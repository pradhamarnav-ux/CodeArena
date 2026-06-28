import { dbAll, dbRun, dbGet } from "./db";
import crypto from "crypto";
import { Server } from "socket.io";
import { checkWin } from "./winChecker";
import { coinService } from "./coinService";

const CF_POLL_INTERVAL_MS = parseInt(
  process.env.CF_POLL_INTERVAL_MS || "30000",
);

// Helper to wait 1.1s to respect CF rate limit
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function fetchCfSubmissions(handle: string) {
  try {
    const res = await fetch(
      `https://codeforces.com/api/user.status?handle=${handle}&count=10`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === "OK") return data.result;
    return null;
  } catch (err) {
    console.error("CF API error for handle", handle, err);
    return null;
  }
}

export function startCfPoller(io: Server) {
  setInterval(async () => {
    try {
      const activeMatches: any[] = await dbAll(
        `SELECT * FROM matches WHERE status = 'active'`,
      );
      if (activeMatches.length === 0) return;

      for (const match of activeMatches) {
        // Check for time out
        const durationMs = match.duration_minutes * 60 * 1000;
        const startedAt = new Date(match.started_at).getTime();
        const now = Date.now();
        if (now > startedAt + durationMs) {
          // Timeout, no winner
          await dbRun(
            `UPDATE matches SET status = 'finished', ended_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [match.id],
          );
          await coinService.refund(match.id);
          io.to(match.id).emit("match_ended_timeout", { matchId: match.id });
          continue;
        }

        const problems = JSON.parse(match.problems);
        const teams: any[] = await dbAll(
          `SELECT * FROM teams WHERE match_id = ?`,
          [match.id],
        );

        let allMembers: any[] = [];
        for (const team of teams) {
          const members: any[] = await dbAll(
            `SELECT * FROM team_members WHERE team_id = ?`,
            [team.id],
          );
          allMembers.push(
            ...members.map((m: any) => ({ ...m, teamName: team.name })),
          );
        }

        let potentialSolves = [];
        for (const member of allMembers) {
          await delay(1100); // 1.1s rate limit per member
          const submissions = await fetchCfSubmissions(member.cf_handle);
          if (!submissions) continue;

          for (const sub of submissions) {
            if (sub.verdict !== "OK") continue;
            if (sub.creationTimeSeconds * 1000 < startedAt) continue;

            const probId = `${sub.problem.contestId}${sub.problem.index}`;
            const probIndex = problems.findIndex((p: any) => p.id === probId);

            if (probIndex !== -1) {
              potentialSolves.push({ member, sub, probId, probIndex });
            }
          }
        }

        // Sort by actual CF submission time to be perfectly fair
        potentialSolves.sort(
          (a, b) => a.sub.creationTimeSeconds - b.sub.creationTimeSeconds,
        );

        let matchOver = false;

        for (const { member, sub, probId, probIndex } of potentialSolves) {
          if (matchOver) break;

          // Check if already solved
          const existing = await dbGet(
            `SELECT id FROM solves WHERE match_id = ? AND team_id = ? AND problem_index = ?`,
            [match.id, member.team_id, probIndex],
          );
          if (existing) continue;

          // Record solve
          const solveId = crypto.randomUUID();
          await dbRun(
            `
            INSERT INTO solves (id, match_id, team_id, problem_id, problem_index, solved_by_handle, cf_submission_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
            [
              solveId,
              match.id,
              member.team_id,
              probId,
              probIndex,
              member.cf_handle,
              sub.id,
            ],
          );

          console.log(
            `New solve! ${member.cf_handle} solved ${probId} for team ${member.teamName}`,
          );
          io.to(match.id).emit("new_solve", {
            matchId: match.id,
            teamId: member.team_id,
            problemIndex: probIndex,
            solvedBy: member.cf_handle,
          });

          // Check win
          const solves: any[] = await dbAll(
            `SELECT problem_index FROM solves WHERE match_id = ? AND team_id = ?`,
            [match.id, member.team_id],
          );
          const solvedIndices = solves.map((s) => s.problem_index);

          const winRes = checkWin(solvedIndices, match.grid_size, "classic");
          if (winRes.hasWon) {
            await dbRun(
              `UPDATE matches SET status = 'finished', winner_team_id = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [member.team_id, match.id],
            );
            await coinService.payout(
              match.id,
              member.team_id,
              match.prize_pool,
            );
            io.to(match.id).emit("match_won", {
              matchId: match.id,
              winnerTeamId: member.team_id,
              winningLine: winRes.winningLine,
              prize: match.prize_pool,
            });
            matchOver = true;
          }
        }
      }
    } catch (err) {
      console.error("Poller error:", err);
    }
  }, CF_POLL_INTERVAL_MS);
}

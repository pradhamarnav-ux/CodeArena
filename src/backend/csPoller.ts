import { dbAll, dbGet, dbRun } from "./db";
import {
  computePoints,
  checkSweepBonus,
  computeMVP,
  payoutCoins,
} from "./csScoring";

// In-memory cache to avoid repeated CF API calls per handle
const recentSubmissionsCache = new Map<string, any[]>();
let lastPolledTimes = new Map<string, number>();

async function fetchCfSubmissions(handle: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://codeforces.com/api/user.status?handle=${handle}&from=1&count=20`,
    );
    const data = await res.json();
    if (data.status === "OK") {
      return data.result;
    }
  } catch (error) {
    console.error("CS Poller fetch error:", error);
  }
  return [];
}

export async function pollClashSquad(io: any) {
  try {
    const activeMatches = await dbAll(
      `SELECT * FROM cs_matches WHERE status = 'active'`,
    );
    if (activeMatches.length === 0) return;

    const allMembers = [];
    for (const match of activeMatches) {
      const teams = await dbAll(`SELECT * FROM cs_teams WHERE match_id = ?`, [
        match.id,
      ]);
      for (const team of teams) {
        const members = await dbAll(
          `SELECT * FROM cs_team_members WHERE team_id = ?`,
          [team.id],
        );
        allMembers.push(
          ...members.map((m) => ({
            ...m,
            matchId: match.id,
            questions: JSON.parse(match.questions),
          })),
        );
      }
    }

    const uniqueHandles = Array.from(
      new Set(allMembers.map((m) => m.cf_handle)),
    );

    for (const handle of uniqueHandles) {
      // Very basic polling rate limit per handle could be handled globally, but let's just fetch
      const submissions = await fetchCfSubmissions(handle);
      if (!submissions || submissions.length === 0) continue;
      recentSubmissionsCache.set(handle, submissions);
    }

    for (const match of activeMatches) {
      const questions = JSON.parse(match.questions);
      const members = allMembers.filter((m) => m.matchId === match.id);
      let newSolves = false;

      let potentialSolves = [];

      for (const member of members) {
        const submissions = recentSubmissionsCache.get(member.cf_handle) || [];
        const matchStartUnix = new Date(match.started_at).getTime() / 1000;

        for (const sub of submissions) {
          if (sub.verdict !== "OK" || sub.creationTimeSeconds < matchStartUnix)
            continue;

          for (const q of questions) {
            const probIdStr = `${sub.problem.contestId}${sub.problem.index}`;
            if (q.problemId === probIdStr) {
              potentialSolves.push({ member, sub, q, probIdStr });
            }
          }
        }
      }

      // Sort by actual CF submission time
      potentialSolves.sort(
        (a, b) => a.sub.creationTimeSeconds - b.sub.creationTimeSeconds,
      );

      for (const { member, sub, q, probIdStr } of potentialSolves) {
        // Check if already solved (might have been solved in a previous poll, or earlier in this sorted loop)
        const existing = await dbGet(
          `SELECT id FROM cs_solves WHERE match_id = ? AND cf_handle = ? AND question_slot = ?`,
          [match.id, member.cf_handle, q.slot],
        );

        if (!existing) {
          // New solve!
          const allSolvesForQ = await dbAll(
            `SELECT id FROM cs_solves WHERE match_id = ? AND question_slot = ?`,
            [match.id, q.slot],
          );
          const solverRank = allSolvesForQ.length;
          const points = computePoints(q.basePoints, q.slot - 1, solverRank);

          await dbRun(
            `INSERT INTO cs_solves (id, match_id, team_id, cf_handle, question_slot, problem_id, points_earned, solver_rank, cf_submission_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              crypto.randomUUID(),
              match.id,
              member.team_id,
              member.cf_handle,
              q.slot,
              probIdStr,
              points,
              solverRank,
              sub.id,
            ],
          );

          await dbRun(
            `UPDATE cs_team_members SET in_game_score = in_game_score + ? WHERE id = ?`,
            [points, member.id],
          );
          await dbRun(
            `UPDATE cs_teams SET in_game_score = in_game_score + ? WHERE id = ?`,
            [points, member.team_id],
          );

          await checkSweepBonus(match.id, q.slot, member.team_id);

          io.to(match.id).emit("cs_solve", {
            handle: member.cf_handle,
            teamId: member.team_id,
            questionSlot: q.slot,
            problemName: q.name,
            points: points,
          });

          newSolves = true;
        }
      }

      if (newSolves) {
        // Check if match ended (all teams solved all questions, etc, or timer. Assuming just checking if all 5 questions solved by both teams here)
        // Note: For simplicity, timer ending is usually checked separately or via force end API
      }
    }
  } catch (err) {
    console.error("csPoller error:", err);
  }
}

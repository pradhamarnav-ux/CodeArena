import { dbAll, dbGet, dbRun } from "./db";
import { computeEliminations, advanceRound } from "./brElimination";

export async function pollBattleRoyale(io: any) {
  try {
    const activeMatches = await dbAll(
      `SELECT * FROM br_matches WHERE status = 'active'`,
    );
    if (activeMatches.length === 0) return;

    for (const match of activeMatches) {
      const players = await dbAll(
        `SELECT * FROM br_players WHERE match_id = ? AND status = 'alive'`,
        [match.id],
      );
      if (players.length === 0) continue;

      const questions = JSON.parse(match.questions);
      const currentQ = questions.find(
        (q: any) => q.slot === match.current_round,
      );
      if (!currentQ) continue;

      let newSolves = false;

      let potentialSolves = [];

      for (const player of players) {
        try {
          const res = await fetch(
            `https://codeforces.com/api/user.status?handle=${player.cf_handle}&from=1&count=5`,
          );
          const data = await res.json();
          if (data.status !== "OK") continue;

          const submissions = data.result;
          const matchStartUnix = new Date(match.started_at).getTime() / 1000;

          for (const sub of submissions) {
            if (
              sub.verdict !== "OK" ||
              sub.creationTimeSeconds < matchStartUnix
            )
              continue;

            const probIdStr = `${sub.problem.contestId}${sub.problem.index}`;
            if (probIdStr === currentQ.problemId) {
              potentialSolves.push({ player, sub, probIdStr });
            }
          }
        } catch (e) {
          // ignore fetch error per user
        }
      }

      // Sort by actual CF submission time
      potentialSolves.sort(
        (a, b) => a.sub.creationTimeSeconds - b.sub.creationTimeSeconds,
      );

      for (const { player, sub, probIdStr } of potentialSolves) {
        const existing = await dbGet(
          `SELECT id FROM br_solves WHERE match_id = ? AND player_id = ? AND round_number = ?`,
          [match.id, player.id, match.current_round],
        );
        if (!existing) {
          const solveTimeMs =
            sub.creationTimeSeconds * 1000 -
            new Date(match.started_at).getTime();
          await dbRun(
            `INSERT INTO br_solves (id, match_id, player_id, cf_handle, round_number, problem_id, solve_time_ms, cf_submission_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              crypto.randomUUID(),
              match.id,
              player.id,
              player.cf_handle,
              match.current_round,
              probIdStr,
              solveTimeMs,
              sub.id,
            ],
          );

          await dbRun(
            `UPDATE br_players SET total_solve_time_ms = total_solve_time_ms + ? WHERE id = ?`,
            [solveTimeMs, player.id],
          );

          const solvedCount = await dbGet(
            `SELECT COUNT(*) as count FROM br_solves WHERE match_id = ? AND round_number = ?`,
            [match.id, match.current_round],
          );

          io.to(match.id).emit("br_solve", {
            handle: player.cf_handle,
            round: match.current_round,
            problemName: currentQ.name,
            solvedCount: solvedCount.count,
            totalAlive: players.length,
          });

          newSolves = true;
        }
      }

      if (newSolves) {
        // check if everyone alive has solved
        const solves = await dbAll(
          `SELECT id FROM br_solves WHERE match_id = ? AND round_number = ?`,
          [match.id, match.current_round],
        );
        if (solves.length >= players.length) {
          await computeEliminations(match.id, match.current_round, io);
          await advanceRound(match.id, io);
        }
      }
    }
  } catch (err) {
    console.error("brPoller error:", err);
  }
}

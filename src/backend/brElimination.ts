import { dbAll, dbGet, dbRun } from "./db";

export async function computeEliminations(
  matchId: string,
  roundNumber: number,
  io: any,
): Promise<void> {
  const alivePlayers = await dbAll(
    `SELECT * FROM br_players WHERE match_id = ? AND status = 'alive'`,
    [matchId],
  );
  if (alivePlayers.length === 0) return;

  const solves = await dbAll(
    `SELECT * FROM br_solves WHERE match_id = ? AND round_number = ?`,
    [matchId, roundNumber],
  );

  // Rank players: unsolved first, then by solve_time_ms ascending, then by cf_submission_id
  const rankedPlayers = alivePlayers.sort((a, b) => {
    const solveA = solves.find((s) => s.player_id === a.id);
    const solveB = solves.find((s) => s.player_id === b.id);

    if (!solveA && solveB) return 1;
    if (solveA && !solveB) return -1;
    if (!solveA && !solveB) return 0; // both unsolved

    if (solveA.solve_time_ms !== solveB.solve_time_ms) {
      return solveA.solve_time_ms - solveB.solve_time_ms;
    }

    return (solveB.cf_submission_id || 0) - (solveA.cf_submission_id || 0); // higher submission ID = later = worse
  });

  let eliminateCount = Math.max(1, Math.floor(alivePlayers.length * 0.25));

  // Special case: round 5, eliminate all but rank-0
  if (roundNumber === 5) {
    eliminateCount = alivePlayers.length - 1;
  }

  // If everyone is eliminated, keep the best one
  if (eliminateCount >= alivePlayers.length) {
    eliminateCount = alivePlayers.length - 1;
  }

  const eliminatedPlayers = rankedPlayers.slice(-eliminateCount);

  for (const player of eliminatedPlayers) {
    const solve = solves.find((s) => s.player_id === player.id);
    const reason = solve ? "slowest" : "unsolved";

    await dbRun(
      `INSERT INTO br_eliminations (id, match_id, round_number, player_id, cf_handle, reason) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        matchId,
        roundNumber,
        player.id,
        player.cf_handle,
        reason,
      ],
    );

    await dbRun(
      `UPDATE br_players SET status = 'eliminated', eliminated_in_round = ?, elimination_reason = ? WHERE id = ?`,
      [roundNumber, reason, player.id],
    );

    io.to(matchId).emit("elimination", {
      handle: player.cf_handle,
      round: roundNumber,
      reason: reason,
    });
  }

  const remainingPlayers = alivePlayers.length - eliminateCount;

  if (remainingPlayers === 1) {
    const winner = rankedPlayers[0];
    await dbRun(`UPDATE br_players SET status = 'winner' WHERE id = ?`, [
      winner.id,
    ]);
    await dbRun(
      `UPDATE br_matches SET status = 'finished', winner_user_id = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [winner.user_id, matchId],
    );

    if (winner.user_id) {
      await dbRun(
        `INSERT INTO coin_transactions (id, user_id, match_id, amount, type, game_mode) VALUES (?, ?, ?, ?, ?, 'battle_royale')`,
        [crypto.randomUUID(), winner.user_id, matchId, 1000, "br_prize_win"],
      );
      await dbRun(
        `UPDATE users SET coin_balance = coin_balance + 1000, matches_won = matches_won + 1 WHERE id = ?`,
        [winner.user_id],
      );
    }

    io.to(matchId).emit("match_ended", { winner: winner.cf_handle });
  } else if (remainingPlayers === 0) {
    await dbRun(
      `UPDATE br_matches SET status = 'finished', ended_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [matchId],
    );
    io.to(matchId).emit("match_ended", { winner: null });
  }
}

export async function advanceRound(matchId: string, io: any): Promise<void> {
  await dbRun(
    `UPDATE br_matches SET current_round = current_round + 1 WHERE id = ?`,
    [matchId],
  );
  io.to(matchId).emit("round_transition", {
    nextRoundStart: Date.now() + 10000,
  });
}

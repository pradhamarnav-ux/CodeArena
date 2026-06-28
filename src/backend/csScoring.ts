import { dbAll, dbGet, dbRun } from "./db";

export function computePoints(
  basePoints: number,
  questionIndex: number,
  solverRank: number,
): number {
  const offset = (questionIndex + 1) * 100;
  const pts = basePoints - offset * solverRank;
  return Math.max(pts, 50);
}

export async function checkSweepBonus(
  matchId: string,
  questionSlot: number,
  teamId: string,
): Promise<void> {
  // query cs_solves for this question
  const solves = await dbAll(
    `SELECT * FROM cs_solves WHERE match_id = ? AND question_slot = ? ORDER BY solved_at ASC`,
    [matchId, questionSlot],
  );

  // check if all members of teamId solved before any member of the other team
  const otherTeamSolves = solves.filter((s) => s.team_id !== teamId);
  const thisTeamSolves = solves.filter((s) => s.team_id === teamId);

  if (thisTeamSolves.length === 0) return;

  const teamMembers = await dbAll(
    `SELECT id FROM cs_team_members WHERE team_id = ?`,
    [teamId],
  );

  if (thisTeamSolves.length === teamMembers.length) {
    const lastThisTeamSolveTime = new Date(
      thisTeamSolves[thisTeamSolves.length - 1].solved_at,
    ).getTime();

    // Check if other team solved before our last solve
    let otherTeamBeatUs = false;
    for (const solve of otherTeamSolves) {
      if (new Date(solve.solved_at).getTime() < lastThisTeamSolveTime) {
        otherTeamBeatUs = true;
        break;
      }
    }

    if (!otherTeamBeatUs) {
      // Check if bonus already awarded
      const existingBonus = await dbGet(
        `SELECT id FROM cs_sweep_bonuses WHERE match_id = ? AND question_slot = ? AND team_id = ?`,
        [matchId, questionSlot, teamId],
      );
      if (!existingBonus) {
        const id = crypto.randomUUID();
        await dbRun(
          `INSERT INTO cs_sweep_bonuses (id, match_id, team_id, question_slot, bonus_points) VALUES (?, ?, ?, ?, ?)`,
          [id, matchId, teamId, questionSlot, 500],
        );
        await dbRun(
          `UPDATE cs_teams SET in_game_score = in_game_score + 500 WHERE id = ?`,
          [teamId],
        );
      }
    }
  }
}

export async function computeMVP(
  matchId: string,
  winnerTeamId: string,
): Promise<void> {
  const members = await dbAll(
    `SELECT id, user_id, cf_handle, in_game_score FROM cs_team_members WHERE team_id = ?`,
    [winnerTeamId],
  );
  if (!members || members.length === 0) return;

  let mvpId = members[0].id;
  let maxScore = members[0].in_game_score;
  let maxSolves = 0;
  let earliestLastSolve = Infinity;

  for (const member of members) {
    const memberSolves = await dbAll(
      `SELECT solved_at FROM cs_solves WHERE match_id = ? AND cf_handle = ? ORDER BY solved_at DESC`,
      [matchId, member.cf_handle],
    );

    const solveCount = memberSolves.length;
    const lastSolveTime =
      solveCount > 0 ? new Date(memberSolves[0].solved_at).getTime() : 0;

    let isBetter = false;
    if (member.in_game_score > maxScore) {
      isBetter = true;
    } else if (member.in_game_score === maxScore) {
      if (solveCount > maxSolves) {
        isBetter = true;
      } else if (solveCount === maxSolves) {
        if (lastSolveTime < earliestLastSolve) {
          isBetter = true;
        }
      }
    }

    if (isBetter) {
      mvpId = member.id;
      maxScore = member.in_game_score;
      maxSolves = solveCount;
      earliestLastSolve = lastSolveTime;
    }
  }

  await dbRun(`UPDATE cs_team_members SET is_mvp = 1 WHERE id = ?`, [mvpId]);
}

export async function payoutCoins(
  matchId: string,
  winnerTeamId: string,
): Promise<void> {
  const members = await dbAll(
    `SELECT id, user_id, is_mvp FROM cs_team_members WHERE team_id = ?`,
    [winnerTeamId],
  );

  for (const member of members) {
    if (!member.user_id) continue;

    const amount = member.is_mvp ? 500 : 100;
    const type = member.is_mvp ? "cs_mvp_win" : "cs_member_win";

    await dbRun(
      `INSERT INTO coin_transactions (id, user_id, match_id, amount, type, game_mode) VALUES (?, ?, ?, ?, ?, 'clash_squad')`,
      [crypto.randomUUID(), member.user_id, matchId, amount, type],
    );

    // Check if wager needs to be added too if there was a prize pool (but requirements said: "Only the FINAL COIN REWARD (not in-game solve points) is saved to player accounts. MVP of the winning team gets 500 coins, every other winning member gets 100 coins." It didn't mention adding the wager pool back to the winners explicitly other than those rewards. Wait, it says "prize pool = wager * 2". Let's give them the wager back or let's assume the 500/100 is the main reward, but what about the prize pool? I will add their portion of the prize pool if they wagered.)
    // The prompt: "MVP of winning team gets 500 coins, every other winning member gets 100 coins." Let's stick strictly to what the prompt says.
    await dbRun(
      `UPDATE users SET coin_balance = coin_balance + ?, matches_won = matches_won + 1 WHERE id = ?`,
      [amount, member.user_id],
    );
  }
}

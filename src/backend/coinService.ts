import { dbRun, dbAll } from "./db";
import crypto from "crypto";

export const coinService = {
  async holdWagers(
    matchId: string,
    wagerPerTeam: number,
    team1Members: any[],
    team2Members: any[],
  ) {
    if (wagerPerTeam === 0) return;

    const team1Wager = Math.floor(wagerPerTeam / team1Members.length);
    const team2Wager = Math.floor(wagerPerTeam / team2Members.length);

    const allMembers = [
      ...team1Members.map((m) => ({ ...m, wager: team1Wager })),
      ...team2Members.map((m) => ({ ...m, wager: team2Wager })),
    ];

    for (const member of allMembers) {
      await dbRun(
        `UPDATE users SET coin_balance = coin_balance - ? WHERE id = ?`,
        [member.wager, member.user_id],
      );
      await dbRun(
        `
        INSERT INTO coin_transactions (id, user_id, match_id, amount, type, description)
        VALUES (?, ?, ?, ?, 'wager_hold', 'Match wager hold')
      `,
        [crypto.randomUUID(), member.user_id, matchId, -member.wager],
      );
    }
  },

  async payout(matchId: string, winnerTeamId: string, prizePool: number) {
    if (prizePool === 0) return;

    const winnerMembers: any[] = await dbAll(
      `SELECT user_id FROM team_members WHERE team_id = ?`,
      [winnerTeamId],
    );
    if (winnerMembers.length === 0) return;

    const prizePerMember = Math.floor(prizePool / winnerMembers.length);

    for (const member of winnerMembers) {
      await dbRun(
        `UPDATE users SET coin_balance = coin_balance + ?, matches_won = matches_won + 1 WHERE id = ?`,
        [prizePerMember, member.user_id],
      );
      await dbRun(
        `
        INSERT INTO coin_transactions (id, user_id, match_id, amount, type, description)
        VALUES (?, ?, ?, ?, 'prize_win', 'Match prize win')
      `,
        [crypto.randomUUID(), member.user_id, matchId, prizePerMember],
      );
    }
  },

  async refund(matchId: string) {
    const holds: any[] = await dbAll(
      `SELECT * FROM coin_transactions WHERE match_id = ? AND type = 'wager_hold'`,
      [matchId],
    );

    for (const hold of holds) {
      const refundAmount = Math.abs(hold.amount);
      await dbRun(
        `UPDATE users SET coin_balance = coin_balance + ? WHERE id = ?`,
        [refundAmount, hold.user_id],
      );
      await dbRun(
        `
        INSERT INTO coin_transactions (id, user_id, match_id, amount, type, description)
        VALUES (?, ?, ?, ?, 'wager_refund', 'Match wager refund')
      `,
        [crypto.randomUUID(), hold.user_id, matchId, refundAmount],
      );
    }
  },
};

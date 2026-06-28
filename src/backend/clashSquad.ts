import express from "express";
import { dbAll, dbGet, dbRun } from "./db";
import crypto from "crypto";
import fetch from "node-fetch";

const router = express.Router();

import { getUserFromReq } from "./api";

router.post("/create", async (req, res) => {
  try {
    const authUser = getUserFromReq(req);
    let creatorHandle = "";
    if (authUser) {
      const u: any = await dbGet(`SELECT cf_handle FROM users WHERE id = ?`, [
        authUser.id,
      ]);
      if (u) creatorHandle = u.cf_handle;
    }

    const { duration_minutes, wager_per_team, team1, team2 } = req.body;

    const allHandles = [
      ...team1.members.map((m: any) => m.handle.toLowerCase()),
      ...team2.members.map((m: any) => m.handle.toLowerCase()),
    ];
    const uniqueHandles = new Set(allHandles);
    if (uniqueHandles.size !== allHandles.length) {
      return res
        .status(400)
        .json({ error: "Duplicate handles are not allowed." });
    }

    // Fetch CF problems for 5 slots
    const problemsResp = await fetch(
      "https://codeforces.com/api/problemset.problems",
    );
    const problemsData: any = await problemsResp.json();
    if (problemsData.status !== "OK") {
      return res.status(500).json({ error: "Failed to fetch CF problems" });
    }

    const allProblems = problemsData.result.problems.filter(
      (p: any) => p.rating !== undefined,
    );
    const slots = [
      { min: 800, max: 1000, basePoints: 500 },
      { min: 1000, max: 1200, basePoints: 1000 },
      { min: 1200, max: 1400, basePoints: 1500 },
      { min: 1400, max: 1600, basePoints: 2000 },
      { min: 1600, max: 1900, basePoints: 2500 },
    ];

    const matchQuestions = [];
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const validProblems = allProblems.filter(
        (p: any) => p.rating >= slot.min && p.rating <= slot.max,
      );
      if (validProblems.length === 0) {
        return res.status(500).json({
          error: `Not enough CF problems for rating ${slot.min}-${slot.max}`,
        });
      }
      const randomProblem =
        validProblems[Math.floor(Math.random() * validProblems.length)];
      matchQuestions.push({
        slot: i + 1,
        problemId: `${randomProblem.contestId}${randomProblem.index}`,
        name: randomProblem.name,
        rating: randomProblem.rating,
        url: `https://codeforces.com/contest/${randomProblem.contestId}/problem/${randomProblem.index}`,
        basePoints: slot.basePoints,
      });
    }

    const matchId = crypto.randomUUID();
    const prizePool = (wager_per_team || 0) * 2;

    await dbRun(
      `INSERT INTO cs_matches (id, status, duration_minutes, wager_per_team, prize_pool, questions, started_at, creator_id) VALUES (?, 'pending', ?, ?, ?, ?, null, ?)`,
      [
        matchId,
        duration_minutes || 60,
        wager_per_team || 0,
        prizePool,
        JSON.stringify(matchQuestions),
        authUser?.id || null,
      ],
    );

    // Insert Teams
    const t1Id = crypto.randomUUID();
    const t2Id = crypto.randomUUID();
    await dbRun(
      `INSERT INTO cs_teams (id, match_id, name, color) VALUES (?, ?, ?, 'teal')`,
      [t1Id, matchId, team1.name],
    );
    await dbRun(
      `INSERT INTO cs_teams (id, match_id, name, color) VALUES (?, ?, ?, 'purple')`,
      [t2Id, matchId, team2.name],
    );

    const io = req.app.get("io");

    for (const m of team1.members) {
      const accepted =
        m.handle.toLowerCase() === creatorHandle?.toLowerCase() ? 1 : 0;
      const tmId = crypto.randomUUID();
      await dbRun(
        `INSERT INTO cs_team_members (id, team_id, user_id, cf_handle, accepted) VALUES (?, ?, ?, ?, ?)`,
        [tmId, t1Id, m.user_id || null, m.handle, accepted],
      );
      if (!accepted && io) {
        io.to(`cf_${m.handle.toLowerCase()}`).emit("new_invitation", {
          invite_id: tmId,
          match_id: matchId,
          mode: "Clash Squad",
          created_at: new Date().toISOString(),
          host_name: authUser?.username || "Unknown Host",
          host_cf_handle: creatorHandle || "Unknown",
          wager: wager_per_team || 0,
        });
      }
    }
    for (const m of team2.members) {
      const accepted =
        m.handle.toLowerCase() === creatorHandle?.toLowerCase() ? 1 : 0;
      const tmId = crypto.randomUUID();
      await dbRun(
        `INSERT INTO cs_team_members (id, team_id, user_id, cf_handle, accepted) VALUES (?, ?, ?, ?, ?)`,
        [tmId, t2Id, m.user_id || null, m.handle, accepted],
      );
      if (!accepted && io) {
        io.to(`cf_${m.handle.toLowerCase()}`).emit("new_invitation", {
          invite_id: tmId,
          match_id: matchId,
          mode: "Clash Squad",
          created_at: new Date().toISOString(),
          host_name: authUser?.username || "Unknown Host",
          host_cf_handle: creatorHandle || "Unknown",
          wager: wager_per_team || 0,
        });
      }
    }

    res.json({ matchId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/ready", async (req, res) => {
  try {
    const authUser = getUserFromReq(req);
    if (!authUser) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;

    const tm = await dbGet(
      `SELECT tm.id, tm.is_ready FROM cs_team_members tm JOIN cs_teams t ON tm.team_id = t.id WHERE t.match_id = ? AND tm.user_id = ?`,
      [id, authUser.id],
    );
    if (!tm) return res.status(404).json({ error: "Not in this match" });

    await dbRun(`UPDATE cs_team_members SET is_ready = ? WHERE id = ?`, [
      tm.is_ready ? 0 : 1,
      tm.id,
    ]);

    const io = req.app.get("io");
    if (io) {
      io.to(id).emit("match_updated");
    }

    res.json({ success: true, is_ready: !tm.is_ready });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:id/start", async (req, res) => {
  try {
    const authUser = getUserFromReq(req);
    if (!authUser) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;

    const match: any = await dbGet(`SELECT * FROM cs_matches WHERE id = ?`, [
      id,
    ]);
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.creator_id !== authUser.id)
      return res
        .status(403)
        .json({ error: "Only the host can start the match" });

    const count: any = await dbGet(
      `SELECT COUNT(*) as c FROM cs_team_members tm2 JOIN cs_teams t2 ON tm2.team_id = t2.id WHERE t2.match_id = ? AND (tm2.accepted = 0 OR tm2.is_ready = 0)`,
      [id],
    );
    if (count.c > 0)
      return res.status(400).json({ error: "Not all players are ready" });

    await dbRun(
      `UPDATE cs_matches SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id],
    );

    const io = req.app.get("io");
    if (io) {
      io.to(id).emit("match_started");
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/:matchId", async (req, res) => {
  try {
    const matchId = req.params.matchId;
    const match = await dbGet(`SELECT * FROM cs_matches WHERE id = ?`, [
      matchId,
    ]);
    if (!match) return res.status(404).json({ error: "Not found" });

    match.questions = JSON.parse(match.questions);

    const teams = await dbAll(`SELECT * FROM cs_teams WHERE match_id = ?`, [
      matchId,
    ]);
    for (const team of teams) {
      team.members = await dbAll(
        `SELECT * FROM cs_team_members WHERE team_id = ?`,
        [team.id],
      );
    }
    match.teams = teams;

    const solves = await dbAll(
      `SELECT * FROM cs_solves WHERE match_id = ? ORDER BY solved_at ASC`,
      [matchId],
    );
    match.solves = solves;

    const bonuses = await dbAll(
      `SELECT * FROM cs_sweep_bonuses WHERE match_id = ?`,
      [matchId],
    );
    match.bonuses = bonuses;

    res.json(match);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:matchId/end", async (req, res) => {
  // force end match logic
  res.json({ success: true });
});

export default router;

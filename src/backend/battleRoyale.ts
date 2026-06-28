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

    const { players } = req.body;
    if (!players || players.length < 5 || players.length > 20) {
      return res
        .status(400)
        .json({ error: "Battle Royale requires 5 to 20 players." });
    }

    const allHandles = players.map((m: any) => m.handle.toLowerCase());
    const uniqueHandles = new Set(allHandles);
    if (uniqueHandles.size !== allHandles.length) {
      return res
        .status(400)
        .json({ error: "Duplicate handles are not allowed." });
    }

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
      { min: 800, max: 1000 },
      { min: 1000, max: 1200 },
      { min: 1200, max: 1500 },
      { min: 1500, max: 1800 },
      { min: 1800, max: 2200 },
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
      });
    }

    const matchId = crypto.randomUUID();

    await dbRun(
      `INSERT INTO br_matches (id, status, current_round, questions, started_at, creator_id) VALUES (?, 'pending', 1, ?, null, ?)`,
      [matchId, JSON.stringify(matchQuestions), authUser?.id || null],
    );

    const io = req.app.get("io");

    for (const m of players) {
      const accepted =
        m.handle.toLowerCase() === creatorHandle?.toLowerCase() ? 1 : 0;
      const tmId = crypto.randomUUID();
      await dbRun(
        `INSERT INTO br_players (id, match_id, user_id, cf_handle, accepted) VALUES (?, ?, ?, ?, ?)`,
        [tmId, matchId, m.user_id || null, m.handle, accepted],
      );
      if (!accepted && io) {
        io.to(`cf_${m.handle.toLowerCase()}`).emit("new_invitation", {
          invite_id: tmId,
          match_id: matchId,
          mode: "Battle Royale",
          created_at: new Date().toISOString(),
          host_name: authUser?.username || "Unknown Host",
          host_cf_handle: creatorHandle || "Unknown",
          wager: 0,
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
      `SELECT id, is_ready FROM br_players WHERE match_id = ? AND user_id = ?`,
      [id, authUser.id],
    );
    if (!tm) return res.status(404).json({ error: "Not in this match" });

    await dbRun(`UPDATE br_players SET is_ready = ? WHERE id = ?`, [
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

    const match: any = await dbGet(`SELECT * FROM br_matches WHERE id = ?`, [
      id,
    ]);
    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.creator_id !== authUser.id)
      return res
        .status(403)
        .json({ error: "Only the host can start the match" });

    const count: any = await dbGet(
      `SELECT COUNT(*) as c FROM br_players WHERE match_id = ? AND (accepted = 0 OR is_ready = 0)`,
      [id],
    );
    if (count.c > 0)
      return res.status(400).json({ error: "Not all players are ready" });

    await dbRun(
      `UPDATE br_matches SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE id = ?`,
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
    const match = await dbGet(`SELECT * FROM br_matches WHERE id = ?`, [
      matchId,
    ]);
    if (!match) return res.status(404).json({ error: "Not found" });

    match.questions = JSON.parse(match.questions);

    const players = await dbAll(`SELECT * FROM br_players WHERE match_id = ?`, [
      matchId,
    ]);
    match.players = players;

    const solves = await dbAll(
      `SELECT * FROM br_solves WHERE match_id = ? ORDER BY solved_at ASC`,
      [matchId],
    );
    match.solves = solves;

    const eliminations = await dbAll(
      `SELECT * FROM br_eliminations WHERE match_id = ? ORDER BY round_number ASC`,
      [matchId],
    );
    match.eliminations = eliminations;

    res.json(match);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:matchId/forceEnd", async (req, res) => {
  res.json({ success: true });
});

export default router;

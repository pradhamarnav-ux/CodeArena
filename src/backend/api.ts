import { Express } from "express";
import { Server } from "socket.io";
import { dbAll, dbGet, dbRun } from "./db";
import crypto from "crypto";
import { coinService } from "./coinService";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const JWT_SECRET = process.env.JWT_SECRET || "codearena-secret";
const cfVerifications = new Map<string, string>();

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || "123456789-abc.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "fake-secret";

export function getUserFromReq(req: any) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded; // { id, username }
  } catch (e) {
    return null;
  }
}

export function setupApiRoutes(app: Express, io: Server) {
  // Auth
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, username, cf_handle, password } = req.body;
      const id = crypto.randomUUID();
      const password_hash = await bcrypt.hash(password, 10);

      await dbRun(
        `INSERT INTO users (id, email, username, cf_handle, password_hash, provider, display_name) VALUES (?, ?, ?, ?, ?, 'local', ?)`,
        [id, email, username, cf_handle, password_hash, username],
      );

      const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: "7d" });
      res.json({
        token,
        user: { id, email, username, cf_handle, coin_balance: 500 },
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user: any = await dbGet(`SELECT * FROM users WHERE email = ?`, [
        email,
      ]);
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "7d" },
      );
      const { password_hash, ...userWithoutPass } = user;
      res.json({ token, user: userWithoutPass });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/auth/codeforces/request", async (req, res) => {
    const { handle } = req.body;
    if (!handle) return res.status(400).json({ error: "Handle required" });
    const token = "CA-" + crypto.randomBytes(4).toString("hex").toUpperCase();
    cfVerifications.set(handle.toLowerCase(), token);
    res.json({ token });
  });

  app.post("/api/auth/codeforces/verify", async (req, res) => {
    try {
      const { handle, token } = req.body;
      const expectedToken = cfVerifications.get(handle.toLowerCase());
      if (!expectedToken || expectedToken !== token) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }

      const cfRes = await fetch(
        `https://codeforces.com/api/user.info?handles=${handle}`,
      );
      const data: any = await cfRes.json();
      if (data.status !== "OK")
        return res.status(400).json({ error: "CF API error" });

      const cfUser = data.result[0];
      if (cfUser.firstName !== token) {
        return res
          .status(400)
          .json({ error: "First name does not match the token" });
      }

      let user: any = await dbGet(`SELECT * FROM users WHERE cf_handle = ?`, [
        handle,
      ]);
      if (!user) {
        const id = crypto.randomUUID();
        const username = `cf_${handle}`;
        const email = `${handle}@codeforces.local`;
        await dbRun(
          `INSERT INTO users (id, email, username, cf_handle, password_hash, provider, display_name, profile_picture) VALUES (?, ?, ?, ?, ?, 'codeforces', ?, ?)`,
          [id, email, username, handle, "cf_login_no_password", handle, cfUser.titlePhoto || ""],
        );
        user = { id, username, cf_handle: handle, email };
      }

      const jwtToken = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "7d" },
      );
      cfVerifications.delete(handle.toLowerCase());
      res.json({ token: jwtToken, user });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/auth/google/url", (req, res) => {
    const redirectUri = `${req.headers.origin || "http://localhost:3000"}/api/auth/google/callback`;
    const oAuth2Client = new OAuth2Client(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      redirectUri,
    );
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
    });
    res.json({ url: authUrl });
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code } = req.query;
      const redirectUri = `${process.env.APP_URL || "http://localhost:3000"}/api/auth/google/callback`;
      const client = new OAuth2Client(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        redirectUri,
      );

      const { tokens } = await client.getToken(code as string);
      client.setCredentials(tokens);

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload()!;

      let user: any = await dbGet(`SELECT * FROM users WHERE email = ?`, [
        payload.email,
      ]);
      if (!user) {
        const id = crypto.randomUUID();
        const username = `google_${payload.email?.split("@")[0]}_${crypto.randomBytes(2).toString("hex")}`;
        await dbRun(
          `INSERT INTO users (id, email, username, cf_handle, password_hash, provider, display_name, profile_picture) VALUES (?, ?, ?, ?, ?, 'google', ?, ?)`,
          [id, payload.email, username, null, "google_login_no_password", payload.name || username, payload.picture || ""],
        );
        user = { id, username, email: payload.email };
      } else {
        // Link logic (just sign in as them, maybe update provider if we want)
      }

      const jwtToken = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "7d" },
      );

      res.send(`
        <html><body><script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${jwtToken}' }, '*');
            window.close();
          } else {
            window.location.href = '/profile';
          }
        </script></body></html>
      `);
    } catch (e: any) {
      res.send(`
        <html><body><script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: \`${e.message}\` }, '*');
            window.close();
          } else {
            window.location.href = '/login?error=' + encodeURIComponent(\`${e.message}\`);
          }
        </script></body></html>
      `);
    }
  });

  app.post("/api/auth/extend", async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "No token" });
      
      const decoded: any = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
      const user: any = await dbGet(`SELECT id, username FROM users WHERE id = ?`, [decoded.id]);
      
      if (!user) return res.status(401).json({ error: "User not found" });

      const newToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ token: newToken });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/auth/github/url", (req, res) => {
    const redirectUri = `${req.headers.origin || "http://localhost:3000"}/api/auth/github/callback`;
    const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "fake_github_client_id";
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: "user:email",
    });
    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
    res.json({ url: authUrl });
  });

  app.get("/api/auth/github/callback", async (req, res) => {
    try {
      const { code } = req.query;
      const redirectUri = `${process.env.APP_URL || "http://localhost:3000"}/api/auth/github/callback`;
      const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "fake_github_client_id";
      const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "fake_github_client_secret";

      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      });

      const tokenData: any = await tokenRes.json();
      if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);

      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      const emails: any = await emailRes.json();
      const primaryEmailObj = emails.find((e: any) => e.primary && e.verified) || emails.find((e: any) => e.verified) || emails[0];
      const email = primaryEmailObj?.email;

      if (!email) throw new Error("No email found on GitHub account");

      const profileRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      const profile = await profileRes.json();

      let user: any = await dbGet(`SELECT * FROM users WHERE email = ?`, [email]);
      if (!user) {
        const id = crypto.randomUUID();
        const username = profile.login || `github_${email.split("@")[0]}_${crypto.randomBytes(2).toString("hex")}`;
        await dbRun(
          `INSERT INTO users (id, email, username, cf_handle, password_hash, provider, display_name, profile_picture) VALUES (?, ?, ?, ?, ?, 'github', ?, ?)`,
          [id, email, username, null, "github_login_no_password", profile.name || username, profile.avatar_url || ""]
        );
        user = { id, username, email };
      } else {
        // Link logic (just sign in as them, maybe update provider if we want)
      }

      const jwtToken = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.send(`
        <html><body><script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${jwtToken}' }, '*');
            window.close();
          } else {
            window.location.href = '/profile';
          }
        </script></body></html>
      `);
    } catch (e: any) {
      res.send(`
        <html><body><script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: \`${e.message}\` }, '*');
            window.close();
          } else {
            window.location.href = '/login?error=' + encodeURIComponent(\`${e.message}\`);
          }
        </script></body></html>
      `);
    }
  });

  app.get("/api/users/me", async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "No token" });
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const user: any = await dbGet(
        `SELECT id, email, username, cf_handle, coin_balance, matches_played, matches_won, provider, display_name, profile_picture FROM users WHERE id = ?`,
        [decoded.id],
      );
      const transactions = await dbAll(
        `SELECT * FROM coin_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
        [user.id],
      );
      user.transactions = transactions;
      res.json(user);
    } catch (e: any) {
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  app.get("/api/users/me/invitations", async (req, res) => {
    try {
      const authUser = getUserFromReq(req);
      if (!authUser) return res.status(401).json({ error: "Unauthorized" });

      const u: any = await dbGet(`SELECT cf_handle FROM users WHERE id = ?`, [
        authUser.id,
      ]);
      if (!u || !u.cf_handle) return res.json([]);

      const handle = u.cf_handle.toLowerCase();

      // Get pending matches
      const arenaInvites = await dbAll(
        `
        SELECT m.id as match_id, m.created_at, '1v1 Arena' as mode, tm.id as invite_id,
               COALESCE(u.username, 'Unknown Host') as host_name,
               COALESCE(u.cf_handle, 'Unknown') as host_cf_handle,
               m.wager_per_team as wager
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN matches m ON t.match_id = m.id
        LEFT JOIN users u ON m.creator_id = u.id
        WHERE LOWER(tm.cf_handle) = ? AND tm.accepted = 0 AND m.status = 'pending'
      `,
        [handle],
      );

      const csInvites = await dbAll(
        `
        SELECT m.id as match_id, m.created_at, 'Clash Squad' as mode, tm.id as invite_id,
               COALESCE(u.username, 'Unknown Host') as host_name,
               COALESCE(u.cf_handle, 'Unknown') as host_cf_handle,
               m.wager_per_team as wager
        FROM cs_team_members tm
        JOIN cs_teams t ON tm.team_id = t.id
        JOIN cs_matches m ON t.match_id = m.id
        LEFT JOIN users u ON m.creator_id = u.id
        WHERE LOWER(tm.cf_handle) = ? AND tm.accepted = 0 AND m.status = 'pending'
      `,
        [handle],
      );

      const brInvites = await dbAll(
        `
        SELECT m.id as match_id, m.created_at, 'Battle Royale' as mode, p.id as invite_id,
               COALESCE(u.username, 'Unknown Host') as host_name,
               COALESCE(u.cf_handle, 'Unknown') as host_cf_handle,
               0 as wager
        FROM br_players p
        JOIN br_matches m ON p.match_id = m.id
        LEFT JOIN users u ON m.creator_id = u.id
        WHERE LOWER(p.cf_handle) = ? AND p.accepted = 0 AND m.status = 'pending'
      `,
        [handle],
      );

      const all = [...arenaInvites, ...csInvites, ...brInvites].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      res.json(all);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/invitations/:id/accept", async (req, res) => {
    try {
      const authUser = getUserFromReq(req);
      if (!authUser) return res.status(401).json({ error: "Unauthorized" });
      const { id } = req.params;

      // Check arena
      const tm = await dbGet(`SELECT t.match_id FROM team_members tm JOIN teams t ON tm.team_id = t.id WHERE tm.id = ?`, [
        id,
      ]);
      if (tm) {
        await dbRun(`UPDATE team_members SET accepted = 1, user_id = ? WHERE id = ?`, [authUser.id, id]);
        io.to(tm.match_id).emit("match_updated");
        return res.json({ success: true, mode: "Arena" });
      }

      // Check CS
      const cstm = await dbGet(
        `SELECT t.match_id FROM cs_team_members tm JOIN cs_teams t ON tm.team_id = t.id WHERE tm.id = ?`,
        [id],
      );
      if (cstm) {
        await dbRun(`UPDATE cs_team_members SET accepted = 1, user_id = ? WHERE id = ?`, [
          authUser.id,
          id,
        ]);
        io.to(cstm.match_id).emit("match_updated");
        return res.json({ success: true, mode: "Clash Squad" });
      }

      // Check BR
      const brp = await dbGet(`SELECT match_id FROM br_players WHERE id = ?`, [
        id,
      ]);
      if (brp) {
        await dbRun(`UPDATE br_players SET accepted = 1, user_id = ? WHERE id = ?`, [authUser.id, id]);
        io.to(brp.match_id).emit("match_updated");
        return res.json({ success: true, mode: "Battle Royale" });
      }

      res.status(404).json({ error: "Invitation not found" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/invitations/:id/decline", async (req, res) => {
    try {
      const authUser = getUserFromReq(req);
      if (!authUser) return res.status(401).json({ error: "Unauthorized" });
      const { id } = req.params;

      // Check arena
      const tm = await dbGet(`SELECT t.match_id FROM team_members tm JOIN teams t ON tm.team_id = t.id WHERE tm.id = ?`, [id]);
      if (tm) {
        await dbRun(`DELETE FROM team_members WHERE id = ?`, [id]);
        io.to(tm.match_id).emit("match_updated");
        return res.json({ success: true });
      }

      // Check CS
      const cstm = await dbGet(`SELECT t.match_id FROM cs_team_members tm JOIN cs_teams t ON tm.team_id = t.id WHERE tm.id = ?`, [id]);
      if (cstm) {
        await dbRun(`DELETE FROM cs_team_members WHERE id = ?`, [id]);
        io.to(cstm.match_id).emit("match_updated");
        return res.json({ success: true });
      }

      // Check BR
      const brp = await dbGet(`SELECT match_id FROM br_players WHERE id = ?`, [id]);
      if (brp) {
        await dbRun(`DELETE FROM br_players WHERE id = ?`, [id]);
        io.to(brp.match_id).emit("match_updated");
        return res.json({ success: true });
      }

      res.status(404).json({ error: "Invitation not found" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/matches/:id/ready", async (req, res) => {
    try {
      const authUser = getUserFromReq(req);
      if (!authUser) return res.status(401).json({ error: "Unauthorized" });
      const { id } = req.params;

      const tm = await dbGet(
        `SELECT tm.id, tm.is_ready FROM team_members tm JOIN teams t ON tm.team_id = t.id WHERE t.match_id = ? AND tm.user_id = ?`,
        [id, authUser.id],
      );
      if (!tm) return res.status(404).json({ error: "Not in this match" });

      await dbRun(`UPDATE team_members SET is_ready = ? WHERE id = ?`, [
        tm.is_ready ? 0 : 1,
        tm.id,
      ]);

      io.to(id).emit("match_updated");

      res.json({ success: true, is_ready: !tm.is_ready });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/matches/:id/start", async (req, res) => {
    try {
      const authUser = getUserFromReq(req);
      if (!authUser) return res.status(401).json({ error: "Unauthorized" });
      const { id } = req.params;

      const match: any = await dbGet(`SELECT * FROM matches WHERE id = ?`, [
        id,
      ]);
      if (!match) return res.status(404).json({ error: "Match not found" });
      if (match.creator_id !== authUser.id)
        return res
          .status(403)
          .json({ error: "Only the host can start the match" });

      const count: any = await dbGet(
        `SELECT COUNT(*) as c FROM team_members tm2 JOIN teams t2 ON tm2.team_id = t2.id WHERE t2.match_id = ? AND (tm2.accepted = 0 OR tm2.is_ready = 0)`,
        [id],
      );
      if (count.c > 0)
        return res.status(400).json({ error: "Not all players are ready" });

      await dbRun(
        `UPDATE matches SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id],
      );
      
      io.to(id).emit("match_started");

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/users/me/matches", async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).json({ error: "No token" });
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const userId = decoded.id;

      const userMatches = [];

      const bingoMembers = await dbAll(
        `
        SELECT m.id, m.status, m.winner_team_id, m.created_at, tm.team_id, m.grid_size, m.duration_minutes
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN matches m ON t.match_id = m.id
        WHERE tm.user_id = ? AND m.status = 'finished'
      `,
        [userId],
      );

      for (const m of bingoMembers) {
        let result = "draw";
        if (m.winner_team_id) {
          result = m.winner_team_id === m.team_id ? "win" : "loss";
        }
        userMatches.push({
          id: m.id,
          game_mode: "bingo",
          result,
          created_at: m.created_at,
          details: `${m.grid_size}x${m.grid_size} Grid`,
        });
      }

      const csMembers = await dbAll(
        `
        SELECT m.id, m.status, m.winner_team_id, m.created_at, tm.team_id, m.duration_minutes
        FROM cs_team_members tm
        JOIN cs_teams t ON tm.team_id = t.id
        JOIN cs_matches m ON t.match_id = m.id
        WHERE tm.user_id = ? AND m.status = 'finished'
      `,
        [userId],
      );

      for (const m of csMembers) {
        let result = "draw";
        if (m.winner_team_id) {
          result = m.winner_team_id === m.team_id ? "win" : "loss";
        }
        userMatches.push({
          id: m.id,
          game_mode: "clash_squad",
          result,
          created_at: m.created_at,
          details: `5 Questions`,
        });
      }

      const brPlayers = await dbAll(
        `
        SELECT m.id, m.status, m.winner_user_id, m.created_at, p.status as player_status
        FROM br_players p
        JOIN br_matches m ON p.match_id = m.id
        WHERE p.user_id = ? AND m.status = 'finished'
      `,
        [userId],
      );

      for (const m of brPlayers) {
        let result = "loss";
        if (m.winner_user_id === userId || m.player_status === "winner") {
          result = "win";
        }
        userMatches.push({
          id: m.id,
          game_mode: "battle_royale",
          result,
          created_at: m.created_at,
          details: `Free for All`,
        });
      }

      userMatches.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      res.json(userMatches);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/all-matches", async (req, res) => {
    try {
      const bingoMatches: any[] = await dbAll(
        `SELECT * FROM matches ORDER BY created_at DESC LIMIT 20`,
      );
      const csMatches: any[] = await dbAll(
        `SELECT * FROM cs_matches ORDER BY created_at DESC LIMIT 20`,
      );
      const brMatches: any[] = await dbAll(
        `SELECT * FROM br_matches ORDER BY created_at DESC LIMIT 20`,
      );

      const allMatches = [];

      for (const m of bingoMatches) {
        const teams = await dbAll(
          `SELECT id, name, color FROM teams WHERE match_id = ?`,
          [m.id],
        );
        allMatches.push({ ...m, type: "bingo", teams });
      }

      for (const m of csMatches) {
        const teams = await dbAll(
          `SELECT id, name, color FROM cs_teams WHERE match_id = ?`,
          [m.id],
        );
        allMatches.push({ ...m, type: "clash_squad", teams });
      }

      for (const m of brMatches) {
        allMatches.push({ ...m, type: "battle_royale" });
      }

      allMatches.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      res.json(allMatches);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Matches
  app.get("/api/matches", async (req, res) => {
    const matches: any[] = await dbAll(
      `SELECT * FROM matches ORDER BY created_at DESC LIMIT 50`,
    );
    for (const match of matches) {
      const teams = await dbAll(
        `SELECT id, name, color FROM teams WHERE match_id = ?`,
        [match.id],
      );
      match.teams = teams;
    }
    res.json(matches);
  });

  app.get("/api/matches/:id", async (req, res) => {
    const matchId = req.params.id;
    const match: any = await dbGet(`SELECT * FROM matches WHERE id = ?`, [
      matchId,
    ]);
    if (!match) return res.status(404).json({ error: "Match not found" });

    match.problems = JSON.parse(match.problems);
    const teams = await dbAll(`SELECT * FROM teams WHERE match_id = ?`, [
      matchId,
    ]);

    for (const team of teams) {
      const members = await dbAll(
        `SELECT * FROM team_members WHERE team_id = ?`,
        [team.id],
      );
      const solves = await dbAll(`SELECT * FROM solves WHERE team_id = ?`, [
        team.id,
      ]);
      (team as any).members = members;
      (team as any).solves = solves;
    }
    match.teams = teams;
    res.json(match);
  });

  app.post("/api/matches", async (req, res) => {
    // Requires auth in real app, simplified here
    try {
      const authUser = getUserFromReq(req);
      let creatorHandle = "";
      if (authUser) {
        const u: any = await dbGet(`SELECT cf_handle FROM users WHERE id = ?`, [
          authUser.id,
        ]);
        if (u) creatorHandle = u.cf_handle;
      }

      const {
        duration_minutes,
        min_rating,
        max_rating,
        grid_size,
        problems,
        wager_per_team,
        team1,
        team2,
      } = req.body;

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

      const matchId = crypto.randomUUID();
      const prize_pool = wager_per_team * 2;

      await dbRun(
        `
        INSERT INTO matches (id, status, grid_size, duration_minutes, wager_per_team, prize_pool, min_rating, max_rating, problems, started_at, creator_id)
        VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, null, ?)
      `,
        [
          matchId,
          grid_size,
          duration_minutes,
          wager_per_team,
          prize_pool,
          min_rating,
          max_rating,
          JSON.stringify(problems),
          authUser?.id || null,
        ],
      );

      const t1Id = crypto.randomUUID();
      await dbRun(
        `INSERT INTO teams (id, match_id, name, color) VALUES (?, ?, ?, 'teal')`,
        [t1Id, matchId, team1.name],
      );

      const t2Id = crypto.randomUUID();
      await dbRun(
        `INSERT INTO teams (id, match_id, name, color) VALUES (?, ?, ?, 'purple')`,
        [t2Id, matchId, team2.name],
      );

      const t1Members = [];
      for (const m of team1.members) {
        const uId = m.user_id || null;
        const accepted =
          m.handle.toLowerCase() === creatorHandle?.toLowerCase() ? 1 : 0;
        const tmId = crypto.randomUUID();
        await dbRun(
          `INSERT INTO team_members (id, team_id, user_id, cf_handle, accepted) VALUES (?, ?, ?, ?, ?)`,
          [tmId, t1Id, uId, m.handle, accepted],
        );
        t1Members.push({ user_id: uId, handle: m.handle });

        if (!accepted) {
          io.to(`cf_${m.handle.toLowerCase()}`).emit("new_invitation", {
            invite_id: tmId,
            match_id: matchId,
            mode: "1v1 Arena",
            created_at: new Date().toISOString(),
            host_name: authUser?.username || "Unknown Host",
            host_cf_handle: creatorHandle || "Unknown",
            wager: wager_per_team || 0,
          });
        }
      }

      const t2Members = [];
      for (const m of team2.members) {
        const uId = m.user_id || null;
        const accepted =
          m.handle.toLowerCase() === creatorHandle?.toLowerCase() ? 1 : 0;
        const tmId = crypto.randomUUID();
        await dbRun(
          `INSERT INTO team_members (id, team_id, user_id, cf_handle, accepted) VALUES (?, ?, ?, ?, ?)`,
          [tmId, t2Id, uId, m.handle, accepted],
        );
        t2Members.push({ user_id: uId, handle: m.handle });

        if (!accepted) {
          io.to(`cf_${m.handle.toLowerCase()}`).emit("new_invitation", {
            invite_id: tmId,
            match_id: matchId,
            mode: "1v1 Arena",
            created_at: new Date().toISOString(),
            host_name: authUser?.username || "Unknown Host",
            host_cf_handle: creatorHandle || "Unknown",
            wager: wager_per_team || 0,
          });
        }
      }

      const pendingCount: any = await dbGet(
        `SELECT COUNT(*) as count FROM team_members tm JOIN teams t ON tm.team_id = t.id WHERE t.match_id = ? AND tm.accepted = 0`,
        [matchId],
      );
      if (pendingCount.count === 0) {
        await dbRun(
          `UPDATE matches SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [matchId],
        );
      }

      if (wager_per_team > 0) {
        // simplified wager hold
        await coinService.holdWagers(
          matchId,
          wager_per_team,
          t1Members,
          t2Members,
        );
      }

      res.json({ matchId });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
}

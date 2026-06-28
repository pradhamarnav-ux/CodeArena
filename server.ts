import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { createServer as createHttpServer } from "http";
import { Server } from "socket.io";
import { initDb } from "./src/backend/db";
import { setupApiRoutes } from "./src/backend/api";
import { startPollerOrchestrator } from "./src/backend/pollerOrchestrator";
import clashSquadRoutes from "./src/backend/clashSquad";
import battleRoyaleRoutes from "./src/backend/battleRoyale";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  app.use(cors());
  app.use(express.json());

  // Initialize SQLite Database
  await initDb();

  // Make IO accessible to routes
  app.set("io", io);

  // Setup API Routes
  setupApiRoutes(app, io);
  app.use("/api/cs", clashSquadRoutes);
  app.use("/api/br", battleRoyaleRoutes);

  // Start Codeforces Poller Orchestrator
  startPollerOrchestrator(io);

  // Socket.io connection handling
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    
    socket.on("register_user", (data) => {
      if (data) {
        if (data.userId) {
          socket.join(`user_${data.userId}`);
          console.log(`Socket ${socket.id} joined room user_${data.userId}`);
        }
        if (data.cfHandle) {
          const cf = data.cfHandle.toLowerCase();
          socket.join(`cf_${cf}`);
          console.log(`Socket ${socket.id} joined room cf_${cf}`);
        }
      }
    });

    socket.on("join_match", (matchId) => {
      socket.join(matchId);
      console.log(`Socket ${socket.id} joined match ${matchId}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);

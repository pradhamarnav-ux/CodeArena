import { BrowserRouter, Routes, Route } from "react-router";
import { Toaster } from "sonner";
import Home from "./pages/Home";
import CreateMatch from "./pages/CreateMatch";
import Arena from "./pages/Arena";
import Navbar from "./components/Navbar";
import Profile from "./pages/Profile";
import Invitations from "./pages/Invitations";

import CreateClashSquad from "./pages/CreateClashSquad";
import ClashSquadArena from "./pages/ClashSquadArena";
import ClashSquadResults from "./pages/ClashSquadResults";

import CreateBattleRoyale from "./pages/CreateBattleRoyale";
import BattleRoyaleArena from "./pages/BattleRoyaleArena";
import BattleRoyaleResults from "./pages/BattleRoyaleResults";

import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { SessionManager } from "./components/SessionManager";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0D1117] text-[#C9D1D9] font-sans">
        <SessionManager />
        <Navbar />
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          toastOptions={{
            style: {
              background: "#161B22",
              border: "1px solid #30363D",
              color: "#fff",
            },
          }}
        />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/create" element={<ProtectedRoute><CreateMatch /></ProtectedRoute>} />
            <Route path="/arena/:id" element={<ProtectedRoute><Arena /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/invitations" element={<ProtectedRoute><Invitations /></ProtectedRoute>} />

            <Route path="/clash-squad/create" element={<ProtectedRoute><CreateClashSquad /></ProtectedRoute>} />
            <Route path="/clash-squad/:id" element={<ProtectedRoute><ClashSquadArena /></ProtectedRoute>} />
            <Route
              path="/clash-squad/:id/results"
              element={<ProtectedRoute><ClashSquadResults /></ProtectedRoute>}
            />

            <Route
              path="/battle-royale/create"
              element={<ProtectedRoute><CreateBattleRoyale /></ProtectedRoute>}
            />
            <Route path="/battle-royale/:id" element={<ProtectedRoute><BattleRoyaleArena /></ProtectedRoute>} />
            <Route
              path="/battle-royale/:id/results"
              element={<ProtectedRoute><BattleRoyaleResults /></ProtectedRoute>}
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

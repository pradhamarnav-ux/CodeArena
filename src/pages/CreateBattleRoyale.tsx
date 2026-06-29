import { useState } from "react";
import { useNavigate } from "react-router";
import { Trophy, Plus, X, Users } from "lucide-react";
import { toast } from "sonner";
import { verifyUserExists } from "../lib/codeforcesApi";

export default function CreateBattleRoyale() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<{ handle: string }[]>(
    Array(5).fill({ handle: "" }),
  );

  const handlePlayerChange = (index: number, value: string) => {
    const newPlayers = [...players];
    newPlayers[index] = { handle: value };
    setPlayers(newPlayers);
  };

  const addPlayer = () => {
    if (players.length < 20) {
      setPlayers([...players, { handle: "" }]);
    }
  };

  const removePlayer = (index: number) => {
    if (players.length > 5) {
      const newPlayers = [...players];
      newPlayers.splice(index, 1);
      setPlayers(newPlayers);
    }
  };

  const handleCreate = async () => {
    const validPlayers = players.filter((p) => p.handle.trim() !== "");

    if (validPlayers.length < 5) {
      toast.error("Battle Royale requires at least 5 players.");
      return;
    }

    setLoading(true);
    try {
      for (const p of validPlayers) {
        const exists = await verifyUserExists(p.handle);
        if (!exists) {
          toast.error(
            `Invalid Handle: Codeforces user '${p.handle}' not found.`,
          );
          setLoading(false);
          return;
        }
      }

      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/br/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ players: validPlayers }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Match started successfully!");
        navigate(`/battle-royale/${data.matchId}`);
      } else {
        toast.error(data.error || "Failed to create match");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error creating match.");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Create Battle Royale
          </h1>
          <p className="text-[#8B949E]">
            Free-for-all elimination mode. Last player standing wins.
          </p>
        </div>
      </div>

      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#8957e5]" /> Participants
          </h2>
          <span className="text-sm font-bold text-[#8B949E]">
            {players.length} / 20 Players
          </span>
        </div>

        <div className="space-y-3">
          {players.map((p, i) => (
            <div key={i} className="flex gap-2">
              <span className="w-8 flex items-center justify-center text-[#8B949E] font-bold text-sm bg-[#0D1117] border border-[#30363D] rounded-lg">
                {i + 1}
              </span>
              <input
                type="text"
                placeholder="Codeforces Handle"
                value={p.handle}
                onChange={(e) => handlePlayerChange(i, e.target.value)}
                className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-lg p-2.5 text-white focus:border-[#8957e5] outline-none"
              />
              {players.length > 5 && (
                <button
                  onClick={() => removePlayer(i)}
                  className="p-2.5 text-red-400 hover:bg-red-400/10 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}

          {players.length < 20 && (
            <button
              onClick={addPlayer}
              className="w-full flex items-center justify-center gap-2 py-3 mt-4 border border-dashed border-[#30363D] rounded-lg text-sm font-bold text-[#8B949E] hover:text-[#8957e5] hover:border-[#8957e5] transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Player Slot
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleCreate}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-[#8957e5] hover:bg-[#a371f7] text-white px-8 py-3 rounded-lg font-bold transition-all shadow-md disabled:opacity-50"
        >
          {loading ? "Creating..." : "Start Battle Royale"}
          <Trophy className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

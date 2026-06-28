import { useState } from "react";
import { useNavigate } from "react-router";
import { fetchRandomProblems, verifyUserExists } from "../lib/codeforcesApi";
import { Trophy, Users, Save, X, Settings2 } from "lucide-react";
import { toast } from "sonner";

export default function CreateMatch() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"settings" | "teams">("settings");
  const [loading, setLoading] = useState(false);
  const [problems, setProblems] = useState<any[]>([]);

  const [settings, setSettings] = useState({
    duration: 60,
    minRating: 800,
    maxRating: 1600,
    gridSize: 5,
    wager: 0,
    showRatings: true,
  });

  const [team1, setTeam1] = useState({
    name: "Team A",
    members: [] as { handle: string }[],
  });
  const [team2, setTeam2] = useState({
    name: "Team B",
    members: [] as { handle: string }[],
  });
  const [handleInput1, setHandleInput1] = useState("");
  const [handleInput2, setHandleInput2] = useState("");

  const handleFetchProblems = async () => {
    try {
      setLoading(true);
      const res = await fetchRandomProblems(
        settings.minRating,
        settings.maxRating,
        settings.gridSize * settings.gridSize,
      );
      setProblems(res);
      toast.success(`Successfully fetched ${res.length} problems`);
    } catch (e: any) {
      toast.error(e.message || "Failed to fetch problems");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (teamNum: 1 | 2) => {
    const handle = teamNum === 1 ? handleInput1 : handleInput2;
    if (!handle) return;

    const exists = await verifyUserExists(handle);
    if (!exists) {
      toast.error(`Invalid Handle: Codeforces user '${handle}' not found.`);
      return;
    }

    if (teamNum === 1) {
      setTeam1({ ...team1, members: [...team1.members, { handle }] });
      setHandleInput1("");
    } else {
      setTeam2({ ...team2, members: [...team2.members, { handle }] });
      setHandleInput2("");
    }
  };

  const handleCreate = async () => {
    if (problems.length < settings.gridSize * settings.gridSize) {
      toast.error("Please fetch problems first.");
      return;
    }
    if (handleInput1.trim() !== "" || handleInput2.trim() !== "") {
      toast.warning(
        "You have an un-added Codeforces handle in the input box. Please click 'Add' first.",
      );
      return;
    }
    if (team1.members.length === 0 || team2.members.length === 0) {
      toast.error("Each team needs at least one member.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_minutes: settings.duration,
          min_rating: settings.minRating,
          max_rating: settings.maxRating,
          grid_size: settings.gridSize,
          wager_per_team: settings.wager,
          problems,
          team1,
          team2,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Match started successfully!");
        navigate(`/arena/${data.matchId}`);
      } else {
        toast.error(data.error || "Failed to create match");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Create Match</h1>
        <p className="text-gray-400">
          Configure game settings and invite players.
        </p>
      </div>

      <div className="flex space-x-1 bg-[#161B22] p-1 rounded-xl border border-[#30363D]">
        <button
          onClick={() => setTab("settings")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            tab === "settings"
              ? "bg-[#21262D] text-white shadow-sm"
              : "text-gray-400 hover:text-white hover:bg-[#21262D]/50"
          }`}
        >
          <Settings2 className="w-4 h-4" />
          Game Settings
        </button>
        <button
          onClick={() => setTab("teams")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            tab === "teams"
              ? "bg-[#21262D] text-white shadow-sm"
              : "text-gray-400 hover:text-white hover:bg-[#21262D]/50"
          }`}
        >
          <Users className="w-4 h-4" />
          Teams
        </button>
      </div>

      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6">
        {tab === "settings" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Duration (Minutes): {settings.duration}
                </label>
                <input
                  type="range"
                  min="30"
                  max="420"
                  step="30"
                  value={settings.duration}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      duration: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Wager per Team (Coins)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={settings.wager}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      wager: parseInt(e.target.value),
                    })
                  }
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <p className="text-xs text-amber-500 mt-1">
                  Prize pool: {settings.wager * 2} coins
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Min Rating
                </label>
                <input
                  type="number"
                  step="100"
                  value={settings.minRating}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      minRating: parseInt(e.target.value),
                    })
                  }
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Max Rating
                </label>
                <input
                  type="number"
                  step="100"
                  value={settings.maxRating}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxRating: parseInt(e.target.value),
                    })
                  }
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Grid Size
                </label>
                <select
                  value={settings.gridSize}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      gridSize: parseInt(e.target.value),
                    })
                  }
                  className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500 appearance-none"
                >
                  <option value={3}>3x3</option>
                  <option value={4}>4x4</option>
                  <option value={5}>5x5</option>
                </select>
              </div>

              <div className="space-y-2 flex items-center h-full pt-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showRatings}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        showRatings: e.target.checked,
                      })
                    }
                    className="w-5 h-5 rounded border-[#30363D] bg-[#0D1117] text-cyan-500 focus:ring-cyan-500 focus:ring-offset-[#161B22]"
                  />
                  <span className="text-sm font-medium text-gray-300">
                    Show problem ratings on grid
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-[#30363D]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">Problem Pool</h3>
                <button
                  onClick={handleFetchProblems}
                  disabled={loading}
                  className="px-4 py-2 bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? "Fetching..." : "Fetch Problems"}
                </button>
              </div>

              {problems.length > 0 ? (
                <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
                  Successfully fetched {problems.length} problems.
                </div>
              ) : (
                <div className="text-sm text-gray-500 bg-[#0D1117] border border-[#30363D] p-3 rounded-lg text-center">
                  Click fetch to generate the grid problems.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Team 1 */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-teal-400">Team 1</h3>
              <input
                type="text"
                placeholder="Team Name"
                value={team1.name}
                onChange={(e) => setTeam1({ ...team1, name: e.target.value })}
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2 text-white focus:border-teal-500 outline-none"
              />

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Codeforces Handle"
                  value={handleInput1}
                  onChange={(e) => setHandleInput1(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddMember(1)}
                  className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2 text-white focus:border-teal-500 outline-none text-sm"
                />
                <button
                  onClick={() => handleAddMember(1)}
                  className="px-4 bg-teal-600 hover:bg-teal-500 rounded-lg text-white font-medium text-sm"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {team1.members.map((m) => (
                  <div
                    key={m.handle}
                    className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 text-teal-300 px-3 py-1.5 rounded-full text-sm"
                  >
                    {m.handle}
                    <button
                      onClick={() =>
                        setTeam1({
                          ...team1,
                          members: team1.members.filter(
                            (x) => x.handle !== m.handle,
                          ),
                        })
                      }
                      className="hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Team 2 */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-purple-400">Team 2</h3>
              <input
                type="text"
                placeholder="Team Name"
                value={team2.name}
                onChange={(e) => setTeam2({ ...team2, name: e.target.value })}
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
              />

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Codeforces Handle"
                  value={handleInput2}
                  onChange={(e) => setHandleInput2(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddMember(2)}
                  className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none text-sm"
                />
                <button
                  onClick={() => handleAddMember(2)}
                  className="px-4 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium text-sm"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {team2.members.map((m) => (
                  <div
                    key={m.handle}
                    className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 text-purple-300 px-3 py-1.5 rounded-full text-sm"
                  >
                    {m.handle}
                    <button
                      onClick={() =>
                        setTeam2({
                          ...team2,
                          members: team2.members.filter(
                            (x) => x.handle !== m.handle,
                          ),
                        })
                      }
                      className="hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleCreate}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-[#238636] hover:bg-[#2ea043] text-white px-8 py-3 rounded-lg font-bold transition-all shadow-md disabled:opacity-50"
        >
          {loading ? "Creating..." : "Start Match"}
          <Trophy className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

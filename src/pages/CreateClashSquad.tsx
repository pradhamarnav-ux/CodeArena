import { useState } from "react";
import { useNavigate } from "react-router";
import { Trophy, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { verifyUserExists } from "../lib/codeforcesApi";

export default function CreateClashSquad() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(60);
  const [wager, setWager] = useState(0);

  const [team1Name, setTeam1Name] = useState("Team Alpha");
  const [team1Members, setTeam1Members] = useState<{ handle: string }[]>([
    { handle: "" },
  ]);

  const [team2Name, setTeam2Name] = useState("Team Beta");
  const [team2Members, setTeam2Members] = useState<{ handle: string }[]>([
    { handle: "" },
  ]);

  const handleMemberChange = (team: 1 | 2, index: number, value: string) => {
    if (team === 1) {
      const newMembers = [...team1Members];
      newMembers[index].handle = value;
      setTeam1Members(newMembers);
    } else {
      const newMembers = [...team2Members];
      newMembers[index].handle = value;
      setTeam2Members(newMembers);
    }
  };

  const addMember = (team: 1 | 2) => {
    if (team === 1 && team1Members.length < 4) {
      setTeam1Members([...team1Members, { handle: "" }]);
    } else if (team === 2 && team2Members.length < 4) {
      setTeam2Members([...team2Members, { handle: "" }]);
    }
  };

  const removeMember = (team: 1 | 2, index: number) => {
    if (team === 1 && team1Members.length > 1) {
      const newMembers = [...team1Members];
      newMembers.splice(index, 1);
      setTeam1Members(newMembers);
    } else if (team === 2 && team2Members.length > 1) {
      const newMembers = [...team2Members];
      newMembers.splice(index, 1);
      setTeam2Members(newMembers);
    }
  };

  const handleCreate = async () => {
    const validT1 = team1Members.filter((m) => m.handle.trim() !== "");
    const validT2 = team2Members.filter((m) => m.handle.trim() !== "");

    if (validT1.length === 0 || validT2.length === 0) {
      toast.error("Each team needs at least one member with a valid handle.");
      return;
    }

    setLoading(true);
    try {
      for (const m of [...validT1, ...validT2]) {
        const exists = await verifyUserExists(m.handle);
        if (!exists) {
          toast.error(
            `Invalid Handle: Codeforces user '${m.handle}' not found.`,
          );
          setLoading(false);
          return;
        }
      }

      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/cs/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          duration_minutes: duration,
          wager_per_team: wager,
          team1: { name: team1Name, members: validT1 },
          team2: { name: team2Name, members: validT2 },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Match started successfully!");
        navigate(`/clash-squad/${data.matchId}`);
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
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Create Clash Squad Match
          </h1>
          <p className="text-[#8B949E]">
            Team vs Team competition across 5 fixed questions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-white mb-4">Match Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#8B949E] mb-1">
                Duration (minutes)
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg p-2.5 text-white focus:border-[#58A6FF] outline-none"
              >
                <option value={30}>30 mins</option>
                <option value={60}>60 mins</option>
                <option value={90}>90 mins</option>
                <option value={120}>120 mins</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#8B949E] mb-1">
                Wager per Team (coins)
              </label>
              <input
                type="number"
                value={wager}
                onChange={(e) => setWager(Number(e.target.value))}
                min="0"
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg p-2.5 text-white focus:border-[#58A6FF] outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#161B22] border border-[#238636]/50 border-t-4 border-t-[#238636] rounded-xl p-6 shadow-sm">
            <input
              type="text"
              value={team1Name}
              onChange={(e) => setTeam1Name(e.target.value)}
              className="bg-transparent text-xl font-bold text-[#3fb950] border-b border-[#30363D] focus:border-[#238636] outline-none mb-4 w-full"
            />
            <div className="space-y-3">
              {team1Members.map((member, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Codeforces Handle"
                    value={member.handle}
                    onChange={(e) => handleMemberChange(1, i, e.target.value)}
                    className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-lg p-2 text-white focus:border-[#238636] outline-none"
                  />
                  {team1Members.length > 1 && (
                    <button
                      onClick={() => removeMember(1, i)}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              {team1Members.length < 4 && (
                <button
                  onClick={() => addMember(1)}
                  className="flex items-center gap-2 text-sm text-[#8B949E] hover:text-[#3fb950] mt-2"
                >
                  <Plus className="w-4 h-4" /> Add Member
                </button>
              )}
            </div>
          </div>

          <div className="bg-[#161B22] border border-[#8957e5]/50 border-t-4 border-t-[#8957e5] rounded-xl p-6 shadow-sm">
            <input
              type="text"
              value={team2Name}
              onChange={(e) => setTeam2Name(e.target.value)}
              className="bg-transparent text-xl font-bold text-[#a371f7] border-b border-[#30363D] focus:border-[#8957e5] outline-none mb-4 w-full"
            />
            <div className="space-y-3">
              {team2Members.map((member, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Codeforces Handle"
                    value={member.handle}
                    onChange={(e) => handleMemberChange(2, i, e.target.value)}
                    className="flex-1 bg-[#0D1117] border border-[#30363D] rounded-lg p-2 text-white focus:border-[#8957e5] outline-none"
                  />
                  {team2Members.length > 1 && (
                    <button
                      onClick={() => removeMember(2, i)}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
              {team2Members.length < 4 && (
                <button
                  onClick={() => addMember(2)}
                  className="flex items-center gap-2 text-sm text-[#8B949E] hover:text-[#a371f7] mt-2"
                >
                  <Plus className="w-4 h-4" /> Add Member
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleCreate}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-[#238636] hover:bg-[#2ea043] text-white px-8 py-3 rounded-lg font-bold transition-all shadow-md disabled:opacity-50"
        >
          {loading ? "Creating..." : "Start Clash Squad"}
          <Trophy className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

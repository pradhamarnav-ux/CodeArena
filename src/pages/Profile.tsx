import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  User,
  Trophy,
  Activity,
  Coins,
  Download,
  Search,
  Flame,
  TrendingUp,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { startOfWeek, format } from "date-fns";
import { Skeleton } from "../components/Skeleton";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [matchSearch, setMatchSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token") || "";
    
    Promise.all([
      fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch("/api/users/me/matches", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch("/api/users/me/invitations", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
    ]).then(([userData, matchesData, invitationsData]) => {
      if (!userData.error) setUser(userData);
      if (!matchesData.error) setMatches(matchesData);
      if (!invitationsData.error) setInvitations(invitationsData);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const acceptInvitation = async (id: string, matchId: string) => {
    const token = localStorage.getItem("token") || "";
    try {
      const res = await fetch(`/api/invitations/${id}/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvitations(invitations.filter((i) => i.invite_id !== id));
        if (data.mode === "Arena") navigate(`/arena/${matchId}`);
        else if (data.mode === "Clash Squad") navigate(`/clash-squad/${matchId}`);
        else if (data.mode === "Battle Royale") navigate(`/battle-royale/${matchId}`);
      } else {
        alert("Failed to accept invitation");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const declineInvitation = async (id: string) => {
    const token = localStorage.getItem("token") || "";
    try {
      const res = await fetch(`/api/invitations/${id}/decline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setInvitations(invitations.filter((i) => i.invite_id !== id));
      } else {
        alert("Failed to decline invitation");
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-8 flex flex-col md:flex-row items-center gap-6 shadow-sm">
          <Skeleton className="w-24 h-24 rounded-full shrink-0" />
          <div className="text-center md:text-left flex-1 space-y-3">
            <Skeleton className="h-8 w-48 mx-auto md:mx-0" />
            <Skeleton className="h-4 w-32 mx-auto md:mx-0" />
            <Skeleton className="h-4 w-40 mx-auto md:mx-0" />
          </div>
          <div className="flex items-center gap-3 bg-[#0D1117] border border-[#30363D] px-6 py-4 rounded-xl shadow-inner">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="w-8 h-8 rounded-lg" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 shadow-sm">
              <Skeleton className="h-6 w-32 mb-6" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 shadow-sm">
              <Skeleton className="h-6 w-32 mb-6" />
              <Skeleton className="h-48 w-full rounded-full mx-auto max-w-[200px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto mt-20 p-8 text-center text-gray-400">
        User profile not found.
      </div>
    );
  }

  // Calculate stats
  let wins = 0,
    losses = 0,
    draws = 0;
  matches.forEach((m) => {
    if (m.result === "win") wins++;
    else if (m.result === "loss") losses++;
    else draws++;
  });

  const chartData = [
    { name: "Wins", value: wins, color: "#3fb950" },
    { name: "Losses", value: losses, color: "#f85149" },
    { name: "Draws", value: draws, color: "#8B949E" },
  ].filter((d) => d.value > 0);

  // Calculate streaks
  const streaks: Record<string, { current: number; longest: number }> = {
    bingo: { current: 0, longest: 0 },
    clash_squad: { current: 0, longest: 0 },
    battle_royale: { current: 0, longest: 0 },
    all: { current: 0, longest: 0 },
  };

  const sortedMatches = [...matches].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  for (const m of sortedMatches) {
    if (m.result === "win") {
      streaks[m.game_mode].current++;
      streaks.all.current++;
    } else {
      streaks[m.game_mode].current = 0;
      streaks.all.current = 0;
    }
    if (streaks[m.game_mode].current > streaks[m.game_mode].longest) {
      streaks[m.game_mode].longest = streaks[m.game_mode].current;
    }
    if (streaks.all.current > streaks.all.longest) {
      streaks.all.longest = streaks.all.current;
    }
  }

 
  const weeklyStats: Record<string, { wins: number; total: number }> = {};
  sortedMatches.forEach((m) => {
    const d = new Date(m.created_at);
    if (isNaN(d.getTime())) return;
    const weekStart = startOfWeek(d, { weekStartsOn: 1 });
    const weekKey = format(weekStart, "MMM d");
    if (!weeklyStats[weekKey]) weeklyStats[weekKey] = { wins: 0, total: 0 };
    weeklyStats[weekKey].total++;
    if (m.result === "win") weeklyStats[weekKey].wins++;
  });

  const trendData = Object.entries(weeklyStats).map(([week, stats]) => ({
    week,
    winRate: Math.round((stats.wins / stats.total) * 100),
  }));

  const exportHistory = (format: "json" | "csv") => {
    if (format === "json") {
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify({ user, matches }, null, 2));
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "match_history.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } else {
      const headers = "ID,Game Mode,Result,Details,Date\n";
      const rows = matches
        .map(
          (m) =>
            `${m.id},${m.game_mode},${m.result},"${m.details}",${m.created_at}`,
        )
        .join("\n");
      const csvContent =
        "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", csvContent);
      downloadAnchorNode.setAttribute("download", "match_history.csv");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    }
  };

  const filteredMatches = matches.filter(
    (m) =>
      m.id.toLowerCase().includes(matchSearch.toLowerCase()) ||
      m.game_mode.toLowerCase().includes(matchSearch.toLowerCase()),
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-8 flex flex-col md:flex-row items-center gap-6 shadow-sm">
        {user.profile_picture ? (
          <img
            src={user.profile_picture}
            alt={user.username}
            className="w-24 h-24 rounded-full object-cover border-2 border-[#58A6FF] shadow-md"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-24 h-24 bg-[#1F6FEB] rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-md">
            {user.display_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || <User className="w-10 h-10" />}
          </div>
        )}

        <div className="text-center md:text-left flex-1">
          <h1 className="text-3xl font-bold text-white">{user.display_name || user.username}</h1>
          <div className="flex flex-col gap-1 mt-1">
            <p className="text-[#8B949E] text-sm">@{user.username}</p>
            {user.cf_handle && (
              <p className="text-[#58A6FF] font-medium text-sm">
                CF Handle: {user.cf_handle}
              </p>
            )}
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
              Connected via {user.provider || "Local"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[#0D1117] border border-[#30363D] px-6 py-4 rounded-xl shadow-inner">
          <Coins className="w-8 h-8 text-[#EF9F27]" />
          <div>
            <div className="text-sm text-[#8B949E] font-bold uppercase tracking-wider">
              Balance
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {user.coin_balance}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {invitations.length > 0 && (
          <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-[#161B22] border border-[#3fb950] rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">
                Pending Match Invitations
              </h2>
              <button
                onClick={() => navigate("/invitations")}
                className="text-xs text-[#58A6FF] hover:underline font-bold"
              >
                Manage All &rarr;
              </button>
            </div>
            <div className="space-y-3">
              {invitations.map((inv) => (
                <div
                  key={inv.invite_id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#0D1117] p-4 rounded-lg border border-[#30363D] gap-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-white font-medium">
                        {inv.mode} Match
                      </span>
                      <span className="text-xs text-gray-500">
                        invited by <span className="font-bold text-[#58A6FF]">{inv.host_name}</span> (@{inv.host_cf_handle})
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>Created: {new Date(inv.created_at).toLocaleString()}</span>
                      {inv.wager > 0 && (
                        <span className="text-[#EF9F27] font-bold">Wager: {inv.wager} 🪙</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => declineInvitation(inv.invite_id)}
                      className="flex-1 sm:flex-none px-3 py-1.5 border border-red-500/30 hover:border-red-500 text-red-400 rounded-md text-sm font-medium transition-colors"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => acceptInvitation(inv.invite_id, inv.match_id)}
                      className="flex-1 sm:flex-none px-4 py-1.5 bg-[#238636] hover:bg-[#2ea043] text-white rounded-md text-sm font-medium transition-colors"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-5 h-5 text-[#a371f7]" />
            <h2 className="text-lg font-bold text-white">
              Win/Loss Distribution
            </h2>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
            {chartData.length > 0 ? (
              <div
                className="w-full h-full relative"
                style={{ minHeight: "200px" }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#0D1117",
                        borderColor: "#30363D",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-white">
                    {matches.length}
                  </span>
                  <span className="text-xs text-[#8B949E]">Matches</span>
                </div>
              </div>
            ) : (
              <p className="text-[#8B949E] text-sm">No matches played yet.</p>
            )}
          </div>
        </div>

        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-5 h-5 text-[#3fb950]" />
            <h2 className="text-lg font-bold text-white">Win Rate Trend</h2>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
            {trendData.length > 0 ? (
              <div
                className="w-full h-full relative"
                style={{ minHeight: "200px" }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#30363D"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="week"
                      stroke="#8B949E"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#8B949E"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "#0D1117",
                        borderColor: "#30363D",
                        borderRadius: "8px",
                      }}
                      itemStyle={{ color: "#fff" }}
                      formatter={(value: any) => [`${value}%`, "Win Rate"]}
                      labelStyle={{ color: "#8B949E", marginBottom: "4px" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="winRate"
                      stroke="#3fb950"
                      strokeWidth={3}
                      dot={{
                        r: 4,
                        fill: "#3fb950",
                        stroke: "#0D1117",
                        strokeWidth: 2,
                      }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-[#8B949E] text-sm">
                Not enough data to show trend.
              </p>
            )}
          </div>
        </div>

        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Flame className="w-5 h-5 text-[#EF9F27]" />
            <h2 className="text-lg font-bold text-white">Win Streaks</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3 flex justify-between items-center">
              <span className="text-[#C9D1D9] font-bold text-sm">Overall</span>
              <div className="flex gap-4 text-sm">
                <div className="flex flex-col items-end">
                  <span className="text-[#8B949E] text-xs">Current</span>
                  <span className="font-bold text-white">
                    {streaks.all.current} 🔥
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[#8B949E] text-xs">Longest</span>
                  <span className="font-bold text-[#EF9F27]">
                    {streaks.all.longest} 🔥
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3 flex justify-between items-center">
              <span className="text-[#3fb950] font-bold text-sm">Bingo</span>
              <div className="flex gap-4 text-sm">
                <div className="flex flex-col items-end">
                  <span className="text-[#8B949E] text-xs">Current</span>
                  <span className="font-bold text-white">
                    {streaks.bingo.current} 🔥
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[#8B949E] text-xs">Longest</span>
                  <span className="font-bold text-[#EF9F27]">
                    {streaks.bingo.longest} 🔥
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3 flex justify-between items-center">
              <span className="text-[#ff7b72] font-bold text-sm">
                Clash Squad
              </span>
              <div className="flex gap-4 text-sm">
                <div className="flex flex-col items-end">
                  <span className="text-[#8B949E] text-xs">Current</span>
                  <span className="font-bold text-white">
                    {streaks.clash_squad.current} 🔥
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[#8B949E] text-xs">Longest</span>
                  <span className="font-bold text-[#EF9F27]">
                    {streaks.clash_squad.longest} 🔥
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-3 flex justify-between items-center">
              <span className="text-[#a371f7] font-bold text-sm">
                Battle Royale
              </span>
              <div className="flex gap-4 text-sm">
                <div className="flex flex-col items-end">
                  <span className="text-[#8B949E] text-xs">Current</span>
                  <span className="font-bold text-white">
                    {streaks.battle_royale.current} 🔥
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[#8B949E] text-xs">Longest</span>
                  <span className="font-bold text-[#EF9F27]">
                    {streaks.battle_royale.longest} 🔥
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="w-5 h-5 text-[#58A6FF]" />
            <h2 className="text-lg font-bold text-white">
              Recent Transactions
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {user.transactions && user.transactions.length > 0 ? (
              user.transactions.map((tx: any) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 bg-[#0D1117] border border-[#30363D] rounded-lg"
                >
                  <div>
                    <div className="text-sm text-white font-bold">
                      {tx.type.replace(/_/g, " ").toUpperCase()}
                    </div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs text-[#8B949E]">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </span>
                      {tx.game_mode && (
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 rounded-sm ${
                            tx.game_mode === "bingo"
                              ? "bg-[#3fb950]/20 text-[#3fb950]"
                              : tx.game_mode === "clash_squad"
                                ? "bg-[#ff7b72]/20 text-[#ff7b72]"
                                : "bg-[#a371f7]/20 text-[#a371f7]"
                          }`}
                        >
                          {tx.game_mode.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className={`font-bold font-mono ${tx.amount > 0 ? "text-[#3fb950]" : "text-red-400"}`}
                  >
                    {tx.amount > 0 ? "+" : ""}
                    {tx.amount} 🪙
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-[#8B949E] py-8 text-sm">
                No recent activity.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#161B22] border border-[#30363D] rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#30363D] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white">Match History</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B949E]" />
              <input
                type="text"
                placeholder="Search ID or mode..."
                value={matchSearch}
                onChange={(e) => setMatchSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[#0D1117] border border-[#30363D] rounded-lg text-sm text-white focus:border-[#58A6FF] outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => exportHistory("csv")}
                className="flex items-center gap-2 bg-[#21262D] hover:bg-[#30363D] text-[#C9D1D9] hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors border border-[#30363D]"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
              <button
                onClick={() => exportHistory("json")}
                className="flex items-center gap-2 bg-[#21262D] hover:bg-[#30363D] text-[#C9D1D9] hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors border border-[#30363D]"
              >
                <Download className="w-4 h-4" /> JSON
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[#C9D1D9]">
            <thead className="bg-[#0D1117] text-[#8B949E] uppercase font-bold text-xs">
              <tr>
                <th className="px-6 py-4 border-b border-[#30363D]">
                  Match ID
                </th>
                <th className="px-6 py-4 border-b border-[#30363D]">
                  Game Mode
                </th>
                <th className="px-6 py-4 border-b border-[#30363D]">Result</th>
                <th className="px-6 py-4 border-b border-[#30363D]">Details</th>
                <th className="px-6 py-4 border-b border-[#30363D]">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatches.length > 0 ? (
                filteredMatches.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-[#30363D] hover:bg-[#21262D]/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-[#58A6FF]">
                      {m.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          m.game_mode === "bingo"
                            ? "bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/30"
                            : m.game_mode === "clash_squad"
                              ? "bg-[#ff7b72]/10 text-[#ff7b72] border border-[#ff7b72]/30"
                              : "bg-[#a371f7]/10 text-[#a371f7] border border-[#a371f7]/30"
                        }`}
                      >
                        {m.game_mode.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`font-bold uppercase ${m.result === "win" ? "text-[#3fb950]" : m.result === "loss" ? "text-red-400" : "text-[#8B949E]"}`}
                      >
                        {m.result}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#8B949E]">{m.details}</td>
                    <td className="px-6 py-4 text-[#8B949E]">
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-[#8B949E]"
                  >
                    No matches found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

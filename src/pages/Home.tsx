import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Trophy,
  Clock,
  Users,
  ArrowRight,
  Search,
  Activity,
  Medal,
  Grid,
  Swords,
  Flame,
  ChevronDown,
  ChevronUp
} from "lucide-react";

const GAME_MODES = [
  {
    id: "bingo",
    title: "Bingo",
    icon: <Grid className="w-8 h-8 text-[#3fb950]" />,
    color: "border-[#3fb950]/30 hover:border-[#3fb950]",
    bgColor: "bg-[#3fb950]/10",
    createLink: "/create",
    howToPlay: {
      objective: "Be the first team to complete a line of solved problems (horizontal, vertical, or diagonal) on a grid.",
      instructions: [
        "Create a match and invite your opponents.",
        "A grid of Codeforces problems (e.g., 3x3, 4x4, 5x5) will be generated.",
        "Both teams start solving problems concurrently.",
        "When a team member solves a problem on Codeforces, the corresponding cell is marked for their team."
      ],
      mechanics: "Problems are fetched based on the selected rating range. A cell can only be claimed by the first team to solve it.",
      controls: "Click on a cell to view the problem link. The system automatically verifies submissions via the Codeforces API.",
      scoring: "No points based on time. The first team to complete a Bingo line wins.",
      winConditions: "Win: Complete a Bingo line first. Lose: The opponent completes a line first.",
      specialRules: "If all cells are filled and no line is formed, the team with the most cells claimed wins (or it's a draw)."
    }
  },
  {
    id: "clash_squad",
    title: "Clash Squad",
    icon: <Swords className="w-8 h-8 text-[#ff7b72]" />,
    color: "border-[#ff7b72]/30 hover:border-[#ff7b72]",
    bgColor: "bg-[#ff7b72]/10",
    createLink: "/clash-squad/create",
    howToPlay: {
      objective: "Defeat the opposing team by solving a set of 5 problems faster in a head-to-head format.",
      instructions: [
        "Form a squad and challenge another squad.",
        "A shared pool of 5 problems is revealed to both teams.",
        "Teams race to solve the problems as fast as possible.",
        "The match ends when a team claims a majority of the problems (e.g., 3 out of 5)."
      ],
      mechanics: "Each problem can only be claimed by one team. Once solved by a team, the opponent can no longer claim it.",
      controls: "Select a problem from the list to open it. Submissions are tracked automatically.",
      scoring: "Each solved problem grants 1 point to the team.",
      winConditions: "Win: Be the first team to score 3 points. Lose: The opponent scores 3 points.",
      specialRules: "Coordination is key! Assign problems to specific team members to maximize efficiency."
    }
  },
  {
    id: "battle_royale",
    title: "Battle Royale",
    icon: <Flame className="w-8 h-8 text-[#a371f7]" />,
    color: "border-[#a371f7]/30 hover:border-[#a371f7]",
    bgColor: "bg-[#a371f7]/10",
    createLink: "/battle-royale/create",
    howToPlay: {
      objective: "Survive multiple rounds of algorithmic challenges to be the last coder standing.",
      instructions: [
        "Join a Battle Royale lobby with multiple players.",
        "The match consists of up to 5 rounds.",
        "In each round, a new problem is presented to all surviving players.",
        "Solve the problem within the time limit to advance to the next round.",
        "Players who fail to solve the problem in time are eliminated."
      ],
      mechanics: "Difficulty increases with each round. The time limit may vary based on problem difficulty.",
      controls: "View the active problem and submit your solution on Codeforces. The system updates your status automatically.",
      scoring: "Survival is the only metric. Faster solves might be used as tie-breakers.",
      winConditions: "Win: Be the last remaining player, or survive all 5 rounds. Lose: Fail to solve a problem in time.",
      specialRules: "If multiple players survive round 5, they share the victory or are ranked by total solve time."
    }
  }
];

const MOCK_LEADERBOARD = [
  { rank: 1, username: "tourist", wins: 152, losses: 12, coins: 45000 },
  { rank: 2, username: "Benq", wins: 134, losses: 28, coins: 38200 },
  { rank: 3, username: "jiangly", wins: 121, losses: 18, coins: 31000 },
  { rank: 4, username: "Radewoosh", wins: 98, losses: 42, coins: 24500 },
  { rank: 5, username: "ecnerwala", wins: 87, losses: 35, coins: 21000 },
];

export default function Home() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<
    "all" | "bingo" | "clash_squad" | "battle_royale"
  >("all");
  const [expandedHowToPlay, setExpandedHowToPlay] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch with delay for skeleton
    const timer = setTimeout(() => {
      fetchMatches(false);
    }, 800);

    // Periodic poll every 5 seconds for real-time updates
    const pollInterval = setInterval(() => {
      fetchMatches(true);
    }, 5000);

    return () => {
      clearTimeout(timer);
      clearInterval(pollInterval);
    };
  }, []);

  const fetchMatches = (isSilent: boolean) => {
    fetch("/api/all-matches")
      .then((r) => r.json())
      .then((data) => {
        setMatches(data);
        if (!isSilent) setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        if (!isSilent) setLoading(false);
      });
  };

  const activeMatches = matches.filter((m) => m.status !== "finished");
  const finishedMatches = matches
    .filter((m) => m.status === "finished")
    .slice(0, 5); // Limit activity feed

  const filteredMatches = activeMatches.filter((match) => {
    if (filterType !== "all" && match.type !== filterType) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const idMatch = match.id.toLowerCase().includes(query);
    const teamMatch = match.teams?.some((t: any) =>
      t.name.toLowerCase().includes(query),
    );
    const gameTypeMatch =
      (match.grid_size &&
        `${match.grid_size}x${match.grid_size}`.includes(query)) ||
      (match.min_rating &&
        `${match.min_rating}-${match.max_rating}`.includes(query));
    return idMatch || teamMatch || gameTypeMatch;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
      {/* Main Content: Lobby */}
      <div className="flex-1 space-y-8">
        
        {/* Game Modes Selection */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Game Modes</h1>
            <p className="text-[#8B949E]">Select a mode to create a match or learn how to play.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {GAME_MODES.map((mode) => (
              <div key={mode.id} className="flex flex-col">
                <div 
                  className={`bg-[#161B22] border border-[#30363D] ${mode.color} rounded-xl p-5 flex flex-col items-center text-center transition-all cursor-pointer relative overflow-hidden group ${expandedHowToPlay === mode.id ? 'ring-2 ring-opacity-50 ring-offset-2 ring-offset-[#0D1117] border-transparent' : ''}`}
                  onClick={() => setExpandedHowToPlay(expandedHowToPlay === mode.id ? null : mode.id)}
                  style={expandedHowToPlay === mode.id ? { borderColor: 'var(--tw-ring-color)' } : {}}
                >
                  <div className={`w-16 h-16 rounded-2xl ${mode.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    {mode.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{mode.title}</h3>
                  <div className="flex items-center gap-1 text-sm text-[#8B949E] mt-2 font-medium">
                    How to Play
                    {expandedHowToPlay === mode.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                  <Link
                    to={mode.createLink}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-4 w-full bg-[#21262D] hover:bg-[#30363D] text-white py-2 rounded-lg font-bold text-sm transition-colors border border-[#30363D]"
                  >
                    Create Match
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* How to Play Expansion Panel */}
          {expandedHowToPlay && (
            <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 animate-in slide-in-from-top-2 fade-in duration-300 shadow-lg">
              {GAME_MODES.map(mode => mode.id === expandedHowToPlay && (
                <div key={`${mode.id}-details`} className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-[#30363D]">
                    <div className={`p-2 rounded-lg ${mode.bgColor}`}>
                      {mode.icon}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">How to Play: {mode.title}</h2>
                      <p className="text-[#8B949E]">{mode.howToPlay.objective}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#21262D] flex items-center justify-center text-xs text-[#58A6FF]">1</span>
                          Instructions
                        </h3>
                        <ol className="list-decimal list-inside space-y-2 text-[#C9D1D9] text-sm marker:text-[#8B949E]">
                          {mode.howToPlay.instructions.map((step, idx) => (
                            <li key={idx} className="pl-1">{step}</li>
                          ))}
                        </ol>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#21262D] flex items-center justify-center text-xs text-[#58A6FF]">2</span>
                          Mechanics
                        </h3>
                        <p className="text-[#C9D1D9] text-sm">{mode.howToPlay.mechanics}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#21262D] flex items-center justify-center text-xs text-[#58A6FF]">3</span>
                          Controls
                        </h3>
                        <p className="text-[#C9D1D9] text-sm">{mode.howToPlay.controls}</p>
                      </div>
                    </div>

                    <div className="space-y-4 bg-[#0D1117] p-5 rounded-xl border border-[#30363D]">
                      <div>
                        <h3 className="text-md font-bold text-white mb-1 text-[#EF9F27]">Scoring System</h3>
                        <p className="text-[#C9D1D9] text-sm">{mode.howToPlay.scoring}</p>
                      </div>
                      <div className="h-px w-full bg-[#30363D]"></div>
                      <div>
                        <h3 className="text-md font-bold text-white mb-1 text-[#3fb950]">Win/Lose Conditions</h3>
                        <p className="text-[#C9D1D9] text-sm">{mode.howToPlay.winConditions}</p>
                      </div>
                      <div className="h-px w-full bg-[#30363D]"></div>
                      <div>
                        <h3 className="text-md font-bold text-white mb-1 text-[#a371f7]">Special Rules & Tips</h3>
                        <p className="text-[#C9D1D9] text-sm">{mode.howToPlay.specialRules}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-px w-full bg-[#30363D]"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              Live Arena Lobby
            </h2>
            <p className="text-[#8B949E]">
              Watch or join active matches from around the world.
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B949E]" />
            <input
              type="text"
              placeholder="Search by team, ID, or game type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl pl-12 pr-4 py-3 text-white placeholder-[#8B949E] focus:outline-none focus:border-[#58A6FF] transition-colors"
            />
          </div>
          <div className="flex bg-[#0D1117] border border-[#30363D] rounded-xl p-1 shrink-0 overflow-x-auto hide-scrollbar">
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${filterType === "all" ? "bg-[#21262D] text-white" : "text-[#8B949E] hover:text-white"}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("bingo")}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${filterType === "bingo" ? "bg-[#21262D] text-[#3fb950]" : "text-[#8B949E] hover:text-white"}`}
            >
              Bingo
            </button>
            <button
              onClick={() => setFilterType("clash_squad")}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${filterType === "clash_squad" ? "bg-[#21262D] text-[#ff7b72]" : "text-[#8B949E] hover:text-white"}`}
            >
              Clash Squad
            </button>
            <button
              onClick={() => setFilterType("battle_royale")}
              className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${filterType === "battle_royale" ? "bg-[#21262D] text-[#a371f7]" : "text-[#8B949E] hover:text-white"}`}
            >
              Battle Royale
            </button>
          </div>
        </div>

        {/* Match Listings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
            // Skeleton Loaders
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 flex flex-col gap-4 animate-pulse"
              >
                <div className="flex justify-between items-center">
                  <div className="w-20 h-6 bg-[#30363D] rounded-md"></div>
                  <div className="w-24 h-5 bg-[#30363D] rounded-md"></div>
                </div>
                <div className="w-3/4 h-6 bg-[#30363D] rounded-md mt-2"></div>
                <div className="space-y-2 mt-4">
                  <div className="w-1/2 h-4 bg-[#30363D] rounded-md"></div>
                  <div className="w-2/3 h-4 bg-[#30363D] rounded-md"></div>
                </div>
                <div className="w-full h-10 bg-[#30363D] rounded-lg mt-6"></div>
              </div>
            ))
          ) : filteredMatches.length > 0 ? (
            filteredMatches.map((match) => (
              <div
                key={match.id}
                className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 flex flex-col hover:border-[#8B949E] transition-colors shadow-sm relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="flex gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                        match.status === "active"
                          ? "bg-[#238636]/10 text-[#3fb950] border border-[#238636]/30"
                          : "bg-[#58A6FF]/10 text-[#58A6FF] border border-[#58A6FF]/30"
                      }`}
                    >
                      {match.status}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                        match.type === "bingo"
                          ? "bg-[#3fb950]/10 text-[#3fb950] border border-[#3fb950]/30"
                          : match.type === "clash_squad"
                            ? "bg-[#ff7b72]/10 text-[#ff7b72] border border-[#ff7b72]/30"
                            : "bg-[#a371f7]/10 text-[#a371f7] border border-[#a371f7]/30"
                      }`}
                    >
                      {match.type.replace("_", " ")}
                    </span>
                  </div>
                  {match.prize_pool !== undefined && (
                    <div className="flex items-center gap-1 text-[#EF9F27] text-sm font-bold">
                      <Trophy className="w-4 h-4" />
                      {match.prize_pool} coins
                    </div>
                  )}
                </div>

                <h3 className="text-lg font-bold text-white mb-2 truncate relative z-10">
                  {match.type === "battle_royale"
                    ? `Battle Royale #${match.id.slice(0, 8)}`
                    : match.teams && match.teams.length === 2
                      ? `${match.teams[0].name} vs ${match.teams[1].name}`
                      : `Match #${match.id.slice(0, 8)}`}
                </h3>

                <div className="space-y-2 mt-2 flex-grow relative z-10">
                  <div className="flex items-center gap-2 text-sm text-[#8B949E]">
                    <Clock className="w-4 h-4" />
                    <span>
                      {match.type === "battle_royale"
                        ? `Round ${match.current_round}/5`
                        : `${match.duration_minutes} min`}
                      {match.type === "bingo" &&
                        ` • ${match.grid_size}x${match.grid_size} Grid`}
                      {match.type === "clash_squad" && ` • 5 Questions`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#8B949E]">
                    <Users className="w-4 h-4" />
                    {match.type === "battle_royale" ? (
                      <span>Free for All</span>
                    ) : (
                      <span>
                        {match.min_rating
                          ? `Rating: ${match.min_rating} - ${match.max_rating}`
                          : "Mixed Ratings"}
                      </span>
                    )}
                  </div>
                </div>

                <Link
                  to={
                    match.type === "bingo"
                      ? `/arena/${match.id}`
                      : match.type === "clash_squad"
                        ? `/clash-squad/${match.id}`
                        : `/battle-royale/${match.id}`
                  }
                  className="mt-6 w-full flex items-center justify-center gap-2 bg-[#21262D] hover:bg-[#30363D] text-[#C9D1D9] hover:text-white py-2.5 rounded-lg text-sm font-bold transition-colors border border-[#30363D] relative z-10"
                >
                  {match.status === "active" ? "Spectate" : "Join Match"}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center border border-dashed border-[#30363D] rounded-xl bg-[#0D1117]">
              <p className="text-[#8B949E] font-medium">
                No active matches found matching your search.
              </p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-2 text-[#58A6FF] hover:underline text-sm font-bold"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar: Leaderboard & Activity Feed */}
      <div className="w-full lg:w-80 shrink-0 space-y-6">
        {/* Leaderboard */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#30363D]">
            <Medal className="w-5 h-5 text-[#EF9F27]" />
            <h2 className="text-[#C9D1D9] font-bold">Top Players</h2>
          </div>
          <div className="space-y-3">
            {MOCK_LEADERBOARD.map((user, idx) => (
              <div
                key={user.username}
                className="flex items-center justify-between group cursor-default"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-mono font-bold w-4 text-center ${
                      idx === 0
                        ? "text-[#EF9F27]"
                        : idx === 1
                          ? "text-gray-300"
                          : idx === 2
                            ? "text-amber-700"
                            : "text-[#8B949E]"
                    }`}
                  >
                    {user.rank}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white group-hover:text-[#58A6FF] transition-colors">
                      {user.username}
                    </span>
                    <span className="text-[10px] text-[#8B949E]">
                      {user.wins}W - {user.losses}L (
                      {((user.wins / (user.wins + user.losses)) * 100).toFixed(
                        1,
                      )}
                      %)
                    </span>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="text-xs font-bold text-[#EF9F27]">
                    {user.coins.toLocaleString()} 🪙
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2 bg-[#0D1117] border border-[#30363D] rounded-md text-xs font-bold text-[#8B949E] hover:text-white hover:bg-[#21262D] transition-colors">
            View Full Leaderboard
          </button>
        </div>

        {/* Activity Feed */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#30363D]">
            <Activity className="w-5 h-5 text-[#58A6FF]" />
            <h2 className="text-[#C9D1D9] font-bold">Recent Activity</h2>
          </div>

          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-[#30363D] shrink-0"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="w-full h-3 bg-[#30363D] rounded"></div>
                    <div className="w-2/3 h-2 bg-[#30363D] rounded"></div>
                  </div>
                </div>
              ))
            ) : finishedMatches.length > 0 ? (
              finishedMatches.map((match) => (
                <div key={match.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#21262D] border border-[#30363D] flex items-center justify-center shrink-0">
                    <Trophy className="w-4 h-4 text-[#8B949E]" />
                  </div>
                  <div>
                    <p className="text-xs text-[#C9D1D9]">
                      <span className="font-bold text-white">
                        {match.teams && match.teams.length === 2
                          ? `${match.teams[0].name} vs ${match.teams[1].name}`
                          : `Match #${match.id.slice(0, 8)}`}
                      </span>{" "}
                      ended.
                    </p>
                    <p className="text-[10px] text-[#8B949E] mt-0.5">
                      {new Date(
                        match.ended_at || match.created_at,
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {match.winner_team_id
                        ? ` • Won by Team ${match.teams?.find((t: any) => t.id === match.winner_team_id)?.name || "?"}`
                        : " • Draw/Timeout"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-[#8B949E] text-center py-4">
                No recent matches to show.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

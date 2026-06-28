import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { Trophy, Star, ArrowLeft } from "lucide-react";
import { Skeleton } from "../components/Skeleton";

export default function ClashSquadResults() {
  const { id } = useParams();
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/cs/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setMatch(data);
        setLoading(false);
      });
  }, [id]);

  if (loading)
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 p-4">
        <Skeleton className="h-6 w-32" />
        <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden shadow-lg">
          <Skeleton className="h-48 w-full" />
          <div className="p-8 grid md:grid-cols-2 gap-8">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
          <div className="px-8 pb-8">
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );

  if (!match)
    return <div className="text-white text-center mt-20">Match not found.</div>;
  if (match.status !== "finished") {
    return (
      <div className="text-white text-center mt-20">
        Match is still active!{" "}
        <Link to={`/clash-squad/${id}`} className="text-[#58A6FF] underline">
          Back to Arena
        </Link>
      </div>
    );
  }

  const team1 = match.teams[0];
  const team2 = match.teams[1];
  const winnerTeam =
    match.winner_team_id === team1.id
      ? team1
      : match.winner_team_id === team2.id
        ? team2
        : null;

  // Find MVP
  let mvp = null;
  if (winnerTeam) {
    mvp = winnerTeam.members.find((m: any) => m.is_mvp);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-[#8B949E] hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Lobby
      </Link>

      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden shadow-lg">
        {/* Winner Banner */}
        <div className="bg-gradient-to-br from-[#238636]/20 to-[#0D1117] p-8 text-center border-b border-[#30363D]">
          <Trophy className="w-16 h-16 text-[#EF9F27] mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">
            Match Finished!
          </h1>
          {winnerTeam ? (
            <p className="text-xl text-[#C9D1D9]">
              Winner:{" "}
              <span
                className={
                  winnerTeam.id === team1.id
                    ? "text-[#3fb950] font-bold"
                    : "text-[#a371f7] font-bold"
                }
              >
                {winnerTeam.name}
              </span>
            </p>
          ) : (
            <p className="text-xl text-[#8B949E]">It's a draw!</p>
          )}
        </div>

        <div className="p-8 grid md:grid-cols-2 gap-8">
          {/* MVP Card */}
          {mvp && (
            <div className="bg-[#0D1117] border border-[#EF9F27]/30 rounded-xl p-6 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#EF9F27]/10 rounded-full blur-2xl"></div>
              <h3 className="text-[#EF9F27] font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 fill-[#EF9F27]" /> Match MVP
              </h3>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {mvp.cf_handle}
                  </div>
                  <div className="text-[#8B949E] text-sm">
                    Score: {mvp.in_game_score}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[#EF9F27] font-bold text-xl">
                    +500 🪙
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payout Summary */}
          <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-6">
            <h3 className="text-[#C9D1D9] font-bold text-sm uppercase tracking-wider mb-4">
              Coin Payouts
            </h3>
            <div className="space-y-3">
              {winnerTeam &&
                winnerTeam.members.map((m: any) => (
                  <div
                    key={m.id}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-[#C9D1D9]">
                      {m.cf_handle} {m.is_mvp && "(MVP)"}
                    </span>
                    <span className="text-[#3fb950] font-bold">
                      +{m.is_mvp ? 500 : 100} 🪙
                    </span>
                  </div>
                ))}
              {!winnerTeam && (
                <div className="text-[#8B949E] text-sm">
                  No payouts awarded.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Final Scores */}
        <div className="px-8 pb-8">
          <h3 className="text-lg font-bold text-white mb-4 border-b border-[#30363D] pb-2">
            Final Scores
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0D1117] p-4 rounded-lg border border-[#30363D]">
              <div className="flex justify-between mb-2">
                <span className="text-[#3fb950] font-bold">{team1.name}</span>
                <span className="text-white font-mono font-bold">
                  {team1.in_game_score} pts
                </span>
              </div>
            </div>
            <div className="bg-[#0D1117] p-4 rounded-lg border border-[#30363D]">
              <div className="flex justify-between mb-2">
                <span className="text-[#a371f7] font-bold">{team2.name}</span>
                <span className="text-white font-mono font-bold">
                  {team2.in_game_score} pts
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

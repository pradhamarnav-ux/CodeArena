import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { Trophy, ArrowLeft, Skull } from "lucide-react";
import { Skeleton } from "../components/Skeleton";

export default function BattleRoyaleResults() {
  const { id } = useParams();
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/br/${id}`)
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
          <div className="p-8">
            <Skeleton className="h-6 w-40 mb-6" />
            <div className="space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
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
        <Link to={`/battle-royale/${id}`} className="text-[#58A6FF] underline">
          Back to Arena
        </Link>
      </div>
    );
  }

  const winner = match.players.find((p: any) => p.status === "winner");

  // Sort players for standings
  const standings = [...match.players].sort((a, b) => {
    if (a.status === "winner") return -1;
    if (b.status === "winner") return 1;
    return (b.eliminated_in_round || 0) - (a.eliminated_in_round || 0);
  });

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
        <div className="bg-gradient-to-br from-[#8957e5]/20 to-[#0D1117] p-8 text-center border-b border-[#30363D]">
          <Trophy className="w-16 h-16 text-[#EF9F27] mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">
            Battle Royale Finished
          </h1>
          {winner ? (
            <p className="text-xl text-[#C9D1D9]">
              Winner:{" "}
              <span className="text-[#a371f7] font-bold text-2xl">
                {winner.cf_handle}
              </span>
            </p>
          ) : (
            <p className="text-xl text-[#8B949E]">Everyone eliminated.</p>
          )}
          {winner && (
            <div className="mt-4 inline-block bg-[#0D1117] border border-[#EF9F27]/30 text-[#EF9F27] font-bold px-6 py-2 rounded-full">
              +1000 🪙
            </div>
          )}
        </div>

        <div className="p-8">
          <h3 className="text-lg font-bold text-white mb-6 border-b border-[#30363D] pb-2">
            Final Standings
          </h3>

          <div className="space-y-2">
            {standings.map((p: any, idx: number) => (
              <div
                key={p.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  p.status === "winner"
                    ? "bg-[#8957e5]/10 border-[#8957e5]/50"
                    : "bg-[#0D1117] border-[#30363D]"
                }`}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`font-mono font-bold w-6 text-center ${
                      idx === 0
                        ? "text-[#EF9F27]"
                        : idx === 1
                          ? "text-gray-300"
                          : idx === 2
                            ? "text-amber-700"
                            : "text-[#8B949E]"
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <span
                    className={`font-bold ${p.status === "winner" ? "text-white text-lg" : "text-[#C9D1D9]"}`}
                  >
                    {p.cf_handle}
                  </span>
                </div>
                <div>
                  {p.status === "winner" ? (
                    <span className="text-[#3fb950] font-bold text-sm">
                      SURVIVOR
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[#8B949E] text-sm">
                      <Skull className="w-4 h-4 text-red-400" /> Eliminated R
                      {p.eliminated_in_round}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

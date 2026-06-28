import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { io } from "socket.io-client";
import {
  Trophy,
  Clock,
  ExternalLink,
  ArrowLeft,
  Skull,
  Users,
  Share2,
} from "lucide-react";
import { Skeleton } from "../components/Skeleton";
import { toast } from "sonner";

export default function BattleRoyaleArena() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [interstitial, setInterstitial] = useState<{
    show: boolean;
    round: number;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 mins
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (
      match?.status === "active" &&
      match?.started_at &&
      startCountdown === null
    ) {
      const elapsed = Date.now() - new Date(match.started_at).getTime();
      if (elapsed < 3000) {
        setStartCountdown(3 - Math.floor(elapsed / 1000));
      } else {
        setStartCountdown(0);
      }
    }
  }, [match?.status, match?.started_at]);

  useEffect(() => {
    if (startCountdown !== null && startCountdown > 0) {
      const timer = setTimeout(
        () => setStartCountdown(startCountdown - 1),
        1000,
      );
      return () => clearTimeout(timer);
    }
  }, [startCountdown]);

  useEffect(() => {
    const token = localStorage.getItem("token") || "";
    fetch("/api/users/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setCurrentUser(data);
      })
      .catch(() => {});

    const fetchMatch = () => {
      fetch(`/api/br/${id}`)
        .then((res) => res.json())
        .then((data) => {
          setMatch(data);
          setLoading(false);
        });
    };
    fetchMatch();

    const socket = io();
    socket.emit("join_match", id);

    socket.on("br_solve", (data) => {
      fetchMatch();

      toast.success(`${data.handle} solved!`, {
        description: `(${data.solvedCount} / ${data.totalAlive} solved this round)`,
      });
    });

    socket.on("elimination", (data) => {
      // Re-fetch match to get updated players
      fetchMatch();
      toast.error(`${data.handle} has been eliminated!`, { icon: "💀" });
    });

    socket.on("round_transition", (data) => {
      setInterstitial({ show: true, round: match?.current_round || 1 });
      setTimeout(() => {
        setInterstitial(null);
        setTimeLeft(600);
        fetchMatch();
      }, 10000);
    });

    socket.on("match_ended", (data) => {
      toast.success("Match Ended! Navigating to results...", {
        duration: 4000,
      });
      setTimeout(() => {
        navigate(`/battle-royale/${id}/results`);
      }, 2000);
    });

    socket.on("match_updated", () => {
      fetchMatch();
    });

    socket.on("match_started", () => {
      fetchMatch();
    });

    const pollTimer = setInterval(() => {
      setMatch((current: any) => {
        if (current?.status === "pending") {
          fetchMatch();
        }
        return current;
      });
    }, 3000);

    return () => {
      socket.disconnect();
      clearInterval(pollTimer);
    };
  }, [id, match?.current_round, navigate]);

  useEffect(() => {
    if (loading || match?.status === "finished" || interstitial) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          fetch(`/api/br/${id}/forceEnd`, { method: "POST" });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, match?.status, interstitial, id]);

  if (loading)
    return (
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 p-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-[1.2] space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="flex-1 space-y-6">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );

  if (!match)
    return <div className="text-white text-center mt-20">Match not found.</div>;

  if (startCountdown !== null && startCountdown > 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[70vh] w-full animate-in zoom-in duration-300">
        <h2 className="text-[120px] font-black text-[#f85149] drop-shadow-2xl animate-pulse">
          {startCountdown}
        </h2>
        <p className="text-2xl text-[#8B949E] font-bold mt-4 tracking-widest">
          BATTLE DROPS SOON
        </p>
      </div>
    );
  }

  if (match.status === "pending") {
    const isCreator = currentUser?.id === match.creator_id;
    const allAcceptedAndReady = match.players.every(
      (m: any) => m.accepted === 1 && m.is_ready === 1,
    );

    const handleStartMatch = async () => {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/br/${id}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Match started!");
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to start match");
      }
    };

    const handleToggleReady = async () => {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/br/${id}/ready`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        toast.success(d.is_ready ? "You are ready!" : "You are not ready");
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to toggle ready state");
      }
    };

    let isCurrentUserInMatch = false;
    let currentUserReady = false;
    let currentUserAccepted = false;
    let currentUserInviteId = "";
    match.players.forEach((m: any) => {
      if (
        currentUser &&
        m.cf_handle.toLowerCase() === currentUser.cf_handle.toLowerCase()
      ) {
        isCurrentUserInMatch = true;
        currentUserReady = m.is_ready === 1;
        currentUserAccepted = m.accepted === 1;
        currentUserInviteId = m.id;
      }
    });

    const handleAcceptInvite = async () => {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(
        `/api/invitations/${currentUserInviteId}/accept`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        toast.success("Invitation accepted!");
      } else {
        toast.error("Failed to accept invitation");
      }
    };

    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[70vh] max-w-4xl mx-auto space-y-8 p-4 animate-in fade-in zoom-in duration-500">
        <div className="text-center">
          <Skull className="w-16 h-16 text-[#f85149] animate-pulse mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-2">
            Battle Royale Lobby
          </h2>
          <p className="text-[#8B949E] text-lg">
            Waiting for all players to get ready.
          </p>
        </div>

        <div className="bg-[#161B22] border border-[#30363D] p-6 rounded-xl w-full">
          <h3 className="text-xl font-bold text-white mb-4 text-[#f85149]">
            Players ({match.players.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {match.players.map((m: any) => (
              <div
                key={m.id}
                className="flex items-center justify-between bg-[#0D1117] p-3 rounded-lg border border-[#30363D]"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={`https://ui-avatars.com/api/?name=${m.cf_handle}&background=random`}
                    alt="avatar"
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="text-white font-medium">{m.cf_handle}</span>
                </div>
                {m.accepted === 1 ? (
                  m.is_ready === 1 ? (
                    <span className="text-[#3fb950] text-sm font-bold bg-[#3fb950]/10 px-2 py-1 rounded">
                      READY
                    </span>
                  ) : (
                    <span className="text-amber-500 text-sm font-bold bg-amber-500/10 px-2 py-1 rounded">
                      NOT READY
                    </span>
                  )
                ) : (
                  <span className="text-[#8B949E] text-sm font-bold bg-[#30363D]/50 px-2 py-1 rounded">
                    PENDING
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Invite link copied!");
            }}
            className="px-6 py-3 rounded-lg font-bold text-lg transition-colors bg-[#1F6FEB] hover:bg-[#388BFD] text-white flex items-center gap-2"
          >
            <Share2 className="w-5 h-5" /> Invite
          </button>

          {isCurrentUserInMatch &&
            (!currentUserAccepted ? (
              <button
                onClick={handleAcceptInvite}
                className="px-8 py-3 rounded-lg font-bold text-lg transition-colors bg-[#f85149] hover:bg-[#d4433d] text-white"
              >
                Accept Invitation
              </button>
            ) : (
              <button
                onClick={handleToggleReady}
                className={`px-8 py-3 rounded-lg font-bold text-lg transition-colors ${currentUserReady ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-[#f85149] hover:bg-[#d4433d] text-white"}`}
              >
                {currentUserReady ? "Unready" : "Ready Up"}
              </button>
            ))}

          {isCreator && (
            <button
              onClick={handleStartMatch}
              disabled={!allAcceptedAndReady}
              className={`px-8 py-3 rounded-lg font-bold text-lg transition-colors ${allAcceptedAndReady ? "bg-[#f85149] hover:bg-[#d4433d] text-white" : "bg-[#30363D] text-gray-500 cursor-not-allowed"}`}
            >
              {allAcceptedAndReady ? "Start Battle" : "Waiting for players..."}
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentQ = match.questions.find(
    (q: any) => q.slot === match.current_round,
  );
  const alivePlayers = match.players.filter((p: any) => p.status === "alive");
  const eliminatedPlayers = match.players.filter(
    (p: any) => p.status === "eliminated",
  );

  const solvesThisRound = (match.solves || []).filter(
    (s: any) => s.round_number === match.current_round,
  ).length;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 relative">
      {interstitial?.show && (
        <div className="absolute inset-0 z-40 bg-[#0D1117]/90 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl border border-[#30363D]">
          <h2 className="text-4xl font-bold text-white mb-4">
            Round {interstitial.round} Over
          </h2>
          <p className="text-xl text-[#8B949E] mb-8">
            Eliminating slowest solvers...
          </p>
          <div className="animate-pulse flex gap-2">
            <div className="w-3 h-3 bg-[#EF9F27] rounded-full"></div>
            <div className="w-3 h-3 bg-[#EF9F27] rounded-full delay-100"></div>
            <div className="w-3 h-3 bg-[#EF9F27] rounded-full delay-200"></div>
          </div>
          <p className="mt-8 text-sm text-[#58A6FF] font-bold">
            Next round starting in 10 seconds
          </p>
        </div>
      )}

      <div className="flex items-center justify-between bg-[#161B22] border border-[#30363D] rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="p-2 text-[#8B949E] hover:text-white transition-colors rounded-lg hover:bg-[#30363D]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Battle Royale <span className="text-[#8957e5]">·</span> Round{" "}
              {match.current_round}/5
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-[#0D1117] border border-[#30363D] px-4 py-2 rounded-lg">
            <Clock className="w-4 h-4 text-[#8B949E]" />
            <span className="font-mono font-bold text-[#EF9F27]">
              {formatTime(timeLeft)}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-[#8957e5]/10 border border-[#8957e5]/30 px-4 py-2 rounded-lg text-[#a371f7] font-bold">
            <Users className="w-4 h-4" />
            {alivePlayers.length} / {match.players.length} Alive
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Panel: Current Question */}
        <div className="flex-[1.2] space-y-6">
          {currentQ ? (
            <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden shadow-sm">
              <div className="bg-[#0D1117] p-6 border-b border-[#30363D]">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-[#21262D] text-[#C9D1D9] font-bold px-3 py-1 rounded-md">
                    Q{currentQ.slot}
                  </span>
                  <div className="text-sm text-[#8B949E] bg-[#21262D] px-3 py-1 rounded-md">
                    Rating: {currentQ.rating}
                  </div>
                </div>
                <a
                  href={currentQ.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-3xl font-bold text-[#58A6FF] hover:underline flex items-center gap-2"
                >
                  {currentQ.name} <ExternalLink className="w-6 h-6" />
                </a>
              </div>
              <div className="p-6">
                <div className="flex justify-between text-sm font-bold text-[#8B949E] mb-2">
                  <span>Progress</span>
                  <span>
                    {solvesThisRound} / {alivePlayers.length} Solved
                  </span>
                </div>
                <div className="w-full bg-[#0D1117] rounded-full h-3 overflow-hidden border border-[#30363D]">
                  <div
                    className="bg-[#EF9F27] h-full transition-all duration-500"
                    style={{
                      width: `${(solvesThisRound / alivePlayers.length) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-12 text-center text-[#8B949E]">
              Waiting for round...
            </div>
          )}

          {/* Elimination Feed */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 shadow-sm h-64 overflow-y-auto">
            <h3 className="text-[#C9D1D9] font-bold mb-4 flex items-center gap-2">
              <Skull className="w-4 h-4 text-red-400" /> Elimination Feed
            </h3>
            <div className="space-y-3">
              {(match.eliminations || [])
                .slice()
                .reverse()
                .map((e: any) => (
                  <div
                    key={e.id}
                    className="text-sm p-3 bg-[#0D1117] border border-red-500/20 rounded-lg flex items-center justify-between"
                  >
                    <span className="font-bold text-white line-through decoration-red-500">
                      {e.cf_handle}
                    </span>
                    <span className="text-xs text-[#8B949E]">
                      Round {e.round_number} —{" "}
                      <span className="text-red-400">
                        {e.reason === "unsolved" ? "Unsolved" : "Slowest"}
                      </span>
                    </span>
                  </div>
                ))}
              {(!match.eliminations || match.eliminations.length === 0) && (
                <div className="text-sm text-[#8B949E] text-center pt-8">
                  No eliminations yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Player Grid */}
        <div className="flex-1 space-y-6">
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 shadow-sm">
            <h2 className="text-[#C9D1D9] font-bold mb-4 border-b border-[#30363D] pb-4 text-center">
              Status Grid
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {match.players.map((p: any) => {
                const isAlive = p.status === "alive";
                const hasSolved =
                  isAlive &&
                  (match.solves || []).some(
                    (s: any) =>
                      s.round_number === match.current_round &&
                      s.player_id === p.id,
                  );

                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center ${
                      isAlive
                        ? hasSolved
                          ? "bg-[#3fb950]/10 border-[#3fb950]/50"
                          : "bg-[#0D1117] border-[#30363D]"
                        : "bg-red-500/5 border-red-500/20 opacity-50"
                    }`}
                  >
                    <span
                      className={`font-bold text-sm truncate w-full ${isAlive ? "text-white" : "text-[#8B949E] line-through"}`}
                    >
                      {p.cf_handle}
                    </span>
                    {isAlive && hasSolved && (
                      <span className="text-[10px] text-[#3fb950] font-bold mt-1 uppercase">
                        Solved
                      </span>
                    )}
                    {!isAlive && (
                      <span className="text-[10px] text-red-400 font-bold mt-1 uppercase">
                        R{p.eliminated_in_round}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { io, Socket } from "socket.io-client";
import { Trophy, ExternalLink, Clock, Share2 } from "lucide-react";
import confetti from "canvas-confetti";
import { Skeleton } from "../components/Skeleton";
import { toast } from "sonner";

let socket: Socket;

export default function Arena() {
  const { id } = useParams();
  const [match, setMatch] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [winBanner, setWinBanner] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    socket = io();
    socket.emit("join_match", id);

    const token = localStorage.getItem("token") || "";
    fetch("/api/users/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setCurrentUser(data);
      })
      .catch(() => {});

    const fetchMatch = () => {
      fetch(`/api/matches/${id}`)
        .then((r) => r.json())
        .then(setMatch);
    };

    fetchMatch();

    socket.on("new_solve", (data) => {
      toast.success(`${data.solvedBy} solved a problem!`, {
        description: `Problem ${data.problemIndex} has been captured.`,
        duration: 4000,
      });
      setMatch((prev: any) => {
        if (!prev) return prev;
        const newTeams = prev.teams.map((t: any) => {
          if (t.id === data.teamId) {
            return {
              ...t,
              solves: [
                ...t.solves,
                {
                  problem_index: data.problemIndex,
                  solved_by_handle: data.solvedBy,
                },
              ],
            };
          }
          return t;
        });
        return { ...prev, teams: newTeams };
      });
    });

    socket.on("match_won", (data) => {
      setWinBanner(data);
      toast.success(`Match Over! Team won!`, { duration: 6000 });
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
      });
      setMatch((prev: any) => ({ ...prev, status: "finished" }));
    });

    socket.on("match_ended_timeout", () => {
      setWinBanner({ type: "timeout" });
      toast.info("Match Ended - Time's Up!", { duration: 6000 });
      setMatch((prev: any) => ({ ...prev, status: "finished" }));
    });

    socket.on("match_updated", () => {
      fetchMatch();
    });

    socket.on("match_started", () => {
      fetchMatch();
    });

    // Simple polling if pending (fallback)
    const pollTimer = setInterval(() => {
      setMatch((current) => {
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
  }, [id]);

  useEffect(() => {
    if (!match || match.status === "finished") return;
    const interval = setInterval(() => {
      const end =
        new Date(match.started_at).getTime() +
        match.duration_minutes * 60 * 1000;
      const rem = end - Date.now();
      if (rem <= 0) {
        setTimeLeft("00:00:00");
      } else {
        const h = Math.floor(rem / 3600000);
        const m = Math.floor((rem % 3600000) / 60000);
        const s = Math.floor((rem % 60000) / 1000);
        setTimeLeft(
          `${h > 0 ? h.toString().padStart(2, "0") + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`,
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [match]);

  if (!match)
    return (
      <div className="flex flex-col h-full overflow-hidden relative max-w-6xl mx-auto w-full p-4 space-y-8">
        <div className="flex justify-center mb-4">
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex-1 flex flex-col md:flex-row gap-6 lg:gap-8">
          <div className="flex-1 space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="aspect-square w-full rounded-sm" />
          </div>
          <div className="hidden md:flex w-8 flex-col items-center justify-center py-8">
            <Skeleton className="w-[1px] h-full" />
          </div>
          <div className="flex-1 space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="aspect-square w-full rounded-sm" />
          </div>
        </div>
        <Skeleton className="h-20 w-full rounded-xl mt-8" />
      </div>
    );

  const team1 = match.teams[0];
  const team2 = match.teams[1];

  if (match.status === "pending") {
    const isCreator = currentUser?.id === match.creator_id;
    const allAcceptedAndReady = match.teams.every((t: any) =>
      t.members.every((m: any) => m.accepted === 1 && m.is_ready === 1),
    );

    const handleStartMatch = async () => {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/matches/${id}/start`, {
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
      const res = await fetch(`/api/matches/${id}/ready`, {
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
    match.teams.forEach((t: any) => {
      t.members.forEach((m: any) => {
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
      <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto space-y-8 p-4 animate-in fade-in zoom-in duration-500">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-[#EF9F27] animate-pulse mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-2">Match Lobby</h2>
          <p className="text-[#8B949E] text-lg">
            Waiting for all players to get ready.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          {match.teams.map((t: any) => (
            <div
              key={t.id}
              className="bg-[#161B22] border border-[#30363D] p-6 rounded-xl"
            >
              <h3
                className="text-xl font-bold text-white mb-4"
                style={{ color: t.color }}
              >
                {t.name}
              </h3>
              <div className="space-y-3">
                {t.members.map((m: any) => (
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
                      <span className="text-white font-medium">
                        {m.cf_handle}
                      </span>
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
          ))}
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
                className="px-8 py-3 rounded-lg font-bold text-lg transition-colors bg-[#238636] hover:bg-[#2ea043] text-white"
              >
                Accept Invitation
              </button>
            ) : (
              <button
                onClick={handleToggleReady}
                className={`px-8 py-3 rounded-lg font-bold text-lg transition-colors ${currentUserReady ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-[#3fb950] hover:bg-[#2ea043] text-white"}`}
              >
                {currentUserReady ? "Unready" : "Ready Up"}
              </button>
            ))}

          {isCreator && (
            <button
              onClick={handleStartMatch}
              disabled={!allAcceptedAndReady}
              className={`px-8 py-3 rounded-lg font-bold text-lg transition-colors ${allAcceptedAndReady ? "bg-[#238636] hover:bg-[#2ea043] text-white" : "bg-[#30363D] text-gray-500 cursor-not-allowed"}`}
            >
              {allAcceptedAndReady ? "Start Match" : "Waiting for players..."}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {winBanner && (
        <div className="absolute top-0 left-0 right-0 z-50 animate-in slide-in-from-top-10 duration-700">
          <div className="bg-[#161B22]/90 backdrop-blur-md border border-amber-500/50 p-6 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.2)] text-center">
            <h2 className="text-3xl font-bold text-[#EF9F27] mb-2">
              {winBanner.type === "timeout"
                ? "Match Ended - Time's Up!"
                : `Team Won!`}
            </h2>
            {winBanner.prize > 0 && (
              <p className="text-xl text-white">
                Prize Pool: {winBanner.prize} Coins
              </p>
            )}
            <Link
              to="/"
              className="inline-block mt-4 px-6 py-2 bg-[#EF9F27] hover:bg-[#d88c20] text-black font-bold rounded-md transition-colors"
            >
              Back to Lobby
            </Link>
          </div>
        </div>
      )}

      {/* Top Bar for Time */}
      <div className="flex justify-center mb-4">
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-widest opacity-50">
            Time Remaining
          </span>
          <span className="text-xl font-mono font-bold text-white">
            {timeLeft || "00:00"}
          </span>
        </div>
      </div>

      <main className="flex-1 flex flex-col md:flex-row gap-6 lg:gap-8 overflow-hidden w-full max-w-6xl mx-auto">
        <BingoGrid
          team={team1}
          match={match}
          winBanner={winBanner}
          color="teal"
        />

        {/* Center Divider / Status */}
        <div className="hidden md:flex w-8 flex-col items-center justify-center gap-4 py-8">
          <div
            className="text-xs font-bold text-[#EF9F27] rotate-180 uppercase tracking-widest"
            style={{ writingMode: "vertical-rl" }}
          >
            VS
          </div>
          <div className="w-[1px] flex-1 bg-[#30363D]"></div>
          <div className="flex flex-col gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-[#534AB7]"></div>
          </div>
          <div className="w-[1px] flex-1 bg-[#30363D]"></div>
          <div
            className="text-xs font-bold text-[#8B949E] rotate-180 uppercase tracking-widest"
            style={{ writingMode: "vertical-rl" }}
          >
            BINGO
          </div>
        </div>

        <BingoGrid
          team={team2}
          match={match}
          winBanner={winBanner}
          color="purple"
        />
      </main>

      {/* Footer Interface */}
      <footer className="mt-8 bg-[#161B22] border border-[#30363D] rounded-xl flex items-center p-4 gap-6 max-w-6xl mx-auto w-full">
        <div className="flex-1">
          <span className="text-[10px] uppercase font-bold text-[#8B949E] block mb-1">
            Prize Pool
          </span>
          <span className="text-2xl font-bold text-[#EF9F27]">
            {match.prize_pool} 🪙
          </span>
        </div>
      </footer>
    </div>
  );
}

function BingoGrid({
  team,
  match,
  winBanner,
  color,
}: {
  team: any;
  match: any;
  winBanner: any;
  color: "teal" | "purple";
}) {
  if (!team) return null;

  const gridSize = match.grid_size;
  const isWinner = winBanner && winBanner.winnerTeamId === team.id;
  const winningLine = isWinner ? winBanner.winningLine : [];

  const bgHeaderColorClass =
    color === "teal"
      ? "bg-[#1D9E75]/10 border-[#1D9E75]/30"
      : "bg-[#534AB7]/10 border-[#534AB7]/30";
  const textColorClass = color === "teal" ? "text-[#1D9E75]" : "text-[#534AB7]";
  const membersList = team.members
    ? team.members.map((m: any) => m.cf_handle).join(", ")
    : "";

  return (
    <div className="flex-1 flex flex-col gap-3">
      <div
        className={`flex items-center justify-between p-3 rounded-xl border ${bgHeaderColorClass}`}
      >
        <div
          className={color === "purple" ? "order-2 text-right" : "text-left"}
        >
          <h2
            className={`${textColorClass} font-bold text-sm uppercase tracking-wider`}
          >
            {team.name}
          </h2>
          <p className="text-xs opacity-60 truncate max-w-[120px] sm:max-w-xs">
            {membersList}
          </p>
        </div>
        <div
          className={color === "purple" ? "order-1 text-left" : "text-right"}
        >
          <span className="block text-xs uppercase opacity-50">Score</span>
          <span className="text-xl font-mono font-bold text-white">
            {team.solves.length}
          </span>
        </div>
      </div>

      <div
        className="grid gap-1.5 flex-1 aspect-square w-full max-h-[520px] mx-auto"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
        }}
      >
        {match.problems.map((prob: any, idx: number) => {
          const solve = team.solves.find((s: any) => s.problem_index === idx);
          const isSolved = !!solve;
          const isWinningCell = winningLine?.includes(idx);

          let bgClass = "bg-[#161B22] border-[#30363D] hover:border-gray-500";
          let textClass = "text-[#C9D1D9]";

          if (isWinningCell) {
            bgClass =
              "bg-[#EF9F27] border-[#EF9F27] shadow-[0_0_15px_rgba(239,159,39,0.5)]";
            textClass = "text-black";
          } else if (isSolved) {
            bgClass =
              color === "teal"
                ? "bg-[#1D9E75] border-[#1D9E75]"
                : "bg-[#534AB7] border-[#534AB7]";
            textClass = "text-white";
          }

          return (
            <a
              key={prob.id}
              href={prob.url}
              target="_blank"
              rel="noreferrer"
              className={`relative flex flex-col items-center justify-center border rounded-sm p-1 transition-all duration-300 ${bgClass}`}
            >
              <span className={`text-[10px] sm:text-xs font-bold ${textClass}`}>
                {prob.id}
              </span>
              {match.show_ratings && (
                <span
                  className={`text-[9px] sm:text-[10px] opacity-70 ${textClass}`}
                >
                  {prob.rating}
                </span>
              )}
              {isSolved && !isWinningCell && (
                <div className="mt-0.5 sm:mt-1 text-[8px] sm:text-[10px] font-bold tracking-widest uppercase">
                  SOLVED
                </div>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

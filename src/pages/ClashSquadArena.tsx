import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { io } from "socket.io-client";
import {
  Trophy,
  Clock,
  ExternalLink,
  ArrowLeft,
  Star,
  Share2,
} from "lucide-react";
import { Skeleton } from "../components/Skeleton";
import { toast } from "sonner";

export default function ClashSquadArena() {
  const { id } = useParams();
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState("");
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
      fetch(`/api/cs/${id}`)
        .then((res) => res.json())
        .then((data) => {
          setMatch(data);
          setLoading(false);
        });
    };
    fetchMatch();

    const socket = io();
    socket.emit("join_match", id);

    socket.on("cs_solve", (data) => {
      fetchMatch();

      const isTeam1 = data.teamId === match?.teams?.[0]?.id;
      const teamName =
        match?.teams?.find((t: any) => t.id === data.teamId)?.name || "A team";

      toast(
        `${data.handle} from ${teamName} just solved Q${data.questionSlot} — ${data.problemName}!`,
        {
          icon: "🚀",
          style: {
            background: isTeam1 ? "#1D9E75" : "#534AB7",
            color: "#fff",
            border: "none",
          },
        },
      );
    });

    socket.on("cs_match_ended", () => {
      toast.info("Match Ended - Time's Up!", { duration: 6000 });
      fetchMatch();
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
  }, [id]);

  useEffect(() => {
    if (!match || match.status === "finished" || match.status === "pending")
      return;
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
          `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`,
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [match?.status, match?.started_at, match?.duration_minutes]);

  if (loading)
    return (
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 p-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <div className="w-full lg:w-96 shrink-0 space-y-6">
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
        <h2 className="text-[120px] font-black text-white drop-shadow-2xl animate-pulse">
          {startCountdown}
        </h2>
        <p className="text-2xl text-[#8B949E] font-bold mt-4 tracking-widest">
          GET READY
        </p>
      </div>
    );
  }

  if (match.status === "pending") {
    const isCreator = currentUser?.id === match.creator_id;
    const allAcceptedAndReady = match.teams.every((t: any) =>
      t.members.every((m: any) => m.accepted === 1 && m.is_ready === 1),
    );

    const handleStartMatch = async () => {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/cs/${id}/start`, {
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
      const res = await fetch(`/api/cs/${id}/ready`, {
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
      <div className="flex flex-col items-center justify-center h-full min-h-[70vh] max-w-4xl mx-auto space-y-8 p-4 animate-in fade-in zoom-in duration-500">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-[#1D9E75] animate-pulse mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-2">
            Clash Squad Lobby
          </h2>
          <p className="text-[#8B949E] text-lg">
            Waiting for all squad members to get ready.
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
                className="px-8 py-3 rounded-lg font-bold text-lg transition-colors bg-[#1D9E75] hover:bg-[#16825D] text-white"
              >
                Accept Invitation
              </button>
            ) : (
              <button
                onClick={handleToggleReady}
                className={`px-8 py-3 rounded-lg font-bold text-lg transition-colors ${currentUserReady ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-[#1D9E75] hover:bg-[#16825D] text-white"}`}
              >
                {currentUserReady ? "Unready" : "Ready Up"}
              </button>
            ))}

          {isCreator && (
            <button
              onClick={handleStartMatch}
              disabled={!allAcceptedAndReady}
              className={`px-8 py-3 rounded-lg font-bold text-lg transition-colors ${allAcceptedAndReady ? "bg-[#1D9E75] hover:bg-[#16825D] text-white" : "bg-[#30363D] text-gray-500 cursor-not-allowed"}`}
            >
              {allAcceptedAndReady ? "Start Clash" : "Waiting for members..."}
            </button>
          )}
        </div>
      </div>
    );
  }

  const team1 = match.teams[0];
  const team2 = match.teams[1];

  const getSolvesForQuestion = (qSlot: number, teamId: string) => {
    return (match.solves || []).filter(
      (s: any) => s.question_slot === qSlot && s.team_id === teamId,
    );
  };

  const hasSweepBonus = (qSlot: number, teamId: string) => {
    return (match.bonuses || []).some(
      (b: any) => b.question_slot === qSlot && b.team_id === teamId,
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-[#161B22] border border-[#30363D] rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="p-2 text-[#8B949E] hover:text-white transition-colors rounded-lg hover:bg-[#30363D]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Clash Squad Match</h1>
            <div className="flex items-center gap-4 text-sm text-[#8B949E] mt-1">
              <span className="flex items-center gap-1 font-mono text-lg text-white">
                <Clock className="w-5 h-5 text-[#8B949E]" />{" "}
                {timeLeft || `${match.duration_minutes}:00`}
              </span>
              <span className="flex items-center gap-1">
                <Trophy className="w-4 h-4 text-[#EF9F27]" /> Prize:{" "}
                {match.prize_pool}
              </span>
            </div>
          </div>
        </div>

        {match.status === "finished" && (
          <div className="px-4 py-2 bg-[#238636]/10 text-[#3fb950] border border-[#238636]/30 rounded-lg font-bold">
            MATCH FINISHED
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Panel: Questions */}
        <div className="flex-1 space-y-4">
          {match.questions.map((q: any) => {
            const currentDecayOffset = q.slot * 100;
            const solvesSoFar = (match.solves || []).filter(
              (s: any) => s.question_slot === q.slot,
            ).length;
            const currentPoints = Math.max(
              q.basePoints - currentDecayOffset * solvesSoFar,
              50,
            );

            const t1Solves = getSolvesForQuestion(q.slot, team1.id);
            const t2Solves = getSolvesForQuestion(q.slot, team2.id);

            return (
              <div
                key={q.slot}
                className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden shadow-sm flex flex-col"
              >
                <div className="bg-[#0D1117] p-4 border-b border-[#30363D] flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="bg-[#21262D] text-[#C9D1D9] font-bold px-3 py-1 rounded-md">
                      Q{q.slot}
                    </span>
                    <a
                      href={q.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#58A6FF] font-bold hover:underline flex items-center gap-1 text-lg"
                    >
                      {q.name} <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-[#8B949E]">
                      Rating: {q.rating}
                    </div>
                    <div className="text-[#EF9F27] font-bold font-mono text-lg">
                      {currentPoints} pts
                    </div>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-2 divide-x divide-[#30363D]">
                  <div className="pr-4 space-y-2">
                    <div className="text-[#3fb950] font-bold text-sm mb-2">
                      {team1.name}
                    </div>
                    {t1Solves.map((s: any) => (
                      <div
                        key={s.id}
                        className="text-xs text-[#C9D1D9] flex justify-between"
                      >
                        <span>{s.cf_handle} solved</span>
                        <span className="text-[#3fb950] font-bold">
                          +{s.points_earned}
                        </span>
                      </div>
                    ))}
                    {hasSweepBonus(q.slot, team1.id) && (
                      <div className="text-xs text-[#EF9F27] flex items-center gap-1 font-bold mt-2 bg-[#EF9F27]/10 p-1.5 rounded">
                        <Star className="w-3 h-3" /> Sweep Bonus +500
                      </div>
                    )}
                  </div>
                  <div className="pl-4 space-y-2">
                    <div className="text-[#a371f7] font-bold text-sm mb-2">
                      {team2.name}
                    </div>
                    {t2Solves.map((s: any) => (
                      <div
                        key={s.id}
                        className="text-xs text-[#C9D1D9] flex justify-between"
                      >
                        <span>{s.cf_handle} solved</span>
                        <span className="text-[#a371f7] font-bold">
                          +{s.points_earned}
                        </span>
                      </div>
                    ))}
                    {hasSweepBonus(q.slot, team2.id) && (
                      <div className="text-xs text-[#EF9F27] flex items-center gap-1 font-bold mt-2 bg-[#EF9F27]/10 p-1.5 rounded">
                        <Star className="w-3 h-3" /> Sweep Bonus +500
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Panel: Leaderboard */}
        <div className="w-full lg:w-96 shrink-0 space-y-6">
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 shadow-sm">
            <h2 className="text-[#C9D1D9] font-bold mb-6 text-xl text-center border-b border-[#30363D] pb-4">
              Live Score
            </h2>

            <div className="flex flex-col gap-6">
              {/* Team 1 */}
              <div className="bg-[#238636]/5 border border-[#238636]/20 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-[#3fb950] text-lg">
                    {team1.name}
                  </span>
                  <span className="font-mono text-2xl text-white font-bold">
                    {team1.in_game_score}
                  </span>
                </div>
                <div className="space-y-2">
                  {team1.members.map((m: any) => (
                    <div key={m.id} className="flex justify-between text-sm">
                      <span className="text-[#C9D1D9]">{m.cf_handle}</span>
                      <span className="text-[#8B949E] font-mono">
                        {m.in_game_score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center text-[#8B949E] font-bold text-lg">
                VS
              </div>

              {/* Team 2 */}
              <div className="bg-[#8957e5]/5 border border-[#8957e5]/20 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-[#a371f7] text-lg">
                    {team2.name}
                  </span>
                  <span className="font-mono text-2xl text-white font-bold">
                    {team2.in_game_score}
                  </span>
                </div>
                <div className="space-y-2">
                  {team2.members.map((m: any) => (
                    <div key={m.id} className="flex justify-between text-sm">
                      <span className="text-[#C9D1D9]">{m.cf_handle}</span>
                      <span className="text-[#8B949E] font-mono">
                        {m.in_game_score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {match.status === "finished" && (
            <Link
              to={`/clash-squad/${id}/results`}
              className="w-full block text-center bg-[#EF9F27] hover:bg-[#d88d22] text-white font-bold py-3 rounded-xl shadow-md transition-colors"
            >
              View Results & Payouts
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

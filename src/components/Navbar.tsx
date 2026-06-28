import { Link, useNavigate } from "react-router";
import { Coins, User, LogOut, Bell } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { io } from "socket.io-client";

export default function Navbar() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [balance, setBalance] = useState(500);
  const [inviteCount, setInviteCount] = useState(0);
  const notifiedInvites = useRef<Set<string>>(new Set());

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      let socket: any = null;

      fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data.error) {
            setBalance(data.coin_balance || 0);

            // Establish real-time Socket.io listener for instant invitations
            socket = io();
            socket.emit("register_user", { userId: data.id, cfHandle: data.cf_handle });

            socket.on("new_invitation", (inv: any) => {
              if (inv && !notifiedInvites.current.has(inv.invite_id)) {
                notifiedInvites.current.add(inv.invite_id);
                setInviteCount((prev) => prev + 1);
                toast.success(`New Match Invitation!`, {
                  description: `${inv.host_name} invited you to a ${inv.mode} match.`,
                  duration: 8000,
                  action: {
                    label: "View & Decide",
                    onClick: () => navigate("/invitations"),
                  },
                });
              }
            });
          }
        });

      // Quick 1.5s backup polling for bulletproof fast deliveries
      const pollInvites = setInterval(() => {
        fetch("/api/users/me/invitations", {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then((data) => {
            if (!data.error && Array.isArray(data)) {
              setInviteCount(data.length);
              data.forEach((inv) => {
                if (!notifiedInvites.current.has(inv.invite_id)) {
                  notifiedInvites.current.add(inv.invite_id);
                  toast.success(`New Match Invitation!`, {
                    description: `${inv.host_name} invited you to a ${inv.mode} match.`,
                    duration: 8000,
                    action: {
                      label: "View & Decide",
                      onClick: () => navigate("/invitations"),
                    },
                  });
                }
              });
            }
          })
          .catch(() => {});
      }, 1500);

      return () => {
        clearInterval(pollInvites);
        if (socket) socket.disconnect();
      };
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    navigate("/login");
  };

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-[#30363D] bg-[#161B22] sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <Link
          to="/"
          className="text-xl font-bold tracking-tighter text-[#58A6FF]"
        >
          CODE<span className="text-white">ARENA</span>
        </Link>
        <div className="h-6 w-[1px] bg-[#30363D] hidden sm:block"></div>
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-xs font-mono font-medium tracking-widest uppercase opacity-70">
            Live Arena
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-4 text-sm font-bold text-[#8B949E]">
          <Link to="/create" className="hover:text-white transition-colors">
            Bingo
          </Link>
          <Link
            to="/clash-squad/create"
            className="hover:text-white transition-colors"
          >
            Clash Squad
          </Link>
          <Link
            to="/battle-royale/create"
            className="hover:text-white transition-colors"
          >
            Battle Royale
          </Link>
          <Link
            to="/invitations"
            className="hover:text-white transition-colors relative"
          >
            Invitations
            {inviteCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-[#EF9F27] text-[#0D1117] rounded-full font-extrabold font-mono">
                {inviteCount}
              </span>
            )}
          </Link>
        </div>

        {isLoggedIn ? (
          <div className="flex items-center gap-4">
            <Link
              to="/invitations"
              className="relative p-2 text-[#8B949E] hover:text-white hover:bg-[#30363D]/40 rounded-lg transition-colors border border-transparent hover:border-[#30363D]"
              title="Invitations"
            >
              <Bell className="w-5 h-5" />
              {inviteCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#EF9F27] text-[#0D1117] text-[10px] font-extrabold rounded-full w-5 h-5 flex items-center justify-center border-2 border-[#161B22] animate-bounce">
                  {inviteCount}
                </span>
              )}
            </Link>

            <div className="flex items-center gap-4 bg-[#0D1117] px-4 py-2 rounded-lg border border-[#30363D]">
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase opacity-50">Balance</span>
                <span className="text-sm font-bold text-[#EF9F27]">
                  {balance} 🪙
                </span>
              </div>
              <Link
                to="/profile"
                className="w-8 h-8 rounded-full bg-[#1F6FEB] flex items-center justify-center font-bold text-xs text-white hover:bg-blue-600 transition-colors"
              >
                ME
              </Link>
              <button
                onClick={handleLogout}
                className="text-[#8B949E] hover:text-red-400 transition-colors ml-2"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <Link
            to="/login"
            className="bg-[#238636] hover:bg-[#2ea043] text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-[#3fb950]/50"
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}

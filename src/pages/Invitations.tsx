import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Bell, Trophy, Coins, User, Calendar, Check, X, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

export default function Invitations() {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvitations = async () => {
    const token = localStorage.getItem("token") || "";
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/users/me/invitations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.error) {
        setInvitations(data);
      }
    } catch (e) {
      console.error("Failed to fetch invitations", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();

    // Setup an interval as backup, but since we have real-time sockets in Navbar,
    // we can also listen or poll. Let's poll at 2 seconds for fresh updates on this active page.
    const interval = setInterval(fetchInvitations, 2000);
    return () => clearInterval(interval);
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
        toast.success("Invitation accepted! Joining the arena...");
        setInvitations((prev) => prev.filter((i) => i.invite_id !== id));
        
        // Redirect to correct arena
        if (data.mode === "Arena") {
          navigate(`/arena/${matchId}`);
        } else if (data.mode === "Clash Squad") {
          navigate(`/clash-squad/${matchId}`);
        } else if (data.mode === "Battle Royale") {
          navigate(`/battle-royale/${matchId}`);
        }
      } else {
        toast.error("Failed to accept invitation");
      }
    } catch (e) {
      console.error(e);
      toast.error("An error occurred");
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
        toast.success("Invitation declined");
        setInvitations((prev) => prev.filter((i) => i.invite_id !== id));
      } else {
        toast.error("Failed to decline invitation");
      }
    } catch (e) {
      console.error(e);
      toast.error("An error occurred");
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 text-sm font-mono">Retrieving your invitations...</p>
      </div>
    );
  }

  const token = localStorage.getItem("token");
  if (!token) {
    return (
      <div className="max-w-md mx-auto bg-[#161B22] border border-[#30363D] p-8 rounded-xl text-center shadow-lg my-12">
        <ShieldAlert className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Authentication Required</h2>
        <p className="text-gray-400 text-sm mb-6">
          You must be logged in to view and manage match invitations.
        </p>
        <button
          onClick={() => navigate("/login")}
          className="px-6 py-2.5 bg-[#238636] hover:bg-[#2ea043] text-white font-bold rounded-lg text-sm transition-colors w-full"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#30363D] pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Bell className="w-8 h-8 text-[#58A6FF]" />
            Match Invitations
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Accept or decline invitations to matches in real-time. Accepted matches will immediately put you in the live arena.
          </p>
        </div>
        <div className="bg-[#161B22] border border-[#30363D] px-4 py-2 rounded-lg font-mono text-xs text-[#8B949E]">
          Pending Count: <span className="font-bold text-white">{invitations.length}</span>
        </div>
      </div>

      {/* Main invitations list */}
      <AnimatePresence mode="popLayout">
        {invitations.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#161B22] border border-dashed border-[#30363D] rounded-2xl p-12 text-center"
          >
            <div className="w-16 h-16 bg-[#0D1117] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#30363D]">
              <Bell className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">All Caught Up!</h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              No pending match invitations. When someone invites you by your Codeforces handle, it will show up here instantly.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {invitations.map((inv) => {
              // Set background and text styling based on game mode
              let modeColor = "bg-[#3fb950]/10 text-[#3fb950] border-[#3fb950]/30";
              if (inv.mode === "Clash Squad") {
                modeColor = "bg-[#ff7b72]/10 text-[#ff7b72] border-[#ff7b72]/30";
              } else if (inv.mode === "Battle Royale") {
                modeColor = "bg-[#a371f7]/10 text-[#a371f7] border-[#a371f7]/30";
              }

              return (
                <motion.div
                  layout
                  key={inv.invite_id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, x: -50 }}
                  transition={{ duration: 0.2 }}
                  className="bg-[#161B22] border border-[#30363D] hover:border-[#8B949E]/50 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all shadow-md relative overflow-hidden"
                >
                  {/* Visual Left Accent Accent */}
                  <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                    inv.mode === "1v1 Arena" ? "bg-[#3fb950]" :
                    inv.mode === "Clash Squad" ? "bg-[#ff7b72]" : "bg-[#a371f7]"
                  }`} />

                  <div className="flex items-center gap-4 pl-2">
                    <div className="w-12 h-12 rounded-full bg-[#0D1117] flex items-center justify-center border border-[#30363D]">
                      <User className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white text-base">
                          {inv.host_name}
                        </span>
                        <span className="text-xs text-[#8B949E]">
                          (@{inv.host_cf_handle})
                        </span>
                        <span className="text-xs text-gray-500">invited you to</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${modeColor}`}>
                          {inv.mode}
                        </span>

                        {inv.wager > 0 && (
                          <div className="flex items-center gap-1.5 bg-[#EF9F27]/10 text-[#EF9F27] px-2 py-0.5 rounded-md border border-[#EF9F27]/20 text-[10px] font-bold">
                            <Coins className="w-3 h-3" />
                            Wager: {inv.wager} 🪙
                          </div>
                        )}

                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto sm:justify-end border-t border-[#30363D]/50 pt-3 sm:border-0 sm:pt-0">
                    <button
                      onClick={() => declineInvitation(inv.invite_id)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 border border-[#f85149]/30 hover:border-[#f85149] bg-transparent hover:bg-[#f85149]/10 text-[#f85149] rounded-lg font-bold text-sm transition-all"
                    >
                      <X className="w-4 h-4" />
                      Decline
                    </button>
                    <button
                      onClick={() => acceptInvitation(inv.invite_id, inv.match_id)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2 bg-[#238636] hover:bg-[#2ea043] border border-[#3fb950]/30 hover:border-[#3fb950]/50 text-white rounded-lg font-bold text-sm shadow-sm transition-all"
                    >
                      <Check className="w-4 h-4" />
                      Accept
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export function SessionManager() {
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const checkToken = () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.exp) {
          const expTime = payload.exp * 1000;
          const now = Date.now();
          const remaining = expTime - now;

          if (remaining > 0 && remaining <= 60000) {
            setTimeLeft(Math.floor(remaining / 1000));
            setShowWarning(true);
          } else if (remaining <= 0) {
            localStorage.removeItem("token");
            window.location.href = "/login";
          } else {
            setShowWarning(false);
          }
        }
      } catch (e) {
        console.error("Failed to parse token:", e);
      }
    };

    const interval = setInterval(checkToken, 1000);
    return () => clearInterval(interval);
  }, []);

  const extendSession = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("/api/auth/extend", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      
      if (data.token) {
        localStorage.setItem("token", data.token);
        setShowWarning(false);
      } else {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    } catch (e) {
      console.error("Failed to extend session:", e);
    }
  };

  if (!showWarning) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-[#161B22] border border-[#e3b341] rounded-xl p-4 shadow-lg animate-in slide-in-from-bottom-5">
      <div className="flex items-center gap-3 mb-3 text-[#e3b341]">
        <AlertTriangle className="w-5 h-5" />
        <h3 className="font-bold">Session Expiring!</h3>
      </div>
      <p className="text-[#8B949E] text-sm mb-4">
        Your authentication session will expire in <span className="font-bold text-white">{timeLeft}</span> seconds.
      </p>
      <button
        onClick={extendSession}
        className="w-full bg-[#238636] hover:bg-[#2ea043] text-white font-bold py-2 px-4 rounded-lg transition-colors"
      >
        Extend Session
      </button>
    </div>
  );
}

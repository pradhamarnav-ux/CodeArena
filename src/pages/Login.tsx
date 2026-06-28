import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  User,
  LogIn,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/profile";

  const [cfHandle, setCfHandle] = useState("");
  const [cfToken, setCfToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const getFriendlyErrorMessage = (err: string) => {
    if (!err) return "";
    const lower = err.toLowerCase();
    if (lower.includes("access_denied")) return "Authentication was canceled or denied by the provider.";
    if (lower.includes("popup_closed_by_user")) return "The authentication window was closed before finishing.";
    if (lower.includes("network_error") || lower.includes("failed to fetch")) return "Network error. Please check your connection and try again.";
    if (lower.includes("no email found")) return "No verified email found on your account. Please add one and try again.";
    if (lower.includes("client_id")) return "OAuth application is misconfigured. Please contact support.";
    if (lower.includes("redirect_uri_mismatch")) return "OAuth application redirect URL is misconfigured.";
    return err;
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlError = params.get("error");
    if (urlError) {
      setError(getFriendlyErrorMessage(urlError));
    }
  }, [location]);

  const requestCfLogin = async () => {
    if (!cfHandle) return setError("Please enter your Codeforces handle.");
    setError("");
    try {
      const res = await fetch("/api/auth/codeforces/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: cfHandle }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCfToken(data.token);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const verifyCfLogin = async () => {
    setVerifying(true);
    setError("");
    try {
      const res = await fetch("/api/auth/codeforces/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: cfHandle, token: cfToken }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      localStorage.setItem("token", data.token);
      navigate(from, { replace: true });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const response = await fetch("/api/auth/google/url");
      if (!response.ok) throw new Error("Failed to get auth URL");
      const { url } = await response.json();

      const authWindow = window.open(
        url,
        "oauth_popup",
        "width=600,height=700",
      );
      if (!authWindow) {
        setError("Please allow popups for this site to connect your account.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleGithubLogin = async () => {
    try {
      const response = await fetch("/api/auth/github/url");
      if (!response.ok) throw new Error("Failed to get auth URL");
      const { url } = await response.json();

      const authWindow = window.open(
        url,
        "oauth_popup",
        "width=600,height=700",
      );
      if (!authWindow) {
        setError("Please allow popups for this site to connect your account.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith(".run.app") && !origin.includes("localhost")) return;
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        const token = event.data.token;
        if (token) {
          localStorage.setItem("token", token);
          navigate(from, { replace: true });
        }
      } else if (event.data?.type === "OAUTH_AUTH_ERROR") {
        setError(getFriendlyErrorMessage(event.data.error || "Authentication failed"));
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-[#161B22] border border-[#30363D] rounded-2xl shadow-xl animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold text-white mb-2 text-center">
        Welcome back
      </h1>
      <p className="text-[#8B949E] text-center text-sm mb-8">
        Login to join the Arena
      </p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm mb-6 text-center">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Codeforces Login */}
        <div className="space-y-4 bg-[#0D1117] p-5 rounded-xl border border-[#30363D]">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.5 7.5C5.32843 7.5 6 8.17157 6 9V21C6 21.8284 5.32843 22.5 4.5 22.5C3.67157 22.5 3 21.8284 3 21V9C3 8.17157 3.67157 7.5 4.5 7.5Z" fill="#F44336"/>
              <path d="M12 3C12.8284 3 13.5 3.67157 13.5 4.5V21C13.5 21.8284 12.8284 22.5 12 22.5C11.1716 22.5 10.5 21.8284 10.5 21V4.5C10.5 3.67157 11.1716 3 12 3Z" fill="#2196F3"/>
              <path d="M19.5 10.5C20.3284 10.5 21 11.1716 21 12V21C21 21.8284 20.3284 22.5 19.5 22.5C18.6716 22.5 18 21.8284 18 21V12C18 11.1716 18.6716 10.5 19.5 10.5Z" fill="#FFC107"/>
            </svg>
            <h2 className="text-white font-bold">Codeforces Login</h2>
          </div>

          {!cfToken ? (
            <>
              <input
                type="text"
                placeholder="Codeforces Handle"
                value={cfHandle}
                onChange={(e) => setCfHandle(e.target.value)}
                className="w-full bg-[#161B22] border border-[#30363D] rounded-lg px-4 py-2 text-white outline-none focus:border-[#58A6FF] transition-colors"
              />
              <button
                onClick={requestCfLogin}
                className="w-full bg-[#21262D] hover:bg-[#30363D] text-white py-2 rounded-lg font-bold border border-[#30363D] transition-colors flex items-center justify-center gap-2"
              >
                Authenticate <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="space-y-4 animate-in fade-in">
              <p className="text-sm text-[#8B949E]">
                To verify ownership, please change your Codeforces{" "}
                <strong className="text-white">First Name</strong> to this token
                temporarily:
              </p>
              <div className="bg-[#161B22] p-3 rounded-lg text-center font-mono text-[#EF9F27] border border-[#30363D] tracking-widest font-bold">
                {cfToken}
              </div>
              <a
                href="https://codeforces.com/settings/social"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#58A6FF] flex items-center gap-1 hover:underline"
              >
                Open Codeforces Settings <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={verifyCfLogin}
                disabled={verifying}
                className="w-full bg-[#238636] hover:bg-[#2ea043] text-white py-2 rounded-lg font-bold border border-[#3fb950]/50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verifying ? "Verifying..." : "Verify & Login"}{" "}
                <ShieldCheck className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-[1px] bg-[#30363D]"></div>
          <span className="text-[#8B949E] text-xs font-bold uppercase tracking-widest">
            OR
          </span>
          <div className="flex-1 h-[1px] bg-[#30363D]"></div>
        </div>

        {/* Google Login */}
        <button
          onClick={handleGoogleLogin}
          className="w-full bg-white hover:bg-gray-100 text-gray-900 py-3 rounded-xl font-bold flex items-center justify-center gap-3 transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        {/* GitHub Login */}
        <button
          onClick={handleGithubLogin}
          className="w-full bg-[#24292F] hover:bg-[#1b1f24] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-3 transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          Continue with GitHub
        </button>
      </div>
    </div>
  );
}

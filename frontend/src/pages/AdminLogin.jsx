import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { api, saveToken } from "@/lib/api";
import { LogIn } from "lucide-react";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.post("/admin/login", { email, password });
      saveToken(r.data.token);
      toast.success("Welcome back");
      navigate("/admin");
    } catch {
      toast.error("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#090A0F]">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#34D399] to-[#FBBF24] flex items-center justify-center font-condensed font-black text-[#0B132B] text-xl">Z</div>
          <span className="font-condensed font-black text-3xl">Zoom<span className="text-[#FBBF24]">Intern</span></span>
        </Link>
        <div className="rounded-2xl bg-[#12141D] border border-[#272B3C] p-8">
          <div className="text-[#FBBF24] text-xs tracking-widest uppercase mb-2">Command center</div>
          <h1 className="font-condensed font-black text-3xl">Sign in as admin</h1>
          <p className="text-sm text-zinc-500 mt-2">Only ZoomIntern staff can issue certificates.</p>

          <form onSubmit={submit} className="mt-6 space-y-3" data-testid="admin-login-form">
            <input
              data-testid="admin-email-input"
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-[#181B26] border border-[#272B3C]"
            />
            <input
              data-testid="admin-password-input"
              type="password"
              placeholder="Password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-[#181B26] border border-[#272B3C]"
            />
            <button
              data-testid="admin-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-[#FBBF24] text-[#090A0F] font-bold hover:bg-[#F59E0B] disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" /> {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

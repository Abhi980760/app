import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { api, saveInternToken } from "@/lib/api";

export default function InternLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [loading, setLoading] = useState(false);

  const requestCode = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.post("/intern/access/request", { email });
      setStep("code");
      toast.success("If your email has a certificate, a code is on its way.");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "We could not send an access code.");
    } finally { setLoading(false); }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await api.post("/intern/access/verify", { email, code });
      saveInternToken(response.data.token);
      navigate("/portal/certificates");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "That code is invalid or expired.");
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-[#090A0F] flex items-center justify-center px-6">
      <section className="w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-500">
        <Link data-testid="intern-portal-logo-link" to="/" className="flex items-center justify-center gap-2 mb-10">
          <span className="w-10 h-10 rounded-md bg-gradient-to-br from-[#34D399] to-[#FBBF24] grid place-items-center text-[#0B132B] font-condensed font-black text-xl">Z</span>
          <span className="font-condensed font-black text-3xl">Zoom<span className="text-[#FBBF24]">Intern</span></span>
        </Link>
        <div data-testid="intern-portal-access-panel" className="border border-[#272B3C] bg-[#12141D] rounded-2xl p-8">
          <div className="w-10 h-10 rounded-md bg-[#34D399]/10 text-[#34D399] grid place-items-center mb-5"><ShieldCheck className="w-5 h-5" /></div>
          <p className="text-xs text-[#FBBF24] tracking-widest uppercase mb-2">Intern portal</p>
          <h1 className="font-condensed font-black text-4xl">Your certificates.</h1>
          <p className="text-sm text-zinc-400 mt-3">Use the email where you received your ZoomIntern certificate.</p>
          {step === "email" ? (
            <form data-testid="intern-access-request-form" onSubmit={requestCode} className="mt-7 space-y-3">
              <input data-testid="intern-email-access-input" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
              <button data-testid="intern-request-code-button" disabled={loading} className={buttonClass} type="submit"><MailCheck className="w-4 h-4" />{loading ? "Sending..." : "Email me a code"}</button>
            </form>
          ) : (
            <form data-testid="intern-access-verify-form" onSubmit={verifyCode} className="mt-7 space-y-3">
              <div data-testid="intern-access-email-display" className="text-sm text-zinc-400">Code sent to <span className="text-white">{email}</span></div>
              <input data-testid="intern-access-code-input" required inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6-digit code" className={`${inputClass} tracking-[0.35em] font-mono`} />
              <button data-testid="intern-verify-code-button" disabled={loading} className={buttonClass} type="submit"><KeyRound className="w-4 h-4" />{loading ? "Verifying..." : "Open my portal"}</button>
              <button data-testid="intern-change-email-button" onClick={() => { setStep("email"); setCode(""); }} className="w-full text-sm text-zinc-400 hover:text-white transition" type="button">Use another email</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

const inputClass = "w-full h-12 px-4 rounded-xl bg-[#181B26] border border-[#272B3C] text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#FBBF24]";
const buttonClass = "w-full h-12 rounded-full bg-[#FBBF24] text-[#090A0F] font-bold inline-flex items-center justify-center gap-2 hover:bg-[#F59E0B] transition disabled:opacity-60";
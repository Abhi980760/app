import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, FileCheck, LogOut } from "lucide-react";
import { API, api, clearInternToken, getInternToken } from "@/lib/api";

export default function InternDashboard() {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getInternToken();
    if (!token) { navigate("/portal"); return; }
    api.get("/intern/certificates", { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => setCertificates(response.data))
      .catch(() => { clearInternToken(); navigate("/portal"); })
      .finally(() => setLoading(false));
  }, [navigate]);

  const signOut = () => { clearInternToken(); navigate("/portal"); };

  return (
    <main className="min-h-screen bg-[#090A0F]">
      <header className="border-b border-[#272B3C] bg-[#090A0F]/85 backdrop-blur sticky top-0 z-40">
        <div className="max-w-5xl mx-auto h-16 px-6 flex justify-between items-center">
          <Link data-testid="intern-dashboard-logo-link" to="/" className="font-condensed font-black text-2xl">Zoom<span className="text-[#FBBF24]">Intern</span></Link>
          <button data-testid="intern-portal-signout-button" onClick={signOut} className="text-sm text-zinc-300 inline-flex items-center gap-2 hover:text-white transition"><LogOut className="w-4 h-4" /> Sign out</button>
        </div>
      </header>
      <section className="max-w-5xl mx-auto px-6 py-14">
        <p className="text-xs text-[#FBBF24] tracking-widest uppercase">Intern portal</p>
        <h1 className="font-condensed font-black text-5xl sm:text-6xl mt-2">Your verified work.</h1>
        <p className="text-zinc-400 mt-4">Download the official PDF for any internship you completed with ZoomIntern.</p>
        <div data-testid="intern-certificates-list" className="mt-10 space-y-3">
          {loading && <div data-testid="intern-certificates-loading" className="text-zinc-400">Loading certificates...</div>}
          {!loading && certificates.length === 0 && <div data-testid="intern-certificates-empty" className="border border-[#272B3C] bg-[#12141D] p-6 rounded-xl text-zinc-400">No certificates are linked to this email yet.</div>}
          {certificates.map((certificate) => (
            <article key={certificate.id} data-testid={`intern-certificate-${certificate.certificate_id}`} className="border border-[#272B3C] bg-[#12141D] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 text-[#34D399] text-xs uppercase tracking-widest"><FileCheck className="w-4 h-4" /> Verified certificate</div>
                <h2 className="font-condensed font-black text-3xl mt-2">{certificate.area}</h2>
                <p className="text-sm text-zinc-400 mt-1">{certificate.start_date} → {certificate.end_date} · <span className="font-mono text-[#FBBF24]">{certificate.certificate_id}</span></p>
              </div>
              <a data-testid={`intern-download-${certificate.certificate_id}`} href={`${API}/certificates/${certificate.certificate_id}/pdf`} target="_blank" rel="noreferrer" className="h-11 px-5 rounded-full bg-[#FBBF24] text-[#090A0F] font-bold inline-flex items-center justify-center gap-2 hover:bg-[#F59E0B] transition"><Download className="w-4 h-4" /> PDF</a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
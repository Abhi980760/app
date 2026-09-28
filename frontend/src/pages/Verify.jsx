import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { api, API } from "@/lib/api";
import { ShieldCheck, BadgeCheck, XCircle, Download } from "lucide-react";

export default function Verify() {
  const [params, setParams] = useSearchParams();
  const [cid, setCid] = useState(params.get("id") || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const initial = params.get("id");
    if (initial) doVerify(initial);
    // eslint-disable-next-line
  }, []);

  const doVerify = async (id) => {
    if (!id) return;
    setLoading(true);
    setSearched(true);
    try {
      const r = await api.get(`/certificates/verify/${encodeURIComponent(id.trim())}`);
      setResult(r.data);
      setParams({ id: id.trim() });
    } catch {
      setResult({ valid: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <section className="max-w-[900px] mx-auto px-6 lg:px-10 py-16">
        <div className="text-[#FBBF24] text-xs tracking-[0.3em] uppercase mb-3">Verify a certificate</div>
        <h1 className="font-condensed font-black text-5xl sm:text-6xl leading-tight">Public registry.</h1>
        <p className="text-zinc-400 mt-4 max-w-xl">Enter any ZoomIntern certificate ID (e.g. <span className="font-mono text-[#FBBF24]">ZI-2026-XXXX</span>) to see if it's authentic.</p>

        <form
          onSubmit={(e) => { e.preventDefault(); doVerify(cid); }}
          className="mt-8 flex flex-col sm:flex-row gap-3 max-w-2xl"
        >
          <input
            data-testid="verify-input"
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            placeholder="ZI-2026-XXXX"
            className="flex-1 h-14 px-5 rounded-full bg-[#12141D] border border-[#272B3C] text-lg font-mono placeholder-zinc-600"
          />
          <button
            data-testid="verify-submit-btn"
            type="submit"
            disabled={loading}
            className="h-14 px-8 rounded-full bg-[#FBBF24] text-[#090A0F] font-bold hover:bg-[#F59E0B] disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" /> {loading ? "Checking..." : "Verify"}
          </button>
        </form>

        {searched && result && (
          <div className="mt-10">
            {result.valid ? (
              <div data-testid="verify-result-valid" className="rounded-2xl border border-[#34D399]/40 bg-[#0f2a20] p-8">
                <div className="flex items-center gap-3 mb-4">
                  <BadgeCheck className="w-7 h-7 text-[#34D399]" />
                  <div>
                    <div className="text-[10px] tracking-widest uppercase text-[#34D399]">Verified</div>
                    <div className="font-condensed font-black text-2xl">This certificate is authentic</div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-5 mt-6">
                  <Info label="Intern name" value={result.intern_name} />
                  <Info label="Program area" value={result.area} />
                  <Info label="Start date" value={result.start_date} />
                  <Info label="End date" value={result.end_date} />
                  <Info label="Duration" value={`${result.duration_weeks} weeks`} />
                  <Info label="Issue date" value={result.issue_date} />
                  <Info label="Certificate ID" value={result.certificate_id} mono />
                  <Info label="Issued by" value={result.ceo_name} />
                </div>
                <a
                  data-testid="download-pdf-btn"
                  href={`${API}/certificates/${result.certificate_id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-8 inline-flex items-center gap-2 px-6 h-11 rounded-full border border-[#FBBF24]/50 text-[#FBBF24] hover:bg-[#FBBF24]/10"
                >
                  <Download className="w-4 h-4" /> View / download PDF
                </a>
              </div>
            ) : (
              <div data-testid="verify-result-invalid" className="rounded-2xl border border-red-500/40 bg-red-900/10 p-8 flex items-center gap-4">
                <XCircle className="w-8 h-8 text-red-400" />
                <div>
                  <div className="font-condensed font-black text-2xl">Not found</div>
                  <div className="text-sm text-zinc-400">This ID doesn't match any certificate in our registry.</div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
}

function Info({ label, value, mono }) {
  return (
    <div>
      <div className="text-[10px] tracking-widest uppercase text-zinc-500 mb-1">{label}</div>
      <div className={`text-white ${mono ? "font-mono text-[#FBBF24]" : ""}`}>{value}</div>
    </div>
  );
}

import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

export default function Header() {
  const { pathname } = useLocation();
  const isActive = (p) => pathname === p;

  return (
    <header className="sticky top-0 z-50 bg-[#090A0F]/85 backdrop-blur-xl border-b border-[#272B3C]">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2 group">
          <div className="relative">
            <div className="w-9 h-9 rounded-md bg-gradient-to-br from-[#34D399] to-[#FBBF24] flex items-center justify-center font-condensed font-black text-[#0B132B] text-lg leading-none">
              Z
            </div>
          </div>
          <span className="font-condensed font-black text-2xl tracking-tight">
            Zoom<span className="text-[#FBBF24]">Intern</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm">
          <Link
            data-testid="nav-internships-link"
            to="/internships"
            className={`hover:text-[#FBBF24] transition ${isActive("/internships") ? "text-[#FBBF24]" : "text-zinc-300"}`}
          >
            Internships
          </Link>
          <Link
            data-testid="nav-verify-link"
            to="/verify"
            className={`hover:text-[#FBBF24] transition ${isActive("/verify") ? "text-[#FBBF24]" : "text-zinc-300"}`}
          >
            Verify
          </Link>
          <Link
            to="/admin/login"
            data-testid="nav-admin-link"
            className={`hover:text-[#FBBF24] transition ${pathname.startsWith("/admin") ? "text-[#FBBF24]" : "text-zinc-300"}`}
          >
            Admin
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/verify"
            data-testid="header-verify-btn"
            className="hidden sm:inline-flex items-center gap-2 px-4 h-10 rounded-full border border-[#272B3C] bg-[#12141D] text-sm hover:bg-[#1F2332] transition"
          >
            <ShieldCheck className="w-4 h-4 text-[#34D399]" /> Verify
          </Link>
          <Link
            to="/internships"
            data-testid="nav-apply-btn"
            className="inline-flex items-center gap-1.5 px-5 h-10 rounded-full bg-[#FBBF24] text-[#090A0F] text-sm font-bold hover:bg-[#F59E0B] transition shadow-lg shadow-amber-500/20"
          >
            Apply now <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

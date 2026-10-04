import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import Internships from "@/pages/Internships";
import Verify from "@/pages/Verify";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import InternLogin from "@/pages/InternLogin";
import InternDashboard from "@/pages/InternDashboard";

function App() {
  return (
    <div className="App min-h-screen bg-[#090A0F] text-[#F8FAFC]">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/internships" element={<Internships />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/portal" element={<InternLogin />} />
          <Route path="/portal/certificates" element={<InternDashboard />} />
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" position="top-right" richColors />
    </div>
  );
}

export default App;

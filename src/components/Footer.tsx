import { Link } from "@tanstack/react-router";
import { Github, Linkedin, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full bg-black text-white/80 py-16 px-6 sm:px-10 border-t border-white/10">
      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-serif text-lg tracking-[0.18em] text-white">GRASP AI</h3>
          <p className="text-sm text-white/60 leading-relaxed">
            An advanced AI-powered study assistant platform turning your syllabus into adaptive plans and flashcards.
          </p>
          <div className="flex gap-4 pt-2">
            <a href="https://github.com/rohillamanas06-commits/GraspAI" target="_blank" rel="noreferrer" className="text-white/60 hover:text-white transition"><Github className="w-5 h-5" /></a>
            <a href="https://www.linkedin.com/in/manas-rohilla" target="_blank" rel="noreferrer" className="text-white/60 hover:text-white transition"><Linkedin className="w-5 h-5" /></a>
            <a href="mailto:rohillamanas06@gmail.com" className="text-white/60 hover:text-white transition"><Mail className="w-5 h-5" /></a>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-white">Product</h4>
          <ul className="space-y-3 text-sm text-white/60">
            <li><Link to="/app/dashboard" className="hover:text-white transition">Dashboard</Link></li>
            <li><Link to="/app/study" className="hover:text-white transition">Study Agent</Link></li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-white">Other Products</h4>
          <ul className="space-y-3 text-sm text-white/60">
            <li><a href="https://www.resuai.co.in/" target="_blank" rel="noreferrer" className="hover:text-white transition">ResuAI</a></li>
            <li><a href="https://med-mate-ai-health-assistant-v2.vercel.app/" target="_blank" rel="noreferrer" className="hover:text-white transition">Med-Mate</a></li>
            <li><a href="https://cosmos-galaxy.vercel.app/" target="_blank" rel="noreferrer" className="hover:text-white transition">Cosmos</a></li>
            <li><a href="https://cortex-ai-v1.vercel.app/" target="_blank" rel="noreferrer" className="hover:text-white transition">Cortex</a></li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-white">Company</h4>
          <ul className="space-y-3 text-sm text-white/60">
            <li><Link to="/about" className="hover:text-white transition">About Us</Link></li>
            <li><Link to="/faq" className="hover:text-white transition">FAQ</Link></li>
          </ul>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-white">Legal</h4>
          <ul className="space-y-3 text-sm text-white/60">
            <li><Link to="/terms" className="hover:text-white transition">Terms of Service</Link></li>
            <li><Link to="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
            <li><Link to="/cookies" className="hover:text-white transition">Cookie Policy</Link></li>
            <li><Link to="/license" className="hover:text-white transition">License</Link></li>
          </ul>
        </div>
      </div>

      <div className="w-full border-t border-white/10 mt-16 pt-8 text-xs text-white/40 flex flex-col md:flex-row items-center justify-between">
        <p>© 2026 GraspAI. Built by Manas Rohilla.</p>
      </div>
    </footer>
  );
}

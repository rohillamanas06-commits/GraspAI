import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_legal/license")({
  component: LicensePage,
});

function LicensePage() {
  return (
    <div className="space-y-6 text-white/80">
      <h1 className="text-4xl font-bold text-white mb-8">License Information</h1>
      
      <p className="text-lg leading-relaxed">
        © {new Date().getFullYear()} GraspAI. All rights reserved.
      </p>

      <p className="leading-relaxed">
        The GraspAI platform, including its user interface, backend architecture, proprietary natural language processing algorithms, and associated codebase, constitutes proprietary software. All intellectual property rights are retained by the original author, Manas Rohilla. 
      </p>

      <p className="leading-relaxed">
        Unauthorized reproduction, distribution, public display, or modification of the underlying source code without explicit, written permission from the author is strictly prohibited. The design assets, branding, and logos associated with GraspAI are also protected under copyright law.
      </p>

      <p className="leading-relaxed mt-8 text-sm text-white/50">
        Third-party libraries, frameworks, and open-source tools utilized within this project (such as React, Tailwind CSS, FastAPI, and NLTK) remain under their respective licenses (e.g., MIT, Apache 2.0).
      </p>
    </div>
  );
}

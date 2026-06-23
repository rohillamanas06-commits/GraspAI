import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_legal/cookies")({
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <div className="space-y-6 text-white/80">
      <h1 className="text-4xl font-bold text-white mb-8">Cookie Policy</h1>
      
      <p className="text-lg leading-relaxed">
        GraspAI utilizes cookies and similar tracking technologies to improve your user experience, maintain your session state, and ensure the platform functions securely and efficiently.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-8 mb-4">What Are Cookies?</h2>
      <p className="leading-relaxed">
        Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used by website owners to make their websites work, or to work more efficiently, as well as to provide reporting information.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-8 mb-4">How We Use Cookies</h2>
      <p className="leading-relaxed">
        We use **strictly essential cookies** to keep you securely logged into your account and to remember your fundamental UI preferences, such as whether you have selected the light or dark mode theme. These cookies are critical for the website to function properly and cannot be switched off in our systems.
      </p>
      
      <p className="leading-relaxed">
        We do **not** use third-party advertising cookies or cross-site tracking cookies. We respect your attention and your privacy.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Managing Cookies</h2>
      <p className="leading-relaxed">
        You can choose to disable or clear cookies through your browser settings at any time. However, please be aware that doing so will impact the core functionalities of the GraspAI platform. If you block essential cookies, you will be required to frequently re-authenticate and your theme preferences will not be saved.
      </p>
    </div>
  );
}

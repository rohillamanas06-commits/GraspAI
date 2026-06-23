import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_legal/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="space-y-6 text-white/80">
      <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>
      
      <p className="text-lg leading-relaxed">
        At GraspAI, we are fundamentally committed to protecting your privacy and ensuring the security of your personal data. We believe in complete transparency regarding how your data is collected, used, and protected.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Information Collection</h2>
      <p className="leading-relaxed">
        We collect only the absolute minimum required information necessary to provide our core services. This includes basic authentication data (if you choose to create an account), system logs for error tracking, and the contents of the syllabus documents you explicitly upload for processing. We do not track your browsing habits across other websites.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Data Processing and Usage</h2>
      <p className="leading-relaxed">
        Your uploaded documents are processed securely via our automated AI pipeline strictly to generate your custom study materials. The text from your syllabus is transmitted securely to our AI providers (such as Google) via encrypted API calls solely for the purpose of inference. We do not sell your personal data or document contents to any third parties, marketing agencies, or data brokers.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Data Retention</h2>
      <p className="leading-relaxed">
        We retain your generated study plans and flashcards in our database so that you can access them across multiple sessions. You maintain full control over your data; if you wish to delete a session or your entire account, all associated data will be permanently purged from our primary servers.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-8 mb-4">Security Measures</h2>
      <p className="leading-relaxed">
        We employ industry-standard security measures, including SSL/TLS encryption for data in transit and secure database hosting via Neon PostgreSQL for data at rest. While we strive to use commercially acceptable means to protect your personal information, no method of transmission over the Internet is 100% secure.
      </p>
    </div>
  );
}

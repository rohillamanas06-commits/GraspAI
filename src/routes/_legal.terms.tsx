import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_legal/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="space-y-6 text-white/80">
      <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>
      <p className="text-sm mb-8">Last Updated: {new Date().toLocaleDateString()}</p>
      
      <p className="text-lg leading-relaxed">
        By accessing and using GraspAI, you agree to comply with and be bound by the following Terms of Service. Please read these terms carefully before using the platform. If you do not agree with any part of these terms, you must discontinue use of the service immediately.
      </p>
      
      <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. Use of Service</h2>
      <p className="leading-relaxed">
        GraspAI provides AI-generated study materials, flashcards, and schedules based on user-provided content. You may use this platform strictly for personal, non-commercial educational purposes. Any misuse of the service, including attempts to exploit, reverse-engineer, scrape data, or disrupt the platform's infrastructure, is strictly prohibited and may result in an immediate ban.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. User Content and Intellectual Property</h2>
      <p className="leading-relaxed">
        You retain all rights and ownership to the syllabus documents, notes, and materials you upload to the platform. By uploading them to GraspAI, you grant us a temporary, non-exclusive permission to process the text strictly for the purpose of generating your personal study plans and flashcards. You are solely responsible for ensuring that you have the legal right to upload and process any documents you provide.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. Limitation of Liability</h2>
      <p className="leading-relaxed">
        While GraspAI utilizes advanced AI models to generate highly accurate study materials, the platform is provided on an "as is" and "as available" basis. We do not guarantee the absolute accuracy, completeness, or reliability of the generated content. GraspAI shall not be held liable for any academic outcomes, failed exams, or loss of data resulting from the use of our service.
      </p>

      <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. Changes to Terms</h2>
      <p className="leading-relaxed">
        We reserve the right to modify or replace these Terms at any time at our sole discretion. We will provide notice of any significant changes by updating the "Last Updated" date at the top of this page. Your continued use of the platform after any such changes constitutes your acceptance of the new Terms.
      </p>
    </div>
  );
}

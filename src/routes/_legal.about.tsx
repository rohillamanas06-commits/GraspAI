import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_legal/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="space-y-6 text-white/80">
      <h1 className="text-4xl font-bold text-white mb-8">About GraspAI</h1>
      <p className="text-lg leading-relaxed">
        GraspAI is an advanced AI-powered study assistant platform designed to streamline the learning process and revolutionize how students prepare for exams. By converting dense syllabuses into structured, actionable learning paths, we save students hundreds of hours of manual planning.
      </p>
      <p className="text-lg leading-relaxed">
        Our core mission is to help students navigate complex coursework by automatically extracting key topics and dynamically generating adaptive flashcards and study plans. We believe that technology should empower learners to achieve their full potential without the burnout often associated with traditional studying methods.
      </p>
      <p className="text-lg leading-relaxed">
        By utilizing cutting-edge natural language processing and modern generative AI models like Google Gemini 2.5 Flash, GraspAI ensures that your study sessions are highly focused, incredibly efficient, and perfectly tailored to your specific needs. Our algorithm continuously learns from your performance, adjusting your schedule in real-time to ensure you spend more time on topics that challenge you and less on those you've already mastered.
      </p>
      <p className="text-lg leading-relaxed">
        Built by a passionate developer who understands the struggles of modern education, GraspAI is more than just a tool—it's your dedicated, 24/7 academic companion.
      </p>
    </div>
  );
}

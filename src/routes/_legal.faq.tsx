import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_legal/faq")({
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="space-y-8 text-white/80">
      <h1 className="text-4xl font-bold text-white mb-8">Frequently Asked Questions</h1>
      
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">How does GraspAI work?</h3>
          <p className="leading-relaxed">
            GraspAI simplifies the entire study process. You begin by uploading a syllabus PDF. Our system uses advanced Natural Language Processing to extract the relevant topics, subtopics, and weightages. Based on this data, it generates highly targeted flashcards and an adaptive day-by-day study schedule tailored exactly to your chosen exam date.
          </p>
        </div>
        
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">What makes the study plan "adaptive"?</h3>
          <p className="leading-relaxed">
            Unlike static study schedules, GraspAI learns from you. When you review flashcards, you rate them based on their difficulty. If you struggle with a specific topic, the AI will automatically rewrite your future study plan to allocate more revision time to that weak area, ensuring you are fully prepared before your exam.
          </p>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-white mb-2">Is the platform free to use?</h3>
          <p className="leading-relaxed">
            Yes, GraspAI is completely free to use. We believe that access to high-quality, AI-driven educational tools should be available to everyone, regardless of their financial background.
          </p>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-white mb-2">Can I export my flashcards to other platforms?</h3>
          <p className="leading-relaxed">
            Absolutely. We understand that many students already use established spaced-repetition systems. GraspAI provides a direct export function that allows you to download your AI-generated flashcards as a ready-to-import Anki deck (.apkg) or as raw JSON data for other applications.
          </p>
        </div>
      </div>
    </div>
  );
}

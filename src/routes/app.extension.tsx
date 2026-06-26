import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";

export const Route = createFileRoute("/app/extension")({
  component: ExtensionPage,
});

function ExtensionPage() {
  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full">
        <h1 className="text-xl font-semibold tracking-tight sm:text-3xl mb-4">Browser Extension</h1>
        <p className="text-base text-muted-foreground mb-8 max-w-[90%] leading-relaxed">
          The GraspAI Chrome Extension is a powerful tool designed to seamlessly integrate your reading experience with your study workflow. Whether you are reading Wikipedia articles, research papers, or online textbooks, you can highlight any text on any website and instantly turn it into comprehensive GraspAI flashcards with a single click. These flashcards are immediately synced to your GraspAI dashboard, allowing you to review them during your next study session without losing focus.
        </p>

        <ul className="list-disc pl-5 space-y-4 text-base text-muted-foreground mb-6 max-w-[90%]">
          <li>
            <strong>Download the Source Code:</strong> Securely download the latest version of the GraspAI extension ZIP file directly to your computer.
            <a href="/GraspAI.zip" download="GraspAI.zip" className="inline-flex items-center justify-center ml-2 text-primary hover:bg-primary/10 p-1 rounded-md transition-colors align-middle -mt-1" title="Download ZIP">
              <Download className="h-5 w-5" />
            </a>
          </li>
          <li><strong>Extract the Archive:</strong> Locate the downloaded archive folder on your device, right-click it, and extract all the contents to a new folder.</li>
          <li><strong>Open Extension Management:</strong> Open a new tab in your browser, type <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono border text-foreground">chrome://extensions/</code> in the address bar, and press Enter to access your browser's extensions dashboard.</li>
          <li><strong>Enable Developer Mode:</strong> Look for the <strong>Developer mode</strong> toggle switch in the top right corner of the page and turn it on to enable manual installation of unpacked extensions.</li>
          <li><strong>Load the Extension:</strong> Click the <strong>Load unpacked</strong> button that appears in the top left, browse to the folder where you extracted the extension files, and select it to complete the installation. You're ready to start highlighting!</li>
        </ul>
      </div>
    </div>
  );
}

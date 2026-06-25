import { createFileRoute } from "@tanstack/react-router";
import { Download, Puzzle, Settings, Unplug, CheckCircle2, Chrome, Coffee } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/extension")({
  component: ExtensionPage,
});

function ExtensionPage() {
  return (
    <div className="w-full space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:gap-3 sm:text-3xl">
          Browser Extension
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Highlight text on any website and instantly turn it into GraspAI flashcards.
        </p>
      </div>

      <Card className="w-full shadow-sm border-primary/20">
        <CardHeader className="pb-5">
          <CardTitle className="text-2xl">Get the Extension</CardTitle>
          <CardDescription className="text-base mt-2">
            Download the latest version of the GraspAI Chrome Extension and follow the steps below to install it.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Step 1: Download */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-6 gap-4">
            <div>
              <h3 className="text-xl font-semibold mb-1">1. Download</h3>
              <p className="text-sm text-muted-foreground">
                The extension is currently in beta. Download the source files to install manually.
              </p>
            </div>
            <Button className="font-medium shadow-sm shrink-0 px-6 py-5 text-base" asChild>
              <a href="/GraspAI.zip" download="GraspAI.zip">
                Download Extension
              </a>
            </Button>
          </div>

          {/* Step 2: Installation */}
          <div>
            <h3 className="text-xl font-semibold mb-6">2. Installation Guide</h3>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">1</div>
                <div>
                  <h4 className="font-medium text-base">Extract the ZIP file</h4>
                  <p className="text-sm text-muted-foreground mt-1">Unzip the downloaded `GraspAI.zip` file.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">2</div>
                <div>
                  <h4 className="font-medium text-base">Open Chrome Extensions</h4>
                  <p className="text-sm text-muted-foreground mt-1">Type <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono border">chrome://extensions/</code> and press Enter.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">3</div>
                <div>
                  <h4 className="font-medium text-base">Enable Developer Mode</h4>
                  <p className="text-sm text-muted-foreground mt-1">Toggle the <strong>Developer mode</strong> switch.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">4</div>
                <div>
                  <h4 className="font-medium text-base">Load Unpacked</h4>
                  <p className="text-sm text-muted-foreground mt-1">Click <strong>Load unpacked</strong> and select the folder.</p>
                </div>
              </div>

              <div className="flex gap-4 sm:col-span-2 lg:col-span-1">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">5</div>
                <div>
                  <h4 className="font-medium text-base">You're done!</h4>
                  <p className="text-sm text-muted-foreground mt-1">Pin it and start highlighting text!</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

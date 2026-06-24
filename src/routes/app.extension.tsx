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

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col h-full border-primary/20 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              1. Download the Extension
            </CardTitle>
            <CardDescription>
              Get the latest version of the GraspAI Chrome Extension as a ZIP file.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center items-center text-center p-6 space-y-4 bg-muted/30 rounded-md mx-6 mb-6">
            <Coffee className="h-16 w-16 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              This extension is currently in beta. You can install it manually by downloading the source files.
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full text-base py-6" asChild>
              <a href="/GraspAI.zip" download="GraspAI.zip">
                Download Extension
              </a>
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex flex-col h-full shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              2. Installation Guide
            </CardTitle>
            <CardDescription>
              Follow these simple steps to load the extension into Google Chrome.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-6">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">1</div>
                <div>
                  <h4 className="font-medium">Extract the ZIP file</h4>
                  <p className="text-sm text-muted-foreground">Unzip the downloaded `GraspAI.zip` file to a folder on your computer.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">2</div>
                <div>
                  <h4 className="font-medium flex items-center gap-2">Open Chrome Extensions</h4>
                  <p className="text-sm text-muted-foreground">Type <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">chrome://extensions/</code> into your Chrome URL bar and press Enter.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">3</div>
                <div>
                  <h4 className="font-medium">Enable Developer Mode</h4>
                  <p className="text-sm text-muted-foreground">Toggle the <strong>Developer mode</strong> switch in the top right corner of the page.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">4</div>
                <div>
                  <h4 className="font-medium flex items-center gap-2">Load Unpacked</h4>
                  <p className="text-sm text-muted-foreground">Click the <strong>Load unpacked</strong> button and select the folder you extracted in Step 1.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">5</div>
                <div>
                  <h4 className="font-medium flex items-center gap-2">You're done!</h4>
                  <p className="text-sm text-muted-foreground">Pin the extension to your toolbar, log in, and start highlighting text to generate flashcards!</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

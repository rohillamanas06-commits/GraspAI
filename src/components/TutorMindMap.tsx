import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ReactFlow, Background, Controls, Node, Edge, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2, Network, Paperclip, X, Maximize, Minimize, Download, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";

interface TutorMindMapProps {
  initialState?: { text: string; nodes: Node[]; edges: Edge[] };
  onSave: (state: { text: string; nodes: Node[]; edges: Edge[] }) => void;
}

/** Calculate node width/height based on label text so text doesn't overflow */
function autoSizeNodes(nodes: Node[]): Node[] {
  return nodes.map(node => {
    const label = String(node.data?.label || '');
    const charCount = label.length;
    // Estimate width: ~8px per char, min 120, max 280
    const width = Math.min(280, Math.max(120, charCount * 7));
    // Wrap into lines and estimate height
    const charsPerLine = Math.floor(width / 7);
    const lineCount = Math.max(1, Math.ceil(charCount / charsPerLine));
    const height = Math.max(40, lineCount * 22 + 20);
    return {
      ...node,
      style: {
        ...((node.style as Record<string, unknown>) || {}),
        width,
        minHeight: height,
        whiteSpace: 'normal' as const,
        wordBreak: 'break-word' as const,
        textAlign: 'center' as const,
        fontSize: '11px',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--primary)',
        color: 'var(--primary-foreground)',
        borderColor: 'var(--border)',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      className: 'border rounded-md transition-all duration-200 hover:opacity-90',
    };
  });
}

export function TutorMindMap(props: TutorMindMapProps) {
  return (
    <ReactFlowProvider>
      <TutorMindMapInner {...props} />
    </ReactFlowProvider>
  );
}

function TutorMindMapInner({ initialState, onSave }: TutorMindMapProps) {
  const { refresh } = useAuth();
  const { getNodes } = useReactFlow();
  const [text, setText] = useState(initialState?.text || "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<Node[]>(autoSizeNodes(initialState?.nodes || []));
  const [edges, setEdges] = useState<Edge[]>(initialState?.edges || []);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialState) {
      setText(initialState.text || "");
      setNodes(autoSizeNodes(initialState.nodes || []));
      setEdges(initialState.edges || []);
    }
  }, [initialState]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  const downloadAsHtml = () => {
    const currentNodes = getNodes();
    if (currentNodes.length === 0) return;

    // Use absolute positions from React Flow's layout engine
    const xs = currentNodes.map(n => (n as any).positionAbsolute?.x ?? n.position.x);
    const ys = currentNodes.map(n => (n as any).positionAbsolute?.y ?? n.position.y);
    const minX = Math.min(...xs) - 100;
    const minY = Math.min(...ys) - 100;

    // Calculate max bounds taking into account the rendered node sizes
    const maxX = Math.max(...currentNodes.map(n => ((n as any).positionAbsolute?.x ?? n.position.x) + (n.measured?.width ?? 200))) + 100;
    const maxY = Math.max(...currentNodes.map(n => ((n as any).positionAbsolute?.y ?? n.position.y) + (n.measured?.height ?? 100))) + 100;

    const w = maxX - minX;
    const h = maxY - minY;

    // Build an HTML mind map from nodes and edges (shifted by minX/minY)
    const nodesHtml = currentNodes.map(n => {
      const label = String(n.data?.label || '');
      const width = n.measured?.width || (n.style?.width as number) || 150;
      const height = n.measured?.height || (n.style?.minHeight as number) || 40;
      const left = ((n as any).positionAbsolute?.x ?? n.position.x) - minX;
      const top = ((n as any).positionAbsolute?.y ?? n.position.y) - minY;
      return `<div class="node" style="left:${left}px;top:${top}px;width:${width}px;min-height:${height}px">${label}</div>`;
    }).join("");

    // Build SVG lines for edges
    const nodeMap = new Map(currentNodes.map(n => [n.id, n]));
    const edgesHtml = edges.map(e => {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (!src || !tgt) return '';

      const sWidth = src.measured?.width || (src.style?.width as number) || 150;
      const sHeight = src.measured?.height || (src.style?.minHeight as number) || 40;
      const tWidth = tgt.measured?.width || (tgt.style?.width as number) || 150;
      const tHeight = tgt.measured?.height || (tgt.style?.minHeight as number) || 40;

      const sx = (((src as any).positionAbsolute?.x ?? src.position.x) - minX) + sWidth / 2;
      const sy = (((src as any).positionAbsolute?.y ?? src.position.y) - minY) + sHeight / 2;
      const tx = (((tgt as any).positionAbsolute?.x ?? tgt.position.x) - minX) + tWidth / 2;
      const ty = (((tgt as any).positionAbsolute?.y ?? tgt.position.y) - minY) + tHeight / 2;

      return `<line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="#a88a5e" stroke-width="1.5" opacity="0.5"/>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>GraspAI — Mind Map</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#f5f0e8;color:#3d2e1f;overflow:auto}
.header{text-align:center;padding:24px;border-bottom:1px solid #e0d5c5}
.header h1{font-size:24px;color:#5c3d2e}
.header p{color:#8b7355;font-size:13px;margin-top:4px}
.canvas{position:relative;width:${w}px;height:${h}px;margin:40px auto}
.canvas svg{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none}
.node{position:absolute;background:#fff;border:2px solid #c4a86e;border-radius:8px;padding:8px;
font-size:11px;text-align:center;word-break:break-word;
display:flex;align-items:center;justify-content:center;
box-shadow:0 2px 6px rgba(0,0,0,.08);font-weight:500}
.footer{text-align:center;padding:24px;color:#b8a080;font-size:12px}
@media print{body{background:#fff}.node{box-shadow:none}}
</style></head><body>
<div class="header"><h1>☕ GraspAI — Mind Map</h1><p>${nodes.length} nodes</p></div>
<div class="canvas">
<svg viewBox="0 0 ${w} ${h}">${edgesHtml}</svg>
${nodesHtml}
</div>
<div class="footer">Generated by GraspAI — Study, brewed.</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mindmap.html";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Mind map downloaded!");
  };

  const generateMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !file) return toast.error("Please enter a syllabus or text to convert.");

    setLoading(true);
    setNodes([]);
    setEdges([]);

    try {
      const fd = new FormData();
      fd.append("text", text);
      if (file) fd.append("file", file);

      const res = await api<{ mindmap: { nodes: Node[], edges: Edge[] } }>("/api/tutor/mindmap", {
        method: "POST",
        body: fd,
        isForm: true
      });

      const newNodes = autoSizeNodes(res.mindmap.nodes || []);
      const newEdges = res.mindmap.edges || [];
      setNodes(newNodes);
      setEdges(newEdges);
      onSave({ text, nodes: newNodes, edges: newEdges });

      toast.success("Mind map generated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate mind map");
    } finally {
      setLoading(false);
      refresh().catch(console.error);
    }
  };

  const resetMap = () => {
    setText("");
    setFile(null);
    setNodes([]);
    setEdges([]);
    onSave({ text: "", nodes: [], edges: [] });
  };

  return (
    <Card className="flex flex-col flex-1 min-h-0 overflow-hidden border-border bg-card mt-0">
      <CardContent className="flex flex-col flex-1 p-4 sm:p-6 overflow-hidden relative space-y-4">

        {nodes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-60 min-h-0">
            <Network className="h-12 w-12 mb-4" />
            <p className="text-sm font-medium">Visual Learner? Generate a Mind Map!</p>
            <p className="text-xs mt-1">Paste your syllabus or lecture notes below to see a visual tree.</p>
          </div>
        ) : (
          <div ref={containerRef} className={`flex-1 overflow-hidden bg-muted/10 relative transition-all ${isFullscreen ? 'bg-background' : 'rounded-md border border-border'}`}>
            <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
              <Background />
            </ReactFlow>
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <Button
                variant="outline"
                size="icon"
                className="bg-background/80 backdrop-blur-sm"
                onClick={resetMap}
                title="Reset Map"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="bg-background/80 backdrop-blur-sm"
                onClick={downloadAsHtml}
                title="Download as HTML"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="bg-background/80 backdrop-blur-sm"
                onClick={toggleFullscreen}
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="shrink-0 pt-2 border-t border-border flex flex-col gap-2">
          <form onSubmit={generateMap} className="flex flex-col gap-2">
            {file && (
              <div className="flex items-center gap-1 bg-muted/50 border border-border rounded-md px-2 py-1.5 w-fit text-[10px] sm:text-xs">
                <span className="truncate max-w-[200px] text-muted-foreground">{file.name}</span>
                <button onClick={() => setFile(null)} type="button" className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="shrink-0 flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-md border border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition">
                <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
                <input type="file" accept=".pdf,.txt,.doc,.docx" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              <Input
                placeholder={file ? "Add specific instructions (optional)..." : "Paste syllabus or notes here..."}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={loading}
                className="flex-1 h-10 sm:h-12"
              />

              <Button type="submit" className="h-10 sm:h-12" disabled={loading || (!text.trim() && !file)}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Generate
              </Button>
            </div>
          </form>
          <div className="text-[10px] sm:text-xs text-muted-foreground">
            Each generation costs 1 credit.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

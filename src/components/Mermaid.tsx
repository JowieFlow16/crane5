import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Renders a Mermaid "diagram-as-code" block into a real SVG diagram.
 *
 * The AI tutor emits flowcharts, mind-maps, cycles (e.g. the water cycle,
 * digestion, an electric circuit, a food web) inside ```mermaid fences. We
 * render them client-side only (mermaid touches the DOM and cannot run during
 * SSR), and re-render when the chart text or the light/dark theme changes.
 */
export function Mermaid({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string>("");
  const [failed, setFailed] = useState(false);
  const rawId = useId();
  const id = "mmd-" + rawId.replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    let active = true;
    setFailed(false);
    setSvg("");

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const dark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: dark ? "dark" : "default",
          fontFamily: "inherit",
          themeVariables: {
            primaryColor: dark ? "#0f3b39" : "#d7efe9",
            primaryBorderColor: "#13a89a",
            lineColor: "#13a89a",
          },
        });
        const { svg: out } = await mermaid.render(id, chart.trim());
        if (active) setSvg(out);
      } catch {
        if (active) setFailed(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [chart, id]);

  if (failed) {
    // Graceful fallback: show the source so the answer is never blank.
    return (
      <pre className="my-3 overflow-x-auto rounded-xl border border-border bg-muted p-3 text-xs">
        <code>{chart.trim()}</code>
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="my-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 p-6 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Drawing diagram…
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram my-3 flex justify-center overflow-x-auto rounded-xl border border-border bg-card p-3"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

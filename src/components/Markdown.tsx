import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Play, ExternalLink } from "lucide-react";
import { Mermaid } from "@/components/Mermaid";
import { cn } from "@/lib/utils";

/**
 * Rich markdown renderer for AI output.
 *
 * Beyond plain text it now renders the "visual answer" toolkit the tutor uses:
 *  - Math & science notation via KaTeX ($inline$ and $$block$$).
 *  - GitHub-flavoured tables (comparisons, data, RACE scoring grids).
 *  - Mermaid "diagrams-as-code" (```mermaid fences) → real SVG diagrams.
 *  - YouTube links → embedded video cards with a thumbnail.
 *  - Every other link normalised to a safe external resource link.
 */
function normalizeHref(href?: string): string | undefined {
  if (!href) return href;
  const trimmed = href.trim();
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("#")) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

/** Extract a YouTube video id from any common URL shape. */
function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m ? m[1] : null;
}

function VideoCard({ id, label }: { id: string; label: string }) {
  return (
    <a
      href={`https://www.youtube.com/watch?v=${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group my-3 flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card no-underline shadow-card transition-shadow hover:shadow-elegant"
    >
      <span className="relative block aspect-video w-32 shrink-0 sm:w-40">
        <img
          src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/10">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
            <Play className="h-4 w-4 translate-x-[1px] fill-current" />
          </span>
        </span>
      </span>
      <span className="min-w-0 flex-1 py-2 pr-3">
        <span className="flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-primary">
          <Play className="h-3 w-3" /> Watch &amp; learn
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm font-medium text-foreground">
          {label}
        </span>
      </span>
    </a>
  );
}

const components: Components = {
  a: ({ href, children, ...props }) => {
    const safe = normalizeHref(href);
    if (safe) {
      const yt = youtubeId(safe);
      if (yt) {
        const label = typeof children === "string" && children.trim() ? children : "Video lesson";
        return <VideoCard id={yt} label={label} />;
      }
    }
    const isExternal = !!safe && /^https?:/i.test(safe);
    return (
      <a
        {...props}
        href={safe}
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:opacity-80"
      >
        {children}
        {isExternal && <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />}
      </a>
    );
  },
  // Unwrap <pre> so our code renderer owns the block container.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const match = /language-(\w+)/.exec(className ?? "");
    const lang = match?.[1];
    const text = String(children ?? "");

    if (lang === "mermaid") {
      return <Mermaid chart={text} />;
    }
    if (lang) {
      return (
        <pre className="my-3 overflow-x-auto rounded-xl border border-border bg-muted p-3 text-xs leading-relaxed">
          <code className={className}>{children}</code>
        </pre>
      );
    }
    return <code className="rounded bg-muted px-1.5 py-0.5 text-[0.8em]">{children}</code>;
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-2 font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/60 px-3 py-2 align-top">{children}</td>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-primary/60 bg-primary/5 py-1 pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  img: ({ src, alt }) => {
    const url = typeof src === "string" ? src : undefined;
    if (!url) return null;
    return (
      <figure className="my-3 overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <img
          src={url}
          alt={alt ?? ""}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="mx-auto block max-h-96 w-auto"
          onError={(e) => {
            // Hide broken AI-suggested images instead of showing a torn-image icon.
            const fig = (e.currentTarget.closest("figure") as HTMLElement) ?? null;
            if (fig) fig.style.display = "none";
          }}
        />
        {alt && (
          <figcaption className="px-3 py-2 text-center text-xs text-muted-foreground">
            {alt}
          </figcaption>
        )}
      </figure>
    );
  },
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  // Normalise notation first so formulas, operators and units always render as
  // real symbols (× ÷ → ≤ ° ± H₂O, KaTeX math) regardless of how the model
  // wrote them.
  const normalized = useMemo(() => normalizeNotation(children), [children]);
  return (
    <div className={cn("prose-chat space-y-2", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}


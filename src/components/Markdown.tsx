import ReactMarkdown, { type Components } from "react-markdown";
import { cn } from "@/lib/utils";

/**
 * Safe markdown renderer for AI output.
 *
 * The AI frequently embeds reference links (e.g. NCDC pages, Khan Academy,
 * YouTube videos). If a link is written without a protocol (e.g.
 * "khanacademy.org/...") react-markdown treats it as a RELATIVE path, so a
 * click navigates inside the SPA and TanStack Router shows its 404 ("Page not
 * found"). That was the revision-page bug. We normalise every link to an
 * absolute URL and force it to open safely in a new tab.
 */
function normalizeHref(href?: string): string | undefined {
  if (!href) return href;
  const trimmed = href.trim();
  // Already absolute / safe schemes.
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  // In-page anchors are fine.
  if (trimmed.startsWith("#")) return trimmed;
  // Anything that looks like a bare domain or path → treat as external https.
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

const components: Components = {
  a: ({ href, children, ...props }) => {
    const safe = normalizeHref(href);
    const isExternal = !!safe && /^https?:/i.test(safe);
    return (
      <a
        {...props}
        href={safe}
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
      >
        {children}
      </a>
    );
  },
};

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("prose-chat space-y-2", className)}>
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  );
}

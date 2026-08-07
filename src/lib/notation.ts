// ---------------------------------------------------------------------------
// Notation normaliser
//
// AI models are inconsistent about notation: sometimes `3 * 4`, sometimes
// `\(x^2\)`, sometimes `->`, `<=`, `deg C`, `H2O`, `sqrt(2)`.
// Every answer Crane5 renders (chat, quiz, revision, flashcards, teacher
// tools, community posts) passes through <Markdown>, so normalising here fixes
// symbols and alignment across the WHOLE app — physics, chemistry, maths,
// economics, geography and everything else.
//
// Rules:
//  - Code fences and inline code are never touched.
//  - LaTeX delimiters are unified to $ / $$ so KaTeX picks them up.
//  - Inside math, ASCII operators become real LaTeX operators.
//  - Outside math, ASCII operators become real Unicode symbols (×, ÷, →, ≤,
//    °C, ±, ⇌, subscripts for formulas like H₂O and CO₂).
// ---------------------------------------------------------------------------

const SUB_DIGITS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
const SUP_MAP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
};

/** Unify LaTeX delimiters so KaTeX (remark-math) recognises them. */
function unifyMathDelimiters(text: string): string {
  return text
    .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_m, inner: string) => `$$${inner}$$`)
    .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_m, inner: string) => `$${inner}$`)
    // Some models emit \begin{equation}…\end{equation} without $$ wrappers.
    .replace(
      /\\begin\{(equation|align)\*?\}([\s\S]*?)\\end\{\1\*?\}/g,
      (_m, _env, inner: string) => `$$${inner.trim()}$$`,
    );
}

/** Fixes applied INSIDE math ($…$ / $$…$$) segments. */
function fixMath(math: string): string {
  return (
    math
      // 3 * 4 → 3 \times 4 (never touch \times, **bold**, or LaTeX commands)
      .replace(/(\d|\}|\)|[a-zA-Z])\s*\*\s*(?=\d|\\|\(|[a-zA-Z])/g, "$1 \\times ")
      .replace(/(?<![<\-=])->(?!>)/g, " \\to ")
      .replace(/<->|<=>/g, " \\rightleftharpoons ")
      .replace(/(?<![<>=!])<=(?!=)/g, " \\le ")
      .replace(/(?<![<>=!])>=(?!=)/g, " \\ge ")
      .replace(/!=/g, " \\neq ")
      .replace(/\+\/-|\+-/g, " \\pm ")
      .replace(/\bsqrt\s*\(([^()]*)\)/g, "\\sqrt{$1}")
      .replace(/(?<!\\)\bdeg(?:rees)?\s*C\b/gi, "^\\circ\\text{C}")
      .replace(/(?<!\\)\bpi\b/g, "\\pi")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/** Subscript chemical formulas: H2O → H₂O, CO2 → CO₂, Ca(OH)2 → Ca(OH)₂. */
function subscriptChemistry(text: string): string {
  return text.replace(
    /\b(\d*)((?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\))+)\b/g,
    (_full: string, coefficient: string, match: string): string => {
      const keep = (value: string) => `${coefficient}${value}`;
      // Only touch things that look like a formula: has a digit and >1 element
      // or a bracket group, and is not an ordinary word or a unit.
      if (!/\d/.test(match)) return keep(match);
      if (/^[A-Z][a-z]?\d+$/.test(match) && !/^(H|O|N|C|S|P|Cl|Br|I|F)\d+$/.test(match)) {
        return keep(match);
      }
      return keep(match.replace(/\d/g, (d) => SUB_DIGITS[Number(d)]));
    },
  );
}

/** Fixes applied OUTSIDE math: real Unicode symbols in prose. */
function fixProse(text: string): string {
  let out = text;

  // Multiplication: only between numeric/variable operands, never markdown bold
  // or a bullet, so "2 * 3" → "2 × 3" but "**bold**" and "* item" survive.
  out = out.replace(/(?<=\d)\s*\*\s*(?=\d)/g, " × ");
  out = out.replace(/(?<=\d)\s*x\s*(?=\d)/g, " × ");
  // Single-letter variables: F = m*a → F = m × a
  out = out.replace(/(?<=\b[A-Za-z])\s*\*\s*(?=[A-Za-z]\b)/g, " × ");
  out = out.replace(/\bsqrt\s*\(([^()]*)\)/g, "√($1)").replace(/√\((\d+(?:\.\d+)?)\)/g, "√$1");
  out = out.replace(/(?<=\d)\s*\*\s*10\^(-?\d+)/g, (_m, e: string) => ` × 10${toSup(e)}`);

  // Division and comparison
  out = out.replace(/(?<=\d)\s*\/\s*(?=\d)/g, "/");
  out = out.replace(/(?<![<>=!/-])<=(?!=)/g, "≤");
  out = out.replace(/(?<![<>=!/-])>=(?!=)/g, "≥");
  out = out.replace(/(?<![!<>=])!=/g, "≠");
  out = out.replace(/\+\/-/g, "±");
  out = out.replace(/(?<=\s)~=(?=\s)/g, "≈");

  // Arrows: reactions, processes, cause → effect (leave mermaid "-->" alone;
  // mermaid lives in code fences which are already protected).
  out = out.replace(/<->|<=>/g, "⇌");
  out = out.replace(/(?<![-<=!])-{1,2}>(?!>)/g, "→");
  out = out.replace(/=>/g, "⇒");

  // Units & symbols
  out = out.replace(/\b(\d+(?:\.\d+)?)\s*deg(?:rees)?\s*([CFK])\b/gi, "$1 °$2");
  out = out.replace(/\b(\d+(?:\.\d+)?)\s*degrees?\b/gi, "$1°");
  out = out.replace(/(?<=\d\s?)o(?=[CF]\b)/g, "°");
  out = out.replace(/\bmicro([a-zA-Z])/g, "µ$1");
  out = out.replace(/\bohms?\b/g, (m) => (m[0] === "O" ? "Ω" : "Ω"));
  out = out.replace(/\bUGX\s?(\d)/g, "UGX $1");

  // Superscript powers in prose: m^2 → m², 10^-3 → 10⁻³
  out = out.replace(/([A-Za-z0-9)\]])\^(-?\d+)(?![\d^])/g, (m, base: string, exp: string) => {
    const sup = toSup(exp);
    return sup ? `${base}${sup}` : m;
  });

  out = subscriptChemistry(out);

  return out;
}

function toSup(exp: string): string {
  let out = "";
  for (const ch of exp) {
    const mapped = SUP_MAP[ch];
    if (!mapped) return "";
    out += mapped;
  }
  return out;
}

/**
 * Normalise notation in an AI-generated markdown string.
 * Protects fenced code, inline code and image/link URLs.
 */
export function normalizeNotation(input: string): string {
  if (!input) return input;

  const protectedBlocks: string[] = [];
  const stash = (value: string) => {
    protectedBlocks.push(value);
    return `\u0000${protectedBlocks.length - 1}\u0000`;
  };

  let text = input;

  // 1. Protect fenced code (incl. mermaid), inline code and URLs.
  text = text.replace(/```[\s\S]*?```/g, (m) => stash(m));
  text = text.replace(/`[^`\n]*`/g, (m) => stash(m));
  text = text.replace(/!?\[[^\]]*\]\([^)]*\)/g, (m) => stash(m));
  text = text.replace(/\bhttps?:\/\/\S+/g, (m) => stash(m));

  // 2. Unify LaTeX delimiters, then treat math separately from prose.
  text = unifyMathDelimiters(text);

  const mathPattern = /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g;
  const segments: string[] = [];
  let cursor = 0;
  for (let m = mathPattern.exec(text); m; m = mathPattern.exec(text)) {
    segments.push(fixProse(text.slice(cursor, m.index)));
    const raw = m[0];
    if (raw.startsWith("$$")) {
      segments.push(`$$${fixMath(raw.slice(2, -2))}$$`);
    } else {
      segments.push(`$${fixMath(raw.slice(1, -1))}$`);
    }
    cursor = m.index + raw.length;
  }
  segments.push(fixProse(text.slice(cursor)));
  text = segments.join("");

  // 3. Restore protected blocks.
  text = text.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => protectedBlocks[Number(i)] ?? "");

  // 4. Tidy alignment: no trailing spaces, max one blank line, tables spaced.
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return text;
}

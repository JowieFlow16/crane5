// Server-only: turn a video link into learnable text (captions/transcript).

export interface VideoLesson {
  title: string;
  text: string;
  platform: string;
  videoId: string | null;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

/** Recognise the common video hosts and pull out an id where we can. */
export function parseVideoUrl(url: string): { platform: string; videoId: string | null } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") return { platform: "youtube", videoId: u.pathname.slice(1) || null };
  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const v = u.searchParams.get("v");
    const m = u.pathname.match(/\/(?:embed|shorts|live|v)\/([^/?#]+)/);
    return { platform: "youtube", videoId: v ?? m?.[1] ?? null };
  }
  if (host.endsWith("vimeo.com")) {
    const m = u.pathname.match(/(\d{6,})/);
    return { platform: "vimeo", videoId: m?.[1] ?? null };
  }
  if (host.endsWith("khanacademy.org")) return { platform: "khan academy", videoId: null };
  if (/\.(mp4|webm|mov|m4v)$/i.test(u.pathname)) return { platform: "video file", videoId: null };
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;#39;/g, "'")
    .replace(/&amp;quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function tidy(text: string): string {
  return decodeEntities(text)
    .replace(/\[[A-Za-z ]{2,20}\]/g, " ") // [Music], [Applause]
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function get(url: string, accept = "text/html,*/*"): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "en" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string };
}

function extractCaptionTracks(watchHtml: string): CaptionTrack[] {
  const idx = watchHtml.indexOf('"captionTracks":');
  if (idx === -1) return [];
  const start = watchHtml.indexOf("[", idx);
  if (start === -1) return [];
  let depth = 0;
  for (let i = start; i < watchHtml.length; i++) {
    const c = watchHtml[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(watchHtml.slice(start, i + 1)) as CaptionTrack[];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

function pickTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  return (
    tracks.find((t) => t.languageCode?.startsWith("en") && t.kind !== "asr") ??
    tracks.find((t) => t.languageCode?.startsWith("en")) ??
    tracks[0]
  );
}

function captionsToText(body: string): string {
  // json3 format
  if (body.trimStart().startsWith("{")) {
    try {
      const json = JSON.parse(body) as {
        events?: { segs?: { utf8?: string }[] }[];
      };
      const parts = (json.events ?? []).flatMap((e) => (e.segs ?? []).map((s) => s.utf8 ?? ""));
      return tidy(parts.join(""));
    } catch {
      return "";
    }
  }
  // timedtext XML
  const lines = [...body.matchAll(/<(?:text|p)[^>]*>([\s\S]*?)<\/(?:text|p)>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, " "),
  );
  return tidy(lines.join(" "));
}

async function youtubeMeta(videoId: string) {
  const raw = await get(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    "application/json",
  );
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { title?: string; author_name?: string };
  } catch {
    return null;
  }
}

/** YouTube's own player API — reliable for title/description and often captions. */
async function youtubePlayer(videoId: string) {
  try {
    const res = await fetch(
      "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UA },
        body: JSON.stringify({
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
          context: { client: { clientName: "WEB", clientVersion: "2.20240401.00.00", hl: "en" } },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as {
      videoDetails?: { title?: string; author?: string; shortDescription?: string };
      captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
    };
  } catch {
    return null;
  }
}

async function trackToText(track: CaptionTrack | undefined): Promise<string> {
  if (!track?.baseUrl) return "";
  const url = decodeEntities(track.baseUrl);
  const body = (await get(`${url}&fmt=json3`, "application/json")) ?? (await get(url, "text/xml"));
  return body ? captionsToText(body) : "";
}

async function youtubeLesson(videoId: string): Promise<VideoLesson> {
  const meta = await youtubeMeta(videoId);
  const player = await youtubePlayer(videoId);
  const watch = await get(`https://www.youtube.com/watch?v=${videoId}&hl=en`);

  let transcript = "";
  if (watch) transcript = await trackToText(pickTrack(extractCaptionTracks(watch)));
  if (!transcript) {
    const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    transcript = await trackToText(pickTrack(tracks));
  }

  let description = tidy(player?.videoDetails?.shortDescription ?? "");
  if (!description && watch) {
    const m = watch.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
    if (m) {
      try {
        description = tidy(JSON.parse(`"${m[1]}"`) as string);
      } catch {
        description = "";
      }
    }
  }

  const title = meta?.title ?? player?.videoDetails?.title ?? `YouTube video ${videoId}`;
  const header = [
    `Video: ${title}`,
    meta?.author_name ?? player?.videoDetails?.author
      ? `Channel: ${meta?.author_name ?? player?.videoDetails?.author}`
      : null,
    `Source: https://www.youtube.com/watch?v=${videoId}`,
  ]
    .filter(Boolean)
    .join("\n");


  const body = transcript
    ? `Transcript:\n${transcript}`
    : description
      ? `Description:\n${description}`
      : "";

  if (!body) {
    throw new Error(
      "That video has no captions or description Omicron can read. Try a video with subtitles turned on.",
    );
  }

  return {
    title,
    text: `${header}\n\n${description && transcript ? `Description:\n${description}\n\n` : ""}${body}`.slice(
      0,
      60_000,
    ),
    platform: "youtube",
    videoId,
  };
}

async function genericVideoLesson(url: string, platform: string): Promise<VideoLesson> {
  const raw = await get(
    `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
    "application/json",
  );
  let title = url;
  let description = "";
  if (raw) {
    try {
      const j = JSON.parse(raw) as { title?: string; description?: string };
      title = j.title ?? url;
      description = tidy(j.description ?? "");
    } catch {
      /* ignore */
    }
  }
  if (!description) {
    const html = await get(url);
    const t = html?.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (t) title = tidy(t[1]).slice(0, 200);
    const d = html?.match(
      /<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]+content=["']([^"']+)["']/i,
    );
    if (d) description = tidy(d[1]);
  }
  if (description.length < 80) {
    throw new Error("Couldn't read enough text from that video link.");
  }
  return {
    title: title.slice(0, 200),
    text: `Video: ${title}\nSource: ${url}\n\nDescription:\n${description}`.slice(0, 60_000),
    platform,
    videoId: null,
  };
}

/** Read a video link into plain text Omicron can learn from. */
export async function fetchVideoLesson(url: string): Promise<VideoLesson> {
  const parsed = parseVideoUrl(url);
  if (!parsed) throw new Error("That doesn't look like a supported video link.");
  if (parsed.platform === "youtube") {
    if (!parsed.videoId) throw new Error("Couldn't find the video id in that YouTube link.");
    return youtubeLesson(parsed.videoId);
  }
  return genericVideoLesson(url, parsed.platform);
}

const ALLOWED_HOSTS = [
  "youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com",
  "tiktok.com", "instagram.com", "facebook.com", "fb.watch",
  "x.com", "twitter.com", "threads.net", "pinterest.com", "pin.it"
];
function hostAllowed(host) {
  const h = String(host || "").toLowerCase().replace(/^www\./, "");
  return ALLOWED_HOSTS.some(domain => h === domain || h.endsWith("." + domain));
}
function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
function cleanText(value) {
  return decodeEntities(String(value || "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\\u003[cC]/g, "<").replace(/\\n/g, "\n").replace(/[ \t]+/g, " ").trim()).slice(0, 12000);
}
function meta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp('<meta[^>]+(?:property|name)=[\\\"\\\']' + escaped + '[\\\"\\\'][^>]+content=[\\\"\\\']([\\s\\S]*?)[\\\"\\\'][^>]*>', "i"),
    new RegExp('<meta[^>]+content=[\\\"\\\']([\\s\\S]*?)[\\\"\\\'][^>]+(?:property|name)=[\\\"\\\']' + escaped + '[\\\"\\\'][^>]*>', "i")
  ];
  for (const p of patterns) { const m = html.match(p); if (m) return cleanText(m[1]); }
  return "";
}
function balancedObject(source, marker) {
  const at = source.indexOf(marker);
  if (at < 0) return null;
  const start = source.indexOf("{", at + marker.length);
  if (start < 0) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === '"') inString = false; continue; }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) { try { return JSON.parse(source.slice(start, i + 1)); } catch { return null; } }
  }
  return null;
}
function unique(values, max = 60) {
  return [...new Set(values.map(x => cleanText(x).trim()).filter(Boolean))].slice(0, max);
}
function parsePage(html, url) {
  let title = meta(html, "og:title") || meta(html, "twitter:title") || "";
  let description = meta(html, "og:description") || meta(html, "description") || meta(html, "twitter:description") || "";
  let tags = [];
  const keywordMeta = meta(html, "keywords");
  if (keywordMeta) tags = keywordMeta.split(/[,;|]/).map(x => x.trim());
  const host = new URL(url).hostname.toLowerCase();
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be" || host === "m.youtube.com") {
    const player = balancedObject(html, "ytInitialPlayerResponse");
    const details = player && player.videoDetails;
    if (details) {
      title = details.title || title;
      description = details.shortDescription || description;
      if (Array.isArray(details.keywords)) tags = details.keywords;
    }
    if (!title) {
      const initial = balancedObject(html, "ytInitialData");
      const video = initial && JSON.stringify(initial);
      if (video) { const m = video.match(/"title":\{"runs":\[\{"text":"((?:\\\\.|[^"\\\\])*)"/); if (m) { try { title = JSON.parse('"' + m[1] + '"'); } catch {} } }
    }
  }
  if (!title) title = meta(html, "title") || "";
  if (!description) {
    const ld = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    if (ld) { try { const data = JSON.parse(ld[1]); const item = Array.isArray(data) ? data.find(x => x.description) : data; description = cleanText(item && item.description || ""); title = title || cleanText(item && item.name || ""); } catch {} }
  }
  const hashtags = unique((description + " " + title).match(/#[\p{L}\p{N}_]+/gu) || [], 100);
  tags = unique(tags.filter(x => !String(x).startsWith("#") && String(x).length < 160), 80);
  return { title: cleanText(title).slice(0, 500), description: cleanText(description), tags, hashtags };
}
module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Gunakan POST /inspect-video." });
  const body = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {});
  let url;
  try { url = new URL(String(body.url || "")); } catch { return res.status(400).json({ error: "URL video tidak valid." }); }
  if (url.protocol !== "https:" || !hostAllowed(url.hostname)) return res.status(400).json({ error: "Hanya URL HTTPS dari platform video yang didukung yang diperbolehkan." });
  if (url.username || url.password || url.href.length > 1000) return res.status(400).json({ error: "URL tidak valid." });
  try {
    const response = await fetch(url.href, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TagnivraMetadata/1.0)", "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error("Platform merespons HTTP " + response.status);
    const finalUrl = new URL(response.url);
    if (!hostAllowed(finalUrl.hostname)) throw new Error("Tautan dialihkan ke domain yang tidak didukung.");
    const html = (await response.text()).slice(0, 5_000_000);
    const result = parsePage(html, url.href);
    if (!result.title && !result.description && !result.tags.length && !result.hashtags.length) {
      if (/youtube\.com|youtu\.be/.test(url.hostname)) {
        try {
          const oembed = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(url.href), { signal: AbortSignal.timeout(8000) });
          if (oembed.ok) { const data = await oembed.json(); result.title = cleanText(data.title || ""); }
        } catch {}
      }
    }
    return res.status(200).json({
      ok: true, ...result,
      note: result.tags.length
        ? "Metadata publik berhasil dibaca. Tag yang ditampilkan hanya tag yang bisa ditemukan di halaman publik."
        : "Metadata publik berhasil diperiksa, tetapi platform mungkin menyembunyikan tag. Hashtag yang terlihat diekstrak dari judul/deskripsi; tag yang tidak dipublikasikan tidak dapat dipastikan."
    });
  } catch (error) {
    return res.status(502).json({ error: "Platform tidak mengizinkan metadata dibaca otomatis saat ini. Coba URL publik lain atau periksa lagi nanti." });
  }
};

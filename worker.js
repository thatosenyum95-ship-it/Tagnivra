const ORIGIN = "https://thatosenyum95-ship-it.github.io";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
};

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin !== ORIGIN) return new Response("Forbidden", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply({ error: "Gunakan POST." }, 405);

    let body;
    try { body = await request.json(); }
    catch { return reply({ error: "Format permintaan tidak valid." }, 400); }

    const topic = String(body.topic || "").trim().slice(0, 180);
    const platform = ["YouTube", "TikTok", "Facebook"].includes(body.platform) ? body.platform : "YouTube";
    const language = ["id", "en", "mix"].includes(body.language) ? body.language : "id";
    const style = String(body.style || "Umum").slice(0, 40);
    if (topic.length < 2) return reply({ error: "Masukkan topik yang lebih jelas." }, 400);

    const languageName = language === "en" ? "English" : language === "mix" ? "Indonesian and English" : "Bahasa Indonesia";
    const prompt = "You are Tagnivra, a practical social media SEO assistant. Create relevant keywords and hashtags. Return ONLY valid JSON with exactly this shape: {\\"hashtags\\":[\\"#tag1\\"],\\"keywords\\":[\\"keyword phrase\\"],\\"summary\\":\\"short explanation\\"}. Topic/title: " + topic + ". Platform: " + platform + ". Content style: " + style + ". Output language: " + languageName + ". Generate 8 distinct relevant hashtags and 12 distinct keywords/tags. Be specific, concise, natural, and avoid keyword stuffing. Hashtags must start with # and contain no spaces. Never promise virality. Do not claim real-time trends or invent trend data.";

    try {
      const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        prompt,
        max_tokens: 700,
        temperature: 0.65
      });
      let output = typeof result === "string" ? result : (result.response || result.output_text || "");
      output = output.replace(/^\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60$/, "").trim();
      const start = output.indexOf("{");
      const end = output.lastIndexOf("}");
      if (start < 0 || end <= start) throw new Error("Invalid model response");
      const parsed = JSON.parse(output.slice(start, end + 1));
      const hashtags = Array.isArray(parsed.hashtags)
        ? parsed.hashtags.map(x => String(x).trim()).filter(x => /^#[\p{L}\p{N}_]+$/u.test(x)).slice(0, 8) : [];
      const keywords = Array.isArray(parsed.keywords)
        ? parsed.keywords.map(x => String(x).trim()).filter(x => x.length > 0 && x.length < 100).slice(0, 12) : [];
      if (hashtags.length < 3 || keywords.length < 4) throw new Error("Incomplete model response");
      return reply({
        hashtags,
        keywords,
        summary: String(parsed.summary || "Dibuat oleh AI. Bukan data tren real-time."),
        source: "ai"
      });
    } catch (error) {
      return reply({ error: "AI sedang tidak bisa merespons. Coba lagi sebentar." }, 502);
    }
  }
};

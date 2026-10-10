const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return reply({ error: "Gunakan metode POST." }, 405);
    }

    if (!env.AI) {
      return reply({ error: "Binding Workers AI bernama AI belum terpasang." }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return reply({ error: "Format permintaan tidak valid." }, 400);
    }

    const topic = String(body.topic || "").trim().slice(0, 180);
    const platform = ["YouTube", "TikTok", "Facebook"].includes(body.platform)
      ? body.platform
      : "YouTube";
    const languageCode = ["id", "en", "mix"].includes(body.language)
      ? body.language
      : "id";
    const language = languageCode === "en"
      ? "English"
      : languageCode === "mix"
        ? "Indonesian and English"
        : "Bahasa Indonesia";
    const style = String(body.style || "Umum").trim().slice(0, 40);

    if (topic.length < 2) {
      return reply({ error: "Masukkan topik yang lebih jelas." }, 400);
    }

    const prompt = `You are Tagnivra, a practical social media SEO assistant.
Return ONLY valid JSON in this exact shape:
{"hashtags":["#tag1"],"keywords":["keyword phrase"],"summary":"short explanation"}

Topic/title: ${topic}
Platform: ${platform}
Content style: ${style}
Output language: ${language}

Generate 8 distinct relevant hashtags and 12 distinct keywords/tags.
Hashtags must start with # and contain no spaces.
Be specific, natural, and avoid keyword stuffing.
Never promise virality or claim real-time trend data.`;

    try {
      const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        prompt,
        max_tokens: 700,
        temperature: 0.65
      });

      let output = typeof result === "string"
        ? result
        : String(result?.response || result?.output_text || "");

      output = output
        .replace(/\x60\x60\x60(?:json)?\s*/gi, "")
        .replace(/\s*\x60\x60\x60/g, "")
        .trim();

      const start = output.indexOf("{");
      const end = output.lastIndexOf("}");
      if (start < 0 || end <= start) {
        throw new Error("Format jawaban AI tidak valid.");
      }

      const parsed = JSON.parse(output.slice(start, end + 1));
      const hashtags = Array.isArray(parsed.hashtags)
        ? parsed.hashtags
            .map(value => String(value).trim())
            .filter(value => /^#[\p{L}\p{N}_]+$/u.test(value))
            .slice(0, 8)
        : [];
      const keywords = Array.isArray(parsed.keywords)
        ? parsed.keywords
            .map(value => String(value).trim())
            .filter(value => value.length > 0 && value.length < 100)
            .slice(0, 12)
        : [];

      if (hashtags.length < 3 || keywords.length < 4) {
        throw new Error("Hasil AI belum lengkap.");
      }

      return reply({
        success: true,
        platform,
        language: languageCode,
        hashtags,
        keywords,
        summary: String(parsed.summary || "Dibuat oleh AI. Bukan data tren real-time."),
        source: "ai"
      });
    } catch (error) {
      return reply({
        error: "Pemanggilan AI gagal.",
        details: String(error?.message || error)
      }, 502);
    }
  }
};
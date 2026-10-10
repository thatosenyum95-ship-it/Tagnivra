export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = "https://thatosenyum95-ship-it.github.io";
    const cors = {
      "Access-Control-Allow-Origin": origin === allowedOrigin ? origin : allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json({
        ok: true,
        service: "Tagnivra Engine",
        geminiConfigured: Boolean(env.GEMINI_API_KEY),
        openaiConfigured: Boolean(env.OPENAI_API_KEY),
        selfHostedConfigured: Boolean(env.SELF_HOSTED_AI_URL),
        version: "1.2.0"
      });
    }
    if (request.method !== "POST" || !["/generate", "/"].includes(url.pathname)) {
      return json({ error: "Gunakan POST /generate untuk membuat tag." }, 405);
    }

    let input;
    try { input = await request.json(); }
    catch { return json({ error: "Body harus berupa JSON yang valid." }, 400); }

    const topic = String(input.topic || "").trim().slice(0, 180);
    const platform = ["YouTube", "TikTok", "Facebook"].includes(input.platform) ? input.platform : "YouTube";
    const language = ["id", "en", "mix"].includes(input.language) ? input.language : "id";
    const style = String(input.style || "Umum").slice(0, 40);
    if (topic.length < 2) return json({ error: "Masukkan topik minimal 2 karakter." }, 400);

    const prompt = [
      "You are Tagnivra Engine, a focused keyword and hashtag generator for social media.",
      "Generate relevant tags from the topic and context only. Never claim trends, popularity, search volume, or virality.",
      "Avoid irrelevant generic tags and duplicates. Use natural keywords and hashtags without spaces.",
      'Return ONLY valid JSON with this exact shape: {"hashtags":["#example"],"keywords":["keyword example"],"note":"short Indonesian disclaimer"}.',
      "Provide 6 to 10 hashtags and 8 to 12 keywords. Every hashtag starts with #.",
      "Platform: " + platform,
      "Output language: " + ({ id: "Indonesian", en: "English", mix: "Indonesian and English" }[language]),
      "Content type: " + style,
      "Topic/title: " + topic
    ].join("\n");

    const parseOutput = (raw) => {
      let output = String(raw || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      const start = output.indexOf("{");
      const end = output.lastIndexOf("}");
      if (start >= 0 && end > start) output = output.slice(start, end + 1);
      const parsed = JSON.parse(output);
      const normalize = (items, hashtag, max) => [...new Set((Array.isArray(items) ? items : [])
        .map(item => String(item || "").trim().replace(/[\r\n]+/g, " ").slice(0, 90))
        .filter(Boolean)
        .map(item => hashtag ? "#" + item.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "") : item)
        .filter(item => item !== "#"))].slice(0, max);
      const hashtags = normalize(parsed.hashtags, true, 10);
      const keywords = normalize(parsed.keywords, false, 12);
      if (hashtags.length < 3 || keywords.length < 3) throw new Error("AI returned too few tags");
      return {
        ok: true, platform, topic, hashtags, keywords,
        note: typeof parsed.note === "string" ? parsed.note.slice(0, 180) : "Saran berdasarkan konteks topik, bukan data tren real-time."
      };
    };

    const errors = [];

    // Gemini is the primary provider. Store GEMINI_API_KEY as a Worker secret.
    if (env.GEMINI_API_KEY) {
      try {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.35, maxOutputTokens: 900, responseMimeType: "application/json" }
          }),
          signal: AbortSignal.timeout(45000)
        });
        if (!response.ok) throw new Error("Gemini HTTP " + response.status);
        const data = await response.json();
        const raw = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("\n") || "";
        const result = parseOutput(raw);
        return json({ ...result, provider: "gemini", model: "gemini-2.5-flash" });
      } catch (error) {
        errors.push("Gemini: " + String(error?.message || error).slice(0, 120));
      }
    }

    // OpenAI is the fallback provider. Store OPENAI_API_KEY as a Worker secret.
    if (env.OPENAI_API_KEY) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + env.OPENAI_API_KEY
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "Generate accurate, topic-relevant social media keywords. Follow the requested JSON format strictly." },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            max_tokens: 900,
            temperature: 0.35
          }),
          signal: AbortSignal.timeout(45000)
        });
        if (!response.ok) throw new Error("OpenAI HTTP " + response.status);
        const data = await response.json();
        const result = parseOutput(data?.choices?.[0]?.message?.content || "");
        return json({ ...result, provider: "openai", model: "gpt-4o-mini" });
      } catch (error) {
        errors.push("OpenAI: " + String(error?.message || error).slice(0, 120));
      }
    }

    // Optional self-hosted server remains available as another fallback.
    if (env.SELF_HOSTED_AI_URL) {
      try {
        const base = String(env.SELF_HOSTED_AI_URL).replace(/\/+$/, "");
        const response = await fetch(base + "/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(env.SELF_HOSTED_AI_TOKEN ? { "Authorization": "Bearer " + env.SELF_HOSTED_AI_TOKEN } : {})
          },
          body: JSON.stringify({ topic, platform, language, style }),
          signal: AbortSignal.timeout(90000)
        });
        if (!response.ok) throw new Error("Self-hosted AI HTTP " + response.status);
        const data = await response.json();
        if (!Array.isArray(data.hashtags) || !Array.isArray(data.keywords)) throw new Error("Invalid self-hosted response");
        return json({ ...data, ok: true, provider: "self-hosted" });
      } catch (error) {
        errors.push("Self-hosted: " + String(error?.message || error).slice(0, 120));
      }
    }

    if (!env.GEMINI_API_KEY && !env.OPENAI_API_KEY && !env.SELF_HOSTED_AI_URL) {
      return json({ error: "AI belum dikonfigurasi. Tambahkan secret GEMINI_API_KEY dan/atau OPENAI_API_KEY di pengaturan Worker." }, 503);
    }
    return json({
      error: "Semua penyedia AI gagal memproses permintaan. Periksa secret, kuota, dan log Worker.",
      providers: errors
    }, 502);
  }
};

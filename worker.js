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
      return json({ ok: true, service: "Tagnivra Engine", selfHostedConfigured: Boolean(env.SELF_HOSTED_AI_URL), fallbackConfigured: Boolean(env.AI), version: "1.1.0" });
    }
    if (request.method !== "POST" || !["/generate", "/"].includes(url.pathname)) {
      return json({ error: "Gunakan POST /generate untuk membuat tag." }, 405);
    }
    let input;
    try { input = await request.json(); }
    catch { return json({ error: "Body harus berupa JSON yang valid." }, 400); }

    // Prefer the Tagnivra-owned model server when configured. The token is a
    // Worker secret and is never sent to the browser.
    if (env.SELF_HOSTED_AI_URL) {
      try {
        const base = String(env.SELF_HOSTED_AI_URL).replace(/\\/+$/, "");
        const upstream = await fetch(base + "/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(env.SELF_HOSTED_AI_TOKEN ? { "Authorization": "Bearer " + env.SELF_HOSTED_AI_TOKEN } : {})
          },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(150000)
        });
        const text = await upstream.text();
        return new Response(text, {
          status: upstream.status,
          headers: { ...cors, "Content-Type": upstream.headers.get("Content-Type") || "application/json; charset=utf-8", "Cache-Control": "no-store" }
        });
      } catch (error) {
        return json({ error: "Server AI Tagnivra belum bisa dihubungi. Periksa alamat server dan koneksinya." , detail: String(error?.message || error).slice(0, 160) }, 502);
      }
    }

    if (!env.AI || typeof env.AI.run !== "function") {
      return json({ error: "AI belum dikonfigurasi. Atur SELF_HOSTED_AI_URL untuk server AI milik Tagnivra." }, 503);
    }
    const topic = String(input.topic || "").trim().slice(0, 180);
    const platform = ["YouTube", "TikTok", "Facebook"].includes(input.platform) ? input.platform : "YouTube";
    const language = ["id", "en", "mix"].includes(input.language) ? input.language : "id";
    const style = String(input.style || "Umum").slice(0, 40);
    if (topic.length < 2) return json({ error: "Masukkan topik minimal 2 karakter." }, 400);
    const prompt = [
      "You are Tagnivra Engine, a focused keyword and hashtag generator for social media.",
      "Generate relevant tags from the topic and context only. Never claim trends, popularity, search volume, or virality.",
      "Avoid irrelevant generic tags and duplicates. Use natural keywords and hashtags without spaces.",
      "Return ONLY valid JSON with this exact shape: {\"hashtags\":[\"#example\"],\"keywords\":[\"keyword example\"],\"note\":\"short Indonesian disclaimer\"}.",
      "Provide 6 to 10 hashtags and 8 to 12 keywords. Every hashtag starts with #.",
      "Platform: " + platform,
      "Output language: " + ({ id: "Indonesian", en: "English", mix: "Indonesian and English" }[language]),
      "Content type: " + style,
      "Topic/title: " + topic
    ].join("\n");
    try {
      const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: "Generate accurate, topic-relevant social media keywords. Follow the requested JSON format strictly." },
          { role: "user", content: prompt }
        ],
        max_tokens: 650,
        temperature: 0.35
      });
      let output = typeof result?.response === "string" ? result.response : "";
      output = output.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`\s*$/i, "").trim();
      const start = output.indexOf("{");
      const end = output.lastIndexOf("}");
      if (start >= 0 && end > start) output = output.slice(start, end + 1);
      let parsed;
      try { parsed = JSON.parse(output); }
      catch { return json({ error: "Model belum menghasilkan format yang valid. Silakan coba lagi." }, 502); }
      const normalize = (items, hashtag, max) => [...new Set((Array.isArray(items) ? items : [])
        .map(item => String(item || "").trim().replace(/[\r\n]+/g, " ").slice(0, 90))
        .filter(Boolean)
        .map(item => hashtag ? "#" + item.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "") : item)
        .filter(item => item !== "#"))].slice(0, max);
      const hashtags = normalize(parsed.hashtags, true, 10);
      const keywords = normalize(parsed.keywords, false, 12);
      if (hashtags.length < 3 || keywords.length < 3) {
        return json({ error: "Hasil AI terlalu sedikit. Coba topik yang lebih jelas." }, 502);
      }
      return json({
        ok: true, platform, topic, hashtags, keywords,
        note: typeof parsed.note === "string" ? parsed.note.slice(0, 180) : "Saran berdasarkan konteks topik, bukan data tren real-time.",
        model: "@cf/meta/llama-3.1-8b-instruct"
      });
    } catch (error) {
      return json({
        error: "Mesin AI sedang gagal memproses permintaan. Coba lagi beberapa saat.",
        detail: String(error?.message || error).slice(0, 240)
      }, 502);
    }
  }
};
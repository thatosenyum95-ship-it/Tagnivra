const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store"
};

function parseOutput(raw, platform, topic) {
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
}

module.exports = async function handler(req, res) {
  Object.entries(jsonHeaders).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Gunakan POST /generate." });

  const input = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {});
  const topic = String(input.topic || "").trim().slice(0, 180);
  const platform = ["YouTube", "TikTok", "Facebook"].includes(input.platform) ? input.platform : "YouTube";
  const language = ["id", "en", "mix"].includes(input.language) ? input.language : "id";
  const style = String(input.style || "Umum").slice(0, 40);
  if (topic.length < 2) return res.status(400).json({ error: "Masukkan topik minimal 2 karakter." });

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

  const errors = [];
  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 900, responseMimeType: "application/json" }
        }),
        signal: AbortSignal.timeout(45000)
      });
      if (!response.ok) throw new Error("Gemini HTTP " + response.status);
      const data = await response.json();
      const raw = data?.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("\n") || "";
      return res.status(200).json({ ...parseOutput(raw, platform, topic), provider: "gemini", model: "gemini-2.5-flash" });
    } catch (error) { errors.push("Gemini: " + String(error?.message || error).slice(0, 120)); }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + process.env.OPENAI_API_KEY },
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
      return res.status(200).json({ ...parseOutput(data?.choices?.[0]?.message?.content || "", platform, topic), provider: "openai", model: "gpt-4o-mini" });
    } catch (error) { errors.push("OpenAI: " + String(error?.message || error).slice(0, 120)); }
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "AI belum dikonfigurasi. Tambahkan GEMINI_API_KEY dan/atau OPENAI_API_KEY di Vercel Environment Variables." });
  }
  return res.status(502).json({ error: "Semua penyedia AI gagal memproses permintaan. Periksa API key, kuota, dan log Vercel.", providers: errors });
};
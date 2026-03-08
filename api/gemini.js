export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt, useSearch } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "API Key missing" });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: useSearch ? [{ google_search: {} }] : []
      })
    });

    const data = await response.json();
    return res.status(200).json({
      text: data.candidates?.[0]?.content?.parts?.[0]?.text || "답변을 생성할 수 없습니다."
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
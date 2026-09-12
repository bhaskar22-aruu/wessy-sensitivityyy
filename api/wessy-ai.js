export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Add it in Vercel → Settings → Environment Variables.' });
  }

  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'No message provided.' });
  }

  const systemPrompt = `You are "Wessy AI", a friendly, knowledgeable Free Fire Max gaming expert built by Wessy Studio.
You help players improve sensitivity settings, aim, drag, headshots, HUD layout, and general gameplay strategy.
Keep answers short (2-4 sentences), practical, and encouraging. Use at most 1-2 emojis. Never mention you are Gemini or Google — you are simply Wessy AI.`;

  try {
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: message }] }]
      })
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error('Gemini API error:', data);
      return res.status(502).json({ error: data?.error?.message || 'AI request failed.' });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      || "I couldn't think of a reply — try asking again!";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Wessy AI error:', err);
    return res.status(500).json({ error: 'Something went wrong talking to Wessy AI.' });
  }
}

// This file runs on the SERVER, never in the student's browser.
// Uses Google Gemini (free tier, supports photos) to analyze food images.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { system, image, mimeType } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image provided.' });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Estimate the calories and macros in this meal.' },
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: image } }
            ]
          }],
          systemInstruction: { parts: [{ text: system }] },
          generationConfig: { maxOutputTokens: 1000 }
        })
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error('Gemini API error:', geminiRes.status, JSON.stringify(data));
      const reason = data?.error?.message || 'Unknown Gemini error';
      return res.status(geminiRes.status).json({ error: 'Gemini error: ' + reason });
    }

    const candidate = data.candidates && data.candidates[0];
    if (!candidate || !candidate.content) {
      console.error('Gemini returned no usable candidate:', JSON.stringify(data));
      const blockReason = data?.promptFeedback?.blockReason || candidate?.finishReason || 'empty response';
      return res.status(200).json({
        content: [{ type: 'text', text: `{"items":[],"total":{"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0},"confidence":"low","note":"Could not analyze this photo (${blockReason}). Try a clearer shot."}` }]
      });
    }

    const text = candidate.content.parts.map(p => p.text || '').join('');
    res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

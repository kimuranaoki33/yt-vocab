const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/api/translate', async (req, res) => {
  const { word, targetLang, context } = req.body;
  if (!word) return res.status(400).json({ error: 'word required' });
  const langName = targetLang === 'en' ? '英語' : '日本語';
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      system: `あなたは翻訳者です。与えられた単語を${langName}に翻訳してください。翻訳結果のみを返してください。説明不要。`,
      messages: [{ role: 'user', content: `単語: "${word}"\n文脈: "${context || ''}"` }],
    });
    res.json({ translation: message.content[0].text.trim() });
  } catch (e) {
    res.status(500).json({ error: 'translation failed' });
  }
});

app.get('/api/subtitles', async (req, res) => {
  const { videoId, lang = 'en' } = req.query;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await pageRes.text();
    const match = html.match(/"captionTracks":(\[.*?\])/s);
    if (!match) return res.status(404).json({ error: '字幕が見つかりません' });
    const tracks = JSON.parse(match[1].replace(/\\u0026/g, '&'));
    const track = tracks.find(t => t.languageCode?.startsWith(lang)) || tracks[0];
    if (!track) return res.status(404).json({ error: '字幕が見つかりません' });
    const capRes = await fetch(track.baseUrl);
    const xml = await capRes.text();
    const segments = [...xml.matchAll(/<text start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g)]
      .map(m => ({
        start: parseFloat(m[1]),
        text: m[2].replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim()
      })).filter(s => s.text);
    res.json({ segments, language: track.languageCode });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`起動中 → http://localhost:${PORT}`));

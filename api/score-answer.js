const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

const SYSTEM_PROMPT = `You are the scoring engine for a rarity-based trivia game. Players are given a prompt and must name something that fits. Their score depends on how RARE their correct answer is — the more obscure, the higher the score.

Scoring scale (1 to 1000):
- 1–150 = Plankton: the most obvious answer, the one almost everyone types first
- 151–300 = Too Clever: the "obscure" pick that everyone reaches for when trying to be clever
- 301–500 = Schooler: common but not automatic
- 501–750 = Rare: genuinely uncommon, requires real knowledge
- 751–950 = Deep Cut: deep knowledge, very few people would name it
- 951–1000 = One in a Krillion: the single rarest valid answer you can think of

CRITICAL RULES:
1. If the answer does not fit the prompt, return {"valid": false, "reason": "brief reason"}.
2. If it fits, return {"valid": true, "score": <integer 1-1000>, "tier": "<tier name>", "note": "one short sentence explaining the score"}.
3. Be honest about commonality. Do not inflate. Most answers land between 100 and 400.
4. "Name a cheese" — Cheddar is Plankton (~40). Taleggio is Deep Cut (~820).
5. "Name a country in Africa" — Egypt is Plankton. São Tomé and Príncipe is One in a Krillion.
6. The answer must genuinely fit the prompt. "Name a country in Africa" — Libya fits, Atlantis does not.
7. Spelling variants and partial names are acceptable if the intent is unambiguous.

Return ONLY a json object. No commentary, no markdown.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const body = req.body || {};
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const answer = typeof body.answer === 'string' ? body.answer.trim() : '';

  if (!prompt || !answer) {
    return res.status(400).json({ error: 'prompt and answer are required' });
  }
  if (answer.length > 100) {
    return res.status(400).json({ error: 'Answer is too long' });
  }

  try {
    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `PROMPT: "${prompt}"\nPLAYER'S ANSWER: "${answer}"` },
        ],
        temperature: 0.3,
        max_completion_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq error:', groqRes.status, errText);
      return res.status(502).json({ error: 'Scoring service unavailable' });
    }

    const data = await groqRes.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: 'Empty scoring response' });

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      return res.status(502).json({ error: 'Malformed scoring response' });
    }

    if (parsed.valid === false) {
      return res.status(200).json({
        valid: false,
        reason: String(parsed.reason || 'That does not fit the prompt.').slice(0, 200),
      });
    }

    const score = Math.max(1, Math.min(1000, Math.round(Number(parsed.score) || 1)));
    return res.status(200).json({
      valid: true,
      score,
      tier: String(parsed.tier || tierFor(score)).slice(0, 40),
      note: String(parsed.note || '').slice(0, 200),
    });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function tierFor(score) {
  if (score <= 150) return 'Plankton';
  if (score <= 300) return 'Too Clever';
  if (score <= 500) return 'Schooler';
  if (score <= 750) return 'Rare';
  if (score <= 950) return 'Deep Cut';
  return 'One in a Krillion';
}

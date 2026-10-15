import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

export const config = { maxDuration: 60 };

const GENERATION_PROMPT = `You generate prompts for Krillion — a trivia game where players name something fitting a prompt, and score higher for rarer answers.

Generate exactly 100 prompts. Return ONLY a json object: {"prompts": ["...", "..."]}.

DIVERSITY IS MANDATORY. Your 100 prompts must include ALL of these types:

1. Straight categories (max 25 of the 100): "Name a country in Africa."
2. Negative constraints: "Name a US state that does not border an ocean." / "Name a cheese that isn't cheddar, brie, or mozzarella."
3. Letter constraints: "Name a country that starts with two consonants." / "Name a vegetable that begins with the letter P."
4. Ending constraints: "Name a vegetable that ends in the letter A." / "Name a country whose name ends in -stan."
5. Length constraints: "Name a movie with a one-word title." / "Name a country whose name is exactly five letters."
6. Situational: "Name a food you would eat at 3 AM." / "Name something you'd bring to a desert island."
7. Time-anchored: "Name a song from the 1980s." / "Name a movie released before 1970."
8. Wordplay: "Name a word that rhymes with 'orange'." / "Name a word that contains the letter Q but no U."
9. Contradictions: "Name a food that is both sweet and savory." / "Name something that is both a noun and a verb."
10. Pop culture with constraints: "Name a Pokémon that is not from Generation 1." / "Name a Beatles song that isn't on Abbey Road."
11. Science and nature: "Name a planet or moon with an atmosphere." / "Name a mammal that lays eggs."
12. Conceptual: "Name a color that does not appear in a rainbow." / "Name an emotion with no single-word English translation."
13. Knowledge-testing: "Name a Nobel laureate from outside Europe and North America." / "Name a language spoken by fewer than 100,000 people."
14. Reverse-think: "Name something that only exists in fiction." / "Name a job that no longer exists."
15. Modifier constraints: "Name a city known for its bridges." / "Name a film set entirely in one room."

RULES:
- Exactly 100 unique prompts. No duplicates.
- Each prompt is a single sentence, 6-20 words.
- Answerable in 1-3 words.
- Unambiguous about what counts.
- Mix difficulty: 30 easy, 50 medium, 20 hard.
- No politics, no religion, no slurs, no prompts whose correct answers could be offensive.
- Be genuinely creative. Surprise me. Do not repeat the classic "Name a country in Africa" formula more than a handful of times.
- No commentary, no markdown.`;

export default async function handler(req, res) {
  // Verify request is from Vercel cron
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.CRON_SECRET && req.headers.authorization !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not set' });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
        messages: [{ role: 'user', content: GENERATION_PROMPT }],
        temperature: 1.1,
        max_completion_tokens: 6000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq error:', groqRes.status, errText);
      return res.status(502).json({ error: 'Groq generation failed' });
    }

    const data = await groqRes.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: 'Empty Groq response' });

    let parsed;
    try { parsed = JSON.parse(content); }
    catch (e) { return res.status(502).json({ error: 'Malformed JSON from Groq' }); }

    let prompts = Array.isArray(parsed.prompts) ? parsed.prompts : [];
    prompts = prompts
      .map(p => String(p || '').trim())
      .filter(p => p.length >= 8 && p.length <= 200)
      .filter(p => /[.!?]$/.test(p) || /^Name /i.test(p))
      .filter((p, i, arr) => arr.indexOf(p) === i);

    if (prompts.length < 50) {
      return res.status(502).json({ error: `Only got ${prompts.length} valid prompts` });
    }

    const today = new Date().toISOString().slice(0, 10);
    await kv.set(`krillion_prompts:${today}`, prompts, { ex: 60 * 60 * 24 * 14 });
    await kv.set('krillion_prompts:latest', {
      date: today,
      count: prompts.length,
      prompts,
    });

    console.log(`Generated ${prompts.length} prompts for ${today}`);
    return res.status(200).json({ success: true, date: today, count: prompts.length });
  } catch (err) {
    console.error('Generate prompts failed:', err);
    return res.status(500).json({ error: err.message });
  }
}

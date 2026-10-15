import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const FALLBACK_PROMPTS = [
  'Name a country in Africa.',
  'Name a country in Asia.',
  'Name a European capital city.',
  'Name a US state.',
  'Name a cheese.',
  'Name a spice.',
  'Name a vegetable.',
  'Name a fruit.',
  'Name a type of pasta.',
  'Name a type of bread.',
  'Name an ocean animal.',
  'Name a bird.',
  'Name a dog breed.',
  'Name a big cat.',
  'Name an insect.',
  'Name a tree.',
  'Name a musical instrument.',
  'Name a board game.',
  'Name a programming language.',
  'Name a car brand.',
  'Name a Pokémon.',
  'Name a country that starts with two consonants.',
  'Name a US state that does not border an ocean.',
  'Name a movie with a one-word title.',
  'Name a food you would eat at 3 AM.',
  'Name a song by The Beatles.',
  'Name a color that does not appear in a rainbow.',
  'Name a food that is both sweet and savory.',
  'Name a vegetable that ends in the letter A.',
  'Name a word that rhymes with "orange".',
  'Name a fictional character who wears a hat.',
  'Name a country whose flag has more than three colors.',
  'Name a piece of furniture you can sit on.',
  'Name a city with more than 10 million people.',
  'Name a type of cloud.',
  'Name something that only exists in fiction.',
  'Name a job that no longer exists.',
  'Name a mammal that lays eggs.',
  'Name a city known for its bridges.',
  'Name a film set entirely in one room.',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let prompts = [];
  let source = 'fallback';

  try {
    const today = new Date().toISOString().slice(0, 10);
    const stored = await kv.get(`krillion_prompts:${today}`);
    if (Array.isArray(stored) && stored.length >= 5) {
      prompts = stored;
      source = 'today';
    } else {
      // Today's set isn't ready — use the most recent one we have
      const latest = await kv.get('krillion_prompts:latest');
      if (latest && Array.isArray(latest.prompts) && latest.prompts.length >= 5) {
        prompts = latest.prompts;
        source = 'latest';
      }
    }
  } catch (e) {
    console.error('Redis read failed:', e.message);
  }

  if (prompts.length < 5) {
    prompts = FALLBACK_PROMPTS;
    source = 'fallback';
  }

  // Pick 5 unique random prompts from the pool
  const pool = [...prompts];
  const picked = [];
  while (picked.length < 5 && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }

  return res.status(200).json({ prompts: picked, source, poolSize: prompts.length });
}

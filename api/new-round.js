const PROMPTS = [
  'Name a country in Africa',
  'Name a country in Asia',
  'Name a country in South America',
  'Name a capital city in Europe',
  'Name a city in the United States',
  'Name a US state',
  'Name a cheese',
  'Name a spice',
  'Name a vegetable',
  'Name a fruit',
  'Name a herb',
  'Name a cut of beef',
  'Name a type of pasta',
  'Name a type of bread',
  'Name an animal that lives in the ocean',
  'Name a bird',
  'Name a dog breed',
  'Name a big cat',
  'Name an insect',
  'Name a reptile',
  'Name a tree',
  'Name a flower',
  'Name a musical instrument',
  'Name a board game',
  'Name a video game',
  'Name a movie from the 1990s',
  'Name a movie from the 2000s',
  'Name a superhero',
  'Name a programming language',
  'Name a car brand',
  'Name a planet or moon in our solar system',
  'Name a language spoken in Asia',
  'Name a Pokémon',
  'Name a food you can eat with your hands',
  'Name a type of hat',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Pick 5 unique prompts
  const pool = [...PROMPTS];
  const picked = [];
  while (picked.length < 5 && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }

  return res.status(200).json({ prompts: picked });
}

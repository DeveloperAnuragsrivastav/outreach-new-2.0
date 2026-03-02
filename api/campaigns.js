// Vercel Serverless Function — GET /api/campaigns
// Fetches all rows from campaignsdata and returns them
// Browser never calls supabase.co directly

const SUPABASE_URL = 'https://mjffvxkothiczayhkjcx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZmZ2eGtvdGhpY3pheWhramN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTEyNjEsImV4cCI6MjA4NzY2NzI2MX0.-g4vsENBmQnCk-M7c-k_lax-tTV2BOJEZxtFEDYxgEc';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/campaignsdata?select=campaign_name,created_at&order=created_at.desc`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Supabase fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
}

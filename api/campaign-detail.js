// Vercel Serverless Function — GET /api/campaign-detail?name=...
// Fetches all rows for a specific campaign from campaignsdata

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

  const campaignName = req.query.name;
  if (!campaignName) {
    return res.status(400).json({ error: 'Missing ?name= parameter' });
  }

  try {
    const encoded = encodeURIComponent(campaignName);
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/campaignsdata?select=id,campaign_name,email_subject,email_body,created_at&campaign_name=eq.${encoded}&order=created_at.asc`,
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

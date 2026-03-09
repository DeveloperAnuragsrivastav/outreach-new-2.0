// Vercel Serverless Function — POST /api/campaign-rerun?id=...
// Re-runs a campaign by fetching its data and re-sending to the webhook

const SUPABASE_URL = 'https://mjffvxkothiczayhkjcx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZmZ2eGtvdGhpY3pheWhramN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTEyNjEsImV4cCI6MjA4NzY2NzI2MX0.-g4vsENBmQnCk-M7c-k_lax-tTV2BOJEZxtFEDYxgEc';
const WEBHOOK_URL = 'https://n8n.gignaati.com/webhook-test/Outreach_Campaign';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Missing ?id= parameter' });

  try {
    // 1. Fetch campaign data from Supabase
    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${id}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      return res.status(fetchRes.status).json({ error: errText });
    }

    const campaigns = await fetchRes.json();
    if (!campaigns || campaigns.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = campaigns[0];

    // 2. Build webhook payload (same format as new campaign launch)
    const payload = {
      campaign_name: campaign.campaign_name,
      goal: campaign.goal || '',
      job_titles: campaign.job_titles || '',
      industries: campaign.industries || '',
      company_size: campaign.company_size || '',
      geography: campaign.geography || '',
      sender_name: campaign.sender_name || '',
      sender_role: campaign.sender_role || '',
      sender_email: campaign.sender_email || '',
      prospects: campaign.prospects || 250,
      launched_at: new Date().toISOString(),
      is_rerun: true,
      original_campaign_id: campaign.id,
    };

    // 3. Send to webhook
    const webhookRes = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // 4. Update launched_at in DB
    await fetch(
      `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ launched_at: new Date().toISOString() }),
      }
    );

    return res.status(200).json({
      success: true,
      campaign_name: campaign.campaign_name,
      webhook_status: webhookRes.status,
    });
  } catch (err) {
    console.error('Re-run error:', err);
    return res.status(500).json({ error: err.message });
  }
}

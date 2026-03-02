/* ============================================================
   CAMPAIGNBUDDY — SUPABASE REAL-TIME INTEGRATION
   Uses ONLY the `campaignsdata` table

   LOCAL DEV: Run `node server.js` and open http://localhost:3000
   The proxy in server.js forwards all /rest/v1/* calls to Supabase.
   No direct calls to supabase.co are made from the browser.

   PROD: Replace API_BASE with full Supabase URL:
     const API_BASE = 'https://mjffvxkothiczayhkjcx.supabase.co';
   ============================================================ */

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZmZ2eGtvdGhpY3pheWhramN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTEyNjEsImV4cCI6MjA4NzY2NzI2MX0.-g4vsENBmQnCk-M7c-k_lax-tTV2BOJEZxtFEDYxgEc';

// AUTO-DETECT: use local proxy on localhost:3000, real URL on production
// TO REMOVE FOR PROD: set API_BASE = 'https://mjffvxkothiczayhkjcx.supabase.co'
const _isLocalProxy = window.location.hostname === 'localhost' && window.location.port === '3000';
const API_BASE = _isLocalProxy
  ? `${window.location.protocol}//${window.location.host}`
  : 'https://mjffvxkothiczayhkjcx.supabase.co';

const SUPABASE_HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// ── State ──────────────────────────────────────────────────────
let _pollInterval = null;
let _detailPollInterval = null;
let currentDetailCampaign = null;

// ── Helpers ────────────────────────────────────────────────────
function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function truncate(str, len = 90) {
  if (!str) return '—';
  return str.length > len ? str.substring(0, len) + '…' : str;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '-');
}

// ── REST API helper ────────────────────────────────────────────
async function supabaseFetch(path) {
  const res = await fetch(`${API_BASE}/rest/v1/${path}`, {
    headers: SUPABASE_HEADERS,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Live indicator ─────────────────────────────────────────────
function setLiveIndicator(connected) {
  const indicator = document.getElementById('realtime-indicator');
  if (!indicator) return;
  if (connected) {
    indicator.classList.add('connected');
  } else {
    indicator.classList.remove('connected');
  }
}

function flashLiveIndicator() {
  const dot = document.querySelector('.realtime-dot');
  if (!dot) return;
  dot.classList.add('flash');
  setTimeout(() => dot.classList.remove('flash'), 800);
}

// ── Campaign History Page ──────────────────────────────────────
async function loadCampaignHistory() {
  const tbody = document.getElementById('campaign-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:32px;color:#999;">Loading campaigns...</td></tr>`;

  try {
    const data = await supabaseFetch('campaignsdata?select=campaign_name,created_at&order=created_at.desc');
    renderCampaignHistory(data || []);
    setLiveIndicator(true);
    flashLiveIndicator();
  } catch (err) {
    console.error('Error loading campaign history:', err);
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:32px;color:#e74c3c;">Failed to load campaigns. Please try again.</td></tr>`;
    setLiveIndicator(false);
  }
}

function renderCampaignHistory(rows) {
  const tbody = document.getElementById('campaign-tbody');
  if (!tbody) return;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:32px;color:#999;">No campaigns found.</td></tr>`;
    return;
  }

  // Group by campaign_name
  const grouped = {};
  rows.forEach(row => {
    const name = row.campaign_name || 'Unnamed Campaign';
    if (!grouped[name]) {
      grouped[name] = { count: 0, firstDate: row.created_at };
    }
    grouped[name].count++;
    if (row.created_at < grouped[name].firstDate) {
      grouped[name].firstDate = row.created_at;
    }
  });

  const campaigns = Object.entries(grouped).sort((a, b) =>
    new Date(b[1].firstDate) - new Date(a[1].firstDate)
  );

  tbody.innerHTML = '';
  campaigns.forEach(([name, info]) => {
    const tr = document.createElement('tr');
    tr.className = 'table-row-anim';
    tr.dataset.campaign = name;
    tr.innerHTML = `
      <td class="campaign-name-cell">
        <span class="campaign-name">${escapeHtml(name)}</span>
        <span class="campaign-date">Started ${formatDate(info.firstDate)}</span>
      </td>
      <td class="sent-count-cell" id="sent-${slugify(name)}">${info.count.toLocaleString()}</td>
      <td>
        <button class="btn-open-detail" onclick="openCampaignDetail('${escapeHtml(name).replace(/'/g, "\\'")}')">
          Open <i data-lucide="arrow-right" width="14" height="14" style="vertical-align:middle;margin-left:4px;"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (window.lucide) window.lucide.createIcons();
}

// Poll every 10 seconds for real-time-like updates
function startHistoryPolling() {
  stopHistoryPolling();
  _pollInterval = setInterval(() => {
    loadCampaignHistory();
  }, 10000);
}

function stopHistoryPolling() {
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }
}

// ── Campaign Detail Page ───────────────────────────────────────
async function openCampaignDetail(campaignName) {
  currentDetailCampaign = campaignName;

  const titleEl = document.getElementById('detail-campaign-title');
  if (titleEl) titleEl.textContent = campaignName;

  navigateTo('campaign-detail');
  await loadCampaignDetail(campaignName);
  startDetailPolling(campaignName);
}

async function loadCampaignDetail(campaignName) {
  const tbody = document.getElementById('detail-tbody');
  const countEl = document.getElementById('detail-sent-count');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:#999;">Loading emails...</td></tr>`;
  if (countEl) countEl.textContent = '…';

  try {
    const encoded = encodeURIComponent(campaignName);
    const data = await supabaseFetch(
      `campaignsdata?select=id,campaign_name,email_subject,email_body,created_at&campaign_name=eq.${encoded}&order=created_at.asc`
    );
    renderCampaignDetail(data || []);
  } catch (err) {
    console.error('Error loading campaign detail:', err);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:#e74c3c;">Failed to load emails.</td></tr>`;
  }
}

function renderCampaignDetail(rows) {
  const tbody = document.getElementById('detail-tbody');
  const countEl = document.getElementById('detail-sent-count');
  if (!tbody) return;

  if (countEl) countEl.textContent = rows.length.toLocaleString();

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:#999;">No emails found for this campaign.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'table-row-anim';
    tr.innerHTML = `
      <td style="color:#999;font-size:13px;">${idx + 1}</td>
      <td class="email-subject-cell">
        <span class="email-subject-text">${escapeHtml(row.email_subject || '—')}</span>
      </td>
      <td class="email-body-cell">
        <span class="email-body-preview" title="${escapeHtml(row.email_body || '')}">${escapeHtml(truncate(row.email_body, 100))}</span>
      </td>
      <td class="sent-at-cell" style="white-space:nowrap;font-size:13px;color:#666;">${formatDateTime(row.created_at)}</td>
    `;
    tbody.appendChild(tr);
  });

  if (window.lucide) window.lucide.createIcons();
}

function startDetailPolling(campaignName) {
  stopDetailPolling();
  _detailPollInterval = setInterval(() => {
    loadCampaignDetail(campaignName);
  }, 10000);
}

function stopDetailPolling() {
  if (_detailPollInterval) {
    clearInterval(_detailPollInterval);
    _detailPollInterval = null;
  }
}

// ── Hook into existing initReport ─────────────────────────────
const _originalInitReport = window.initReport;
window.initReport = function () {
  if (_originalInitReport) _originalInitReport();
  loadCampaignHistory();
  startHistoryPolling();
};

// ── Cleanup on page leave ──────────────────────────────────────
const _originalNavigateTo = window.navigateTo;
window.navigateTo = function (page) {
  if (page !== 'campaign-detail') {
    stopDetailPolling();
    currentDetailCampaign = null;
  }
  if (page !== 'report') {
    stopHistoryPolling();
  }
  _originalNavigateTo(page);
};

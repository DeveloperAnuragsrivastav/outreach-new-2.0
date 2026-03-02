/* ============================================================
   CAMPAIGNBUDDY — SUPABASE REAL-TIME INTEGRATION
   Uses ONLY the `campaignsdata` table
   ============================================================ */

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZmZ2eGtvdGhpY3pheWhramN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTEyNjEsImV4cCI6MjA4NzY2NzI2MX0.-g4vsENBmQnCk-M7c-k_lax-tTV2BOJEZxtFEDYxgEc';

// AUTO-DETECT: Use local proxy when running on localhost:3000 (node server.js)
// Use real Supabase URL when on production / any other host
// TO REMOVE FOR PROD: replace the whole block with just:
//   const SUPABASE_URL = 'https://mjffvxkothiczayhkjcx.supabase.co';
const _isLocalProxy = window.location.hostname === 'localhost' && window.location.port === '3000';
const SUPABASE_URL = _isLocalProxy
  ? `${window.location.protocol}//${window.location.host}`
  : 'https://mjffvxkothiczayhkjcx.supabase.co';

// Initialize Supabase client
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── State ──────────────────────────────────────────────────────
let realtimeChannel = null;
let currentDetailCampaign = null;
let detailRealtimeChannel = null;

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

// ── Campaign History Page ──────────────────────────────────────

/**
 * Fetch all campaigns from campaignsdata grouped by campaign_name
 * and render them in the history table with real-time count.
 */
async function loadCampaignHistory() {
  const tbody = document.getElementById('campaign-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:32px;color:#999;">Loading campaigns...</td></tr>`;

  try {
    // Get all rows from campaignsdata
    const { data, error } = await _supabase
      .from('campaignsdata')
      .select('campaign_name, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    renderCampaignHistory(data || []);
  } catch (err) {
    console.error('Error loading campaign history:', err);
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:32px;color:#e74c3c;">Failed to load campaigns. Please try again.</td></tr>`;
  }
}

/**
 * Group rows by campaign_name and render the history table.
 */
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
    // Track earliest date
    if (row.created_at < grouped[name].firstDate) {
      grouped[name].firstDate = row.created_at;
    }
  });

  const campaigns = Object.entries(grouped).sort((a, b) => {
    // Sort by first date descending
    return new Date(b[1].firstDate) - new Date(a[1].firstDate);
  });

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

  // Re-init icons
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Subscribe to real-time changes on campaignsdata table
 * and refresh the history table when data changes.
 */
function subscribeToHistory() {
  // Clean up existing subscription
  if (realtimeChannel) {
    _supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  realtimeChannel = _supabase
    .channel('campaignsdata-history')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'campaignsdata' },
      (payload) => {
        console.log('Real-time update received:', payload);
        // Reload the full history on any change
        loadCampaignHistory();
        // Flash the live indicator
        flashLiveIndicator();
      }
    )
    .subscribe((status) => {
      console.log('Realtime subscription status:', status);
      const indicator = document.getElementById('realtime-indicator');
      if (indicator) {
        if (status === 'SUBSCRIBED') {
          indicator.classList.add('connected');
        } else {
          indicator.classList.remove('connected');
        }
      }
    });
}

function flashLiveIndicator() {
  const dot = document.querySelector('.realtime-dot');
  if (!dot) return;
  dot.classList.add('flash');
  setTimeout(() => dot.classList.remove('flash'), 800);
}

// ── Campaign Detail Page ───────────────────────────────────────

/**
 * Open the campaign detail page for a specific campaign name.
 */
async function openCampaignDetail(campaignName) {
  currentDetailCampaign = campaignName;

  // Update title
  const titleEl = document.getElementById('detail-campaign-title');
  if (titleEl) titleEl.textContent = campaignName;

  // Navigate to detail page
  navigateTo('campaign-detail');

  // Load emails
  await loadCampaignDetail(campaignName);

  // Subscribe to real-time updates for this campaign
  subscribeToDetail(campaignName);
}

/**
 * Fetch all emails for a specific campaign from campaignsdata.
 */
async function loadCampaignDetail(campaignName) {
  const tbody = document.getElementById('detail-tbody');
  const countEl = document.getElementById('detail-sent-count');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:#999;">Loading emails...</td></tr>`;
  if (countEl) countEl.textContent = '…';

  try {
    const { data, error } = await _supabase
      .from('campaignsdata')
      .select('id, campaign_name, email_subject, email_body, created_at')
      .eq('campaign_name', campaignName)
      .order('created_at', { ascending: true });

    if (error) throw error;

    renderCampaignDetail(data || []);
  } catch (err) {
    console.error('Error loading campaign detail:', err);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:#e74c3c;">Failed to load emails.</td></tr>`;
  }
}

/**
 * Render the detail table rows.
 */
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

/**
 * Subscribe to real-time changes for a specific campaign's detail view.
 */
function subscribeToDetail(campaignName) {
  // Clean up existing
  if (detailRealtimeChannel) {
    _supabase.removeChannel(detailRealtimeChannel);
    detailRealtimeChannel = null;
  }

  detailRealtimeChannel = _supabase
    .channel('campaignsdata-detail-' + slugify(campaignName))
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'campaignsdata',
        filter: `campaign_name=eq.${campaignName}`
      },
      (payload) => {
        console.log('Detail real-time update:', payload);
        loadCampaignDetail(campaignName);
      }
    )
    .subscribe();
}

// ── Utility ────────────────────────────────────────────────────
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

// ── Hook into existing initReport ─────────────────────────────
// Override the existing initReport function to load real-time data
const _originalInitReport = window.initReport;
window.initReport = function () {
  if (_originalInitReport) _originalInitReport();
  loadCampaignHistory();
  subscribeToHistory();
};

// ── Cleanup on page leave ──────────────────────────────────────
// Unsubscribe detail channel when leaving detail page
const _originalNavigateTo = window.navigateTo;
window.navigateTo = function (page) {
  // If leaving detail page, unsubscribe detail channel
  if (page !== 'campaign-detail' && detailRealtimeChannel) {
    _supabase.removeChannel(detailRealtimeChannel);
    detailRealtimeChannel = null;
    currentDetailCampaign = null;
  }
  _originalNavigateTo(page);
};

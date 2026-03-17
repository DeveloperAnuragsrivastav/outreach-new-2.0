/* ============================================================
   CAMPAIGNBUDDY — SUPABASE INTEGRATION (Universal)
   Direct Supabase REST API calls — works on ANY static hosting
   No server-side proxy or Vercel functions needed
   ============================================================ */

const SUPABASE_URL = 'https://mjffvxkothiczayhkjcx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZmZ2eGtvdGhpY3pheWhramN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTEyNjEsImV4cCI6MjA4NzY2NzI2MX0.-g4vsENBmQnCk-M7c-k_lax-tTV2BOJEZxtFEDYxgEc';

const SUPABASE_HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
};

// ── State ─────────────────────────────────────────────────────
let currentDetailCampaign = null;
let _historyLoaded = false;  // track if history has been loaded at least once

// ── Generic Supabase REST Helper ──────────────────────────────
async function supabaseRest(path, options = {}) {
  const url = SUPABASE_URL + '/rest/v1/' + path;
  const headers = Object.assign({}, SUPABASE_HEADERS);
  if (options.extraHeaders) Object.assign(headers, options.extraHeaders);

  const fetchOpts = { method: options.method || 'GET', headers: headers };
  if (options.body) fetchOpts.body = JSON.stringify(options.body);

  const res = await fetch(url, fetchOpts);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('HTTP ' + res.status + ': ' + errText);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-length');
  if (ct === '0') return null;
  return res.json();
}

// ── Helpers ────────────────────────────────────────────────────
function formatDate(isoString) {
  if (!isoString) return '—';
  var d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  var d = new Date(isoString);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function truncate(str, len) {
  len = len || 90;
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

// ── Live indicator ────────────────────────────────────────────
function setLiveIndicator(connected) {
  var indicator = document.getElementById('realtime-indicator');
  if (!indicator) return;
  if (connected) indicator.classList.add('connected');
  else indicator.classList.remove('connected');
}

function flashLiveIndicator() {
  var dot = document.querySelector('.realtime-dot');
  if (!dot) return;
  dot.classList.add('flash');
  setTimeout(function () { dot.classList.remove('flash'); }, 800);
}

// ══════════════════════════════════════════════════════════════
//  CAMPAIGN HISTORY (Reports page) — from campaignsdata table
//  Loads ONCE on page visit. Use refreshCampaignHistory() to reload.
// ══════════════════════════════════════════════════════════════

async function loadCampaignHistory(forceRefresh) {
  var tbody = document.getElementById('campaign-tbody');
  if (!tbody) return;

  // Show loading state
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:#999;">Loading campaigns...</td></tr>';

  // Disable refresh button while loading
  var refreshBtn = document.getElementById('history-refresh-btn');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i data-lucide="loader-2" width="14" height="14" style="animation:spin 1s linear infinite;vertical-align:middle;margin-right:4px;"></i> Refreshing…';
  }

  try {
    // Fetch campaign_name, created_at, to (sent to), from (sent by)
    var data = await supabaseRest('campaignsdata?select=campaign_name,created_at,"to","from"&order=created_at.desc');
    renderCampaignHistory(data || []);
    _historyLoaded = true;
    setLiveIndicator(true);
    flashLiveIndicator();
  } catch (err) {
    console.error('Error loading campaign history:', err);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:#e74c3c;">Failed to load campaigns. Click Refresh to try again.</td></tr>';
    setLiveIndicator(false);
  } finally {
    // Re-enable refresh button
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<i data-lucide="refresh-cw" width="14" height="14" style="vertical-align:middle;margin-right:4px;"></i> Refresh';
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

// Called by the Refresh button in the UI
window.refreshCampaignHistory = function () {
  loadCampaignHistory(true);
};

function renderCampaignHistory(rows) {
  var tbody = document.getElementById('campaign-tbody');
  if (!tbody) return;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:#999;">No campaigns found.</td></tr>';
    return;
  }

  // Group rows by campaign_name — collect unique to/from values per campaign
  var grouped = {};
  rows.forEach(function (row) {
    var name = row.campaign_name || 'Unnamed Campaign';
    if (!grouped[name]) {
      grouped[name] = {
        count: 0,
        firstDate: row.created_at,
        toSet: new Set(),
        fromSet: new Set()
      };
    }
    grouped[name].count++;
    if (row.created_at < grouped[name].firstDate) grouped[name].firstDate = row.created_at;
    if (row['to'])   grouped[name].toSet.add(row['to']);
    if (row['from']) grouped[name].fromSet.add(row['from']);
  });

  var campaigns = Object.entries(grouped).sort(function (a, b) {
    return new Date(b[1].firstDate) - new Date(a[1].firstDate);
  });

  tbody.innerHTML = '';
  campaigns.forEach(function (entry) {
    var name = entry[0], info = entry[1];

    // Format to/from — show up to 2 values then "+N more"
    function formatSet(set) {
      var arr = Array.from(set).filter(Boolean);
      if (arr.length === 0) return '<span style="color:#bbb;">—</span>';
      var display = arr.slice(0, 2).map(function(v) { return escapeHtml(v); }).join(', ');
      if (arr.length > 2) display += ' <span style="color:#999;font-size:0.75rem;">+' + (arr.length - 2) + ' more</span>';
      return display;
    }

    var tr = document.createElement('tr');
    tr.className = 'table-row-anim';
    tr.dataset.campaign = name;
    tr.innerHTML =
      '<td class="campaign-name-cell">' +
        '<span class="campaign-name">' + escapeHtml(name) + '</span>' +
        '<span class="campaign-date">Started ' + formatDate(info.firstDate) + '</span>' +
      '</td>' +
      '<td class="sent-count-cell">' + info.count.toLocaleString() + '</td>' +
      '<td class="history-to-cell">' + formatSet(info.toSet) + '</td>' +
      '<td class="history-from-cell">' + formatSet(info.fromSet) + '</td>' +
      '<td>' +
        '<button class="btn-open-detail" onclick="openCampaignDetail(\'' + escapeHtml(name).replace(/'/g, "\\'") + '\')">' +
          'Open <i data-lucide="arrow-right" width="14" height="14" style="vertical-align:middle;margin-left:4px;"></i>' +
        '</button>' +
      '</td>';
    tbody.appendChild(tr);
  });

  if (window.lucide) window.lucide.createIcons();
}

// ══════════════════════════════════════════════════════════════
//  CAMPAIGN DETAIL — emails for a specific campaign
// ══════════════════════════════════════════════════════════════

async function openCampaignDetail(campaignName) {
  currentDetailCampaign = campaignName;

  var titleEl = document.getElementById('detail-campaign-title');
  if (titleEl) titleEl.textContent = campaignName;

  navigateTo('campaign-detail');
  await loadCampaignDetail(campaignName);
}

async function loadCampaignDetail(campaignName) {
  var tbody = document.getElementById('detail-tbody');
  var countEl = document.getElementById('detail-sent-count');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:#999;">Loading emails...</td></tr>';
  if (countEl) countEl.textContent = '…';

  try {
    var encoded = encodeURIComponent(campaignName);
    var data = await supabaseRest('campaignsdata?campaign_name=eq.' + encoded + '&select=email_subject,email_body,created_at&order=created_at.desc');
    renderCampaignDetail(data || []);
  } catch (err) {
    console.error('Error loading campaign detail:', err);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:#e74c3c;">Failed to load emails.</td></tr>';
  }
}

function renderCampaignDetail(rows) {
  var tbody = document.getElementById('detail-tbody');
  var countEl = document.getElementById('detail-sent-count');
  if (!tbody) return;

  if (countEl) countEl.textContent = rows.length.toLocaleString();

  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:#999;">No emails found for this campaign.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  rows.forEach(function (row, idx) {
    var tr = document.createElement('tr');
    tr.className = 'table-row-anim email-preview-item';
    tr.style.display = 'block';
    tr.style.marginBottom = '16px';

    var safeSubject = escapeHtml(row.email_subject || '—');
    var safeBody = escapeHtml(row.email_body || '');
    var dateStr = formatDateTime(row.created_at);

    tr.innerHTML =
      '<td style="display:block;width:100%;border:none;padding:0;">' +
        '<div class="email-preview-meta">' +
          '<div class="ep-subject">' + safeSubject + '</div>' +
          '<div class="ep-date">' + dateStr + '</div>' +
        '</div>' +
        '<div class="ep-preview">' + escapeHtml(truncate(row.email_body, 140)) + '</div>' +
        '<div style="margin-top:12px;">' +
          '<button class="btn-open-detail" onclick="openEmailPreviewModal(this)" style="display:inline-flex;align-items:center;gap:6px;font-size:0.8125rem;font-weight:500;color:var(--charcoal);background:var(--warm-stone);border:1px solid var(--charcoal-08);padding:6px 12px;border-radius:100px;cursor:pointer;transition:background 0.2s;">' +
            '<i data-lucide="eye" width="14" height="14"></i> Preview Email' +
          '</button>' +
          '<template class="modal-data-template">' +
            '<div class="mod-subject">' + safeSubject + '</div>' +
            '<div class="mod-body">' + safeBody + '</div>' +
            '<div class="mod-date">' + dateStr + '</div>' +
          '</template>' +
        '</div>' +
      '</td>';
    tbody.appendChild(tr);
  });

  if (window.lucide) window.lucide.createIcons();
}

// ── Email Preview Modal Logic ─────────────────────────────────
window.openEmailPreviewModal = function (btn) {
  var tpl = btn.nextElementSibling;
  if (!tpl) return;
  var content = tpl.content || tpl;
  var subject = content.querySelector('.mod-subject').innerHTML;
  var body = content.querySelector('.mod-body').innerHTML;
  var date = content.querySelector('.mod-date').innerHTML;

  document.getElementById('preview-modal-subject').innerHTML = subject;
  document.getElementById('preview-modal-body').innerHTML = body;
  document.getElementById('preview-modal-date').innerHTML = date;

  document.getElementById('email-preview-modal').classList.remove('hidden');
};

window.closeEmailPreviewModal = function () {
  document.getElementById('email-preview-modal').classList.add('hidden');
};

window.closeEmailPreviewOnBackdrop = function (e) {
  if (e.target === document.getElementById('email-preview-modal')) {
    closeEmailPreviewModal();
  }
};

// ── Hook into existing initReport ────────────────────────────
// Load campaign history ONCE when the user navigates to the page.
// No polling — use the Refresh button to reload.
var _originalInitReport = window.initReport;
window.initReport = function () {
  if (_originalInitReport) _originalInitReport();
  loadCampaignHistory();
};

// ── Cleanup on page leave ─────────────────────────────────────
var _originalNavigateTo = window.navigateTo;
window.navigateTo = function (page) {
  if (page !== 'campaign-detail') {
    currentDetailCampaign = null;
  }
  _originalNavigateTo(page);
};

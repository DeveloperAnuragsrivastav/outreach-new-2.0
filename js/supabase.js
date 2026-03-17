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
let _allCampaignHistoryData = []; // store history data for filtering

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
// Parse DB date string directly — no timezone conversion.
// Supabase returns timestamps without 'Z', already in local time (IST).
// Using new Date() on such strings causes cross-browser timezone shifts.
function _parseDbDate(isoString) {
  // '2026-03-17T11:32:06.595209' → [2026, 3, 17, 11, 32, 6]
  var parts = isoString.replace('T', '-').replace(/\..*$/, '').split(/[-:]/);
  // month is 0-indexed in Date constructor
  return new Date(+parts[0], +parts[1] - 1, +parts[2], +parts[3] || 0, +parts[4] || 0, +parts[5] || 0);
}

var _months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(isoString) {
  if (!isoString) return '—';
  var d = _parseDbDate(isoString);
  return _months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  var d = _parseDbDate(isoString);
  var h = d.getHours();
  var m = d.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  var mm = m < 10 ? '0' + m : m;
  return _months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ', ' + h + ':' + mm + ' ' + ampm;
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
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:32px;color:#999;">Loading campaigns...</td></tr>';

  // Disable refresh button while loading
  var refreshBtn = document.getElementById('history-refresh-btn');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i data-lucide="loader-2" width="14" height="14" style="animation:spin 1s linear infinite;vertical-align:middle;margin-right:4px;"></i> Refreshing…';
  }

  try {
    // Fetch campaign_name and created_at for the history list
    var data = await supabaseRest('campaignsdata?select=campaign_name,created_at&order=created_at.desc');
    _allCampaignHistoryData = data || [];
    populateHistoryFilters(_allCampaignHistoryData);
    renderCampaignHistory();
    _historyLoaded = true;
    setLiveIndicator(true);
    flashLiveIndicator();
  } catch (err) {
    console.error('Error loading campaign history:', err);
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:32px;color:#e74c3c;">Failed to load campaigns. Click Refresh to try again.</td></tr>';
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

function populateHistoryFilters(rows) {
  var select = document.getElementById('history-campaign-filter');
  if (!select) return;
  var currentVal = select.value;
  var uniqueNames = new Set();
  rows.forEach(function(r) { if (r.campaign_name) uniqueNames.add(r.campaign_name); });
  
  var sortedNames = Array.from(uniqueNames).sort();
  var html = '<option value="">All Campaigns</option>';
  sortedNames.forEach(function(name) {
    html += '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
  });
  select.innerHTML = html;
  if (sortedNames.includes(currentVal)) select.value = currentVal;
}

window.renderCampaignHistory = function () {
  var rows = _allCampaignHistoryData || [];
  var campaignFilter = document.getElementById('history-campaign-filter')?.value;
  var dateFilter = document.getElementById('history-date-filter')?.value; // YYYY-MM-DD
  
  if (campaignFilter) {
    rows = rows.filter(function(r) { return r.campaign_name === campaignFilter; });
  }
  if (dateFilter) {
    rows = rows.filter(function(r) {
      if (!r.created_at) return false;
      var d = _parseDbDate(r.created_at);
      var month = '' + (d.getMonth() + 1);
      var day = '' + d.getDate();
      if (month.length < 2) month = '0' + month;
      if (day.length < 2) day = '0' + day;
      return (d.getFullYear() + '-' + month + '-' + day) === dateFilter;
    });
  }

  var tbody = document.getElementById('campaign-tbody');
  if (!tbody) return;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:32px;color:#999;">No campaigns found.</td></tr>';
    return;
  }

  // Group rows by campaign_name
  var grouped = {};
  rows.forEach(function (row) {
    var name = row.campaign_name || 'Unnamed Campaign';
    if (!grouped[name]) {
      grouped[name] = { count: 0, firstDate: row.created_at };
    }
    grouped[name].count++;
    if (row.created_at < grouped[name].firstDate) grouped[name].firstDate = row.created_at;
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
    // Include 'to' and 'from' fields for the email preview modal
    var data = await supabaseRest('campaignsdata?campaign_name=eq.' + encoded + '&select=email_subject,email_body,created_at,"to","from"&order=created_at.desc');
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
    var safeTo = escapeHtml(row['to'] || '—');
    var safeFrom = escapeHtml(row['from'] || '—');
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
            '<div class="mod-to">' + safeTo + '</div>' +
            '<div class="mod-from">' + safeFrom + '</div>' +
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
  var toEl = content.querySelector('.mod-to');
  var to = toEl ? toEl.innerHTML : '—';
  var fromEl = content.querySelector('.mod-from');
  var from = fromEl ? fromEl.innerHTML : '—';

  document.getElementById('preview-modal-subject').innerHTML = subject;
  document.getElementById('preview-modal-body').innerHTML = body;
  document.getElementById('preview-modal-date').innerHTML = date;
  document.getElementById('preview-modal-to').innerHTML = to;
  var fromSpan = document.getElementById('preview-modal-from');
  if (fromSpan) fromSpan.innerHTML = from;

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

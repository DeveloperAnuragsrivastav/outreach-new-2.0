/* ============================================================
   CAMPAIGNBUDDY — CAMPAIGN HISTORY + DETAIL
   Uses Vercel Serverless Functions (/api/*) to fetch data
   Browser NEVER calls supabase.co directly
   Polls every 8 seconds for near-real-time updates
   ============================================================ */

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

  // Only show loading on first load
  if (!tbody.dataset.loaded) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:32px;color:#999;">Loading campaigns...</td></tr>`;
  }

  try {
    const res = await fetch('/api/campaigns');
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    renderCampaignHistory(data || []);
    tbody.dataset.loaded = 'true';
    setLiveIndicator(true);
    flashLiveIndicator();
  } catch (err) {
    console.error('Error loading campaign history:', err);
    if (!tbody.dataset.loaded) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:32px;color:#e74c3c;">Failed to load campaigns. Please try again.</td></tr>`;
    }
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

// Poll every 8 seconds for near-real-time updates
function startHistoryPolling() {
  stopHistoryPolling();
  _pollInterval = setInterval(() => {
    loadCampaignHistory();
  }, 8000);
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

  if (!tbody.dataset.loaded) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:#999;">Loading emails...</td></tr>`;
  }
  if (countEl && !tbody.dataset.loaded) countEl.textContent = '…';

  try {
    const encoded = encodeURIComponent(campaignName);
    const res = await fetch(`/api/campaign-detail?name=${encoded}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    renderCampaignDetail(data || []);
    tbody.dataset.loaded = 'true';
  } catch (err) {
    console.error('Error loading campaign detail:', err);
    if (!tbody.dataset.loaded) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:#e74c3c;">Failed to load emails.</td></tr>`;
    }
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
    tr.className = 'table-row-anim email-preview-item';
    tr.style.display = 'block'; // Convert to blocks like .emails-list items
    tr.style.marginBottom = '16px';
    
    // Store data purely for modal use
    const safeSubject = escapeHtml(row.email_subject || '—');
    const safeBody = escapeHtml(row.email_body || '');
    const dateStr = formatDateTime(row.created_at);

    tr.innerHTML = `
      <td style="display: block; width: 100%; border: none; padding: 0;">
          <div class="email-preview-meta">
              <div class="ep-subject">${safeSubject}</div>
              <div class="ep-date">${dateStr}</div>
          </div>
          <div class="ep-preview">${escapeHtml(truncate(row.email_body, 140))}</div>
          <div style="margin-top: 12px;">
              <button class="btn-open-detail" onclick="openEmailPreviewModal(this)" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.8125rem; font-weight: 500; color: var(--charcoal); background: var(--warm-stone); border: 1px solid var(--charcoal-08); padding: 6px 12px; border-radius: 100px; cursor: pointer; transition: background 0.2s;">
                  <i data-lucide="eye" width="14" height="14"></i> Preview Email
              </button>
              <template class="modal-data-template">
                  <div class="mod-subject">${safeSubject}</div>
                  <div class="mod-body">${safeBody}</div>
                  <div class="mod-date">${dateStr}</div>
              </template>
          </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (window.lucide) window.lucide.createIcons();
}

// ── Email Preview Modal Logic ──────────────────────────────────
window.openEmailPreviewModal = function(btn) {
    const tpl = btn.nextElementSibling;
    if (!tpl) return;
    const content = tpl.content || tpl; // Fallback just in case
    const subject = content.querySelector('.mod-subject').innerHTML;
    const body = content.querySelector('.mod-body').innerHTML;
    const date = content.querySelector('.mod-date').innerHTML;

    document.getElementById('preview-modal-subject').innerHTML = subject;
    document.getElementById('preview-modal-body').innerHTML = body;
    document.getElementById('preview-modal-date').innerHTML = date;

    document.getElementById('email-preview-modal').classList.remove('hidden');
};

window.closeEmailPreviewModal = function() {
    document.getElementById('email-preview-modal').classList.add('hidden');
};

window.closeEmailPreviewOnBackdrop = function(e) {
    if (e.target === document.getElementById('email-preview-modal')) {
        closeEmailPreviewModal();
    }
};

function startDetailPolling(campaignName) {
  stopDetailPolling();
  _detailPollInterval = setInterval(() => {
    loadCampaignDetail(campaignName);
  }, 8000);
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

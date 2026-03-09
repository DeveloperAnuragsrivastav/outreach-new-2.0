/* ============================================================
   CAMPAIGNBUDDY — CAMPAIGN LIST PAGE
   Shows all campaigns from DB with Edit, Delete, Re-run
   ============================================================ */

let _listPollInterval = null;

// ── Load Campaign List ────────────────────────────────────────
async function loadCampaignList() {
  const tbody = document.getElementById('campaign-list-tbody');
  if (!tbody) return;

  if (!tbody.dataset.loaded) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:#999;">Loading campaigns...</td></tr>`;
  }

  try {
    const res = await fetch('/api/campaign-list');
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    renderCampaignList(data || []);
    tbody.dataset.loaded = 'true';
  } catch (err) {
    console.error('Error loading campaign list:', err);
    if (!tbody.dataset.loaded) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:#e74c3c;">Failed to load campaigns.</td></tr>`;
    }
  }
}

// ── Render Campaign List Table ────────────────────────────────
function renderCampaignList(campaigns) {
  const tbody = document.getElementById('campaign-list-tbody');
  if (!tbody) return;

  if (!campaigns || campaigns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:#999;">No campaigns found. Create one from "New Campaign".</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  campaigns.forEach(c => {
    const tr = document.createElement('tr');
    tr.className = 'table-row-anim';
    tr.dataset.id = c.id;
    tr.innerHTML = `
      <td class="campaign-name-cell">
        <span class="campaign-name">${escapeHtml(c.campaign_name || '—')}</span>
        <span class="campaign-date">${formatDate(c.created_at)}</span>
      </td>
      <td style="font-size:13px;color:#555;">${escapeHtml(c.goal || '—')}</td>
      <td style="font-size:13px;">
        <span style="color:#333;">${escapeHtml(c.sender_name || '—')}</span>
        <br><span style="color:#888;font-size:12px;">${escapeHtml(c.sender_email || '')}</span>
      </td>
      <td style="font-weight:600;">${c.prospects ? c.prospects.toLocaleString() : '—'}</td>
      <td style="font-size:13px;color:#666;">${formatDate(c.launched_at)}</td>
      <td class="actions-cell-list">
        <div class="campaign-actions-row">
          <button class="action-btn action-btn-edit" title="Edit" onclick="openEditCampaign(${c.id})">
            <i data-lucide="pencil" width="14" height="14"></i>
          </button>
          <button class="action-btn action-btn-rerun" title="Re-run" onclick="rerunCampaign(${c.id}, '${escapeHtml(c.campaign_name || '').replace(/'/g, "\\'")}')">
            <i data-lucide="refresh-cw" width="14" height="14"></i>
          </button>
          <button class="action-btn action-btn-delete" title="Delete" onclick="openDeleteCampaign(${c.id}, '${escapeHtml(c.campaign_name || '').replace(/'/g, "\\'")}')">
            <i data-lucide="trash-2" width="14" height="14"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (window.lucide) window.lucide.createIcons();
}

// ── Polling ───────────────────────────────────────────────────
function startListPolling() {
  stopListPolling();
  _listPollInterval = setInterval(() => loadCampaignList(), 8000);
}

function stopListPolling() {
  if (_listPollInterval) {
    clearInterval(_listPollInterval);
    _listPollInterval = null;
  }
}

// ── Edit Campaign ─────────────────────────────────────────────
let _campaignCache = [];

async function openEditCampaign(id) {
  // Fetch fresh data
  try {
    const res = await fetch('/api/campaign-list');
    if (res.ok) _campaignCache = await res.json();
  } catch (e) { /* use cached */ }

  const campaign = _campaignCache.find(c => c.id === id);
  if (!campaign) {
    showToast('Campaign not found.', 'error');
    return;
  }

  document.getElementById('edit-campaign-id').value = id;
  document.getElementById('edit-campaign-name').value = campaign.campaign_name || '';
  document.getElementById('edit-campaign-goal').value = campaign.goal || '';
  document.getElementById('edit-job-titles').value = campaign.job_titles || '';
  document.getElementById('edit-industries').value = campaign.industries || '';
  document.getElementById('edit-company-size').value = campaign.company_size || '';
  document.getElementById('edit-geography').value = campaign.geography || '';
  document.getElementById('edit-sender-name').value = campaign.sender_name || '';
  document.getElementById('edit-sender-role').value = campaign.sender_role || '';
  document.getElementById('edit-sender-email').value = campaign.sender_email || '';
  document.getElementById('edit-prospects').value = campaign.prospects || '';

  document.getElementById('edit-campaign-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-campaign-modal').classList.add('hidden');
}

function closeEditModalOnBackdrop(e) {
  if (e.target === document.getElementById('edit-campaign-modal')) closeEditModal();
}

async function saveEditCampaign() {
  const id = document.getElementById('edit-campaign-id').value;
  if (!id) return;

  const payload = {
    campaign_name: document.getElementById('edit-campaign-name').value.trim(),
    goal: document.getElementById('edit-campaign-goal').value,
    job_titles: document.getElementById('edit-job-titles').value.trim(),
    industries: document.getElementById('edit-industries').value.trim(),
    company_size: document.getElementById('edit-company-size').value,
    geography: document.getElementById('edit-geography').value.trim(),
    sender_name: document.getElementById('edit-sender-name').value.trim(),
    sender_role: document.getElementById('edit-sender-role').value.trim(),
    sender_email: document.getElementById('edit-sender-email').value.trim(),
    prospects: parseInt(document.getElementById('edit-prospects').value) || 250,
  };

  if (!payload.campaign_name) {
    showToast('Campaign name is required.', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/campaign-update?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    closeEditModal();
    showToast('Campaign updated successfully!', 'success');
    await loadCampaignList();
  } catch (err) {
    console.error('Error updating campaign:', err);
    showToast('Failed to update campaign. ' + err.message, 'error');
  }
}

// ── Delete Campaign ───────────────────────────────────────────
function openDeleteCampaign(id, name) {
  document.getElementById('delete-campaign-id').value = id;
  document.getElementById('delete-campaign-msg').textContent = `Are you sure you want to delete "${name}"? This action cannot be undone.`;
  document.getElementById('delete-campaign-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('delete-campaign-modal').classList.add('hidden');
}

function closeDeleteModalOnBackdrop(e) {
  if (e.target === document.getElementById('delete-campaign-modal')) closeDeleteModal();
}

async function confirmDeleteCampaign() {
  const id = document.getElementById('delete-campaign-id').value;
  if (!id) return;

  try {
    const res = await fetch(`/api/campaign-delete?id=${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    closeDeleteModal();
    showToast('Campaign deleted.', 'success');
    await loadCampaignList();
  } catch (err) {
    console.error('Error deleting campaign:', err);
    showToast('Failed to delete campaign. ' + err.message, 'error');
  }
}

// ── Re-run Campaign ───────────────────────────────────────────
async function rerunCampaign(id, name) {
  if (!confirm(`Re-run campaign "${name}"? This will re-launch it with the same settings.`)) return;

  showToast(`Re-running "${name}"...`, 'info');

  try {
    const res = await fetch(`/api/campaign-rerun?id=${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    showToast(`Campaign "${name}" re-launched successfully!`, 'success');
    await loadCampaignList();
  } catch (err) {
    console.error('Error re-running campaign:', err);
    showToast('Failed to re-run campaign. ' + err.message, 'error');
  }
}

// ── Hook into navigation ──────────────────────────────────────
(function () {
  const _prevNavigateTo = window.navigateTo;
  window.navigateTo = function (page) {
    if (page !== 'campaign-list') {
      stopListPolling();
    }
    _prevNavigateTo(page);
    if (page === 'campaign-list') {
      loadCampaignList();
      startListPolling();
    }
  };
})();

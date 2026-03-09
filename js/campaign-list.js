/* ============================================================
   CAMPAIGNBUDDY — CAMPAIGN LIST PAGE (Universal)
   Direct Supabase REST API calls for CRUD — no server needed
   ============================================================ */

var _listPollInterval = null;
var _campaignCache = [];

// ── Load Campaign List ───────────────────────────────────────
async function loadCampaignList() {
  var tbody = document.getElementById('campaign-list-tbody');
  if (!tbody) return;

  if (!tbody.dataset.loaded) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#999;">Loading campaigns...</td></tr>';
  }

  try {
    var data = await supabaseRest(
      'campaigns?select=id,campaign_name,goal,sender_name,sender_email,sender_role,job_titles,industries,company_size,geography,prospects,launched_at,created_at,product_name,value_proposition,competitor_displacement,social_proof,cta_link&order=created_at.desc'
    );
    _campaignCache = data || [];
    renderCampaignList(_campaignCache);
    tbody.dataset.loaded = 'true';
  } catch (err) {
    console.error('Error loading campaign list:', err);
    if (!tbody.dataset.loaded) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#e74c3c;">Failed to load campaigns.</td></tr>';
    }
  }
}

// ── Render Campaign List Table ───────────────────────────────
function renderCampaignList(campaigns) {
  var tbody = document.getElementById('campaign-list-tbody');
  if (!tbody) return;

  if (!campaigns || campaigns.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:#999;">No campaigns found. Create one from "New Campaign".</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  campaigns.forEach(function (c) {
    var tr = document.createElement('tr');
    tr.className = 'table-row-anim';
    tr.dataset.id = c.id;
    tr.innerHTML =
      '<td class="campaign-name-cell">' +
        '<span class="campaign-name">' + escapeHtml(c.campaign_name || '—') + '</span>' +
        '<span class="campaign-date">' + formatDate(c.created_at) + '</span>' +
      '</td>' +
      '<td style="font-size:13px;color:#555;">' + escapeHtml(c.goal || '—') + '</td>' +
      '<td style="font-size:13px;">' +
        '<span style="color:#333;">' + escapeHtml(c.sender_name || '—') + '</span>' +
        '<br><span style="color:#888;font-size:12px;">' + escapeHtml(c.sender_email || '') + '</span>' +
      '</td>' +
      '<td style="font-weight:600;">' + (c.prospects ? c.prospects.toLocaleString() : '—') + '</td>' +
      '<td style="font-size:13px;color:#666;">' + formatDate(c.launched_at) + '</td>' +
      '<td class="actions-cell-list">' +
        '<div class="campaign-actions-row">' +
          '<button class="action-btn action-btn-edit" title="Edit" onclick="openEditCampaign(' + c.id + ')">' +
            '<i data-lucide="pencil" width="14" height="14"></i>' +
          '</button>' +
          '<button class="action-btn action-btn-rerun" title="Re-run" onclick="rerunCampaign(' + c.id + ', \'' + escapeHtml(c.campaign_name || '').replace(/'/g, "\\'") + '\')">' +
            '<i data-lucide="refresh-cw" width="14" height="14"></i>' +
          '</button>' +
          '<button class="action-btn action-btn-delete" title="Delete" onclick="openDeleteCampaign(' + c.id + ', \'' + escapeHtml(c.campaign_name || '').replace(/'/g, "\\'") + '\')">' +
            '<i data-lucide="trash-2" width="14" height="14"></i>' +
          '</button>' +
        '</div>' +
      '</td>';
    tbody.appendChild(tr);
  });

  if (window.lucide) window.lucide.createIcons();
}

// ── Polling ──────────────────────────────────────────────────
function startListPolling() {
  stopListPolling();
  _listPollInterval = setInterval(function () { loadCampaignList(); }, 8000);
}

function stopListPolling() {
  if (_listPollInterval) { clearInterval(_listPollInterval); _listPollInterval = null; }
}

// ── Edit Campaign ────────────────────────────────────────────
async function openEditCampaign(id) {
  // Refresh cache
  try {
    var data = await supabaseRest(
      'campaigns?select=*&order=created_at.desc'
    );
    if (data) _campaignCache = data;
  } catch (e) { /* use cached */ }

  var campaign = _campaignCache.find(function (c) { return c.id === id; });
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
  var id = document.getElementById('edit-campaign-id').value;
  if (!id) return;

  var payload = {
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
    await supabaseRest('campaigns?id=eq.' + id, {
      method: 'PATCH',
      body: payload,
      extraHeaders: { 'Prefer': 'return=representation' },
    });

    closeEditModal();
    showToast('Campaign updated successfully!', 'success');
    await loadCampaignList();
  } catch (err) {
    console.error('Error updating campaign:', err);
    showToast('Failed to update campaign. ' + err.message, 'error');
  }
}

// ── Delete Campaign ──────────────────────────────────────────
function openDeleteCampaign(id, name) {
  document.getElementById('delete-campaign-id').value = id;
  document.getElementById('delete-campaign-msg').textContent = 'Are you sure you want to delete "' + name + '"? This action cannot be undone.';
  document.getElementById('delete-campaign-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('delete-campaign-modal').classList.add('hidden');
}

function closeDeleteModalOnBackdrop(e) {
  if (e.target === document.getElementById('delete-campaign-modal')) closeDeleteModal();
}

async function confirmDeleteCampaign() {
  var id = document.getElementById('delete-campaign-id').value;
  if (!id) return;

  try {
    await supabaseRest('campaigns?id=eq.' + id, {
      method: 'DELETE',
    });

    closeDeleteModal();
    showToast('Campaign deleted.', 'success');
    await loadCampaignList();
  } catch (err) {
    console.error('Error deleting campaign:', err);
    showToast('Failed to delete campaign. ' + err.message, 'error');
  }
}

// ── Re-run Campaign ──────────────────────────────────────────
async function rerunCampaign(id, name) {
  if (!confirm('Re-run campaign "' + name + '"? This will re-launch it with the same settings.')) return;

  showToast('Re-running "' + name + '"...', 'info');

  try {
    // Fetch campaign data
    var data = await supabaseRest('campaigns?id=eq.' + id + '&select=*');
    if (!data || data.length === 0) throw new Error('Campaign not found');

    var campaign = data[0];

    // Send to n8n webhook (same as original launch)
    var webhookUrl = 'https://n8n-1-yvtq.onrender.com/webhook/outreach';
    var webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_name: campaign.campaign_name,
        goal: campaign.goal,
        job_titles: campaign.job_titles,
        industries: campaign.industries,
        company_size: campaign.company_size,
        geography: campaign.geography,
        sender_name: campaign.sender_name,
        sender_role: campaign.sender_role,
        sender_email: campaign.sender_email,
        prospects: campaign.prospects,
        product_name: campaign.product_name,
        value_proposition: campaign.value_proposition,
        competitor_displacement: campaign.competitor_displacement,
        social_proof: campaign.social_proof,
        cta_link: campaign.cta_link,
      }),
    });

    if (!webhookRes.ok) throw new Error('Webhook returned ' + webhookRes.status);

    // Update launched_at
    await supabaseRest('campaigns?id=eq.' + id, {
      method: 'PATCH',
      body: { launched_at: new Date().toISOString() },
      extraHeaders: { 'Prefer': 'return=representation' },
    });

    showToast('Campaign "' + name + '" re-launched successfully!', 'success');
    await loadCampaignList();
  } catch (err) {
    console.error('Error re-running campaign:', err);
    showToast('Failed to re-run campaign. ' + err.message, 'error');
  }
}

// ── Hook into navigation ─────────────────────────────────────
(function () {
  var _prevNavigateTo = window.navigateTo;
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

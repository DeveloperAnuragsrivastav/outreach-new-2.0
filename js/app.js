/* ============================================================
   CAMPAIGNBUDDY — APP ROUTER & INTERACTIONS
   ============================================================ */

// ── Init & State ───────────────────────────────────────────────
let sidebarCollapsed = false;
let sendgridApiKey = null;

// ── Welcome Gate (API + Sender Auth) ───────────────────────────
function showApiInput(btn) {
  document.getElementById('gate-api-btns').style.display = 'none';
  document.getElementById('gate-api-input-area').style.display = 'block';
  setTimeout(() => document.getElementById('sg-api-key-input').focus(), 50);
}

function submitApiKey() {
  const input = document.getElementById('sg-api-key-input');
  const errorEl = document.getElementById('sg-gate-error');
  const key = input.value.trim();

  if (!key.startsWith('SG.')) {
    errorEl.style.display = 'block';
    input.style.borderColor = 'var(--danger)';
    return;
  }

  // Valid key -> save it and move to step 2 (Verification)
  errorEl.style.display = 'none';
  input.style.borderColor = '';
  sendgridApiKey = key;

  document.getElementById('gate-step-1').classList.remove('active');
  document.getElementById('gate-step-2').classList.add('active');
  initIcons();
}

function finishWelcomeGate() {
  // Hide the entire gate, reveal campaign form
  document.getElementById('welcome-gate').style.display = 'none';
  document.getElementById('new-campaign-header').style.display = '';
  document.getElementById('wizard-layout').style.display = '';
  
  // Auto-fill and lock Sender Name
  const senderNameInput = document.getElementById('sender-name');
  if (senderNameInput && window.verifiedSenderName) {
    senderNameInput.value = window.verifiedSenderName;
    senderNameInput.readOnly = true;
    senderNameInput.style.backgroundColor = '#f1f5f9';
    senderNameInput.style.color = '#64748b';
    senderNameInput.style.cursor = 'not-allowed';
    senderNameInput.style.boxShadow = 'none';
    senderNameInput.style.borderColor = '#e2e8f0';
  }

  // Auto-fill and lock Sender Email
  const senderEmailInput = document.getElementById('sender-email');
  if (senderEmailInput && window.verifiedSenderEmail) {
    senderEmailInput.value = window.verifiedSenderEmail;
    senderEmailInput.readOnly = true;
    senderEmailInput.style.backgroundColor = '#f1f5f9';
    senderEmailInput.style.color = '#64748b';
    senderEmailInput.style.cursor = 'not-allowed';
    senderEmailInput.style.boxShadow = 'none';
    senderEmailInput.style.borderColor = '#e2e8f0';
  }
  
  initIcons();
  initScrollReveal();
}

async function submitSenderEmail() {
  const input = document.getElementById('sender-verified-email');
  const errorEl = document.getElementById('sender-email-error');
  const email = input ? input.value.trim() : '';
  const submitBtn = document.querySelector('#gate-step-2 .btn-gate-primary');

  // Simple email validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (errorEl) { errorEl.textContent = 'Please enter a valid email address.'; errorEl.style.display = 'block'; }
    if (input) input.style.borderColor = 'var(--danger)';
    return;
  }

  if (errorEl) errorEl.style.display = 'none';
  if (input) input.style.borderColor = '';

  // Extract nicely formatted name from email (e.g. john.doe@ -> John Doe)
  const namePart = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ');
  const senderName = namePart.replace(/\b\w/g, c => c.toUpperCase()).trim();

  // Store globally for later use in webhook payload
  window.verifiedSenderEmail = email;
  window.verifiedSenderName = senderName;

  // Show loading state
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Verifying...'; }

  try {
    const res = await fetch('https://n8n.gignaati.com/webhook/api-and-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sendgrid_api_key: sendgridApiKey, 
        sender_email: email,
        sender_name: window.verifiedSenderName
      })
    });

    const data = await res.json();

    if (res.status !== 200) {
      // Show exact message from webhook, do NOT proceed
      const msg = data && (data.message || data.error || JSON.stringify(data));
      if (errorEl) { errorEl.textContent = msg || ''; errorEl.style.display = 'block'; }
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Yes, it\'s verified — Continue <i data-lucide="arrow-right" width="18" height="18"></i>'; initIcons(); }
      return;
    }

    // Only reaches here if 200 → proceed to campaign form
    finishWelcomeGate();

  } catch (err) {
    if (typeof showFallbackError === 'function') {
      showFallbackError('Connection Error', 'We couldn\'t verify your Sender Email right now. Please check your connection and try again.');
    }
    if (errorEl) { errorEl.style.display = 'none'; }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Yes, it\'s verified — Continue <i data-lucide="arrow-right" width="18" height="18"></i>'; initIcons(); }
  }
}

// ── Wizard Step Reveal ─────────────────────────────────────────
function revealNextStep(currentStep) {
  const currentEl = document.querySelector('[data-wizard-step="' + currentStep + '"]');
  if (currentEl) {
    let hasError = false;
    const inputs = currentEl.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]):not([type="file"]), textarea, select');
    const source = document.querySelector('input[name="audience-source"]:checked')?.value || 'existing_lead';
    
    inputs.forEach(el => {
      // Check if visible and not readonly/disabled
      if (el.offsetParent !== null && !el.readOnly && !el.disabled) {
        // Exempt "Any size" explicitly since it's a valid empty value for the select
        if (el.id === 'icp-size' && el.value === '') return;
        
        if (!el.value.trim()) {
           el.style.borderColor = '#EF4444'; // Red border
           hasError = true;
           // Remove red border when user starts typing/selecting
           el.addEventListener('input', function() { this.style.borderColor = ''; }, { once: true });
           if (el.tagName === 'SELECT') {
             el.addEventListener('change', function() { this.style.borderColor = ''; }, { once: true });
           }
        }
      }
    });

    if (hasError) {
      if (typeof showToast === 'function') {
        showToast('Please fill out all highlighted fields', 'error');
      }
      return; // Stop form from advancing
    }

    // Hide the Next button that was clicked
    const btn = currentEl.querySelector('.wizard-next-btn');
    if (btn) btn.style.display = 'none';
  }

  const nextStep = currentStep + 1;
  const nextEl = document.querySelector('[data-wizard-step="' + nextStep + '"]');
  if (nextEl && !nextEl.classList.contains('step-visible')) {
    nextEl.classList.add('step-visible');
    initIcons();
    setTimeout(() => {
      nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);

    // Auto-reveal Launch button when Campaign Scale (step 4) is shown
    if (nextStep === 4) {
      const launchEl = document.querySelector('[data-wizard-step="5"]');
      if (launchEl) {
        setTimeout(() => {
          launchEl.classList.add('step-visible');
          initIcons();
        }, 300);
      }
    }
  }
}

function revealAllSteps() {
  document.querySelectorAll('[data-wizard-step]').forEach(el => {
    el.classList.add('step-visible');
  });
  initIcons();
}

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  // Proceed to default 'new-campaign'
  navigateTo('new-campaign');
}

// ── Shared functions ────────────────────────────────────────────────
function startLoading() {
  const bar = document.getElementById('page-loading-bar');
  bar.style.width = '0';
  bar.style.opacity = '1';
  bar.classList.remove('done');
  bar.classList.add('loading');
}
function finishLoading() {
  const bar = document.getElementById('page-loading-bar');
  bar.style.width = '100%';
  setTimeout(() => { bar.classList.add('done'); }, 200);
  setTimeout(() => { bar.classList.remove('loading', 'done'); bar.style.width = '0'; }, 600);
}

// ── Page navigation ────────────────────────────────────────────
function navigateTo(page) {
  startLoading();

  // Always show app shell (Login page removed)
  document.getElementById('app-shell').classList.remove('hidden');
  document.getElementById('app-shell').style.display = 'flex';



  // Switch inner page
  const innerPages = document.querySelectorAll('.inner-page');
  innerPages.forEach(p => p.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
  }

  // Update sidebar active state
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === page) item.classList.add('active');
  });

  currentPage = page;

  // Page-specific init
  setTimeout(() => {
    finishLoading();
    if (page === 'dashboard') initDashboard();
    if (page === 'campaign-report') initReport();
    if (page === 'new-campaign') { resetCampaignForm(); initSlider(); }
    if (page === 'analytics') initAnalyticsPage();
    initScrollReveal();
    initIcons();
  }, 50);

}

// ── Campaign Form Reset ───────────────────────────────────────
function resetCampaignForm() {
  // Clear all text inputs and textareas
  var textFields = [
    'campaign-name', 'new-goal', 'new-product-name', 'new-value-proposition',
    'new-cta-link', 'icp-title', 'icp-industry', 'icp-geo',
    'new-industries', 'new-job-titles', 'new-competitor-displacement',
    'sender-name', 'sender-role', 'sender-email', 'new-social-proof',
    'new-lead-list-name'
  ];
  textFields.forEach(function(id) {
    var el = document.getElementById(id);
    if (el && !el.readOnly) el.value = '';
  });

  // Reset selects to first option
  var selectFields = ['icp-size'];
  selectFields.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.selectedIndex = 0;
  });

  // Reset audience source — disable 'Use Existing Lead' until email is verified
  var defaultRadio = document.getElementById('existing-lead-radio');
  if (defaultRadio) {
    defaultRadio.disabled = true;
    defaultRadio.style.cursor = 'not-allowed';
    defaultRadio.style.opacity = '0.45';
  }
  var existingLabel = document.getElementById('existing-lead-label');
  if (existingLabel) {
    existingLabel.style.opacity = '0.45';
    existingLabel.style.cursor = 'not-allowed';
  }
  // Hide the lead dropdown
  var leadDropSection = document.getElementById('existing-lead-dropdown-section');
  if (leadDropSection) leadDropSection.style.display = 'none';
  var leadSelect = document.getElementById('existing-lead-select');
  if (leadSelect) leadSelect.innerHTML = '<option value="">-- Select a lead list --</option>';
  // Default to 'custom' radio since existing_lead is disabled
  var customRadio = document.querySelector('input[name="audience-source"][value="custom"]');
  if (customRadio) {
    customRadio.checked = true;
    toggleAudienceSource('new');
  }

  // Reset file input and previews
  if (typeof resetLeadFile === 'function') {
    resetLeadFile('new');
  } else {
    var fileInput = document.getElementById('new-lead-file');
    if (fileInput) fileInput.value = '';
  }

  // Reset slider to 250
  var slider = document.getElementById('campaign-scale');
  if (slider) { slider.value = 250; updateSlider(slider); }

  // Reset wizard — hide all steps except step 1
  document.querySelectorAll('[data-wizard-step]').forEach(function(el) {
    var step = parseInt(el.dataset.wizardStep);
    if (step === 1) {
      el.classList.add('step-visible');
      var btn = el.querySelector('.wizard-next-btn');
      if (btn) btn.style.display = '';
    } else {
      el.classList.remove('step-visible');
    }
  });

  // Hide error alert
  var errorAlert = document.getElementById('form-error-alert');
  if (errorAlert) errorAlert.style.display = 'none';

  // Trigger preview update
  if (typeof updatePreview === 'function') updatePreview();
}

// ── Login handler ──────────────────────────────────────────────
function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const btnText = btn.querySelector('.btn-text');
  btnText.textContent = 'Signing in…';
  btn.disabled = true;
  btn.style.opacity = '0.8';
  setTimeout(() => {
    btn.disabled = false;
    btn.style.opacity = '';
    btnText.textContent = 'Sign In';
    navigateTo('dashboard');
    showToast('Welcome back, Alex!', 'success');
  }, 900);
}

// ── Sidebar collapse ───────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebarCollapsed = !sidebarCollapsed;
  sidebar.classList.toggle('collapsed', sidebarCollapsed);
}

// ── Actions menu ───────────────────────────────────────────────
function closeAllDropdowns() {
  document.querySelectorAll('.actions-dropdown.open').forEach(d => {
    d.classList.remove('open');
    // Reset fixed positioning
    d.style.position = '';
    d.style.top = '';
    d.style.left = '';
    d.style.right = '';
    d.style.width = '';
  });
}

function openActionsMenu(btn) {
  const dropdown = btn.nextElementSibling;
  const isOpen = dropdown.classList.contains('open');

  // Close all other dropdowns first
  closeAllDropdowns();

  if (isOpen) return;

  // Use fixed positioning so it escapes overflow:auto on .table-wrap
  const btnRect = btn.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.top = (btnRect.bottom + 4) + 'px';
  dropdown.style.right = (window.innerWidth - btnRect.right) + 'px';
  dropdown.style.left = 'auto';
  dropdown.classList.add('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.actions-cell')) {
    closeAllDropdowns();
  }
});

// Reposition on scroll so the dropdown follows its button
document.addEventListener('scroll', () => closeAllDropdowns(), { capture: true, passive: true });

// ── Report tabs ────────────────────────────────────────────────
function switchReportTab(tabId, btn) {
  document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.report-tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + tabId).classList.add('active');
}

// ── Settings tabs ──────────────────────────────────────────────
let settingsInitDone = false;
function initSettingsTabs() {
  if (settingsInitDone) return;
  settingsInitDone = true;
  moveSettingsIndicator(document.querySelector('.settings-tab-btn.active'));
}
function switchSettingsTab(tabId, btn) {
  document.querySelectorAll('.settings-tab-btn').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('settings-tab-' + tabId).classList.add('active');
  moveSettingsIndicator(btn);
}
function moveSettingsIndicator(btn) {
  const indicator = document.getElementById('settings-tab-indicator');
  if (!btn || !indicator) return;
  indicator.style.left = btn.offsetLeft + 'px';
  indicator.style.width = btn.offsetWidth + 'px';
}

// ── Shared payload store for preview flow ──────────────────────
let _previewPayload = null;

// ── launchPreview — Step 1: send to preview webhook ────────────
async function launchPreview() {
  const name = document.getElementById('campaign-name').value.trim();
  if (!name) {
    showToast('Please enter a campaign name first.', 'info');
    document.getElementById('campaign-name').focus();
    return;
  }

  const audienceSource = document.querySelector('input[name="audience-source"]:checked')?.value || 'existing_lead';
  const leadListName = document.getElementById('new-lead-list-name')?.value.trim();
  const fileInput = document.getElementById('new-lead-file');

  if (audienceSource === 'custom') {
    if (!leadListName) { showToast('Please enter a Lead List Name.', 'error'); return; }
    if (!fileInput.files || fileInput.files.length === 0) { showToast('Please upload a leads file.', 'error'); return; }
  }

  // Build payload (same as before)
  const payload = {
    campaign_name: name,
    goal: document.getElementById('new-goal')?.value || '',
    job_titles: audienceSource === 'existing_lead' ? (document.getElementById('new-job-titles')?.value || '') : '',
    industries: audienceSource === 'existing_lead' ? (document.getElementById('new-industries')?.value || '') : '',
    company_size: audienceSource === 'existing_lead' ? (document.getElementById('icp-size')?.value || '') : '',
    geography: audienceSource === 'existing_lead' ? (document.getElementById('icp-geo')?.value || '') : '',
    sender_name: document.getElementById('sender-name')?.value || '',
    sender_role: document.getElementById('sender-role')?.value || '',
    sender_email: document.getElementById('sender-email')?.value || '',
    prospects: document.getElementById('campaign-scale')?.value || '250',
    launched_at: new Date().toISOString(),
    product_name: document.getElementById('new-product-name')?.value || '',
    value_proposition: document.getElementById('new-value-proposition')?.value || '',
    competitor_displacement: document.getElementById('new-competitor-displacement')?.value || '',
    social_proof: document.getElementById('new-social-proof')?.value || '',
    cta_link: document.getElementById('new-cta-link')?.value || '',
    lead_source: audienceSource,
    lead_list_name: audienceSource === 'custom' ? leadListName : '',
    sendgrid_api_key: sendgridApiKey || ''
  };

  if (audienceSource === 'custom') {
    const file = fileInput.files[0];
    payload.lead_file_name = file.name;
    try {
      showToast('Parsing leads file...', 'info');
      payload.rows = await parseLeadFile(file);
    } catch (err) {
      showToast('Failed to parse file: ' + err.message, 'error');
      return;
    }
  }

  _previewPayload = payload; // store for epLaunch

  // Show loader
  const loaderEl = document.getElementById('preview-loader');
  const loaderMsg = document.getElementById('preview-loader-msg');
  loaderEl.style.display = 'flex';

  const cycleMessages = [
    'Crafting your outreach strategy...',
    'Scraping LinkedIn profile...',
    'Analyzing lead behavior...',
    'Writing personalized email...',
    'Generating HTML template...',
    'Almost there, hang tight...'
  ];
  let msgIdx = 0;
  loaderMsg.textContent = cycleMessages[0];
  const msgInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % cycleMessages.length;
    loaderMsg.textContent = cycleMessages[msgIdx];
  }, 3000);

  try {
    const res = await fetch('https://n8n.gignaati.com/webhook/email-prview-exisiting-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    clearInterval(msgInterval);
    loaderEl.style.display = 'none';

    // Render preview
    document.getElementById('ep-from').textContent = data.from || '—';
    document.getElementById('ep-to').textContent = data.to || '—';
    document.getElementById('ep-subject').textContent = data.subject || '—';
    document.getElementById('ep-body').srcdoc = data.body || '';
    document.getElementById('ep-success').style.display = 'none';
    document.getElementById('send-loader').style.display = 'none';
    document.getElementById('ep-actions').style.display = 'flex';
    document.getElementById('ep-launch-btn').disabled = false;

    // Hide campaign form, show preview
    document.getElementById('wizard-layout').style.display = 'none';
    document.getElementById('new-campaign-header').style.display = 'none';
    const previewSection = document.getElementById('email-preview-section');
    previewSection.style.display = 'block';
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    clearInterval(msgInterval);
    loaderEl.style.display = 'none';
    if (typeof showFallbackError === 'function') {
      showFallbackError('Preview Failed', 'We couldn\'t generate the email preview. Please check your connection or try again.');
    } else {
      showToast('Preview failed: ' + err.message, 'error');
    }
  }
}

// ── epEdit — Go back to form without clearing it ───────────────
function epEdit() {
  document.getElementById('email-preview-section').style.display = 'none';
  document.getElementById('new-campaign-header').style.display = '';
  document.getElementById('wizard-layout').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── epLaunch — Final campaign submission ───────────────────────
async function epLaunch() {
  if (!_previewPayload) { showToast('No payload found. Please regenerate preview.', 'error'); return; }

  const launchBtn = document.getElementById('ep-launch-btn');
  const sendLoader = document.getElementById('send-loader');
  const actionsDiv = document.getElementById('ep-actions');

  launchBtn.disabled = true;
  actionsDiv.style.display = 'none';
  sendLoader.style.display = 'block';

  const sendMessages = ['Sending your campaign...', 'Emails going out...', 'Campaign launched!'];
  let sIdx = 0;
  sendLoader.textContent = sendMessages[0];
  const sendInterval = setInterval(() => {
    sIdx = Math.min(sIdx + 1, sendMessages.length - 1);
    sendLoader.textContent = sendMessages[sIdx];
  }, 2500);

  const webhookTarget = (_previewPayload.lead_source === 'custom') ? WEBHOOK_URL_CUSTOM : WEBHOOK_URL;

  try {
    const res = await fetch(webhookTarget, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_previewPayload)
    });
    if (!res.ok) throw new Error('API returned ' + res.status);
  } catch (err) {
    console.warn('Campaign webhook error:', err);
    clearInterval(sendInterval);
    sendLoader.style.display = 'none';
    if (typeof showFallbackError === 'function') {
       showFallbackError('Launch Failed', 'We hit a snag while launching your campaign. Please try again or contact support.');
    }
    launchBtn.disabled = false;
    actionsDiv.style.display = 'flex';
    return;
  }

  clearInterval(sendInterval);
  sendLoader.style.display = 'none';
  document.getElementById('ep-success').style.display = 'block';

  // Reset form after a moment
  setTimeout(() => {
    document.getElementById('email-preview-section').style.display = 'none';
    document.getElementById('new-campaign-header').style.display = '';
    document.getElementById('wizard-layout').style.display = '';
    _previewPayload = null;
    if (typeof resetCampaignForm === 'function') resetCampaignForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Campaign launched successfully!', 'success');
  }, 3000);
}

// ── Confirmation modal (kept for internal reference) ───────────
const WEBHOOK_URL = 'https://n8n.gignaati.com/webhook/Outreach_Campaign';
const WEBHOOK_URL_CUSTOM = 'https://n8n.gignaati.com/webhook/Custom-Leads';

async function openConfirmModal() {
  const name = document.getElementById('campaign-name').value.trim();
  if (!name) {
    showToast('Please enter a campaign name first.', 'info');
    document.getElementById('campaign-name').focus();
    return;
  }

  // Get audience source
  const audienceSource = document.querySelector('input[name="audience-source"]:checked')?.value || 'existing_lead';
  const leadListName = document.getElementById('new-lead-list-name')?.value.trim();
  const fileInput = document.getElementById('new-lead-file');

  if (audienceSource === 'custom') {
    if (!leadListName) {
      showToast('Please enter a Lead List Name.', 'error');
      return;
    }
    if (!fileInput.files || fileInput.files.length === 0) {
      showToast('Please upload a leads file.', 'error');
      return;
    }
  }

  // Collect all form data
  const payload = {
    campaign_name: name,
    goal: document.getElementById('new-goal')?.value || '',
    job_titles: audienceSource === 'existing_lead' ? (document.getElementById('new-job-titles')?.value || '') : '',
    industries: audienceSource === 'existing_lead' ? (document.getElementById('new-industries')?.value || '') : '',
    company_size: audienceSource === 'existing_lead' ? (document.getElementById('icp-size')?.value || '') : '',
    geography: audienceSource === 'existing_lead' ? (document.getElementById('icp-geo')?.value || '') : '',
    sender_name: document.getElementById('sender-name')?.value || '',
    sender_role: document.getElementById('sender-role')?.value || '',
    sender_email: document.getElementById('sender-email')?.value || '',
    prospects: document.getElementById('campaign-scale')?.value || '250',
    launched_at: new Date().toISOString(),
    product_name: document.getElementById('new-product-name')?.value || '',
    value_proposition: document.getElementById('new-value-proposition')?.value || '',
    competitor_displacement: document.getElementById('new-competitor-displacement')?.value || '',
    social_proof: document.getElementById('new-social-proof')?.value || '',
    cta_link: document.getElementById('new-cta-link')?.value || '',
    lead_source: audienceSource,
    lead_name: audienceSource === 'existing_lead' ? (document.getElementById('existing-lead-select')?.value || '') : '',
    lead_list_name: audienceSource === 'custom' ? leadListName : '',
    sendgrid_api_key: sendgridApiKey || ''
  };

  if (audienceSource === 'custom') {
    const file = fileInput.files[0];
    payload.lead_file_name = file.name;
    try {
      showToast('Parsing leads file...', 'info');
      payload.rows = await parseLeadFile(file);
    } catch (err) {
      showToast('Failed to parse file: ' + err.message, 'error');
      return;
    }
  }

  // Hide previous error if any
  const errorAlert = document.getElementById('form-error-alert');
  const errorMessage = document.getElementById('form-error-message');
  if (errorAlert) errorAlert.style.display = 'none';

  // Show loading state on button briefly just for feel
  const launchBtn = document.getElementById('launch-btn');
  const launchText = launchBtn?.querySelector('.launch-text');
  if (launchText) launchText.textContent = 'Launching…';
  if (launchBtn) launchBtn.disabled = true;

  // --- Add entry to history table as 'Running' (Pending Webhook) ---
  const tbody = document.getElementById('campaign-tbody');
  const tempId = 'campaign-' + Date.now();
  if (tbody) {
    const tr = document.createElement('tr');
    tr.className = 'table-row-anim';
    tr.id = tempId;
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    tr.innerHTML = `
      <td class="campaign-name-cell">
          <span class="campaign-name">${name}</span>
          <span class="campaign-date">Started ${today}</span>
      </td>
      <td><span class="status-badge active" style="opacity: 0.7; animation: pulse 1s infinite alternate;">Running...</span></td>
      <td id="${tempId}-sent">...</td>
    `;
    tbody.insertBefore(tr, tbody.firstChild);

    if (!document.getElementById('pulse-style')) {
      const style = document.createElement('style');
      style.id = 'pulse-style';
      style.innerHTML = '@keyframes pulse { 0% { opacity: 0.5; } 100% { opacity: 1; } }';
      document.head.appendChild(style);
    }
  }
  // ----------------------------------------------------------------

  // Instantly show the modal & restore button state
  if (launchText) launchText.textContent = 'Launch Campaign';
  if (launchBtn) launchBtn.disabled = false;

  const modal = document.getElementById('confirm-modal');
  modal.classList.remove('hidden');
  const path = modal.querySelector('.check-path');
  if (path) {
    path.style.animation = 'none';
    void path.offsetWidth;
    path.style.animation = '';
  }

  // Route to the correct webhook based on audience source
  const webhookTarget = (audienceSource === 'custom') ? WEBHOOK_URL_CUSTOM : WEBHOOK_URL;

  // Fire webhook in background (Fire-and-forget style)
  fetch(webhookTarget, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(response => {
      if (!response.ok) throw new Error('API returned status ' + response.status);
      return response.json().catch(() => ({}));
    })
    .then(data => {
      // If explicit error from n8n 
      if (data && data.success === false) {
        if (errorAlert && errorMessage) {
          errorMessage.textContent = data.message || 'An error occurred while launching.';
          errorAlert.style.display = 'flex';
        }
        // Remove the temp row if it failed
        const row = document.getElementById(tempId);
        if (row) row.remove();
      } else {
        // Success case
        const row = document.getElementById(tempId);
        if (row) {
          const badge = row.querySelector('.status-badge');
          if (badge) {
            badge.innerHTML = 'Running';
            badge.style.opacity = '1';
            badge.style.animation = 'none';
          }
          const sentCell = document.getElementById(tempId + '-sent');
          if (sentCell) sentCell.textContent = '0';
        }
      }
    })
    .catch(err => {
      console.warn('Webhook delivery failed:', err);
      const confirmModal = document.getElementById('confirm-modal');
      if (confirmModal) confirmModal.classList.add('hidden');
      if (typeof showFallbackError === 'function') {
         showFallbackError('Launch Failed', 'We couldn\'t connect to our servers to launch your campaign. Please try again or contact support.');
      }
      const row = document.getElementById(tempId);
      if (row) row.remove();
    });
}
function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
  if (typeof resetCampaignForm === 'function') resetCampaignForm();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Campaign launched successfully!', 'success');
}
function closeConfirmModalAndGo() {
  document.getElementById('confirm-modal').classList.add('hidden');
  if (typeof resetCampaignForm === 'function') resetCampaignForm();
  navigateTo('campaign-report');
}
function closeModalOnBackdrop(e) {
  if (e.target === document.getElementById('confirm-modal')) closeConfirmModal();
}

// ── Autofill ───────────────────────────────────────────────────
function autofillCampaignForm() {
  const fields = {
    'campaign-name': 'Q2 Enterprise SaaS Outbound',
    'campaign-goal': 'Book discovery calls',
    'new-goal': 'Book 15 discovery calls for our new enterprise AI sales tool by the end of Q2.',
    'new-product-name': 'CampaignBuddy Enterprise',
    'new-value-proposition': 'We help modern sales teams automate outreach and boost reply rates by up to 3x using AI.',
    'new-job-titles': 'VP of Sales, Chief Revenue Officer, Head of Growth',
    'new-industries': 'B2B SaaS, FinTech, Healthcare IT',
    'icp-size': '51–200 employees',
    'icp-geo': 'United States, Canada',
    'new-competitor-displacement': 'Legacy outreach tools like Outreach.io or SalesLoft that take too much time to manage.',
    'sender-name': 'Alex Morgan',
    'sender-role': 'Head of Partnerships',
    'sender-email': 'alex@nexora.com',
    'new-social-proof': 'We recently helped Acme Corp double their meeting booked rate in just 14 days.',
    'new-cta-link': 'https://nexora.com/demo',
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el || el.readOnly) return;
    el.value = val;
    // trigger native input/change events so any listeners fire
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // Set slider to 500 prospects
  const slider = document.getElementById('campaign-scale');
  if (slider) { slider.value = 500; updateSlider(slider); }
  updatePreview();
  revealAllSteps();
  showToast('Form filled with sample data!', 'success');
}

// ── Live preview updater ───────────────────────────────────────
function updatePreview() {
  // Live preview removed
}

// ── Slider ─────────────────────────────────────────────────────
function initSlider() {
  const slider = document.getElementById('campaign-scale');
  if (!slider) return; // exit gracefully if not on the campaign page
  updateSlider(slider);
}
function updateSlider(slider) {
  if (!slider) return; // guard: called externally with a null element
  const min = +slider.min, max = +slider.max, val = +slider.value;
  const pct = ((val - min) / (max - min)) * 100;
  const tooltip = document.getElementById('slider-tooltip');
  if (!tooltip) return; // guard: tooltip element missing
  tooltip.textContent = val.toLocaleString();
  // Position tooltip (roughly accounting for thumb)
  const thumbOffset = 10 - (pct * 0.2);
  tooltip.style.left = `calc(${pct}% + ${thumbOffset}px)`;
}

// ── File & Audience Helpers ────────────────────────────────────────
// ── Leads Owner Check ─────────────────────────────────────────
window.checkLeadsOwner = async function () {
  const email = (document.getElementById('sender-email')?.value || '').trim();
  const dropdownSection = document.getElementById('existing-lead-dropdown-section');
  const select = document.getElementById('existing-lead-select');
  if (!email || !dropdownSection || !select) return;

  try {
    const SUPABASE_URL = 'https://mjffvxkothiczayhkjcx.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZmZ2eGtvdGhpY3pheWhramN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTEyNjEsImV4cCI6MjA4NzY2NzI2MX0.-g4vsENBmQnCk-M7c-k_lax-tTV2BOJEZxtFEDYxgEc';
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/leads_owners?owner_email=eq.${encodeURIComponent(email)}&select=lead_name`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
    );
    if (!res.ok) return;
    const rows = await res.json();

    const existingRadio = document.getElementById('existing-lead-radio');
    const existingLabel = document.getElementById('existing-lead-label');

    if (rows && rows.length > 0) {
      // Populate dropdown with found lead names
      select.innerHTML = '<option value="">-- Select a lead list --</option>';
      rows.forEach(function(row) {
        const opt = document.createElement('option');
        opt.value = row.lead_name;
        opt.textContent = row.lead_name;
        select.appendChild(opt);
      });
      dropdownSection.style.display = 'block';

      // Enable the 'Use Existing Lead' radio and restore its appearance
      if (existingRadio) {
        existingRadio.disabled = false;
        existingRadio.style.cursor = '';
        existingRadio.style.opacity = '';
      }
      if (existingLabel) {
        existingLabel.style.opacity = '';
        existingLabel.style.cursor = '';
      }

      // Auto-select 'Use Existing Lead' radio if not already selected
      if (existingRadio && !existingRadio.checked) {
        existingRadio.checked = true;
        toggleAudienceSource('new');
      }
    } else {
      // No leads found — hide dropdown and disable radio
      dropdownSection.style.display = 'none';
      select.innerHTML = '<option value="">-- Select a lead list --</option>';

      if (existingRadio) {
        existingRadio.disabled = true;
        existingRadio.style.cursor = 'not-allowed';
        existingRadio.style.opacity = '0.45';
        // If it was selected, switch to custom
        if (existingRadio.checked) {
          const customRadio = document.querySelector('input[name="audience-source"][value="custom"]');
          if (customRadio) { customRadio.checked = true; toggleAudienceSource('new'); }
        }
      }
      if (existingLabel) {
        existingLabel.style.opacity = '0.45';
        existingLabel.style.cursor = 'not-allowed';
      }
    }
  } catch (err) {
    console.warn('[checkLeadsOwner] error:', err);
  }
};

function toggleAudienceSource(context = 'new') {
  const source = document.querySelector(`input[name="${context === 'new' ? '' : 'edit-'}audience-source"]:checked`).value;
  const aiSection = document.getElementById(`${context === 'new' ? '' : 'edit-'}ai-audience-section`);
  const customSection = document.getElementById(`${context === 'new' ? 'custom' : 'edit-custom'}-leads-section`);
  const scrapSection = document.getElementById(`${context === 'new' ? 'scrap' : 'edit-scrap'}-leads-section`);
  const nextBtn = document.getElementById('new-wizard-next-btn-2');

  if (source === 'existing_lead') {
    if (aiSection) aiSection.style.display = 'block';
    if (customSection) customSection.style.display = 'none';
    if (scrapSection) scrapSection.style.display = 'none';
    if (context === 'new' && nextBtn) nextBtn.style.display = 'inline-flex';
  } else if (source === 'custom') {
    if (aiSection) aiSection.style.display = 'none';
    if (customSection) customSection.style.display = 'block';
    if (scrapSection) scrapSection.style.display = 'none';
    
    if (context === 'new' && nextBtn) {
      const previewContainer = document.getElementById('new-lead-file-preview-container');
      const hasValidFile = previewContainer && previewContainer.style.display === 'block';
      nextBtn.style.display = hasValidFile ? 'inline-flex' : 'none';
    }
  } else if (source === 'scrap') {
    if (aiSection) aiSection.style.display = 'none';
    if (customSection) customSection.style.display = 'none';
    if (scrapSection) scrapSection.style.display = 'block';
    if (context === 'new' && nextBtn) nextBtn.style.display = 'none';
  }
}

window.downloadSampleCsv = function(e) {
  e.preventDefault();
  const headers = "Company Name,Name,Title,Email,Seniority,Departments,Personal LinkedIn URL\n";
  const row1 = "Acme Inc,John Doe,VP of Sales,john@acme.com,Director,Sales,https://linkedin.com/in/johndoe\n";
  const row2 = "Corp Ltd,Jane Smith,Head of Marketing,jane@corp.com,Manager,Marketing,https://linkedin.com/in/janesmith\n";
  const csvContent = headers + row1 + row2;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sample_leads.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

window.resetLeadFile = function(context) {
  const fileInput = document.getElementById(`${context}-lead-file`);
  const errorDiv = document.getElementById(`${context}-lead-file-error`);
  const previewContainer = document.getElementById(`${context}-lead-file-preview-container`);
  const thead = document.getElementById(`${context}-lead-file-thead`);
  const tbody = document.getElementById(`${context}-lead-file-tbody`);
  const nextBtn = document.getElementById('new-wizard-next-btn-2');
  
  if (fileInput) fileInput.value = '';
  if (errorDiv) { errorDiv.style.display = 'none'; errorDiv.textContent = ''; }
  if (previewContainer) previewContainer.style.display = 'none';
  if (thead) { thead.innerHTML = ''; }
  if (tbody) { tbody.innerHTML = ''; }
  
  if (context === 'new' && nextBtn) {
    nextBtn.style.display = 'none';
  }
};

window.handleLeadFileUpload = function(evt, context) {
  const file = evt.target.files[0];
  const errorDiv = document.getElementById(`${context}-lead-file-error`);
  const previewContainer = document.getElementById(`${context}-lead-file-preview-container`);
  const nextBtn = document.getElementById('new-wizard-next-btn-2');
  
  if (errorDiv) { errorDiv.style.display = 'none'; errorDiv.textContent = ''; }
  if (previewContainer) { previewContainer.style.display = 'none'; }
  if (context === 'new' && nextBtn) nextBtn.style.display = 'none';
  
  if (!file) return;
  
  // Auto-fill Lead List Name field
  const leadListNameInput = document.getElementById(`${context}-lead-list-name`);
  if (leadListNameInput) {
    let baseName = file.name;
    const lastDotIndex = baseName.lastIndexOf('.');
    if (lastDotIndex > 0) baseName = baseName.substring(0, lastDotIndex);
    leadListNameInput.value = baseName;
    leadListNameInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  parseLeadFile(file).then(rows => {
    if (!rows || rows.length === 0) {
      throw new Error("File appears to be empty.");
    }
    const headers = Object.keys(rows[0]);
    const emailCol = headers.find(h => {
      const norm = (h || '').toLowerCase().trim();
      return norm === 'email' || norm === 'email address';
    });
    
    if (!emailCol) {
      throw new Error("We couldn't find an Email column. Please check your file or download the sample.");
    }

    // Validate columns match sample CSV headers
    const expectedCols = ['company name','name','title','email','seniority','departments','personal linkedin url'];
    const uploadedCols = headers.map(h => (h || '').toLowerCase().trim());
    const missingCols = expectedCols.filter(c => !uploadedCols.includes(c));

    if (missingCols.length > 0) {
      throw new Error("Please match the format of the sample data. Missing: " + missingCols.join(', '));
    }
    
    const thead = document.getElementById(`${context}-lead-file-thead`);
    const tbody = document.getElementById(`${context}-lead-file-tbody`);
    
    const esc = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    
    if (thead && tbody) {
      thead.innerHTML = `<tr>${headers.map(h => `<th style="padding: 8px;">${esc(h)}</th>`).join('')}</tr>`;
      tbody.innerHTML = rows.slice(0, 3).map(row => 
        `<tr style="border-bottom: 1px solid var(--charcoal-08);">
          ${headers.map(h => `<td style="padding: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;" title="${esc(row[h])}">${esc(row[h])}</td>`).join('')}
        </tr>`
      ).join('');
      
      previewContainer.style.display = 'block';
    }
    
    if (context === 'new' && nextBtn) nextBtn.style.display = 'inline-flex';
    
  }).catch(err => {
    if (typeof showToast === 'function') {
      showToast(err.message, 'error');
    }
    if (errorDiv) {
      errorDiv.textContent = err.message;
      errorDiv.style.display = 'block';
      setTimeout(() => {
        if (errorDiv.textContent === err.message) {
          errorDiv.style.display = 'none';
        }
      }, 4000);
    }
    evt.target.value = '';
    if (previewContainer) previewContainer.style.display = 'none';
  });
};

document.addEventListener('DOMContentLoaded', () => {
    const newFileInput = document.getElementById('new-lead-file');
    if (newFileInput) newFileInput.addEventListener('change', (e) => window.handleLeadFileUpload(e, 'new'));
    
    const editFileInput = document.getElementById('edit-lead-file');
    if (editFileInput) editFileInput.addEventListener('change', (e) => window.handleLeadFileUpload(e, 'edit'));
});

function parseLeadFile(file) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();
    
    // Check if CSV/TSV
    if (ext === 'csv' || ext === 'tsv') {
      if (!window.Papa) return reject(new Error('PapaParse library not loaded'));
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
          resolve(results.data);
        },
        error: function(err) {
          reject(err);
        }
      });
    } 
    // Check if Excel
    else if (ext === 'xlsx' || ext === 'xls') {
      if (!window.XLSX) return reject(new Error('SheetJS library not loaded'));
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = function(err) {
        reject(err);
      };
      reader.readAsArrayBuffer(file);
    } 
    // Unsupported
    else {
      reject(new Error('Unsupported file extension: ' + ext));
    }
  });
}

// ── Toast notifications ────────────────────────────────────────
function showToast(message, type = 'success') {
  const icons = { success: '✓', info: 'ℹ', error: '✕' };
  const titles = { success: 'Success', info: 'Info', error: 'Error' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '✓'}</span>
    <div class="toast-body">
      <div class="toast-title">${titles[type]}</div>
      <div class="toast-message">${message}</div>
    </div>
    <div class="toast-progress" style="width:100%"></div>
  `;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

// ── Parallax ───────────────────────────────────────────────────
function initParallax() {
  const newCampHeader = document.querySelector('#page-new-campaign .parallax-bg');
  if (!newCampHeader) return;
  const handler = () => {
    if (currentPage !== 'new-campaign') return;
    const scrollY = document.querySelector('.main-content')?.scrollTop || window.scrollY;
    newCampHeader.style.transform = `translateY(${scrollY * 0.4}px)`;
  };
  const mainContent = document.getElementById('main-content');
  if (mainContent) mainContent.addEventListener('scroll', handler, { passive: true });
  window.addEventListener('scroll', handler, { passive: true });
}

// ── Scroll reveal (IntersectionObserver) ──────────────────────
function initScrollReveal() {
  const els = document.querySelectorAll('.scroll-reveal:not(.visible)');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 80);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
}

// ── Dashboard init ─────────────────────────────────────────────
function initDashboard() {
  // KPI counters start after cards animate in
  setTimeout(() => {
    document.querySelectorAll('.kpi-value[data-target]').forEach(el => {
      animateCounter(el);
    });
  }, 500);
}

function animateCounter(el) {
  const target = +el.dataset.target;
  const suffix = el.dataset.suffix || '';
  const duration = 1200;
  const start = performance.now();
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
    const current = Math.round(target * eased);
    el.textContent = current.toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ── Report init ────────────────────────────────────────────────
function initReport() {
  // Report page logic here if needed for history table
}

// ── Lucide icons init ──────────────────────────────────────────
function initIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

window.showFallbackError = function(title = 'Something went wrong', message = 'We\'re having trouble connecting to our servers. Please check your connection or try again.') {
  const modal = document.getElementById('global-error-modal');
  const titleEl = document.getElementById('global-error-title');
  const bodyEl = document.getElementById('global-error-body');
  
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.textContent = message;
  
  if (modal) {
    modal.classList.remove('hidden');
    initIcons();
  } else {
    showToast(message, 'error');
  }
};

window.closeGlobalErrorModal = function(e) {
  if (e && e.target.id !== 'global-error-modal' && !e.target.closest('.btn-primary')) {
      return; 
  }
  const modal = document.getElementById('global-error-modal');
  if (modal) modal.classList.add('hidden');
};
// ── Analytics (Campaign Selector + Webhook) ─────────────────────
var _analyticsCampaignsLoaded = false;
var _analyticsCampaignMap = {};  // { campaign_name: created_at }
var ANALYTICS_WEBHOOK_URL = 'https://n8n.gignaati.com/webhook/Analytics';

// Called every time the user navigates to the Analytics page
async function initAnalyticsPage() {
  if (!_analyticsCampaignsLoaded) {
    await loadAnalyticsCampaigns();
  }
}

// Fetch distinct campaign names from Supabase and populate the dropdown
async function loadAnalyticsCampaigns() {
  var select = document.getElementById('analytics-campaign-select');
  if (!select) return;

  select.innerHTML = '<option value="">Loading campaigns...</option>';
  select.disabled = true;

  try {
    var data = await supabaseRest('campaigns?select=campaign_name,created_at&order=created_at.desc');

    // Extract unique campaign names and store created_at (Supabase may return duplicates)
    var seen = {};
    var uniqueNames = [];
    _analyticsCampaignMap = {};
    if (Array.isArray(data)) {
      data.forEach(function (row) {
        var name = row.campaign_name;
        if (name && !seen[name]) {
          seen[name] = true;
          uniqueNames.push(name);
          _analyticsCampaignMap[name] = row.created_at || '';
        }
      });
    }

    // Populate dropdown
    select.innerHTML = '';
    if (uniqueNames.length === 0) {
      select.innerHTML = '<option value="">No campaigns found</option>';
      select.disabled = true;
      return;
    }

    uniqueNames.forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });

    select.disabled = false;
    _analyticsCampaignsLoaded = true;

    // Auto-trigger: select the first campaign and fetch its analytics
    select.selectedIndex = 0;
    fetchAnalyticsForCampaign(uniqueNames[0]);

  } catch (err) {
    select.innerHTML = '<option value="">Failed to load campaigns</option>';
    select.disabled = true;
    console.error('[analytics] loadAnalyticsCampaigns error:', err);
    if (typeof showFallbackError === 'function') {
      showFallbackError('System Warning', 'We had trouble loading your campaign history. Please refresh the page or try again in a few minutes.');
    }
  }
}

// Called when the user changes the dropdown selection
function onAnalyticsCampaignChange() {
  var select = document.getElementById('analytics-campaign-select');
  if (!select) return;
  var campaignName = select.value;
  if (campaignName) {
    fetchAnalyticsForCampaign(campaignName);
  }
}

// Send the selected campaign name to the webhook and display the response
async function fetchAnalyticsForCampaign(campaignName) {
  var errorBox = document.getElementById('analytics-error');
  var errorMsg = document.getElementById('analytics-error-message');
  var loading = document.getElementById('analytics-loading');
  var loadingName = document.getElementById('analytics-loading-name');
  var empty = document.getElementById('analytics-empty');
  var results = document.getElementById('analytics-results');
  var select = document.getElementById('analytics-campaign-select');

  // Reset UI
  errorBox.style.display = 'none';
  empty.style.display = 'none';
  results.style.display = 'none';
  if (loadingName) loadingName.textContent = campaignName;
  loading.style.display = 'block';
  if (select) select.disabled = true;

  try {
    var response = await fetch(ANALYTICS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ campaign_name: campaignName, created_at: _analyticsCampaignMap[campaignName] || '' })
    });

    if (!response.ok) {
      var errText = 'Server returned status ' + response.status;
      try {
        var errorData = await response.json();
        if (errorData.message) errText = errorData.message;
      } catch (e) { /* not json */ }
      throw new Error(errText);
    }

    var data = await response.json();

    // Aggregate stats — handle single object, array of objects, or nested stats
    var totalStats = {
      delivered: 0, opens: 0, clicks: 0, bounces: 0,
      spam_reports: 0, unsubscribes: 0, blocks: 0
    };

    if (Array.isArray(data)) {
      data.forEach(function (item) {
        if (item.stats && Array.isArray(item.stats)) {
          item.stats.forEach(function (stat) {
            if (stat.metrics) {
              totalStats.delivered += stat.metrics.delivered || 0;
              totalStats.opens += stat.metrics.opens || 0;
              totalStats.clicks += stat.metrics.clicks || 0;
              totalStats.bounces += stat.metrics.bounces || 0;
              totalStats.spam_reports += stat.metrics.spam_reports || 0;
              totalStats.unsubscribes += stat.metrics.unsubscribes || 0;
              totalStats.blocks += stat.metrics.blocks || 0;
            }
          });
        } else if (item.metrics) {
          totalStats.delivered += item.metrics.delivered || 0;
          totalStats.opens += item.metrics.opens || 0;
          totalStats.clicks += item.metrics.clicks || 0;
          totalStats.bounces += item.metrics.bounces || 0;
          totalStats.spam_reports += item.metrics.spam_reports || 0;
          totalStats.unsubscribes += item.metrics.unsubscribes || 0;
          totalStats.blocks += item.metrics.blocks || 0;
        } else {
          totalStats.delivered += item.delivered || 0;
          totalStats.opens += item.opens || 0;
          totalStats.clicks += item.clicks || 0;
          totalStats.bounces += item.bounces || 0;
          totalStats.spam_reports += item.spam_reports || 0;
          totalStats.unsubscribes += item.unsubscribes || 0;
          totalStats.blocks += item.blocks || 0;
        }
      });
    } else if (data && typeof data === 'object') {
      totalStats.delivered = data.delivered || 0;
      totalStats.opens = data.opens || 0;
      totalStats.clicks = data.clicks || 0;
      totalStats.bounces = data.bounces || 0;
      totalStats.spam_reports = data.spam_reports || 0;
      totalStats.unsubscribes = data.unsubscribes || 0;
      totalStats.blocks = data.blocks || 0;
    }

    // Assign to UI
    document.getElementById('stat-delivered').textContent = totalStats.delivered.toLocaleString();
    document.getElementById('stat-opens').textContent = totalStats.opens.toLocaleString();
    document.getElementById('stat-clicks').textContent = totalStats.clicks.toLocaleString();
    document.getElementById('stat-bounces').textContent = totalStats.bounces.toLocaleString();
    document.getElementById('stat-spam').textContent = totalStats.spam_reports.toLocaleString();
    document.getElementById('stat-unsubscribes').textContent = totalStats.unsubscribes.toLocaleString();
    document.getElementById('stat-blocks').textContent = totalStats.blocks.toLocaleString();

    loading.style.display = 'none';
    results.style.display = 'block';

  } catch (error) {
    loading.style.display = 'none';
    if (typeof showFallbackError === 'function') {
      showFallbackError('Analytics Error', 'We had trouble loading your analytics. ' + error.message);
    }
    errorBox.style.display = 'flex';
    errorMsg.textContent = error.message;
    empty.style.display = 'block';
  } finally {
    if (select) select.disabled = false;
  }
}

// ── Boot ───────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initIcons();
  initScrollReveal();
  initParallax();
});

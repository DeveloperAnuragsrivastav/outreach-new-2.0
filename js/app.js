/* ============================================================
   CAMPAIGNBUDDY — APP ROUTER & INTERACTIONS
   ============================================================ */

// ── Init & State ───────────────────────────────────────────────
let sidebarCollapsed = false;
let sendgridApiKey = null;

// ── SendGrid Gate ──────────────────────────────────────────────
function sgGateYes() {
  document.getElementById('sg-gate-btns').style.display = 'none';
  document.getElementById('sg-gate-input-area').style.display = 'block';
  setTimeout(() => document.getElementById('sg-api-key-input').focus(), 50);
}

function sgGateNo() {
  window.open('https://sendgrid.com', '_blank');
}

function sgGateSubmit() {
  const input = document.getElementById('sg-api-key-input');
  const errorEl = document.getElementById('sg-gate-error');
  const key = input.value.trim();

  if (!key.startsWith('SG.')) {
    errorEl.style.display = 'block';
    input.style.borderColor = 'var(--danger)';
    return;
  }

  // Valid key
  errorEl.style.display = 'none';
  input.style.borderColor = '';
  sendgridApiKey = key;

  // Hide gate, reveal campaign form
  document.getElementById('sendgrid-gate').style.display = 'none';
  document.getElementById('new-campaign-header').style.display = '';
  document.getElementById('wizard-layout').style.display = '';
  initIcons();
  initScrollReveal();
}

// ── Wizard Step Reveal ─────────────────────────────────────────
function revealNextStep(currentStep) {
  // Hide the Next button that was clicked
  const currentEl = document.querySelector('[data-wizard-step="' + currentStep + '"]');
  if (currentEl) {
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
    if (page === 'new-campaign') initSlider();
    if (page === 'analytics') initAnalyticsPage();
    initScrollReveal();
    initIcons();
  }, 50);

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

// ── Confirmation modal ─────────────────────────────────────────
const WEBHOOK_URL = 'https://n8n.gignaati.com/webhook/Outreach_Campaign';

async function openConfirmModal() {
  const name = document.getElementById('campaign-name').value.trim();
  if (!name) {
    showToast('Please enter a campaign name first.', 'info');
    document.getElementById('campaign-name').focus();
    return;
  }

  // Get audience source
  const audienceSource = document.querySelector('input[name="audience-source"]:checked')?.value || 'ai';
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
    goal: document.getElementById('new-goal')?.value || document.getElementById('campaign-goal')?.value || '',
    job_titles: audienceSource === 'ai' ? (document.getElementById('new-job-titles')?.value || document.getElementById('icp-title')?.value || '') : '',
    industries: audienceSource === 'ai' ? (document.getElementById('new-industries')?.value || document.getElementById('icp-industry')?.value || '') : '',
    company_size: audienceSource === 'ai' ? (document.getElementById('icp-size')?.value || '') : '',
    geography: audienceSource === 'ai' ? (document.getElementById('icp-geo')?.value || '') : '',
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
      payload.lead_file_base64 = await toBase64(file);
    } catch (err) {
      showToast('Failed to read file.', 'error');
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

  // Fire webhook in background (Fire-and-forget style)
  fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(response => response.json().catch(() => ({})))
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
      // Don't remove row on network error to avoid jarring UI, let poll correct it
    });
}
function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
  showToast('Campaign launched successfully!', 'success');
}
function closeConfirmModalAndGo() {
  document.getElementById('confirm-modal').classList.add('hidden');
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
    'icp-title': 'VP of Sales, Head of Growth, CRO',
    'new-job-titles': 'VP of Sales, Chief Revenue Officer, Head of Growth',
    'icp-industry': 'SaaS, FinTech, B2B Software',
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
    if (!el) return;
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
function toggleAudienceSource(context = 'new') {
  const source = document.querySelector(`input[name="${context === 'new' ? '' : 'edit-'}audience-source"]:checked`).value;
  const aiSection = document.getElementById(`${context === 'new' ? '' : 'edit-'}ai-audience-section`);
  const customSection = document.getElementById(`${context === 'new' ? 'custom' : 'edit-custom'}-leads-section`);
  const scrapSection = document.getElementById(`${context === 'new' ? 'scrap' : 'edit-scrap'}-leads-section`);

  if (source === 'ai') {
    if (aiSection) aiSection.style.display = 'block';
    if (customSection) customSection.style.display = 'none';
    if (scrapSection) scrapSection.style.display = 'none';
  } else if (source === 'custom') {
    if (aiSection) aiSection.style.display = 'none';
    if (customSection) customSection.style.display = 'block';
    if (scrapSection) scrapSection.style.display = 'none';
  } else if (source === 'scrap') {
    if (aiSection) aiSection.style.display = 'none';
    if (customSection) customSection.style.display = 'none';
    if (scrapSection) scrapSection.style.display = 'block';
  }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // FileReader results in "data:MIME_TYPE;base64,...". We only need the base64 part often.
      let encoded = reader.result.toString().replace(/^data:(.*,)?/, '');
      if ((encoded.length % 4) > 0) {
        encoded += '='.repeat(4 - (encoded.length % 4));
      }
      resolve(encoded);
    };
    reader.onerror = error => reject(error);
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
  if (window.lucide) window.lucide.createIcons();
}

// ── Analytics (Campaign Selector + Webhook) ─────────────────────
var _analyticsCampaignsLoaded = false;
var ANALYTICS_WEBHOOK_URL = 'https://n8n.gignaati.com/webhook/campaign-analytics';

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
    var data = await supabaseRest('campaigns?select=campaign_name&order=launched_at.desc');

    // Extract unique campaign names (Supabase may return duplicates)
    var seen = {};
    var uniqueNames = [];
    if (Array.isArray(data)) {
      data.forEach(function (row) {
        var name = row.campaign_name;
        if (name && !seen[name]) {
          seen[name] = true;
          uniqueNames.push(name);
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
      body: JSON.stringify({ campaign_name: campaignName })
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

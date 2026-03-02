/* ============================================================
   CAMPAIGNBUDDY — APP ROUTER & INTERACTIONS
   ============================================================ */

// ── Current state ─────────────────────────────────────────────
let currentPage = 'new-campaign';
let sidebarCollapsed = false;

// ── Loading bar ────────────────────────────────────────────────
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
const WEBHOOK_URL = 'https://n8n.gignaati.com/webhook-test/Outreach_Campaign';

async function openConfirmModal() {
  const name = document.getElementById('campaign-name').value.trim();
  if (!name) {
    showToast('Please enter a campaign name first.', 'info');
    document.getElementById('campaign-name').focus();
    return;
  }

  // Collect all form data
  const payload = {
    campaign_name: name,
    goal: document.getElementById('campaign-goal')?.value || '',
    job_titles: document.getElementById('icp-title')?.value || '',
    industries: document.getElementById('icp-industry')?.value || '',
    company_size: document.getElementById('icp-size')?.value || '',
    geography: document.getElementById('icp-geo')?.value || '',
    sender_name: document.getElementById('sender-name')?.value || '',
    sender_role: document.getElementById('sender-role')?.value || '',
    sender_email: document.getElementById('sender-email')?.value || '',
    prospects: document.getElementById('campaign-scale')?.value || '250',
    launched_at: new Date().toISOString(),
  };

  // Hide previous error if any
  const errorAlert = document.getElementById('form-error-alert');
  const errorMessage = document.getElementById('form-error-message');
  if (errorAlert) errorAlert.style.display = 'none';

  // Show loading state on button
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

  let successFlow = true;

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Attempt to parse JSON response
    try {
      const data = await response.json();
      if (data && data.success === false) {
        successFlow = false;
        if (errorAlert && errorMessage) {
          errorMessage.textContent = data.message || 'An error occurred while launching.';
          errorAlert.style.display = 'flex';
        }
      }
    } catch (e) {
      // Ignored if response is not JSON
    }
  } catch (err) {
    console.warn('Webhook delivery failed:', err);
    // Don't block UX — still show modal
  } finally {
    if (launchText) launchText.textContent = 'Launch Campaign';
    if (launchBtn) launchBtn.disabled = false;
  }

  // Update the table row based on result
  const row = document.getElementById(tempId);
  if (row) {
    if (successFlow) {
      const badge = row.querySelector('.status-badge');
      if (badge) {
        badge.innerHTML = 'Running';
        badge.style.opacity = '1';
        badge.style.animation = 'none';
      }
      const sentCell = document.getElementById(tempId + '-sent');
      if (sentCell) {
        sentCell.textContent = '0'; // Real DB numbers logic later
      }
    } else {
      row.remove();
    }
  }

  if (successFlow) {
    // Show success modal
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('hidden');
    const path = modal.querySelector('.check-path');
    if (path) {
      path.style.animation = 'none';
      void path.offsetWidth;
      path.style.animation = '';
    }
  }
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
    'icp-title': 'VP of Sales, Head of Growth, CRO',
    'icp-industry': 'SaaS, FinTech, B2B Software',
    'icp-size': '51–200 employees',
    'icp-geo': 'United States, Canada',
    'sender-name': 'Alex Morgan',
    'sender-role': 'Head of Partnerships',
    'sender-email': 'alex@nexora.com',
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
  showToast('Form filled with sample data!', 'success');
}

// ── Live preview updater ───────────────────────────────────────
function updatePreview() {
  // Live preview removed
}

// ── Slider ─────────────────────────────────────────────────────
function initSlider() {
  const slider = document.getElementById('campaign-scale');
  if (slider) updateSlider(slider);
}
function updateSlider(slider) {
  const min = +slider.min, max = +slider.max, val = +slider.value;
  const pct = ((val - min) / (max - min)) * 100;
  const tooltip = document.getElementById('slider-tooltip');
  tooltip.textContent = val.toLocaleString();
  // Position tooltip (roughly accounting for thumb)
  const thumbOffset = 10 - (pct * 0.2);
  tooltip.style.left = `calc(${pct}% + ${thumbOffset}px)`;
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

// ── Boot ───────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initIcons();
  initScrollReveal();
  initParallax();
});

/* ============================================================
   CAMPAIGNBUDDY — ANIMATIONS
   ============================================================ */

// Subtle entrance animations for nav items
function animateNavItems() {
    const items = document.querySelectorAll('.sidebar-nav-item');
    items.forEach((item, i) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-8px)';
        setTimeout(() => {
            item.style.transition = 'opacity 300ms ease, transform 300ms ease, background 120ms ease, color 120ms ease';
            item.style.opacity = '';
            item.style.transform = '';
        }, 100 + i * 60);
    });
}

// Called when dashboard enters
function initDashboardAnimations() {
    animateNavItems();
}

// Init on first load
document.addEventListener('DOMContentLoaded', () => {
    // The stagger animations on the login page are pure CSS
    // Nav items animate when the shell becomes visible
    const shellObs = new MutationObserver(() => {
        const shell = document.getElementById('app-shell');
        if (shell && !shell.classList.contains('hidden')) {
            animateNavItems();
        }
    });
    const shell = document.getElementById('app-shell');
    if (shell) shellObs.observe(shell, { attributes: true, attributeFilter: ['class'] });
});

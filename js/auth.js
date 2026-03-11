/* ============================================================
   CAMPAIGNBUDDY — SUPABASE AUTH
   Handles login, signup, session guard, and logout.
   Uses Supabase JS client loaded via CDN (window._supabase).
   ============================================================ */

(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────
  const SUPABASE_URL  = 'https://mjffvxkothiczayhkjcx.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZmZ2eGtvdGhpY3pheWhramN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTEyNjEsImV4cCI6MjA4NzY2NzI2MX0.-g4vsENBmQnCk-M7c-k_lax-tTV2BOJEZxtFEDYxgEc';

  // ── Wait for Supabase CDN to be ready ────────────────────────
  function waitForSupabase(cb) {
    if (window.supabase && window.supabase.createClient) {
      cb(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON));
    } else {
      setTimeout(function () { waitForSupabase(cb); }, 50);
    }
  }

  // ── Bootstrap ────────────────────────────────────────────────
  waitForSupabase(function (client) {
    // Expose client globally so logout button in sidebar can call it
    window._sbClient = client;

    // Determine which "view" is active on this load
    var loginView  = document.getElementById('page-auth');
    var appShell   = document.getElementById('app-shell');

    if (!loginView || !appShell) return; // safety

    // ── Session guard ─────────────────────────────────────────
    client.auth.getSession().then(function (result) {
      var session = result.data && result.data.session;
      if (session) {
        // User is logged in — show app, hide auth
        showApp(session.user);
      } else {
        // Not logged in — show login view
        showAuthPage('login');
      }
    });

    // Listen for auth state changes (e.g. after email confirmation redirect)
    client.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_IN' && session) {
        showApp(session.user);
      } else if (event === 'SIGNED_OUT') {
        showAuthPage('login');
      }
    });

    // ── Show / hide helpers ───────────────────────────────────
    function showApp(user) {
      loginView.style.display  = 'none';
      loginView.classList.remove('active');
      appShell.style.display   = 'flex';
      appShell.classList.add('active');

      // Populate user email in sidebar if element exists
      var emailEl = document.getElementById('sidebar-user-email');
      if (emailEl && user) emailEl.textContent = user.email || '';
    }

    function showAuthPage(tab) {
      appShell.style.display  = 'none';
      appShell.classList.remove('active');
      loginView.style.display = 'flex';
      loginView.classList.add('active');
      switchAuthTab(tab);
    }

    // ── Tab switcher (Login ↔ Signup) ─────────────────────────
    window.switchAuthTab = function (tab) {
      var loginPanel  = document.getElementById('auth-login-panel');
      var signupPanel = document.getElementById('auth-signup-panel');
      var tabLogin    = document.getElementById('auth-tab-login');
      var tabSignup   = document.getElementById('auth-tab-signup');

      if (!loginPanel || !signupPanel) return;

      clearAuthError('login');
      clearAuthError('signup');

      if (tab === 'login') {
        loginPanel.style.display  = 'block';
        signupPanel.style.display = 'none';
        if (tabLogin)  tabLogin.classList.add('active');
        if (tabSignup) tabSignup.classList.remove('active');
      } else {
        loginPanel.style.display  = 'none';
        signupPanel.style.display = 'block';
        if (tabLogin)  tabLogin.classList.remove('active');
        if (tabSignup) tabSignup.classList.add('active');
      }
    };

    // ── Login ─────────────────────────────────────────────────
    window.handleAuthLogin = async function (e) {
      e.preventDefault();
      var email    = document.getElementById('login-email').value.trim();
      var password = document.getElementById('login-password').value;
      var btn      = document.getElementById('login-submit-btn');

      if (!email || !password) {
        setAuthError('login', 'Please enter your email and password.');
        return;
      }

      setAuthLoading(btn, true, 'Signing in…');
      clearAuthError('login');

      var result = await client.auth.signInWithPassword({ email: email, password: password });

      if (result.error) {
        setAuthError('login', friendlyError(result.error.message));
        setAuthLoading(btn, false, 'Sign In');
      }
      // On success, onAuthStateChange fires → showApp()
    };

    // ── Signup ────────────────────────────────────────────────
    window.handleAuthSignup = async function (e) {
      e.preventDefault();
      var email    = document.getElementById('signup-email').value.trim();
      var password = document.getElementById('signup-password').value;
      var confirm  = document.getElementById('signup-confirm').value;
      var btn      = document.getElementById('signup-submit-btn');

      if (!email || !password || !confirm) {
        setAuthError('signup', 'Please fill in all fields.');
        return;
      }
      if (password.length < 6) {
        setAuthError('signup', 'Password must be at least 6 characters.');
        return;
      }
      if (password !== confirm) {
        setAuthError('signup', 'Passwords do not match.');
        return;
      }

      setAuthLoading(btn, true, 'Creating account…');
      clearAuthError('signup');

      var result = await client.auth.signUp({ email: email, password: password });

      setAuthLoading(btn, false, 'Create Account');

      if (result.error) {
        setAuthError('signup', friendlyError(result.error.message));
      } else {
        // Show success message — user needs to confirm email
        showSignupSuccess(email);
      }
    };

    // ── Logout ────────────────────────────────────────────────
    window.handleLogout = async function () {
      await client.auth.signOut();
      // onAuthStateChange fires → showAuthPage('login')
    };

    // ── Signup success state ──────────────────────────────────
    function showSignupSuccess(email) {
      var panel = document.getElementById('auth-signup-panel');
      if (!panel) return;
      panel.innerHTML =
        '<div class="auth-success-state">' +
          '<div class="auth-success-icon">' +
            '<svg width="40" height="40" viewBox="0 0 52 52" fill="none">' +
              '<circle cx="26" cy="26" r="25" stroke="#1a7a4a" stroke-width="2"/>' +
              '<path d="M14 26l8 8 16-16" stroke="#1a7a4a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>' +
          '</div>' +
          '<h3 class="auth-success-title">Check your inbox</h3>' +
          '<p class="auth-success-body">We sent a confirmation link to <strong>' + escapeHtmlAuth(email) + '</strong>. Click the link to activate your account, then come back to sign in.</p>' +
          '<button class="btn-auth-primary" style="margin-top:24px;" onclick="switchAuthTab(\'login\')">' +
            'Back to Sign In' +
          '</button>' +
        '</div>';
    }

    // ── UI helpers ────────────────────────────────────────────
    function setAuthError(form, msg) {
      var el = document.getElementById('auth-error-' + form);
      if (el) { el.textContent = msg; el.style.display = 'flex'; }
    }

    function clearAuthError(form) {
      var el = document.getElementById('auth-error-' + form);
      if (el) { el.textContent = ''; el.style.display = 'none'; }
    }

    function setAuthLoading(btn, loading, label) {
      if (!btn) return;
      btn.disabled = loading;
      btn.textContent = label;
      btn.style.opacity = loading ? '0.75' : '1';
    }

    function friendlyError(msg) {
      if (!msg) return 'An unexpected error occurred.';
      var m = msg.toLowerCase();
      if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('email not confirmed'))
        return 'Invalid email or password. Please try again.';
      if (m.includes('user already registered') || m.includes('already been registered'))
        return 'An account with this email already exists. Try signing in.';
      if (m.includes('rate limit'))
        return 'Too many attempts. Please wait a moment and try again.';
      if (m.includes('network') || m.includes('fetch'))
        return 'Network error. Please check your connection.';
      return msg;
    }

    function escapeHtmlAuth(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  });

})();

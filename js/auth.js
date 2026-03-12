/* ============================================================
   CAMPAIGNBUDDY — SUPABASE AUTH
   Handles session guard, login, signup, forgot password, logout.

   Flash-of-sidebar prevention strategy
   ─────────────────────────────────────
   index.html <head> contains:
     #app-shell { display: none !important; }
     #page-auth { display: none !important; }

   Both shells are invisible on first paint — no JS needed.
   This file runs the session check FIRST, then removes the
   !important guard from whichever shell should be visible.
   The other shell stays hidden via the head CSS.
   ============================================================ */

(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────
  var SUPABASE_URL  = 'https://mjffvxkothiczayhkjcx.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZmZ2eGtvdGhpY3pheWhramN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTEyNjEsImV4cCI6MjA4NzY2NzI2MX0.-g4vsENBmQnCk-M7c-k_lax-tTV2BOJEZxtFEDYxgEc';
  var RESET_REDIRECT_URL = 'https://outreach-new-2-0.vercel.app/reset-password.html';

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
    window._sbClient = client;

    var authPage = document.getElementById('page-auth');
    var appShell = document.getElementById('app-shell');

    if (!authPage || !appShell) return;

    // ── STEP 1: Session check — runs before anything is revealed ─
    // getSession() reads from localStorage synchronously in most
    // browsers, so this resolves almost instantly (< 1 ms).
    // Either way, both shells remain hidden until this resolves.
    client.auth.getSession().then(function (result) {
      var session = result.data && result.data.session;
      if (session) {
        revealApp(session.user);
      } else {
        revealAuthPage('login');
      }
    });

    // ── STEP 2: Keep listening for future auth state changes ──────
    // (covers: email confirmation redirect, Google OAuth callback,
    //  sign-out from another tab, session expiry, etc.)
    client.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_IN' && session) {
        revealApp(session.user);
      } else if (event === 'SIGNED_OUT') {
        revealAuthPage('login');
      }
    });

    // ── Reveal helpers ────────────────────────────────────────────
    // We use style.removeProperty('display') to lift the !important
    // rule set in the <head> guard, then set the explicit value we want.

    function revealApp(user) {
      // Hide auth page
      authPage.style.setProperty('display', 'none', 'important');
      authPage.classList.remove('active');

      // Show app shell
      appShell.style.removeProperty('display');   // lifts !important guard
      appShell.style.display = 'flex';
      appShell.classList.add('active');

      // Populate user email in sidebar
      var emailEl = document.getElementById('sidebar-user-email');
      if (emailEl && user) emailEl.textContent = user.email || '';
    }

    function revealAuthPage(tab) {
      // Hide app shell
      appShell.style.setProperty('display', 'none', 'important');
      appShell.classList.remove('active');

      // Show auth page
      authPage.style.removeProperty('display');   // lifts !important guard
      authPage.style.display = 'flex';
      authPage.classList.add('active');

      switchAuthTab(tab);
    }

    // ── Tab switcher (Login / Signup / Forgot) ────────────────────
    window.switchAuthTab = function (tab) {
      var loginPanel  = document.getElementById('auth-login-panel');
      var signupPanel = document.getElementById('auth-signup-panel');
      var forgotPanel = document.getElementById('auth-forgot-panel');
      var tabLogin    = document.getElementById('auth-tab-login');
      var tabSignup   = document.getElementById('auth-tab-signup');

      if (!loginPanel || !signupPanel) return;

      clearAuthError('login');
      clearAuthError('signup');
      clearAuthError('forgot');

      loginPanel.style.display  = 'none';
      signupPanel.style.display = 'none';
      if (forgotPanel) forgotPanel.style.display = 'none';

      if (tabLogin)  tabLogin.classList.remove('active');
      if (tabSignup) tabSignup.classList.remove('active');

      if (tab === 'login') {
        loginPanel.style.display = 'block';
        if (tabLogin) tabLogin.classList.add('active');
      } else if (tab === 'signup') {
        signupPanel.style.display = 'block';
        if (tabSignup) tabSignup.classList.add('active');
      } else if (tab === 'forgot') {
        resetForgotPanel();
        if (forgotPanel) forgotPanel.style.display = 'block';
      }
    };

    // ── Login ─────────────────────────────────────────────────────
    window.handleAuthLogin = async function (e) {
      e.preventDefault();
      var email    = document.getElementById('login-email').value.trim();
      var password = document.getElementById('login-password').value;
      var btn      = document.getElementById('login-submit-btn');

      if (!email || !password) {
        setAuthError('login', 'Please enter your email and password.');
        return;
      }

      setAuthLoading(btn, true, 'Signing in\u2026');
      clearAuthError('login');

      var result = await client.auth.signInWithPassword({ email: email, password: password });

      if (result.error) {
        setAuthError('login', friendlyError(result.error.message));
        setAuthLoading(btn, false, 'Sign In');
      }
      // On success, onAuthStateChange fires → revealApp()
    };

    // ── Signup ────────────────────────────────────────────────────
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

      setAuthLoading(btn, true, 'Creating account\u2026');
      clearAuthError('signup');

      var result = await client.auth.signUp({ email: email, password: password });

      setAuthLoading(btn, false, 'Create Account');

      if (result.error) {
        setAuthError('signup', friendlyError(result.error.message));
      } else {
        showSignupSuccess(email);
      }
    };

    // ── Forgot Password ───────────────────────────────────────────
    window.handleForgotPassword = async function (e) {
      e.preventDefault();
      var email = document.getElementById('forgot-email').value.trim();
      var btn   = document.getElementById('forgot-submit-btn');

      if (!email) {
        setAuthError('forgot', 'Please enter your email address.');
        return;
      }

      setAuthLoading(btn, true, 'Sending\u2026');
      clearAuthError('forgot');

      var result = await client.auth.resetPasswordForEmail(email, {
        redirectTo: RESET_REDIRECT_URL
      });

      setAuthLoading(btn, false, 'Send Reset Link');

      if (result.error) {
        setAuthError('forgot', friendlyError(result.error.message));
      } else {
        showForgotSuccess(email);
      }
    };

    // ── Google OAuth ──────────────────────────────────────────────
    window.handleGoogleLogin = async function () {
      var btn = document.querySelector('.btn-google');
      if (btn) { btn.disabled = true; btn.style.opacity = '0.75'; }

      var result = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://outreach-new-2-0.vercel.app' }
      });

      if (result.error) {
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        setAuthError('login', result.error.message || 'Google sign-in failed. Please try again.');
      }
      // On success, Supabase redirects the browser — no further action needed
    };

    // ── Logout ────────────────────────────────────────────────────
    window.handleLogout = async function () {
      await client.auth.signOut();
      // onAuthStateChange fires → revealAuthPage('login')
    };

    // ── Signup success state ──────────────────────────────────────
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

    // ── Forgot password success state ─────────────────────────────
    function showForgotSuccess(email) {
      var form    = document.getElementById('auth-forgot-form');
      var success = document.getElementById('auth-forgot-success');
      var msgEl   = document.getElementById('auth-forgot-success-msg');

      if (form)    form.style.display    = 'none';
      if (success) success.style.display = 'block';
      if (msgEl)   msgEl.innerHTML = 'We sent a reset link to <strong>' + escapeHtmlAuth(email) + '</strong>. Check your inbox and follow the instructions.';
    }

    function resetForgotPanel() {
      var form    = document.getElementById('auth-forgot-form');
      var success = document.getElementById('auth-forgot-success');
      var emailEl = document.getElementById('forgot-email');

      if (form)    form.style.display    = 'block';
      if (success) success.style.display = 'none';
      if (emailEl) emailEl.value = '';
      clearAuthError('forgot');
    }

    // ── UI helpers ────────────────────────────────────────────────
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
      btn.disabled      = loading;
      btn.textContent   = label;
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
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;');
    }
  });

})();

/* ============================================================
   CAMPAIGNBUDDY — AUTH HELPERS (logout + sidebar email)
   
   Session guard is handled by the inline <script> at the top of
   index.html body, which redirects to login.html if not authed.
   
   This file only handles:
   1. Displaying the logged-in user's email in the sidebar
   2. The logout button (signOut → redirect to login.html)
   ============================================================ */

(function () {
  'use strict';

  var SUPABASE_URL  = 'https://mjffvxkothiczayhkjcx.supabase.co';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qZmZ2eGtvdGhpY3pheWhramN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTEyNjEsImV4cCI6MjA4NzY2NzI2MX0.-g4vsENBmQnCk-M7c-k_lax-tTV2BOJEZxtFEDYxgEc';

  function waitForSupabase(cb) {
    if (window.supabase && window.supabase.createClient) {
      cb(window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON));
    } else {
      setTimeout(function () { waitForSupabase(cb); }, 50);
    }
  }

  waitForSupabase(function (client) {
    window._sbClient = client;

    // ── Show user email in sidebar ────────────────────────────
    client.auth.getSession().then(function (res) {
      if (res.data && res.data.session && res.data.session.user) {
        var emailEl = document.getElementById('sidebar-user-email');
        if (emailEl) {
          emailEl.textContent = res.data.session.user.email || '';
          emailEl.title       = res.data.session.user.email || '';
        }
      }
    }).catch(function () {
      // Silently ignore — session guard already handles redirect
    });

    // ── Logout ────────────────────────────────────────────────
    window.handleLogout = async function () {
      try {
        await client.auth.signOut();
      } catch (e) {
        // Ignore errors — we redirect regardless
      }
      window.location.href = 'login.html';
    };
  });

})();

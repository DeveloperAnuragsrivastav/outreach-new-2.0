// Temporary Authentication for /admin route
// Automatically generates a password every 10s logged to the console
// Forces a logout after 30 minutes

let currentAdminPassword = '';
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, 1, O, 0 for readability
  let pass = 'TempPass-';
  for (let i = 0; i < 5; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

function rotatePassword() {
  currentAdminPassword = generateRandomPassword();
  console.log(`%c[ADMIN AUTH] Current Valid Password (expires in 10s): %c${currentAdminPassword}`, 'color: #3498db; font-weight: bold;', 'color: #e74c3c; font-weight: bold; font-size: 14px;');
}

// Start rotation
rotatePassword();
setInterval(rotatePassword, 10000);

// Global Login Handler
window.handleAdminLogin = function(e) {
  e.preventDefault();
  const user = document.getElementById('admin-username').value.trim();
  const pass = document.getElementById('admin-password').value.trim();
  const errorEl = document.getElementById('admin-error');

  if (user === 'anurag' && pass === currentAdminPassword) {
    // Success
    errorEl.style.display = 'none';
    
    // Store session start time
    sessionStorage.setItem('admin_auth_timestamp', Date.now().toString());
    
    // Proceed to shell
    document.getElementById('page-admin-login').style.display = 'none';
    document.getElementById('app-shell').style.display = 'flex';
    document.getElementById('app-shell').classList.add('active');
    
    if (window.showToast) window.showToast('Admin access granted', 'success');
  } else {
    // Failure
    errorEl.textContent = 'Invalid username or expired password';
    errorEl.style.display = 'block';
  }
};

window.checkAdminAuth = function() {
  const timestamp = sessionStorage.getItem('admin_auth_timestamp');
  
  // If no timestamp, they aren't logged in
  if (!timestamp) return false;
  
  // If timestamp exists, check if 30 minutes have passed
  const elapsed = Date.now() - parseInt(timestamp, 10);
  if (elapsed > SESSION_DURATION_MS) {
    // Expired
    window.logoutAdmin();
    return false;
  }
  
  // Valid
  return true;
};

window.logoutAdmin = function(showMessage = true) {
  sessionStorage.removeItem('admin_auth_timestamp');
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('app-shell').classList.remove('active');
  document.getElementById('page-admin-login').style.display = 'flex';
  
  if (showMessage && window.showToast) {
    window.showToast('Session expired. Please log in again.', 'default');
  }
};

// Check expiry periodically if they are currently inside the shell
setInterval(() => {
  if (document.getElementById('app-shell').style.display !== 'none') {
    if (!window.checkAdminAuth()) {
      window.logoutAdmin();
    }
  }
}, 5000);

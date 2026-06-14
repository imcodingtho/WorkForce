/**
 * ui.js
 * Handles general UI configuration, navigation, utilities, confirm dialogs,
 * toast notifications, keyboard shortcuts, and page state loaders.
 */

// =========================================================================
// APP LIFECYCLE & NAVIGATION
// =========================================================================

/**
 * Initializes the app state, theme, loads user details, badges, and navigates to Dashboard.
 */
function startApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  document.getElementById('app-screen').classList.add('active');

  const savedTheme = getTheme();
  setTheme(savedTheme, true);

  updateUserUI();

  const settings = getSettings();
  if (settings.name) {
    document.getElementById('settings-name').value = settings.name;
  }

  // Force initial DOM translation
  translateDOM();

  updateLoanBadge();
  navigate('dashboard');
}

/**
 * Updates user avatar and name in the sidebar profile card.
 */
function updateUserUI() {
  if (!currentUser) return;
  const name = currentUser.name || currentUser.email.split('@')[0];
  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('sidebar-avatar').textContent = name.charAt(0).toUpperCase();
}

/**
 * Recalculates and updates the count of active loans in the sidebar badge.
 */
function updateLoanBadge() {
  const activeCount = employees.reduce((sum, e) => {
    return sum + (e.loans || []).filter(l => l.status === 'active').length;
  }, 0);
  const badge = document.getElementById('active-loans-badge');
  if (badge) {
    badge.textContent = activeCount;
    badge.style.display = activeCount > 0 ? '' : 'none';
  }
}

/**
 * Switches current page view, updates menu active styles, top bar header title, and invokes page renderers.
 * @param {string} page - The name of the page to show (e.g. 'dashboard', 'employees').
 */
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(i => {
    i.classList.toggle('active', i.dataset.page === page);
  });
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');

  // Page titles will be updated dynamically via translateDOM()
  translateDOM();

  const titles = {
    dashboard: 'Dashboard',
    employees: 'Employees',
    salary: 'Salary Tracker',
    loans: 'Loans & Advances',
    notes: 'Notes',
    settings: 'Settings'
  };
  document.getElementById('topbar-title').textContent = titles[page] || 'WorkForce';

  if (page === 'dashboard') renderDashboard();
  else if (page === 'employees') renderEmployees();
  else if (page === 'salary') renderSalary();
  else if (page === 'loans') renderLoans();
  else if (page === 'notes') renderNotes();
  else if (page === 'settings') renderSettings();

  closeSidebar();
}

/**
 * Opens mobile navigation sidebar drawer.
 */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('active');
}

/**
 * Closes mobile navigation sidebar drawer.
 */
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('active');
}

// =========================================================================
// GENERAL UTILITIES / HELPERS
// =========================================================================

/**
 * Generates a pseudo-random unique identifier.
 * @returns {string} The unique ID.
 */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Formats a number as USD currency.
 * @param {number} n - The raw number.
 * @returns {string} Formatted currency string.
 */
const currencySymbols = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  AED: 'د.إ',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥'
};

/**
 * Formats a number as dynamic currency based on settings.
 * @param {number} n - The raw number.
 * @returns {string} Formatted currency string.
 */
function formatCurrency(n) {
  const curr = getCurrency();
  const symbol = currencySymbols[curr] || '₹';
  if (isNaN(n) || n === null || n === undefined) return symbol + '0';
  return symbol + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Formats a timestamp into a readable date string (e.g., Jun 14, 2026).
 * @param {number} ts - The millisecond timestamp.
 * @returns {string} Formatted date.
 */
function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Formats a timestamp into HTML input date value format (YYYY-MM-DD).
 * @param {number} ts - The millisecond timestamp.
 * @returns {string} Formatted input value date.
 */
function formatDateInput(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

/**
 * Resolves initials from a user or employee's full name.
 * @param {string} name - Full name.
 * @returns {string} First letter of first two name words capitalized.
 */
function getInitials(name) {
  return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
}

/**
 * Resolves a unique theme color variable for employee card avatars based on name hash.
 * @param {string} name - Employee name.
 * @returns {string} CSS variable accent color.
 */
function getAvatarColor(name) {
  const colors = ['var(--accent)', 'var(--green)', 'var(--blue)', 'var(--purple)', 'var(--red)'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Sanitizes strings for simple cross-site scripting (XSS) prevention.
 * @param {string} str - Raw input.
 * @returns {string} Encoded string.
 */
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// =========================================================================
// TOAST NOTIFICATIONS
// =========================================================================

/**
 * Displays a non-blocking floating alert notice to the user.
 * @param {string} msg - Message to output.
 * @param {string} type - Toast type ('success', 'error', 'info').
 */
function showToast(msg, type = 'info') {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// =========================================================================
// CUSTOM CONFIRM MODAL
// =========================================================================

/**
 * Opens a blocking custom confirm dialog.
 * @param {string} title - Heading description of decision.
 * @param {string} text - Detailed prompt message.
 * @param {string} btnLabel - Text context label of confirmation button action.
 * @param {Function} cb - Callback to invoke if the action is approved.
 */
function openConfirm(title, text, btnLabel, cb) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').innerHTML = text;
  document.getElementById('confirm-btn').textContent = btnLabel || 'Confirm';
  confirmCallback = cb;
  document.getElementById('confirm-overlay').classList.add('active');
}

/**
 * Closes the active confirmation dialog.
 */
function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('active');
  confirmCallback = null;
}

/**
 * Invokes the cached confirm callback action if valid.
 */
function confirmAction() {
  if (confirmCallback) confirmCallback();
  closeConfirm();
}

// =========================================================================
// GLOBAL EVENT LISTENERS & SHORTCUTS
// =========================================================================

// Keyboard Listeners
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeEmployeeModal();
    closeNoteModal();
    closeAddLoanModal();
    closeLoanHistoryModal();
    closeConfirm();
    closeSidebar();
    if (typeof closeProfileModal === 'function') closeProfileModal();
    if (typeof closeRecordPaymentModal === 'function') closeRecordPaymentModal();
    if (typeof closeMarkModal === 'function') closeMarkModal();
  }
  if (e.ctrlKey && e.key === 'n' && currentUser) {
    e.preventDefault();
    openEmployeeModal();
  }
});

// Modal Overlay Click-to-Dismiss Listeners
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('emp-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeEmployeeModal();
  });
  document.getElementById('note-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeNoteModal();
  });
  document.getElementById('confirm-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeConfirm();
  });
  document.getElementById('loan-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAddLoanModal();
  });
  document.getElementById('loan-history-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLoanHistoryModal();
  });
  
  // Custom checks for attendance modals
  const profileOverlay = document.getElementById('profile-modal-overlay');
  if (profileOverlay) {
    profileOverlay.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeProfileModal();
    });
  }
  const paymentOverlay = document.getElementById('payment-modal-overlay');
  if (paymentOverlay) {
    paymentOverlay.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeRecordPaymentModal();
    });
  }
  const markOverlay = document.getElementById('mark-modal-overlay');
  if (markOverlay) {
    markOverlay.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeMarkModal();
    });
  }
});

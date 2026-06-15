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

  updateSidebarPlanBadge();
  updateLoanBadge();
  updateBranchUIVisibility();
  navigate('dashboard');
}

/**
 * Updates the visibility of the global branch selector based on the current plan.
 */
function updateBranchUIVisibility() {
  const selector = document.getElementById('global-branch-selector');
  if (selector) {
    if (isUltraUser()) {
      selector.style.display = 'inline-block';
    } else {
      selector.style.display = 'none';
      currentBranch = 'all'; // Reset to all if downgraded
      selector.value = 'all';
    }
  }
}

/**
 * Handles switching the global branch and re-renders the current page.
 * @param {string} branchVal - The selected branch or 'all'
 */
function changeGlobalBranch(branchVal) {
  currentBranch = branchVal;
  navigate(currentPage);
}

/**
 * Updates user avatar and name in the sidebar profile card.
 */
function updateUserUI() {
  if (!currentUser) return;
  const name = currentUser.name || currentUser.email.split('@')[0];
  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('sidebar-avatar').textContent = name.charAt(0).toUpperCase();
  
  const gbSel = document.getElementById('global-branch-selector');
  if (gbSel) {
    gbSel.style.display = isUltraUser() ? '' : 'none';
  }
  populateBranchDropdowns();

  // Custom Branding Injection
  const settings = getSettings();
  const branding = settings.branding || {};
  const logoTextEl = document.querySelector('.sidebar-logo-text');
  const logoIconEl = document.querySelector('.sidebar-logo-icon');
  
  if (isUltraUser() && branding.name) {
    logoTextEl.textContent = branding.name;
  } else {
    logoTextEl.textContent = 'WorkForce';
  }
  
  if (isUltraUser() && branding.logo) {
    logoIconEl.innerHTML = `<img src="${esc(branding.logo)}" style="width:100%; height:100%; object-fit:contain; border-radius:inherit;" />`;
    logoIconEl.style.background = 'transparent';
  } else {
    logoIconEl.innerHTML = '<i class="fa-solid fa-briefcase"></i>';
    logoIconEl.style.background = 'var(--accent)';
  }
}

/**
 * Dynamically populates the branch dropdowns with user's custom branches.
 */
function populateBranchDropdowns() {
  const branches = getBranches();
  
  const globalSel = document.getElementById('global-branch-selector');
  if (globalSel) {
    const prevGlobal = globalSel.value;
    globalSel.innerHTML = '<option value="all">All Branches</option>' + 
      branches.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
    if (branches.includes(prevGlobal) || prevGlobal === 'all') {
      globalSel.value = prevGlobal;
    } else {
      globalSel.value = 'all';
      currentBranch = 'all';
    }
  }

  const empSel = document.getElementById('emp-branch');
  if (empSel) {
    const prevEmp = empSel.value;
    empSel.innerHTML = '<option value="">— Unassigned —</option>' + 
      branches.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join('');
    if (branches.includes(prevEmp) || prevEmp === '') {
      empSel.value = prevEmp;
    }
  }
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
    settings: 'Settings',
    upgrade: 'Plans & Pricing',
    reports: 'Reports',
    analytics: 'Analytics'
  };
  document.getElementById('topbar-title').textContent = titles[page] || 'WorkForce';

  if (page === 'dashboard') renderDashboard();
  else if (page === 'employees') renderEmployees();
  else if (page === 'salary') renderSalary();
  else if (page === 'loans') renderLoans();
  else if (page === 'notes') renderNotes();
  else if (page === 'settings') renderSettings();
  else if (page === 'upgrade') renderUpgradePage();
  else if (page === 'reports') renderReportsPage();
  else if (page === 'analytics') renderAnalyticsPage();

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
 * Returns the currency symbol of the currently set currency preference.
 * @returns {string} Currency symbol.
 */
function getCurrencySymbol() {
  const curr = getCurrency();
  return currencySymbols[curr] || '₹';
}

/**
 * Formats a number as dynamic currency based on settings.
 * @param {number} n - The raw number.
 * @returns {string} Formatted currency string.
 */
function formatCurrency(n) {
  const symbol = getCurrencySymbol();
  if (isNaN(n) || n === null || n === undefined) return symbol + '0';
  return symbol + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Plan prices in each currency (base prices, not conversions).
 * These are the actual prices we charge in each currency.
 */
const planPrices = {
  INR: { pro: 499, ultra: 1499 },
  USD: { pro: 5.99, ultra: 17.99 },
  EUR: { pro: 5.49, ultra: 16.49 },
  GBP: { pro: 4.79, ultra: 14.29 },
  AED: { pro: 21.99, ultra: 65.99 },
  CAD: { pro: 7.99, ultra: 23.99 },
  AUD: { pro: 8.99, ultra: 26.99 },
  JPY: { pro: 899, ultra: 2699 }
};

/**
 * Updates the plan prices on the upgrade page based on the current currency.
 */
function updatePlanPrices() {
  const curr = getCurrency();
  const symbol = getCurrencySymbol();
  const prices = planPrices[curr] || planPrices['INR'];

  const proEl = document.getElementById('pro-plan-price');
  const ultraEl = document.getElementById('ultra-plan-price');

  if (proEl) proEl.innerHTML = `<span class="currency">${symbol}</span>${prices.pro.toLocaleString('en-US')}`;
  if (ultraEl) ultraEl.innerHTML = `<span class="currency">${symbol}</span>${prices.ultra.toLocaleString('en-US')}`;
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
 * Parses an HTML date input string (YYYY-MM-DD) into a local millisecond timestamp.
 * @param {string} dateStr - Date string from input.
 * @returns {number|null} Timestamp or null.
 */
function parseInputDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
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
    closePlanModal();
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
  const planOverlay = document.getElementById('plan-modal-overlay');
  if (planOverlay) {
    planOverlay.addEventListener('click', e => {
      if (e.target === e.currentTarget) closePlanModal();
    });
  }
});

/**
 * Renders active status states on the Upgrade Pricing page for 3 plans.
 */
function renderUpgradePage() {
  const plan = getCurrentPlan().plan; // 'base', 'pro', or 'ultra'
  updateSidebarPlanBadge();
  updatePlanPrices();

  // Base plan badge
  const baseBadge = document.getElementById('base-plan-badge');
  if (baseBadge) {
    if (plan === 'base') {
      baseBadge.textContent = '✓ ' + t('current_plan_free').replace('Current Plan: ', '');
      baseBadge.style.color = 'var(--accent)';
      baseBadge.style.borderColor = 'var(--accent)';
      baseBadge.style.borderStyle = 'solid';
      baseBadge.onclick = null;
      baseBadge.style.cursor = 'default';
    } else {
      baseBadge.textContent = t('downgrade_to_free');
      baseBadge.style.color = 'var(--text3)';
      baseBadge.style.borderColor = 'var(--border2)';
      baseBadge.style.borderStyle = 'dashed';
      baseBadge.onclick = () => changePlanSimulation('base');
      baseBadge.style.cursor = 'pointer';
    }
  }

  // Pro plan button & active badge
  const proBtn = document.getElementById('upgrade-pro-btn');
  const proActiveBadge = document.getElementById('pro-active-badge');
  if (proBtn && proActiveBadge) {
    if (plan === 'pro') {
      proBtn.style.display = 'none';
      proActiveBadge.style.display = '';
      proActiveBadge.textContent = '✦ ' + t('current_plan_pro');
      proActiveBadge.onclick = null;
      proActiveBadge.style.cursor = 'default';
    } else if (plan === 'ultra') {
      proBtn.style.display = 'none';
      proActiveBadge.style.display = '';
      proActiveBadge.textContent = t('downgrade_to_pro') || 'Downgrade to Pro';
      proActiveBadge.style.cursor = 'pointer';
      proActiveBadge.onclick = () => changePlanSimulation('pro');
    } else {
      proBtn.style.display = '';
      proActiveBadge.style.display = 'none';
    }
  }

  // Ultra plan button & active badge
  const ultraBtn = document.getElementById('upgrade-ultra-btn');
  const ultraActiveBadge = document.getElementById('ultra-active-badge');
  if (ultraBtn && ultraActiveBadge) {
    if (plan === 'ultra') {
      ultraBtn.style.display = 'none';
      ultraActiveBadge.style.display = '';
      ultraActiveBadge.textContent = '✦ ' + (t('current_plan_ultra') || 'Current Plan: Ultra');
    } else {
      ultraBtn.style.display = '';
      ultraActiveBadge.style.display = 'none';
    }
  }
}

/**
 * Handles upgrade click on Pro or Ultra plan buttons.
 * @param {string} targetPlan - 'pro' or 'ultra'
 */
function handleUpgradeClick(targetPlan) {
  const labels = { pro: 'Pro', ultra: 'Ultra' };
  openConfirm(
    t('upgrade_to_pro').replace('Pro', labels[targetPlan]),
    t('payments_coming_soon_text'),
    t('upgrade_to_pro').replace('Pro', labels[targetPlan]),
    () => {
      changePlanSimulation(targetPlan);
      showToast('Successfully upgraded to ' + labels[targetPlan] + '!', 'success');
    }
  );
}

/**
 * Plan Modal dialog helpers.
 */
function openPlanModal(title, text, iconClass = 'fa-crown', showUpgradeBtn = true) {
  const titleEl = document.getElementById('plan-modal-title');
  const textEl = document.getElementById('plan-modal-text');
  const iconEl = document.getElementById('plan-modal-icon');
  const navBtnEl = document.getElementById('plan-modal-nav-btn');
  const overlayEl = document.getElementById('plan-modal-overlay');

  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = text;
  if (iconEl) iconEl.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
  if (navBtnEl) navBtnEl.style.display = showUpgradeBtn ? '' : 'none';
  if (overlayEl) overlayEl.classList.add('active');
}

function closePlanModal() {
  const overlayEl = document.getElementById('plan-modal-overlay');
  if (overlayEl) overlayEl.classList.remove('active');
}

/**
 * Toggles the right activity sidebar.
 */
function toggleActivitySidebar() {
  document.body.classList.toggle('has-activity-sidebar');
  if (document.body.classList.contains('has-activity-sidebar')) {
    renderActivitySidebar();
  }
}

/**
 * Renders the right activity log from storage.
 */
function renderActivitySidebar() {
  const listEl = document.getElementById('right-activity-list');
  if (!listEl) return;
  const logs = getActivityLogs();
  if (logs.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:30px">
        <i class="fa-solid fa-clock" style="font-size:1.8rem;margin-bottom:10px;display:block"></i>
        <p>No recent activity</p>
      </div>`;
  } else {
    listEl.innerHTML = logs.map(l => `
      <div class="activity-item">
        <div class="time">${l.time}</div>
        <div class="msg">${esc(l.msg)}</div>
      </div>
    `).join('');
  }
}

/**
 * Toggles the left sidebar collapsed state.
 */
function toggleSidebarCollapse() {
  const sb = document.getElementById('sidebar');
  const icon = document.getElementById('sidebar-collapse-icon');
  if (sb.classList.contains('collapsed')) {
    sb.classList.remove('collapsed');
    document.body.classList.remove('sidebar-collapsed');
    if (icon) { icon.classList.remove('fa-chevron-right'); icon.classList.add('fa-chevron-left'); }
  } else {
    sb.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
    if (icon) { icon.classList.remove('fa-chevron-left'); icon.classList.add('fa-chevron-right'); }
  }
}

/**
 * Initializes the left sidebar resizer handle drag events.
 */
function initSidebarResizer() {
  const resizer = document.getElementById('sidebar-resizer');
  if (resizer) resizer.style.display = 'none';
}

// Initialize resizer on load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initSidebarResizer, 100);
});

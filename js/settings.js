/**
 * settings.js
 * Controls application settings, profile updates, themes selection,
 * database clean overrides, data exports formats generators.
 */

// =========================================================================
// RENDER SETTINGS PANEL
// =========================================================================

/**
 * Loads current settings preferences and sets active state classes on theme selector cards.
 */
function renderSettings() {
  const theme = getTheme();
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.id === 'theme-' + theme);
  });
  const settings = getSettings();
  document.getElementById('settings-name').value = settings.name || (currentUser ? currentUser.name : '');

  // Populate System Preferences select inputs
  const langSelect = document.getElementById('settings-lang');
  const currSelect = document.getElementById('settings-currency');
  if (langSelect) langSelect.value = getLanguage();
  if (currSelect) currSelect.value = getCurrency();

  const planSelect = document.getElementById('settings-plan');
  if (planSelect) planSelect.value = getCurrentPlan().plan;

  // Custom Branding load
  const branding = settings.branding || {};
  const elBrandName = document.getElementById('brand-name');
  const elBrandLogo = document.getElementById('brand-logo');
  const elBrandAddr = document.getElementById('brand-address');
  const elBrandPhone = document.getElementById('brand-phone');
  
  if (elBrandName) elBrandName.value = branding.name || '';
  if (elBrandLogo) elBrandLogo.value = branding.logo || '';
  if (elBrandAddr) elBrandAddr.value = branding.address || '';
  if (elBrandPhone) elBrandPhone.value = branding.phone || '';

  updateSidebarPlanBadge();
}

/**
 * Changes currency system preference and updates active screens.
 * @param {string} curr - Selected currency code.
 */
function changeCurrency(curr) {
  saveCurrency(curr);

  // Update both Settings and Login page selections if visible
  const currSelect = document.getElementById('settings-currency');
  if (currSelect) {
    currSelect.value = curr;
  }
  const authCurrSelect = document.getElementById('auth-currency');
  if (authCurrSelect) {
    authCurrSelect.value = curr;
  }

  // Re-render current active tab to reflect changes
  if (currentPage === 'dashboard') renderDashboard();
  else if (currentPage === 'employees') renderEmployees();
  else if (currentPage === 'salary') renderSalary();
  else if (currentPage === 'loans') renderLoans();
  else if (currentPage === 'settings') renderSettings();
  showToast(t('toast_settings_saved'), 'success');
}

// =========================================================================
// THEME SWITCHER
// =========================================================================

/**
 * Binds selected theme settings to root documentElement selectors and updates indicators.
 * @param {string} theme - Theme key ('dark', 'light', 'corporate', 'minimal').
 * @param {boolean} [silent] - Avoid displaying toast notifications on updates.
 */
function setTheme(theme, silent) {
  document.documentElement.setAttribute('data-theme', theme);
  saveTheme(theme);
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.id === 'theme-' + theme);
  });
  if (!silent) {
    showToast('Theme changed to ' + theme, 'info');
  }
}

// =========================================================================
// CONFIGURATIONS UPDATES
// =========================================================================

/**
 * Validates display name changes and saves configuration profiles to caches.
 */
function handleSaveSettings() {
  const name = document.getElementById('settings-name').value.trim();
  if (name && currentUser) {
    currentUser.name = name;
    const users = getUsers();
    users[currentUser.email].name = name;
    saveUsers(users);
    saveSession(currentUser);
    updateUserUI();
  }
  
  // Custom Branding save
  const branding = {
    name: document.getElementById('brand-name') ? document.getElementById('brand-name').value.trim() : '',
    logo: document.getElementById('brand-logo') ? document.getElementById('brand-logo').value.trim() : '',
    address: document.getElementById('brand-address') ? document.getElementById('brand-address').value.trim() : '',
    phone: document.getElementById('brand-phone') ? document.getElementById('brand-phone').value.trim() : ''
  };

  const currentSettings = getSettings();
  saveSettings({ ...currentSettings, name, branding });
  
  // Re-render UI to apply branding changes immediately
  updateUserUI();
  
  showToast('Settings saved!', 'success');
}

/**
 * Switch the subscription plan for testing/simulation.
 * @param {string} planVal - The plan key ('base', 'pro', 'ultra').
 */
function changePlanSimulation(planVal) {
  setCurrentPlan(planVal);
  updateSidebarPlanBadge();
  if (typeof updateBranchUIVisibility === 'function') updateBranchUIVisibility();

  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'settings') renderSettings();
  if (currentPage === 'upgrade') renderUpgradePage();
  if (currentPage === 'reports') renderReportsPage();
  if (currentPage === 'analytics') renderAnalyticsPage();
  if (currentPage === 'employees') renderEmployees();

  const labels = { base: 'Base (10 emp)', pro: 'Pro (35 emp)', ultra: 'Ultra (Unlimited)' };
  showToast('✅ Plan activated: ' + (labels[planVal] || planVal), 'success');
}

/**
 * Reads the plan dropdown value and applies it. Called by the Apply Plan button.
 */
function applyPlanChange() {
  const planSelect = document.getElementById('settings-plan');
  if (!planSelect) return;
  changePlanSimulation(planSelect.value);
  // Navigate to upgrade page so user sees the updated card states
  navigate('upgrade');
}

/**
 * Quick-activates a plan from any page (e.g., locked state buttons).
 * Switches plan immediately and re-renders current page.
 * @param {string} planVal - 'base', 'pro', or 'ultra'
 */
function _quickActivatePlan(planVal) {
  changePlanSimulation(planVal);
  // Re-render current page with new plan
  navigate(currentPage);
}

/**
 * Updates the sidebar plan badge to show the current active plan with color coding.
 */
function updateSidebarPlanBadge() {
  const badge = document.getElementById('sidebar-plan-badge');
  if (!badge) return;
  const { plan } = getCurrentPlan();
  const configs = {
    base:  { label: t('free_plan') + ' — 10 ' + t('employees').toLowerCase(),       bg: 'var(--bg3)',                  color: 'var(--text3)',   border: 'var(--border)' },
    pro:   { label: '⚡ ' + t('pro_plan') + ' — 35 ' + t('employees').toLowerCase(),     bg: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)',  border: 'rgba(var(--accent-rgb),0.3)' },
    ultra: { label: '✦ Ultra — ' + t('unlimited_employees'),       bg: 'rgba(167,139,250,0.12)',       color: 'var(--purple)',  border: 'rgba(167,139,250,0.35)' },
  };
  const cfg = configs[plan] || configs.base;
  badge.textContent = cfg.label;
  badge.style.background = cfg.bg;
  badge.style.color = cfg.color;
  badge.style.borderColor = cfg.border;
  badge.style.cursor = 'pointer';
  badge.onclick = () => navigate('upgrade');
}



/**
 * Displays confirm alert overlay dialogues before resetting local storage cache databases.
 */
function confirmClearData() {
  openConfirm(
    'Clear All Data',
    'This will permanently delete ALL employees, loans, and reset your data. This cannot be undone.',
    'Clear All Data',
    () => {
      employees = [];
      saveEmployees(currentUser.email, employees);
      navigate('dashboard');
      updateLoanBadge();
      showToast('All data cleared.', 'info');
    }
  );
}

// =========================================================================
// DATA EXPORTS
// =========================================================================

/**
 * Exports current database records lists either as formatted JSON files or CSV tables.
 * @param {string} type - Export format choice ('json' or 'csv').
 */
function exportData(type) {
  if (employees.length === 0) {
    showToast('No data to export.', 'error');
    return;
  }
  let content, mime, ext;
  if (type === 'json') {
    content = JSON.stringify(employees, null, 2);
    mime = 'application/json';
    ext = 'json';
  } else {
    // CSV export building
    const headers = ['ID', 'Name', 'Role', 'Salary', 'Interval', 'CustomDays', 'Phone', 'Paid', 'Notes', 'DateAdded', 'ActiveLoans', 'TotalLoanBalance'];
    const rows = employees.map(e => {
      const activeLoans = getActiveLoans(e);
      const totalBalance = getTotalActiveLoanBalance(e);
      return [
        e.id,
        `"${e.name.replace(/"/g, '""')}"`,
        `"${e.role.replace(/"/g,'""')}"`,
        e.salary,
        e.interval,
        e.customDays || '',
        e.phone || '',
        e.paid ? 'Yes' : 'No',
        `"${(e.notes || '').replace(/"/g,'""')}"`,
        formatDate(e.dateAdded),
        activeLoans.length,
        totalBalance.toFixed(2)
      ].join(',');
    });
    content = [headers.join(','), ...rows].join('\n');
    mime = 'text/csv';
    ext = 'csv';
  }

  // File download triggers
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workforce-export-${Date.now()}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported as ${ext.toUpperCase()}!`, 'success');
}

// =========================================================================
// CUSTOM BRANCHES & MODULE SETTINGS
// =========================================================================

/**
 * Initializes and renders the module toggle checkboxes.
 */
function renderModuleToggles() {
  const settings = getSettings();
  const mods = settings.modules || { payroll: true, loans: true, attendance: true };
  
  const pCheck = document.getElementById('toggle-mod-payroll');
  const lCheck = document.getElementById('toggle-mod-loans');
  const aCheck = document.getElementById('toggle-mod-attendance');
  
  if (pCheck) pCheck.checked = mods.payroll;
  if (lCheck) lCheck.checked = mods.loans;
  if (aCheck) aCheck.checked = mods.attendance;
  
  applyModuleVisibility(mods);
}

/**
 * Handles toggling of module visibility globally.
 * @param {string} modName - Module name ('payroll', 'loans', 'attendance')
 * @param {boolean} isVisible - Target visibility state
 */
function toggleModule(modName, isVisible) {
  const settings = getSettings();
  if (!settings.modules) settings.modules = { payroll: true, loans: true, attendance: true };
  settings.modules[modName] = isVisible;
  saveSettings(settings);
  applyModuleVisibility(settings.modules);
  showToast(`${modName.charAt(0).toUpperCase() + modName.slice(1)} module ${isVisible ? 'enabled' : 'disabled'}.`, 'info');
}

/**
 * Applies CSS display/none to navigation and UI elements based on module toggles.
 * @param {Object} mods - Visibility states
 */
function applyModuleVisibility(mods) {
  const payrollNav = document.querySelector('button[data-page="salary"]');
  const loansNav = document.querySelector('button[data-page="loans"]');
  const profileAttnTab = document.getElementById('profile-tab-btn-attendance');
  
  if (payrollNav) payrollNav.style.display = mods.payroll ? '' : 'none';
  if (loansNav) loansNav.style.display = mods.loans ? '' : 'none';
  if (profileAttnTab) profileAttnTab.style.display = mods.attendance ? '' : 'none';
}

/**
 * Renders the custom branches list inside Settings (if Ultra plan active).
 */
function renderBranchSettings() {
  const branchSection = document.getElementById('settings-branch-section');
  if (!branchSection) return;
  
  if (!isUltraUser()) {
    branchSection.style.display = 'none';
    return;
  }
  
  branchSection.style.display = '';
  const branches = getBranches();
  const listEl = document.getElementById('settings-branches-list');
  
  listEl.innerHTML = branches.map(b => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg3); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border);">
      <span>${esc(b)}</span>
      ${['ABC Restaurant', 'ABC Warehouse', 'ABC Catering'].includes(b) ? 
        `<span style="font-size:0.75rem; color:var(--text3);">(Default)</span>` :
        `<button class="btn btn-ghost btn-sm" onclick="deleteBranch('${esc(b)}')"><i class="fa-solid fa-trash" style="color:var(--red);"></i></button>`
      }
    </div>
  `).join('');
}

/**
 * Adds a new custom branch.
 */
function addNewBranch() {
  if (!isUltraUser()) return;
  const input = document.getElementById('new-branch-input');
  const val = input.value.trim();
  if (!val) return;
  
  const branches = getBranches();
  if (branches.includes(val)) {
    showToast('Branch already exists!', 'error');
    return;
  }
  
  branches.push(val);
  saveBranches(branches);
  input.value = '';
  
  renderBranchSettings();
  if (typeof populateBranchDropdowns === 'function') populateBranchDropdowns();
  showToast(`Branch "${val}" added successfully.`, 'success');
}

/**
 * Deletes a custom branch.
 * @param {string} b - Branch name
 */
function deleteBranch(b) {
  if (!isUltraUser()) return;
  let branches = getBranches();
  branches = branches.filter(branch => branch !== b);
  saveBranches(branches);
  
  renderBranchSettings();
  if (typeof populateBranchDropdowns === 'function') populateBranchDropdowns();
  showToast(`Branch "${b}" deleted.`, 'info');
}

// Hook to render elements when rendering settings
const originalRenderSettings = renderSettings;
renderSettings = function() {
  originalRenderSettings();
  renderModuleToggles();
  renderBranchSettings();
  
  // Toggle Branding Section visibility
  const brandingSection = document.getElementById('settings-branding-section');
  if (brandingSection) {
    brandingSection.style.display = isUltraUser() ? '' : 'none';
  }
};

// Initial module load
document.addEventListener('DOMContentLoaded', () => {
  const settings = getSettings();
  const mods = settings.modules || { payroll: true, loans: true, attendance: true };
  applyModuleVisibility(mods);
});

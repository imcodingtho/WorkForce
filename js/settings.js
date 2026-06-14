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
  const theme = localStorage.getItem(THEME_KEY) || 'dark';
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.id === 'theme-' + theme);
  });
  const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  document.getElementById('settings-name').value = settings.name || (currentUser ? currentUser.name : '');
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
  localStorage.setItem(THEME_KEY, theme);
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
function saveSettings() {
  const name = document.getElementById('settings-name').value.trim();
  if (name && currentUser) {
    currentUser.name = name;
    const users = getUsers();
    users[currentUser.email].name = name;
    saveUsers(users);
    saveSession(currentUser);
    updateUserUI();
  }
  const settings = { name };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  showToast('Settings saved!', 'success');
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

/**
 * storage.js
 * Manages global application state and provides helper methods to interact with localStorage.
 */

// =========================================================================
// GLOBAL STATE VARIABLES
// =========================================================================
let currentUser = null;
let employees = [];
let currentView = 'card';
let currentPage = 'dashboard';
let confirmCallback = null;
let tableSortCol = '';
let tableSortDir = 'asc';
let currentLoanFilter = 'all';
let currentBranch = 'all';

// =========================================================================
// LOCALSTORAGE KEYS
// =========================================================================
const USERS_KEY = 'wf_users';
const EMPLOYEES_KEY_PREFIX = 'wf_employees_';
const SESSION_KEY = 'wf_session';
const THEME_KEY = 'wf_theme';
const SETTINGS_KEY = 'wf_settings';

// =========================================================================
// LOCALSTORAGE GETTERS & SETTERS
// =========================================================================

/**
 * Retrieves all registered users from localStorage.
 * Automatically provisions a demo user if not present.
 * @returns {Object} Dictionary of email to user objects.
 */
function getUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  const users = raw ? JSON.parse(raw) : {};
  if (!users['demo@workforce.app']) {
    users['demo@workforce.app'] = { email: 'demo@workforce.app', password: 'demo1234', name: 'Demo User' };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  return users;
}

/**
 * Saves the registered users dictionary to localStorage.
 * @param {Object} users - Dictionary of email to user objects.
 */
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/**
 * Retrieves the list of employees. If email is provided, retrieves for that email.
 * Otherwise, retrieves for the currently logged-in user.
 * @param {string} [email] - The user's email address.
 * @returns {Array} List of employees.
 */
function getEmployees(email) {
  const targetEmail = email || (currentUser ? currentUser.email : null);
  if (!targetEmail) return [];
  const raw = localStorage.getItem(EMPLOYEES_KEY_PREFIX + targetEmail);
  return raw ? JSON.parse(raw) : [];
}

/**
 * Saves the list of employees. Supports both (emps, email) and (email, emps) and (emps) signatures.
 * @param {Array|string} arg1 - Employees array or email.
 * @param {Array|string} [arg2] - Employees array or email.
 */
function saveEmployees(arg1, arg2) {
  let email, emps;
  if (typeof arg1 === 'string') {
    email = arg1;
    emps = arg2;
  } else {
    emps = arg1;
    email = arg2;
  }
  const targetEmail = email || (currentUser ? currentUser.email : null);
  if (!targetEmail) return;
  localStorage.setItem(EMPLOYEES_KEY_PREFIX + targetEmail, JSON.stringify(emps));
}

/**
 * Saves/inserts a single employee object in global state and writes to localStorage.
 * @param {Object} emp - Employee object.
 */
function saveEmployee(emp) {
  if (!emp || !emp.id) return;
  const idx = employees.findIndex(e => e.id === emp.id);
  if (idx > -1) {
    employees[idx] = { ...employees[idx], ...emp };
  } else {
    employees.unshift(emp);
  }
  saveEmployees(employees);
}

/**
 * Retrieves a flat array of all loans across all current employees.
 * @returns {Array} All loans.
 */
function getLoans() {
  const all = [];
  employees.forEach(e => {
    if (e.loans) {
      e.loans.forEach(l => {
        all.push({ loan: l, emp: e });
      });
    }
  });
  return all;
}

/**
 * Inserts or updates a loan record for a target employee, writing changes to storage.
 * @param {string} empId - Target employee ID.
 * @param {Object} loan - Loan object to record.
 * @returns {boolean} Success status of the save operation.
 */
function saveLoan(empId, loan) {
  if (!empId || !loan || !loan.id) return false;
  const empIdx = employees.findIndex(e => e.id === empId);
  if (empIdx === -1) return false;
  if (!employees[empIdx].loans) employees[empIdx].loans = [];
  const loanIdx = employees[empIdx].loans.findIndex(l => l.id === loan.id);
  if (loanIdx > -1) {
    employees[empIdx].loans[loanIdx] = { ...employees[empIdx].loans[loanIdx], ...loan };
  } else {
    employees[empIdx].loans.push(loan);
  }
  saveEmployees(employees);
  return true;
}

/**
 * Retrieves the application settings from localStorage.
 * @returns {Object} Settings object.
 */
function getSettings() {
  const targetEmail = currentUser ? currentUser.email : 'default';
  const raw = localStorage.getItem(SETTINGS_KEY + '_' + targetEmail);
  return raw ? JSON.parse(raw) : {};
}

/**
 * Saves the settings object to localStorage.
 * @param {Object} settings - Settings configuration to persist.
 */
function saveSettings(settings) {
  const targetEmail = currentUser ? currentUser.email : 'default';
  localStorage.setItem(SETTINGS_KEY + '_' + targetEmail, JSON.stringify(settings));
}

/**
 * Retrieves the active theme key.
 * @returns {string} Theme key.
 */
function getTheme() {
  const targetEmail = currentUser ? currentUser.email : 'default';
  return localStorage.getItem(THEME_KEY + '_' + targetEmail) || localStorage.getItem(THEME_KEY) || 'dark';
}

/**
 * Persists the selected theme key.
 * @param {string} theme - Selected theme name.
 */
function saveTheme(theme) {
  const targetEmail = currentUser ? currentUser.email : 'default';
  localStorage.setItem(THEME_KEY + '_' + targetEmail, theme);
  localStorage.setItem(THEME_KEY, theme);
}

/**
 * Retrieves the selected currency from localStorage. Defaults to 'INR'.
 * @returns {string} Currency key.
 */
function getCurrency() {
  const targetEmail = currentUser ? currentUser.email : 'default';
  return localStorage.getItem('wf_currency_' + targetEmail) || localStorage.getItem('wf_currency') || 'INR';
}

/**
 * Saves the selected currency key to localStorage.
 * @param {string} curr - Selected currency.
 */
function saveCurrency(curr) {
  const targetEmail = currentUser ? currentUser.email : 'default';
  localStorage.setItem('wf_currency_' + targetEmail, curr);
  localStorage.setItem('wf_currency', curr);
}

/**
 * Retrieves the selected language from localStorage. Defaults to 'en'.
 * @returns {string} Language code.
 */
function getLanguage() {
  const targetEmail = currentUser ? currentUser.email : 'default';
  return localStorage.getItem('wf_language_' + targetEmail) || localStorage.getItem('wf_language') || 'en';
}

/**
 * Saves the selected language code to localStorage.
 * @param {string} lang - Language code.
 */
function saveLanguage(lang) {
  const targetEmail = currentUser ? currentUser.email : 'default';
  localStorage.setItem('wf_language_' + targetEmail, lang);
  localStorage.setItem('wf_language', lang);
}

/**
 * Retrieves the active user session from localStorage.
 * @returns {Object|null} The active user session object or null.
 */
function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Saves the user session object to localStorage.
 * @param {Object} user - The active user object.
 */
function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

/**
 * Clears the active user session from localStorage.
 */
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Retrieves the current subscription plan for the active user.
 * @returns {Object} Plan object with a 'plan' key: 'base', 'pro', or 'ultra'.
 */
function getCurrentPlan() {
  const targetEmail = currentUser ? currentUser.email : 'default';
  const raw = localStorage.getItem('wf_plan_' + targetEmail);
  if (!raw) {
    return { plan: 'base' };
  }
  const parsed = JSON.parse(raw);
  // Migrate legacy 'free' plan to 'base'
  if (parsed.plan === 'free') parsed.plan = 'base';
  return parsed;
}

/**
 * Persists the subscription plan key for the active user.
 * @param {string} planStr - Subscription plan name ('base', 'pro', 'ultra').
 */
function setCurrentPlan(planStr) {
  const targetEmail = currentUser ? currentUser.email : 'default';
  localStorage.setItem('wf_plan_' + targetEmail, JSON.stringify({ plan: planStr }));
}

/**
 * Checks if the current active plan is 'pro' or higher.
 * @returns {boolean} True if Pro or Ultra.
 */
function isProUser() {
  const { plan } = getCurrentPlan();
  return plan === 'pro' || plan === 'ultra';
}

/**
 * Checks if the current active plan is 'ultra'.
 * @returns {boolean} True if Ultra.
 */
function isUltraUser() {
  return getCurrentPlan().plan === 'ultra';
}

/**
 * Returns the maximum number of employees allowed on the current plan.
 * Base: 10 | Pro: 35 | Ultra: Unlimited.
 * @returns {number} Employee limit.
 */
function getEmployeeLimit() {
  const { plan } = getCurrentPlan();
  if (plan === 'ultra') return Infinity;
  if (plan === 'pro') return 35;
  return 10; // base
}

/**
 * Returns employees filtered by the globally selected branch.
 * If not an Ultra user or 'all' is selected, returns all employees.
 * @returns {Array} List of filtered employees.
 */
function getFilteredEmployees() {
  if (!isUltraUser() || currentBranch === 'all') {
    return employees;
  }
  return employees.filter(e => e.branch === currentBranch);
}

/**
 * Retrieves the custom list of branches for the active user.
 * @returns {Array} List of branch names.
 */
function getBranches() {
  const targetEmail = currentUser ? currentUser.email : 'default';
  const raw = localStorage.getItem('wf_branches_' + targetEmail);
  return raw ? JSON.parse(raw) : ['ABC Restaurant', 'ABC Warehouse', 'ABC Catering'];
}

/**
 * Saves the custom list of branches for the active user.
 * @param {Array} branches - Array of branch names.
 */
function saveBranches(branches) {
  const targetEmail = currentUser ? currentUser.email : 'default';
  localStorage.setItem('wf_branches_' + targetEmail, JSON.stringify(branches));
}

/**
 * Logs an activity to the timelog.
 * @param {string} msg - The activity description.
 */
function logActivity(msg) {
  const targetEmail = currentUser ? currentUser.email : 'default';
  const key = 'wf_timelog_' + targetEmail;
  const raw = localStorage.getItem(key);
  let logs = raw ? JSON.parse(raw) : [];
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  logs.unshift({ time: timeStr, msg: msg, timestamp: now.getTime() });
  
  if (logs.length > 100) logs = logs.slice(0, 100); // keep last 100
  
  localStorage.setItem(key, JSON.stringify(logs));
}

/**
 * Retrieves the activity timelogs.
 * @returns {Array} List of log objects.
 */
function getActivityLogs() {
  const targetEmail = currentUser ? currentUser.email : 'default';
  const raw = localStorage.getItem('wf_timelog_' + targetEmail);
  return raw ? JSON.parse(raw) : [];
}


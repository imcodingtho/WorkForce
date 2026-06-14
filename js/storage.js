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
 * Retrieves the list of employees associated with a user's email.
 * @param {string} email - The user's email address.
 * @returns {Array} List of employees.
 */
function getEmployees(email) {
  const raw = localStorage.getItem(EMPLOYEES_KEY_PREFIX + email);
  return raw ? JSON.parse(raw) : [];
}

/**
 * Saves the list of employees for a user's email to localStorage.
 * @param {string} email - The user's email address.
 * @param {Array} emps - List of employees to save.
 */
function saveEmployees(email, emps) {
  localStorage.setItem(EMPLOYEES_KEY_PREFIX + email, JSON.stringify(emps));
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

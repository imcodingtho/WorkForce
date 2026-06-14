/**
 * auth.js
 * Handles sign in/out processes, verification warning layouts, signup,
 * user session management, and sample databases generator for demonstration.
 */

/**
 * Toggles active tab display headers between "login" and "signup" auth views.
 * @param {string} tab - Current active panel ('login' or 'signup').
 */
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  // Note: event is the standard global DOM event object used in the original onclick.
  // We can access it directly. To be safe, we fetch window.event if event is undefined.
  const evt = (typeof event !== 'undefined') ? event : window.event;
  if (evt && evt.target) {
    evt.target.classList.add('active');
  }
  document.getElementById('login-form').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('signup-form').style.display = tab === 'signup' ? '' : 'none';
}

/**
 * Appends alert error message layout to a specific warning panel identifier.
 * @param {string} id - Error container ID.
 * @param {string} msg - Warning details text.
 */
function showAuthError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
}

/**
 * Dismisses validation warning layout from a warning panel.
 * @param {string} id - Error container ID.
 */
function clearAuthError(id) {
  document.getElementById(id).classList.remove('show');
}

/**
 * Validates login input credentials and logs in the matches user context.
 */
function handleLogin() {
  clearAuthError('login-error');
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  if (!email || !password) {
    showAuthError('login-error', 'Please fill in all fields.');
    return;
  }
  const users = getUsers();
  const user = users[email];
  if (!user || user.password !== password) {
    showAuthError('login-error', 'Invalid email or password.');
    return;
  }
  loginUser(user);
}

/**
 * Validates registration forms and logs in new users.
 */
function handleSignup() {
  clearAuthError('signup-error');
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const password = document.getElementById('signup-password').value;
  if (!name || !email || !password) {
    showAuthError('signup-error', 'Please fill in all fields.');
    return;
  }
  if (password.length < 6) {
    showAuthError('signup-error', 'Password must be at least 6 characters.');
    return;
  }
  if (!email.includes('@')) {
    showAuthError('signup-error', 'Please enter a valid email.');
    return;
  }
  const users = getUsers();
  if (users[email]) {
    showAuthError('signup-error', 'An account with this email already exists.');
    return;
  }
  users[email] = { email, password, name };
  saveUsers(users);
  loginUser(users[email]);
  showToast('Account created! Welcome, ' + name + '!', 'success');
}

/**
 * Binds active state database arrays to matches email context. Loads/provisions demo profile datasets.
 * @param {Object} user - User session database context.
 */
function loginUser(user) {
  currentUser = user;
  saveSession(user);
  employees = getEmployees(user.email);
  // Migrate old employees without loans/payments arrays
  employees = employees.map(e => ({
    loans: [],
    payments: [],
    ...e
  }));
  if (user.email === 'demo@workforce.app' && employees.length === 0) {
    employees = getSampleEmployees();
    saveEmployees(user.email, employees);
  }
  startApp();
}

/**
 * Resets user cache details, clears session cache keys, and redirects views back to Authentication portal.
 */
function handleLogout() {
  clearSession();
  currentUser = null;
  employees = [];
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('app-screen').style.display = '';
  document.getElementById('auth-screen').style.display = '';
  showToast('Logged out successfully.', 'info');
}

/**
 * Builds demo database dataset list of employees, repayments, payments, and notes logs.
 * @returns {Array} List of initial sample employees.
 */
function getSampleEmployees() {
  const now = Date.now();
  const e1id = uid(), e2id = uid(), e3id = uid(), e4id = uid(), e5id = uid();
  const l1id = uid(), l2id = uid();
  return [
    {
      id: e1id, name: 'Sarah Johnson', role: 'Product Manager', salary: 7500, interval: 'monthly',
      customDays: null, phone: '+1 555 123 4567', paid: true,
      notes: 'Great leadership skills. Leading the Q4 product launch.',
      dateAdded: now - 86400000 * 30,
      loans: [
        {
          id: l1id, amount: 3000, dateGiven: now - 86400000 * 25, reason: 'Home renovation deposit',
          repaymentType: 'fixed', monthlyDeduction: 500, remainingBalance: 2000, status: 'active',
          repaymentHistory: [
            { id: uid(), date: now - 86400000 * 20, amount: 500, note: 'Month 1 deduction' },
            { id: uid(), date: now - 86400000 * 10, amount: 500, note: 'Month 2 deduction' }
          ]
        }
      ],
      payments: [{ id: uid(), date: now - 86400000 * 2, amount: 7500 }]
    },
    {
      id: e2id, name: 'Marcus Lee', role: 'Lead Developer', salary: 9200, interval: 'monthly',
      customDays: null, phone: '+1 555 234 5678', paid: false,
      notes: 'Senior dev. Working on backend architecture refactor.',
      dateAdded: now - 86400000 * 25,
      loans: [
        {
          id: l2id, amount: 5000, dateGiven: now - 86400000 * 15, reason: 'Emergency medical expense',
          repaymentType: 'manual', monthlyDeduction: 0, remainingBalance: 5000, status: 'active',
          repaymentHistory: []
        }
      ],
      payments: []
    },
    {
      id: e3id, name: 'Elena Vasquez', role: 'UI/UX Designer', salary: 5800, interval: 'monthly',
      customDays: null, phone: '', paid: true, notes: '',
      dateAdded: now - 86400000 * 20,
      loans: [],
      payments: [{ id: uid(), date: now - 86400000 * 3, amount: 5800 }]
    },
    {
      id: e4id, name: 'Tom Bradley', role: 'DevOps Engineer', salary: 1400, interval: 'weekly',
      customDays: null, phone: '+1 555 345 6789', paid: false,
      notes: 'Managing cloud infrastructure on AWS.',
      dateAdded: now - 86400000 * 15,
      loans: [],
      payments: []
    },
    {
      id: e5id, name: 'Priya Nair', role: 'Data Analyst', salary: 220, interval: 'daily',
      customDays: null, phone: '', paid: true,
      notes: 'Building dashboards in Tableau.',
      dateAdded: now - 86400000 * 10,
      loans: [],
      payments: [{ id: uid(), date: now - 86400000 * 1, amount: 220 }]
    }
  ];
}

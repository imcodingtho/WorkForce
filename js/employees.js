/**
 * employees.js
 * Controls employee records management, sorting/filtering systems,
 * layout toggling (card/table), add/edit forms validation, notes management.
 */

// =========================================================================
// FILTERING & SORTING
// =========================================================================

/**
 * Returns filtered and sorted employees based on active toolbar state selections.
 * @returns {Array} List of processed employees.
 */
function getFilteredSorted() {
  const q = document.getElementById('emp-search').value.toLowerCase();
  const status = document.getElementById('filter-status').value;
  const interval = document.getElementById('filter-interval').value;
  const loanFilter = document.getElementById('filter-loan').value;
  const salaryMin = parseFloat(document.getElementById('filter-salary-min').value) || null;
  const salaryMax = parseFloat(document.getElementById('filter-salary-max').value) || null;
  const sortBy = document.getElementById('sort-by').value;

  let list = getFilteredEmployees().filter(e => {
    const matchQ = !q || e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q) || (e.phone && e.phone.includes(q));
    const matchStatus = !status || (status === 'paid' ? e.paid : !e.paid);
    const matchInterval = !interval || e.interval === interval;
    const hasActiveLoan = getActiveLoans(e).length > 0;
    const matchLoan = !loanFilter || (loanFilter === 'yes' ? hasActiveLoan : !hasActiveLoan);
    const sal = parseFloat(e.salary) || 0;
    const matchSalaryMin = salaryMin === null || sal >= salaryMin;
    const matchSalaryMax = salaryMax === null || sal <= salaryMax;
    return matchQ && matchStatus && matchInterval && matchLoan && matchSalaryMin && matchSalaryMax;
  });

  list.sort((a, b) => {
    if (sortBy === 'date-desc') return b.dateAdded - a.dateAdded;
    if (sortBy === 'date-asc') return a.dateAdded - b.dateAdded;
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
    if (sortBy === 'salary-desc') return (parseFloat(b.salary)||0) - (parseFloat(a.salary)||0);
    if (sortBy === 'salary-asc') return (parseFloat(a.salary)||0) - (parseFloat(b.salary)||0);
    return 0;
  });
  return list;
}

// =========================================================================
// EMPLOYEES TAB RENDERING
// =========================================================================

/**
 * Triggers re-rendering employee lists based on active layout type (card/table).
 */
function renderEmployees() {
  const list = getFilteredSorted();
  if (currentView === 'card') renderCardView(list);
  else renderTableView(list);
}

/**
 * Renders list arrays as visual dashboard Cards.
 * @param {Array} list - Filtered list of employees.
 */
function renderCardView(list) {
  const grid = document.getElementById('employees-grid');
  const empty = document.getElementById('employees-empty');

  // Show / hide free plan limit banner
  _renderPlanLimitBanner();

  if (list.length === 0) {
    grid.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = list.map(e => {
    const activeLoans = getActiveLoans(e);
    const totalBalance = getTotalActiveLoanBalance(e);
    const monthlyDeduct = getTotalMonthlyDeduction(e);
    const lastPaid = getLastPaymentDate(e);

    // Build loan mini section on the card
    let loanSection = '';
    if (activeLoans.length > 0) {
      const biggestLoan = activeLoans.reduce((a, b) => (b.amount > a.amount ? b : a), activeLoans[0]);
      const pct = getLoanRepaidPercent(biggestLoan);
      loanSection = `
        <div class="loan-mini-section">
          <div class="loan-mini-header">
            <div class="loan-mini-label"><i class="fa-solid fa-hand-holding-dollar"></i> Active Loan</div>
            <span class="badge badge-loan-active">${activeLoans.length} loan${activeLoans.length > 1 ? 's' : ''}</span>
          </div>
          <div class="loan-mini-header" style="margin-top:2px">
            <span style="font-size:0.78rem;color:var(--text3)">Balance remaining</span>
            <div class="loan-mini-balance">${formatCurrency(totalBalance)}</div>
          </div>
          <div class="loan-progress-track">
            <div class="loan-progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="loan-mini-meta">
            <span>${pct}% repaid</span>
            ${monthlyDeduct > 0 ? `<span>${formatCurrency(monthlyDeduct)}/mo deduction</span>` : '<span>Manual repayment</span>'}
          </div>
        </div>
      `;
    }

    return `
    <div class="emp-card" id="card-${e.id}">
      <div class="emp-card-header">
        <div class="emp-avatar-lg" style="background:rgba(var(--accent-rgb),0.15);color:var(--accent)">${getInitials(e.name)}</div>
        <div style="flex:1;min-width:0">
          <div class="emp-card-name" style="cursor:pointer;text-decoration:underline" onclick="openEmployeeProfile('${e.id}')">${esc(e.name)}</div>
          <div class="emp-card-role">${esc(e.role)}</div>
        </div>
        <div class="emp-card-actions">
          <div class="icon-btn loan-btn" onclick="openAddLoanModal('${e.id}')" title="Add Loan"><i class="fa-solid fa-hand-holding-dollar"></i></div>
          <div class="icon-btn" onclick="openEmployeeModal('${e.id}')" title="Edit"><i class="fa-solid fa-pen"></i></div>
          <div class="icon-btn delete" onclick="confirmDeleteEmployee('${e.id}')" title="Delete"><i class="fa-solid fa-trash"></i></div>
        </div>
      </div>
      <div class="emp-card-body">
        <div class="emp-detail">
          <span class="emp-detail-label"><i class="fa-solid fa-money-bill"></i> Salary</span>
          <span class="emp-detail-value">${formatCurrency(e.salary)} <span class="chip chip-${e.interval}">${e.interval}</span></span>
        </div>
        <div class="emp-detail">
          <span class="emp-detail-label"><i class="fa-solid fa-calendar"></i> Next Payment</span>
          <span class="emp-detail-value" style="font-size:0.82rem">${formatDate(calcNextPayment(e))}</span>
        </div>
        ${lastPaid ? `<div class="emp-detail">
          <span class="emp-detail-label"><i class="fa-solid fa-clock-rotate-left"></i> Last Paid</span>
          <span style="font-size:0.82rem;color:var(--green)">${formatDate(lastPaid)}</span>
        </div>` : ''}
        ${e.phone ? `<div class="emp-detail">
          <span class="emp-detail-label"><i class="fa-solid fa-phone"></i> Phone</span>
          <span class="emp-detail-value" style="font-size:0.82rem">${esc(e.phone)}</span>
        </div>` : ''}
        <div class="emp-detail">
          <span class="emp-detail-label"><i class="fa-solid fa-calendar-plus"></i> Added</span>
          <span style="font-size:0.82rem;color:var(--text2)">${formatDate(e.dateAdded)}</span>
        </div>
        <div class="emp-detail">
          <span class="emp-detail-label"><i class="fa-solid fa-circle-dot"></i> Status</span>
          <label class="pay-toggle" onclick="togglePaid('${e.id}')">
            <div class="toggle-track ${e.paid ? 'on' : ''}" id="toggle-${e.id}"><div class="toggle-thumb"></div></div>
            <span class="badge ${e.paid ? 'badge-paid' : 'badge-unpaid'}">${e.paid ? 'Paid ✅' : 'Pending ❌'}</span>
          </label>
        </div>
        ${loanSection}
      </div>
      ${e.notes ? `<div class="notes-preview" id="notes-prev-${e.id}" onclick="toggleNotesPreview('${e.id}')">${esc(e.notes)}</div>` : ''}
      ${activeLoans.length > 0 ? `<div class="emp-card-footer">
        <button class="btn btn-ghost btn-sm" style="color:var(--orange);border-color:rgba(251,146,60,0.3)" onclick="navigate('loans')"><i class="fa-solid fa-eye"></i> View Loans</button>
        <button class="btn btn-ghost btn-sm" onclick="openNoteModal('${e.id}')"><i class="fa-solid fa-pen"></i> Note</button>
      </div>` : `<div class="emp-card-footer">
        <button class="btn btn-ghost btn-sm" onclick="openNoteModal('${e.id}')"><i class="fa-solid fa-pen"></i> Note</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--orange)" onclick="openAddLoanModal('${e.id}')"><i class="fa-solid fa-plus"></i> Add Loan</button>
      </div>`}
    </div>
    `;
  }).join('');
}

/**
 * Renders list arrays as rows in tabular view.
 * @param {Array} list - Filtered list of employees.
 */
function renderTableView(list) {
  // Show / hide free plan limit banner
  _renderPlanLimitBanner();

  const tbody = document.getElementById('employees-tbody');
  const empty = document.getElementById('table-empty');
  if (list.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = '';
    document.querySelector('#page-employees .table-wrap table').style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  document.querySelector('#page-employees .table-wrap table').style.display = '';
  tbody.innerHTML = list.map(e => {
    const activeLoans = getActiveLoans(e);
    const totalBalance = getTotalActiveLoanBalance(e);
    return `
    <tr>
      <td>
        <div class="td-name" style="cursor:pointer;text-decoration:underline" onclick="openEmployeeProfile('${e.id}')">${esc(e.name)}</div>
        <div class="td-role">${esc(e.role)}</div>
      </td>
      <td><strong>${formatCurrency(e.salary)}</strong></td>
      <td><span class="chip chip-${e.interval}">${e.interval}${e.interval === 'custom' && e.customDays ? ' ('+e.customDays+'d)' : ''}</span></td>
      <td style="font-size:0.82rem">${formatDate(calcNextPayment(e))}</td>
      <td>
        <label class="pay-toggle" onclick="togglePaid('${e.id}')">
          <div class="toggle-track ${e.paid ? 'on' : ''}" id="toggle-t-${e.id}"><div class="toggle-thumb"></div></div>
          <span class="badge ${e.paid ? 'badge-paid' : 'badge-unpaid'}">${e.paid ? 'Paid' : 'Pending'}</span>
        </label>
      </td>
      <td style="font-size:0.82rem;color:var(--text2)">${e.phone ? esc(e.phone) : '—'}</td>
      <td>
        ${activeLoans.length > 0
          ? `<span class="badge badge-loan-active"><i class="fa-solid fa-hand-holding-dollar"></i> ${formatCurrency(totalBalance)}</span>`
          : `<span style="color:var(--text3);font-size:0.8rem">—</span>`
        }
      </td>
      <td>
        <div class="td-actions">
          <div class="icon-btn loan-btn" onclick="openAddLoanModal('${e.id}')" title="Add Loan"><i class="fa-solid fa-hand-holding-dollar"></i></div>
          <div class="icon-btn" onclick="openEmployeeModal('${e.id}')" title="Edit"><i class="fa-solid fa-pen"></i></div>
          <div class="icon-btn delete" onclick="confirmDeleteEmployee('${e.id}')" title="Delete"><i class="fa-solid fa-trash"></i></div>
        </div>
      </td>
    </tr>
    `;
  }).join('');
}

/**
 * Configures the current view selection display (card or table grid).
 * @param {string} view - View key ('card' or 'table').
 */
function setView(view) {
  currentView = view;
  document.getElementById('card-view-btn').classList.toggle('active', view === 'card');
  document.getElementById('table-view-btn').classList.toggle('active', view === 'table');
  document.getElementById('employees-card-view').style.display = view === 'card' ? '' : 'none';
  document.getElementById('employees-table-view').style.display = view === 'table' ? '' : 'none';
  renderEmployees();
}

/**
 * Triggers sorting data arrays by click listeners on table headers.
 * @param {string} col - Column name.
 */
function setSortTable(col) {
  if (tableSortCol === col) {
    tableSortDir = tableSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    tableSortCol = col;
    tableSortDir = 'asc';
  }
  const sortMap = { name: 'name-asc', role: 'name-asc', salary: 'salary-desc', status: 'date-desc' };
  document.getElementById('sort-by').value = tableSortDir === 'asc'
    ? (sortMap[col] || 'name-asc')
    : (col === 'salary' ? 'salary-asc' : 'name-desc');
  renderEmployees();
}

/**
 * Expands/collapses card notes previews.
 * @param {string} id - Employee ID.
 */
function toggleNotesPreview(id) {
  const el = document.getElementById('notes-prev-' + id);
  if (el) el.classList.toggle('expanded');
}

// =========================================================================
// FREE PLAN LIMIT BANNER
// =========================================================================

/**
 * Inserts or updates the free-plan limit warning banner above the employee grid.
 */
function _renderPlanLimitBanner() {
  const page = document.getElementById('page-employees');
  if (!page) return;

  // Remove any existing banner first
  const existing = document.getElementById('emp-plan-banner');
  if (existing) existing.remove();

  const isPro = isProUser();
  const count = employees.length;
  const limit = getEmployeeLimit();

  if (isPro) return; // Pro/Ultra users never see this

  const toolbar = page.querySelector('.toolbar');
  if (!toolbar) return;

  const banner = document.createElement('div');
  banner.id = 'emp-plan-banner';

  if (count >= limit) {
    // AT LIMIT — show hard block
    banner.className = 'plan-limit-banner plan-limit-full';
    banner.innerHTML = `
      <div class="plan-limit-content">
        <i class="fa-solid fa-lock"></i>
        <div>
          <strong>Employee limit reached (${count}/${limit})</strong>
          <span>Base plan allows up to ${limit} employees. Upgrade to Pro for unlimited.</span>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="navigate('upgrade')" style="white-space:nowrap;flex-shrink:0">
        <i class="fa-solid fa-gem"></i> Upgrade to Pro
      </button>
    `;
  } else {
    // BELOW LIMIT — show soft warning
    banner.className = 'plan-limit-banner plan-limit-warn';
    banner.innerHTML = `
      <div class="plan-limit-content">
        <i class="fa-solid fa-circle-info"></i>
        <div>
          <strong>Base Plan: ${count}/${limit} employees used</strong>
          <span>Upgrade to Pro for unlimited employees and premium features.</span>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="navigate('upgrade')" style="white-space:nowrap;flex-shrink:0;border-color:var(--accent);color:var(--accent)">
        <i class="fa-solid fa-gem"></i> Upgrade
      </button>
    `;
  }

  toolbar.insertAdjacentElement('afterend', banner);
}

// =========================================================================
// EMPLOYEE DETAILS FORM MODAL (ADD / EDIT)
// =========================================================================

/**
 * Opens form panel overlay and populates inputs for editing or cleans inputs for additions.
 * @param {string} [id] - Optional employee ID for editing mode.
 */
function openEmployeeModal(id) {
  // Block ADDING new employees on Base plan if at limit
  if (!id && !isProUser() && employees.length >= getEmployeeLimit()) {
    openPlanModal(
      'Base Plan Limit Reached',
      `You have reached the ${getEmployeeLimit()}-employee limit on the Base Plan. Upgrade to Pro for unlimited employees.`,
      'fa-users-slash',
      true
    );
    return;
  }

  const overlay = document.getElementById('emp-modal-overlay');
  overlay.classList.add('active');
  if (id) {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    document.getElementById('emp-modal-title').textContent = 'Edit Employee';
    document.getElementById('emp-id').value = emp.id;
    document.getElementById('emp-name').value = emp.name;
    document.getElementById('emp-role').value = emp.role;
    document.getElementById('emp-salary').value = emp.salary;
    document.getElementById('emp-interval').value = emp.interval;
    document.getElementById('emp-phone').value = emp.phone || '';
    document.getElementById('emp-paid').value = emp.paid ? 'paid' : 'unpaid';
    document.getElementById('emp-notes').value = emp.notes || '';
    document.getElementById('emp-custom-days').value = emp.customDays || '';
    document.getElementById('emp-payment-start').value = emp.paymentStartDate ? formatDateInput(emp.paymentStartDate) : '';
    if (document.getElementById('emp-branch')) {
      document.getElementById('emp-branch').value = emp.branch || '';
    }
    toggleCustomInterval();
  } else {
    document.getElementById('emp-modal-title').textContent = 'Add Employee';
    document.getElementById('emp-id').value = '';
    document.getElementById('emp-name').value = '';
    document.getElementById('emp-role').value = '';
    document.getElementById('emp-salary').value = '';
    document.getElementById('emp-interval').value = 'monthly';
    document.getElementById('emp-phone').value = '';
    document.getElementById('emp-paid').value = 'unpaid';
    document.getElementById('emp-notes').value = '';
    document.getElementById('emp-custom-days').value = '';
    document.getElementById('emp-payment-start').value = '';
    if (document.getElementById('emp-branch')) {
      const globalBranch = document.getElementById('global-branch-selector') ? document.getElementById('global-branch-selector').value : '';
      document.getElementById('emp-branch').value = globalBranch;
    }
    toggleCustomInterval();
  }
  
  if (isUltraUser() && document.getElementById('emp-branch-group')) {
    document.getElementById('emp-branch-group').style.display = '';
  } else if (document.getElementById('emp-branch-group')) {
    document.getElementById('emp-branch-group').style.display = 'none';
  }
  
  setTimeout(() => document.getElementById('emp-name').focus(), 100);
}

/**
 * Closes Employee form modal overlay.
 */
function closeEmployeeModal() {
  document.getElementById('emp-modal-overlay').classList.remove('active');
}

/**
 * Shows/hides sub-input fields for Custom interval days selection.
 */
function toggleCustomInterval() {
  const val = document.getElementById('emp-interval').value;
  document.getElementById('custom-interval-group').style.display = val === 'custom' ? '' : 'none';
}

// Bind custom interval handler
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('emp-interval').addEventListener('change', toggleCustomInterval);
});

/**
 * Validates form inputs and saves new or edited employee records.
 */
function saveEmployee() {
  const id = document.getElementById('emp-id').value;
  const name = document.getElementById('emp-name').value.trim();
  const role = document.getElementById('emp-role').value.trim();
  const salary = parseFloat(document.getElementById('emp-salary').value);
  const interval = document.getElementById('emp-interval').value;
  const customDays = document.getElementById('emp-custom-days').value;
  const paymentStartVal = document.getElementById('emp-payment-start').value;
  const phone = document.getElementById('emp-phone').value.trim();
  const paid = document.getElementById('emp-paid').value === 'paid';
  const notes = document.getElementById('emp-notes').value.trim();
  const branchEl = document.getElementById('emp-branch');
  const branch = (isUltraUser() && branchEl) ? branchEl.value : null;

  // Enforce Base plan employee limits (max 25)
  if (!id && !isProUser() && employees.length >= getEmployeeLimit()) {
    openPlanModal(
      'Base Plan Limit Reached',
      `You have reached the ${getEmployeeLimit()}-employee limit on the Base Plan. Upgrade to Pro for unlimited employees.`,
      'fa-users-slash',
      true
    );
    closeEmployeeModal();
    return;
  }

  if (!name) { showToast('Name is required.', 'error'); return; }
  if (!role) { showToast('Role is required.', 'error'); return; }
  if (isNaN(salary) || salary < 0) { showToast('Please enter a valid salary.', 'error'); return; }
  if (interval === 'custom' && (!customDays || parseInt(customDays) < 1)) {
    showToast('Please enter valid custom interval days.', 'error');
    return;
  }

  const paymentStartDate = parseInputDate(paymentStartVal);

  if (id) {
    const idx = employees.findIndex(e => e.id === id);
    if (idx > -1) {
      employees[idx] = { ...employees[idx], name, role, salary, interval, customDays: customDays || null, phone, paid, notes, branch, paymentStartDate };
      showToast('Employee updated successfully.', 'success');
    }
  } else {
    employees.unshift({ id: uid(), name, role, salary, interval, customDays: customDays || null, phone, paid, notes, branch, dateAdded: Date.now(), loans: [], payments: [], paymentStartDate });
    showToast(`${name} added to the team!`, 'success');
  }

  saveEmployees(currentUser.email, employees);
  closeEmployeeModal();

  if (currentPage === 'employees') renderEmployees();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'salary') renderSalary();
  if (currentPage === 'notes') renderNotes();
  if (currentPage === 'loans') renderLoans();
  updateLoanBadge();
}

// =========================================================================
// DELETIONS
// =========================================================================

/**
 * Triggers confirmation overlay warning alert prior to employee removal.
 * @param {string} id - Employee ID.
 */
function confirmDeleteEmployee(id) {
  const emp = employees.find(e => e.id === id);
  if (!emp) return;
  openConfirm(
    'Delete Employee',
    `Remove <strong>${esc(emp.name)}</strong> from the system? This cannot be undone.`,
    'Delete',
    () => deleteEmployee(id)
  );
}

/**
 * Removes an employee record with fadeout animations.
 * @param {string} id - Employee ID.
 */
function deleteEmployee(id) {
  const emp = employees.find(e => e.id === id);
  const card = document.getElementById('card-' + id);
  if (card) {
    card.classList.add('remove-anim');
    setTimeout(() => {
      employees = employees.filter(e => e.id !== id);
      saveEmployees(currentUser.email, employees);
      renderEmployees();
      if (currentPage === 'dashboard') renderDashboard();
      if (currentPage === 'salary') renderSalary();
      if (currentPage === 'notes') renderNotes();
      if (currentPage === 'loans') renderLoans();
      updateLoanBadge();
    }, 280);
  } else {
    employees = employees.filter(e => e.id !== id);
    saveEmployees(currentUser.email, employees);
    renderEmployees();
    if (currentPage === 'loans') renderLoans();
    updateLoanBadge();
  }
  showToast(emp ? `${emp.name} removed.` : 'Employee deleted.', 'info');
}

// =========================================================================
// NOTES PAGE & NOTE DIALOG MODAL
// =========================================================================

/**
 * Renders all employees notes as simple grid notes cards.
 */
function renderNotes() {
  const grid = document.getElementById('notes-grid');
  const empty = document.getElementById('notes-empty');
  const emps = getFilteredEmployees();
  if (emps.length === 0) {
    grid.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = emps.map(e => `
    <div class="note-card" id="note-card-${e.id}">
      <div class="note-card-header">
        <div class="recent-avatar" style="width:36px;height:36px;font-size:0.8rem;flex-shrink:0">${getInitials(e.name)}</div>
        <div>
          <div class="note-card-name">${esc(e.name)}</div>
          <div class="note-card-role">${esc(e.role)}</div>
        </div>
      </div>
      <div class="note-text ${e.notes ? '' : 'empty'}">${e.notes ? esc(e.notes) : 'No notes yet. Click edit to add.'}</div>
      <div class="note-card-footer">
        <button class="btn btn-ghost btn-sm" onclick="openNoteModal('${e.id}')"><i class="fa-solid fa-pen"></i> Edit Note</button>
      </div>
    </div>
  `).join('');
}

/**
 * Opens the specific note dialog box modal and focuses content editor.
 * @param {string} id - Employee ID.
 */
function openNoteModal(id) {
  const emp = employees.find(e => e.id === id);
  if (!emp) return;
  document.getElementById('note-modal-name').textContent = emp.name + ' — Notes';
  document.getElementById('note-emp-id').value = id;
  document.getElementById('note-text').value = emp.notes || '';
  document.getElementById('note-modal-overlay').classList.add('active');
  setTimeout(() => document.getElementById('note-text').focus(), 100);
}

/**
 * Closes the active Note modal.
 */
function closeNoteModal() {
  document.getElementById('note-modal-overlay').classList.remove('active');
}

/**
 * Saves edited notes descriptions, updates localStorage datasets, and updates page lists.
 */
function saveNote() {
  const id = document.getElementById('note-emp-id').value;
  const text = document.getElementById('note-text').value.trim();
  const idx = employees.findIndex(e => e.id === id);
  if (idx === -1) return;
  employees[idx].notes = text;
  saveEmployees(currentUser.email, employees);
  closeNoteModal();
  renderNotes();
  if (currentPage === 'employees') renderEmployees();
  showToast('Note saved!', 'success');
}

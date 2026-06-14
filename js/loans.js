/**
 * loans.js
 * Controls employee loans calculations, payment logs, outstanding balances,
 * add loan forms, and detailed repayment history modules.
 */

// =========================================================================
// LOAN CALCULATION HELPERS
// =========================================================================

/**
 * Filter list of active loans associated with an employee.
 * @param {Object} emp - Employee object.
 * @returns {Array} List of active loans.
 */
function getActiveLoans(emp) {
  return (emp.loans || []).filter(l => l.status === 'active');
}

/**
 * Calculates sum outstanding loan balances for an employee.
 * @param {Object} emp - Employee object.
 * @returns {number} Sum value remaining.
 */
function getTotalActiveLoanBalance(emp) {
  return getActiveLoans(emp).reduce((s, l) => s + (parseFloat(l.remainingBalance) || 0), 0);
}

/**
 * Calculates sum monthly auto deduction amounts for active loans of an employee.
 * @param {Object} emp - Employee object.
 * @returns {number} Monthly deduction sum.
 */
function getTotalMonthlyDeduction(emp) {
  return getActiveLoans(emp)
    .filter(l => l.repaymentType === 'fixed')
    .reduce((s, l) => s + (parseFloat(l.monthlyDeduction) || 0), 0);
}

/**
 * Determines estimated target date of next repayment obligation (typically 1 month after last).
 * @param {Object} loan - Loan object.
 * @returns {Date} Date of next expected repayment.
 */
function calcNextRepaymentDate(loan) {
  const history = loan.repaymentHistory || [];
  if (history.length === 0) {
    const d = new Date(loan.dateGiven);
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  const lastDate = Math.max(...history.map(h => h.date));
  const d = new Date(lastDate);
  d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Calculates the total repaid amount of a loan.
 * @param {Object} loan - Loan object.
 * @returns {number} Repaid amount.
 */
function getLoanRepaidAmount(loan) {
  return (parseFloat(loan.amount) || 0) - (parseFloat(loan.remainingBalance) || 0);
}

/**
 * Calculates percentage of original loan amount that has been repaid.
 * @param {Object} loan - Loan object.
 * @returns {number} Percentage (0-100).
 */
function getLoanRepaidPercent(loan) {
  const original = parseFloat(loan.amount) || 0;
  if (original === 0) return 100;
  const repaid = getLoanRepaidAmount(loan);
  return Math.min(100, Math.round((repaid / original) * 100));
}

/**
 * Aggregates statistics of total loans, totals repaid, and employees counts.
 * @returns {Object} Structured data dictionary of values.
 */
function getLoanStats() {
  let totalIssued = 0, totalOutstanding = 0, totalActive = 0, totalCompleted = 0, totalLoans = 0;
  const employeesWithLoans = new Set();
  const allLoans = [];

  employees.forEach(e => {
    (e.loans || []).forEach(l => {
      totalLoans++;
      totalIssued += parseFloat(l.amount) || 0;
      if (l.status === 'active') {
        totalActive++;
        totalOutstanding += parseFloat(l.remainingBalance) || 0;
        employeesWithLoans.add(e.id);
      } else {
        totalCompleted++;
      }
      allLoans.push({ loan: l, emp: e });
    });
  });

  return {
    totalIssued,
    totalOutstanding,
    totalActive,
    totalCompleted,
    totalLoans,
    employeeCount: employeesWithLoans.size,
    allLoans
  };
}

// =========================================================================
// LOANS PAGE RENDERING
// =========================================================================

/**
 * Changes active tab selection for loans display (all, active, completed).
 * @param {string} filter - Filter key tab.
 */
function setLoanFilter(filter) {
  currentLoanFilter = filter;
  document.querySelectorAll('.loan-filter-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('loan-tab-' + filter).classList.add('active');
  renderLoans();
}

/**
 * Renders statistical cards, employee select filters, and cards grid list of loans.
 */
function renderLoans() {
  // Populate employee select dropdown filter dynamically
  const empSelect = document.getElementById('loan-filter-emp');
  const prevVal = empSelect.value;
  empSelect.innerHTML = '<option value="">All Employees</option>' +
    employees.filter(e => (e.loans || []).length > 0).map(e =>
      `<option value="${e.id}">${esc(e.name)}</option>`
    ).join('');
  empSelect.value = prevVal;

  const filterEmp = empSelect.value;
  const ls = getLoanStats();

  // Update loan statistics cards UI elements
  document.getElementById('loans-stat-total').innerHTML = `<span class="currency">${getCurrencySymbol()}</span>${ls.totalIssued.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
  document.getElementById('loans-stat-count').textContent = ls.totalLoans + ' loan' + (ls.totalLoans !== 1 ? 's' : '') + ' issued';
  document.getElementById('loans-stat-outstanding').innerHTML = `<span class="currency">${getCurrencySymbol()}</span>${ls.totalOutstanding.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
  document.getElementById('loans-stat-active').textContent = ls.totalActive;
  document.getElementById('loans-stat-completed').textContent = ls.totalCompleted;

  // Build flat array list of loans with parent employee references
  const allLoans = getLoans().filter(({ loan, emp }) => {
    if (filterEmp && emp.id !== filterEmp) return false;
    if (currentLoanFilter === 'active' && loan.status !== 'active') return false;
    if (currentLoanFilter === 'completed' && loan.status !== 'completed') return false;
    return true;
  });

  allLoans.sort((a, b) => b.loan.dateGiven - a.loan.dateGiven);

  const grid = document.getElementById('loans-grid');
  const empty = document.getElementById('loans-empty');

  if (allLoans.length === 0) {
    grid.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = allLoans.map(({ loan, emp }) => {
    const pct = getLoanRepaidPercent(loan);
    const repaidAmt = getLoanRepaidAmount(loan);
    const nextRepay = loan.status === 'active' ? calcNextRepaymentDate(loan) : null;

    return `
    <div class="loan-card ${loan.status === 'completed' ? 'completed' : ''}">
      <div class="loan-card-header">
        <div class="recent-avatar" style="background:rgba(251,146,60,0.15);color:var(--orange);flex-shrink:0">${getInitials(emp.name)}</div>
        <div class="loan-card-info">
          <div class="loan-card-name">${esc(emp.name)}</div>
          <div class="loan-card-role">${esc(emp.role)}</div>
          ${loan.reason ? `<div style="font-size:0.76rem;color:var(--text2);margin-top:2px;font-style:italic">${esc(loan.reason)}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="loan-card-amount">${formatCurrency(loan.amount)}</div>
          <span class="badge ${loan.status === 'active' ? 'badge-loan-active' : 'badge-loan-completed'}" style="margin-top:4px">
            ${loan.status === 'active' ? '● Active' : '✅ Completed'}
          </span>
        </div>
      </div>

      <div class="loan-card-body">
        <div class="loan-progress-section">
          <div class="loan-progress-header">
            <span>${formatCurrency(repaidAmt)} repaid</span>
            <span class="loan-progress-pct">${pct}%</span>
          </div>
          <div class="loan-progress-bar-track">
            <div class="loan-progress-bar-fill ${loan.status === 'completed' ? 'loan-done' : ''}" style="width:${pct}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.74rem;color:var(--text3);margin-top:3px">
            <span>${getCurrencySymbol()}0</span>
            <span style="color:${loan.status === 'active' ? 'var(--orange)' : 'var(--green)'}">${formatCurrency(loan.remainingBalance)} remaining</span>
            <span>${formatCurrency(loan.amount)}</span>
          </div>
        </div>

        <div class="loan-meta-grid">
          <div class="loan-meta-item">
            <div class="loan-meta-key">Date Given</div>
            <div class="loan-meta-val">${formatDate(loan.dateGiven)}</div>
          </div>
          <div class="loan-meta-item">
            <div class="loan-meta-key">Repayment Type</div>
            <div class="loan-meta-val">${loan.repaymentType === 'fixed' ? 'Fixed Monthly' : 'Manual'}</div>
          </div>
          ${loan.repaymentType === 'fixed' && loan.monthlyDeduction > 0 ? `
          <div class="loan-meta-item">
            <div class="loan-meta-key">Monthly Deduct.</div>
            <div class="loan-meta-val" style="color:var(--orange)">${formatCurrency(loan.monthlyDeduction)}</div>
          </div>` : ''}
          ${nextRepay ? `
          <div class="loan-meta-item">
            <div class="loan-meta-key">Next Repayment</div>
            <div class="loan-meta-val">${formatDate(nextRepay)}</div>
          </div>` : ''}
          <div class="loan-meta-item">
            <div class="loan-meta-key">Repayments</div>
            <div class="loan-meta-val">${(loan.repaymentHistory || []).length} records</div>
          </div>
          ${loan.status === 'completed' ? `
          <div class="loan-meta-item">
            <div class="loan-meta-key">Status</div>
            <div class="loan-meta-val" style="color:var(--green)">Fully Repaid ✅</div>
          </div>` : ''}
        </div>
      </div>

      <div class="loan-card-footer">
        <button class="btn btn-ghost btn-sm" onclick="openLoanHistoryModal('${loan.id}','${emp.id}')">
          <i class="fa-solid fa-clock-rotate-left"></i> History
        </button>
        ${loan.status === 'active' ? `<button class="btn btn-success btn-sm" onclick="openLoanHistoryModal('${loan.id}','${emp.id}')">
          <i class="fa-solid fa-plus"></i> Repayment
        </button>` : ''}
      </div>
    </div>
    `;
  }).join('');
}

// =========================================================================
// ADD LOAN DIALOG MODAL
// =========================================================================

/**
 * Prepares forms inputs and displays Add Loan modal layout overlay.
 * @param {string} [preselectedEmpId] - Optional pre-selected employee ID.
 */
function openAddLoanModal(preselectedEmpId) {
  // Populate employee select dropdown dynamically
  const sel = document.getElementById('loan-employee-select');
  sel.innerHTML = '<option value="">— Select Employee —</option>' +
    employees.map(e => `<option value="${e.id}">${esc(e.name)} — ${esc(e.role)}</option>`).join('');

  if (preselectedEmpId) {
    sel.value = preselectedEmpId;
    document.getElementById('loan-emp-id').value = preselectedEmpId;
  } else {
    document.getElementById('loan-emp-id').value = '';
  }

  // Reset inputs
  document.getElementById('loan-amount').value = '';
  document.getElementById('loan-date').value = formatDateInput(Date.now());
  document.getElementById('loan-reason').value = '';
  document.getElementById('loan-repay-type').value = 'fixed';
  document.getElementById('loan-monthly-deduction').value = '';
  toggleLoanRepayFields();

  document.getElementById('loan-modal-overlay').classList.add('active');
  setTimeout(() => document.getElementById('loan-amount').focus(), 150);
}

/**
 * Closes Add Loan modal.
 */
function closeAddLoanModal() {
  document.getElementById('loan-modal-overlay').classList.remove('active');
}

/**
 * Syncs the hidden employee ID input with selections in the dropdown list.
 */
function updateLoanEmployeeId() {
  const val = document.getElementById('loan-employee-select').value;
  document.getElementById('loan-emp-id').value = val;
}

/**
 * Displays/hides fixed monthly deduction input boxes.
 */
function toggleLoanRepayFields() {
  const type = document.getElementById('loan-repay-type').value;
  document.getElementById('loan-monthly-group').style.display = type === 'fixed' ? '' : 'none';
}

/**
 * Saves the new loan configuration to matches employee.
 */
function saveLoan() {
  const empId = document.getElementById('loan-emp-id').value;
  const amount = parseFloat(document.getElementById('loan-amount').value);
  const dateStr = document.getElementById('loan-date').value;
  const reason = document.getElementById('loan-reason').value.trim();
  const repaymentType = document.getElementById('loan-repay-type').value;
  const monthlyDeduction = parseFloat(document.getElementById('loan-monthly-deduction').value) || 0;

  if (!empId) { showToast('Please select an employee.', 'error'); return; }
  if (isNaN(amount) || amount <= 0) { showToast('Please enter a valid loan amount.', 'error'); return; }
  if (!dateStr) { showToast('Please select a date.', 'error'); return; }
  if (repaymentType === 'fixed' && (isNaN(monthlyDeduction) || monthlyDeduction <= 0)) {
    showToast('Please enter a valid monthly deduction amount.', 'error'); return;
  }
  if (repaymentType === 'fixed' && monthlyDeduction > amount) {
    showToast('Monthly deduction cannot exceed loan amount.', 'error'); return;
  }

  const idx = employees.findIndex(e => e.id === empId);
  if (idx === -1) { showToast('Employee not found.', 'error'); return; }

  const newLoan = {
    id: uid(),
    amount,
    dateGiven: new Date(dateStr).getTime(),
    reason,
    repaymentType,
    monthlyDeduction: repaymentType === 'fixed' ? monthlyDeduction : 0,
    remainingBalance: amount,
    status: 'active',
    repaymentHistory: []
  };

  if (!employees[idx].loans) employees[idx].loans = [];
  employees[idx].loans.push(newLoan);

  saveEmployees(currentUser.email, employees);
  closeAddLoanModal();

  if (currentPage === 'employees') renderEmployees();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'loans') renderLoans();
  if (currentPage === 'salary') renderSalary();
  updateLoanBadge();

  showToast(`Loan of ${formatCurrency(amount)} added for ${employees[idx].name}!`, 'success');
}

// =========================================================================
// LOAN REPAYMENT HISTORY DETAIL MODAL
// =========================================================================

/**
 * Prepares content details and displays the loan detailed log sheet.
 * @param {string} loanId - Loan ID.
 * @param {string} empId - Employee ID.
 */
function openLoanHistoryModal(loanId, empId) {
  const emp = employees.find(e => e.id === empId);
  if (!emp) return;
  const loan = (emp.loans || []).find(l => l.id === loanId);
  if (!loan) return;

  document.getElementById('lh-loan-id').value = loanId;
  document.getElementById('lh-emp-id').value = empId;
  document.getElementById('lh-modal-title').textContent = `Loan — ${emp.name}`;

  // Set default parameters
  document.getElementById('lh-repay-date').value = formatDateInput(Date.now());
  document.getElementById('lh-repay-amount').value = loan.repaymentType === 'fixed' ? loan.monthlyDeduction : '';
  document.getElementById('lh-repay-note').value = '';

  renderLoanHistoryContent(loan, emp);
  document.getElementById('loan-history-overlay').classList.add('active');
}

/**
 * Loads values and layout templates into repayment log screens.
 * @param {Object} loan - Loan object.
 * @param {Object} emp - Employee object.
 */
function renderLoanHistoryContent(loan, emp) {
  const pct = getLoanRepaidPercent(loan);
  const repaidAmt = getLoanRepaidAmount(loan);
  const nextRepay = loan.status === 'active' ? calcNextRepaymentDate(loan) : null;

  // Render hero template
  const heroEl = document.getElementById('lh-hero');
  heroEl.innerHTML = `
    <div class="loan-detail-hero-top">
      <div>
        <div class="loan-detail-emp-name">${esc(emp.name)}</div>
        <div class="loan-detail-reason">${loan.reason ? esc(loan.reason) : 'No reason specified'} · ${formatDate(loan.dateGiven)}</div>
      </div>
      <span class="badge ${loan.status === 'active' ? 'badge-loan-active' : 'badge-loan-completed'}" style="font-size:0.85rem;padding:5px 12px">
        ${loan.status === 'active' ? '● Active' : '✅ Completed'}
      </span>
    </div>
    <div class="loan-detail-amounts">
      <div class="loan-detail-amt-item">
        <div class="loan-detail-amt-key">Original Amount</div>
        <div class="loan-detail-amt-val">${formatCurrency(loan.amount)}</div>
      </div>
      <div class="loan-detail-amt-item">
        <div class="loan-detail-amt-key">Remaining</div>
        <div class="loan-detail-amt-val ${loan.status === 'active' ? 'highlight' : 'done'}">${formatCurrency(loan.remainingBalance)}</div>
      </div>
      <div class="loan-detail-amt-item">
        <div class="loan-detail-amt-key">Repaid</div>
        <div class="loan-detail-amt-val" style="color:var(--green)">${formatCurrency(repaidAmt)}</div>
      </div>
      ${loan.repaymentType === 'fixed' && loan.monthlyDeduction > 0 ? `
      <div class="loan-detail-amt-item">
        <div class="loan-detail-amt-key">Monthly Deduct.</div>
        <div class="loan-detail-amt-val" style="color:var(--orange)">${formatCurrency(loan.monthlyDeduction)}</div>
      </div>` : ''}
      ${nextRepay && loan.status === 'active' ? `
      <div class="loan-detail-amt-item">
        <div class="loan-detail-amt-key">Next Repayment</div>
        <div class="loan-detail-amt-val" style="font-size:0.9rem">${formatDate(nextRepay)}</div>
      </div>` : ''}
    </div>
  `;

  // Render progress bars
  const progressEl = document.getElementById('lh-progress-section');
  progressEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:0.82rem;color:var(--text2);margin-bottom:6px">
      <span>Repayment Progress</span>
      <strong style="color:${loan.status === 'active' ? 'var(--orange)' : 'var(--green)'}">${pct}% repaid</strong>
    </div>
    <div class="loan-progress-bar-track" style="height:10px">
      <div class="loan-progress-bar-fill ${loan.status === 'completed' ? 'loan-done' : ''}" style="width:${pct}%;transition:width 0.8s ease"></div>
    </div>
  `;

  // Render repayment log ledger
  const logEl = document.getElementById('lh-repay-log');
  const history = [...(loan.repaymentHistory || [])].sort((a, b) => b.date - a.date);
  if (history.length === 0) {
    logEl.innerHTML = `<div class="repay-empty"><i class="fa-solid fa-inbox" style="display:block;font-size:1.5rem;margin-bottom:8px;opacity:0.4"></i>No repayments recorded yet.</div>`;
  } else {
    logEl.innerHTML = history.map(h => `
      <div class="repay-log-item">
        <div>
          <div class="repay-log-date">${formatDate(h.date)}</div>
          ${h.note ? `<div class="repay-log-note">${esc(h.note)}</div>` : ''}
        </div>
        <div class="repay-log-amount">+${formatCurrency(h.amount)}</div>
      </div>
    `).join('');
  }

  // Display repayment controls if active
  const addSection = document.getElementById('lh-add-repayment-section');
  addSection.style.display = loan.status === 'active' ? '' : 'none';
}

/**
 * Closes Loan Repayments history modal.
 */
function closeLoanHistoryModal() {
  document.getElementById('loan-history-overlay').classList.remove('active');
}

/**
 * Validates repayment fields and logs the transaction.
 */
function submitRepayment() {
  const loanId = document.getElementById('lh-loan-id').value;
  const empId = document.getElementById('lh-emp-id').value;
  const amount = parseFloat(document.getElementById('lh-repay-amount').value);
  const dateStr = document.getElementById('lh-repay-date').value;
  const note = document.getElementById('lh-repay-note').value.trim();

  if (isNaN(amount) || amount <= 0) { showToast('Please enter a valid repayment amount.', 'error'); return; }
  if (!dateStr) { showToast('Please select a date.', 'error'); return; }

  const empIdx = employees.findIndex(e => e.id === empId);
  if (empIdx === -1) return;
  const loanIdx = (employees[empIdx].loans || []).findIndex(l => l.id === loanId);
  if (loanIdx === -1) return;

  const loan = employees[empIdx].loans[loanIdx];

  // Prevent overpayment
  const actualAmount = Math.min(amount, parseFloat(loan.remainingBalance) || 0);
  if (actualAmount <= 0) { showToast('Loan is already fully repaid.', 'error'); return; }

  // Append history object
  if (!loan.repaymentHistory) loan.repaymentHistory = [];
  loan.repaymentHistory.push({
    id: uid(),
    date: new Date(dateStr).getTime(),
    amount: actualAmount,
    note
  });

  // Calculate new balance
  loan.remainingBalance = Math.max(0, (parseFloat(loan.remainingBalance) || 0) - actualAmount);

  // Complete status trigger if fully repaid
  if (loan.remainingBalance <= 0) {
    loan.remainingBalance = 0;
    loan.status = 'completed';
    showToast(`Loan fully repaid! 🎉 ${employees[empIdx].name}'s loan is now complete.`, 'success');
  } else {
    showToast(`Repayment of ${formatCurrency(actualAmount)} recorded!`, 'success');
  }

  employees[empIdx].loans[loanIdx] = loan;
  saveEmployees(currentUser.email, employees);

  // Reload history logs layout
  renderLoanHistoryContent(loan, employees[empIdx]);

  // Clean inputs
  document.getElementById('lh-repay-amount').value = loan.repaymentType === 'fixed' ? loan.monthlyDeduction : '';
  document.getElementById('lh-repay-note').value = '';

  // Trigger list re-renders
  if (currentPage === 'employees') renderEmployees();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'loans') renderLoans();
  if (currentPage === 'salary') renderSalary();
  updateLoanBadge();
}

/**
 * Triggers delete confirmations alert dialog.
 */
function confirmDeleteLoan() {
  const loanId = document.getElementById('lh-loan-id').value;
  const empId = document.getElementById('lh-emp-id').value;
  const emp = employees.find(e => e.id === empId);
  openConfirm(
    'Delete Loan',
    `Remove this loan record for <strong>${emp ? esc(emp.name) : 'this employee'}</strong>? All repayment history will be lost.`,
    'Delete Loan',
    () => {
      const idx = employees.findIndex(e => e.id === empId);
      if (idx > -1) {
        employees[idx].loans = (employees[idx].loans || []).filter(l => l.id !== loanId);
        saveEmployees(currentUser.email, employees);
      }
      closeLoanHistoryModal();
      if (currentPage === 'employees') renderEmployees();
      if (currentPage === 'dashboard') renderDashboard();
      if (currentPage === 'loans') renderLoans();
      if (currentPage === 'salary') renderSalary();
      updateLoanBadge();
      showToast('Loan deleted.', 'info');
    }
  );
}

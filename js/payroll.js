/**
 * payroll.js
 * Tracks employee salary histories, payroll projections, deductions, and batch pay operations.
 */

// =========================================================================
// PAYROLL CALCULATION HELPERS
// =========================================================================

/**
 * Calculates next salary payout deadline based on dateAdded and intervals configuration.
 * @param {Object} emp - Employee object.
 * @returns {Date} Target deadline date.
 */
function calcNextPayment(emp) {
  const now = new Date();
  
  // Use paymentStartDate if set, otherwise fallback to dateAdded
  const baseDate = emp.paymentStartDate ? new Date(emp.paymentStartDate) : new Date(emp.dateAdded);
  
  let days = 30;
  if (emp.interval === 'weekly') days = 7;
  else if (emp.interval === 'daily') days = 1;
  else if (emp.interval === 'custom' && emp.customDays) days = parseInt(emp.customDays);

  let next = new Date(baseDate);
  // If the base date is in the future, the next payment is simply the base date.
  if (next > now) {
    return next;
  }
  
  // Otherwise, advance by the interval until it is in the future
  while (next <= now) {
    next.setDate(next.getDate() + days);
  }
  return next;
}

/**
 * Normalizes custom payment structures to standard monthly equivalents.
 * @param {Object} emp - Employee object.
 * @returns {number} Monthly salary equivalence amount.
 */
function calcMonthlyEquivalent(emp) {
  const s = parseFloat(emp.salary) || 0;
  if (emp.interval === 'daily') return s * 30;
  if (emp.interval === 'weekly') return s * 4.33;
  if (emp.interval === 'custom' && emp.customDays) return s * (30 / parseInt(emp.customDays));
  return s;
}

/**
 * Resolves simple estimated payout amounts since employee registration.
 * @param {Object} emp - Employee object.
 * @returns {number} Sum value estimate.
 */
function estimateTotalPaid(emp) {
  const added = new Date(emp.dateAdded);
  const now = new Date();
  const diffDays = Math.floor((now - added) / 86400000);
  let periods = 0;
  if (emp.interval === 'daily') periods = diffDays;
  else if (emp.interval === 'weekly') periods = Math.floor(diffDays / 7);
  else if (emp.interval === 'monthly') periods = Math.floor(diffDays / 30);
  else if (emp.interval === 'custom' && emp.customDays) periods = Math.floor(diffDays / parseInt(emp.customDays));
  return (parseFloat(emp.salary) || 0) * periods;
}

/**
 * Evaluates the timestamp date of last payment entry recorded in payouts list.
 * @param {Object} emp - Employee object.
 * @returns {number|null} Timestamp or null.
 */
function getLastPaymentDate(emp) {
  const payments = emp.payments || [];
  if (payments.length === 0) return null;
  return Math.max(...payments.map(p => p.date));
}

// =========================================================================
// SINGLE RECORD TOGGLE
// =========================================================================

/**
 * Toggles status values (paid/unpaid), appends payments ledger logs, and updates layouts.
 * @param {string} id - Employee ID.
 */
function togglePaid(id) {
  const idx = employees.findIndex(e => e.id === id);
  if (idx === -1) return;
  employees[idx].paid = !employees[idx].paid;

  // Record payment history when marking as paid
  if (employees[idx].paid) {
    if (!employees[idx].payments) employees[idx].payments = [];
    const loanDeduct = getTotalMonthlyDeduction(employees[idx]);
    const attnDetails = getAttendanceSalaryDetails(employees[idx]);
    const finalNetPay = Math.max(0, attnDetails.netSalary - loanDeduct);
    employees[idx].payments.push({
      id: uid(),
      date: Date.now(),
      amount: finalNetPay
    });
    logActivity(`Salary paid to ${employees[idx].name} (${formatCurrency(finalNetPay)})`);
  }

  saveEmployees(currentUser.email, employees);

  // Update toggle UI elements directly without running full list re-renders
  const toggleEls = [
    document.getElementById('toggle-' + id),
    document.getElementById('toggle-t-' + id),
    document.getElementById('sal-toggle-' + id)
  ];
  toggleEls.forEach(el => {
    if (el) el.classList.toggle('on', employees[idx].paid);
  });

  // Update badges in cards
  const card = document.getElementById('card-' + id);
  if (card) {
    const badge = card.querySelector('.badge');
    if (badge) {
      badge.className = 'badge ' + (employees[idx].paid ? 'badge-paid' : 'badge-unpaid');
      badge.textContent = employees[idx].paid ? 'Paid ✅' : 'Pending ❌';
    }
  }

  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'salary') renderSalary();
  if (currentPage === 'employees') renderEmployees();

  showToast(employees[idx].name + ' marked as ' + (employees[idx].paid ? 'Paid ✅' : 'Unpaid ❌'), 'success');
}

// =========================================================================
// SALARY PAGE RENDER
// =========================================================================

/**
 * Renders statistical indicators and tabular ledger lists on the Salary Tracker page.
 */
function renderSalary() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let paidAmt = 0;
  let pendingAmt = 0;
  let totalAmt = 0;
  let totalDeductions = 0;
  const emps = getFilteredEmployees();

  emps.forEach(e => {
    const loanDeduct = getTotalMonthlyDeduction(e);
    const attnDetails = getAttendanceSalaryDetails(e, year, month);
    const finalNetPay = Math.max(0, attnDetails.netSalary - loanDeduct);

    if (e.paid) {
      paidAmt += finalNetPay;
    } else {
      pendingAmt += finalNetPay;
    }
    totalAmt += finalNetPay;
    totalDeductions += loanDeduct + attnDetails.deduction;
  });

  document.getElementById('sal-paid').innerHTML = `<span class="currency">${getCurrencySymbol()}</span>${paidAmt.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
  document.getElementById('sal-paid-n').textContent = emps.filter(e => e.paid).length + ' employee' + (emps.filter(e => e.paid).length !== 1 ? 's' : '');
  document.getElementById('sal-pending').innerHTML = `<span class="currency">${getCurrencySymbol()}</span>${pendingAmt.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
  document.getElementById('sal-pending-n').textContent = emps.filter(e => !e.paid).length + ' employee' + (emps.filter(e => !e.paid).length !== 1 ? 's' : '');
  document.getElementById('sal-total').innerHTML = `<span class="currency">${getCurrencySymbol()}</span>${totalAmt.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
  document.getElementById('sal-deductions').innerHTML = `<span class="currency">${getCurrencySymbol()}</span>${totalDeductions.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`;

  const tbody = document.getElementById('salary-tbody');
  const empty = document.getElementById('salary-empty');

  if (emps.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = emps.map(e => {
    const loanDeduct = getTotalMonthlyDeduction(e);
    const attnDetails = getAttendanceSalaryDetails(e, year, month);
    const netPay = Math.max(0, attnDetails.netSalary - loanDeduct);
    const lastPaid = getLastPaymentDate(e);
    return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="recent-avatar" style="width:34px;height:34px;font-size:0.8rem">${getInitials(e.name)}</div>
          <div>
            <div class="td-name" style="cursor:pointer;text-decoration:underline" onclick="openEmployeeProfile('${e.id}')">${esc(e.name)}</div>
            <div class="td-role">${esc(e.role)}</div>
          </div>
        </div>
      </td>
      <td><strong>${formatCurrency(e.salary)}</strong></td>
      <td class="deduction-cell">${attnDetails.deduction > 0 ? '−' + formatCurrency(attnDetails.deduction) : '<span style="color:var(--text3)">—</span>'}</td>
      <td class="deduction-cell">${loanDeduct > 0 ? '−' + formatCurrency(loanDeduct) : '<span style="color:var(--text3)">—</span>'}</td>
      <td class="net-pay-cell">${formatCurrency(netPay)}</td>
      <td><span class="chip chip-${e.interval}">${e.interval}${e.interval==='custom'&&e.customDays?' ('+e.customDays+'d)':''}</span></td>
      <td style="font-size:0.82rem">${formatDate(calcNextPayment(e))}</td>
      <td style="font-size:0.78rem;color:var(--text2)">${lastPaid ? formatDate(lastPaid) : '—'}</td>
      <td><span class="badge ${e.paid?'badge-paid':'badge-unpaid'}">${e.paid?'Paid ✅':'Pending ❌'}</span></td>
      <td>
        <label class="pay-toggle" onclick="togglePaid('${e.id}')">
          <div class="toggle-track ${e.paid?'on':''}" id="sal-toggle-${e.id}"><div class="toggle-thumb"></div></div>
        </label>
      </td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openSalarySlipModal('${e.id}')" title="View Salary Slip">
          <i class="fa-solid fa-file-invoice"></i> View
        </button>
      </td>
    </tr>
    `;
  }).join('');
}

// =========================================================================
// BATCH ACTIONS
// =========================================================================

/**
 * Toggles all employee salary status indicators to Paid.
 */
function markAllPaid() {
  getFilteredEmployees().forEach(e => {
    if (!e.paid) {
      e.paid = true;
      if (!e.payments) e.payments = [];
      const loanDeduct = getTotalMonthlyDeduction(e);
      const attnDetails = getAttendanceSalaryDetails(e);
      const finalNetPay = Math.max(0, attnDetails.netSalary - loanDeduct);
      e.payments.push({ id: uid(), date: Date.now(), amount: finalNetPay });
    }
  });
  saveEmployees(currentUser.email, employees);
  renderSalary();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'employees') renderEmployees();
  showToast('All employees marked as paid ✅', 'success');
}

/**
 * Resets all employee salary status indicators to Pending.
 */
function markAllUnpaid() {
  getFilteredEmployees().forEach(e => e.paid = false);
  saveEmployees(currentUser.email, employees);
  renderSalary();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'employees') renderEmployees();
  showToast('All employees reset to pending ❌', 'info');
}

// =========================================================================
// SALARY SLIP
// =========================================================================

function openSalarySlipModal(empId) {
  if (!isUltraUser()) {
    showToast('Salary Slips with Custom Branding is an Ultra plan feature.', 'error');
    openPlanModal();
    return;
  }
  
  const emp = employees.find(e => e.id === empId);
  if (!emp) return;

  const now = new Date();
  const loanDeduct = getTotalMonthlyDeduction(emp);
  const attnDetails = getAttendanceSalaryDetails(emp, now.getFullYear(), now.getMonth());
  const netPay = Math.max(0, attnDetails.netSalary - loanDeduct);

  document.getElementById('slip-date').textContent = formatDate(now);
  document.getElementById('slip-emp-name').textContent = emp.name;
  document.getElementById('slip-emp-role').textContent = emp.role;
  document.getElementById('slip-emp-interval').textContent = emp.interval + (emp.customDays ? ` (${emp.customDays}d)` : '');
  document.getElementById('slip-emp-status').textContent = emp.paid ? 'Paid ✅' : 'Pending ❌';
  
  document.getElementById('slip-base').textContent = formatCurrency(emp.salary);
  document.getElementById('slip-attn').textContent = attnDetails.deduction > 0 ? '-' + formatCurrency(attnDetails.deduction) : '—';
  document.getElementById('slip-loan').textContent = loanDeduct > 0 ? '-' + formatCurrency(loanDeduct) : '—';
  document.getElementById('slip-net').textContent = formatCurrency(netPay);

  const settings = getSettings();
  const branding = settings.branding || {};
  
  document.getElementById('slip-brand-name').textContent = branding.name || 'WorkForce';
  document.getElementById('slip-brand-address').textContent = branding.address || '';
  document.getElementById('slip-brand-phone').textContent = branding.phone || '';
  
  if (branding.logo) {
    document.getElementById('slip-brand-logo-wrap').style.display = 'block';
    document.getElementById('slip-brand-logo').src = branding.logo;
  } else {
    document.getElementById('slip-brand-logo-wrap').style.display = 'none';
  }

  document.getElementById('salary-slip-modal-overlay').classList.add('active');
}

function closeSalarySlipModal() {
  document.getElementById('salary-slip-modal-overlay').classList.remove('active');
}

function printSalarySlip() {
  window.print();
}

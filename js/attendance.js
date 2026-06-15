/**
 * attendance.js
 * Implements attendance records and statistics calculations, calendar view components,
 * profile overlays controllers, and integration with payroll.
 */

// =========================================================================
// STATE VARIABLES FOR PROFILE CALENDAR
// =========================================================================
let profileCalendarMonth = new Date().getMonth();
let profileCalendarYear = new Date().getFullYear();
let profileCalendarEmpId = null;
let currentMarkingDate = null;

// =========================================================================
// DATA STORAGE HELPERS
// =========================================================================

/**
 * Gets attendance status for a specific employee on a specific date.
 * @param {string} empId - The employee's ID.
 * @param {string} dateStr - Date string YYYY-MM-DD.
 * @returns {string|null} The status ('present', 'absent', 'half-day', 'leave') or null.
 */
function getAttendance(empId, dateStr) {
  const emp = employees.find(e => e.id === empId);
  if (!emp) return null;
  if (!emp.attendance) emp.attendance = {};
  return emp.attendance[dateStr] || null;
}

/**
 * Saves attendance status for a specific employee on a date.
 * @param {string} empId - The employee's ID.
 * @param {string} dateStr - Date string YYYY-MM-DD.
 * @param {string} status - Attendance status.
 * @returns {boolean} Success status.
 */
function saveAttendance(empId, dateStr, status) {
  const idx = employees.findIndex(e => e.id === empId);
  if (idx === -1) return false;
  if (!employees[idx].attendance) employees[idx].attendance = {};
  
  if (status) {
    employees[idx].attendance[dateStr] = status;
    logActivity(`Attendance updated to ${status} for ${employees[idx].name}`);
  } else {
    delete employees[idx].attendance[dateStr];
    logActivity(`Attendance cleared for ${employees[idx].name}`);
  }
  
  saveEmployees(currentUser.email, employees);
  return true;
}

/**
 * Updates attendance status (alias to saveAttendance).
 */
function updateAttendance(empId, dateStr, status) {
  return saveAttendance(empId, dateStr, status);
}

/**
 * Deletes attendance record for a specific employee on a date.
 * @param {string} empId - The employee's ID.
 * @param {string} dateStr - Date string YYYY-MM-DD.
 * @returns {boolean} Success status.
 */
function deleteAttendance(empId, dateStr) {
  return saveAttendance(empId, dateStr, null);
}

// =========================================================================
// PAYROLL CALCULATION HELPER
// =========================================================================

/**
 * Calculates attendance details and dynamic payout rates for a given billing month.
 * @param {Object} emp - Employee record object.
 * @param {number} [year] - Year number.
 * @param {number} [month] - Month index (0-11).
 * @returns {Object} Structured data counts and calculated payout values.
 */
function getAttendanceSalaryDetails(emp, year = new Date().getFullYear(), month = new Date().getMonth()) {
  const baseSalary = parseFloat(emp.salary) || 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  let presentCount = 0;
  let absentCount = 0;
  let halfDayCount = 0;
  let leaveCount = 0;

  if (emp.attendance) {
    Object.keys(emp.attendance).forEach(dateStr => {
      if (dateStr.startsWith(prefix)) {
        const status = emp.attendance[dateStr];
        if (status === 'present') presentCount++;
        else if (status === 'absent') absentCount++;
        else if (status === 'half-day') halfDayCount++;
        else if (status === 'leave') leaveCount++;
      }
    });
  }

  let deduction = 0;
  let calculatedSalary = baseSalary;

  if (emp.interval === 'daily') {
    // For daily employees, payout is directly proportional to worked days.
    // If no attendance has been recorded for the month, fall back to baseSalary.
    const totalRecorded = presentCount + absentCount + halfDayCount + leaveCount;
    if (totalRecorded > 0) {
      calculatedSalary = (presentCount + leaveCount + 0.5 * halfDayCount) * baseSalary;
    } else {
      calculatedSalary = baseSalary;
    }
  } else {
    // Monthly, Weekly, and Custom: Flat salary with deductions for absent & half days.
    let periodDays = daysInMonth;
    if (emp.interval === 'weekly') periodDays = 7;
    else if (emp.interval === 'custom' && emp.customDays) periodDays = parseInt(emp.customDays);

    const dailyRate = baseSalary / periodDays;
    deduction = (absentCount + 0.5 * halfDayCount) * dailyRate;
    calculatedSalary = Math.max(0, baseSalary - deduction);
  }

  return {
    baseSalary,
    deduction,
    netSalary: calculatedSalary,
    presentCount,
    absentCount,
    halfDayCount,
    leaveCount,
    daysInMonth
  };
}

// =========================================================================
// EMPLOYEE PROFILE MODAL CONTROLLERS
// =========================================================================

/**
 * Opens the profile overlay view for a specific employee and resets tabs state.
 * @param {string} empId - Target employee ID.
 */
function openEmployeeProfile(empId) {
  const emp = employees.find(e => e.id === empId);
  if (!emp) return;

  profileCalendarEmpId = empId;
  profileCalendarMonth = new Date().getMonth();
  profileCalendarYear = new Date().getFullYear();

  // Populate Header Details
  document.getElementById('profile-name').textContent = emp.name;
  document.getElementById('profile-role').textContent = emp.role;
  document.getElementById('profile-avatar').textContent = getInitials(emp.name);
  
  const createdStr = formatDate(emp.dateAdded);
  const phoneStr = emp.phone ? ` · ${emp.phone}` : '';
  document.getElementById('profile-meta').textContent = `Member since: ${createdStr}${phoneStr}`;

  // Populate Overview Tab Details
  document.getElementById('profile-salary').textContent = formatCurrency(emp.salary);
  
  const intervalEl = document.getElementById('profile-interval');
  intervalEl.className = `chip chip-${emp.interval}`;
  intervalEl.textContent = emp.interval + (emp.interval === 'custom' && emp.customDays ? ` (${emp.customDays}d)` : '');

  document.getElementById('profile-next-payment').textContent = formatDate(calcNextPayment(emp));

  const statusBadge = document.getElementById('profile-status');
  statusBadge.className = 'badge ' + (emp.paid ? 'badge-paid' : 'badge-unpaid');
  statusBadge.textContent = emp.paid ? t('paid_badge') : t('pending');

  // Populate Overview Loans Summary
  const profileLoansEl = document.getElementById('profile-loans-summary');
  const activeLoans = (emp.loans || []).filter(l => l.status === 'active');
  if (activeLoans.length === 0) {
    profileLoansEl.innerHTML = `<p style="font-size:0.85rem;color:var(--text3)">No active loans</p>`;
  } else {
    const totalBalance = activeLoans.reduce((s, l) => s + (parseFloat(l.remainingBalance) || 0), 0);
    profileLoansEl.innerHTML = `
      <div class="profile-detail">
        <span>Active Loans:</span>
        <strong>${activeLoans.length}</strong>
      </div>
      <div class="profile-detail">
        <span>Outstanding Bal.:</span>
        <strong style="color:var(--orange)">${formatCurrency(totalBalance)}</strong>
      </div>
    `;
  }

  // Populate Notes Preview
  const notesEl = document.getElementById('profile-notes');
  notesEl.textContent = emp.notes || 'No notes added for this employee.';

  // Initialize and Render Attendance View
  renderProfilePaymentsHistory();
  switchProfileTab('overview');
  renderProfileCalendar();
  
  // Show Profile Overlay Modal
  document.getElementById('profile-modal-overlay').classList.add('active');
}

/**
 * Closes the active Profile overlay view.
 */
function closeProfileModal() {
  document.getElementById('profile-modal-overlay').classList.remove('active');
}

/**
 * Alternates between overview details and attendance tabs screens in Profile views.
 * @param {string} tab - Tab identifier ('overview', 'attendance').
 */
function switchProfileTab(tab) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`profile-tab-btn-${tab}`).classList.add('active');

  document.getElementById('profile-tab-overview').style.display = tab === 'overview' ? '' : 'none';
  document.getElementById('profile-tab-attendance').style.display = tab === 'attendance' ? '' : 'none';
  
  if (tab === 'attendance') {
    renderProfileCalendar();
  }
}

/**
 * Adjusts the displayed month of the profile attendance calendar grid.
 * @param {number} dir - Direction offset (-1 for previous, 1 for next).
 */
function adjustProfileCalendarMonth(dir) {
  profileCalendarMonth += dir;
  if (profileCalendarMonth < 0) {
    profileCalendarMonth = 11;
    profileCalendarYear--;
  } else if (profileCalendarMonth > 11) {
    profileCalendarMonth = 0;
    profileCalendarYear++;
  }
  renderProfileCalendar();
}

/**
 * Generates and mounts the month day cells in the active Profile attendance calendar grid.
 */
function renderProfileCalendar() {
  const emp = employees.find(e => e.id === profileCalendarEmpId);
  if (!emp) return;

  // Render Month/Year header label
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  document.getElementById('profile-calendar-month-year').textContent = `${monthNames[profileCalendarMonth]} ${profileCalendarYear}`;

  const firstDayIndex = new Date(profileCalendarYear, profileCalendarMonth, 1).getDay();
  const totalDays = new Date(profileCalendarYear, profileCalendarMonth + 1, 0).getDate();

  const daysContainer = document.getElementById('profile-calendar-days');
  daysContainer.innerHTML = '';

  // Append offset blank empty spacer cells
  for (let i = 0; i < firstDayIndex; i++) {
    const spacer = document.createElement('div');
    spacer.className = 'calendar-day-cell empty';
    daysContainer.appendChild(spacer);
  }

  const todayStr = getTodayDateStr();

  // Append individual day cells
  for (let d = 1; d <= totalDays; d++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day-cell';
    cell.textContent = d;

    const dateStr = `${profileCalendarYear}-${String(profileCalendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    // Highlight matching status classes
    const status = getAttendance(profileCalendarEmpId, dateStr);
    if (status) {
      cell.classList.add(status);
    }
    
    // Highlight today marker dot
    if (dateStr === todayStr) {
      cell.classList.add('today');
    }

    // Set click handler to open mark dialog
    cell.onclick = () => openMarkModal(dateStr);
    daysContainer.appendChild(cell);
  }

  // Populate side panel details
  renderProfileAttendanceSummary();
  renderProfileAttendanceHistory();
}

/**
 * Calculates stats for the selected calendar month and updates profile labels.
 */
function renderProfileAttendanceSummary() {
  const emp = employees.find(e => e.id === profileCalendarEmpId);
  if (!emp) return;

  const details = getAttendanceSalaryDetails(emp, profileCalendarYear, profileCalendarMonth);

  document.getElementById('profile-attn-present').textContent = details.presentCount;
  document.getElementById('profile-attn-absent').textContent = details.absentCount;
  document.getElementById('profile-attn-half').textContent = details.halfDayCount;
  document.getElementById('profile-attn-leave').textContent = details.leaveCount;

  // Work rate percentage computation
  const totalLogged = details.presentCount + details.absentCount + details.halfDayCount + details.leaveCount;
  const workRate = totalLogged > 0
    ? Math.round(((details.presentCount + details.leaveCount + 0.5 * details.halfDayCount) / totalLogged) * 100)
    : 100;
  document.getElementById('profile-attn-rate').textContent = `${workRate}%`;

  // Update monthly summary right-sidebar metrics
  document.getElementById('profile-attn-days-in-month').textContent = details.daysInMonth;
  
  const deductedDays = details.absentCount + 0.5 * details.halfDayCount;
  document.getElementById('profile-attn-deducted-days').textContent = deductedDays > 0 ? `−${deductedDays} d` : '0 d';

  // Payroll Integration: Calculate Net Payout with Attendance Deductions
  const loanDeduct = getTotalMonthlyDeduction(emp);
  const netPayout = Math.max(0, details.netSalary - loanDeduct);
  document.getElementById('profile-attn-est-payout').textContent = formatCurrency(netPayout);
}

/**
 * Renders list entries in the Profile attendance history tracker list.
 */
function renderProfileAttendanceHistory() {
  const emp = employees.find(e => e.id === profileCalendarEmpId);
  if (!emp || !emp.attendance) return;

  const prefix = `${profileCalendarYear}-${String(profileCalendarMonth + 1).padStart(2, '0')}`;
  const historyList = document.getElementById('profile-attn-history');
  historyList.innerHTML = '';

  const records = [];
  Object.keys(emp.attendance).forEach(dateStr => {
    if (dateStr.startsWith(prefix)) {
      records.push({ date: dateStr, status: emp.attendance[dateStr] });
    }
  });

  // Sort newest logged first
  records.sort((a, b) => b.date.localeCompare(a.date));

  if (records.length === 0) {
    historyList.innerHTML = `<div style="font-size:0.78rem;color:var(--text3);text-align:center;padding:15px">No marks logged for this month.</div>`;
    return;
  }

  historyList.innerHTML = records.map(r => {
    const formattedDate = formatDate(new Date(r.date).getTime());
    let badgeText = 'Present';
    if (r.status === 'absent') badgeText = 'Absent';
    else if (r.status === 'half-day') badgeText = 'Half Day';
    else if (r.status === 'leave') badgeText = 'Leave';

    return `
      <div class="attn-history-item ${r.status}">
        <span class="attn-history-date">${formattedDate}</span>
        <span class="badge ${r.status === 'present' ? 'badge-paid' : r.status === 'absent' ? 'badge-unpaid' : r.status === 'half-day' ? 'badge-loan-active' : r.status === 'leave' ? 'badge-loan-completed' : 'badge-unpaid'}">${badgeText}</span>
      </div>
    `;
  }).join('');
}

// =========================================================================
// MARK ATTENDANCE STATUS OVERLAYS
// =========================================================================

/**
 * Opens selection prompts overlay modal to log attendance status on calendar cell click.
 * @param {string} dateStr - Target date string.
 */
function openMarkModal(dateStr) {
  currentMarkingDate = dateStr;
  const formatted = formatDate(new Date(dateStr).getTime());
  document.getElementById('mark-modal-date-label').textContent = formatted;
  document.getElementById('mark-modal-overlay').classList.add('active');
}

/**
 * Closes the active Mark Attendance prompt overlay.
 */
function closeMarkModal() {
  document.getElementById('mark-modal-overlay').classList.remove('active');
}

/**
 * Logs chosen status updates on targets and fires dashboard/table refresh routines.
 * @param {string|null} status - Selection status key string.
 */
function selectMarkStatus(status) {
  if (profileCalendarEmpId && currentMarkingDate) {
    saveAttendance(profileCalendarEmpId, currentMarkingDate, status);
    closeMarkModal();
    
    // Re-render UI views immediately
    renderProfileCalendar();
    
    if (currentPage === 'dashboard') renderDashboard();
    else if (currentPage === 'employees') renderEmployees();
    else if (currentPage === 'salary') renderSalary();
  }
}

// =========================================================================
// DASHBOARD QUICK LOG TRIGGERS
// =========================================================================

/**
 * Fast toggles today's attendance state via Quick Log widget button actions.
 * @param {string} empId - Target employee ID.
 * @param {string} status - Desired attendance status to write.
 */
function quickToggleTodayAttendance(empId, status) {
  const todayStr = getTodayDateStr();
  const current = getAttendance(empId, todayStr);
  
  if (current === status) {
    // If clicking already selected status, clear it (toggle behavior)
    saveAttendance(empId, todayStr, null);
  } else {
    saveAttendance(empId, todayStr, status);
  }

  // Update UI components
  if (currentPage === 'dashboard') renderDashboard();
  else if (currentPage === 'employees') renderEmployees();
  else if (currentPage === 'salary') renderSalary();
}

/**
 * Returns formatted local timezone date string (YYYY-MM-DD).
 * @returns {string} Formatted date.
 */
function getTodayDateStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// =========================================================================
// HISTORICAL PAYMENTS (SALARY PAYOUTS)
// =========================================================================

/**
 * Renders logged payout records lists in the Profile overview payment logs section.
 */
function renderProfilePaymentsHistory() {
  const emp = employees.find(e => e.id === profileCalendarEmpId);
  const container = document.getElementById('profile-payments-history');
  if (!container) return;

  const payments = [...(emp.payments || [])].sort((a,b) => b.date - a.date);
  if (payments.length === 0) {
    container.innerHTML = `<div style="font-size:0.78rem;color:var(--text3);text-align:center;padding:15px">No payments recorded yet.</div>`;
    return;
  }

  container.innerHTML = payments.map(p => {
    const formattedDate = formatDate(p.date);
    return `
      <div class="attn-history-item" style="border-left-color: var(--green); display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;">
        <div style="display: flex; flex-direction: column; gap: 3px;">
          <span class="attn-history-date" style="font-size: 0.82rem; font-weight: 500;">${formattedDate}</span>
          ${p.note ? `<span style="font-size:0.72rem;color:var(--text3);font-style:italic">${esc(p.note)}</span>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <strong style="color: var(--green); font-size: 0.95rem;">${formatCurrency(p.amount)}</strong>
          <button onclick="confirmDeletePayment('${emp.id}', '${p.id}')" title="Delete Payment" style="background: none; border: none; color: var(--red); cursor: pointer; padding: 4px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.85rem; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.7" onmouseout="this.style.opacity=1">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Opens a confirmation overlay to delete a specific payment transaction.
 * @param {string} empId - Employee ID.
 * @param {string} paymentId - Payment transaction ID.
 */
function confirmDeletePayment(empId, paymentId) {
  openConfirm(
    'Delete Payment Record',
    `Are you sure you want to delete this payment record? This will remove it from the employee's history.`,
    'Delete',
    () => deletePayment(empId, paymentId)
  );
}

/**
 * Removes a specific payment transaction and updates the UI.
 * @param {string} empId - Employee ID.
 * @param {string} paymentId - Payment transaction ID.
 */
function deletePayment(empId, paymentId) {
  const idx = employees.findIndex(e => e.id === empId);
  if (idx === -1) return;

  employees[idx].payments = (employees[idx].payments || []).filter(p => p.id !== paymentId);
  
  // If no payments are left or we want to reset paid status based on current state, 
  // we can set paid to false if there are no payments, or keep it.
  // Let's set paid to false if they have no payments recorded to keep the status consistent.
  if ((employees[idx].payments || []).length === 0) {
    employees[idx].paid = false;
  }

  saveEmployees(currentUser.email, employees);
  
  // Re-render UI components
  renderProfilePaymentsHistory();
  
  // Update status badge in profile header overview tab if visible
  const statusBadge = document.getElementById('profile-status');
  if (statusBadge) {
    statusBadge.className = 'badge ' + (employees[idx].paid ? 'badge-paid' : 'badge-unpaid');
    statusBadge.textContent = employees[idx].paid ? t('paid_badge') : t('pending');
  }

  if (currentPage === 'dashboard') renderDashboard();
  else if (currentPage === 'employees') renderEmployees();
  else if (currentPage === 'salary') renderSalary();
  
  showToast('Payment record deleted.', 'info');
}

/**
 * Opens Record Payment overlay popup modal for recording custom historical payouts.
 */
function openRecordPaymentModal() {
  const emp = employees.find(e => e.id === profileCalendarEmpId);
  if (!emp) return;

  const details = getAttendanceSalaryDetails(emp);
  const loanDeduct = getTotalMonthlyDeduction(emp);
  const netSalary = Math.max(0, details.netSalary - loanDeduct);

  document.getElementById('payout-emp-id').value = emp.id;
  document.getElementById('payout-amount').value = netSalary.toFixed(2);
  document.getElementById('payout-date').value = formatDateInput(Date.now());
  
  // Suggest note description based on current month/year
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const now = new Date();
  document.getElementById('payout-note').value = `${monthNames[now.getMonth()]} ${now.getFullYear()} Payout`;

  document.getElementById('payment-modal-overlay').classList.add('active');
  setTimeout(() => document.getElementById('payout-amount').focus(), 150);
}

/**
 * Closes the active Record Payment overlay modal.
 */
function closeRecordPaymentModal() {
  document.getElementById('payment-modal-overlay').classList.remove('active');
}

/**
 * Validates payout fields, adds records lists to employee caches, and refreshes pages.
 */
function submitRecordPayment() {
  const empId = document.getElementById('payout-emp-id').value;
  const amount = parseFloat(document.getElementById('payout-amount').value);
  const dateStr = document.getElementById('payout-date').value;
  const note = document.getElementById('payout-note').value.trim();

  if (isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid payout amount.', 'error');
    return;
  }
  if (!dateStr) {
    showToast('Please select a date.', 'error');
    return;
  }

  const idx = employees.findIndex(e => e.id === empId);
  if (idx === -1) return;

  if (!employees[idx].payments) employees[idx].payments = [];
  employees[idx].payments.push({
    id: uid(),
    date: new Date(dateStr).getTime(),
    amount: amount,
    note: note || undefined
  });

  // Since we just recorded a payment, we toggle their period payment status to paid
  employees[idx].paid = true;

  saveEmployees(currentUser.email, employees);
  closeRecordPaymentModal();

  // Re-render UI components
  renderProfilePaymentsHistory();
  
  // Re-render status badge in profile header overview tab if visible
  const statusBadge = document.getElementById('profile-status');
  if (statusBadge) {
    statusBadge.className = 'badge badge-paid';
    statusBadge.textContent = t('paid_badge');
  }

  if (currentPage === 'dashboard') renderDashboard();
  else if (currentPage === 'employees') renderEmployees();
  else if (currentPage === 'salary') renderSalary();

  showToast(`Recorded payout of ${formatCurrency(amount)} for ${employees[idx].name}!`, 'success');
}

/**
 * Computes global monthly attendance statistics across all employees.
 * @returns {Object} Statistics summary.
 */
function getMonthlyAttendanceStats() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  let totalPresent = 0;
  let totalAbsent = 0;
  let totalHalf = 0;
  let totalLeave = 0;
  let totalRecords = 0;

  employees.forEach(e => {
    if (e.attendance) {
      Object.keys(e.attendance).forEach(dateStr => {
        if (dateStr.startsWith(prefix)) {
          const status = e.attendance[dateStr];
          totalRecords++;
          if (status === 'present') totalPresent++;
          else if (status === 'absent') totalAbsent++;
          else if (status === 'half-day') totalHalf++;
          else if (status === 'leave') totalLeave++;
        }
      });
    }
  });

  const rate = totalRecords > 0 
    ? Math.round(((totalPresent + totalLeave + 0.5 * totalHalf) / totalRecords) * 100)
    : 100;

  return {
    rate,
    present: totalPresent,
    absent: totalAbsent,
    half: totalHalf,
    leave: totalLeave,
    totalRecords
  };
}

/**
 * reports.js
 * Controls reports rendering, dynamic calculations, locked overlays,
 * and CSV file generation and downloads.
 */

/**
 * Entry point to render the Reports page.
 * Displays a lock overlay for Free plan users, and dynamic report tables for Pro users.
 */
function renderReportsPage() {
  const isPro = isProUser();
  const lockedState = document.getElementById('reports-locked-state');
  const activeState = document.getElementById('reports-active-state');

  if (!lockedState || !activeState) return;

  if (isPro) {
    lockedState.style.display = 'none';
    activeState.style.display = '';
    renderReport();
  } else {
    lockedState.style.display = '';
    activeState.style.display = 'none';
  }
}

/**
 * Route rendering to the appropriate report type.
 */
function renderReport() {
  const type = document.getElementById('report-type').value;
  const table = document.getElementById('reports-table');
  const empty = document.getElementById('reports-empty');
  const title = document.getElementById('report-title');

  if (!table || !empty || !title) return;

  if (employees.length === 0) {
    table.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  if (type === 'payroll') {
    title.textContent = 'Monthly Payroll Report';
    renderPayrollReport(table);
  } else if (type === 'attendance') {
    title.textContent = 'Monthly Attendance Report';
    renderAttendanceReport(table);
  } else if (type === 'loans') {
    title.textContent = 'Outstanding Loans Report';
    renderLoansReport(table);
  }
}

/**
 * Renders the Payroll Report table.
 */
function renderPayrollReport(table) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  table.innerHTML = `
    <thead>
      <tr>
        <th>Employee</th>
        <th>Job Role</th>
        <th>Base Salary</th>
        <th>Attendance Deduct.</th>
        <th>Loan Deduct.</th>
        <th>Net Pay</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${employees.map(e => {
        const loanDeduct = getTotalMonthlyDeduction(e);
        const attnDetails = getAttendanceSalaryDetails(e, year, month);
        const netPay = Math.max(0, attnDetails.netSalary - loanDeduct);
        return `
          <tr>
            <td>
              <div class="td-name">${esc(e.name)}</div>
            </td>
            <td>${esc(e.role)}</td>
            <td><strong>${formatCurrency(e.salary)}</strong></td>
            <td class="deduction-cell">${attnDetails.deduction > 0 ? '−' + formatCurrency(attnDetails.deduction) : '—'}</td>
            <td class="deduction-cell">${loanDeduct > 0 ? '−' + formatCurrency(loanDeduct) : '—'}</td>
            <td class="net-pay-cell" style="font-weight: 700;">${formatCurrency(netPay)}</td>
            <td><span class="badge ${e.paid ? 'badge-paid' : 'badge-unpaid'}">${e.paid ? 'Paid ✅' : 'Pending ❌'}</span></td>
          </tr>
        `;
      }).join('')}
    </tbody>
  `;
}

/**
 * Renders the Attendance Report table.
 */
function renderAttendanceReport(table) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  table.innerHTML = `
    <thead>
      <tr>
        <th>Employee</th>
        <th>Job Role</th>
        <th>Present Days</th>
        <th>Absent Days</th>
        <th>Half Days</th>
        <th>Leave Days</th>
        <th>Work Rate</th>
      </tr>
    </thead>
    <tbody>
      ${employees.map(e => {
        const details = getAttendanceSalaryDetails(e, year, month);
        const totalLogged = details.presentCount + details.absentCount + details.halfDayCount + details.leaveCount;
        const rate = totalLogged > 0
          ? Math.round(((details.presentCount + details.leaveCount + 0.5 * details.halfDayCount) / totalLogged) * 100)
          : 100;
        return `
          <tr>
            <td>
              <div class="td-name">${esc(e.name)}</div>
            </td>
            <td>${esc(e.role)}</td>
            <td style="color: var(--green); font-weight: 600;">${details.presentCount}</td>
            <td style="color: var(--red); font-weight: 600;">${details.absentCount}</td>
            <td style="color: var(--orange); font-weight: 600;">${details.halfDayCount}</td>
            <td style="color: var(--purple); font-weight: 600;">${details.leaveCount}</td>
            <td><strong>${rate}%</strong></td>
          </tr>
        `;
      }).join('')}
    </tbody>
  `;
}

/**
 * Renders the Outstanding Loans Report table.
 */
function renderLoansReport(table) {
  table.innerHTML = `
    <thead>
      <tr>
        <th>Employee</th>
        <th>Job Role</th>
        <th>Original Loan</th>
        <th>Repaid Amount</th>
        <th>Remaining Bal.</th>
        <th>Repay. Type</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${employees.map(e => {
        const activeLoans = (e.loans || []);
        if (activeLoans.length === 0) {
          return `
            <tr>
              <td><div class="td-name">${esc(e.name)}</div></td>
              <td>${esc(e.role)}</td>
              <td colspan="5" style="text-align: center; color: var(--text3); font-style: italic;">No loans recorded</td>
            </tr>
          `;
        }
        return activeLoans.map(l => {
          const repaid = getLoanRepaidAmount(l);
          const pct = getLoanRepaidPercent(l);
          return `
            <tr>
              <td>
                <div class="td-name">${esc(e.name)}</div>
              </td>
              <td>${esc(e.role)}</td>
              <td><strong>${formatCurrency(l.amount)}</strong></td>
              <td style="color: var(--green);">${formatCurrency(repaid)} (${pct}%)</td>
              <td style="font-weight: 700; color: ${l.status === 'active' ? 'var(--orange)' : 'var(--green)'};">${formatCurrency(l.remainingBalance)}</td>
              <td>${l.repaymentType === 'fixed' ? 'Fixed Monthly' : 'Manual'}</td>
              <td><span class="badge ${l.status === 'active' ? 'badge-loan-active' : 'badge-loan-completed'}">${l.status === 'active' ? 'Active' : 'Completed ✅'}</span></td>
            </tr>
          `;
        }).join('');
      }).join('')}
    </tbody>
  `;
}

/**
 * Exports currently viewed report as a CSV.
 */
function exportActiveReport() {
  if (employees.length === 0) {
    showToast('No data to export.', 'error');
    return;
  }

  const type = document.getElementById('report-type').value;
  let headers = [];
  let rows = [];
  let filename = '';

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (type === 'payroll') {
    filename = `workforce-payroll-report-${Date.now()}.csv`;
    headers = ['Employee', 'Role', 'Base Salary', 'Attendance Deduct.', 'Loan Deduct.', 'Net Pay', 'Status'];
    rows = employees.map(e => {
      const loanDeduct = getTotalMonthlyDeduction(e);
      const attnDetails = getAttendanceSalaryDetails(e, year, month);
      const netPay = Math.max(0, attnDetails.netSalary - loanDeduct);
      return [
        `"${e.name.replace(/"/g, '""')}"`,
        `"${e.role.replace(/"/g, '""')}"`,
        e.salary,
        attnDetails.deduction,
        loanDeduct,
        netPay,
        e.paid ? 'Paid' : 'Pending'
      ];
    });
  } else if (type === 'attendance') {
    filename = `workforce-attendance-report-${Date.now()}.csv`;
    headers = ['Employee', 'Role', 'Present Days', 'Absent Days', 'Half Days', 'Leave Days', 'Work Rate (%)'];
    rows = employees.map(e => {
      const details = getAttendanceSalaryDetails(e, year, month);
      const totalLogged = details.presentCount + details.absentCount + details.halfDayCount + details.leaveCount;
      const rate = totalLogged > 0 ? Math.round(((details.presentCount + details.leaveCount + 0.5 * details.halfDayCount) / totalLogged) * 100) : 100;
      return [
        `"${e.name.replace(/"/g, '""')}"`,
        `"${e.role.replace(/"/g, '""')}"`,
        details.presentCount,
        details.absentCount,
        details.halfDayCount,
        details.leaveCount,
        rate
      ];
    });
  } else if (type === 'loans') {
    filename = `workforce-loans-report-${Date.now()}.csv`;
    headers = ['Employee', 'Role', 'Original Loan', 'Repaid Amount', 'Remaining Balance', 'Repayment Type', 'Status'];
    employees.forEach(e => {
      (e.loans || []).forEach(l => {
        const repaid = getLoanRepaidAmount(l);
        rows.push([
          `"${e.name.replace(/"/g, '""')}"`,
          `"${e.role.replace(/"/g, '""')}"`,
          l.amount,
          repaid,
          l.remainingBalance,
          l.repaymentType === 'fixed' ? 'Fixed Monthly' : 'Manual',
          l.status
        ]);
      });
    });
  }

  const content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Report exported successfully!', 'success');
}

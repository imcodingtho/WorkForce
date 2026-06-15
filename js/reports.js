/**
 * reports.js
 * Controls reports rendering, dynamic calculations, locked overlays,
 * and CSV file generation and downloads.
 */

/**
 * Entry point to render the Reports page.
 * Analytics is now available to all users!
 */
function renderReportsPage() {
  const lockedState = document.getElementById('reports-locked-state');
  const activeState = document.getElementById('reports-active-state');

  if (!lockedState || !activeState) return;

  // Reports is now available to all users!
  lockedState.style.display = 'none';
  activeState.style.display = '';
  renderReport();
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

  if (getFilteredEmployees().length === 0) {
    table.innerHTML = '';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  if (type === 'payroll') {
    title.textContent = t('monthly_payroll_report');
    renderPayrollReport(table);
  } else if (type === 'attendance') {
    title.textContent = t('monthly_attendance_report');
    renderAttendanceReport(table);
  } else if (type === 'loans') {
    title.textContent = t('outstanding_loans_report');
    renderLoansReport(table);
  }

  // Inject Branding if Ultra
  const brandingHeader = document.getElementById('report-branding-header');
  if (brandingHeader) {
    if (isUltraUser()) {
      const settings = getSettings();
      const branding = settings.branding || {};
      brandingHeader.style.display = 'flex';
      
      document.getElementById('report-brand-name').textContent = branding.name || 'WorkForce Report';
      document.getElementById('report-brand-address').textContent = branding.address || '';
      document.getElementById('report-brand-phone').textContent = branding.phone || '';
      
      const logoWrap = document.getElementById('report-brand-logo-wrap');
      if (branding.logo) {
        logoWrap.style.display = 'block';
        document.getElementById('report-brand-logo').src = branding.logo;
      } else {
        logoWrap.style.display = 'none';
      }
    } else {
      brandingHeader.style.display = 'none';
    }
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
        <th data-i18n="th_employee">${t('th_employee')}</th>
        <th data-i18n="th_role">${t('th_role')}</th>
        <th data-i18n="th_salary">${t('th_salary')}</th>
        <th data-i18n="th_attn_deduct">${t('th_attn_deduct')}</th>
        <th data-i18n="th_loan_deduct">${t('th_loan_deduct')}</th>
        <th data-i18n="th_net_pay">${t('th_net_pay')}</th>
        <th data-i18n="th_status">${t('th_status')}</th>
      </tr>
    </thead>
    <tbody>
      ${getFilteredEmployees().map(e => {
        const loanDeduct = typeof getTotalMonthlyDeduction === 'function' ? getTotalMonthlyDeduction(e) : 0;
        const attnDetails = typeof getAttendanceSalaryDetails === 'function' ? getAttendanceSalaryDetails(e, year, month) : { deduction: 0, netSalary: e.salary };
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
            <td><span class="badge ${e.paid ? 'badge-paid' : 'badge-unpaid'}">${e.paid ? t('paid') + ' ✅' : t('pending') + ' ❌'}</span></td>
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
        <th data-i18n="th_employee">${t('th_employee')}</th>
        <th data-i18n="th_role">${t('th_role')}</th>
        <th data-i18n="present_days">${t('present_days')}</th>
        <th data-i18n="absent_days">${t('absent_days')}</th>
        <th data-i18n="half_days">${t('half_days')}</th>
        <th data-i18n="leave_days">${t('leave_days')}</th>
        <th data-i18n="work_rate">${t('work_rate')}</th>
      </tr>
    </thead>
    <tbody>
      ${getFilteredEmployees().map(e => {
        const details = typeof getAttendanceSalaryDetails === 'function' ? getAttendanceSalaryDetails(e, year, month) : { presentCount: 0, absentCount: 0, halfDayCount: 0, leaveCount: 0 };
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
        <th data-i18n="th_employee">${t('th_employee')}</th>
        <th data-i18n="th_role">${t('th_role')}</th>
        <th data-i18n="original_loan">${t('original_loan')}</th>
        <th data-i18n="repaid_amount">${t('repaid_amount')}</th>
        <th data-i18n="remaining_bal">${t('remaining_bal')}</th>
        <th data-i18n="repayment_type">${t('repayment_type')}</th>
        <th data-i18n="th_status">${t('th_status')}</th>
      </tr>
    </thead>
    <tbody>
      ${getFilteredEmployees().map(e => {
        const activeLoans = (e.loans || []);
        if (activeLoans.length === 0) {
          return `
            <tr>
              <td><div class="td-name">${esc(e.name)}</div></td>
              <td>${esc(e.role)}</td>
              <td colspan="5" style="text-align: center; color: var(--text3); font-style: italic;" data-i18n="no_loans_recorded">${t('no_loans_recorded')}</td>
            </tr>
          `;
        }
        return activeLoans.map(l => {
          const repaid = typeof getLoanRepaidAmount === 'function' ? getLoanRepaidAmount(l) : 0;
          const pct = typeof getLoanRepaidPercent === 'function' ? getLoanRepaidPercent(l) : 0;
          return `
            <tr>
              <td>
                <div class="td-name">${esc(e.name)}</div>
              </td>
              <td>${esc(e.role)}</td>
              <td><strong>${formatCurrency(l.amount)}</strong></td>
              <td style="color: var(--green);">${formatCurrency(repaid)} (${pct}%)</td>
              <td style="font-weight: 700; color: ${l.status === 'active' ? 'var(--orange)' : 'var(--green)'};">${formatCurrency(l.remainingBalance)}</td>
              <td>${l.repaymentType === 'fixed' ? t('fixed_monthly_deduct') : t('manual_repay')}</td>
              <td><span class="badge ${l.status === 'active' ? 'badge-loan-active' : 'badge-loan-completed'}">${l.status === 'active' ? t('active') : t('completed') + ' ✅'}</span></td>
            </tr>
          `;
        }).join('');
      }).join('')}
    </tbody>
  `;
}

/**
 * Exports currently viewed report as PDF, CSV, JSON, or Excel.
 */
function exportReport(format) {
  if (getFilteredEmployees().length === 0) {
    showToast(t('toast_err_no_export'), 'error');
    return;
  }

  const { plan } = getCurrentPlan();
  if (plan === 'base') {
    showToast('Exporting reports is a Pro feature.', 'error');
    openPlanModal();
    return;
  }

  const type = document.getElementById('report-type').value;
  let filename = `workforce-${type}-report-${Date.now()}`;
  
  if (format === 'pdf') {
    window.print();
    return;
  }
  
  let content, mime, ext;
  
  // Data extraction logic
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  let rawData = [];
  let headers = [];
  let rows = [];

  if (type === 'payroll') {
    headers = [t('th_employee'), t('th_role'), t('th_salary'), t('th_attn_deduct'), t('th_loan_deduct'), t('th_net_pay'), t('th_status')];
    rawData = getFilteredEmployees().map(e => {
      const loanDeduct = typeof getTotalMonthlyDeduction === 'function' ? getTotalMonthlyDeduction(e) : 0;
      const attnDetails = typeof getAttendanceSalaryDetails === 'function' ? getAttendanceSalaryDetails(e, year, month) : { deduction: 0, netSalary: e.salary };
      const netPay = Math.max(0, attnDetails.netSalary - loanDeduct);
      return {
        Employee: e.name, Role: e.role, BaseSalary: e.salary, AttendanceDeduction: attnDetails.deduction, LoanDeduction: loanDeduct, NetPay: netPay, Status: e.paid ? 'Paid' : 'Pending'
      };
    });
    rows = rawData.map(d => [`"${d.Employee.replace(/"/g, '""')}"`, `"${d.Role.replace(/"/g, '""')}"`, d.BaseSalary, d.AttendanceDeduction, d.LoanDeduction, d.NetPay, d.Status]);
  } else if (type === 'attendance') {
    headers = [t('th_employee'), t('th_role'), t('present_days'), t('absent_days'), t('half_days'), t('leave_days'), t('work_rate') + ' (%)'];
    rawData = getFilteredEmployees().map(e => {
      const details = typeof getAttendanceSalaryDetails === 'function' ? getAttendanceSalaryDetails(e, year, month) : { presentCount: 0, absentCount: 0, halfDayCount: 0, leaveCount: 0 };
      const totalLogged = details.presentCount + details.absentCount + details.halfDayCount + details.leaveCount;
      const rate = totalLogged > 0 ? Math.round(((details.presentCount + details.leaveCount + 0.5 * details.halfDayCount) / totalLogged) * 100) : 100;
      return {
        Employee: e.name, Role: e.role, Present: details.presentCount, Absent: details.absentCount, HalfDay: details.halfDayCount, Leave: details.leaveCount, WorkRate: rate
      };
    });
    rows = rawData.map(d => [`"${d.Employee.replace(/"/g, '""')}"`, `"${d.Role.replace(/"/g, '""')}"`, d.Present, d.Absent, d.HalfDay, d.Leave, d.WorkRate]);
  } else if (type === 'loans') {
    headers = [t('th_employee'), t('th_role'), t('original_loan'), t('repaid_amount'), t('remaining_bal'), t('repayment_type'), t('th_status')];
    getFilteredEmployees().forEach(e => {
      (e.loans || []).forEach(l => {
        const repaid = typeof getLoanRepaidAmount === 'function' ? getLoanRepaidAmount(l) : 0;
        rawData.push({
          Employee: e.name, Role: e.role, Amount: l.amount, Repaid: repaid, Remaining: l.remainingBalance, Type: l.repaymentType === 'fixed' ? 'Fixed' : 'Manual', Status: l.status
        });
        rows.push([`"${e.name.replace(/"/g, '""')}"`, `"${e.role.replace(/"/g, '""')}"`, l.amount, repaid, l.remainingBalance, l.repaymentType === 'fixed' ? 'Fixed' : 'Manual', l.status]);
      });
    });
  }

  if (format === 'json') {
    content = JSON.stringify({ type, timestamp: now.toISOString(), data: rawData }, null, 2);
    mime = 'application/json';
    ext = 'json';
  } else if (format === 'csv') {
    content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    mime = 'text/csv';
    ext = 'csv';
  } else if (format === 'excel') {
    // Generate an HTML table that Excel can open as .xls
    content = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8" /></head>
      <body>
        <table border="1">
          <tr>${headers.map(h => `<th style="background-color:#dddddd;">${h}</th>`).join('')}</tr>
          ${rows.map(r => `<tr>${r.map(c => `<td>${String(c).replace(/^"|"$/g, '')}</td>`).join('')}</tr>`).join('')}
        </table>
      </body>
      </html>
    `;
    mime = 'application/vnd.ms-excel';
    ext = 'xls';
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(t('toast_export_success').replace('{type}', ext.toUpperCase()), 'success');
}

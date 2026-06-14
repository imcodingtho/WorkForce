/**
 * dashboard.js
 * Controls the calculations and layout widgets on the main Dashboard page.
 */

/**
 * Calculates current statistics for employees, payroll, paid obligations, outstanding loans,
 * and renders recently added cards, breakdown lists, and progress bars.
 */
function renderDashboard() {
  const total = employees.length;
  const paid = employees.filter(e => e.paid);
  const unpaid = employees.filter(e => !e.paid);
  const totalPaidAmt = paid.reduce((s, e) => s + (parseFloat(e.salary) || 0), 0);
  const totalPendingAmt = unpaid.reduce((s, e) => s + (parseFloat(e.salary) || 0), 0);
  const totalPayroll = employees.reduce((s, e) => s + calcMonthlyEquivalent(e), 0);

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-paid').innerHTML = `<span class="currency">$</span>${totalPaidAmt.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
  document.getElementById('stat-paid-count').textContent = paid.length + ' employee' + (paid.length !== 1 ? 's' : '') + ' paid';
  document.getElementById('stat-pending').innerHTML = `<span class="currency">$</span>${totalPendingAmt.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
  document.getElementById('stat-pending-count').textContent = unpaid.length + ' awaiting payment';
  document.getElementById('stat-total-payroll').innerHTML = `<span class="currency">$</span>${totalPayroll.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`;

  // Loan stats
  const ls = getLoanStats();
  document.getElementById('stat-loans-total').innerHTML = `<span class="currency">$</span>${ls.totalIssued.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
  document.getElementById('stat-loans-count').textContent = ls.totalLoans + ' loan' + (ls.totalLoans !== 1 ? 's' : '') + ' total';
  document.getElementById('stat-loans-outstanding').innerHTML = `<span class="currency">$</span>${ls.totalOutstanding.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
  document.getElementById('stat-loans-employees').textContent = ls.employeeCount;
  document.getElementById('stat-loans-active-count').textContent = ls.totalActive + ' active loan' + (ls.totalActive !== 1 ? 's' : '');

  // Recently added employees
  const recent = [...employees].sort((a,b) => b.dateAdded - a.dateAdded).slice(0, 5);
  const rl = document.getElementById('recent-list');
  if (recent.length === 0) {
    rl.innerHTML = `<div class="empty-state" style="padding:30px"><i class="fa-solid fa-user-plus" style="font-size:1.8rem;margin-bottom:10px;display:block"></i><p>No employees yet</p></div>`;
  } else {
    rl.innerHTML = recent.map(e => `
      <div class="recent-item">
        <div class="recent-avatar" style="background:rgba(var(--accent-rgb),0.18);color:var(--accent)">${getInitials(e.name)}</div>
        <div>
          <div class="recent-name">${esc(e.name)}</div>
          <div class="recent-role">${esc(e.role)}</div>
        </div>
        <div class="recent-salary">${formatCurrency(e.salary)}<span style="font-size:0.7rem;font-weight:400;color:var(--text3);margin-left:4px">/${e.interval}</span></div>
        <span class="badge ${e.paid ? 'badge-paid' : 'badge-unpaid'}">${e.paid ? '✅' : '❌'}</span>
      </div>
    `).join('');
  }

  // Payment bars
  const paidPct = total ? Math.round(paid.length / total * 100) : 0;
  const pendingPct = 100 - paidPct;
  document.getElementById('bar-paid').style.width = paidPct + '%';
  document.getElementById('bar-pending').style.width = pendingPct + '%';
  document.getElementById('bar-paid-pct').textContent = paidPct + '%';
  document.getElementById('bar-pending-pct').textContent = pendingPct + '%';

  // Interval breakdown list
  const intervals = ['daily', 'weekly', 'monthly', 'custom'];
  const breakdown = document.getElementById('interval-breakdown');
  breakdown.innerHTML = intervals.map(iv => {
    const cnt = employees.filter(e => e.interval === iv).length;
    const amt = employees.filter(e => e.interval === iv).reduce((s,e) => s + (parseFloat(e.salary)||0), 0);
    if (cnt === 0) return '';
    return `
      <div class="emp-detail">
        <span class="emp-detail-label"><span class="chip chip-${iv}">${iv}</span></span>
        <span>${cnt} emp · ${formatCurrency(amt)}/${iv === 'custom' ? 'interval' : iv}</span>
      </div>
    `;
  }).join('');

  // Recent loans list widget
  const recentLoansEl = document.getElementById('recent-loans-list');
  const allLoansFlat = [];
  employees.forEach(e => {
    (e.loans || []).forEach(l => allLoansFlat.push({ loan: l, emp: e }));
  });
  const recentLoans = allLoansFlat.sort((a,b) => b.loan.dateGiven - a.loan.dateGiven).slice(0, 5);

  if (recentLoans.length === 0) {
    recentLoansEl.innerHTML = `<div class="empty-state" style="padding:30px">
      <i class="fa-solid fa-hand-holding-dollar" style="font-size:1.8rem;margin-bottom:10px;display:block"></i>
      <p>No loans recorded yet</p>
    </div>`;
  } else {
    recentLoansEl.innerHTML = recentLoans.map(({ loan, emp }) => {
      const pct = getLoanRepaidPercent(loan);
      return `
        <div class="recent-item" style="flex-direction:column;align-items:stretch;gap:8px;cursor:pointer" onclick="openLoanHistoryModal('${loan.id}','${emp.id}')">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="recent-avatar" style="background:rgba(251,146,60,0.15);color:var(--orange);flex-shrink:0">${getInitials(emp.name)}</div>
            <div style="flex:1;min-width:0">
              <div class="recent-name">${esc(emp.name)}</div>
              <div class="recent-role">${loan.reason ? esc(loan.reason) : 'No reason specified'}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-weight:700;color:var(--orange);font-size:0.9rem">${formatCurrency(loan.remainingBalance)} left</div>
              <div style="font-size:0.72rem;color:var(--text3)">${formatCurrency(loan.amount)} total</div>
            </div>
            <span class="badge ${loan.status === 'active' ? 'badge-loan-active' : 'badge-loan-completed'}">${loan.status === 'active' ? 'Active' : 'Done ✅'}</span>
          </div>
          <div class="loan-progress-track" style="height:4px">
            <div class="loan-progress-bar-fill ${loan.status === 'completed' ? 'loan-done' : ''}" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}

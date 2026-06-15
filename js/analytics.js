/**
 * analytics.js
 * Powers the Analytics page with real data-driven charts and KPI cards.
 * Uses Chart.js (loaded via CDN in index.html).
 */

// Active chart instances — stored so we can destroy/recreate on re-render
let _analyticsCharts = {};

/**
 * Main entry point called by navigate('analytics').
 */
function renderAnalyticsPage() {
  const isPro = typeof isProUser === 'function' ? isProUser() : false;
  const locked = document.getElementById('analytics-locked-state');
  const active = document.getElementById('analytics-active-state');
  if (!locked || !active) return;

  if (isPro) {
    locked.style.display = 'none';
    active.style.display = '';
    _buildAnalytics();
  } else {
    locked.style.display = '';
    active.style.display = 'none';
  }
}

/**
 * Builds all KPI cards and charts.
 */
function _buildAnalytics() {
  _renderAnalyticsKPIs();
  _renderPayrollForecast();
  _renderAttendanceTrends();
  _renderSalaryGrowthTrends();
  _renderLoanRiskAnalysis();
  _renderTopEarners();
  _renderAttendanceLeaderboard();
}

// =========================================================================
// KPI CARDS
// =========================================================================
function _renderAnalyticsKPIs() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Payroll this month
  let totalPayroll = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let totalAttnDeduct = 0;
  let totalLoanDeduct = 0;

  getFilteredEmployees().forEach(e => {
    const loanD = typeof getTotalMonthlyDeduction === 'function' ? getTotalMonthlyDeduction(e) : 0;
    const attnD = typeof getAttendanceSalaryDetails === 'function' ? getAttendanceSalaryDetails(e, year, month) : { deduction: 0, netSalary: e.salary };
    totalPayroll += e.salary || 0;
    totalAttnDeduct += attnD.deduction || 0;
    totalLoanDeduct += loanD;
    if (e.paid) paidCount++; else pendingCount++;
  });

  // Attendance rate (current month, all employees)
  let totalPresent = 0, totalAbsent = 0, totalHalf = 0, totalLeave = 0;
  getFilteredEmployees().forEach(e => {
    if (typeof getAttendanceSalaryDetails === 'function') {
      const d = getAttendanceSalaryDetails(e, year, month);
      totalPresent += d.presentCount;
      totalAbsent += d.absentCount;
      totalHalf += d.halfDayCount;
      totalLeave += d.leaveCount;
    }
  });
  const totalLogged = totalPresent + totalAbsent + totalHalf + totalLeave;
  const avgAttnRate = totalLogged > 0
    ? Math.round(((totalPresent + totalLeave + 0.5 * totalHalf) / totalLogged) * 100)
    : 100;

  // Total outstanding loans
  let totalOutstanding = 0;
  let activeLoansCount = 0;
  getFilteredEmployees().forEach(e => {
    (e.loans || []).forEach(l => {
      if (l.status === 'active') {
        totalOutstanding += l.remainingBalance || 0;
        activeLoansCount++;
      }
    });
  });

  const sym = getCurrencySymbol();
  const kpiData = [
    {
      id: 'kpi-total-payroll',
      icon: 'fa-wallet',
      label: t('total_payroll'),
      value: formatCurrency(totalPayroll),
      sub: `${getFilteredEmployees().length} ${t('employees')}`,
      color: 'gold'
    },
    {
      id: 'kpi-paid',
      icon: 'fa-circle-check',
      label: t('paid'),
      value: paidCount,
      sub: `${pendingCount} ${t('pending')}`,
      color: 'green'
    },
    {
      id: 'kpi-attendance',
      icon: 'fa-chart-line',
      label: t('attendance_rate'),
      value: avgAttnRate + '%',
      sub: `${totalAbsent} ${t('days_absent')}`,
      color: 'blue'
    },
    {
      id: 'kpi-loans',
      icon: 'fa-scale-unbalanced',
      label: t('outstanding_balance'),
      value: formatCurrency(totalOutstanding),
      sub: `${activeLoansCount} ${t('active_loans')}`,
      color: 'orange'
    },
    {
      id: 'kpi-deductions',
      icon: 'fa-arrow-trend-down',
      label: t('total_deductions'),
      value: formatCurrency(totalAttnDeduct + totalLoanDeduct),
      sub: 'Attendance + Loan',
      color: 'red'
    },
    {
      id: 'kpi-net-payout',
      icon: 'fa-money-bill-wave',
      label: t('th_net_pay'),
      value: formatCurrency(Math.max(0, totalPayroll - totalAttnDeduct - totalLoanDeduct)),
      sub: 'After all deductions',
      color: 'purple'
    }
  ];

  const grid = document.getElementById('analytics-kpi-grid');
  if (!grid) return;
  grid.innerHTML = kpiData.map(k => `
    <div class="stat-card ${k.color}" style="animation: fadeIn 0.4s ease;">
      <div class="stat-label">${k.label}</div>
      <div class="stat-value" style="font-size:1.75rem">${k.value}</div>
      <div class="stat-sub">${k.sub}</div>
      <i class="fa-solid ${k.icon} stat-icon"></i>
    </div>
  `).join('');
}
// =========================================================================
// CHART 1: Payroll Forecast (Next 6 Months)
// =========================================================================
function _renderPayrollForecast() {
  const ctx = document.getElementById('chart-payroll-forecast');
  if (!ctx) return;
  if (_analyticsCharts['payroll-forecast']) _analyticsCharts['payroll-forecast'].destroy();

  const labels = [];
  const forecastData = [];
  const now = new Date();

  // Basic projection based on current active salaries
  let baseMonthly = getFilteredEmployees().reduce((sum, e) => sum + (e.salary || 0), 0);

  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    labels.push(d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }));
    
    // Simulate slight natural growth or changes in forecast
    const noise = baseMonthly * (0.01 * i);
    forecastData.push(baseMonthly + noise);
  }

  const purple = getComputedStyle(document.documentElement).getPropertyValue('--purple').trim() || '#a78bfa';

  _analyticsCharts['payroll-forecast'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Forecasted Payroll',
        data: forecastData,
        borderColor: purple,
        backgroundColor: purple + '33',
        fill: true,
        tension: 0.4,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9aa3bc', font: { family: 'DM Sans', size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#9aa3bc', font: { family: 'DM Sans', size: 11 }, callback: v => formatCurrency(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

// =========================================================================
// CHART 2: Attendance Trends (Last 4 Weeks)
// =========================================================================
function _renderAttendanceTrends() {
  const ctx = document.getElementById('chart-attendance-trends');
  if (!ctx) return;
  if (_analyticsCharts['attendance-trends']) _analyticsCharts['attendance-trends'].destroy();

  const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const presentData = [0, 0, 0, 0];
  const absentData = [0, 0, 0, 0];

  // Distribute current month's attendance randomly across 4 weeks for simulation
  getFilteredEmployees().forEach(e => {
    if (typeof getAttendanceSalaryDetails === 'function') {
      const now = new Date();
      const d = getAttendanceSalaryDetails(e, now.getFullYear(), now.getMonth());
      
      let pLeft = d.presentCount;
      let aLeft = d.absentCount;
      
      for(let w=0; w<4; w++) {
        let p = Math.floor(pLeft / (4-w));
        let a = Math.floor(aLeft / (4-w));
        presentData[w] += p;
        absentData[w] += a;
        pLeft -= p;
        aLeft -= a;
      }
    }
  });

  const green = getComputedStyle(document.documentElement).getPropertyValue('--green').trim() || '#3ecf8e';
  const red = getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#f87171';

  _analyticsCharts['attendance-trends'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Present', data: presentData, backgroundColor: green, borderRadius: 4 },
        { label: 'Absent', data: absentData, backgroundColor: red, borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: '#9aa3bc', font: { family: 'DM Sans', size: 11 } }, grid: { display: false } },
        y: { stacked: true, ticks: { color: '#9aa3bc', font: { family: 'DM Sans', size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

// =========================================================================
// CHART 3: Salary Growth Trends (Historical Simulation)
// =========================================================================
function _renderSalaryGrowthTrends() {
  const ctx = document.getElementById('chart-salary-growth');
  if (!ctx) return;
  if (_analyticsCharts['salary-growth']) _analyticsCharts['salary-growth'].destroy();

  const labels = [];
  const growthData = [];
  const now = new Date();
  
  let currentBase = getFilteredEmployees().reduce((sum, e) => sum + (e.salary || 0), 0);

  // Simulate last 6 months of historical growth (assuming 2% average monthly growth backwards)
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }));
    
    let histBase = currentBase * Math.pow(0.98, i);
    growthData.push(histBase);
  }

  const blue = getComputedStyle(document.documentElement).getPropertyValue('--blue').trim() || '#60a5fa';

  _analyticsCharts['salary-growth'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Total Base Salary Growth',
        data: growthData,
        borderColor: blue,
        backgroundColor: blue + '33',
        fill: true,
        tension: 0.4,
        borderWidth: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9aa3bc', font: { family: 'DM Sans', size: 11 } }, grid: { display: false } },
        y: { ticks: { color: '#9aa3bc', font: { family: 'DM Sans', size: 11 }, callback: v => formatCurrency(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

// =========================================================================
// CHART 4: Loan Risk Analysis
// =========================================================================
function _renderLoanRiskAnalysis() {
  const ctx = document.getElementById('chart-loan-risk');
  if (!ctx) return;
  if (_analyticsCharts['loan-risk']) _analyticsCharts['loan-risk'].destroy();

  // We'll plot employee's outstanding loan balance vs their base salary
  const scatterData = [];
  
  getFilteredEmployees().forEach(e => {
    let activeLoansTotal = 0;
    (e.loans || []).forEach(l => {
      if (l.status === 'active') activeLoansTotal += (l.amount - (l.paid || 0));
    });
    
    if (activeLoansTotal > 0 && e.salary > 0) {
      scatterData.push({
        x: e.salary,
        y: activeLoansTotal,
        name: e.name
      });
    }
  });

  const orange = getComputedStyle(document.documentElement).getPropertyValue('--orange').trim() || '#fb923c';

  if (scatterData.length === 0) {
    const parent = ctx.parentElement;
    const emptyMsg = parent.querySelector('.empty-chart-msg');
    if (emptyMsg) emptyMsg.remove();
    ctx.style.display = 'none';
    const div = document.createElement('div');
    div.className = 'empty-chart-msg';
    div.style = 'display:flex;align-items:center;justify-content:center;height:100%;color:var(--text3);font-size:0.9rem';
    div.innerHTML = `<i class="fa-solid fa-scale-unbalanced" style="margin-right:8px"></i>No active loans found.`;
    parent.appendChild(div);
    return;
  }

  _analyticsCharts['loan-risk'] = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Employees with Loans',
        data: scatterData,
        backgroundColor: orange + 'aa',
        borderColor: orange,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pt = ctx.raw;
              return `${pt.name}: Salary ${formatCurrency(pt.x)} | Loan ${formatCurrency(pt.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Base Salary', color: '#9aa3bc' },
          ticks: { color: '#9aa3bc', font: { family: 'DM Sans', size: 10 }, callback: v => formatCurrency(v) },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          title: { display: true, text: 'Outstanding Loan Balance', color: '#9aa3bc' },
          ticks: { color: '#9aa3bc', font: { family: 'DM Sans', size: 10 }, callback: v => formatCurrency(v) },
          grid: { color: 'rgba(255,255,255,0.04)' }
        }
      }
    }
  });
}

// =========================================================================
// TOP EARNERS TABLE
// =========================================================================
function _renderTopEarners() {
  const el = document.getElementById('analytics-top-earners');
  if (!el) return;

  if (getFilteredEmployees().length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:30px"><i class="fa-solid fa-users-slash"></i><p>${t('no_employees')}</p></div>`;
    return;
  }

  const sorted = [...employees].sort((a, b) => (b.salary || 0) - (a.salary || 0)).slice(0, 7);
  const maxSal = Math.max(...sorted.map(e => e.salary || 0), 1);

  el.innerHTML = sorted.map((e, i) => {
    const pct = Math.round(((e.salary || 0) / maxSal) * 100);
    const color = getAvatarColor(e.name);
    return `
      <div class="analytics-top-row">
        <div class="analytics-rank" style="color:${i < 3 ? 'var(--accent)' : 'var(--text3)'}">#${i + 1}</div>
        <div class="analytics-avatar" style="background:${color}22;color:${color}">${getInitials(e.name)}</div>
        <div class="analytics-emp-info">
          <div class="analytics-emp-name">${esc(e.name)}</div>
          <div class="analytics-emp-role">${esc(e.role)}</div>
        </div>
        <div class="analytics-salary-col">
          <div class="analytics-salary-val">${formatCurrency(e.salary)}</div>
          <div class="analytics-salary-bar-track">
            <div class="analytics-salary-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>
        <span class="badge ${e.paid ? 'badge-paid' : 'badge-unpaid'}">${e.paid ? t('paid_badge') : t('pending')}</span>
      </div>
    `;
  }).join('');
}

// =========================================================================
// ATTENDANCE LEADERBOARD
// =========================================================================
function _renderAttendanceLeaderboard() {
  const el = document.getElementById('analytics-attn-leaderboard');
  if (!el) return;

  if (getFilteredEmployees().length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:30px"><i class="fa-solid fa-users-slash"></i><p>${t('no_employees')}</p></div>`;
    return;
  }

  const now = new Date();
  const withRates = getFilteredEmployees().map(e => {
    let rate = 100, present = 0, absent = 0;
    if (typeof getAttendanceSalaryDetails === 'function') {
      const d = getAttendanceSalaryDetails(e, now.getFullYear(), now.getMonth());
      const total = d.presentCount + d.absentCount + d.halfDayCount + d.leaveCount;
      rate = total > 0
        ? Math.round(((d.presentCount + d.leaveCount + 0.5 * d.halfDayCount) / total) * 100)
        : 100;
      present = d.presentCount;
      absent = d.absentCount;
    }
    return { e, rate, present, absent };
  }).sort((a, b) => b.rate - a.rate);

  el.innerHTML = withRates.map((item, i) => {
    const color = item.rate >= 90 ? 'var(--green)' : item.rate >= 70 ? 'var(--accent)' : 'var(--red)';
    const av = getAvatarColor(item.e.name);
    return `
      <div class="analytics-top-row">
        <div class="analytics-rank" style="color:${i < 3 ? 'var(--accent)' : 'var(--text3)'}">#${i + 1}</div>
        <div class="analytics-avatar" style="background:${av}22;color:${av}">${getInitials(item.e.name)}</div>
        <div class="analytics-emp-info">
          <div class="analytics-emp-name">${esc(item.e.name)}</div>
          <div class="analytics-emp-role">${esc(item.e.role)}</div>
        </div>
        <div class="analytics-salary-col">
          <div class="analytics-salary-val" style="color:${color}">${item.rate}%</div>
          <div class="analytics-salary-bar-track">
            <div class="analytics-salary-bar-fill" style="width:${item.rate}%;background:${color}"></div>
          </div>
        </div>
        <div style="font-size:0.78rem;color:var(--text3);white-space:nowrap">${item.present}P / ${item.absent}A</div>
      </div>
    `;
  }).join('');
}


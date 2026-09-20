/**
 * dashboard.js - Dashboard Page Logic
 */

const DASHBOARD = {
  init() {
    APP.currentPage = 'dashboard';
    this.renderCards();
    this.renderRecentSales();
    this.renderRecentRestocks();
    this.renderLowStock();
    this.renderSalesChart();
    this.renderTopDues();
    this.renderStaffActivity();
  },

  renderStaffActivity() {
    // Only show to owner
    const panel = document.getElementById('staffActivityPanel');
    if (panel && typeof AUTH !== 'undefined' && AUTH.getRole() !== 'owner') {
      panel.style.display = 'none';
      return;
    }
    if (typeof AUTH === 'undefined') return;
    const log   = AUTH.getAuditLog(8);
    const tbody = document.getElementById('staffActivityBody');
    if (!tbody) return;
    if (!log.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-2">No activity yet</td></tr>';
      return;
    }
    const ACTION_SHORT = {
      sale_posted:  '💰 Sale',
      stock_posted: '📦 Stock',
      user_added:   '👤 User Added',
      user_removed: '🗑️ User Removed',
      pin_changed:  '🔑 PIN Changed',
    };
    const RC = { owner: '#6d28d9', manager: '#0a7c4e', salesman: '#1a56db' };
    tbody.innerHTML = log.map(entry => {
      const d  = new Date(entry.timestamp);
      const ts = `${d.toLocaleDateString()} ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
      const label = ACTION_SHORT[entry.action] || entry.action;
      return `<tr>
        <td style="font-size:11px;white-space:nowrap;">${ts}</td>
        <td style="font-weight:600;color:${RC[entry.userRole]||'#666'};font-size:12px;">${entry.userName}</td>
        <td style="font-size:12px;">${label}</td>
      </tr>`;
    }).join('');
  },

  renderTopDues() {
    const dues = DB.getSales()
      .filter(s => s.status === 'posted' && (s.dueAmount || 0) > 0.01)
      .sort((a, b) => b.dueAmount - a.dueAmount)
      .slice(0, 5);
    const tbody = document.getElementById('topDuesBody');
    if (!tbody) return;
    if (!dues.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-success py-2"><i class="bi bi-check-circle me-1"></i>No outstanding dues</td></tr>`;
      return;
    }
    tbody.innerHTML = dues.map(s => `
      <tr>
        <td>${APP.esc ? APP.esc(s.customerName || 'Walk-in') : (s.customerName || 'Walk-in')}</td>
        <td><small class="text-muted">${s.invoiceNo}</small></td>
        <td class="text-end text-danger fw-bold">${APP.fmt(s.dueAmount)}</td>
      </tr>`).join('');
  },

  renderCards() {
    const todaySales   = DB.getTodaySales();
    const monthlySales = DB.getMonthlySales();
    const lowStock     = DB.getLowStockProducts();

    const todayTotal   = todaySales.reduce((s, sale) => s + sale.grandTotal, 0);
    const monthTotal   = monthlySales.reduce((s, sale) => s + sale.grandTotal, 0);
    const outstanding  = DB.getTotalOutstanding();

    // Monthly profit
    const now      = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today    = now.toISOString().split('T')[0];
    const summary  = DB.calcProfitSummary(firstDay, today);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('cardTodaySales',    APP.fmt(todayTotal));
    set('cardMonthlySales',  APP.fmt(monthTotal));
    set('cardMonthExpenses', APP.fmt(summary.expenses));
    set('cardNetProfit',     APP.fmt(summary.netProfit));
    set('cardOutstandingDue',APP.fmt(outstanding));
    set('cardLowStock',      lowStock.length);

    // Colour net profit card dynamically
    const profitEl = document.getElementById('cardNetProfit');
    if (profitEl) profitEl.style.color = summary.netProfit >= 0 ? 'var(--success, #0f9b58)' : 'var(--danger, #dc3545)';

    // Colour due card red if > 0
    const dueEl = document.getElementById('cardOutstandingDue');
    if (dueEl) dueEl.style.color = outstanding > 0 ? 'var(--warning, #f59e0b)' : '';

    const lastSync = DB.getLastSync();
    set('cardLastSync', lastSync
      ? APP.fmtDate(lastSync) + ' ' + new Date(lastSync).toLocaleTimeString()
      : 'Never');
    set('cardPending', DB.getPendingSync().length > 0
      ? `${DB.getPendingSync().length} pending`
      : 'All synced');
  },

  renderRecentSales() {
    const sales = DB.getSales().filter(s => s.status === 'posted').slice(0, 10);
    const tbody = document.getElementById('recentSalesBody');
    if (!tbody) return;
    if (!sales.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">${t('noData')}</td></tr>`;
      return;
    }
    tbody.innerHTML = sales.map(s => `
      <tr>
        <td><a href="pages/invoice.html?inv=${s.invoiceNo}" class="text-decoration-none fw-bold">${s.invoiceNo}</a></td>
        <td>${s.customerName}</td>
        <td>${APP.fmtDate(s.date)}</td>
        <td class="text-end fw-bold text-success">${APP.fmt(s.grandTotal)}</td>
      </tr>`).join('');
  },

  renderRecentRestocks() {
    const stock = DB.getStockEntries().filter(s => s.status === 'posted').slice(0, 10);
    const tbody = document.getElementById('recentRestockBody');
    if (!tbody) return;
    if (!stock.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">${t('noData')}</td></tr>`;
      return;
    }
    tbody.innerHTML = stock.map(s => `
      <tr>
        <td>${s.productName}</td>
        <td>${s.supplierName || '-'}</td>
        <td>${APP.fmtDate(s.date)}</td>
        <td class="text-end fw-bold text-primary">+${s.quantity}</td>
      </tr>`).join('');
  },

  renderLowStock() {
    const low = DB.getLowStockProducts();
    const el = document.getElementById('lowStockList');
    if (!el) return;
    if (!low.length) {
      el.innerHTML = `<div class="text-center text-muted py-3"><i class="bi bi-check-circle text-success fs-3 d-block mb-2"></i>All stock levels OK</div>`;
      return;
    }
    el.innerHTML = low.map(p => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div>
          <div class="fw-semibold">${p.name}</div>
          <small class="text-muted">${p.category || ''}</small>
        </div>
        <div class="text-end">
          <span class="badge bg-danger">${p.currentStock} ${p.unit}</span>
          <br><small class="text-muted">Min: ${p.reorderLevel}</small>
        </div>
      </div>`).join('');
  },

  renderSalesChart() {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;

    // Get last 7 days sales
    const days = [];
    const amounts = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const dayLabel = `${d.getDate()}/${d.getMonth()+1}`;
      days.push(dayLabel);
      const daySales = DB.getSales().filter(s => s.status === 'posted' && new Date(s.date).toDateString() === dayStr);
      amounts.push(daySales.reduce((sum, s) => sum + s.grandTotal, 0));
    }

    const ctx = canvas.getContext('2d');
    // Simple bar chart drawn with canvas (no Chart.js dependency)
    const W = canvas.width, H = canvas.height;
    const maxVal = Math.max(...amounts, 1);
    const barW = (W - 60) / days.length - 8;
    const chartH = H - 50;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#dee2e6';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = 10 + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 10, y); ctx.stroke();
      ctx.fillStyle = '#6c757d';
      ctx.font = '10px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal - (maxVal / 4) * i), 35, y + 4);
    }

    // Bars
    days.forEach((day, i) => {
      const x = 50 + i * (barW + 8);
      const barH = amounts[i] > 0 ? (amounts[i] / maxVal) * (chartH - 10) : 2;
      const y = 10 + (chartH - barH);

      // Bar gradient
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, '#0d6efd');
      grad.addColorStop(1, '#6ea8fe');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      ctx.fill();

      // Value label on top
      if (amounts[i] > 0) {
        ctx.fillStyle = '#0d6efd';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(amounts[i]), x + barW / 2, y - 3);
      }

      // Day label
      ctx.fillStyle = '#495057';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(day, x + barW / 2, H - 5);
    });

    // Title
    ctx.fillStyle = '#212529';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Last 7 Days Sales (BDT)', W / 2, H - 30);
  }
};

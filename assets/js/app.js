/**
 * app.js - Core Application Logic
 * Navigation, utilities, header rendering, toast notifications
 */

const APP = {
  currentPage: '',

  init() {
    // Seed demo data if first time
    if (!DB.isSetupDone()) {
      DB.seedDemo();
    }
    this.applyTheme(DB.getTheme());
    this.renderHeader();
    this.renderNav();
    this.renderFooter();
    this.updateSyncStatus();
    this.applyLang();
    this.checkStorageQuota();

    // Listen for online/offline
    window.addEventListener('online', () => this.updateSyncStatus());
    window.addEventListener('offline', () => this.updateSyncStatus());

    // Language toggle
    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
      langToggle.addEventListener('click', () => {
        const lang = DB.getLang() === 'en' ? 'bn' : 'en';
        DB.setLang(lang);
        location.reload();
      });
    }

    // Sync button
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => GOOGLE.syncAll());
    }
  },

  renderHeader() {
    const shop = DB.getShop();
    const headers = document.querySelectorAll('.shop-header');
    headers.forEach(h => {
      h.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          ${shop.logo ? `<img src="${shop.logo}" alt="Logo" class="shop-logo" style="height:40px;width:40px;object-fit:contain;border-radius:8px;">` : `<div class="shop-logo-placeholder"><i class="bi bi-shop"></i></div>`}
          <div>
            <div class="shop-name">${shop.name || 'My Shop'}</div>
            <div class="shop-address text-muted small">${shop.address || ''} ${shop.mobile ? '| ' + shop.mobile : ''}</div>
          </div>
        </div>`;
    });

    // Topbar shop name
    const topShopName = document.getElementById('topShopName');
    if (topShopName) topShopName.textContent = shop.name || 'Sales & Inventory';
  },

  renderNav() {
    const nav = document.getElementById('sideNav');
    if (!nav) return;
    const page    = this.currentPage;
    const isRoot  = !window.location.pathname.includes('/pages/');
    const prefix  = isRoot ? 'pages/' : '';
    const dashHref = isRoot ? '#' : '../index.html';

    // Get allowed pages for current role (if AUTH is loaded)
    const allowedPages = (typeof AUTH !== 'undefined' && AUTH.getSession())
      ? AUTH.getRoleConfig().pages
      : null; // null = show all (fallback when auth not yet loaded)

    const items = [
      { key: 'dashboard',  icon: 'bi-speedometer2',  href: dashHref },
      { key: 'invoice',    icon: 'bi-receipt',        href: prefix + 'invoice.html' },
      { key: 'products',   icon: 'bi-box-seam',       href: prefix + 'products.html' },
      { key: 'restock',    icon: 'bi-arrow-repeat',   href: prefix + 'restock.html' },
      { key: 'finance',    icon: 'bi-wallet2',        href: prefix + 'finance.html' },
      { key: 'investors',  icon: 'bi-people-fill',    href: prefix + 'investors.html' },
      { key: 'masterData', icon: 'bi-table',          href: prefix + 'master-data.html' },
      { key: 'reports',    icon: 'bi-bar-chart',      href: prefix + 'reports.html' },
      { key: 'settings',   icon: 'bi-gear',           href: prefix + 'settings.html' },
    ];

    // Filter to only pages this role can access
    const visible = allowedPages
      ? items.filter(item => allowedPages.includes(item.key))
      : items;

    nav.innerHTML = visible.map(item => `
      <a href="${item.href}" class="nav-link ${page === item.key ? 'active' : ''}">
        <i class="bi ${item.icon}"></i>
        <span>${t(item.key)}</span>
      </a>`).join('');
  },

  updateSyncStatus() {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    const online = navigator.onLine;
    const signedIn = GOOGLE.isSignedIn ? GOOGLE.isSignedIn() : false;
    const pending = DB.getPendingSync().length;
    let html = '';
    if (!online) {
      html = `<span class="badge bg-secondary"><i class="bi bi-wifi-off"></i> ${t('offline')}</span>`;
    } else if (!signedIn) {
      html = `<span class="badge bg-warning text-dark"><i class="bi bi-cloud-slash"></i> ${t('offline')}</span>`;
    } else if (pending > 0) {
      html = `<span class="badge bg-warning text-dark"><i class="bi bi-cloud-upload"></i> ${t('pendingSync')} (${pending})</span>`;
    } else {
      html = `<span class="badge bg-success"><i class="bi bi-cloud-check"></i> ${t('synced')}</span>`;
    }
    el.innerHTML = html;
  },

  showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const colors = { success: 'bg-success', error: 'bg-danger', warning: 'bg-warning text-dark', info: 'bg-info text-dark' };
    const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
    const id = 'toast-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = `toast align-items-center text-white ${colors[type] || 'bg-info'} border-0 mb-2`;
    div.setAttribute('role', 'alert');
    div.innerHTML = `<div class="d-flex"><div class="toast-body d-flex align-items-center gap-2"><i class="bi ${icons[type]}"></i>${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    container.appendChild(div);
    const toast = new bootstrap.Toast(div, { delay: 3500 });
    toast.show();
    div.addEventListener('hidden.bs.toast', () => div.remove());
  },

  showConfirm(msg, onYes) {
    document.getElementById('confirmMsg').textContent = msg;
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    modal.show();
    document.getElementById('confirmYes').onclick = () => { modal.hide(); onYes(); };
  },

  applyLang() {
    document.querySelectorAll('[data-t]').forEach(el => {
      el.textContent = t(el.getAttribute('data-t'));
    });
    document.querySelectorAll('[data-tp]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-tp'));
    });
  },

  fmt(amount) {
    const settings = DB.getSettings();
    const cur = settings.currency || 'BDT';
    return `${cur} ${parseFloat(amount || 0).toFixed(2)}`;
  },

  fmtDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  },

  exportCSV(data, filename) {
    if (!data || !data.length) return;
    const keys = Object.keys(data[0]);
    const rows = [keys.join(','), ...data.map(r => keys.map(k => `"${(r[k] || '').toString().replace(/"/g,'""')}"`).join(','))];
    this.downloadFile(rows.join('\n'), filename, 'text/csv;charset=utf-8;');
  },

  exportJSON(data, filename) {
    this.downloadFile(JSON.stringify(data, null, 2), filename, 'application/json');
  },

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },

  printElement(el) {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Print</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
      <style>body{padding:20px;font-size:13px;} @media print{.no-print{display:none}}</style>
      </head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 500);
  },

  applyTheme(theme) {
    document.body.setAttribute('data-theme', theme || 'default');
  },

  // Escape user content before inserting into innerHTML
  esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },

  renderFooter() {
    const shop = DB.getShop();
    const year = new Date().getFullYear();
    const shopName = shop.name || 'Shop';
    const footers = document.querySelectorAll('.app-footer');
    footers.forEach(f => {
      f.innerHTML = `
        <span class="footer-left">Developed by <strong>Sabbir Hossain@QureMap</strong> &copy; ${year}</span>
        <span class="footer-right"><strong>${this.esc(shopName)}</strong> &copy; ${year}</span>`;
    });
  },

  checkStorageQuota() {
    try {
      let total = 0;
      Object.keys(localStorage).forEach(k => { total += (localStorage.getItem(k) || '').length; });
      const pct = (total / (5 * 1024 * 1024)) * 100;
      if (pct > 85) {
        this.showToast(`⚠️ Storage ${pct.toFixed(0)}% full. Export a backup soon!`, 'warning');
      }
    } catch (e) { /* silent */ }
  },

  paginate(data, page, perPage = 20) {
    const total = data.length;
    const pages = Math.ceil(total / perPage);
    const start = (page - 1) * perPage;
    return { data: data.slice(start, start + perPage), page, pages, total };
  },

  renderPagination(containerId, page, pages, onPage) {
    const el = document.getElementById(containerId);
    if (!el || pages <= 1) { if (el) el.innerHTML = ''; return; }
    let html = '<ul class="pagination pagination-sm mb-0">';
    html += `<li class="page-item ${page === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${page-1}">‹</a></li>`;
    for (let i = 1; i <= pages; i++) {
      html += `<li class="page-item ${i === page ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
    }
    html += `<li class="page-item ${page === pages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${page+1}">›</a></li>`;
    html += '</ul>';
    el.innerHTML = html;
    el.querySelectorAll('[data-page]').forEach(a => {
      a.addEventListener('click', e => { e.preventDefault(); const p = parseInt(a.dataset.page); if (p >= 1 && p <= pages) onPage(p); });
    });
  }
};

// Bootstrap common modal for confirmations (injected into every page)
function injectCommonUI() {
  const modals = `
  <div id="toastContainer" class="toast-container position-fixed top-0 end-0 p-3" style="z-index:9999;"></div>
  <div class="modal fade" id="confirmModal" tabindex="-1">
    <div class="modal-dialog modal-sm modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header py-2"><h6 class="modal-title">${t('confirmDelete')}</h6></div>
        <div class="modal-body py-2"><p id="confirmMsg">${t('deleteMsg')}</p></div>
        <div class="modal-footer py-2">
          <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">${t('no')}</button>
          <button class="btn btn-danger btn-sm" id="confirmYes">${t('yes')}</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', modals);
}

document.addEventListener('DOMContentLoaded', () => {
  injectCommonUI();
  APP.init();
});

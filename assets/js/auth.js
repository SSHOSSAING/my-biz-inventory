/**
 * auth.js — Role-based Access Control
 * PIN login, session management, page guards, audit trail
 */

const AUTH = {
  SESSION_KEY: 'sis_session',
  USERS_KEY:   'sis_users',
  SESSION_TTL: 8 * 60 * 60 * 1000, // 8 hours in ms

  // ── Role definitions ────────────────────────────────────────
  ROLES: {
    owner: {
      label: 'Owner',
      icon:  'bi-person-badge',
      color: '#6d28d9',
      pages: ['dashboard','invoice','products','restock','finance','investors','masterData','reports','settings'],
      canSync:          true,
      canDeleteRecords: true,
      canViewPurchasePrice: true,
      canAccessSettings: true,
      maxDiscountPct:   100,
    },
    manager: {
      label: 'Manager',
      icon:  'bi-person-gear',
      color: '#0a7c4e',
      pages: ['dashboard','invoice','products','restock'],
      canSync:          false,
      canDeleteRecords: false,
      canViewPurchasePrice: true,
      canAccessSettings: false,
      maxDiscountPct:   20,
    },
    salesman: {
      label: 'Salesman',
      icon:  'bi-person',
      color: '#1a56db',
      pages: ['invoice'],
      canSync:          false,
      canDeleteRecords: false,
      canViewPurchasePrice: false,
      canAccessSettings: false,
      maxDiscountPct:   10,
    },
  },

  // Page key → file path mapping (used for guards)
  PAGE_MAP: {
    dashboard:  ['index.html', ''],
    invoice:    ['pages/invoice.html'],
    products:   ['pages/products.html'],
    restock:    ['pages/restock.html'],
    finance:    ['pages/finance.html'],
    investors:  ['pages/investors.html'],
    masterData: ['pages/master-data.html'],
    reports:    ['pages/reports.html'],
    settings:   ['pages/settings.html'],
  },

  // ── User management ─────────────────────────────────────────
  getUsers() {
    const stored = localStorage.getItem(this.USERS_KEY);
    if (stored) return JSON.parse(stored);
    // Default users — owner PIN 1234, manager PIN 2222
    const defaults = [
      { id: 'user-owner',   role: 'owner',   name: 'Owner',   pin: this._hash('1234'), active: true },
      { id: 'user-manager', role: 'manager', name: 'Manager', pin: this._hash('2222'), active: true },
    ];
    localStorage.setItem(this.USERS_KEY, JSON.stringify(defaults));
    return defaults;
  },

  saveUsers(users) {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  },

  addUser(name, role, pin) {
    const users = this.getUsers();
    // Validate PIN uniqueness across same role
    const exists = users.find(u => u.role === role && u.pin === this._hash(pin) && u.active);
    if (exists) return { ok: false, error: 'PIN already used by another ' + role };
    const user = {
      id:      'user-' + Date.now(),
      role, name,
      pin:     this._hash(pin),
      active:  true,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    this.saveUsers(users);
    return { ok: true, user };
  },

  updateUserPIN(userId, newPin) {
    const users = this.getUsers();
    const idx   = users.findIndex(u => u.id === userId);
    if (idx === -1) return { ok: false, error: 'User not found' };
    users[idx].pin = this._hash(newPin);
    this.saveUsers(users);
    return { ok: true };
  },

  updateUserName(userId, name) {
    const users = this.getUsers();
    const idx   = users.findIndex(u => u.id === userId);
    if (idx === -1) return { ok: false, error: 'User not found' };
    users[idx].name = name;
    this.saveUsers(users);
    return { ok: true };
  },

  deactivateUser(userId) {
    const users = this.getUsers();
    const idx   = users.findIndex(u => u.id === userId);
    if (idx === -1) return false;
    // Don't allow deactivating the only owner
    if (users[idx].role === 'owner' && users.filter(u => u.role === 'owner' && u.active).length <= 1) {
      return { ok: false, error: 'Cannot remove the last active owner account' };
    }
    users[idx].active = false;
    this.saveUsers(users);
    return { ok: true };
  },

  // ── PIN verification ─────────────────────────────────────────
  verifyPIN(role, pin, userId = null) {
    const users = this.getUsers().filter(u => u.active);

    if (role === 'salesman' && userId) {
      // Specific salesman — verify their individual PIN
      const user = users.find(u => u.id === userId && u.role === 'salesman');
      if (!user) return { ok: false, error: 'User not found' };
      if (user.pin !== this._hash(pin)) return { ok: false, error: 'Incorrect PIN' };
      return { ok: true, user };
    }

    if (role === 'owner') {
      const user = users.find(u => u.role === 'owner' && u.pin === this._hash(pin));
      if (!user) return { ok: false, error: 'Incorrect owner PIN' };
      return { ok: true, user };
    }

    if (role === 'manager') {
      const user = users.find(u => u.role === 'manager' && u.pin === this._hash(pin));
      if (!user) return { ok: false, error: 'Incorrect manager PIN' };
      return { ok: true, user };
    }

    return { ok: false, error: 'Unknown role' };
  },

  // ── Session management ───────────────────────────────────────
  startSession(user) {
    const session = {
      userId:    user.id,
      role:      user.role,
      name:      user.name,
      startedAt: Date.now(),
      expiresAt: Date.now() + this.SESSION_TTL,
    };
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    // Log the login event (after session is set so getUserName works)
    this.log('login', { role: user.role });
  },

  getSession() {
    try {
      const raw = sessionStorage.getItem(this.SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (Date.now() > session.expiresAt) {
        sessionStorage.removeItem(this.SESSION_KEY);
        return null;
      }
      return session;
    } catch { return null; }
  },

  isLoggedIn() { return !!this.getSession(); },

  getRole()    { return this.getSession()?.role || null; },
  getUserName(){ return this.getSession()?.name || 'Unknown'; },
  getUserId()  { return this.getSession()?.userId || null; },

  getRoleConfig(role) {
    return this.ROLES[role || this.getRole()] || this.ROLES.salesman;
  },

  can(permission) {
    const cfg = this.getRoleConfig();
    return !!cfg[permission];
  },

  // Detect if current page is inside /pages/ subfolder
  _isInPages() {
    const p = window.location.pathname;
    const h = window.location.href;
    return p.includes('/pages/') || h.includes('/pages/');
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.href = this._isInPages() ? '../login.html' : 'login.html';
  },

  // ── Page guard — call at top of every page ───────────────────
  guard(pageKey) {
    const session = this.getSession();
    if (!session) {
      window.location.href = this._isInPages() ? '../login.html' : 'login.html';
      return false;
    }
    const cfg = this.getRoleConfig(session.role);
    if (!cfg.pages.includes(pageKey)) {
      const first = cfg.pages[0];
      if (first === 'dashboard') {
        window.location.href = this._isInPages() ? '../index.html' : 'index.html';
      } else {
        const file = Object.entries(this.PAGE_MAP).find(([k]) => k === first)?.[1]?.[0] || 'index.html';
        if (this._isInPages()) {
          window.location.href = file.startsWith('pages/') ? '../' + file : file;
        } else {
          window.location.href = file;
        }
      }
      return false;
    }
    return true;
  },

  // ── UI restriction helpers ───────────────────────────────────
  applyRestrictions() {
    const session = this.getSession();
    if (!session) return;
    const cfg = this.getRoleConfig(session.role);

    // Hide purchase prices for salesmen
    if (!cfg.canViewPurchasePrice) {
      document.querySelectorAll('.purchase-price-col, .col-purchase-price, [data-hide-salesman]').forEach(el => {
        el.style.display = 'none';
      });
    }

    // Hide sync button for non-owners
    if (!cfg.canSync) {
      document.querySelectorAll('#syncBtn, #syncBtn2, .sync-only').forEach(el => {
        el.style.display = 'none';
      });
    }

    // Hide settings nav link for non-owners
    if (!cfg.canAccessSettings) {
      document.querySelectorAll('[href*="settings.html"], [href*="settings"]').forEach(el => {
        el.closest('a')?.remove();
      });
    }

    // Hide delete buttons for restricted roles
    if (!cfg.canDeleteRecords) {
      document.querySelectorAll('.delete-only, [data-owner-only]').forEach(el => {
        el.style.display = 'none';
      });
    }

    // Apply max discount limit on invoice page
    const discountInput = document.getElementById('invDiscount');
    if (discountInput && cfg.maxDiscountPct < 100) {
      discountInput.dataset.maxPct = cfg.maxDiscountPct;
    }
  },

  // Render the staff badge in the topbar
  renderUserBadge() {
    const session = this.getSession();
    if (!session) return;
    const cfg   = this.getRoleConfig(session.role);
    const badge = document.getElementById('userBadge');
    if (!badge) return;
    badge.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <div style="width:30px;height:30px;border-radius:8px;background:${cfg.color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700;flex-shrink:0;">
          ${(session.name || '?')[0].toUpperCase()}
        </div>
        <div class="d-none d-md-block" style="line-height:1.2;">
          <div style="font-size:12px;font-weight:600;">${session.name}</div>
          <div style="font-size:10px;color:#6c757d;">${cfg.label}</div>
        </div>
        <button class="btn btn-sm btn-outline-secondary ms-1" onclick="AUTH.logout()" title="Logout" style="padding:3px 8px;font-size:12px;">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>`;
  },

  // ── Simple PIN hash (not cryptographic — UI security only) ───
  _hash(pin) {
    // djb2-style hash — sufficient for local PIN storage
    let h = 5381;
    for (let i = 0; i < pin.length; i++) {
      h = ((h << 5) + h) + pin.charCodeAt(i);
      h = h & 0xffffffff;
    }
    return h.toString(16);
  },

  // ── Audit logging ────────────────────────────────────────────
  AUDIT_KEY: 'sis_audit_log',

  log(action, details = {}) {
    const session = this.getSession();
    try {
      const existing = JSON.parse(localStorage.getItem(this.AUDIT_KEY) || '[]');
      existing.unshift({
        id:        'log-' + Date.now(),
        timestamp: new Date().toISOString(),
        userId:    session?.userId  || 'unknown',
        userName:  session?.name    || 'Unknown',
        userRole:  session?.role    || 'unknown',
        action,
        details,
      });
      // Keep last 500 log entries
      localStorage.setItem(this.AUDIT_KEY, JSON.stringify(existing.slice(0, 500)));
    } catch (e) { /* silent — audit log failure must not break the app */ }
  },

  getAuditLog(limit = 100) {
    try {
      return JSON.parse(localStorage.getItem(this.AUDIT_KEY) || '[]').slice(0, limit);
    } catch { return []; }
  },

  clearAuditLog() {
    localStorage.removeItem(this.AUDIT_KEY);
  },
};

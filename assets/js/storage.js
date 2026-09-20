/**
 * storage.js - LocalStorage Database Layer
 * Handles all data persistence for the offline Sales & Inventory System
 */

const DB = {
  // Keys
  KEYS: {
    SHOP: 'sis_shop',
    PRODUCTS: 'sis_products',
    CUSTOMERS: 'sis_customers',
    SUPPLIERS: 'sis_suppliers',
    SALES: 'sis_sales',
    STOCK: 'sis_stock',
    SETTINGS: 'sis_settings',
    PENDING_SYNC: 'sis_pending_sync',
    LAST_SYNC: 'sis_last_sync',
    INVOICE_COUNTER: 'sis_invoice_counter',
    PRODUCT_COUNTER: 'sis_product_counter',
    GOOGLE_AUTH: 'sis_google_auth',
    SPREADSHEET_ID: 'sis_spreadsheet_id',
    SETUP_DONE: 'sis_setup_done',
    LANG: 'sis_lang',
    CATEGORIES: 'sis_categories',
    THEME: 'sis_theme',
    EXPENSES: 'sis_expenses',
    INVESTMENTS: 'sis_investments',
    INVESTORS: 'sis_investors',
    DUE_PAYMENTS: 'sis_due_payments',
    EXPENSE_COUNTER: 'sis_expense_counter',
    INVEST_COUNTER: 'sis_invest_counter',
  },

  // Generic get/set
  get(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage error:', e);
      return false;
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  // --- SHOP PROFILE ---
  getShop() {
    return this.get(this.KEYS.SHOP) || {
      name: '', owner: '', mobile: '', whatsapp: '',
      address: '', email: '', logo: ''
    };
  },
  saveShop(data) { return this.set(this.KEYS.SHOP, data); },

  // --- PRODUCTS ---
  getProducts() { return this.get(this.KEYS.PRODUCTS) || []; },
  saveProducts(list) { return this.set(this.KEYS.PRODUCTS, list); },
  getProduct(id) { return this.getProducts().find(p => p.id === id) || null; },
  addProduct(product) {
    const list = this.getProducts();
    const counter = (this.get(this.KEYS.PRODUCT_COUNTER) || 0) + 1;
    this.set(this.KEYS.PRODUCT_COUNTER, counter);
    product.id = 'PRD-' + String(counter).padStart(4, '0');
    product.createdAt = new Date().toISOString();
    product.updatedAt = new Date().toISOString();
    list.push(product);
    this.saveProducts(list);
    this.addPending('product_add', product);
    return product;
  },
  updateProduct(id, data) {
    const list = this.getProducts();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
    this.saveProducts(list);
    this.addPending('product_update', list[idx]);
    return list[idx];
  },
  deleteProduct(id) {
    const list = this.getProducts().filter(p => p.id !== id);
    this.saveProducts(list);
    return true;
  },
  getLowStockProducts() {
    return this.getProducts().filter(p => p.status === 'active' && p.currentStock <= p.reorderLevel);
  },
  getTotalInventoryValue() {
    return this.getProducts().reduce((sum, p) => sum + (p.currentStock * p.purchasePrice), 0);
  },

  // --- CUSTOMERS ---
  getCustomers() { return this.get(this.KEYS.CUSTOMERS) || []; },
  saveCustomers(list) { return this.set(this.KEYS.CUSTOMERS, list); },
  addCustomer(c) {
    const list = this.getCustomers();
    c.id = 'CUS-' + Date.now();
    c.createdAt = new Date().toISOString();
    list.push(c);
    this.saveCustomers(list);
    this.addPending('customer_add', c);
    return c;
  },
  updateCustomer(id, data) {
    const list = this.getCustomers();
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...data };
    this.saveCustomers(list);
    return list[idx];
  },
  deleteCustomer(id) {
    this.saveCustomers(this.getCustomers().filter(c => c.id !== id));
  },

  // --- SUPPLIERS ---
  getSuppliers() { return this.get(this.KEYS.SUPPLIERS) || []; },
  saveSuppliers(list) { return this.set(this.KEYS.SUPPLIERS, list); },
  addSupplier(s) {
    const list = this.getSuppliers();
    s.id = 'SUP-' + Date.now();
    s.createdAt = new Date().toISOString();
    list.push(s);
    this.saveSuppliers(list);
    this.addPending('supplier_add', s);
    return s;
  },
  updateSupplier(id, data) {
    const list = this.getSuppliers();
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...data };
    this.saveSuppliers(list);
    return list[idx];
  },
  deleteSupplier(id) {
    this.saveSuppliers(this.getSuppliers().filter(s => s.id !== id));
  },

  // --- SALES ---
  getSales() { return this.get(this.KEYS.SALES) || []; },
  saveSales(list) { return this.set(this.KEYS.SALES, list); },
  getSale(invoiceNo) { return this.getSales().find(s => s.invoiceNo === invoiceNo) || null; },
  generateInvoiceNo() {
    const today = new Date();
    const dateStr = today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');
    const counter = (this.get(this.KEYS.INVOICE_COUNTER) || 0) + 1;
    this.set(this.KEYS.INVOICE_COUNTER, counter);
    return `INV-${dateStr}-${String(counter).padStart(3, '0')}`;
  },
  addSale(sale) {
    const list = this.getSales();
    sale.createdAt = new Date().toISOString();
    // Deduct stock
    if (sale.status === 'posted') {
      sale.items.forEach(item => {
        this.updateProductStock(item.productId, -item.quantity);
      });
    }
    list.unshift(sale);
    this.saveSales(list);
    if (sale.status === 'posted') this.addPending('sale_add', sale);
    return sale;
  },
  updateSale(invoiceNo, data) {
    const list = this.getSales();
    const idx = list.findIndex(s => s.invoiceNo === invoiceNo);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...data };
    this.saveSales(list);
    return list[idx];
  },
  getTodaySales() {
    const today = new Date().toDateString();
    return this.getSales().filter(s => s.status === 'posted' && new Date(s.date).toDateString() === today);
  },
  getMonthlySales() {
    const now = new Date();
    return this.getSales().filter(s => {
      if (s.status !== 'posted') return false;
      const d = new Date(s.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  },
  updateProductStock(productId, delta) {
    const product = this.getProduct(productId);
    if (!product) return;
    const newStock = Math.max(0, (product.currentStock || 0) + delta);
    this.updateProduct(productId, { currentStock: newStock });
  },

  // --- STOCK (RESTOCK) ---
  getStockEntries() { return this.get(this.KEYS.STOCK) || []; },
  saveStockEntries(list) { return this.set(this.KEYS.STOCK, list); },
  addStockEntry(entry) {
    const list = this.getStockEntries();
    entry.id = 'STK-' + Date.now();
    entry.createdAt = new Date().toISOString();
    if (entry.status === 'posted') {
      this.updateProductStock(entry.productId, entry.quantity);
      this.addPending('stock_add', entry);
    }
    list.unshift(entry);
    this.saveStockEntries(list);
    return entry;
  },

  // --- SYNC ---
  getPendingSync() { return this.get(this.KEYS.PENDING_SYNC) || []; },
  addPending(type, data) {
    const list = this.getPendingSync();
    list.push({ type, data, timestamp: new Date().toISOString() });
    this.set(this.KEYS.PENDING_SYNC, list);
  },
  clearPending() { this.set(this.KEYS.PENDING_SYNC, []); },
  getLastSync() { return this.get(this.KEYS.LAST_SYNC); },
  setLastSync() { this.set(this.KEYS.LAST_SYNC, new Date().toISOString()); },

  // --- SETTINGS ---
  getSettings() {
    return this.get(this.KEYS.SETTINGS) || {
      googleEmail: '', spreadsheetId: '', taxRate: 0,
      currency: 'BDT', dateFormat: 'DD/MM/YYYY', lang: 'en'
    };
  },
  saveSettings(s) { return this.set(this.KEYS.SETTINGS, s); },

  // --- EXPORT / IMPORT ---
  exportAll() {
    return {
      shop: this.getShop(),
      products: this.getProducts(),
      customers: this.getCustomers(),
      suppliers: this.getSuppliers(),
      sales: this.getSales(),
      stock: this.getStockEntries(),
      expenses: this.getExpenses(),
      investments: this.getInvestments(),
      investors: this.getInvestors(),
      duePayments: this.getDuePayments(),
      settings: this.getSettings(),
      exportedAt: new Date().toISOString()
    };
  },
  importAll(data) {
    if (!data || typeof data !== 'object') return { ok: false, error: 'Invalid file format' };
    const hasAny = data.shop || data.products || data.sales || data.settings;
    if (!hasAny) return { ok: false, error: 'File does not appear to be a valid backup' };
    if (data.products && !Array.isArray(data.products)) return { ok: false, error: 'Invalid products data' };
    if (data.sales && !Array.isArray(data.sales)) return { ok: false, error: 'Invalid sales data' };
    if (data.shop) this.saveShop(data.shop);
    if (data.products) this.saveProducts(data.products);
    if (data.customers) this.saveCustomers(data.customers);
    if (data.suppliers) this.saveSuppliers(data.suppliers);
    if (data.sales) this.saveSales(data.sales);
    if (data.stock) this.saveStockEntries(data.stock);
    if (data.expenses) this.set(this.KEYS.EXPENSES, data.expenses);
    if (data.investments) this.set(this.KEYS.INVESTMENTS, data.investments);
    if (data.investors) this.saveInvestors(data.investors);
    if (data.duePayments) this.set(this.KEYS.DUE_PAYMENTS, data.duePayments);
    if (data.settings) this.saveSettings(data.settings);
    return { ok: true };
  },

  // --- SETUP ---
  isSetupDone() { return !!this.get(this.KEYS.SETUP_DONE); },
  markSetupDone() { this.set(this.KEYS.SETUP_DONE, true); },

  // Language
  getLang() { return this.get(this.KEYS.LANG) || 'en'; },
  setLang(l) { this.set(this.KEYS.LANG, l); },

  // Theme
  getTheme() { return this.get(this.KEYS.THEME) || 'default'; },
  setTheme(t) { this.set(this.KEYS.THEME, t); },

  // Categories
  DEFAULT_CATEGORIES: ['Grocery','Snacks','Beverages','Dairy','Personal Care','Medicine','Stationery','Electronics','Clothing','Frozen Food','Bakery','Household'],
  getCategories() {
    const stored = this.get(this.KEYS.CATEGORIES);
    return stored || [...this.DEFAULT_CATEGORIES];
  },
  saveCategories(list) { return this.set(this.KEYS.CATEGORIES, list); },
  addCategory(name) {
    const list = this.getCategories();
    const trimmed = name.trim();
    if (!trimmed || list.includes(trimmed)) return false;
    list.push(trimmed);
    this.saveCategories(list);
    return true;
  },
  deleteCategory(name) {
    const list = this.getCategories().filter(c => c !== name);
    this.saveCategories(list);
  },

  // Google Auth
  getGoogleAuth() { return this.get(this.KEYS.GOOGLE_AUTH); },
  saveGoogleAuth(data) { this.set(this.KEYS.GOOGLE_AUTH, data); },
  getSpreadsheetId() { return this.get(this.KEYS.SPREADSHEET_ID); },
  saveSpreadsheetId(id) { this.set(this.KEYS.SPREADSHEET_ID, id); },

  // ─── DUE PAYMENTS ───────────────────────────────────────────
  getDuePayments() { return this.get(this.KEYS.DUE_PAYMENTS) || []; },
  addDuePayment(payment) {
    const list = this.getDuePayments();
    payment.id = 'DPY-' + Date.now();
    payment.createdAt = new Date().toISOString();
    list.unshift(payment);
    this.set(this.KEYS.DUE_PAYMENTS, list);
    // Update the sale's paidAmount and dueAmount
    const sale = this.getSale(payment.invoiceNo);
    if (sale) {
      const newPaid = (sale.paidAmount || 0) + payment.amount;
      const newDue  = Math.max(0, sale.grandTotal - newPaid);
      this.updateSale(payment.invoiceNo, { paidAmount: newPaid, dueAmount: newDue });
    }
    this.addPending('due_payment', payment);
    return payment;
  },
  getDuePaymentsForInvoice(invoiceNo) {
    return this.getDuePayments().filter(p => p.invoiceNo === invoiceNo);
  },
  getTotalOutstanding() {
    return this.getSales()
      .filter(s => s.status === 'posted' && s.dueAmount > 0)
      .reduce((sum, s) => sum + s.dueAmount, 0);
  },

  // ─── EXPENSES ───────────────────────────────────────────────
  EXPENSE_CATEGORIES: ['Rent','Salaries','Electricity','Water','Internet','Transport',
    'Packaging','Marketing','Maintenance','Bank Charges','Tax','Miscellaneous'],
  getExpenses() { return this.get(this.KEYS.EXPENSES) || []; },
  addExpense(exp) {
    const list = this.getExpenses();
    const counter = (this.get(this.KEYS.EXPENSE_COUNTER) || 0) + 1;
    this.set(this.KEYS.EXPENSE_COUNTER, counter);
    exp.id = 'EXP-' + String(counter).padStart(4, '0');
    exp.createdAt = new Date().toISOString();
    list.unshift(exp);
    this.set(this.KEYS.EXPENSES, list);
    this.addPending('expense_add', exp);
    return exp;
  },
  updateExpense(id, data) {
    const list = this.getExpenses();
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...data };
    this.set(this.KEYS.EXPENSES, list);
    return list[idx];
  },
  deleteExpense(id) {
    this.set(this.KEYS.EXPENSES, this.getExpenses().filter(e => e.id !== id));
  },
  getExpensesInRange(from, to) {
    return this.getExpenses().filter(e => {
      const d = new Date(e.date);
      return d >= new Date(from) && d <= new Date(to + 'T23:59:59');
    });
  },
  getTotalExpenses(from, to) {
    const list = from ? this.getExpensesInRange(from, to) : this.getExpenses();
    return list.reduce((s, e) => s + (e.amount || 0), 0);
  },

  // ─── INVESTORS ──────────────────────────────────────────────
  getInvestors() { return this.get(this.KEYS.INVESTORS) || []; },
  saveInvestors(list) { return this.set(this.KEYS.INVESTORS, list); },
  getInvestor(id) { return this.getInvestors().find(v => v.id === id) || null; },
  addInvestor(inv) {
    const list = this.getInvestors();
    inv.id = 'INV-' + Date.now();
    inv.createdAt = new Date().toISOString();
    list.push(inv);
    this.saveInvestors(list);
    return inv;
  },
  updateInvestor(id, data) {
    const list = this.getInvestors();
    const idx = list.findIndex(v => v.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...data };
    this.saveInvestors(list);
    return list[idx];
  },
  deleteInvestor(id) {
    this.saveInvestors(this.getInvestors().filter(v => v.id !== id));
    // also remove their investments
    this.set(this.KEYS.INVESTMENTS, this.getInvestments().filter(i => i.investorId !== id));
  },

  // ─── INVESTMENTS (capital transactions per investor) ─────────
  getInvestments() { return this.get(this.KEYS.INVESTMENTS) || []; },
  addInvestment(inv) {
    const list = this.getInvestments();
    const counter = (this.get(this.KEYS.INVEST_COUNTER) || 0) + 1;
    this.set(this.KEYS.INVEST_COUNTER, counter);
    inv.id = 'TXN-' + String(counter).padStart(4, '0');
    inv.createdAt = new Date().toISOString();
    list.unshift(inv);
    this.set(this.KEYS.INVESTMENTS, list);
    this.addPending('investment_add', inv);
    return inv;
  },
  deleteInvestment(id) {
    this.set(this.KEYS.INVESTMENTS, this.getInvestments().filter(i => i.id !== id));
  },
  getInvestmentsForInvestor(investorId) {
    return this.getInvestments().filter(i => i.investorId === investorId);
  },
  getTotalCapital() {
    return this.getInvestments()
      .filter(i => i.type === 'investment')
      .reduce((s, i) => s + (i.amount || 0), 0);
  },
  getTotalWithdrawals() {
    return this.getInvestments()
      .filter(i => i.type === 'withdrawal')
      .reduce((s, i) => s + (i.amount || 0), 0);
  },

  // ─── PROFIT CALCULATION ─────────────────────────────────────
  // Gross profit = Revenue - Cost of Goods Sold
  // Net profit   = Gross profit - Operating Expenses
  calcProfitSummary(from, to) {
    const sales = from
      ? this.getSales().filter(s => {
          if (s.status !== 'posted') return false;
          const d = new Date(s.date);
          return d >= new Date(from) && d <= new Date(to + 'T23:59:59');
        })
      : this.getSales().filter(s => s.status === 'posted');

    let revenue = 0, cogs = 0;
    sales.forEach(sale => {
      revenue += sale.grandTotal || 0;
      (sale.items || []).forEach(item => {
        const product = this.getProduct(item.productId);
        cogs += (product ? product.purchasePrice : 0) * item.quantity;
      });
    });

    const expenses = this.getTotalExpenses(from, to);
    const grossProfit = revenue - cogs;
    const netProfit   = grossProfit - expenses;
    const totalCapital = this.getTotalCapital();

    return { revenue, cogs, grossProfit, expenses, netProfit, totalCapital,
      roi: totalCapital > 0 ? ((netProfit / totalCapital) * 100).toFixed(1) : 0 };
  },

  // Distribute profit among investors based on share %
  distributeProfit(netProfit) {
    const investors = this.getInvestors();
    const totalShare = investors.reduce((s, v) => s + (v.sharePercent || 0), 0);
    return investors.map(v => {
      const pct = totalShare > 0 ? (v.sharePercent || 0) / totalShare * 100 : 0;
      const share = (netProfit * pct) / 100;
      const invested = this.getInvestmentsForInvestor(v.id)
        .filter(i => i.type === 'investment').reduce((s, i) => s + i.amount, 0);
      return { ...v, sharePercent: v.sharePercent, effectivePct: pct.toFixed(1),
        profitShare: share, invested };
    });
  },

  // Seed demo data
  seedDemo() {
    if (this.getProducts().length > 0) return;
    const shop = { name: 'XYZ General Shop', owner: 'Abdul Karim', mobile: '01800000000', whatsapp: '01800000000', address: "Station Road, Cox's Bazar", email: 'xyz@shop.com', logo: '' };
    this.saveShop(shop);

    const products = [
      { name: 'Rice (5kg)', category: 'Grocery', brand: 'Local', sku: 'RCE001', barcode: '', unit: 'Bag', purchasePrice: 280, sellingPrice: 320, currentStock: 50, reorderLevel: 10, description: '', status: 'active' },
      { name: 'Cooking Oil (1L)', category: 'Grocery', brand: 'Rupchanda', sku: 'OIL001', barcode: '', unit: 'Bottle', purchasePrice: 150, sellingPrice: 175, currentStock: 30, reorderLevel: 5, description: '', status: 'active' },
      { name: 'Sugar (1kg)', category: 'Grocery', brand: 'Local', sku: 'SGR001', barcode: '', unit: 'Kg', purchasePrice: 75, sellingPrice: 90, currentStock: 8, reorderLevel: 10, description: '', status: 'active' },
      { name: 'Salt (1kg)', category: 'Grocery', brand: 'ACI', sku: 'SLT001', barcode: '', unit: 'Pack', purchasePrice: 30, sellingPrice: 40, currentStock: 25, reorderLevel: 10, description: '', status: 'active' },
      { name: 'Biscuit (Tin)', category: 'Snacks', brand: 'Olympic', sku: 'BSC001', barcode: '', unit: 'Tin', purchasePrice: 120, sellingPrice: 145, currentStock: 3, reorderLevel: 5, description: '', status: 'active' },
    ];
    const counter = this.get(this.KEYS.PRODUCT_COUNTER) || 0;
    products.forEach((p, i) => {
      p.id = 'PRD-' + String(counter + i + 1).padStart(4, '0');
      p.createdAt = new Date().toISOString();
      p.updatedAt = new Date().toISOString();
    });
    this.set(this.KEYS.PRODUCT_COUNTER, counter + products.length);
    this.saveProducts(products);

    this.addCustomer({ name: 'Walk-in Customer', mobile: '', address: '', email: '', notes: 'Default walk-in' });
    this.addSupplier({ name: 'Dhaka Traders', mobile: '01711000000', address: 'Dhaka', email: '', notes: 'Main supplier' });
    this.markSetupDone();
  }
};

// Translations
const T = {
  en: {
    dashboard: 'Dashboard', products: 'Products', restock: 'Restock', invoice: 'Invoice',
    masterData: 'Master Data', settings: 'Settings', reports: 'Reports',
    finance: 'Finance', investors: 'Investors & Partners',
    todaySales: "Today's Sales", monthlySales: 'Monthly Sales', totalProducts: 'Total Products',
    availableStock: 'Available Stock', lowStock: 'Low Stock', inventoryValue: 'Inventory Value',
    recentSales: 'Recent Sales', recentRestocks: 'Recent Restocks',
    addProduct: 'Add Product', editProduct: 'Edit Product', deleteProduct: 'Delete Product',
    productName: 'Product Name', category: 'Category', brand: 'Brand', sku: 'SKU',
    unit: 'Unit', purchasePrice: 'Purchase Price', sellingPrice: 'Selling Price',
    currentStock: 'Current Stock', reorderLevel: 'Reorder Level', status: 'Status',
    active: 'Active', inactive: 'Inactive', save: 'Save', cancel: 'Cancel',
    search: 'Search', export: 'Export', sync: 'Sync Now', online: 'Online', offline: 'Offline',
    synced: 'Synced', pendingSync: 'Pending Sync', shopName: 'Shop Name', ownerName: 'Owner Name',
    mobile: 'Mobile', whatsapp: 'WhatsApp', address: 'Address', email: 'Email',
    logo: 'Logo', saveProfile: 'Save Profile', invoiceNo: 'Invoice No', customer: 'Customer',
    date: 'Date', product: 'Product', quantity: 'Quantity', price: 'Price', discount: 'Discount',
    tax: 'Tax', subtotal: 'Subtotal', grandTotal: 'Grand Total', paymentMethod: 'Payment Method',
    cash: 'Cash', bkash: 'Bkash', nagad: 'Nagad', rocket: 'Rocket', card: 'Card',
    paidAmount: 'Paid Amount', dueAmount: 'Due Amount', notes: 'Notes', saveDraft: 'Save Draft',
    postSale: 'Post Sale', printInvoice: 'Print Invoice', downloadPDF: 'Download PDF',
    whatsappInvoice: 'WhatsApp Invoice', newInvoice: 'New Invoice', supplier: 'Supplier',
    postStock: 'Post Stock', totalCost: 'Total Cost', exportJSON: 'Export JSON',
    importJSON: 'Import JSON', exportCSV: 'Export CSV', customers: 'Customers',
    suppliers: 'Suppliers', addCustomer: 'Add Customer', addSupplier: 'Add Supplier',
    customerName: 'Customer Name', supplierName: 'Supplier Name', confirmDelete: 'Confirm Delete',
    deleteMsg: 'Are you sure you want to delete this item?', yes: 'Yes', no: 'No',
    success: 'Success', error: 'Error', warning: 'Warning', info: 'Info',
    stockPosted: 'Stock posted successfully!', saleSaved: 'Sale saved successfully!',
    salePosted: 'Sale posted successfully!', profileSaved: 'Profile saved!',
    productSaved: 'Product saved!', customerSaved: 'Customer saved!', supplierSaved: 'Supplier saved!',
    noData: 'No data found', loading: 'Loading...', connectGoogle: 'Connect Google',
    googleConnected: 'Google Connected', spreadsheetId: 'Spreadsheet ID',
    taxRate: 'Tax Rate (%)', currency: 'Currency', language: 'Language',
    backupRestore: 'Backup & Restore', exportBackup: 'Export Backup', importBackup: 'Import Backup',
    thankyou: 'Thank you for shopping!', visitAgain: 'Visit Again', print: 'Print',
    actions: 'Actions', edit: 'Edit', delete: 'Delete', view: 'View', close: 'Close',
    addItem: 'Add Item', removeItem: 'Remove Item', total: 'Total', amount: 'Amount',
    profit: 'Profit', loss: 'Loss', report: 'Report', filter: 'Filter', from: 'From', to: 'To',
    apply: 'Apply', reset: 'Reset', all: 'All', dailyReport: 'Daily Report',
    monthlyReport: 'Monthly Report', topProducts: 'Top Selling Products', profitReport: 'Profit Report',
    lowStockAlert: 'Low Stock Alert', stockMovement: 'Stock Movement',
  },
  bn: {
    dashboard: 'ড্যাশবোর্ড', products: 'পণ্য', restock: 'স্টক যোগ', invoice: 'ইনভয়েস',
    masterData: 'মাস্টার ডেটা', settings: 'সেটিংস', reports: 'রিপোর্ট',
    finance: 'আর্থিক', investors: 'বিনিয়োগকারী',
    todaySales: 'আজকের বিক্রয়', monthlySales: 'মাসিক বিক্রয়', totalProducts: 'মোট পণ্য',
    availableStock: 'মজুদ পণ্য', lowStock: 'কম স্টক', inventoryValue: 'মোট মূল্যমান',
    recentSales: 'সাম্প্রতিক বিক্রয়', recentRestocks: 'সাম্প্রতিক স্টক',
    addProduct: 'পণ্য যোগ', editProduct: 'পণ্য সম্পাদনা', deleteProduct: 'পণ্য মুছুন',
    productName: 'পণ্যের নাম', category: 'বিভাগ', brand: 'ব্র্যান্ড', sku: 'এসকেইউ',
    unit: 'একক', purchasePrice: 'ক্রয়মূল্য', sellingPrice: 'বিক্রয়মূল্য',
    currentStock: 'বর্তমান স্টক', reorderLevel: 'পুনর্মজুদ স্তর', status: 'অবস্থা',
    active: 'সক্রিয়', inactive: 'নিষ্ক্রিয়', save: 'সংরক্ষণ', cancel: 'বাতিল',
    search: 'অনুসন্ধান', export: 'রপ্তানি', sync: 'এখন সিঙ্ক', online: 'অনলাইন', offline: 'অফলাইন',
    synced: 'সিঙ্কড', pendingSync: 'সিঙ্ক বাকি', shopName: 'দোকানের নাম', ownerName: 'মালিকের নাম',
    mobile: 'মোবাইল', whatsapp: 'হোয়াটসঅ্যাপ', address: 'ঠিকানা', email: 'ইমেইল',
    logo: 'লোগো', saveProfile: 'প্রোফাইল সংরক্ষণ', invoiceNo: 'ইনভয়েস নং', customer: 'গ্রাহক',
    date: 'তারিখ', product: 'পণ্য', quantity: 'পরিমাণ', price: 'মূল্য', discount: 'ছাড়',
    tax: 'কর', subtotal: 'উপমোট', grandTotal: 'মোট', paymentMethod: 'পেমেন্ট পদ্ধতি',
    cash: 'নগদ', bkash: 'বিকাশ', nagad: 'নগদ', rocket: 'রকেট', card: 'কার্ড',
    paidAmount: 'পরিশোধিত', dueAmount: 'বকেয়া', notes: 'নোট', saveDraft: 'ড্রাফট সংরক্ষণ',
    postSale: 'বিক্রয় পোস্ট', printInvoice: 'প্রিন্ট', downloadPDF: 'পিডিএফ ডাউনলোড',
    whatsappInvoice: 'হোয়াটসঅ্যাপ', newInvoice: 'নতুন ইনভয়েস', supplier: 'সরবরাহকারী',
    postStock: 'স্টক পোস্ট', totalCost: 'মোট খরচ', exportJSON: 'JSON রপ্তানি',
    importJSON: 'JSON আমদানি', exportCSV: 'CSV রপ্তানি', customers: 'গ্রাহক',
    suppliers: 'সরবরাহকারী', addCustomer: 'গ্রাহক যোগ', addSupplier: 'সরবরাহকারী যোগ',
    customerName: 'গ্রাহকের নাম', supplierName: 'সরবরাহকারীর নাম', confirmDelete: 'মুছে ফেলুন',
    deleteMsg: 'আপনি কি নিশ্চিতভাবে এটি মুছতে চান?', yes: 'হ্যাঁ', no: 'না',
    success: 'সফল', error: 'ত্রুটি', warning: 'সতর্কতা', info: 'তথ্য',
    stockPosted: 'স্টক সফলভাবে যোগ হয়েছে!', saleSaved: 'বিক্রয় সংরক্ষিত!',
    salePosted: 'বিক্রয় পোস্ট সফল!', profileSaved: 'প্রোফাইল সংরক্ষিত!',
    productSaved: 'পণ্য সংরক্ষিত!', customerSaved: 'গ্রাহক সংরক্ষিত!', supplierSaved: 'সরবরাহকারী সংরক্ষিত!',
    noData: 'কোনো ডেটা নেই', loading: 'লোড হচ্ছে...', connectGoogle: 'গুগল সংযুক্ত',
    googleConnected: 'গুগল সংযুক্ত', spreadsheetId: 'স্প্রেডশিট আইডি',
    taxRate: 'কর হার (%)', currency: 'মুদ্রা', language: 'ভাষা',
    backupRestore: 'ব্যাকআপ ও পুনরুদ্ধার', exportBackup: 'ব্যাকআপ রপ্তানি', importBackup: 'ব্যাকআপ আমদানি',
    thankyou: 'কেনাকাটায় ধন্যবাদ!', visitAgain: 'আবার আসবেন', print: 'প্রিন্ট',
    actions: 'কার্যক্রম', edit: 'সম্পাদনা', delete: 'মুছুন', view: 'দেখুন', close: 'বন্ধ',
    addItem: 'পণ্য যোগ', removeItem: 'পণ্য সরান', total: 'মোট', amount: 'পরিমাণ',
    profit: 'লাভ', loss: 'ক্ষতি', report: 'রিপোর্ট', filter: 'ফিল্টার', from: 'থেকে', to: 'পর্যন্ত',
    apply: 'প্রযোগ', reset: 'রিসেট', all: 'সব', dailyReport: 'দৈনিক রিপোর্ট',
    monthlyReport: 'মাসিক রিপোর্ট', topProducts: 'সেরা পণ্য', profitReport: 'লাভ রিপোর্ট',
    lowStockAlert: 'কম স্টক সতর্কতা', stockMovement: 'স্টক চলাচল',
  }
};

function t(key) {
  const lang = DB.getLang();
  return (T[lang] && T[lang][key]) || T['en'][key] || key;
}

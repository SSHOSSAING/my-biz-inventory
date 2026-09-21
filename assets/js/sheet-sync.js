/**
 * sheet-sync.js - Google OAuth & Sheets Integration
 * Handles Google login, spreadsheet creation and data sync
 */

const GOOGLE = {
  CLIENT_ID: '<<YOUR_GOOGLE_CLIENT_ID>>', // Replace with your OAuth Client ID
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
  DISCOVERY_DOCS: [
    'https://sheets.googleapis.com/$discovery/rest?version=v4',
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
  ],

  tokenClient: null,
  gapiInited: false,
  gisInited: false,

  // Load Google API client
  async initGapi() {
    return new Promise((resolve) => {
      gapi.load('client', async () => {
        await gapi.client.init({
          discoveryDocs: this.DISCOVERY_DOCS,
        });
        this.gapiInited = true;
        resolve();
      });
    });
  },

  // Initialize Google Identity Services
  initGis() {
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.CLIENT_ID,
      scope: this.SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          console.error('Auth error:', tokenResponse);
          APP.showToast('Google authentication failed', 'error');
          return;
        }
        DB.saveGoogleAuth({ token: tokenResponse, signedIn: true, timestamp: Date.now() });
        APP.updateSyncStatus();
        APP.showToast('Google connected successfully!', 'success');
        document.dispatchEvent(new Event('google-auth-success'));
      }
    });
    this.gisInited = true;
  },

  // Trigger Google Login
  login() {
    if (!this.tokenClient) {
      APP.showToast('Google API not loaded. Check internet connection.', 'warning');
      return;
    }
    this.tokenClient.requestAccessToken({ prompt: 'consent' });
  },

  // Logout / Revoke
  logout() {
    const auth = DB.getGoogleAuth();
    if (auth && auth.token) {
      google.accounts.oauth2.revoke(auth.token.access_token);
    }
    DB.remove(DB.KEYS.GOOGLE_AUTH);
    DB.remove(DB.KEYS.SPREADSHEET_ID);
    APP.updateSyncStatus();
    APP.showToast('Disconnected from Google', 'info');
  },

  isSignedIn() {
    const auth = DB.getGoogleAuth();
    if (!auth || !auth.signedIn) return false;
    // Token valid for 1 hour
    return (Date.now() - auth.timestamp) < 3500000;
  },

  getToken() {
    const auth = DB.getGoogleAuth();
    return auth ? auth.token : null;
  },

  // Set authorization header for fetch calls
  async authorizedFetch(url, options = {}) {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated');
    options.headers = options.headers || {};
    options.headers['Authorization'] = `Bearer ${token.access_token}`;
    options.headers['Content-Type'] = 'application/json';
    const response = await fetch(url, options);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'API Error');
    }
    return response.json();
  },

  // Create Spreadsheet
  async createSpreadsheet(shopName) {
    const title = `${shopName || 'Shop'} Inventory Database`;
    const data = await this.authorizedFetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      body: JSON.stringify({
        properties: { title },
        sheets: [
          { properties: { title: 'Products',    sheetId: 0 } },
          { properties: { title: 'Stock',       sheetId: 1 } },
          { properties: { title: 'Sales',       sheetId: 2 } },
          { properties: { title: 'Customers',   sheetId: 3 } },
          { properties: { title: 'Suppliers',   sheetId: 4 } },
          { properties: { title: 'Expenses',    sheetId: 5 } },
          { properties: { title: 'Investors',   sheetId: 6 } },
          { properties: { title: 'Investments', sheetId: 7 } },
          { properties: { title: 'DuePayments', sheetId: 8 } },
          { properties: { title: 'Settings',    sheetId: 9 } },
        ]
      })
    });
    const spreadsheetId = data.spreadsheetId;
    DB.saveSpreadsheetId(spreadsheetId);
    await this.initSheetHeaders(spreadsheetId);
    return spreadsheetId;
  },

  async initSheetHeaders(spreadsheetId) {
    const headers = {
      'Products':    [['ProductID','Name','Category','Brand','SKU','Barcode','Unit','PurchasePrice','SellingPrice','CurrentStock','ReorderLevel','Status','UpdatedAt']],
      'Stock':       [['StockID','Date','ProductID','ProductName','Quantity','PurchasePrice','TotalCost','SupplierID','SupplierName','Notes','Status','CreatedAt']],
      'Sales':       [['InvoiceNo','Date','CustomerName','CustomerMobile','ProductID','ProductName','Quantity','Price','Discount','Tax','GrandTotal','PaymentMethod','PaidAmount','DueAmount','Notes','Status']],
      'Customers':   [['CustomerID','Name','Mobile','Address','Email','Notes','CreatedAt']],
      'Suppliers':   [['SupplierID','Name','Mobile','Address','Email','Notes','CreatedAt']],
      'Expenses':    [['ExpenseID','Date','Category','Description','Amount','PaymentMethod','Reference','Notes','CreatedAt']],
      'Investors':   [['InvestorID','Name','Mobile','Email','SharePercent','JoinDate','Notes','CreatedAt']],
      'Investments': [['TxnID','Date','InvestorID','InvestorName','Type','Amount','Notes','CreatedAt']],
      'DuePayments': [['PaymentID','InvoiceNo','CustomerName','Date','Amount','Method','Notes','CreatedAt']],
      'Settings':    [['Key','Value']],
    };
    const requests = Object.entries(headers).map(([sheet, rows]) => ({
      range: `${sheet}!A1`, values: rows
    }));
    await this.authorizedFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: requests }) }
    );
  },

  // Append rows to a sheet
  async appendRows(spreadsheetId, sheetName, rows) {
    return this.authorizedFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values: rows }) }
    );
  },

  // Full sync - push all pending data
  async syncAll() {
    if (!this.isSignedIn()) {
      APP.showToast('Please connect Google account first', 'warning');
      return false;
    }
    const spreadsheetId = DB.getSpreadsheetId();
    if (!spreadsheetId) {
      APP.showToast('No spreadsheet linked. Please set up first.', 'warning');
      return false;
    }

    const pending = DB.getPendingSync();
    if (pending.length === 0) {
      APP.showToast('Everything is already synced!', 'info');
      return true;
    }

    APP.showToast('Syncing...', 'info');
    let success = true;

    try {
      const productRows=[], stockRows=[], saleRows=[], customerRows=[], supplierRows=[];
      const expenseRows=[], investorRows=[], investmentRows=[], dueRows=[];

      for (const item of pending) {
        const d = item.data;
        if (item.type === 'product_add' || item.type === 'product_update') {
          productRows.push([d.id,d.name,d.category,d.brand,d.sku,d.barcode,d.unit,
            d.purchasePrice,d.sellingPrice,d.currentStock,d.reorderLevel,d.status,d.updatedAt]);
        } else if (item.type === 'stock_add') {
          stockRows.push([d.id,d.date,d.productId,d.productName,d.quantity,d.purchasePrice,
            d.totalCost,d.supplierId,d.supplierName,d.notes,d.status,d.createdAt]);
        } else if (item.type === 'sale_add') {
          d.items.forEach(i => {
            saleRows.push([d.invoiceNo,d.date,d.customerName,d.customerMobile,
              i.productId,i.productName,i.quantity,i.price,i.discount,i.tax,
              d.grandTotal,d.paymentMethod,d.paidAmount,d.dueAmount,d.notes,d.status]);
          });
        } else if (item.type === 'customer_add') {
          customerRows.push([d.id,d.name,d.mobile,d.address,d.email,d.notes,d.createdAt]);
        } else if (item.type === 'supplier_add') {
          supplierRows.push([d.id,d.name,d.mobile,d.address,d.email,d.notes,d.createdAt]);
        } else if (item.type === 'expense_add') {
          expenseRows.push([d.id,d.date,d.category,d.description,d.amount,
            d.paymentMethod,d.reference,d.notes,d.createdAt]);
        } else if (item.type === 'investor_add') {
          investorRows.push([d.id,d.name,d.mobile,d.email,d.sharePercent,
            d.joinDate,d.notes,d.createdAt]);
        } else if (item.type === 'investment_add') {
          investmentRows.push([d.id,d.date,d.investorId,d.investorName,
            d.type,d.amount,d.notes,d.createdAt]);
        } else if (item.type === 'due_payment') {
          dueRows.push([d.id,d.invoiceNo,d.customerName,d.date,
            d.amount,d.method,d.notes,d.createdAt]);
        }
      }

      if (productRows.length)    await this.appendRows(spreadsheetId,'Products',productRows);
      if (stockRows.length)      await this.appendRows(spreadsheetId,'Stock',stockRows);
      if (saleRows.length)       await this.appendRows(spreadsheetId,'Sales',saleRows);
      if (customerRows.length)   await this.appendRows(spreadsheetId,'Customers',customerRows);
      if (supplierRows.length)   await this.appendRows(spreadsheetId,'Suppliers',supplierRows);
      if (expenseRows.length)    await this.appendRows(spreadsheetId,'Expenses',expenseRows);
      if (investorRows.length)   await this.appendRows(spreadsheetId,'Investors',investorRows);
      if (investmentRows.length) await this.appendRows(spreadsheetId,'Investments',investmentRows);
      if (dueRows.length)        await this.appendRows(spreadsheetId,'DuePayments',dueRows);

      DB.clearPending();
      DB.setLastSync();
      APP.updateSyncStatus();
      APP.showToast(`Synced ${pending.length} records to Google Sheets!`, 'success');
    } catch (err) {
      console.error('Sync error:', err);
      APP.showToast('Sync failed: ' + err.message, 'error');
      success = false;
    }
    return success;
  },

  // ── PULL from Google Sheets (Multi-device sync) ─────────────
  async pullAll() {
    if (!this.isSignedIn()) {
      APP.showToast('Please connect Google account first', 'warning');
      return false;
    }
    const spreadsheetId = DB.getSpreadsheetId();
    if (!spreadsheetId) {
      APP.showToast('No spreadsheet linked', 'warning');
      return false;
    }

    APP.showToast('Pulling data from Google Sheets...', 'info');
    try {
      const sheets = ['Products','Stock','Sales','Customers','Suppliers',
                      'Expenses','Investors','Investments','DuePayments'];
      const ranges = sheets.map(s => `${s}!A2:Z`).join('&ranges=');
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${ranges}`;
      const result = await this.authorizedFetch(url);
      const valueRanges = result.valueRanges || [];

      // Products
      const prodRows = (valueRanges[0]?.values || []);
      if (prodRows.length) {
        const products = prodRows.filter(r => r[0]).map(r => ({
          id: r[0], name: r[1]||'', category: r[2]||'', brand: r[3]||'',
          sku: r[4]||'', barcode: r[5]||'', unit: r[6]||'',
          purchasePrice: parseFloat(r[7]||0), sellingPrice: parseFloat(r[8]||0),
          currentStock: parseInt(r[9]||0), reorderLevel: parseInt(r[10]||5),
          status: r[11]||'active', updatedAt: r[12]||new Date().toISOString(),
          createdAt: r[12]||new Date().toISOString()
        }));
        if (products.length) DB.saveProducts(products);
      }

      // Customers
      const custRows = (valueRanges[3]?.values || []);
      if (custRows.length) {
        const customers = custRows.filter(r => r[0]).map(r => ({
          id: r[0], name: r[1]||'', mobile: r[2]||'',
          address: r[3]||'', email: r[4]||'', notes: r[5]||'',
          createdAt: r[6]||new Date().toISOString()
        }));
        if (customers.length) DB.saveCustomers(customers);
      }

      // Suppliers
      const supRows = (valueRanges[4]?.values || []);
      if (supRows.length) {
        const suppliers = supRows.filter(r => r[0]).map(r => ({
          id: r[0], name: r[1]||'', mobile: r[2]||'',
          address: r[3]||'', email: r[4]||'', notes: r[5]||'',
          createdAt: r[6]||new Date().toISOString()
        }));
        if (suppliers.length) DB.saveSuppliers(suppliers);
      }

      // Investors
      const invRows = (valueRanges[6]?.values || []);
      if (invRows.length) {
        const investors = invRows.filter(r => r[0]).map(r => ({
          id: r[0], name: r[1]||'', mobile: r[2]||'', email: r[3]||'',
          sharePercent: parseFloat(r[4]||0), joinDate: r[5]||'',
          notes: r[6]||'', createdAt: r[7]||new Date().toISOString()
        }));
        if (investors.length) DB.saveInvestors(investors);
      }

      DB.setLastSync();
      APP.updateSyncStatus();
      APP.showToast('Data pulled from Google Sheets successfully!', 'success');
      return true;
    } catch (err) {
      console.error('Pull error:', err);
      APP.showToast('Pull failed: ' + err.message, 'error');
      return false;
    }
  },

  // Push all data (full re-sync)
  async pushAll() {
    if (!this.isSignedIn()) return false;
    const spreadsheetId = DB.getSpreadsheetId();
    if (!spreadsheetId) return false;

    const products = DB.getProducts();
    const customers = DB.getCustomers();
    const suppliers = DB.getSuppliers();
    const stock = DB.getStockEntries();
    const sales = DB.getSales();

    // Clear and re-add pending for all
    DB.clearPending();
    products.forEach(p => DB.addPending('product_add', p));
    customers.forEach(c => DB.addPending('customer_add', c));
    suppliers.forEach(s => DB.addPending('supplier_add', s));
    stock.filter(s => s.status === 'posted').forEach(s => DB.addPending('stock_add', s));
    sales.filter(s => s.status === 'posted').forEach(s => DB.addPending('sale_add', s));

    return await this.syncAll();
  }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Load GAPI script dynamically if online
  if (navigator.onLine) {
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.onload = () => GOOGLE.initGapi();
    document.head.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = () => GOOGLE.initGis();
    document.head.appendChild(gisScript);
  }
});

/**
 * product.js - Product Management
 */

const PRODUCT = {
  page: 1,
  search: '',
  filterCat: '',
  filterStatus: '',
  editingId: null,

  init() {
    APP.currentPage = 'products';
    this.bindEvents();
    this.loadCategories();
    this.render();
  },

  bindEvents() {
    document.getElementById('addProductBtn')?.addEventListener('click', () => this.openModal());
    document.getElementById('productSearchInput')?.addEventListener('input', e => {
      this.search = e.target.value.toLowerCase();
      this.page = 1;
      this.render();
    });
    document.getElementById('filterCategory')?.addEventListener('change', e => {
      this.filterCat = e.target.value;
      this.page = 1;
      this.render();
    });
    document.getElementById('filterStatus')?.addEventListener('change', e => {
      this.filterStatus = e.target.value;
      this.page = 1;
      this.render();
    });
    document.getElementById('exportCSVBtn')?.addEventListener('click', () => APP.exportCSV(DB.getProducts(), 'products.csv'));
    document.getElementById('exportJSONBtn')?.addEventListener('click', () => APP.exportJSON(DB.getProducts(), 'products.json'));
    document.getElementById('saveProductBtn')?.addEventListener('click', () => this.saveProduct());
    document.getElementById('productLogo')?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => { document.getElementById('productImgPreview').src = ev.target.result; document.getElementById('productImgPreview').style.display = ''; };
      reader.readAsDataURL(file);
    });
  },

  loadCategories() {
    const cats = DB.getCategories();
    // Update the filter dropdown
    const sel = document.getElementById('filterCategory');
    if (sel) {
      const current = sel.value;
      sel.innerHTML = `<option value="">${t('all')} ${t('category')}</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join('');
      if (current) sel.value = current;
    }
    // Update datalist for product modal
    const dl = document.getElementById('categoryList');
    if (dl) dl.innerHTML = cats.map(c => `<option value="${c}">`).join('');
  },

  getFiltered() {
    let list = DB.getProducts();
    if (this.search) list = list.filter(p => p.name.toLowerCase().includes(this.search) || (p.sku||'').toLowerCase().includes(this.search) || (p.category||'').toLowerCase().includes(this.search));
    if (this.filterCat) list = list.filter(p => p.category === this.filterCat);
    if (this.filterStatus) list = list.filter(p => p.status === this.filterStatus);
    return list;
  },

  render() {
    const filtered = this.getFiltered();
    const paged = APP.paginate(filtered, this.page, 15);
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    if (paged.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4"><i class="bi bi-inbox fs-2 d-block mb-2"></i>${t('noData')}</td></tr>`;
    } else {
      tbody.innerHTML = paged.data.map(p => {
        const low = p.currentStock <= p.reorderLevel;
        return `<tr class="${low ? 'table-warning' : ''}">
          <td><small class="text-muted">${p.id}</small></td>
          <td><strong>${p.name}</strong>${p.brand ? `<br><small class="text-muted">${p.brand}</small>` : ''}</td>
          <td>${p.category || '-'}</td>
          <td>${p.unit || '-'}</td>
          <td class="purchase-price-col">${APP.fmt(p.purchasePrice)}</td>
          <td>${APP.fmt(p.sellingPrice)}</td>
          <td>
            <span class="badge ${low ? 'bg-danger' : 'bg-success'}">${p.currentStock}</span>
            ${low ? `<br><small class="text-danger">Low!</small>` : ''}
          </td>
          <td><span class="badge ${p.status === 'active' ? 'bg-success' : 'bg-secondary'}">${t(p.status)}</span></td>
          <td>
            <button class="btn btn-sm btn-outline-primary me-1" onclick="PRODUCT.openModal('${p.id}')"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="PRODUCT.deleteProduct('${p.id}')"><i class="bi bi-trash"></i></button>
          </td>
        </tr>`;
      }).join('');
    }

    document.getElementById('productCount').textContent = `${filtered.length} ${t('products')}`;
    APP.renderPagination('productPagination', paged.page, paged.pages, p => { this.page = p; this.render(); });
  },

  openModal(id = null) {
    this.editingId = id;
    const product = id ? DB.getProduct(id) : null;
    const modal = document.getElementById('productModal');
    const title = document.getElementById('productModalTitle');
    if (title) title.textContent = id ? t('editProduct') : t('addProduct');

    const fields = ['Name','Category','Brand','SKU','Barcode','Unit','PurchasePrice','SellingPrice','CurrentStock','ReorderLevel','Description'];
    fields.forEach(f => {
      const el = document.getElementById('prod' + f);
      if (el) el.value = product ? (product[f.charAt(0).toLowerCase() + f.slice(1)] || '') : '';
    });

    const statusEl = document.getElementById('prodStatus');
    if (statusEl) statusEl.value = product ? product.status : 'active';

    const imgPreview = document.getElementById('productImgPreview');
    if (imgPreview) { imgPreview.src = ''; imgPreview.style.display = 'none'; }

    new bootstrap.Modal(modal).show();
  },

  saveProduct() {
    const name = document.getElementById('prodName')?.value.trim();
    if (!name) { APP.showToast('Product name is required', 'warning'); return; }

    const sku = document.getElementById('prodSKU')?.value.trim() || '';
    const purchasePrice = parseFloat(document.getElementById('prodPurchasePrice')?.value || 0);
    const sellingPrice  = parseFloat(document.getElementById('prodSellingPrice')?.value || 0);
    const currentStock  = parseInt(document.getElementById('prodCurrentStock')?.value || 0);
    const reorderLevel  = parseInt(document.getElementById('prodReorderLevel')?.value || 5);

    // Validate
    if (purchasePrice < 0 || sellingPrice < 0) { APP.showToast('Prices cannot be negative', 'warning'); return; }
    if (currentStock < 0) { APP.showToast('Stock cannot be negative', 'warning'); return; }
    if (sellingPrice > 0 && purchasePrice > 0 && sellingPrice < purchasePrice) {
      APP.showToast('⚠️ Selling price is BELOW purchase price — you will make a loss!', 'warning');
      // Allow save but warn — shopkeeper may have a reason (clearance sale)
    }

    // SKU uniqueness check
    if (sku) {
      const existing = DB.getProducts().find(p => p.sku === sku && p.id !== this.editingId);
      if (existing) { APP.showToast(`SKU "${sku}" already used by: ${existing.name}`, 'warning'); return; }
    }

    const data = {
      name,
      category: document.getElementById('prodCategory')?.value.trim() || '',
      brand: document.getElementById('prodBrand')?.value.trim() || '',
      sku,
      barcode: document.getElementById('prodBarcode')?.value.trim() || '',
      unit: document.getElementById('prodUnit')?.value.trim() || '',
      purchasePrice,
      sellingPrice,
      currentStock,
      reorderLevel,
      description: document.getElementById('prodDescription')?.value.trim() || '',
      status: document.getElementById('prodStatus')?.value || 'active',
    };

    if (this.editingId) {
      DB.updateProduct(this.editingId, data);
    } else {
      DB.addProduct(data);
    }

    bootstrap.Modal.getInstance(document.getElementById('productModal'))?.hide();
    APP.showToast(t('productSaved'), 'success');
    APP.updateSyncStatus();
    this.loadCategories();
    this.render();
  },

  deleteProduct(id) {
    // Warn if product has sales history
    const sales = DB.getSales().filter(s => s.items && s.items.some(i => i.productId === id));
    const msg = sales.length > 0
      ? `This product has ${sales.length} sale record(s). Deleting it will NOT remove those records but history will show no product name. Continue?`
      : t('deleteMsg');
    APP.showConfirm(msg, () => {
      DB.deleteProduct(id);
      APP.showToast('Product deleted', 'info');
      this.render();
    });
  },

  // ── BULK IMPORT ─────────────────────────────────────────────
  importedRows: [],

  openImportModal() {
    this.importedRows = [];
    const fi = document.getElementById('importFileInput');
    if (fi) fi.value = '';
    const pw = document.getElementById('importPreviewWrap');
    if (pw) pw.style.display = 'none';
    const st = document.getElementById('importStatus');
    if (st) st.textContent = 'No file selected';
    const btn = document.getElementById('doImportBtn');
    if (btn) btn.disabled = true;
    new bootstrap.Modal(document.getElementById('importModal')).show();
  },

  downloadTemplate() {
    const headers = ['Name','Category','Brand','SKU','Barcode','Unit','PurchasePrice','SellingPrice','CurrentStock','ReorderLevel','Description','Status'];
    const sample  = ['Rice 5kg','Grocery','Local','RCE001','','Bag','280','320','50','10','Premium quality','active'];
    const csv = [headers.join(','), sample.join(',')].join('\n');
    APP.downloadFile(csv, 'products-import-template.csv', 'text/csv;charset=utf-8;');
  },

  handleImportFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const st = document.getElementById('importStatus');
    if (st) st.textContent = `Reading ${file.name}...`;

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = e => this.parseCSV(e.target.result);
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      // Load SheetJS on demand then parse
      if (typeof XLSX !== 'undefined') {
        const reader = new FileReader();
        reader.onload = e => this.parseExcel(e.target.result);
        reader.readAsArrayBuffer(file);
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        script.onload = () => {
          const reader = new FileReader();
          reader.onload = e => this.parseExcel(e.target.result);
          reader.readAsArrayBuffer(file);
        };
        document.head.appendChild(script);
      }
    } else {
      APP.showToast('Please use a .csv or .xlsx file', 'warning');
    }
  },

  parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { APP.showToast('File appears empty or has no data rows', 'warning'); return; }
    // Parse header row
    const headers = this._splitCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = this._splitCSVLine(lines[i]);
      if (cols.every(c => !c.trim())) continue;
      const row = {};
      headers.forEach((h, idx) => { row[h] = (cols[idx] || '').replace(/^"|"$/g, '').trim(); });
      rows.push(row);
    }
    this.buildPreview(rows);
  },

  _splitCSVLine(line) {
    const cols = [];
    let inQuote = false, cur = '';
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cols.push(cur); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur);
    return cols;
  },

  parseExcel(buffer) {
    try {
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      this.buildPreview(json);
    } catch (e) {
      APP.showToast('Could not read Excel file: ' + e.message, 'error');
    }
  },

  // Normalise various column name spellings → internal field names
  normaliseRow(raw) {
    const map = {
      name:          ['name','productname','product name','product'],
      category:      ['category','cat'],
      brand:         ['brand'],
      sku:           ['sku','code','itemcode','item code'],
      barcode:       ['barcode','ean','upc'],
      unit:          ['unit','uom','unit of measure'],
      purchasePrice: ['purchaseprice','purchase price','buyprice','buy price','cost','costprice','cost price'],
      sellingPrice:  ['sellingprice','selling price','saleprice','sale price','price','mrp'],
      currentStock:  ['currentstock','current stock','stock','qty','quantity','openingstock','opening stock'],
      reorderLevel:  ['reorderlevel','reorder level','minstock','min stock','minimum'],
      description:   ['description','desc','details'],
      status:        ['status'],
    };
    const rawLower = {};
    Object.keys(raw).forEach(k => { rawLower[k.toLowerCase().trim()] = raw[k]; });
    const out = {};
    Object.entries(map).forEach(([field, aliases]) => {
      const matchAlias = aliases.find(a => Object.prototype.hasOwnProperty.call(rawLower, a));
      out[field] = matchAlias !== undefined ? (rawLower[matchAlias] || '').toString().trim() : '';
    });
    return out;
  },

  buildPreview(rawRows) {
    this.importedRows = rawRows.map(r => this.normaliseRow(r));
    const existingNames = new Set(DB.getProducts().map(p => p.name.toLowerCase()));

    this.importedRows.forEach((row, i) => {
      row._rowNum  = i + 2;
      row._issues  = [];
      row._isDuplicate = false;
      if (!row.name) { row._issues.push('Missing name'); }
      if (row.purchasePrice && row.sellingPrice &&
          parseFloat(row.sellingPrice) > 0 && parseFloat(row.purchasePrice) > 0 &&
          parseFloat(row.sellingPrice) < parseFloat(row.purchasePrice)) {
        row._issues.push('Sell < Buy');
      }
      if (row.name && existingNames.has(row.name.toLowerCase())) {
        row._isDuplicate = true;
      }
    });

    const valid     = this.importedRows.filter(r => !r._issues.length);
    const withIssue = this.importedRows.filter(r => r._issues.length);
    const dupes     = this.importedRows.filter(r => r._isDuplicate && !r._issues.length);
    const cols = ['name','category','brand','sku','unit','purchasePrice','sellingPrice','currentStock','status'];

    const head = document.getElementById('importPreviewHead');
    if (head) head.innerHTML = '<th>#</th><th>Status</th>' + cols.map(c => `<th>${c}</th>`).join('');

    const body = document.getElementById('importPreviewBody');
    if (body) {
      const preview = this.importedRows.slice(0, 100);
      body.innerHTML = preview.map(row => {
        const hasIssue = row._issues.length > 0;
        const isDupe   = row._isDuplicate && !hasIssue;
        const rowCls   = hasIssue ? 'table-danger' : isDupe ? 'table-warning' : '';
        const badge    = hasIssue
          ? `<span class="badge bg-danger">Error</span><br><small>${row._issues.join(', ')}</small>`
          : isDupe ? `<span class="badge bg-warning text-dark">Duplicate</span>`
          : `<span class="badge bg-success">OK</span>`;
        const esc = s => (s || '-').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        return `<tr class="${rowCls}">
          <td class="text-muted">${row._rowNum}</td>
          <td>${badge}</td>
          ${cols.map(c => `<td>${esc(row[c])}</td>`).join('')}
        </tr>`;
      }).join('') + (this.importedRows.length > 100
        ? `<tr><td colspan="${cols.length+2}" class="text-center text-muted py-2">… and ${this.importedRows.length - 100} more rows</td></tr>` : '');
    }

    const countEl = document.getElementById('importPreviewCount');
    if (countEl) countEl.textContent = `${this.importedRows.length} rows`;

    const issuesBadge = document.getElementById('importIssuesBadge');
    if (issuesBadge) {
      issuesBadge.innerHTML = (withIssue.length ? `<span class="badge bg-danger me-1">${withIssue.length} errors</span>` : '') +
        (dupes.length ? `<span class="badge bg-warning text-dark">${dupes.length} duplicates</span>` : '');
    }

    const warnEl = document.getElementById('importWarnings');
    if (warnEl) {
      warnEl.innerHTML = withIssue.length
        ? `<div class="alert alert-warning py-2 small"><strong>${withIssue.length} rows have errors</strong> and will be skipped. Fix them in your file and re-import.</div>` : '';
    }

    const pw = document.getElementById('importPreviewWrap');
    if (pw) pw.style.display = '';

    const st = document.getElementById('importStatus');
    if (st) st.textContent = `${valid.length} of ${this.importedRows.length} rows ready to import`;

    const btn = document.getElementById('doImportBtn');
    if (btn) btn.disabled = valid.length === 0;
  },

  doImport() {
    const mode          = document.getElementById('importDuplicateMode')?.value || 'skip';
    const defaultStatus = document.getElementById('importDefaultStatus')?.value || 'active';
    const existingMap   = new Map(DB.getProducts().map(p => [p.name.toLowerCase(), p]));

    let added = 0, updated = 0, skipped = 0;

    this.importedRows.forEach(row => {
      if (row._issues.length) { skipped++; return; }

      const productData = {
        name:          row.name,
        category:      row.category      || '',
        brand:         row.brand         || '',
        sku:           row.sku           || '',
        barcode:       row.barcode       || '',
        unit:          row.unit          || 'Piece',
        purchasePrice: parseFloat(row.purchasePrice) || 0,
        sellingPrice:  parseFloat(row.sellingPrice)  || 0,
        currentStock:  Math.max(0, parseInt(row.currentStock) || 0),
        reorderLevel:  Math.max(0, parseInt(row.reorderLevel) || 5),
        description:   row.description   || '',
        status:        ['active','inactive'].includes(row.status) ? row.status : defaultStatus,
      };

      // Auto-register new categories
      if (productData.category) DB.addCategory(productData.category);

      const existing = existingMap.get(row.name.toLowerCase());
      if (existing) {
        if (mode === 'skip')   { skipped++; return; }
        if (mode === 'update') { DB.updateProduct(existing.id, productData); updated++; return; }
      }
      DB.addProduct(productData);
      added++;
    });

    bootstrap.Modal.getInstance(document.getElementById('importModal'))?.hide();
    APP.showToast(`✅ Import done — Added: ${added} | Updated: ${updated} | Skipped: ${skipped}`, 'success');
    APP.updateSyncStatus();
    this.loadCategories();
    this.render();
  }
};

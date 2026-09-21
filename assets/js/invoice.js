/**
 * invoice.js - Invoice & PDF Generation
 */

const INVOICE = {
  currentItems: [],
  editingInvoiceNo: null,

  init() {
    APP.currentPage = 'invoice';
    this.loadCustomers();
    this.loadProducts();
    this.setDate();
    this.setInvoiceNo();
    this.bindEvents();
    this.renderItems();
    this.calculateTotals();
    this.showDiscountHint();
  },

  showDiscountHint() {
    const hint = document.getElementById('discountLimitHint');
    if (!hint) return;
    if (typeof AUTH === 'undefined' || !AUTH.getSession()) return;
    const cfg = AUTH.getRoleConfig();
    if (cfg.maxDiscountPct < 100) {
      hint.textContent = `Max ${cfg.maxDiscountPct}% discount allowed for your role`;
      hint.style.color = '#dc3545';
    }
  },

  setDate() {
    const el = document.getElementById('invDate');
    if (el) el.value = new Date().toISOString().split('T')[0];
  },

  setInvoiceNo() {
    const el = document.getElementById('invNo');
    if (el) el.value = DB.generateInvoiceNo();
  },

  loadCustomers() {
    const sel = document.getElementById('invCustomerSel');
    if (!sel) return;
    const customers = DB.getCustomers();
    sel.innerHTML = `<option value="">-- ${t('customer')} --</option>` +
      customers.map(c => `<option value="${c.id}" data-mobile="${c.mobile}">${c.name}</option>`).join('');
    sel.addEventListener('change', () => {
      const opt = sel.selectedOptions[0];
      const mobileEl = document.getElementById('invMobile');
      const nameEl = document.getElementById('invCustomerName');
      if (mobileEl) mobileEl.value = opt.dataset.mobile || '';
      if (nameEl) nameEl.value = opt.text !== `-- ${t('customer')} --` ? opt.text : '';
    });
  },

  loadProducts() {
    const sel = document.getElementById('itemProductSel');
    if (!sel) return;
    const canSeeCost = !(typeof AUTH !== 'undefined' && AUTH.getSession() &&
      !AUTH.getRoleConfig().canViewPurchasePrice);
    const products = DB.getProducts().filter(p => p.status === 'active');
    sel.innerHTML = `<option value="">-- ${t('product')} --</option>` +
      products.map(p => {
        const stockLabel = `(Stock: ${p.currentStock} ${p.unit})`;
        return `<option value="${p.id}" data-price="${p.sellingPrice}" data-stock="${p.currentStock}" data-name="${p.name}">
          ${p.name} ${stockLabel}
        </option>`;
      }).join('');
    sel.addEventListener('change', () => {
      const opt = sel.selectedOptions[0];
      const priceEl = document.getElementById('itemPrice');
      if (priceEl) priceEl.value = opt.dataset.price || '';
      this.updateItemTotal();
    });

    // Show/hide discount field for salesman
    const discountRow = document.getElementById('itemDiscountWrap');
    if (discountRow && !canSeeCost) {
      discountRow.style.display = 'none';
    }
  },

  bindEvents() {
    document.getElementById('addItemBtn')?.addEventListener('click', () => this.addItem());
    document.getElementById('saveDraftBtn')?.addEventListener('click', () => this.saveDraft());
    document.getElementById('postSaleBtn')?.addEventListener('click', () => this.postSale());
    document.getElementById('printInvBtn')?.addEventListener('click', () => this.printInvoice());
    document.getElementById('downloadPDFBtn')?.addEventListener('click', () => this.downloadPDF());
    document.getElementById('whatsappBtn')?.addEventListener('click', () => this.sendWhatsApp());
    document.getElementById('newInvBtn')?.addEventListener('click', () => this.newInvoice());
    ['itemQty', 'itemPrice', 'itemDiscount'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updateItemTotal());
    });
    ['invDiscount', 'invTax', 'invPaid'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.calculateTotals());
    });
  },

  updateItemTotal() {
    const qty = parseFloat(document.getElementById('itemQty')?.value || 0);
    const price = parseFloat(document.getElementById('itemPrice')?.value || 0);
    const disc = parseFloat(document.getElementById('itemDiscount')?.value || 0);
    const total = (qty * price) - disc;
    const el = document.getElementById('itemTotal');
    if (el) el.value = total.toFixed(2);
  },

  addItem() {
    const selEl = document.getElementById('itemProductSel');
    const opt = selEl?.selectedOptions[0];
    if (!opt || !opt.value) { APP.showToast('Please select a product', 'warning'); return; }
    const qty = parseFloat(document.getElementById('itemQty')?.value || 0);
    const price = parseFloat(document.getElementById('itemPrice')?.value || 0);
    const disc = parseFloat(document.getElementById('itemDiscount')?.value || 0);

    if (qty <= 0) { APP.showToast('Quantity must be greater than 0', 'warning'); return; }
    if (price <= 0) { APP.showToast('Price must be greater than 0', 'warning'); return; }

    const stock = parseInt(opt.dataset.stock || 0);
    if (qty > stock) { APP.showToast(`Only ${stock} in stock!`, 'warning'); return; }

    const existing = this.currentItems.find(i => i.productId === opt.value);
    if (existing) {
      existing.quantity += qty;
      existing.discount += disc;
      existing.total = (existing.quantity * existing.price) - existing.discount;
    } else {
      this.currentItems.push({
        productId: opt.value,
        productName: opt.dataset.name,
        quantity: qty,
        price,
        discount: disc,
        tax: 0,
        total: (qty * price) - disc
      });
    }

    // Clear item fields
    selEl.value = '';
    ['itemQty', 'itemPrice', 'itemDiscount', 'itemTotal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = id === 'itemQty' ? '1' : '';
    });

    this.renderItems();
    this.calculateTotals();
  },

  removeItem(idx) {
    this.currentItems.splice(idx, 1);
    this.renderItems();
    this.calculateTotals();
  },

  renderItems() {
    const tbody = document.getElementById('invItemsBody');
    if (!tbody) return;
    if (this.currentItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">${t('noData')}</td></tr>`;
      return;
    }
    tbody.innerHTML = this.currentItems.map((item, i) => `
      <tr>
        <td>${item.productName}</td>
        <td><input type="number" class="form-control form-control-sm" value="${item.quantity}" style="width:70px"
          onchange="INVOICE.updateItemField(${i},'quantity',this.value)"></td>
        <td>${APP.fmt(item.price)}</td>
        <td>${APP.fmt(item.discount)}</td>
        <td><strong>${APP.fmt(item.total)}</strong></td>
        <td><button class="btn btn-danger btn-sm py-0" onclick="INVOICE.removeItem(${i})"><i class="bi bi-trash"></i></button></td>
      </tr>`).join('');
  },

  updateItemField(idx, field, val) {
    this.currentItems[idx][field] = parseFloat(val) || 0;
    const item = this.currentItems[idx];
    item.total = (item.quantity * item.price) - item.discount;
    this.renderItems();
    this.calculateTotals();
  },

  calculateTotals() {
    const subtotal = this.currentItems.reduce((s, i) => s + i.total, 0);
    let disc = parseFloat(document.getElementById('invDiscount')?.value || 0);

    // Enforce role-based max discount
    if (typeof AUTH !== 'undefined' && AUTH.getSession()) {
      const maxPct = AUTH.getRoleConfig().maxDiscountPct ?? 100;
      const maxDisc = (subtotal * maxPct) / 100;
      if (disc > maxDisc) {
        disc = parseFloat(maxDisc.toFixed(2));
        const discEl = document.getElementById('invDiscount');
        if (discEl) discEl.value = disc.toFixed(2);
        APP.showToast(`Max discount for your role is ${maxPct}% (${APP.fmt(maxDisc)})`, 'warning');
      }
    }

    // Discount cannot exceed subtotal
    if (disc > subtotal && subtotal > 0) {
      disc = subtotal;
      const discEl = document.getElementById('invDiscount');
      if (discEl) discEl.value = subtotal.toFixed(2);
      APP.showToast('Discount cannot exceed subtotal', 'warning');
    }

    const taxRate = parseFloat(document.getElementById('invTax')?.value || 0);
    const tax  = ((subtotal - disc) * taxRate) / 100;
    const grand = Math.max(0, subtotal - disc + tax);
    const paid  = parseFloat(document.getElementById('invPaid')?.value || 0);
    const due   = grand - paid;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = APP.fmt(val); };
    set('invSubtotal',  subtotal);
    set('invTaxAmt',    tax);
    set('invGrandTotal',grand);

    const dueEl = document.getElementById('invDue');
    if (dueEl) {
      dueEl.textContent = APP.fmt(Math.abs(due));
      dueEl.style.color = due > 0 ? '#dc3545' : due < 0 ? '#198754' : '';
      dueEl.title = due < 0 ? `Change to return: ${APP.fmt(Math.abs(due))}` : '';
    }

    const el = document.getElementById('invGrandInput');
    if (el) el.value = grand.toFixed(2);
  },

  buildSaleObject(status) {
    const invNo = document.getElementById('invNo')?.value;
    const date = document.getElementById('invDate')?.value;
    const customerName = document.getElementById('invCustomerName')?.value || 'Walk-in';
    const customerMobile = document.getElementById('invMobile')?.value || '';
    const paymentMethod = document.querySelector('input[name="payMethod"]:checked')?.value || 'cash';
    const paidAmount = parseFloat(document.getElementById('invPaid')?.value || 0);
    const grandTotal = parseFloat(document.getElementById('invGrandInput')?.value || 0);
    const notes = document.getElementById('invNotes')?.value || '';
    const discount = parseFloat(document.getElementById('invDiscount')?.value || 0);
    const taxRate = parseFloat(document.getElementById('invTax')?.value || 0);

    return {
      invoiceNo: invNo,
      date,
      customerName,
      customerMobile,
      items: [...this.currentItems],
      discount,
      taxRate,
      grandTotal,
      paymentMethod,
      paidAmount,
      dueAmount: grandTotal - paidAmount,
      notes,
      status,
    };
  },

  saveDraft() {
    if (this.currentItems.length === 0) { APP.showToast('Add at least one item', 'warning'); return; }
    const sale = this.buildSaleObject('draft');
    DB.addSale(sale);
    APP.showToast(t('saleSaved'), 'success');
  },

  postSale() {
    if (this.currentItems.length === 0) { APP.showToast('Add at least one item', 'warning'); return; }
    const grand = parseFloat(document.getElementById('invGrandInput')?.value || 0);
    if (grand <= 0) { APP.showToast('Grand total must be greater than zero', 'warning'); return; }

    // Guard against double-posting same invoice number
    const invNo = document.getElementById('invNo')?.value;
    if (DB.getSale(invNo) && DB.getSale(invNo).status === 'posted') {
      APP.showToast('This invoice was already posted!', 'warning');
      return;
    }

    const sale = this.buildSaleObject('posted');
    sale.createdBy   = typeof AUTH !== 'undefined' ? AUTH.getUserName() : 'Unknown';
    sale.createdById = typeof AUTH !== 'undefined' ? AUTH.getUserId()   : '';
    DB.addSale(sale);
    if (typeof AUTH !== 'undefined') AUTH.log('sale_posted', { invoiceNo: sale.invoiceNo, total: sale.grandTotal });
    APP.showToast(t('salePosted'), 'success');
    APP.updateSyncStatus();
    document.getElementById('invoicePrintArea').innerHTML = this.buildPrintHTML(sale);
    document.getElementById('invoiceResult').style.display = '';
    // Disable post button to prevent accidental re-post
    const postBtn = document.getElementById('postSaleBtn');
    if (postBtn) { postBtn.disabled = true; postBtn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Posted'; }
    this.scrollToResult();
  },

  scrollToResult() {
    document.getElementById('invoiceResult')?.scrollIntoView({ behavior: 'smooth' });
  },

  newInvoice() {
    this.currentItems = [];
    this.renderItems();
    this.calculateTotals();
    ['invDiscount','invTax','invPaid'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    ['invCustomerSel','invCustomerName','invMobile','invNotes'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
    this.setInvoiceNo();
    document.getElementById('invoiceResult').style.display = 'none';
    // Re-enable post button
    const postBtn = document.getElementById('postSaleBtn');
    if (postBtn) { postBtn.disabled = false; postBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i><span data-t="postSale">Post Sale</span>'; }
  },

  buildPrintHTML(sale) {
    const shop = DB.getShop();
    const dateStr = APP.fmtDate(sale.date);
    return `
      <div class="invoice-print p-3">
        <div class="text-center mb-3">
          ${shop.logo ? `<img src="${shop.logo}" style="height:60px;width:60px;object-fit:contain;" class="mb-2 d-block mx-auto">` : ''}
          <h4 class="mb-0 fw-bold">${shop.name}</h4>
          <p class="mb-0 small">${shop.address}</p>
          <p class="mb-0 small">📞 ${shop.mobile} ${shop.whatsapp ? '| WhatsApp: '+shop.whatsapp : ''}</p>
          ${shop.email ? `<p class="mb-0 small">${shop.email}</p>` : ''}
        </div>
        <hr>
        <div class="row mb-2">
          <div class="col-6"><strong>Invoice No:</strong> ${sale.invoiceNo}</div>
          <div class="col-6 text-end"><strong>Date:</strong> ${dateStr}</div>
          <div class="col-6"><strong>Customer:</strong> ${sale.customerName}</div>
          <div class="col-6 text-end">${sale.customerMobile ? '📱 '+sale.customerMobile : ''}</div>
        </div>
        <hr>
        <table class="table table-sm table-bordered">
          <thead class="table-dark"><tr><th>#</th><th>Product</th><th>Qty</th><th>Price</th><th>Disc</th><th>Total</th></tr></thead>
          <tbody>
            ${sale.items.map((item, i) => `
              <tr>
                <td>${i+1}</td>
                <td>${item.productName}</td>
                <td>${item.quantity}</td>
                <td>${APP.fmt(item.price)}</td>
                <td>${APP.fmt(item.discount)}</td>
                <td>${APP.fmt(item.total)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <div class="row justify-content-end">
          <div class="col-md-5">
            <table class="table table-sm">
              <tr><td>Subtotal:</td><td class="text-end">${APP.fmt(sale.items.reduce((s,i)=>s+i.total,0))}</td></tr>
              ${sale.discount ? `<tr><td>Discount:</td><td class="text-end">- ${APP.fmt(sale.discount)}</td></tr>` : ''}
              ${sale.taxRate ? `<tr><td>Tax (${sale.taxRate}%):</td><td class="text-end">${APP.fmt((sale.items.reduce((s,i)=>s+i.total,0)-sale.discount)*(sale.taxRate/100))}</td></tr>` : ''}
              <tr class="fw-bold"><td>Grand Total:</td><td class="text-end">${APP.fmt(sale.grandTotal)}</td></tr>
              <tr><td>Paid (${sale.paymentMethod}):</td><td class="text-end">${APP.fmt(sale.paidAmount)}</td></tr>
              ${sale.dueAmount > 0 ? `<tr class="text-danger fw-bold"><td>Due:</td><td class="text-end">${APP.fmt(sale.dueAmount)}</td></tr>` : ''}
            </table>
          </div>
        </div>
        ${sale.notes ? `<div class="mt-2"><strong>Notes:</strong> ${sale.notes}</div>` : ''}
        <hr>
        <div class="text-center">
          <p class="fw-bold mb-0">${t('thankyou')}</p>
          <p class="text-muted mb-0">${t('visitAgain')}</p>
        </div>
        ${sale.createdBy ? `<div class="text-muted mt-2" style="font-size:10px;text-align:right;">Served by: ${sale.createdBy}</div>` : ''}
      </div>`;
  },

  printInvoice() {
    const area = document.getElementById('invoicePrintArea');
    if (!area || !area.innerHTML.trim()) { APP.showToast('Post the sale first to print', 'warning'); return; }
    APP.printElement(area);
  },

  downloadPDF() {
    const area = document.getElementById('invoicePrintArea');
    if (!area || !area.innerHTML.trim()) { APP.showToast('Post the sale first to download PDF', 'warning'); return; }
    const invNo = document.getElementById('invNo')?.value || 'INV';
    // Use print-to-PDF via window.print with hidden content
    const style = `<style>
      @page { margin: 1cm; }
      body { font-family: Arial, sans-serif; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; }
      td, th { border: 1px solid #ddd; padding: 4px 6px; }
      thead { background: #333; color: #fff; }
    </style>`;
    const w = window.open('', '_blank', 'width=600,height=800');
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice-${invNo}</title>${style}
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
      </head><body>${area.innerHTML}
      <script>window.onload=function(){window.print();setTimeout(function(){window.close();},1000);}<\/script>
      </body></html>`);
    w.document.close();
  },

  sendWhatsApp() {
    const shop = DB.getShop();
    const mobile = document.getElementById('invMobile')?.value;
    const invNo = document.getElementById('invNo')?.value;
    const grand = document.getElementById('invGrandInput')?.value;
    const date = APP.fmtDate(document.getElementById('invDate')?.value);

    if (!mobile) { APP.showToast('Customer mobile number required for WhatsApp', 'warning'); return; }

    const msg = `Dear Customer,\n\n🛍️ Thank you for shopping with *${shop.name}*!\n\n📄 Invoice No: ${invNo}\n💰 Total Amount: BDT ${grand}\n📅 Date: ${date}\n\nFor queries, contact us:\n📞 ${shop.mobile || ''}\n\nThank you! 🙏`;
    const cleanMobile = mobile.replace(/\D/g, '');
    const url = `https://wa.me/${cleanMobile.startsWith('88') ? '' : '88'}${cleanMobile}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }
};

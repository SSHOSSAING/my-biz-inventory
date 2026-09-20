# Sales & Inventory Management System
## Complete Offline POS for Small Shopkeepers

A free, fully offline-capable Sales & Inventory Management System built with pure HTML, CSS, and JavaScript. No server, no hosting, no monthly cost required.

---

## ✅ Features

- **100% Offline** — works without internet
- **Google Sheets Backup** — optional cloud sync when online
- **POS-style Invoice** — print, PDF, WhatsApp send
- **Product Management** — stock tracking, low stock alerts
- **Restock Module** — supplier-linked stock entries
- **Sales Reports** — daily, monthly, profit analysis
- **Master Data** — customers, suppliers, full history
- **Bilingual** — English & Bengali (বাংলা)
- **Mobile Friendly** — works on phones and tablets
- **Zero Cost** — no subscriptions, no hosting needed

---

## 📁 File Structure

```
sales-inventory-system/
├── index.html                  ← Dashboard (open this first)
├── README.md
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── storage.js          ← LocalStorage database layer
│       ├── sheet-sync.js       ← Google Sheets integration
│       ├── app.js              ← Core app (nav, toasts, utils)
│       ├── invoice.js          ← Invoice & PDF logic
│       ├── product.js          ← Product management
│       └── dashboard.js        ← Dashboard charts
└── pages/
    ├── invoice.html            ← POS Invoice
    ├── products.html           ← Product management
    ├── restock.html            ← Stock entry / restock
    ├── master-data.html        ← Sales, customers, suppliers
    ├── reports.html            ← Analytics & reports
    └── settings.html           ← Shop profile & settings
```

---

## 🚀 Quick Start (No Installation Needed)

### Option 1 — Open Directly (Simplest)
1. Download or copy the entire `sales-inventory-system/` folder
2. Double-click `index.html` to open in your browser
3. The app loads with demo data — you're ready to use it!

### Option 2 — Run via Local Server (Recommended for Google Sync)
```bash
# Python (any computer)
cd sales-inventory-system
python -m http.server 8080

# Then open: http://localhost:8080
```

> **Why local server for Google Sync?**  
> Google OAuth requires a proper `http://` or `https://` URL.  
> File-based (`file://`) URLs cannot use Google login.  
> For offline-only use, `file://` works perfectly.

---

## ⚙️ First Time Setup

1. Open `index.html` in your browser
2. Demo data is loaded automatically (5 products, 1 supplier, 1 customer)
3. Go to **Settings** to:
   - Enter your **shop name, owner name, address, phone**
   - Upload your **shop logo**
   - Set your **currency** (default: BDT)
4. Start using the **Invoice** page to make sales

---

## 🔗 Google Sheets Setup (Optional — for Cloud Backup)

### Step 1: Create a Google Cloud Project
1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. "My Shop Inventory")
3. Go to **APIs & Services → Library**
4. Enable **Google Sheets API**
5. Enable **Google Drive API**

### Step 2: Create OAuth Credentials
1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth Client ID**
3. Application type: **Web application**
4. Add Authorized JavaScript origins:
   - `http://localhost:8080` (for local use)
   - Your website URL (if hosted)
5. Copy the **Client ID**

### Step 3: Configure the App
1. Open `assets/js/sheet-sync.js`
2. Replace `<<YOUR_GOOGLE_CLIENT_ID>>` with your actual Client ID:
   ```javascript
   CLIENT_ID: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com',
   ```
3. Alternatively, paste the Client ID in **Settings → Google Sheets Integration**

### Step 4: Connect & Create Spreadsheet
1. Go to **Settings → Google Sheets Integration**
2. Click **Connect Google** and log in
3. Click **Create Spreadsheet** — this creates a Google Sheet named:  
   `[Your Shop Name] Inventory Database`
4. Click **Sync Now** to push all data

### Spreadsheet Structure
The system creates 6 sheets automatically:
| Sheet | Contents |
|-------|----------|
| Products | All products with prices and stock |
| Stock | All restock entries |
| Sales | All invoice/sale records |
| Customers | Customer directory |
| Suppliers | Supplier directory |
| Settings | Shop settings |

---

## 📱 How to Use — Page by Page

### Dashboard
- Summary cards: today's sales, monthly total, stock value
- Low stock alerts
- Last 7 days sales chart
- Recent sales and restock history
- Google Sync status

### Invoice (POS)
1. Select a customer (or type name directly)
2. Add products one by one using **Add Product**
3. Set quantity, price, discount per item
4. Choose payment method (Cash / bKash / Nagad / Rocket / Card)
5. Enter amount paid
6. Click **Post Sale** to complete
7. **Print**, **Download PDF**, or **Send via WhatsApp**

### Products
- Add/edit/delete products
- Fields: name, category, brand, SKU, unit, prices, stock, reorder level
- Filter by category or status
- Export to CSV or JSON
- Low stock items highlighted in yellow

### Restock
- Select supplier and product
- Enter quantity and purchase price
- Save as Draft or **Post Stock** to update inventory immediately
- View stock history
- Quick restock button for low-stock items

### Master Data
Tabs for:
- **Sales** — full sales history with date filter
- **Stock** — all restock entries
- **Customers** — add/edit/delete customers
- **Suppliers** — add/edit/delete suppliers
- **Products** — read-only product list with export

### Reports
- Select period: Today / This Week / This Month / This Year / Custom
- Revenue, profit, invoice count, items sold
- Daily sales bar chart
- Payment method breakdown
- Top 10 selling products
- Profit analysis by product
- Low stock alert table

### Settings
- **Shop Profile** — name, logo, contact details (shown on all invoices)
- **App Settings** — currency, tax rate, language
- **Google Sheets** — connect and sync
- **Backup & Restore** — export/import JSON, export CSV

---

## 💾 Data Storage

All data is stored in your browser's **LocalStorage**:
- No external database needed
- Data persists even after closing the browser
- Stored on the device you use the app on
- ~5 MB storage limit (sufficient for years of small shop data)

> **Important:** If you clear browser data/cache, LocalStorage is deleted.  
> Always export a JSON backup regularly from Settings → Backup & Restore.

---

## 📊 Data Limits (Estimated)

| Data Type | Records before 5MB limit |
|-----------|--------------------------|
| Products | ~2,000+ |
| Sales | ~10,000+ |
| Customers | ~5,000+ |
| Suppliers | ~1,000+ |

---

## 🖨️ Printing Invoices

1. Post a sale on the Invoice page
2. The invoice preview appears on the right
3. Click **Print** — browser print dialog opens
4. Select your printer or "Save as PDF"
5. Sidebar and buttons are automatically hidden in print

---

## 📲 WhatsApp Invoice

1. Make sure customer mobile number is filled
2. Click **WhatsApp Invoice** button
3. WhatsApp Web opens with a pre-filled message
4. Customer number and invoice details are pre-loaded
5. Press Send manually

> Note: Uses `wa.me` deep link. Works on desktop (WhatsApp Web) and mobile.

---

## 🌐 Language Switch

- Click the **EN/বাং** button in the top-right corner
- Switches between English and Bengali
- Preference is saved automatically

---

## 📤 Export Options

| Format | Where |
|--------|-------|
| JSON Backup | Settings → Export JSON Backup |
| Products CSV | Products page → CSV button |
| Sales CSV | Master Data → Sales → CSV |
| Stock CSV | Master Data → Stock → CSV |
| Customers CSV | Master Data → Customers → CSV |
| Suppliers CSV | Master Data → Suppliers → CSV |
| Sales Report CSV | Reports → Export CSV |

---

## 🔧 Customization

### Change currency symbol
In `assets/js/storage.js`, find:
```javascript
currency: 'BDT'
```
Change to `USD`, `EUR`, `INR`, etc.

### Add product categories
In `pages/products.html`, find `<datalist id="categoryList">` and add your categories.

### Change tax rate default
In `pages/invoice.html`, the Tax field defaults to `0`. Change in Settings.

### Add more payment methods
In `pages/invoice.html`, find the payment method radio buttons and add new ones.

---

## ❓ Troubleshooting

**Q: Data disappeared after clearing browser history**  
A: LocalStorage is cleared with browser data. Always export a backup from Settings first.

**Q: Google Sync doesn't work**  
A: You need to run the app on `http://localhost:8080`, not as a `file://` URL. Also ensure your Client ID is set correctly.

**Q: Print/PDF looks wrong**  
A: Use Chrome or Edge for best print results. In the print dialog, uncheck "Headers and footers".

**Q: App is slow**  
A: If you have thousands of records, use the date filters on Reports and Master Data pages to load less data at once.

**Q: WhatsApp button doesn't work**  
A: Make sure the customer mobile number starts with the country code (e.g. `01XXXXXXXX` for Bangladesh — the app auto-adds `88` prefix).

---

## 🛡️ Privacy & Security

- All data stays on your device (browser LocalStorage)
- Google Sheets sync only happens when YOU click Sync or it's triggered
- No data is sent to any third-party server
- Google OAuth is used only to authenticate with your own Google account

---

## 📞 Support

This is a standalone open-source tool. For issues:
1. Check the Troubleshooting section above
2. Export a backup before making any major changes
3. Try opening in a different browser (Chrome recommended)

---

## 📝 Version History

| Version | Notes |
|---------|-------|
| 1.0 | Initial release — full offline POS system |

---

*Built for small shopkeepers in Cox's Bazar and beyond. Free forever.*

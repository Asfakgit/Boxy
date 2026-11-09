/**
 * ============================================================================
 * Boxy Cloud Kitchen POS & ERP — Streamlined Google Apps Script Backend (Code.gs)
 * ============================================================================
 * 
 * Clean, lightweight 8-Table Architecture:
 *  1. Transactions   — Master cash flow audit log (All Money IN / OUT)
 *  2. Sales          — Customer POS orders & invoices with readable item summaries
 *  3. Products       — Menu items with LIVE STOCK tracking, unit, min reorder alert
 *  4. Raw Materials  — Kitchen stock inventory, ingredients & restocking
 *  5. Purchases      — Supplier restocking invoices & payable settlements
 *  6. Expenses       — Daily operational overheads (Gas, Utilities, Wages)
 *  7. Customers      — B2B client accounts and credit balances
 *  8. Suppliers      — Vendor contacts and payables
 */

// Google Sheet ID for Boxy Cloud Kitchen ERP Database (2026)
const SPREADSHEET_ID = '19VZ70qy1rUHsBTfn1FSUyjqarB56VujZJR7UcJqZXb8';

const SHEET_NAMES = {
  TRANSACTIONS: 'Transactions',
  SALES: 'Sales',
  PRODUCTS: 'Products',
  RAW_MATERIALS: 'Raw Materials',
  PURCHASES: 'Purchases',
  EXPENSES: 'Expenses',
  CUSTOMERS: 'Customers',
  SUPPLIERS: 'Suppliers',
  RECIPES: 'Recipes',
  PARTNERS: 'Partners',
  LABOURERS: 'Labourers',
  PARTNER_WITHDRAWALS: 'Partner Withdrawals',
  SALARY_PAYMENTS: 'Salary Payments',
  ATTENDANCE: 'Attendance'
};

const UNWANTED_SHEETS = [
  'Employees',
  'Units',
  'Categories',
  'Settings',
  'Sale Items',
  'Purchase Items',
  'Dashboard Cache',
  'Sheet1'
];

// Clean, streamlined column definitions with full stock support
const SCHEMAS = {
  [SHEET_NAMES.TRANSACTIONS]: ['id', 'date', 'flow', 'type', 'partyName', 'reference', 'amount', 'paymentMethod', 'notes'],
  [SHEET_NAMES.SALES]: ['invoiceNumber', 'date', 'customerName', 'itemsSummary', 'subtotal', 'discount', 'taxAmount', 'totalAmount', 'paymentMethod', 'status'],
  [SHEET_NAMES.PRODUCTS]: ['code', 'name', 'category', 'sellingPrice', 'costPrice', 'currentStock', 'minStock', 'unit', 'status', 'image'],
  [SHEET_NAMES.RAW_MATERIALS]: ['id', 'name', 'category', 'currentStock', 'unit', 'costPrice', 'minStock'],
  [SHEET_NAMES.PURCHASES]: ['purchaseNumber', 'date', 'supplierName', 'itemsSummary', 'totalAmount', 'amountPaid', 'paymentStatus', 'paymentMethod', 'notes'],
  [SHEET_NAMES.EXPENSES]: ['id', 'date', 'category', 'amount', 'paymentMethod', 'description'],
  [SHEET_NAMES.CUSTOMERS]: ['id', 'name', 'phone', 'address', 'outstandingBalance', 'creditLimit'],
  [SHEET_NAMES.SUPPLIERS]: ['id', 'name', 'phone', 'address', 'outstandingBalance'],
  [SHEET_NAMES.RECIPES]: ['id', 'productCode', 'productName', 'rawMaterialId', 'rawMaterialName', 'quantity', 'unit', 'costPerUnit', 'totalCost'],
  [SHEET_NAMES.PARTNERS]: ['id', 'name', 'phone', 'address', 'joiningDate', 'profitShare', 'isPartner', 'isLabour', 'status', 'notes'],
  [SHEET_NAMES.LABOURERS]: ['id', 'partnerId', 'name', 'phone', 'jobRole', 'salaryType', 'salaryAmount', 'workingDays', 'status', 'joiningDate'],
  [SHEET_NAMES.PARTNER_WITHDRAWALS]: ['id', 'partnerId', 'partnerName', 'date', 'amount', 'paymentMethod', 'notes'],
  [SHEET_NAMES.SALARY_PAYMENTS]: ['id', 'labourId', 'labourName', 'date', 'month', 'amount', 'paymentMethod', 'notes'],
  [SHEET_NAMES.ATTENDANCE]: ['id', 'labourId', 'labourName', 'date', 'status', 'workingHours', 'notes']
};

// Distinct tab colors for clean visual navigation in Google Sheets
const TAB_COLORS = {
  [SHEET_NAMES.TRANSACTIONS]: '#10b981', // Emerald
  [SHEET_NAMES.SALES]: '#4f46e5',        // Indigo
  [SHEET_NAMES.PRODUCTS]: '#7c3aed',     // Purple
  [SHEET_NAMES.RAW_MATERIALS]: '#f59e0b',// Amber
  [SHEET_NAMES.PURCHASES]: '#0284c7',   // Sky
  [SHEET_NAMES.EXPENSES]: '#e11d48',    // Rose
  [SHEET_NAMES.CUSTOMERS]: '#0d9488',   // Teal
  [SHEET_NAMES.SUPPLIERS]: '#ea580c',   // Orange
  [SHEET_NAMES.RECIPES]: '#ec4899',     // Pink
  [SHEET_NAMES.PARTNERS]: '#059669',    // Green
  [SHEET_NAMES.LABOURERS]: '#d97706',   // Amber
  [SHEET_NAMES.PARTNER_WITHDRAWALS]: '#2563eb', // Blue
  [SHEET_NAMES.SALARY_PAYMENTS]: '#dc2626', // Red
  [SHEET_NAMES.ATTENDANCE]: '#8b5cf6'   // Violet
};

/**
 * Access Google Spreadsheet by ID or Active instance
 */
function getSpreadsheet() {
  if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID && SPREADSHEET_ID.trim() !== '') {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    } catch (err) {
      Logger.log('Could not open by SPREADSHEET_ID: ' + err.toString());
    }
  }
  
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  throw new Error('Spreadsheet not found. Please bind this script via Extensions > Apps Script.');
}

/**
 * Automated Cleanup: Removes unwanted legacy tabs and setups core 8 sheets
 */
function cleanupSheetDatabase() {
  const ss = getSpreadsheet();
  const deleted = [];

  // 1. Delete unwanted sheets
  UNWANTED_SHEETS.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && ss.getSheets().length > 1) {
      try {
        ss.deleteSheet(sheet);
        deleted.push(sheetName);
      } catch (err) {
        Logger.log('Could not delete ' + sheetName + ': ' + err.toString());
      }
    }
  });

  // 2. Setup/verify core 8 sheets
  const setupRes = setupSheets();

  return {
    status: 'success',
    deletedSheets: deleted,
    activeSheets: Object.values(SHEET_NAMES),
    setup: setupRes
  };
}

/**
 * Clear all data rows across all core sheets while preserving styled header rows
 */
function clearAllSheetData() {
  const ss = getSpreadsheet();
  const cleared = [];

  Object.values(SHEET_NAMES).forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
        cleared.push({ sheet: sheetName, rowsDeleted: lastRow - 1 });
      }
    }
  });

  return {
    status: 'success',
    message: 'All data rows cleared across all sheets',
    clearedSheets: cleared
  };
}

/**
 * Initialize / Rebuild core 8 sheets with styled headers and frozen top row
 */
function setupSheets() {
  const ss = getSpreadsheet();
  const created = [];
  const updated = [];

  Object.entries(SCHEMAS).forEach(([sheetName, headers]) => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
      styleHeaderRow(sheet, headers.length, TAB_COLORS[sheetName]);
      created.push(sheetName);
    } else {
      const lastRow = sheet.getLastRow();
      if (lastRow === 0) {
        sheet.appendRow(headers);
        styleHeaderRow(sheet, headers.length, TAB_COLORS[sheetName]);
        created.push(sheetName);
      } else {
        // Update header row to ensure all required columns exist
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        styleHeaderRow(sheet, headers.length, TAB_COLORS[sheetName]);
        updated.push(sheetName);
      }
    }
  });

  return { status: 'success', createdSheets: created, updatedSheets: updated };
}

function styleHeaderRow(sheet, numCols, tabColor) {
  const headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#312e81'); // Dark modern indigo
  headerRange.setFontColor('#ffffff');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 32);

  if (tabColor) {
    try {
      sheet.setTabColor(tabColor);
    } catch (e) {
      // Ignored if unsupported
    }
  }
}

/**
 * Handle GET Requests
 */
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || 'ping';

    if (action === 'ping') {
      const ss = getSpreadsheet();
      const allSheets = ss.getSheets().map(s => ({
        name: s.getName(),
        rows: Math.max(0, s.getLastRow() - 1)
      }));

      return createJSONResponse({
        status: 'success',
        message: 'Boxy Cloud Kitchen backend is connected.',
        spreadsheetName: ss.getName(),
        spreadsheetId: ss.getId(),
        detectedSheets: allSheets,
        serverTime: new Date().toISOString()
      });
    }

    let data = null;

    switch (action) {
      case 'getAllData':
        data = getAllDatabaseData();
        break;
      case 'getTransactions':
        data = getSheetData(SHEET_NAMES.TRANSACTIONS);
        break;
      case 'getSales':
        data = getSheetData(SHEET_NAMES.SALES);
        break;
      case 'getProducts':
        data = getSheetData(SHEET_NAMES.PRODUCTS);
        break;
      case 'getRawMaterials':
        data = getSheetData(SHEET_NAMES.RAW_MATERIALS);
        break;
      case 'getPurchases':
        data = getSheetData(SHEET_NAMES.PURCHASES);
        break;
      case 'getExpenses':
        data = getSheetData(SHEET_NAMES.EXPENSES);
        break;
      case 'getCustomers':
        data = getSheetData(SHEET_NAMES.CUSTOMERS);
        break;
      case 'getSuppliers':
        data = getSheetData(SHEET_NAMES.SUPPLIERS);
        break;
      case 'getDashboardMetrics':
        data = calculateDashboardMetrics();
        break;
      case 'setupSheets':
      case 'rebuildAllTabs':
        data = setupSheets();
        break;
      case 'cleanup':
        data = cleanupSheetDatabase();
        break;
      case 'clearAllData':
      case 'purgeAllData':
        data = clearAllSheetData();
        break;
      default:
        return createJSONResponse({ status: 'error', message: 'Unknown action: ' + action });
    }

    return createJSONResponse({ status: 'success', data: data });
  } catch (error) {
    return createJSONResponse({ status: 'error', message: error.toString() });
  }
}

/**
 * Handle POST Requests
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action;
    const data = payload.data || {};
    let result = null;

    switch (action) {
      case 'ping':
        result = { pong: true, time: new Date().toISOString() };
        break;
      case 'setupSheets':
      case 'rebuildAllTabs':
        result = setupSheets();
        break;
      case 'cleanupDatabase':
        result = cleanupSheetDatabase();
        break;
      case 'clearAllData':
      case 'purgeAllData':
        result = clearAllSheetData();
        break;
      case 'recordSale':
        result = recordSaleEntry(data);
        break;
      case 'recordPurchase':
        result = recordPurchaseEntry(data);
        break;
      case 'adjustStock':
        result = adjustStockEntry(data);
        break;
      case 'recordExpense':
        result = recordExpenseEntry(data);
        break;
      case 'recordCustomerPayment':
        result = recordCustomerPayment(data);
        break;
      case 'recordSupplierPayment':
        result = recordSupplierPayment(data);
        break;
      case 'saveRow':
        result = saveOrUpdateRow(payload.sheetName, data);
        break;
      case 'deleteRow':
        result = deleteRowById(payload.sheetName, payload.id || (payload.data && (payload.data.id || payload.data.code)) || data.id || data.code || data.key || data.invoiceNumber || data.purchaseNumber);
        break;
      default:
        return createJSONResponse({ status: 'error', message: 'Unknown POST action: ' + action });
    }

    return createJSONResponse({ status: 'success', data: result });
  } catch (error) {
    return createJSONResponse({ status: 'error', message: error.toString() });
  }
}

/**
 * Helper: Append financial entry to master 'Transactions' sheet
 */
function logTransaction(tx) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAMES.TRANSACTIONS);
    if (!sheet) {
      setupSheets();
      sheet = ss.getSheetByName(SHEET_NAMES.TRANSACTIONS);
    }

    const row = [
      tx.id || 'TXN-' + Date.now(),
      tx.date || new Date().toISOString(),
      tx.flow || 'IN', // 'IN' or 'OUT'
      tx.type || 'Sale',
      tx.partyName || 'Walk-in',
      tx.reference || '',
      Number(tx.amount || 0),
      tx.paymentMethod || 'Cash',
      tx.notes || ''
    ];

    sheet.appendRow(row);
  } catch (err) {
    Logger.log('Error logging transaction: ' + err.toString());
  }
}

/**
 * Record Sale with Clean Single-Row Items Summary & Auto Stock Deduction
 */
function convertRecipeQty(qty, fromUnit, toUnit) {
  const f = String(fromUnit || '').trim().toLowerCase();
  const t = String(toUnit || '').trim().toLowerCase();
  if (f === t) return Number(qty || 0);
  if ((f === 'g' || f === 'gram' || f === 'grams') && (t === 'kg' || t === 'kilogram' || t === 'kilograms')) {
    return Number(qty || 0) / 1000;
  }
  if ((f === 'kg' || f === 'kilogram' || f === 'kilograms') && (t === 'g' || t === 'gram' || t === 'grams')) {
    return Number(qty || 0) * 1000;
  }
  if ((f === 'ml' || f === 'millilitre' || f === 'millilitres') && (t === 'ltr' || t === 'liter' || t === 'litres')) {
    return Number(qty || 0) / 1000;
  }
  if ((f === 'ltr' || f === 'liter' || f === 'litres') && (t === 'ml' || t === 'millilitre' || t === 'millilitres')) {
    return Number(qty || 0) * 1000;
  }
  return Number(qty || 0);
}

function recordSaleEntry(saleData) {
  const ss = getSpreadsheet();
  let salesSheet = ss.getSheetByName(SHEET_NAMES.SALES);
  let productsSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
  let customersSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);

  if (!salesSheet) {
    setupSheets();
    salesSheet = ss.getSheetByName(SHEET_NAMES.SALES);
    productsSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    customersSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);
  }

  const invoiceNum = saleData.invoiceNumber || 'INV-' + Date.now();
  const date = saleData.date || new Date().toISOString();
  const items = saleData.items || [];

  // Create clean readable items summary e.g. "2x Chicken Shawarma, 1x Mojito"
  const itemsSummary = items.map(i => `${i.quantity}x ${i.productName || i.name}`).join(', ');

  // 1. Append Sale Row
  salesSheet.appendRow([
    invoiceNum,
    date,
    saleData.customerName || 'Walk-in Customer',
    itemsSummary,
    Number(saleData.subtotal || saleData.totalAmount || 0),
    Number(saleData.discount || 0),
    Number(saleData.taxAmount || 0),
    Number(saleData.totalAmount || 0),
    saleData.paymentMethod || 'Cash',
    'Completed'
  ]);

  // 2. Automatically Deduct Raw Materials (Recipe BOM) or Fallback to Product Stock
  if (items.length > 0) {
    const recipesData = getSheetData(SHEET_NAMES.RECIPES);
    const rawMaterialsSheet = ss.getSheetByName(SHEET_NAMES.RAW_MATERIALS);
    const rawMaterialsData = rawMaterialsSheet ? getSheetData(SHEET_NAMES.RAW_MATERIALS) : [];
    const rmStockColIdx = SCHEMAS[SHEET_NAMES.RAW_MATERIALS].indexOf('currentStock') + 1;

    items.forEach(item => {
      const pCode = String(item.productCode || item.code || '');
      const pName = String(item.productName || item.name || '').toLowerCase();
      const itemQty = Number(item.quantity || 1);

      const matchedRecipeIngredients = recipesData.filter(r => 
        (pCode && String(r.productCode) === pCode) || 
        (pName && String(r.productName || '').toLowerCase() === pName)
      );

      if (matchedRecipeIngredients.length > 0 && rawMaterialsSheet && rmStockColIdx > 0) {
        // Deduct raw materials based on Recipe BOM
        matchedRecipeIngredients.forEach(ing => {
          const rmIdx = rawMaterialsData.findIndex(rm => 
            String(rm.id) === String(ing.rawMaterialId) || 
            String(rm.name).toLowerCase() === String(ing.rawMaterialName).toLowerCase()
          );
          if (rmIdx !== -1) {
            const rm = rawMaterialsData[rmIdx];
            const deductionPerUnit = convertRecipeQty(ing.quantity, ing.unit, rm.unit);
            const totalDeduction = deductionPerUnit * itemQty;
            const currentStock = Number(rm.currentStock || 0);
            const newStock = Math.max(0, currentStock - totalDeduction);
            rawMaterialsSheet.getRange(rmIdx + 2, rmStockColIdx).setValue(Number(newStock.toFixed(4)));
            rawMaterialsData[rmIdx].currentStock = newStock;
          }
        });
      } else if (productsSheet) {
        // Fallback: direct product stock deduction
        const productsData = getSheetData(SHEET_NAMES.PRODUCTS);
        const prodHeaders = SCHEMAS[SHEET_NAMES.PRODUCTS];
        const stockColIdx = prodHeaders.indexOf('currentStock') + 1;
        if (stockColIdx > 0) {
          const prodIndex = productsData.findIndex(p => 
            (pCode && String(p.code) === pCode) || 
            String(p.name).toLowerCase() === pName
          );
          if (prodIndex !== -1) {
            const currentStock = Number(productsData[prodIndex].currentStock || 0);
            const newStock = Math.max(0, currentStock - itemQty);
            productsSheet.getRange(prodIndex + 2, stockColIdx).setValue(newStock);
          }
        }
      }
    });
  }

  // 3. Update Customer Balance if Credit sale
  if (saleData.customerId && saleData.customerId !== 'WALKIN' && saleData.paymentMethod === 'Credit' && customersSheet) {
    const customersData = getSheetData(SHEET_NAMES.CUSTOMERS);
    const custIndex = customersData.findIndex(c => String(c.id) === String(saleData.customerId));
    if (custIndex !== -1) {
      const currentBal = Number(customersData[custIndex].outstandingBalance) || 0;
      const newBal = currentBal + Number(saleData.totalAmount || 0);
      customersSheet.getRange(custIndex + 2, 5).setValue(newBal); // Column 5 = outstandingBalance
    }
  }

  // 4. Log to Transactions Master Ledger
  logTransaction({
    id: 'TXN-' + Date.now(),
    date: date,
    flow: 'IN',
    type: 'Sale',
    partyName: saleData.customerName || 'Walk-in Customer',
    reference: invoiceNum,
    amount: Number(saleData.totalAmount || 0),
    paymentMethod: saleData.paymentMethod || 'Cash',
    notes: itemsSummary
  });

  return { invoiceNumber: invoiceNum, status: 'Success' };
}

/**
 * Record Purchase Restocking for Raw Materials and/or Products
 */
function recordPurchaseEntry(purchaseData) {
  const ss = getSpreadsheet();
  let purchasesSheet = ss.getSheetByName(SHEET_NAMES.PURCHASES);
  let rawMaterialsSheet = ss.getSheetByName(SHEET_NAMES.RAW_MATERIALS);
  let productsSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
  let suppliersSheet = ss.getSheetByName(SHEET_NAMES.SUPPLIERS);

  if (!purchasesSheet) {
    setupSheets();
    purchasesSheet = ss.getSheetByName(SHEET_NAMES.PURCHASES);
    rawMaterialsSheet = ss.getSheetByName(SHEET_NAMES.RAW_MATERIALS);
    productsSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    suppliersSheet = ss.getSheetByName(SHEET_NAMES.SUPPLIERS);
  }

  const purchaseNum = purchaseData.purchaseNumber || purchaseData.materialNumber || purchaseData.id || 'PUR-' + Date.now().toString().slice(-6);
  const date = purchaseData.date || new Date().toISOString().split('T')[0];
  const items = purchaseData.items || [];
  const itemsSummary = items.length > 0 
    ? items.map(i => `${i.quantity} ${i.rawMaterialName || i.name}`).join(', ')
    : (purchaseData.notes || 'Restocking');

  const totalAmount = Number(purchaseData.totalAmount || 0);
  const amountPaid = Number(purchaseData.amountPaid !== undefined ? purchaseData.amountPaid : purchaseData.totalAmount) || 0;

  // 1. Append Purchase Row
  purchasesSheet.appendRow([
    purchaseNum,
    date,
    purchaseData.supplierName || 'Supplier',
    itemsSummary,
    totalAmount,
    amountPaid,
    purchaseData.paymentStatus || 'Paid',
    purchaseData.paymentMethod || 'Bank Transfer',
    purchaseData.notes || ''
  ]);

  // 2. Restock Raw Materials Stock directly
  if (items.length > 0 && rawMaterialsSheet) {
    const rawMaterialsData = getSheetData(SHEET_NAMES.RAW_MATERIALS);
    items.forEach(item => {
      const rmIndex = rawMaterialsData.findIndex(rm => 
        String(rm.id) === String(item.rawMaterialId || item.id) ||
        String(rm.name).toLowerCase() === String(item.rawMaterialName || item.name).toLowerCase()
      );
      if (rmIndex !== -1) {
        const currentStock = Number(rawMaterialsData[rmIndex].currentStock) || 0;
        const newStock = currentStock + Number(item.quantity || 0);
        rawMaterialsSheet.getRange(rmIndex + 2, 4).setValue(newStock); // Column 4 = currentStock
        if (item.unitPrice) {
          rawMaterialsSheet.getRange(rmIndex + 2, 6).setValue(Number(item.unitPrice)); // Column 6 = costPrice
        }
      }
    });
  }

  // 3. Restock Products Stock directly (if product restocked)
  if (items.length > 0 && productsSheet) {
    const productsData = getSheetData(SHEET_NAMES.PRODUCTS);
    const prodHeaders = SCHEMAS[SHEET_NAMES.PRODUCTS];
    const stockColIdx = prodHeaders.indexOf('currentStock') + 1;
    const costColIdx = prodHeaders.indexOf('costPrice') + 1;

    if (stockColIdx > 0) {
      items.forEach(item => {
        const prodIndex = productsData.findIndex(p => 
          String(p.code) === String(item.code || item.id || item.rawMaterialId) ||
          String(p.name).toLowerCase() === String(item.name || item.rawMaterialName).toLowerCase()
        );
        if (prodIndex !== -1) {
          const currentStock = Number(productsData[prodIndex].currentStock) || 0;
          const newStock = currentStock + Number(item.quantity || 0);
          productsSheet.getRange(prodIndex + 2, stockColIdx).setValue(newStock);
          if (item.unitPrice && costColIdx > 0) {
            productsSheet.getRange(prodIndex + 2, costColIdx).setValue(Number(item.unitPrice));
          }
        }
      });
    }
  }

  // 4. Update Supplier Balance if Due
  if (purchaseData.supplierId && suppliersSheet && (purchaseData.paymentStatus === 'Partial' || purchaseData.paymentStatus === 'Due')) {
    const suppliersData = getSheetData(SHEET_NAMES.SUPPLIERS);
    const supIndex = suppliersData.findIndex(s => String(s.id) === String(purchaseData.supplierId));
    if (supIndex !== -1) {
      const currentBal = Number(suppliersData[supIndex].outstandingBalance) || 0;
      const due = totalAmount - amountPaid;
      suppliersSheet.getRange(supIndex + 2, 5).setValue(currentBal + due); // Column 5 = outstandingBalance
    }
  }

  // 5. Log to Transactions
  logTransaction({
    id: 'TXN-' + Date.now(),
    date: date,
    flow: 'OUT',
    type: 'Purchase',
    partyName: purchaseData.supplierName || 'Supplier',
    reference: purchaseNum,
    amount: amountPaid,
    paymentMethod: purchaseData.paymentMethod || 'Bank Transfer',
    notes: itemsSummary
  });

  return { purchaseNumber: purchaseNum, status: 'Success' };
}

/**
 * Direct Stock Adjustment (Add, Deduct, or Set Stock for Products or Raw Materials)
 */
function adjustStockEntry(data) {
  const ss = getSpreadsheet();
  const { itemId, delta, newStock, type, notes } = data;

  // 1. Try Products sheet
  if (type === 'product' || !type) {
    const sheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
    if (sheet) {
      const prodData = getSheetData(SHEET_NAMES.PRODUCTS);
      const idx = prodData.findIndex(p => String(p.code) === String(itemId) || String(p.id) === String(itemId));
      if (idx !== -1) {
        const colIdx = SCHEMAS[SHEET_NAMES.PRODUCTS].indexOf('currentStock') + 1;
        const current = Number(prodData[idx].currentStock || 0);
        const updated = newStock !== undefined ? Number(newStock) : Math.max(0, current + Number(delta || 0));
        sheet.getRange(idx + 2, colIdx).setValue(updated);
        return { success: true, item: prodData[idx].name, newStock: updated, sheet: SHEET_NAMES.PRODUCTS };
      }
    }
  }

  // 2. Try Raw Materials sheet
  const rmSheet = ss.getSheetByName(SHEET_NAMES.RAW_MATERIALS);
  if (rmSheet) {
    const rmData = getSheetData(SHEET_NAMES.RAW_MATERIALS);
    const idx = rmData.findIndex(rm => String(rm.id) === String(itemId) || String(rm.code) === String(itemId));
    if (idx !== -1) {
      const colIdx = SCHEMAS[SHEET_NAMES.RAW_MATERIALS].indexOf('currentStock') + 1;
      const current = Number(rmData[idx].currentStock || 0);
      const updated = newStock !== undefined ? Number(newStock) : Math.max(0, current + Number(delta || 0));
      rmSheet.getRange(idx + 2, colIdx).setValue(updated);
      return { success: true, item: rmData[idx].name, newStock: updated, sheet: SHEET_NAMES.RAW_MATERIALS };
    }
  }

  return { success: false, message: 'Item not found in Products or Raw Materials' };
}

/**
 * Record Operational Expense
 */
function recordExpenseEntry(expenseData) {
  const ss = getSpreadsheet();
  let expensesSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
  if (!expensesSheet) {
    setupSheets();
    expensesSheet = ss.getSheetByName(SHEET_NAMES.EXPENSES);
  }

  const expId = expenseData.id || 'EXP-' + Date.now().toString().slice(-6);
  const date = expenseData.date || new Date().toISOString().split('T')[0];
  const amount = Number(expenseData.amount || 0);

  // 1. Append Expense Row
  expensesSheet.appendRow([
    expId,
    date,
    expenseData.category || 'Kitchen Gas',
    amount,
    expenseData.paymentMethod || 'Cash',
    expenseData.description || ''
  ]);

  // 2. Log to Transactions
  logTransaction({
    id: 'TXN-' + Date.now(),
    date: date,
    flow: 'OUT',
    type: 'Expense',
    partyName: expenseData.category || 'Overhead',
    reference: expId,
    amount: amount,
    paymentMethod: expenseData.paymentMethod || 'Cash',
    notes: expenseData.description || ''
  });

  return { id: expId, status: 'Success' };
}

/**
 * Record Customer Payment Settlement
 */
function recordCustomerPayment(data) {
  const { customerId, amount, paymentMethod } = data;
  const ss = getSpreadsheet();
  const customersSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);
  const customersData = getSheetData(SHEET_NAMES.CUSTOMERS);

  const custIndex = customersData.findIndex(c => String(c.id) === String(customerId));
  if (custIndex !== -1 && customersSheet) {
    const cust = customersData[custIndex];
    const currentBal = Number(cust.outstandingBalance) || 0;
    const newBal = Math.max(0, currentBal - Number(amount));
    customersSheet.getRange(custIndex + 2, 5).setValue(newBal); // Column 5 = outstandingBalance

    logTransaction({
      id: 'TXN-' + Date.now(),
      date: new Date().toISOString(),
      flow: 'IN',
      type: 'Customer Settlement',
      partyName: cust.name,
      reference: 'CUST-' + customerId,
      amount: Number(amount),
      paymentMethod: paymentMethod || 'Cash',
      notes: 'Customer debt payment'
    });

    return { success: true, newBalance: newBal };
  }
  return { success: false, message: 'Customer not found' };
}

/**
 * Record Supplier Settlement
 */
function recordSupplierPayment(data) {
  const { supplierId, amount, paymentMethod } = data;
  const ss = getSpreadsheet();
  const suppliersSheet = ss.getSheetByName(SHEET_NAMES.SUPPLIERS);
  const suppliersData = getSheetData(SHEET_NAMES.SUPPLIERS);

  const supIndex = suppliersData.findIndex(s => String(s.id) === String(supplierId));
  if (supIndex !== -1 && suppliersSheet) {
    const sup = suppliersData[supIndex];
    const currentBal = Number(sup.outstandingBalance) || 0;
    const newBal = Math.max(0, currentBal - Number(amount));
    suppliersSheet.getRange(supIndex + 2, 5).setValue(newBal); // Column 5 = outstandingBalance

    logTransaction({
      id: 'TXN-' + Date.now(),
      date: new Date().toISOString(),
      flow: 'OUT',
      type: 'Supplier Settlement',
      partyName: sup.name,
      reference: 'SUP-' + supplierId,
      amount: Number(amount),
      paymentMethod: paymentMethod || 'Bank Transfer',
      notes: 'Vendor bill settlement'
    });

    return { success: true, newBalance: newBal };
  }
  return { success: false, message: 'Supplier not found' };
}

/**
 * Generic Read Rows
 */
function getSheetData(sheetName) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];

    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];

    const headers = values[0];
    const rows = values.slice(1);

    return rows.map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        if (header) obj[header] = row[i] !== undefined ? row[i] : '';
      });
      return obj;
    });
  } catch (err) {
    Logger.log('Error reading sheet ' + sheetName + ': ' + err.toString());
    return [];
  }
}

/**
 * Generic Save/Update Row
 */
function saveOrUpdateRow(sheetName, rowData) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    setupSheets();
    sheet = ss.getSheetByName(sheetName);
  }

  const headers = SCHEMAS[sheetName] || sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idKey = rowData.code ? 'code' : (rowData.invoiceNumber ? 'invoiceNumber' : (rowData.purchaseNumber ? 'purchaseNumber' : 'id'));

  if (!rowData[idKey]) {
    rowData[idKey] = sheetName.slice(0, 3).toUpperCase() + '-' + Date.now().toString().slice(-6);
  }

  const existingData = getSheetData(sheetName);
  const rowIndex = existingData.findIndex(item => String(item[idKey]) === String(rowData[idKey]));
  const rowArray = headers.map(h => rowData[h] !== undefined ? rowData[h] : '');

  if (rowIndex !== -1) {
    sheet.getRange(rowIndex + 2, 1, 1, rowArray.length).setValues([rowArray]);
  } else {
    sheet.appendRow(rowArray);
  }

  return rowData;
}

/**
 * Generic Delete Row
 */
function deleteRowById(sheetName, id) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { success: false, message: 'Sheet not found' };

  const existingData = getSheetData(sheetName);
  const rowIndex = existingData.findIndex(item => 
    String(item.id) === String(id) || 
    String(item.code) === String(id) ||
    String(item.invoiceNumber) === String(id) ||
    String(item.purchaseNumber) === String(id)
  );

  if (rowIndex !== -1) {
    sheet.deleteRow(rowIndex + 2);
    return { success: true, deletedId: id };
  }

  return { success: false, message: 'Record not found' };
}

/**
 * Dashboard KPIs Calculation
 */
function calculateDashboardMetrics() {
  const sales = getSheetData(SHEET_NAMES.SALES);
  const purchases = getSheetData(SHEET_NAMES.PURCHASES);
  const expenses = getSheetData(SHEET_NAMES.EXPENSES);
  const customers = getSheetData(SHEET_NAMES.CUSTOMERS);
  const rawMaterials = getSheetData(SHEET_NAMES.RAW_MATERIALS);
  const products = getSheetData(SHEET_NAMES.PRODUCTS);

  const todayStr = new Date().toISOString().split('T')[0];

  const todaySales = sales
    .filter(s => String(s.date).startsWith(todayStr))
    .reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);

  const totalSales = sales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
  const todayPurchases = purchases
    .filter(p => String(p.date).startsWith(todayStr))
    .reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);

  const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netProfit = totalSales - totalPurchases - totalExpenses;
  const outstandingReceivables = customers.reduce((sum, c) => sum + Number(c.outstandingBalance || 0), 0);
  
  const lowStockRaw = rawMaterials.filter(rm => Number(rm.currentStock || 0) <= Number(rm.minStock || 0)).length;
  const lowStockProd = products.filter(p => p.currentStock !== undefined && p.currentStock !== '' && Number(p.currentStock) <= Number(p.minStock || 0)).length;
  const lowStockCount = lowStockRaw + lowStockProd;

  return {
    todaySales: todaySales,
    totalSales: totalSales,
    todayPurchases: todayPurchases,
    totalPurchases: totalPurchases,
    totalExpenses: totalExpenses,
    grossProfit: totalSales - totalPurchases,
    netProfit: netProfit,
    outstandingReceivables: outstandingReceivables,
    lowStockCount: lowStockCount,
    salesCount: sales.length,
    purchasesCount: purchases.length
  };
}

/**
 * Hydrate complete database
 */
function getAllDatabaseData() {
  return {
    transactions: getSheetData(SHEET_NAMES.TRANSACTIONS),
    sales: getSheetData(SHEET_NAMES.SALES),
    products: getSheetData(SHEET_NAMES.PRODUCTS),
    rawMaterials: getSheetData(SHEET_NAMES.RAW_MATERIALS),
    purchases: getSheetData(SHEET_NAMES.PURCHASES),
    expenses: getSheetData(SHEET_NAMES.EXPENSES),
    customers: getSheetData(SHEET_NAMES.CUSTOMERS),
    suppliers: getSheetData(SHEET_NAMES.SUPPLIERS),
    recipes: getSheetData(SHEET_NAMES.RECIPES),
    partners: getSheetData(SHEET_NAMES.PARTNERS),
    labourers: getSheetData(SHEET_NAMES.LABOURERS),
    partnerWithdrawals: getSheetData(SHEET_NAMES.PARTNER_WITHDRAWALS),
    salaryPayments: getSheetData(SHEET_NAMES.SALARY_PAYMENTS),
    attendance: getSheetData(SHEET_NAMES.ATTENDANCE)
  };
}

function createJSONResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

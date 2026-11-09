import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Format currency safely for standard jsPDF fonts (Helvetica/Courier)
 * Prevents non-ASCII symbols like ₹ from rendering as garbage.
 */
export const formatCurrencyForPdf = (val, currencySymbol = '₹') => {
  const num = Number(val || 0);
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  if (currencySymbol === '₹' || currencySymbol === 'INR') {
    return `Rs. ${formatted}`;
  }
  return `${currencySymbol} ${formatted}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(dateStr);
  }
};

/**
 * =========================================================================
 * 1. BALANCE SHEET PDF EXPORT
 * =========================================================================
 */
export const exportBalanceSheetPDF = ({
  balanceSheetData,
  asOfDate,
  settings = {},
  currency = '₹'
}) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;

  const companyName = (settings.companyName || 'BOXY CLOUD KITCHEN').toUpperCase();
  const tagline = settings.tagline || 'Cloud Kitchen Operations & Financial Intelligence';
  const fmt = (v) => formatCurrencyForPdf(v, currency);

  // 1. Header Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 3, 3, 'F');

  // Draw Logo if provided
  let textStartX = margin + 8;
  const logo = settings?.logo;
  if (logo && typeof logo === 'string' && logo.startsWith('data:image')) {
    try {
      const imgType = logo.includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(logo, imgType, margin + 4, currentY + 4, 20, 20);
      textStartX = margin + 28;
    } catch (err) {
      console.warn('PDF Logo render skipped:', err);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(companyName, textStartX, currentY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text(tagline, textStartX, currentY + 18);

  // Document Badge on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('BALANCE SHEET', pageWidth - margin - 8, currentY + 11, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`As of: ${formatDate(asOfDate)}`, pageWidth - margin - 8, currentY + 18, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin - 8, currentY + 23, { align: 'right' });

  currentY += 34;

  // 2. Executive Financial Summary Cards
  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cards = [
    { label: 'TOTAL ASSETS', value: fmt(balanceSheetData.totalAssets), bg: [238, 242, 255], border: [99, 102, 241], text: [49, 46, 129] },
    { label: 'TOTAL LIABILITIES', value: fmt(balanceSheetData.totalLiabilities), bg: [254, 242, 242], border: [239, 68, 68], text: [153, 27, 27] },
    { label: 'TOTAL EQUITY', value: fmt(balanceSheetData.totalEquity), bg: [240, 253, 244], border: [34, 197, 94], text: [22, 101, 52] },
    { label: 'LIABILITIES + EQUITY', value: fmt(balanceSheetData.totalLiabAndEquity), bg: [248, 250, 252], border: [148, 163, 184], text: [15, 23, 42] }
  ];

  cards.forEach((card, idx) => {
    const x = margin + idx * (cardWidth + 3);
    doc.setFillColor(...card.bg);
    doc.setDrawColor(...card.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, currentY, cardWidth, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + cardWidth / 2, currentY + 5.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...card.text);
    doc.text(card.value, x + cardWidth / 2, currentY + 13, { align: 'center' });
  });

  currentY += 23;

  // Audit Validation Pill
  const isBalanced = Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalLiabAndEquity) < 0.05;
  doc.setFillColor(isBalanced ? 236 : 254, isBalanced ? 253 : 242, isBalanced ? 245 : 242);
  doc.setDrawColor(isBalanced ? 16 : 239, isBalanced ? 185 : 68, isBalanced ? 129 : 68);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 8, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(isBalanced ? 6 : 185, isBalanced ? 95 : 28, isBalanced ? 70 : 28);
  const auditText = isBalanced
    ? 'AUDIT VERIFICATION: PERFECTLY BALANCED (Total Assets = Total Liabilities + Total Equity)'
    : `AUDIT VERIFICATION: VARIANCE DETECTED of ${fmt(Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalLiabAndEquity))}`;
  doc.text(auditText, pageWidth / 2, currentY + 5.2, { align: 'center' });

  currentY += 13;

  // 3. Side-by-Side Tables: Assets on Left, Liabilities & Equity on Right
  const halfTableWidth = (pageWidth - margin * 2 - 6) / 2;

  // ASSETS ROWS (100% Real Operational Data)
  const assetRows = [
    [{ content: 'OPERATIONAL ASSETS', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [30, 41, 59] } }],
    ['Cash in Hand (Physical Register)', fmt(balanceSheetData.assets.cashInHand)],
    ['Bank & Digital Accounts (UPI / Cards)', fmt(balanceSheetData.assets.bankBalances)],
    ['Total Cash & Cash Equivalents', fmt(balanceSheetData.assets.totalCash)],
    ['Accounts Receivable (Customer Due)', fmt(balanceSheetData.assets.accountsReceivable)],
    ['Inventory - Finished Products', fmt(balanceSheetData.assets.productsInventory)],
    ['Inventory - Kitchen Raw Materials', fmt(balanceSheetData.assets.rawMaterialsInventory)],
    ['Total Inventory at Cost', fmt(balanceSheetData.assets.totalInventory)],
    [{ content: 'TOTAL ASSETS', styles: { fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [49, 46, 129] } }, { content: fmt(balanceSheetData.totalAssets), styles: { fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [49, 46, 129] } }]
  ];

  // LIABILITIES & EQUITY ROWS (100% Real Operational Data)
  const liabRows = [
    [{ content: 'CURRENT LIABILITIES', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [30, 41, 59] } }],
    ['Accounts Payable (Supplier Due)', fmt(balanceSheetData.liabilities.accountsPayable)],
    ['Salaries & Wages Payable', fmt(balanceSheetData.liabilities.salariesPayable || 0)],
    ['Taxes & GST Payable', fmt(balanceSheetData.liabilities.taxPayable)],
    [{ content: 'TOTAL LIABILITIES', styles: { fontStyle: 'bold', fillColor: [254, 226, 226], textColor: [153, 27, 27] } }, { content: fmt(balanceSheetData.totalLiabilities), styles: { fontStyle: 'bold', fillColor: [254, 226, 226], textColor: [153, 27, 27] } }],
    [{ content: 'PARTNERS EQUITY & PROFIT SHARE', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [30, 41, 59] } }],
    ...(balanceSheetData.equity.partnersEquity || []).map(p => [`${p.name} Balance (${p.percentage}%)`, fmt(p.balance)]),
    ['Retained Earnings (Accumulated Net Profit)', fmt(balanceSheetData.equity.retainedEarnings)],
    ["Total Net Business Equity", fmt(balanceSheetData.equity.totalEquity)],
    [{ content: 'TOTAL LIABILITIES & EQUITY', styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] } }, { content: fmt(balanceSheetData.totalLiabAndEquity), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] } }]
  ];

  // Render Assets Table
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin },
    tableWidth: halfTableWidth,
    head: [['ASSETS (Breakdown)', 'AMOUNT']],
    body: assetRows,
    theme: 'plain',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: halfTableWidth * 0.65 },
      1: { cellWidth: halfTableWidth * 0.35, halign: 'right', fontStyle: 'bold' }
    }
  });

  // Render Liabilities Table
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin + halfTableWidth + 6 },
    tableWidth: halfTableWidth,
    head: [['LIABILITIES & EQUITY', 'AMOUNT']],
    body: liabRows,
    theme: 'plain',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: halfTableWidth * 0.65 },
      1: { cellWidth: halfTableWidth * 0.35, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalY = doc.lastAutoTable.finalY + 8;

  // 4. Financial Health Key Ratios
  const ratios = [
    { name: 'Working Capital', val: fmt(balanceSheetData.assets.totalCurrentAssets - balanceSheetData.liabilities.totalCurrentLiabilities) },
    { name: 'Current Ratio', val: balanceSheetData.liabilities.totalCurrentLiabilities > 0 ? (balanceSheetData.assets.totalCurrentAssets / balanceSheetData.liabilities.totalCurrentLiabilities).toFixed(2) + 'x' : 'N/A' },
    { name: 'Quick Ratio', val: balanceSheetData.liabilities.totalCurrentLiabilities > 0 ? ((balanceSheetData.assets.totalCash + balanceSheetData.assets.accountsReceivable) / balanceSheetData.liabilities.totalCurrentLiabilities).toFixed(2) + 'x' : 'N/A' },
    { name: 'Debt-to-Equity', val: balanceSheetData.totalEquity > 0 ? (balanceSheetData.totalLiabilities / balanceSheetData.totalEquity).toFixed(2) + 'x' : 'N/A' }
  ];

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, finalY, pageWidth - margin * 2, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('FINANCIAL RATIOS & SOLVENCY:', margin + 4, finalY + 8.5);

  const ratioSpacing = (pageWidth - margin * 2 - 60) / 4;
  ratios.forEach((r, i) => {
    const rx = margin + 58 + i * ratioSpacing;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`${r.name}:`, rx, finalY + 8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(r.val, rx + doc.getTextWidth(`${r.name}: `) + 1, finalY + 8.5);
  });

  // Footer & Signature Area
  const footY = pageHeight - 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('This is an official computer-generated financial document. Certified accurate by Boxy Cloud Kitchen Accounting.', margin, footY);
  doc.text(`Page 1 of 1`, pageWidth - margin, footY, { align: 'right' });

  // Save / Trigger Download
  const fileName = `${(settings.companyName || 'Boxy').replace(/\s+/g, '_')}_Balance_Sheet_${asOfDate}.pdf`;
  doc.save(fileName);
  return fileName;
};

/**
 * =========================================================================
 * 2. CUSTOMER LEDGER STATEMENT PDF EXPORT
 * =========================================================================
 */
export const exportCustomerLedgerPDF = ({
  customer,
  dateRange = {},
  transactions = [],
  summary = {},
  settings = {},
  currency = '₹'
}) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;

  const companyName = (settings.companyName || 'BOXY CLOUD KITCHEN').toUpperCase();
  const tagline = settings.tagline || 'Cloud Kitchen Operations & POS';
  const fmt = (v) => formatCurrencyForPdf(v, currency);

  // Header Banner
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(companyName, margin + 8, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(tagline, margin + 8, currentY + 16);

  // Document Badge on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('CUSTOMER STATEMENT', pageWidth - margin - 8, currentY + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Period: ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}`, pageWidth - margin - 8, currentY + 17, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin - 8, currentY + 22, { align: 'right' });

  currentY += 34;

  // Customer Profile Information Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(customer.shopName ? `${customer.shopName} (${customer.name})` : customer.name, margin + 6, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Phone: ${customer.phone || 'N/A'}  |  Category: ${customer.customerType || 'Retail'}  |  Address: ${customer.address || 'N/A'}`, margin + 6, currentY + 13);
  doc.text(`Credit Limit: ${fmt(customer.creditLimit || 0)}  |  Available Credit: ${fmt(Math.max(0, (customer.creditLimit || 0) - (summary.closingBalance || 0)))}`, margin + 6, currentY + 18);

  currentY += 27;

  // Summary Metrics Banner
  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cards = [
    { label: 'OPENING BALANCE', value: fmt(summary.openingBalance), bg: [248, 250, 252], border: [203, 213, 225], text: [71, 85, 105] },
    { label: 'TOTAL INVOICED (+)', value: fmt(summary.totalInvoiced), bg: [238, 242, 255], border: [99, 102, 241], text: [49, 46, 129] },
    { label: 'TOTAL PAID (-)', value: fmt(summary.totalPaid), bg: [240, 253, 244], border: [34, 197, 94], text: [22, 101, 52] },
    { label: 'CLOSING BALANCE DUE', value: fmt(summary.closingBalance), bg: [254, 242, 242], border: [239, 68, 68], text: [153, 27, 27] }
  ];

  cards.forEach((card, idx) => {
    const x = margin + idx * (cardWidth + 3);
    doc.setFillColor(...card.bg);
    doc.setDrawColor(...card.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, currentY, cardWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + cardWidth / 2, currentY + 5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...card.text);
    doc.text(card.value, x + cardWidth / 2, currentY + 11.5, { align: 'center' });
  });

  currentY += 21;

  // Table Data
  const tableRows = [];

  // Opening Balance Row
  tableRows.push([
    formatDate(dateRange.startDate),
    '—',
    'OPENING',
    'Balance brought forward from previous periods',
    '—',
    '—',
    '—',
    fmt(summary.openingBalance)
  ]);

  // Transactions
  transactions.forEach(t => {
    tableRows.push([
      formatDate(t.date),
      t.reference || t.id || '—',
      t.type || 'Transaction',
      t.notes || t.description || 'Order sale / settlement',
      t.paymentMethod || '—',
      t.debit > 0 ? fmt(t.debit) : '—',
      t.credit > 0 ? fmt(t.credit) : '—',
      fmt(t.runningBalance)
    ]);
  });

  // Closing Balance Row
  tableRows.push([
    { content: formatDate(dateRange.endDate), styles: { fontStyle: 'bold' } },
    { content: 'TOTALS', styles: { fontStyle: 'bold' } },
    { content: 'CLOSING', styles: { fontStyle: 'bold' } },
    { content: `Statement Closing Position for ${customer.name}`, styles: { fontStyle: 'bold' } },
    { content: '—', styles: { fontStyle: 'bold' } },
    { content: fmt(summary.totalInvoiced), styles: { fontStyle: 'bold', textColor: [49, 46, 129] } },
    { content: fmt(summary.totalPaid), styles: { fontStyle: 'bold', textColor: [22, 101, 52] } },
    { content: fmt(summary.closingBalance), styles: { fontStyle: 'bold', textColor: [153, 27, 27] } }
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['DATE', 'REF #', 'TYPE', 'DESCRIPTION / ITEMS', 'METHOD', 'DEBIT (+)', 'CREDIT (-)', 'BALANCE']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 22, fontStyle: 'bold' },
      2: { cellWidth: 18 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 18 },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Footer & Signature Area
  const footY = pageHeight - 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Computer-generated Customer Statement. For questions or disputes, contact accounts at ' + (settings.companyName || 'Boxy'), margin, footY);
  doc.text(`Authorized Signatory`, pageWidth - margin - 35, footY);

  const cleanName = (customer.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Customer_Ledger_${cleanName}_${dateRange.startDate}_to_${dateRange.endDate}.pdf`;
  doc.save(fileName);
  return fileName;
};

/**
 * =========================================================================
 * 3. SUPPLIER LEDGER STATEMENT PDF EXPORT
 * =========================================================================
 */
export const exportSupplierLedgerPDF = ({
  supplier,
  dateRange = {},
  transactions = [],
  summary = {},
  settings = {},
  currency = '₹'
}) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;

  const companyName = (settings.companyName || 'BOXY CLOUD KITCHEN').toUpperCase();
  const tagline = settings.tagline || 'Cloud Kitchen Operations & POS';
  const fmt = (v) => formatCurrencyForPdf(v, currency);

  // Header Banner
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(companyName, margin + 8, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(tagline, margin + 8, currentY + 16);

  // Document Badge on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('SUPPLIER STATEMENT', pageWidth - margin - 8, currentY + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Period: ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}`, pageWidth - margin - 8, currentY + 17, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin - 8, currentY + 22, { align: 'right' });

  currentY += 34;

  // Supplier Profile Information Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(supplier.name, margin + 6, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Phone: ${supplier.phone || 'N/A'}  |  Address: ${supplier.address || 'N/A'}`, margin + 6, currentY + 13);

  currentY += 25;

  // Summary Metrics Banner
  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cards = [
    { label: 'OPENING PAYABLE', value: fmt(summary.openingBalance), bg: [248, 250, 252], border: [203, 213, 225], text: [71, 85, 105] },
    { label: 'TOTAL PURCHASES (+)', value: fmt(summary.totalPurchases), bg: [254, 242, 242], border: [239, 68, 68], text: [153, 27, 27] },
    { label: 'TOTAL SETTLED (-)', value: fmt(summary.totalPaid), bg: [240, 253, 244], border: [34, 197, 94], text: [22, 101, 52] },
    { label: 'NET PAYABLE DUE', value: fmt(summary.closingBalance), bg: [255, 251, 235], border: [245, 158, 11], text: [180, 83, 9] }
  ];

  cards.forEach((card, idx) => {
    const x = margin + idx * (cardWidth + 3);
    doc.setFillColor(...card.bg);
    doc.setDrawColor(...card.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, currentY, cardWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + cardWidth / 2, currentY + 5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...card.text);
    doc.text(card.value, x + cardWidth / 2, currentY + 11.5, { align: 'center' });
  });

  currentY += 21;

  // Table Data
  const tableRows = [];

  // Opening Balance Row
  tableRows.push([
    formatDate(dateRange.startDate),
    '—',
    'OPENING',
    'Payable balance brought forward from previous periods',
    '—',
    '—',
    '—',
    fmt(summary.openingBalance)
  ]);

  // Transactions
  transactions.forEach(t => {
    tableRows.push([
      formatDate(t.date),
      t.reference || t.id || '—',
      t.type || 'Bill / Settlement',
      t.notes || t.description || 'Restocking inventory purchase',
      t.paymentMethod || '—',
      t.purchaseAmount > 0 ? fmt(t.purchaseAmount) : '—',
      t.paidAmount > 0 ? fmt(t.paidAmount) : '—',
      fmt(t.runningBalance)
    ]);
  });

  // Closing Balance Row
  tableRows.push([
    { content: formatDate(dateRange.endDate), styles: { fontStyle: 'bold' } },
    { content: 'TOTALS', styles: { fontStyle: 'bold' } },
    { content: 'CLOSING', styles: { fontStyle: 'bold' } },
    { content: `Statement Closing Position for ${supplier.name}`, styles: { fontStyle: 'bold' } },
    { content: '—', styles: { fontStyle: 'bold' } },
    { content: fmt(summary.totalPurchases), styles: { fontStyle: 'bold', textColor: [153, 27, 27] } },
    { content: fmt(summary.totalPaid), styles: { fontStyle: 'bold', textColor: [22, 101, 52] } },
    { content: fmt(summary.closingBalance), styles: { fontStyle: 'bold', textColor: [180, 83, 9] } }
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['DATE', 'PO / REF #', 'TYPE', 'DESCRIPTION / ITEMS', 'METHOD', 'PURCHASE (+)', 'PAYMENT (-)', 'PAYABLE BAL']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 22, fontStyle: 'bold' },
      2: { cellWidth: 18 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 18 },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Footer & Signature Area
  const footY = pageHeight - 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Computer-generated Vendor Statement. Prepared by Boxy Cloud Kitchen Accounts Payable.', margin, footY);
  doc.text(`Authorized Signatory`, pageWidth - margin - 35, footY);

  const cleanName = (supplier.name || 'Supplier').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Supplier_Ledger_${cleanName}_${dateRange.startDate}_to_${dateRange.endDate}.pdf`;
  doc.save(fileName);
  return fileName;
};

/**
 * =========================================================================
 * 4. ORDERS & INVOICES PDF EXPORT (Replaces Orders CSV)
 * =========================================================================
 */
export const exportOrdersPDF = ({
  sales = [],
  filterPayment = 'ALL',
  settings = {},
  currency = '₹'
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;

  const companyName = (settings.companyName || 'BOXY CLOUD KITCHEN').toUpperCase();
  const tagline = settings.tagline || 'Cloud Kitchen Operations & POS';
  const fmt = (v) => formatCurrencyForPdf(v, currency);

  // Header Banner
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(companyName, margin + 8, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(tagline, margin + 8, currentY + 16);

  // Document Badge on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('ORDERS & SALES REPORT', pageWidth - margin - 8, currentY + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Payment Filter: ${filterPayment}`, pageWidth - margin - 8, currentY + 17, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin - 8, currentY + 22, { align: 'right' });

  currentY += 34;

  // Summary Metrics
  const totalRev = sales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
  const totalDiscount = sales.reduce((sum, s) => sum + Number(s.discount || 0), 0);
  const totalTax = sales.reduce((sum, s) => sum + Number(s.taxAmount || 0), 0);
  const avgOrder = sales.length > 0 ? totalRev / sales.length : 0;

  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cards = [
    { label: 'TOTAL INVOICES', value: `${sales.length} Bills`, bg: [238, 242, 255], border: [99, 102, 241], text: [49, 46, 129] },
    { label: 'GROSS REVENUE', value: fmt(totalRev), bg: [240, 253, 244], border: [34, 197, 94], text: [22, 101, 52] },
    { label: 'TOTAL DISCOUNTS', value: fmt(totalDiscount), bg: [254, 242, 242], border: [239, 68, 68], text: [153, 27, 27] },
    { label: 'AVG ORDER VALUE', value: fmt(avgOrder), bg: [255, 251, 235], border: [245, 158, 11], text: [180, 83, 9] }
  ];

  cards.forEach((card, idx) => {
    const x = margin + idx * (cardWidth + 3);
    doc.setFillColor(...card.bg);
    doc.setDrawColor(...card.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, currentY, cardWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + cardWidth / 2, currentY + 5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...card.text);
    doc.text(card.value, x + cardWidth / 2, currentY + 11.5, { align: 'center' });
  });

  currentY += 21;

  // Table Data
  const tableRows = sales.map(s => {
    const itemsText = s.itemsSummary || (s.items || []).map(i => `${i.quantity}x ${i.productName || i.name}`).join(', ') || 'POS Order';
    const dateStr = s.date ? new Date(s.date).toLocaleDateString('en-GB') : '—';
    return [
      s.invoiceNumber || '—',
      dateStr,
      s.customerName || 'Walk-in Customer',
      itemsText,
      s.paymentMethod || 'Cash',
      fmt(s.totalAmount),
      s.status || 'Completed'
    ];
  });

  // Totals Row
  tableRows.push([
    { content: 'TOTALS', styles: { fontStyle: 'bold' } },
    { content: `${sales.length} Orders`, styles: { fontStyle: 'bold' } },
    { content: '—', styles: { fontStyle: 'bold' } },
    { content: `Taxes Collected: ${fmt(totalTax)}`, styles: { fontStyle: 'bold' } },
    { content: '—', styles: { fontStyle: 'bold' } },
    { content: fmt(totalRev), styles: { fontStyle: 'bold', textColor: [22, 101, 52] } },
    { content: '—', styles: { fontStyle: 'bold' } }
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['INVOICE #', 'DATE', 'CUSTOMER', 'ITEMS ORDERED', 'METHOD', 'TOTAL', 'STATUS']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold' },
      1: { cellWidth: 20 },
      2: { cellWidth: 28 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 20 },
      5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 20, halign: 'center' }
    },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  const footY = pageHeight - 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Official Boxy Cloud Kitchen Orders Report. All sales recorded and synced.', margin, footY);
  doc.text(`Page 1 of 1`, pageWidth - margin, footY, { align: 'right' });

  const fileName = `Boxy_Orders_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
  return fileName;
};

/**
 * =========================================================================
 * 5. TRANSACTIONS CASH FLOW PDF EXPORT (Replaces Transactions CSV)
 * =========================================================================
 */
export const exportTransactionsPDF = ({
  transactions = [],
  filterFlow = 'ALL',
  filterType = 'ALL',
  settings = {},
  currency = '₹'
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;

  const companyName = (settings.companyName || 'BOXY CLOUD KITCHEN').toUpperCase();
  const tagline = settings.tagline || 'Cash Flow & General Ledger Systems';
  const fmt = (v) => formatCurrencyForPdf(v, currency);

  // Header Banner
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(companyName, margin + 8, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(tagline, margin + 8, currentY + 16);

  // Document Badge on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('CASH FLOW LEDGER', pageWidth - margin - 8, currentY + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Flow: ${filterFlow}  |  Type: ${filterType}`, pageWidth - margin - 8, currentY + 17, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin - 8, currentY + 22, { align: 'right' });

  currentY += 34;

  const totalIn = transactions.filter(t => t.flow === 'IN').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalOut = transactions.filter(t => t.flow === 'OUT').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const netFlow = totalIn - totalOut;

  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cards = [
    { label: 'TOTAL ENTRIES', value: `${transactions.length} Records`, bg: [248, 250, 252], border: [203, 213, 225], text: [71, 85, 105] },
    { label: 'TOTAL INFLOW (+)', value: fmt(totalIn), bg: [240, 253, 244], border: [34, 197, 94], text: [22, 101, 52] },
    { label: 'TOTAL OUTFLOW (-)', value: fmt(totalOut), bg: [254, 242, 242], border: [239, 68, 68], text: [153, 27, 27] },
    { label: 'NET CASH FLOW', value: fmt(netFlow), bg: [238, 242, 255], border: [99, 102, 241], text: [49, 46, 129] }
  ];

  cards.forEach((card, idx) => {
    const x = margin + idx * (cardWidth + 3);
    doc.setFillColor(...card.bg);
    doc.setDrawColor(...card.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, currentY, cardWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + cardWidth / 2, currentY + 5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...card.text);
    doc.text(card.value, x + cardWidth / 2, currentY + 11.5, { align: 'center' });
  });

  currentY += 21;

  // Table Data
  const tableRows = transactions.map(t => {
    const dateStr = t.date ? new Date(t.date).toLocaleDateString('en-GB') : '—';
    const isIncome = t.flow === 'IN';
    return [
      t.reference || t.id || '—',
      dateStr,
      t.flow || 'IN',
      t.type || 'Transaction',
      t.partyName || 'Counter',
      t.notes || t.category || '—',
      t.paymentMethod || 'Cash',
      `${isIncome ? '+' : '-'}${fmt(t.amount)}`
    ];
  });

  tableRows.push([
    { content: 'TOTALS', styles: { fontStyle: 'bold' } },
    { content: `${transactions.length} Txns`, styles: { fontStyle: 'bold' } },
    { content: 'NET', styles: { fontStyle: 'bold' } },
    { content: `In: ${fmt(totalIn)} | Out: ${fmt(totalOut)}`, colSpan: 3, styles: { fontStyle: 'bold' } },
    { content: '—', styles: { fontStyle: 'bold' } },
    { content: fmt(netFlow), styles: { fontStyle: 'bold', textColor: netFlow >= 0 ? [22, 101, 52] : [153, 27, 27] } }
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['REF #', 'DATE', 'FLOW', 'TYPE', 'PARTY / ACCOUNT', 'DESCRIPTION / NOTE', 'METHOD', 'AMOUNT']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold' },
      1: { cellWidth: 18 },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 20 },
      4: { cellWidth: 26 },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 18 },
      7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  const footY = pageHeight - 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Certified Cash Flow Ledger Report • Real-time Boxy Accounting Synchronization', margin, footY);
  doc.text(`Page 1 of 1`, pageWidth - margin, footY, { align: 'right' });

  const fileName = `Boxy_Transactions_Ledger_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
  return fileName;
};

/**
 * =========================================================================
 * 6. DAILY BUSINESS REPORT PDF EXPORT (Replaces Daily CSV)
 * =========================================================================
 */
export const exportDailyReportPDF = ({
  dailyData = {},
  selectedDay,
  settings = {},
  currency = '₹'
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;

  const companyName = (settings.companyName || 'BOXY CLOUD KITCHEN').toUpperCase();
  const tagline = settings.tagline || 'Daily Business Operations & Performance';
  const fmt = (v) => formatCurrencyForPdf(v, currency);

  // Header Banner
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(companyName, margin + 8, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(tagline, margin + 8, currentY + 16);

  // Document Badge on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('DAILY BUSINESS STATEMENT', pageWidth - margin - 8, currentY + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Date: ${formatDate(selectedDay)}`, pageWidth - margin - 8, currentY + 17, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin - 8, currentY + 22, { align: 'right' });

  currentY += 34;

  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cards = [
    { label: "TODAY'S SALES", value: fmt(dailyData.totalSales), bg: [240, 253, 244], border: [34, 197, 94], text: [22, 101, 52] },
    { label: 'ORDERS COUNT', value: `${dailyData.ordersCount || 0} Bills`, bg: [238, 242, 255], border: [99, 102, 241], text: [49, 46, 129] },
    { label: 'PURCHASES & EXPENSES', value: fmt((dailyData.totalPurchases || 0) + (dailyData.totalExpenses || 0)), bg: [254, 242, 242], border: [239, 68, 68], text: [153, 27, 27] },
    { label: 'NET DAILY PROFIT', value: fmt(dailyData.netProfit), bg: [255, 251, 235], border: [245, 158, 11], text: [180, 83, 9] }
  ];

  cards.forEach((card, idx) => {
    const x = margin + idx * (cardWidth + 3);
    doc.setFillColor(...card.bg);
    doc.setDrawColor(...card.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, currentY, cardWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + cardWidth / 2, currentY + 5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...card.text);
    doc.text(card.value, x + cardWidth / 2, currentY + 11.5, { align: 'center' });
  });

  currentY += 21;

  // Day Sales Table
  const tableRows = (dailyData.daySales || []).map(s => [
    s.invoiceNumber || '—',
    s.date ? new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
    s.customerName || 'Walk-in Customer',
    s.itemsSummary || (s.items || []).map(i => `${i.quantity}x ${i.productName || i.name}`).join(', ') || 'Sale Order',
    s.paymentMethod || 'Cash',
    fmt(s.subtotal || s.totalAmount),
    fmt(s.taxAmount || 0),
    fmt(s.totalAmount)
  ]);

  tableRows.push([
    { content: 'TOTALS', styles: { fontStyle: 'bold' } },
    { content: `${dailyData.ordersCount || 0} Bills`, styles: { fontStyle: 'bold' } },
    { content: '—', styles: { fontStyle: 'bold' } },
    { content: `Net Profit: ${fmt(dailyData.netProfit)}`, styles: { fontStyle: 'bold' } },
    { content: '—', styles: { fontStyle: 'bold' } },
    { content: '—', styles: { fontStyle: 'bold' } },
    { content: fmt(dailyData.totalTax || 0), styles: { fontStyle: 'bold' } },
    { content: fmt(dailyData.totalSales), styles: { fontStyle: 'bold', textColor: [22, 101, 52] } }
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['INVOICE #', 'TIME', 'CUSTOMER', 'ITEMS SUMMARY', 'METHOD', 'SUBTOTAL', 'TAX (GST)', 'TOTAL AMOUNT']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold' },
      1: { cellWidth: 16 },
      2: { cellWidth: 26 },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 18 },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 18, halign: 'right' },
      7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  const footY = pageHeight - 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Boxy Cloud Kitchen Daily Business Closing Statement.', margin, footY);
  doc.text(`Page 1 of 1`, pageWidth - margin, footY, { align: 'right' });

  const fileName = `Boxy_Daily_Report_${selectedDay}.pdf`;
  doc.save(fileName);
  return fileName;
};

/**
 * =========================================================================
 * 7. MONTHLY PERFORMANCE REPORT PDF EXPORT (Replaces Monthly CSV)
 * =========================================================================
 */
export const exportMonthlyReportPDF = ({
  monthlyData = {},
  selectedMonth,
  settings = {},
  currency = '₹'
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;

  const companyName = (settings.companyName || 'BOXY CLOUD KITCHEN').toUpperCase();
  const tagline = settings.tagline || 'Monthly Financial P&L and Operational Trends';
  const fmt = (v) => formatCurrencyForPdf(v, currency);

  // Header Banner
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(companyName, margin + 8, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(tagline, margin + 8, currentY + 16);

  // Document Badge on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('MONTHLY STATEMENT & P&L', pageWidth - margin - 8, currentY + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Month: ${selectedMonth}`, pageWidth - margin - 8, currentY + 17, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin - 8, currentY + 22, { align: 'right' });

  currentY += 34;

  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cards = [
    { label: 'MONTHLY SALES', value: fmt(monthlyData.totalSales), bg: [240, 253, 244], border: [34, 197, 94], text: [22, 101, 52] },
    { label: 'PURCHASES / COGS', value: fmt(monthlyData.totalPurchases), bg: [255, 251, 235], border: [245, 158, 11], text: [180, 83, 9] },
    { label: 'OPERATING OVERHEAD', value: fmt(monthlyData.totalExpenses), bg: [254, 242, 242], border: [239, 68, 68], text: [153, 27, 27] },
    { label: 'NET MONTHLY PROFIT', value: fmt(monthlyData.netProfit), bg: [238, 242, 255], border: [99, 102, 241], text: [49, 46, 129] }
  ];

  cards.forEach((card, idx) => {
    const x = margin + idx * (cardWidth + 3);
    doc.setFillColor(...card.bg);
    doc.setDrawColor(...card.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, currentY, cardWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + cardWidth / 2, currentY + 5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...card.text);
    doc.text(card.value, x + cardWidth / 2, currentY + 11.5, { align: 'center' });
  });

  currentY += 21;

  // Daily Ledger Rows
  const tableRows = (monthlyData.dayLedger || []).map(d => [
    d.dateStr,
    `Day ${d.dayNum}`,
    `${d.ordersCount} orders`,
    fmt(d.sales),
    fmt(d.purchases),
    fmt(d.expenses),
    fmt(d.netProfit)
  ]);

  tableRows.push([
    { content: 'MONTH TOTALS', colSpan: 2, styles: { fontStyle: 'bold' } },
    { content: `${monthlyData.ordersCount || 0} Orders`, styles: { fontStyle: 'bold' } },
    { content: fmt(monthlyData.totalSales), styles: { fontStyle: 'bold', textColor: [22, 101, 52] } },
    { content: fmt(monthlyData.totalPurchases), styles: { fontStyle: 'bold', textColor: [180, 83, 9] } },
    { content: fmt(monthlyData.totalExpenses), styles: { fontStyle: 'bold', textColor: [153, 27, 27] } },
    { content: fmt(monthlyData.netProfit), styles: { fontStyle: 'bold', textColor: [49, 46, 129] } }
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['DATE', 'DAY', 'ACTIVITY', 'SALES REVENUE', 'RESTOCK PURCHASES', 'OVERHEAD', 'NET PROFIT']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 20 },
      2: { cellWidth: 24 },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  const footY = pageHeight - 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Boxy Cloud Kitchen Monthly Statement & Performance Analytics.', margin, footY);
  doc.text(`Page 1 of 1`, pageWidth - margin, footY, { align: 'right' });

  const fileName = `Boxy_Monthly_Report_${selectedMonth}.pdf`;
  doc.save(fileName);
  return fileName;
};

/**
 * =========================================================================
 * 8. CUSTOM RANGE REPORT PDF EXPORT (Replaces Custom CSV)
 * =========================================================================
 */
export const exportCustomReportPDF = ({
  customData = {},
  customCategoryFilter = 'all',
  customStartDate,
  customEndDate,
  settings = {},
  currency = '₹'
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;

  const companyName = (settings.companyName || 'BOXY CLOUD KITCHEN').toUpperCase();
  const tagline = settings.tagline || 'Customized Financial Reporting & Performance';
  const fmt = (v) => formatCurrencyForPdf(v, currency);

  // Header Banner
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(companyName, margin + 8, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(tagline, margin + 8, currentY + 16);

  // Document Badge on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('CUSTOM FINANCIAL STATEMENT', pageWidth - margin - 8, currentY + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Period: ${formatDate(customStartDate)} to ${formatDate(customEndDate)}`, pageWidth - margin - 8, currentY + 17, { align: 'right' });
  doc.text(`Filter: ${customCategoryFilter.toUpperCase()}`, pageWidth - margin - 8, currentY + 22, { align: 'right' });

  currentY += 34;

  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cards = [
    { label: 'TOTAL SALES REVENUE', value: fmt(customData.totalSales), bg: [240, 253, 244], border: [34, 197, 94], text: [22, 101, 52] },
    { label: 'PURCHASES / RESTOCK', value: fmt(customData.totalPurchases), bg: [255, 251, 235], border: [245, 158, 11], text: [180, 83, 9] },
    { label: 'OPERATING OVERHEAD', value: fmt(customData.totalExpenses), bg: [254, 242, 242], border: [239, 68, 68], text: [153, 27, 27] },
    { label: 'NET PERIOD PROFIT', value: fmt(customData.netProfit), bg: [238, 242, 255], border: [99, 102, 241], text: [49, 46, 129] }
  ];

  cards.forEach((card, idx) => {
    const x = margin + idx * (cardWidth + 3);
    doc.setFillColor(...card.bg);
    doc.setDrawColor(...card.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, currentY, cardWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + cardWidth / 2, currentY + 5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...card.text);
    doc.text(card.value, x + cardWidth / 2, currentY + 11.5, { align: 'center' });
  });

  currentY += 21;

  let headers = ['INVOICE #', 'DATE', 'CUSTOMER / DETAIL', 'METHOD', 'SUBTOTAL', 'TAX', 'TOTAL'];
  let tableRows = [];

  if (customCategoryFilter === 'purchases') {
    headers = ['PURCHASE #', 'DATE', 'SUPPLIER', 'STATUS', 'METHOD', 'PAID', 'TOTAL'];
    tableRows = (customData.filteredPurchases || []).map(p => [
      p.materialNumber || p.id || '—',
      formatDate(p.date),
      p.supplierName || 'Vendor',
      p.paymentStatus || 'Completed',
      p.paymentMethod || 'Bank Transfer',
      fmt(p.amountPaid || p.totalAmount),
      fmt(p.totalAmount)
    ]);
  } else if (customCategoryFilter === 'expenses') {
    headers = ['EXPENSE ID', 'DATE', 'CATEGORY', 'DESCRIPTION', 'METHOD', 'STATUS', 'AMOUNT'];
    tableRows = (customData.filteredExpenses || []).map(e => [
      e.id || '—',
      formatDate(e.date),
      e.category || 'Overhead',
      e.description || 'Operating expense',
      e.paymentMethod || 'Cash',
      'Paid',
      fmt(e.amount)
    ]);
  } else {
    tableRows = (customData.filteredSales || []).map(s => [
      s.invoiceNumber || '—',
      formatDate(s.date),
      s.customerName || 'Walk-in Customer',
      s.paymentMethod || 'Cash',
      fmt(s.subtotal || s.totalAmount),
      fmt(s.taxAmount || 0),
      fmt(s.totalAmount)
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [headers],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold' },
      1: { cellWidth: 20 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 22 },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
    },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  const footY = pageHeight - 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Boxy Cloud Kitchen Custom Statement of Financial Performance.', margin, footY);
  doc.text(`Page 1 of 1`, pageWidth - margin, footY, { align: 'right' });

  const fileName = `Boxy_Custom_Report_${customStartDate || 'start'}_to_${customEndDate || 'end'}.pdf`;
  doc.save(fileName);
  return fileName;
};

/**
 * =========================================================================
 * 9. KITCHEN ANALYTICS & INVENTORY PDF EXPORT (Replaces Kitchen CSV)
 * =========================================================================
 */
export const exportKitchenReportPDF = ({
  kitchenData = {},
  kitchenSubTab = 'stock',
  settings = {},
  currency = '₹'
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = 16;

  const companyName = (settings.companyName || 'BOXY CLOUD KITCHEN').toUpperCase();
  const tagline = settings.tagline || 'Kitchen Inventory & Recipe Costing Intelligence';
  const fmt = (v) => formatCurrencyForPdf(v, currency);

  // Header Banner
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(companyName, margin + 8, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(tagline, margin + 8, currentY + 16);

  // Document Badge on right
  const subTitle = kitchenSubTab === 'stock'
    ? 'RAW MATERIALS & STOCK VALUATION'
    : kitchenSubTab === 'consumption'
    ? 'INVOICE BOM INGREDIENT CONSUMPTION'
    : 'RECIPE COSTING & GROSS MARGINS';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(subTitle, pageWidth - margin - 8, currentY + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin - 8, currentY + 18, { align: 'right' });

  currentY += 34;

  let headers = [];
  let tableRows = [];

  if (kitchenSubTab === 'stock') {
    headers = ['ID', 'MATERIAL NAME', 'CATEGORY', 'CURRENT STOCK', 'UNIT', 'COST/UNIT', 'VALUATION', 'STATUS'];
    tableRows = (kitchenData.stockList || []).map(r => [
      r.id || '—',
      r.name,
      r.category || 'General',
      String(r.currentStock || 0),
      r.unit || 'unit',
      fmt(r.costPrice || 0),
      fmt(r.valuation || 0),
      r.isLowStock ? 'LOW STOCK' : 'IN STOCK'
    ]);
  } else if (kitchenSubTab === 'consumption') {
    headers = ['INVOICE #', 'DATE', 'CUSTOMER', 'ITEMS ORDERED', 'INGREDIENTS CONSUMED', 'BOM COST'];
    tableRows = (kitchenData.invoiceConsumptionList || []).map(inv => [
      inv.invoiceNumber,
      formatDate(inv.date),
      inv.customerName || 'Walk-in',
      inv.itemsSummary || 'Order',
      (inv.ingredients || []).map(i => `${i.quantity} ${i.unit} ${i.rawMaterialName}`).join(', '),
      fmt(inv.totalIngredientCost || 0)
    ]);
  } else {
    headers = ['CODE', 'PRODUCT NAME', 'SELLING PRICE', 'RECIPE COST', 'GROSS PROFIT', 'MARGIN %', 'STATUS'];
    tableRows = (kitchenData.recipeCostingList || []).map(r => [
      r.productCode || '—',
      r.productName,
      fmt(r.sellingPrice || 0),
      fmt(r.recipeCost || 0),
      fmt(r.grossProfit || 0),
      `${r.marginPct || 0}%`,
      r.hasRecipe ? 'Configured' : 'Missing BOM'
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [headers],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  const footY = pageHeight - 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Boxy Kitchen Intelligence & Recipe BOM Report.', margin, footY);
  doc.text(`Page 1 of 1`, pageWidth - margin, footY, { align: 'right' });

  const fileName = `Boxy_Kitchen_${kitchenSubTab}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
  return fileName;
};

/**
 * =========================================================================
 * 9. PARTNER FINANCIAL STATEMENT PDF EXPORT
 * =========================================================================
 */
export const exportPartnerStatementPDF = ({
  partner,
  financials = {},
  withdrawals = [],
  dateRange = {},
  settings = {},
  currency = '₹'
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const fmt = (val) => formatCurrencyForPdf(val, currency);

  // Top Accent Bar
  doc.setFillColor(16, 185, 129); // Emerald
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Header Box
  doc.setFillColor(15, 23, 42); // Pure deep dark
  doc.roundedRect(margin, 10, contentWidth, 32, 3, 3, 'F');

  // Brand Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(String(settings.companyName || 'BOXY CLOUD KITCHEN').toUpperCase(), margin + 8, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text('PARTNER PROFIT DISTRIBUTION & WITHDRAWAL STATEMENT', margin + 8, 29);
  doc.text(`Period: ${dateRange.startDate || 'Beginning'} to ${dateRange.endDate || 'Present'}`, margin + 8, 35);

  let currentY = 48;

  // Partner Isolated Profile Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(partner.name, margin + 6, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Phone: ${partner.phone || '—'}  |  Joined: ${formatDate(partner.joiningDate)}  |  Share: ${partner.profitShare}%`, margin + 6, currentY + 15);
  if (partner.isLabour) {
    doc.setTextColor(5, 150, 105);
    doc.text(`Active Dual Role: Business Partner + Active Worker (${partner.jobRole || 'Kitchen Staff'})`, margin + 6, currentY + 21);
  }

  currentY += 32;

  // 4 Financial Summary Metric Blocks
  const colW = (contentWidth - 6) / 4;
  const metrics = [
    { label: 'DISTRIBUTABLE PROFIT', val: fmt(financials.totalDistributableProfit || 0), color: [79, 70, 229] },
    { label: `PARTNER SHARE (${partner.profitShare}%)`, val: fmt(partner.allocatedProfit || 0), color: [16, 185, 129] },
    { label: 'TOTAL WITHDRAWALS', val: fmt(partner.totalWithdrawals || 0), color: [225, 29, 72] },
    { label: 'REMAINING BALANCE', val: fmt(partner.remainingBalance || 0), color: (partner.remainingBalance >= 0 ? [5, 150, 105] : [225, 29, 72]) }
  ];

  metrics.forEach((m, idx) => {
    const x = margin + idx * (colW + 2);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, colW, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(m.label, x + 4, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...m.color);
    doc.text(m.val, x + 4, currentY + 13);
  });

  currentY += 24;

  // Withdrawals History Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Profit Withdrawal Transactions', margin, currentY);
  currentY += 4;

  const withdrawalRows = (withdrawals || []).map(w => [
    formatDate(w.date),
    w.id || '—',
    w.paymentMethod || 'Cash',
    w.notes || 'Partner profit withdrawal',
    fmt(w.amount || 0)
  ]);

  if (withdrawalRows.length === 0) {
    withdrawalRows.push(['—', '—', '—', 'No withdrawals recorded for this partner in the selected period.', fmt(0)]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Date', 'Reference ID', 'Payment Method', 'Notes / Description', 'Amount Paid']],
    body: withdrawalRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 4: { halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] } }
  });

  // Footer
  const footY = pageHeight - 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on ${new Date().toLocaleString('en-GB')}  •  Boxy ERP Partner Portal`, margin, footY);
  doc.text('Page 1 of 1', pageWidth - margin, footY, { align: 'right' });

  const fileName = `Partner_Statement_${partner.name}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
  return fileName;
};

/**
 * =========================================================================
 * 10. LABOUR SALARY STATEMENT PDF EXPORT
 * =========================================================================
 */
export const exportLabourStatementPDF = ({
  labourer,
  payments = [],
  attendance = [],
  dateRange = {},
  settings = {},
  currency = '₹'
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const fmt = (val) => formatCurrencyForPdf(val, currency);

  // Top Accent Bar
  doc.setFillColor(245, 158, 11); // Amber
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Header Box
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, 10, contentWidth, 32, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(String(settings.companyName || 'BOXY CLOUD KITCHEN').toUpperCase(), margin + 8, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text('LABOUR SALARY & ATTENDANCE STATEMENT', margin + 8, 29);
  doc.text(`Period: ${dateRange.startDate || 'Beginning'} to ${dateRange.endDate || 'Present'}`, margin + 8, 35);

  let currentY = 48;

  // Worker Profile Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(labourer.name, margin + 6, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Role: ${labourer.jobRole || 'Worker'}  |  Phone: ${labourer.phone || '—'}  |  Type: ${labourer.salaryType || 'Monthly'} (${fmt(labourer.baseSalary || labourer.salaryAmount)})`, margin + 6, currentY + 16);

  currentY += 30;

  // Financial Metrics
  const colW = (contentWidth - 4) / 3;
  const metrics = [
    { label: 'TOTAL EARNED SALARY', val: fmt(labourer.earnedSalary || labourer.salaryAmount || 0), color: [79, 70, 229] },
    { label: 'TOTAL SALARY PAID', val: fmt(labourer.totalPaid || 0), color: [16, 185, 129] },
    { label: 'PENDING SALARY DUE', val: fmt(labourer.pendingSalary || 0), color: (labourer.pendingSalary > 0 ? [225, 29, 72] : [5, 150, 105]) }
  ];

  metrics.forEach((m, idx) => {
    const x = margin + idx * (colW + 2);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, colW, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(m.label, x + 4, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...m.color);
    doc.text(m.val, x + 4, currentY + 13);
  });

  currentY += 24;

  // Payments Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Salary Payment History', margin, currentY);
  currentY += 4;

  const paymentRows = (payments || []).map(p => [
    formatDate(p.date),
    p.month || '—',
    p.paymentMethod || 'Cash',
    p.notes || 'Salary payment',
    fmt(p.amount || 0)
  ]);

  if (paymentRows.length === 0) {
    paymentRows.push(['—', '—', '—', 'No salary payments recorded in this period.', fmt(0)]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Payment Date', 'Salary Month', 'Payment Method', 'Notes', 'Amount Paid']],
    body: paymentRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 4: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] } }
  });

  const footY = pageHeight - 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on ${new Date().toLocaleString('en-GB')}  •  Boxy ERP Labour Portal`, margin, footY);
  doc.text('Page 1 of 1', pageWidth - margin, footY, { align: 'right' });

  const fileName = `Salary_Statement_${labourer.name}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
  return fileName;
};

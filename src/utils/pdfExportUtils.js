import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isNative, shareFileNative } from './nativeBridge';

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
 * SHARED LAYOUT HELPERS
 * =========================================================================
 */

const generatedDate = () => `Generated: ${new Date().toLocaleDateString('en-GB')}`;
const todayIso = () => new Date().toISOString().split('T')[0];

/** Creates an A4 portrait document plus the layout context shared by all helpers. */
const createPdfDoc = (currency) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  return {
    doc,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    margin: 14,
    fmt: (v) => formatCurrencyForPdf(v, currency)
  };
};

/**
 * Dark slate header banner: company name + tagline on the left, a title and
 * subtitle lines right-aligned. `offsets` are relative to the banner top.
 */
const drawHeaderBanner = (ctx, y, {
  settings,
  defaultTagline,
  title,
  lines = [],
  titleSize = 11,
  offsets = { name: 10, tagline: 16, title: 10, lines: [17, 22] },
  withLogo = false
}) => {
  const { doc, pageWidth, margin } = ctx;
  const companyName = (settings.companyName || 'BOXY CLOUD KITCHEN').toUpperCase();
  const tagline = settings.tagline || defaultTagline;

  doc.setFillColor(30, 41, 59); // Slate-800
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, 'F');

  let textStartX = margin + 8;
  const logo = settings?.logo;
  if (withLogo && logo && typeof logo === 'string' && logo.startsWith('data:image')) {
    try {
      const imgType = logo.includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(logo, imgType, margin + 4, y + 4, 20, 20);
      textStartX = margin + 28;
    } catch (err) {
      console.warn('PDF Logo render skipped:', err);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(companyName, textStartX, y + offsets.name);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text(tagline, textStartX, y + offsets.tagline);

  // Document badge on right
  const rightX = pageWidth - margin - 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titleSize);
  doc.setTextColor(255, 255, 255);
  doc.text(title, rightX, y + offsets.title, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  lines.forEach((line, i) => {
    doc.text(line, rightX, y + offsets.lines[i], { align: 'right' });
  });

  return y + 34;
};

/** Row of 4 tinted summary cards (label + value). Returns the Y below the row. */
const drawSummaryCards = (ctx, y, cards, { height = 16, labelY = 5, valueY = 11.5, valueSize = 9 } = {}) => {
  const { doc, pageWidth, margin } = ctx;
  const cardWidth = (pageWidth - margin * 2 - 9) / 4;

  cards.forEach((card, idx) => {
    const x = margin + idx * (cardWidth + 3);
    doc.setFillColor(...card.bg);
    doc.setDrawColor(...card.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardWidth, height, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + cardWidth / 2, y + labelY, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(valueSize);
    doc.setTextColor(...card.text);
    doc.text(card.value, x + cardWidth / 2, y + valueY, { align: 'center' });
  });

  return y + height + 5;
};

/** Light grey profile box with a bold title and detail lines underneath. */
const drawProfileBox = (ctx, y, height, title, lines, {
  titleSize = 9.5,
  titleY = 7,
  textColor = [71, 85, 105],
  lineYs = [13, 18]
} = {}) => {
  const { doc, pageWidth, margin } = ctx;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - margin * 2, height, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titleSize);
  doc.setTextColor(15, 23, 42);
  doc.text(title, margin + 6, y + titleY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textColor);
  lines.forEach((line, i) => doc.text(line, margin + 6, y + lineYs[i]));
};

/** Base table styling shared by the report tables (fresh objects per call). */
const baseTableStyles = (lineWidth = 0.15) => ({
  styles: {
    fontSize: 7.5,
    cellPadding: 2.2,
    textColor: [30, 41, 59],
    lineColor: [226, 232, 240],
    lineWidth
  },
  headStyles: {
    fillColor: [30, 41, 59],
    textColor: [255, 255, 255],
    fontStyle: 'bold',
    halign: 'left'
  }
});

/** Full-width striped grid table used by most reports. */
const drawGridTable = (ctx, startY, head, body, columnStyles) => {
  autoTable(ctx.doc, {
    startY,
    margin: { left: ctx.margin, right: ctx.margin },
    head,
    body,
    theme: 'grid',
    ...baseTableStyles(),
    ...(columnStyles && { columnStyles }),
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });
};

/** Footer line at the page bottom with either a page label or a signatory label. */
const drawFooter = (ctx, text, { offset = 14, fontSize = 7, signatory = false } = {}) => {
  const { doc, pageWidth, pageHeight, margin } = ctx;
  const footY = pageHeight - offset;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(148, 163, 184);
  doc.text(text, margin, footY);
  if (signatory) {
    doc.text('Authorized Signatory', pageWidth - margin - 35, footY);
  } else {
    doc.text('Page 1 of 1', pageWidth - margin, footY, { align: 'right' });
  }
};

/** Bold "TOTALS"-style row cell. */
const boldCell = (content, textColor) => ({
  content,
  styles: textColor ? { fontStyle: 'bold', textColor } : { fontStyle: 'bold' }
});

// Shared card colour palettes
const PALETTE = {
  slate: { bg: [248, 250, 252], border: [203, 213, 225], text: [71, 85, 105] },
  indigo: { bg: [238, 242, 255], border: [99, 102, 241], text: [49, 46, 129] },
  green: { bg: [240, 253, 244], border: [34, 197, 94], text: [22, 101, 52] },
  red: { bg: [254, 242, 242], border: [239, 68, 68], text: [153, 27, 27] },
  amber: { bg: [255, 251, 235], border: [245, 158, 11], text: [180, 83, 9] }
};
const card = (label, value, palette) => ({ label, value, ...PALETTE[palette] });

/* ---- Partner / Labour statement helpers (deep-dark "portal" layout) ---- */

const drawStatementHeader = (ctx, { accentColor, title, settings, dateRange }) => {
  const { doc, pageWidth, margin } = ctx;
  const contentWidth = pageWidth - margin * 2;

  // Top Accent Bar
  doc.setFillColor(...accentColor);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Header Box
  doc.setFillColor(15, 23, 42); // Pure deep dark
  doc.roundedRect(margin, 10, contentWidth, 32, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(String(settings.companyName || 'BOXY CLOUD KITCHEN').toUpperCase(), margin + 8, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(title, margin + 8, 29);
  doc.text(`Period: ${dateRange.startDate || 'Beginning'} to ${dateRange.endDate || 'Present'}`, margin + 8, 35);

  return 48;
};

const drawMetricBlocks = (ctx, y, metrics, colW) => {
  const { doc, margin } = ctx;
  metrics.forEach((m, idx) => {
    const x = margin + idx * (colW + 2);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, colW, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(m.label, x + 4, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...m.color);
    doc.text(m.val, x + 4, y + 13);
  });
  return y + 24;
};

/** Section title followed by a compact history table. */
const drawStatementTable = (ctx, y, sectionTitle, head, body, amountColor) => {
  const { doc, margin } = ctx;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(sectionTitle, margin, y);

  autoTable(doc, {
    startY: y + 4,
    margin: { left: margin, right: margin },
    head,
    body,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 4: { halign: 'right', fontStyle: 'bold', textColor: amountColor } }
  });
};

const drawPortalFooter = (ctx, portalName) => {
  drawFooter(ctx, `Generated on ${new Date().toLocaleString('en-GB')}  •  Boxy ERP ${portalName}`, { offset: 12, fontSize: 7.5 });
};

const saveDoc = (doc, fileName) => {
  if (isNative()) {
    shareFileNative(doc.output('blob'), fileName).catch(err => console.error('PDF export failed:', err));
  } else {
    doc.save(fileName);
  }
  return fileName;
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
  const ctx = createPdfDoc(currency);
  const { doc, pageWidth, margin, fmt } = ctx;

  // 1. Header Banner (with optional logo)
  let currentY = drawHeaderBanner(ctx, 16, {
    settings,
    defaultTagline: 'Cloud Kitchen Operations & Financial Intelligence',
    title: 'BALANCE SHEET',
    lines: [
      `As of: ${formatDate(asOfDate)}`,
      `Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    ],
    offsets: { name: 11, tagline: 18, title: 11, lines: [18, 23] },
    withLogo: true
  });

  // 2. Executive Financial Summary Cards
  currentY = drawSummaryCards(ctx, currentY, [
    card('TOTAL ASSETS', fmt(balanceSheetData.totalAssets), 'indigo'),
    card('TOTAL LIABILITIES', fmt(balanceSheetData.totalLiabilities), 'red'),
    card('TOTAL EQUITY', fmt(balanceSheetData.totalEquity), 'green'),
    { label: 'LIABILITIES + EQUITY', value: fmt(balanceSheetData.totalLiabAndEquity), bg: [248, 250, 252], border: [148, 163, 184], text: [15, 23, 42] }
  ], { height: 18, labelY: 5.5, valueY: 13, valueSize: 9.5 });

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
  const sectionRow = (label) => [{ content: label, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [30, 41, 59] } }];
  const totalRow = (label, value, fillColor, textColor) => [
    { content: label, styles: { fontStyle: 'bold', fillColor, textColor } },
    { content: value, styles: { fontStyle: 'bold', fillColor, textColor } }
  ];

  const assetRows = [
    sectionRow('OPERATIONAL ASSETS'),
    ['Cash in Hand (Physical Register)', fmt(balanceSheetData.assets.cashInHand)],
    ['Bank & Digital Accounts (UPI / Cards)', fmt(balanceSheetData.assets.bankBalances)],
    ['Total Cash & Cash Equivalents', fmt(balanceSheetData.assets.totalCash)],
    ['Accounts Receivable (Customer Due)', fmt(balanceSheetData.assets.accountsReceivable)],
    ['Inventory - Finished Products', fmt(balanceSheetData.assets.productsInventory)],
    ['Inventory - Kitchen Raw Materials', fmt(balanceSheetData.assets.rawMaterialsInventory)],
    ['Total Inventory at Cost', fmt(balanceSheetData.assets.totalInventory)],
    totalRow('TOTAL ASSETS', fmt(balanceSheetData.totalAssets), [224, 231, 255], [49, 46, 129])
  ];

  const liabRows = [
    sectionRow('CURRENT LIABILITIES'),
    ['Accounts Payable (Supplier Due)', fmt(balanceSheetData.liabilities.accountsPayable)],
    ['Salaries & Wages Payable', fmt(balanceSheetData.liabilities.salariesPayable || 0)],
    ['Taxes & GST Payable', fmt(balanceSheetData.liabilities.taxPayable)],
    totalRow('TOTAL LIABILITIES', fmt(balanceSheetData.totalLiabilities), [254, 226, 226], [153, 27, 27]),
    sectionRow('PARTNERS EQUITY & PROFIT SHARE'),
    ...(balanceSheetData.equity.partnersEquity || []).map(p => [`${p.name} Balance (${p.percentage}%)`, fmt(p.balance)]),
    ['Retained Earnings (Accumulated Net Profit)', fmt(balanceSheetData.equity.retainedEarnings)],
    ['Total Net Business Equity', fmt(balanceSheetData.equity.totalEquity)],
    totalRow('TOTAL LIABILITIES & EQUITY', fmt(balanceSheetData.totalLiabAndEquity), [241, 245, 249], [15, 23, 42])
  ];

  const drawHalfTable = (left, headLabel, body) => autoTable(doc, {
    startY: currentY,
    margin: { left },
    tableWidth: halfTableWidth,
    head: [[headLabel, 'AMOUNT']],
    body,
    theme: 'plain',
    ...baseTableStyles(0.2),
    columnStyles: {
      0: { cellWidth: halfTableWidth * 0.65 },
      1: { cellWidth: halfTableWidth * 0.35, halign: 'right', fontStyle: 'bold' }
    }
  });

  drawHalfTable(margin, 'ASSETS (Breakdown)', assetRows);
  drawHalfTable(margin + halfTableWidth + 6, 'LIABILITIES & EQUITY', liabRows);

  const finalY = doc.lastAutoTable.finalY + 8;

  // 4. Financial Health Key Ratios
  const { assets, liabilities } = balanceSheetData;
  const ratios = [
    { name: 'Working Capital', val: fmt(assets.totalCurrentAssets - liabilities.totalCurrentLiabilities) },
    { name: 'Current Ratio', val: liabilities.totalCurrentLiabilities > 0 ? (assets.totalCurrentAssets / liabilities.totalCurrentLiabilities).toFixed(2) + 'x' : 'N/A' },
    { name: 'Quick Ratio', val: liabilities.totalCurrentLiabilities > 0 ? ((assets.totalCash + assets.accountsReceivable) / liabilities.totalCurrentLiabilities).toFixed(2) + 'x' : 'N/A' },
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

  drawFooter(ctx, 'This is an official computer-generated financial document. Certified accurate by Boxy Cloud Kitchen Accounting.', { offset: 18 });

  return saveDoc(doc, `${(settings.companyName || 'Boxy').replace(/\s+/g, '_')}_Balance_Sheet_${asOfDate}.pdf`);
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
  const ctx = createPdfDoc(currency);
  const { fmt } = ctx;

  let currentY = drawHeaderBanner(ctx, 16, {
    settings,
    defaultTagline: 'Cloud Kitchen Operations & POS',
    title: 'CUSTOMER STATEMENT',
    lines: [`Period: ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}`, generatedDate()]
  });

  // Customer Profile Information Box
  drawProfileBox(ctx, currentY, 22, customer.shopName ? `${customer.shopName} (${customer.name})` : customer.name, [
    `Phone: ${customer.phone || 'N/A'}  |  Category: ${customer.customerType || 'Retail'}  |  Address: ${customer.address || 'N/A'}`,
    `Credit Limit: ${fmt(customer.creditLimit || 0)}  |  Available Credit: ${fmt(Math.max(0, (customer.creditLimit || 0) - (summary.closingBalance || 0)))}`
  ]);
  currentY += 27;

  currentY = drawSummaryCards(ctx, currentY, [
    card('OPENING BALANCE', fmt(summary.openingBalance), 'slate'),
    card('TOTAL INVOICED (+)', fmt(summary.totalInvoiced), 'indigo'),
    card('TOTAL PAID (-)', fmt(summary.totalPaid), 'green'),
    card('CLOSING BALANCE DUE', fmt(summary.closingBalance), 'red')
  ]);

  const tableRows = [
    [formatDate(dateRange.startDate), '—', 'OPENING', 'Balance brought forward from previous periods', '—', '—', '—', fmt(summary.openingBalance)],
    ...transactions.map(t => [
      formatDate(t.date),
      t.reference || t.id || '—',
      t.type || 'Transaction',
      t.notes || t.description || 'Order sale / settlement',
      t.paymentMethod || '—',
      t.debit > 0 ? fmt(t.debit) : '—',
      t.credit > 0 ? fmt(t.credit) : '—',
      fmt(t.runningBalance)
    ]),
    [
      boldCell(formatDate(dateRange.endDate)),
      boldCell('TOTALS'),
      boldCell('CLOSING'),
      boldCell(`Statement Closing Position for ${customer.name}`),
      boldCell('—'),
      boldCell(fmt(summary.totalInvoiced), [49, 46, 129]),
      boldCell(fmt(summary.totalPaid), [22, 101, 52]),
      boldCell(fmt(summary.closingBalance), [153, 27, 27])
    ]
  ];

  drawGridTable(ctx, currentY, [['DATE', 'REF #', 'TYPE', 'DESCRIPTION / ITEMS', 'METHOD', 'DEBIT (+)', 'CREDIT (-)', 'BALANCE']], tableRows, {
    0: { cellWidth: 20 },
    1: { cellWidth: 22, fontStyle: 'bold' },
    2: { cellWidth: 18 },
    3: { cellWidth: 'auto' },
    4: { cellWidth: 18 },
    5: { cellWidth: 22, halign: 'right' },
    6: { cellWidth: 22, halign: 'right' },
    7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
  });

  drawFooter(ctx, 'Computer-generated Customer Statement. For questions or disputes, contact accounts at ' + (settings.companyName || 'Boxy'), { offset: 16, signatory: true });

  const cleanName = (customer.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
  return saveDoc(ctx.doc, `Customer_Ledger_${cleanName}_${dateRange.startDate}_to_${dateRange.endDate}.pdf`);
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
  const ctx = createPdfDoc(currency);
  const { fmt } = ctx;

  let currentY = drawHeaderBanner(ctx, 16, {
    settings,
    defaultTagline: 'Cloud Kitchen Operations & POS',
    title: 'SUPPLIER STATEMENT',
    lines: [`Period: ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}`, generatedDate()]
  });

  // Supplier Profile Information Box
  drawProfileBox(ctx, currentY, 20, supplier.name, [
    `Phone: ${supplier.phone || 'N/A'}  |  Address: ${supplier.address || 'N/A'}`
  ]);
  currentY += 25;

  currentY = drawSummaryCards(ctx, currentY, [
    card('OPENING PAYABLE', fmt(summary.openingBalance), 'slate'),
    card('TOTAL PURCHASES (+)', fmt(summary.totalPurchases), 'red'),
    card('TOTAL SETTLED (-)', fmt(summary.totalPaid), 'green'),
    card('NET PAYABLE DUE', fmt(summary.closingBalance), 'amber')
  ]);

  const tableRows = [
    [formatDate(dateRange.startDate), '—', 'OPENING', 'Payable balance brought forward from previous periods', '—', '—', '—', fmt(summary.openingBalance)],
    ...transactions.map(t => [
      formatDate(t.date),
      t.reference || t.id || '—',
      t.type || 'Bill / Settlement',
      t.notes || t.description || 'Restocking inventory purchase',
      t.paymentMethod || '—',
      t.purchaseAmount > 0 ? fmt(t.purchaseAmount) : '—',
      t.paidAmount > 0 ? fmt(t.paidAmount) : '—',
      fmt(t.runningBalance)
    ]),
    [
      boldCell(formatDate(dateRange.endDate)),
      boldCell('TOTALS'),
      boldCell('CLOSING'),
      boldCell(`Statement Closing Position for ${supplier.name}`),
      boldCell('—'),
      boldCell(fmt(summary.totalPurchases), [153, 27, 27]),
      boldCell(fmt(summary.totalPaid), [22, 101, 52]),
      boldCell(fmt(summary.closingBalance), [180, 83, 9])
    ]
  ];

  drawGridTable(ctx, currentY, [['DATE', 'PO / REF #', 'TYPE', 'DESCRIPTION / ITEMS', 'METHOD', 'PURCHASE (+)', 'PAYMENT (-)', 'PAYABLE BAL']], tableRows, {
    0: { cellWidth: 20 },
    1: { cellWidth: 22, fontStyle: 'bold' },
    2: { cellWidth: 18 },
    3: { cellWidth: 'auto' },
    4: { cellWidth: 18 },
    5: { cellWidth: 22, halign: 'right' },
    6: { cellWidth: 22, halign: 'right' },
    7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
  });

  drawFooter(ctx, 'Computer-generated Vendor Statement. Prepared by Boxy Cloud Kitchen Accounts Payable.', { offset: 16, signatory: true });

  const cleanName = (supplier.name || 'Supplier').replace(/[^a-zA-Z0-9]/g, '_');
  return saveDoc(ctx.doc, `Supplier_Ledger_${cleanName}_${dateRange.startDate}_to_${dateRange.endDate}.pdf`);
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
  const ctx = createPdfDoc(currency);
  const { fmt } = ctx;

  let currentY = drawHeaderBanner(ctx, 16, {
    settings,
    defaultTagline: 'Cloud Kitchen Operations & POS',
    title: 'ORDERS & SALES REPORT',
    lines: [`Payment Filter: ${filterPayment}`, generatedDate()]
  });

  const totalRev = sales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
  const totalDiscount = sales.reduce((sum, s) => sum + Number(s.discount || 0), 0);
  const totalTax = sales.reduce((sum, s) => sum + Number(s.taxAmount || 0), 0);
  const avgOrder = sales.length > 0 ? totalRev / sales.length : 0;

  currentY = drawSummaryCards(ctx, currentY, [
    card('TOTAL INVOICES', `${sales.length} Bills`, 'indigo'),
    card('GROSS REVENUE', fmt(totalRev), 'green'),
    card('TOTAL DISCOUNTS', fmt(totalDiscount), 'red'),
    card('AVG ORDER VALUE', fmt(avgOrder), 'amber')
  ]);

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

  tableRows.push([
    boldCell('TOTALS'),
    boldCell(`${sales.length} Orders`),
    boldCell('—'),
    boldCell(`Taxes Collected: ${fmt(totalTax)}`),
    boldCell('—'),
    boldCell(fmt(totalRev), [22, 101, 52]),
    boldCell('—')
  ]);

  drawGridTable(ctx, currentY, [['INVOICE #', 'DATE', 'CUSTOMER', 'ITEMS ORDERED', 'METHOD', 'TOTAL', 'STATUS']], tableRows, {
    0: { cellWidth: 22, fontStyle: 'bold' },
    1: { cellWidth: 20 },
    2: { cellWidth: 28 },
    3: { cellWidth: 'auto' },
    4: { cellWidth: 20 },
    5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
    6: { cellWidth: 20, halign: 'center' }
  });

  drawFooter(ctx, 'Official Boxy Cloud Kitchen Orders Report. All sales recorded and synced.');

  return saveDoc(ctx.doc, `Boxy_Orders_Report_${todayIso()}.pdf`);
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
  const ctx = createPdfDoc(currency);
  const { fmt } = ctx;

  let currentY = drawHeaderBanner(ctx, 16, {
    settings,
    defaultTagline: 'Cash Flow & General Ledger Systems',
    title: 'CASH FLOW LEDGER',
    lines: [`Flow: ${filterFlow}  |  Type: ${filterType}`, generatedDate()]
  });

  const totalIn = transactions.filter(t => t.flow === 'IN').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalOut = transactions.filter(t => t.flow === 'OUT').reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const netFlow = totalIn - totalOut;

  currentY = drawSummaryCards(ctx, currentY, [
    card('TOTAL ENTRIES', `${transactions.length} Records`, 'slate'),
    card('TOTAL INFLOW (+)', fmt(totalIn), 'green'),
    card('TOTAL OUTFLOW (-)', fmt(totalOut), 'red'),
    card('NET CASH FLOW', fmt(netFlow), 'indigo')
  ]);

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
    boldCell('TOTALS'),
    boldCell(`${transactions.length} Txns`),
    boldCell('NET'),
    { content: `In: ${fmt(totalIn)} | Out: ${fmt(totalOut)}`, colSpan: 3, styles: { fontStyle: 'bold' } },
    boldCell('—'),
    boldCell(fmt(netFlow), netFlow >= 0 ? [22, 101, 52] : [153, 27, 27])
  ]);

  drawGridTable(ctx, currentY, [['REF #', 'DATE', 'FLOW', 'TYPE', 'PARTY / ACCOUNT', 'DESCRIPTION / NOTE', 'METHOD', 'AMOUNT']], tableRows, {
    0: { cellWidth: 22, fontStyle: 'bold' },
    1: { cellWidth: 18 },
    2: { cellWidth: 14, halign: 'center' },
    3: { cellWidth: 20 },
    4: { cellWidth: 26 },
    5: { cellWidth: 'auto' },
    6: { cellWidth: 18 },
    7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
  });

  drawFooter(ctx, 'Certified Cash Flow Ledger Report • Real-time Boxy Accounting Synchronization');

  return saveDoc(ctx.doc, `Boxy_Transactions_Ledger_${todayIso()}.pdf`);
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
  const ctx = createPdfDoc(currency);
  const { fmt } = ctx;

  let currentY = drawHeaderBanner(ctx, 16, {
    settings,
    defaultTagline: 'Daily Business Operations & Performance',
    title: 'DAILY BUSINESS STATEMENT',
    lines: [`Date: ${formatDate(selectedDay)}`, generatedDate()]
  });

  currentY = drawSummaryCards(ctx, currentY, [
    card("TODAY'S SALES", fmt(dailyData.totalSales), 'green'),
    card('ORDERS COUNT', `${dailyData.ordersCount || 0} Bills`, 'indigo'),
    card('PURCHASES & EXPENSES', fmt((dailyData.totalPurchases || 0) + (dailyData.totalExpenses || 0)), 'red'),
    card('NET DAILY PROFIT', fmt(dailyData.netProfit), 'amber')
  ]);

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
    boldCell('TOTALS'),
    boldCell(`${dailyData.ordersCount || 0} Bills`),
    boldCell('—'),
    boldCell(`Net Profit: ${fmt(dailyData.netProfit)}`),
    boldCell('—'),
    boldCell('—'),
    boldCell(fmt(dailyData.totalTax || 0)),
    boldCell(fmt(dailyData.totalSales), [22, 101, 52])
  ]);

  drawGridTable(ctx, currentY, [['INVOICE #', 'TIME', 'CUSTOMER', 'ITEMS SUMMARY', 'METHOD', 'SUBTOTAL', 'TAX (GST)', 'TOTAL AMOUNT']], tableRows, {
    0: { cellWidth: 22, fontStyle: 'bold' },
    1: { cellWidth: 16 },
    2: { cellWidth: 26 },
    3: { cellWidth: 'auto' },
    4: { cellWidth: 18 },
    5: { cellWidth: 20, halign: 'right' },
    6: { cellWidth: 18, halign: 'right' },
    7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
  });

  drawFooter(ctx, 'Boxy Cloud Kitchen Daily Business Closing Statement.');

  return saveDoc(ctx.doc, `Boxy_Daily_Report_${selectedDay}.pdf`);
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
  const ctx = createPdfDoc(currency);
  const { fmt } = ctx;

  let currentY = drawHeaderBanner(ctx, 16, {
    settings,
    defaultTagline: 'Monthly Financial P&L and Operational Trends',
    title: 'MONTHLY STATEMENT & P&L',
    lines: [`Month: ${selectedMonth}`, generatedDate()]
  });

  currentY = drawSummaryCards(ctx, currentY, [
    card('MONTHLY SALES', fmt(monthlyData.totalSales), 'green'),
    card('PURCHASES / COGS', fmt(monthlyData.totalPurchases), 'amber'),
    card('OPERATING OVERHEAD', fmt(monthlyData.totalExpenses), 'red'),
    card('NET MONTHLY PROFIT', fmt(monthlyData.netProfit), 'indigo')
  ]);

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
    boldCell(`${monthlyData.ordersCount || 0} Orders`),
    boldCell(fmt(monthlyData.totalSales), [22, 101, 52]),
    boldCell(fmt(monthlyData.totalPurchases), [180, 83, 9]),
    boldCell(fmt(monthlyData.totalExpenses), [153, 27, 27]),
    boldCell(fmt(monthlyData.netProfit), [49, 46, 129])
  ]);

  drawGridTable(ctx, currentY, [['DATE', 'DAY', 'ACTIVITY', 'SALES REVENUE', 'RESTOCK PURCHASES', 'OVERHEAD', 'NET PROFIT']], tableRows, {
    0: { cellWidth: 26 },
    1: { cellWidth: 20 },
    2: { cellWidth: 24 },
    3: { cellWidth: 28, halign: 'right' },
    4: { cellWidth: 28, halign: 'right' },
    5: { cellWidth: 28, halign: 'right' },
    6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
  });

  drawFooter(ctx, 'Boxy Cloud Kitchen Monthly Statement & Performance Analytics.');

  return saveDoc(ctx.doc, `Boxy_Monthly_Report_${selectedMonth}.pdf`);
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
  const ctx = createPdfDoc(currency);
  const { fmt } = ctx;

  let currentY = drawHeaderBanner(ctx, 16, {
    settings,
    defaultTagline: 'Customized Financial Reporting & Performance',
    title: 'CUSTOM FINANCIAL STATEMENT',
    lines: [
      `Period: ${formatDate(customStartDate)} to ${formatDate(customEndDate)}`,
      `Filter: ${customCategoryFilter.toUpperCase()}`
    ]
  });

  currentY = drawSummaryCards(ctx, currentY, [
    card('TOTAL SALES REVENUE', fmt(customData.totalSales), 'green'),
    card('PURCHASES / RESTOCK', fmt(customData.totalPurchases), 'amber'),
    card('OPERATING OVERHEAD', fmt(customData.totalExpenses), 'red'),
    card('NET PERIOD PROFIT', fmt(customData.netProfit), 'indigo')
  ]);

  let headers = ['INVOICE #', 'DATE', 'CUSTOMER / DETAIL', 'METHOD', 'SUBTOTAL', 'TAX', 'TOTAL'];
  let tableRows;

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

  drawGridTable(ctx, currentY, [headers], tableRows, {
    0: { cellWidth: 24, fontStyle: 'bold' },
    1: { cellWidth: 20 },
    2: { cellWidth: 'auto' },
    3: { cellWidth: 22 },
    4: { cellWidth: 22, halign: 'right' },
    5: { cellWidth: 20, halign: 'right' },
    6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
  });

  drawFooter(ctx, 'Boxy Cloud Kitchen Custom Statement of Financial Performance.');

  return saveDoc(ctx.doc, `Boxy_Custom_Report_${customStartDate || 'start'}_to_${customEndDate || 'end'}.pdf`);
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
  const ctx = createPdfDoc(currency);
  const { fmt } = ctx;

  const subTitle = kitchenSubTab === 'stock'
    ? 'RAW MATERIALS & STOCK VALUATION'
    : kitchenSubTab === 'consumption'
    ? 'INVOICE BOM INGREDIENT CONSUMPTION'
    : 'RECIPE COSTING & GROSS MARGINS';

  const currentY = drawHeaderBanner(ctx, 16, {
    settings,
    defaultTagline: 'Kitchen Inventory & Recipe Costing Intelligence',
    title: subTitle,
    titleSize: 10,
    lines: [generatedDate()],
    offsets: { name: 10, tagline: 16, title: 10, lines: [18] }
  });

  let headers;
  let tableRows;

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

  drawGridTable(ctx, currentY, [headers], tableRows);

  drawFooter(ctx, 'Boxy Kitchen Intelligence & Recipe BOM Report.');

  return saveDoc(ctx.doc, `Boxy_Kitchen_${kitchenSubTab}_${todayIso()}.pdf`);
};

/**
 * =========================================================================
 * 10. PARTNER FINANCIAL STATEMENT PDF EXPORT
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
  const ctx = createPdfDoc(currency);
  const { doc, pageWidth, margin, fmt } = ctx;
  const contentWidth = pageWidth - margin * 2;

  let currentY = drawStatementHeader(ctx, {
    accentColor: [16, 185, 129], // Emerald
    title: 'PARTNER PROFIT DISTRIBUTION & WITHDRAWAL STATEMENT',
    settings,
    dateRange
  });

  // Partner Isolated Profile Card
  drawProfileBox(ctx, currentY, 26, partner.name, [
    `Phone: ${partner.phone || '—'}  |  Joined: ${formatDate(partner.joiningDate)}  |  Share: ${partner.profitShare}%`
  ], { titleSize: 11, titleY: 8, textColor: [100, 116, 139], lineYs: [15] });
  if (partner.isLabour) {
    doc.setTextColor(5, 150, 105);
    doc.text(`Active Dual Role: Business Partner + Active Worker (${partner.jobRole || 'Kitchen Staff'})`, margin + 6, currentY + 21);
  }
  currentY += 32;

  currentY = drawMetricBlocks(ctx, currentY, [
    { label: 'DISTRIBUTABLE PROFIT', val: fmt(financials.totalDistributableProfit || 0), color: [79, 70, 229] },
    { label: `PARTNER SHARE (${partner.profitShare}%)`, val: fmt(partner.allocatedProfit || 0), color: [16, 185, 129] },
    { label: 'TOTAL WITHDRAWALS', val: fmt(partner.totalWithdrawals || 0), color: [225, 29, 72] },
    { label: 'REMAINING BALANCE', val: fmt(partner.remainingBalance || 0), color: (partner.remainingBalance >= 0 ? [5, 150, 105] : [225, 29, 72]) }
  ], (contentWidth - 6) / 4);

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

  drawStatementTable(ctx, currentY, 'Profit Withdrawal Transactions',
    [['Date', 'Reference ID', 'Payment Method', 'Notes / Description', 'Amount Paid']], withdrawalRows, [225, 29, 72]);

  drawPortalFooter(ctx, 'Partner Portal');

  return saveDoc(doc, `Partner_Statement_${partner.name}_${todayIso()}.pdf`);
};

/**
 * =========================================================================
 * 11. LABOUR SALARY STATEMENT PDF EXPORT
 * =========================================================================
 */
export const exportLabourStatementPDF = ({
  labourer,
  payments = [],
  dateRange = {},
  settings = {},
  currency = '₹'
}) => {
  const ctx = createPdfDoc(currency);
  const { doc, pageWidth, margin, fmt } = ctx;
  const contentWidth = pageWidth - margin * 2;

  let currentY = drawStatementHeader(ctx, {
    accentColor: [245, 158, 11], // Amber
    title: 'LABOUR SALARY & ATTENDANCE STATEMENT',
    settings,
    dateRange
  });

  // Worker Profile Card
  drawProfileBox(ctx, currentY, 24, labourer.name, [
    `Role: ${labourer.jobRole || 'Worker'}  |  Phone: ${labourer.phone || '—'}  |  Type: ${labourer.salaryType || 'Monthly'} (${fmt(labourer.baseSalary || labourer.salaryAmount)})`
  ], { titleSize: 11, titleY: 8, textColor: [100, 116, 139], lineYs: [16] });
  currentY += 30;

  currentY = drawMetricBlocks(ctx, currentY, [
    { label: 'TOTAL EARNED SALARY', val: fmt(labourer.earnedSalary || labourer.salaryAmount || 0), color: [79, 70, 229] },
    { label: 'TOTAL SALARY PAID', val: fmt(labourer.totalPaid || 0), color: [16, 185, 129] },
    { label: 'PENDING SALARY DUE', val: fmt(labourer.pendingSalary || 0), color: (labourer.pendingSalary > 0 ? [225, 29, 72] : [5, 150, 105]) }
  ], (contentWidth - 4) / 3);

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

  drawStatementTable(ctx, currentY, 'Salary Payment History',
    [['Payment Date', 'Salary Month', 'Payment Method', 'Notes', 'Amount Paid']], paymentRows, [5, 150, 105]);

  drawPortalFooter(ctx, 'Labour Portal');

  return saveDoc(doc, `Salary_Statement_${labourer.name}_${todayIso()}.pdf`);
};

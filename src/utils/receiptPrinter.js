/**
 * Boxy Cloud Kitchen — Receipt Printing & WhatsApp Invoice Formatter
 * 
 * Provides crisp thermal receipt printing (80mm / A4) with zero DOM pollution,
 * clean Save-As-PDF capability, and formatted digital invoices for WhatsApp.
 */

export const printOrderReceipt = (order, settings = {}) => {
  if (!order) return;
  const companyName = settings.companyName || 'BOXY CLOUD KITCHEN';
  const tagline = settings.tagline || 'Cloud Kitchen POS & ERP';
  const logo = settings.logo || '/logo.jpg';
  const currency = settings.currencySymbol || '₹';
  const footer = settings.invoiceFooter || 'Thank you for choosing Boxy Cloud Kitchen!';
  const fmt = (val) => `${currency} ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const items = Array.isArray(order.items) && order.items.length > 0
    ? order.items
    : (order.itemsSummary ? String(order.itemsSummary).split(',').map(s => {
        const match = s.trim().match(/^(\d+)x?\s*(.+)$/i);
        return {
          productName: match ? match[2] : s.trim(),
          quantity: match ? Number(match[1]) : 1,
          unitPrice: 0,
          total: 0
        };
      }) : []);

  const itemsHtml = items.map(item => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unitPrice || item.price || 0);
    const amount = Number(item.subtotal || (qty * price) || 0);
    return `
      <tr>
        <td style="padding: 4px 0; font-weight: 600;">${item.productName || item.name}</td>
        <td style="padding: 4px 0; text-align: center; color: #475569;">${qty}</td>
        <td style="padding: 4px 0; text-align: right; color: #475569;">${price > 0 ? fmt(price) : '—'}</td>
        <td style="padding: 4px 0; text-align: right; font-weight: 700;">${amount > 0 ? fmt(amount) : '—'}</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank', 'width=450,height=750');
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt #${order.invoiceNumber} — ${companyName}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 4mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace, sans-serif;
            font-size: 11px;
            color: #0f172a;
            margin: 0;
            padding: 8px;
            max-width: 80mm;
            margin: 0 auto;
            background: #fff;
          }
          .header { text-align: center; border-bottom: 1px dashed #94a3b8; padding-bottom: 8px; margin-bottom: 8px; }
          .logo { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; margin-bottom: 4px; }
          .title { font-size: 14px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; margin: 0; }
          .sub { font-size: 9px; color: #64748b; margin: 2px 0 0 0; }
          .meta { font-size: 10px; color: #475569; margin-top: 6px; line-height: 1.4; text-align: left; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10px; }
          th { border-bottom: 1px dashed #94a3b8; padding-bottom: 4px; text-align: left; font-weight: 800; font-size: 10px; }
          .totals { border-top: 1px dashed #94a3b8; border-bottom: 1px dashed #94a3b8; padding: 6px 0; margin-top: 6px; font-size: 10px; }
          .total-row { display: flex; justify-content: space-between; margin: 2px 0; }
          .grand-total { display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; margin-top: 6px; padding-top: 4px; border-top: 1px solid #0f172a; }
          .footer { text-align: center; margin-top: 12px; font-size: 9px; color: #64748b; line-height: 1.3; }
          @media print {
            body { max-width: 100%; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${logo}" class="logo" alt="" onerror="this.style.display='none'" />
          <h1 class="title">${companyName}</h1>
          <p class="sub">${tagline}</p>
          <div class="meta">
            <div><strong>Invoice:</strong> #${order.invoiceNumber}</div>
            <div><strong>Date:</strong> ${new Date(order.date || Date.now()).toLocaleString('en-GB')}</div>
            <div><strong>Customer:</strong> ${order.customerName || 'Walk-in Customer'}</div>
            <div><strong>Payment:</strong> ${order.paymentMethod || 'Cash'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 44%;">Item</th>
              <th style="width: 14%; text-align: center;">Qty</th>
              <th style="width: 21%; text-align: right;">Price</th>
              <th style="width: 21%; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || `<tr><td colspan="4" style="text-align: center; padding: 6px;">${order.itemsSummary || 'Standard Order'}</td></tr>`}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>${fmt(order.subtotal || order.totalAmount)}</span>
          </div>
          ${Number(order.discount || 0) > 0 ? `
            <div class="total-row" style="color: #059669;">
              <span>Discount:</span>
              <span>-${fmt(order.discount)}</span>
            </div>
          ` : ''}
          ${Number(order.taxAmount || 0) > 0 ? `
            <div class="total-row">
              <span>GST / Tax (${order.taxRate || 0}%):</span>
              <span>+${fmt(order.taxAmount)}</span>
            </div>
          ` : ''}
          <div class="grand-total">
            <span>TOTAL PAID:</span>
            <span>${fmt(order.totalAmount)}</span>
          </div>
        </div>

        <div class="footer">
          <p>${footer}</p>
          <p>*** Have a wonderful day! ***</p>
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 350);
};

export const formatWhatsAppReceipt = (order, settings = {}) => {
  if (!order) return '#';
  const companyName = settings.companyName || 'BOXY CLOUD KITCHEN';
  const currency = settings.currencySymbol || '₹';
  const fmt = (val) => `${currency} ${Number(val || 0).toFixed(2)}`;

  let itemsText = '';
  if (Array.isArray(order.items) && order.items.length > 0) {
    itemsText = order.items.map(i => {
      const q = Number(i.quantity) || 1;
      const p = Number(i.unitPrice || i.price || 0);
      return `• ${q}x ${i.productName || i.name} (${fmt(q * p)})`;
    }).join('%0a');
  } else if (order.itemsSummary) {
    itemsText = `• ${order.itemsSummary}`;
  } else {
    itemsText = `• Order items - ${fmt(order.totalAmount)}`;
  }

  const text =
    `🧾 *${companyName.toUpperCase()} — DIGITAL INVOICE*%0a` +
    `--------------------------------%0a` +
    `*Invoice #:* ${order.invoiceNumber}%0a` +
    `*Date:* ${new Date(order.date || Date.now()).toLocaleDateString('en-GB')}, ${new Date(order.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}%0a` +
    `*Customer:* ${order.customerName || 'Walk-in Customer'}%0a` +
    `--------------------------------%0a` +
    `*ORDER SUMMARY:*%0a${itemsText}%0a` +
    `--------------------------------%0a` +
    `*Subtotal:* ${fmt(order.subtotal || order.totalAmount)}%0a` +
    (Number(order.discount || 0) > 0 ? `*Discount:* -${fmt(order.discount)}%0a` : '') +
    (Number(order.taxAmount || 0) > 0 ? `*GST / Tax (${order.taxRate || 0}%):* +${fmt(order.taxAmount)}%0a` : '') +
    `*TOTAL PAID (${order.paymentMethod || 'Cash'}):* *${fmt(order.totalAmount)}*%0a` +
    `--------------------------------%0a` +
    `${settings.invoiceFooter || 'Thank you for choosing Boxy Cloud Kitchen! Freshness & quality guaranteed.'}`;

  return `https://wa.me/?text=${text}`;
};


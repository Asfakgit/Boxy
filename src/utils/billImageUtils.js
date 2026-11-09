/**
 * Bill / Receipt Image Generation & WhatsApp Sharing Utilities
 * Pure HTML5 Canvas implementation - 100% immune to modern CSS / Tailwind OKLCH parser issues.
 */

/**
 * Clean phone number for WhatsApp wa.me links
 * Handles 10-digit Indian numbers by prepending 91 if no country code.
 */
export const cleanPhoneNumberForWhatsApp = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
};

/**
 * Format currency for bills
 */
const fmtVal = (val, symbol = '₹') => `${symbol} ${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Helper to safely load an image URL into an HTML Image object
 */
const loadReceiptImage = (src) => {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
};

/**
 * Draw a rounded rectangle on Canvas 2D context
 */
const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
};

/**
 * Render the full receipt on an HTML5 Canvas and output high-res PNG
 */
export const renderReceiptToCanvas = async (order, settings = {}) => {
  const currency = settings.currencySymbol || '₹';
  const companyName = (settings.companyName || 'BOXY CLOUD KITCHEN').toUpperCase();
  const tagline = settings.tagline || 'Speedy & Professional Cloud Kitchen POS';
  const footer = settings.invoiceFooter || 'Thank you for choosing Boxy Cloud Kitchen! Freshness & quality guaranteed.';
  const logoSrc = settings.logo || '/logo.jpg';

  // Normalize order items
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

  // Preload logo
  const logoImg = await loadReceiptImage(logoSrc);

  // Canvas Geometry
  const scale = 2; // High-DPI 2x Retina scale for crystal clarity
  const logicalWidth = 440;
  const paddingX = 26;
  const contentWidth = logicalWidth - paddingX * 2;

  // Calculate dynamic height based on content
  let estimatedHeight = 30; // Top padding
  if (logoImg) estimatedHeight += 58; // Logo
  estimatedHeight += 26; // Company name
  estimatedHeight += 18; // Tagline
  estimatedHeight += 95; // Meta info box
  estimatedHeight += 16; // Separator
  estimatedHeight += 24; // Table header
  estimatedHeight += Math.max(1, items.length) * 28; // Item rows
  estimatedHeight += 16; // Separator
  estimatedHeight += 22; // Subtotal
  if (Number(order.discount || 0) > 0) estimatedHeight += 22;
  if (Number(order.taxAmount || 0) > 0) estimatedHeight += 22;
  estimatedHeight += 38; // Total Paid box
  estimatedHeight += 18; // Separator
  estimatedHeight += 48; // Footer
  estimatedHeight += 30; // Bottom padding

  const canvas = document.createElement('canvas');
  canvas.width = logicalWidth * scale;
  canvas.height = estimatedHeight * scale;

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Background - Pure White
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, logicalWidth, estimatedHeight);

  // Outer border & soft card styling
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, 4, 4, logicalWidth - 8, estimatedHeight - 8, 16);
  ctx.stroke();

  let currentY = 24;

  // 1. Draw Logo (if available)
  if (logoImg) {
    const logoSize = 48;
    const logoX = (logicalWidth - logoSize) / 2;
    ctx.save();
    drawRoundedRect(ctx, logoX, currentY, logoSize, logoSize, 12);
    ctx.clip();
    ctx.drawImage(logoImg, logoX, currentY, logoSize, logoSize);
    ctx.restore();

    // Subtle logo ring
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, logoX, currentY, logoSize, logoSize, 12);
    ctx.stroke();

    currentY += logoSize + 10;
  }

  // 2. Company Name
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(companyName, logicalWidth / 2, currentY);
  currentY += 16;

  // 3. Tagline
  ctx.fillStyle = '#64748b';
  ctx.font = '500 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(tagline, logicalWidth / 2, currentY);
  currentY += 16;

  // 4. Meta Information Box
  const metaBoxHeight = 84;
  ctx.fillStyle = '#f8fafc';
  drawRoundedRect(ctx, paddingX, currentY, contentWidth, metaBoxHeight, 10);
  ctx.fill();
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, paddingX, currentY, contentWidth, metaBoxHeight, 10);
  ctx.stroke();

  const metaStartY = currentY + 16;
  const metaLineHeight = 17;
  const leftX = paddingX + 12;
  const rightX = logicalWidth - paddingX - 12;

  const orderDate = new Date(order.date || Date.now());
  const dateFormatted = `${orderDate.toLocaleDateString('en-GB')}, ${orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const metaRows = [
    { label: 'Invoice #:', value: `#${order.invoiceNumber}`, isBoldVal: true },
    { label: 'Date:', value: dateFormatted },
    { label: 'Client:', value: order.customerName || 'Walk-in Customer' },
    { label: 'Payment:', value: order.paymentMethod || 'Cash', valColor: '#4338ca', isBoldVal: true }
  ];

  metaRows.forEach((row, i) => {
    const yPos = metaStartY + i * metaLineHeight;
    ctx.textAlign = 'left';
    ctx.font = '600 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText(row.label, leftX, yPos);

    ctx.textAlign = 'right';
    ctx.font = `${row.isBoldVal ? 'bold' : '500'} 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace`;
    ctx.fillStyle = row.valColor || '#0f172a';
    ctx.fillText(row.value, rightX, yPos);
  });

  currentY += metaBoxHeight + 14;

  // 5. Dashed Separator
  const drawDashedLine = (y) => {
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.2;
    ctx.moveTo(paddingX, y);
    ctx.lineTo(logicalWidth - paddingX, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawDashedLine(currentY);
  currentY += 14;

  // 6. Items Table Header
  ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
  ctx.fillStyle = '#64748b';

  ctx.textAlign = 'left';
  ctx.fillText('ITEM', paddingX, currentY);

  ctx.textAlign = 'center';
  ctx.fillText('QTY x PRICE', logicalWidth * 0.58, currentY);

  ctx.textAlign = 'right';
  ctx.fillText('AMOUNT', logicalWidth - paddingX, currentY);

  currentY += 14;

  // 7. Item Rows
  if (items.length === 0) {
    ctx.textAlign = 'left';
    ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('Standard POS Sale', paddingX, currentY);
    ctx.textAlign = 'right';
    ctx.fillText(fmtVal(order.totalAmount, currency), logicalWidth - paddingX, currentY);
    currentY += 24;
  } else {
    items.forEach((item) => {
      const name = item.productName || item.name || 'Menu Item';
      const qty = Number(item.quantity || 1);
      const price = Number(item.unitPrice || item.price || (item.subtotal ? item.subtotal / qty : 0));
      const total = Number(item.subtotal || item.total || (qty * price));

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
      
      // Truncate item name if too long for the column
      let truncatedName = name;
      if (ctx.measureText(truncatedName).width > 160) {
        while (truncatedName.length > 3 && ctx.measureText(truncatedName + '...').width > 160) {
          truncatedName = truncatedName.slice(0, -1);
        }
        truncatedName += '...';
      }
      ctx.fillText(truncatedName, paddingX, currentY);

      // Qty x Price
      ctx.fillStyle = '#475569';
      ctx.font = '500 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${qty} × ${fmtVal(price, currency)}`, logicalWidth * 0.58, currentY);

      // Amount
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(fmtVal(total, currency), logicalWidth - paddingX, currentY);

      currentY += 24;
    });
  }

  currentY += 4;
  drawDashedLine(currentY);
  currentY += 16;

  // 8. Totals Breakdown
  const subtotal = Number(order.subtotal || order.totalAmount || 0);
  const discount = Number(order.discount || 0);
  const taxAmount = Number(order.taxAmount || 0);

  // Subtotal
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
  ctx.fillText('Subtotal:', paddingX, currentY);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
  ctx.fillText(fmtVal(subtotal, currency), logicalWidth - paddingX, currentY);
  currentY += 20;

  // Discount
  if (discount > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
    ctx.fillText('Discount:', paddingX, currentY);

    ctx.textAlign = 'right';
    ctx.fillText(`-${fmtVal(discount, currency)}`, logicalWidth - paddingX, currentY);
    currentY += 20;
  }

  // Tax
  if (taxAmount > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
    ctx.fillText(`Tax / GST (${order.taxRate || 0}%):`, paddingX, currentY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
    ctx.fillText(`+${fmtVal(taxAmount, currency)}`, logicalWidth - paddingX, currentY);
    currentY += 20;
  }

  currentY += 4;

  // Grand Total Box
  ctx.fillStyle = '#f8fafc';
  drawRoundedRect(ctx, paddingX, currentY, contentWidth, 36, 8);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, paddingX, currentY, contentWidth, 36, 8);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
  ctx.fillText(`Total Paid (${order.paymentMethod || 'Cash'}):`, paddingX + 12, currentY + 23);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#4338ca';
  ctx.font = '900 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
  ctx.fillText(fmtVal(order.totalAmount, currency), logicalWidth - paddingX - 12, currentY + 23);

  currentY += 48;
  drawDashedLine(currentY);
  currentY += 16;

  // 9. Receipt Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(footer, logicalWidth / 2, currentY);
  currentY += 15;

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 8.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Computer-generated tax receipt • Freshness & quality guaranteed', logicalWidth / 2, currentY);

  return canvas;
};

/**
 * Generate a PNG Blob & Data URL of the bill / receipt.
 * 100% Canvas rendered - no HTML2Canvas, no CSS parsing, no OKLCH errors.
 */
export const generateBillPNG = async (order, settings = {}) => {
  if (!order) throw new Error('Order data is required to generate bill PNG.');

  const canvas = await renderReceiptToCanvas(order, settings);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to create bill PNG image blob.'));
    }, 'image/png', 1.0);
  });

  const dataUrl = canvas.toDataURL('image/png');
  const filename = `Invoice_${order.invoiceNumber || Date.now()}.png`;

  return { blob, dataUrl, filename };
};

/**
 * Download the bill directly to the user's device as a PNG image.
 */
export const downloadBillPNG = async (order, settings = {}) => {
  const { dataUrl, filename } = await generateBillPNG(order, settings);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return filename;
};

/**
 * Share the bill as a PNG image via WhatsApp:
 * 1. Generates the crisp PNG image via pure HTML5 Canvas.
 * 2. On Mobile & Web Share API supported devices:
 *    Invokes navigator.share with the PNG file attached directly!
 * 3. On Desktop or unsupported environments:
 *    - Automatically downloads the PNG image to device.
 *    - Copies image to clipboard if supported (for instant Ctrl+V into WhatsApp).
 *    - Opens WhatsApp (wa.me) with pre-filled message and customer number.
 */
export const shareBillAsPNGViaWhatsApp = async (order, settings = {}) => {
  if (!order) return { success: false, message: 'No order data provided.' };

  const currency = settings.currencySymbol || '₹';
  const companyName = settings.companyName || 'Boxy Cloud Kitchen';
  const cleanPhone = cleanPhoneNumberForWhatsApp(order.customerPhone || order.phone);

  const caption =
    `🧾 *Invoice #${order.invoiceNumber}* from *${companyName}*\n` +
    `Total Amount: *${fmtVal(order.totalAmount, currency)}* (${order.paymentMethod || 'Paid'})\n` +
    `Date: ${new Date(order.date || Date.now()).toLocaleDateString('en-GB')}\n` +
    `Thank you for choosing ${companyName}!`;

  // 1. Generate the crisp PNG image using pure Canvas
  const { blob, filename, dataUrl } = await generateBillPNG(order, settings);
  const imageFile = new File([blob], filename, { type: 'image/png' });

  // 2. Check if native Web Share with files is supported (Mobile Chrome, Safari, Android/iOS)
  if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
    try {
      await navigator.share({
        title: `Bill #${order.invoiceNumber} — ${companyName}`,
        text: caption,
        files: [imageFile]
      });
      return {
        success: true,
        sharedDirectly: true,
        method: 'native-share',
        message: 'Bill PNG image shared directly to WhatsApp!'
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, cancelled: true, message: 'Share was cancelled.' };
      }
      console.warn('Native share failed, falling back to download + WhatsApp Web:', err);
    }
  }

  // 3. Fallback for Desktop Web / browsers without file sharing:
  // a) Trigger automatic PNG download so the user has the image on their device
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // b) Try copying image to system clipboard so user can press Ctrl+V in WhatsApp
  let copiedToClipboard = false;
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      copiedToClipboard = true;
    } catch (clipErr) {
      console.warn('Could not copy image to clipboard:', clipErr);
    }
  }

  // c) Open WhatsApp with pre-filled text
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(caption)}`
    : `https://wa.me/?text=${encodeURIComponent(caption)}`;

  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

  return {
    success: true,
    sharedDirectly: false,
    downloaded: true,
    copiedToClipboard,
    message: copiedToClipboard
      ? 'Bill PNG downloaded & copied to clipboard! Paste (Ctrl+V) directly into WhatsApp chat.'
      : 'Bill PNG downloaded! Attach the downloaded image in your WhatsApp chat.'
  };
};

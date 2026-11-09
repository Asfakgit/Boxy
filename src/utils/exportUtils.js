/**
 * Export Utilities (PDF-Only)
 * All legacy CSV generation and downloads have been replaced with PDF exports.
 */
import {
  exportOrdersPDF,
  exportTransactionsPDF,
  exportDailyReportPDF,
  exportMonthlyReportPDF,
  exportCustomReportPDF,
  exportKitchenReportPDF,
  exportBalanceSheetPDF,
  exportCustomerLedgerPDF,
  exportSupplierLedgerPDF
} from './pdfExportUtils';

export {
  exportOrdersPDF,
  exportTransactionsPDF,
  exportDailyReportPDF,
  exportMonthlyReportPDF,
  exportCustomReportPDF,
  exportKitchenReportPDF,
  exportBalanceSheetPDF,
  exportCustomerLedgerPDF,
  exportSupplierLedgerPDF
};

/**
 * Backward compatibility wrapper:
 * If any legacy caller invokes exportToCSV or exportTransactionsToCSV,
 * route directly to PDF export rather than CSV.
 */
export const exportToCSV = (data, filename = 'boxy-report') => {
  console.warn('[PDF Migration] CSV exports are deprecated and replaced with PDF format.');
  if (Array.isArray(data) && data.length > 0) {
    // If transactions array
    if (data[0].Transaction_ID || data[0].flow || data[0].referenceId) {
      exportTransactionsPDF({ transactions: data, filename });
      return;
    }
    // If orders array
    if (data[0].invoiceNumber || data[0]['Invoice #']) {
      exportOrdersPDF({ orders: data, filename });
      return;
    }
  }
};

export const exportTransactionsToCSV = (transactions, filename = 'boxy-transactions') => {
  exportTransactionsPDF({ transactions, filename });
};

export const exportSummaryToCSV = () => {
  console.warn('[PDF Migration] CSV summary is deprecated. Use exportDailyReportPDF or exportMonthlyReportPDF instead.');
};

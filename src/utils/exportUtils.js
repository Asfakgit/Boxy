import Papa from 'papaparse';

export const prepareTransactionData = (transactions = []) => {
  return transactions.map(tx => ({
    'Date': tx.date ? new Date(tx.date).toLocaleDateString('en-GB') : '',
    'Time': tx.date ? new Date(tx.date).toLocaleTimeString() : '',
    'Type': tx.type ? (tx.type.charAt(0).toUpperCase() + tx.type.slice(1)) : '',
    'Item': tx.item || '',
    'Category': tx.category || 'Uncategorized',
    'Quantity': tx.quantity || 0,
    'Unit Price': tx.unitPrice || 0,
    'Total Amount': tx.amount || 0,
    'Customer/Supplier': tx.customer || tx.supplier || '',
    'Note': tx.note || '',
  }));
};

export const prepareTransactionDataForExport = prepareTransactionData;

export const prepareSummaryData = (metrics = {}) => {
  return [
    ['Metric', 'Value'],
    ['Total Sales', metrics.sales || 0],
    ['Total Purchases', metrics.purchases || 0],
    ['Total Expenses', metrics.expenses || 0],
    ['Net Profit', metrics.profit || 0],
    ['Total Transactions', metrics.count || 0],
    ['Sales Count', metrics.salesCount || 0],
    ['Purchases Count', metrics.purchasesCount || 0],
    ['Expenses Count', metrics.expensesCount || 0],
  ];
};

export const exportToCSV = (data, filename = 'boxy-export') => {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    alert('No data to export!');
    return;
  }

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  
  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('download', cleanFilename);
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportTransactionsToCSV = (transactions, filename = 'boxy-transactions') => {
  const data = prepareTransactionData(transactions);
  exportToCSV(data, `${filename}-${new Date().toISOString().split('T')[0]}`);
};

export const exportSummaryToCSV = (metrics, filename = 'boxy-summary') => {
  const data = prepareSummaryData(metrics);
  exportToCSV(data, `${filename}-${new Date().toISOString().split('T')[0]}`);
};
/**
 * Boxy Cloud Kitchen — Live Google Sheets Database Service
 * 
 * Powered by Google Apps Script Web App (Code.gs).
 * All sales, purchases, stock deductions, and financial transactions
 * synchronize directly to your Google Sheet database.
 */

import { INITIAL_DATA } from './mockData';

const STORAGE_KEY = 'boxy_cloud_kitchen_db_v3';
export const DEFAULT_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzPPvwAW0ZCPrfXE5fC3ALeepJyF_KTPZNrltIldHt6HzBGQcVY9ErinAZgpCXiS2HR/exec';
export const DEFAULT_SHEET_URL = import.meta.env.VITE_GOOGLE_SHEET_URL || 'https://docs.google.com/spreadsheets/d/19VZ70qy1rUHsBTfn1FSUyjqarB56VujZJR7UcJqZXb8/edit';
export const DEFAULT_SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID || '19VZ70qy1rUHsBTfn1FSUyjqarB56VujZJR7UcJqZXb8';

// Clean legacy caches to ensure 100% fresh slate
try {
  localStorage.removeItem('boxy_cloud_kitchen_db_v2');
  localStorage.removeItem('boxy_cloud_kitchen_db_v1');
  localStorage.removeItem('boxy_cloud_kitchen_db');
  localStorage.removeItem('boxy_custom_categories');
} catch (e) {
  // Ignore in non-browser environments
}

export const getDatabase = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATA));
    return INITIAL_DATA;
  }
  try {
    const parsed = JSON.parse(saved);
    if (parsed.settings && (parsed.settings.taxRate === 5 || parsed.settings.taxRate === undefined)) {
      parsed.settings.taxRate = 0;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    if (Array.isArray(parsed.products)) {
      parsed.products = parsed.products.map(p => ({
        ...p,
        currentStock: p.currentStock !== undefined && p.currentStock !== '' ? Number(p.currentStock) : 0
      }));
    }
    if (Array.isArray(parsed.rawMaterials)) {
      parsed.rawMaterials = parsed.rawMaterials.map(rm => ({
        ...rm,
        currentStock: rm.currentStock !== undefined && rm.currentStock !== '' ? Number(rm.currentStock) : 0
      }));
    }
    if (!Array.isArray(parsed.recipes)) {
      parsed.recipes = [];
    }
    if (!Array.isArray(parsed.partners) || parsed.partners.length === 0) {
      parsed.partners = INITIAL_DATA.partners;
    }
    if (!Array.isArray(parsed.labourers) || parsed.labourers.length === 0) {
      parsed.labourers = INITIAL_DATA.labourers;
    }
    if (!Array.isArray(parsed.partnerWithdrawals)) {
      parsed.partnerWithdrawals = [];
    }
    if (!Array.isArray(parsed.salaryPayments)) {
      parsed.salaryPayments = [];
    }
    if (!Array.isArray(parsed.attendance)) {
      parsed.attendance = [];
    }
    return { ...INITIAL_DATA, ...parsed };
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATA));
    return INITIAL_DATA;
  }
};

export const saveDatabase = (db) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

export const clearLocalCache = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const getScriptUrl = () => {
  const db = getDatabase();
  return (db.settings?.googleScriptUrl || localStorage.getItem('BOXY_GAS_URL') || DEFAULT_SCRIPT_URL).trim();
};

export const isLiveMode = () => true;

/**
 * Diagnostic Connection Test to verify Google Sheets Web App communication
 */
export const testGoogleSheetsConnection = async (testUrl = null) => {
  const url = (testUrl || getScriptUrl()).trim();
  if (!url) {
    return { success: false, message: 'No Google Apps Script Web App URL provided.' };
  }

  const startTime = Date.now();
  try {
    const response = await fetch(`${url}?action=ping`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    const text = await response.text();
    const latency = Date.now() - startTime;

    if (text.includes('<!DOCTYPE html>') || text.includes('accounts.google.com') || text.includes('Sign in')) {
      return {
        success: false,
        message: 'Google returned an HTML login page. Please ensure your Apps Script is deployed with "Who has access: Anyone".',
        latency
      };
    }

    try {
      const json = JSON.parse(text);
      if (json.status === 'success') {
        return {
          success: true,
          message: json.message || 'Connected successfully to Google Sheet backend!',
          spreadsheetName: json.spreadsheetName || 'Boxy Database',
          spreadsheetId: json.spreadsheetId,
          detectedSheets: json.detectedSheets || [],
          latency
        };
      } else {
        return {
          success: false,
          message: json.message || 'Apps Script returned an error status.',
          latency
        };
      }
    } catch {
      return {
        success: false,
        message: 'Invalid response from Google Apps Script. Please verify the Web App deployment URL.',
        latency
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Network request failed. Check your internet connection: ' + error.message,
      latency: Date.now() - startTime
    };
  }
};

/**
 * Direct Live Request Engine to Google Apps Script
 */
const apiRequest = async (action, payload = {}, method = 'POST') => {
  const url = getScriptUrl();

  try {
    let response;
    if (method === 'GET') {
      const query = new URLSearchParams({ action, ...payload }).toString();
      response = await fetch(`${url}?${query}`);
    } else {
      // Use text/plain to avoid browser CORS preflight blocker on Google Apps Script
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload })
      });
    }

    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error('Google Sheets returned non-JSON response:', text, e);
      throw new Error('Google Sheets API did not return valid JSON.', { cause: e });
    }

    if (json && json.status === 'success') {
      // Sync to local cache
      if (action === 'getAllData' && json.data) {
        saveDatabase(json.data);
      }
      return json.data;
    } else {
      throw new Error(json?.message || 'Failed request to Google Sheets');
    }
  } catch (error) {
    console.error(`Google Sheets API call [${action}] failed:`, error);
    // Return cached data if available for GET requests, else re-throw
    if (method === 'GET') {
      const db = getDatabase();
      if (action === 'getAllData') return db;
      if (action === 'getTransactions') return db.transactions || [];
      if (action === 'getDashboardMetrics') {
        const todayStr = new Date().toISOString().split('T')[0];
        const todaySales = (db.sales || []).filter(s => String(s.date).startsWith(todayStr)).reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
        const totalSales = (db.sales || []).reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
        const todayPurchases = (db.purchases || []).filter(p => String(p.date).startsWith(todayStr)).reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
        const totalPurchases = (db.purchases || []).reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
        const totalExpenses = (db.expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const grossProfit = (db.sales || []).reduce((sum, s) => sum + Number(s.grossProfit || 0), 0);
        const netProfit = grossProfit - totalExpenses;
        const outstandingReceivables = (db.customers || []).reduce((sum, c) => sum + Number(c.outstandingBalance || 0), 0);
        const lowStockCount = (db.rawMaterials || []).filter(rm => Number(rm.currentStock || 0) <= Number(rm.minStock || 0)).length;

        return {
          todaySales,
          totalSales,
          todayPurchases,
          totalPurchases,
          totalExpenses,
          grossProfit,
          netProfit,
          outstandingReceivables,
          lowStockCount,
          salesCount: (db.sales || []).length,
          purchasesCount: (db.purchases || []).length
        };
      }
    }
    throw error;
  }
};

export const api = {
  getAllData: () => apiRequest('getAllData', {}, 'GET'),
  getTransactions: () => apiRequest('getTransactions', {}, 'GET'),
  getDashboardMetrics: () => apiRequest('getDashboardMetrics', {}, 'GET'),
  recordSale: (saleData) => apiRequest('recordSale', { data: saleData }),
  recordPurchase: (purchaseData) => apiRequest('recordPurchase', { data: purchaseData }),
  recordExpense: (expenseData) => apiRequest('recordExpense', { data: expenseData }),
  recordCustomerPayment: (customerId, amount, paymentMethod = 'Cash') => 
    apiRequest('recordCustomerPayment', { data: { customerId, amount, paymentMethod } }),
  recordSupplierPayment: (supplierId, amount, paymentMethod = 'Bank Transfer') => 
    apiRequest('recordSupplierPayment', { data: { supplierId, amount, paymentMethod } }),
  saveRow: (sheetName, data) => apiRequest('saveRow', { sheetName, data }),
  deleteRow: (sheetName, id) => apiRequest('deleteRow', { sheetName, id, data: { id, code: id } }),
  savePartner: (data) => apiRequest('saveRow', { sheetName: 'Partners', data }),
  deletePartner: (id) => apiRequest('deleteRow', { sheetName: 'Partners', id }),
  saveLabourer: (data) => apiRequest('saveRow', { sheetName: 'Labourers', data }),
  deleteLabourer: (id) => apiRequest('deleteRow', { sheetName: 'Labourers', id }),
  recordPartnerWithdrawal: (data) => apiRequest('saveRow', { sheetName: 'Partner Withdrawals', data }),
  deletePartnerWithdrawal: (id) => apiRequest('deleteRow', { sheetName: 'Partner Withdrawals', id }),
  recordSalaryPayment: (data) => apiRequest('saveRow', { sheetName: 'Salary Payments', data }),
  deleteSalaryPayment: (id) => apiRequest('deleteRow', { sheetName: 'Salary Payments', id }),
  recordAttendance: (data) => apiRequest('saveRow', { sheetName: 'Attendance', data }),
  adjustStock: (data) => apiRequest('adjustStock', { data }),
  setupSheets: () => apiRequest('setupSheets', {}, 'GET'),
  cleanupDatabase: () => apiRequest('cleanupDatabase', {}, 'POST'),
  clearAllData: async () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATA));
    try {
      return await apiRequest('clearAllData', {}, 'POST');
    } catch (err) {
      console.warn('Backend clear all data:', err);
      return { success: true };
    }
  },
  testConnection: (url) => testGoogleSheetsConnection(url),
  purgeAndRefetch: async () => {
    clearLocalCache();
    return apiRequest('getAllData', {}, 'GET');
  }
};

export const apiService = {
  ...api,
  fetchData: () => api.getAllData(),
  setScriptUrl: (url) => {
    const db = getDatabase();
    if (!db.settings) db.settings = {};
    db.settings.googleScriptUrl = (url || '').trim();
    saveDatabase(db);
    localStorage.setItem('BOXY_GAS_URL', (url || '').trim());
  },
  isLiveMode: () => true,
  getScriptUrl: () => getScriptUrl()
};

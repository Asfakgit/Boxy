import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getDatabase, saveDatabase } from '../services/apiService';

const AppContext = createContext();

const getCollectionKey = (sheetName) => {
  const norm = String(sheetName || '').toLowerCase().replace(/[^a-z]/g, '');
  if (norm.includes('product')) return 'products';
  if (norm.includes('raw') || norm.includes('material')) return 'rawMaterials';
  if (norm.includes('customer')) return 'customers';
  if (norm.includes('supplier')) return 'suppliers';
  if (norm.includes('expense')) return 'expenses';
  if (norm.includes('purchase')) return 'purchases';
  if (norm.includes('sale')) return 'sales';
  if (norm.includes('transaction')) return 'transactions';
  return 'products';
};

const getItemId = (item) => String(item?.code || item?.id || item?.invoiceNumber || item?.purchaseNumber || '');

export const AppProvider = ({ children }) => {
  // Database State
  const [data, setData] = useState(() => getDatabase());
  const [metrics, setMetrics] = useState({
    todaySales: 0,
    totalSales: 0,
    todayPurchases: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    grossProfit: 0,
    netProfit: 0,
    outstandingReceivables: 0,
    lowStockCount: 0,
    salesCount: 0,
    purchasesCount: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // POS Cart State
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null); // null = Walk-in Customer
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // Notifications / Toasts
  const [toasts, setToasts] = useState([]);

  // Global In-UI Confirmation Popup Modal
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showConfirmDialog = useCallback(({
    title,
    message,
    itemName,
    confirmText,
    cancelText = 'Cancel',
    type = 'delete', // 'delete', 'update', 'danger', 'info'
    onConfirm
  }) => {
    setConfirmDialog({
      title,
      message,
      itemName,
      confirmText: confirmText || (type === 'delete' || type === 'danger' ? 'Yes, Delete' : 'Yes, Update'),
      cancelText,
      type,
      onConfirm: async () => {
        if (onConfirm) await onConfirm();
        setConfirmDialog(null);
      }
    });
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog(null);
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Refresh All Data from Google Sheets with Smart Local-First Merge
  const refreshData = useCallback(async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const cloudData = await api.getAllData();
      if (cloudData && typeof cloudData === 'object') {
        setData(currentLocal => {
          const merged = { ...currentLocal, ...cloudData };
          const keys = ['products', 'rawMaterials', 'sales', 'purchases', 'expenses', 'customers', 'suppliers', 'transactions'];

          keys.forEach(k => {
            const cloudList = Array.isArray(cloudData[k]) ? cloudData[k] : [];
            const localList = Array.isArray(currentLocal[k]) ? currentLocal[k] : [];

            const localMap = new Map();
            localList.forEach(item => {
              const id = getItemId(item);
              if (id) localMap.set(id, item);
            });

            const map = new Map();
            // Start with cloud items, merging with local values to protect un-synced fields
            cloudList.forEach(cloudItem => {
              const id = getItemId(cloudItem);
              if (id) {
                const localItem = localMap.get(id);
                if (localItem) {
                  const mergedItem = { ...localItem, ...cloudItem };
                  Object.keys(localItem).forEach(prop => {
                    if (mergedItem[prop] === undefined || mergedItem[prop] === null || mergedItem[prop] === '') {
                      mergedItem[prop] = localItem[prop];
                    }
                  });
                  map.set(id, mergedItem);
                } else {
                  map.set(id, cloudItem);
                }
              }
            });

            // Preserve any newly added local items that haven't reached cloud yet
            localList.forEach(item => {
              const id = getItemId(item);
              if (id && !map.has(id)) {
                map.set(id, item);
              }
            });

            merged[k] = Array.from(map.values());
          });

          saveDatabase(merged);
          return merged;
        });
      }

      const dashMetrics = await api.getDashboardMetrics();
      if (dashMetrics) setMetrics(dashMetrics);
    } catch (error) {
      console.warn('Error refreshing cloud data, using local database cache:', error);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // POS Cart Methods
  const addToCart = (product, quantity = 1) => {
    const qty = Math.max(1, Number(quantity) || 1);
    setCart(prev => {
      const existing = prev.find(item => item.productCode === product.code);
      if (existing) {
        return prev.map(item => item.productCode === product.code ? { ...item, quantity: item.quantity + qty } : item);
      }
      return [...prev, {
        productCode: product.code,
        productName: product.name,
        unitPrice: Number(product.sellingPrice) || 0,
        costPrice: Number(product.costPrice) || 0,
        quantity: qty,
        image: product.image
      }];
    });
    showToast(`Added ${qty > 1 ? `${qty}x ` : ''}${product.name} to cart`, 'success');
  };

  const setCartQuantity = (productCode, exactQty) => {
    // If the user hit backspace and value is empty string, keep item with empty string so they can type
    if (exactQty === '' || exactQty === null || exactQty === undefined) {
      setCart(prev => prev.map(item => {
        if (item.productCode === productCode) {
          return { ...item, quantity: '' };
        }
        return item;
      }));
      return;
    }
    const val = parseInt(exactQty, 10);
    if (isNaN(val)) return;
    setCart(prev => prev.map(item => {
      if (item.productCode === productCode) {
        return { ...item, quantity: Math.max(1, val) };
      }
      return item;
    }));
  };

  const updateCartQuantity = (productCode, delta) => {
    setCart(prev => prev.map(item => {
      if (item.productCode === productCode) {
        const currentQty = Number(item.quantity) || 1;
        const newQty = currentQty + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (productCode) => {
    setCart(prev => prev.filter(item => item.productCode !== productCode));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setDiscount(0);
    setPaymentMethod('Cash');
  };

  // ==========================================
  // Optimistic CRUD & Business Action Handlers
  // ==========================================

  const recordPOSSale = async (customSaleData = null) => {
    setIsLoading(true);
    try {
      const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
      const totalAmount = Math.max(0, subtotal - Number(discount || 0));

      const salePayload = customSaleData || {
        date: new Date().toISOString(),
        invoiceNumber: 'INV-' + Math.floor(Math.random() * 90000 + 10000),
        customerId: selectedCustomer ? selectedCustomer.id : 'WALKIN',
        customerName: selectedCustomer ? (selectedCustomer.shopName || selectedCustomer.name) : 'Walk-in Customer',
        subtotal,
        discount: Number(discount || 0),
        taxAmount: 0,
        totalAmount,
        paymentMethod,
        items: [...cart]
      };

      if (!salePayload.invoiceNumber) {
        salePayload.invoiceNumber = 'INV-' + Math.floor(Math.random() * 90000 + 10000);
      }

      const summary = (salePayload.items || []).map(i => `${i.quantity}x ${i.productName || i.name}`).join(', ');

      const txnPayload = {
        id: 'TXN-' + Date.now(),
        date: salePayload.date,
        flow: 'IN',
        type: 'Sale',
        partyName: salePayload.customerName || 'Walk-in Customer',
        reference: salePayload.invoiceNumber,
        amount: Number(salePayload.totalAmount || 0),
        paymentMethod: salePayload.paymentMethod || 'Cash',
        notes: summary
      };

      // 1. Instantly update React state and LocalStorage
      setData(prev => {
        const nextSales = [salePayload, ...(prev.sales || [])];
        const nextTxns = [txnPayload, ...(prev.transactions || [])];

        // Deduct sold stock
        const nextProducts = (prev.products || []).map(p => {
          const sold = (salePayload.items || []).find(i => 
            String(i.productCode || i.code) === String(p.code) ||
            String(i.productName || i.name).toLowerCase() === String(p.name).toLowerCase()
          );
          if (sold && p.currentStock !== undefined && p.currentStock !== '') {
            const current = Number(p.currentStock || 0);
            return { ...p, currentStock: Math.max(0, current - Number(sold.quantity || 1)) };
          }
          return p;
        });

        // Update customer credit balance if applicable
        let nextCustomers = prev.customers || [];
        if (salePayload.customerId && salePayload.customerId !== 'WALKIN' && salePayload.paymentMethod === 'Credit') {
          nextCustomers = nextCustomers.map(c => {
            if (String(c.id) === String(salePayload.customerId)) {
              return { ...c, outstandingBalance: Number(c.outstandingBalance || 0) + Number(salePayload.totalAmount || 0) };
            }
            return c;
          });
        }

        const nextDb = {
          ...prev,
          sales: nextSales,
          transactions: nextTxns,
          products: nextProducts,
          customers: nextCustomers
        };
        saveDatabase(nextDb);
        return nextDb;
      });

      clearCart();
      showToast(`Sale recorded! Invoice #${salePayload.invoiceNumber}`, 'success');
      setIsLoading(false);

      // 2. Background sync to Google Sheets
      try {
        await api.recordSale(salePayload);
      } catch (err) {
        console.warn('Background sync for sale had an issue, preserved locally:', err);
      }

      return salePayload;
    } catch (err) {
      showToast('Error recording sale: ' + err.message, 'error');
      setIsLoading(false);
      throw err;
    }
  };

  const recordPurchaseEntry = async (purchasePayload) => {
    setIsLoading(true);
    const purchaseNum = purchasePayload.materialNumber || purchasePayload.purchaseNumber || 'PUR-' + Math.floor(Math.random() * 9000 + 1000);
    const date = purchasePayload.date || new Date().toISOString().split('T')[0];
    const totalAmount = Number(purchasePayload.totalAmount || 0);
    const amountPaid = Number(purchasePayload.amountPaid !== undefined ? purchasePayload.amountPaid : totalAmount);

    const fullPurchase = {
      ...purchasePayload,
      materialNumber: purchaseNum,
      purchaseNumber: purchaseNum,
      date,
      totalAmount,
      amountPaid
    };

    const summary = (fullPurchase.items || []).map(i => `${i.quantity}x ${i.rawMaterialName || i.name}`).join(', ');

    const txnPayload = {
      id: 'TXN-' + Date.now(),
      date,
      flow: 'OUT',
      type: 'Purchase',
      partyName: fullPurchase.supplierName || 'Supplier',
      reference: purchaseNum,
      amount: amountPaid,
      paymentMethod: fullPurchase.paymentMethod || 'Bank Transfer',
      notes: summary
    };

    // 1. Instantly update React state & localStorage
    setData(prev => {
      const nextPurchases = [fullPurchase, ...(prev.purchases || [])];
      const nextTxns = [txnPayload, ...(prev.transactions || [])];

      // Restock Raw Materials
      const nextRawMaterials = (prev.rawMaterials || []).map(rm => {
        const item = (fullPurchase.items || []).find(i => 
          String(i.rawMaterialId || i.id) === String(rm.id) ||
          String(i.rawMaterialName || i.name).toLowerCase() === String(rm.name).toLowerCase()
        );
        if (item) {
          const current = Number(rm.currentStock || 0);
          return {
            ...rm,
            currentStock: current + Number(item.quantity || 0),
            costPrice: item.unitPrice ? Number(item.unitPrice) : rm.costPrice
          };
        }
        return rm;
      });

      // Restock Products
      const nextProducts = (prev.products || []).map(p => {
        const item = (fullPurchase.items || []).find(i => 
          String(i.rawMaterialId || i.id || i.code) === String(p.code) ||
          String(i.rawMaterialName || i.name).toLowerCase() === String(p.name).toLowerCase()
        );
        if (item) {
          const current = Number(p.currentStock || 0);
          return {
            ...p,
            currentStock: current + Number(item.quantity || 0),
            costPrice: item.unitPrice ? Number(item.unitPrice) : p.costPrice
          };
        }
        return p;
      });

      const nextDb = {
        ...prev,
        purchases: nextPurchases,
        transactions: nextTxns,
        rawMaterials: nextRawMaterials,
        products: nextProducts
      };
      saveDatabase(nextDb);
      return nextDb;
    });

    showToast('Purchase recorded & inventory restocked!', 'success');
    setIsLoading(false);

    // 2. Background sync
    try {
      await api.recordPurchase(fullPurchase);
    } catch (err) {
      console.warn('Background sync for purchase had an issue, preserved locally:', err);
    }
  };

  const recordExpenseEntry = async (expensePayload) => {
    setIsLoading(true);
    const expId = expensePayload.id || 'EXP-' + Math.floor(Math.random() * 9000 + 1000);
    const fullExpense = {
      ...expensePayload,
      id: expId,
      date: expensePayload.date || new Date().toISOString().split('T')[0],
      amount: Number(expensePayload.amount || 0)
    };

    const txnPayload = {
      id: 'TXN-' + Date.now(),
      date: fullExpense.date,
      flow: 'OUT',
      type: 'Expense',
      partyName: fullExpense.category || 'Overhead',
      reference: expId,
      amount: fullExpense.amount,
      paymentMethod: fullExpense.paymentMethod || 'Cash',
      notes: fullExpense.description || ''
    };

    // 1. Instantly update React state & localStorage
    setData(prev => {
      const nextExpenses = [fullExpense, ...(prev.expenses || [])];
      const nextTxns = [txnPayload, ...(prev.transactions || [])];
      const nextDb = { ...prev, expenses: nextExpenses, transactions: nextTxns };
      saveDatabase(nextDb);
      return nextDb;
    });

    showToast('Expense recorded successfully!', 'success');
    setIsLoading(false);

    // 2. Background sync
    try {
      await api.recordExpense(fullExpense);
    } catch (err) {
      console.warn('Background sync for expense had an issue, preserved locally:', err);
    }
  };

  const recordCustomerSettlement = async (customerId, amount, method = 'Cash') => {
    setIsLoading(true);
    const numAmount = Number(amount || 0);

    const txnPayload = {
      id: 'TXN-' + Date.now(),
      date: new Date().toISOString(),
      flow: 'IN',
      type: 'Customer Settlement',
      partyName: 'Customer #' + customerId,
      reference: 'CUST-' + customerId,
      amount: numAmount,
      paymentMethod: method,
      notes: 'Customer debt payment'
    };

    setData(prev => {
      const nextCustomers = (prev.customers || []).map(c => {
        if (String(c.id) === String(customerId)) {
          const current = Number(c.outstandingBalance || 0);
          return { ...c, outstandingBalance: Math.max(0, current - numAmount) };
        }
        return c;
      });
      const nextTxns = [txnPayload, ...(prev.transactions || [])];
      const nextDb = { ...prev, customers: nextCustomers, transactions: nextTxns };
      saveDatabase(nextDb);
      return nextDb;
    });

    showToast(`Recorded customer payment of ${data.settings?.currencySymbol || '₹'}${amount}!`, 'success');
    setIsLoading(false);

    try {
      await api.recordCustomerPayment(customerId, amount, method);
    } catch (err) {
      console.warn('Background sync for customer settlement had an issue:', err);
    }
  };

  const recordSupplierPayment = async (supplierId, amount, method = 'Bank Transfer') => {
    setIsLoading(true);
    const numAmount = Number(amount || 0);

    const txnPayload = {
      id: 'TXN-' + Date.now(),
      date: new Date().toISOString(),
      flow: 'OUT',
      type: 'Supplier Settlement',
      partyName: 'Supplier #' + supplierId,
      reference: 'SUP-' + supplierId,
      amount: numAmount,
      paymentMethod: method,
      notes: 'Vendor bill payment'
    };

    setData(prev => {
      const nextSuppliers = (prev.suppliers || []).map(s => {
        if (String(s.id) === String(supplierId)) {
          const current = Number(s.outstandingBalance || 0);
          return { ...s, outstandingBalance: Math.max(0, current - numAmount) };
        }
        return s;
      });
      const nextTxns = [txnPayload, ...(prev.transactions || [])];
      const nextDb = { ...prev, suppliers: nextSuppliers, transactions: nextTxns };
      saveDatabase(nextDb);
      return nextDb;
    });

    showToast(`Recorded vendor payment of ${data.settings?.currencySymbol || '₹'}${amount}!`, 'success');
    setIsLoading(false);

    try {
      await api.recordSupplierPayment(supplierId, amount, method);
    } catch (err) {
      console.warn('Background sync for supplier payment had an issue:', err);
    }
  };

  const saveItem = async (sheetName, itemData, label = 'Item') => {
    setIsLoading(true);
    const collectionKey = getCollectionKey(sheetName);
    const itemWithId = { ...itemData };

    // Auto generate clean ID / Code if missing
    if (!itemWithId.id && !itemWithId.code) {
      if (collectionKey === 'products') itemWithId.code = 'PRD-' + Math.floor(Math.random() * 9000 + 1000);
      else if (collectionKey === 'rawMaterials') itemWithId.id = 'RM-' + Math.floor(Math.random() * 9000 + 1000);
      else if (collectionKey === 'customers') itemWithId.id = 'CUST-' + Math.floor(Math.random() * 9000 + 1000);
      else if (collectionKey === 'suppliers') itemWithId.id = 'SUP-' + Math.floor(Math.random() * 9000 + 1000);
      else if (collectionKey === 'expenses') itemWithId.id = 'EXP-' + Math.floor(Math.random() * 9000 + 1000);
      else itemWithId.id = 'ID-' + Math.floor(Math.random() * 9000 + 1000);
    }
    if (itemWithId.code && !itemWithId.id) itemWithId.id = itemWithId.code;
    if (itemWithId.id && !itemWithId.code) itemWithId.code = itemWithId.id;

    // 1. Instantly update React state & localStorage (Row 1 at the top!)
    setData(prev => {
      const list = [...(prev[collectionKey] || [])];
      const targetId = getItemId(itemWithId);
      const existingIdx = list.findIndex(i => getItemId(i) === targetId);

      if (existingIdx !== -1) {
        list[existingIdx] = { ...list[existingIdx], ...itemWithId };
      } else {
        list.unshift(itemWithId); // Put at TOP so it is immediately visible!
      }

      const nextDb = { ...prev, [collectionKey]: list };
      saveDatabase(nextDb);
      return nextDb;
    });

    showToast(`${label} saved successfully!`, 'success');
    setIsLoading(false);

    // 2. Background sync to Google Sheets
    try {
      await api.saveRow(sheetName, itemWithId);
    } catch (err) {
      console.warn(`Background sync for ${label} had an issue, preserved locally:`, err);
    }

    return itemWithId;
  };

  const deleteItem = async (sheetName, id, label = 'Item') => {
    setIsLoading(true);
    const collectionKey = getCollectionKey(sheetName);
    const targetIdStr = String(id);

    // 1. Instantly remove from React state & localStorage
    setData(prev => {
      const list = (prev[collectionKey] || []).filter(i => getItemId(i) !== targetIdStr);
      const nextDb = { ...prev, [collectionKey]: list };
      saveDatabase(nextDb);
      return nextDb;
    });

    showToast(`${label} deleted!`, 'success');
    setIsLoading(false);

    // 2. Background sync delete
    try {
      await api.deleteRow(sheetName, id);
    } catch (err) {
      console.warn(`Background delete for ${label} had an issue:`, err);
    }
  };

  const adjustStock = async (itemId, delta, newStock, type = 'product', notes = '') => {
    setIsLoading(true);
    const targetIdStr = String(itemId);

    // 1. Instantly update React state & localStorage
    setData(prev => {
      let nextProducts = [...(prev.products || [])];
      let nextRawMaterials = [...(prev.rawMaterials || [])];

      if (type === 'product' || !type) {
        const pIdx = nextProducts.findIndex(p => String(p.code) === targetIdStr || String(p.id) === targetIdStr);
        if (pIdx !== -1) {
          const current = Number(nextProducts[pIdx].currentStock || 0);
          const updated = newStock !== undefined ? Number(newStock) : Math.max(0, current + Number(delta || 0));
          nextProducts[pIdx] = { ...nextProducts[pIdx], currentStock: updated };
        }
      }

      const rmIdx = nextRawMaterials.findIndex(rm => String(rm.id) === targetIdStr || String(rm.code) === targetIdStr);
      if (rmIdx !== -1) {
        const current = Number(nextRawMaterials[rmIdx].currentStock || 0);
        const updated = newStock !== undefined ? Number(newStock) : Math.max(0, current + Number(delta || 0));
        nextRawMaterials[rmIdx] = { ...nextRawMaterials[rmIdx], currentStock: updated };
      }

      const nextDb = { ...prev, products: nextProducts, rawMaterials: nextRawMaterials };
      saveDatabase(nextDb);
      return nextDb;
    });

    showToast('Stock updated successfully!', 'success');
    setIsLoading(false);

    // 2. Background sync
    try {
      await api.adjustStock({ itemId, delta, newStock, type, notes });
    } catch (err) {
      console.warn('Background sync for stock adjustment had an issue, preserved locally:', err);
    }
  };

  const saveSettings = async (updatedSettings) => {
    setIsLoading(true);
    try {
      const db = getDatabase();
      db.settings = { ...(db.settings || {}), ...updatedSettings };
      saveDatabase(db);
      setData(prev => ({ ...prev, settings: db.settings }));
      showToast('Settings updated successfully!', 'success');
      await refreshData(true);
    } catch (err) {
      showToast('Error saving settings: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const setupGoogleSheets = async () => {
    setIsLoading(true);
    try {
      const res = await api.setupSheets();
      showToast('Core 8 Google Sheets verified and initialized with clean headers!', 'success');
      await refreshData();
      return res;
    } catch (err) {
      showToast('Failed to setup sheets: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const restoreData = (newDb) => {
    saveDatabase(newDb);
    setData(newDb);
    refreshData();
    showToast('Database restored successfully from backup!', 'success');
  };

  const forceSyncFromSheets = async () => {
    setIsLoading(true);
    try {
      const fresh = await api.purgeAndRefetch();
      setData(fresh);
      await refreshData(true);
      showToast('Cache refreshed directly from Google Sheets!', 'success');
    } catch (err) {
      showToast('Error syncing from Google Sheets: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppContext.Provider value={{
      data,
      metrics,
      isLoading,
      isSyncing,
      refreshData,
      cart,
      addToCart,
      updateCartQuantity,
      setCartQuantity,
      removeFromCart,
      clearCart,
      selectedCustomer,
      setSelectedCustomer,
      discount,
      setDiscount,
      paymentMethod,
      setPaymentMethod,
      recordPOSSale,
      recordPurchaseEntry,
      recordExpenseEntry,
      recordCustomerSettlement,
      recordSupplierPayment,
      adjustStock,
      saveItem,
      deleteItem,
      saveSettings,
      setupGoogleSheets,
      restoreData,
      forceSyncFromSheets,
      toasts,
      showToast,
      removeToast,
      confirmDialog,
      showConfirmDialog,
      closeConfirmDialog
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

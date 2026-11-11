import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, getDatabase, saveDatabase } from '../services/apiService';
import { convertQuantity } from '../utils/unitConverter';

const AppContext = createContext();

const getCollectionKey = (sheetName) => {
  const norm = String(sheetName || '').toLowerCase().replace(/[^a-z]/g, '');
  if (norm.includes('partnerwithdrawal')) return 'partnerWithdrawals';
  if (norm.includes('partner')) return 'partners';
  if (norm.includes('salarypayment')) return 'salaryPayments';
  if (norm.includes('labour') || norm.includes('worker') || norm.includes('employee')) return 'labourers';
  if (norm.includes('attendance')) return 'attendance';
  if (norm.includes('product')) return 'products';
  if (norm.includes('raw') || norm.includes('material')) return 'rawMaterials';
  if (norm.includes('recipe')) return 'recipes';
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

  // Apply an immutable update to the database and persist it to localStorage.
  const updateDb = useCallback((updater) => {
    setData(prev => {
      const next = updater(prev);
      saveDatabase(next);
      return next;
    });
  }, []);
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
          const keys = ['products', 'rawMaterials', 'sales', 'purchases', 'expenses', 'customers', 'suppliers', 'transactions', 'recipes', 'partners', 'labourers', 'partnerWithdrawals', 'salaryPayments', 'attendance'];

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
  // Recipe BOM & Live Inventory Validation
  // ==========================================

  const getRecipeForProduct = useCallback((productCode) => {
    if (!productCode) return [];
    const codeStr = String(productCode).trim();
    return (data?.recipes || []).filter(r => String(r.productCode).trim() === codeStr);
  }, [data?.recipes]);

  const checkCartStockAvailability = useCallback((cartItems = []) => {
    const rawMaterialsMap = new Map();
    (data?.rawMaterials || []).forEach(rm => {
      rawMaterialsMap.set(String(rm.id), {
        id: String(rm.id),
        name: rm.name,
        currentStock: Number(rm.currentStock || 0),
        unit: rm.unit || 'kg'
      });
    });

    const neededMap = new Map(); // rawMaterialId -> { rawMaterialId, rawMaterialName, available, stockUnit, required }

    (cartItems || []).forEach(item => {
      const pCode = String(item.productCode || item.code || item.id || '').trim();
      const pName = String(item.productName || item.name || '').trim().toLowerCase();
      const itemQty = Number(item.quantity || 1);

      const ingredients = (data?.recipes || []).filter(r => 
        (pCode && String(r.productCode).trim() === pCode) ||
        (pName && String(r.productName || '').trim().toLowerCase() === pName)
      );

      ingredients.forEach(ing => {
        const rmId = String(ing.rawMaterialId);
        const rm = rawMaterialsMap.get(rmId) || (data?.rawMaterials || []).find(m => String(m.name).toLowerCase() === String(ing.rawMaterialName).toLowerCase());
        
        if (rm) {
          const key = String(rm.id);
          const deductionPerServing = convertQuantity(ing.quantity, ing.unit, rm.unit);
          const totalServingDeduction = deductionPerServing * itemQty;

          if (!neededMap.has(key)) {
            neededMap.set(key, {
              rawMaterialId: key,
              rawMaterialName: rm.name,
              available: rm.currentStock,
              stockUnit: rm.unit,
              required: 0
            });
          }
          const entry = neededMap.get(key);
          entry.required = Number((entry.required + totalServingDeduction).toFixed(4));
        }
      });
    });

    const shortages = [];
    neededMap.forEach(entry => {
      if (entry.required > entry.available) {
        shortages.push({
          rawMaterialId: entry.rawMaterialId,
          rawMaterialName: entry.rawMaterialName,
          required: entry.required,
          available: entry.available,
          deficit: Number((entry.required - entry.available).toFixed(4)),
          unit: entry.stockUnit
        });
      }
    });

    return {
      isAvailable: shortages.length === 0,
      shortages,
      requiredIngredients: Array.from(neededMap.values())
    };
  }, [data?.rawMaterials, data?.recipes]);

  const saveRecipe = async (productCode, productName, ingredients = []) => {
    setIsLoading(true);
    try {
      const codeStr = String(productCode).trim();
      const rows = ingredients.map((ing, idx) => ({
        id: ing.id || `BOM-${codeStr}-${idx + 1}`,
        productCode: codeStr,
        productName: productName || ing.productName || 'Menu Item',
        rawMaterialId: String(ing.rawMaterialId || ing.id),
        rawMaterialName: ing.rawMaterialName || ing.name,
        quantity: Number(ing.quantity || 0),
        unit: ing.unit || 'pcs',
        costPerUnit: Number(ing.costPerUnit || 0),
        totalCost: Number(ing.totalCost || 0)
      }));

      updateDb(prev => {
        const otherRecipes = (prev.recipes || []).filter(r => String(r.productCode).trim() !== codeStr);
        const nextRecipes = [...otherRecipes, ...rows];
        return { ...prev, recipes: nextRecipes };
      });

      showToast(`Recipe saved for "${productName}" (${rows.length} ingredients)!`, 'success');

      // Background sync to Google Sheets
      for (const row of rows) {
        try {
          await api.saveRow('Recipes', row);
        } catch (e) {
          console.warn('Sync recipe row to cloud:', e);
        }
      }
    } catch (err) {
      showToast('Error saving recipe: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRecipe = async (productCode) => {
    setIsLoading(true);
    try {
      const codeStr = String(productCode).trim();
      const toDelete = (data?.recipes || []).filter(r => String(r.productCode).trim() === codeStr);

      updateDb(prev => {
        const nextRecipes = (prev.recipes || []).filter(r => String(r.productCode).trim() !== codeStr);
        return { ...prev, recipes: nextRecipes };
      });

      showToast('Recipe deleted successfully', 'success');

      for (const r of toDelete) {
        try {
          await api.deleteRow('Recipes', r.id);
        } catch (e) {
          console.warn('Sync delete recipe:', e);
        }
      }
    } catch (err) {
      showToast('Error deleting recipe: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const refundAndRestockOrder = async (invoiceNumber) => {
    setIsLoading(true);
    try {
      const sale = (data?.sales || []).find(s => s.invoiceNumber === invoiceNumber);
      if (!sale) throw new Error('Order not found');

      updateDb(prev => {
        let nextRawMaterials = [...(prev.rawMaterials || [])];
        const allRecipes = prev.recipes || [];
        const restockTxns = [];

        (sale.items || []).forEach(item => {
          const pCode = String(item.productCode || item.code || item.id || '').trim();
          const pName = String(item.productName || item.name || '').trim().toLowerCase();
          const itemQty = Number(item.quantity || 1);

          const matchedIngredients = allRecipes.filter(r => 
            (pCode && String(r.productCode).trim() === pCode) ||
            (pName && String(r.productName || '').trim().toLowerCase() === pName)
          );

          matchedIngredients.forEach(ing => {
            const rmIdx = nextRawMaterials.findIndex(rm => 
              String(rm.id) === String(ing.rawMaterialId) ||
              String(rm.name).toLowerCase() === String(ing.rawMaterialName).toLowerCase()
            );

            if (rmIdx !== -1) {
              const targetRm = nextRawMaterials[rmIdx];
              const deductionPerUnit = convertQuantity(ing.quantity, ing.unit, targetRm.unit);
              const totalRestock = Number((deductionPerUnit * itemQty).toFixed(4));
              const currentStock = Number(targetRm.currentStock || 0);

              nextRawMaterials[rmIdx] = {
                ...targetRm,
                currentStock: Number((currentStock + totalRestock).toFixed(4))
              };

              restockTxns.push({
                id: `RESTOCK-${invoiceNumber}-${targetRm.id}`,
                date: new Date().toISOString(),
                flow: 'IN',
                type: 'Recipe Restock',
                partyName: `Cancelled Order #${invoiceNumber}`,
                reference: invoiceNumber,
                amount: Number((totalRestock * Number(targetRm.costPrice || 0)).toFixed(2)),
                paymentMethod: 'Inventory Restock',
                notes: `Restocked ${totalRestock} ${targetRm.unit} of ${targetRm.name} from cancelled order #${invoiceNumber}`
              });
            }
          });
        });

        const nextSales = (prev.sales || []).map(s => 
          s.invoiceNumber === invoiceNumber ? { ...s, status: 'Cancelled' } : s
        );

        return {
          ...prev,
          sales: nextSales,
          rawMaterials: nextRawMaterials,
          transactions: [...(prev.transactions || []), ...restockTxns]
        };
      });

      showToast(`Order #${invoiceNumber} cancelled & raw materials restored!`, 'success');
    } catch (err) {
      showToast('Error cancelling order: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
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

      // 0. Idempotency Check: Prevent duplicate deductions on retries
      const isAlreadyRecorded = (data?.sales || []).some(s => s.invoiceNumber === salePayload.invoiceNumber);
      if (isAlreadyRecorded) {
        console.warn(`Invoice ${salePayload.invoiceNumber} was already recorded. Skipping duplicate stock deduction.`);
        setIsLoading(false);
        return salePayload;
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
      updateDb(prev => {
        const nextSales = [salePayload, ...(prev.sales || [])];
        const nextTxns = [txnPayload, ...(prev.transactions || [])];
        const allRecipes = prev.recipes || [];

        // Track raw materials to deduct and log
        let nextRawMaterials = [...(prev.rawMaterials || [])];
        const bomConsumptionTxns = [];

        (salePayload.items || []).forEach(item => {
          const pCode = String(item.productCode || item.code || item.id || '').trim();
          const pName = String(item.productName || item.name || '').trim().toLowerCase();
          const itemQty = Number(item.quantity || 1);

          // Find recipe for this item
          const matchedIngredients = allRecipes.filter(r => 
            (pCode && String(r.productCode).trim() === pCode) ||
            (pName && String(r.productName || '').trim().toLowerCase() === pName)
          );

          if (matchedIngredients.length > 0) {
            matchedIngredients.forEach(ing => {
              const rmIdx = nextRawMaterials.findIndex(rm => 
                String(rm.id) === String(ing.rawMaterialId) ||
                String(rm.name).toLowerCase() === String(ing.rawMaterialName).toLowerCase()
              );

              if (rmIdx !== -1) {
                const targetRm = nextRawMaterials[rmIdx];
                const deductionPerUnit = convertQuantity(ing.quantity, ing.unit, targetRm.unit);
                const totalDeduction = Number((deductionPerUnit * itemQty).toFixed(4));
                const currentStock = Number(targetRm.currentStock || 0);
                const updatedStock = Math.max(0, Number((currentStock - totalDeduction).toFixed(4)));

                nextRawMaterials[rmIdx] = {
                  ...targetRm,
                  currentStock: updatedStock
                };

                // Add audit entry for this ingredient consumption
                bomConsumptionTxns.push({
                  id: `BOM-LOG-${salePayload.invoiceNumber}-${targetRm.id}`,
                  date: salePayload.date,
                  flow: 'OUT',
                  type: 'Recipe Consumption',
                  partyName: `${item.quantity}x ${item.productName || item.name}`,
                  reference: salePayload.invoiceNumber,
                  amount: Number((totalDeduction * Number(targetRm.costPrice || 0)).toFixed(2)),
                  paymentMethod: 'Raw Inventory',
                  notes: `Deducted ${totalDeduction} ${targetRm.unit} of ${targetRm.name} for ${item.quantity}x ${item.productName || item.name} (Inv #${salePayload.invoiceNumber})`
                });
              }
            });
          }
        });

        // Deduct sold stock from products IF product had manual stock and NO recipe was configured
        const nextProducts = (prev.products || []).map(p => {
          const hasRecipe = allRecipes.some(r => String(r.productCode).trim() === String(p.code).trim());
          if (hasRecipe) return p; // Skip product stock deduction when recipe-managed!

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

        return {
          ...prev,
          sales: nextSales,
          transactions: [...nextTxns, ...bomConsumptionTxns],
          products: nextProducts,
          rawMaterials: nextRawMaterials,
          customers: nextCustomers
        };
      });

      clearCart();
      showToast(`Sale completed! Invoice #${salePayload.invoiceNumber} (Kitchen raw materials deducted)`, 'success');
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
    updateDb(prev => {
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

      return {
        ...prev,
        purchases: nextPurchases,
        transactions: nextTxns,
        rawMaterials: nextRawMaterials,
        products: nextProducts
      };
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
    updateDb(prev => {
      const nextExpenses = [fullExpense, ...(prev.expenses || [])];
      const nextTxns = [txnPayload, ...(prev.transactions || [])];
      return { ...prev, expenses: nextExpenses, transactions: nextTxns };
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

    updateDb(prev => {
      const nextCustomers = (prev.customers || []).map(c => {
        if (String(c.id) === String(customerId)) {
          const current = Number(c.outstandingBalance || 0);
          return { ...c, outstandingBalance: Math.max(0, current - numAmount) };
        }
        return c;
      });
      const nextTxns = [txnPayload, ...(prev.transactions || [])];
      return { ...prev, customers: nextCustomers, transactions: nextTxns };
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

    updateDb(prev => {
      const nextSuppliers = (prev.suppliers || []).map(s => {
        if (String(s.id) === String(supplierId)) {
          const current = Number(s.outstandingBalance || 0);
          return { ...s, outstandingBalance: Math.max(0, current - numAmount) };
        }
        return s;
      });
      const nextTxns = [txnPayload, ...(prev.transactions || [])];
      return { ...prev, suppliers: nextSuppliers, transactions: nextTxns };
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
    updateDb(prev => {
      const list = [...(prev[collectionKey] || [])];
      const targetId = getItemId(itemWithId);
      const existingIdx = list.findIndex(i => getItemId(i) === targetId);

      if (existingIdx !== -1) {
        list[existingIdx] = { ...list[existingIdx], ...itemWithId };
      } else {
        list.unshift(itemWithId); // Put at TOP so it is immediately visible!
      }

      return { ...prev, [collectionKey]: list };
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
    updateDb(prev => {
      const list = (prev[collectionKey] || []).filter(i => getItemId(i) !== targetIdStr);
      return { ...prev, [collectionKey]: list };
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
    updateDb(prev => {
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

      return { ...prev, products: nextProducts, rawMaterials: nextRawMaterials };
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

  const resetAllStockToZero = async () => {
    setIsLoading(true);
    try {
      updateDb(prev => {
        const nextProducts = (prev.products || []).map(p => ({ ...p, currentStock: 0 }));
        const nextRawMaterials = (prev.rawMaterials || []).map(rm => ({ ...rm, currentStock: 0, totalAmount: 0 }));
        return { ...prev, products: nextProducts, rawMaterials: nextRawMaterials };
      });

      const db = getDatabase();
      for (const prod of (db.products || [])) {
        try {
          await api.adjustStock({ itemId: prod.code || prod.id, newStock: 0, type: 'product', notes: 'Stock reset to 0' });
        } catch (e) {
          console.warn('Sync zero product stock:', e);
        }
      }
      for (const rm of (db.rawMaterials || [])) {
        try {
          await api.adjustStock({ itemId: rm.id, newStock: 0, type: 'rawMaterial', notes: 'Stock reset to 0' });
        } catch (e) {
          console.warn('Sync zero rm stock:', e);
        }
      }

      showToast('All inventory current stock has been set to 0!', 'success');
    } catch (err) {
      showToast('Error setting stock to 0: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================================
  // PARTNER MANAGEMENT OPERATIONS
  // =========================================================================

  const savePartner = async (partnerData) => {
    setIsLoading(true);
    const item = { ...partnerData };
    if (!item.id) item.id = 'PRT-' + Math.floor(Math.random() * 9000 + 1000);
    item.profitShare = Number(item.profitShare || 0);

    updateDb(prev => {
      const partners = [...(prev.partners || [])];
      const idx = partners.findIndex(p => p.id === item.id);
      if (idx !== -1) {
        partners[idx] = { ...partners[idx], ...item };
      } else {
        partners.push(item);
      }

      // If partner is also a worker, sync unified profile in labourers
      let labourers = [...(prev.labourers || [])];
      if (item.isLabour) {
        const lbrIdx = labourers.findIndex(l => l.partnerId === item.id || l.name.toLowerCase() === item.name.toLowerCase());
        if (lbrIdx !== -1) {
          labourers[lbrIdx] = {
            ...labourers[lbrIdx],
            partnerId: item.id,
            name: item.name,
            phone: item.phone,
            jobRole: item.jobRole || labourers[lbrIdx].jobRole || 'Kitchen Staff',
            salaryType: item.salaryType || labourers[lbrIdx].salaryType || 'Monthly',
            salaryAmount: Number(item.salaryAmount ?? labourers[lbrIdx].salaryAmount ?? 15000),
            status: item.status || 'Active'
          };
        } else {
          labourers.push({
            id: 'LBR-' + Math.floor(Math.random() * 9000 + 1000),
            partnerId: item.id,
            name: item.name,
            phone: item.phone,
            jobRole: item.jobRole || 'Kitchen Staff',
            salaryType: item.salaryType || 'Monthly',
            salaryAmount: Number(item.salaryAmount || 15000),
            workingDays: 26,
            status: item.status || 'Active',
            joiningDate: item.joiningDate || new Date().toISOString().split('T')[0]
          });
        }
      }

      return { ...prev, partners, labourers };
    });

    showToast(`Partner profile for ${item.name} saved!`, 'success');
    setIsLoading(false);

    try {
      await api.savePartner(item);
    } catch (err) {
      console.warn('Sync partner error:', err);
    }
    return item;
  };

  const deletePartner = async (partnerId) => {
    setIsLoading(true);
    updateDb(prev => {
      const partners = (prev.partners || []).filter(p => p.id !== partnerId);
      const labourers = (prev.labourers || []).map(l => l.partnerId === partnerId ? { ...l, partnerId: null } : l);
      return { ...prev, partners, labourers };
    });
    showToast('Partner profile removed.', 'success');
    setIsLoading(false);
    try {
      await api.deletePartner(partnerId);
    } catch (err) {
      console.warn('Delete partner error:', err);
    }
  };

  const recordPartnerWithdrawal = async ({ partnerId, partnerName, amount, paymentMethod = 'Cash', date, notes = '' }) => {
    setIsLoading(true);
    const numAmount = Number(amount || 0);
    const withdrawalId = 'WITHDRAW-' + Date.now();
    const withdrawDate = date || new Date().toISOString();

    const withdrawalEntry = {
      id: withdrawalId,
      partnerId,
      partnerName,
      date: withdrawDate,
      amount: numAmount,
      paymentMethod,
      notes: notes || `Partner profit withdrawal by ${partnerName}`
    };

    const txnPayload = {
      id: 'TXN-' + Date.now(),
      date: withdrawDate,
      flow: 'OUT',
      type: 'Partner Drawing',
      partyName: partnerName,
      reference: withdrawalId,
      amount: numAmount,
      paymentMethod,
      notes: `Partner Withdrawal: ${partnerName}`
    };

    updateDb(prev => {
      const nextWithdrawals = [withdrawalEntry, ...(prev.partnerWithdrawals || [])];
      const nextTxns = [txnPayload, ...(prev.transactions || [])];
      return { ...prev, partnerWithdrawals: nextWithdrawals, transactions: nextTxns };
    });

    showToast(`Recorded profit withdrawal of ${data.settings?.currencySymbol || '₹'}${numAmount} for ${partnerName}!`, 'success');
    setIsLoading(false);

    try {
      await api.recordPartnerWithdrawal(withdrawalEntry);
      await api.saveRow('Transactions', txnPayload);
    } catch (err) {
      console.warn('Background sync withdrawal error:', err);
    }
  };

  const deletePartnerWithdrawal = async (withdrawalId) => {
    setIsLoading(true);
    updateDb(prev => {
      const nextWithdrawals = (prev.partnerWithdrawals || []).filter(w => w.id !== withdrawalId);
      const nextTxns = (prev.transactions || []).filter(t => t.reference !== withdrawalId);
      return { ...prev, partnerWithdrawals: nextWithdrawals, transactions: nextTxns };
    });
    showToast('Partner withdrawal record removed.', 'success');
    setIsLoading(false);
    try {
      await api.deletePartnerWithdrawal(withdrawalId);
    } catch (err) {
      console.warn('Delete withdrawal error:', err);
    }
  };

  // =========================================================================
  // LABOUR MANAGEMENT OPERATIONS
  // =========================================================================

  const saveLabourer = async (labourData) => {
    setIsLoading(true);
    const item = { ...labourData };
    if (!item.id) item.id = 'LBR-' + Math.floor(Math.random() * 9000 + 1000);
    item.salaryAmount = Number(item.salaryAmount || 0);

    updateDb(prev => {
      const labourers = [...(prev.labourers || [])];
      const idx = labourers.findIndex(l => l.id === item.id);
      if (idx !== -1) {
        labourers[idx] = { ...labourers[idx], ...item };
      } else {
        labourers.push(item);
      }

      // If linked to partner, sync basic details in partners
      let partners = [...(prev.partners || [])];
      if (item.partnerId) {
        const pIdx = partners.findIndex(p => p.id === item.partnerId);
        if (pIdx !== -1) {
          partners[pIdx] = {
            ...partners[pIdx],
            isLabour: true,
            jobRole: item.jobRole,
            salaryType: item.salaryType,
            salaryAmount: item.salaryAmount
          };
        }
      }

      return { ...prev, labourers, partners };
    });

    showToast(`Labour profile for ${item.name} saved!`, 'success');
    setIsLoading(false);

    try {
      await api.saveLabourer(item);
    } catch (err) {
      console.warn('Sync labourer error:', err);
    }
    return item;
  };

  const deleteLabourer = async (labourId) => {
    setIsLoading(true);
    updateDb(prev => {
      const target = (prev.labourers || []).find(l => l.id === labourId);
      const labourers = (prev.labourers || []).filter(l => l.id !== labourId);
      let partners = [...(prev.partners || [])];
      if (target?.partnerId) {
        partners = partners.map(p => p.id === target.partnerId ? { ...p, isLabour: false } : p);
      }
      return { ...prev, labourers, partners };
    });
    showToast('Labourer record removed.', 'success');
    setIsLoading(false);
    try {
      await api.deleteLabourer(labourId);
    } catch (err) {
      console.warn('Delete labourer error:', err);
    }
  };

  const recordSalaryPayment = async ({ labourId, labourName, amount, paymentMethod = 'Cash', date, month, notes = '' }) => {
    setIsLoading(true);
    const numAmount = Number(amount || 0);
    const paymentId = 'SALPAY-' + Date.now();
    const payDate = date || new Date().toISOString();
    const payMonth = month || new Date(payDate).toISOString().slice(0, 7);

    const paymentEntry = {
      id: paymentId,
      labourId,
      labourName,
      date: payDate,
      month: payMonth,
      amount: numAmount,
      paymentMethod,
      notes: notes || `Salary payment for ${payMonth}`
    };

    // Operating business expense entry (deducted before calculating distributable profit)
    const expenseEntry = {
      id: 'EXP-SAL-' + Date.now(),
      date: payDate,
      category: 'Salaries',
      amount: numAmount,
      paymentMethod,
      description: `Labour salary: ${labourName} (${payMonth})`
    };

    // Cash flow ledger entry
    const txnPayload = {
      id: 'TXN-' + Date.now(),
      date: payDate,
      flow: 'OUT',
      type: 'Expense',
      partyName: labourName,
      reference: paymentId,
      amount: numAmount,
      paymentMethod,
      notes: `Salary: ${labourName} (${payMonth})`
    };

    updateDb(prev => {
      const nextPayments = [paymentEntry, ...(prev.salaryPayments || [])];
      const nextExpenses = [expenseEntry, ...(prev.expenses || [])];
      const nextTxns = [txnPayload, ...(prev.transactions || [])];
      return { ...prev, salaryPayments: nextPayments, expenses: nextExpenses, transactions: nextTxns };
    });

    showToast(`Recorded salary payment of ${data.settings?.currencySymbol || '₹'}${numAmount} to ${labourName}!`, 'success');
    setIsLoading(false);

    try {
      await api.recordSalaryPayment(paymentEntry);
      await api.saveRow('Expenses', expenseEntry);
      await api.saveRow('Transactions', txnPayload);
    } catch (err) {
      console.warn('Background sync salary payment error:', err);
    }
  };

  const deleteSalaryPayment = async (paymentId) => {
    setIsLoading(true);
    updateDb(prev => {
      const nextPayments = (prev.salaryPayments || []).filter(p => p.id !== paymentId);
      const nextExpenses = (prev.expenses || []).filter(e => e.id !== `EXP-SAL-${paymentId.replace('SALPAY-', '')}` && !e.description?.includes(paymentId));
      const nextTxns = (prev.transactions || []).filter(t => t.reference !== paymentId);
      return { ...prev, salaryPayments: nextPayments, expenses: nextExpenses, transactions: nextTxns };
    });
    showToast('Salary payment record reversed.', 'success');
    setIsLoading(false);
    try {
      await api.deleteSalaryPayment(paymentId);
    } catch (err) {
      console.warn('Delete salary payment error:', err);
    }
  };

  const recordAttendance = async ({ labourId, labourName, date, status = 'Present', workingHours = 8, notes = '' }) => {
    const attId = `ATT-${labourId}-${date}`;
    const attEntry = {
      id: attId,
      labourId,
      labourName,
      date,
      status,
      workingHours: Number(workingHours || 8),
      notes
    };

    updateDb(prev => {
      const list = [...(prev.attendance || [])];
      const idx = list.findIndex(a => (a.labourId === labourId && a.date === date) || a.id === attId);
      if (idx !== -1) {
        list[idx] = attEntry;
      } else {
        list.unshift(attEntry);
      }
      return { ...prev, attendance: list };
    });

    showToast(`Attendance updated for ${labourName}!`, 'success');
    try {
      await api.recordAttendance(attEntry);
    } catch (err) {
      console.warn('Sync attendance error:', err);
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

  const clearAllDatabaseData = async () => {
    setIsLoading(true);
    try {
      await api.clearAllData();
      clearCart();
      setSelectedCustomer(null);
      setData(prev => ({
        ...prev,
        transactions: [],
        sales: [],
        products: [],
        rawMaterials: [],
        purchases: [],
        expenses: [],
        customers: [],
        suppliers: [],
        recipes: [],
        partnerWithdrawals: [],
        salaryPayments: [],
        attendance: []
      }));
      showToast('All data rows cleared from the site and Google Sheets!', 'success');
      await refreshData(true);
    } catch (err) {
      showToast('Error clearing database: ' + err.message, 'error');
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
      clearAllDatabaseData,
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
      resetAllStockToZero,
      saveRecipe,
      deleteRecipe,
      getRecipeForProduct,
      checkCartStockAvailability,
      refundAndRestockOrder,
      saveItem,
      deleteItem,
      saveSettings,
      setupGoogleSheets,
      restoreData,
      forceSyncFromSheets,
      savePartner,
      deletePartner,
      recordPartnerWithdrawal,
      deletePartnerWithdrawal,
      saveLabourer,
      deleteLabourer,
      recordSalaryPayment,
      deleteSalaryPayment,
      recordAttendance,
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

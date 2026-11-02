import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import {
  Package,
  UtensilsCrossed,
  Boxes,
  Plus,
  Minus,
  Trash2,
  Edit2,
  Eye,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sliders,
  TrendingUp,
  Tag,
  Search,
  ArrowRight,
  Calculator
} from 'lucide-react';

export const ItemManagement = () => {
  const { data, saveItem, deleteItem, adjustStock, showConfirmDialog, isLoading } = useApp();
  const [activeTab, setActiveTab] = useState('stock'); // 'stock', 'products', 'materials', 'categories'
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Category Look & Edit Management State
  const [editingCategory, setEditingCategory] = useState(null);
  const [isRenamingCategory, setIsRenamingCategory] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [newCategoryModalOpen, setNewCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState('products');

  const currency = data?.settings?.currencySymbol || '₹';
  const fmt = (val) => `${currency} ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Unified Inventory: Combines Menu Items (Products) and Raw Materials
  const unifiedStock = useMemo(() => {
    const list = [];

    (data?.products || []).forEach(p => {
      const stock = p.currentStock !== undefined && p.currentStock !== '' ? Number(p.currentStock) : 0;
      const min = Number(p.minStock || 5);
      let status = 'in_stock';
      if (stock <= 0) status = 'out_of_stock';
      else if (stock <= min) status = 'low_stock';

      list.push({
        id: p.code || p.id,
        code: p.code || p.id,
        name: p.name,
        category: p.category || 'Dishes',
        type: 'product',
        typeLabel: 'Menu Item',
        currentStock: stock,
        minStock: min,
        unit: p.unit || 'portion',
        costPrice: Number(p.costPrice || 0),
        sellingPrice: Number(p.sellingPrice || 0),
        image: p.image || '',
        status: p.status || 'Active',
        stockStatus: status,
        raw: p
      });
    });

    (data?.rawMaterials || []).forEach(rm => {
      const stock = rm.currentStock !== undefined && rm.currentStock !== '' ? Number(rm.currentStock) : 0;
      const min = Number(rm.minStock || 5);
      let status = 'in_stock';
      if (stock <= 0) status = 'out_of_stock';
      else if (stock <= min) status = 'low_stock';

      list.push({
        id: rm.id || rm.code,
        code: rm.id || rm.code,
        name: rm.name,
        category: rm.category || 'Ingredients',
        type: 'rawMaterial',
        typeLabel: 'Raw Material',
        currentStock: stock,
        minStock: min,
        unit: rm.unit || 'kg',
        costPrice: Number(rm.costPrice || 0),
        sellingPrice: 0,
        image: '',
        status: 'Active',
        stockStatus: status,
        raw: rm
      });
    });

    return list;
  }, [data]);

  // Grouped Categories Analysis (Dishes & Ingredients)
  const categoriesSummary = useMemo(() => {
    const map = new Map();

    (data?.products || []).forEach(p => {
      const cat = (p.category || 'Dishes').trim();
      if (!map.has(cat)) {
        map.set(cat, {
          name: cat,
          type: 'products',
          typeLabel: 'Menu Dishes',
          count: 0,
          items: [],
          totalStock: 0,
          minPrice: Infinity,
          maxPrice: 0
        });
      }
      const entry = map.get(cat);
      entry.count += 1;
      entry.items.push(p);
      entry.totalStock += Number(p.currentStock || 0);
      const price = Number(p.sellingPrice || 0);
      if (price < entry.minPrice) entry.minPrice = price;
      if (price > entry.maxPrice) entry.maxPrice = price;
    });

    (data?.rawMaterials || []).forEach(rm => {
      const cat = (rm.category || 'Ingredients').trim();
      if (!map.has(cat)) {
        map.set(cat, {
          name: cat,
          type: 'materials',
          typeLabel: 'Raw Materials',
          count: 0,
          items: [],
          totalStock: 0,
          minPrice: 0,
          maxPrice: 0
        });
      }
      const entry = map.get(cat);
      entry.count += 1;
      entry.items.push(rm);
      entry.totalStock += Number(rm.currentStock || 0);
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [data]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categoriesSummary;
    const term = categorySearch.toLowerCase();
    return categoriesSummary.filter(c => c.name.toLowerCase().includes(term));
  }, [categoriesSummary, categorySearch]);

  const handleSaveCategoryEdit = async (e) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.newName.trim()) return;
    const oldName = editingCategory.originalName;
    const newName = editingCategory.newName.trim();
    if (oldName === newName) {
      setEditingCategory(null);
      return;
    }

    setIsRenamingCategory(true);
    try {
      const matchingProducts = (data?.products || []).filter(p => (p.category || 'Dishes').trim() === oldName);
      for (const prod of matchingProducts) {
        await saveItem('Products', { ...prod, category: newName }, 'Menu Item');
      }

      const matchingMaterials = (data?.rawMaterials || []).filter(rm => (rm.category || 'Ingredients').trim() === oldName);
      for (const rm of matchingMaterials) {
        await saveItem('Raw Materials', { ...rm, category: newName }, 'Raw Material');
      }

      setEditingCategory(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRenamingCategory(false);
    }
  };

  const handleCreateNewCategory = (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const name = newCategoryName.trim();
    setNewCategoryModalOpen(false);
    handleOpenModal(null, newCategoryType);
    setEditingItem(prev => ({ ...prev, category: name }));
    setNewCategoryName('');
  };

  // Open "Look / View Details" Modal
  const handleOpenLookModal = (item) => {
    const rawData = item?.raw ? { ...item.raw } : { ...item };
    const isProduct = item?.type === 'product' || (rawData?.code && !rawData?.id?.startsWith('RM-'));
    const stock = rawData.currentStock !== undefined && rawData.currentStock !== '' ? Number(rawData.currentStock) : 0;
    const cost = Number(rawData.costPrice || 0);
    const totalAmount = rawData.totalAmount !== undefined && rawData.totalAmount !== '' 
      ? Number(rawData.totalAmount) 
      : Number((stock * cost).toFixed(2));

    setViewingItem({
      ...rawData,
      type: isProduct ? 'product' : 'rawMaterial',
      typeLabel: isProduct ? 'Menu Dish' : 'Raw Ingredient',
      currentStock: stock,
      minStock: Number(rawData.minStock || 5),
      unit: rawData.unit || (isProduct ? 'portion' : 'kg'),
      sellingPrice: Number(rawData.sellingPrice || 0),
      costPrice: cost,
      totalAmount
    });
  };

  // Open "Add / Edit" Modal
  const handleOpenModal = (item = null, forceType = null) => {
    const targetType = forceType || (activeTab === 'materials' ? 'materials' : 'products');

    if (item) {
      const rawData = item?.raw ? { ...item.raw } : { ...item };
      const isProduct = item.type === 'product' || (rawData.code && !rawData.id?.startsWith('RM-'));
      const stock = rawData.currentStock !== undefined ? Number(rawData.currentStock) : 0;
      const cost = rawData.costPrice !== undefined ? Number(rawData.costPrice) : 0;
      const calcTotal = Number((stock * cost).toFixed(2));
      const existingTotal = rawData.totalAmount !== undefined && rawData.totalAmount !== '' ? Number(rawData.totalAmount) : calcTotal;

      setEditingItem({
        ...rawData,
        id: rawData.id || rawData.code,
        code: rawData.code || rawData.id,
        currentStock: rawData.currentStock !== undefined ? String(rawData.currentStock) : '0',
        minStock: rawData.minStock !== undefined ? String(rawData.minStock) : '5',
        sellingPrice: rawData.sellingPrice !== undefined ? String(rawData.sellingPrice) : '0',
        costPrice: rawData.costPrice !== undefined ? String(rawData.costPrice) : '0',
        totalAmount: existingTotal > 0 ? String(existingTotal) : '',
        unit: rawData.unit || (isProduct ? 'portion' : 'kg'),
        _itemType: isProduct ? 'products' : 'materials'
      });
    } else {
      setEditingItem(
        targetType === 'products'
          ? {
              name: '',
              category: 'Dishes',
              sellingPrice: '',
              costPrice: '',
              currentStock: '20',
              minStock: '5',
              unit: 'portion',
              image: '',
              status: 'Active',
              _itemType: 'products'
            }
          : {
              name: '',
              category: 'Ingredients',
              unit: 'kg',
              costPrice: '',
              currentStock: '',
              totalAmount: '',
              minStock: '5',
              _itemType: 'materials'
            }
      );
    }
    setModalOpen(true);
  };

  // Dynamic 2-way auto-calculation for Raw Materials
  const handleMaterialQtyChange = (val) => {
    setEditingItem(prev => {
      const qty = val;
      const cost = prev.costPrice;
      let total = prev.totalAmount;
      if (qty !== '' && cost !== '' && !isNaN(Number(qty)) && !isNaN(Number(cost))) {
        total = String(Number((Number(qty) * Number(cost)).toFixed(2)));
      } else if (qty !== '' && total !== '' && !isNaN(Number(qty)) && Number(qty) > 0 && !isNaN(Number(total))) {
        const calculatedCost = String(Number((Number(total) / Number(qty)).toFixed(2)));
        return { ...prev, currentStock: qty, costPrice: calculatedCost };
      }
      return { ...prev, currentStock: qty, totalAmount: total };
    });
  };

  const handleMaterialCostChange = (val) => {
    setEditingItem(prev => {
      const cost = val;
      const qty = prev.currentStock;
      let total = prev.totalAmount;
      if (cost !== '' && qty !== '' && !isNaN(Number(cost)) && !isNaN(Number(qty))) {
        total = String(Number((Number(qty) * Number(cost)).toFixed(2)));
      }
      return { ...prev, costPrice: cost, totalAmount: total };
    });
  };

  const handleMaterialTotalChange = (val) => {
    setEditingItem(prev => {
      const total = val;
      const qty = prev.currentStock;
      let cost = prev.costPrice;
      if (total !== '' && qty !== '' && !isNaN(Number(total)) && !isNaN(Number(qty)) && Number(qty) > 0) {
        cost = String(Number((Number(total) / Number(qty)).toFixed(2)));
      }
      return { ...prev, totalAmount: total, costPrice: cost };
    });
  };

  const handleOpenAdjust = (item) => {
    const rawData = item?.raw ? { ...item.raw } : { ...item };
    setAdjustTarget({
      ...rawData,
      type: item.type || (rawData.code ? 'product' : 'rawMaterial'),
      typeLabel: item.type === 'product' || rawData.code ? 'Menu Product' : 'Raw Material'
    });
    setAdjustDelta('');
    setAdjustNotes('');
    setAdjustModalOpen(true);
  };

  const handleQuickAdjust = async (item, delta) => {
    try {
      await adjustStock(item.id || item.code, delta, undefined, item.type, 'Quick UI adjustment');
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmAdjust = async (e) => {
    e.preventDefault();
    if (!adjustTarget || adjustDelta === '') return;

    try {
      const numDelta = Number(adjustDelta);
      await adjustStock(adjustTarget.id || adjustTarget.code, numDelta, undefined, adjustTarget.type, adjustNotes);
      setAdjustModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setEditingItem(prev => ({ ...prev, image: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const isProduct = editingItem._itemType === 'products';
    const isUpdate = Boolean(editingItem.id || editingItem.code);
    const label = isProduct ? 'Menu Item' : 'Raw Material';

    const executeSave = async () => {
      const sheetName = isProduct ? 'Products' : 'Raw Materials';
      const payload = { ...editingItem };
      delete payload._itemType;

      if (!payload.id && !payload.code) {
        if (isProduct) payload.code = 'PRD-' + Math.floor(Math.random() * 9000 + 1000);
        else payload.id = 'RM-' + Math.floor(Math.random() * 9000 + 1000);
      }

      if (isProduct) {
        payload.sellingPrice = Number(payload.sellingPrice || 0);
        payload.costPrice = Number(payload.costPrice || 0);
        payload.currentStock = Number(payload.currentStock || 0);
        payload.minStock = Number(payload.minStock || 5);
        payload.unit = payload.unit || 'portion';
        payload.status = payload.status || 'Active';
      } else {
        payload.currentStock = Number(payload.currentStock || 0);
        let cost = Number(payload.costPrice || 0);
        let total = Number(payload.totalAmount || 0);
        if (cost === 0 && total > 0 && payload.currentStock > 0) {
          cost = Number((total / payload.currentStock).toFixed(2));
        }
        if (total === 0 && cost > 0 && payload.currentStock > 0) {
          total = Number((payload.currentStock * cost).toFixed(2));
        }
        payload.costPrice = cost;
        payload.totalAmount = total;
        payload.minStock = Number(payload.minStock || 5);
        payload.unit = payload.unit || 'kg';
      }

      await saveItem(sheetName, payload, label);
      setModalOpen(false);
    };

    if (isUpdate) {
      showConfirmDialog({
        title: `Update ${label}`,
        itemName: editingItem.name,
        message: `Are you sure you want to save updates to "${editingItem.name}"?`,
        type: 'update',
        confirmText: 'Yes, Save Changes',
        onConfirm: executeSave
      });
    } else {
      await executeSave();
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Items & Stock Inventory</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time kitchen inventory counts, menu products, and raw ingredient restocking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleOpenModal(null, 'products')}
            variant="primary"
            icon={Plus}
            className="bg-indigo-600 hover:bg-indigo-700 text-xs shadow-xs"
          >
            Add Menu Item
          </Button>
          <Button
            onClick={() => handleOpenModal(null, 'materials')}
            variant="outline"
            icon={Plus}
            className="text-xs border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
          >
            Add Raw Material
          </Button>
        </div>
      </div>

      {/* Modern Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 sm:p-1.5 rounded-2xl w-full sm:w-max border border-slate-200/80 dark:border-slate-700/80 gap-1 overflow-x-auto max-w-full scrollbar-none">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'stock'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Boxes className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>All Stock & Items ({unifiedStock.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'products'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span>Menu Items / Dishes ({data?.products?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'materials'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Raw Materials / Ingredients ({data?.rawMaterials?.length || 0})</span>
        </button>

        <button
          onClick={() => { setActiveTab('categories'); setCategoryFilter(''); }}
          className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'categories'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Categories ({categoriesSummary.length})</span>
        </button>
      </div>

      {/* Category Active Filter Banner */}
      {categoryFilter && activeTab !== 'categories' && (
        <div className="flex items-center gap-2 p-2 px-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-300 w-fit">
          <span>Filtering by category: <strong>{categoryFilter}</strong></span>
          <button
            onClick={() => setCategoryFilter('')}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline ml-1"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Main Table Views */}
      <div className="space-y-4">
        {activeTab === 'stock' && (
          <Table
            columns={[
              {
                header: 'Item Details',
                accessor: 'name',
                render: (r) => (
                  <div className="flex items-center gap-3">
                    {r.image ? (
                      <img src={r.image} className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-bold shrink-0">
                        {r.type === 'product' ? <UtensilsCrossed className="w-4 h-4 text-purple-500" /> : <Package className="w-4 h-4 text-amber-500" />}
                      </div>
                    )}
                    <div>
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white block">{r.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-slate-400 font-bold">{r.code}</span>
                        <span className="text-[10px] text-slate-400">• {r.category}</span>
                      </div>
                    </div>
                  </div>
                )
              },
              {
                header: 'Category & Type',
                accessor: 'typeLabel',
                render: (r) => (
                  <Badge variant={r.type === 'product' ? 'info' : 'warning'}>
                    {r.typeLabel}
                  </Badge>
                )
              },
              {
                header: 'Current Stock',
                accessor: 'currentStock',
                render: (r) => {
                  const isOut = r.stockStatus === 'out_of_stock';
                  const isLow = r.stockStatus === 'low_stock';

                  return (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-black ${isOut ? 'text-rose-600' : isLow ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                          {r.currentStock} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{r.unit}</span>
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">Min alert: {r.minStock} {r.unit}</span>
                    </div>
                  );
                }
              },
              {
                header: 'Stock Status',
                accessor: 'stockStatus',
                render: (r) => {
                  if (r.stockStatus === 'out_of_stock') {
                    return (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                        <XCircle className="w-3.5 h-3.5" /> Out of Stock
                      </span>
                    );
                  }
                  if (r.stockStatus === 'low_stock') {
                    return (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" /> In Stock
                    </span>
                  );
                }
              },
              {
                header: 'Quick Adjust',
                accessor: 'quickAdjust',
                render: (r) => (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleQuickAdjust(r, -1)}
                      title="Deduct 1 unit"
                      className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-colors font-bold text-xs"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleQuickAdjust(r, 1)}
                      title="Add 1 unit"
                      className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-colors font-bold text-xs"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleOpenAdjust(r)}
                      title="Set custom stock amount"
                      className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white flex items-center gap-1 text-[11px] font-bold transition-colors"
                    >
                      <Sliders className="w-3 h-3" /> Set
                    </button>
                  </div>
                )
              },
              {
                header: 'Actions (Look / Edit)',
                accessor: 'actions',
                render: (r) => (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {/* Dedicated Look / View Button */}
                    <button
                      onClick={() => handleOpenLookModal(r)}
                      title="Look / View Item Details"
                      className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Dedicated Edit Button */}
                    <button
                      onClick={() => handleOpenModal(r.raw || r)}
                      title="Edit Item"
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => {
                        const sheet = r.type === 'product' ? 'Products' : 'Raw Materials';
                        const label = r.type === 'product' ? 'Menu Item' : 'Raw Material';
                        showConfirmDialog({
                          title: `Delete ${label}`,
                          itemName: r.name,
                          message: `Are you sure you want to permanently delete "${r.name}"? This action cannot be undone.`,
                          type: 'delete',
                          confirmText: 'Yes, Delete',
                          onConfirm: () => deleteItem(sheet, r.code, label)
                        });
                      }}
                      title="Delete Item"
                      className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              }
            ]}
            data={categoryFilter ? unifiedStock.filter(item => (item.category || '').trim() === categoryFilter) : unifiedStock}
            onRowClick={(row) => handleOpenLookModal(row)}
            searchPlaceholder="Search all inventory & items by name, code, category..."
            emptyMessage="No stock items found. Add menu dishes or kitchen raw materials above!"
          />
        )}

        {activeTab === 'products' && (
          <Table
            columns={[
              {
                header: 'Photo',
                accessor: 'image',
                render: (r) => r.image ? (
                  <img src={r.image} className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0" alt="" />
                ) : (
                  <img src={data?.settings?.logo || '/logo.jpg'} className="w-10 h-10 rounded-xl object-cover ring-1 ring-amber-400/40 shrink-0 shadow-2xs" alt="" />
                )
              },
              {
                header: 'Item Code',
                accessor: 'code',
                render: (r) => <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{r.code}</span>
              },
              {
                header: 'Item Name',
                accessor: 'name',
                render: (r) => (
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white block">{r.name}</span>
                    <span className="text-xs text-slate-400">{r.category || 'General'}</span>
                  </div>
                )
              },
              {
                header: 'Current Stock',
                accessor: 'currentStock',
                render: (r) => {
                  const stock = Number(r.currentStock || 0);
                  const isLow = stock <= Number(r.minStock || 5);
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className={`font-black text-sm ${isLow ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-white'}`}>
                        {stock} {r.unit || 'portion'}
                      </span>
                      {isLow && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" title="Low stock alert" />}
                    </div>
                  );
                }
              },
              {
                header: 'Selling Price',
                accessor: 'sellingPrice',
                render: (r) => <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">{fmt(r.sellingPrice)}</span>
              },
              {
                header: 'Cost Price',
                accessor: 'costPrice',
                render: (r) => <span className="text-xs text-slate-500 font-bold">{fmt(r.costPrice)}</span>
              },
              {
                header: 'Status',
                accessor: 'status',
                render: (r) => <Badge variant={r.status === 'Active' || !r.status ? 'success' : 'default'}>{r.status || 'Active'}</Badge>
              },
              {
                header: 'Actions (Look / Edit)',
                accessor: 'actions',
                render: (r) => (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleOpenLookModal(r)}
                      title="Look / View Item Details"
                      className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenModal(r, 'products')}
                      title="Edit Item"
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenAdjust(r)}
                      title="Adjust Stock"
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <Sliders className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        showConfirmDialog({
                          title: 'Delete Menu Item',
                          itemName: r.name,
                          message: `Are you sure you want to permanently delete menu item "${r.name}"? This action cannot be undone.`,
                          type: 'delete',
                          confirmText: 'Yes, Delete',
                          onConfirm: () => deleteItem('Products', r.code, 'Menu Item')
                        });
                      }}
                      title="Delete Item"
                      className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              }
            ]}
            data={categoryFilter ? (data?.products || []).filter(p => (p.category || 'Dishes').trim() === categoryFilter) : (data?.products || [])}
            onRowClick={(row) => handleOpenLookModal(row)}
            searchPlaceholder="Search menu items..."
            emptyMessage="No menu items registered yet. Add your first dish above!"
          />
        )}

        {activeTab === 'materials' && (
          <Table
            columns={[
              {
                header: 'Material ID',
                accessor: 'id',
                render: (r) => <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{r.id}</span>
              },
              {
                header: 'Material Name',
                accessor: 'name',
                render: (r) => (
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white block">{r.name}</span>
                    <span className="text-xs text-slate-400">{r.category || 'Ingredients'}</span>
                  </div>
                )
              },
              {
                header: 'Units Bought / Stock',
                accessor: 'currentStock',
                render: (r) => {
                  const isLow = Number(r.currentStock || 0) <= Number(r.minStock || 0);
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className={`font-black text-sm ${isLow ? 'text-rose-600' : 'text-slate-800 dark:text-white'}`}>
                        {r.currentStock || 0} {r.unit || 'kg'}
                      </span>
                      {isLow && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" title="Low stock threshold reached" />}
                    </div>
                  );
                }
              },
              {
                header: 'Cost / Unit',
                accessor: 'costPrice',
                render: (r) => <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{fmt(r.costPrice)} / {r.unit || 'kg'}</span>
              },
              {
                header: 'Total Amount',
                accessor: 'totalAmount',
                render: (r) => {
                  const total = Number(r.totalAmount || (Number(r.currentStock || 0) * Number(r.costPrice || 0)));
                  return (
                    <div>
                      <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 block">{fmt(total)}</span>
                      <span className="text-[10px] text-slate-400">Total Purchase Value</span>
                    </div>
                  );
                }
              },
              {
                header: 'Actions (Look / Edit)',
                accessor: 'actions',
                render: (r) => (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleOpenLookModal(r)}
                      title="Look / View Item Details"
                      className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenModal(r, 'materials')}
                      title="Edit Item"
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenAdjust(r)}
                      title="Adjust Stock"
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <Sliders className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        showConfirmDialog({
                          title: 'Delete Raw Material',
                          itemName: r.name,
                          message: `Are you sure you want to permanently delete raw material "${r.name}"? This action cannot be undone.`,
                          type: 'delete',
                          confirmText: 'Yes, Delete',
                          onConfirm: () => deleteItem('Raw Materials', r.id, 'Raw Material')
                        });
                      }}
                      title="Delete Item"
                      className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              }
            ]}
            data={categoryFilter ? (data?.rawMaterials || []).filter(rm => (rm.category || 'Ingredients').trim() === categoryFilter) : (data?.rawMaterials || [])}
            onRowClick={(row) => handleOpenLookModal(row)}
            searchPlaceholder="Search raw materials..."
            emptyMessage="No raw materials registered yet. Add chicken, oil, flour, etc.!"
          />
        )}

        {/* CATEGORY LOOK & MANAGEMENT VIEW */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs font-medium"
                />
              </div>

              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => setNewCategoryModalOpen(true)}
                className="text-xs"
              >
                + New Category
              </Button>
            </div>

            {/* Category Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCategories.map((cat, idx) => (
                <div
                  key={cat.name || idx}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                          cat.type === 'products'
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                        }`}>
                          {cat.type === 'products' ? <UtensilsCrossed className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                            {cat.name}
                          </h4>
                          <span className="text-[10px] font-bold uppercase text-slate-400">
                            {cat.typeLabel}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setEditingCategory({ originalName: cat.name, newName: cat.name, count: cat.count })}
                        title={`Edit category name: ${cat.name}`}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors shrink-0"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 my-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Total Items</span>
                        <span className="font-black text-sm text-slate-800 dark:text-slate-200">
                          {cat.count} {cat.count === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">
                          {cat.type === 'products' ? 'Price Range' : 'Current Stock'}
                        </span>
                        <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400 truncate block">
                          {cat.type === 'products'
                            ? (cat.minPrice !== Infinity ? `${fmt(cat.minPrice)} – ${fmt(cat.maxPrice)}` : '—')
                            : `${cat.totalStock} in stock`}
                        </span>
                      </div>
                    </div>

                    {/* Preview Images stack */}
                    <div className="flex items-center gap-1.5 overflow-hidden py-1">
                      {cat.items.slice(0, 4).map((item, iIdx) => (
                        <div
                          key={item.id || item.code || iIdx}
                          title={item.name}
                          className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shrink-0"
                        >
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400">
                              {item.name?.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                      ))}
                      {cat.items.length > 4 && (
                        <span className="text-[10px] font-bold text-slate-400 px-1">
                          +{cat.items.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditingCategory({ originalName: cat.name, newName: cat.name, count: cat.count })}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Name</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab(cat.type);
                        setCategoryFilter(cat.name);
                      }}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-xs font-bold text-indigo-600 dark:text-indigo-400 transition-colors flex items-center justify-center gap-1"
                    >
                      <span>View Items</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {filteredCategories.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold">No categories match your search.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* LOOK / VIEW ITEM DETAILS MODAL */}
      {viewingItem && (
        <Modal
          isOpen={Boolean(viewingItem)}
          onClose={() => setViewingItem(null)}
          title={`Item Details — ${viewingItem.name}`}
        >
          <div className="space-y-5 pt-2">
            {/* Top Overview Card */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
              {viewingItem.image ? (
                <img src={viewingItem.image} alt={viewingItem.name} className="w-24 h-24 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm shrink-0" />
              ) : (
                <img src={data?.settings?.logo || '/logo.jpg'} alt="Boxy Logo" className="w-24 h-24 rounded-2xl object-cover ring-2 ring-amber-400/50 shadow-md shrink-0" />
              )}

              <div className="flex-1 text-center sm:text-left min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                  <Badge variant={viewingItem.type === 'product' ? 'info' : 'warning'}>
                    {viewingItem.typeLabel || (viewingItem.type === 'product' ? 'Menu Item' : 'Raw Material')}
                  </Badge>
                  <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    {viewingItem.code || viewingItem.id}
                  </span>
                  <Badge variant={viewingItem.status === 'Active' || !viewingItem.status ? 'success' : 'default'}>
                    {viewingItem.status || 'Active'}
                  </Badge>
                </div>

                <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                  {viewingItem.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-center sm:justify-start gap-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400" /> Category: <strong className="text-slate-700 dark:text-slate-300">{viewingItem.category || 'General'}</strong>
                </p>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Current Stock / Units Bought */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  {viewingItem.type === 'product' ? 'Current Stock' : 'Units Bought / Stock'}
                </span>
                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 block mt-0.5">
                  {viewingItem.currentStock} <span className="text-xs font-bold text-slate-500">{viewingItem.unit}</span>
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Min threshold: {viewingItem.minStock} {viewingItem.unit}</span>
              </div>

              {/* Selling Price (if product) */}
              {viewingItem.type === 'product' && (
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Selling Price</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
                    {fmt(viewingItem.sellingPrice)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">Customer bill price</span>
                </div>
              )}

              {/* Cost Price / Cost per Unit */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  {viewingItem.type === 'product' ? 'Cost Price' : 'Cost / Unit'}
                </span>
                <span className="text-xl font-black text-slate-800 dark:text-slate-200 block mt-0.5">
                  {fmt(viewingItem.costPrice)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">Cost per {viewingItem.unit}</span>
              </div>

              {/* Total Amount (for Raw Materials) */}
              {viewingItem.type !== 'product' && (
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Amount</span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
                    {fmt(Number(viewingItem.totalAmount || (viewingItem.currentStock * viewingItem.costPrice)))}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">Total purchase value</span>
                </div>
              )}

              {/* Margin & Profit (for Menu Items) */}
              {viewingItem.type === 'product' && viewingItem.sellingPrice > 0 && (
                <div className="col-span-2 sm:col-span-3 p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/60 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" /> Gross Profit Margin
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 block">
                      Profit per unit: <strong className="text-slate-900 dark:text-white">{fmt(viewingItem.sellingPrice - viewingItem.costPrice)}</strong>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                      {Math.round(((viewingItem.sellingPrice - viewingItem.costPrice) / viewingItem.sellingPrice) * 100)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Purchase Breakdown Banner (for Raw Materials) */}
              {viewingItem.type !== 'product' && (
                <div className="col-span-2 sm:col-span-3 p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" /> Purchase Breakdown
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 block">
                      {viewingItem.currentStock} {viewingItem.unit} purchased at {fmt(viewingItem.costPrice)} per {viewingItem.unit}
                    </span>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-[11px] text-slate-400 block font-bold uppercase tracking-wider">Total Purchase Value</span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {fmt(Number(viewingItem.totalAmount || (viewingItem.currentStock * viewingItem.costPrice)))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons inside View Modal */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const target = viewingItem;
                    setViewingItem(null);
                    handleOpenAdjust(target);
                  }}
                  icon={Sliders}
                  className="text-xs"
                >
                  Adjust Stock
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const target = viewingItem;
                    setViewingItem(null);
                    handleOpenModal(target);
                  }}
                  icon={Edit2}
                  className="bg-indigo-600 hover:bg-indigo-700 text-xs"
                >
                  Edit Item
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewingItem(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Quick Stock Adjustment Modal */}
      {adjustModalOpen && adjustTarget && (
        <Modal
          isOpen={adjustModalOpen}
          onClose={() => setAdjustModalOpen(false)}
          title={`Adjust Stock — ${adjustTarget.name}`}
        >
          <form onSubmit={handleConfirmAdjust} className="space-y-4 pt-2">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block">Current Inventory</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {adjustTarget.currentStock} {adjustTarget.unit}
                </span>
              </div>
              <Badge variant={adjustTarget.type === 'product' ? 'info' : 'warning'}>
                {adjustTarget.typeLabel}
              </Badge>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Stock Change (+ or -)
              </label>
              <input
                type="number"
                step="any"
                required
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                placeholder="e.g. +20 (new batch) or -5 (damage/spoilage)"
                className="w-full px-3.5 py-2.5 text-base bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-indigo-600"
              />
              <div className="flex gap-2 mt-2">
                {[-10, -5, -1, 1, 5, 10, 25].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAdjustDelta(String(val))}
                    className="flex-1 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white transition-colors"
                  >
                    {val > 0 ? `+${val}` : val}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Adjustment Reason / Note (Optional)
              </label>
              <input
                type="text"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="e.g. Fresh morning cooking, wastage, physical count correction"
                className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="ghost" onClick={() => setAdjustModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" isLoading={isLoading}>Apply Stock Change</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && editingItem && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingItem.id || editingItem.code ? `Edit ${editingItem._itemType === 'products' ? 'Menu Item' : 'Raw Material'}` : `Add New ${editingItem._itemType === 'products' ? 'Menu Item' : 'Raw Material'}`}
        >
          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* Item Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {editingItem._itemType === 'products' ? 'Item Name *' : 'Raw Material Name *'}
              </label>
              <input
                type="text"
                required
                value={editingItem.name || ''}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                placeholder={editingItem._itemType === 'products' ? 'e.g. Classic Shawarma Box' : 'e.g. maidha, fresh chicken, cooking oil...'}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              />
            </div>

            {editingItem._itemType === 'products' ? (
              /* MENU ITEM FORM FIELDS */
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                    <input
                      type="text"
                      value={editingItem.category || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                      placeholder="Shawarma"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Selling Price ({currency}) *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={editingItem.sellingPrice || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, sellingPrice: e.target.value })}
                      placeholder="120.00"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cost Price ({currency})</label>
                    <input
                      type="number"
                      step="any"
                      value={editingItem.costPrice || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, costPrice: e.target.value })}
                      placeholder="60.00"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                    <select
                      value={editingItem.status || 'Active'}
                      onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Current Stock</label>
                    <input
                      type="number"
                      step="any"
                      value={editingItem.currentStock || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, currentStock: e.target.value })}
                      placeholder="20"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Min Alert Level</label>
                    <input
                      type="number"
                      step="any"
                      value={editingItem.minStock || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, minStock: e.target.value })}
                      placeholder="5"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Unit</label>
                    <select
                      value={editingItem.unit || 'portion'}
                      onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                    >
                      <option value="portion">portion</option>
                      <option value="box">box</option>
                      <option value="plate">plate</option>
                      <option value="pcs">pcs</option>
                      <option value="can">can</option>
                      <option value="bottle">bottle</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Item Photo (Optional)</label>
                  <div className="flex items-center gap-3">
                    {editingItem.image && (
                      <img src={editingItem.image} className="w-12 h-12 rounded-xl object-cover border" alt="" />
                    )}
                    <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 flex items-center gap-2">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Image</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                    {editingItem.image && (
                      <button
                        type="button"
                        onClick={() => setEditingItem({ ...editingItem, image: '' })}
                        className="text-xs text-rose-500 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* RAW MATERIAL FORM FIELDS */
              <>
                {/* Category & Unit of Measure */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                    <input
                      type="text"
                      value={editingItem.category || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                      placeholder="e.g. Ingredients"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Unit of Measure</label>
                    <select
                      value={editingItem.unit || 'kg'}
                      onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                    >
                      <option value="kg">kg (Kilograms)</option>
                      <option value="g">g (Grams)</option>
                      <option value="ltr">ltr (Liters)</option>
                      <option value="ml">ml (Milliliters)</option>
                      <option value="pkt">pkt (Packets)</option>
                      <option value="pcs">pcs (Pieces)</option>
                      <option value="box">box (Boxes)</option>
                      <option value="can">can (Cans)</option>
                      <option value="bottle">bottle (Bottles)</option>
                      <option value="portion">portion</option>
                    </select>
                  </div>
                </div>

                {/* Dedicated Purchase & Stock Calculation Card */}
                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/90 dark:border-amber-800/60 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Purchase & Cost Details
                    </span>
                    <span className="text-[10px] text-amber-700/80 dark:text-amber-400 font-semibold bg-amber-100/80 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                      ⚡ Auto-calculates both ways
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 1. How many units bought / quantity */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Units Bought ({editingItem.unit || 'kg'}) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={editingItem.currentStock ?? ''}
                        onChange={(e) => handleMaterialQtyChange(e.target.value)}
                        placeholder="e.g. 20"
                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-amber-400"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Quantity bought</span>
                    </div>

                    {/* 2. Cost per unit */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Cost / Unit ({currency}) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={editingItem.costPrice ?? ''}
                        onChange={(e) => handleMaterialCostChange(e.target.value)}
                        placeholder="e.g. 20.00"
                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-amber-400"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Price per {editingItem.unit || 'kg'}</span>
                    </div>

                    {/* 3. Total Amount */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Total Amount ({currency}) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={editingItem.totalAmount ?? ''}
                        onChange={(e) => handleMaterialTotalChange(e.target.value)}
                        placeholder="e.g. 400.00"
                        className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-amber-400"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Total purchase cost</span>
                    </div>
                  </div>

                  {/* Live Calculation Preview Pill */}
                  <div className="pt-2.5 border-t border-amber-200/70 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-black">
                        {editingItem.currentStock || 0} {editingItem.unit || 'kg'}
                      </span>
                      <span>×</span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold">
                        {fmt(editingItem.costPrice || 0)}
                      </span>
                      <span>=</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-black text-sm">
                        {fmt(editingItem.totalAmount || (Number(editingItem.currentStock || 0) * Number(editingItem.costPrice || 0)))}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Units × Cost/Unit = Total Purchase Amount
                    </span>
                  </div>
                </div>

                {/* Min Alert Level */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Low Stock Alert Level ({editingItem.unit || 'kg'})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editingItem.minStock || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, minStock: e.target.value })}
                    placeholder="5"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Trigger low-stock notification when inventory falls below this amount
                  </span>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" isLoading={isLoading}>
                {editingItem.id || editingItem.code ? 'Save Changes' : (editingItem._itemType === 'products' ? 'Save Menu Item' : 'Save Raw Material')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT CATEGORY MODAL */}
      {editingCategory && (
        <Modal
          isOpen={Boolean(editingCategory)}
          onClose={() => setEditingCategory(null)}
          title={`Edit Category: ${editingCategory.originalName}`}
          subtitle="Rename this category across all associated inventory records"
        >
          <form onSubmit={handleSaveCategoryEdit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Category Name *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={editingCategory.newName}
                onChange={(e) => setEditingCategory({ ...editingCategory, newName: e.target.value })}
                placeholder="e.g. Shawarma, Burgers, Hot Drinks..."
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                Renaming will automatically update all <strong>{editingCategory.count}</strong> items currently assigned to "{editingCategory.originalName}".
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditingCategory(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isRenamingCategory} icon={CheckCircle2}>
                Save Category Name
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* CREATE NEW CATEGORY MODAL */}
      {newCategoryModalOpen && (
        <Modal
          isOpen={newCategoryModalOpen}
          onClose={() => setNewCategoryModalOpen(false)}
          title="Create New Category"
          subtitle="Add a new category classification for menu items or raw materials"
        >
          <form onSubmit={handleCreateNewCategory} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Category Name *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Desserts, Fresh Juices, Rice Bowls..."
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Category Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewCategoryType('products')}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                    newCategoryType === 'products'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Menu Items / Dishes
                </button>
                <button
                  type="button"
                  onClick={() => setNewCategoryType('materials')}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                    newCategoryType === 'materials'
                      ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Raw Materials / Ingredients
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setNewCategoryModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create & Add Item
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
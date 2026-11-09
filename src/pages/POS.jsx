import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Printer,
  Share2,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  UserCheck,
  X,
  RotateCcw,
  ChefHat,
  AlertTriangle,
  Download
} from 'lucide-react';
import { printOrderReceipt } from '../utils/receiptPrinter';
import { shareBillAsPNGViaWhatsApp, downloadBillPNG } from '../utils/billImageUtils';

export const POS = () => {
  const {
    data,
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
    checkCartStockAvailability,
    showToast,
    isLoading
  } = useApp();

  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [mobileViewTab, setMobileViewTab] = useState('menu'); // 'menu' or 'cart'
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [shortageWarning, setShortageWarning] = useState(null);

  const currency = data?.settings?.currencySymbol || '₹';
  const defaultTaxRate = Number(data?.settings?.taxRate ?? 0);
  const [posTaxRate, setPosTaxRate] = useState(defaultTaxRate);

  useEffect(() => {
    setPosTaxRate(Number(data?.settings?.taxRate ?? 0));
  }, [data?.settings?.taxRate]);

  const taxRate = Number(posTaxRate || 0);
  const fmt = (val) => `${currency} ${Number(val || 0).toFixed(2)}`;

  // Filter products by category and search
  const products = (data?.products || []).filter(p => p.status === 'Active' || !p.status);

  // Derive categories list from available products
  const productCategories = useMemo(() => {
    const cats = new Set(['ALL']);
    products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (p.code || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Cart calculations
  const subtotal = cart.reduce((sum, item) => sum + (Number(item.unitPrice || 0) * (Number(item.quantity) || 1)), 0);
  const discountVal = Number(discount) || 0;
  const taxableAmount = Math.max(0, subtotal - discountVal);
  const taxAmount = taxRate > 0 ? (taxableAmount * taxRate) / 100 : 0;
  const totalAmount = taxableAmount + taxAmount;

  const handleCheckout = () => {
    if (cart.length === 0) return;

    const invoiceNumber = 'INV-' + Math.floor(Math.random() * 90000 + 10000);
    const salePayload = {
      date: new Date().toISOString(),
      invoiceNumber,
      customerId: selectedCustomer ? selectedCustomer.id : 'WALKIN',
      customerName: selectedCustomer ? (selectedCustomer.shopName || selectedCustomer.name) : 'Walk-in Customer',
      subtotal,
      discount: discountVal,
      taxRate,
      taxAmount,
      totalAmount,
      paymentMethod,
      items: cart.map(item => ({
        ...item,
        quantity: Math.max(1, Number(item.quantity) || 1)
      }))
    };

    // Pre-checkout Kitchen Raw Material Validation
    if (checkCartStockAvailability) {
      const check = checkCartStockAvailability(cart);
      if (!check.isAvailable && check.shortages.length > 0) {
        setShortageWarning({
          shortages: check.shortages,
          salePayload
        });
        return;
      }
    }

    executeCheckout(salePayload);
  };

  const executeCheckout = async (salePayload) => {
    try {
      await recordPOSSale(salePayload);
      setLastOrder(salePayload);
      setReceiptModalOpen(true);
      setShortageWarning(null);
    } catch (e) {
      console.error('POS Checkout Error:', e);
    }
  };

  const [isSharingPNG, setIsSharingPNG] = useState(false);
  const [isDownloadingPNG, setIsDownloadingPNG] = useState(false);

  const handleSharePNGWhatsApp = async () => {
    if (!lastOrder) return;
    setIsSharingPNG(true);
    try {
      const res = await shareBillAsPNGViaWhatsApp(lastOrder, data?.settings, 'printable-receipt');
      if (res?.message) {
        showToast(res.message, res.success ? 'success' : 'info');
      }
    } catch (err) {
      showToast('Error generating bill image: ' + err.message, 'error');
    } finally {
      setIsSharingPNG(false);
    }
  };

  const handleDownloadPNG = async () => {
    if (!lastOrder) return;
    setIsDownloadingPNG(true);
    try {
      const filename = await downloadBillPNG(lastOrder, data?.settings, 'printable-receipt');
      showToast(`Bill image saved as ${filename}!`, 'success');
    } catch (err) {
      showToast('Error downloading image: ' + err.message, 'error');
    } finally {
      setIsDownloadingPNG(false);
    }
  };

  const printReceipt = () => {
    printOrderReceipt(lastOrder, data?.settings);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Mobile Switcher (Menu vs Cart) */}
      <div className="flex lg:hidden bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
        <button
          onClick={() => setMobileViewTab('menu')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all ${
            mobileViewTab === 'menu'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <span>Menu Grid ({filteredProducts.length})</span>
        </button>
        <button
          onClick={() => setMobileViewTab('cart')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all ${
            mobileViewTab === 'cart'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <span>Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
          {cart.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black">
              {fmt(totalAmount)}
            </span>
          )}
        </button>
      </div>

      {/* Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 7/8 Cols: Menu & Search */}
        <div className={`lg:col-span-7 xl:col-span-8 space-y-4 ${mobileViewTab === 'cart' ? 'hidden lg:block' : 'block'}`}>
          {/* Search Bar & Category Chips */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search menu items by name or code (e.g. Shawarma, Burger, PRD-1)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {productCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  {cat === 'ALL' ? 'All Items' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
            {filteredProducts.map(prod => {
              const inCart = cart.find(i => i.productCode === prod.code);
              return (
                <div
                  key={prod.code}
                  onClick={() => addToCart(prod)}
                  className={`group relative bg-white dark:bg-slate-900 rounded-2xl border p-3 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${
                    inCart 
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20' 
                      : 'border-slate-200/80 dark:border-slate-800 hover:border-indigo-400'
                  }`}
                >
                  <div>
                    <div className="w-full h-24 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden mb-2 relative">
                      {prod.image ? (
                        <img src={prod.image} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900/5 dark:bg-slate-800">
                          <img src={data?.settings?.logo || '/logo.jpg'} alt="Boxy Logo" className="w-12 h-12 rounded-xl object-cover opacity-85 group-hover:scale-110 transition-transform duration-200 shadow-2xs" />
                        </div>
                      )}
                      {/* Live Prep or Finished Stock Badge */}
                      {(() => {
                        const hasRecipe = (data?.recipes || []).some(r => String(r.productCode).trim() === String(prod.code || prod.id).trim());
                        if (hasRecipe) {
                          return (
                            <div className="absolute top-1.5 left-1.5">
                              <span className="px-2 py-0.5 rounded-full bg-rose-600/90 backdrop-blur-xs text-white text-[9px] font-black shadow-xs flex items-center gap-1">
                                <ChefHat className="w-2.5 h-2.5" /> Live Prep
                              </span>
                            </div>
                          );
                        }

                        if (prod.currentStock !== undefined && prod.currentStock !== '') {
                          if (Number(prod.currentStock) <= 0) return null;
                          return (
                            <div className="absolute top-1.5 left-1.5">
                              {Number(prod.currentStock) <= Number(prod.minStock || 5) ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black shadow-xs">
                                  {prod.currentStock} left
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-900/70 backdrop-blur-xs text-white text-[9px] font-bold shadow-xs">
                                  {prod.currentStock} {prod.unit || 'in stock'}
                                </span>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">{prod.name}</h4>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                      <span>{prod.code}</span>
                      <span className="text-[9px] uppercase font-bold text-slate-400">{prod.category || 'Dishes'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-black text-sm text-slate-900 dark:text-white">{fmt(prod.sellingPrice)}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); addToCart(prod); }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        inCart 
                          ? 'bg-indigo-600 text-white shadow-2xs' 
                          : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white'
                      }`}
                      title="Add to cart"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold">No menu items match your search.</p>
                <button onClick={() => navigate('/items')} className="text-xs text-indigo-600 font-bold mt-2 underline">
                  Add items in Item Management
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right 4/5 Cols: Cart & Checkout Drawer */}
        <div className={`lg:col-span-5 xl:col-span-4 ${mobileViewTab === 'menu' ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-4 space-y-4 sticky top-4">
            {/* Header: Customer Selector */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Customer</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white block">
                    {selectedCustomer ? (selectedCustomer.shopName || selectedCustomer.name) : 'Walk-in Customer'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {selectedCustomer && (
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Clear selected customer (revert to Walk-in)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCustomerModalOpen(true)}
                  className="text-xs h-7 px-2.5"
                >
                  Change
                </Button>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-60 sm:max-h-72 lg:max-h-[calc(100vh-420px)] overflow-y-auto pr-1">
              {cart.map(item => (
                <div key={item.productCode} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs gap-1.5">
                  <div className="flex-1 min-w-0 pr-1">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{item.productName}</p>
                    <p className="text-[10px] text-slate-400">{fmt(item.unitPrice)} each</p>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(item.productCode, -1)}
                      className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 transition-colors shrink-0"
                      title="Decrease quantity by 1"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => setCartQuantity(item.productCode, e.target.value)}
                      onBlur={() => {
                        if (!item.quantity || Number(item.quantity) < 1) {
                          setCartQuantity(item.productCode, 1);
                        }
                      }}
                      className="w-11 sm:w-12 text-center font-black text-xs py-1 px-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs shrink-0"
                      title="Type sale quantity"
                    />
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(item.productCode, 1)}
                      className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 transition-colors shrink-0"
                      title="Increase quantity by 1"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="w-14 sm:w-16 text-right font-black text-slate-900 dark:text-white shrink-0 truncate">
                      {fmt(item.unitPrice * (Number(item.quantity) || 1))}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productCode)}
                      className="text-slate-400 hover:text-rose-500 p-1 shrink-0"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="py-8 text-center text-slate-400">
                  <ShoppingBag className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                  <p className="text-xs font-medium">Cart is currently empty.</p>
                  <p className="text-[11px] text-slate-400">Tap items on the left to add.</p>
                </div>
              )}
            </div>

            {/* Discount & Payment Method */}
            {cart.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                {/* Discount Presets */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    <span>Discount</span>
                    <div className="flex items-center gap-1">
                      {[0, 5, 10].map(pct => {
                        const val = (subtotal * pct) / 100;
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setDiscount(val)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              discount === val ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {pct}%
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={discount || ''}
                      onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                    />
                  </div>
                </div>

                {/* Payment Methods */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">Payment Method</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'Cash', icon: Banknote, label: 'Cash' },
                      { id: 'UPI / Online', icon: QrCode, label: 'UPI / Card' },
                      { id: 'Credit', icon: CreditCard, label: 'Credit', disabled: !selectedCustomer }
                    ].map(m => {
                      const Icon = m.icon;
                      const isSelected = paymentMethod === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={m.disabled}
                          onClick={() => setPaymentMethod(m.id)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl text-[11px] font-bold transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : m.disabled
                              ? 'bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 mb-1" />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Financial Summary & Payable Section */}
                <div className="space-y-2 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Subtotal:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{fmt(subtotal)}</span>
                  </div>

                  {discountVal > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Discount:</span>
                      <span>-{fmt(discountVal)}</span>
                    </div>
                  )}

                  {/* GST Level Control in Payable Section */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-[11px] text-slate-700 dark:text-slate-300">GST Level:</span>
                        <div className="flex items-center gap-1">
                          {[0, 5, 12, 18].map(pct => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setPosTaxRate(pct)}
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-black transition-all ${
                                taxRate === pct
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                              }`}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom % input */}
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={posTaxRate === 0 ? '' : posTaxRate}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') setPosTaxRate(0);
                            else setPosTaxRate(Math.max(0, Number(val)));
                          }}
                          placeholder="0"
                          className="w-12 px-1.5 py-0.5 text-xs text-right font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-indigo-600 dark:text-indigo-400 focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] font-black text-slate-400">%</span>
                      </div>
                    </div>

                    {taxRate > 0 && (
                      <div className="flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                        <span>Tax / GST ({taxRate}%):</span>
                        <span>+{fmt(taxAmount)}</span>
                      </div>
                    )}
                  </div>

                  {/* Total Payable */}
                  <div className="flex justify-between items-baseline text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span>Total Payable:</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{fmt(totalAmount)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={clearCart}
                    className="flex-1 text-xs"
                    icon={RotateCcw}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleCheckout}
                    isLoading={isLoading}
                    className="flex-[2] text-xs font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-md shadow-indigo-500/20"
                    icon={CheckCircle2}
                  >
                    Complete ({fmt(totalAmount)})
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Picker Modal */}
      <Modal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        title="Select Customer for Order"
        subtitle="Choose a registered B2B client or keep default Walk-in"
      >
        <div className="space-y-3 pt-2">
          <div
            onClick={() => { setSelectedCustomer(null); setCustomerModalOpen(false); }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
              !selectedCustomer ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-white">Walk-in Customer (Default)</p>
              <p className="text-xs text-slate-500">Standard counter retail customer</p>
            </div>
            {!selectedCustomer && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {(data?.customers || []).map(cust => (
              <div
                key={cust.id}
                onClick={() => { setSelectedCustomer(cust); setCustomerModalOpen(false); }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  selectedCustomer?.id === cust.id ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">{cust.shopName || cust.name}</p>
                  <p className="text-xs text-slate-500">Contact: {cust.phone || 'No phone'} • Balance: <span className="font-bold text-amber-600">{fmt(cust.outstandingBalance)}</span></p>
                </div>
                {selectedCustomer?.id === cust.id && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" onClick={() => navigate('/customers')}>+ Add New Customer</Button>
          </div>
        </div>
      </Modal>

      {/* Thermal Receipt Print Modal */}
      {receiptModalOpen && lastOrder && (
        <Modal
          isOpen={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          title="Order Completed Successfully!"
          subtitle={`Invoice #${lastOrder.invoiceNumber}`}
        >
          <div className="space-y-4 pt-2">
            {/* 80mm Thermal Receipt Preview Card */}
            <div id="printable-receipt" className="p-5 bg-white text-slate-900 border border-slate-200 rounded-2xl font-mono text-xs shadow-inner space-y-3">
              <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3 flex flex-col items-center">
                <img src={data?.settings?.logo || '/logo.jpg'} alt="Logo" className="w-12 h-12 rounded-xl object-cover mb-2 ring-1 ring-amber-400/40 shadow-xs" />
                <h3 className="font-black text-sm tracking-wider uppercase">{data?.settings?.companyName || 'BOXY CLOUD KITCHEN'}</h3>
                <p className="text-[10px] text-slate-500">{data?.settings?.tagline || 'Est. 2022'}</p>
                <p className="text-[10px] text-slate-500">Invoice: #{lastOrder.invoiceNumber}</p>
                <p className="text-[10px] text-slate-500">Date: {new Date(lastOrder.date).toLocaleString('en-GB')}</p>
                <p className="text-[10px] text-slate-500">Client: {lastOrder.customerName}</p>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-slate-200">
                  <span>Item</span>
                  <span>Qty x Price</span>
                  <span>Amount</span>
                </div>
                {(lastOrder.items || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px]">
                    <span className="truncate max-w-[120px]">{item.productName}</span>
                    <span className="text-slate-500">{item.quantity} x {fmt(item.unitPrice)}</span>
                    <span className="font-bold">{fmt(item.quantity * item.unitPrice)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 pt-1 border-b border-dashed border-slate-300 pb-3 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{fmt(lastOrder.subtotal)}</span>
                </div>
                {lastOrder.discount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount:</span>
                    <span>-{fmt(lastOrder.discount)}</span>
                  </div>
                )}
                {Number(lastOrder.taxAmount || 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax / GST ({lastOrder.taxRate || taxRate}%):</span>
                    <span>{fmt(lastOrder.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Paid ({lastOrder.paymentMethod}):</span>
                  <span>{fmt(lastOrder.totalAmount)}</span>
                </div>
              </div>

              <div className="text-center pt-1 text-[10px] text-slate-500">
                <p>{data?.settings?.invoiceFooter || 'Thank you for your visit!'}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Printer}
                  onClick={printReceipt}
                  className="text-xs"
                >
                  Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  onClick={handleDownloadPNG}
                  isLoading={isDownloadingPNG}
                  className="text-xs"
                  title="Download receipt as PNG image"
                >
                  Save PNG
                </Button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="primary"
                  size="sm"
                  icon={Share2}
                  onClick={handleSharePNGWhatsApp}
                  isLoading={isSharingPNG}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20"
                >
                  Share Bill (PNG) via WhatsApp
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setReceiptModalOpen(false)}
                  className="text-xs"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* KITCHEN RAW MATERIAL SHORTAGE WARNING MODAL */}
      {shortageWarning && (
        <Modal
          isOpen={Boolean(shortageWarning)}
          onClose={() => setShortageWarning(null)}
          title="⚠️ Kitchen Raw Material Shortage Alert"
          subtitle="One or more ingredients in inventory are below the quantities needed to prepare this order."
        >
          <div className="space-y-4 pt-1">
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Insufficient Stock for Live Preparation</span>
              </div>
              <p className="text-[11px] text-amber-700/90 dark:text-amber-400">
                You can still proceed with Manager Override if more ingredients are being restocked, or adjust the cart quantities.
              </p>
            </div>

            {/* Shortages List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {shortageWarning.shortages.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                >
                  <div>
                    <h5 className="font-extrabold text-xs text-slate-900 dark:text-white">{item.rawMaterialName}</h5>
                    <span className="text-[11px] text-slate-400">
                      Required: <strong className="text-slate-700 dark:text-slate-300">{item.required} {item.unit}</strong> &bull; Available: <span className="text-rose-600 font-bold">{item.available} {item.unit}</span>
                    </span>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-black">
                    Short by {item.deficit} {item.unit}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShortageWarning(null)}
              >
                Adjust Order
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => executeCheckout(shortageWarning.salePayload)}
              >
                Proceed with Override
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Floating Bottom Cart Bar for Mobile View */}
      {cart.length > 0 && mobileViewTab === 'menu' && (
        <div className="lg:hidden fixed bottom-20 left-4 right-4 z-40 animate-slideUp">
          <button
            onClick={() => setMobileViewTab('cart')}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl shadow-xl flex items-center justify-between font-black text-xs sm:text-sm active:scale-98 transition-transform"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-xs font-black">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
              <span>View Cart & Checkout</span>
            </div>
            <span>{fmt(totalAmount)} &rarr;</span>
          </button>
        </div>
      )}
    </div>
  );
};

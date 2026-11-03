/**
 * Boxy Cloud Kitchen — Centralized Unit Conversion & Recipe Cost Engine
 * 
 * Accurately converts between recipe preparation units (e.g., grams, ml)
 * and inventory stocking units (e.g., kg, litres) for live food preparation.
 */

// Supported Unit Categories
export const UNIT_TYPES = {
  WEIGHT: 'weight',
  VOLUME: 'volume',
  COUNT: 'count'
};

// Unit Normalization & Mapping
export const UNIT_METADATA = {
  // Weight units (base: grams)
  g: { type: UNIT_TYPES.WEIGHT, baseMultiplier: 1, label: 'Grams (g)' },
  gram: { type: UNIT_TYPES.WEIGHT, baseMultiplier: 1, label: 'Grams (g)' },
  grams: { type: UNIT_TYPES.WEIGHT, baseMultiplier: 1, label: 'Grams (g)' },
  kg: { type: UNIT_TYPES.WEIGHT, baseMultiplier: 1000, label: 'Kilograms (kg)' },
  kilogram: { type: UNIT_TYPES.WEIGHT, baseMultiplier: 1000, label: 'Kilograms (kg)' },
  kilograms: { type: UNIT_TYPES.WEIGHT, baseMultiplier: 1000, label: 'Kilograms (kg)' },

  // Volume units (base: millilitres)
  ml: { type: UNIT_TYPES.VOLUME, baseMultiplier: 1, label: 'Millilitres (ml)' },
  millilitre: { type: UNIT_TYPES.VOLUME, baseMultiplier: 1, label: 'Millilitres (ml)' },
  millilitres: { type: UNIT_TYPES.VOLUME, baseMultiplier: 1, label: 'Millilitres (ml)' },
  ltr: { type: UNIT_TYPES.VOLUME, baseMultiplier: 1000, label: 'Litres (ltr)' },
  liter: { type: UNIT_TYPES.VOLUME, baseMultiplier: 1000, label: 'Litres (ltr)' },
  liters: { type: UNIT_TYPES.VOLUME, baseMultiplier: 1000, label: 'Litres (ltr)' },
  litre: { type: UNIT_TYPES.VOLUME, baseMultiplier: 1000, label: 'Litres (ltr)' },
  litres: { type: UNIT_TYPES.VOLUME, baseMultiplier: 1000, label: 'Litres (ltr)' },

  // Discrete / Count units (base: pieces)
  pcs: { type: UNIT_TYPES.COUNT, baseMultiplier: 1, label: 'Pieces (pcs)' },
  piece: { type: UNIT_TYPES.COUNT, baseMultiplier: 1, label: 'Pieces (pcs)' },
  pieces: { type: UNIT_TYPES.COUNT, baseMultiplier: 1, label: 'Pieces (pcs)' },
  pkt: { type: UNIT_TYPES.COUNT, baseMultiplier: 1, label: 'Packet (pkt)' },
  packet: { type: UNIT_TYPES.COUNT, baseMultiplier: 1, label: 'Packet (pkt)' },
  packets: { type: UNIT_TYPES.COUNT, baseMultiplier: 1, label: 'Packet (pkt)' },
  portion: { type: UNIT_TYPES.COUNT, baseMultiplier: 1, label: 'Portion' },
  portions: { type: UNIT_TYPES.COUNT, baseMultiplier: 1, label: 'Portion' },
  box: { type: UNIT_TYPES.COUNT, baseMultiplier: 1, label: 'Box' },
  boxes: { type: UNIT_TYPES.COUNT, baseMultiplier: 1, label: 'Box' },
  can: { type: UNIT_TYPES.COUNT, baseMultiplier: 1, label: 'Can' },
  cans: { type: UNIT_TYPES.COUNT, baseMultiplier: 1, label: 'Can' },
  bottle: { type: UNIT_TYPES.COUNT, baseMultiplier: 1, label: 'Bottle' },
  bottles: { type: UNIT_TYPES.COUNT, baseMultiplier: 1, label: 'Bottle' }
};

/**
 * Standardize unit string (lowercased, trimmed)
 */
export const normalizeUnit = (unit) => {
  if (!unit) return 'pcs';
  return String(unit).trim().toLowerCase();
};

/**
 * Check if two units are compatible for conversion
 */
export const areUnitsCompatible = (fromUnit, toUnit) => {
  const fromMeta = UNIT_METADATA[normalizeUnit(fromUnit)];
  const toMeta = UNIT_METADATA[normalizeUnit(toUnit)];

  if (!fromMeta || !toMeta) {
    // If not in catalog, treat as direct match if strings are equal
    return normalizeUnit(fromUnit) === normalizeUnit(toUnit);
  }

  return fromMeta.type === toMeta.type;
};

/**
 * Convert quantity from recipeUnit into rawMaterial stockUnit.
 * 
 * Example:
 *  - convertQuantity(200, 'g', 'kg') => 0.2 (200g is 0.2kg)
 *  - convertQuantity(1.5, 'kg', 'g') => 1500 (1.5kg is 1500g)
 *  - convertQuantity(50, 'ml', 'ltr') => 0.05 (50ml is 0.05ltr)
 *  - convertQuantity(2, 'pcs', 'pcs') => 2
 */
export const convertQuantity = (quantity, fromUnit, toUnit) => {
  const num = Number(quantity || 0);
  if (num === 0) return 0;

  const fUnit = normalizeUnit(fromUnit);
  const tUnit = normalizeUnit(toUnit);

  if (fUnit === tUnit) return num;

  const fromMeta = UNIT_METADATA[fUnit];
  const toMeta = UNIT_METADATA[tUnit];

  // If compatible within weight or volume, convert via base unit
  if (fromMeta && toMeta && fromMeta.type === toMeta.type) {
    const baseQuantity = num * fromMeta.baseMultiplier;
    const targetQuantity = baseQuantity / toMeta.baseMultiplier;
    return Number(targetQuantity.toFixed(4));
  }

  // Fallback for non-standard or discrete units
  return num;
};

/**
 * Calculate the cost of an ingredient for a given recipe portion
 * based on the raw material's purchase cost per stock unit.
 * 
 * Example:
 *  - Raw material chicken: ₹250 per 'kg'
 *  - Recipe requires: 100 'g'
 *  - Cost = 100g -> 0.1kg * ₹250 = ₹25.00
 */
export const calculateIngredientCost = (recipeQty, recipeUnit, stockCostPrice, stockUnit) => {
  const qtyInStockUnits = convertQuantity(recipeQty, recipeUnit, stockUnit);
  const cost = qtyInStockUnits * Number(stockCostPrice || 0);
  return Number(cost.toFixed(2));
};

/**
 * Returns available compatible units for a raw material's stock unit
 */
export const getCompatibleUnits = (stockUnit) => {
  const meta = UNIT_METADATA[normalizeUnit(stockUnit)];
  if (!meta) return [stockUnit];

  return Object.keys(UNIT_METADATA).filter(u => UNIT_METADATA[u].type === meta.type);
};


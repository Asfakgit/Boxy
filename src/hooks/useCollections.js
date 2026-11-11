import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

const COLLECTION_KEYS = [
  'sales', 'purchases', 'expenses', 'transactions',
  'products', 'rawMaterials', 'recipes',
  'customers', 'suppliers',
  'partners', 'partnerWithdrawals', 'labourers', 'salaryPayments', 'attendance',
];

/**
 * Returns every database collection as an array (never undefined).
 * The arrays keep a stable identity until the database changes,
 * so they are safe to use as useMemo/useEffect dependencies.
 */
export const useCollections = () => {
  const { data } = useApp();
  return useMemo(
    () => Object.fromEntries(COLLECTION_KEYS.map(key => [key, Array.isArray(data?.[key]) ? data[key] : []])),
    [data]
  );
};

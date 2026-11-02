/**
 * Boxy Cloud Kitchen — Core Initial State
 * Configured for India (₹ / INR)
 */

export const INITIAL_DATA = {
  settings: {
    companyName: "Boxy Cloud Kitchen",
    tagline: "Speedy & Professional Cloud Kitchen POS",
    foundedYear: "2022",
    currencySymbol: "₹",
    taxRate: 0,
    invoiceFooter: "Thank you for choosing Boxy Cloud Kitchen! Freshness & quality guaranteed.",
    whatsappTemplate: "Hello {customerName}, your Boxy invoice #{invoiceNumber} for {currency}{amount} is ready. Thank you for your order!",
    googleScriptUrl: import.meta.env.VITE_GOOGLE_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbzPPvwAW0ZCPrfXE5fC3ALeepJyF_KTPZNrltIldHt6HzBGQcVY9ErinAZgpCXiS2HR/exec",
    googleSheetUrl: import.meta.env.VITE_GOOGLE_SHEET_URL || "https://docs.google.com/spreadsheets/d/19VZ70qy1rUHsBTfn1FSUyjqarB56VujZJR7UcJqZXb8/edit"
  },
  transactions: [],
  sales: [],
  products: [],
  rawMaterials: [],
  purchases: [],
  expenses: [],
  customers: [],
  suppliers: []
};

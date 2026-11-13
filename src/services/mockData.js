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
    googleScriptUrl: import.meta.env.VITE_GOOGLE_SCRIPT_URL || "https://script.google.com/macros/s/AKfycby2PWFa6tvXaHpUay3NKDA3Vi6evV0AavK8vTQ8ChVPNsb3xIo3BKsFZWHrcnR3Ij-T/exec",
    googleSheetUrl: import.meta.env.VITE_GOOGLE_SHEET_URL || "https://docs.google.com/spreadsheets/d/19VZ70qy1rUHsBTfn1FSUyjqarB56VujZJR7UcJqZXb8/edit"
  },
  transactions: [],
  sales: [],
  products: [],
  rawMaterials: [],
  purchases: [],
  expenses: [],
  customers: [],
  suppliers: [],
  recipes: [],
  partners: [
    {
      id: "PRT-001",
      name: "Ashfak",
      phone: "918089974243",
      address: "Kochi, Kerala",
      joiningDate: "2024-01-01",
      profitShare: 40,
      isPartner: true,
      isLabour: false,
      status: "Active",
      notes: "Founding Partner (40% Shareholder)"
    },
    {
      id: "PRT-002",
      name: "Rayya",
      phone: "919876543210",
      address: "Kochi, Kerala",
      joiningDate: "2024-01-01",
      profitShare: 30,
      isPartner: true,
      isLabour: true,
      status: "Active",
      notes: "Partner & Active Kitchen Staff (30% Shareholder)"
    },
    {
      id: "PRT-003",
      name: "Fathima",
      phone: "919876543211",
      address: "Kochi, Kerala",
      joiningDate: "2024-01-01",
      profitShare: 30,
      isPartner: true,
      isLabour: true,
      status: "Active",
      notes: "Partner & Active Kitchen Staff (30% Shareholder)"
    }
  ],
  labourers: [
    {
      id: "LBR-001",
      partnerId: "PRT-002",
      name: "Rayya",
      phone: "919876543210",
      jobRole: "Kitchen Supervisor & Head Chef",
      joiningDate: "2024-01-01",
      salaryType: "Monthly",
      salaryAmount: 18000,
      workingDays: 26,
      status: "Active",
      notes: "Partner working as active Head Chef"
    },
    {
      id: "LBR-002",
      partnerId: "PRT-003",
      name: "Fathima",
      phone: "919876543211",
      jobRole: "Kitchen Operations & Prep Chef",
      joiningDate: "2024-01-01",
      salaryType: "Monthly",
      salaryAmount: 18000,
      workingDays: 26,
      status: "Active",
      notes: "Partner working as active Operations Chef"
    }
  ],
  partnerWithdrawals: [],
  salaryPayments: [],
  attendance: []
};

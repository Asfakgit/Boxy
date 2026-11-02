import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/layout/Layout';

// Pages
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { OrdersHistory } from './pages/OrdersHistory';
import { TransactionsLedger } from './pages/TransactionsLedger';
import { PurchaseManagement } from './pages/PurchaseManagement';
import { CustomerManagement } from './pages/CustomerManagement';
import { SupplierManagement } from './pages/SupplierManagement';
import { ReportingAnalytics } from './pages/ReportingAnalytics';
import { SettingsConfiguration } from './pages/SettingsConfiguration';
import { ItemManagement } from './pages/ItemManagement';

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pos" element={<POS />} />
              <Route path="/orders" element={<OrdersHistory />} />
              <Route path="/transactions" element={<TransactionsLedger />} />
              <Route path="/items" element={<ItemManagement />} />
              <Route path="/purchases" element={<PurchaseManagement />} />
              <Route path="/customers" element={<CustomerManagement />} />
              <Route path="/suppliers" element={<SupplierManagement />} />
              <Route path="/reports" element={<ReportingAnalytics />} />
              <Route path="/settings" element={<SettingsConfiguration />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </Router>
      </AppProvider>
    </ThemeProvider>
  );
}

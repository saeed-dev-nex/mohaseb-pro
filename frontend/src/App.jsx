import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const Services = lazy(() => import('./pages/Services'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceForm = lazy(() => import('./pages/InvoiceForm'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Cheques = lazy(() => import('./pages/Cheques'));
const StaffPage = lazy(() => import('./pages/StaffPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const Chat = lazy(() => import('./pages/Chat'));
const Layout = lazy(() => import('./components/Layout'));

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-950" dir="rtl">
    <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" aria-label="در حال بارگذاری" />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />

          {/* Customers */}
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />

          {/* Services */}
          <Route path="services" element={<Services />} />

          {/* Invoices */}
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/new" element={<InvoiceForm />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="invoices/:id/edit" element={<InvoiceForm />} />

          {/* Reports */}
          <Route path="reports" element={<Reports />} />

          {/* Expenses */}
          <Route path="expenses" element={<Expenses />} />

          {/* Cheques */}
          <Route path="cheques" element={<Cheques />} />

          {/* Staff */}
          <Route path="staff" element={<StaffPage />} />

          {/* Users (admin only) */}
          <Route path="users" element={<UsersPage />} />
          <Route path="chat" element={<Chat />} />

          {/* Settings */}
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Services from './pages/Services';
import Invoices from './pages/Invoices';
import InvoiceForm from './pages/InvoiceForm';
import InvoiceDetail from './pages/InvoiceDetail';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Expenses from './pages/Expenses';
import Cheques from './pages/Cheques';
import StaffPage from './pages/StaffPage';
import UsersPage from './pages/UsersPage';
import Chat from './pages/Chat';
import Layout from './components/Layout';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
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
    </Router>
  );
}

export default App;

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import UserBooking from './pages/UserBooking';

// Lazy load administrative pages and layout
const Login = lazy(() => import('./pages/Login'));
const ProtectedLayout = lazy(() => import('./components/Layout/ProtectedLayout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Bookings = lazy(() => import('./pages/Bookings'));
const Payments = lazy(() => import('./pages/Payments'));
const Coupons = lazy(() => import('./pages/Coupons'));
const AdminManagement = lazy(() => import('./pages/AdminManagement'));
const SetPayment = lazy(() => import('./pages/SetPayment'));

// Simple lightweight loading fallback
const PageLoader = () => (
  <div className="min-h-screen bg-brand-light flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="border-4 border-brand-highlight border-l-brand-accent rounded-full w-8 h-8 animate-spin" />
      <span className="text-xs font-semibold text-brand-textSecondary">Loading...</span>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public customer facing booking portal at / */}
            <Route path="/" element={<UserBooking />} />

            {/* Administrative staff login */}
            <Route path="/admin/login" element={<Login />} />

            {/* Secure Administrative panel nested under /admin namespace */}
            <Route element={<ProtectedLayout />}>
              <Route path="/admin/dashboard" element={<Dashboard />} />
              <Route path="/admin/bookings" element={<Bookings />} />
              <Route path="/admin/payments" element={<Payments />} />
              <Route path="/admin/set-payment" element={<SetPayment />} />
              <Route path="/admin/coupons" element={<Coupons />} />
              <Route path="/admin/admins" element={<AdminManagement />} />
              
              {/* Fallback root redirects for namespace /admin */}
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            </Route>

            {/* Global fallback wildcards */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

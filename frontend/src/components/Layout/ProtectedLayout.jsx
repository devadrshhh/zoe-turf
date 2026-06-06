import React, { useState } from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../utils/axiosInstance';
import ExportModal from '../ExportModal';
import {
  LayoutDashboard,
  CalendarDays,
  CreditCard,
  Ticket,
  Users,
  LogOut,
  User,
  Menu,
  X,
  Sun,
  Moon,
  TrendingUp,
  ChevronDown,
  DollarSign,
  Download,
  Settings,
  Clock
} from 'lucide-react';

const ProtectedLayout = () => {
  const { admin, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-brand-light text-brand-accent font-sans">
        <div className="text-center">
          <div className="border-[3px] border-brand-highlight border-l-brand-accent rounded-full w-10 h-10 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-brand-textSecondary">Loading session credentials...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Bookings', path: '/admin/bookings', icon: CalendarDays },
    { label: 'Pending', path: '/admin/pending-payments', icon: Clock },
    { label: 'Payments', path: '/admin/payments', icon: CreditCard },
    { label: 'Coupons', path: '/admin/coupons', icon: Ticket },
    { label: 'Settings', path: '/admin/set-payment', icon: Settings },
    { label: 'Admins', path: '/admin/admins', icon: Users },
  ];

  return (
    <div className="flex h-screen bg-brand-light overflow-hidden font-sans relative">
      
      {/* Sidebar Backdrop Overlay on Mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-brand-textDark/50 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar Navigation - Collapsible Left Drawer on Mobile */}
      <aside className={`fixed md:relative inset-y-0 left-0 w-[75%] md:w-[260px] bg-white border-r border-brand-border/60 flex flex-col z-50 transition-transform duration-300 ease-in-out shrink-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Branding header */}
        <div className="p-5 flex items-center justify-between border-b border-brand-border/50 bg-gradient-to-r from-brand-accent/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="bg-brand-highlight text-brand-accent p-2 rounded-lg border border-brand-border">
              <TrendingUp size={20} />
            </div>
            <div>
              <h1 className="font-extrabold text-brand-textDark text-sm tracking-tight">TURF HUB</h1>
              <span className="text-[9px] font-bold text-brand-accent uppercase tracking-widest bg-brand-highlight px-1.5 py-0.5 rounded mt-0.5 inline-block">
                Staff Engine
              </span>
            </div>
          </div>
          {/* Close button inside sidebar on mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-lg border border-brand-border text-brand-textSecondary hover:text-brand-textDark md:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation lists */}
        <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 py-2.5 px-4 rounded-lg font-semibold text-xs transition-all duration-300 border ${
                  isActive
                    ? 'bg-brand-highlight text-brand-accent border-brand-border/40 shadow-soft'
                    : 'text-brand-textSecondary border-transparent hover:text-brand-accent hover:bg-brand-light'
                }`}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}

          {/* Export CSV Trigger */}
          <button
            onClick={() => {
              setSidebarOpen(false);
              setIsExportModalOpen(true);
            }}
            className="flex items-center gap-3 py-2.5 px-4 rounded-lg font-semibold text-xs text-brand-textSecondary border border-transparent hover:text-brand-accent hover:bg-brand-light text-left w-full cursor-pointer"
          >
            <Download size={15} />
            Export
          </button>
        </nav>

        {/* User context footer */}
        <div className="p-4 border-t border-brand-border/50 flex flex-col gap-3 bg-brand-light/35">
          <div className="flex items-center gap-3">
            <div className="w-8.5 h-8.5 rounded-full bg-brand-highlight border border-brand-border text-brand-accent flex items-center justify-center font-black text-sm shrink-0">
              {admin.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-brand-textDark truncate leading-tight">{admin.name}</p>
              <p className="text-[9px] text-brand-textMuted uppercase tracking-wider font-semibold mt-0.5">
                {admin.role === 'superadmin' ? 'Super Admin' : 'Admin'}
              </p>
            </div>
          </div>
          
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-brand-border rounded-lg bg-brand-danger/5 hover:bg-brand-danger/10 text-brand-danger text-xs font-bold transition-all duration-300 cursor-pointer"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main panel content box */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Sticky/Fixed Compact Top Navbar */}
        <header className="sticky top-0 h-[56px] bg-white border-b border-brand-border/60 flex items-center justify-between px-4 z-30 shadow-soft shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-brand-textDark p-1.5 hover:bg-brand-light rounded-lg md:hidden shrink-0 transition-all duration-200"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-sm font-extrabold text-brand-textDark tracking-tight hidden md:block">
              {navItems.find((n) => n.path === location.pathname)?.label || 'Overview Insights'}
            </h2>
          </div>

          {/* Centered Logo on Mobile */}
          <div className="md:hidden flex items-center gap-1.5">
            <div className="text-brand-accent p-1 bg-brand-highlight border border-brand-border/40 rounded">
              <TrendingUp size={14} />
            </div>
            <span className="font-black text-brand-textDark text-xs uppercase tracking-wider">TURF HUB</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Compact Profile Toggle Icon */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-8 h-8 rounded-full bg-brand-highlight border border-brand-border text-brand-accent flex items-center justify-center font-bold text-xs hover:border-brand-accent shrink-0 transition-all duration-300"
              >
                {admin.name.charAt(0).toUpperCase()}
              </button>

              {profileDropdownOpen && (
                <>
                  <div
                    onClick={() => setProfileDropdownOpen(false)}
                    className="fixed inset-0 z-40 bg-transparent"
                  />
                  <div className="absolute top-9 right-0 w-[180px] bg-white border border-brand-border rounded-lg p-1.5 z-50 shadow-premium animate-fade">
                    <Link
                      to="/admin/admins"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2 py-2 px-3 rounded-lg text-brand-textDark hover:bg-brand-light font-semibold text-xs transition-all duration-300 text-left w-full"
                    >
                      <User size={13} className="text-brand-textSecondary" />
                      Admins Security
                    </Link>
                    <button
                      onClick={logout}
                      className="flex items-center gap-2 py-2 px-3 rounded-lg text-brand-danger hover:bg-brand-danger/5 font-bold text-xs transition-all duration-300 text-left w-full border-none outline-none cursor-pointer"
                    >
                      <LogOut size={13} />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable central outlet */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto bg-brand-light/35 scroll-smooth">
          <div className="max-w-full md:max-w-[1200px] mx-auto w-full">
            <Outlet />
          </div>
        </main>

      </div>

      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />

    </div>
  );
};

export default ProtectedLayout;

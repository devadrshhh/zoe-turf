import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Plus,
  Lock,
  Calendar,
  Clock,
  X,
  ShieldAlert,
  Check,
  UserCog,
  Trash2
} from 'lucide-react';

const AdminManagement = () => {
  const { admin: currentAdmin, isSuperAdmin } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  // Form Fields: Add Admin
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('admin');
  const [password, setPassword] = useState('');

  // Form Fields: Edit Admin
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('admin');
  const [editIsActive, setEditIsActive] = useState(true);

  // Form Fields: Password Reset
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Loader / feedback state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/admin/all');
      if (response.data.success) {
        setAdmins(response.data.admins);
      }
    } catch (err) {
      console.error(err);
      setError('Error loading administrative staff lists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAddAdminSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    if (!isSuperAdmin) {
      setFormError('Super Admin scope required to perform edits.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await axiosInstance.post('/admin/create', { name, email, password, role, phone });
      if (response.data.success) {
        triggerToast('New administrative account seeded!');
        setAddModalOpen(false);
        setName('');
        setEmail('');
        setPhone('');
        setPassword('');
        setRole('admin');
        await fetchAdmins();
      }
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.message || 'Failed to seed admin account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAdminSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    if (!isSuperAdmin) {
      setFormError('Super Admin scope required to perform edits.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await axiosInstance.put(`/admin/update/${selectedAdmin._id}`, {
        name: editName,
        email: editEmail,
        phone: editPhone,
        role: editRole,
        isActive: editIsActive,
      });

      if (response.data.success) {
        triggerToast('Staff profile details updated successfully!');
        setEditModalOpen(false);
        setSelectedAdmin(null);
        await fetchAdmins();
      }
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.message || 'Failed to update administrative details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    if (newPassword !== confirmPassword) {
      setFormError('New passwords do not match');
      setSubmitting(false);
      return;
    }

    try {
      const isSelf = currentAdmin.id === selectedAdmin._id;
      const payload = {
        newPassword,
        confirmPassword,
      };

      if (isSelf) {
        payload.currentPassword = currentPassword;
      }

      const response = await axiosInstance.put(`/admin/change-password/${selectedAdmin._id}`, payload);
      if (response.data.success) {
        triggerToast('Security password successfully updated!');
        setPasswordModalOpen(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSelectedAdmin(null);
      }
    } catch (err) {
      console.error(err);
      setFormError(err.response?.data?.message || 'Verification failed. Double check current password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAdminSubmit = async () => {
    if (!selectedAdmin) return;
    setSubmitting(true);
    try {
      const response = await axiosInstance.delete(`/admin/delete/${selectedAdmin._id}`);
      if (response.data.success) {
        triggerToast('Staff account successfully deleted.');
        setDeleteConfirmOpen(false);
        setSelectedAdmin(null);
        await fetchAdmins();
      }
    } catch (err) {
      console.error(err);
      triggerToast(err.response?.data?.message || 'Deletion failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade">
      {/* Toast Notice */}
      {toastVisible && (
        <div className="fixed top-6 right-6 bg-brand-success text-white px-6 py-4 rounded-xl z-50 shadow-premium flex items-center gap-3 font-semibold animate-slide">
          <Check size={18} />
          {toastMessage}
        </div>
      )}

      {/* Header bar controls */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-brand-textDark tracking-tight">Staff Security & Admins</h1>
          <p className="text-xs text-brand-textSecondary mt-0.5">Control administrative staff listings, update passwords, and manage scopes.</p>
        </div>
        {isSuperAdmin && (
          <button className="text-xs font-bold text-white bg-brand-accent hover:bg-brand-accentHover py-2.5 px-5 rounded-lg flex items-center gap-1.5 transition-all duration-300 shadow-premium" onClick={() => setAddModalOpen(true)}>
            <Plus size={15} /> Add Admin
          </button>
        )}
      </div>

      {/* Accounts list Table */}
      <div className="bg-white border border-brand-border/60 rounded-xl p-6 shadow-soft hover:shadow-premium transition-all duration-300">
        {loading ? (
          <div className="flex h-[30vh] items-center justify-center text-brand-accent">
            <p className="text-xs font-semibold">Scanning credentials registers...</p>
          </div>
        ) : error ? (
          <p className="text-brand-danger text-center text-xs font-semibold">{error}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Mobile View: Cards */}
            <div className="md:hidden flex flex-col gap-3">
              {admins.length === 0 ? (
                <div className="bg-white border border-brand-border rounded-xl p-6 text-center text-brand-textSecondary text-xs">
                  No active administrator accounts found.
                </div>
              ) : (
                admins.map((u) => (
                  <div key={u._id} className={`bg-white border border-brand-border/60 rounded-xl p-4 shadow-soft flex flex-col gap-3 transition-all duration-300 border-l-4 ${
                    u.isActive ? 'border-l-brand-success' : 'border-l-brand-danger'
                  }`}>
                    <div className="flex items-center justify-between border-b border-brand-border/40 pb-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-brand-textDark">{u.name}</span>
                        <span className="text-[10px] text-brand-textSecondary mt-0.5">{u.email}</span>
                        {u.phone && <span className="text-[9px] text-brand-accent font-extrabold mt-0.5">📞 {u.phone}</span>}
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                        u.isActive
                          ? 'bg-green-50 text-green-600 border-green-200'
                          : 'bg-red-50 text-red-600 border-red-200'
                      }`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs font-bold text-brand-textDark">
                      <div>
                        <span className="text-[10px] text-brand-textMuted uppercase block font-semibold">Security Scope</span>
                        <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border mt-0.5 ${
                          u.role === 'superadmin'
                            ? 'bg-green-50 text-green-600 border-green-200'
                            : 'bg-brand-highlight text-brand-accent border-brand-border'
                        }`}>
                          {u.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-brand-textMuted uppercase block font-semibold">Created Date</span>
                        <div className="flex items-center gap-1 mt-0.5 text-brand-textSecondary font-semibold">
                          <Calendar size={11} className="shrink-0 text-brand-accent" />
                          <span className="font-bold text-brand-textDark">{new Date(u.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-brand-border/40 pt-2 grid grid-cols-1 gap-1 text-xs font-bold text-brand-textDark">
                      <div>
                        <span className="text-[10px] text-brand-textMuted uppercase block font-semibold">Last Login Event</span>
                        {u.lastLogin ? (
                          <div className="flex items-center gap-1 text-[10px] text-brand-textSecondary mt-0.5 font-medium">
                            <Clock size={11} className="shrink-0 text-brand-accent" />
                            <span>{new Date(u.lastLogin).toLocaleString()}</span>
                          </div>
                        ) : (
                          <span className="text-brand-textMuted italic text-[10px] mt-0.5 block font-medium">Never logged in</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-brand-border/30">
                      {(currentAdmin.id === u._id || isSuperAdmin) && (
                        <button
                          onClick={() => {
                            setSelectedAdmin(u);
                            setPasswordModalOpen(true);
                          }}
                          className="flex-1 text-[10px] font-bold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-2 rounded-lg flex items-center justify-center gap-1 transition-all duration-300 cursor-pointer"
                        >
                          <Lock size={11} /> Password
                        </button>
                      )}

                      {isSuperAdmin && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedAdmin(u);
                              setEditName(u.name);
                              setEditEmail(u.email);
                              setEditPhone(u.phone || '');
                              setEditRole(u.role);
                              setEditIsActive(u.isActive);
                              setEditModalOpen(true);
                            }}
                            className="flex-1 text-[10px] font-bold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-2 rounded-lg flex items-center justify-center gap-1 transition-all duration-300 cursor-pointer"
                          >
                            <UserCog size={11} /> Edit
                          </button>
                          {currentAdmin.id !== u._id && (
                            <button
                              onClick={() => {
                                setSelectedAdmin(u);
                                setDeleteConfirmOpen(true);
                              }}
                              className="text-[10px] font-bold text-white bg-brand-danger hover:bg-red-600 py-2 px-3 rounded-lg transition-all duration-300 cursor-pointer flex items-center justify-center shrink-0"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto border border-brand-border rounded-lg shadow-soft">
              <table className="min-w-full divide-y divide-brand-border/40 text-xs">
                <thead className="bg-brand-light/50">
                  <tr>
                    <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Staff Name</th>
                    <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Email Address</th>
                    <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Contact Number</th>
                    <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Security Scope</th>
                    <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Active State</th>
                    <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Created Date</th>
                    <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Last Login</th>
                    <th className="px-5 py-3 text-right font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-brand-border/30">
                  {admins.map((u) => (
                    <tr key={u._id} className="hover:bg-brand-light/30 transition-all duration-300">
                      <td className="px-5 py-3.5 font-bold text-brand-textDark whitespace-nowrap">{u.name}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-brand-textSecondary">{u.email}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-brand-textSecondary font-semibold">{u.phone || <span className="text-brand-textMuted italic font-normal">Not configured</span>}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                          u.role === 'superadmin'
                            ? 'bg-green-50 text-green-600 border-green-200'
                            : 'bg-brand-highlight text-brand-accent border-brand-border'
                        }`}>
                          {u.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                          u.isActive
                            ? 'bg-green-50 text-green-600 border-green-200'
                            : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-brand-textSecondary">
                        <div className="flex items-center gap-1">
                          <Calendar size={11} /> {new Date(u.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-brand-textSecondary">
                        {u.lastLogin ? (
                          <div className="flex items-center gap-1 text-[10px]">
                            <Clock size={11} /> {new Date(u.lastLogin).toLocaleString()}
                          </div>
                        ) : (
                          <span className="text-brand-textMuted italic text-[10px]">Never logged in</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <div className="flex gap-2 justify-end">
                          {(currentAdmin.id === u._id || isSuperAdmin) && (
                            <button
                              onClick={() => {
                                setSelectedAdmin(u);
                                setPasswordModalOpen(true);
                              }}
                              className="text-[10px] font-bold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-1.5 px-3 rounded-lg flex items-center gap-1 transition-all duration-300 cursor-pointer"
                              title="Reset Security Password"
                            >
                              <Lock size={11} /> Key
                            </button>
                          )}

                          {isSuperAdmin && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedAdmin(u);
                                  setEditName(u.name);
                                  setEditEmail(u.email);
                                  setEditPhone(u.phone || '');
                                  setEditRole(u.role);
                                  setEditIsActive(u.isActive);
                                  setEditModalOpen(true);
                                }}
                                className="text-[10px] font-bold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-1.5 px-3 rounded-lg flex items-center gap-1 transition-all duration-300 cursor-pointer"
                              >
                                <UserCog size={11} /> Edit
                              </button>
                              {currentAdmin.id !== u._id && (
                                <button
                                  onClick={() => {
                                    setSelectedAdmin(u);
                                    setDeleteConfirmOpen(true);
                                  }}
                                  className="text-[10px] font-bold text-white bg-brand-danger hover:bg-red-600 py-1.5 px-3 rounded-lg transition-all duration-300 cursor-pointer"
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Add staff */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-brand-textDark/45 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade">
          <div className="bg-white border border-brand-border shadow-premium rounded-xl p-6 md:p-8 max-w-md w-full relative flex flex-col gap-5 animate-fade">
            <button
              onClick={() => setAddModalOpen(false)}
              className="absolute top-5 right-5 text-brand-textSecondary hover:text-brand-accent transition-all duration-300"
            >
              <X size={20} />
            </button>

            <div>
              <h2 className="text-base font-extrabold text-brand-textDark tracking-tight">Create Staff Profile</h2>
              <p className="text-xs text-brand-textSecondary mt-0.5">Seed new user account with dedicated role scopes.</p>
            </div>

            {formError && (
              <div className="flex gap-2 p-3 bg-brand-danger/5 border border-brand-danger/15 rounded-lg text-brand-danger text-xs">
                <ShieldAlert size={15} className="shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddAdminSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent"
                  placeholder="E.g., Mary Jane"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent"
                  placeholder="mary@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Contact Number (with Country Code)</label>
                <input
                  type="text"
                  className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent"
                  placeholder="E.g., 919876543210 (required for SMS)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Role Scope</label>
                  <select
                    className="bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-2 text-xs outline-none transition-all duration-300 focus:border-brand-accent"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="admin">Standard Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Initial Password</label>
                  <input
                    type="password"
                    placeholder="Min 6 characters"
                    className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2.5 justify-end mt-2">
                <button type="button" className="text-xs font-semibold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-2.5 px-4 rounded-lg transition-all duration-300" onClick={() => setAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="text-xs font-bold text-white bg-brand-accent hover:bg-brand-accentHover py-2.5 px-4 rounded-lg transition-all duration-300 shadow-premium" disabled={submitting}>
                  {submitting ? 'Creating account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit staff */}
      {editModalOpen && selectedAdmin && (
        <div className="fixed inset-0 bg-brand-textDark/45 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade">
          <div className="bg-white border border-brand-border shadow-premium rounded-xl p-6 md:p-8 max-w-md w-full relative flex flex-col gap-5 animate-fade">
            <button
              onClick={() => {
                setSelectedAdmin(null);
                setEditModalOpen(false);
              }}
              className="absolute top-5 right-5 text-brand-textSecondary hover:text-brand-accent transition-all duration-300"
            >
              <X size={20} />
            </button>

            <div>
              <h2 className="text-base font-extrabold text-brand-textDark tracking-tight">Edit Staff Profile</h2>
              <p className="text-xs text-brand-textSecondary mt-0.5">Update staff account parameters and states.</p>
            </div>

            {formError && (
              <div className="flex gap-2 p-3 bg-brand-danger/5 border border-brand-danger/15 rounded-lg text-brand-danger text-xs">
                <ShieldAlert size={15} className="shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditAdminSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Contact Number (with Country Code)</label>
                <input
                  type="text"
                  className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent"
                  placeholder="E.g., 919876543210"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Security Scope</label>
                  <select
                    className="bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-2 text-xs outline-none transition-all duration-300 focus:border-brand-accent"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    disabled={currentAdmin.id === selectedAdmin._id} // Prevent self role change
                  >
                    <option value="admin">Standard Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Account State</label>
                  <div className="flex gap-4 mt-2.5">
                    <label className="flex items-center gap-1.5 text-xs text-brand-textDark font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="edit_status"
                        checked={editIsActive === true}
                        onChange={() => setEditIsActive(true)}
                        disabled={currentAdmin.id === selectedAdmin._id}
                      />
                      Active
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-brand-textDark font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="edit_status"
                        checked={editIsActive === false}
                        onChange={() => setEditIsActive(false)}
                        disabled={currentAdmin.id === selectedAdmin._id}
                      />
                      Deactivated
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end mt-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-2.5 px-4 rounded-lg transition-all duration-300"
                  onClick={() => {
                    setSelectedAdmin(null);
                    setEditModalOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="text-xs font-bold text-white bg-brand-accent hover:bg-brand-accentHover py-2.5 px-4 rounded-lg transition-all duration-300 shadow-premium" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Reset Password */}
      {passwordModalOpen && selectedAdmin && (
        <div className="fixed inset-0 bg-brand-textDark/45 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade">
          <div className="bg-white border border-brand-border shadow-premium rounded-xl p-6 md:p-8 max-w-sm w-full relative flex flex-col gap-5 animate-fade">
            <button
              onClick={() => {
                setSelectedAdmin(null);
                setPasswordModalOpen(false);
              }}
              className="absolute top-5 right-5 text-brand-textSecondary hover:text-brand-accent transition-all duration-300"
            >
              <X size={20} />
            </button>

            <div>
              <h2 className="text-base font-extrabold text-brand-textDark tracking-tight">Update staff key</h2>
              <p className="text-xs text-brand-textSecondary mt-0.5">
                Change credentials for <strong>{selectedAdmin.name}</strong>.
              </p>
            </div>

            {formError && (
              <div className="flex gap-2 p-3 bg-brand-danger/5 border border-brand-danger/15 rounded-lg text-brand-danger text-xs">
                <ShieldAlert size={15} className="shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="flex flex-col gap-4">
              {currentAdmin.id === selectedAdmin._id && (
                <div className="flex flex-col gap-1">
                  <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Current Password</label>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">New Password</label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Re-enter new password"
                  className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2.5 justify-end mt-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-2.5 px-4 rounded-lg transition-all duration-300"
                  onClick={() => {
                    setSelectedAdmin(null);
                    setPasswordModalOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="text-xs font-bold text-white bg-brand-accent hover:bg-brand-accentHover py-2.5 px-4 rounded-lg transition-all duration-300 shadow-premium" disabled={submitting}>
                  {submitting ? 'Updating key...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Confirm Delete Admin */}
      {deleteConfirmOpen && selectedAdmin && (
        <div className="fixed inset-0 bg-brand-textDark/45 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade">
          <div className="bg-white border border-brand-border shadow-premium rounded-xl p-6 md:p-8 max-w-sm w-full text-center flex flex-col gap-5 relative animate-fade">
            <button
              onClick={() => {
                setSelectedAdmin(null);
                setDeleteConfirmOpen(false);
              }}
              className="absolute top-4 right-4 text-brand-textSecondary hover:text-brand-accent transition-all duration-300"
            >
              <X size={18} />
            </button>

            <div>
              <div className="bg-brand-danger/5 text-brand-danger p-3.5 rounded-full inline-flex border border-brand-danger/15 mx-auto">
                <ShieldAlert size={24} />
              </div>
              <h2 className="text-base font-extrabold text-brand-textDark mt-3 tracking-tight">Delete administrative staff?</h2>
              <p className="text-xs text-brand-textSecondary mt-2 leading-relaxed">
                Are you sure you want to delete administrative profile <strong>{selectedAdmin.name}</strong>? This action is irreversible.
              </p>
            </div>

            <div className="flex gap-2.5 justify-center mt-1">
              <button
                type="button"
                className="text-xs font-semibold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-2.5 px-4 rounded-lg transition-all duration-300"
                onClick={() => {
                  setSelectedAdmin(null);
                  setDeleteConfirmOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="text-xs font-bold text-white bg-brand-danger hover:bg-red-600 py-2.5 px-4 rounded-lg transition-all duration-300 shadow-soft"
                onClick={handleDeleteAdminSubmit}
                disabled={submitting}
              >
                {submitting ? 'Deleting...' : 'Yes, Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminManagement;

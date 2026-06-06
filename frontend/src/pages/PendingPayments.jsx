import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import {
  Search,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  AlertTriangle,
  X,
  MapPin,
  Info,
  CheckCircle2,
  Trash2,
  TrendingUp
} from 'lucide-react';

const PendingPayments = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Table Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Toast System
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [toastVisible, setToastVisible] = useState(false);

  const triggerToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3500);
  };

  const fetchPendingBookings = async () => {
    try {
      const response = await axiosInstance.get('/bookings?paymentStatus=Pending');
      if (response.data.success) {
        setBookings(response.data.bookings);
      }
    } catch (err) {
      console.error(err);
      setError('Error loading pending payments ledger.');
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await fetchPendingBookings();
      setLoading(false);
    };
    initializeData();
  }, []);

  // Mark Booking as Paid
  const handleMarkAsPaid = async (booking) => {
    if (!window.confirm(`Are you sure you want to mark booking ${booking.bookingId} as Paid? This will generate a QR ticket and email it to the user.`)) {
      return;
    }
    
    setIsSubmittingAction(true);
    try {
      const response = await axiosInstance.put(`/bookings/mark-paid/${booking._id}`);
      if (response.data.success) {
        triggerToast('Booking marked as Paid successfully!');
        await fetchPendingBookings();
      }
    } catch (err) {
      console.error(err);
      triggerToast(err.response?.data?.message || 'Failed to update payment status.', 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Cancel Booking
  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    setIsSubmittingAction(true);
    try {
      const response = await axiosInstance.put(`/bookings/cancel/${selectedBooking._id}`);
      if (response.data.success) {
        triggerToast('Booking cancelled.');
        setCancelConfirmOpen(false);
        setSelectedBooking(null);
        await fetchPendingBookings();
      }
    } catch (err) {
      console.error(err);
      triggerToast(err.response?.data?.message || 'Cancellation error.', 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.bookingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customerPhone.includes(searchTerm);
    const matchesStatus = statusFilter ? b.status === statusFilter : true;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-6">
      
      {/* Toast Alert */}
      {toastVisible && (
        <div className={`fixed top-6 right-6 px-6 py-4 rounded-xl z-50 shadow-premium flex items-center gap-3 font-semibold text-white animate-slide ${
          toastType === 'success' ? 'bg-brand-success' : 'bg-brand-danger'
        }`}>
          <Info size={18} />
          {toastMessage}
        </div>
      )}

      {/* Main Page Content */}
      <div className="flex flex-col gap-6 animate-fade">

        {/* Header Bar */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-brand-textDark tracking-tight flex items-center gap-2">
              Pending Payments
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                Action Required
              </span>
            </h1>
            <p className="text-xs text-brand-textSecondary mt-0.5">Verify user checkout transactions, confirm manual entries, or cancel unpaid reserved slots.</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white border border-brand-border/60 rounded-xl p-5 shadow-soft flex gap-4 flex-wrap items-center">
          <div className="relative flex-1 min-w-[240px] flex items-center">
            <Search size={15} className="absolute left-3.5 text-brand-textMuted" />
            <input
              type="text"
              placeholder="Search booking ID, customer name, phone..."
              className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 pl-10 pr-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2.5 flex-wrap">
            <select
              className="bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Booking Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Pending Ledger Table */}
        <div className="bg-white border border-brand-border/60 rounded-xl p-6 shadow-soft hover:shadow-premium transition-all duration-300">
          {loading ? (
            <div className="flex h-[30vh] items-center justify-center text-brand-accent">
              <p className="text-xs font-semibold">Gathering pending payments ledger...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              
              {/* Mobile View: Cards */}
              <div className="md:hidden flex flex-col gap-3">
                {filteredBookings.length === 0 ? (
                  <div className="bg-white border border-brand-border rounded-xl p-6 text-center text-brand-textSecondary text-xs">
                    No pending payment reservations found.
                  </div>
                ) : (
                  filteredBookings.map((b) => (
                    <div key={b._id} className="bg-white border border-brand-border/60 rounded-xl p-3 shadow-sm flex flex-col gap-2.5 transition-all duration-300 border-l-4 border-l-amber-500">
                      {/* Top row */}
                      <div className="flex items-center justify-between border-b border-brand-border/40 pb-1.5">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-brand-textDark">{b.bookingId}</span>
                          <span className="text-[9px] text-brand-textSecondary font-bold">{b.turf?.name || 'Deleted Turf'}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                          b.status === 'Confirmed'
                            ? 'bg-green-50 text-green-600 border-green-200'
                            : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {b.status}
                        </span>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-2 text-xxs">
                        <div>
                          <span className="text-[9px] text-brand-textMuted uppercase block font-bold">Player Info</span>
                          <p className="mt-0.5 truncate font-extrabold text-brand-textDark text-[11px]">{b.customerName}</p>
                          <p className="text-[9px] text-brand-textSecondary truncate font-medium">{b.customerPhone}</p>
                        </div>
                        <div>
                          <span className="text-[9px] text-brand-textMuted uppercase block font-bold">Reservation Timing</span>
                          <div className="flex items-center gap-1 mt-0.5 text-[9px] text-brand-textSecondary font-semibold">
                            <Calendar size={10} className="text-brand-textMuted shrink-0" />
                            <span className="truncate">{b.date}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-brand-textDark font-black">
                            <Clock size={11} className="text-brand-accent shrink-0" />
                            <span className="text-xs font-black tracking-tight text-brand-textDark">{b.slot}</span>
                          </div>
                        </div>
                      </div>

                      {/* Price and Action Row */}
                      <div className="flex items-center justify-between border-t border-brand-border/40 pt-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-black text-brand-textDark">₹{b.finalAmount}</span>
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border bg-yellow-50 text-yellow-600 border-yellow-200">
                            Pending
                          </span>
                          <span className="text-[8px] text-brand-textMuted font-semibold">({b.paymentMethod})</span>
                        </div>

                        <div className="flex gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedBooking(b);
                              setDetailsModalOpen(true);
                            }}
                            className="text-[9px] font-extrabold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-1 px-2 rounded-lg flex items-center justify-center gap-0.5 transition-all duration-300 cursor-pointer shadow-xxs"
                          >
                            <Info size={9} /> Details
                          </button>
                          {b.status === 'Confirmed' && (
                            <>
                              <button
                                onClick={() => handleMarkAsPaid(b)}
                                disabled={isSubmittingAction}
                                className="text-[9px] font-black text-white bg-brand-success hover:bg-green-600 py-1 px-2 rounded-lg transition-all duration-300 cursor-pointer shadow-xxs disabled:opacity-50"
                              >
                                Approve Paid
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedBooking(b);
                                  setCancelConfirmOpen(true);
                                }}
                                disabled={isSubmittingAction}
                                className="text-[9px] font-black text-white bg-brand-danger hover:bg-red-600 py-1 px-2 rounded-lg transition-all duration-300 cursor-pointer shadow-xxs disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
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
                      <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Booking ID</th>
                      <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Turf</th>
                      <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Customer</th>
                      <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Timing Slot</th>
                      <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Final Cost</th>
                      <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Method</th>
                      <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Booking Status</th>
                      <th className="px-5 py-3 text-right font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-brand-border/30">
                    {filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-5 py-8 text-center text-brand-textSecondary">
                          No pending payment reservations found.
                        </td>
                      </tr>
                    ) : (
                      filteredBookings.map((b) => (
                        <tr key={b._id} className="hover:bg-brand-light/30 transition-all duration-300">
                          <td className="px-5 py-3.5 font-bold text-brand-textDark whitespace-nowrap">{b.bookingId}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="font-bold text-brand-textDark">{b.turf?.name || 'Deleted Turf'}</div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div>
                              <div className="font-semibold text-brand-textDark">{b.customerName}</div>
                              <span className="text-[10px] text-brand-textSecondary">{b.customerPhone}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div>
                              <div className="flex items-center gap-1 font-semibold text-brand-textDark">
                                <Calendar size={11} className="text-brand-accent" /> {b.date}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-brand-textSecondary mt-0.5">
                                <Clock size={9} /> {b.slot}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap font-bold text-brand-textDark">₹{b.finalAmount}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-brand-textSecondary font-semibold">{b.paymentMethod}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                              b.status === 'Confirmed'
                                ? 'bg-green-50 text-green-600 border-green-200'
                                : 'bg-red-50 text-red-600 border-red-200'
                            }`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-right">
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => {
                                  setSelectedBooking(b);
                                  setDetailsModalOpen(true);
                                }}
                                className="text-[10px] font-bold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-1.5 px-3 rounded-lg flex items-center gap-1 transition-all duration-300 cursor-pointer"
                              >
                                <Info size={11} /> Details
                              </button>
                              {b.status === 'Confirmed' && (
                                <>
                                  <button
                                    onClick={() => handleMarkAsPaid(b)}
                                    disabled={isSubmittingAction}
                                    className="text-[10px] font-bold text-white bg-brand-success hover:bg-green-600 py-1.5 px-3 rounded-lg transition-all duration-300 cursor-pointer disabled:opacity-50"
                                  >
                                    Approve Paid
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedBooking(b);
                                      setCancelConfirmOpen(true);
                                    }}
                                    disabled={isSubmittingAction}
                                    className="text-[10px] font-bold text-white bg-brand-danger hover:bg-red-600 py-1.5 px-3 rounded-lg transition-all duration-300 cursor-pointer disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}
        </div>

      </div>

      {/* MODAL: Details Dialog */}
      {detailsModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-brand-textDark/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-brand-border shadow-premium rounded-2xl p-6 md:p-8 max-w-lg w-full relative flex flex-col gap-5 animate-fade">
            <button
              onClick={() => {
                setDetailsModalOpen(false);
                setSelectedBooking(null);
              }}
              className="absolute top-5 right-5 text-brand-textSecondary hover:text-brand-accent transition-all duration-300"
            >
              <X size={20} />
            </button>

            <div>
              <h2 className="text-base font-extrabold text-brand-textDark tracking-tight">Booking Details</h2>
              <span className="text-[10px] font-extrabold text-brand-accent bg-brand-highlight px-2 py-0.5 rounded uppercase mt-1 inline-block">
                ID: {selectedBooking.bookingId}
              </span>
            </div>

            <div className="flex flex-col gap-4 divide-y divide-brand-border/40">
              
              {/* Player section */}
              <div className="flex flex-col gap-2.5 pt-1">
                <span className="text-[10px] font-bold text-brand-textMuted uppercase tracking-wider block">Customer Info</span>
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <User size={13} className="text-brand-textMuted" />
                    <span className="font-bold text-brand-textDark">{selectedBooking.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-brand-textMuted" />
                    <span className="font-semibold text-brand-textSecondary">{selectedBooking.customerPhone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="text-brand-textMuted" />
                    <span className="font-semibold text-brand-textSecondary">{selectedBooking.customerEmail}</span>
                  </div>
                </div>
              </div>

              {/* Turf and timing details */}
              <div className="flex flex-col gap-2.5 pt-3">
                <span className="text-[10px] font-bold text-brand-textMuted uppercase tracking-wider block">Reservation Summary</span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-brand-light/35 border border-brand-border/40 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[9px] text-brand-textSecondary font-bold">Turf Arena</span>
                    <span className="font-black text-brand-textDark truncate flex items-center gap-1">
                      <MapPin size={11} className="text-brand-accent" /> {selectedBooking.turf?.name || 'Deleted Turf'}
                    </span>
                  </div>
                  <div className="bg-brand-light/35 border border-brand-border/40 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[9px] text-brand-textSecondary font-bold">Timing Slot</span>
                    <span className="font-black text-brand-textDark flex items-center gap-1">
                      <Clock size={11} className="text-brand-accent" /> {selectedBooking.slot}
                    </span>
                  </div>
                  <div className="bg-brand-light/35 border border-brand-border/40 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[9px] text-brand-textSecondary font-bold">Booking Date</span>
                    <span className="font-black text-brand-textDark">
                      {selectedBooking.date}
                    </span>
                  </div>
                  <div className="bg-brand-light/35 border border-brand-border/40 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[9px] text-brand-textSecondary font-bold">Payment Method</span>
                    <span className="font-black text-brand-textDark">
                      {selectedBooking.paymentMethod}
                    </span>
                  </div>
                </div>
              </div>

              {/* pricing */}
              <div className="flex flex-col gap-2.5 pt-3">
                <span className="text-[10px] font-bold text-brand-textMuted uppercase tracking-wider block">Price Breakdown</span>
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-brand-textSecondary">Base Turf Price:</span>
                    <span className="font-semibold text-brand-textDark">₹{selectedBooking.price}</span>
                  </div>
                  {selectedBooking.discount > 0 && (
                    <div className="flex justify-between text-brand-success">
                      <span>Discount Coupon ({selectedBooking.couponCode}):</span>
                      <span>-₹{selectedBooking.discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-brand-border/40 pt-2 font-black text-sm text-brand-textDark">
                    <span>Total Unpaid Amount:</span>
                    <span className="text-brand-accent">₹{selectedBooking.finalAmount}</span>
                  </div>
                </div>
              </div>

            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => {
                  setDetailsModalOpen(false);
                  setSelectedBooking(null);
                }}
                className="flex-1 border border-brand-border hover:bg-brand-light text-brand-textSecondary hover:text-brand-textDark font-extrabold py-2.5 px-4 rounded-xl text-xs transition-all duration-300 cursor-pointer shadow-sm text-center"
              >
                Close Details
              </button>
              {selectedBooking.status === 'Confirmed' && (
                <button
                  onClick={() => {
                    const b = selectedBooking;
                    setDetailsModalOpen(false);
                    setSelectedBooking(null);
                    handleMarkAsPaid(b);
                  }}
                  className="flex-1 bg-brand-success hover:bg-green-600 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all duration-300 cursor-pointer shadow-soft hover:shadow-premium"
                >
                  <CheckCircle2 size={13} /> Approve Payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cancel Confirmer */}
      {cancelConfirmOpen && selectedBooking && (
        <div className="fixed inset-0 bg-brand-textDark/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-brand-border shadow-premium rounded-2xl p-6 max-w-sm w-full relative flex flex-col gap-4 text-center animate-fade">
            <div className="w-12 h-12 rounded-full bg-brand-danger/10 text-brand-danger flex items-center justify-center mx-auto shadow-sm">
              <AlertTriangle size={24} />
            </div>
            
            <div>
              <h3 className="font-extrabold text-sm text-brand-textDark">Cancel Unpaid Booking?</h3>
              <p className="text-xxs text-brand-textSecondary mt-1.5 leading-relaxed">
                Are you sure you want to cancel booking <strong>{selectedBooking.bookingId}</strong> for {selectedBooking.customerName}? This slot will be released back to the active inventory list.
              </p>
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                onClick={() => {
                  setCancelConfirmOpen(false);
                  setSelectedBooking(null);
                }}
                className="flex-1 border border-brand-border hover:bg-brand-light text-brand-textSecondary hover:text-brand-textDark font-extrabold py-2.5 rounded-xl text-xs transition-all duration-300 cursor-pointer"
              >
                No, Keep
              </button>
              <button
                onClick={handleCancelBooking}
                className="flex-1 bg-brand-danger hover:bg-red-600 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all duration-300 cursor-pointer shadow-soft hover:shadow-premium"
              >
                Yes, Cancel Slot
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PendingPayments;

import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import ExportModal from '../components/ExportModal';
import {
  Search,
  Plus,
  Download,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Ticket,
  AlertTriangle,
  X,
  QrCode,
  MapPin,
  Info,
  Printer,
  RefreshCw
} from 'lucide-react';

const isSlotTimeValid = (slotTime, bookingDate) => {
  if (!bookingDate) return true;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  if (bookingDate !== todayStr) {
    return true;
  }
  
  // Extract slot start time (e.g., '11:00' from '11:00 - 12:00')
  const startTimePart = slotTime.split(' - ')[0]; // '11:00'
  const [slotHour, slotMin] = startTimePart.split(':').map(Number);
  
  const slotStart = new Date();
  slotStart.setHours(slotHour, slotMin, 0, 0);
  
  // Expiry is start time + 10 minutes
  const slotExpiry = new Date(slotStart.getTime() + 10 * 60 * 1000);
  
  return now <= slotExpiry;
};

const Bookings = () => {
  // Master lists
  const [bookings, setBookings] = useState([]);
  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Table Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');

  // Modals state
  const [walkinModalOpen, setWalkinModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Walk-in form states
  const [selectedTurfId, setSelectedTurfId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponSuccess, setCouponSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [submittingBooking, setSubmittingBooking] = useState(false);
  
  // Successful QR code modal
  const [receiptBooking, setReceiptBooking] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

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

  const fetchBookings = async () => {
    try {
      const response = await axiosInstance.get('/bookings');
      if (response.data.success) {
        setBookings(response.data.bookings);
      }
    } catch (err) {
      console.error(err);
      setError('Error loading bookings ledger.');
    }
  };

  const fetchTurfs = async () => {
    try {
      const response = await axiosInstance.get('`${import.meta.env.VITE_API_URL}/api/turfs`');
      if (response.data.success) {
        setTurfs(response.data.turfs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([fetchBookings(), fetchTurfs()]);
      setLoading(false);

      const params = new URLSearchParams(window.location.search);
      if (params.get('new') === 'true') {
        setWalkinModalOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };
    initializeData();
  }, []);

  // Fetch slots on turf/date change
  useEffect(() => {
    if (!selectedTurfId || !bookingDate) {
      setAvailableSlots([]);
      return;
    }

    const loadSlots = async () => {
      setSlotsLoading(true);
      setSelectedSlot('');
      try {
        const response = await axiosInstance.get(`/bookings/slots-available?turfId=${selectedTurfId}&date=${bookingDate}`);
        if (response.data.success) {
          setAvailableSlots(response.data.slots);
        }
      } catch (err) {
        console.error(err);
        triggerToast('Failed to fetch available slots.', 'error');
      } finally {
        setSlotsLoading(false);
      }
    };

    loadSlots();
  }, [selectedTurfId, bookingDate]);

  // Apply Coupon promo code
  const handleApplyCoupon = async () => {
    if (!couponCode) {
      triggerToast('Please write coupon code', 'error');
      return;
    }
    if (!selectedTurfId) {
      triggerToast('Select a sports turf venue first', 'error');
      return;
    }

    const turf = turfs.find((t) => t._id === selectedTurfId);
    const basePrice = turf ? turf.pricePerHour : 0;

    try {
      const response = await axiosInstance.post('/coupons/apply', {
        code: couponCode,
        bookingAmount: basePrice,
      });

      if (response.data.success) {
        setCouponDiscount(response.data.discount);
        setCouponMessage(`Discount of ₹${response.data.discount} applied!`);
        setCouponSuccess(true);
        triggerToast('Coupon applied!');
      }
    } catch (err) {
      setCouponDiscount(0);
      setCouponMessage(err.response?.data?.message || 'Invalid coupon code');
      setCouponSuccess(false);
      triggerToast('Failed to apply coupon.', 'error');
    }
  };

  // Open and default Walk-in modal
  const handleOpenNewBooking = () => {
    if (turfs && turfs.length > 0) {
      setSelectedTurfId(turfs[0]._id);
    }
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setBookingDate(todayStr);
    setWalkinModalOpen(true);
  };

  // Submit Walk-in Booking
  const handleWalkinSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      triggerToast('Please pick an hourly slot', 'error');
      return;
    }

    setSubmittingBooking(true);
    try {
      const payload = {
        turfId: selectedTurfId,
        date: bookingDate,
        slot: selectedSlot,
        customerName,
        customerEmail,
        customerPhone,
        paymentMethod,
        couponCode: couponSuccess ? couponCode : undefined,
      };

      const response = await axiosInstance.post('/bookings', payload);
      if (response.data.success) {
        triggerToast('Walk-in booking confirmed!');
        setWalkinModalOpen(false);
        setReceiptBooking(response.data.booking);
        setReceiptModalOpen(true);
        
        // Reset states
        setSelectedTurfId('');
        setBookingDate('');
        setSelectedSlot('');
        setCustomerName('');
        setCustomerEmail('');
        setCustomerPhone('');
        setCouponCode('');
        setCouponDiscount(0);
        setCouponMessage('');
        setCouponSuccess(false);
        
        await fetchBookings();
      }
    } catch (err) {
      console.error(err);
      triggerToast(err.response?.data?.message || 'Failed to create booking', 'error');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const downloadReceiptAsPNG = (booking) => {
    if (!booking) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = 450;
    canvas.height = 650;
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Top border stripe (sky-blue/blue gradient)
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, '#3b82f6');
    grad.addColorStop(1, '#2563eb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, 12);
    
    // Inner border outline
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    
    // Header
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('BOOKING RECEIPT', canvas.width / 2, 50);
    
    ctx.fillStyle = '#64748b';
    ctx.font = '500 12px sans-serif';
    ctx.fillText('Timings successfully reserved at Turf Hub', canvas.width / 2, 70);
    
    // Draw decorative dotted line
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(35, 88);
    ctx.lineTo(canvas.width - 35, 88);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Load QR base64 image and draw once ready
    const qrImg = new Image();
    qrImg.src = booking.qrCodeData;
    qrImg.onload = () => {
      // Draw centered QR Code
      ctx.drawImage(qrImg, canvas.width / 2 - 80, 105, 160, 160);
      
      // Draw details table
      let startY = 295;
      const rowHeight = 28;
      
      const drawRow = (label, val, isLast = false) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = isLast ? '#0f172a' : '#64748b';
        ctx.font = isLast ? 'bold 13px sans-serif' : '500 11px sans-serif';
        ctx.fillText(label, 40, startY);
        
        ctx.textAlign = 'right';
        ctx.fillStyle = isLast ? '#3b82f6' : '#0f172a';
        ctx.font = isLast ? 'extrabold 15px sans-serif' : 'bold 12px sans-serif';
        
        // Handle long values (e.g. long email) gracefully by scaling text
        if (!isLast && val.length > 25) {
          ctx.font = 'bold 10px sans-serif';
        }
        ctx.fillText(val, canvas.width - 40, startY);
        
        startY += rowHeight;
      };
      
      drawRow('Booking ID:', booking.bookingId);
      drawRow('Player Name:', booking.customerName);
      drawRow('Phone Number:', booking.customerPhone);
      drawRow('Email Address:', booking.customerEmail);
      drawRow('Timing Slot:', `${booking.date} (${booking.slot})`);
      drawRow('Turf Venue:', booking.turf?.name || 'Main Turf Arena');
      drawRow('Payment Method:', `${booking.paymentMethod} (${booking.paymentStatus})`);
      
      // Divider
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(35, startY - 12);
      ctx.lineTo(canvas.width - 35, startY - 12);
      ctx.stroke();
      
      startY += 8;
      drawRow('Total Amount Paid:', `₹${booking.finalAmount}`, true);
      
      // Receipt generation timestamp
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 9px sans-serif';
      ctx.fillText(`Generated on: ${new Date().toLocaleString()}`, canvas.width / 2, canvas.height - 40);
      
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 10px sans-serif';
      ctx.fillText('Thank you for booking with Turf Hub! Present QR at reception.', canvas.width / 2, canvas.height - 22);
      
      // Programmatically trigger download
      const link = document.createElement('a');
      link.download = `Receipt_${booking.bookingId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
  };

  // Mark Booking as Paid
  const handleMarkAsPaid = async (booking) => {
    if (!window.confirm(`Are you sure you want to mark booking ${booking.bookingId} as Paid?`)) {
      return;
    }
    
    try {
      const response = await axiosInstance.put(`/bookings/mark-paid/${booking._id}`);
      if (response.data.success) {
        triggerToast('Booking marked as Paid successfully!');
        await fetchBookings();
      }
    } catch (err) {
      console.error(err);
      triggerToast(err.response?.data?.message || 'Failed to update payment status.', 'error');
    }
  };

  // Cancel Booking
  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    try {
      const response = await axiosInstance.put(`/bookings/cancel/${selectedBooking._id}`);
      if (response.data.success) {
        triggerToast('Booking cancelled.');
        setCancelConfirmOpen(false);
        setSelectedBooking(null);
        await fetchBookings();
      }
    } catch (err) {
      console.error(err);
      triggerToast(err.response?.data?.message || 'Cancellation error.', 'error');
    }
  };


  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.bookingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customerPhone.includes(searchTerm);
    const matchesStatus = statusFilter ? b.status === statusFilter : true;
    const matchesPayment = paymentStatusFilter ? b.paymentStatus === paymentStatusFilter : true;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  return (
    <div className="flex flex-col gap-6">
      
      {/* Toast Alert (rendered at viewport level to prevent coordinate shifts) */}
      {toastVisible && (
        <div className={`fixed top-6 right-6 px-6 py-4 rounded-xl z-50 shadow-premium flex items-center gap-3 font-semibold text-white animate-slide ${
          toastType === 'success' ? 'bg-brand-success' : 'bg-brand-danger'
        }`}>
          <Info size={18} />
          {toastMessage}
        </div>
      )}

      {/* Main page transition anim wrapper */}
      <div className="flex flex-col gap-6 animate-fade">

      {/* Header bar controls */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-brand-textDark tracking-tight">Reservations Console</h1>
          <p className="text-xs text-brand-textSecondary mt-0.5">Filter timelines, create bookings, and cancel playing slots.</p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <button className="text-xs font-semibold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-2.5 px-5 rounded-lg flex items-center gap-2 transition-all duration-300 shadow-soft" onClick={() => setIsExportModalOpen(true)}>
            <Download size={15} /> Export Report
          </button>
          <button className="text-xs font-bold text-white bg-brand-accent hover:bg-brand-accentHover py-2.5 px-5 rounded-lg flex items-center gap-1.5 transition-all duration-300 shadow-premium" onClick={handleOpenNewBooking}>
            <Plus size={15} /> New Booking
          </button>
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
            <option value="">All Statuses</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            className="bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent"
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
          >
            <option value="">All Payments</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Bookings Ledger Table */}
      <div className="bg-white border border-brand-border/60 rounded-xl p-6 shadow-soft hover:shadow-premium transition-all duration-300">
        {loading ? (
          <div className="flex h-[30vh] items-center justify-center text-brand-accent">
            <p className="text-xs font-semibold">Gathering booking ledger...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="md:hidden flex flex-col gap-3">
              {filteredBookings.length === 0 ? (
                <div className="bg-white border border-brand-border rounded-xl p-6 text-center text-brand-textSecondary text-xs">
                  No bookings matching selected filters.
                </div>
              ) : (
                filteredBookings.map((b) => (
                  <div key={b._id} className={`bg-white border border-brand-border/60 rounded-xl p-3 shadow-sm flex flex-col gap-2.5 transition-all duration-300 border-l-4 ${
                    b.status === 'Confirmed' ? 'border-l-brand-success' : 'border-l-brand-danger'
                  }`}>
                    {/* Top line: ID, Turf, Status */}
                    <div className="flex items-center justify-between border-b border-brand-border/40 pb-1.5">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-brand-textDark">{b.bookingId}</span>
                        <span className="text-[9px] text-brand-textSecondary font-bold">{b.turf?.name || 'Deleted Turf'}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                        b.isVerified
                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : b.status === 'Confirmed'
                          ? 'bg-green-50 text-green-600 border-green-200'
                          : 'bg-red-50 text-red-600 border-red-200'
                      }`}>
                        {b.isVerified ? 'Expired' : b.status}
                      </span>
                    </div>
                    
                    {/* Info Grid */}
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

                    {/* Paid Info & Compact Actions */}
                    <div className="flex items-center justify-between border-t border-brand-border/40 pt-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black text-brand-textDark">₹{b.finalAmount}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                          b.paymentStatus === 'Paid'
                            ? 'bg-green-50 text-green-600 border-green-200'
                            : b.paymentStatus === 'Pending'
                            ? 'bg-yellow-50 text-yellow-600 border-yellow-200'
                            : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {b.paymentStatus}
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
                        {b.paymentStatus === 'Pending' && b.status === 'Confirmed' && (
                          <button
                            onClick={() => handleMarkAsPaid(b)}
                            className="text-[9px] font-black text-white bg-brand-success hover:bg-green-600 py-1 px-2 rounded-lg transition-all duration-300 cursor-pointer shadow-xxs"
                          >
                            Mark Paid
                          </button>
                        )}
                        {b.status === 'Confirmed' && (
                          <button
                            onClick={() => {
                              setSelectedBooking(b);
                              setCancelConfirmOpen(true);
                            }}
                            className="text-[9px] font-black text-white bg-brand-danger hover:bg-red-600 py-1 px-2 rounded-lg transition-all duration-300 cursor-pointer shadow-xxs"
                          >
                            Cancel
                          </button>
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
                    <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Payments</th>
                    <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Status</th>
                    <th className="px-5 py-3 text-right font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-brand-border/30">
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-5 py-8 text-center text-brand-textSecondary">
                        No bookings matching selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((b) => (
                      <tr key={b._id} className="hover:bg-brand-light/30 transition-all duration-300">
                        <td className="px-5 py-3.5 font-bold text-brand-textDark whitespace-nowrap">{b.bookingId}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div>
                            <div className="font-bold text-brand-textDark">{b.turf?.name || 'Deleted Turf'}</div>
                          </div>
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
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border align-self-start ${
                              b.paymentStatus === 'Paid'
                                ? 'bg-green-50 text-green-600 border-green-200'
                                : b.paymentStatus === 'Pending'
                                ? 'bg-yellow-50 text-yellow-600 border-yellow-200'
                                : 'bg-red-50 text-red-600 border-red-200'
                            }`} style={{ width: 'fit-content' }}>
                              {b.paymentStatus}
                            </span>
                            <span className="text-[10px] text-brand-textMuted">{b.paymentMethod}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                            b.isVerified
                              ? 'bg-amber-50 text-amber-600 border-amber-200'
                              : b.status === 'Confirmed'
                              ? 'bg-green-50 text-green-600 border-green-200'
                              : 'bg-red-50 text-red-600 border-red-200'
                          }`}>
                            {b.isVerified ? 'Expired' : b.status}
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
                            {b.paymentStatus === 'Pending' && b.status === 'Confirmed' && (
                              <button
                                onClick={() => handleMarkAsPaid(b)}
                                className="text-[10px] font-bold text-white bg-brand-success hover:bg-green-600 py-1.5 px-3 rounded-lg transition-all duration-300 hover:scale-[1.01] cursor-pointer"
                              >
                                Paid
                              </button>
                            )}
                            {b.status === 'Confirmed' && (
                              <button
                                onClick={() => {
                                  setSelectedBooking(b);
                                  setCancelConfirmOpen(true);
                                }}
                                className="text-[10px] font-bold text-white bg-brand-danger hover:bg-red-600 py-1.5 px-3 rounded-lg transition-all duration-300 cursor-pointer"
                              >
                                Cancel
                              </button>
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

      {/* Close transform parent wrapper to isolate fixed modals */}
      </div>

      {/* MODAL 1: Create Walk-in Booking */}
      {walkinModalOpen && (
        <div className="fixed inset-0 bg-brand-textDark/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-brand-border shadow-premium rounded-2xl p-6 md:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto relative flex flex-col gap-6 animate-fade">
            <button
              onClick={() => setWalkinModalOpen(false)}
              className="absolute top-5 right-5 text-brand-textSecondary hover:text-brand-accent transition-all duration-300"
            >
              <X size={20} />
            </button>

            <div>
              <h2 className="text-base font-extrabold text-brand-textDark tracking-tight">Create New Booking</h2>
              <p className="text-xs text-brand-textSecondary mt-0.5">Submit slot timings directly on behalf of players.</p>
            </div>

            <form onSubmit={handleWalkinSubmit} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider block mb-0.5">Select Turf</label>
                  <select
                    className="bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow"
                    value={selectedTurfId}
                    onChange={(e) => setSelectedTurfId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Turf --</option>
                    {turfs.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} (₹{t.pricePerHour}/hr)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider block mb-0.5">Booking Date</label>
                  <input
                    type="date"
                    min={(() => {
                      const now = new Date();
                      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    })()}
                    className="bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Slot timings */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider">Available Timing Hour</label>
                {!selectedTurfId || !bookingDate ? (
                  <div className="border border-dashed border-brand-border bg-brand-light/20 p-5 text-center text-xs text-brand-textMuted rounded-lg">
                    Select both Turf and Booking Date above to query timelines.
                  </div>
                ) : slotsLoading ? (
                  <div className="flex items-center gap-1.5 text-xs text-brand-accent">
                    <div className="border-2 border-brand-highlight border-l-brand-accent rounded-full w-3.5 h-3.5 animate-spin" />
                    Gathering slots...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 border border-brand-border bg-brand-light/20 p-4 rounded-xl max-h-[160px] overflow-y-auto">
                    {availableSlots
                      .filter((s) => isSlotTimeValid(s.time, bookingDate))
                      .map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={!s.isAvailable}
                        onClick={() => setSelectedSlot(s.time)}
                        className={`py-2.5 px-2 rounded-lg border text-center text-[11px] font-bold transition-all duration-300 ${
                          selectedSlot === s.time
                            ? 'bg-brand-accent text-white border-brand-accent shadow-soft scale-102'
                            : s.isAvailable
                            ? 'bg-white border-brand-border text-brand-textDark hover:border-brand-accent hover:bg-brand-highlight/30 hover:text-brand-accent'
                            : 'bg-gray-100 border-gray-200 text-gray-450 cursor-not-allowed opacity-75 line-through'
                        }`}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider block mb-0.5">Customer Name</label>
                  <input
                    type="text"
                    className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow"
                    placeholder="E.g., John Smith"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider block mb-0.5">Phone Number</label>
                  <input
                    type="tel"
                    className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow"
                    placeholder="10 digit phone number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider block mb-0.5">Email Address</label>
                  <input
                    type="email"
                    className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 px-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow"
                    placeholder="player@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-1">
                  <label className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider block mb-0.5">Promo Coupon</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2 px-2 text-xs outline-none transition-all duration-300 uppercase focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow"
                      placeholder="WELCOME200"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    />
                    <button
                      type="button"
                      className="text-xs font-semibold px-3 rounded-lg border border-brand-border bg-brand-light hover:bg-brand-highlight text-brand-accent transition-all duration-300"
                      onClick={handleApplyCoupon}
                    >
                      Apply
                    </button>
                  </div>
                  {couponMessage && (
                    <span className={`text-[10px] font-semibold mt-1 block ${
                      couponSuccess ? 'text-brand-success' : 'text-brand-danger'
                    }`}>
                      {couponMessage}
                    </span>
                  )}
                </div>
              </div>

              {/* pricing */}
              <div className="border border-brand-border/60 bg-brand-light/20 p-4 rounded-xl flex items-center justify-between flex-wrap gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Payment Method</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-brand-textDark font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="walk_pay_mode"
                        value="Cash"
                        checked={paymentMethod === 'Cash'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                      Cash
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-brand-textDark font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="walk_pay_mode"
                        value="Razorpay"
                        checked={paymentMethod === 'Razorpay'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                      Razorpay
                    </label>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-brand-textMuted font-semibold block">
                    Base Cost: ₹{selectedTurfId ? turfs.find((t) => t._id === selectedTurfId)?.pricePerHour : 0}
                  </span>
                  {couponSuccess && (
                    <span className="text-[10px] text-brand-success font-semibold block">
                      Discount: -₹{couponDiscount}
                    </span>
                  )}
                  <span className="text-base font-extrabold text-brand-textDark mt-1 block">
                    Final Sum: ₹{selectedTurfId ? Math.max(0, (turfs.find((t) => t._id === selectedTurfId)?.pricePerHour || 0) - couponDiscount) : 0}
                  </span>
                </div>
              </div>

              <div className="flex gap-2.5 justify-end mt-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-2.5 px-5 rounded-lg transition-all duration-300"
                  onClick={() => setWalkinModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBooking}
                  className="text-xs font-bold text-white bg-brand-accent hover:bg-brand-accentHover disabled:bg-brand-textMuted py-2.5 px-5 rounded-lg transition-all duration-300 shadow-premium"
                >
                  {submittingBooking ? 'Confirming...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Receipt QR Success card */}
      {receiptModalOpen && receiptBooking && (
        <div className="fixed inset-0 bg-brand-textDark/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-brand-border shadow-premium rounded-2xl p-6 md:p-8 max-w-sm w-full text-center relative flex flex-col gap-6 animate-fade">
            <button
              onClick={() => setReceiptModalOpen(false)}
              className="absolute top-4 right-4 text-brand-textSecondary hover:text-brand-accent transition-all duration-300"
            >
              <X size={20} />
            </button>

            <div>
              <div className="bg-brand-highlight text-brand-accent p-3.5 rounded-full inline-flex border border-brand-border/60 mx-auto">
                <QrCode size={26} />
              </div>
              <h2 className="text-base font-extrabold text-brand-textDark mt-3 tracking-tight">Booking Confirmed!</h2>
              <p className="text-xs text-brand-textSecondary mt-1">Receipt QR code successfully built.</p>
            </div>

            {receiptBooking.qrCodeData && (
              <div className="bg-white border border-brand-border/60 p-4 rounded-lg w-[160px] h-[160px] mx-auto flex items-center justify-center shadow-soft">
                <img
                  src={receiptBooking.qrCodeData}
                  alt={`Walkin Receipt QR ${receiptBooking.bookingId}`}
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <div className="bg-brand-light border border-brand-border/60 rounded-lg p-4 text-left text-xs flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-brand-textMuted">Booking ID:</span>
                <span className="font-extrabold text-brand-textDark">{receiptBooking.bookingId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted">Player Name:</span>
                <span className="font-semibold text-brand-textDark">{receiptBooking.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted">Timing Slot:</span>
                <span className="font-semibold text-brand-textDark">{receiptBooking.date} ({receiptBooking.slot})</span>
              </div>
              <div className="flex justify-between border-t border-brand-border/40 pt-2.5 mt-1.5">
                <span className="font-bold text-brand-textDark">Amount Paid:</span>
                <span className="font-extrabold text-brand-accent text-sm">₹{receiptBooking.finalAmount}</span>
              </div>
            </div>

            <div className="mt-2">
              <button
                type="button"
                onClick={() => downloadReceiptAsPNG(receiptBooking)}
                className="w-full bg-brand-success hover:bg-green-600 text-white py-3 px-4 rounded-lg font-bold text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-1.5 shadow-soft hover:scale-[1.01]"
              >
                <Download size={14} /> Download Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: General Details View */}
      {detailsModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-brand-textDark/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-brand-border shadow-premium rounded-2xl p-6 md:p-8 max-w-lg w-full relative flex flex-col gap-6 animate-fade">
            <button
              onClick={() => {
                setSelectedBooking(null);
                setDetailsModalOpen(false);
              }}
              className="absolute top-5 right-5 text-brand-textSecondary hover:text-brand-accent transition-all duration-300"
            >
              <X size={20} />
            </button>

            <div>
              <h2 className="text-base font-extrabold text-brand-textDark tracking-tight">Reservation Detail</h2>
              <span className="text-[10px] text-brand-textMuted font-semibold">Security audits logging metadata</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="sm:col-span-2 flex flex-col gap-4 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-brand-textMuted uppercase tracking-wider block mb-1">Customer Contact</span>
                  <div className="font-bold text-brand-textDark">{selectedBooking.customerName}</div>
                  <div className="text-brand-textSecondary mt-0.5">{selectedBooking.customerPhone}</div>
                  <div className="text-brand-textSecondary">{selectedBooking.customerEmail}</div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-brand-textMuted uppercase tracking-wider block mb-1">Turf</span>
                  <div className="font-bold text-brand-textDark">{selectedBooking.turf?.name || 'Deleted Turf'}</div>
                  <div className="text-brand-textSecondary mt-0.5">Location: {selectedBooking.turf?.location}</div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-brand-textMuted uppercase tracking-wider block mb-1">Timings and Pricing</span>
                  <div className="font-semibold text-brand-textDark">Date: {selectedBooking.date}</div>
                  <div className="font-semibold text-brand-textDark">Timing Slot: {selectedBooking.slot}</div>
                  <div className="border-t border-brand-border/40 pt-2.5 mt-2.5">
                    <span>Base Hourly Cost: ₹{selectedBooking.price}</span>
                    {selectedBooking.discount > 0 && (
                      <span className="text-brand-success block">Coupon Discount: -₹{selectedBooking.discount} ({selectedBooking.couponCode})</span>
                    )}
                    <span className="font-extrabold text-brand-textDark text-sm block mt-1">Paid Total: ₹{selectedBooking.finalAmount}</span>
                  </div>
                </div>
              </div>

              {/* QR Receipt Card if paid */}
              <div className="sm:col-span-1 flex flex-col items-center justify-center gap-2">
                {selectedBooking.paymentStatus === 'Paid' && selectedBooking.qrCodeData ? (
                  <>
                    <div className="bg-white border border-brand-border/60 p-2.5 rounded-lg w-[120px] h-[120px] flex items-center justify-center shadow-soft">
                      <img
                        src={selectedBooking.qrCodeData}
                        alt={`Receipt code ${selectedBooking.bookingId}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="text-[9px] text-brand-textMuted font-bold uppercase tracking-wider text-center">Receipt QR Code</span>
                    <button
                      type="button"
                      onClick={() => downloadReceiptAsPNG(selectedBooking)}
                      className="text-brand-accent hover:text-brand-accentHover text-[10px] font-bold flex items-center gap-1 mt-1 border-none bg-none outline-none cursor-pointer hover:scale-[1.01]"
                    >
                      <Download size={11} /> Download Receipt
                    </button>
                  </>
                ) : (
                  <div className="border border-dashed border-brand-border p-4 rounded-lg text-center text-xxs text-brand-textMuted h-32 flex items-center justify-center bg-brand-light/10">
                    QR receipts only generated for Paid status.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                className="text-xs font-semibold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-2 px-4 rounded-lg transition-all duration-300"
                onClick={() => {
                  setSelectedBooking(null);
                  setDetailsModalOpen(false);
                }}
              >
                Close details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Safety Confirm Cancel Booking */}
      {cancelConfirmOpen && selectedBooking && (
        <div className="fixed inset-0 bg-brand-textDark/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border border-brand-border shadow-premium rounded-2xl p-6 md:p-8 max-w-sm w-full text-center flex flex-col gap-5 relative animate-fade">
            <button
              onClick={() => {
                setSelectedBooking(null);
                setCancelConfirmOpen(false);
              }}
              className="absolute top-4 right-4 text-brand-textSecondary hover:text-brand-accent transition-all duration-300"
            >
              <X size={18} />
            </button>

            <div>
              <div className="bg-brand-danger/5 text-brand-danger p-3.5 rounded-full inline-flex border border-brand-danger/15 mx-auto">
                <AlertTriangle size={24} />
              </div>
              <h2 className="text-base font-extrabold text-brand-textDark mt-3 tracking-tight">Cancel playing slot?</h2>
              <p className="text-xs text-brand-textSecondary mt-2 leading-relaxed">
                Are you sure you want to cancel booking <strong>{selectedBooking.bookingId}</strong>? Reserved timing slot will be immediately freed.
              </p>
            </div>

            <div className="flex gap-2.5 justify-center mt-1">
              <button
                type="button"
                className="text-xs font-semibold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-2.5 px-4 rounded-lg transition-all duration-300"
                onClick={() => {
                  setSelectedBooking(null);
                  setCancelConfirmOpen(false);
                }}
              >
                Keep slot
              </button>
              <button
                type="button"
                className="text-xs font-bold text-white bg-brand-danger hover:bg-red-600 py-2.5 px-4 rounded-lg transition-all duration-300"
                onClick={handleCancelBooking}
              >
                Yes, Cancel Booking
              </button>
            </div>
          </div>
        </div>
      )}

      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />

    </div>
  );
};

export default Bookings;

import React, { useState, useEffect, useMemo } from 'react';
import axiosInstance from '../utils/axiosInstance';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Ticket,
  Check,
  MapPin,
  Dribbble,
  X,
  Download,
  AlertCircle,
  CreditCard,
  Info,
  ChevronRight,
  TrendingUp,
  DollarSign
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

const UserBooking = () => {
  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selection states
  const [selectedTurf, setSelectedTurf] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  // Player Contact form states
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponSuccess, setCouponSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Razorpay');

  // Checkout overlays
  const [submitting, setSubmitting] = useState(false);
  const [mockRazorpayOpen, setMockRazorpayOpen] = useState(false);
  const [activeBooking, setActiveBooking] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [downloadedBookingId, setDownloadedBookingId] = useState('');

  // Reusable Alert Toast
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [toastVisible, setToastVisible] = useState(false);

  const triggerToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3500);
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    // 1. Preload Razorpay script on mount for immediate opening
    loadRazorpayScript().then((success) => {
      if (success) {
        console.log('💳 Razorpay checkout script preloaded.');
      }
    });

    // 2. Fetch Turfs
    const loadTurfs = async () => {
      try {
        const response = await axiosInstance.get('/turfs');
        if (response.data.success) {
          setTurfs(response.data.turfs);
          if (response.data.turfs.length > 0) {
            setSelectedTurf(response.data.turfs[0]); // Default to first turf for smooth UX
          }
        }
      } catch (err) {
        console.error(err);
        setError('Error synchronizing sports turfs. Please run the backend API.');
      } finally {
        setLoading(false);
      }
    };
    loadTurfs();

    // 3. Auto-fill contact details from localStorage
    const cachedName = localStorage.getItem('turf_customer_name');
    const cachedEmail = localStorage.getItem('turf_customer_email');
    const cachedPhone = localStorage.getItem('turf_customer_phone');
    if (cachedName) setCustomerName(cachedName);
    if (cachedEmail) setCustomerEmail(cachedEmail);
    if (cachedPhone) setCustomerPhone(cachedPhone);

    // Default booking date to Today
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setBookingDate(todayStr);
  }, []);

  // Fetch timings when Date/Turf modifications occur
  useEffect(() => {
    if (!selectedTurf || !bookingDate) {
      setAvailableSlots([]);
      return;
    }

    const loadSlots = async () => {
      setSlotsLoading(true);
      setSelectedSlot('');
      try {
        const response = await axiosInstance.get(`/bookings/slots-available?turfId=${selectedTurf._id}&date=${bookingDate}`);
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
  }, [selectedTurf, bookingDate]);

  // Apply Coupon promo code
  const handleApplyCoupon = async () => {
    if (!couponCode) {
      triggerToast('Please write a coupon code', 'error');
      return;
    }
    if (!selectedTurf) {
      triggerToast('Select a sports turf venue first', 'error');
      return;
    }

    try {
      const response = await axiosInstance.post('/coupons/apply', {
        code: couponCode,
        bookingAmount: selectedTurf.pricePerHour,
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
      triggerToast('Invalid coupon code.', 'error');
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      triggerToast('Please pick a timing slot', 'error');
      return;
    }

    // Save customer details to localStorage for zero-typing auto-fill next time
    localStorage.setItem('turf_customer_name', customerName);
    localStorage.setItem('turf_customer_email', customerEmail);
    localStorage.setItem('turf_customer_phone', customerPhone);

    setSubmitting(true);
    try {
      const payload = {
        turfId: selectedTurf._id,
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
        const booking = response.data.booking;
        
        if (paymentMethod === 'Cash') {
          setActiveBooking(booking);
          setCheckoutModalOpen(false);
          setReceiptModalOpen(true);
          triggerToast('Slot booked! Present QR at reception.');
          resetForm();
        } else {
          const params = response.data.razorpayParameters;
          
          if (params.order_id.startsWith('order_sandbox_')) {
            // Simulated local checkout
            setActiveBooking(booking);
            setCheckoutModalOpen(false);
            setMockRazorpayOpen(true);
            setSubmitting(false);
          } else {
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
              triggerToast('Failed to load Razorpay. Check your connection.', 'error');
              return;
            }

            const options = {
              key: params.key,
              amount: params.amount,
              currency: params.currency,
              name: params.name,
              description: params.description,
              order_id: params.order_id,
              prefill: {
                name: customerName,
                email: customerEmail,
                contact: customerPhone,
              },
              theme: {
                color: '#4da6ff',
              },
              handler: async function (responsePayload) {
                setSubmitting(true);
                try {
                  const verifyResponse = await axiosInstance.post('/payments/verify', {
                    bookingId: booking.bookingId,
                    razorpay_order_id: responsePayload.razorpay_order_id,
                    razorpay_payment_id: responsePayload.razorpay_payment_id,
                    razorpay_signature: responsePayload.razorpay_signature,
                  });

                  if (verifyResponse.data.success) {
                    setActiveBooking(verifyResponse.data.booking);
                    setCheckoutModalOpen(false);
                    setReceiptModalOpen(true);
                    triggerToast('Transaction completed successfully!');
                    resetForm();
                  }
                } catch (err) {
                  console.error(err);
                  triggerToast('Payment verification rejected.', 'error');
                } finally {
                  setSubmitting(false);
                }
              },
              modal: {
                ondismiss: function () {
                  setSubmitting(false);
                }
              }
            };

            const paymentObject = new window.Razorpay(options);
            paymentObject.open();
          }
        }
      }
    } catch (err) {
      console.error(err);
      triggerToast(err.response?.data?.message || 'Failed to complete booking', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimulatePayment = async (status) => {
    if (!activeBooking) return;
    setSubmitting(true);
    setMockRazorpayOpen(false);
    
    if (status === 'success') {
      try {
        const verifyResponse = await axiosInstance.post('/payments/verify', {
          bookingId: activeBooking.bookingId,
          razorpay_order_id: activeBooking.razorpayOrderId,
          razorpay_payment_id: `pay_mock_${Date.now()}`,
          razorpay_signature: 'mock_sandbox_signature_hash',
        });

        if (verifyResponse.data.success) {
          setActiveBooking(verifyResponse.data.booking);
          setReceiptModalOpen(true);
          triggerToast('Sandbox Transaction completed successfully!');
          resetForm();
        }
      } catch (err) {
        console.error(err);
        triggerToast('Sandbox payment verification rejected.', 'error');
      } finally {
        setSubmitting(false);
      }
    } else {
      triggerToast('Sandbox payment simulation cancelled.', 'error');
      setSubmitting(false);
    }
  };

  const downloadReceiptAsPNG = () => {
    if (!activeBooking) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = 450;
    canvas.height = 650;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, '#3b82f6');
    grad.addColorStop(1, '#2563eb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, 12);
    
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('BOOKING RECEIPT', canvas.width / 2, 50);
    
    ctx.fillStyle = '#64748b';
    ctx.font = '500 12px sans-serif';
    ctx.fillText('Timings successfully reserved at Turf Hub', canvas.width / 2, 70);
    
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(35, 88);
    ctx.lineTo(canvas.width - 35, 88);
    ctx.stroke();
    ctx.setLineDash([]); 

    const qrImg = new Image();
    qrImg.src = activeBooking.qrCodeData;
    qrImg.onload = () => {
      ctx.drawImage(qrImg, canvas.width / 2 - 80, 105, 160, 160);
      
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
        
        if (!isLast && val.length > 25) {
          ctx.font = 'bold 10px sans-serif';
        }
        ctx.fillText(val, canvas.width - 40, startY);
        startY += rowHeight;
      };
      
      drawRow('Booking ID:', activeBooking.bookingId);
      drawRow('Player Name:', activeBooking.customerName);
      drawRow('Phone Number:', activeBooking.customerPhone);
      drawRow('Email Address:', activeBooking.customerEmail);
      drawRow('Timing Slot:', `${activeBooking.date} (${activeBooking.slot})`);
      drawRow('Turf Venue:', selectedTurf ? selectedTurf.name : 'Main Turf Arena');
      drawRow('Payment Method:', `${activeBooking.paymentMethod} (${activeBooking.paymentStatus})`);
      
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(35, startY - 12);
      ctx.lineTo(canvas.width - 35, startY - 12);
      ctx.stroke();
      
      startY += 8;
      drawRow('Total Amount Paid:', `₹${activeBooking.finalAmount}`, true);
      
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 9px sans-serif';
      ctx.fillText(`Generated on: ${new Date().toLocaleString()}`, canvas.width / 2, canvas.height - 40);
      
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 10px sans-serif';
      ctx.fillText('Thank you for booking with Turf Hub! Present QR at reception.', canvas.width / 2, canvas.height - 22);
      
      const link = document.createElement('a');
      link.download = `Receipt_${activeBooking.bookingId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
  };

  useEffect(() => {
    if (receiptModalOpen && activeBooking && activeBooking.bookingId !== downloadedBookingId) {
      setDownloadedBookingId(activeBooking.bookingId);
      const timer = setTimeout(() => {
        downloadReceiptAsPNG();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [receiptModalOpen, activeBooking, downloadedBookingId]);

  const resetForm = () => {
    setSelectedSlot('');
    setCheckoutModalOpen(false);
    setCouponCode('');
    setCouponDiscount(0);
    setCouponMessage('');
    setCouponSuccess(false);
  };

  const getHorizontalDates = () => {
    const dates = [];
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 0; i < 4; i++) { // Render 4 days for a bit more choice
      const d = new Date();
      d.setDate(d.getDate() + i);
      
      const label = weekdayNames[d.getDay()];
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const valueStr = `${year}-${month}-${day}`;

      dates.push({
        label,
        day: d.getDate(),
        month: monthNames[d.getMonth()],
        value: valueStr,
      });
    }
    return dates;
  };

  const horizontalDates = useMemo(() => getHorizontalDates(), []);
  const finalAmount = selectedTurf ? Math.max(0, selectedTurf.pricePerHour - couponDiscount) : 0;

  // Filter only valid active slots to display
  const activeValidSlots = useMemo(() => {
    return availableSlots.filter((s) => isSlotTimeValid(s.time, bookingDate));
  }, [availableSlots, bookingDate]);

  return (
    <div className="min-h-screen bg-brand-light pb-20">
      
      {/* Toast Alert */}
      {toastVisible && (
        <div className={`fixed top-6 right-6 px-6 py-4 rounded-xl z-50 shadow-premium flex items-center gap-3 font-semibold text-white animate-slide ${
          toastType === 'success' ? 'bg-brand-success' : 'bg-brand-danger'
        }`}>
          <AlertCircle size={18} />
          {toastMessage}
        </div>
      )}

      {/* Top Stripe Navigation */}
      <header className="h-[56px] sm:h-[70px] bg-white border-b border-brand-border/60 flex items-center justify-between px-4 sm:px-6 md:px-12 sticky top-0 z-40 shadow-soft">
        <div className="flex items-center gap-2">
          <div className="bg-brand-highlight text-brand-accent p-1.5 sm:p-2 rounded-lg border border-brand-border/60">
            <Dribbble size={18} className="animate-pulse" />
          </div>
          <span className="font-sans font-extrabold text-brand-textDark tracking-tight text-base sm:text-lg">TURF HUB</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs font-semibold text-brand-textSecondary">
          <span>Speedy Slot Booking Portal</span>
        </div>
      </header>

      {/* Main Single-Page Interface */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 mt-4 sm:mt-8">
        
        {/* Dynamic Title */}
        <div className="mb-4 sm:mb-6 animate-fade">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-brand-textDark tracking-tight">
            Reserve Your Timing Slot
          </h1>
          <p className="text-[11px] sm:text-xs text-brand-textSecondary mt-0.5 sm:mt-1">
            Pick your preferred turf arena, select an available hour, and checkout instantly.
          </p>
        </div>

        {loading ? (
          // Skeleton Loader for initial list
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="bg-white border border-brand-border/50 rounded-xl p-6 shadow-soft flex flex-col gap-4">
                <div className="h-4 bg-brand-light animate-pulse rounded-lg w-1/4" />
                <div className="h-16 bg-brand-light animate-pulse rounded-lg w-full" />
                <div className="h-16 bg-brand-light animate-pulse rounded-lg w-full" />
              </div>
            </div>
            <div className="lg:col-span-1 bg-white border border-brand-border/50 rounded-xl p-6 h-40 shadow-soft animate-pulse" />
          </div>
        ) : error ? (
          <div className="bg-white border border-brand-border rounded-xl p-8 text-center text-brand-danger shadow-soft max-w-lg mx-auto">
            <p className="font-semibold text-sm">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT 2 COLUMNS: Turf selection & Timing Picker (Single-Page Layout) */}
            <div className="lg:col-span-2 flex flex-col gap-6 animate-fade">
              
              {/* Turf List */}
              <div className="bg-white border border-brand-border/60 rounded-xl p-4 sm:p-6 shadow-soft hover:shadow-premium transition-all duration-300">
                <h3 className="text-brand-textDark font-extrabold text-xs sm:text-sm md:text-base flex items-center gap-2 mb-3 sm:mb-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-success" /> Choose Sports Arena
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {turfs.map((t) => {
                    const isPicked = selectedTurf?._id === t._id;
                    return (
                      <div
                        key={t._id}
                        onClick={() => {
                          setSelectedTurf(t);
                          triggerToast(`Selected ${t.name}`);
                        }}
                        className={`p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 cursor-pointer flex flex-col gap-2 sm:gap-2.5 transition-all duration-300 relative overflow-hidden ${
                          isPicked
                            ? 'border-brand-accent bg-brand-highlight/25 shadow-soft scale-[1.01]'
                            : 'border-brand-border/40 bg-white hover:border-brand-accent/50 hover:bg-brand-light/30'
                        }`}
                      >
                        {isPicked && (
                          <div className="absolute top-0 right-0 bg-brand-accent text-white p-1 rounded-bl-lg">
                            <Check size={11} />
                          </div>
                        )}
                        <div>
                          <h4 className="font-extrabold text-brand-textDark text-xs sm:text-sm">{t.name}</h4>
                          <span className="text-[9px] sm:text-[10px] text-brand-textSecondary font-semibold uppercase tracking-wider block mt-0.5">{t.sportType}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xxs text-brand-textSecondary border-t border-brand-border/20 pt-1.5 sm:pt-2 mt-0.5">
                          <MapPin size={11} className="text-brand-accent shrink-0" />
                          <span className="truncate">{t.location}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-brand-border/25 pt-1.5 sm:pt-2 mt-1">
                          <span className="text-[9px] sm:text-[10px] text-brand-textMuted font-medium">Hourly Pricing:</span>
                          <span className="text-xs sm:text-sm font-black text-brand-textDark">₹{t.pricePerHour}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Date & Hour Slots Selection (Combined in Single Screen) */}
              <div className="bg-white border border-brand-border/60 rounded-xl p-4 sm:p-6 shadow-soft hover:shadow-premium transition-all duration-300">
                <h3 className="text-brand-textDark font-extrabold text-xs sm:text-sm md:text-base flex items-center gap-2 mb-3 sm:mb-4">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-accent" /> Date & Hour Slots Selection
                </h3>

                {/* Horizontal Date picker */}
                <div className="flex gap-2 overflow-x-auto pb-2.5 no-scrollbar scroll-smooth">
                  {horizontalDates.map((d, index) => {
                    const isSelected = bookingDate === d.value;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setBookingDate(d.value)}
                        className={`flex-shrink-0 flex flex-col items-center justify-center p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 w-[70px] sm:w-[85px] transition-all duration-300 ${
                          isSelected
                            ? 'border-brand-accent bg-brand-accent text-white shadow-soft scale-102 font-bold'
                            : 'border-brand-border/40 bg-white text-brand-textDark hover:border-brand-accent/50'
                        }`}
                      >
                        <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-white/90' : 'text-brand-textMuted'}`}>
                          {d.label}
                        </span>
                        <span className="text-sm sm:text-lg font-black mt-0.5 leading-none">{d.day}</span>
                        <span className={`text-[8px] sm:text-[9px] font-bold ${isSelected ? 'text-white/90' : 'text-brand-textSecondary'}`}>
                          {d.month}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Available Hours */}
                <div className="mt-4 sm:mt-6 border-t border-brand-border/20 pt-4 sm:pt-5">
                  <span className="text-[10px] sm:text-xs font-bold text-brand-textSecondary uppercase tracking-wider block mb-2.5 sm:mb-3.5">
                    Available Slots ({bookingDate})
                  </span>

                  {slotsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-brand-accent py-6 justify-center">
                      <div className="border-2 border-brand-highlight border-l-brand-accent rounded-full w-4 h-4 animate-spin" />
                      Scanning slot status...
                    </div>
                  ) : activeValidSlots.length === 0 ? (
                    <div className="border border-dashed border-brand-border/80 bg-brand-light/35 rounded-xl p-8 text-center text-xs text-brand-textMuted font-semibold">
                      No matching slots found on this date. Please pick another date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {activeValidSlots.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={!s.isAvailable}
                          onClick={() => {
                            setSelectedSlot(s.time);
                            // On mobile viewports, let users use the sticky bottom action bar to confirm.
                            // On desktop, immediately open checkout popup modal.
                            if (window.innerWidth >= 640) {
                              setCheckoutModalOpen(true);
                            } else {
                              triggerToast(`Selected slot ${s.time}! Tap "Book Now" below.`);
                            }
                          }}
                          className={`py-2.5 px-2 rounded-lg border-2 text-center text-[10px] sm:text-xs font-bold transition-all duration-300 flex items-center justify-center gap-1.5 hover:scale-[1.01] ${
                            selectedSlot === s.time
                              ? 'bg-brand-accent text-white border-brand-accent shadow-soft'
                              : s.isAvailable
                              ? 'bg-white border-brand-border/40 text-brand-textDark hover:border-brand-accent hover:bg-brand-highlight/20 hover:text-brand-accent'
                              : 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed opacity-55 line-through'
                          }`}
                        >
                          <Clock size={11} className="shrink-0" />
                          {s.time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Sidebar Summary Guide (Fidelity Assistant) */}
            <div className="lg:col-span-1 animate-fade">
              <div className="bg-white border border-brand-border/60 border-l-4 border-l-brand-accent rounded-xl p-6 shadow-soft hover:shadow-premium transition-all duration-300 sticky top-[95px] flex flex-col gap-4.5">
                <div>
                  <span className="text-[9px] font-black text-brand-accent uppercase tracking-wider block">Live Selection Summary</span>
                  <h3 className="text-brand-textDark font-extrabold text-base mt-0.5">Your Active Slot</h3>
                </div>

                <div className="bg-brand-light/50 border border-brand-border/50 rounded-xl p-4 flex flex-col gap-3 text-xs leading-relaxed text-brand-textSecondary font-semibold">
                  <div className="flex justify-between items-center border-b border-brand-border/20 pb-2">
                    <span>Selected Turf:</span>
                    <span className="font-extrabold text-brand-textDark truncate max-w-[150px]">{selectedTurf ? selectedTurf.name : 'None Selected'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-brand-border/20 pb-2">
                    <span>Booking Date:</span>
                    <span className="font-extrabold text-brand-textDark">{bookingDate || 'None Selected'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Timing Slot:</span>
                    <span className="font-extrabold text-brand-accent">{selectedSlot || 'Tap any slot below'}</span>
                  </div>
                </div>

                <div className="bg-brand-highlight/35 border border-brand-border/40 rounded-xl p-4 flex gap-2 text-xxs text-brand-textSecondary leading-relaxed">
                  <Info size={16} className="text-brand-accent shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-brand-textDark block mb-0.5">Speedy Booking Guide</strong>
                    Simply tap any available timings slot card in the timeline to load the checkout drawer directly. No typing or multi-step wizard is needed.
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* QUICK CHECKOUT POPUP MODAL (Zero-Typing, Single-Page Checkout Drawer) */}
      {checkoutModalOpen && selectedTurf && selectedSlot && (
        <div className="fixed inset-0 bg-brand-textDark/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-fade">
          <div className="bg-white border border-brand-border shadow-premium rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 max-w-lg w-full relative flex flex-col gap-3.5 sm:gap-5 overflow-y-auto animate-fade max-h-[96vh] my-auto">
            {/* Top decorative stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-accent to-blue-500" />
            
            <button
              onClick={() => setCheckoutModalOpen(false)}
              className="absolute top-5 right-5 text-brand-textSecondary hover:text-brand-accent transition-all duration-300"
            >
              <X size={18} />
            </button>

            <div>
              <span className="text-[9px] font-black text-brand-accent uppercase tracking-wider block">TIMING RESERVATION</span>
              <h2 className="text-base font-extrabold text-brand-textDark tracking-tight mt-0.5">Confirm Checkout Details</h2>
            </div>

            {/* Quick summary box */}
            <div className="bg-brand-light border border-brand-border/60 rounded-xl p-3.5 flex justify-between items-center text-xs">
              <div>
                <span className="font-extrabold text-brand-textDark">{selectedTurf.name}</span>
                <span className="text-[10px] text-brand-textSecondary block mt-0.5">{bookingDate} • {selectedSlot}</span>
              </div>
              <div className="text-right">
                <span className="font-black text-sm text-brand-textDark">₹{selectedTurf.pricePerHour}</span>
                <span className="text-[9px] text-brand-textMuted block">hourly rate</span>
              </div>
            </div>

            <form onSubmit={handleBookingSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Player Full Name</label>
                <div className="relative flex items-center">
                  <User size={13} className="absolute left-3 text-brand-textMuted" />
                  <input
                    type="text"
                    placeholder="E.g., David Beckham"
                    className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 pl-9 pr-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow font-semibold"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Mobile Number</label>
                  <div className="relative flex items-center">
                    <Phone size={13} className="absolute left-3 text-brand-textMuted" />
                    <input
                      type="tel"
                      placeholder="10-digit number"
                      className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 pl-9 pr-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow font-semibold"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Email Address</label>
                  <div className="relative flex items-center">
                    <Mail size={13} className="absolute left-3 text-brand-textMuted" />
                    <input
                      type="email"
                      placeholder="player@example.com"
                      className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 pl-9 pr-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow font-semibold"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Promo Coupon Row */}
              <div className="flex flex-col gap-1">
                <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">Apply Promo Coupon</label>
                <div className="flex gap-2">
                  <div className="relative flex items-center flex-1">
                    <Ticket size={13} className="absolute left-3 text-brand-textMuted" />
                    <input
                      type="text"
                      placeholder="WELCOME200"
                      className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2 pl-9 pr-2 text-xs outline-none transition-all duration-300 uppercase focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow font-bold"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="text-xs font-bold px-4 rounded-lg bg-brand-light hover:bg-brand-highlight text-brand-accent border border-brand-border transition-all duration-300 cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
                {couponMessage && (
                  <span className={`text-[10px] font-bold mt-1 block ${
                    couponSuccess ? 'text-brand-success' : 'text-brand-danger'
                  }`}>
                    {couponMessage}
                  </span>
                )}
              </div>

              {/* Billing Breakdowns */}
              <div className="border-t border-brand-border/40 pt-3 mt-1 flex flex-col gap-1.5 text-xs text-brand-textSecondary">
                {couponSuccess && (
                  <div className="flex justify-between text-brand-success font-semibold">
                    <span>Coupon Applied:</span>
                    <span>-₹{couponDiscount}</span>
                  </div>
                )}
                <div className="flex justify-between text-brand-textDark font-extrabold border-t border-brand-border/20 pt-2 mt-1">
                  <span className="text-sm">Total Payable Amount:</span>
                  <span className="text-base text-brand-accent">₹{finalAmount}</span>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => setCheckoutModalOpen(false)}
                  className="flex-1 text-xs font-bold text-brand-textSecondary bg-brand-light border border-brand-border hover:bg-brand-highlight py-3.5 px-4 rounded-xl transition-all duration-300 cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] bg-brand-accent hover:bg-brand-accentHover disabled:bg-brand-textMuted text-white text-xs font-bold py-3.5 px-4 rounded-xl shadow-premium tracking-wide uppercase transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 hover:scale-[1.01]"
                >
                  {submitting ? (
                    <>
                      <div className="border-2 border-white/20 border-l-white rounded-full w-4 h-4 animate-spin" />
                      Creating Slot Reservation...
                    </>
                  ) : (
                    `Confirm & Pay Online`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DYNAMIC SUCCESS QR CARD MODAL */}
      {receiptModalOpen && activeBooking && (
        <div className="fixed inset-0 bg-brand-textDark/65 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade">
          <div className="bg-white border border-brand-border shadow-premium rounded-xl p-6 md:p-8 max-w-sm w-full text-center relative flex flex-col gap-4.5 animate-fade my-6 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setReceiptModalOpen(false)}
              className="absolute top-4 right-4 text-brand-textSecondary hover:text-brand-accent transition-all duration-300"
            >
              <X size={18} />
            </button>

            <div>
              <div className="bg-brand-highlight text-brand-accent p-3.5 rounded-full inline-flex border border-brand-border/60 mx-auto">
                <Check size={26} />
              </div>
              <h2 className="text-base font-extrabold text-brand-textDark mt-3.5 tracking-tight">Booking Confirmed!</h2>
              <p className="text-xs text-brand-textSecondary mt-0.5">Your timing slot is successfully reserved.</p>
              <p className="text-[10px] sm:text-xs text-brand-success font-bold mt-1.5 bg-green-50 border border-green-200 rounded-lg py-1 px-2.5 inline-block">
                Check your Gmail for ticket anytime!
              </p>
            </div>

            {/* QR ticket */}
            {activeBooking.qrCodeData && (
              <div className="bg-white border border-brand-border/60 p-3.5 rounded-xl w-[170px] h-[170px] mx-auto flex items-center justify-center shadow-soft">
                <img
                  src={activeBooking.qrCodeData}
                  alt={`Receipt code ${activeBooking.bookingId}`}
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <div className="bg-brand-light border border-brand-border/60 rounded-xl p-4 text-left text-xs flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="text-brand-textMuted">Booking ID:</span>
                <span className="font-extrabold text-brand-textDark">{activeBooking.bookingId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted">Player:</span>
                <span className="font-semibold text-brand-textDark">{activeBooking.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted">Timing:</span>
                <span className="font-semibold text-brand-textDark truncate max-w-[160px]">{activeBooking.date} ({activeBooking.slot})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted">Payment Status:</span>
                <span className="font-bold text-brand-success">{activeBooking.paymentStatus} ({activeBooking.paymentMethod})</span>
              </div>
              <div className="flex justify-between border-t border-brand-border/40 pt-2.5 mt-1">
                <span className="font-bold text-brand-textDark">Paid Total:</span>
                <span className="font-extrabold text-brand-accent text-sm">₹{activeBooking.finalAmount}</span>
              </div>
            </div>

            <div className="mt-1">
              <button
                onClick={downloadReceiptAsPNG}
                className="w-full bg-brand-success hover:bg-green-600 text-white py-3.5 px-4 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-1.5 shadow-soft hover:scale-[1.01]"
              >
                <Download size={14} /> Download Receipt Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RAZORPAY SANDBOX MOCK MODAL */}
      {mockRazorpayOpen && activeBooking && (
        <div className="fixed inset-0 bg-brand-textDark/65 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white border-2 border-brand-accent/35 shadow-premium rounded-xl p-6 md:p-8 max-w-md w-full relative flex flex-col gap-4.5 overflow-hidden">
            
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-accent to-blue-500" />
            
            <div className="flex justify-between items-start mt-2">
              <div className="flex items-center gap-2">
                <div className="bg-brand-highlight text-brand-accent p-2 rounded-lg border border-brand-border/60">
                  <CreditCard size={18} className="animate-pulse" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-brand-textDark tracking-tight">Razorpay Sandbox</h2>
                  <span className="text-[10px] text-brand-textMuted font-bold uppercase tracking-wider block">Simulated Checkout</span>
                </div>
              </div>
              <button
                onClick={() => handleSimulatePayment('fail')}
                className="text-brand-textSecondary hover:text-brand-danger transition-all duration-300 p-1 hover:bg-brand-light rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="border border-yellow-250 bg-yellow-50/50 rounded-xl p-4 flex gap-3 text-xs text-yellow-800 leading-relaxed shadow-soft">
              <Info size={18} className="text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-yellow-900">Sandbox Test Mode Enabled</strong>
                <p className="mt-0.5 text-yellow-850 text-[11px]">We detected no active or real Razorpay API keys. You can simulate success/failure below.</p>
              </div>
            </div>

            <div className="bg-brand-light border border-brand-border/60 rounded-xl p-4 flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-brand-textMuted font-medium">Merchant:</span>
                <span className="font-bold text-brand-textDark">Turf Booking Hub</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted font-medium">Order ID:</span>
                <span className="font-mono text-[10px] font-bold text-brand-textDark">{activeBooking.razorpayOrderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted font-medium">Amount Payable:</span>
                <span className="font-extrabold text-brand-accent text-sm">₹{activeBooking.finalAmount}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 mt-2">
              <button
                onClick={() => handleSimulatePayment('success')}
                className="w-full bg-brand-success hover:bg-green-600 text-white py-3 px-4 rounded-lg font-bold text-xs tracking-wider uppercase transition-all duration-300 shadow-soft flex items-center justify-center gap-1.5 hover:scale-[1.01]"
              >
                <Check size={14} /> Simulate Successful Payment
              </button>
              
              <button
                onClick={() => handleSimulatePayment('fail')}
                className="w-full bg-white hover:bg-brand-light border border-brand-danger text-brand-danger py-3 px-4 rounded-lg font-bold text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-1.5 hover:scale-[1.01]"
              >
                <X size={14} /> Simulate Cancel / Failure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STICKY BOTTOM ACTION BAR FOR MOBILE */}
      {selectedSlot && selectedTurf && !checkoutModalOpen && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-brand-border/60 p-3 z-40 flex items-center justify-between shadow-premium sm:hidden animate-fade">
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] text-brand-textMuted font-bold uppercase tracking-wider">Timing Hour</span>
            <span className="text-[11px] font-black text-brand-textDark truncate leading-tight mt-0.5">{bookingDate} • {selectedSlot}</span>
            <span className="text-xs font-black text-brand-accent mt-0.5 leading-none">₹{finalAmount} Total</span>
          </div>
          <button
            onClick={() => setCheckoutModalOpen(true)}
            className="bg-brand-accent hover:bg-brand-accentHover text-white text-xs font-black py-3 px-5 rounded-xl shadow-premium tracking-wide uppercase transition-all duration-300 active:scale-[0.98] shrink-0"
          >
            Book Now
          </button>
        </div>
      )}
    </div>
  );
};

export default UserBooking;

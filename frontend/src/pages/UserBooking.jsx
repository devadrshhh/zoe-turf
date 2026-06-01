import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Ticket,
  Check,
  QrCode,
  MapPin,
  Sparkles,
  Info,
  CreditCard,
  X,
  Dribbble,
  ChevronRight,
  Printer,
  Download,
  AlertCircle
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
  const [currentStep, setCurrentStep] = useState(1); // 1 = Pick Turf, 2 = Date & Slots, 3 = Summary

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

  useEffect(() => {
    const loadTurfs = async () => {
      try {
        const response = await axiosInstance.get('`${import.meta.env.VITE_API_URL}/api/turfs`');
        if (response.data.success) {
          setTurfs(response.data.turfs);
          if (response.data.turfs.length > 0) {
            setSelectedTurf(response.data.turfs[0]); // Default to first turf for high fidelity UX
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

    // Default booking date to Today using local timezone calculations
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

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      triggerToast('Please pick a timing slot', 'error');
      return;
    }

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
          setReceiptModalOpen(true);
          triggerToast('Slot booked! Present QR at reception.');
          resetForm();
        } else {
          const params = response.data.razorpayParameters;
          
          if (params.order_id.startsWith('order_sandbox_')) {
            // Simulated local checkout
            setActiveBooking(booking);
            setMockRazorpayOpen(true);
            setSubmitting(false);
          } else {
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
              triggerToast('Failed to load Razorpay payment gateway. Please check your connection.', 'error');
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
                    setReceiptModalOpen(true);
                    triggerToast('Transaction completed successfully!');
                    resetForm();
                  }
                } catch (err) {
                  console.error(err);
                  triggerToast('Razorpay payment verification rejected.', 'error');
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
      triggerToast('Sandbox payment simulation cancelled or failed.', 'error');
      setSubmitting(false);
    }
  };  const downloadReceiptAsPNG = () => {
    if (!activeBooking) return;
    
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
    qrImg.src = activeBooking.qrCodeData;
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
      
      drawRow('Booking ID:', activeBooking.bookingId);
      drawRow('Player Name:', activeBooking.customerName);
      drawRow('Phone Number:', activeBooking.customerPhone);
      drawRow('Email Address:', activeBooking.customerEmail);
      drawRow('Timing Slot:', `${activeBooking.date} (${activeBooking.slot})`);
      drawRow('Turf Venue:', selectedTurf ? selectedTurf.name : 'Main Turf Arena');
      drawRow('Payment Method:', `${activeBooking.paymentMethod} (${activeBooking.paymentStatus})`);
      
      // Divider
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(35, startY - 12);
      ctx.lineTo(canvas.width - 35, startY - 12);
      ctx.stroke();
      
      startY += 8;
      drawRow('Total Amount Paid:', `₹${activeBooking.finalAmount}`, true);
      
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
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCouponCode('');
    setCouponDiscount(0);
    setCouponMessage('');
    setCouponSuccess(false);
  };

  const getHorizontalDates = () => {
    const dates = [];
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      
      const label = weekdayNames[d.getDay()];

      // Always format as local YYYY-MM-DD to match database calendars and prevent UTC timezone shifts
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

  const horizontalDates = getHorizontalDates();
  const finalAmount = selectedTurf ? Math.max(0, selectedTurf.pricePerHour - couponDiscount) : 0;

  return (
    <div className="min-h-screen bg-brand-light pb-20">
      
      {/* Toast popup */}
      {toastVisible && (
        <div className={`fixed top-6 right-6 px-6 py-4 rounded-xl z-50 shadow-premium flex items-center gap-3 font-semibold text-white animate-slide ${
          toastType === 'success' ? 'bg-brand-success' : 'bg-brand-danger'
        }`}>
          <AlertCircle size={18} />
          {toastMessage}
        </div>
      )}

      {/* Top Stripe Navigation */}
      <header className="h-[70px] bg-white border-b border-brand-border/60 flex items-center justify-between px-6 md:px-12 sticky top-0 z-40 shadow-soft">
        <div className="flex items-center gap-2">
          <div className="bg-brand-highlight text-brand-accent p-2 rounded-lg border border-brand-border">
            <Dribbble size={20} className="animate-pulse" />
          </div>
          <span className="font-sans font-extrabold text-brand-textDark tracking-tight text-lg">TURF HUB</span>
        </div>
      </header>

      {/* Hero Welcome Intro */}
      <div className="max-w-[1200px] mx-auto mt-8 px-6 text-center animate-fade">
        <h1 className="text-3xl md:text-4xl font-extrabold text-brand-textDark tracking-tight">
          Reserve Your Timing Slot
        </h1>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 mt-10">
        {loading ? (
          <div className="flex h-[40vh] items-center justify-center text-brand-accent">
            <div className="text-center">
              <div className="border-[3px] border-brand-highlight border-l-brand-accent rounded-full w-9 h-9 animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium">Syncing sports arenas...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white border border-brand-border rounded-xl p-8 text-center text-brand-danger shadow-soft max-w-lg mx-auto">
            <p className="font-semibold text-sm">{error}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {/* Mobile Stepper Header (Wizard indicator) */}
            <div className="lg:hidden">
              <div className="flex bg-white border border-brand-border/60 rounded-xl p-1.5 shadow-soft justify-between items-center relative overflow-hidden">
                {[
                  { step: 1, label: 'Pick Turf' },
                  { step: 2, label: 'Date & Slots' },
                  { step: 3, label: 'Summary' },
                ].map((item) => {
                  const isCompleted = currentStep > item.step;
                  const isCurrent = currentStep === item.step;
                  return (
                    <button
                      key={item.step}
                      type="button"
                      onClick={() => {
                        if (item.step === 1 || (item.step === 2 && selectedTurf) || (item.step === 3 && selectedTurf && selectedSlot)) {
                          setCurrentStep(item.step);
                        }
                      }}
                      className={`flex-1 text-center py-2 px-1 rounded-lg text-xxs font-extrabold transition-all duration-300 flex flex-col items-center gap-1.5 cursor-pointer ${
                        isCurrent
                          ? 'bg-brand-highlight text-brand-accent shadow-xs'
                          : isCompleted
                          ? 'text-brand-success'
                          : 'text-brand-textMuted hover:text-brand-textSecondary'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-all duration-300 ${
                        isCurrent
                          ? 'border-brand-accent bg-brand-accent text-white shadow-soft'
                          : isCompleted
                          ? 'border-brand-success bg-brand-success text-white'
                          : 'border-brand-border bg-brand-light text-brand-textMuted'
                      }`}>
                        {item.step}
                      </div>
                      <span className="text-[9px] uppercase tracking-wider">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* LEFT 2 COLUMNS: Slot Timings & Turfs Flow */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                
                {/* Step 1: Select Turf */}
                <div className={`bg-white border border-brand-border/60 rounded-xl p-6 shadow-soft transition-all duration-300 hover:shadow-premium border-l-4 border-l-brand-success ${
                  currentStep === 1 ? 'block' : 'hidden lg:block'
                }`}>
                  <h3 className="text-brand-textDark font-bold text-base flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-brand-success" /> Step 1: Pick Turf
                  </h3>

                <div className="flex flex-col gap-3">
                  {turfs.map((t) => {
                    const isPicked = selectedTurf?._id === t._id;
                    return (
                      <div
                        key={t._id}
                        onClick={() => {
                          setSelectedTurf(t);
                          setCurrentStep(2);
                          triggerToast(`Selected ${t.name}. Moving to Date & Slots!`);
                        }}
                        className={`p-4 rounded-lg border-2 cursor-pointer flex justify-between items-center transition-all duration-300 ${
                          isPicked
                            ? 'border-brand-accent bg-brand-light shadow-soft'
                            : 'border-brand-border bg-white hover:border-brand-accent/50'
                        }`}
                      >
                        <div className="flex-1 pr-4">
                          <h4 className="font-bold text-brand-textDark text-sm md:text-base">{t.name}</h4>
                          <div className="flex items-center gap-4 text-xs text-brand-textSecondary mt-1">
                            <span className="flex items-center gap-1"><MapPin size={12} className="text-brand-accent" /> {t.location}</span>
                          </div>
                          <p className="text-xs text-brand-textMuted mt-2 leading-relaxed max-w-[450px]">
                            {t.description}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-lg md:text-xl font-extrabold text-brand-textDark">₹{t.pricePerHour}</span>
                          <span className="text-xxs text-brand-textMuted block">per hour</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

                {/* Step 2: Date Selector (Horizontal cards) */}
                <div className={`bg-white border border-brand-border/60 rounded-xl p-6 shadow-soft transition-all duration-300 hover:shadow-premium border-l-4 border-l-brand-accent ${
                  currentStep === 2 ? 'block' : 'hidden lg:block'
                }`}>
                  <h3 className="text-brand-textDark font-bold text-base flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-brand-accent" /> Step 2: Date & Available Slots
                  </h3>

                <label className="text-xs font-bold text-brand-textSecondary uppercase tracking-wider block mb-2">
                  Select Timing Date
                </label>

                {/* Horizontal Date Picker Cards */}
                <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                  {horizontalDates.map((d, index) => {
                    const isSelected = bookingDate === d.value;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setBookingDate(d.value)}
                        className={`flex-shrink-0 flex flex-col items-center justify-center p-3 rounded-lg border-2 w-[85px] transition-all duration-300 ${
                          isSelected
                            ? 'border-brand-accent bg-brand-accent text-white shadow-soft scale-102'
                            : 'border-brand-border bg-white text-brand-textDark hover:border-brand-accent/50'
                        }`}
                      >
                        <span className={`text-xxs font-bold uppercase tracking-wider ${isSelected ? 'text-white/80' : 'text-brand-textMuted'}`}>
                          {d.label}
                        </span>
                        <span className="text-lg font-extrabold mt-0.5">{d.day}</span>
                        <span className={`text-xxs font-semibold ${isSelected ? 'text-white/80' : 'text-brand-textSecondary'}`}>
                          {d.month}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Slot Selector Timing Cards */}
                <div className="mt-6">
                  <label className="text-xs font-bold text-brand-textSecondary uppercase tracking-wider block mb-3">
                    Pick Timings Hours
                  </label>

                  {!selectedTurf || !bookingDate ? (
                    <div className="border border-dashed border-brand-border bg-brand-light/30 rounded-lg p-6 text-center text-xs text-brand-textMuted">
                      Please pick both Turf and Date to display timings slots.
                    </div>
                  ) : slotsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-brand-accent">
                      <div className="border-2 border-brand-highlight border-l-brand-accent rounded-full w-4 h-4 animate-spin" />
                      Scanning availability...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 lg:max-h-[220px] lg:overflow-y-auto pr-1">
                      {availableSlots
                        .filter((s) => isSlotTimeValid(s.time, bookingDate))
                        .map((s, idx) => (
                          <button
                            key={idx}
                          type="button"
                          disabled={!s.isAvailable}
                          onClick={() => {
                            setSelectedSlot(s.time);
                            setCurrentStep(3);
                            triggerToast(`Selected slot ${s.time}. Complete your contact info!`);
                          }}
                          className={`py-3 px-2 rounded-lg border-2 text-center text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 ${
                            selectedSlot === s.time
                              ? 'bg-brand-accent text-white border-brand-accent shadow-soft'
                              : s.isAvailable
                              ? 'bg-white border-brand-border text-brand-textDark hover:border-brand-accent/50 hover:bg-brand-light'
                              : 'bg-gray-100 border-gray-200 text-gray-450 cursor-not-allowed opacity-75 line-through'
                          }`}
                        >
                          <Clock size={12} />
                          {s.time}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Mobile Back navigation */}
                  <div className="mt-5 flex lg:hidden">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="w-full text-xs font-bold text-brand-textSecondary bg-brand-light border border-brand-border hover:bg-brand-highlight py-2.5 px-4 rounded-xl transition-all duration-300 cursor-pointer"
                    >
                      ← Back to Pick Turf
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Player Info & Checkout Summary */}
            <div className={`lg:col-span-1 ${
              currentStep === 3 ? 'block' : 'hidden lg:block'
            }`}>
              <div className="bg-white border border-brand-border/60 border-l-4 border-l-brand-warning rounded-xl p-6 shadow-soft transition-all duration-300 hover:shadow-premium sticky top-[90px]">
                <h3 className="text-brand-textDark font-bold text-base flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-brand-warning" /> Step 3: Booking Summary
                </h3>

                <form onSubmit={handleBookingSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">
                      Player Full Name
                    </label>
                    <div className="relative flex items-center">
                      <User size={14} className="absolute left-3 text-brand-textMuted" />
                      <input
                        type="text"
                        placeholder="E.g., David Beckham"
                        className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 pl-9 pr-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">
                      Mobile Number
                    </label>
                    <div className="relative flex items-center">
                      <Phone size={14} className="absolute left-3 text-brand-textMuted" />
                      <input
                        type="tel"
                        placeholder="10 digit phone number"
                        className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 pl-9 pr-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">
                      Email Address
                    </label>
                    <div className="relative flex items-center">
                      <Mail size={14} className="absolute left-3 text-brand-textMuted" />
                      <input
                        type="email"
                        placeholder="player@example.com"
                        className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 pl-9 pr-3 text-xs outline-none transition-all duration-300 focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Promo coupons */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">
                      Apply Promo Coupon
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex items-center flex-1">
                        <Ticket size={14} className="absolute left-3 text-brand-textMuted" />
                        <input
                          type="text"
                          placeholder="WELCOME200"
                          className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-2.5 pl-9 pr-2 text-xs outline-none transition-all duration-300 uppercase focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        className="text-xs font-semibold px-4 rounded-lg bg-brand-light hover:bg-brand-highlight text-brand-accent border border-brand-border transition-all duration-300"
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
                  {/* Pricing and Submit */}
                  <div className="border-t border-brand-border/60 pt-4 mt-2 flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs text-brand-textSecondary">
                      <span>Base Turf Cost:</span>
                      <span className="font-semibold">₹{selectedTurf ? selectedTurf.pricePerHour : 0}</span>
                    </div>
                    {couponSuccess && (
                      <div className="flex justify-between text-xs text-brand-success">
                        <span>Coupon Discount:</span>
                        <span className="font-semibold">-₹{couponDiscount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-brand-textDark font-extrabold border-t border-brand-border/40 pt-2.5 mt-1.5">
                      <span>Total Amount:</span>
                      <span className="text-lg">₹{finalAmount}</span>
                    </div>
                  </div>

                  {/* Split mobile actions / Full-width desktop actions */}
                  <div className="flex gap-3 mt-2 lg:hidden">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="flex-1 text-xs font-bold text-brand-textSecondary bg-brand-light border border-brand-border hover:bg-brand-highlight py-3 px-4 rounded-xl transition-all duration-300 cursor-pointer animate-fade-in"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !selectedTurf || !bookingDate || !selectedSlot}
                      className="flex-[2] bg-brand-accent hover:bg-brand-accentHover disabled:bg-brand-textMuted text-white text-xs font-bold py-3 px-4 rounded-xl shadow-premium tracking-wide uppercase transition-all duration-300 cursor-pointer"
                    >
                      {submitting ? 'Booking...' : 'Book Slot'}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !selectedTurf || !bookingDate || !selectedSlot}
                    className="hidden lg:block w-full bg-brand-accent hover:bg-brand-accentHover disabled:bg-brand-textMuted text-white text-xs font-bold py-3.5 px-4 rounded-lg shadow-premium tracking-wide uppercase transition-all duration-300 mt-2 hover:scale-[1.01] cursor-pointer"
                  >
                    {submitting ? 'Creating booking...' : 'Book Playing Slot'}
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>
        )}
      </div>



      {/* MODAL 2: Dynamic Success QR code receipt Card */}
      {receiptModalOpen && activeBooking && (
        <div className="fixed inset-0 bg-brand-textDark/65 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade">
          <div className="bg-white border border-brand-border shadow-premium rounded-xl p-6 md:p-8 max-w-sm w-full text-center relative flex flex-col gap-5 animate-fade">
            <button
              onClick={() => setReceiptModalOpen(false)}
              className="absolute top-4 right-4 text-brand-textSecondary hover:text-brand-accent transition-all duration-300"
            >
              <X size={18} />
            </button>

            <div>
              <div className="bg-brand-highlight text-brand-accent p-3.5 rounded-full inline-flex border border-brand-border/60 mx-auto">
                <Check size={28} />
              </div>
              <h2 className="text-lg font-extrabold text-brand-textDark mt-3 tracking-tight">Booking Confirmed!</h2>
              <p className="text-xs text-brand-textSecondary mt-1">Timings successfully reserved.</p>
            </div>

            {/* Programmatic base64 receipt QR */}
            {activeBooking.qrCodeData && (
              <div className="bg-white border border-brand-border/60 p-4 rounded-lg w-[170px] h-[170px] mx-auto flex items-center justify-center shadow-soft">
                <img
                  src={activeBooking.qrCodeData}
                  alt={`Receipt code ${activeBooking.bookingId}`}
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <div className="bg-brand-light border border-brand-border/60 rounded-lg p-4 text-left text-xs flex flex-col gap-2">
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
                <span className="font-semibold text-brand-textDark">{activeBooking.date} ({activeBooking.slot})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted">Payment Status:</span>
                <span className="font-bold text-brand-success">{activeBooking.paymentStatus} ({activeBooking.paymentMethod})</span>
              </div>
              <div className="flex justify-between border-t border-brand-border/40 pt-2.5 mt-1.5">
                <span className="font-bold text-brand-textDark">Paid Total:</span>
                <span className="font-extrabold text-brand-accent text-sm">₹{activeBooking.finalAmount}</span>
              </div>
            </div>

            <div className="mt-2">
              <button
                onClick={downloadReceiptAsPNG}
                className="w-full bg-brand-success hover:bg-green-600 text-white py-3 px-4 rounded-lg font-bold text-xs tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-1.5 shadow-soft hover:scale-[1.01]"
              >
                <Download size={14} /> Download Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Custom Simulated Razorpay Sandbox Modal */}
      {mockRazorpayOpen && activeBooking && (
        <div className="fixed inset-0 bg-brand-textDark/65 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white border-2 border-brand-accent/35 shadow-premium rounded-xl p-6 md:p-8 max-w-md w-full relative flex flex-col gap-5 overflow-hidden">
            
            {/* Top decorative stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-accent to-blue-600" />
            
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

            <div className="border border-yellow-200 bg-yellow-50/50 rounded-xl p-4 flex gap-3 text-xs text-yellow-800 leading-relaxed shadow-soft">
              <Info size={18} className="text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-yellow-900">Sandbox Test Mode Enabled</strong>
                <p className="mt-0.5 text-yellow-800 text-[11px]">We detected no active or real Razorpay API keys, or standard offline development mode. You can simulate success/failure below.</p>
              </div>
            </div>

            <div className="bg-brand-light border border-brand-border/60 rounded-xl p-4 flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-brand-textMuted font-medium">Recipient Merchant:</span>
                <span className="font-bold text-brand-textDark">Turf Booking Hub</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted font-medium">Order Reference ID:</span>
                <span className="font-mono text-[10px] font-bold text-brand-textDark">{activeBooking.razorpayOrderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-textMuted font-medium">Customer Contact:</span>
                <span className="font-semibold text-brand-textDark">{activeBooking.customerName}</span>
              </div>
              <div className="flex justify-between border-t border-brand-border/40 pt-2.5 mt-1">
                <span className="font-bold text-brand-textDark">Amount Payable:</span>
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
            
            <div className="text-center">
              <span className="text-[9px] text-brand-textMuted font-semibold uppercase tracking-wider block">Secured by program sandbox simulation</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserBooking;

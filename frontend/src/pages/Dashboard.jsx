import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Html5Qrcode } from 'html5-qrcode';
import {
  CalendarCheck,
  MapPin,
  Clock,
  Sparkles,
  RefreshCw,
  QrCode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  X,
  User,
  Mail,
  Phone,
  ShieldAlert,
  Upload,
  Plus
} from 'lucide-react';

// Audio synthesis feedback using Web Audio API
const playSuccessSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Play two notes for a satisfying confirmation tone (E5 -> A5)
    const playNote = (freq, duration, delay) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
      
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(audioCtx.currentTime + delay);
      osc.stop(audioCtx.currentTime + delay + duration);
    };

    playNote(659.25, 0.08, 0); // E5
    playNote(880.00, 0.15, 0.06); // A5
  } catch (err) {
    console.warn('Audio feedback failed:', err);
  }
};

const playErrorSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle'; // rougher tone
    osc.frequency.setValueAtTime(180, audioCtx.currentTime); // Low buzz
    
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (err) {
    console.warn('Audio feedback failed:', err);
  }
};

// Helper to find the primary 1x back camera (ignoring ultra-wide or zoom lenses)
const choosePrimaryBackCamera = (devices) => {
  // Filter for rear/back/environment cameras
  const backCams = devices.filter(d => {
    const label = d.label.toLowerCase();
    return label.includes('back') || label.includes('environment') || label.includes('rear');
  });

  if (backCams.length === 0) return null;

  // 1st Priority: Standard rear camera avoiding wide, ultra, tele, zoom, 0.5x, 0.6x, depth, etc.
  const primaryCam = backCams.find(d => {
    const label = d.label.toLowerCase();
    return !label.includes('ultra') && 
           !label.includes('wide') && 
           !label.includes('tele') && 
           !label.includes('zoom') && 
           !label.includes('virtual') &&
           !label.includes('depth') &&
           !label.includes('0.5x') &&
           !label.includes('0.6x');
  });
  if (primaryCam) return primaryCam;

  // 2nd Priority: Look for main, primary, 1x, or camera 0
  const mainCam = backCams.find(d => {
    const label = d.label.toLowerCase();
    return label.includes('main') || label.includes('primary') || label.includes('1x') || label.includes('camera 0');
  });
  if (mainCam) return mainCam;

  // 3rd Priority: Default to first available back camera
  return backCams[0];
};

// QR Viewfinder component using html5-qrcode
const QrCameraScanner = ({ onScanned, onClose }) => {
  const [cameras, setCameras] = useState([]);
  const [activeCameraId, setActiveCameraId] = useState('');
  const [scanError, setScanError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isStarting, setIsStarting] = useState(true);
  const scannerRef = React.useRef(null);
  const hasScannedRef = React.useRef(false);
  const hasCorrectedRef = React.useRef(false);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Failed to stop scanner:', err);
      }
    }
    setIsScanning(false);
  };

  const startScanner = async (deviceOrMode) => {
    try {
      setScanError('');
      setIsStarting(true);
      
      let html5QrCode = scannerRef.current;
      if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;
      } else if (html5QrCode.isScanning) {
        try {
          await html5QrCode.stop();
        } catch (err) {
          console.warn('Failed to stop active scanner before restarting:', err);
        }
      }

      // Configurations optimized for speed, low resources, and continuous focus
      const config = {
        fps: 25, // Fluid 25 fps
        qrbox: (width, height) => {
          const minSize = Math.min(width, height);
          const size = Math.floor(minSize * 0.72);
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
        disableFlip: true, // Don't mirror environment camera stream
        videoConstraints: {
          facingMode: "environment",
          focusMode: "continuous",
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      await html5QrCode.start(
        deviceOrMode,
        config,
        (decodedText) => {
          if (hasScannedRef.current) return;
          hasScannedRef.current = true;
          stopScanner();
          onScanned(decodedText);
        },
        (errorMessage) => {
          // Silently process frame-level decoding errors
        }
      );

      setIsScanning(true);
      setIsStarting(false);

      // Post-start self-correction check (only when initialized blindly via facingMode)
      if (deviceOrMode && typeof deviceOrMode === 'object' && deviceOrMode.facingMode) {
        if (!hasCorrectedRef.current) {
          hasCorrectedRef.current = true;
          try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 1) {
              setCameras(devices);
              
              const videoElement = document.querySelector('#qr-reader video');
              if (videoElement && videoElement.srcObject) {
                const tracks = videoElement.srcObject.getVideoTracks();
                if (tracks.length > 0) {
                  const activeTrack = tracks[0];
                  const activeLabel = activeTrack.label.toLowerCase();
                  
                  // Check if the current running camera is wide/ultra-wide or zoom
                  const isWrongCamera = activeLabel.includes('ultra') || 
                                        activeLabel.includes('wide') || 
                                        activeLabel.includes('zoom') || 
                                        activeLabel.includes('0.5x') || 
                                        activeLabel.includes('0.6x') ||
                                        activeLabel.includes('0.7x') ||
                                        activeLabel.includes('0.8x');
                                        
                  if (isWrongCamera) {
                    const primaryBackCam = choosePrimaryBackCamera(devices);
                    if (primaryBackCam && primaryBackCam.label.toLowerCase() !== activeLabel) {
                      console.log(`Self-correcting camera: active track "${activeTrack.label}" is ultrawide/zoom. Switching to primary: "${primaryBackCam.label}"`);
                      await html5QrCode.stop();
                      setActiveCameraId(primaryBackCam.id);
                      await startScanner(primaryBackCam.id);
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.warn('Post-start camera self-correction check failed:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error starting QR scanner:', err);
      // Fallback: if direct facingMode fail, query listing
      if (deviceOrMode && typeof deviceOrMode === 'object' && deviceOrMode.facingMode) {
        console.warn('Direct facingMode: environment failed, querying devices...');
        fallbackToDeviceList();
      } else {
        setScanError('Webcam access failed. Verify camera permissions.');
        setIsScanning(false);
        setIsStarting(false);
      }
    }
  };

  const fallbackToDeviceList = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        const backCam = choosePrimaryBackCamera(devices);
        const nextId = backCam ? backCam.id : devices[0].id;
        setActiveCameraId(nextId);
        startScanner(nextId);
      } else {
        setScanError('No camera devices detected on this system.');
        setIsScanning(false);
        setIsStarting(false);
      }
    } catch (err) {
      console.error('Fallback camera detection failed:', err);
      setScanError('Webcam permission denied or camera not found.');
      setIsScanning(false);
      setIsStarting(false);
    }
  };

  useEffect(() => {
    const initializeCamera = async () => {
      try {
        setScanError('');
        setIsStarting(true);
        
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          
          const primaryBackCam = choosePrimaryBackCamera(devices);
          if (primaryBackCam) {
            setActiveCameraId(primaryBackCam.id);
            await startScanner(primaryBackCam.id);
          } else {
            setActiveCameraId(devices[0].id);
            await startScanner(devices[0].id);
          }
        } else {
          await startScanner({ facingMode: "environment" });
        }
      } catch (err) {
        console.warn('Webcam devices list query failed, falling back to standard facingMode:', err);
        await startScanner({ facingMode: "environment" });
      }
    };

    initializeCamera();

    return () => {
      stopScanner();
    };
  }, []);

  const handleCameraChange = (cameraId) => {
    setActiveCameraId(cameraId);
    startScanner(cameraId);
  };

  return (
    <div className="flex flex-col gap-4 items-center w-full flex-1 justify-center">
      {scanError && (
        <div className="bg-red-950/80 text-red-400 border border-red-900 text-xs p-3 rounded-lg flex items-center gap-2 w-full">
          <AlertTriangle size={15} className="shrink-0" />
          <span>{scanError}</span>
        </div>
      )}

      {/* Viewport Frame */}
      <div className="relative w-full flex-1 max-h-[360px] sm:max-h-[300px] flex items-center justify-center bg-slate-950 overflow-hidden rounded-xl border border-slate-800">
        
        {/* html5-qrcode element */}
        <div id="qr-reader" className="w-full h-full object-cover [&>video]:object-cover [&>video]:w-full [&>video]:h-full [&>div]:hidden"></div>
        
        {/* Starting indicator */}
        {isStarting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-950/90 p-4 text-center">
            <Camera size={32} className="animate-pulse text-brand-accent mb-2" />
            <p className="text-xs font-semibold">Initializing camera stream...</p>
          </div>
        )}

        {/* HUD Scanner Box Overlay */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between">
            {/* Top Mask */}
            <div className="bg-slate-950/60 flex-1"></div>
            
            <div className="flex">
              {/* Left Mask */}
              <div className="bg-slate-950/60 flex-1"></div>
              
              {/* Hollow Viewport Target */}
              <div className="relative w-[210px] h-[210px] sm:w-[230px] sm:h-[230px] shrink-0 border border-brand-accent/25 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(77,166,255,0.12)]">
                {/* Glowing Corner Accents */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-[3.5px] border-l-[3.5px] border-brand-accent rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-[3.5px] border-r-[3.5px] border-brand-accent rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3.5px] border-l-[3.5px] border-brand-accent rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3.5px] border-r-[3.5px] border-brand-accent rounded-br-lg"></div>
                
                {/* Neon Sweeping Laser Line */}
                <div className="absolute left-0 right-0 h-[2.5px] bg-gradient-to-r from-transparent via-brand-accent to-transparent shadow-[0_0_10px_#4da6ff] animate-scan-laser"></div>
              </div>
              
              {/* Right Mask */}
              <div className="bg-slate-950/60 flex-1"></div>
            </div>
            
            {/* Bottom Mask */}
            <div className="bg-slate-950/60 flex-1 flex flex-col items-center justify-start pt-3">
              <p className="text-[10px] font-bold text-slate-300 tracking-wider uppercase px-4 text-center">
                Align QR Code inside square frame
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer controls / switcher */}
      {cameras.length > 1 && (
        <div className="w-full mt-1 px-2">
          <select
            value={activeCameraId}
            onChange={(e) => handleCameraChange(e.target.value)}
            className="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-300 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none font-semibold"
          >
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.label || `Camera ${camera.id}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // QR Scan States
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState('scan'); // 'scan', 'processing', 'details', 'success'
  const [scanTab, setScanTab] = useState('camera'); // 'camera', 'upload'
  const [manualInput, setManualInput] = useState('');
  const [scannedBooking, setScannedBooking] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [isSubmittingVerify, setIsSubmittingVerify] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(true);

  // Timer reference to cancel count-down resets if user closes or re-scans manually
  const autoResetTimerRef = React.useRef(null);
  const lastScannedCodeRef = React.useRef({ code: '', time: 0 });

  const handleBookingLookup = async (idOrJson) => {
    // Clear any pending timers
    if (autoResetTimerRef.current) {
      clearTimeout(autoResetTimerRef.current);
    }

    // Anti-double-scan threshold: Ignore scan if same code is read within 4.5 seconds
    const now = Date.now();
    const lastScan = lastScannedCodeRef.current;
    if (lastScan.code === idOrJson.trim() && (now - lastScan.time) < 4500) {
      console.log('Anti-loop: Ignored duplicate scan of same code');
      return;
    }
    lastScannedCodeRef.current = { code: idOrJson.trim(), time: now };

    setLookupError('');
    let bookingId = idOrJson.trim();

    // Check if input is a JSON string from a QR code
    if (bookingId.startsWith('{')) {
      try {
        const parsed = JSON.parse(bookingId);
        if (parsed.bookingId) {
          bookingId = parsed.bookingId;
        }
      } catch (err) {
        console.warn('Attempted to parse JSON input, but failed. Using raw string.', err);
      }
    }

    if (!bookingId) {
      playErrorSound();
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      setLookupError('Please enter a valid Booking ID or QR code text.');
      return;
    }

    setScannerMode('processing');

    try {
      setLookupError('');
      const response = await axiosInstance.get(`/bookings/lookup/${bookingId}`);
      if (response.data.success) {
        const booking = response.data.booking;
        setScannedBooking(booking);

        // If ticket is already verified (expired)
        if (booking.isVerified) {
          playErrorSound();
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          setLookupError(`This ticket was already verified on ${new Date(booking.verifiedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`);
          setScannerMode('details');
          
          if (isContinuousMode) {
            autoResetTimerRef.current = setTimeout(() => {
              setScannerMode('scan');
              setScannedBooking(null);
              setLookupError('');
            }, 3800);
          }
          return;
        }

        // If valid and pending check-in, AUTO-VERIFY instantly!
        try {
          const verifyResponse = await axiosInstance.put(`/bookings/verify/${booking._id}`);
          if (verifyResponse.data.success) {
            playSuccessSound();
            if (navigator.vibrate) navigator.vibrate(150);
            
            setScannedBooking(verifyResponse.data.booking);
            setScannerMode('success');
            
            // Sync Ledger Metrics
            fetchAnalytics();

            if (isContinuousMode) {
              autoResetTimerRef.current = setTimeout(() => {
                setScannerMode('scan');
                setScannedBooking(null);
                setLookupError('');
              }, 1800);
            } else {
              autoResetTimerRef.current = setTimeout(() => {
                setIsScanModalOpen(false);
                setScannerMode('scan');
                setScannedBooking(null);
                setLookupError('');
              }, 2200);
            }
          }
        } catch (verifyErr) {
          console.error('Verify error during auto-submit:', verifyErr);
          playErrorSound();
          if (navigator.vibrate) navigator.vibrate([200, 100]);
          setLookupError(verifyErr.response?.data?.message || 'Error occurred during ticket verification.');
          setScannerMode('details');
        }
      }
    } catch (err) {
      console.error('Failed to lookup booking:', err);
      playErrorSound();
      if (navigator.vibrate) navigator.vibrate([200, 100]);
      setLookupError(err.response?.data?.message || 'Booking not found with the provided ID.');
      setScannerMode('scan'); // Stay on scan tab so they can try again
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLookupError('');
    try {
      const html5QrCode = new Html5Qrcode("qr-reader-file");
      const decodedText = await html5QrCode.scanFile(file, false);
      await handleBookingLookup(decodedText);
    } catch (err) {
      console.error('Failed to parse QR code from file:', err);
      playErrorSound();
      if (navigator.vibrate) navigator.vibrate([200, 100]);
      setLookupError('Could not find a valid QR Code in the uploaded image. Make sure it is well-lit.');
    }
  };

  const handleVerifyTicket = async () => {
    if (!scannedBooking) return;
    setIsSubmittingVerify(true);
    setLookupError('');
    try {
      const response = await axiosInstance.put(`/bookings/verify/${scannedBooking._id}`);
      if (response.data.success) {
        playSuccessSound();
        if (navigator.vibrate) navigator.vibrate(150);
        setScannerMode('success');
        fetchAnalytics();
        
        if (isContinuousMode) {
          autoResetTimerRef.current = setTimeout(() => {
            setScannerMode('scan');
            setScannedBooking(null);
            setLookupError('');
          }, 1800);
        } else {
          autoResetTimerRef.current = setTimeout(() => {
            setIsScanModalOpen(false);
            setScannerMode('scan');
            setScannedBooking(null);
            setLookupError('');
          }, 2200);
        }
      }
    } catch (err) {
      console.error('Failed to verify booking ticket:', err);
      playErrorSound();
      if (navigator.vibrate) navigator.vibrate([200, 100]);
      setLookupError(err.response?.data?.message || 'Error occurred during ticket verification.');
    } finally {
      setIsSubmittingVerify(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await axiosInstance.get('/dashboard/analytics');
      if (response.data.success) {
        setData(response.data.analytics);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      setError('Error loading analytics. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Clean up any pending timer on unmount
  useEffect(() => {
    fetchAnalytics();
    return () => {
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-brand-accent">
        <div className="text-center">
          <div className="border-[3px] border-brand-highlight border-l-brand-accent rounded-full w-9 h-9 animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-brand-textSecondary">Syncing metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-brand-border rounded-xl p-8 text-center text-brand-danger shadow-soft max-w-lg mx-auto">
        <p className="font-semibold text-sm">{error || 'An error occurred loading insights.'}</p>
      </div>
    );
  }

  const { todayBookings, recentBookings } = data;

  const cardStats = [
    { label: "Today's Bookings", value: todayBookings, icon: CalendarCheck, color: '#10b981' },
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade">
      
      {/* Dashboard Top Header Controls */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-brand-textDark tracking-tight flex items-center gap-1.5">
            Dashboard Overview <Sparkles size={16} className="text-brand-warning animate-pulse" />
          </h1>
          <p className="text-xs text-brand-textSecondary mt-0.5">Real-time scheduling analytics and administrative controls.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/bookings?new=true"
            className="text-xs font-bold text-white bg-brand-accent hover:bg-brand-accent/90 py-2 px-4 rounded-lg flex items-center gap-1.5 transition-all duration-300 shadow-soft hover:shadow-premium"
          >
            <Plus size={13} /> New Booking
          </Link>
          <button
            onClick={() => {
              setIsScanModalOpen(true);
              setScannerMode('scan');
              setLookupError('');
            }}
            className="text-xs font-semibold text-brand-textSecondary border border-brand-border hover:border-brand-accent bg-white hover:text-brand-accent py-2 px-4 rounded-lg flex items-center gap-1.5 transition-all duration-300 shadow-soft"
          >
            <QrCode size={13} /> Scan QR Code
          </button>
          <button
            onClick={() => {
              setLoading(true);
              fetchAnalytics();
            }}
            className="text-xs font-semibold text-brand-textSecondary border border-brand-border hover:border-brand-accent bg-white hover:text-brand-accent py-2 px-4 rounded-lg flex items-center gap-1.5 transition-all duration-300 shadow-soft"
          >
            <RefreshCw size={13} /> Sync Ledger
          </button>
        </div>
      </div>

      {/* Stats Cards Dashboard Grid */}
      <div className="grid grid-cols-1 max-w-sm gap-4">
        {cardStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-white border border-brand-border/60 border-l-4 border-l-brand-success rounded-xl p-5 shadow-soft hover:shadow-premium transition-all duration-300 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-brand-textMuted uppercase tracking-wider block">{stat.label}</span>
                <span className="text-xl font-extrabold text-brand-textDark mt-1 block leading-tight">{stat.value}</span>
              </div>
              <div
                className="p-3 rounded-lg border flex items-center justify-center shrink-0"
                style={{
                  color: stat.color,
                  backgroundColor: `${stat.color}08`,
                  borderColor: `${stat.color}18`
                }}
              >
                <Icon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabular summary list */}
      <div className="bg-white border border-brand-border/60 rounded-xl p-6 shadow-soft hover:shadow-premium transition-all duration-300">
        <div>
          <h3 className="font-bold text-sm text-brand-textDark">Recent Activity Logs</h3>
          <p className="text-xxs text-brand-textMuted font-semibold mt-0.5">Summary ledger of last 5 slot reservations</p>
        </div>

        {/* Mobile View for Recent Bookings (shown as compact cards) */}
        <div className="md:hidden mt-4 flex flex-col gap-2.5">
          {recentBookings.length === 0 ? (
            <div className="bg-white border border-brand-border rounded-xl p-6 text-center text-brand-textSecondary text-xs">
              No bookings logged yet.
            </div>
          ) : (
            recentBookings.map((b) => (
              <div key={b._id} className={`bg-white border border-brand-border/60 rounded-xl p-3 shadow-sm flex flex-col gap-2.5 transition-all duration-300 border-l-4 ${
                b.status === 'Confirmed' ? 'border-l-brand-success' : 'border-l-brand-danger'
              }`}>
                {/* ID & Status */}
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
                      <MapPin size={10} className="text-brand-textMuted shrink-0" />
                      <span className="truncate">{b.date}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-brand-textDark font-black">
                      <Clock size={11} className="text-brand-accent shrink-0" />
                      <span className="text-xs font-black tracking-tight text-brand-textDark">{b.slot}</span>
                    </div>
                  </div>
                </div>

                {/* Paid Info */}
                <div className="flex items-center justify-between border-t border-brand-border/40 pt-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-brand-textMuted uppercase font-bold">Paid Cost:</span>
                    <span className="text-[11px] font-black text-brand-textDark">₹{b.finalAmount}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                      b.paymentMethod === 'Cash'
                        ? 'bg-brand-highlight text-brand-accent border-brand-border'
                        : 'bg-green-50 text-green-600 border-green-200'
                    }`}>
                      {b.paymentMethod}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View for Recent Bookings (traditional table) */}
        <div className="hidden md:block overflow-x-auto mt-4 border border-brand-border rounded-lg shadow-soft">
          <table className="min-w-full divide-y divide-brand-border/40 text-xs">
            <thead className="bg-brand-light/50">
              <tr>
                <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Booking ID</th>
                <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Turf</th>
                <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Player Info</th>
                <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Reservation Timing</th>
                <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Paid Amount</th>
                <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Checkout Mode</th>
                <th className="px-5 py-3 text-left font-bold text-brand-textSecondary uppercase tracking-wider text-[10px]">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-brand-border/30">
              {recentBookings.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-5 py-6 text-center text-brand-textSecondary">
                    No bookings logged yet.
                  </td>
                </tr>
              ) : (
                recentBookings.map((b) => (
                  <tr key={b._id} className="hover:bg-brand-light/30 transition-all duration-300">
                    <td className="px-5 py-3.5 font-bold text-brand-textDark whitespace-nowrap">{b.bookingId}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div>
                        <div className="font-bold text-brand-textDark">{b.turf?.name || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div>
                        <div className="font-semibold text-brand-textDark">{b.customerName}</div>
                        <span className="text-[10px] text-brand-textMuted">{b.customerPhone}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div>
                        <div className="flex items-center gap-1 font-semibold text-brand-textDark">
                          <MapPin size={11} className="text-brand-accent" /> {b.date}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-brand-textSecondary mt-0.5">
                          <Clock size={9} /> {b.slot}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-bold text-brand-textDark">₹{b.finalAmount}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                        b.paymentMethod === 'Cash'
                          ? 'bg-brand-highlight text-brand-accent border-brand-border'
                          : 'bg-green-50 text-green-600 border-green-200'
                      }`}>
                        {b.paymentMethod}
                      </span>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Code Ticket Verification Modal */}
      {isScanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-brand-textDark/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
          <div className={`border-0 sm:border w-full sm:max-w-md h-screen sm:h-[580px] rounded-none sm:rounded-2xl shadow-soft overflow-hidden animate-slide-up flex flex-col max-h-screen sm:max-h-[90vh] transition-colors duration-300 ${
            scannerMode === 'scan' || scannerMode === 'processing'
              ? 'bg-slate-950 text-white border-slate-800' 
              : 'bg-white text-brand-textDark border-brand-border/85'
          }`}>
            
            {/* Modal Header */}
            <div className={`border-b p-4 pt-7 sm:p-4 flex items-center justify-between transition-colors duration-300 ${
              scannerMode === 'scan' || scannerMode === 'processing'
                ? 'border-slate-800 bg-slate-900/40 text-white' 
                : 'border-brand-border/60 bg-gradient-to-r from-brand-accent/5 to-transparent text-brand-textDark'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg transition-colors duration-300 ${
                  scannerMode === 'scan' || scannerMode === 'processing' ? 'bg-brand-accent/20 text-brand-accent' : 'bg-brand-accent/10 text-brand-accent'
                }`}>
                  <QrCode size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">Verify Booking Receipt</h3>
                  <p className={`text-[10px] mt-0.5 font-semibold ${scannerMode === 'scan' || scannerMode === 'processing' ? 'text-slate-400' : 'text-brand-textSecondary'}`}>
                    Admin check-in ledger console
                  </p>
                </div>
              </div>

              {/* Continuous Scan Mode Toggle */}
              {(scannerMode === 'scan' || scannerMode === 'processing') && (
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden xs:inline">Continuous</span>
                  <button
                    onClick={() => setIsContinuousMode(!isContinuousMode)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 focus:outline-none relative border ${
                      isContinuousMode 
                        ? 'bg-brand-success border-brand-success' 
                        : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                      isContinuousMode ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
                  lastScannedCodeRef.current = { code: '', time: 0 }; // Reset anti-double-scan lock
                  setIsScanModalOpen(false);
                  setScannerMode('scan');
                  setScannedBooking(null);
                  setLookupError('');
                  setManualInput('');
                }}
                className={`p-1.5 rounded-lg border transition-all duration-300 ${
                  scannerMode === 'scan' || scannerMode === 'processing'
                    ? 'border-slate-800 text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-900'
                    : 'border-brand-border/60 text-brand-textSecondary hover:text-brand-textDark bg-white hover:bg-brand-light'
                }`}
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3 sm:gap-4 overflow-hidden justify-between">
              
              {/* Display errors */}
              {lookupError && (
                <div className={`text-xs p-3 rounded-lg flex items-center gap-2 border transition-colors duration-300 ${
                  scannerMode === 'scan' || scannerMode === 'processing'
                    ? 'bg-red-950/70 text-red-400 border-red-900'
                    : 'bg-red-50 text-red-600 border-red-200'
                }`}>
                  <AlertTriangle size={15} className="shrink-0" />
                  <span className="font-semibold">{lookupError}</span>
                </div>
              )}

              {/* Mode 1: SCAN / INPUT */}
              {scannerMode === 'scan' && (
                <div className="flex-1 flex flex-col gap-3 justify-between overflow-hidden">
                  <div className="flex flex-col gap-3 flex-1 justify-center">
                    {/* Tabs */}
                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                      <button
                        onClick={() => { setScanTab('camera'); setLookupError(''); }}
                        className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md transition-all duration-300 flex items-center justify-center gap-1.5 ${
                          scanTab === 'camera'
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Camera size={13} /> Camera Viewfinder
                      </button>
                      <button
                        onClick={() => { setScanTab('upload'); setLookupError(''); }}
                        className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md transition-all duration-300 flex items-center justify-center gap-1.5 ${
                          scanTab === 'upload'
                            ? 'bg-slate-800 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Upload size={13} /> Upload QR Image
                      </button>
                    </div>

                    {scanTab === 'camera' ? (
                      <QrCameraScanner
                        onScanned={(text) => handleBookingLookup(text)}
                        onClose={() => setIsScanModalOpen(false)}
                      />
                    ) : (
                      <div className="flex flex-col gap-3 w-full py-4">
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-brand-accent rounded-2xl p-6 bg-slate-900/40 transition-all duration-300 relative group cursor-pointer max-w-[220px] mx-auto w-full">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          />
                          <div className="flex flex-col items-center gap-2 text-center group-hover:text-brand-accent transition-all duration-300">
                            <div className="p-3 rounded-full border bg-slate-800/40 border-slate-700/60 group-hover:border-brand-accent/20 group-hover:bg-brand-accent/10 transition-all duration-300">
                              <Upload size={18} className="text-slate-400 group-hover:text-brand-accent transition-all duration-300" />
                            </div>
                            <div>
                              <p className="text-xs font-extrabold text-white">Upload QR Image</p>
                              <p className="text-[9px] text-brand-textMuted font-bold mt-0.5 leading-relaxed">
                                Choose image file
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Hidden div required by html5-qrcode for scanFile helper */}
                        <div id="qr-reader-file" className="hidden"></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mode 2: PROCESSING (LOOKING UP) */}
              {scannerMode === 'processing' && (
                <div className="flex-1 flex flex-col justify-center items-center py-12 text-center gap-4 text-white">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-12 h-12 rounded-full bg-brand-accent/20 animate-ping" />
                    <div className="border-[3px] border-slate-800 border-l-brand-accent rounded-full w-12 h-12 animate-spin relative z-10" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm tracking-tight text-white">Verifying Booking Receipt</h4>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">Contacting administrative ledger database...</p>
                  </div>
                </div>
              )}

              {/* Mode 3: TICKET DETAILS */}
              {scannerMode === 'details' && scannedBooking && (
                <div className="flex-1 flex flex-col gap-3 sm:gap-4 justify-between overflow-hidden animate-scale-up">
                  <div className="flex flex-col gap-3 sm:gap-4 overflow-hidden">
                    
                    {/* Status Banner */}
                    {scannedBooking.isVerified ? (
                      <div className="bg-red-50 text-red-700 border border-red-100 rounded-xl p-3 flex items-center gap-3">
                        <ShieldAlert size={24} className="text-red-500 shrink-0 animate-pulse" />
                        <div className="text-left flex-1 min-w-0">
                          <span className="font-extrabold text-[11px] uppercase tracking-wide block text-red-800">EXPIRED / TICKET USED</span>
                          <p className="text-[10px] font-semibold text-red-600 leading-tight mt-0.5">
                            Verified: <span className="font-black text-brand-textDark">{new Date(scannedBooking.verifiedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-green-50 text-green-700 border border-green-100 rounded-xl p-3 flex items-center gap-2">
                        <CheckCircle2 size={20} className="text-green-500 shrink-0" />
                        <div className="text-left">
                          <span className="font-extrabold text-[11px] uppercase tracking-wide block text-green-800">VALID TICKET</span>
                          <p className="text-[9px] font-bold text-green-600 mt-0.5 uppercase">Pending check-in registration</p>
                        </div>
                      </div>
                    )}

                    {/* Booking Card Grid */}
                    <div className="bg-brand-light/50 border border-brand-border/60 rounded-xl p-3 sm:p-4 flex flex-col gap-3 overflow-hidden shadow-sm">
                      
                      <div className="flex items-center justify-between border-b border-brand-border/40 pb-2">
                        <span className="text-[10px] font-bold text-brand-textMuted uppercase">Booking Identifier</span>
                        <span className="text-xs font-black text-brand-textDark">{scannedBooking.bookingId}</span>
                      </div>

                      {/* Customer & Booking Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Customer Info */}
                        <div className="bg-white border border-brand-border/40 rounded-xl p-2.5 sm:p-3 flex flex-col gap-1.5 text-xxs font-bold text-brand-textDark">
                          <span className="text-[8px] font-black text-brand-textMuted uppercase tracking-wider block">Customer Info</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <User size={12} className="text-brand-textMuted shrink-0" />
                            <span className="truncate text-xs font-black">{scannedBooking.customerName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone size={12} className="text-brand-textMuted shrink-0" />
                            <span className="font-semibold text-brand-textSecondary text-[11px]">{scannedBooking.customerPhone}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail size={12} className="text-brand-textMuted shrink-0" />
                            <span className="font-semibold text-brand-textSecondary truncate">{scannedBooking.customerEmail}</span>
                          </div>
                        </div>

                        {/* Turf & Slot Info */}
                        <div className="bg-white border border-brand-border/40 rounded-xl p-2.5 sm:p-3 flex flex-col gap-1.5 text-xxs font-bold text-brand-textDark">
                          <span className="text-[8px] font-black text-brand-textMuted uppercase tracking-wider block">Turf & Session</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <MapPin size={12} className="text-brand-accent shrink-0" />
                            <span className="truncate text-xs font-black">{scannedBooking.turf?.name || 'Main Arena'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CalendarCheck size={12} className="text-brand-accent shrink-0" />
                            <span className="font-semibold text-brand-textSecondary text-[11px]">{scannedBooking.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={12} className="text-brand-accent shrink-0" />
                            <span className="font-bold text-brand-textDark text-xs leading-none">{scannedBooking.slot}</span>
                          </div>
                        </div>
                      </div>

                      {/* Cost & Payment Details */}
                      <div className="flex items-center justify-between bg-white border border-brand-border/40 p-2.5 sm:p-3 rounded-xl text-xs font-bold">
                        <span className="text-brand-textSecondary text-[10px] font-black uppercase tracking-wider">Paid Amount</span>
                        <div className="flex items-center gap-2">
                          <span className="text-brand-textDark text-base font-black">₹{scannedBooking.finalAmount}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                            scannedBooking.paymentStatus === 'Paid'
                              ? 'bg-green-50 text-green-600 border-green-200'
                              : 'bg-yellow-50 text-yellow-600 border-yellow-200'
                          }`}>
                            {scannedBooking.paymentStatus}
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-brand-border/40">
                    <div className="flex gap-3 w-full animate-fade-in">
                      <button
                        onClick={() => {
                          if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
                          lastScannedCodeRef.current = { code: '', time: 0 }; // Reset anti-double-scan lock
                          setScannerMode('scan');
                          setScannedBooking(null);
                          setLookupError('');
                        }}
                        className="flex-1 border border-brand-border hover:bg-brand-light text-brand-textSecondary hover:text-brand-textDark font-extrabold py-2.5 px-4 rounded-xl text-xs transition-all duration-300 shadow-sm"
                      >
                        Scan Another
                      </button>
                      {!scannedBooking.isVerified && (
                        <button
                          onClick={handleVerifyTicket}
                          disabled={isSubmittingVerify}
                          className="flex-1 bg-brand-accent hover:bg-brand-accentHover disabled:opacity-50 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all duration-300 shadow-soft hover:shadow-premium"
                        >
                          {isSubmittingVerify ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <CheckCircle2 size={13} />
                          )}
                          Verify Ticket
                        </button>
                      )}
                    </div>

                    {isContinuousMode && scannedBooking.isVerified && (
                      <div className="w-full">
                        <div className="w-full bg-slate-100 border border-slate-200 h-1.5 rounded-full overflow-hidden mt-1 relative">
                          <div 
                            className="h-full bg-brand-danger rounded-full animate-countdown"
                            style={{ animationDuration: '3.8s' }}
                          />
                        </div>
                        <p className="text-[9px] text-brand-textMuted font-bold text-center mt-1 uppercase tracking-wide">
                          Resuming scanner in 3.8s...
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mode 4: SUCCESS */}
              {scannerMode === 'success' && (
                <div className="flex-1 flex flex-col justify-between items-center py-4 text-center gap-4 animate-scale-up overflow-hidden">
                  <div className="flex flex-col items-center gap-3.5 w-full">
                    {/* Glowing Checkmark */}
                    <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center text-brand-success shadow-soft animate-pulse shrink-0">
                      <CheckCircle2 size={32} />
                    </div>
                    
                    <div>
                      <h4 className="font-extrabold text-brand-textDark text-sm tracking-tight">Ticket Verified Successfully!</h4>
                      <p className="text-[10px] text-brand-textSecondary mt-0.5 leading-relaxed font-semibold max-w-[260px] mx-auto">
                        Player check-in logged. The slot allocation is confirmed and receipt verified.
                      </p>
                    </div>

                    {scannedBooking && (
                      <div className="w-full bg-brand-light/70 border border-brand-border/40 rounded-xl p-3 text-xxs font-bold text-brand-textSecondary flex flex-col gap-2 max-w-[320px] mx-auto text-left shadow-sm">
                        <div className="flex justify-between border-b border-brand-border/30 pb-1.5">
                          <span>Booking ID:</span>
                          <span className="text-brand-textDark font-black">{scannedBooking.bookingId}</span>
                        </div>
                        <div className="flex justify-between border-b border-brand-border/30 pb-1.5">
                          <span>Player:</span>
                          <span className="text-brand-textDark font-black">{scannedBooking.customerName}</span>
                        </div>
                        <div className="flex justify-between border-b border-brand-border/30 pb-1.5">
                          <span>Turf:</span>
                          <span className="text-brand-textDark font-black">{scannedBooking.turf?.name || 'Main Arena'}</span>
                        </div>
                        <div className="flex justify-between border-b border-brand-border/30 pb-1.5">
                          <span>Slot Timing:</span>
                          <span className="text-brand-textDark font-black">{scannedBooking.slot}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Paid:</span>
                          <span className="text-brand-success font-black">₹{scannedBooking.finalAmount}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Manual Override & Progress Timer */}
                  <div className="w-full max-w-[320px] mx-auto">
                    <button
                      onClick={() => {
                        if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
                        lastScannedCodeRef.current = { code: '', time: 0 }; // Reset anti-double-scan lock
                        setScannerMode('scan');
                        setScannedBooking(null);
                        setLookupError('');
                        setManualInput('');
                      }}
                      className="w-full bg-brand-accent hover:bg-brand-accentHover text-white font-extrabold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all duration-300 shadow-soft hover:shadow-premium"
                    >
                      Scan Next Ticket
                    </button>

                    {/* Progress Countdown Bar */}
                    <div className="w-full bg-brand-light border border-brand-border/20 h-1.5 rounded-full overflow-hidden mt-3.5 relative">
                      <div 
                        className="h-full bg-brand-success rounded-full animate-countdown"
                        style={{ animationDuration: isContinuousMode ? '1.8s' : '2.2s' }}
                      />
                    </div>
                    <p className="text-[9px] text-brand-textMuted font-bold text-center mt-1.5 uppercase tracking-wider">
                      {isContinuousMode ? 'Resuming camera in 1.8s...' : 'Closing window in 2.2s...'}
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;

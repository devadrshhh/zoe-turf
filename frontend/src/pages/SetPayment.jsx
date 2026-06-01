import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { DollarSign, AlertTriangle, RefreshCw, CheckCircle, Info } from 'lucide-react';

const SetPayment = () => {
  const [amount, setAmount] = useState('');
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch current global pricing to show as hint/default
  const fetchCurrentPricing = async () => {
    setFetching(true);
    setErrorMsg('');
    try {
      const response = await axiosInstance.get('`${import.meta.env.VITE_API_URL}/api/turfs`');
      if (response.data.success && response.data.turfs.length > 0) {
        // Since price is global, we can display the first turf's price as current reference
        setCurrentPrice(response.data.turfs[0].pricePerHour);
        setAmount(response.data.turfs[0].pricePerHour.toString());
      } else {
        setCurrentPrice(1);
        setAmount('1');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to fetch active turf pricing configurations.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchCurrentPricing();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount) || Number(amount) < 0) {
      setErrorMsg('Please enter a valid non-negative pricing amount.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await axiosInstance.put('`${import.meta.env.VITE_API_URL}/api/turfs`/update-price-all', {
        amount: Number(amount),
      });

      if (response.data.success) {
        setSuccessMsg(response.data.message || 'Global slot pricing successfully applied!');
        setCurrentPrice(Number(amount));
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Error updating global turf pricing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade max-w-2xl mx-auto">
      {/* Header bar controls */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-brand-textDark tracking-tight">Set Global Slot Price</h1>
          <p className="text-xs text-brand-textSecondary mt-0.5">
            Configure the default hourly rate applied globally across all active turf arenas.
          </p>
        </div>
        <button
          onClick={fetchCurrentPricing}
          className="text-xs font-semibold text-brand-textSecondary border border-brand-border bg-white hover:text-brand-accent hover:border-brand-accent py-2.5 px-5 rounded-lg flex items-center gap-1.5 transition-all duration-300 shadow-soft"
          disabled={fetching || loading}
        >
          <RefreshCw size={14} className={fetching ? 'animate-spin' : ''} /> Refresh Price
        </button>
      </div>

      {/* Main card */}
      <div className="bg-white border border-brand-border/60 rounded-xl p-6 md:p-8 shadow-soft hover:shadow-premium transition-all duration-300 flex flex-col gap-6">
        
        {/* Status indicator */}
        <div className="flex items-center gap-4 bg-brand-light/40 border border-brand-border/60 rounded-xl p-4.5">
          <div className="p-3 bg-brand-highlight border border-brand-border rounded-lg text-brand-accent shrink-0">
            <DollarSign size={22} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-brand-textMuted uppercase tracking-wider block">Active Global Price</span>
            <span className="text-2xl font-extrabold text-brand-textDark mt-0.5 block leading-none">
              {fetching ? '...' : currentPrice !== null ? `₹${currentPrice} / hr` : 'Not Set'}
            </span>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 flex gap-3 text-xs leading-relaxed text-amber-800">
          <AlertTriangle size={16} className="shrink-0 text-amber-500 mt-0.5" />
          <div>
            <strong className="font-bold text-amber-900 block mb-0.5">Important Pricing Override Behavior</strong>
            Applying a new rate here will overwrite the price settings of every active arena in the database. All customers will immediately see and pay this updated hourly rate when choosing timing slots on the portal.
          </div>
        </div>

        {/* Form controls */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xxs font-bold text-brand-textSecondary uppercase tracking-wider">
              New Hourly Pricing Rate (₹)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-brand-textDark font-bold text-xs select-none">₹</span>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="E.g., 500"
                className="w-full bg-brand-light/35 border border-brand-border rounded-lg py-3 pl-8 pr-3 text-xs font-bold outline-none transition-all duration-300 focus:border-brand-accent focus:ring-3 focus:ring-brand-accentGlow"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                disabled={loading || fetching}
                required
              />
            </div>
            <span className="text-[10px] text-brand-textMuted mt-1 leading-relaxed">
              Enter the numeric hourly slot cost. Values below ₹0 are not accepted by the database schema.
            </span>
          </div>

          {/* Success / Error Alerts */}
          {successMsg && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3.5 flex gap-2.5 text-xs text-green-700 font-semibold items-center animate-fade">
              <CheckCircle size={15} className="text-green-500 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3.5 flex gap-2.5 text-xs text-brand-danger font-semibold items-center animate-fade">
              <Info size={15} className="text-brand-danger shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action button */}
          <button
            type="submit"
            disabled={loading || fetching}
            className="w-full bg-brand-accent hover:bg-brand-accentHover disabled:bg-brand-textMuted text-white text-xs font-bold py-3.5 px-4 rounded-lg shadow-premium tracking-wide uppercase transition-all duration-300 mt-2 flex items-center justify-center gap-2 hover:scale-[1.01]"
          >
            {loading ? (
              <>
                <div className="border-2 border-white/20 border-l-white rounded-full w-4.5 h-4.5 animate-spin" />
                Propagating to Slots...
              </>
            ) : (
              'Apply Price to All Slots'
            )}
          </button>
        </form>

      </div>
    </div>
  );
};

export default SetPayment;

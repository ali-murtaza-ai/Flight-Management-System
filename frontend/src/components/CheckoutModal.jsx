import React, { useState, useEffect } from 'react';
import { X, Clock, ShieldCheck, User, Mail, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';
import { confirmBooking } from '../api/client';

export default function CheckoutModal({ isOpen, onClose, holdData, flight, onBookingSuccess }) {
  const [passengerName, setPassengerName] = useState('');
  const [passengerEmail, setPassengerEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 10-Minute Hold Timer Countdown (600 seconds)
  const [secondsLeft, setSecondsLeft] = useState(600);

  useEffect(() => {
    if (!isOpen) {
      setSecondsLeft(600);
      setError(null);
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen || !holdData || !flight) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isExpired = secondsLeft === 0;

  const basePrices = { FIRST: 1200, BUSINESS: 650, ECONOMY: 250 };
  const seatPrice = basePrices[holdData.seat_class] || 200;
  const totalFare = seatPrice * holdData.seat_count;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isExpired) {
      setError('Seat hold has expired. Please create a new seat hold.');
      return;
    }

    if (!passengerName || !passengerEmail) {
      setError('Please fill in all passenger details.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const bookingPayload = {
        flight_id: flight.id,
        hold_id: holdData.id,
        user_id: holdData.user_id || 'usr-guest',
        passenger_name: passengerName,
        passenger_email: passengerEmail,
        seat_class: holdData.seat_class,
        seat_count: holdData.seat_count
      };

      const booking = await confirmBooking(bookingPayload);
      setLoading(false);
      onBookingSuccess(booking);
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to confirm booking');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header & Hold Timer Badge */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase tracking-wider">
              Temporary Seat Hold Active
            </span>
            <h3 className="text-xl font-extrabold text-white mt-1">Complete Checkout</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Real-time Countdown Timer Bar */}
        <div className={`mt-4 p-3 rounded-xl border flex items-center justify-between transition-colors ${
          isExpired
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            : secondsLeft < 120
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
            : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
        }`}>
          <div className="flex items-center space-x-2 text-sm font-medium">
            <Clock className="w-4 h-4" />
            <span>{isExpired ? 'Seat Hold Expired!' : 'Hold Expires In:'}</span>
          </div>
          <span className="text-lg font-black tracking-widest font-mono">
            {formattedTime}
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Flight & Seat Hold Summary */}
        <div className="mt-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-sm">
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-xs text-slate-400">Flight Number:</span>
            <span className="font-bold text-white">{flight.flight_number}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-xs text-slate-400">Route:</span>
            <span className="font-semibold text-slate-200">{flight.origin} → {flight.destination}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span className="text-xs text-slate-400">Seat Class & Seats:</span>
            <span className="font-semibold text-sky-400">{holdData.seat_count}x {holdData.seat_class} Class</span>
          </div>
          <div className="pt-2 border-t border-slate-800 flex justify-between items-center font-bold text-base">
            <span className="text-slate-300">Total Price:</span>
            <span className="text-emerald-400">${totalFare.toFixed(2)}</span>
          </div>
        </div>

        {/* Passenger Input Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Passenger Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                placeholder="e.g. Eleanor Vance"
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Email Address for Ticket Confirmation
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                placeholder="eleanor@airline.com"
                value={passengerEmail}
                onChange={(e) => setPassengerEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || isExpired}
            className={`w-full mt-2 py-3 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg ${
              isExpired
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
            }`}
          >
            {loading ? (
              <span>Confirming Booking...</span>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>Confirm Booking & Pay ${totalFare.toFixed(2)}</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}

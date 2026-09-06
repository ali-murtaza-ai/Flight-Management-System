import React, { useState, useEffect } from 'react';
import { Search, Plane, ShieldAlert, Clock, ArrowRight, UserCheck, AlertCircle, Sparkles } from 'lucide-react';
import { getFlights, createSeatHold, getFareRules, addToWaitlist } from '../api/client';
import FareRulesModal from './FareRulesModal';
import CheckoutModal from './CheckoutModal';

export default function FlightSearch({ onNavigateWaitlist }) {
  const [flights, setFlights] = useState([]);
  const [fareRules, setFareRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Search Filters
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [seatClass, setSeatClass] = useState('');

  // Modals state
  const [isFareRulesOpen, setIsFareRulesOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Active Hold state
  const [activeHold, setActiveHold] = useState(null);
  const [selectedFlight, setSelectedFlight] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const flts = await getFlights({ origin, destination, seat_class: seatClass });
      const rules = await getFareRules();
      setFlights(flts);
      setFareRules(rules);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [origin, destination, seatClass]);

  const handleHoldAndBook = async (flight, targetClass) => {
    setError(null);
    setActionLoading(true);
    try {
      const holdPayload = {
        flight_id: flight.id,
        seat_class: targetClass,
        seat_count: 1,
        user_id: `usr-${Math.floor(Math.random() * 9000 + 1000)}`
      };

      const hold = await createSeatHold(holdPayload);
      setActiveHold(hold);
      setSelectedFlight(flight);
      setIsCheckoutOpen(true);
    } catch (err) {
      setError(err.message || 'Failed to acquire temporary seat hold');
    }
    setActionLoading(false);
  };

  const handleJoinWaitlist = async (flight, targetClass) => {
    try {
      const userEmail = prompt(`Flight class ${targetClass} is sold out! Enter your email to join the waitlist:`);
      if (!userEmail) return;

      await addToWaitlist({
        flight_id: flight.id,
        user_id: `usr-wt-${Date.now()}`,
        passenger_email: userEmail,
        seat_class: targetClass,
        seat_count: 1
      });

      setNotification(`Added ${userEmail} to the waitlist queue for flight ${flight.flight_number}! n8n worker will auto-promote when seats free up.`);
      setTimeout(() => setNotification(null), 6000);
      if (onNavigateWaitlist) onNavigateWaitlist();
    } catch (err) {
      setError('Failed to join waitlist');
    }
  };

  const basePrices = { FIRST: 1200, BUSINESS: 650, ECONOMY: 250 };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/50 to-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-sky-400 text-xs font-bold tracking-wider uppercase">
            <Sparkles className="w-4 h-4" />
            <span>Live Inventory Search Engine</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-1">Book Flights & Hold Seats</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time seat class availability. Includes 10-minute temporary checkout hold locks.
          </p>
        </div>
        <button
          onClick={() => setIsFareRulesOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-sky-300 border border-slate-700 text-xs font-bold flex items-center space-x-2 transition-all shadow-md shrink-0"
        >
          <ShieldAlert className="w-4 h-4 text-sky-400" />
          <span>View Fare Policy Rules</span>
        </button>
      </div>

      {/* Notifications */}
      {notification && (
        <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-sm flex items-center gap-3">
          <Sparkles className="w-5 h-5 shrink-0" />
          <span>{notification}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Filter Bar */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Origin Airport</label>
          <input
            type="text"
            placeholder="e.g. JFK"
            value={origin}
            onChange={(e) => setOrigin(e.target.value.toUpperCase())}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500/50 uppercase"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Destination Airport</label>
          <input
            type="text"
            placeholder="e.g. LAX"
            value={destination}
            onChange={(e) => setDestination(e.target.value.toUpperCase())}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500/50 uppercase"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Seat Class Filter</label>
          <select
            value={seatClass}
            onChange={(e) => setSeatClass(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500/50"
          >
            <option value="">All Classes</option>
            <option value="FIRST">First Class</option>
            <option value="BUSINESS">Business Class</option>
            <option value="ECONOMY">Economy Class</option>
          </select>
        </div>

        <button
          onClick={loadData}
          className="py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-sky-600/20"
        >
          <Search className="w-4 h-4" />
          <span>Refresh Results</span>
        </button>
      </div>

      {/* Flight Cards Grid */}
      <div className="space-y-6">
        {flights.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <Plane className="w-10 h-10 text-slate-600 mx-auto transform -rotate-45" />
            <h3 className="text-base font-bold text-slate-300">No scheduled flights match your search criteria.</h3>
            <p className="text-xs text-slate-500">Try clearing filters or schedule new flights in the Admin Dashboard.</p>
          </div>
        ) : (
          flights.map((flight) => (
            <div
              key={flight.id}
              className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all shadow-xl space-y-6"
            >
              {/* Route & Times */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-extrabold text-sm">
                    {flight.flight_number}
                  </div>
                  <div>
                    <div className="flex items-center space-x-3 text-lg font-black text-white">
                      <span>{flight.origin}</span>
                      <ArrowRight className="w-4 h-4 text-sky-400" />
                      <span>{flight.destination}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Departure: {new Date(flight.departure_time).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-xs font-semibold text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    Capacity: {flight.capacity} seats
                  </span>
                </div>
              </div>

              {/* SEAT CLASSES & PRICING GRID */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['FIRST', 'BUSINESS', 'ECONOMY'].map((className) => {
                  const alloc = flight.allocations?.find((a) => a.seat_class === className);
                  const available = alloc ? alloc.available_seats : 0;
                  const price = basePrices[className];
                  const isSoldOut = available <= 0;

                  return (
                    <div
                      key={className}
                      className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                        className === 'FIRST' ? 'bg-amber-950/10 border-amber-500/20' :
                        className === 'BUSINESS' ? 'bg-indigo-950/10 border-indigo-500/20' :
                        'bg-sky-950/10 border-sky-500/20'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center">
                          <span className={`text-xs font-bold uppercase tracking-wider ${
                            className === 'FIRST' ? 'text-amber-400' :
                            className === 'BUSINESS' ? 'text-indigo-400' : 'text-sky-400'
                          }`}>
                            {className} CLASS
                          </span>
                          <span className="text-sm font-black text-white">
                            ${price}
                          </span>
                        </div>

                        {/* Availability Badge */}
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-slate-400">Available:</span>
                          <span className={`font-bold px-2 py-0.5 rounded-full ${
                            available > 10 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            available > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {available > 0 ? `${available} Seats Left` : 'Sold Out'}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {available > 0 ? (
                        <button
                          onClick={() => handleHoldAndBook(flight, className)}
                          disabled={actionLoading}
                          className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Hold & Book Seat</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleJoinWaitlist(flight, className)}
                          className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all border border-amber-500/30"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                          <span>Join Waitlist Queue</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <FareRulesModal
        isOpen={isFareRulesOpen}
        onClose={() => setIsFareRulesOpen(false)}
        fareRules={fareRules}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        holdData={activeHold}
        flight={selectedFlight}
        onBookingSuccess={() => {
          setNotification('Booking confirmed successfully! Seat held & ticket persist to Postgres ledger.');
          setTimeout(() => setNotification(null), 6000);
          loadData();
        }}
      />

    </div>
  );
}

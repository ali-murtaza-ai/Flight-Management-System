import React, { useState, useEffect } from 'react';
import { PlusCircle, Plane, CheckCircle2, AlertTriangle, ShieldCheck, XCircle, Sliders, Calendar, Clock, ChevronRight } from 'lucide-react';
import { getFlights, createFlight, cancelFlight } from '../api/client';

export default function AdminDashboard() {
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Form State
  const [flightNumber, setFlightNumber] = useState('SK-808');
  const [origin, setOrigin] = useState('JFK');
  const [destination, setDestination] = useState('SFO');
  const [departureDate, setDepartureDate] = useState('2026-10-15T09:00');
  const [arrivalDate, setArrivalDate] = useState('2026-10-15T14:30');
  const [capacity, setCapacity] = useState(180);

  // Seat Class Allocations
  const [firstClassSeats, setFirstClassSeats] = useState(12);
  const [businessClassSeats, setBusinessClassSeats] = useState(36);
  const [economyClassSeats, setEconomyClassSeats] = useState(132);

  // Live Capacity Validation Math
  const allocatedSum = Number(firstClassSeats || 0) + Number(businessClassSeats || 0) + Number(economyClassSeats || 0);
  const isCapacityValid = allocatedSum === Number(capacity) && allocatedSum > 0;
  const isNegativeOrZero = Number(firstClassSeats) <= 0 || Number(businessClassSeats) <= 0 || Number(economyClassSeats) <= 0 || Number(capacity) <= 0;

  const loadFlights = async () => {
    setLoading(true);
    try {
      const data = await getFlights();
      setFlights(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFlights();
  }, []);

  const handleCreateFlight = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (!isCapacityValid) {
      setError(`Seat class sum (${allocatedSum}) does not match declared capacity (${capacity}).`);
      return;
    }

    if (isNegativeOrZero) {
      setError('Seat counts and aircraft capacity must be strictly positive (> 0).');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        flight_number: flightNumber.trim().toUpperCase(),
        origin: origin.trim().toUpperCase(),
        destination: destination.trim().toUpperCase(),
        departure_time: new Date(departureDate).toISOString(),
        arrival_time: new Date(arrivalDate).toISOString(),
        capacity: Number(capacity),
        allocations: [
          { seat_class: 'FIRST', total_seats: Number(firstClassSeats) },
          { seat_class: 'BUSINESS', total_seats: Number(businessClassSeats) },
          { seat_class: 'ECONOMY', total_seats: Number(economyClassSeats) }
        ]
      };

      const newFlt = await createFlight(payload);
      setMessage(`Flight ${newFlt.flight_number} created successfully with ${newFlt.capacity} total seat capacity!`);
      await loadFlights();
    } catch (err) {
      setError(err.message || 'Failed to create flight');
    }
    setActionLoading(false);
  };

  const handleCancelFlight = async (flightId) => {
    if (!window.confirm('Are you sure you want to cancel this flight? All bookings will be 100% refunded.')) return;
    try {
      await cancelFlight(flightId);
      setMessage('Flight status updated to CANCELLED.');
      await loadFlights();
    } catch (e) {
      setError(e.message || 'Failed to cancel flight');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-sky-400 text-xs font-bold tracking-wider uppercase">
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Write Path Enforcer</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-1">Flight Management & Inventory Control</h1>
          <p className="text-xs text-slate-400 mt-1">
            FastAPI is the exclusive write node for live flight scheduling. Ledger updates persist directly to Supabase Postgres.
          </p>
        </div>
      </div>

      {/* Global Status Alerts */}
      {message && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid: Create Flight Form & System Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* CREATE FLIGHT FORM (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Schedule New Flight</h2>
              <p className="text-xs text-slate-400">Define route, timings, and class allocations</p>
            </div>
          </div>

          <form onSubmit={handleCreateFlight} className="space-y-6">
            
            {/* Route & Flight Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Flight Number</label>
                <input
                  type="text"
                  required
                  value={flightNumber}
                  onChange={(e) => setFlightNumber(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500/50 uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Origin (3-Letter IATA)</label>
                <input
                  type="text"
                  maxLength={3}
                  required
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500/50 uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Destination (3-Letter IATA)</label>
                <input
                  type="text"
                  maxLength={3}
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500/50 uppercase"
                />
              </div>
            </div>

            {/* Timings & Capacity */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Departure Time</label>
                <input
                  type="datetime-local"
                  required
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Arrival Time</label>
                <input
                  type="datetime-local"
                  required
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Total Aircraft Capacity</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500/50"
                />
              </div>
            </div>

            {/* SEAT CLASS BREAKDOWN & LIVE CAPACITY VALIDATION */}
            <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Seat Class Capacity Allocation
                </span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
                  isCapacityValid
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}>
                  {allocatedSum} / {capacity} Seats Allocated
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                <div 
                  style={{ width: `${(firstClassSeats / capacity) * 100}%` }} 
                  className="bg-amber-400 h-full transition-all duration-300" 
                  title="First Class"
                />
                <div 
                  style={{ width: `${(businessClassSeats / capacity) * 100}%` }} 
                  className="bg-indigo-500 h-full transition-all duration-300" 
                  title="Business Class"
                />
                <div 
                  style={{ width: `${(economyClassSeats / capacity) * 100}%` }} 
                  className="bg-sky-500 h-full transition-all duration-300" 
                  title="Economy Class"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-amber-400 mb-1">First Class Seats</label>
                  <input
                    type="number"
                    min={1}
                    value={firstClassSeats}
                    onChange={(e) => setFirstClassSeats(e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-400/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-indigo-400 mb-1">Business Class Seats</label>
                  <input
                    type="number"
                    min={1}
                    value={businessClassSeats}
                    onChange={(e) => setBusinessClassSeats(e.target.value)}
                    className="w-full bg-slate-900 border border-indigo-500/30 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-400/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-sky-400 mb-1">Economy Class Seats</label>
                  <input
                    type="number"
                    min={1}
                    value={economyClassSeats}
                    onChange={(e) => setEconomyClassSeats(e.target.value)}
                    className="w-full bg-slate-900 border border-sky-500/30 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-400/50"
                  />
                </div>
              </div>

              {!isCapacityValid && (
                <p className="text-xs text-rose-400 flex items-center gap-1.5 pt-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Validation Error: Sum of seat classes ({allocatedSum}) must EXACTLY equal declared aircraft capacity ({capacity}).</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!isCapacityValid || isNegativeOrZero || actionLoading}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                isCapacityValid && !isNegativeOrZero
                  ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {actionLoading ? 'Creating Flight...' : 'Confirm & Schedule Flight'}
            </button>
          </form>

        </div>

        {/* SYSTEM AUDIT & ARCHITECTURE INFO (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              <span>Concurrency & Locks</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              When users hold or book seats, FastAPI acquires an atomic <code className="text-sky-400 bg-slate-950 px-1 py-0.5 rounded">SELECT ... FOR UPDATE</code> lock on <code className="text-slate-300">seat_allocations</code> rows.
            </p>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Active Flights:</span>
                <span className="font-bold text-white">{flights.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ledger Engine:</span>
                <span className="font-semibold text-emerald-400">Postgres 16</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* FLIGHT MANAGEMENT LIST TABLE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Scheduled Flights Ledger</h3>
          <span className="text-xs text-slate-400">{flights.length} Flights Loaded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5">Flight No</th>
                <th className="p-3.5">Route</th>
                <th className="p-3.5">Departure</th>
                <th className="p-3.5">Capacity</th>
                <th className="p-3.5">Class Allocations</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {flights.map((flight) => (
                <tr key={flight.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 font-bold text-white flex items-center gap-2">
                    <Plane className="w-4 h-4 text-sky-400" />
                    <span>{flight.flight_number}</span>
                  </td>
                  <td className="p-3.5 font-semibold text-slate-200">
                    {flight.origin} → {flight.destination}
                  </td>
                  <td className="p-3.5 text-xs text-slate-400">
                    {new Date(flight.departure_time).toLocaleString()}
                  </td>
                  <td className="p-3.5 font-medium text-slate-200">
                    {flight.capacity} seats
                  </td>
                  <td className="p-3.5 text-xs space-x-1">
                    {flight.allocations?.map((alloc) => (
                      <span
                        key={alloc.seat_class}
                        className={`inline-block px-2 py-0.5 rounded font-mono ${
                          alloc.seat_class === 'FIRST' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          alloc.seat_class === 'BUSINESS' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                          'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        }`}
                      >
                        {alloc.seat_class[0]}: {alloc.available_seats}/{alloc.total_seats}
                      </span>
                    ))}
                  </td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      flight.status === 'SCHEDULED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {flight.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    {flight.status === 'SCHEDULED' && (
                      <button
                        onClick={() => handleCancelFlight(flight.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors"
                      >
                        Cancel Flight
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

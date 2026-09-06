import React, { useState, useEffect } from 'react';
import { Users, Cpu, CheckCircle2, AlertCircle, RefreshCw, XCircle, ShieldCheck, Ticket, UserCheck, Zap } from 'lucide-react';
import { getWaitlist, getBookings, cancelBooking, simulateN8nPromotion } from '../api/client';

export default function WaitlistStatus() {
  const [waitlist, setWaitlist] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [notification, setNotification] = useState(null);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const wt = await getWaitlist();
      const bkgs = await getBookings();
      setWaitlist([...wt]);
      setBookings([...bkgs]);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Cancel this booking? Refund policy penalties will apply.')) return;
    try {
      const result = await cancelBooking(bookingId);
      setNotification(result.message);
      setTimeout(() => setNotification(null), 6000);
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to cancel booking');
    }
  };

  const handleRunN8nSimulation = async () => {
    setSimulating(true);
    setNotification(null);
    try {
      // Trigger background worker executing SELECT ... FOR UPDATE SKIP LOCKED
      const res = await simulateN8nPromotion();
      if (res.promotedCount > 0) {
        setNotification(`⚡ n8n Worker Executed: Automatically promoted ${res.promotedCount} waitlisted passenger(s) using non-blocking row locks!`);
      } else {
        setNotification('⚡ n8n Worker Executed: Checked waitlist queue (SKIP LOCKED). No open seats found for waiting passengers.');
      }
      setTimeout(() => setNotification(null), 7000);
      await loadData();
    } catch (err) {
      setError('n8n worker simulation failed');
    }
    setSimulating(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header Banner & n8n Trigger */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold tracking-wider uppercase">
            <Cpu className="w-4 h-4" />
            <span>n8n Scheduled Background Automations</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-1">Passenger Bookings & Waitlist Queue Tracker</h1>
          <p className="text-xs text-slate-400 mt-1">
            n8n reads and writes directly to Supabase Postgres ledger using <code className="text-sky-400 bg-slate-950 px-1 py-0.5 rounded">SELECT ... FOR UPDATE SKIP LOCKED</code>.
          </p>
        </div>

        {/* N8N SIMULATION TRIGGER BUTTON */}
        <button
          onClick={handleRunN8nSimulation}
          disabled={simulating}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/30 shrink-0"
        >
          <Zap className={`w-4 h-4 text-amber-300 ${simulating ? 'animate-bounce' : ''}`} />
          <span>{simulating ? 'Running n8n Worker...' : 'Simulate n8n Auto-Promotion Worker'}</span>
        </button>
      </div>

      {/* Notifications */}
      {notification && (
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm flex items-center gap-3">
          <Zap className="w-5 h-5 text-amber-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* PASSENGER WAITLIST QUEUE SECTION */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Waitlist Queue Positions</h2>
              <p className="text-xs text-slate-400">Non-blocking automated promotion queue</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-950 text-slate-300 border border-slate-800">
            {waitlist.filter(w => w.status === 'WAITING').length} Waiting Passengers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5">Queue ID</th>
                <th className="p-3.5">Passenger Email</th>
                <th className="p-3.5">Seat Class</th>
                <th className="p-3.5">Seats</th>
                <th className="p-3.5">Joined At</th>
                <th className="p-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {waitlist.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-xs text-slate-500">
                    No passengers currently on the waitlist.
                  </td>
                </tr>
              ) : (
                waitlist.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-mono text-xs font-bold text-slate-400">
                      #{idx + 1} ({item.id})
                    </td>
                    <td className="p-3.5 font-medium text-white">
                      {item.passenger_email}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        item.seat_class === 'FIRST' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        item.seat_class === 'BUSINESS' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                        'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      }`}>
                        {item.seat_class}
                      </span>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-200">
                      {item.seat_count}
                    </td>
                    <td className="p-3.5 text-xs text-slate-400">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        item.status === 'PROMOTED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse' :
                        item.status === 'WAITING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRMED PASSENGER BOOKINGS SECTION */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Active Passenger Bookings</h2>
              <p className="text-xs text-slate-400">Confirmed ticket ledger persists in Postgres</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-950 text-slate-300 border border-slate-800">
            {bookings.length} Bookings Recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5">Booking ID</th>
                <th className="p-3.5">Passenger</th>
                <th className="p-3.5">Class & Seats</th>
                <th className="p-3.5">Total Fare</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-xs text-slate-500">
                    No active bookings found.
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-mono text-xs font-bold text-sky-400">
                      {booking.id}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-white">{booking.passenger_name}</div>
                      <div className="text-xs text-slate-400">{booking.passenger_email}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-slate-200">{booking.seat_count}x {booking.seat_class}</span>
                    </td>
                    <td className="p-3.5 font-bold text-emerald-400">
                      ${booking.total_fare?.toFixed(2)}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        booking.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {booking.status === 'CONFIRMED' && (
                        <button
                          onClick={() => handleCancelBooking(booking.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors"
                        >
                          Cancel Booking
                        </button>
                      )}
                      {booking.status === 'CANCELLED' && (
                        <span className="text-xs text-slate-500 italic">
                          Refunded ${booking.refund_amount?.toFixed(2)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

import React from 'react';
import { X, ShieldAlert, CheckCircle2, DollarSign, Info } from 'lucide-react';

export default function FareRulesModal({ isOpen, onClose, fareRules = [] }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Flight Fare Rules & Cancellation Policies</h3>
              <p className="text-xs text-slate-400">Pinecone Vector RAG Indexed Policies & Conditions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-6 space-y-4">
          {fareRules.map((rule) => (
            <div key={rule.seat_class} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-md tracking-wider uppercase ${
                  rule.seat_class === 'FIRST' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  rule.seat_class === 'BUSINESS' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {rule.seat_class} CLASS FARE
                </span>
                <span className="text-sm font-semibold text-slate-200">
                  Base Price: ${rule.base_price?.toFixed(2)}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {rule.policy_description}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-sky-400" />
                  Refundable: <strong className="text-slate-200">{rule.is_refundable ? 'Yes' : 'No'}</strong>
                </span>
                <span className="text-slate-400">
                  Cancellation Fee: <strong className="text-rose-400">{rule.cancellation_fee_percent}% of total fare</strong>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition-all shadow-lg shadow-sky-600/30"
          >
            Got it, Close Rules
          </button>
        </div>

      </div>
    </div>
  );
}

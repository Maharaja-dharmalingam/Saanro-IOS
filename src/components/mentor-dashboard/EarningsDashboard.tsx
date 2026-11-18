import { useState, useEffect } from 'react';
import { DollarSign, Clock, TrendingUp, ArrowUpRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Earning } from '../../lib/types';

interface EarningsDashboardProps {
  mentorId: string;
  totalSessions: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function BarChart({ data }: { data: { label: string; amount: number }[] }) {
  const max = Math.max(...data.map(d => d.amount), 1);
  return (
    <div className="flex items-end gap-1.5 h-28">
      {data.map(({ label, amount }) => {
        const pct = (amount / max) * 100;
        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1 group relative">
            {amount > 0 && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                ${amount}
              </div>
            )}
            <div
              className="w-full rounded-t-lg transition-all duration-500 bg-gradient-to-t from-blue-600 to-blue-400"
              style={{ height: `${Math.max(pct, amount > 0 ? 8 : 0)}%` }}
            />
            <span className="text-[10px] text-slate-400 font-medium">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function EarningsDashboard({ mentorId, totalSessions }: EarningsDashboardProps) {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEarnings();
  }, [mentorId]);

  async function loadEarnings() {
    setLoading(true);
    const { data } = await supabase
      .from('earnings')
      .select('*')
      .eq('mentor_id', mentorId)
      .order('session_date', { ascending: false });
    if (data) setEarnings(data as Earning[]);
    setLoading(false);
  }

  const total = earnings.reduce((s, e) => s + (e.status !== 'refunded' ? e.amount_usd : 0), 0);
  const pending = earnings.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount_usd, 0);
  const paid = earnings.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount_usd, 0);

  const now = new Date();
  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { label: MONTHS[d.getMonth()], month: d.getMonth(), year: d.getFullYear(), amount: 0 };
  });

  earnings.forEach(e => {
    const d = new Date(e.session_date);
    const slot = last6.find(s => s.month === d.getMonth() && s.year === d.getFullYear());
    if (slot && e.status !== 'refunded') slot.amount += e.amount_usd;
  });

  const thisMonth = last6[last6.length - 1].amount;
  const lastMonth = last6[last6.length - 2].amount;
  const growth = lastMonth === 0 ? null : Math.round(((thisMonth - lastMonth) / lastMonth) * 100);

  return (
    <div className="space-y-4 pb-8">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Earned', value: `$${total.toLocaleString()}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Pending Payout', value: `$${pending.toLocaleString()}`, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Sessions Completed', value: totalSessions, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Paid Out', value: `$${paid.toLocaleString()}`, icon: ArrowUpRight, color: 'text-slate-600', bg: 'bg-slate-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={17} className={color} />
            </div>
            <p className="text-xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800">Monthly Revenue</h3>
            <p className="text-xs text-slate-400 mt-0.5">Last 6 months</p>
          </div>
          {growth !== null && (
            <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl ${
              growth >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
            }`}>
              <ArrowUpRight size={13} className={growth < 0 ? 'rotate-180' : ''} />
              {Math.abs(growth)}% vs last month
            </div>
          )}
        </div>
        {loading ? (
          <div className="h-28 bg-slate-50 rounded-xl animate-pulse" />
        ) : (
          <BarChart data={last6} />
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h3 className="font-bold text-slate-800">Recent Transactions</h3>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />)}
          </div>
        ) : earnings.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-slate-400 text-sm">No earnings recorded yet.</p>
            <p className="text-slate-300 text-xs mt-1">Earnings appear after completed sessions.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {earnings.slice(0, 10).map(e => (
              <div key={e.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Session · {new Date(e.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    e.status === 'paid' ? 'bg-green-50 text-green-600' :
                    e.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                    'bg-red-50 text-red-500'
                  }`}>
                    {e.status}
                  </span>
                </div>
                <span className={`text-sm font-bold ${e.status === 'refunded' ? 'text-red-400 line-through' : 'text-slate-800'}`}>
                  ${e.amount_usd.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

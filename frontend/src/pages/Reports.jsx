import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { invoicesAPI, expensesAPI } from '../services/api';
import JalaliDatePicker from '../components/JalaliDatePicker';


const fmt = (n) => new Intl.NumberFormat('fa-IR').format(Number(n) || 0) + ' تومان';
const fmtN = (n) => new Intl.NumberFormat('fa-IR').format(Number(n) || 0);

const persianDate = (d) => {
  if (!d) return '---';
  try { return new Intl.DateTimeFormat('fa-IR').format(new Date(d)); } catch { return d; }
};

const STATUS_MAP = {
  draft:     { label: 'پیش‌نویس',    color: 'text-slate-300 bg-slate-500/20 border-slate-500/30' },
  pending:   { label: 'پرداخت نشده', color: 'text-yellow-300 bg-yellow-500/20 border-yellow-500/30' },
  paid:      { label: 'پرداخت شده',  color: 'text-green-300 bg-green-500/20 border-green-500/30' },
  cancelled: { label: 'لغو شده',     color: 'text-red-300 bg-red-500/20 border-red-500/30' },
};

const StatBox = ({ label, value, sub, color = 'blue', icon }) => (
  <div className={`bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5`}>
    <div className="flex items-start justify-between mb-3">
      <span className="text-2xl">{icon}</span>
      <div className={`w-2 h-2 rounded-full bg-${color}-500 mt-1`} />
    </div>
    <p className={`text-xl font-bold text-${color}-400`}>{value}</p>
    <p className="text-slate-400 text-sm mt-1">{label}</p>
    {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
  </div>
);

const Reports = () => {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [report, setReport] = useState(null);
  const [overdue, setOverdue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('summary'); // summary | invoices | overdue

  const loadReport = async () => {
    setLoading(true);
    try {
      const [repRes, ovRes, expRes] = await Promise.all([
        invoicesAPI.report({ date_from: dateFrom, date_to: dateTo }),
        invoicesAPI.overdue(),
        expensesAPI.summary({ date_from: dateFrom, date_to: dateTo }),
      ]);
      setReport(repRes.data);
      setOverdue(ovRes.data);
      // Merge expense data into report
      repRes.data._expenseTotal = expRes.data.total || 0;
      repRes.data._expenseCategories = expRes.data.by_category || [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">گزارشات مالی</h2>
          <p className="text-slate-400 text-sm mt-0.5">تحلیل و گزارش‌گیری از عملکرد مالی</p>
        </div>
        <button onClick={async () => {
          try {
            const { data } = await invoicesAPI.exportCsv({ date_from: dateFrom, date_to: dateTo });
            const url = URL.createObjectURL(data);
            const a = document.createElement('a'); a.href = url;
            a.download = `invoices_${dateFrom}_${dateTo}.csv`;
            a.click(); URL.revokeObjectURL(url);
          } catch { alert('خطا در دانلود'); }
        }} className="px-4 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-emerald-400 text-sm transition-all flex items-center gap-2">
          📄 خروجی CSV
        </button>
      </div>

      {/* Date Filter */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="space-y-1.5 flex-1">
            <label className="text-xs text-slate-400">از تاریخ</label>
            <JalaliDatePicker value={dateFrom} onChange={(v) => setDateFrom(v)} />
          </div>
          <div className="space-y-1.5 flex-1">
            <label className="text-xs text-slate-400">تا تاریخ</label>
            <JalaliDatePicker value={dateTo} onChange={(v) => setDateTo(v)} />
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'امروز', f: today, t: today },
              { label: 'این ماه', f: firstOfMonth, t: today },
              { label: 'همه', f: '2020-01-01', t: today },
            ].map((q) => (
              <button
                key={q.label}
                onClick={() => { setDateFrom(q.f); setDateTo(q.t); }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
              >
                {q.label}
              </button>
            ))}
            <button
              onClick={loadReport}
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl transition-all disabled:opacity-60 flex items-center gap-2"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '🔍'}
              نمایش گزارش
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatBox icon="💰" label="درآمد خالص (کارمزد)" value={fmt(report.total_commission)} color="green" />
          <StatBox icon="🟡" label="مبلغ معوقه" value={fmt(report.pending_amount)} color="yellow" />
          <StatBox icon="🧾" label="گردش مالی کل" value={fmt(report.total_revenue)} color="purple" />
          <StatBox icon="📋" label="تعداد فاکتور" value={fmtN(report.total_count)} color="blue" />
          <StatBox icon="💸" label="کل هزینه‌ها" value={fmt(report._expenseTotal || 0)} color="red" />
          <StatBox icon="📈" label="سود خالص" value={fmt((report.total_commission || 0) - (report._expenseTotal || 0))} color={((report.total_commission || 0) - (report._expenseTotal || 0)) >= 0 ? 'green' : 'red'} />
        </div>
      )}


      {/* Status Breakdown */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(STATUS_MAP).map(([key, { label, color }]) => {
            const data = report.by_status?.[key];
            if (!data) return null;
            return (
              <div key={key} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${color}`}>{label}</span>
                <p className="text-white font-bold text-lg mt-2">{fmtN(data.count)}</p>
                <p className="text-slate-400 text-xs mt-0.5">{fmt(data.amount)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700/50">
        {[
          { key: 'invoices', label: `📋 لیست فاکتورها (${report?.total_count || 0})` },
          { key: 'overdue', label: `⏰ معوقه‌ها (${overdue.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
              tab === t.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {tab === 'invoices' && report && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
          {report.invoices?.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-10">فاکتوری در این بازه زمانی یافت نشد</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-700/30 text-slate-400 text-xs">
                    <th className="text-right py-3 px-4 font-medium">شماره</th>
                    <th className="text-right py-3 px-4 font-medium">مشتری</th>
                    <th className="text-right py-3 px-4 font-medium">تاریخ</th>
                    <th className="text-right py-3 px-4 font-medium">مبلغ</th>
                    <th className="text-right py-3 px-4 font-medium">کارمزد</th>
                    <th className="text-right py-3 px-4 font-medium">وضعیت</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {report.invoices.map((inv) => {
                    const st = STATUS_MAP[inv.status] || STATUS_MAP.draft;
                    return (
                      <tr key={inv.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-blue-400">{inv.invoice_number}</td>
                        <td className="py-3 px-4 text-white">{inv.customer_name}</td>
                        <td className="py-3 px-4 text-slate-400 text-xs">{persianDate(inv.date)}</td>
                        <td className="py-3 px-4 text-white font-medium">{fmt(inv.total_amount)}</td>
                        <td className="py-3 px-4 text-yellow-400">{Number(inv.commission_total) > 0 ? fmt(inv.commission_total) : '—'}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
                        </td>
                        <td className="py-3 px-4">
                          <Link to={`/invoices/${inv.id}`} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">مشاهده →</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Overdue List */}
      {tab === 'overdue' && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
          {overdue.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-slate-300 font-medium">هیچ فاکتور معوقه‌ای وجود ندارد</p>
              <p className="text-slate-500 text-sm mt-1">فاکتورهایی که سررسیدشان گذشته اینجا نشان داده می‌شوند</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-red-500/10 text-slate-400 text-xs">
                    <th className="text-right py-3 px-4 font-medium">شماره</th>
                    <th className="text-right py-3 px-4 font-medium">مشتری</th>
                    <th className="text-right py-3 px-4 font-medium text-red-400">سررسید</th>
                    <th className="text-right py-3 px-4 font-medium">مانده</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {overdue.map((inv) => {
                    const daysLate = Math.floor(
                      (Date.now() - new Date(inv.due_date).getTime()) / 86400000
                    );
                    return (
                      <tr key={inv.id} className="hover:bg-red-500/5 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-blue-400">{inv.invoice_number}</td>
                        <td className="py-3 px-4 text-white">{inv.customer_name}</td>
                        <td className="py-3 px-4">
                          <span className="text-red-400 text-xs">{persianDate(inv.due_date)}</span>
                          <span className="text-red-500/70 text-xs mr-2">({daysLate} روز تأخیر)</span>
                        </td>
                        <td className="py-3 px-4 text-white font-medium">{fmt(inv.remaining_amount ?? inv.total_amount)}</td>
                        <td className="py-3 px-4">
                          <Link to={`/invoices/${inv.id}`} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">مشاهده →</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;

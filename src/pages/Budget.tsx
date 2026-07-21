import { useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid,
} from 'recharts';
import { Plus, Trash2 } from 'lucide-react';
import { useTrip, newId } from '../store';
import type { ExpenseCategory } from '../types';
import { budgetSummary, costByDestination, avgNightlyRate, CATEGORY_LABELS } from '../lib/budget';
import { tripNightTotals } from '../lib/gaps';
import { ils, parseAmount } from '../lib/money';
import { StatCard, SectionTitle, Field } from '../components/ui';

export default function Budget() {
  const trip = useTrip((s) => s.trip)!;
  const { addExpense, removeExpense, updateSettings } = useTrip();
  const b = budgetSummary(trip);
  const byDest = costByDestination(trip);
  const nights = tripNightTotals(trip);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState<ExpenseCategory>('other');

  const pieData = b.lines.filter((l) => l.paid + l.committed + l.estimated > 0)
    .map((l) => ({ name: l.label, value: l.paid + l.committed + l.estimated, color: l.color }));

  const addRow = () => {
    const value = parseAmount(amount);
    if (!desc.trim() || !value) return;
    addExpense({
      id: newId('e'), date: null, destinationId: null,
      category: cat, description: desc.trim(), amount: value, currency: 'ILS', paid: false,
    });
    setDesc(''); setAmount('');
  };

  return (
    <div className="space-y-5">
      <SectionTitle>תקציב</SectionTitle>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="שולם בפועל" value={ils(b.paid)} tone="good" />
        <StatCard label="מחויב (טרם שולם)" value={ils(b.committed)} tone="warn"
                  sub="הזמנות סגורות שלא סומנו כשולמו" />
        <StatCard label="אומדן להשלמה" value={ils(b.estimated)}
                  sub={`כולל ${nights.openNights} לילות לפי ${ils(avgNightlyRate(trip))}/לילה`} />
        <StatCard
          label="סה״כ צפוי" value={ils(b.total)}
          tone={b.remaining !== null && b.remaining < 0 ? 'bad' : 'neutral'}
          sub={b.remaining !== null
            ? `${b.remaining >= 0 ? 'נותרו' : 'חריגה'} ${ils(Math.abs(b.remaining))} מתוך ${ils(b.target)}`
            : 'לא הוגדר יעד תקציב'}
        />
      </div>

      <div className="card p-4">
        <Field label="יעד תקציב כולל לטיול (₪)">
          <input
            className="input max-w-xs" inputMode="numeric" placeholder="למשל 45000"
            value={trip.settings.budgetTarget ?? ''}
            onChange={(e) => updateSettings({ budgetTarget: parseAmount(e.target.value) })}
          />
        </Field>
        {b.target !== null && (
          <div className="mt-3">
            <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div className="flex h-full">
                <div className="bg-emerald-500" style={{ width: `${Math.min(100, (b.paid / b.target) * 100)}%` }} />
                <div className="bg-amber-500" style={{ width: `${Math.min(100, (b.committed / b.target) * 100)}%` }} />
                <div className="bg-sky-400" style={{ width: `${Math.min(100, (b.estimated / b.target) * 100)}%` }} />
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-neutral-500">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" /> שולם</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-500" /> מחויב</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-sky-400" /> אומדן</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-bold">פילוח לפי קטגוריה</h3>
          {/* recharts מחשב מיקומים לפי LTR — בתוך עמוד RTL הגרף נדחף מחוץ למסגרת */}
          <div dir="ltr" className="h-[260px] w-full">
            {pieData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm muted">
                אין עדיין נתוני עלות להצגה
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}
                     paddingAngle={2} isAnimationActive={false}>
                  {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => ils(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            )}
          </div>
          <p className="sr-only">
            {pieData.map((d) => `${d.name}: ${ils(d.value)}`).join(', ')}. הנתונים המלאים בטבלה שלמטה.
          </p>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-sm font-bold">עלות לפי יעד</h3>
          <div dir="ltr" className="h-[260px] w-full">
            {byDest.every((d) => !d['מלונות'] && !d['תחבורה'] && !d['אטרקציות']) ? (
              <div className="flex h-full items-center justify-center text-center text-sm muted">
                אין עדיין עלויות משויכות ליעדים
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDest} margin={{ top: 5, right: 5, bottom: 45, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-300 dark:stroke-neutral-700" opacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={60} />
                <YAxis tick={{ fontSize: 10 }} width={45} />
                <Tooltip formatter={(v: number) => ils(v)} />
                <Legend verticalAlign="top" height={24} />
                <Bar dataKey="מלונות" stackId="a" fill="#4f6128" isAnimationActive={false} />
                <Bar dataKey="תחבורה" stackId="a" fill="#0ea5e9" isAnimationActive={false} />
                <Bar dataKey="אטרקציות" stackId="a" fill="#f59e0b" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <h3 className="border-b border-neutral-100 p-3 text-sm font-bold dark:border-neutral-800">פירוט לפי קטגוריה</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-950/60">
              <tr>
                <th scope="col" className="p-2 text-start font-medium">קטגוריה</th>
                <th scope="col" className="p-2 text-start font-medium">שולם</th>
                <th scope="col" className="p-2 text-start font-medium">מחויב</th>
                <th scope="col" className="p-2 text-start font-medium">אומדן</th>
                <th scope="col" className="p-2 text-start font-medium">סה״כ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {b.lines.map((l) => (
                <tr key={l.key}>
                  <th scope="row" className="p-2 font-normal">
                    <span className="flex items-center gap-2">
                      <i className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                      {l.label}
                    </span>
                  </th>
                  <td className="p-2 tabular-nums">{ils(l.paid)}</td>
                  <td className="p-2 tabular-nums">{ils(l.committed)}</td>
                  <td className="p-2 tabular-nums text-neutral-500">{ils(l.estimated)}</td>
                  <td className="p-2 font-semibold tabular-nums">{ils(l.paid + l.committed + l.estimated)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-neutral-200 bg-neutral-50 font-bold dark:border-neutral-700 dark:bg-neutral-950/60">
              <tr>
                <td className="p-2">סה״כ</td>
                <td className="p-2 tabular-nums">{ils(b.paid)}</td>
                <td className="p-2 tabular-nums">{ils(b.committed)}</td>
                <td className="p-2 tabular-nums">{ils(b.estimated)}</td>
                <td className="p-2 tabular-nums">{ils(b.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <h3 className="border-b border-neutral-100 p-3 text-sm font-bold dark:border-neutral-800">הוצאות אחרות</h3>
        <div className="flex flex-wrap items-end gap-2 border-b border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950/60">
          <div className="min-w-[12rem] flex-1">
            <Field label="תיאור">
              <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && addRow()} placeholder="ביטוח נסיעות" />
            </Field>
          </div>
          <div className="w-32">
            <Field label="קטגוריה">
              <select className="input" value={cat} onChange={(e) => setCat(e.target.value as ExpenseCategory)}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
          <div className="w-28">
            <Field label="סכום (₪)">
              <input className="input" inputMode="numeric" value={amount}
                     onChange={(e) => setAmount(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && addRow()} />
            </Field>
          </div>
          <button onClick={addRow} className="btn-primary"><Plus size={14} /> הוסף</button>
        </div>

        {trip.expenses.length === 0 ? (
          <p className="p-4 text-center text-sm muted">אין עדיין הוצאות נוספות</p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {trip.expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3">
                <span className="chip bg-neutral-100 dark:bg-neutral-800">{CATEGORY_LABELS[e.category]}</span>
                <span className="flex-1 text-sm">{e.description}</span>
                <button
                  onClick={() => useTrip.getState().updateExpense(e.id, { paid: !e.paid })}
                  className={`chip ${e.paid
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'}`}
                >
                  {e.paid ? 'שולם' : 'לא שולם'}
                </button>
                <span className="font-semibold tabular-nums">{ils(e.amount)}</span>
                <button onClick={() => removeExpense(e.id)} className="btn-icon hover:!text-red-600"
                        aria-label={`מחק את ההוצאה ${e.description}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

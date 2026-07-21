import { FileSpreadsheet, CalendarPlus, FileJson, Sun, Moon } from 'lucide-react';
import { useTrip } from '../store';
import { exportExcel, exportIcs, exportJson } from '../lib/exportFiles';
import { parseAmount, thb, ils } from '../lib/money';
import { SectionTitle, Field } from '../components/ui';

export default function SettingsPage() {
  const trip = useTrip((s) => s.trip)!;
  const { updateSettings } = useTrip();
  const s = trip.settings;

  return (
    <div className="max-w-3xl space-y-5">
      <SectionTitle>הגדרות</SectionTitle>

      <div className="card space-y-4 p-4">
        <h3 className="text-sm font-bold">כללי</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="מספר מטיילים">
            <input className="input" inputMode="numeric" value={s.travelers}
                   onChange={(e) => updateSettings({ travelers: parseAmount(e.target.value) ?? 1 })} />
          </Field>
          <Field label="יעד תקציב כולל (₪)">
            <input className="input" inputMode="numeric" value={s.budgetTarget ?? ''} placeholder="לא הוגדר"
                   onChange={(e) => updateSettings({ budgetTarget: parseAmount(e.target.value) })} />
          </Field>
          <Field label="תקציב אוכל יומי לאדם (₪)">
            <input className="input" inputMode="numeric" value={s.dailyFoodBudget ?? ''}
                   onChange={(e) => updateSettings({ dailyFoodBudget: parseAmount(e.target.value) })} />
          </Field>
          <Field label="שער באהט → שקל">
            <input className="input" inputMode="decimal" value={s.thbToIls}
                   onChange={(e) => updateSettings({ thbToIls: parseAmount(e.target.value) ?? 0.105 })} />
          </Field>
        </div>
        <p className="text-xs muted">
          לדוגמה: {thb(1000)} = {ils(1000 * s.thbToIls)}. עדכן ידנית לפני הטיול (חפש "THB to ILS").
        </p>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 text-sm font-bold">מראה</h3>
        <div className="flex gap-2">
          {([['light', 'בהיר', Sun], ['dark', 'כהה', Moon]] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => updateSettings({ theme: k })}
              className={s.theme === k ? 'btn-primary' : 'btn-ghost'}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <h3 className="mb-1 text-sm font-bold">ייצוא וגיבוי</h3>
        <p className="mb-3 text-xs muted">
          הנתונים נשמרים אוטומטית ב־<code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">data/trip.json</code>,
          עם גיבוי אחרון ב־<code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">data/trip.bak.json</code>.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => exportExcel(trip)} className="btn-ghost">
            <FileSpreadsheet size={15} /> ייצוא לאקסל
          </button>
          <button onClick={() => exportIcs(trip)} className="btn-ghost">
            <CalendarPlus size={15} /> ייצוא ליומן (.ics)
          </button>
          <button onClick={() => exportJson(trip)} className="btn-ghost">
            <FileJson size={15} /> הורדת JSON גולמי
          </button>
        </div>
        <p className="mt-3 text-xs muted">
          קובץ ה־.ics כולל צ׳ק-אין, צ׳ק-אאוט, כל דדליין ביטול חינם, מעברי תחבורה ואטרקציות משובצות.
        </p>
      </div>

      <div className="card p-4 text-xs muted">
        <h3 className="mb-2 text-sm font-bold text-neutral-900 dark:text-neutral-100">סטטיסטיקה</h3>
        <ul className="space-y-1">
          <li>{trip.destinations.length} יעדים · {trip.destinations.reduce((n, d) => n + (d.nights ?? 0), 0)} לילות</li>
          <li>{trip.hotels.filter((h) => h.status === 'booked').length} מלונות סגורים · {trip.hotels.filter((h) => h.status === 'candidate').length} מועמדים</li>
          <li>{trip.transport.length} רשומות תחבורה · {trip.attractions.length} אטרקציות</li>
        </ul>
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import {
  FileSpreadsheet, CalendarPlus, FileJson, Sun, Moon, Upload, Loader2, CircleCheck, CircleAlert,
} from 'lucide-react';
import { useTrip } from '../store';
import { exportExcel, exportIcs, exportJson } from '../lib/exportFiles';
import { parseAmount, thb, ils } from '../lib/money';
import { SectionTitle, Field } from '../components/ui';

type ImportState = 'idle' | 'busy' | 'done' | 'error';

export default function SettingsPage() {
  const trip = useTrip((s) => s.trip)!;
  const { updateSettings, load } = useTrip();
  const s = trip.settings;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importState, setImportState] = useState<ImportState>('idle');
  const [importMessage, setImportMessage] = useState<string | null>(null);

  async function handleImportFile(file: File) {
    if (!confirm(
      'ייבוא מהאקסל דורס את כל נתוני הטיול הנוכחיים בנתונים שבקובץ — כולל עריכות שעשית באפליקציה ' +
      '(שולם, קישורים, הערות). להמשיך?',
    )) return;

    setImportState('busy');
    setImportMessage(null);
    try {
      const res = await fetch('/api/import-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      });
      if (!res.headers.get('content-type')?.includes('application/json')) {
        throw new Error(`שגיאה לא צפויה מהשרת (${res.status})`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      await load();
      setImportState('done');
      setImportMessage(data.log ?? null);
    } catch (err) {
      setImportState('error');
      setImportMessage(err instanceof Error ? err.message : String(err));
    }
  }

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

      <div className="card p-4">
        <h3 className="mb-1 text-sm font-bold">ייבוא מאקסל</h3>
        <p className="mb-3 text-xs muted">
          מעלים את קובץ "מלונות שהוזמנו" (.xlsx) והאפליקציה קוראת אותו מחדש ומעדכנת יעדים ומלונות
          בהתאם למה שכתוב בו. שים לב — זו דריסה מלאה: עריכות שעשית באפליקציה (שולם, קישורים, הערות) יימחקו.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void handleImportFile(file);
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importState === 'busy'}
          className="btn-ghost"
        >
          {importState === 'busy' ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {importState === 'busy' ? 'מייבא…' : 'בחר קובץ אקסל וייבא'}
        </button>
        {importState === 'done' && (
          <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <p className="mb-1 flex items-center gap-1 font-semibold"><CircleCheck size={13} /> הייבוא הצליח</p>
            {importMessage && <pre className="whitespace-pre-wrap font-sans">{importMessage}</pre>}
          </div>
        )}
        {importState === 'error' && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
            <p className="mb-1 flex items-center gap-1 font-semibold"><CircleAlert size={13} /> הייבוא נכשל</p>
            {importMessage && <pre className="whitespace-pre-wrap font-sans">{importMessage}</pre>}
          </div>
        )}
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

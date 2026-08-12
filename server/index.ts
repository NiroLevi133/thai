import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importExcelBuffer } from './importExcel';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data', 'trip.json');
const BAK = path.join(__dirname, '..', 'data', 'trip.bak.json');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/api/trip', (_req, res) => {
  if (!fs.existsSync(DATA)) {
    return res.status(404).json({ error: 'data/trip.json לא קיים — הרץ: npm run import' });
  }
  res.type('application/json').send(fs.readFileSync(DATA, 'utf-8'));
});

app.put('/api/trip', (req, res) => {
  try {
    if (fs.existsSync(DATA)) fs.copyFileSync(DATA, BAK);
    const tmp = `${DATA}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(req.body, null, 2), 'utf-8');
    fs.renameSync(tmp, DATA); // כתיבה אטומית — לא נשאר קובץ חצי-כתוב אם משהו קורס
    res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (err) {
    console.error('שמירה נכשלה:', err);
    res.status(500).json({ error: String(err) });
  }
});

/** ייבוא מחדש מקובץ אקסל שהועלה מהממשק — ראה server/importExcel.ts. דורס את data/trip.json. */
app.post('/api/import-excel', express.raw({ type: '*/*', limit: '25mb' }), (req, res) => {
  const buf = req.body as Buffer;
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    return res.status(400).json({ error: 'לא התקבל קובץ' });
  }

  let result: ReturnType<typeof importExcelBuffer>;
  try {
    result = importExcelBuffer(buf);
  } catch (err) {
    return res.status(500).json({ error: String(err instanceof Error ? err.message : err) });
  }

  if (!result.ok || !result.trip) {
    return res.status(400).json({ error: result.errors.join('\n') });
  }

  try {
    if (fs.existsSync(DATA)) fs.copyFileSync(DATA, BAK);
    const tmp = `${DATA}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(result.trip, null, 2), 'utf-8');
    fs.renameSync(tmp, DATA);
    res.json({ ok: true, trip: result.trip, log: result.log.join('\n') });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const PORT = 5174;
app.listen(PORT, () => console.log(`📁 שרת נתונים על http://localhost:${PORT}`));

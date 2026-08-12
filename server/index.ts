import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data', 'trip.json');
const BAK = path.join(__dirname, '..', 'data', 'trip.bak.json');
const IMPORT_SCRIPT = path.join(__dirname, '..', 'scripts', 'import_excel.py');

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

/**
 * ייבוא מחדש מקובץ אקסל שהועלה מהממשק — מריץ את scripts/import_excel.py
 * (הפרסינג המלא, כולל צבעים ומיזוגי תאים, נשאר בפייתון) ודורס את data/trip.json.
 */
app.post('/api/import-excel', express.raw({ type: '*/*', limit: '25mb' }), (req, res) => {
  const buf = req.body as Buffer;
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    return res.status(400).json({ error: 'לא התקבל קובץ' });
  }

  const tmpPath = path.join(os.tmpdir(), `thai-import-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
  fs.writeFileSync(tmpPath, buf);
  if (fs.existsSync(DATA)) fs.copyFileSync(DATA, BAK);

  const child = spawn('python3', [IMPORT_SCRIPT], {
    env: { ...process.env, TRIP_XLSX: tmpPath },
  });

  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));

  child.on('error', (err) => {
    fs.rmSync(tmpPath, { force: true });
    res.status(500).json({ error: `לא ניתן להריץ python3: ${err.message}` });
  });

  child.on('close', (code) => {
    fs.rmSync(tmpPath, { force: true });
    if (code !== 0) {
      const hint = output.includes('No module named')
        ? '\n\nנראה ש-openpyxl לא מותקן. הרץ: pip install -r scripts/requirements.txt'
        : '';
      return res.status(400).json({ error: output.trim() + hint });
    }
    try {
      const trip = JSON.parse(fs.readFileSync(DATA, 'utf-8'));
      res.json({ ok: true, trip, log: output.trim() });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
});

const PORT = 5174;
app.listen(PORT, () => console.log(`📁 שרת נתונים על http://localhost:${PORT}`));

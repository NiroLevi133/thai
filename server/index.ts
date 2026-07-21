import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const PORT = 5174;
app.listen(PORT, () => console.log(`📁 שרת נתונים על http://localhost:${PORT}`));

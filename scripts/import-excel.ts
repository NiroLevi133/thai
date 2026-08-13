#!/usr/bin/env -S npx tsx
/** ייבוא מהטרמינל — עוטף את server/importExcel.ts (ראה שם את כל הלוגיקה). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importExcelBuffer } from '../server/importExcel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.env.TRIP_XLSX ?? path.join(os.homedir(), 'Downloads', 'מסלול לתאילנד מפורט ביותר!.xlsx');
const OUT = path.join(__dirname, '..', 'data', 'trip.json');

if (!fs.existsSync(SRC)) {
  console.error(`❌ קובץ המקור לא נמצא: ${SRC}`);
  process.exit(1);
}

const result = importExcelBuffer(fs.readFileSync(SRC));
console.log(result.log.join('\n'));

if (!result.ok || !result.trip) {
  console.error('\n❌ הייבוא נכשל באימות:');
  for (const e of result.errors) console.error('   ·', e);
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result.trip, null, 2), 'utf-8');
console.log(`\n✅ נכתב: ${path.relative(process.cwd(), OUT)}`);

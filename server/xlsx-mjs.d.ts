/**
 * ה-build הראשי של xlsx (`xlsx.js`) הוא CJS/UMD ישן בלי `exports` בחבילה, ותחת ה-Node
 * ESM loader האמיתי של Vercel (לא esbuild/tsx) ה-named exports שלו לא מזוהים נכון —
 * זה גרם ל-FUNCTION_INVOCATION_FAILED (קריסה בטעינת המודול, לפני שהקוד שלנו רץ).
 * לכן server/importExcel.ts מייבא ישירות את ה-build האמיתי של ESM (`xlsx/xlsx.mjs`),
 * שאין לו הצהרת טיפוסים משלו — מפנים אותה לטיפוסים הרשמיים של החבילה הראשית.
 */
declare module 'xlsx/xlsx.mjs' {
  export * from 'xlsx';
}

/** Save text as a file in the browser. A .csv opens straight in Excel. */
export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  // The BOM makes Excel read rupee signs and Gujarati/Hindi/Urdu names correctly.
  const blob = new Blob(["﻿" + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

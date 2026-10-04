import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const STYLE = `<style>body{font-family:-apple-system,Roboto,sans-serif;color:#1c2b24;padding:24px}h1{font-size:22px;margin:0 0 4px}
p{margin:4px 0}.m{color:#5b6b63;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
th,td{text-align:left;border-bottom:1px solid #d6ddd9;padding:6px 4px}</style>`;

/** An HTML page for a PDF. `rtl` flips the page for Urdu. */
export const page = (title: string, body: string, rtl = false) =>
  `<html dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>${STYLE}</head><body><h1>${esc(title)}</h1>${body}</body></html>`;

/** Make a PDF from HTML and open the phone's share sheet. On web the browser's print dialog saves it as a PDF. */
export async function sharePdf(html: string, dialogTitle: string) {
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle, UTI: "com.adobe.pdf" });
}

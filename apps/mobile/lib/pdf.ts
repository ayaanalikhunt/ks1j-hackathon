import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

/** Turns a printable HTML page (see receiptHtml / statementHtml in @ks1j/shared) into a PDF file and opens the share sheet. */
export async function sharePdf(html: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error("SHARING_UNAVAILABLE");
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle });
}

import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Noto_Nastaliq_Urdu, Noto_Sans_Devanagari, Noto_Sans_Gujarati, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { themeScript } from "@/components/ThemeToggle";

// Headings: Playfair Display. Body and UI: Atkinson Hyperlegible Next (built for low vision).
// Noto fonts cover Gujarati, Hindi and Urdu; the browser only downloads them when those scripts appear.
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const body = Atkinson_Hyperlegible_Next({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const gujarati = Noto_Sans_Gujarati({ variable: "--font-gu", subsets: ["gujarati"], weight: ["400", "600"], preload: false });
const devanagari = Noto_Sans_Devanagari({ variable: "--font-hi", subsets: ["devanagari"], weight: ["400", "600"], preload: false });
const urdu = Noto_Nastaliq_Urdu({ variable: "--font-ur", subsets: ["arabic"], weight: ["400", "600"], preload: false });

export const metadata: Metadata = {
  title: { default: "KS1J · One Jamaat. One app.", template: "%s · KS1J" },
  description: "Ask for help, pay Khums and Lawajam, support families in need and get answers you can trust. Every case is checked by two committee members.",
  icons: { icon: "/favicon.png", apple: "/apple-icon.png" },
  openGraph: { title: "KS1J", description: "One Jamaat. One app.", images: ["/web-icon.png"] },
  metadataBase: new URL("https://ks1j-8a2e3.web.app"),
};

export const viewport: Viewport = { themeColor: "#0b4d3a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${playfair.variable} ${body.variable} ${gujarati.variable} ${devanagari.variable} ${urdu.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

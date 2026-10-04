import type { Metadata, Viewport } from "next";
import { Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { themeScript } from "@/components/ThemeToggle";

const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["400", "700"] });

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
    <html lang="en" suppressHydrationWarning className={`${playfair.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

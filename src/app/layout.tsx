import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ಒಗ್ಗರಣೆ BOWL — by NG's Cafe",
  description: "ಊಟ ತನ್ನಿಚ್ಛೆ · Fresh Rice Bath & More · NG's Cafe",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="kn">
      <body className={`${geist.className} bg-cream min-h-screen`}>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: { borderRadius: "12px", fontWeight: 600 },
          }}
        />
      </body>
    </html>
  );
}

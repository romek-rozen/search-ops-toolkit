import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Search Ops Toolkit",
  description: "Pobieranie i eksport opinii z wizytówek Google Maps",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className={inter.className}>
      <body className="bg-slate-50 min-h-screen flex font-sans antialiased">
        <Sidebar />
        <main className="flex-1 min-h-screen lg:ml-0">{children}</main>
      </body>
    </html>
  );
}

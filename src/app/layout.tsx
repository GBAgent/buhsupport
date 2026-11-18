import type { Metadata } from "next";
import { Golos_Text, Inter_Tight } from "next/font/google";
import "./globals.css";

const golos = Golos_Text({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"], variable: "--font-golos", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin", "cyrillic"], weight: ["500", "600", "700"], variable: "--font-inter-tight", display: "swap" });

export const metadata: Metadata = {
  title: "ГлавБух Поддержка",
  description: "Кабинет IT-поддержки клиентов ГлавБух",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${golos.variable} ${interTight.variable}`}>
      <body>{children}</body>
    </html>
  );
}

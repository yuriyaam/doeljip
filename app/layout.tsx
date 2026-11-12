import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans_KR({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex",
  fallback: ["Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "될집 — 이 집, 대출 될까?",
  description: "내 조건과 매물을 넣으면 대출별로 되는지, 왜 안 되는지, 매달 얼마인지 보여줘요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={plex.variable}>
      <body>{children}</body>
    </html>
  );
}

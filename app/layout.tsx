import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {width:"device-width",initialScale:1,themeColor:"#7a61c5"};

export const metadata: Metadata = {
  applicationName: "Job Radar",
  manifest: "/manifest.webmanifest",
  appleWebApp: {capable:true,statusBarStyle:"default",title:"Job Radar"},
  title: "Job Radar · Your next move",
  description: "Follow companies. Find your next opportunity.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

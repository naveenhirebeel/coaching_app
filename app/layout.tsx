import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoachingBuddy",
  description: "Attendance management for coaching institutes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}

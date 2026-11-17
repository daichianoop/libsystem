import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hostel–Library Pass & Student Movement System",
  description: "Cloud-Based Hostel–Library Digital Pass and Student Movement Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-whitesmoke antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}

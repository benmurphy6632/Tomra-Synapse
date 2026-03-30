// app/layout.tsx
import "./globals.css";
import { Metadata } from "next";
import { Roboto } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import Starfield from "@/components/Starfield";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tomra-Synapse",
  description: "Model Testing",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Apply Roboto globally here */}
      <body className={`${roboto.className} min-h-screen bg-black text-white`}>
        {/* Background layer (ALWAYS behind everything) */}
        <div className="fixed inset-0 -z-50 pointer-events-none">
          <Starfield />
        </div>

        {/* Foreground app shell */}
        <div className="relative z-10 flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}

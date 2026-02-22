import type { Metadata } from "next";
import { Karla } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Header from "./components/Header";
import Footer from "./components/Footer";

const karla = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
});

const sweetSans = localFont({
  src: [
    {
      path: "../public/fonts/SweetSansPro/fonnts.com-SweetSansProLight.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/SweetSansPro/fonnts.com-SweetSansProRegular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/SweetSansPro/fonnts.com-SweetSansProMedium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/SweetSansPro/fonnts.com-SweetSansProBold.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sweet-sans",
});

const moontime = localFont({
  src: "../public/fonts/Moontime/MoonTime-Regular.otf",
  variable: "--font-moontime",
  weight: "400",
});

export const metadata: Metadata = {
  title: "The Wedding of Arya & Christa",
  description: "December 12, 2026 at The Cape, a Thompson Hotel, by Hyatt",
  openGraph: {
    title: "The Wedding of Arya & Christa",
    description: "December 12, 2026 at The Cape, a Thompson Hotel, by Hyatt",
    images: [
      {
        url: "/sketch.png",
        width: 1200,
        height: 630,
        alt: "The Cape Hotel Sketch",
      },
    ],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${karla.variable} ${sweetSans.variable} ${moontime.variable} font-sans flex flex-col min-h-screen bg-white text-black`}
      >
        <Header />
        <main className="flex-grow flex flex-col items-center w-full">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

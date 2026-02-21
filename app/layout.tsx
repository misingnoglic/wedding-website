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
  title: "Arya & Christa Wedding",
  description: "Wedding of Arya and Christa in Cabo San Lucas, Mexico.",
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
        className={`${karla.variable} ${sweetSans.variable} ${moontime.variable} font-sans flex flex-col min-h-screen bg-white dark:bg-zinc-950`}
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

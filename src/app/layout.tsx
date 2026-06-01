import type { Metadata, Viewport } from "next";
import { Inter, Outfit, Orbitron, Architects_Daughter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { SemesterProvider } from "@/context/SemesterContext";
import { CourseProvider } from "@/context/CourseContext";
import { RoutineProvider } from "@/context/RoutineContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AcademicProvider } from "@/context/AcademicContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
});

const architectsDaughter = Architects_Daughter({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-notebook",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Routine Manager",
  description: "Manage your daily university class schedule with smart notifications",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Routine",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#06080f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${orbitron.variable} ${architectsDaughter.variable}`} data-theme="midnight">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ThemeProvider>
          <AuthProvider>
            <SettingsProvider>
              <SemesterProvider>
                <CourseProvider>
                  <RoutineProvider>
                    <AcademicProvider>{children}</AcademicProvider>
                  </RoutineProvider>
                </CourseProvider>
              </SemesterProvider>
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

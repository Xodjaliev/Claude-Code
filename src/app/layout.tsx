import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { LanguageProvider } from "@/components/providers/LanguageProvider";

const inter = Inter({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://school-37.com"),
  title: {
    default: "School №37 — современная общеобразовательная школа",
    template: "%s · School №37",
  },
  description:
    "School №37 — современное образовательное учреждение: качественное обучение, авторские программы, IT, английский, спорт. Узнайте о поступлении, новостях, учителях и расписании.",
  keywords: [
    "школа",
    "School 37",
    "школа 37",
    "образование",
    "поступление",
    "уроки",
    "учителя",
    "Узбекистан",
  ],
  authors: [{ name: "School №37" }],
  openGraph: {
    title: "School №37 — образование, которое меняет жизнь",
    description:
      "Современная школа, где академическое качество встречается с заботой о каждом ученике.",
    url: "https://school-37.com",
    siteName: "School №37",
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "School №37",
    description: "Современная школа, где академическое качество встречается с заботой о каждом ученике.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#070b18" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const noFlashScript = `
    (function () {
      try {
        var t = localStorage.getItem('school37-theme');
        if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        if (t === 'dark') document.documentElement.classList.add('dark');
        var l = localStorage.getItem('school37-locale');
        if (l === 'ru' || l === 'uz' || l === 'en') document.documentElement.lang = l;
      } catch (e) {}
    })();
  `;

  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className={`${inter.variable} ${poppins.variable} font-sans`}>
        <ThemeProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

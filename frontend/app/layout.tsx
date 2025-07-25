import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { ToastProvider } from "@/components/ui/toast";
import { ErrorBoundaryProvider } from "@/components/providers/error-boundary-provider";
import { AuthHydration } from "@/components/providers/auth-hydration";
import { OfflineBanner } from "@/components/ui/offline-banner";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: {
    default: "AIsReact - Observe AI Reactions to World Events",
    template: "%s | AIsReact",
  },
  description:
    "An open-source platform for observing how different AI models react to real-world news and events submitted by the community.",
  keywords: [
    "AI",
    "artificial intelligence",
    "news analysis",
    "transparency",
    "open source",
  ],
  authors: [{ name: "AIsReact Contributors" }],
  creator: "AIsReact",
  metadataBase: new URL("https://aisreact.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://aisreact.com",
    siteName: "AIsReact",
    title: "AIsReact - Observe AI Reactions to World Events",
    description:
      "An open-source platform for observing how different AI models react to real-world news and events.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AIsReact Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AIsReact - Observe AI Reactions to World Events",
    description:
      "An open-source platform for observing how different AI models react to real-world news and events.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1b26",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <head>
        {/* Resource Hints for Performance */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />

        {/* Fonts are automatically handled by Next.js */}

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme color for mobile browsers */}
        <meta name="theme-color" content="#1a1b26" />

        {/* Important routes are prefetched dynamically */}
      </head>
      <body
        className={`${manrope.className} font-sans min-h-screen antialiased`}
        suppressHydrationWarning
      >
        <AuthHydration>
          <ErrorBoundaryProvider>
            <ToastProvider>
              <QueryProvider>
                <OfflineBanner />
                {children}
              </QueryProvider>
            </ToastProvider>
          </ErrorBoundaryProvider>
        </AuthHydration>
      </body>
    </html>
  );
}

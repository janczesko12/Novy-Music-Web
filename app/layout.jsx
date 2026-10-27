import "./globals.css";

const siteTitle = "Novy Music";
const siteDescription = "Prywatna muzyczna przestrzeń";

export const metadata = {
  metadataBase: new URL("https://music.novydev.pl"),
  title: siteTitle,
  description: siteDescription,
  applicationName: siteTitle,
  icons: {
    icon: [
      { url: "/icon.png", sizes: "180x180", type: "image/png" },
      { url: "/novy-music-mark.webp", sizes: "192x192", type: "image/webp" },
    ],
    shortcut: "/icon.png",
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    title: siteTitle,
    description: siteDescription,
    siteName: siteTitle,
    images: [{ url: "/novy-music-logo.webp", width: 360, height: 360, alt: "Logo Novy Music" }],
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
    images: ["/novy-music-logo.webp"],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return <html lang="pl"><body>{children}</body></html>;
}

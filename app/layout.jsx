import "./globals.css";

export const metadata = {
  title: "Novy Music",
  description: "Prywatna muzyczna przestrzeń",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return <html lang="pl"><body>{children}</body></html>;
}

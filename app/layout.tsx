import type { Metadata, Viewport } from "next";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { QueryBoundary } from "./_components/QueryBoundary";
import { ThemeSync } from "./_components/ThemeSync";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Melos",
  description: "Meet a student who listens like you do, then go hear it live.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The canvas token on the default berkeley theme (design/tokens/tokens.json).
  themeColor: "#060a16",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="berkeley" className={fontVariables}>
      <body>
        <ConvexClientProvider>
          <QueryBoundary>
            <ThemeSync />
            {children}
          </QueryBoundary>
        </ConvexClientProvider>
      </body>
    </html>
  );
}

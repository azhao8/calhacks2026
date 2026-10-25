import localFont from "next/font/local";

// Bricolage Grotesque (display) and Figtree (body), self-hosted from design/assets/fonts with the
// weights, widths and unicode ranges of design/assets/fonts/fonts.css. Each family is two files:
// the latin face is preloaded, and the latin-ext face downloads only when a page shows one of its
// characters, such as the ł in a first name. app/theme.css puts both faces in --font-display and
// --font-body. next/font only accepts literal options, so the unicode ranges are repeated.

const bricolage = localFont({
  src: "../design/assets/fonts/bricolage-grotesque-latin-standard-normal.woff2",
  weight: "200 800",
  variable: "--font-bricolage",
  declarations: [
    { prop: "font-stretch", value: "75% 100%" },
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

const bricolageExt = localFont({
  src: "../design/assets/fonts/bricolage-grotesque-latin-ext-standard-normal.woff2",
  weight: "200 800",
  variable: "--font-bricolage-ext",
  preload: false,
  // This file has no a to z, so it can't size a fallback; the latin face's fallback covers it.
  adjustFontFallback: false,
  declarations: [
    { prop: "font-stretch", value: "75% 100%" },
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

const figtree = localFont({
  src: "../design/assets/fonts/figtree-latin-wght-normal.woff2",
  weight: "300 900",
  variable: "--font-figtree",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

const figtreeExt = localFont({
  src: "../design/assets/fonts/figtree-latin-ext-wght-normal.woff2",
  weight: "300 900",
  variable: "--font-figtree-ext",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

/** Class names that define the four font variables; set on <html>. */
export const fontVariables = [bricolage, bricolageExt, figtree, figtreeExt]
  .map((font) => font.variable)
  .join(" ");

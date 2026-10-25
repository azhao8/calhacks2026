import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export const metadata: Metadata = { title: "Privacy · Melos" };

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-headline text-ink">{title}</h2>
      <div className="flex flex-col gap-2 text-body text-ink-muted">{children}</div>
    </section>
  );
}

// What Melos reads and why (CLAUDE.md §1 Spotify rules, §8.4). Public, plain, on the dark canvas.
export default function PrivacyPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-120 flex-col gap-8 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex min-h-12 items-center">
        <Link href="/" aria-label="Melos home" className="inline-flex min-h-12 items-center">
          <Wordmark />
        </Link>
      </header>
      <main className="flex flex-col gap-6">
        <h1 className="font-display text-title">Privacy</h1>
        <Part title="Your school email">
          <p>We use it to sign you in with a code and to email you when Spotify is ready to connect. A school email shows you&apos;re part of a school; it doesn&apos;t vouch for anyone&apos;s behavior.</p>
        </Part>
        <Part title="What we read from Spotify">
          <p>With your permission we read your top artists, top tracks and liked songs. We only ask for read access to those. We never post for you.</p>
          <p>We turn the names of artists, tracks and genres into a short summary of your taste, which you can correct, and use it to suggest events and to pair you with someone who shares some of it.</p>
          <p>Melos isn&apos;t made by, endorsed by or partnered with Spotify.</p>
        </Part>
        <Part title="Who sees what">
          <p>The person you&apos;re paired with sees your first name and only what you both share. Never your email, year, gender or the rest of your taste. Your year and gender, if you give them, are used only for pairing.</p>
          <p>A phone number or Instagram handle is shared only if you choose to, only with the person from that plan, and you can stop sharing at any time.</p>
        </Part>
        <Part title="Services we use">
          <p>Claude (Anthropic) writes taste summaries and conversation starters from artist, track and genre names. Voyage turns those summaries into numbers for matching. Neither receives your email, phone, Instagram, gender or year.</p>
          <p>Resend sends our emails. Events come from public listings, and map data comes from OpenStreetMap.</p>
        </Part>
        <Part title="Disconnecting">
          <p>You can disconnect Spotify from the menu at any time. When you do, we delete your Spotify data, your taste summary and your taste profile.</p>
        </Part>
        <Part title="Map data">
          <p>
            Map data ©{" "}
            <a href="https://www.openstreetmap.org/copyright" className="font-semibold text-accent underline underline-offset-3">
              OpenStreetMap contributors
            </a>
            .
          </p>
        </Part>
      </main>
    </div>
  );
}

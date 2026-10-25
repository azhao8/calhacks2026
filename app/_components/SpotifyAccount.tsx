import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { ROUTES } from "@/app/_lib/routes";

// The Spotify email we have on file, with Change, which opens About you to fix it. A changed email
// goes back to the app owner as a new request (onboarding.saveAboutYou).
export function SpotifyAccount({ lead, email }: { lead: string; email: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <p className="min-w-0 text-body text-ink wrap-anywhere">
        {lead} <span className="font-semibold">{email}</span>
      </p>
      <Link href={ROUTES.aboutYou} aria-label="Change the Spotify email" className={buttonClasses({ variant: "secondary" })}>
        Change
      </Link>
    </div>
  );
}

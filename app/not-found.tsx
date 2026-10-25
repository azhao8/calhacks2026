import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { StateView } from "@/components/StateView";
import { ROUTES } from "@/app/_lib/routes";
import { Screen } from "@/app/_components/Screen";

export const metadata: Metadata = { title: "Not found · Melos" };

// Any URL Melos doesn't have. Home picks the right screen for whoever is signed in.
export default function NotFound() {
  return (
    <Screen object="radio">
      <StateView kind="empty" icon="music" title="We couldn't find that page" body="The link may be old or mistyped." action={null} className="rounded-lg bg-backdrop-vignette" />
      <Link href={ROUTES.welcome} className={buttonClasses({ block: true })}>
        Go to Melos
      </Link>
    </Screen>
  );
}

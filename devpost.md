## Inspiration
Have you ever found out a classmate likes the same artist as you AFTER the concert? Or skipped a concert because no one would go with you? Music is one of the easiest things for strangers to bond over, but one of the hardest to act on.

Melos starts with the taste profile Spotify already has, and you end up with a plan instead of a feed.

## What it does
Melos pairs two verified Berkeley students who listen to similar music and sends them to a real event together.
- **Sign up:** verify a .edu email with a code, then connect Spotify. Claude summarizes your taste, and you confirm or correct it.
- **Drops:** every so often, a drop opens for the whole campus at once, with a 2 hour countdown. You get 1 to 4 cards, one at a time. Each card shows only the date, time and price. Tap "See more" to see the event, or "Pass forever". You can't go back, and you never know how many cards are left.
- **Commit:** "See more" reveals the event. Accept it, or say "Next time". After the 2 hours, you have 24 hours to accept.
- **Get paired:** when the 24 hours end, everyone who accepted is matched at the same moment, with someone who shares their taste and accepted the same event. Both phones open the match like a present, one tap at a time:
  1. someone's going with you;
  2. an artist you both love;
  3. a song you both have on repeat;
  4. their first name.
- **Go:** the plan is set right away, with a public meeting spot near the venue and the official ticket link. If someone drops out, only their seat reopens, and the other person keeps their plan.

We wanted Melos to feel like an invitation, not a menu. Giving each person a few chances keeps the odds of a match high. Showing them one at a time, with no going back and no way to know whether another is coming, makes each one feel rare and worth a yes.

## How we built it
- **App:** Next.js and Tailwind on Vercel. Convex for the database, live queries, scheduling and vector search.
- **Taste:** Spotify sign in, a Claude taste summary that the student confirms, and Voyage embeddings.
- **Picking events:** once per event, Claude writes a short audience profile (who would enjoy it: the energy, crowd and scene). We embed it in the same space as student tastes. At drop time, each student's cards are pure math: budget, distance and time filters, similarity, variety across kinds of events, and a little randomness. Cost stays flat per event whether there are 40 students or 50,000, and games and performances compete fairly with concerts.
- **Matching:** pair scores from shared artists and vector similarity, then blossom matching per event. Leftover seats get a demo student.
- **Events:** our own Apify actor runs one Claude agent per source and sends events to Convex through a webhook. Strict checks there decide what's published.

## Challenges we ran into
**The pivot:** our original idea read students' Instagram and TikTok feeds, but neither platform lets an app read what you watch, so we pivoted to Spotify.

**Spotify's limit:** Spotify caps new apps at 5 users in Development Mode. So we built an early access queue: students fill in their preferences while we add their account, and Melos emails them the moment they can connect.

**Messy listings:** scraped events repeat and contradict each other. Our first scout run took in 42 events and merged 9 duplicates. We added stricter import checks and looser title matching for the same show.

**A late redesign:** at 5:30 AM we rebuilt the core flow into drops, using four parallel builds, a bug review and a ready rollback, and shipped it before sunrise.

## Accomplishments that we're proud of
- **The moment it works:** two strangers accept the same show in a drop, and at matching both phones open the reveal together: a shared artist, a shared song, then a first name. Plenty of apps recommend concerts. Melos gets two people to the same one.
- **Invitations that feel rare:** there's no feed to scroll. A drop gives you a few cards, one at a time, and "Pass forever" means forever.
- **The whole loop, live:** a .edu code, then Spotify, then Claude's taste summary, then a drop, a pair, and a meeting spot and ticket link. All of it runs on melos.azhao.dev.
- **Guardrails against hallucination:** Event Scout, our Apify actor, uses Claude to find real events. Every price cites the page it came from or reads "Price not listed". Events without an official ticket link, a start time or a mappable venue are rejected. Its first run published 27 of 42 events with no human review.
- **Rebuilt after a pivot:** we dropped our first idea on Saturday afternoon and rebuilt Melos in about 13 hours: over 40 merged pull requests, about 20 screens and 40+ test files.
- **Private by design:** Claude never sees an email, phone number or handle, or any student data when picking events. A partner only ever sees your first name and the music you share.

## What we learned
Where taste data lives decides the product. The apps that know what you watch won't share it, but Spotify sign in put real listening one tap away. That was worth a full pivot.

An agent earns trust through its guardrails, and ours is never allowed to invent a price or a time.

Live state is the demo: Convex keeps every phone in sync, and every seat change is a transaction.

Most of all, trust comes before features. A first name, shared taste and a public meeting spot are what get a stranger to show up.

## What's next for Melos
- **Push notifications** for drops, about once a week at a slightly random time.
- **Group meetups:** go as three or four, not just a pair.
- **More than shows:** museums, record stores and walks, where Melos picks the time.
- **A business model:** referral links on the tickets students already buy, and sponsored events.
- **More schools,** once Berkeley works.

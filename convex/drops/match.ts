import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { isTeamEmail } from "../lib/access";
import { MATCHING, SURPRISE_ME, TIMING } from "../lib/config";
import { maxMatching } from "../matching/blossom";
import { hookItems } from "../matching/names";
import { accepts, cosine, documentFrequency, pairScore, sharedItems, similarYear, type PairScore } from "../matching/taste";
import { canHoldSeat, createSetPlan, eventCutoff, seatsOf } from "../plans/model";

// Drop matching (DECISIONS.md, Oct 25). Per event, the real students (team accounts included) who
// accepted are paired with blossom on the existing pair score and hard rules. A demo student fills
// every leftover seat: one who accepted the same event first, otherwise the best fitting one. A demo
// student is never paired with another. Plans are created already set. Returns the real students matched.

type Member = {
  user: Doc<"users">;
  entry: Doc<"dropEntries">;
  profile: Doc<"tasteProfiles"> | null;
  prefs: Pick<Doc<"preferences">, "meetWho" | "prefersSimilarYear">;
};

const DEFAULT_PREFS = { meetWho: SURPRISE_ME.meetWho, prefersSimilarYear: SURPRISE_ME.prefersSimilarYear } as const;
const EMPTY_FINGERPRINT = { topArtists: [], likedArtists: [], tracks: [], labels: [] };

export async function matchDrop(ctx: MutationCtx, dropId: Id<"drops">): Promise<Id<"users">[]> {
  const real = Date.now();
  const accepted = await ctx.db
    .query("dropEntries")
    .withIndex("by_drop_state", (q) => q.eq("dropId", dropId).eq("state", "accepted"))
    .collect();

  const allProfiles = (await ctx.db.query("tasteProfiles").collect()).filter((p) => p.confirmedAt !== undefined);
  const profiles = new Map(allProfiles.map((p) => [p.userId, p]));
  const frequency = documentFrequency(allProfiles.map((p) => p.fingerprint));
  const students = allProfiles.length;

  async function member(entry: Doc<"dropEntries">): Promise<Member | null> {
    const user = await ctx.db.get(entry.userId);
    // Gone, no longer ready (for example after a Spotify disconnect), or a real student with no
    // confirmed taste: never matched.
    if (user === null || user.onboarding !== "ready") return null;
    if (!user.isDemo && !profiles.has(user._id)) return null;
    const prefs = await ctx.db
      .query("preferences")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    return { user, entry, profile: profiles.get(user._id) ?? null, prefs: prefs ?? DEFAULT_PREFS };
  }

  const recentCache = new Map<Id<"users">, Set<Id<"users">>>();
  async function recentPartners(userId: Id<"users">): Promise<Set<Id<"users">>> {
    const cached = recentCache.get(userId);
    if (cached) return cached;
    const partners = new Set<Id<"users">>();
    const seats = await ctx.db
      .query("meetupMembers")
      .withIndex("by_user_seat", (q) => q.eq("userId", userId))
      .collect();
    for (const seat of seats) {
      if (seat._creationTime < real - TIMING.repeatPairBlockMs) continue;
      for (const other of await seatsOf(ctx.db, seat.meetupId)) if (other.userId !== userId) partners.add(other.userId);
    }
    recentCache.set(userId, partners);
    return partners;
  }

  function score(a: Member, b: Member): PairScore {
    const shared = sharedItems(
      a.profile?.fingerprint ?? EMPTY_FINGERPRINT,
      b.profile?.fingerprint ?? EMPTY_FINGERPRINT,
      frequency,
      students,
    );
    return pairScore({
      similarity: cosine(a.profile?.embedding, b.profile?.embedding),
      shared,
      similarYear: similarYear(
        { year: a.user.year, prefersSimilarYear: a.prefs.prefersSimilarYear },
        { year: b.user.year, prefersSimilarYear: b.prefs.prefersSimilarYear },
      ),
      waitingRuns: 0,
    });
  }

  // The hard rules: who you'd like to meet, both ways; not paired in the last 7 days (two team
  // accounts may pair again, for rehearsals); and at least one real shared item.
  async function evaluate(a: Member, b: Member, requireShared = true): Promise<PairScore | null> {
    if (!accepts(a.prefs.meetWho, b.user.gender) || !accepts(b.prefs.meetWho, a.user.gender)) return null;
    const bothTeam = isTeamEmail(a.user.email) && isTeamEmail(b.user.email) && !a.user.isDemo && !b.user.isDemo;
    if (!bothTeam && (await recentPartners(a.user._id)).has(b.user._id)) return null;
    const result = score(a, b);
    if (requireShared && result.shared.length < MATCHING.minSharedItems) return null;
    return result;
  }

  const byEvent = new Map<Id<"events">, Member[]>();
  const demoMembers: Member[] = [];
  for (const entry of accepted.sort((x, y) => x.userId.localeCompare(y.userId))) {
    const m = entry.eventId === undefined ? null : await member(entry);
    if (m === null) {
      await ctx.db.patch(entry._id, { state: "unmatched", endedAt: real });
      continue;
    }
    if (m.user.isDemo) demoMembers.push(m);
    else byEvent.set(entry.eventId!, [...(byEvent.get(entry.eventId!) ?? []), m]);
  }
  // Demo students in the pool for refills of any event: they hold one seat per event.
  const allDemos = (
    await ctx.db
      .query("users")
      .withIndex("by_demoKey", (q) => q.gt("demoKey", ""))
      .collect()
  ).filter((user) => user.isDemo && user.onboarding === "ready");

  const matchedReal: Id<"users">[] = [];
  const usedEntries = new Set<Id<"dropEntries">>();
  const finish = async (m: Member, meetupId: Id<"meetups"> | null) => {
    usedEntries.add(m.entry._id);
    await ctx.db.patch(
      m.entry._id,
      meetupId === null ? { state: "unmatched", endedAt: real } : { state: "matched", meetupId, endedAt: real },
    );
    if (meetupId !== null && !m.user.isDemo) matchedReal.push(m.user._id);
  };

  for (const [eventId, members] of [...byEvent.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
    const event = await ctx.db.get(eventId);
    const open = event !== null && event.status === "published" && real < eventCutoff(event);
    if (!open) {
      for (const m of members) await finish(m, null);
      continue;
    }
    // 1. Pair real students with blossom.
    const edges: { a: Id<"users">; b: Id<"users">; score: PairScore }[] = [];
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const s = await evaluate(members[i], members[j]);
        if (s !== null) edges.push({ a: members[i].user._id, b: members[j].user._id, score: s });
      }
    }
    const pairs = maxMatching(
      members.map((m) => m.user._id),
      edges.map((edge) => ({ a: edge.a, b: edge.b, score: edge.score.score })),
    );
    const left = new Map(members.map((m) => [m.user._id, m]));
    for (const [aId, bId] of pairs) {
      const a = left.get(aId)!;
      const b = left.get(bId)!;
      const edge = edges.find((e) => (e.a === aId && e.b === bId) || (e.a === bId && e.b === aId))!;
      const items = await hookItems(ctx.db, edge.score.shared, [aId, bId]);
      const meetupId = await createSetPlan(ctx, event, [a.user, b.user], items);
      await finish(a, meetupId);
      await finish(b, meetupId);
      left.delete(aId);
      left.delete(bId);
    }

    // 2. A demo student fills every leftover seat.
    for (const m of [...left.values()]) {
      const sameEvent = demoMembers.filter((d) => d.entry.eventId === eventId && !usedEntries.has(d.entry._id));
      const others: Member[] = [];
      for (const user of allDemos) {
        if (sameEvent.some((d) => d.user._id === user._id)) continue;
        if (!(await canHoldSeat(ctx.db, user, eventId))) continue;
        const prefs = await ctx.db
          .query("preferences")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .unique();
        others.push({ user, entry: m.entry, profile: profiles.get(user._id) ?? null, prefs: prefs ?? DEFAULT_PREFS });
      }
      let best: { demo: Member; score: PairScore } | null = null;
      // Same event first; within a group, prefer a real shared item, then any allowed pair.
      for (const group of [sameEvent, others]) {
        for (const requireShared of [true, false]) {
          for (const demo of group) {
            if (!(await canHoldSeat(ctx.db, demo.user, eventId))) continue;
            const s = await evaluate(m, demo, requireShared);
            if (s !== null && (best === null || s.score > best.score.score)) best = { demo, score: s };
          }
          if (best !== null) break;
        }
        if (best !== null) break;
      }
      if (best === null) {
        await finish(m, null);
        continue;
      }
      const items = await hookItems(ctx.db, best.score.shared, [m.user._id, best.demo.user._id]);
      const meetupId = await createSetPlan(ctx, event, [m.user, best.demo.user], items);
      await finish(m, meetupId);
      // A demo student who accepted this event is matched; one drafted from elsewhere keeps their own entry.
      if (best.demo.entry._id !== m.entry._id) await finish(best.demo, meetupId);
    }
  }
  // Demo students nobody needed.
  for (const d of demoMembers) if (!usedEntries.has(d.entry._id)) await finish(d, null);
  return matchedReal;
}

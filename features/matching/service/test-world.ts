// Shared scaffolding for B's service tests. Test-only, not production code.
//
// acceptSerially, declineSerially and cutoffSerially stand in for the real serialized step on a meetup
// (load snapshot, decide, apply effects). Running them one after another proves the decision logic. It
// does NOT prove the database's locking, so the race tests must be rerun against the transactional service.

import { decideAccept } from './accept.ts'
import type { AcceptOutcome, InvitationRecord, MeetupRecord, MembershipRecord } from './accept.ts'
import { decideCutoff } from './cutoff.ts'
import type { CutoffOutcome } from './cutoff.ts'
import { decideDecline } from './decline.ts'
import type { DeclineOutcome } from './decline.ts'
import { TIMING, cutoffFor, invitationExpiry } from './timing.ts'

export const HOUR = 60 * 60 * 1000
export const START = Date.UTC(2026, 9, 29, 18, 30)
export const ISSUED = START - TIMING.initialLeadMs
export const NOW = START - 11 * HOUR // inside the window: after issue, before expiry and cutoff

export interface Db {
  meetup: MeetupRecord
  invitations: Map<string, InvitationRecord>
  memberships: MembershipRecord[]
  users: Map<string, { universityId: string; otherActiveMeetupIds: string[]; allowedSizes: number[] }>
  cooldowns: Map<string, number>
  replacementRequests: Array<{ meetupId: string; vacatedInvitationId: string }>
  notified: string[]
}

// A meetup with `taken` seats already reserved and one pending invitation per contender.
// Everyone allows groups of 3 or 4 unless a test changes it.
export function world(opts: { target?: number; taken?: number; contenders?: string[] } = {}): Db {
  const { target = 4, taken = 0, contenders = ['alice'] } = opts
  const meetup: MeetupRecord = {
    id: 'm1',
    universityId: 'u1',
    status: 'inviting',
    targetCount: target,
    cutoffAt: cutoffFor(START),
  }
  const db: Db = {
    meetup,
    invitations: new Map(),
    memberships: [],
    users: new Map(),
    cooldowns: new Map(),
    replacementRequests: [],
    notified: [],
  }
  const addUser = (userId: string) =>
    db.users.set(userId, { universityId: 'u1', otherActiveMeetupIds: [], allowedSizes: [3, 4] })

  for (let i = 0; i < taken; i++) {
    const userId = `taken${i}`
    addUser(userId)
    db.invitations.set(`inv-${userId}`, {
      id: `inv-${userId}`, meetupId: 'm1', userId, status: 'accepted',
      issuedAt: ISSUED, expiresAt: invitationExpiry(ISSUED, START),
    })
    db.memberships.push({ meetupId: 'm1', userId, status: 'reserved', acceptedAt: ISSUED + HOUR })
  }
  for (const userId of contenders) {
    addUser(userId)
    db.invitations.set(`inv-${userId}`, {
      id: `inv-${userId}`, meetupId: 'm1', userId, status: 'pending',
      issuedAt: ISSUED, expiresAt: invitationExpiry(ISSUED, START),
    })
  }
  return db
}

export function acceptSerially(db: Db, callerUserId: string | null, invitationId: unknown, now = NOW): AcceptOutcome {
  const invitation = typeof invitationId === 'string' ? db.invitations.get(invitationId) : undefined
  const user = callerUserId ? db.users.get(callerUserId) : undefined
  const outcome = decideAccept({
    callerUserId,
    invitationId,
    now,
    snapshot: {
      invitation,
      meetup: invitation ? db.meetup : undefined,
      meetupMemberships: db.memberships.filter((m) => m.meetupId === db.meetup.id),
      callerUniversityId: user?.universityId,
      callerOtherActiveMeetupIds: user?.otherActiveMeetupIds ?? [],
    },
  })
  if (outcome.ok && outcome.kind === 'reserved') {
    db.invitations.get(outcome.invitationId)!.status = 'accepted'
    db.memberships.push(outcome.membership)
  }
  return outcome
}

export function declineSerially(db: Db, callerUserId: string | null, invitationId: unknown, now = NOW): DeclineOutcome {
  const invitation = typeof invitationId === 'string' ? db.invitations.get(invitationId) : undefined
  const outcome = decideDecline({
    callerUserId,
    invitationId,
    now,
    snapshot: { invitation, meetup: invitation ? db.meetup : undefined },
  })
  if (outcome.ok && outcome.kind === 'declined') {
    db.invitations.get(outcome.invitationId)!.status = outcome.effects.invitationStatus
    db.cooldowns.set(callerUserId!, outcome.effects.cooldownUntil)
    if (outcome.effects.replacementFor) db.replacementRequests.push(outcome.effects.replacementFor)
  }
  return outcome
}

export function cutoffSerially(db: Db, now: number): CutoffOutcome {
  const allowedSizesByUserId: Record<string, number[]> = {}
  for (const [userId, user] of db.users) allowedSizesByUserId[userId] = user.allowedSizes
  const outcome = decideCutoff({
    now,
    snapshot: {
      meetup: db.meetup,
      invitations: [...db.invitations.values()],
      memberships: db.memberships,
      allowedSizesByUserId,
    },
  })
  if (outcome.kind === 'decided') {
    const fx = outcome.effects
    db.meetup.status = fx.meetupStatus
    for (const id of fx.expireInvitationIds) db.invitations.get(id)!.status = 'expired'
    for (const m of db.memberships) {
      if (fx.cancelMembershipUserIds.includes(m.userId)) m.status = 'cancelled'
    }
    db.notified.push(...fx.notifyUserIds)
  }
  return outcome
}

export const seatsHeld = (db: Db) =>
  db.memberships.filter((m) => m.status === 'reserved' || m.status === 'participating').length

export const snapshotOf = (db: Db) =>
  JSON.stringify({
    meetup: db.meetup,
    invitations: [...db.invitations.values()],
    memberships: db.memberships,
    cooldowns: [...db.cooldowns],
    replacementRequests: db.replacementRequests,
    notified: db.notified,
  })

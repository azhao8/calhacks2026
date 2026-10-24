// Run from the repo root with no installs (Node 24 strips the types):
//   node --test 'features/matching/service/*.test.ts'
//
// declineSerially (in test-world.ts) is the serial stand-in for the real serialized step.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { decideDecline } from './decline.ts'
import { HOUR, NOW, START, acceptSerially, declineSerially, seatsHeld, snapshotOf, world } from './test-world.ts'
import { TIMING, cutoffFor } from './timing.ts'

test('"Next time" declines once, starts the cooldown and asks for one replacement', () => {
  const db = world({ target: 4, taken: 3 })
  const out = declineSerially(db, 'alice', 'inv-alice')
  assert.deepEqual(out, {
    ok: true,
    kind: 'declined',
    invitationId: 'inv-alice',
    effects: {
      invitationStatus: 'declined',
      cooldownUntil: NOW + TIMING.declineCooldownMs,
      replacementFor: { meetupId: 'm1', vacatedInvitationId: 'inv-alice' },
    },
  })
  assert.equal(db.invitations.get('inv-alice')!.status, 'declined')
  assert.equal(db.cooldowns.get('alice'), NOW + HOUR)
  assert.deepEqual(db.replacementRequests, [{ meetupId: 'm1', vacatedInvitationId: 'inv-alice' }])
})

test('not signed in is an authentication failure; a malformed id is a validation failure', () => {
  const db = world()
  for (const caller of [null, '']) {
    assert.deepEqual(declineSerially(db, caller, 'inv-alice'), { ok: false, error: { code: 'authentication_failure' } })
  }
  for (const bad of [undefined, null, 42, '', {}]) {
    assert.deepEqual(declineSerially(db, 'alice', bad), { ok: false, error: { code: 'validation_failure' } })
  }
})

test('a missing invitation and someone else\'s invitation get the identical forbidden answer', () => {
  const db = world({ contenders: ['alice', 'bob'] })
  declineSerially(db, 'bob', 'inv-bob') // bob\'s invitation is now declined: must not leak to alice
  const missing = declineSerially(db, 'alice', 'inv-nobody')
  const notMine = declineSerially(db, 'alice', 'inv-bob')
  assert.deepEqual(missing, { ok: false, error: { code: 'forbidden', reason: 'not_your_invitation' } })
  assert.deepEqual(notMine, missing)
})

test('declining twice is idempotent: no second cooldown, no second replacement request', () => {
  const db = world({ target: 4, taken: 3 })
  declineSerially(db, 'alice', 'inv-alice')
  const again = declineSerially(db, 'alice', 'inv-alice', NOW + 30 * 60 * 1000)
  assert.deepEqual(again, { ok: true, kind: 'already_declined', invitationId: 'inv-alice' })
  assert.equal(db.cooldowns.get('alice'), NOW + HOUR) // still the first cooldown
  assert.equal(db.replacementRequests.length, 1)
})

test('a stale "Next time" after an accept changes nothing and points back to the accepted meetup', () => {
  const db = world({ target: 4, taken: 3 })
  acceptSerially(db, 'alice', 'inv-alice')
  const before = snapshotOf(db)
  assert.deepEqual(declineSerially(db, 'alice', 'inv-alice', NOW + 1000), {
    ok: true,
    kind: 'already_accepted',
    invitationId: 'inv-alice',
  })
  assert.equal(snapshotOf(db), before)
  assert.equal(seatsHeld(db), 4)
})

test('nothing left to decline: expired, revoked, expired by the clock, or a meetup no longer inviting', () => {
  const cases: Array<[string, (db: ReturnType<typeof world>) => void, number]> = [
    ['expired', (db) => { db.invitations.get('inv-alice')!.status = 'expired' }, NOW],
    ['revoked', (db) => { db.invitations.get('inv-alice')!.status = 'revoked' }, NOW],
    ['past expiry, sweep not run', () => {}, START - 5 * HOUR],
    ['meetup cancelled', (db) => { db.meetup.status = 'cancelled' }, NOW],
  ]
  for (const [name, mutate, now] of cases) {
    const db = world()
    mutate(db)
    const before = snapshotOf(db)
    assert.deepEqual(declineSerially(db, 'alice', 'inv-alice', now), {
      ok: true,
      kind: 'already_closed',
      invitationId: 'inv-alice',
    }, name)
    assert.equal(snapshotOf(db), before, `${name}: wrote something`)
  }
})

test('past the cutoff a decline is recorded but asks for no replacement', () => {
  const db = world()
  db.invitations.get('inv-alice')!.expiresAt = START // an invitation that outlived the cutoff
  const out = declineSerially(db, 'alice', 'inv-alice', cutoffFor(START))
  assert.equal(out.ok && out.kind, 'declined')
  if (out.ok && out.kind === 'declined') assert.equal(out.effects.replacementFor, null)
  assert.deepEqual(db.replacementRequests, [])
})

test('after declining, the same invitation can no longer be accepted', () => {
  const db = world({ target: 4, taken: 3 })
  declineSerially(db, 'alice', 'inv-alice')
  assert.deepEqual(acceptSerially(db, 'alice', 'inv-alice', NOW + 1000), {
    ok: false,
    error: { code: 'expired_invitation', reason: 'not_pending' },
  })
  assert.equal(seatsHeld(db), 3)
})

test('each vacated invitation produces its own replacement key, so a vacancy is replaced once', () => {
  const db = world({ target: 4, taken: 2, contenders: ['alice', 'bob'] })
  declineSerially(db, 'alice', 'inv-alice')
  declineSerially(db, 'bob', 'inv-bob')
  declineSerially(db, 'alice', 'inv-alice') // replay
  assert.deepEqual(db.replacementRequests.map((r) => r.vacatedInvitationId), ['inv-alice', 'inv-bob'])
})

test('an inconsistent snapshot throws instead of returning a user-facing error', () => {
  const db = world()
  const invitation = db.invitations.get('inv-alice')!
  assert.throws(
    () => decideDecline({ callerUserId: 'alice', invitationId: 'inv-alice', now: NOW, snapshot: { invitation, meetup: undefined } }),
    /meetup does not match/,
  )
  assert.throws(
    () => decideDecline({ callerUserId: 'alice', invitationId: 'inv-other', now: NOW, snapshot: { invitation, meetup: db.meetup } }),
    /does not match the requested id/,
  )
})

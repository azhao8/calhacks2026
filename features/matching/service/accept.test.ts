// Run from the repo root with no installs (Node 24 strips the types):
//   node --test 'features/matching/service/*.test.ts'
//
// acceptSerially (in test-world.ts) stands in for the real serialized step. Serial execution proves the
// decision logic, not the database's locking, so the last-seat test has to be rerun against the real accept.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { HOUR, ISSUED, NOW, START, acceptSerially, seatsHeld, world } from './test-world.ts'
import type { Db } from './test-world.ts'
import { TIMING, cutoffFor, invitationExpiry } from './timing.ts'

test('accept reserves a seat and records the acceptance time', () => {
  const db = world()
  const out = acceptSerially(db, 'alice', 'inv-alice')
  assert.deepEqual(out, {
    ok: true,
    kind: 'reserved',
    invitationId: 'inv-alice',
    membership: { meetupId: 'm1', userId: 'alice', status: 'reserved', acceptedAt: NOW },
  })
  assert.equal(db.invitations.get('inv-alice')!.status, 'accepted')
  assert.equal(seatsHeld(db), 1)
})

test('not signed in is an authentication failure, before anything else is looked at', () => {
  const db = world()
  for (const caller of [null, '']) {
    assert.deepEqual(acceptSerially(db, caller, 'inv-alice'), { ok: false, error: { code: 'authentication_failure' } })
  }
  assert.equal(seatsHeld(db), 0)
})

test('a malformed invitation id is a validation failure', () => {
  const db = world()
  for (const bad of [undefined, null, 42, '', {}]) {
    assert.deepEqual(acceptSerially(db, 'alice', bad), { ok: false, error: { code: 'validation_failure' } })
  }
})

test('a missing invitation and someone else\'s invitation get the identical forbidden answer', () => {
  const db = world({ contenders: ['alice', 'bob'] })
  db.invitations.get('inv-bob')!.status = 'declined' // must not leak through a different error
  const missing = acceptSerially(db, 'alice', 'inv-nobody')
  const notMine = acceptSerially(db, 'alice', 'inv-bob')
  assert.deepEqual(missing, { ok: false, error: { code: 'forbidden', reason: 'not_your_invitation' } })
  assert.deepEqual(notMine, missing)
})

test('accepting twice is idempotent: same membership, no second seat', () => {
  const db = world()
  const first = acceptSerially(db, 'alice', 'inv-alice')
  const second = acceptSerially(db, 'alice', 'inv-alice', NOW + HOUR)
  assert.equal(first.ok && first.kind, 'reserved')
  assert.equal(second.ok && second.kind, 'already_accepted')
  if (first.ok && second.ok) assert.deepEqual(second.membership, first.membership)
  assert.equal(seatsHeld(db), 1)
})

test('an accepted invitation whose membership was cancelled cannot be accepted again', () => {
  const db = world()
  acceptSerially(db, 'alice', 'inv-alice')
  db.memberships[0]!.status = 'cancelled'
  assert.deepEqual(acceptSerially(db, 'alice', 'inv-alice'), {
    ok: false,
    error: { code: 'expired_invitation', reason: 'membership_not_active' },
  })
})

for (const status of ['declined', 'expired', 'revoked'] as const) {
  test(`invitation status "${status}" cannot be accepted`, () => {
    const db = world()
    db.invitations.get('inv-alice')!.status = status
    assert.deepEqual(acceptSerially(db, 'alice', 'inv-alice'), {
      ok: false,
      error: { code: 'expired_invitation', reason: 'not_pending' },
    })
    assert.equal(seatsHeld(db), 0)
  })
}

test('expiry boundary is exclusive and holds even if no sweep has flipped the status', () => {
  const expiresAt = invitationExpiry(ISSUED, START)
  assert.equal(expiresAt, ISSUED + TIMING.pendingTtlMs) // 6 h after issue beats the cutoff here

  const justBefore = world()
  assert.equal(acceptSerially(justBefore, 'alice', 'inv-alice', expiresAt - 1).ok, true)

  for (const now of [expiresAt, expiresAt + 1]) {
    const db = world()
    assert.equal(db.invitations.get('inv-alice')!.status, 'pending') // sweep has not run
    assert.deepEqual(acceptSerially(db, 'alice', 'inv-alice', now), {
      ok: false,
      error: { code: 'expired_invitation', reason: 'past_expiry' },
    })
    assert.equal(seatsHeld(db), 0)
  }
})

test('expiry is the earlier of issue + 6 h and the cutoff', () => {
  assert.equal(invitationExpiry(ISSUED, START), ISSUED + 6 * HOUR)
  const late = START - 3 * HOUR // issued 3 h before the start: the 2 h cutoff comes first
  assert.equal(invitationExpiry(late, START), cutoffFor(START))
})

test('a meetup that is no longer inviting rejects the accept', () => {
  for (const status of ['preparing', 'confirmed', 'active', 'completed', 'cancelled'] as const) {
    const db = world()
    db.meetup.status = status
    assert.deepEqual(acceptSerially(db, 'alice', 'inv-alice'), {
      ok: false,
      error: { code: 'expired_invitation', reason: 'meetup_closed' },
    })
  }
})

test('the cutoff is a hard stop even for an invitation that outlived it', () => {
  const outlived = () => {
    const db = world()
    db.invitations.get('inv-alice')!.expiresAt = START // a stale or hand-edited expiry past the cutoff
    return db
  }
  const cutoff = cutoffFor(START)
  assert.equal(acceptSerially(outlived(), 'alice', 'inv-alice', cutoff - 1).ok, true)
  assert.deepEqual(acceptSerially(outlived(), 'alice', 'inv-alice', cutoff), {
    ok: false,
    error: { code: 'expired_invitation', reason: 'past_cutoff' },
  })
})

test('a full meetup has no seat; cancelled members free theirs', () => {
  const full = world({ target: 4, taken: 4 })
  assert.deepEqual(acceptSerially(full, 'alice', 'inv-alice'), { ok: false, error: { code: 'unavailable_seat' } })

  const oneCancelled = world({ target: 4, taken: 4 })
  oneCancelled.memberships[0]!.status = 'cancelled'
  assert.equal(acceptSerially(oneCancelled, 'alice', 'inv-alice').ok, true)
})

test('last seat: of many simultaneous accepts exactly one wins and the meetup never overfills', () => {
  const contenders = Array.from({ length: 10 }, (_, i) => `user${i}`)
  const db = world({ target: 4, taken: 3, contenders })
  const outcomes = contenders.map((u) => acceptSerially(db, u, `inv-${u}`))

  const winners = outcomes.filter((o) => o.ok)
  const losers = outcomes.filter((o) => !o.ok)
  assert.equal(winners.length, 1)
  assert.equal(losers.length, 9)
  for (const o of losers) assert.deepEqual(o, { ok: false, error: { code: 'unavailable_seat' } })
  assert.equal(seatsHeld(db), 4)

  // The losers' offers stay pending; nothing was written for them.
  assert.equal([...db.invitations.values()].filter((i) => i.status === 'pending').length, 9)
})

test('wrong university and an overlapping active meetup are rejected for the service to log', () => {
  const otherCampus = world()
  otherCampus.users.get('alice')!.universityId = 'u2'
  assert.deepEqual(acceptSerially(otherCampus, 'alice', 'inv-alice'), {
    ok: false,
    error: { code: 'forbidden', reason: 'wrong_university' },
  })

  const busy = world()
  busy.users.get('alice')!.otherActiveMeetupIds = ['m9']
  assert.deepEqual(acceptSerially(busy, 'alice', 'inv-alice'), {
    ok: false,
    error: { code: 'forbidden', reason: 'conflicting_meetup' },
  })
})

test('an inconsistent snapshot throws instead of returning a user-facing error', () => {
  const dup = world()
  dup.memberships.push({ meetupId: 'm1', userId: 'alice', status: 'cancelled', acceptedAt: ISSUED })
  assert.throws(() => acceptSerially(dup, 'alice', 'inv-alice'), /already has a membership row/)

  const wrongMeetup = world()
  wrongMeetup.invitations.get('inv-alice')!.meetupId = 'm2'
  assert.throws(() => acceptSerially(wrongMeetup, 'alice', 'inv-alice'), /meetup does not match/)
})

test('every rejection writes nothing', () => {
  const scenarios: Array<[string, (db: Db) => void]> = [
    ['declined', (db) => { db.invitations.get('inv-alice')!.status = 'declined' }],
    ['expired by clock', () => {}],
    ['meetup cancelled', (db) => { db.meetup.status = 'cancelled' }],
  ]
  for (const [name, mutate] of scenarios) {
    const db = world()
    mutate(db)
    const before = JSON.stringify([...db.invitations.values()]) + JSON.stringify(db.memberships)
    const out = acceptSerially(db, 'alice', 'inv-alice', name === 'expired by clock' ? START : NOW)
    assert.equal(out.ok, false, name)
    assert.equal(JSON.stringify([...db.invitations.values()]) + JSON.stringify(db.memberships), before, name)
  }
})

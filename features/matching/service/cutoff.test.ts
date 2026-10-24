// Run from the repo root with no installs (Node 24 strips the types):
//   node --test 'features/matching/service/*.test.ts'
//
// cutoffSerially (in test-world.ts) is the serial stand-in for the real serialized step.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { decideCutoff, isCompatibleGroupSize } from './cutoff.ts'
import { HOUR, START, acceptSerially, cutoffSerially, declineSerially, seatsHeld, snapshotOf, world } from './test-world.ts'
import { cutoffFor } from './timing.ts'

const CUTOFF = cutoffFor(START)

test('the job is not due before the cutoff and runs at the cutoff instant', () => {
  const db = world({ target: 4, taken: 4 })
  const before = snapshotOf(db)
  assert.deepEqual(cutoffSerially(db, CUTOFF - 1), { kind: 'not_due' })
  assert.equal(snapshotOf(db), before)
  assert.equal(cutoffSerially(db, CUTOFF).kind, 'decided')
})

test('a full group is confirmed and leftover offers expire', () => {
  const db = world({ target: 4, taken: 4, contenders: ['p1', 'p2'] })
  const out = cutoffSerially(db, CUTOFF)
  assert.deepEqual(out, {
    kind: 'decided',
    effects: {
      meetupStatus: 'confirmed',
      confirmedCount: 4,
      expireInvitationIds: ['inv-p1', 'inv-p2'],
      cancelMembershipUserIds: [],
      notifyUserIds: [],
    },
  })
  assert.equal(db.meetup.status, 'confirmed')
  assert.equal(db.invitations.get('inv-p1')!.status, 'expired')
  assert.equal(seatsHeld(db), 4)
})

test('a smaller group is confirmed when its real size suits every accepted member', () => {
  const three = world({ target: 4, taken: 3 }) // everyone allows 3 or 4
  const out = cutoffSerially(three, CUTOFF)
  assert.equal(out.kind === 'decided' && out.effects.meetupStatus, 'confirmed')
  assert.equal(out.kind === 'decided' && out.effects.confirmedCount, 3)

  const two = world({ target: 4, taken: 2 })
  for (const u of two.users.values()) u.allowedSizes = [2, 3, 4]
  assert.equal(cutoffSerially(two, CUTOFF).kind === 'decided' && two.meetup.status, 'confirmed')
})

test('a smaller group is cancelled when one accepted member does not allow that size', () => {
  const db = world({ target: 4, taken: 3, contenders: ['p1'] })
  db.users.get('taken0')!.allowedSizes = [4]
  const out = cutoffSerially(db, CUTOFF)
  assert.deepEqual(out, {
    kind: 'decided',
    effects: {
      meetupStatus: 'cancelled',
      confirmedCount: 3,
      expireInvitationIds: ['inv-p1'],
      cancelMembershipUserIds: ['taken0', 'taken1', 'taken2'],
      notifyUserIds: ['taken0', 'taken1', 'taken2'],
    },
  })
  assert.equal(db.meetup.status, 'cancelled')
  assert.equal(seatsHeld(db), 0)
  assert.deepEqual(db.notified, ['taken0', 'taken1', 'taken2'])
})

test('a group below 2 is never compatible, even if someone\'s stored sizes include 1', () => {
  assert.equal(isCompatibleGroupSize(1, [[1, 2, 3]]), false)
  assert.equal(isCompatibleGroupSize(2, [[2, 3], [2]]), true)
  assert.equal(isCompatibleGroupSize(3, [[2, 3], [2]]), false)

  const one = world({ target: 4, taken: 1 })
  one.users.get('taken0')!.allowedSizes = [1, 2, 3, 4]
  const out = cutoffSerially(one, CUTOFF)
  assert.equal(out.kind === 'decided' && out.effects.meetupStatus, 'cancelled')

  const none = world({ target: 4, taken: 0, contenders: ['p1'] })
  const empty = cutoffSerially(none, CUTOFF)
  assert.equal(empty.kind === 'decided' && empty.effects.meetupStatus, 'cancelled')
  assert.deepEqual(none.notified, []) // nobody accepted, nobody to tell
})

test('running the job again changes nothing', () => {
  for (const taken of [4, 3, 1]) {
    const db = world({ target: 4, taken })
    const first = cutoffSerially(db, CUTOFF)
    assert.equal(first.kind, 'decided')
    const after = snapshotOf(db)
    const second = cutoffSerially(db, CUTOFF + 60_000)
    assert.deepEqual(second, { kind: 'already_decided', meetupStatus: db.meetup.status })
    assert.equal(snapshotOf(db), after)
  }
})

test('a meetup that is not inviting is left alone', () => {
  for (const status of ['preparing', 'confirmed', 'active', 'completed', 'cancelled'] as const) {
    const db = world({ target: 4, taken: 4 })
    db.meetup.status = status
    const before = snapshotOf(db)
    assert.deepEqual(cutoffSerially(db, CUTOFF + HOUR), { kind: 'already_decided', meetupStatus: status })
    assert.equal(snapshotOf(db), before)
  }
})

test('after the job, an offer that outlived the cutoff can no longer be accepted', () => {
  const db = world({ target: 4, taken: 3 })
  db.invitations.get('inv-alice')!.expiresAt = START // stale expiry past the cutoff
  cutoffSerially(db, CUTOFF)
  assert.deepEqual(acceptSerially(db, 'alice', 'inv-alice', CUTOFF), {
    ok: false,
    error: { code: 'expired_invitation', reason: 'not_pending' },
  })
  assert.equal(seatsHeld(db), 3)
})

test('a declined seat is not counted: decline, then cutoff, confirms the smaller compatible group', () => {
  const db = world({ target: 4, taken: 3 })
  declineSerially(db, 'alice', 'inv-alice')
  const out = cutoffSerially(db, CUTOFF)
  assert.equal(out.kind === 'decided' && out.effects.meetupStatus, 'confirmed')
  assert.equal(db.replacementRequests.length, 1) // asked for before the cutoff, found nobody
})

test('inconsistent data throws so the job can be retried or investigated', () => {
  const overfull = world({ target: 4, taken: 5 })
  assert.throws(() => cutoffSerially(overfull, CUTOFF), /more seats held than the target/)

  const missingSizes = world({ target: 4, taken: 3 })
  missingSizes.users.delete('taken1')
  assert.throws(() => cutoffSerially(missingSizes, CUTOFF), /no allowed group sizes loaded for member taken1/)

  assert.throws(
    () => decideCutoff({ now: CUTOFF, snapshot: { meetup: undefined, invitations: [], memberships: [], allowedSizesByUserId: {} } }),
    /no meetup/,
  )
})

// Pure accept decision for S08 -> S09. No I/O and no clock reads.
//
// The service loads an AcceptSnapshot and calls decideAccept inside ONE serialized step (a
// transaction with a row lock on the meetup, or a compare-and-set), then applies the returned
// effects in that same step. Atomicity comes from that step, not from this function.
// Check order and error mapping: invitation-reservation-rules.md, "Accept".
//
// Types are local to B until the foundation's schemas land. Timestamps are UTC epoch ms.

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked'
export type MeetupStatus = 'preparing' | 'inviting' | 'confirmed' | 'active' | 'completed' | 'cancelled'
export type MembershipStatus = 'reserved' | 'cancelled' | 'participating' | 'finished' | 'left'

export interface InvitationRecord {
  id: string
  meetupId: string
  userId: string
  status: InvitationStatus
  issuedAt: number
  expiresAt: number
}

export interface MeetupRecord {
  id: string
  universityId: string
  status: MeetupStatus
  targetCount: number
  cutoffAt: number
}

export interface MembershipRecord {
  meetupId: string
  userId: string
  status: MembershipStatus
  acceptedAt: number
}

export interface AcceptSnapshot {
  invitation: InvitationRecord | undefined
  meetup: MeetupRecord | undefined
  // Every membership row of the invitation's meetup, any status.
  meetupMemberships: MembershipRecord[]
  // The caller's university from the server-verified user record.
  callerUniversityId: string | undefined
  // Meetups other than this one where the caller is reserved or participating and the meetup is not completed.
  callerOtherActiveMeetupIds: string[]
}

export interface AcceptInput {
  // From the authenticated session, never from the request body. Null or empty means not signed in.
  callerUserId: string | null
  invitationId: unknown
  now: number
  snapshot: AcceptSnapshot
}

// `reason` is for logs and UI copy. For `forbidden` it must never reach the client:
// a missing invitation and someone else's invitation have to look identical.
export type AcceptError =
  | { code: 'authentication_failure' }
  | { code: 'validation_failure' }
  | { code: 'forbidden'; reason: 'not_your_invitation' | 'wrong_university' | 'conflicting_meetup' }
  | {
      code: 'expired_invitation'
      reason: 'not_pending' | 'past_expiry' | 'meetup_closed' | 'past_cutoff' | 'membership_not_active'
    }
  | { code: 'unavailable_seat' }

export type AcceptOutcome =
  // Apply together: invitation -> 'accepted', insert `membership`.
  | { ok: true; kind: 'reserved'; invitationId: string; membership: MembershipRecord }
  // Replay of an accept that already succeeded. Nothing to write.
  | { ok: true; kind: 'already_accepted'; invitationId: string; membership: MembershipRecord }
  | { ok: false; error: AcceptError }

const fail = (error: AcceptError): AcceptOutcome => ({ ok: false, error })

const holdsSeat = (m: MembershipRecord) => m.status === 'reserved' || m.status === 'participating'

export function decideAccept(input: AcceptInput): AcceptOutcome {
  const { callerUserId, invitationId, now, snapshot } = input
  const { invitation, meetup, meetupMemberships } = snapshot

  if (!callerUserId) return fail({ code: 'authentication_failure' })
  if (typeof invitationId !== 'string' || invitationId === '') return fail({ code: 'validation_failure' })

  if (!invitation || invitation.userId !== callerUserId) {
    return fail({ code: 'forbidden', reason: 'not_your_invitation' })
  }

  // From here on the snapshot must be consistent. A mismatch is a bug in the loader, not a user error.
  if (invitation.id !== invitationId) throw new Error('snapshot invitation does not match the requested id')
  if (!meetup || meetup.id !== invitation.meetupId) throw new Error('snapshot meetup does not match the invitation')

  const mine = meetupMemberships.find((m) => m.userId === callerUserId)

  if (invitation.status === 'accepted') {
    if (mine && holdsSeat(mine)) {
      return { ok: true, kind: 'already_accepted', invitationId: invitation.id, membership: mine }
    }
    return fail({ code: 'expired_invitation', reason: 'membership_not_active' })
  }
  if (invitation.status !== 'pending') return fail({ code: 'expired_invitation', reason: 'not_pending' })

  // A pending invitation never coexists with a membership row for the same person (one row per meetup and user).
  if (mine) throw new Error('pending invitation but the caller already has a membership row for this meetup')

  // Time is checked against the clock, so an invitation that expired but has not been swept cannot be accepted.
  // The boundary is exclusive: at the exact expiry or cutoff instant the offer is gone.
  if (now >= invitation.expiresAt) return fail({ code: 'expired_invitation', reason: 'past_expiry' })
  if (meetup.status !== 'inviting') return fail({ code: 'expired_invitation', reason: 'meetup_closed' })
  if (now >= meetup.cutoffAt) return fail({ code: 'expired_invitation', reason: 'past_cutoff' })

  if (meetupMemberships.filter(holdsSeat).length >= meetup.targetCount) return fail({ code: 'unavailable_seat' })

  // These two cannot fail by construction (one pending invitation and one active meetup at a time).
  // A failure means a bug upstream, so reject it and let the service log the reason.
  if (snapshot.callerUniversityId !== meetup.universityId) {
    return fail({ code: 'forbidden', reason: 'wrong_university' })
  }
  if (snapshot.callerOtherActiveMeetupIds.length > 0) {
    return fail({ code: 'forbidden', reason: 'conflicting_meetup' })
  }

  return {
    ok: true,
    kind: 'reserved',
    invitationId: invitation.id,
    membership: { meetupId: meetup.id, userId: callerUserId, status: 'reserved', acceptedAt: now },
  }
}

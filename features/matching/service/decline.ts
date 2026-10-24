// Pure decision for "Next time" on S08. No I/O and no clock reads.
//
// Same arrangement as accept.ts: the service loads a snapshot and applies the returned effects in one
// serialized step on the meetup. Outcomes by invitation state: invitation-reservation-rules.md, "Decline".

import type { InvitationRecord, MeetupRecord } from './accept.ts'
import { TIMING } from './timing.ts'

export interface DeclineSnapshot {
  invitation: InvitationRecord | undefined
  meetup: MeetupRecord | undefined
}

export interface DeclineInput {
  // From the authenticated session, never from the request body. Null or empty means not signed in.
  callerUserId: string | null
  invitationId: unknown
  now: number
  snapshot: DeclineSnapshot
}

export type DeclineError =
  | { code: 'authentication_failure' }
  | { code: 'validation_failure' }
  // A missing invitation and someone else's invitation look identical. `reason` is for logs only.
  | { code: 'forbidden'; reason: 'not_your_invitation' }

export type DeclineOutcome =
  | {
      ok: true
      kind: 'declined'
      invitationId: string
      // Apply together: invitation -> 'declined', record the cooldown, and queue the replacement if present.
      effects: {
        invitationStatus: 'declined'
        // The user gets no invitation to another meetup before this instant.
        cooldownUntil: number
        // Keyed on the vacated invitation, so one vacancy yields one replacement attempt.
        // Null once the cutoff has passed: no new people join a journey that is about to start.
        replacementFor: { meetupId: string; vacatedInvitationId: string } | null
      }
    }
  // Nothing to write. The UI goes to S07, except `already_accepted`, which opens S09.
  | { ok: true; kind: 'already_declined' | 'already_accepted' | 'already_closed'; invitationId: string }
  | { ok: false; error: DeclineError }

const fail = (error: DeclineError): DeclineOutcome => ({ ok: false, error })

export function decideDecline(input: DeclineInput): DeclineOutcome {
  const { callerUserId, invitationId, now, snapshot } = input
  const { invitation, meetup } = snapshot

  if (!callerUserId) return fail({ code: 'authentication_failure' })
  if (typeof invitationId !== 'string' || invitationId === '') return fail({ code: 'validation_failure' })

  if (!invitation || invitation.userId !== callerUserId) {
    return fail({ code: 'forbidden', reason: 'not_your_invitation' })
  }

  if (invitation.id !== invitationId) throw new Error('snapshot invitation does not match the requested id')
  if (!meetup || meetup.id !== invitation.meetupId) throw new Error('snapshot meetup does not match the invitation')

  if (invitation.status === 'declined') return { ok: true, kind: 'already_declined', invitationId: invitation.id }
  // A stale "Next time" after an accept changes nothing. Leaving is a deliberate cancel on S09.
  if (invitation.status === 'accepted') return { ok: true, kind: 'already_accepted', invitationId: invitation.id }

  // Expired, revoked, expired by the clock before any sweep, or a meetup that is no longer taking replies:
  // there is nothing left to decline, and the person did nothing that earns a cooldown.
  const closed =
    invitation.status !== 'pending' || now >= invitation.expiresAt || meetup.status !== 'inviting'
  if (closed) return { ok: true, kind: 'already_closed', invitationId: invitation.id }

  return {
    ok: true,
    kind: 'declined',
    invitationId: invitation.id,
    effects: {
      invitationStatus: 'declined',
      cooldownUntil: now + TIMING.declineCooldownMs,
      replacementFor:
        now < meetup.cutoffAt ? { meetupId: meetup.id, vacatedInvitationId: invitation.id } : null,
    },
  }
}

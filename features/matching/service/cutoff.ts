// Pure decision for the reservation cutoff job. No I/O and no clock reads.
//
// The job runs once per meetup, keyed on the meetup id. It only ever acts on a meetup that is still
// `inviting`, so a second or concurrent run decides nothing. The service applies the returned effects
// in the same serialized step on the meetup as accept and decline. Rules: invitation-reservation-rules.md,
// "Cutoff job".

import { holdsSeat } from './accept.ts'
import type { InvitationRecord, MeetupRecord, MeetupStatus, MembershipRecord } from './accept.ts'

// Group sizes are 2-6 and include the user (S06), so a group below 2 is never compatible.
export const MIN_GROUP_SIZE = 2

// `memberAllowedSizes` holds one array of allowed sizes per accepted member.
export function isCompatibleGroupSize(count: number, memberAllowedSizes: number[][]): boolean {
  return count >= MIN_GROUP_SIZE && memberAllowedSizes.every((sizes) => sizes.includes(count))
}

export interface CutoffSnapshot {
  meetup: MeetupRecord | undefined
  // Every invitation and membership row of this meetup, any status.
  invitations: InvitationRecord[]
  memberships: MembershipRecord[]
  // Allowed group sizes for each member who holds a seat, from A's restricted matching view.
  allowedSizesByUserId: Record<string, number[]>
}

export interface CutoffInput {
  now: number
  snapshot: CutoffSnapshot
}

export interface CutoffEffects {
  meetupStatus: 'confirmed' | 'cancelled'
  confirmedCount: number
  // Pending offers all end at the cutoff, so they become `expired` (not `revoked`).
  expireInvitationIds: string[]
  // Empty unless the meetup is cancelled.
  cancelMembershipUserIds: string[]
  // Accepted members to tell when the meetup is cancelled. Copy and channel are open (rules note, question 6).
  notifyUserIds: string[]
}

export type CutoffOutcome =
  | { kind: 'not_due' }
  | { kind: 'already_decided'; meetupStatus: MeetupStatus }
  | { kind: 'decided'; effects: CutoffEffects }

export function decideCutoff(input: CutoffInput): CutoffOutcome {
  const { now, snapshot } = input
  const { meetup } = snapshot

  if (!meetup) throw new Error('snapshot has no meetup')
  if (meetup.status !== 'inviting') return { kind: 'already_decided', meetupStatus: meetup.status }
  if (now < meetup.cutoffAt) return { kind: 'not_due' }

  const members = snapshot.memberships.filter((m) => m.meetupId === meetup.id && holdsSeat(m))
  const count = members.length
  if (count > meetup.targetCount) throw new Error('more seats held than the target count')

  const memberAllowedSizes = members.map((m) => {
    const sizes = snapshot.allowedSizesByUserId[m.userId]
    if (!sizes) throw new Error(`no allowed group sizes loaded for member ${m.userId}`)
    return sizes
  })

  // A full group is confirmed as is. A smaller one only if its real size suits every accepted member.
  const confirmed = count === meetup.targetCount || isCompatibleGroupSize(count, memberAllowedSizes)

  const memberIds = members.map((m) => m.userId).sort()
  return {
    kind: 'decided',
    effects: {
      meetupStatus: confirmed ? 'confirmed' : 'cancelled',
      confirmedCount: count,
      expireInvitationIds: snapshot.invitations
        .filter((i) => i.meetupId === meetup.id && i.status === 'pending')
        .map((i) => i.id)
        .sort(),
      cancelMembershipUserIds: confirmed ? [] : memberIds,
      notifyUserIds: confirmed ? [] : memberIds,
    },
  }
}

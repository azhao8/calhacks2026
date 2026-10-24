# Decision log

Append-only shared decision record for `CLAUDE.md`. Add new entries at the bottom; never edit or delete earlier ones. A later entry supersedes an earlier one. Git merges this file with the union strategy (see `.gitattributes`), so parallel appends don't conflict.

Entry format:

```
## YYYY-MM-DD HH:MM PT · <who> · <short title>
- Changed: <what is now true>
- Why: <reason>
- Replaces: BASELINE | CONFIRMED | OPEN | new — <which item>
- Affects: <screens (S01–S15), entities, operations, workstreams>
```

## 2026-10-24 04:30 PT · azhao8 · Adopt CLAUDE.md v1 as the source of truth
- Changed: `CLAUDE.md` v1 (mystery small-group meetups for verified students) is the canonical spec for the Cal Hacks 13 build.
- Why: one shared product definition for all teammates and Claude sessions.
- Replaces: new — supersedes the original pitch (two-person matching, fully packaged plans, tickets, calendar invites, public plan library, reviews), now deferred per CLAUDE.md §2.
- Affects: everything.

## 2026-10-24 05:18 PT · grant-j-kim · Claim: workstream A
- Changed: Claim: grant-j-kim takes workstream A — Understand the student; owned files: `features/profile/ui`, `features/profile/service`
- Why: one writer per workstream, per CLAUDE.md §9.
- Replaces: new — workstream A ownership
- Affects: S01–S06 and A's S15 subsections; User, AnalysisJob, InterestProfile, MeetupPreferences; workstream A

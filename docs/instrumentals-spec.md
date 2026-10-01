# Instrumental Library — Spec (draft)

Shared instrumentals for music bouts (rap, dance, singing). Both opponents perform to the **same** track.

## Decisions (from product owner)
- **Who uploads at launch:** staff and organizers. Producers submit tracks to staff for approval.
- **Producer report:** staff can generate a usage report for any producer (model on `/admin/sponsors/[id]/report`).
- **Performers:** may record in the app over the track, or download the track and upload their own video.
- **In-app recording requires headphones.** A clear message is shown when the track option is chosen.
- **Goal:** attract beat producers and convert them into organizers.

## Roles
| Role | Can do |
|---|---|
| Staff | Upload, approve/reject/remove any track, generate producer reports |
| Organizer | Upload tracks for their own events, attach any approved track to their bouts |
| Producer | Submit tracks for staff review; has a public producer page once approved |
| Performer | Download the track, or record in-app over it |

## Data model
See `docs/sql/instrumentals_phase1.sql`.
- `instrumentals`: title, producer_name, producer_id (nullable), file_url, bpm, musical_key, genre, duration_seconds, license_type (`original` | `royalty_free` | `licensed_to_boutcasts`), license_source_url, status (`pending` | `approved` | `rejected` | `removed`), uploaded_by, created_at.
- `bouts.instrumental_id` (nullable FK). Locked once the bout is live (enforced in the picker UI in phase 1; add a DB trigger in phase 2).

## Licensing terms (shown to every uploader)
Non-exclusive license for BoutCasts to host the track and let performers use it in battles, with the producer credited on the bout page. A takedown path uses the existing "Copyright issue" report reason. No ripped or copyrighted beats.

## In-app recording (phase 3)
- Show: "Headphones required. Without them the beat will bleed into your microphone." plus a confirmation checkbox. Browsers cannot reliably detect headphones, so this is a message, not a hard block.
- Mix the beat and the microphone in the browser (Web Audio API) so the saved clip contains both and stays in sync for voters.
- Uploaded videos are trusted at launch; moderators spot-check and viewers can report a mismatch.

## Producer to organizer funnel
- Producer page: credit, play count, bouts using the track, **Host a beat battle** button.
- Producer report: bouts that used their tracks, performers entered, total votes, top bouts, shares. Doubles as the pitch to become an organizer (ties into the existing organizer license / Pro offerings).

## Phases
1. **Phase 1 (this patch):** staff/organizer upload, approve-by-default for staff, attach a track to a bout, play and download it on the bout page.
2. Library search, producer submissions into the moderation queue, producer pages, credit, producer report.
3. In-app recording over the track with headphone message and browser-side mix.

## Open items
- Run the SQL migration in Supabase and create the `instrumentals` storage bucket (public read).
- Confirm how organizers are identified in RLS (the SQL assumes `categories.owner_id` marks organizer-run categories).

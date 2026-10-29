# Paid Bouts — questions for an attorney

This is a plain-language summary to take to a lawyer. It is not legal advice, and nothing here has been reviewed by counsel.

## What the product does (as built)
- An organizer creates a competition with an **entry fee** ($5–$500), published rules, a published judging method, a minimum and optional maximum number of entries, and an entry deadline.
- Prizes are **fixed amounts set before the bout opens**, paid in a fixed order. A bout opens only if prizes are fully covered at the minimum number of entries; otherwise it is cancelled and every entrant is **refunded in full**.
- BoutCasts keeps a **platform fee (20% of all entry fees)**. The organizer gets what remains after the fee and all prizes.
- Entrants pay by card (Stripe). Winners are decided by the published judging (judges and/or crowd vote).
- Admin review (`pending_review`) happens before a bout opens.

## Questions to ask
1. **Skill vs. chance.** Does a paid, judged performance competition (rap, dance, singing, roast) qualify as a game of skill in each state we operate? Does a crowd-vote component change that?
2. **Prize/consideration/chance (lottery test).** Is any element (random tie-breaks, crowd voting that can be influenced by purchasing votes) at risk of being "chance"? Do Super Votes or other paid votes in the same product affect this?
3. **State-by-state limits.** Are there states where entry-fee contests, or contests with minors, must be excluded or registered/bonded (e.g. for large prize pools)? What geo-blocking or eligibility terms do we need?
4. **Minors.** May under-18 users enter paid bouts? Parental consent, age gates, COPPA, and school-related use.
5. **Money flow.** Do we need money-transmitter or marketplace licensing, or can Stripe Connect handle collection and payouts so BoutCasts never holds prize money? What does the organizer payout structure require?
6. **Taxes.** 1099 reporting for prize winners and organizers; sales tax on the fee; who is the payer of record.
7. **Terms and disclosures.** Official rules language, refund/cancellation terms, dispute process, judging disclosure, and what the organizer vs. BoutCasts is responsible for. Any registration/disclosure required by consumer protection law.
8. **Content and IP.** Rights to entrants' performances, instrumentals/beats used in music bouts, and the producer usage-report flow.
9. **Sponsor and ad rules** around paid contests, and FTC disclosure for promoted bouts.
10. **Entity and insurance.** Whether to run this under a separate LLC, and what insurance to carry.

## Facts to have ready
- Fee range, platform fee, refund policy, minimum-entry rule (above).
- Which states you plan to launch in first, and whether the audience includes high-school students.
- The current published rules template (`/rules`) and terms (`/terms`).

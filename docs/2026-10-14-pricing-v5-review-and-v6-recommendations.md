# WaifuDance — Pricing Strategy v5 Review & v6 Recommendations

**Date:** 2026-10-14
**Reviews:** "WaifuDance AI — Pricing Strategy v5" (updated 2026-04-11)
**Based on:** the v5 document

## Summary

v5 contains **one arithmetic error** that guarantees losses, **one internal contradiction** that breaks its own conversion funnel, and **one factual mismatch**: the document does not describe what the live site actually sells, so every margin in it is computed on the wrong product. Details and fixes below.

## What v5 gets right

- **Cost baseline is real.** kie.ai Grok Imagine at 1.6 credits/sec (480p) and 3 credits/sec (720p) → 9.6 / 18 credits per 6-sec video. This matches the consumption implied by the live pricing page (~10 / ~19 credits). Good.
- **Self-correction on quotas.** v5 caught that Standard at 400 credits and Pro at 1,000 credits lose money at maximum usage, and revised them down (280 / 650). The instinct is right even if the model needs work (see §5).
- **Resolution strategy and price-raise triggers** (post-PMF increases, demand>supply) are sound.

---

## Critical issue 1 — The Power pack is priced below your own cost

| Pack | Price | Credits | Sell rate | Your cost (v5) |
|---|---|---|---|---|
| Taste | $5 | 500 | $0.0100/cr | $0.010/cr (small tier) |
| Casual | $10 | 1,200 | $0.0083/cr | — |
| Regular | $25 | 3,000 | $0.0083/cr | — |
| Power | $50 | 7,500 | **$0.0067/cr** | **$0.0076/cr (large tier)** |

Power sells credits at **$0.0067** while v5's own cheapest purchase rate is **$0.0076** — a guaranteed loss on every fully-redeemed Power pack, before payment fees. Taste at $0.0100/cr sits exactly on the small-tier cost line, so it is also underwater once Creem's fee is deducted. "Credits never expire" does not fix this; it defers the loss and keeps the liability on the books indefinitely.

PAYG as a loss-leader only works if the losses are small, capped, and convert. These are none of the three.

**Rule for v6 (price floor):** no pack or plan may sell credits below **1.5× your blended purchase cost**. At today's costs ($0.0076–0.010/cr), that means a hard floor around **$0.012–0.015/cr** for the cheapest bulk tier, with smaller packs priced above it.

---

## Critical issue 2 — The document's funnel contradicts its own numbers

v5 §4 states the design intent: *"Subscription should feel ~20–30% cheaper per credit than PAYG,"* and the conversion path assumes users upgrade because *"monthly is cheaper."*

The document's own table says the **opposite**:

| Effective rate | |
|---|---|
| Subscription | **$0.06–0.09 / credit** |
| PAYG | **$0.007–0.010 / credit** |

Subscriptions are **7–9× more expensive** per credit than PAYG. No rational user upgrades "because monthly is cheaper" — it isn't. The comparison table even lists "Cheaper" as a subscription advantage, which is false under these numbers.

The upgrade pull is further weakened by v5 giving PAYG the full effect library with no tier restrictions. What remains for subscribers is only priority queue, bulk export, and early-access effects — a thin justification for $39/mo against a $50 one-time pack that undercuts it on credits.

**Rule for v6 (one ladder, right order):** per-credit price must strictly decrease with commitment:

**Pro < Standard < Starter < PAYG** — and PAYG should carry a clear top-up premium (~1.5–2× the Starter per-credit rate).

Where subscriptions cannot win on credits alone, differentiate with real walls, not inverted prices: PAYG = standard queue, no exclusive/early-access effects, no bulk export. Do not give PAYG the full library.

---

## Critical issue 3 — v5 does not describe the live product

| | v5 document | Live site (audited 2026-10-14) |
|---|---|---|
| Credit model | Single pool (Starter 150 / Standard 280 / Pro 650) | **Split pools:** 150 image + 150 video, 280 + 280, 650 + 650 |
| Free tier | 20 credits, one-time, on signup | **20 image + 20 video credits monthly**, plus a one-time signup grant |
| Image generation cost | **Not in the cost baseline** | Sold in every plan — image credits burn API cost too |

Every margin figure in v5 is computed on the single-pool product. The live site sells **roughly double** the entitlements plus a recurring free tier, and an entire cost category (images) is missing from the baseline.

**Rule for v6:** one credit model, everywhere. Either merge to a single pool on the live site, or extend the cost baseline to image generation and recompute. The document and the storefront must sell the same thing. We also recommend returning the free tier to the v5 design (one-time trial credits, watermarked) to cap recurring free cost.

---

## Secondary issues

1. **Margins use the large-tier purchase rate ($0.0076/cr).** Current volume will not qualify for it. At the small-tier rate ($0.010/cr), every margin in v5 shrinks by ~30%. Model at the rate you actually pay until volume proves otherwise.
2. **No payment costs in the model.** Creem's merchant-of-record fee and a refund/chargeback buffer (budget 3–5%; this niche has elevated chargebacks) must be line items, not surprises.
3. **Max-usage is the only scenario modeled.** It drove quota cuts (Standard 400→280) that hurt competitiveness: Pika's Standard is $28 for 700 credits; ours is $39 for 280. "Adult niche premium" may justify a gap, but v5 benchmarks only general platforms — no direct niche competitor is named or priced. Add average-utilization scenarios (e.g. 30% / 60% / 100%) and at least 2–3 actual dance/anime generator competitors before finalizing quotas.
4. **The Wan 2.7 note appears to have a unit error.** "720p = $0.08/sec" × 6 sec = $0.48/video, which is ~3× the current 720p cost ($0.137–0.18), not a saving. Do not plan margins on this until the units are verified.
5. **Sequencing.** v5 is dated April 2026. As of October 2026 the Creem account is still in test mode and recorded revenue is zero (28 days: 8 checkout clicks, $0). No pricing strategy matters until checkout works end-to-end in live mode. Pricing v6 should be calibrated on the first 30 days of real payment and utilization data, not before.

---

## v6 recommendations (actionable)

1. **Enforce the price floor (§2):** cheapest $/credit ≥ 1.5× blended cost. Reprice or shrink the Power pack first — it is the only tier guaranteed to lose money.
2. **Restore the ladder (§3):** subscriptions cheapest per credit, PAYG as premium top-up; move PAYG differentiation to feature walls (queue, exclusive effects, bulk export).
3. **Unify the credit model (§4)** across document, pricing page, and billing system; add image generation to the cost baseline.
4. **Rebuild the margin model:** small-tier cost, minus Creem fees, minus 3–5% chargeback/refund buffer, at 30/60/100% utilization scenarios.
5. **Verify Wan 2.7 pricing units** before using it in any projection.
6. **Sequence:** (a) activate Creem live mode and test the full checkout; (b) ship the two conversion fixes already specced (no-credits upsell, pricing-page number consistency); (c) recalibrate v6 numbers after 30 days of real data.

---

## Illustrative ladder (same price points, credits adjusted — validate against real costs before shipping)

| Tier | Price | Credits | $/credit | Margin at max usage (cost $0.0076–0.010/cr) |
|---|---|---|---|---|
| Starter | $19/mo | 600 | $0.032 | cost $4.6–6.0 → healthy |
| Standard | $39/mo | 1,500 | $0.026 | cost $11.4–15.0 → healthy |
| Pro | $89/mo | 4,000 | $0.022 | cost $30.4–40.0 → healthy |
| PAYG Taste | $5 | 120 | $0.042 | trial-sized, above floor |
| PAYG Casual | $10 | 280 | $0.036 | |
| PAYG Regular | $25 | 750 | $0.033 | |
| PAYG Power | $50 | 1,600 | $0.031 | above Starter rate — top-up premium preserved |

This keeps every public price unchanged, makes subscriptions genuinely the best per-credit deal, keeps PAYG above the cost floor, and leaves max-usage margins positive at both purchase rates. Treat the credit figures as a starting point for the recalibration in step 6(c), not as final.

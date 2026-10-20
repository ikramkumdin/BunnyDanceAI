# WaifuDance — Developer Implementation Spec: Pricing & Checkout Conversion

**Date:** 2026-10-14
**Audience:** Development only. This spec is self-contained: every value and behavior you need is in here. Pricing rationale lives in a separate document in the end for attachment.
**Priority order:** Change 1 → Change 2 → Change 3 → Change 4 → Change 5.

---

## Change 1 — Credit amounts per plan/pack (config)

Prices do not change. Only credit amounts and the credit model change.

### 1a. Merge to a single credit pool

- Replace the current split pools (image credits + video credits) with one unified credit balance per user.
- Generation costs stay as currently implemented in code (do not change per-generation deduction rates). For reference, current effective rates are ≈10 credits per 6-sec 480p video and ≈19 credits per 6-sec 720p video — verify against code and use the exact values wherever the UI displays derived numbers.
- Balance migration: for existing accounts, new unified balance = image balance + video balance. Run once at deploy.

### 1b. New amounts (single pool)

**Subscriptions (monthly grant):**

| Plan | Price | Credits: current → new |
|---|---|---|
| Starter | $19/mo | 150+150 → **600** |
| Standard | $39/mo | 280+280 → **1,500** |
| Pro | $89/mo | 650+650 → **4,000** |

**Pay-as-you-go (one-time, never expires):**

| Pack | Price | Credits: current → new |
|---|---|---|
| Taste | $5 | 500 → **120** |
| Casual | $10 | 1,200 → **280** |
| Regular | $25 | 3,000 → **750** |
| Power | $50 | 7,500 → **1,600** |

**Free tier:**

| | Current | New |
|---|---|---|
| Grant | 20 image + 20 video credits monthly + signup grant | **20 credits, one-time, on signup only** |
| Limits | 480p, watermark | 480p only, watermark (unchanged) |

### 1c. Rules

- Annual billing remains 20% off; credit grants are monthly in all cases.
- New amounts apply to new purchases and new subscription periods. Existing subscribers keep their current period's entitlement; the new grant applies from their next renewal.
- If credit amounts are also stored in Creem product configuration/metadata, update them there to match. The storefront, the Creem products, and the fulfillment logic must all agree.
- Entitlement differences stay as-is except Change 4: subscriptions keep no-watermark, all effects, priority/VIP queue, bulk export, as currently specced per plan.

---

## Change 2 — No-credits upsell (in-place)

**Trigger:** a generation attempt that fails for insufficient credits (existing event `generate_no_credits`; **22 occurrences** in the last 28 days vs 19 successful generation starts).

### Behavior

1. Show the upgrade prompt in the same modal/flow where generation failed. **Do not** redirect to the pricing page as the primary path.
2. **Primary CTA:** Taste pack — $5 one-time, 120 credits, never expires (values from Change 1).
3. **Secondary CTA:** "See monthly plans" → full pricing view.
4. **Preserve intent through sign-in:** if the user is signed out, route to sign-in and afterwards land directly on the checkout for the item they clicked — not the homepage, not generic pricing.
5. **Resume after purchase:** on successful payment, return the user to the generation they attempted, with the updated balance displayed, so they can complete it in one click.
6. **Analytics:** existing events (`pricing_plan_selected`, `pricing_checkout_clicked`) must fire from this entry point too, with parameter `source=no_credits_modal`.

### Acceptance tests

- [ ] Drain an account to <10 credits, attempt a 480p generation → prompt appears with Taste as primary CTA.
- [ ] Signed-out: click Taste CTA → sign in → lands on Taste checkout.
- [ ] Complete test-mode purchase → balance increases by exactly 120 → pending generation can be completed without re-navigation.

---

## Change 3 — Pricing page numbers: one cost table, everything derived

The pricing page currently contradicts itself (e.g. 150 credits ≈ 15 videos on one plan and 280 credits ≈ 15 videos on another, with the resolution difference not stated inline; pay-as-you-go "$/video" figures are per-credit prices mislabeled, off by ~10×).

### Fix

1. Publish internally one cost table (from code): credits per generation by type and resolution.
2. Every "~N videos" on the page = plan credits ÷ credits per video at the stated resolution, rounded down.
3. Every "$/video" = price ÷ N videos for the same row. **No per-credit figures labeled as per-video.**
4. Where two plans show the same video count, the resolution difference must be stated in the same line.
5. Reference values at current deduction rates (10 cr / 480p video, 19 cr / 720p video — recompute if code differs):

| Tier | Credits | ≈ videos 480p | ≈ videos 720p |
|---|---|---|---|
| Starter (600) | 600 | 60 | 31 |
| Standard (1,500) | 1,500 | 150 | 78 |
| Pro (4,000) | 4,000 | 400 | 210 |
| Taste (120) | 120 | 12 | 6 |
| Casual (280) | 280 | 28 | 14 |
| Regular (750) | 750 | 75 | 39 |
| Power (1,600) | 1,600 | 160 | 84 |

### Acceptance test

For every row on the live page, credits, ≈ videos, and $/video are mutually consistent under the single cost table.

---

## Change 4 — PAYG entitlement walls

Pay-as-you-go credits currently unlock the full effect library. Change entitlements for PAYG-sourced credits:

- **Standard queue only** (no priority/VIP).
- **No exclusive or early-access effects** (those remain subscription-only, per plan).
- **No bulk export.**

Track credit source (subscription grant vs PAYG purchase) at the balance level; if a user holds both, subscription entitlements apply while a subscription is active. Everything else about PAYG is unchanged (never expires, all resolutions).

### Acceptance test

An account holding only PAYG credits cannot select an exclusive effect or use bulk export; the same account with an active Standard subscription can.

---

## Change 5 — GA4 purchase event

Confirm a GA4 `purchase` event fires on successful payment with `value` and `currency`. (Last 28 days: 8 checkout clicks, 0 revenue events recorded — conversion is currently unmeasurable.) If the event exists, reply with where it fires; if not, add it. Verify in GA4 DebugView using a Creem test-mode purchase.

---

*This content is only supported in a Lark Docs.*

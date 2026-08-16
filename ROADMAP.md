# Chromatic — where this goes next

Written as the engineering/product case for what to build after the PWA and the
tone scanner. Opinionated on purpose; argue with it.

---

## 1. What you actually have

It's worth being precise about the asset, because it isn't the colour maths.

The maths in this app is good but reproducible — RYB hue interpolation, CIELAB
nearest-neighbour, WCAG contrast. Any competent engineer rebuilds it in a week.

**The moat is the writing and the curation.** The Wada library with a real
sentence of reasoning per palette. "Handle *Salmon Pink* with care — it sits just
far enough from your colour to look like a near-miss rather than a decision."
The Refine toggle, and the callout explaining *why* raw harmony geometry looks
cheap. That is a point of view, and points of view don't get cloned in a week.

**The problem is that it's a reference tool.** Reference tools have a brutal
retention curve: someone learns the 60/30/10 rule once and never returns. Coolors
and Adobe Color have enormous traffic and almost no loyalty.

So the interesting question is not "what features next" — it's **what makes
someone open this on a Tuesday.**

## 2. The strategic choice

Three coherent products live inside what you've built. Pick one to be primary;
the others become features.

| | Retention | Monetisation | Competition | Your edge |
|---|---|---|---|---|
| **A. Colour theory reference** | Very low | Ads only | Coolors, Adobe Color | Better writing |
| **B. Personal colour + wardrobe** | High | Subscription + affiliate | Style DNA, Colorwise, human analysts (€150–300) | Measured, local, explains itself |
| **C. Designer/artist palette tool** | Medium | Prosumer subscription | Coolors Pro, Khroma | Paint-accurate RYB wheel |

**Build B.** The reasoning:

- It has a **recurring question** — "does this go with what I own?" — which is a
  weekly need, not a one-time lookup.
- It attaches to **commerce naturally**, without feeling bolted on.
- The incumbent experience is a **€150–300 in-person consultation** or an opaque
  app that returns "You're a Summer!" with no evidence. You return CIELAB
  coordinates, an ITA° figure, a confidence score, and a plain-English derivation.
  *Showing your work is the differentiator.*
- Options A and C survive intact as the Learn / Wheel / Lab tabs. They become the
  credibility layer — the reason to trust the recommendation — rather than dead
  weight.

The one-line positioning: **"A colour analyst in your pocket that shows its
working, and then finds you the clothes."**

## 3. What I'd build, in order

### Tier 1 — makes it a product (next 4–6 weeks)

**My Closet.** Photograph a garment; the existing extraction code pulls its
dominant colour; store `{photo, hex, category, name}` in IndexedDB. This is the
single highest-leverage feature you can build, for three reasons: it creates
switching cost, it converts the app from advice to inventory, and every later
feature depends on it.

**Outfit builder.** Pick 2–4 closet items; score the combination using the logic
you already have — harmony relationship, contrast ratio, 60/30/10 proportion, and
fit against the wearer's measured tone. Return a *reason*, in the register the
Advisor already writes in. This is where your writing voice becomes the product.

**"Does this suit me?"** A single-purpose camera check: point at a garment, get
its colour scored against your profile with a plain-English verdict. Cheap to
build on top of what exists, and it's the feature people will actually screenshot
and send to friends.

**Shareable result cards.** A rendered PNG of your season, palette and top
colours, via `canvas.toBlob()` + the Web Share API. Personal colour analysis is
inherently social — this is your only zero-cost acquisition channel.

### Tier 2 — makes it retain (weeks 6–14)

- **Wardrobe gap analysis.** "You own eleven cool-toned tops and no warm neutral
  bottom." Inventory plus a palette makes this trivially computable and genuinely
  useful.
- **Packing / capsule generator.** N items, maximum outfit combinations, all
  inside your palette.
- **Occasion + climate context.** The same palette behaves differently in Delhi
  daylight and Amsterdam November overcast. You already teach this in the
  simultaneous-contrast lesson — apply it.
- **Save multiple profiles.** Partners, kids, clients. Turns one user into four.

### Tier 3 — makes it a business (month 4+)

- **The shopping layer.** Section 5.
- **Pro tier** — unlimited closet, PDF export, multiple profiles, stylist mode.
- **Stylist/B2B mode.** Independent stylists and boutiques will pay more than
  consumers will. A shareable client report is a small feature with real revenue.

## 4. The AI question, answered honestly

You asked whether to put an AI model in the app to read skin tone. Here is the
straight version.

### The tone reading is already done — and it did not need a model

Skin tone measurement is **colorimetry, not perception**. ITA° from CIELAB is the
dermatological standard; it is arithmetic, it runs in a millisecond, it needs no
weights, no download, and no server. It is also *auditable* — the app can show you
the numbers and how they produced the answer. A neural network cannot do that, and
for a product whose entire pitch is "we show our working," that matters more than
accuracy would.

**A model would not have made this better.** It would have made it heavier, opaque,
and — trained on the datasets that exist — very likely worse on dark skin.

### Where a model genuinely earns its place

Four places, in priority order:

**1. Face landmark detection — do this first.**
Right now the user aligns their face inside an oval and four fixed patches sample
whatever is behind them. It works, but it fails on glasses, fringes, beards and
anyone who doesn't centre themselves. **MediaPipe Face Mesh** (~3 MB WASM, fully
on-device, no network) gives 468 landmarks, which lets you place the patches on
actual anatomy, exclude eyebrows and lips automatically, and sample the sclera as
a *biological white reference* — which would largely solve the white-balance
problem that is currently your single largest error source.

This is the highest-value model in the entire product. It is also the least
glamorous, which is usually how it goes.

**2. Garment segmentation for the closet.**
Background removal so extracted colour is the garment, not the sofa. Either
`u2netp` (~4 MB, ONNX Runtime Web) or the browser-native `Segmentation API` where
available. Without this, closet colour extraction will be noticeably wrong.

**3. Product-image colour extraction — server-side.**
The commercial unlock, covered in section 5. Same k-means you already have, run
over retailer feeds in a batch job rather than in the browser.

**4. A vision-language model for outfit critique — last, and only if you must.**
"Why doesn't this work?" answered in prose. Genuinely delightful, genuinely
expensive, and it cannot measure — so it must sit *downstream* of your
deterministic scoring, phrasing a verdict the maths already reached. Never let it
choose the colours. Server-side, cached hard, gated behind the paid tier.

### What not to do

- **Do not send face photos to a server.** The moment you do, you inherit a
  compliance burden that will cost more than the feature earns. Local-only is a
  real, defensible, marketable position — lead with it.
- **Do not use an LLM to pick colours.** It will produce confident,
  unreproducible, unmeasurable output. You have arithmetic that is correct.
- **Do not ship a model just to say "AI-powered."** Your credible claim is
  *"measured, not guessed."* That is a stronger claim, and it's true.

## 5. The shopping layer

You chose **both markets, auto-detected**. Here's how that actually works.

### The hard part is not the links — it's the colour metadata

There is no public product API for Zalando or Myntra that a third party can just
call. What you can get is **affiliate product feeds**:

| Market | Retailers | Route |
|---|---|---|
| NL / EU | Zalando, H&M, ASOS, Uniqlo, Wehkamp | Awin, Tradedoubler, Daisycon |
| India | Myntra, Ajio, Nykaa Fashion | Cuelinks, INRDeals, vCommission |
| India | Amazon.in | Amazon Associates PA-API |
| Global fallback | — | plain search deep links, no affiliate |

Those feeds give you `{title, image, price, url, colour: "Dusty Rose"}` — and that
colour is **a marketing string, not a hex**. "Dusty Rose" spans about forty
distinguishable colours. Matching a user's measured `#BE7F80` against a string is
hopeless.

**So don't match strings — match pixels.** You already have the extraction code:

```
nightly:  feed → product image → remove background → k-means → dominant hex
          → CIELAB → index by (L*, a*, b*)

runtime:  user profile → ranked target colours → ΔE nearest-neighbour lookup
          → "this jacket is 2.1 ΔE from your best mid-tone"
```

This is the whole business. Every fashion app filters by the retailer's colour
word. **You would be the only one filtering by measured colour.** It is also the
only part of this that genuinely needs a backend — which is fine, because it
handles product images, never user photos.

### Country detection

Locale and timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) get you
there without geolocation permission or an IP lookup. Always show the detected
market with a manual override — travellers and expats are disproportionately
represented in your likely audience.

### Economics, honestly

Fashion affiliate commission runs roughly 5–12% in the EU and 3–8% in India, on a
30-day cookie, and networks usually want demonstrated traffic before approving
you. India's rates are lower and its average basket is much smaller, so **the
Netherlands will pay for the product and India will provide the volume.** Plan the
funding accordingly, and don't let affiliate revenue be the only business model —
it's a supplement to subscription, not a substitute.

**Ship the plain deep links first.** Colour-filtered search URLs into Zalando and
Myntra, no affiliate tags, no feed pipeline. It proves whether anyone clicks
before you build the infrastructure. If nobody clicks, you saved three months.

## 6. Hard problems — the ones that actually bite

**Camera white balance.** Already the dominant error source and it will stay that
way. Under tungsten light an uncorrected reading shifts a full season. Mitigations,
in order of value: sclera-based white reference via Face Mesh; the manual
white-reference tap (shipped); a printed reference card; and honest confidence
reporting (shipped). Never let a low-confidence reading present itself as fact.

**Screen colour on the way out.** You measure the user accurately, then display
recommendations on an uncalibrated OLED with vendor saturation boost. Colour names
and physical references matter more than swatches for exactly this reason — which
your Advisor already understands.

**Seasonal analysis is contested.** It is a styling heuristic with a devoted
following and no clinical basis. Your current framing — measured numbers first,
season as an *interpretation*, with an explicit caveat — is the right call. Keep
the numbers primary. It's the honest position and it also happens to be the
defensible one.

**Privacy and regulation — get counsel before EU launch.** Skin tone can imply
racial or ethnic origin, which is special-category data under GDPR Article 9. And
the EU AI Act restricts biometric categorisation systems that infer race from
biometric data. Your architecture is close to the best-case answer already: local
processing, no transmission, no image retention, explicit deletion. But "we don't
upload it" is an engineering fact, not a legal conclusion. Do not guess on this
one, and do not let a growth experiment quietly move inference server-side later.

**Dark skin accuracy.** Most colour-analysis products are visibly worse on deep
skin tones, largely because of camera exposure metering and training-set bias.
ITA° is defined across the full range and your implementation handles it, but
**test it deliberately across the range** rather than assuming. This is both an
ethical obligation and, in the Indian market, a straightforward commercial one.

## 7. Business model

- **Free** — lessons, wheel, advisor, library, one tone scan, small closet.
- **Pro, ~€4/mo or ₹199/mo** — unlimited closet, outfit scoring, multiple
  profiles, PDF export, packing planner.
- **Affiliate** — supplements Pro, never replaces it.
- **B2B stylist tier** — client profiles and branded reports. Highest revenue per
  user, lowest volume, least glamour. Usually the one that works.

Price India separately and unapologetically. €4 and ₹199 are the same product at
the right local price, and pretending otherwise loses the market.

## 8. First 90 days

| Weeks | Ship |
|---|---|
| 1–2 | Face Mesh landmarks + sclera white reference. Fixes the biggest accuracy gap. |
| 3–5 | My Closet — capture, extract, IndexedDB, grid. |
| 6–8 | Outfit builder + scoring, in the Advisor's written voice. |
| 9–10 | Shareable result cards + Web Share. First real acquisition channel. |
| 11–12 | Plain deep links to Zalando/Myntra. Instrument the clicks. |
| 13 | Read the click data. **Then** decide whether the feed pipeline is worth building. |

The decision gate at week 13 is the important part of this table. Everything
before it is cheap; the feed pipeline is not.

---

## The short version

You have built a reference tool with unusually good writing and an honest
measurement engine. Reference tools don't retain. Wardrobes do.

Add the closet, keep showing your working, and let the commerce follow the
measurement rather than leading it.

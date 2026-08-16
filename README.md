# Chromatic

A colour companion — colour theory lessons, a pairing advisor, Sanzo Wada's palette
library, a paint-accurate colour wheel, a palette lab, and an on-device skin-tone
analyser. Installable, works offline, no backend.

---

## Run it

A service worker and `getUserMedia` both require a secure context, so `file://`
will not work. Serve the folder:

```bash
python -m http.server 5173
```

Then open <http://localhost:5173>. `localhost` counts as secure, so the camera and
the service worker both work there.

Any static host works for deployment — Netlify, Vercel, Cloudflare Pages, GitHub
Pages. The only requirement is HTTPS.

## Files

```
index.html              the whole app — markup, styles, logic
manifest.webmanifest    PWA manifest: icons, shortcuts, display mode
sw.js                   service worker: precache, offline, update flow
favicon.ico             root favicon (browsers request this implicitly)
icons/                  generated PNG icons, incl. maskable + apple-touch
tools/make-icons.js     regenerates every icon; zero dependencies
.claude/launch.json     dev-server config
ROADMAP.md              product strategy and the case for what to build next
```

Regenerate icons after changing the mark:

```bash
node tools/make-icons.js
```

---

## What was added to the original

### PWA
- **Installable** — manifest with maskable icons and three app shortcuts
  (tone scan, advisor, lab), plus an in-app Install button driven by
  `beforeinstallprompt`. iOS has no such event, so Safari users get a one-time
  Add-to-Home-Screen hint instead.
- **Offline** — the shell is precached on install. Navigations are network-first
  (so a deploy lands immediately) and fall back to cache. Google Fonts are cached
  at runtime: cache-first for the font files, stale-while-revalidate for the CSS.
- **Update flow** — a new service worker does not activate silently. A banner
  offers a reload; `SKIP_WAITING` and a guarded `controllerchange` handle the swap
  without the first-install reload loop.
- **State survives reloads** — palette, theme, lesson progress, quiz score,
  questionnaire answers and the last tone reading persist to `localStorage`.
- **Mobile** — safe-area insets for notch and home indicator; the sticky nav's
  offset is measured at runtime rather than hard-coded, because the topbar wraps
  on narrow screens and grows under an iOS status bar.

### Skin-tone analysis
Lives under **Personal Colour → Scan my skin**. Everything runs in the browser;
no image is uploaded and no image is stored.

**Pipeline**

1. **Capture** — camera or photo upload, drawn cover-fit into a fixed 720×960
   canvas so the guide overlay maps 1:1 onto pixel coordinates.
2. **White balance** — Shades-of-Grey illuminant estimation (Minkowski p=6) over
   the *background only*, so the face cannot drag the estimate toward neutral.
   Applied at partial strength, because nothing in the frame distinguishes an
   orange lamp from a beige wall. A strong cast is flagged, and the user can pin
   an exact white reference by tapping something neutral in the shot.
3. **Sampling** — four patches (forehead, both cheeks, jaw). Pixels are filtered
   to plausible skin in YCbCr, specular highlights and shadow are trimmed off the
   ends, and the middle 60% is averaged in CIELAB rather than RGB.
4. **Metrics** — L\*, a\*, b\*, C\*, hue angle, and **ITA°**, the Individual
   Typology Angle used in dermatology for constitutive skin depth.
5. **Profile** — undertone from hue angle, depth from ITA°, clarity from chroma
   normalised against the chroma expected at that lightness, contrast from the
   hair-to-skin ΔL (user-correctable).
6. **Season** — the four axes are placed against twelve seasons in
   (warmth, depth, clarity, contrast) space; nearest point wins, with each
   season's *naming* axis weighted double.
7. **Colours** — all 190 named colours are scored against the measured profile,
   then bucketed by lightness and hue-spaced so you get a wearable spread rather
   than five near-identical burgundies.
8. **Drape test** — the captured face composited against candidate colours, which
   is the test a human colour analyst actually performs.

**Quality reporting.** Focus, blown pixels, illuminant cast and cross-patch
agreement each get a line, and a combined confidence score. A bad reading says so
instead of quietly returning a wrong season.

**Known limits** — camera white balance is the dominant error source; under strong
tungsten light an uncorrected reading can shift a full season, which is why the
white-reference tap exists. Make-up, tanning and screen glow all affect the result.
Seasonal analysis is a styling heuristic, not a measurement, and the app says so.

---

## Hardening worth doing before a real launch

- **Self-host the fonts.** They are currently fetched from Google Fonts and cached
  at runtime, so a user whose very first visit is offline gets the fallback stack.
  Self-hosting also removes a third-party request.
- **Bump `VERSION` in `sw.js` on every deploy.** It names the caches; without a
  bump, stale assets can survive.
- **Split `index.html`.** One file is fine at this size and genuinely nice to
  deploy, but the tone engine deserves its own module with tests once it grows.
- **Legal review before EU launch.** See the privacy section in `ROADMAP.md` —
  inferring characteristics from a face image has regulatory weight even when the
  processing is entirely local.

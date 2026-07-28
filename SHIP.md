# Shipping blinky1200

The game is one self-contained `index.html` plus a few static assets
(`card.png`, `manifest.json`, `sw.js`, `icon-*.png`). Everything below is
turnkey — the only things you do by hand are the two publish actions
(posting to Facebook, submitting to Play), which no tool can do for you.

## Tonight — go live on pages.dev + post to Facebook

`hunpayont.net` is brand new, so it isn't usable yet (needs nameserver setup +
propagation — see the next section). So tonight the game ships on its Cloudflare
**pages.dev** URL, and the OG/share tags point there so the FB card renders right
away. The branded domain is a swap-in later; both URLs serve the same game.

1. **Deploy.** Double-click `~/Desktop/Ship blinky1200.command`. It bundles the
   game + assets into `dist/` and runs `wrangler pages deploy`. First run opens a
   browser once to log in to Cloudflare — click Allow. It prints the live URL,
   `https://blinky1200.pages.dev/`.

2. **Warm the preview cache.** Facebook caches link previews. Paste
   `https://blinky1200.pages.dev/` into the **Facebook Sharing Debugger**
   (developers.facebook.com/tools/debug/) and click *Scrape Again*. You should see
   the `card.png` (a big blinking 12:00) and the title/description.

3. **Post it.** Share `https://blinky1200.pages.dev/` on Facebook (or use the
   in-game ⤴ SHARE → Facebook). The card + copy come from the OG tags.

## When you're ready — move it to blinky1200.hunpayont.net

Do this whenever (no rush — it doesn't block tonight's post):

1. **Add the domain to Cloudflare.** Dashboard → *Add a site* → `hunpayont.net`
   (Free plan is fine). Cloudflare gives you two nameservers.
2. **Point the nameservers.** At whatever registrar you bought it from, replace the
   nameservers with Cloudflare's two. Propagation is usually minutes to a few hours;
   Cloudflare emails you when the zone is active.
3. **Attach it to the Pages project.** Dashboard → Workers & Pages → `blinky1200` →
   **Custom domains** → *Set up a domain* → `blinky1200.hunpayont.net`. The CNAME +
   HTTPS cert are auto-provisioned (~a minute once the zone is active).
4. **Point the tags at it (optional polish).** In `index.html`, change the two
   `og:url`/`og:image` lines and the `file:` fallback from `blinky1200.pages.dev`
   to `blinky1200.hunpayont.net`, re-run the launcher, and re-scrape in the FB
   debugger. (Everything keeps working on pages.dev too — this is just for a clean
   branded link.) Different subdomain or the apex? same one-line change.

That's it — you're live, and every player has the ⤴ SHARE button (Facebook, X,
WhatsApp, LINE, Telegram, Reddit, Messenger, Email, copy-link, and native share
on phones), plus a "SHARE / BRAG" line on the win screen and the wall.

## Tomorrow — Google Play (TWA)

The game is already a PWA (installable, offline via `sw.js`, `manifest.json` with
maskable icon). Wrap it as a Trusted Web Activity and submit.

> A TWA is bound to one host and is a pain to re-point after publishing, so decide
> the host FIRST. If `blinky1200.hunpayont.net` is live by then, use it. If not,
> either wait for the domain, or build against `blinky1200.pages.dev` (permanent,
> always works). Use the same host everywhere below.

**Easiest path — PWABuilder (GUI):**
1. Go to pwabuilder.com, enter your chosen host URL (the custom domain if live,
   else `https://blinky1200.pages.dev/`).
2. It validates the manifest/PWA, then Package for Stores -> Android -> download
   the signed `.aab` (it walks you through the signing key — save it safely).
3. In Google Play Console ($25 one-time dev account): create the app, upload the
   `.aab`, fill the listing (use `card.png` art + the icons), set content rating,
   privacy policy, and submit for review.

**CLI path — Bubblewrap (if you prefer terminal):**
```bash
npx @bubblewrap/cli init --manifest https://blinky1200.hunpayont.net/manifest.json
npx @bubblewrap/cli build      # produces app-release-signed.aab
```
Then upload the `.aab` in Play Console as above.

Notes:
- TWA needs the site on https (Pages gives you that) and a valid manifest (done).
- Digital Asset Links (opens the app without a URL bar): a template already lives at
  `.well-known/assetlinks.json`, and the launcher deploys it automatically. Tomorrow,
  replace `REPLACE_WITH_YOUR_PACKAGE_NAME` and `REPLACE_WITH_YOUR_SHA256_FINGERPRINT`
  with the values PWABuilder/Bubblewrap give you, re-run the launcher, then verify:
  `curl https://blinky1200.hunpayont.net/.well-known/assetlinks.json` should return your
  filled-in JSON. (If it 404s, your wrangler is old and skipped the dotfolder — update
  wrangler, or add `assetlinks.json` via a Pages redirect.)
- Landscape is set in the manifest; the in-game "turn your phone sideways" gate
  still covers portrait just in case.

## Assets

Regenerate the card + icons any time with the scratchpad script
(`make_assets.py`, uses Pillow): it draws the seven-segment `12:00` card at
1200x630 and icons at 192/512 (+ maskable).

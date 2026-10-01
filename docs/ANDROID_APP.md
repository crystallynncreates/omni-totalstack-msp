# Omni on Google Play (Android app)

Omni is a Progressive Web App (manifest `public/manifest.webmanifest`, service worker `public/sw.js`, icons in
`public/icons/`). The Android app is a **Trusted Web Activity (TWA)**: a small signed Android wrapper that opens
Omni full-screen with no browser bar. Updates to the website appear in the app instantly — no new Play release needed.

## 1. Build the app package
Generated with PWABuilder (pwabuilder.com → enter https://omni-totalstack-msp.vercel.app → Package for stores →
Android). Settings used: package ID `com.omnitotalstack.app`, app name "Omni TotalStack MSP", launcher name "Omni MSP",
start URL `/app?source=app`, theme `#0b0d12`, signing key: **new**.

The download contains:
* `*.aab` — upload this to Google Play
* `*.apk` — install on a phone to test
* `signing.keystore` + `signing-key-info.txt` — **back these up somewhere safe**. Every future update must be signed
  with this key. Never commit them to GitHub.
* `assetlinks.json` — contains your SHA-256 fingerprint

## 2. Prove the app and website belong together
Omni serves `/.well-known/assetlinks.json` from Vercel environment variables (`api/_handlers/app.ts`):
* `ANDROID_PACKAGE` = `com.omnitotalstack.app`
* `ANDROID_SHA256` = comma-separated SHA-256 fingerprints: the one from `assetlinks.json` (your upload key) **and**
  the one Google Play shows under *Setup → App signing → App signing key certificate* after your first upload.
Redeploy after changing them. Until both are set the app still works but shows a small browser bar at the top.

## 3. Publish on Google Play
1. play.google.com/console → pay the one-time $25 developer fee → verify your identity.
2. Create app → name "Omni TotalStack MSP", App, Free.
3. Store listing: short description, full description (see below), app icon `docs/play-store/app-icon-512.png`,
   feature graphic `docs/play-store/feature-graphic-1024x500.png`, 2+ phone screenshots (`docs/play-store/`).
4. App content: Privacy policy URL `https://omni-totalstack-msp.vercel.app/privacy`; Ads: No; App access: provide a
   demo login (or explain the "Explore the demo workspace" button); Data safety: see below; Target audience 18+; Category Business.
5. Testing → Internal testing → upload the `.aab` → add your email as a tester → install from the link.
   New personal developer accounts must run a closed test with at least 12 testers for 14 days before production.
6. Production → Create release → upload the `.aab` → Roll out.

### Store text
* **Short description (80):** Run your MSP: clients, tickets, patching, billing & one-line commands.
* **Full description:** Omni TotalStack MSP is the all-in-one command center for managed service providers. See which
  client sites are down, work tickets against SLA timers, approve proposals, check who has paid, and type commands like
  "update windows 11 at Acme" or "disable user john@acme.com" that run on your connected RMM, Microsoft 365, Proxmox and
  more — with a confirmation step and a full audit log. Includes branded client portal, invoicing with ACH/card/Apple
  Pay/Google Pay, 15-day safe patching, Huntress security, QBRs and an AI assistant. An Omni subscription is required
  (plans from $29.99/month) — sign up at omni-totalstack-msp.vercel.app.

### Data safety answers
Collected: name, email (account management), user-entered business data (app functionality). Encrypted in transit: yes.
Users can request deletion: yes (omnitotalstack@gmail.com). Not shared for advertising; not sold. No location, contacts,
photos, audio or device IDs.

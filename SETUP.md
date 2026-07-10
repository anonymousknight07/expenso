# Expenso — Setup & Mobile Install Guide

## 1. Run locally (development)

```bash
npm install
npm run dev        # opens on http://localhost:5173
```

Production build + local preview:

```bash
npm run build
npm run preview
```

> The app needs your Supabase credentials (already configured in `src/lib/supabase.ts` /
> environment). Nothing else is required.

## 2. Deploy (required for mobile install)

PWA installation and clipboard access require **HTTPS**, so deploy first.
The repo already has `vercel.json`, so Vercel is the fastest path:

```bash
npm i -g vercel     # once
vercel              # deploy preview
vercel --prod       # deploy production
```

Any static host (Netlify, Cloudflare Pages) works too — build output is in `dist/`.

## 3. Install on a phone

### Android (Chrome)
1. Open your deployed URL (e.g. `https://expenso-xxx.vercel.app`) in Chrome.
2. Tap the **⋮ menu → "Install app"** (or the "Add Expenso to Home screen" banner).
3. Confirm. Expenso now opens full-screen from its own icon, works offline for the UI,
   and appears in the app drawer like a native app.

### iPhone / iPad (Safari)
1. Open the deployed URL in Safari.
2. Tap the **Share button → "Add to Home Screen"**.
3. Confirm. The app opens standalone with the dark theme and app icon.

## 4. UPI auto-tracking on mobile

Phones do not let websites/PWAs silently read the SMS inbox (OS security restriction —
that would require a native Android app). Expenso gets as close as the platform allows,
with three capture paths:

| Path | How | Where |
|------|-----|-------|
| **Share to Expenso** (best on Android) | Long-press the bank SMS / UPI notification → **Share → Expenso** | The app opens UPI Sync with the message pre-parsed |
| **Auto-capture** | Toggle it on in UPI Sync, then just **copy** any payment message; it's detected the moment you switch back to Expenso | Android + desktop (iOS shows a paste-permission prompt) |
| **Paste** | Paste any number of messages into the box and hit *Detect transactions* | Everywhere |

What happens after capture:

- **Debited** amounts → added to **Expenses**, tagged with an auto-created **UPI**
  category; if that category has a budget for the month, its *spent* figure is updated,
  so budget alerts and totals stay correct.
- **Credited** amounts → added to **Income** (both `amount` and `in_hand_amount` are
  set, which is what Dashboard/Reports/Expenses sum), so *Balance = Income − Expenses*
  always adds up.
- **Duplicates** are skipped automatically using the UPI reference number (checked
  against both the database and a local history), so sharing the same SMS twice never
  double-counts.
- If you share a message while logged out, it's kept and processed right after login.

Supported formats: GPay, PhonePe, Paytm, and bank SMS (SBI/HDFC/ICICI-style wording).

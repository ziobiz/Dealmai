# Deal Pro — Project State

**Last updated:** 5 Jun 2026 (ontheline emails now redirected to support-only at send-time, replacing the ineffective Zero-Width-Space approach · earlier: ontheline Currencies CRUD + webhook currency validation · multi-event support Paid/Unpaid/Refund/Partial Refund/Fail · Orders show latest event per transaction_id · Today/Yesterday/This Month/Last Month/Period filters · multi-currency amount display with live USD conversion via Free Currency API · webhook-events show currency+amount+event)
**Status:** Production-ready · Phase 2 complete · Customer Portal complete · Admin enhancements complete · Branding system complete · **DM Champ Agency integration complete (incl. Grant Credits API for repeat purchases)**
**Owner:** Thai-speaking user (geeravut@gmail.com)
**Live URL:** https://dealmai.com (production · custom domain) · https://deal-pro-ai.netlify.app (Netlify deploy URL · still works)

---

## 🎯 What This Project Is

Deal Pro is an **AI Sales Agent SaaS web application** with two purchase flows:

1. **Direct purchase via ChillPay** — customers buy packages on the website, pay via Thai payment gateway (credit card, QR PromptPay, mobile banking, e-wallets) ✅ **Phase 1 + 2 complete + checksum verified**
2. **ontheline webhook** — customers buy through a partner system that forwards completed purchases to our webhook ✅ working

All flows result in: order created → customer account provisioned → invoice/receipt/credentials emailed via Resend → **DM Champ sub-account auto-provisioned** → customer can sign in to Portal to see active subscription + order history + DM Champ workspace credentials.

The system supports **4 languages**: English (master), Thai, Korean, Japanese. All UI strings are stored in Firestore and editable through the admin console. Currently **all 4 languages at 100%** (~485 keys each). System name and logo are also editable through the admin Branding panel. **DM Champ integration settings** (API key, credits-per-USD rate, default credits, rollover) are configurable through the admin DM Champ panel.

---

## 📁 File Structure

```
deal-pro-ai/
├── index.html                                  # All HTML + CSS (~62 KB)
├── app.js                                      # Application logic (~453 KB, ~7,730 lines)
├── netlify.toml                                # Netlify build + redirects + scheduled fn config
├── firestore.rules                             # Firestore Security Rules
├── package.json                                # firebase-admin dependency
├── PROJECT_STATE.md                            # ← this file
└── netlify/
    └── functions/
        ├── ontheline-webhook.js                # ✅ ontheline webhook receiver (records DM Champ credits for display — NO DM Champ API call)
        ├── send-queued-emails.js               # ✅ Scheduled function: sends queued emails via Resend
        ├── create-chillpay-payment.js          # ✅ Creates ChillPay payment + returns paymentUrl
        ├── chillpay-callback.js                # ✅ Receives ChillPay background callback + auto-provisions DM Champ
        ├── payment-result.js                   # ✅ Handles ChillPay POST return → 303 redirect to SPA
        ├── delete-customer.js                  # ✅ Hard-delete user from Auth + Firestore
        ├── provision-dmchamp.js                # ✅ Creates/tops-up DM Champ sub-account (auto + admin manual retry)
        └── lib/
            ├── email-templates.js              # ✅ Email HTML templates (5 kinds × 4 langs)
            ├── chillpay.js                     # ✅ ChillPay MD5/channels/currencies helpers
            ├── packages.js                     # ✅ Expiry computation + bucket inference helpers
            ├── exchange-rate.js                # ✅ USD→THB rate fetcher (cache 1hr, fallback)
            └── dmchamp.js                      # ✅ DM Champ SubAccounts API wrapper (create + lookup + grantCredits)
```

---

## 🏗️ Architecture

### Frontend (Client-side)
- **Pure HTML/CSS/JS** — no framework
- **Firebase Web SDK v12.13.0** loaded as ES modules from CDN
- Custom CSS with design tokens (warm off-white #f6f2ea, teal #0bb6c4, magenta #d6299b)
- **Kanit** font (primary), JetBrains Mono (labels)
- Fully responsive: 1100/880/560px breakpoints
- Mobile drawer for nav
- **dmchamp AI chat widget** embedded (script in `index.html` before `</body>`)

### Backend (Server-side)
- **Firebase Firestore** — data persistence
- **Firebase Authentication** — admin/customer login
- **Netlify Functions** — serverless Node.js for webhooks, payment creation, email sending, user deletion, DM Champ provisioning
- **Firebase Admin SDK** — used in all functions (service account)
- **Resend API** — email delivery
- **ChillPay API** — payment processing (Thai PSP)
- **DM Champ API** — sub-account provisioning (Agency tier required)
- **open.er-api.com** — free USD→THB exchange rate

### Deployment
- **Netlify** — drag & drop deploys
- Custom domain: `dealmai.com` (production · Squarespace registrar) + `deal-pro-ai.netlify.app` (Netlify default · also reachable)
- Auto-build of Netlify functions on every deploy
- Scheduled Functions enabled (run every 5 minutes for email sender)

---

## 🔥 Firebase Configuration

### Project
- **Project ID:** `deal-pro-ai-web-app`
- **Auth domain:** `deal-pro-ai-web-app.firebaseapp.com`
- **Storage bucket:** `deal-pro-ai-web-app.firebasestorage.app`

### Firebase Web Config (in app.js, safe to expose)
```javascript
{
  apiKey: "AIzaSyAiR-HKbkfiNJQqm8oBcmA0ZelQ7PTYaV8",
  authDomain: "deal-pro-ai-web-app.firebaseapp.com",
  projectId: "deal-pro-ai-web-app",
  storageBucket: "deal-pro-ai-web-app.firebasestorage.app",
  messagingSenderId: "426548482181",
  appId: "1:426548482181:web:09966f281d50bb744599ec",
  measurementId: "G-X9F07WC8YD"
}
```

**Note:** The `apiKey` is a Firebase Web API key — safe in client code.

---

## 📊 Firestore Collections

| Collection | Purpose | Writers |
|---|---|---|
| `users` | Admin + customer profiles (uid, email, role, mustChangePassword) | Backend + admin |
| `orders` | All orders (chillpay + ontheline) | Backend functions only |
| `packages` | Package catalog (credit, onetime, subscription buckets) | Admin only |
| `translations` | i18n strings keyed by language code (en/th/ko/ja) | Admin only |
| `email_queue` | Pending/sent emails (consumed by send-queued-emails) | Backend |
| `chillpay_events` | Audit log of every ChillPay API call + callback | Backend only |
| `webhook_events` | Audit log of every ontheline webhook event (incl. partner/paygw) | Backend only |
| `ontheline_partners` | Admin-managed partner codes `{code, companyName}` — validated by webhook | Admin (frontend) |
| `ontheline_paygw` | Admin-managed payment-gateway codes `{code, companyName}` — validated by webhook | Admin (frontend) |
| `ontheline_currencies` | Admin-managed currency codes `{code, symbol, label}` — validated by webhook; drives multi-currency amount display + USD conversion | Admin (frontend) |
| `config/webhook` | Single doc holding ontheline HMAC secret | Admin only |
| `config/branding` | Site name + logo + favicon + enabledLangs + dmchampPortalUrl (base64 data URLs) — public read | Admin only |
| `config/dmchamp` | DM Champ API key + credits-per-USD rate + defaults | Admin only |
| `audit_log` | User deletions + DM Champ provisioning + admin actions | Backend only |

### `users` document shape
```javascript
{
  uid: "firebase-auth-uid",
  email: "user@example.com",
  name: "Display Name",
  role: "admin" | "customer",
  source: "chillpay" | "ontheline" | "manual",
  mustChangePassword: true | false,
  createdAt: Timestamp
}
```

### `orders` document shape (ChillPay)
```javascript
{
  ref: "DP-CP-ABCDEF",
  source: "chillpay",
  status: "pending" | "paid" | "failed" | "cancelled",
  paymentMethod: "chillpay",
  paymentChannel: "creditcard" | "...",
  customer: { name, email, country, company, phone },
  items: [{ id, bucket, title, price, manual }],
  subtotal, vat, total,                 // in USD
  currency: "USD",
  receiptLang: "en" | "th" | "ko" | "ja",
  // ChillPay-specific
  chillpayOrderNo: "DPCP260521...",
  chillpayTransactionId: "587523",
  chillpayPaymentStatus: "0",
  chillpayBankRefCode: "639149",
  chillpayBankCode: "creditcard",
  chillpayChannelCode: "creditcard",
  chillpayPaymentDate: "20260521011045",
  chillpayAmount: 174785,                // THB in cents
  chillpayRawCallback: { ... },          // full callback payload
  fxRate: 32.5,
  paidAt: Timestamp,
  expiresAt: Timestamp,                  // paidAt + durationDays
  initialPassword: "x8Mdy...",           // ephemeral, removed after first sign-in
  // DM Champ provisioning (added when payment succeeds, agency tier required)
  dmchampSubAccount: {
    status: "created" | "linked" | "topped_up" | "failed",
    // status meaning:
    //   created   — new sub-account created for first-time customer (chillpay)
    //   topped_up — credits added on top of existing balance. TWO sub-cases:
    //                 • source≠'ontheline': real Grant Credits API call (chillpay
    //                   repeat purchase) — has uid + newBalance
    //                 • source='ontheline': SYNTHETIC record, NO API call made
    //                   (uid:null, httpStatus:0) — ontheline manages DM Champ
    //                   itself; we only mirror the credit figure for display
    //   linked    — existing sub-account but Grant Credits API failed;
    //               admin must add credits manually in DM Champ dashboard
    //   failed    — initial creation failed (other errors); admin can retry
    uid: "dm-champ-user-id",             // null when status='linked' or source='ontheline'
    email: "customer@example.com",
    tempPassword: "ABCxyz123",           // null when status='linked'/'topped_up'
    monthlyCredits: 500,                 // intended credit amount this order earns
    creditsGranted: 500,                 // actually applied (== monthlyCredits on success,
                                         // 0 on linked/failed; from DM Champ response on
                                         // chillpay topped_up; = computed credits on ontheline)
    newBalance: 1042,                    // post-grant total from DM Champ (chillpay topped_up
                                         // only; null for ontheline + all other states)
    creditsPerUsd: 100,                  // SNAPSHOT at time of provisioning — used by all UI
                                         // (My Account stats, Admin Orders Credits column, CSV export).
                                         // Frozen on the order so changing the admin rate later
                                         // doesn't retroactively change displayed credits.
    usdAmount: 5.00,                     // order SUBTOTAL used for credit calc (ex-VAT)
    source: "auto" | "manual" | "ontheline",  // 'ontheline' = synthetic no-API record
    actorEmail: "admin@x.com" | null,    // present when source='manual'
    httpStatus: 200,                     // 0 when source='ontheline' (no API call)
    attempts: 1,                         // 0 when source='ontheline'
    error: null | "...",                 // last error message when status='failed' or top-up failed
    createdAt: Timestamp,
    lastAttemptAt: Timestamp,
    raw: { ... }                          // full DM Champ response payload (null for ontheline)
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**ontheline orders** carry extra fields not present on ChillPay orders:
```javascript
{
  source: "ontheline",
  event: "Paid" | "Unpaid" | "Refund" | "Partial Refund" | "Fail",  // latest event for this row
  status: "paid" | "Partial Refund" | <event>,  // 'paid' for Paid; event string otherwise
  transactionId: "ot_xxx",   // ontheline txn id — Orders table shows only the LATEST event per txId
  partner: "PARTNER01",      // validated against ontheline_partners
  paygw:   "PAYGW01",        // validated against ontheline_paygw
  currency: "THB",           // validated against ontheline_currencies
  amountOriginal: 3550.00,   // amount in the original currency (what ontheline sent)
  amountUsd: 100.00,         // converted to USD (credit math + display); subtotal mirrors this
  fxRate: 35.5,              // units of `currency` per 1 USD at conversion time
  fxSource: "freecurrencyapi.com" | "open.er-api.com" | "hardcoded-fallback" | "identity",
  // ...common fields (ref DP-OT-..., customer, items, totals, dmchampSubAccount for Paid/Partial Refund)
}
```
Only **Paid** and **Partial Refund** events provision a user + send emails + record DM Champ credits. Other events (Unpaid/Refund/Fail) write a lean order for the audit trail only. The Orders table de-duplicates by `transaction_id`, showing the newest event and floating updated transactions to the top.

### `ontheline_currencies` document shape
```javascript
{
  code: "THB",                // ISO 4217, matched case-insensitively against the webhook currency + used for FX lookup
  symbol: "฿",                // shown next to amounts in Orders / webhook events
  label: "Thai Baht",         // admin reference
  createdAt: Timestamp,
  createdBy: "admin@email.com"
}
```

### `ontheline_partners` / `ontheline_paygw` document shape
```javascript
{
  code: "PARTNER01",          // matched case-insensitively against the webhook value; unique within its collection
  companyName: "Acme Travel Co., Ltd.",  // for admin reference + shown in Orders / webhook events
  createdAt: Timestamp,
  createdBy: "admin@email.com",
  updatedAt: Timestamp,       // present after an edit
  updatedBy: "admin@email.com"
}
```
The ontheline webhook reads both collections (via Admin SDK) on every call and rejects payloads whose `partner`/`paygw` doesn't match an existing code (HTTP 400). Managed from Admin → ontheline Partners / ontheline Payment Gateways.


```javascript
{
  bucket: "credit" | "onetime" | "sub",
  title: "Atelier",
  description: "...",
  price: 50,                           // USD
  durationDays: 30 | null,             // null for credit (no expiry)
  featured: true | false,
  order: 1,
  manual: false                        // true for "custom amount" placeholder
}
```

### `config/branding` document shape
```javascript
{
  siteName: "Deal Pro",                // brand name shown everywhere
  logoDataUrl: "data:image/png;base64,...",  // null = use default (header logo, ~300×100)
  faviconDataUrl: "data:image/png;base64,...", // null = use default gradient-D SVG (browser-tab icon, square)
  // DM Champ sign-in URL surfaced to customers (in emails + "Open DM Champ"
  // buttons in the customer portal). Stored here — NOT in config/dmchamp —
  // because this doc is public-read; non-admin customers need to read it for
  // the portal CTA. config/dmchamp stays admin-only since it holds the API key.
  // Default is "https://app.dmchamp.com"; agency customers with a White-Label
  // custom domain set this to e.g. "https://app.dealmai.com".
  dmchampPortalUrl: "https://app.dealmai.com",
  updatedAt: Timestamp,
  updatedBy: "admin@email.com"
}
```

### `config/dmchamp` document shape
```javascript
{
  apiKey: "dmc_...",                   // DM Champ Agency API key (admin-only read)
  enabled: true,                       // toggle for auto-provisioning
  creditsPerUsd: 100,                  // $1 paid → 100 DM Champ credits
  defaultMonthlyCredits: 1000,         // fallback when amount can't be computed
  rollOverToNextMonth: false,          // whether unused credits carry over
  timeZoneId: "Asia/Bangkok",
  country: "TH",                       // default ISO-2 country code
  updatedAt: Timestamp,
  updatedBy: "admin@email.com"
  // NOTE: portalUrl deliberately lives in config/branding (public-read) so
  // the customer portal can read it. Admin → DM Champ → Portal URL writes
  // to both docs but config/branding is the source of truth at read time.
}
```

---

## 🔒 Firestore Security Rules

```javascript
match /databases/{database}/documents {
  function isAdmin() {
    return request.auth != null
      && exists(/databases/$(database)/documents/users/$(request.auth.uid))
      && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
  }

  match /users/{userId} {
    allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());
    allow create: if request.auth != null && request.auth.uid == userId;
    allow update: if request.auth != null && (request.auth.uid == userId || isAdmin());
    allow delete: if isAdmin();
    allow list: if true;                    // adminExists() probe needs this
  }
  match /packages/{pkgId} {
    allow read: if true;
    allow write: if isAdmin();
  }
  match /translations/{lang} {
    allow read: if true;
    allow write: if isAdmin();
  }
  match /orders/{orderId} {
    // Customer can read their own orders (email-matched), admin reads all
    allow read: if isAdmin()
             || (request.auth != null && resource.data.customer.email == request.auth.token.email);
    allow write: if isAdmin();
  }
  match /email_queue/{emailId} {
    allow read, write: if isAdmin();
  }
  match /chillpay_events/{eventId} {
    allow read: if isAdmin();
    allow write: if false;                  // only backend (Admin SDK) writes
  }
  match /webhook_events/{eventId} {
    allow read:  if isAdmin();
    allow write: if isAdmin();              // admin "Fire Test Webhook" button writes
  }
  match /audit_log/{logId} {
    allow read:  if isAdmin();
    allow write: if false;                  // only backend (Admin SDK) writes
  }
  // config/branding is publicly readable so guests get the logo + site name;
  // config/webhook holds the HMAC secret (admin-only);
  // config/dmchamp holds the DM Champ API key (admin-only — NEVER expose).
  match /config/{configId} {
    allow read:  if configId == "branding" || isAdmin();
    allow write: if isAdmin();
  }
}
```

---

## 🌐 Netlify Configuration

### Site
- **Site name:** deal-pro-ai
- **Production URL:** https://dealmai.com (canonical · custom domain) · https://deal-pro-ai.netlify.app (still reachable as the Netlify default)
- **Publish directory:** `.`
- **Functions directory:** `netlify/functions/`
- **Smart secret scanning:** disabled (false positive on Firebase Web API key)

### Environment Variables
| Name | Purpose | Production value (30 May 2026) |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project | `deal-pro-ai-web-app` |
| `FIREBASE_CLIENT_EMAIL` | Service account email | (set) |
| `FIREBASE_PRIVATE_KEY` | Service account private key (escaped `\n`) | (set) |
| `RESEND_API_KEY` | Resend API key | (set) |
| `EMAIL_FROM` | From address shown to recipients | `Deal Pro <noreply@dealmai.com>` |
| `EMAIL_REPLY_TO` | Reply-To used by Resend + read by `email-templates.js` `loadBranding()` to fill the supportEmail field | `support@dealmai.com` |
| `EMAIL_TEST_REWRITE_TO` | Resend test-mode workaround | **deleted 30 May 2026** (no longer needed — Resend domain verified) |
| `PUBLIC_SITE_URL` | Read by `email-templates.js` `loadBranding()` to fill the portalUrl field | `https://dealmai.com` |
| `CHILLPAY_MERCHANT_CODE` | ChillPay merchant code | `M038296` |
| `CHILLPAY_API_KEY` | ChillPay API key | (set) |
| `CHILLPAY_MD5_SECRET` | ChillPay MD5 secret key | (set) |
| `CHILLPAY_MODE` | `sandbox` or `production` | `sandbox` (will switch for go-live) |
| `ONTHELINE_WEBHOOK_SECRET` | Fallback HMAC secret (Firestore `config/webhook` takes precedence) | (set) |
| `WEBHOOK_TEST_MODE` | When `true`, bypasses HMAC verification | **not set** (= signature verification ON · ready for production webhooks) |
| `DMCHAMP_API_KEY` | Fallback DM Champ Agency API key (Firestore `config/dmchamp` takes precedence) | (set) |

### netlify.toml Redirects
- `/api/ontheline-webhook` → `ontheline-webhook` function
- `/api/send-emails-now` → `send-queued-emails` (manual trigger)
- `/api/create-chillpay-payment` → `create-chillpay-payment`
- `/api/chillpay-callback` → `chillpay-callback`
- `/api/delete-customer` → `delete-customer`
- `/api/provision-dmchamp` → `provision-dmchamp`
- `/payment-result`, `/payment-result/`, `/payment-result/*` → `payment-result` (force flag required for POST)
- `/*` → `/index.html` (SPA catch-all, no force flag)

**Note:** Frontend currently calls `/.netlify/functions/delete-customer` and `/.netlify/functions/provision-dmchamp` directly (not the `/api/*` aliases) due to a redirect-cache issue on Netlify's edge — stale 404 responses linger after a new redirect is added. The `/api/*` alias works for all other functions.

---

## 🪪 Google Cloud IAM (Service Account)

- **Service account:** `firebase-adminsdk-fbsvc@deal-pro-ai-web-app.iam.gserviceaccount.com`
- **Roles:** Firebase Admin, Cloud Datastore User
- **Used by:** All Netlify Functions for Firestore + Firebase Auth admin operations

---

## 🔗 Webhook & API Endpoints

### 1. ontheline Webhook (✅ working)
- **URL:** `POST /api/ontheline-webhook`
- **Signature:** HMAC-SHA256 in `X-Webhook-Signature` header
- **Secret source:** Reads `config/webhook.secret` from Firestore first, falls back to `ONTHELINE_WEBHOOK_SECRET` env var
- **Test mode:** `WEBHOOK_TEST_MODE=true` bypasses signature check (current setting — must be false in production)
- **Flow:** Verify signature → idempotency check (by `transactionId` in `webhook_events`) → **validate `partner` + `paygw` codes against `ontheline_partners` / `ontheline_paygw` (HTTP 400 on missing/unknown)** → match items via `matchPackagesForAmount` → write `webhook_events` audit entry (incl. partner/paygw) → create order (`source: 'ontheline'`, `partner`, `paygw`, `subtotal` = ontheline amount, pre-VAT) → provision/find Deal Pro user (Firebase Auth) → queue invoice/receipt/credentials emails (each tagged `source:'ontheline'` for ZWSP) → **record DM Champ credits for display (NO DM Champ API call)** → queue `dmchamp_linked` email
- **Required payload fields (31 May 2026):** in addition to `customer.email` + `amount`, ontheline must now send `partner` (a code present in `ontheline_partners`) and `paygw` (a code present in `ontheline_paygw`). Both are matched case-insensitively. Missing → `400 {error:'Missing required field: partner'|'...paygw'}`; unknown → `400 {error:'Unknown partner code: X', field:'partner'}` (or paygw). **Admin must create at least one partner + one paygw entry before ontheline can call the webhook successfully.**
- **Currency + event (1 Jun 2026):** `currency` must be a code present in `ontheline_currencies` → unknown gives `400 {field:'currency'}`. `event` accepts **Paid / Unpaid / Refund / Partial Refund / Fail** (legacy `purchase.completed` → Paid) → unknown gives `400 {field:'event'}`. Only **Paid** + **Partial Refund** provision the user / send emails / record credits; others create a lean audit order only. The amount is converted to USD (`currency-convert.js`) and stored as `amountUsd` alongside `amountOriginal`. **Admin must create at least one currency entry (e.g. USD $) too.** Idempotency is per-(`transaction_id` + `event`), so the same transaction can post multiple events over time — the Orders table shows only the latest per `transaction_id`.
- **⚠️ DM Champ handling for ontheline is DELIBERATELY different from ChillPay** (28 May 2026): ontheline manages DM Champ provisioning + crediting on ITS OWN side, so Deal Pro must NOT create, look up, or top-up anything via the DM Champ API for ontheline orders. Instead the webhook:
  1. Reads `creditsPerUsd` from `config/dmchamp` (Firestore read only — no network call) and computes `creditsEarned = amount × creditsPerUsd` via `dmchamp.computeMonthlyCredits()` (pure function)
  2. Writes a **synthetic** `order.dmchampSubAccount` record with `status: 'topped_up'`, `source: 'ontheline'`, `uid: null`, `tempPassword: null`, `httpStatus: 0`, `creditsGranted: creditsEarned`, `creditsPerUsd` snapshot. The `httpStatus:0` + `uid:null` + `source:'ontheline'` markers make it unambiguous that no API call happened.
  3. Queues the `dmchamp_linked` email template (subject "Your DM Champ workspace is linked to this purchase") for EVERY ontheline order — new or returning customer alike
  4. Writes an `audit_log` entry with action `dmchamp_ontheline_credit` and a note that no API call was made
- **Why:** double-provisioning would be wrong — ontheline already created/credited the customer's DM Champ workspace. Deal Pro only mirrors the credit figure so it shows up consistently in the admin (Users/Orders) and Customer Portal.
- **Admin → Orders → View for an ontheline order:** the DM Champ Sub-Account section shows ONLY "✓ Topped up by N credits" (no formula block, no retry button, no email/uid fields) because there's no API interaction to retry or detail.


### 2. ChillPay Payment Creation (✅ working)
- **URL:** `POST /api/create-chillpay-payment`
- **Auth:** None (called from public checkout form)
- **Input:** customer info + items + USD totals
- **Output:** `paymentUrl` for ChillPay's hosted checkout page
- **Notable behavior:**
  - Strips `+tag` from email when sending CustEmail to ChillPay (Gmail "+address" workaround)
  - Resolves IPv4 from `x-forwarded-for` chain (ChillPay rejects IPv6)
  - USD → THB conversion using `open.er-api.com` (1hr cache + 32.5 fallback)
  - 20-field outbound checksum per v1.2.5 Table 2.2

### 3. ChillPay Background Callback (✅ verified working)
- **URL:** `POST /api/chillpay-callback`
- **Auth:** MD5 checksum verification (16-field format)
- **Checksum format:** `v1.2.5-16-MC-RN-end (raw secret)` — empirically verified against real callbacks
- **Flow:** Verify checksum → find order by `chillpayOrderNo` → idempotency check → update status → provision/update user → compute `expiresAt` from package `durationDays` → queue emails → **auto-provision DM Champ sub-account (best-effort, in-process call to `provisionForOrder`)**
- **Audit:** Every callback writes to `chillpay_events` collection (rawParams + verified + receivedChecksum + computedChecksum + error/note + `dmchampProvisioned` + `dmchampUid` or `dmchampError`)

### 4. ChillPay Payment Result Return (✅ working)
- **URL:** `POST /payment-result` (browser-side redirect from ChillPay)
- **Why a function:** Netlify static hosting returns 404 for POST on static HTML; function parses POST body and issues 303 See Other to `/index.html?<params>#payment-result`
- **SPA:** Reads URL query params + polls Firestore every 3s for up to 60s to flip from "Processing" to "Paid"

### 5. Email Sender (✅ working)
- **URL:** `POST /api/send-emails-now` (manual trigger) or scheduled every 5 min
- **Reads:** `email_queue` where `status="pending"` (batch of 25)
- **Sends:** Via Resend API with retry (5 max)
- **Test rewrite:** If `EMAIL_TEST_REWRITE_TO` env var is set, rewrites recipient + tags subject `[TEST → original@]`

### 6. Delete Customer (✅ working)
- **URL:** `POST /.netlify/functions/delete-customer` (direct path; `/api/*` redirect not yet refreshed)
- **Auth:** Firebase ID token of caller in `Authorization: Bearer <token>` header
- **Verifies:** Caller has `role='admin'` in Firestore + not deleting self
- **Action:** Deletes Firebase Auth account + Firestore `users/{uid}` doc + writes `audit_log` entry
- **Tolerates:** `auth/user-not-found` (already-deleted Auth user) → still cleans up Firestore profile

### 7. Provision DM Champ Sub-Account (✅ working)
- **URL (manual retry):** `POST /.netlify/functions/provision-dmchamp` (direct path; `/api/*` redirect cache issue)
- **Diagnostic:** `GET /.netlify/functions/provision-dmchamp` returns config status (no auth, no secrets exposed)
- **Auth (POST):** Firebase ID token of caller in `Authorization: Bearer <token>` header — admin-only
- **Body:** `{ orderRef: "DP-..." }` OR `{ orderId: "<docId>" }`
- **Two invocation paths:**
  1. **Auto from ChillPay (in-process)**: `chillpay-callback.js` requires this file and calls `provisionForOrder()` directly after payment succeeds — no HTTP call, no auth needed
  2. **Manual HTTP**: Admin Orders View modal "Provision/Retry" button POSTs here with admin Bearer token
- **NOT used by ontheline:** ontheline orders deliberately do NOT call `provisionForOrder()` — they record DM Champ credits for display only without any API call (see Endpoint #1 above). This is because ontheline manages DM Champ provisioning on its own side.
- **Idempotent:** If `order.dmchampSubAccount.status === 'created'` OR `'topped_up'`, returns existing record without re-calling DM Champ
- **`forceLinkedEmail` option:** `provisionForOrder(db, admin, order, ref, { forceLinkedEmail: true })` makes even a brand-new sub-account queue the `dmchamp_linked` email instead of `dmchamp_access`. Currently unused (ontheline no longer calls provisionForOrder), kept for future flexibility.
- **DM Champ API calls used:**
  - `POST https://api.dmchamp.com/v1/subaccounts?apiKey=<key>` — create new sub-account (first-time customer)
  - `GET https://api.dmchamp.com/v1/subaccounts?apiKey=<key>&email=<email>` — look up existing sub-account by email (for top-up flow)
  - `POST https://api.dmchamp.com/v1/subaccounts/credits?apiKey=<key>` — Grant Credits API (top-up flow for repeat purchases). Body: `{email, amount, description}`. Response includes `sub_account_id`, `credits_added`, `new_balance`. **Endpoint confirmed via DM Champ docs (`help.dmchamp.com/agency/sub-account-auto-recharge`)** — NOT `/grant_credits` as initially guessed
- **Credit calc:** `monthlyCredits = round(order.subtotal × cfg.creditsPerUsd)` with `cfg.defaultMonthlyCredits` fallback. **Uses SUBTOTAL (before VAT), not total** — rationale: VAT is collected for the tax authority and shouldn't change credit grants between jurisdictions. Falls back to `order.total` only for legacy orders missing `subtotal`.
- **Four result states** written to `order.dmchampSubAccount`:
  - `created` — new sub-account created (first-time customer), temp password returned, `dmchamp_access` email queued
  - `topped_up` — has TWO sub-cases distinguished by the `source` field:
    - `source` ≠ `'ontheline'` (chillpay/direct repeat purchase): existing sub-account received additional credits via the Grant Credits API; `dmchamp_linked` email queued with `toppedUp: true` + `creditsGranted` + `newBalance` from DM Champ response. Order View shows full detail + retry button.
    - `source` = `'ontheline'`: synthetic record written by `ontheline-webhook.js` WITHOUT any API call (`uid: null`, `httpStatus: 0`); used only so credits display consistently. Order View shows just "✓ Topped up by N credits".
  - `linked` — repeat purchase but Grant Credits API failed → fallback with `creditsGranted: 0` for admin to manually intervene in DM Champ dashboard, `dmchamp_linked` email queued with `toppedUp: false`
  - `failed` — initial creation errors → admin can retry from Order View modal
- **Audit:** Writes to `audit_log` with action `dmchamp_provision`, `dmchamp_top_up`, `dmchamp_linked` (provisionForOrder paths), or `dmchamp_ontheline_credit` (ontheline no-API path) + actor + source + creditsGranted + newBalance (where applicable)

---

## 💰 Package Catalog

### Three Buckets

#### 1. Credit Purchase (`credit.*`)
| ID | Title | Price | Duration |
|---|---|---|---|
| credit.5 | Starter | $5 | No expiry |
| credit.10 | Essentials | $10 | No expiry |
| credit.20 | Studio | $20 | No expiry · **Featured** |
| credit.50 | Atelier | $50 | No expiry |
| credit.100 | House | $100 | No expiry |

Plus a **Manual Input** card where customers can enter a custom amount.

#### 2. 1-Time Access (`onetime.*`)
| ID | Title | Price | Duration (days) |
|---|---|---|---|
| onetime.3d | 3 Days | $100 | 3 |
| onetime.7d | 7 Days | $150 | 7 |
| onetime.14d | 14 Days | $300 | 14 |
| onetime.1m | 1 Month | $500 | 30 |
| onetime.3m | 3 Months | $1,000 | 90 · **Featured** |
| onetime.6m | 6 Months | $3,000 | 180 |
| onetime.12m | 12 Months | $5,000 | 365 |
| onetime.24m | 24 Months | $10,000 | 730 |

#### 3. Subscription (`sub.*`)
| ID | Title | Price | Duration (days) |
|---|---|---|---|
| sub.1m | 1 Month | $500 | 30 |
| sub.3m | 3 Months | $1,000 | 90 · **Featured** |
| sub.6m | 6 Months | $3,000 | 180 |
| sub.12m | 12 Months | $5,000 | 365 |
| sub.24m | 24 Months | $10,000 | 730 |

### Duration Logic (`packages.js` lib)
- `computeItemExpiry(item, paidAt)` — returns expiry date for a single item based on bucket + durationDays
- `computeOrderExpiry(order, paidAt)` — picks latest expiry across order's items
- `computeOrderExpiryWithExtension(order, existingExpiry, paidAt)` — for repeat purchases of same bucket, **extends** existing expiry instead of replacing
- `inferBucket(itemId)` — derives bucket from id prefix
- `inferDurationDays(itemId)` — fallback when package doc has no durationDays

### Matching Algorithm (for ontheline webhook)
1. Match by exact id first
2. Match by USD amount within ±$0.50 tolerance
3. If no match, generate a "manual" item with the exact amount

### Realtime Package Updates ✅
- When admin adds/edits/removes packages, all open browsers (customers on Packages page, admin on Packages console, customers in Checkout) see the change instantly without refresh
- **Visual flash animation**: changed cards pulse teal, new cards pulse green
- **Toast notification**: "1 package(s) updated" when changes occur (only on pages displaying packages)
- **Checkout protection**: if selected package price changes during checkout, total updates + toast shown; if package is deleted, customer is kicked back to packages page

---

## 🎨 Branding System ✅ (NEW)

Admin can customize site name and logo via **Admin → Branding**.

### Features
- **Site Name** input (max 60 chars) — replaces every "Deal Pro" instance across header, footer, browser tab, **hero copy, login subtitle, server-rendered emails, admin previews** (29 May 2026)
- **Logo Upload** (PNG/JPEG/SVG/WebP, max 500 KB) — shown in site header
- **Default Logo** embedded as base64 in app.js (~29 KB PNG) — used when no custom logo is set
- **Favicon Upload** (31 May 2026) — browser-tab icon (PNG/ICO/SVG/WebP, square, max 100 KB) stored in `config/branding.faviconDataUrl`. Includes a live "tab preview" mimicking a browser tab. Default is an inline gradient-"D" SVG. See "Favicon" subsection below.
- **Reset buttons** — revert to defaults
- **Live Preview** — see brand name preview before saving
- **Last Updated audit** — shows who changed it and when
- **DM Champ Portal URL** (30 May 2026) — admins can point the customer-facing "Open DM Champ" buttons + email links at a White-Label custom domain (e.g. `https://app.dealmai.com`) instead of `app.dmchamp.com`. Stored in `config/branding.dmchampPortalUrl` (public-read) so the customer portal can use it without admin privileges. See "DM Champ Integration" below for details.

### How It Works
- Stored in Firestore `config/branding` doc (publicly readable for guests)
- `subscribeBranding()` listener triggers `applyBranding()` on every snapshot
- `applyBranding()` updates header logo image OR wordmark fallback, footer name, document title, AND calls `I.apply()` to re-render every `[data-i18n]` element so strings containing the `{brand}` placeholder pick up the new site name (29 May 2026)
- Wordmark auto-splits multi-word names into `"First <em>Rest</em>"` for the existing gradient styling

### Dynamic `{brand}` Placeholder (29 May 2026)
Six i18n keys use the `{brand}` placeholder so the site name flows into them at render time instead of being hardcoded:
- `hero.lede` × 4 langs ("{brand} is an autonomous AI sales agent...")
- `login.sub` × 4 langs ("Access your {brand} account")

`I.t(key, ph)` substitutes `{brand}` automatically from `State.branding.siteName` (with fallback to `DEFAULT_BRANDING.siteName`) unless the caller explicitly passes `ph.brand`. Same `{brand}` pattern is also used by server-rendered emails (see Email System / Branding below).

### Favicon (browser-tab icon) ✅ (31 May 2026)
Admins can upload a custom favicon in Admin → Branding. Stored as a base64 data URL in `config/branding.faviconDataUrl` (shares the public-read doc with logo + site name).
- **Upload card** sits full-width below the Site Name + Logo cards. Includes a live "tab preview" that mimics a browser tab (favicon + site name + ✕) so admins see exactly how it'll look.
- **Accepted:** PNG, ICO (`image/x-icon` or `image/vnd.microsoft.icon`), SVG, WebP. Square recommended, ≥32×32 px. Max 100 KB (favicons are tiny; keeps the Firestore doc well under the 1 MB limit it shares with `logoDataUrl`).
- **Default:** an inline gradient-"D" SVG defined in `index.html` (`<link rel="icon" data-brand-favicon-default>`). This is what shows before/without a custom upload, so the tab always has a branded icon instead of the browser globe.
- **Chrome favicon-cache fix:** Chrome caches favicons aggressively and ignores an in-place `href` change on an existing `<link>`. `applyBranding()` therefore **removes every icon link and recreates a single fresh one** on each run (rather than mutating the existing link's href). This forces Chrome to re-evaluate. MIME type is inferred from the data URL prefix so PNG/ICO/SVG all render. Handlers: `AdminActions.uploadBrandFavicon` / `resetBrandFavicon`. Even with this, Chrome may keep the old tab icon until the tab is closed + reopened (or tested in Incognito) — documented as expected browser behavior.
- **i18n:** `admin.branding.favicon.*` + `toast.branding.favicon.*` × 4 langs.

### What Changes Across the App
| Surface | Update | Notes |
|---|---|---|
| Header (top-left) | Logo image OR wordmark glyph + text | Instant via realtime listener |
| Footer | "© 2026 [name]" | Instant |
| Browser tab title | "[name] · AI Sales Agent" | Instant |
| Browser tab icon (favicon) | custom uploaded icon, or default gradient-D SVG | Instant — link removed+recreated to beat Chrome's favicon cache |
| Home hero lede | "[name] is an autonomous AI sales agent…" | Instant (via `{brand}` substitution + `I.apply()`) |
| Login subtitle | "Access your [name] account" | Instant |
| Admin invoice/email preview modals | "[name]" header + "© [name]" footer | Instant |
| Server-rendered emails (5 kinds × 4 langs) | Subject, intro, footer, CTA labels | Next email send (server reads Firestore via cached `loadBranding(db)`, 30s cache) |
| All open browsers | Instant via realtime listener | Single Firestore listener powers it all |

### `STALE_VALUE_OVERRIDES` — Migrating Pre-existing Firestore Seeds
When the project was first set up, Firestore was seeded with `hero.lede` etc. that had `"Deal Pro"` literal-text baked in (no `{brand}` placeholder). The new code uses `{brand}` placeholder but `I.t()` reads Firestore *before* falling back to DEFAULT_STRINGS, so seeded copies hide the fix. To migrate without manual Firestore edits, `STALE_VALUE_OVERRIDES` maps the legacy seeded value → the new placeholder-based value at runtime. Same pattern was reused for the ChillPay → Payment Gateway rebrand (see Translation System below).

### Limitations (Current Phase)
- Hardcoded "Deal Pro" in `BRAND_DEFAULTS` (email-templates.js) and `DEFAULT_BRANDING.siteName` (app.js) acts as the fallback when Firestore is unavailable — these are intentional defaults, not bugs.
- Old Firestore seeds with "Deal Pro" or "ChillPay" literal text still need migration via STALE_VALUE_OVERRIDES + an unconditional ChillPay→Payment Gateway pass in `I.t()` (see ChillPay → Payment Gateway rebrand log entry for the 30 May 2026 fix).

---

## 🤖 DM Champ Integration ✅ (NEW)

Every paying customer gets a DM Champ AI workspace automatically. DM Champ is an external AI-chat SaaS (https://dmchamp.com) where the actual conversation agent lives — Deal Pro handles billing + access provisioning.

### Features
- **Auto-provisioning** — every successful ChillPay payment triggers `provisionForOrder()` in-process from `chillpay-callback.js`
- **Manual retry** — admin can re-trigger from Order View modal "Provision/Retry" button (calls HTTP endpoint with Bearer token)
- **Idempotent** — re-running on an already-provisioned order is a no-op
- **Three-state UI** — created (green), linked (teal), failed (red) — with retry button on failed/linked states
- **Customer Portal card** — shows DM Champ email + credits + temp password (when applicable) + "Open DM Champ" CTA
- **Long-string handling** — UID + temp password fields use `word-break: break-all` + Copy button (via `data-copy` attribute + `App.copyFromAttr()` helper)
- **Linked-account fallback** — when DM Champ returns "email already in use" (customer had a DM Champ account before purchasing), Deal Pro marks status as `linked` and sends a different email template that does NOT include a temp password
- **4 language support** for all admin UI + customer card + 2 email templates (dmchamp_access + dmchamp_linked)

### How It Works
1. **Customer pays via ChillPay** → `chillpay-callback.js` verifies checksum, marks order paid, queues invoice/receipt/credentials emails
2. **In-process call** to `require('./provision-dmchamp').provisionForOrder(db, admin, order, orderRef, { source: 'auto' })` — does NOT go over HTTP, no auth needed
3. `provisionForOrder()` reads `config/dmchamp` → calls `dmchamp.createSubAccount()` → `POST https://api.dmchamp.com/v1/subaccounts?apiKey=...`
4. On success → writes `order.dmchampSubAccount` with status `created` + queues `dmchamp_access` email
5. On "email already in use" → writes status `linked` + queues `dmchamp_linked` email
6. On other errors → writes status `failed` + admin can retry from UI
7. Best-effort: payment flow does NOT fail even if DM Champ provisioning fails

### Credit Calculation
- `monthlyCredits = round(order.total_USD × cfg.creditsPerUsd)` with minimum 1
- Falls back to `cfg.defaultMonthlyCredits` (1000) when amount can't be computed
- Admin sets `creditsPerUsd` in Admin → DM Champ panel (default 100, meaning $1 = 100 credits)

### Configuration (`config/dmchamp` Firestore doc)
- `apiKey` — Agency-tier API key from DM Champ Settings → API Access
- `enabled` — toggle for auto-provisioning (when off, payment still works, just no DM Champ call)
- `creditsPerUsd` — conversion rate (default 100)
- `defaultMonthlyCredits` — fallback minimum (default 1000)
- `rollOverToNextMonth` — whether unused DM Champ credits carry over (default false)
- `timeZoneId` — default tz for sub-accounts (default "Asia/Bangkok")
- `country` — default ISO-2 country code (default "TH")

### Customer-facing Portal URL ✅ (30 May 2026)
Stored separately at `config/branding.dmchampPortalUrl` (NOT in `config/dmchamp`) because the customer portal needs to read it without admin privileges.
- **Default:** `https://app.dmchamp.com` — DM Champ's hosted app
- **White-Label override:** e.g. `https://app.dealmai.com` — customer's own branded subdomain
- **Where it appears:** "Open DM Champ" buttons in My Account portal · `dmchamp_access` + `dmchamp_linked` email CTA buttons + plain-text fallback
- **Admin UI:** Admin → DM Champ → "Portal URL" input. On save, writes to BOTH `config/dmchamp` (for backwards compat) and `config/branding.dmchampPortalUrl` (the source of truth at read time)
- **Validation:** must start with `http://` or `https://`; trailing slashes trimmed; invalid URL falls back to default at render time (so a broken setting never produces a non-clickable email)
- **Realtime sync:** `subscribeBranding` watches `config/branding` → updates `State.dmchamp.portalUrl` → re-renders customer portal immediately (no reload)
- **Server-side:** `email-templates.js`'s `loadBranding(db)` reads the same field from `config/branding` (30s cache); render functions consume `brand.dmchampPortalUrl`

### DM Champ Domain White-Label Setup (Agency Custom Domain) ✅ (30 May 2026)
Beyond just rewriting the URL in our links, customers can host the DM Champ workspace UI on their own subdomain via DM Champ's built-in White-Labeling feature:
- **Setup steps:**
  1. DM Champ → Settings → White Labeling → set Custom Domain (e.g. `app.dealmai.com`) + upload logo
  2. Add CNAME record at the user's DNS provider: `app` → `tenants.youraiconnector.com` (the exact target is shown in DM Champ's "Verify Custom Domain" dialog)
  3. Wait for DNS propagation (5 min–24 hr) + SSL provisioning (additional 5–15 min)
  4. Click "Verify" in DM Champ → status flips to Active
- **Diagnostic commands:** `nslookup app.dealmai.com` should return a CNAME chain to `tenants.youraiconnector.com`. Use `dnschecker.org` to see global propagation.
- **Browser cache trap:** Visiting the custom domain BEFORE setup completes can cache an error page. Fix: Chrome → `chrome://net-internals/#dns` → Clear host cache + flush sockets, OR test in Incognito.
- **⚠️ CRITICAL — where to put the CNAME (resolved 30 May 2026):** `dealmai.com` is registered at Squarespace BUT its **nameservers are set to Netlify DNS** (`dns1-4.p01.nsone.net` — NS1/nsone.net is Netlify's DNS backend). This means **DNS records are read from Netlify DNS, NOT from the Squarespace DNS Settings panel.** A CNAME added in Squarespace's DNS Settings will be IGNORED because the nameservers don't point there. The `app`/`docs`/`api` CNAMEs MUST be added in **Netlify → Domains → dealmai.com → DNS records**, not in Squarespace. (This was the root cause of `app.dealmai.com` returning "site can't be reached" — the CNAME was in the wrong DNS provider.) Verify which DNS is authoritative with `nslookup -type=NS dealmai.com` → if it returns `*.nsone.net`, use Netlify DNS. The apex `dealmai.com` + `www` work because Netlify DNS auto-creates those records when you add the custom domain; subdomains must be added manually in Netlify DNS.
- **Production status (31 May 2026):** Owner confirmed `dealmai.com` nameservers ARE the Netlify/NS1 set (`dns1-4.p01.nsone.net`) and the apex site points at Netlify. So the `app`/`docs`/`api` CNAMEs the owner had added in the **Squarespace** DNS Settings panel are non-authoritative and ignored — they must be re-added in **Netlify → Domains → dealmai.com → DNS records**. Pending: add CNAME `app → tenants.youraiconnector.com` in Netlify DNS, wait for resolve, click Verify in DM Champ, wait for SSL.
- **Coordination with Deal Pro:** Once `app.dealmai.com` is live, admin sets Portal URL field above to `https://app.dealmai.com` so all customer-facing links (portal buttons + emails) point at the branded domain. The two changes are independent — DM Champ verifies the domain regardless of what Deal Pro's portalUrl is set to.

### Email Templates Added
- `dmchamp_access` — Welcome email + login email + temp password + credits + portal link
- `dmchamp_linked` — Existing account linked (no password — uses "Forgot password" hint)

### Customer-Facing Product Name: "Ai Portal" / "DealMai Ai" ✅ (30 May 2026)
The DM Champ workspace is **white-labeled to customers** under two display names, while the admin console + code keep calling it "DM Champ" (the real product admins configure):

| Surface | Customer sees | Implemented via |
|---|---|---|
| Customer portal (My Account) | **"Ai Portal"** | i18n `account.dmchamp.*` values + scoped runtime substitution |
| "Open …" buttons (portal) | **"Open Ai Portal"** | `account.dmchamp.open` |
| Emails (subject + body, all 5 kinds) | **"DealMai Ai"** | `email-templates.js` EMAIL_STRINGS (4 langs) |
| Admin console (DM Champ page, Order View) | "DM Champ" (unchanged) | `admin.dmchamp.*` left as-is |

- **Customer portal** — every `account.dmchamp.*` i18n value reads "Ai Portal". Three-layer safety (same pattern as ChillPay rebrand): DEFAULT_STRINGS edited + STALE_VALUE_OVERRIDES for `open`/`toppedUp`/`title`/`pending`/`failed`/`linked` + **scoped unconditional substitution** in `I.t()` that replaces "DM Champ"→"Ai Portal" ONLY for keys starting `account.dmchamp.` (so the admin console keeps "DM Champ").
- **Emails** — `email-templates.js` EMAIL_STRINGS replaced "DM Champ"→"DealMai Ai" across 32 values (8 keys × 4 langs). Also de-duplicated "DealMai Ai AI" → "DealMai Ai" in the access subject (the original "DM Champ AI workspace" wording would otherwise read awkwardly). Code comments + i18n key names + the `dmchamp_access`/`dmchamp_linked` kind identifiers unchanged.
- **Why two different names** (Ai Portal vs DealMai Ai) — they were requested separately by the owner for the two surfaces; the system supports either independently. Portal uses "Ai Portal"; emails use "DealMai Ai".

### Open Portal Buttons ✅ (30 May 2026)
- **Admin → DM Champ** — "Open DM Champ Portal ↗" button in the status banner opens `State.dmchamp.portalUrl` in a new tab (i18n `admin.dmchamp.openPortal`, 4 langs). Lets admins jump straight to the configured portal (default or White-Label custom domain).
- **Customer portal** — "Open Ai Portal →" button in the DM Champ card. Present in all sub-account states that have a usable account: `created`, `linked`, and now also `topped_up` (previously `topped_up` had NO card at all — customers with ontheline/repeat-purchase top-ups couldn't see the portal button; fixed 30 May 2026 by adding the `topped_up` branch in `renderCustomerAccount`).

### Limitations
- DM Champ API key must be from an **Agency tier** plan; non-Agency keys return 403
- The `temporary_password` returned from DM Champ is stored in Firestore (so admin can re-show in Order View) — eventually should be marked ephemeral / cleared after customer logs in
- DM Champ API does NOT return a `portalUrl` field in responses — the customer-facing URL is something Deal Pro chooses (defaulting to DM Champ's public app, overridable via `config/branding.dmchampPortalUrl`)

---

## 💳 ChillPay Integration Details

### Credentials (sandbox)
- **Merchant Code:** M038296
- **API endpoint:** `https://sandbox-appsrv2.chillpay.co/api/v2/Payment/`
- **URL Background (callback):** `https://dealmai.com/api/chillpay-callback`
- **URL Result (browser return):** `https://dealmai.com/payment-result`

### Outbound Request (20-field checksum — per v1.2.5 Table 2.2)
Field order:
```
MerchantCode + OrderNo + Amount + Currency + Description + PaymentDescription +
CustomerId + ChannelCode + LangCode + RouteNo + IPAddress + ApiKey +
TokenFlag + CreditToken + CreditMonth + ShopID + ProductImageUrl +
CustEmail + CardType + CustName + MD5SecretKey
```
- Concat (raw, no separators) → MD5 → hex

### Inbound Callback (16-field checksum — per v1.2.5 Table 3.1)
Field order (verified against real callbacks):
```
TransactionId + Amount + OrderNo + CustomerId + BankCode + PaymentDate +
PaymentStatus + BankRefCode + CurrentDate + CurrentTime + PaymentDescription +
CreditCardToken + Currency + CustomerName + MerchantCode + RouteNo + MD5SecretKey
```
- **Important:** MD5SecretKey is the **raw secret**, NOT URL-encoded (contrary to v1.2.5 docs Table 3.1 Remarks)
- Algorithm name: `v1.2.5-16-MC-RN-end (raw secret)`

### Currency Conversion (USD → THB)
- Lookup via `open.er-api.com` (free, no API key)
- 1-hour in-memory cache
- Fallback rate: 32.5 THB per USD
- Stored on order as `fxRate` for audit

### Channels Supported
Empty `ChannelCode` → ChillPay shows the channel selection page (current setting). Specific channels available per Appendix E if needed.

---

## 🌍 Translation System

### Supported Languages (all at 100%, ~485 keys)
- **English (en)** — master, source of truth in DEFAULT_STRINGS in code
- **Thai (th)** — 100% · live
- **Korean (ko)** — 100% · live
- **Japanese (ja)** — 100% · live

### How It Works
1. EN strings live in `DEFAULT_STRINGS` (in-code, never in Firestore)
2. TH/KO/JA strings live in `FULL_TRANSLATIONS` (in-code) AND in Firestore `translations/{lang}.strings`
3. Firestore values take precedence (allows live editing from admin UI without redeploy)
4. `I.t(key)` lookup chain: current lang Firestore → EN Firestore → `DEFAULT_STRINGS` → key itself

### `{brand}` Placeholder Auto-Substitution (29 May 2026)
`I.t()` auto-substitutes `{brand}` in every string with `State.branding.siteName` unless the caller passes `ph.brand` explicitly. Six i18n keys currently use the placeholder:
- `hero.lede` × 4 langs
- `login.sub` × 4 langs

Substitution is a fast-path check (`v.indexOf("{brand}") !== -1`) so the overwhelming majority of strings without it skip the work. Used by `applyBranding()` → `I.apply()` to flip the entire site to the new brand name in realtime when admin saves a new Site Name.

### Unconditional ChillPay → Payment Gateway Substitution (30 May 2026)
After the EN-only string-replace pass, three additional patches stack to make the rebrand stick across all 4 languages even when Firestore values diverge from DEFAULT_STRINGS:

1. **String-replace pass on DEFAULT_STRINGS + FULL_TRANSLATIONS** for all 4 langs — 16 keys × 4 langs = 64 i18n values flipped (29–30 May 2026). Captures fresh deployments + EN admin who saved through the UI.
2. **STALE_VALUE_OVERRIDES** entries for 14 keys × 4 langs = 56 entries — flip exact-match legacy Firestore values to new wording at runtime. Captures Firestore docs seeded from the original DEFAULT_STRINGS before the rename.
3. **Unconditional regex pass in `I.t()`** — `if(v.indexOf("ChillPay") !== -1) v = v.replace(/ChillPay/g, "Payment Gateway")` runs AFTER STALE_VALUE_OVERRIDES + placeholder substitution. Catches admin-edited Firestore values whose wording diverged from the original seed (e.g. admin shortened the hint text in the Translations UI, so the exact-string override key no longer matches). Safe because no current i18n VALUE intentionally contains "ChillPay" anymore — only identifiers (CSS classes, JS vars, code comments) which don't pass through `I.t()`.

The three layers stack: layer 1 covers most cases at build time, layer 2 covers exact-match Firestore migrations, layer 3 catches everything else. If admin ever re-saves a translation through the UI (overwriting the Firestore value with the new wording), STALE_VALUE_OVERRIDES + the unconditional pass both become dead code for that key — but harmless.

### Scoped DM Champ → Ai Portal Substitution (customer portal only) (30 May 2026)
The customer portal renames "DM Champ" → "Ai Portal", but the admin console must KEEP "DM Champ" (it's the real product admins configure). So unlike the global ChillPay pass, this substitution is **scoped by key prefix**:
```js
if(key.indexOf("account.dmchamp.") === 0 && v.indexOf("DM Champ") !== -1){
  v = v.replace(/DM Champ/g, "Ai Portal");
}
```
Runs in `I.t()` after the ChillPay pass. Only `account.dmchamp.*` keys (the customer-facing workspace card + buttons) are affected; `admin.dmchamp.*` keys are untouched. Backed by the same three-layer strategy: DEFAULT_STRINGS edited + STALE_VALUE_OVERRIDES for 6 keys (`open`/`toppedUp`/`title`/`pending`/`failed`/`linked`) + this scoped unconditional pass for anything hand-edited.

### STALE_VALUE_OVERRIDES (renamed strings)
Read-side override layer in `I.t()` — when a string is renamed in a release, old Firestore values are flipped to new values at lookup time without writing Firestore. Currently active for:
- `nav.login`: "Admin Login" → "Sign In" (all 4 langs)
- `login.title-html`: "Admin Login" heading → "Sign In"
- `login.sub`: "Console Access · Restricted" → "Access your {brand} account" (now uses `{brand}` placeholder)
- `hero.lede` × 4 langs: "Deal Pro is an autonomous..." → "{brand} is an autonomous..." (TH has 2 variants for compatibility)
- 14 ChillPay keys × 4 langs (56 entries): "ChillPay" → "Payment Gateway" in EN/TH/KO/JA values for checkout/admin/toast strings — see ChillPay rebrand log entry 30 May 2026
- 6 Ai Portal keys × 4 langs (`account.dmchamp.open`/`toppedUp`/`title`/`pending`/`failed`/`linked`): "DM Champ" → "Ai Portal" for the customer portal — see Ai Portal rebrand log entry 30 May 2026

### Auto-Sync on Admin Login
On admin sign-in, `syncMissingTranslationsToFirestore()` runs:
- Adds any keys present in `FULL_TRANSLATIONS` but missing from Firestore (merge, never overwrite)
- Applies forced renames from `FORCED_RENAMES` (only when current value matches a known-stale value)

### Editing Translations
Admin → Languages → Edit Translation → table of all keys with current value + EN source. Auto-saves on blur. Changes apply instantly via Firestore real-time listener.

### Bulk Import Buttons
- **Import TH/KO/JA** — populates only missing keys
- **Import + Overwrite** — replaces all values with shipped translations

---

## 🛠️ Admin Console Features

### Sidebar Navigation
Orders · Users · Packages · ontheline Webhook · **Payment Gateway Events** (was ChillPay Events — 30 May 2026) · Email Queue · Languages · Branding · DM Champ · Change Password

### Orders Page ✅
- Filter by source (All / ontheline / **Direct** — unified ChillPay + direct)
- 4 stat cards: Today · ontheline · Direct · Revenue (ChillPay count merged into Direct)
- Columns: Reference · Customer · Source · Package · Amount · Status · Date · **Expires** (orange ≤7 days, magenta if expired) · Actions
- Actions per row: View · Resend · Check Status
- View modal shows full invoice preview + **ChillPay Diagnostics section**: OrderNo, TransactionId, PaymentStatus, BankRefCode, BankCode, ChannelCode, PaymentDate, PaidAt, ExpiresAt, raw callback JSON

### Users Page ✅
- Columns: Email · Name · Role · Source · **Active Package** (shows package + days left, orange ≤7 days) · Created · Actions
- Actions: Reset Password · Delete (hard-delete via `delete-customer` function — removes Firebase Auth + Firestore)
- "Add User" button (creates customer/admin manually via secondary Firebase app instance)

### Packages Page ✅
- Three bucket sections with collapsible tables
- Add/Edit/Delete buttons per package
- Edit form fields: Bucket · ID · Title · Description · Price · **Duration (days)** (disabled for credit bucket) · Featured · Order
- **Realtime sync** — admin edits show flash animation + toast on customer's package page

### Webhook Page ✅
- **Webhook Secret card**: masked secret display + Show/Hide/Copy/Regenerate buttons
  - Stored in `config/webhook` Firestore doc
  - Backend reads Firestore first, falls back to env var
  - Regenerate creates 32-byte random hex via `crypto.getRandomValues()`
- Recent webhook events table

### Payment Gateway Events Page ✅ (was "ChillPay Events" — renamed 30 May 2026, see ChillPay rebrand log)
- **2 endpoint URL cards** (NEW): URL Background + URL Result with Copy buttons + descriptions
- Stats cards: Verified Callbacks · Total Events
- Filterable list (all / create-payment / callback / verified / failed)
- Refresh button for one-shot Firestore read
- View modal shows raw data (clean — debug probes removed after checksum verified)
- **UI text** uses "Payment Gateway" everywhere (incl. instructions like "Configure this URL in your Payment Gateway merchant dashboard"); admin must remember the actual provider is ChillPay at chillpay.co.th — this is intentional preparation for swapping providers without UI changes

### Email Queue Page ✅
- Columns: Queued · To · Subject · Kind · Status · Actions
- Status badges: ✓ SENT (green) · PENDING (amber) · FAILED (red)
- View modal shows full email preview + Resend button

### Languages Page ✅
- 4 language cards with progress bars (% translated)
- LIVE TO USERS / LOCKED UNTIL ≥ 90% indicator
- Bulk Import buttons
- Translation table editor with search

### Branding Page ✅
- **Site Name card** — text input + Save + Reset + Live Preview
- **Logo Image card** — file upload + visual preview (dark background) + Reset (when custom)
- **Favicon card** ✅ (31 May 2026) — full-width row below the two cards: browser-tab-icon upload (PNG/ICO/SVG/WebP, square, ≤100 KB) + a live "tab preview" + Reset (when custom). Writes `config/branding.faviconDataUrl`.
- Audit footer: "Last updated [date] by [email]"

### DM Champ Page ✅
- **Status banner** — connected (green) / not connected (amber) / disabled (gray)
- **API Key card** — masked display of current key + paste new key to replace + Save
- **Auto-provisioning toggle** — checkbox to enable/disable
- **Credits per USD** input — live conversion preview refresh
- **Default monthly credits** input — fallback amount
- **Roll over unused credits** toggle
- **Default time zone + country** inputs
- **Portal URL** input ✅ (NEW 30 May 2026) — admin sets the customer-facing DM Champ sign-in URL (default `https://app.dmchamp.com`, override to White-Label custom domain like `https://app.dealmai.com`). Validates http(s) prefix; saves to BOTH `config/dmchamp.portalUrl` (back-compat) and `config/branding.dmchampPortalUrl` (public-read source of truth); realtime sync via subscribeBranding.
- **Conversion preview card** — shows $5/$10/$20/$50/$100 → credits at current rate (full-width, below settings — mobile-friendly single-column layout with `max-width:760px`)
- Audit footer: "Last updated [date] by [email]"

### Order View Modal — DM Champ section ✅ (NEW)
Added to every PAID order view modal (between ChillPay diagnostics and action buttons):
- **`created` state (green)** — shows email, UID (with Copy button), monthly credits, source (auto/manual), created timestamp, temp password (with Copy button); Re-provision (force new) button
- **`linked` state (teal)** — 🔗 informational message + email + linked timestamp; Re-check button
- **`failed` state (red)** — last error message + attempts + Retry button
- **Absent state (amber)** — "Not provisioned yet" + Provision button
- Long-string overflow handled via `word-break:break-all` + `min-width:0` on grid cells + `data-copy` + `App.copyFromAttr()` Copy helper

### Change Password Page
- Standard 3-field form (current / new / confirm)
- Reauthenticate + updatePassword

---

## 👤 Customer Portal Features ✅

### My Account Dashboard (`/account`)
- Welcome card with customer's name
- **Active Subscription card** showing:
  - Current package title
  - Progress bar (days used / total days)
  - Expiry date + "X days remaining" (or "No expiry · credit balance")
  - Status badge (Active / Expiring Soon / Expired)
- **Ai Portal Workspace card** ✅ (customer-facing name is "Ai Portal" — 30 May 2026; internally DM Champ) — shows when customer has at least one paid order:
  - `created` state — email + monthly credits + temp password (with hint to change on first sign-in) + "Open Ai Portal" button
  - `linked` state — 🔗 "Your existing Ai Portal account is linked" + email + credits + "Open Ai Portal" button (no temp password)
  - `topped_up` state ✅ (added 30 May 2026) — ✓ "Credits from this purchase have been added to your Ai Portal account" + email + credits + "Open Ai Portal" button. Covers repeat purchases AND ontheline orders (which always write `topped_up`). Previously this state rendered no card at all.
  - `failed` state — "Please contact support" message
  - `pending` state — "Workspace is being prepared" message
- **Quick stats**: Total Orders · Total Spent · Member Since
- **Password change banner** (visible only when `mustChangePassword=true`) → opens modal in "forced" mode
- **Change Password button** ✅ (added 30 May 2026) — in the bottom CTA row, always available. Opens the same modal in "neutral" mode (wording clarifies it changes the **Deal Pro account** password, not the Ai Portal/DM Champ password). Requires current password (re-authenticated via `reauthenticateWithCredential` before `updatePassword`).
- CTAs: View My Orders · Browse Packages · Change Password

### My Orders (`/orders`)
- Table of all customer's orders (Firestore listener scoped by email)
- Columns: Reference · Date · Package · Amount · Expires · Status · Actions
- Order detail modal with: Customer · Items · Subtotal/VAT/Total · Payment Method · Paid At · Expires At
- Resend Invoice / Resend Credentials buttons (re-queues email)

### Language Switching Re-render ✅ (fixed 30 May 2026)
`setLang(code)` re-renders the currently-visible customer page so the WHOLE page (content cards + buttons, not just `[data-i18n]` elements) switches language immediately. Previously only the top nav relabeled instantly (those are `[data-i18n]` static elements handled by `I.apply()`), while card content + bottom buttons — built with JS template literals calling `I.t()` at render time — stayed in the old language until the user navigated to another menu and back. Fix: `setLang` now calls `renderCustomerAccount()` / `renderCustomerOrders()` when those pages are visible (in addition to the existing renderHome/renderPackages/renderCheckout/admin re-renders).

### Change-Password Modal (shared) ✅
- `openCustomerPasswordModal(forced)` — `forced=true` (mustChangePassword nudge) shows security wording; `forced=false` (the account-page button) shows neutral wording. Both use the same 3-field form (current + new + confirm) and `doCustomerPasswordChange()` handler.
- `doCustomerPasswordChange()` — validates non-empty + match + min length, then `reauthenticateWithCredential(user, EmailAuthProvider.credential(email, current))` → `updatePassword(user, new)` → clears `mustChangePassword` flag → toast + re-render. Wrong current password surfaces `auth/invalid-credential` as a friendly error.

### Auth Flow
- `onAuthStateChanged` accepts both `role=admin` and `role=customer`
- Admins → `subscribeCollections()` (all collections)
- Customers → `subscribeCustomerCollections()` (orders scoped by email only)
- `App.go("admin")` redirects customers to `/account`
- Hero CTAs are role-aware: logged-out → "Sign In", admin → "Open Admin Console", customer → "Go to My Account"
- Nav buttons toggled by role in `updateAuthUI()`

### Customer Password Change Modal
- Triggered from password banner in My Account
- Reauthenticate + updatePassword + clears `mustChangePassword` flag
- Same UX as admin password change

---

## 📧 Email System

### Provider: Resend
- Free tier: 3,000 emails/month, 100/day
- Currently using `onboarding@resend.dev` (test mode — only sends to verified `geeravut@gmail.com`)
- Production: requires domain + DNS verification at resend.com/domains

### Test-Mode Workaround
- `EMAIL_TEST_REWRITE_TO=geeravut@gmail.com` env var rewrites recipient + tags subject `[TEST → original@] ...`
- Allows full end-to-end testing with synthetic addresses (e.g. `geeravut+test1@gmail.com`)
- Firestore queue + order doc still record real recipient
- Remove this env var after Resend domain verification

### Architecture
- App writes to `email_queue` collection (`status: "pending"`)
- Scheduled function `send-queued-emails` runs every 5 minutes
- Pulls up to 25 pending emails per batch
- Renders HTML + plain text via `lib/email-templates.js` — **`renderEmail(kind, lang, order, db)` is async since 29 May 2026** (caller must await; `send-queued-emails.js` passes `db` argument)
- POSTs to Resend API with API key
- Updates status: `sent` / `retry` / `failed` (5 retries max)

### Runtime Branding for Emails ✅ (29 May 2026)
Email templates no longer hardcode "Deal Pro" or portal URLs. Instead:
- **`BRAND_DEFAULTS`** in `email-templates.js` provides fallback values: name=`Deal Pro`, portalUrl=`deal-pro-ai.netlify.app`, supportEmail=`support@deal-pro-ai.example`, dmchampPortalUrl=`app.dmchamp.com`
- **`loadBranding(db)`** is the runtime loader with a **30-second cache** to avoid hammering Firestore during batch sends. Reads (in priority order):
  - `PUBLIC_SITE_URL` env var → overrides `portalUrl` (production: `https://dealmai.com`)
  - `EMAIL_REPLY_TO` env var → overrides `supportEmail` (production: `support@dealmai.com`)
  - Firestore `config/branding.siteName` → overrides `name`
  - Firestore `config/branding.dmchampPortalUrl` → overrides `dmchampPortalUrl`
- **`renderEmail()`** is async, accepts `db` arg, calls `loadBranding(db)`, passes the resulting `brand` object into every renderer
- **`t(lang, key, vars)`** consumers must pass `brand: brand.name` when the i18n string contains `{brand}` (six keys do: `creds.title`, `subject.invoice`, `subject.receipt`, `subject.credentials`, `common.thanks`, `common.footer`)
- **5 render functions** (renderInvoice, renderReceipt, renderCredentials, renderDmChampAccess, renderDmChampLinked) now take `(lang, order, brand)`; `wrapHtml()` takes `(lang, title, contentHtml, brand)`
- Result: emails reflect the admin's current Site Name + DM Champ Portal URL within 30 seconds of saving Branding/DM Champ settings, with no redeploy needed

### Templates: 5 kinds × 4 languages (20 total)
- **invoice** — pre-payment invoice
- **receipt** — post-payment receipt
- **credentials** — welcome + initial password (Deal Pro account)
- **dmchamp_access** — sub-account credentials (sent when DM Champ provisioning succeeds; includes temp password + monthly credits + portal link). Customer-facing copy says **"DealMai Ai"** (the `dmchamp_access` kind id is unchanged).
- **dmchamp_linked** — existing-account notice (sent when DM Champ rejects with "email already in use", OR for ontheline orders; no password — directs customer to use existing credentials or "Forgot Password"). Customer-facing copy says **"DealMai Ai"**.

### Email Product-Name Rebrand: "DM Champ" → "DealMai Ai" ✅ (30 May 2026)
All customer-facing email copy (subject + body, both DM Champ email kinds, all 4 langs) was rebranded from "DM Champ" to **"DealMai Ai"** — 32 EMAIL_STRINGS values (8 keys × 4 langs). Example subject: "Your DealMai Ai workspace is linked to this purchase". Also de-duplicated the access subject ("DM Champ AI workspace" would have become "DealMai Ai AI workspace" — the redundant "AI" was removed → "DealMai Ai workspace"). Code comments + i18n key names + the `dmchamp_access`/`dmchamp_linked` kind identifiers + `dmchampPortalUrl` field are all unchanged. NOTE: the customer portal uses "Ai Portal" while emails use "DealMai Ai" — two distinct customer-facing names for the same DM Champ workspace, both requested by the owner.

All include:
- Branded gradient header (teal #075d63 → #0bb6c4)
- Items table + totals table (subtotal / VAT 7% / total)
- Footer with support email + portal link
- Plain text fallback for non-HTML clients

### Language Selection
1. Explicit `lang` param (when admin queues manually)
2. `order.receiptLang` (set during checkout)
3. `customer.country` mapping (TH→th, KR→ko, JP→ja, else→en)
4. Default: `en`

---

## 🔐 Authentication Flow

### Setup Mode (First Visitor)
1. App boots → calls `adminExists()` → checks if any user has `role: "admin"`
2. If no admin → login modal switches to "Setup" mode (strong-password required)
3. User enters email + password → creates Firebase Auth account → writes `users/{uid}` with `role: "admin"`

### Sign In Mode
1. Standard email/password sign-in via Firebase Auth
2. After auth → fetch `users/{uid}` profile → set `State.user`
3. Branch by role:
   - **Admin** → subscribe to admin collections → auto-seed packages if empty → auto-sync missing translations → navigate to admin console
   - **Customer** → subscribe to customer orders only → check `mustChangePassword` → navigate to `/account`

### Smart Password Logic (chillpay-callback)
On every successful ChillPay payment:
- **New user** (auth/user-not-found) → generate password + create user + queue credentials email with password
- **Existing user + mustChangePassword=true** (never logged in yet, repeat purchase) → regenerate password + update Firebase Auth + queue email with new password
- **Existing user + mustChangePassword=false** (customer set their own password) → no password reset, credentials email shows "Account: your@email" only

### Persistence
- `browserLocalPersistence` — admin stays logged in across page reloads
- "Welcome back" toast suppressed on auto-restore

### User Creation Trick (Admin manual add)
Admin creating a customer/admin uses a **secondary Firebase app instance** (`initializeApp(config, "user-creator")`) — prevents the createUser call from replacing the admin's own session.

### Forgot Password
"Forgot Password?" button in login modal → `sendPasswordResetEmail()` → user receives Firebase Auth reset link.

---

## 🐛 Known Limitations & Notes

1. **`WEBHOOK_TEST_MODE=true` currently active** — bypasses HMAC signature on ontheline. Set to `false` and exchange real signature secret with ontheline before production.

2. **Resend test mode** — `onboarding@resend.dev` can only send to verified email. Workaround via `EMAIL_TEST_REWRITE_TO` env var (active). Remove after domain verification.

3. **ChillPay sandbox mode** — `CHILLPAY_MODE=sandbox`. Switch to `production` after sandbox testing succeeds.

4. **`/api/delete-customer` and `/api/provision-dmchamp` redirect cache issue** — aliases return 404 for a period after a redirect is added; frontend calls `/.netlify/functions/...` directly as a workaround. May resolve with future Netlify cache refresh — the `netlify.toml` aliases are correct for long-term.

5. **Service account credentials handling** — `FIREBASE_PRIVATE_KEY` must keep `\n` as literal characters (2 chars each), not actual newlines. Functions restore via `.replace(/\\n/g, '\n')`.

6. **Firestore Rules allow public read** for `translations`, `packages`, `users` (list only), and `config/branding`. The `users` rule is needed for `adminExists()` pre-login. In a stricter setup, this should move to a Cloud Function.

7. **Smart secret scanning is disabled** — required because Netlify's scanner flags Firebase Web API keys as secrets (false positive).

8. **Scheduled functions only run on PUBLISHED deploys** — draft/branch deploys won't trigger the email sender cron. Always check `Deploys` tab → deploy badge says "Production".

9. **Polling on payment-result is best-effort** — runs every 3s for up to 60s. If callback takes longer (rare), customer needs to refresh manually. The order will still get updated by the background callback regardless.

10. **Gmail "+tag" emails** — strip `+tag` for ChillPay's `CustEmail` (regex `/\+[^@]*(?=@)/`) since ChillPay validates email format strictly. Other systems (Firebase Auth, Firestore, Resend) use the full email so a tagged address is a distinct identity.

11. **Drag-and-drop deploys** — ALWAYS drag entire folder, never single files. Otherwise other files get removed from the deploy.

12. **Branding logo size limit** — 500 KB raw file (~666 KB base64). Firestore doc limit is 1 MB, so this leaves headroom for the siteName + timestamps. Larger logos would need Cloud Storage instead.

13. **Email templates use runtime branding** ✅ (resolved 29 May 2026) — `email-templates.js`'s `renderEmail()` is now async + reads `config/branding.siteName`, `config/branding.dmchampPortalUrl`, `PUBLIC_SITE_URL` env var, and `EMAIL_REPLY_TO` env var at render time (30s cache). All "Deal Pro" mentions in email body/subject/footer use the `{brand}` placeholder fed from `loadBranding(db)`. Customer-facing emails now reflect the admin's current Site Name + DM Champ Portal URL without redeploy. The `BRAND` legacy export is kept frozen at module-load time for backwards compatibility but no internal code uses it.

14. **`app.js` syntax validation** — `node --check` parses as CommonJS and allows `return` outside function (legal in CJS module scope). The browser loads `app.js` as `<script type="module">` (strict ES Module), which rejects orphan `return`. Always validate with Acorn (`sourceType: 'module'`) — same parser used by browsers and esbuild — before pushing changes. CJS-mode validation has missed two `Illegal return statement` bugs during this project's history (both around `renderAdminPassword()` being accidentally removed during nearby edits).

15. **DM Champ requires Agency tier** — non-Agency API keys return 403 on `POST /v1/subaccounts`. The `enabled` toggle in admin panel lets you turn off auto-provisioning without removing the key.

16. **DM Champ Grant Credits API live** (28 May 2026) — repeat purchases by an existing email now auto-top-up the customer's DM Champ credits via `POST /v1/subaccounts/credits`. Previously marked as `linked` with no credits granted; admin had to add manually. If the Grant Credits API call fails (network issue, key revoked, etc.), Deal Pro falls back to `linked` status so the admin can intervene from the Order View modal. The DM Champ docs path is `help.dmchamp.com/agency/sub-account-auto-recharge` (Grant Credits API section).

17. **DM Champ temp password persistence** — the `temporary_password` from DM Champ response is stored in `order.dmchampSubAccount.tempPassword` so admin can re-show in Order View. Should be marked ephemeral / cleared after customer's first DM Champ login (no signal available yet — would need DM Champ to webhook us on first login).

18. **Inline event handlers and string values** — when embedding user-controlled strings into HTML `onclick` attributes via template literals, never use `JSON.stringify()` directly inside the attribute — its double quotes break the attribute delimiter and HTML renders the rest as text content. Use `data-*` attributes + `escapeHtml()` + a helper method that reads the attribute (see `App.copyFromAttr()`).

19. **SPA asset paths MUST be absolute, not relative** — in `index.html`, the script tag for `app.js` (and any future asset reference) MUST use `/app.js` (absolute, domain-rooted), never `./app.js` (relative). Reason: the app uses the History API and lives at deep routes like `/admin/orders`, `/account`, `/checkout/foo`. With a relative path, the browser resolves `./app.js` against the *current* URL — so on `/admin/orders` it requests `/admin/app.js`, which doesn't exist on Netlify. The SPA catch-all redirect then returns `/index.html` (MIME `text/html`), and the strict ES Module loader rejects it with: *"Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of text/html."* Followed by `App is not defined` errors from the chat widget. The bug is invisible when testing only the home page (`/`) because there the relative and absolute resolve to the same URL. Always test deep routes (especially after refresh) when changing any asset path.

20. **Credit calculation uses SUBTOTAL, not total** (added 28 May 2026) — `provision-dmchamp.js` reads `order.subtotal` for `usdAmount`, falling back to `order.total` only if subtotal is missing/zero (legacy orders). All UI surfaces that display "credits earned" (Customer Portal stats tile, My Orders Credits column, Admin Orders Credits column, Admin Users Credits column, Admin Order detail modal, CSV export) follow the same rule. **Important:** When manually editing an order in Firestore Console, set `subtotal` correctly — otherwise the credits-earned UI silently falls back to `total` which would over-count credits by the VAT amount.

21. **`State.dmchamp.creditsPerUsd` lazy-loaded from `config/dmchamp`** (added 28 May 2026) — the Customer Portal, My Orders, Admin Orders, and Admin Users pages all use this rate as a fallback when an order's `dmchampSubAccount.creditsPerUsd` snapshot is missing. The pages call `loadDmChampConfig()` fire-and-forget on first render and re-render once loaded; first paint uses the default `100` so customers may see slightly wrong credit counts for ~200ms after navigating to a credit-displaying page. Acceptable trade-off vs. blocking render on every page load. The `loadDmChampConfig()` helper is idempotent (no double-fetch).

22. **Email filter input focus preservation** (added 28 May 2026) — `AdminActions.setOrderEmailFilter()` debounces the re-render by 180ms (or immediate on empty string) AND restores focus + caret position to the input after `renderAdminOrders()` rebuilds the DOM. Without this, typing in the filter input would lose focus on every keystroke because the entire orders panel is destroyed and rebuilt. Pattern: read `document.activeElement === prev` + `prev.selectionStart` before re-render, then `next.focus()` + `next.setSelectionRange(caret, caret)` after.

23. **DM Champ Grant Credits API endpoint confirmation** (28 May 2026) — the canonical endpoint is `POST /v1/subaccounts/credits` (NOT `/v1/subaccounts/grant_credits` as initially guessed before the docs were confirmed). Body shape: `{email, amount, description?}`. Authentication via `?apiKey=...` query parameter ONLY — the API does not read API keys from headers. Sub-account is identified by email (must match an existing sub-account under the agency). Response includes `sub_account_id`, `credits_added`, `new_balance` — all three are stored on `order.dmchampSubAccount` for audit and UI display.

---

## 📋 Current State Checklist

### ✅ Working (Production-ready)
- ChillPay Phase 1 backend (create-payment + callback)
- ChillPay Phase 2 frontend (checkout → ChillPay → result page)
- ChillPay checksum verified (v1.2.5-16-MC-RN-end with raw secret)
- ontheline webhook receiver
- Email sender (Resend) with test-mode rewrite
- Customer Portal (My Account + My Orders)
- Admin Console (Orders, Users, Packages, Webhook, **ontheline Partners**, **ontheline Payment Gateways**, **ontheline Currencies**, **Payment Gateway Events**, Email Queue, Languages, Branding, **DM Champ**)
- Delete Customer (hard-delete via Netlify Function)
- 4-language i18n (all 100% · ~540 keys)
- STALE_VALUE_OVERRIDES for renamed strings (incl. `{brand}` placeholder migration + ChillPay→Payment Gateway 56 entries)
- Webhook Secret UI (Firestore-stored + Regenerate button)
- Smart password logic for repeat purchases
- IPv6 → IPv4 resolution for Payment Gateway (ChillPay)
- Gmail "+tag" stripping for Payment Gateway email validation
- Role-aware UI (admin vs customer vs guest)
- Payment Gateway Diagnostics section in Order View modal
- Payment Gateway endpoint URLs displayed in Admin → Payment Gateway Events
- Unified Direct + Payment Gateway source in Orders (simplified UX)
- Realtime Package Updates (toast + flash animation)
- Always-fresh Packages page (re-renders on navigation)
- dmchamp AI chat widget embedded site-wide
- Branding system (admin can change site name + logo + favicon, realtime sync to all browsers)
- **Language enable/disable** ✅ (31 May 2026) — Admin → Languages toggles which UI languages end-users can pick (`config/branding.enabledLangs`); "en" is always forced on as the fallback; picker + checkout select hide disabled langs; current lang falls back to en if disabled
- **ontheline Partners & Payment Gateways** ✅ (31 May 2026) — two admin-managed reference lists (`ontheline_partners` / `ontheline_paygw`, each `{code, companyName}`) with full CRUD in dedicated admin pages; the webhook validates incoming codes against them
- **Webhook partner/paygw validation** ✅ (31 May 2026) — ontheline webhook requires `partner` + `paygw`, rejects unknown/missing codes with HTTP 400; stores both on the order + webhook_event
- **ontheline Currencies + multi-currency amounts** ✅ (1 Jun 2026) — admin-managed `ontheline_currencies` (`{code, symbol, label}`); webhook validates the `currency` param; amounts display in the original currency (symbol) with the USD value in parentheses; USD conversion via Free Currency API (`currency-convert.js`, key `FREECURRENCY_API_KEY`, open.er-api.com fallback)
- **Webhook multi-event** ✅ (1 Jun 2026) — accepts Paid/Unpaid/Refund/Partial Refund/Fail; only Paid + Partial Refund provision user/email/credits; idempotency is per-(txId+event); each event creates its own order
- **Orders latest-event-per-transaction** ✅ (1 Jun 2026) — Orders table de-duplicates ontheline rows by `transaction_id`, shows the latest event (colour-mapped) in STATUS, floats updated transactions to the top
- **Orders 5 date filters + currency filter** ✅ (1 Jun 2026) — Today / Yesterday / This Month / Last Month / Period (shared `computeOrderDateRange()`); currency dropdown filter; all affect CSV export (which gains Currency / Amount Original / Amount USD columns)
- **Orders partner/paygw column + filters + CSV** ✅ (31 May 2026) — Admin Orders shows Partner/PayGW for ontheline rows, two dropdown filters (also affect CSV export), 4 new CSV columns, ontheline block in the order-view modal
- **Webhook events partner/paygw column** ✅ (31 May 2026) — Recent webhook events table shows partner + paygw (code · company)
- **Email BCC + ontheline support-only redirect** ✅ (updated 5 Jun 2026) — every outbound Resend email BCCs `support@dealmai.com`. ontheline-origin emails are redirected so ONLY the support inbox receives them (support becomes the sole "To"; the customer address is dropped from the envelope and never delivered). The earlier Zero-Width-Space approach was removed because Resend sanitised the U+200B and delivered to the customer anyway. The stored / displayed / exported customer email stays clean; ontheline mail is recorded with status `sent_support_only`.
- **Favicon upload** ✅ (31 May 2026) — Admin → Branding uploads a browser-tab icon (PNG/ICO/SVG/WebP, ≤100 KB) stored in `config/branding.faviconDataUrl`; default is an inline gradient-D SVG; applyBranding removes+recreates the icon link to beat Chrome's favicon cache
- **Dynamic `{brand}` substitution** ✅ (29 May 2026) — hero copy, login subtitle, admin previews, and server-rendered emails all reflect the current Site Name automatically
- **Server-side runtime branding for emails** ✅ (29 May 2026) — `email-templates.js` reads Site Name + portal URLs from env vars + Firestore at render time with 30s cache; no redeploy needed when admin renames the site
- **DM Champ Portal URL admin-configurable** ✅ (30 May 2026) — Admin → DM Champ → Portal URL stores custom domain in `config/branding.dmchampPortalUrl`; customer-facing portal buttons + email links flip in realtime
- **Open Portal buttons** ✅ (30 May 2026) — admin status banner "Open DM Champ Portal" + customer card "Open Ai Portal" (now incl. `topped_up` state), both open the configured `portalUrl`
- **Customer change-password** ✅ (30 May 2026) — "Change Password" button on My Account opens a modal that re-authenticates the current password before updating (Deal Pro account password, not Ai Portal)
- **Customer-portal "Ai Portal" rebrand** ✅ (30 May 2026) — all `account.dmchamp.*` strings show "Ai Portal" (4 langs) via DEFAULT_STRINGS + STALE overrides + scoped `I.t()` substitution; admin console keeps "DM Champ"
- **Email "DealMai Ai" rebrand** ✅ (30 May 2026) — all DM Champ email subjects + bodies say "DealMai Ai" (4 langs, 32 values)
- **Language-switch full re-render** ✅ (30 May 2026) — `setLang` now re-renders the visible customer page (My Account / My Orders) so card content + buttons relabel instantly instead of only on next navigation
- **DM Champ Domain White-Label setup** ✅ (30 May 2026) — `app.dealmai.com` configured at DM Champ; CNAME must live in **Netlify DNS** (nameservers are Netlify's NS1, not Squarespace) — awaiting SSL. Independent from Deal Pro's portal URL setting.
- **ChillPay → Payment Gateway UI rebrand** ✅ (30 May 2026) — 64 i18n values (16 keys × 4 langs) + 4 HTML strings + 56 STALE_VALUE_OVERRIDES entries + unconditional ChillPay→Payment Gateway substitution in `I.t()`. All identifiers / file names / Firestore values / env vars unchanged. See log entry 30 May 2026 for full breakdown.
- **Production custom domain `dealmai.com` live** ✅ (30 May 2026) — Netlify domain config + DNS, full Resend domain verification with Zoho mail server, ontheline webhook URL updated, ChillPay merchant dashboard URLs updated
- **DM Champ integration** (auto-provision sub-accounts on payment, manual retry from admin, four-state UI: created/topped_up/linked/failed, dedicated email templates × 4 langs)
- **DM Champ auto top-up on repeat purchases** via Grant Credits API (28 May 2026) — returning customers get their new purchase's credits added to their existing balance automatically; fallback to `linked` state with admin retry if API call fails
- **ontheline DM Champ credit mirroring** (28 May 2026) — ontheline orders record credits for display (Users/Orders/Portal) WITHOUT calling the DM Champ API, because ontheline manages DM Champ itself; always sends the `dmchamp_linked` email; Order View shows a simple "✓ Topped up by N credits"
- **Credits Earned displays everywhere** (28 May 2026) — Customer Portal stats tile + My Orders column + Admin Orders column + Admin Users column (total) + Admin Order detail modal + CSV export; calculation based on subtotal (before VAT) × per-order snapshot rate
- **Admin Orders email filter** (28 May 2026) — case-insensitive substring filter input next to source pills, debounced re-render with focus preservation
- **My Account 2-column responsive layout** (28 May 2026) — Active subscription card + 2×2 stats grid; collapses to single column on tablet (≤980px), stats stay as 2×2 grid on mobile

### ⏳ Pre-Production Tasks
- [x] Buy domain + verify in Resend → change `EMAIL_FROM` to use own domain — **DONE 30 May 2026 (dealmai.com)**
- [x] Remove `EMAIL_TEST_REWRITE_TO` env var after domain verification — **DONE 30 May 2026**
- [ ] Switch `CHILLPAY_MODE` from `sandbox` to `production`
- [ ] Set `WEBHOOK_TEST_MODE=false` and exchange real signature secret with ontheline
- [ ] Migrate Firestore Rules to stricter version (move `adminExists()` to Cloud Function)
- [ ] Switch from drag-and-drop to Git-based deploys
- [ ] Investigate `/api/delete-customer` and `/api/provision-dmchamp` redirect cache issue (currently bypassed by direct path)
- [ ] End-to-end production test with real ฿1 transaction
- [ ] Add `app` CNAME → `tenants.youraiconnector.com` in **Netlify DNS** (NOT Squarespace — nameservers are Netlify's NS1), wait for it to resolve, then click Verify in DM Champ → wait for SSL → set Portal URL field to `https://app.dealmai.com`
- [ ] Update email templates to use branding (siteName) from Firestore
- [ ] Verify DM Champ API key is on **Agency tier** (Plan 3+ on AppSumo) before production traffic
- [ ] Decide on policy for `linked` accounts at scale — currently no credit upgrade for repeat buyers with existing DM Champ accounts

### 🚀 Future Enhancements
- Dedicated `/api/chillpay-check-status` Netlify function that re-queries ChillPay's status API (currently "Check Status" only reads from Firestore — relies on callback having landed)
- Real-time customer notifications (push or email) when subscription nears expiry
- Customer-facing usage dashboard (credit balance, history)
- Multi-admin role granularity (read-only admin, billing admin, etc.)
- Subscription auto-renewal flow (ChillPay Token Save)
- Custom domain on Netlify (e.g. `app.dealpro.io`)
- Analytics dashboard (orders/day, revenue, conversion rate)

---

## 🚀 Quick Reference Commands

### Generate HMAC for ontheline webhook testing
```bash
SECRET="your-webhook-secret-here"
BODY='{"event":"purchase.completed","transaction_id":"ot_001","customer":{"name":"Test","email":"geeravut@gmail.com","country":"TH"},"amount":50,"currency":"USD"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')
curl -X POST https://dealmai.com/api/ontheline-webhook \
  -H "Content-Type: application/json" \
  -H "X-OnTheLine-Signature: sha256=$SIG" \
  -d "$BODY"
```

### Diagnostic endpoints (all GET requests)
- `GET /.netlify/functions/ontheline-webhook` — returns config snapshot (env presence, mode)
- `GET /.netlify/functions/chillpay-callback` — diagnostic JSON
- `GET /.netlify/functions/provision-dmchamp` — DM Champ config status (configured, enabled, creditsPerUsd, etc. — never exposes API key)
- `GET /api/send-emails-now` — triggers email sender immediately (good for testing)
- `GET /.netlify/functions/delete-customer` — returns 405 (method not allowed, confirms deploy)

### Firebase Console Quick Links
- [Project Overview](https://console.firebase.google.com/project/deal-pro-ai-web-app)
- [Authentication users](https://console.firebase.google.com/project/deal-pro-ai-web-app/authentication/users)
- [Firestore data](https://console.firebase.google.com/project/deal-pro-ai-web-app/firestore/data)
- [Service Accounts](https://console.firebase.google.com/project/deal-pro-ai-web-app/settings/serviceaccounts/adminsdk)

### ChillPay Documentation
- [Merchant Integration Manual v1.2.5](https://chillpay-uploads.s3.ap-southeast-1.amazonaws.com/documents/ChillPay-Merchant-Integration-Manual-Document-EN_v1.2.5.pdf)
- Sandbox dashboard: https://sandbox-portal2.chillpay.co/
- Production dashboard: https://portal2.chillpay.co/

### Resend Quick Links
- [Domains](https://resend.com/domains) — verify domain to leave test mode
- [Emails](https://resend.com/emails) — sent email log
- [API Keys](https://resend.com/api-keys)

### DM Champ Quick Links
- [API Docs · SubAccounts](https://help.dmchamp.com/api/subaccounts)
- [API Docs · Grant Credits + Auto-Recharge Webhook](https://help.dmchamp.com/agency/sub-account-auto-recharge) — Grant Credits API spec used for top-up flow
- [Agency Accounts guide](https://help.dmchamp.com/get-started/agency-accounts)
- App / sub-account login: https://app.dmchamp.com
- API base: `https://api.dmchamp.com/v1`
- Find API key: DM Champ dashboard → Settings → API Access

---

## 🎨 Design System

### Colors
- `--cream`: #f6f2ea (background)
- `--text`: #1f2126 (body text)
- `--muted`: #6f7480 (secondary text)
- `--line`: #e6e2d8 (borders)
- `--teal`: #0bb6c4 (primary accent)
- `--teal-deep`: #075d63 (hover / dark teal)
- `--magenta`: #d6299b (CTA / featured)
- `--amber`: #d68a1c (warning)
- `--red`: #c8463d (error)
- `--green`: #7fa92a (success)

### Typography
- **Primary:** Kanit (300, 400, 500, 600, 700)
- **Mono:** JetBrains Mono (labels, refs, code)

### Components
- `.btn-primary` — magenta gradient CTA with arrow
- `.btn-ghost` — outlined teal button
- `.status-tag` — pill badges (paid/pending/failed/cancelled)
- `.confirm-cell` — labeled value box
- `.email-preview` — inset card mimicking email content
- `.modal-bg` + `.modal` — full-screen overlay with centered card
- `.pkg-card.flash-changed` / `.flash-new` — realtime update animations

---

## 🧪 ChillPay Sandbox Testing Data

### Credit Card Numbers (per docs Appendix C)
- **Success:** `4111-1111-1111-1111` · any future expiry · CVV `123`
- **Failed:** `4000-0000-0000-0002`
- 3D Secure OTP: `123456`

### Mobile Banking / QR / E-wallet
- Any account/QR scan in sandbox is auto-approved

### Internet Banking
- Username: any · Password: `1234`

---

## 📝 Recent Changes Log

### 6 Jun 2026 — Revenue stat = true cash flow (Unpaid no longer subtracts)
Clarified Revenue Today/Period as real cash flow within the date range: paid orders count positive on their pay date, Refund/Partial Refund count negative on their refund date (so a refund today of a Paid order from an earlier day legitimately makes today negative). Fixed: "Unpaid" events no longer subtract from revenue — the customer never paid, so no cash flowed out (Unpaid only reverses credits, not money). Refund/Partial Refund still subtract refundAmountUsd; Fail/failed/cancelled never count. Note: revenue figures depend on each order's stored refundAmountUsd, so ontheline orders created before the VAT-inclusive change (which stored pre-VAT refund amounts) will contribute slightly different figures than new orders. File touched: `app.js`.

### 5 Aug 2026 — fix: credits briefly displayed 100× too high; cancelled status leaked its i18n key
**Credits 100× inflated.** Every credits figure was computed as subtotal × rate with `(State.dmchamp.creditsPerUsd) || 100` as the fallback. `config/dmchamp` is admin-only and loads asynchronously, so the first paint of My Orders / Admin Orders / the Credits Earned tile used the 100 default: a $10.70 order rendered **1,000** credits instead of 10, then silently corrected itself once the config resolved (or after visiting the DM Champ admin page, which populates it). Replaced the guess with `creditsForOrder(o)`, which prefers what DM Champ actually granted (`dmchampSubAccount.creditsGranted`), then the intended amount (`monthlyCredits`), then the rate snapshotted on the order, and only then the live config — returning **null** when the rate genuinely isn't known yet so the UI shows a small placeholder instead of a wrong number. `calculateCreditsEarned` skips null orders rather than inflating the total. Applied to the customer My Orders table, the Admin Orders table and the Credits Earned tile.
**Raw i18n key on screen.** A cancelled order rendered `ORDERS.STATUS.CANCELLED` because `orders.status.cancelled` did not exist and `I.t()` returns the key unchanged when missing. Added the key in all four languages, mapped `cancelled`/`expired` in statusClass, and made statusLabel fall back to the capitalised status instead of leaking a key when any future status has no translation. Tests 6/6 (reproduced the exact 1,000-vs-10 case). File: `app.js`.

### 4 Aug 2026 — added a read-only status probe for diagnosing the empty-shell reply
With the request now matching Table 4.1 exactly, ChillPay still answered `PaymentStatus: 9` with every field null for transaction 646176. That reply is ambiguous: it could mean our call is still malformed, or it could be the correct answer for a transaction that was never actually paid (646176 was a later test; the only transaction CONFIRMED Success in the ChillPay dashboard is 646164). Added `POST { transactionId }` to check-payment-status — a read-only probe that runs the identical gateway call against any transaction id and returns the request, every attempt and the raw reply, without touching an order. Pointing it at a known-good transaction separates the two explanations in one call. Tests 8/8. File: `check-payment-status.js`.

### 4 Aug 2026 — status check implemented to the actual ChillPay spec (Section 4)
Got the real manual section, which contradicted three of my guesses:
1. **No RouteNo.** Table 4.1 lists exactly four request parameters — MerchantCode, TransactionId, ApiKey, CheckSum. Sending RouteNo (and hashing it) is why ChillPay kept replying with the empty shell.
2. **CheckSum = MD5(MerchantCode + TransactionId + ApiKey + MD5SecretKey)** — ApiKey sits inside the hash, RouteNo does not.
3. **TransactionId is ChillPay's numeric reference** ("See data from Table 3.1, Field 1"), not our OrderNo — so the identifier sweep was wrong too. If an order has no stored TransactionId we now say so plainly instead of guessing with the order number.
Rewrote `checkStatus()` to the spec. The manual says to URL-encode ApiKey and the secret before hashing, but this integration's payment-request checksum was proven empirically to use the RAW secret, so raw is tried first with the URL-encoded form kept as a fallback for keys containing reserved characters. The empty-shell guard stays as a safety net. Response fields from Table 4.2 (BankRefCode, OrderNo, RefundedAmount, Remarks, CustomerName) are now captured onto the order. Tests 17/17, including an explicit assertion that RouteNo is NOT sent and that exactly four parameters go out. File: `lib/gateways/chillpay.js`.

### 4 Aug 2026 — status check: empty-shell replies + OrderNo vs TransactionId
Adding ApiKey cleared `ReturnCode 1001`, but ChillPay then answered with a full-shaped body of nulls — `PaymentStatus: 9`, `TransactionId: 0`, `MerchantCode: null`, and **no ReturnCode at all**. Because the retry logic keyed off ReturnCode, that empty shell looked like a valid reply: the loop stopped after the very first variant and reported the order as pending. Two fixes:
- **Recognise the rejection shell.** `isRealAnswer()` now rejects a reply whose PaymentStatus is 9 with no transaction id and no order number, so the loop keeps trying instead of accepting a non-answer. This also prevents an empty reply from ever being read as a failed payment.
- **Try both identifiers.** ChillPay's manual describes the parameter ambiguously as "the transaction reference OR the merchant's Order No", so the lookup now sweeps a matrix of identifier (our gatewayOrderNo, then ChillPay's numeric ref) × checksum ordering (MC+ID+RN+AK, MC+ID+AK, MC+ID+RN, MC+ID) — 8 combinations, stopping at the first real answer. Each attempt records identifier, checksum name, ReturnCode, PaymentStatus and the echoed TransactionId; the winning pair is logged and stored on the audit doc as `acceptedCombination` so it can be hard-coded.
Tests 11/11 (found via OrderNo, found via txId after exhausting OrderNo, nothing found → explicit failure rather than silent "pending", attempt bookkeeping). File: `lib/gateways/chillpay.js`, `check-payment-status.js`.

### 4 Aug 2026 — status check: ChillPay PaymentStatus needs ApiKey; checksum resolved by trying variants
First live call to `/api/v2/PaymentStatus/` came back `ReturnCode 1001 "Invalid API Key"` — the endpoint requires an **ApiKey** parameter that the manual excerpt did not list. Added it. Since the checksum input for this endpoint is still undocumented, `checkStatus()` now tries the plausible orderings in sequence and stops at the first the server accepts: MC+TX+RN+AK, MC+TX+AK, MC+TX+RN, MC+TX, TX+MC+RN+AK. Return codes 1001–1005 are treated as "signature/credential rejected, try the next variant"; anything else is a real answer and stops the loop immediately. The winning variant is logged ("✔ accepted checksum variant …") and every attempt is recorded on the `status-check` audit doc as `checksumAttempts`, so the correct ordering can be hard-coded once observed. Also fixed status mapping: `PaymentStatus: 9` accompanies ChillPay error responses and now maps to *pending*, not *failed* — otherwise a rejected status check would have wrongly marked a real order failed. Tests 14/14 (first variant correct, third variant correct, all rejected, redaction, PaymentStatus 9). Files: `lib/gateways/chillpay.js`, `check-payment-status.js`.

### 4 Aug 2026 — self-healing payments: status polling + scheduled sweep
Testing proved our callback endpoint is fully working (a hand-made POST reached the function, was rejected for a bad checksum, and was logged to `payment_events`) — yet ChillPay still never delivered a callback for transaction 646164, leaving a real payment stranded on `pending`. Waiting on the provider is not a recovery plan for money that already changed hands, so the system now settles orders on its own:
- **`lib/settle-order.js`** — extracted the whole "a payment succeeded" pipeline (expiry with extension semantics, order update, Auth provisioning / initial-password reissue, invoice+receipt+credentials emails, DM Champ) out of payment-callback so callback and polling settle an order through identical code.
- **ChillPay adapter `checkStatus()`** — POSTs to `/api/v2/PaymentStatus/` (sandbox/production by mode) with MerchantCode + TransactionId + RouteNo + CheckSum. ⚠️ **The checksum input order is a documented-convention guess** (values in parameter order, MD5 secret appended) because ChillPay's manual gives the endpoint and parameters but not the hash input. Every attempt writes a `kind:"status-check"` doc to `payment_events` with the redacted request and ChillPay's full reply, and the adapter comment lists the alternative orderings to try — so it can be corrected empirically, the same way the request and callback checksums were.
- **`check-payment-status.js`** — `POST {orderId}` checks one order; `POST {sweep:true}` checks all pending gateway orders older than N minutes. Settles paid ones, marks failed ones, leaves genuinely-pending ones alone, and re-reads the order before settling so a callback landing mid-poll can't double-process.
- **`settle-pending-payments.js`** — scheduled every 10 minutes (netlify.toml), sweeping orders older than 10 minutes, max 25 per run.
- Admin **Check Status** now actually calls the gateway (it previously just re-read Firestore and reported the same status back — misleading). 5 new i18n keys × 4 languages.
Tests: status-check paths 17/17 (paid / still-pending / rejected checksum / non-gateway order, correct endpoint + params, audit written, 3 emails queued, no duplicate emails); callback after the refactor 6/6 including the legacy `chillpay*` mirror. Files: `lib/settle-order.js`, `lib/gateways/chillpay.js`, `check-payment-status.js`, `settle-pending-payments.js`, `payment-callback.js`, `app.js`, `netlify.toml`.

### 4 Aug 2026 — ROOT CAUSE: ChillPay will not call a webhook URL containing a query string
Payments succeeded at ChillPay but orders stayed `pending` and no callback ever reached the function (no logs, no `payment_events` doc with `kind:"callback"`). The ChillPay transaction detail showed **Status: Success** but **Merchant Response Message: Pending** — i.e. ChillPay had not managed to notify us. The only difference from the last working callback (4 Jun) was the URL Background: `/api/chillpay-callback` (worked) vs `/.netlify/functions/payment-callback?gw=chillpay` (never delivered). **ChillPay silently refuses webhook URLs that contain a query string.** Advertising a `?gw=` URL in the admin UI was my design error.
Fix: `payment-callback` now resolves the gateway from a **trailing path segment** — `/.netlify/functions/payment-callback/<id>` — falling back to `?gw=` and then the active gateway, so all three forms work and nothing already registered breaks. Both admin pages (Payment Gateway card, Payment Gateway Events) and the GET diagnostic now advertise the query-free path form, and the gateway guide documents the constraint. Path parsing tested 9/9 (trailing slash, mixed case, underscores/dashes, /api alias, rawUrl fallback) plus priority 3/3; full callback simulation passes for all three URL forms. Files touched: `payment-callback.js`, `app.js`, `ADDING-A-PAYMENT-GATEWAY.md`.

### 4 Aug 2026 — fix: customers silently got the default credit rate (config/dmchamp is admin-only)
`loadDmChampConfig()` is called from the customer My Account and My Orders pages, but it reads `config/dmchamp` — which is admin-read-only because it holds the DM Champ API key. Every customer therefore hit `Missing or insufficient permissions`, the loader fell back to `creditsPerUsd = 100`, and customers saw credit numbers computed from the wrong rate whenever the admin had configured something else. Fixed by mirroring the non-secret `creditsPerUsd` into `config/branding` (public-read) alongside the existing `dmchampPortalUrl`, and having the loader fall back to that mirror. The API key is never copied. The console warning for the expected admin-only denial was removed since it is not an error. **The mirror is written when an admin saves DM Champ settings — open Admin → DM Champ and press Save once to populate it.** File touched: `app.js`.

### 4 Aug 2026 — Payment Gateway top tab + callback URL corrected to the direct function path
- Added **Payment Gateway** to the admin top tab strip (between ontheline Currencies and Payment Gateway Events); it was previously only in the side rail.
- **Payment Gateway Events was advertising the wrong callback URL.** It showed `/api/chillpay-callback` — an `/api/*` alias, and this project has repeatedly confirmed those fall through to the SPA catch-all on production. For a payment callback that means the provider POSTs into an HTML page and the payment is never recorded. Both pages now show `${origin}/.netlify/functions/payment-callback?gw=<activeGateway>`, matching what the Payment Gateway page already displayed. The legacy URLs still work (thin wrappers forcing gw=chillpay), so an already-registered dashboard is not broken.
- The Events page pins the URL to the ACTIVE gateway and lazy-loads `config/payment` if the admin hasn'''t opened the Payment Gateway page yet, so it never suggests the wrong provider'''s URL.
- The **Return URL (URL Result)** is now shown on each gateway card too, next to the callback URL, with hints explaining each — both must be registered together in the provider dashboard. It is gateway-independent (our own `/payment-result` page), so the value is the same on every card. 12 new i18n strings (3 keys × 4 languages). File touched: `app.js`.

### 6 Jun 2026 — Pluggable payment gateways (Phase 2 + 3: admin UI + generic fields)
**Phase 2 — switch gateways from the admin UI**
- New admin page **Payment Gateway** (`adm-paymentgw`, sidebar above Payment Gateway Events). Reads `config/payment.activeGateway` from Firestore and the gateway list + env status from the `create-payment` GET diagnostic, so the panel shows what the SERVER can actually do rather than a hard-coded list.
- Per-gateway card: name / id / currency / mode, ready-vs-missing-env banner, channel chips, the callback URL to register with the provider (copy button), and a collapsible env-var table (values are already redacted server-side).
- `AdminActions.setActiveGateway(id)` writes `config/payment` after a confirm. A gateway whose env vars are incomplete cannot be activated (button disabled + guard in the action).
- 23 new i18n keys × 4 languages.

**Phase 3 — gateway-neutral display**
- Admin Orders: the Source cell now shows the settling gateway underneath `direct`; CSV export gained a **Gateway** column.
- Order View modal: the old "ChillPay diagnostics" block is now generic — it renders for any gateway-settled order, reads `gatewayOrderNo` / `gatewayRef` / `gatewayStatus` / `gatewayData` / `gatewayRawCallback` and falls back to the legacy `chillpay*` names for pre-refactor orders. **This also fixed a latent bug:** the block was gated on `source === "chillpay"`, so new `source:'direct'` orders would have shown no diagnostics at all.
- Same class of fix in three more places that keyed off `source === "chillpay"` and would have broken for `source:'direct'`: row actions (Check Status / Mark Paid / Cancel), the revenue stat (pending gateway orders must not count), and the payment-result method label. All now test `!!o.gateway || o.source === "chillpay"`.
- Payment Gateway Events page now subscribes to **both** `payment_events` (new, all gateways) and `chillpay_events` (legacy history), merges and sorts them, and shows the gateway id under the event kind.
- Checkout channel pills are rendered from the ACTIVE gateway's `channels` (fetched once per session and cached; cache cleared when an admin switches). The hard-coded pills in index.html remain as the pre-load fallback. If the selected channel isn't offered by the new gateway it resets to that gateway's first channel, so we never send a code the provider would reject.

Tests: structure 27/27, i18n 12/12 keys × 4 languages, admin-panel + regression logic 20/20.

**Still open:** dropping the legacy `chillpay*` mirror on the order doc (harmless duplication kept for the transition), and rule-based gateway selection (per country/currency) if you ever want to run two providers in parallel — `config/payment` is shaped so that can be added without restructuring.

### 6 Jun 2026 — Pluggable payment gateways (Phase 1: adapter refactor)
Direct (web) payments are no longer hard-wired to ChillPay. Introduced an adapter layer so a future provider can be added without touching business logic.

**New files**
- `netlify/functions/lib/gateways/index.js` — registry + the adapter contract. `getActiveGatewayId(db)` reads `config/payment.activeGateway` (falls back to chillpay). `gatewayIdForOrder(order)` resolves which gateway settles a given order, with fallbacks for legacy orders (`source:'chillpay'` / `chillpayOrderNo`).
- `netlify/functions/lib/gateways/chillpay.js` — ChillPay as the first adapter. Holds everything provider-specific: endpoint, credentials, request payload, MD5 checksums, IPv4 resolution, the Gmail +tag strip, response parsing, callback verification and status mapping.
- `netlify/functions/create-payment.js` — generic payment creation (validate → resolve active gateway → convert USD → write pending order → `adapter.createPayment()` → return paymentUrl). GET returns a diagnostic listing every registered gateway and its config state.
- `netlify/functions/payment-callback.js` — generic callback handling. Takes `?gw=<id>`, verifies, then **re-resolves the adapter from the order's own `gateway` field** and re-verifies if they differ — so a payment started under gateway A is still settled correctly if an admin switches to B mid-flight. Downstream (expiry, Auth provisioning, DM Champ, email queue) is unchanged and provider-independent.

**Compatibility**
- `create-chillpay-payment.js` and `chillpay-callback.js` are now thin wrappers delegating to the generic handlers; the ChillPay dashboard's registered URL Background keeps working (the wrapper forces `gw=chillpay`).
- Orders now carry neutral fields (`gateway`, `gatewayOrderNo`, `gatewayRef`, `gatewayStatus`, `gatewayData`, `gatewayPaymentUrl`) **plus** the legacy `chillpay*` mirror so existing admin views keep rendering. Callback lookup tries `gatewayOrderNo` then falls back to `chillpayOrderNo`. No migration needed.
- `source` for web sales is now `'direct'` (was `'chillpay'`), with `gateway:'chillpay'` alongside.
- New audit collection `payment_events` (carries a `gateway` field); `chillpay_events` retained for history. Firestore rules updated for both plus `config/payment`.
- Frontend now calls `/.netlify/functions/create-payment` directly (the `/api/*` alias remains unreliable on production).

**Verified as a pure refactor:** the outbound ChillPay payload was diffed field-by-field against the previous implementation — 19/19 identical and the checksum uses the same formula. Adapter contract tests: 33/33; createPayment behaviour (success / gateway rejection / network error / IPv6→IPv4 / +tag strip / redaction): 20/20; deploy-layout module loading: 8/8.

**Not yet done (Phase 2+):** admin UI to switch gateways (`config/payment` is read but nothing writes it yet — set it manually in Firestore for now), channel pills still hard-coded in index.html rather than driven by `adapter.channels`, and dropping the legacy `chillpay*` mirror once nothing reads it.

### 6 Jun 2026 — About Us document localised into all 4 languages
The About Us modal body was English-only. Extracted its copy into a new `ABOUT_DOC` dictionary keyed by UI language (en/th/ko/ja) — headings, all body paragraphs, the callout, the doc-meta labels (Entity/Registration/Address/Support/Platform) and the Thai/Korean/Japanese rendering of the registered address. `Docs.aboutUs()` now picks `State.currentLang` and falls back to `en`. The About modal carries a `data-doc="about"` marker so `setLang()` rebuilds it live if the reader switches language while it is open. **`Docs.terms()` is deliberately left English-only** — it is the authoritative legal text as published. File touched: `app.js`.

### 6 Jun 2026 — checkout customer prefill + Tax ID + Terms consent gate + About Us blocks
Three customer-facing additions:
1. **Checkout customer details.** Signed-in customers now have Full Name + Email prefilled from their account. Signed-out visitors see the sample values as PLACEHOLDERS only (grey hints, never submitted) — the old code actually wrote "Soraya Kanchanaporn" etc. into the inputs. submitCheckout() now validates name/email are really filled (red border + focus + toast on the offending field) before payment. Added an optional **Tax ID** field (`co-taxid`, with hint for the Thai 13-digit number) which flows through to the payment payload as `customer.taxId`.
2. **Terms consent gate.** The summary panel now shows a link to the Terms of Service & Privacy Policy (opens a scrollable document modal containing the full Master Terms + Privacy Policy) and a mandatory consent checkbox. Confirm & Pay starts **disabled** and only enables once ticked; attempting to pay without it shakes/highlights the block and shows a toast. `termsAcceptedAt` (ISO timestamp) is sent with the payload.
3. **About Us.** A styled teaser block (`#about-home`, `#about-packages`) renders on Home and Packages with a "Read our story" button opening the full About Us text in the same document modal. Re-rendered on navigation, language change, and translation refresh.
New `Docs` module holds the long-form content (`Docs.aboutUs()`, `Docs.terms()`) as formatted HTML, presented in English (the authoritative legal language). New `.doc-modal` / `.about-block` / `.terms-block` CSS. 26 new i18n keys × 4 languages. Files touched: `app.js`, `index.html`.

### 6 Jun 2026 — ROOT CAUSE of ghost users: firestore.rules users/create lacked isAdmin()
The real source of the ghost-user problem (Auth account with no Firestore profile) was the security rule:
`allow create: if isSignedIn() && request.auth.uid == userId;` — self-create only, no admin path. When an admin uses Add User, the new Auth account is created via a secondary app (as the new user) but the profile is written with the PRIMARY db, which is still the ADMIN's session. So request.auth.uid (admin) != userId (new user) and the create was DENIED, leaving the Auth account with no profile. Fixed: `allow create: if isSignedIn() && (request.auth.uid == userId || isAdmin());` — self-create (customer signup / first-admin bootstrap) OR admin-create-for-anyone. Self-heal in createUser (previous entry) remains as a safety net to recover any ghost already created. ⚠️ firestore.rules must be re-published in Firebase Console (Firestore → Rules → Publish); it does NOT deploy via Netlify. File touched: `firestore.rules`.

### 6 Jun 2026 — fix: Add User self-heals ghost Auth accounts (Auth exists, no Firestore profile)
Creating an admin/user could leave a "ghost": createUserWithEmailAndPassword succeeds (Auth account created) but the subsequent setDoc(profile) doesn't complete, so the account never shows in the Users table (which reads Firestore) yet the email is taken — a retry then fails with auth/email-already-in-use and the account can only be removed via the Firebase Console. createUser now self-heals: on email-already-in-use it signs in with the supplied password using the secondary app; if sign-in succeeds and no Firestore profile exists for that uid, it writes the missing profile (+ queues the credentials email) — recovering the ghost. If sign-in fails (password doesn't match) it reports the email belongs to another account; if a profile already exists it reports the user already exists. To recover the current dmadmin@dealmai.com ghost: open Add User, enter that email + its existing password + Admin role, and Create — it will heal. File touched: `app.js`.

### 6 Jun 2026 — Revenue stat = literal day-of-event sum of all transactions (user-confirmed)
User clarified Revenue should be the actual sum of every transaction in the day (date-of-event), not a latest-state-per-transaction figure. Reworked the revenue reduce: Paid → + o.total on its day; Unpaid / Refund / Partial Refund → − refundAmountUsd (fallback o.total) on the day the reversal happened; Fail/failed/cancelled → not counted. Unpaid IS subtracted (per user). A full Refund whose Paid was on an earlier day is subtracted on the refund's day, so a day's Revenue can legitimately go negative. Removed the latest-event-per-tx + refund-sum maps from the previous (rejected) interpretation. Verified the 6 Jun screenshot's 9 rows sum to −4.42 with VAT-inclusive USD values. (Old pre-fix orders store stale refundAmountUsd, so historical totals only reconcile for transactions created after deploy.) File touched: `app.js`.

### 6 Jun 2026 — fix: Revenue stat = orders whose LATEST state is still Paid (not cash-flow netting)
Revenue Today was going negative/wrong because it netted cash flow within the date window: it added every Paid order's total and subtracted every refund's amount on the day each occurred. When a Paid order and its refund fell on different days (or a refund had no Paid counterpart in the window), the day's revenue went negative (e.g. −1.98) and didn't match the visible transactions. Per the chosen definition, Revenue now sums only orders whose transaction's LATEST event is still Paid: a transaction reversed by Unpaid or full Refund contributes 0; one ending in Partial Refund contributes (Paid total − refunded); fully-Paid contributes its total. Reversal rows no longer subtract on their own. Computed via a latest-event-per-transaction_id map + a per-transaction refund sum over all orders, applied to the date-filtered Paid orders. Non-ontheline (direct/chillpay) revenue is unchanged. File touched: `app.js`.

### 6 Jun 2026 — ontheline amounts are now treated as VAT-INCLUSIVE
Decision: the `amount` ontheline sends is the exact sum the customer paid (VAT already included), so the system must NOT add 7% on top. Reworked the VAT handling for ontheline only (direct/chillpay orders are unchanged — their package prices are pre-VAT and still get VAT added):
- **ontheline-webhook.js + Simulate (app.js):** the converted USD figure is now the grand total. We derive the pre-VAT subtotal as total ÷ 1.07, set vat = total − subtotal, and store total = converted USD (what the customer paid). Package matching + DM Champ credit calculation use the pre-VAT subtotal (so credits = subtotal × creditsPerUsd, unchanged in spirit). Previously the converted figure was treated as the subtotal and VAT was added on top, overstating the total by 7%.
- **Reversals:** partial refunds split the refunded (VAT-inclusive) amount the same way; full refunds (Unpaid/Refund) now refund the Paid order's actual total/subtotal/original figures. refundAmountUsd is stored VAT-inclusive so it matches the displayed amount, Total Spent, and Revenue.
Net effect: My Orders, Admin Orders (USD in parens), Total Spent, and Revenue all reflect the true VAT-inclusive amount the customer paid, and they reconcile across pages. Files touched: `ontheline-webhook.js`, `app.js`.

### 6 Jun 2026 — fix: Admin Orders USD amount (non-USD rows) now matches customer My Orders
For non-USD ontheline orders, the Admin Orders Amount column showed the USD value in parentheses using the pre-VAT amountUsd (e.g. $3.67), while the customer My Orders table showed the VAT-inclusive o.total ($3.93) — so the same order looked like a different USD amount on the two pages. USD-currency orders already matched because both pages used o.total there. Changed the Admin non-USD USD-in-parens to use o.total (VAT-inclusive) so both pages agree. The original-currency figure (e.g. THB 120.00) is unchanged, and credit math still uses the pre-VAT amountUsd separately. File touched: `app.js`.

### 6 Jun 2026 — fix: My Account Total Spent now matches My Orders (VAT unit mismatch)
Total Spent on My Account didn't reconcile with the amounts in My Orders. Root cause: it subtracted refunds using the pre-VAT `refundAmountUsd` from gross paid totals that were VAT-inclusive (o.total) — so refunds were under-subtracted and Total Spent was overstated (e.g. $7.04 instead of $5.23). Fixed by subtracting the reversal orders' o.total (VAT-inclusive), so both sides use the same VAT-inclusive figures shown in My Orders. Now: gross paid (incl VAT) − refunds (incl VAT) = net spent that matches the customer's own row-by-row math. CREDIT balance stays pre-VAT (credit-item prices − refundAmountUsd) and Credits Earned is the DM Champ credit count — both are intentionally different units from Total Spent. File touched: `app.js`.

### 6 Jun 2026 — customer My Orders refund display · stat labels for yesterday/last-month · credit balance nets refunds
- **Customer My Orders** now renders ontheline lifecycle events correctly: the Status column shows the event verbatim (Paid / Unpaid / Refund / Partial Refund, with Fail → Failed) instead of the raw un-translated `orders.status.Partial Refund` key, colour-mapped like the admin table; the Credits column shows reversal orders as a red negative figure (e.g. −2), matching admin.
- **Admin Orders stat labels** now cover Yesterday and Last Month. Previously only today/month had labels and the others fell through to "Period". Added admin.orders.stat.{yesterday,lastMonth} + admin.orders.stat.revenue.{yesterday,lastMonth} ×4 and wired them into ordersStatLabel/revenueStatLabel.
- **Credit balance (My Account CREDIT tile)** now nets out refunds (subtracts refundAmountUsd of ontheline reversals), so it stays consistent with Total Spent and Credits Earned which already account for refunds.
File touched: `app.js`.

Re the 6 Jun questions: CREDIT ($ balance) = sum of credit-bucket item prices on paid orders, now MINUS refunded USD. Total Spent = gross paid totals (incl VAT) MINUS sum of refundAmountUsd. Revenue stat = paid order totals MINUS ontheline refunds, excluding Fail/failed/cancelled.

### 6 Jun 2026 — webhook-events Transaction ID column · customer-side refund credits · Orders shows all events
Three changes:
1. **Recent webhook events table** now has a Transaction ID column (after Customer) + i18n admin.webhook.events.col.txId ×4.
2. **Customer Portal credit/spend now reflects refunds.** calculateCreditsEarned (My Account "Credits Earned" tile) was summing only status==paid orders and ignoring reversals — same bug as the admin Users table. Rewrote it to subtract creditsDeducted for ontheline Unpaid/Refund/Partial Refund and count event==Paid as earning (prefer amountUsd, floor at 0). Total Spent is now net of refunds (gross paid − sum of refundAmountUsd). The per-order AI Portal card still shows that order's own granted credits (unchanged, correct in context).
3. **Orders table shows EVERY transaction row** (was: latest event per transaction_id). getFilteredOrders no longer de-duplicates by transaction_id — it returns all filtered rows sorted newest-first, so the full Paid→Refund→… history for a transaction_id is visible. Revenue stat now subtracts ontheline refunds (refundAmountUsd) and excludes Fail. Order counts were already based on the raw date-filtered set, so they're unaffected.
File touched: `app.js`.

### 6 Jun 2026 — fix: refund/partial-refund now actually deducts from the user credit total
Bug found in production: firing a Refund deducted 0 credits (email showed "CREDITS REMOVED −0") and the user's total credits in the Users table didn't drop. Two root causes:
1. **totalCreditsForEmail() never subtracted reversals** — it summed only orders with status=="paid" and ignored ontheline reversal orders entirely. Rewrote it to: subtract `creditsDeducted` for ontheline Unpaid/Refund/Partial Refund orders, count both status=="paid" AND event=="Paid" as earning orders, prefer `amountUsd` over subtotal, and floor the net at 0.
2. **creditsGranted was 0 on Simulate Paid orders** — the Simulate Paid path doesn't store a dmchampSubAccount, so reversal math read 0. Both the webhook and Simulate now fall back to recomputing granted credits from the paid USD × creditsPerUsd when the stored value is missing/zero.
Also: the Admin Orders Credits column now shows reversal orders as a red negative figure (e.g. −501). Verified: Paid $5.01 = 501 credits; full Refund → 0; Paid $5 + Partial Refund $2 → 300. Files touched: `app.js`, `ontheline-webhook.js`.

### 5 Jun 2026 — Simulate-webhook form: Transaction ID field + client-side state machine
Added a Transaction ID input to the Admin → ontheline Webhook → Simulate form. Leaving it blank auto-generates one (old behaviour); typing an existing id lets you exercise the full event flow from the UI — e.g. fire Paid, then fire Refund/Partial Refund with the SAME id. fireTestWebhook now mirrors the deployed webhook's state machine client-side: it reads the current state from State.orders for that transaction_id, enforces all transition rules (new→Paid/Fail only; Paid→Unpaid/Refund/Partial Refund; Unpaid/Refund/Partial Refund final; Fail→Paid; duplicate-event guard) with toast errors, and for reversals deducts credits (full for Unpaid/Refund, proportional for Partial Refund with the <-paid-amount check) + queues the refund_cancel / partial_refund email. Provisioning is Paid-only, matching the backend. New i18n: toast.webhook.{dupEvent,needPaidFirst,fromPaid,finalState,fromFail,refundTooBig,reversed} + admin.webhook.test.txid.{ph,hint} ×4. File touched: `app.js`.

### 5 Jun 2026 — ontheline event state-machine + credit reversal + Transaction ID column
Major upgrade to ontheline event handling.
- **Transaction ID column** added to the Admin Orders table (after Reference) + i18n `admin.orders.col.txId` ×4. CSV already had it.
- **Event state machine** (ontheline-webhook.js): each incoming event is validated against the transaction's current state (latest event for that transaction_id) before processing. Rules: a NEW transaction_id may only start with Paid or Fail; Paid → Unpaid/Refund/Partial Refund only; Unpaid/Refund/Partial Refund are FINAL; Fail → Paid only. Illegal transitions (and Unpaid/Refund/Partial Refund for a non-existent transaction_id) return HTTP 400 with currentState/attemptedEvent in the body. 16/16 transition unit tests pass.
- **Provisioning narrowed to Paid only** — Partial Refund is now always a reversal of a prior Paid (the state machine guarantees it can't open a transaction), not a provisioning event.
- **Credit reversal (no DM Champ API call — display/audit only, per ontheline design):**
  - Paid → Unpaid or Refund = full reversal: removes ALL credits granted by the Paid order, full refund, queues the `refund_cancel` email.
  - Paid → Partial Refund = partial reversal: `amount` is the refunded portion and MUST be less than the original paid amount (else 400); credits removed = round(refundUsd × creditsPerUsd); remaining = granted − removed; queues the `partial_refund` email.
  - The reversal order stores reversalOf, creditsDeducted, creditsRemaining, refundAmountUsd/Original; an audit_log entry is written.
- **Two new email templates** (email-templates.js): `refund_cancel` (cancel + full refund) and `partial_refund` (partial refund + remaining balance), full HTML+text, 4 languages (refund.* + subject.refund.* strings).
- **Fail shown as "Failed"** in the Orders status column so ontheline Fail reads identically to a direct/chillpay failed order (same colour + label).
- **Setup instructions** (ontheline Webhook page) rewritten with the full event flow & state-transition rules + credit-reversal explanation.
Files touched: `ontheline-webhook.js`, `email-templates.js`, `app.js`.

### 5 Jun 2026 — ontheline mail To shows customer email as display-name
For ontheline emails (which go to the support inbox only), the To field now shows the customer email as the display-name while keeping support@dealmai.com as the real mailbox — e.g. `"agency4eg@gmail.com" <support@dealmai.com>`. Support can see at a glance which customer each email was for, straight from the To column, without opening it. The actual recipient is still support only (the customer address is just a label, never a real envelope recipient — the customer receives nothing). Double-quotes in the email are stripped first so the "name" <addr> syntax can't break. File touched: `send-queued-emails.js`.

### 5 Jun 2026 — fix: Simulate-webhook calls convert-currency directly (/.netlify/functions/)
The /api/convert-currency redirect alias did not work on production — calling it returned index.html (the SPA catch-all), even though the function itself worked when called at /.netlify/functions/convert-currency. This is the SAME known /api/* redirect-cache issue this project already worked around for delete-customer and provision-dmchamp (both call /.netlify/functions/ directly). Changed fireTestWebhook to call `/.netlify/functions/convert-currency` directly instead of `/api/convert-currency`. The netlify.toml /api/convert-currency redirect is left in place (harmless) but no longer relied upon. File touched: `app.js`. (Verified: GET /.netlify/functions/convert-currency?amount=3550&currency=THB returns {"source":"freecurrencyapi.com"} with the live key.)

### 5 Jun 2026 — currency-convert.js verified against freecurrencyapi docs
Cross-checked currency-convert.js against the official freecurrencyapi docs (URL `https://api.freecurrencyapi.com/v1/latest`, GET, `apikey` auth, optional `base_currency` default USD, response `{data:{CODE:rate,...}}` where rate = units per 1 USD). Logic matched; tightened two things:
- **Auth via HTTP header instead of query param** — the docs warn the `?apikey=` query param can leak into access logs and recommend the `apikey` request header. Switched to `headers: { apikey }`; the URL now carries only `base_currency=USD`.
- **Explicit handling/logging for 429 (quota or per-minute rate limit) and 401/403 (bad key)** — these now log a clear reason before falling back to open.er-api.com, making the free-tier 5,000/month limit and key problems easy to spot in Netlify function logs. (Only successful calls count against quota per the docs.)
Conversion math (`usd = amount / rate`) and the ≥2-numeric-rates validation were already correct. File touched: `currency-convert.js`.

### 5 Jun 2026 — fix: Free Currency API not being used + admin Simulate now uses the real key
Two issues found with currency conversion:
1. **Brittle validation in currency-convert.js** — the freecurrencyapi response was only accepted if it contained a finite `THB` or `EUR` rate. A valid response that omitted both (or any future shape change) silently fell through to the open.er-api.com fallback. Replaced with a generic check: accept the response if its `data` object has at least 2 positive numeric rates. Also added logging of the HTTP status + body on non-2xx so auth/quota errors are visible in the Netlify function logs.
2. **Admin Simulate-webhook used open.er-api.com, never the key** — `fireTestWebhook` (frontend) called open.er-api.com directly because the browser cannot hold `FREECURRENCY_API_KEY`. Added a new backend endpoint **`convert-currency.js`** (`GET /api/convert-currency?amount=&currency=`) that wraps the shared `currency-convert` lib, so the Simulate form now converts via the same Free Currency API key as the real webhook (falling back to open.er-api.com then identity). New redirect `/api/convert-currency` added to netlify.toml.

Note: the real ontheline webhook already used `currency-convert.js` correctly — if conversion looked wrong there, it was the validation issue (#1). New file: `convert-currency.js` → `netlify/functions/`. Files touched: `currency-convert.js`, `app.js`, `netlify.toml`.

### 5 Jun 2026 — fix: ontheline source not propagating to admin-queued emails
Follow-up to the support-only redirect: emails were STILL reaching the customer because `App.queueEmail()` (the frontend queue helper used by Mark Paid, Resend Receipt, and the Simulate-webhook button) never wrote a `source` field to the email_queue doc — so the sender saw `fromOntheline = false` and delivered normally. Fixed `queueEmail` to copy `order.source` onto the queue doc, and made the Mark-Paid emailOrder payload preserve `o.source`. Backend webhook writes were already correct. Now any ontheline-sourced order routes its mail to support only, regardless of which code path queued it. File touched: `app.js`.

### 5 Jun 2026 — ontheline emails redirected to support only (replaces Zero-Width-Space)
The Zero-Width-Space (U+200B) trick added on 31 May to stop ontheline customer emails from delivering didn't work: Resend strips the U+200B and delivers to the customer anyway. Replaced it with a clean envelope-level redirect.
- **send-queued-emails.js:** removed `insertZwspBeforeAt` entirely. `sendViaResend` now branches on `fromOntheline`: normal mail keeps `To = customer, Bcc = support`; **ontheline mail sets `To = support@dealmai.com` only** — the customer address never appears on the envelope, so the customer is never delivered to, while support still receives the message. The subject is tagged `[ontheline → <customer>]` so support can see the intended recipient. ontheline sends are recorded with `status: 'sent_support_only'` + `customerDelivered: false` + `deliveredTo: support`.
- **app.js:** Email Queue shows a teal `support only` badge for `sent_support_only` rows (with a tooltip), and the email-view modal shows a `✓ SUPPORT ONLY` badge plus an info note explaining the customer was not emailed. i18n `admin.emails.status.supportOnly*` ×4.
- The customer's email address is still stored / shown in the Admin Console / exported to CSV exactly as received (clean). Files touched: `send-queued-emails.js`, `app.js`.

### 1 Jun 2026 — ontheline currencies, multi-event transactions, multi-currency amounts, expanded date filters
A six-part build extending the ontheline pipeline. All validated (app.js parses via acorn; ontheline-webhook.js + currency-convert.js + send-queued-emails.js pass `node -c`; 41/41 smoke checks; dedup + FX-conversion unit tests pass).

**1. ontheline Currencies (admin-managed)** — new collection `ontheline_currencies`, each doc `{ code, symbol, label }` (e.g. `USD` / `$` / `US Dollar`). Dedicated admin page (sidebar + section + routing + mobile tab) with full CRUD (`renderAdminCurrencies`, `addCurrency`/`editCurrency`/`saveCurrency`/`deleteCurrency`, unique-code validation, symbol required). State `onthelineCurrencies` synced via a new `subscribeCollections` listener. i18n `admin.side.currencies` + `admin.currencies.*` + `toast.currencies.*` ×4.

**2. Webhook multi-event + currency validation** (ontheline-webhook.js).
- `event` now accepts **Paid, Unpaid, Refund, Partial Refund, Fail** (legacy `purchase.completed` → `Paid`). Unknown events → `400 {field:'event'}`. Normalised via an `EVENT_ALIASES` map.
- Only **Paid** and **Partial Refund** trigger full processing (user provisioning + emails + DM Champ credit recording). The rest (`PROVISION_EVENTS` excludes them) write a lean order + webhook_event for the audit trail and return early.
- `currency` is validated against `ontheline_currencies` (case-insensitive) → `400 {field:'currency'}` if unknown.
- Idempotency changed from per-`transaction_id` to per-(`transaction_id` + `event`) so a transaction can legitimately receive multiple events over time; only an exact same-event replay is de-duplicated.

**3. Currency → USD conversion** — new `currency-convert.js` lib. `convertToUsd(amount, currency)` uses **Free Currency API** (`api.freecurrencyapi.com`, key in `FREECURRENCY_API_KEY`, 5,000 req/mo free) with **open.er-api.com** as a keyless fallback and a hardcoded rate table as last resort. 1-hour in-memory cache. The webhook converts the incoming amount to USD, stores both `amountOriginal` (+ `currency`) and `amountUsd` (+ `fxRate`, `fxSource`) on the order, and computes DM Champ credits from the USD value.

**4. Orders — latest event per transaction_id** (app.js) — ontheline sends a new order per event, but `getFilteredOrders()` now de-duplicates by `transaction_id`, keeping only the newest `createdAt` per txId and sorting newest-first so an updated transaction floats to the top. The STATUS column shows the ontheline **event** (colour-mapped: Paid→green, Partial Refund/Unpaid→amber, Refund/Fail→red) instead of the generic status.

**5. Orders — expanded date filters + currency** (app.js) — date filter expands from 3 to **5 modes: Today, Yesterday, This Month, Last Month, Period** (refactored into a shared `computeOrderDateRange()` helper used by both the renderer and the CSV export). New **currency** dropdown filter (`orderCurrencyFilter`) alongside partner/paygw. The **AMOUNT** column now shows the original-currency amount with its symbol (`$`, `฿`, `¥`, `₩`, …) followed by the USD value in parentheses. CSV export gains `Currency`, `Amount (Original)`, `Amount (USD)` columns, uses the event as the status for ontheline rows, and the filename encodes the date mode + source + partner + paygw + currency scope. The order-view modal's ontheline block shows event + currency amount.

**6. Webhook events — currency + amount + event** (app.js) — the Recent webhook events table AMOUNT column shows the original-currency amount (symbol) + USD in parentheses; the STATUS column shows the ontheline event (colour-mapped), falling back to the legacy success/fail display for old rows without an `event` field.

**Firestore rules** — added `ontheline_currencies` (admin read/write; webhook reads via Admin SDK).

**Deploy note** — new file `currency-convert.js` → `netlify/functions/lib/currency-convert.js`. Set env var `FREECURRENCY_API_KEY` for best FX accuracy (falls back to open.er-api.com without it). **Create at least one currency (e.g. USD $) in Admin → ontheline Currencies before the webhook will accept calls** — the new currency validation rejects unknown codes with 400. Files touched: `app.js`, `index.html`, `ontheline-webhook.js`, `currency-convert.js` (new), `firestore.rules`.

**Admin webhook page sync (1 Jun 2026)** — the "Setup instructions for ontheline" doc block and the "Simulate ontheline webhook" form on the ontheline Webhook page were updated to the new schema: the sample payload shows `event`/`currency`/`partner`/`paygw`, the simulate form has dropdowns for Event (Paid/Unpaid/Refund/Partial Refund/Fail), Currency, Partner, and PayGW (populated from the collections), and `fireTestWebhook` mirrors the deployed validation (rejects unknown partner/paygw/currency), converts the amount to USD via open.er-api.com, stores `event`/`amountOriginal`/`amountUsd`/`fxRate`, and only provisions on Paid/Partial Refund.

### 31 May 2026 — evening (language enable/disable · ontheline Partners & PayGW · webhook validation · orders+events partner/paygw · email BCC+ZWSP)
A six-part feature build. All edits validated (app.js parses via acorn; ontheline-webhook.js + send-queued-emails.js pass `node -c`; 32/32 smoke checks).

**1. Language enable/disable** — admins choose which UI languages end-users can pick.
- `config/branding.enabledLangs` — array like `["en","th"]`; `null`/absent = all enabled (backwards-compatible). **"en" is always forced on** (fallback) and cannot be disabled.
- `App.isLangEnabled(code)` helper. `buildLangPicker()` + checkout receipt-language `<select>` both skip disabled langs. `subscribeBranding` syncs `enabledLangs` and, if the current language was just disabled, falls back to `App.setLang("en")`.
- Admin → Languages: each lang card has an ON/OFF toggle (en shown locked-ON). Handler `AdminActions.toggleLangEnabled(code)` writes the full enabled list, keeps "en" present, preserves canonical order. i18n `admin.langs.toggle.*` + `toast.langs.*` ×4. CSS `.lang-toggle` / `.lang-disabled` in index.html.

**2. ontheline Partners & Payment Gateways** — two new admin-managed reference lists.
- Collections `ontheline_partners` + `ontheline_paygw`, each doc `{ code, companyName, createdAt }`.
- Sidebar items + sections (`adm-partners`, `adm-paygw`) + setAdmin routing + mobile tabs. Generic `renderAdminCodeList(kind)` renders both; `renderAdminPartners()` / `renderAdminPaygw()` are thin wrappers.
- CRUD handlers `addCodeItem` / `editCodeItem` / `_openCodeItemModal` / `saveCodeItem` / `deleteCodeItem` — unique-code validation (case-insensitive), uses `addDoc`/`updateDoc`/`deleteDoc`. State arrays `onthelinePartners` / `onthelinePaygw` synced via two new `subscribeCollections` listeners. i18n `admin.side.partners`/`paygw` + `admin.partners.*` + `admin.paygw.*` + `admin.codelist.*` + `toast.codelist.*` ×4.

**3. Webhook partner/paygw validation** (ontheline-webhook.js).
- Extracts `partner` + `paygw` from the payload. After the email/amount check, validates both against the Firestore collections (case-insensitive). Missing or unknown partner → `400 {error:'Unknown partner code: X', field:'partner'}`; same for paygw. A lookup failure → `500`.
- Stores `partner` + `paygw` on both the `webhook_events` doc and the `orders` doc.

**4. Orders display / filter / CSV** (app.js).
- Admin Orders table: new **Partner / PayGW** column after Source (ontheline rows show `P:`/`G:` code + companyName; others show "—").
- Two dropdown filters (`.orders-dropdown-filter`) populated from the collections; `getFilteredOrders()` adds exact-match partner + paygw filters (so they also affect CSV export). Handlers `setOrderPartnerFilter` / `setOrderPaygwFilter`; State `orderPartnerFilter` / `orderPaygwFilter`.
- CSV export: 4 new columns (Partner Code, Partner Company, PayGW Code, PayGW Company). The exported customer email is the **raw/clean** value (never the ZWSP version).
- `viewOrder` modal: a magenta-bordered ontheline block showing partner/paygw codes + company names. i18n `admin.orders.col.partnerGw` + `admin.orders.filter.partner.*`/`paygw.*` + `admin.orders.view.ontheline`/`partner`/`paygw` ×4.

**5. Webhook events display** (app.js) — `renderAdminWebhook` events table gains a Partner/PayGW column (`P:`/`G:` code + companyName). Header `admin.webhook.events.col.partnerGw` ×4.

**6. Email BCC + Zero-Width-Space** (send-queued-emails.js + ontheline-webhook.js).
- `const SUPPORT_BCC = 'support@dealmai.com'` — **every** outbound Resend email now BCCs support (`bcc: [SUPPORT_BCC]` in the request body), regardless of source.
- `insertZwspBeforeAt(email)` inserts U+200B between the local part and "@" (guards: no "@" or "@" at index 0 → unchanged). Applied **only** when `fromOntheline && actualTo === to` (skipped when test-mode rewriting redirects). ZWSP is injected **only at Resend send-time** — never stored in Firestore, shown in the Admin Console, or written to CSV.
- ontheline-webhook.js: both `email_queue` writes (invoice/receipt/credentials batch + dmchamp_linked) now include `source: 'ontheline'`. `processEmailDoc` passes `fromOntheline: data.source === 'ontheline'` to `sendViaResend`.

**Firestore rules** — added `ontheline_partners` + `ontheline_paygw` (admin read/write; webhook reads via Admin SDK which bypasses rules). Updated the `config/branding` comment to list `faviconDataUrl`, `enabledLangs`, `dmchampPortalUrl` (branding doc stays public-read so favicon + language picker work for guests).

**Deploy note** — this build spans `app.js` (root), `index.html` (root), `netlify/functions/ontheline-webhook.js`, `netlify/functions/send-queued-emails.js`, plus publishing `firestore.rules`. **Before ontheline can call the webhook, create at least one partner + one paygw entry in the admin UI** — the new validation rejects unknown/missing codes with 400.

### 31 May 2026 (favicon upload · default favicon · Chrome cache fix · DNS confirmation)
- ✅ **Favicon upload in Admin → Branding** — new full-width card below Site Name + Logo. Admins upload a browser-tab icon (PNG/ICO/SVG/WebP, square, ≤100 KB) stored as a base64 data URL in `config/branding.faviconDataUrl`. Includes a live "tab preview" mimicking a browser tab. Handlers `AdminActions.uploadBrandFavicon` / `resetBrandFavicon`; `State.branding.faviconDataUrl` + sync in `subscribeBranding`; i18n `admin.branding.favicon.*` + `toast.branding.favicon.*` × 4 langs.
- ✅ **Default favicon** — added an inline gradient-"D" SVG `<link rel="icon" data-brand-favicon-default>` to `index.html` so the tab always shows a branded icon instead of the browser globe (the page previously had no favicon at all).
- ✅ **Chrome favicon-cache fix** — first implementation mutated the existing `<link>` href, which Chrome ignored (it caches favicons hard). Reworked `applyBranding()` to **remove every icon link and recreate a single fresh one** each run, forcing re-evaluation. MIME type inferred from the data-URL prefix. Verified with jsdom: custom upload shows, re-renders don't duplicate, reset restores the default. Even so, Chrome may keep the old tab icon until the tab is closed+reopened or tested in Incognito — documented as expected browser behavior, not a bug.
- ✅ **Deploy note** — this change touches BOTH `app.js` (favicon logic + admin UI + handlers + State + i18n) and `index.html` (default favicon link). Deploy both.
- ✅ **DNS confirmation** — owner confirmed `dealmai.com` nameservers are the Netlify/NS1 set and the apex points at Netlify, so the `app`/`docs`/`api` CNAMEs added in the Squarespace DNS panel are ignored and must be re-added in Netlify → Domains → DNS records. (Reinforces the 30 May troubleshooting note.)

### 30 May 2026 — afternoon (Ai Portal / DealMai Ai rebrand · Open Portal buttons · customer change-password · language-switch fix · DNS troubleshooting)
- ✅ **Customer portal "Ai Portal" rebrand** — every `account.dmchamp.*` i18n value now reads "Ai Portal" instead of "DM Champ" (4 langs). The button label `account.dmchamp.open` became "Open Ai Portal". Three-layer safety: DEFAULT_STRINGS edited + STALE_VALUE_OVERRIDES (6 keys × 4 langs) + a **scoped** unconditional `I.t()` pass that replaces "DM Champ"→"Ai Portal" ONLY for keys under `account.dmchamp.` — the admin console deliberately keeps "DM Champ" (the real product name admins configure).
- ✅ **Email "DealMai Ai" rebrand** — `email-templates.js` EMAIL_STRINGS replaced "DM Champ"→"DealMai Ai" across 32 values (8 keys × 4 langs), subject + body, both email kinds. Example: "Your DealMai Ai workspace is linked to this purchase". De-duplicated the access subject's redundant "AI" ("DealMai Ai AI workspace" → "DealMai Ai workspace"). Comments + key names + kind identifiers unchanged.
- ✅ **Open Portal buttons (admin + customer)** — Admin → DM Champ status banner gained an "Open DM Champ Portal ↗" button; customer My Account card's "Open Ai Portal →" button now also appears in the `topped_up` state. Both open the configured `State.dmchamp.portalUrl`.
- ✅ **`topped_up` card added to customer portal** — previously `renderCustomerAccount` had no branch for `topped_up`, so customers whose sub-account was credited via repeat purchase or ontheline saw NO DM Champ card. Added a full card (email + credits + Open Ai Portal button + "credits added" message).
- ✅ **Customer change-password button** — My Account bottom CTA row gained a "Change Password" button. Reuses the existing `openCustomerPasswordModal()` / `doCustomerPasswordChange()` (which re-authenticates the current password via `reauthenticateWithCredential` before `updatePassword`). Refactored the modal to take a `forced` flag so the forced-first-login nudge keeps its security wording while the new button uses neutral wording clarifying it changes the **Deal Pro account** password (not Ai Portal).
- ✅ **Language-switch full re-render fix** — `setLang()` now re-renders the visible customer page (`renderCustomerAccount` / `renderCustomerOrders`). Before, switching language only relabeled `[data-i18n]` nav elements instantly; the card content + bottom buttons (built with JS template literals) stayed stale until the user navigated away and back.
- ✅ **DNS troubleshooting documented** — diagnosed why `app.dealmai.com` returned "site can't be reached": `dealmai.com`'s nameservers are set to **Netlify DNS** (`dns1-4.p01.nsone.net` = NS1, Netlify's backend), so DNS records are read from Netlify DNS, NOT the Squarespace DNS Settings panel where the CNAME had been added. Fix: add the `app`/`docs`/`api` CNAMEs in **Netlify → Domains → DNS records**. Verify authoritative DNS with `nslookup -type=NS dealmai.com`. Documented in DM Champ White-Label section.

### 30 May 2026 — morning (custom domain go-live · DM Champ White-Label · ChillPay → Payment Gateway rebrand · DM Champ Portal URL config)
- ✅ **Production custom domain `dealmai.com` live** — Netlify domain config set, DNS pointed at Netlify (Squarespace registrar), Resend domain verified (Zoho mail server + Resend SPF combined), `EMAIL_FROM` switched to `noreply@dealmai.com`, `EMAIL_REPLY_TO` to `support@dealmai.com`, `EMAIL_TEST_REWRITE_TO` deleted, `PUBLIC_SITE_URL` set. Old netlify.app URL still works (Netlify keeps both).
- ✅ **ChillPay → Payment Gateway UI rebrand** — replaced every customer-/admin-facing mention of "ChillPay" with "Payment Gateway" across 4 languages:
  - 64 i18n values in `app.js` (16 keys × 4 langs)
  - 4 HTML strings in `index.html`
  - Includes admin instructions like "Configure this URL in your Payment Gateway merchant dashboard"
- ✅ **STALE_VALUE_OVERRIDES with 56 entries** — `app.js` `I.t()` flips legacy Firestore values to the new wording at runtime for the 14 affected keys × 4 langs. Migrates existing deployments without manual Firestore edits.
- ✅ **Unconditional ChillPay → Payment Gateway substitution** in `I.t()` — final safety net pass after STALE_VALUE_OVERRIDES + placeholder substitution. Catches admin-edited Firestore values whose wording diverged from the original seed (the STALE table relies on exact-string match). Safe because no current i18n VALUE intentionally contains "ChillPay" anymore. Three-layer migration strategy documented in Translation System section.
- ✅ **NOT touched** — code identifiers, CSS classes, HTML data attributes, Firestore field values (`o.source === "chillpay"`), env var names, file names (`chillpay-callback.js`, `chillpay.js`), URL paths (`/api/chillpay-callback`). All technical references to ChillPay as a provider stay because the actual integration is unchanged — only branding/wording flipped.
- ✅ **Identifier-collision recovery during batch replace** — initial batch replace of "ChillPay" → "Payment Gateway" broke 12 JS identifiers (e.g. `renderAdminChillPay` → `renderAdminPayment Gateway` with a literal space, which is a syntax error). Fixed with a context-aware regex that restores the original spelling when the match is adjacent to camelCase neighbors `[a-zA-Z0-9_$]` or followed by `(` (function call). Lessons-learned codified as a build-step pattern for future renames.
- ✅ **DM Champ Portal URL admin-configurable** — added "Portal URL" input to Admin → DM Champ form (with http(s) validation + trailing slash trimming). Stored in `config/branding.dmchampPortalUrl` (public-read) so the customer portal can use it without admin privileges. `config/dmchamp` stays admin-only because of the API key. `subscribeBranding()` syncs to `State.dmchamp.portalUrl` in realtime; `email-templates.js` `loadBranding()` reads the same field with 30s cache. Default `https://app.dmchamp.com`; agency White-Label customers override to e.g. `https://app.dealmai.com`.
- ✅ **DM Champ Domain White-Label setup** — configured `app.dealmai.com` in DM Champ Settings → White Labeling + uploaded logo + added CNAME `app` → `tenants.youraiconnector.com` at Squarespace registrar. Status: pending DNS propagation + SSL provisioning. Setup steps + diagnostic procedures (nslookup, browser cache flush, Incognito test) documented in DM Champ Integration section.
- ✅ **Documentation refreshes** — Production env vars table now lists current production values; "Pre-Production Tasks" two domain-related items marked done; "Working features" list captures all 30 May items; Known Limitation #13 (email branding hardcoded) marked resolved with implementation pointer.

### 29 May 2026 (Dynamic brand name · server-side email runtime branding)
- ✅ **Dynamic `{brand}` substitution in `I.t()`** — added auto-substitution of `{brand}` placeholder with `State.branding.siteName` in every i18n string lookup. Six keys use the placeholder (`hero.lede` × 4 langs, `login.sub` × 4 langs). `applyBranding()` now calls `I.apply()` to re-render every `[data-i18n]` element when admin saves a new Site Name → hero copy, login subtitle, and admin previews flip live without reload.
- ✅ **STALE_VALUE_OVERRIDES entries for hero.lede + login.sub** — migrates existing Firestore-seeded values ("Deal Pro is an autonomous...") to the placeholder version ("{brand} is an autonomous..."). Without this, the new code couldn't take effect because Firestore values shadow DEFAULT_STRINGS in `I.t()`.
- ✅ **Server-side email templates use runtime branding** — `email-templates.js` refactored to async `renderEmail(kind, lang, order, db)`. New `BRAND_DEFAULTS` + `loadBranding(db)` async loader with 30s cache. Reads `PUBLIC_SITE_URL` env var + `EMAIL_REPLY_TO` env var + Firestore `config/branding` (siteName, dmchampPortalUrl). Removed `BRAND.name`/`portalUrl`/`supportEmail` hardcodes; all 5 render functions now accept `(lang, order, brand)`; 24 hardcoded "Deal Pro" strings in 4 langs replaced with `{brand}` placeholder; 6 i18n keys with `{brand}` get `vars.brand` passed automatically. Caller `send-queued-emails.js` updated to `await renderEmail(..., db)`. Tested 5 cases pass (default fallback, override, multi-word brand, Thai, DM Champ linked email).
- ✅ **Admin invoice + email preview modals use brandName** — `<h2>Deal Pro</h2>` hardcodes replaced with `${escapeHtml(brandName)}` from `State.branding.siteName`.
- ✅ **Result: full brand-name dynamism across the app** — header, footer, browser tab, hero, login subtitle, admin previews, and all 5 email templates × 4 langs all reflect the admin's current Site Name. No redeploy needed for brand changes; emails pick up changes within 30 seconds (the cache window).

### 28 May 2026 (ontheline DM Champ flow — no-API credit recording)
- ✅ **ontheline orders no longer call the DM Champ API** — per requirements, ontheline manages DM Champ provisioning + crediting on its own side. Deal Pro's `ontheline-webhook.js` must NOT create, look up, or top-up via the DM Champ API for ontheline orders. (This reverses the earlier same-day change that wired `provisionForOrder()` into ontheline.)
- ✅ **Credits recorded for display only** — the webhook reads `creditsPerUsd` from `config/dmchamp` (Firestore, no network) and computes `creditsEarned = amount × creditsPerUsd` via the pure `dmchamp.computeMonthlyCredits()`. No `fetch()` to DM Champ anywhere in the ontheline path.
- ✅ **Synthetic `topped_up` record** — ontheline writes `order.dmchampSubAccount` with `status:'topped_up'`, `source:'ontheline'`, `uid:null`, `httpStatus:0`, `creditsGranted:creditsEarned`. This makes credits appear consistently in Admin → Users (total), Admin → Orders (Credits column), the Order View modal, CSV export, and the Customer Portal — all without an API call.
- ✅ **DM Champ email always uses `dmchamp_linked` template** for ontheline (subject "Your DM Champ workspace is linked to this purchase") regardless of whether the Deal Pro user is new or returning.
- ✅ **Order View modal simplified for ontheline** — the DM Champ Sub-Account section shows ONLY "✓ Topped up by N credits" (no formula block, no email/uid/date, no retry button) since there's no API interaction. Detected via `sub.source === 'ontheline'`. Chillpay repeat purchases still show the full detail + retry.
- ✅ **New audit action `dmchamp_ontheline_credit`** — logged for every ontheline credit recording with a note that no API call was made.
- ✅ **`provisionForOrder()` invocation paths reduced to two** (ChillPay in-process + admin manual HTTP). The `forceLinkedEmail` option added earlier is now unused but kept for future flexibility.
- ✅ **All four files re-validated** (app.js, ontheline-webhook.js, provision-dmchamp.js, dmchamp.js); `computeMonthlyCredits` unit-tested 4/4; confirmed zero DM Champ API references in the ontheline path via grep.

### 28 May 2026 (Credits feature + Customer Portal redesign + Admin UX improvements)
- ✅ **Credit calculation now uses `order.subtotal` (BEFORE VAT)** — rationale: VAT is collected for the tax authority and shouldn't change credit grants between jurisdictions. `provision-dmchamp.js` falls back to `order.total` only for legacy orders missing subtotal. All UI surfaces use the same rule (Customer Portal stats, My Orders Credits column, Admin Orders Credits column, Admin Users Credits column, Admin Order detail modal, CSV export).
- ✅ **Auto top-up on repeat purchases via DM Champ Grant Credits API** — when a returning customer (existing DM Champ email) buys again, Deal Pro now calls `POST /v1/subaccounts/credits` to add the new purchase's credits to their existing balance. Previously marked as `linked` with `creditsGranted: 0` and required manual admin intervention. On API success: status becomes `topped_up` with `creditsGranted` + `newBalance` from response. On failure: fallback to old `linked` behavior so admin can intervene from Order View modal.
- ✅ **Confirmed Grant Credits API spec from official DM Champ docs** (`help.dmchamp.com/agency/sub-account-auto-recharge`): endpoint is `POST /v1/subaccounts/credits` (NOT `/grant_credits`), body `{email, amount, description?}`, auth via `?apiKey=` query parameter only. Initial implementation guessed wrong URL + had a 3-body-shape fallback loop; both removed after docs confirmed.
- ✅ **Added `findSubAccount()` + `grantCredits()` to `dmchamp.js`** — lookup-by-email and credit-grant API wrappers. Exported alongside existing `createSubAccount`.
- ✅ **`ontheline-webhook.js` records DM Champ credits for display** — note: this was briefly implemented as a full `provisionForOrder()` call, then revised (same day) per requirements: ontheline orders must NOT call the DM Champ API at all (ontheline manages DM Champ itself). The webhook now computes credits from the amount and writes a synthetic `topped_up` record + queues a `dmchamp_linked` email, with zero DM Champ API calls. See the "ontheline Webhook" endpoint section for the full flow.
- ✅ **Credits Earned tile in Customer Portal stats row** (My Account) — shown only when `creditsEarned > 0`. Uses snapshot rate from `order.dmchampSubAccount.creditsPerUsd` per order, falls back to `State.dmchamp.creditsPerUsd`, then default 100. Followed by a note pointing to DM Champ Portal for live remaining balance.
- ✅ **Credits column in Admin Orders table** — per-order credit calculation matching the provision logic. Empty for non-paid orders. Also added to CSV export.
- ✅ **Credits Earned section in Admin Order detail modal** — shows the formula `$X (subtotal, ex. VAT) × Y credits/USD = N credits` + note. New `topped_up` state pill (teal-deep) with retry button, updated `linked` state to amber with "manual top-up required" message.
- ✅ **Credits column in My Orders (customer)** — per-order credit display so customers see what each purchase earned them.
- ✅ **Credits column in Admin Users table** — sums credits across ALL paid orders for each user's email (helper `totalCreditsForEmail()`). Customers show teal number, admins show "—".
- ✅ **Email column + email substring filter in Admin Orders** — new text input next to source filter pills, case-insensitive substring match against `customer.email`. Debounced 180ms (immediate on clear). Focus + caret preservation across re-renders via `document.activeElement` check + `setSelectionRange()`. Clear button "×" inside the input.
- ✅ **My Account layout redesign** — was single column (each stat tile became a full-width row, looked bad on desktop). Now 2-column grid on desktop (`grid-template-columns:1.4fr 1fr`): Active subscription card on left, 2×2 stats grid on right. Collapses to single column at ≤980px but keeps stats as a 2×2 grid (not vertical stack) for compactness. Mobile (≤560px) reduces padding and font sizes.
- ✅ **New CSS classes in `index.html`** — `.acct-layout`, `.acct-active`, `.acct-stats`, `.acct-stat` + `.orders-email-filter` + `.orders-email-clear`. Previously `.acct-stat` had no rules and rendered as flow content (one stat per line).
- ✅ **`loadDmChampConfig({force})` helper extracted from `renderAdminDmChamp()`** — shared loader, idempotent, used by Customer Portal, My Orders, Admin Orders, Admin Users (all need `creditsPerUsd` as fallback). Fire-and-forget pattern: first render uses default `100`, then triggers re-render once loaded.
- ✅ **Updated Known Limitations #16** (Grant Credits API now live, replaces "not supported"), added #20 (subtotal calc), #21 (lazy load pattern), #22 (focus preservation in filter input), #23 (API endpoint confirmation note).
- ✅ **+13 i18n keys × 4 languages = 52 declarations** — all validated. New keys: `account.stats.credits`, `account.credits.note`, `orders.col.credits`, `admin.users.col.credits`, `admin.orders.col.credits`, `admin.orders.col.email`, `admin.orders.filter.email.placeholder`, `admin.orders.filter.email.clear`, `admin.orders.view.credits.label`, `admin.orders.view.credits.note`, `admin.orders.view.credits.topup`, `admin.orders.view.credits.new`, `admin.orders.view.credits.linked`.

### 23 May 2026 (SPA module path bug fix)
- 🐛 **Fixed:** `app.js` failed to load on deep routes (`/admin/orders`, `/account`, etc.) after page refresh or direct deep-link navigation. Error: *"Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of text/html"* + cascade of `App is not defined` from chat widget.
- 🔍 **Root cause:** `index.html` referenced `<script type="module" src="./app.js">` (relative path). With History API at `/admin/orders`, the browser resolved `./app.js` to `/admin/app.js` → Netlify can't find it → SPA catch-all returns `index.html` (text/html) → strict ES Module loader rejects.
- ✅ **Fix:** Changed to `<script type="module" src="/app.js">` (absolute, domain-rooted) — resolves correctly from every route. Single-line change in `index.html`.
- 📝 Added inline HTML comment above the script tag explaining why absolute path is required, so future edits don't regress.
- 📝 Added Known Limitation #19 documenting the bug + detection pattern (only deep routes break, home page hides the bug).

### 22 May 2026 (afternoon — DM Champ integration)
- ✅ **DM Champ integration complete**: auto-provision sub-accounts after every paid order
- ✅ Created `lib/dmchamp.js` — API wrapper for `POST /v1/subaccounts` with `loadConfig`, `computeMonthlyCredits`, `createSubAccount`, `describeConfig`
- ✅ Created `netlify/functions/provision-dmchamp.js` — admin HTTP endpoint + exported `provisionForOrder()` for in-process call from chillpay-callback
- ✅ Wired into `chillpay-callback.js` — best-effort auto-provision after payment + emails
- ✅ Added Admin → DM Champ panel (API key, creditsPerUsd, defaults, rollover, timezone, country) with live conversion preview
- ✅ Added Order View modal DM Champ section with 3 states (created/linked/failed) + Provision/Retry button + Copy buttons for UID + temp password
- ✅ Added Customer Portal DM Champ Workspace card (4 states: created/linked/failed/pending)
- ✅ Added `dmchamp_access` email template × 4 langs (with temp password)
- ✅ Added `dmchamp_linked` email template × 4 langs (for "email already in use" — no password)
- ✅ Detect DM Champ "email already in use" → mark as `linked` instead of `failed` + send different email
- ✅ Added `App.copyFromAttr(el)` helper using `data-copy` attribute (fixes inline-JSON-stringify issue that rendered onclick as text)
- ✅ Refactored Order View grid to `auto-fit minmax(220px,1fr)` + `word-break:break-all` for long opaque strings (UIDs, JWT passwords)
- ✅ Stacked DM Champ admin panel to single column with `max-width:760px` (better mobile UX)
- ✅ Firestore Rules updated: `webhook_events` admin-writable (Fire Test Webhook button), added `audit_log` rule, comment on `config/dmchamp`
- ✅ Added DMCHAMP_API_KEY env var to Netlify (fallback when Firestore config absent)
- ✅ +51 i18n keys × 4 languages (total ~485 keys, 100% coverage in all langs)

### 22 May 2026 (morning — Branding system)
- ✅ **Branding system complete**: Site name + logo editable via Admin → Branding panel
- ✅ Default Deal Pro logo embedded as base64 (~29 KB PNG, 320×95)
- ✅ `config/branding` Firestore doc with public read (so guests get the brand)
- ✅ `subscribeBranding()` realtime listener → `applyBranding()` updates header logo, footer, browser tab
- ✅ +29 i18n keys × 4 languages
- ✅ Wordmark auto-splits multi-word names ("First <em>Rest</em>")

### 21 May 2026
- ✅ Always-fresh Packages page — re-renders on navigation (fixed stale-cards bug)
- ✅ Realtime Package Updates — toast notification + visual flash animation
- ✅ Unified Direct + ChillPay source in Orders page (was 4 filters, now 3)
- ✅ Added URL Result endpoint card in Admin → ChillPay Events
- ✅ Embedded dmchamp AI chat widget site-wide
- ✅ Built Customer Portal (My Account dashboard + My Orders)
- ✅ Added Active Package column to Admin Users
- ✅ Added Expires column to Admin Orders
- ✅ Added Duration (days) field to Package edit form
- ✅ Added durationDays to all default packages (3/7/14/30/90/180/365/730)
- ✅ Built Webhook Secret UI (Firestore-stored + Regenerate)
- ✅ ChillPay checksum SOLVED: `v1.2.5-16-MC-RN-end (raw secret)`
- ✅ Cleaned up checksum debug code (24 probes → 1 single algorithm)
- ✅ Removed TEST_MODE bypass from callback
- ✅ Added EMAIL_TEST_REWRITE_TO env var support
- ✅ Added smart password logic for repeat purchases
- ✅ Renamed "Admin Login" → "Sign In" across all 4 languages
- ✅ Added STALE_VALUE_OVERRIDES read-side layer for renamed strings
- ✅ Made hero CTAs role-aware (signin / admin / account)
- ✅ Created `delete-customer` Netlify Function (hard-delete user)
- ✅ Fixed `onErr is not defined` for customer subscriptions
- ✅ Fixed duplicate `generic-modal` id in HTML
- ✅ Added ChillPay Diagnostics section to Order View modal

### 20 May 2026
- ✅ ChillPay Phase 2 frontend (checkout → ChillPay → result page)
- ✅ Added `payment-result` Netlify Function (POST → 303 redirect)
- ✅ ChillPay Events admin page
- ✅ Fixed IPv6 → IPv4 resolution
- ✅ Gmail "+tag" stripping for ChillPay CustEmail

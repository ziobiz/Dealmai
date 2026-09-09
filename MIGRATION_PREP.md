# DealMai Migration Prep

**Target:** move https://dealmai.com off current Netlify hosting to a new host/account  
**Source backup:** `D:\Delopment\Dealmai` · GitHub https://github.com/ziobiz/Dealmai  
**Local commit:** `a0f7559` on `main`

---

## 1. What this stack is

| Layer | Current | Notes |
|-------|---------|-------|
| Frontend | Static SPA (`index.html` + `app.js`) | No build step for UI |
| Hosting | Netlify (drop deploy) | Custom domain `dealmai.com` |
| Server logic | Netlify Functions (`netlify/functions/*`) | Node 18 + `firebase-admin` |
| Database / Auth | Firebase project `deal-pro-ai-web-app` | Firestore + Auth |
| Email | Resend | Via scheduled function |
| Direct payments | ChillPay | Callback URLs on this domain |
| Partner payments | ontheline webhook | HMAC + Firestore config |
| AI workspaces | DM Champ | Separate product; API key in env/Firestore |

**Important:** Moving “the server” usually means **hosting + functions + domain**.  
Firebase data can stay on the same project, or be exported/imported to a new project.

---

## 2. Already ready (local / GitHub)

- [x] Frontend: `index.html`, `app.js`
- [x] Functions: payment, webhook, email queue, DM Champ, delete-customer, etc.
- [x] `netlify.toml` (redirects + schedules)
- [x] `firestore.rules`
- [x] `package.json` (`firebase-admin`)
- [x] Docs: `PROJECT_STATE.md`, `ADDING-A-PAYMENT-GATEWAY.md`
- [x] Git remote: `origin` → `ziobiz/Dealmai`

**Not in repo (by design):** Netlify env secrets, Firestore dump, Auth users, DNS private access.

---

## 3. Must obtain before cutover

### A. Netlify Environment Variables (values)

| Variable | Purpose |
|----------|---------|
| `FIREBASE_PROJECT_ID` | Firebase project id |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key (`\n` preserved) |
| `RESEND_API_KEY` | Outbound email |
| `EMAIL_FROM` | From header |
| `EMAIL_REPLY_TO` | Reply-To / support |
| `PUBLIC_SITE_URL` | Usually `https://dealmai.com` |
| `CHILLPAY_MERCHANT_CODE` | ChillPay merchant |
| `CHILLPAY_API_KEY` | ChillPay API |
| `CHILLPAY_MD5_SECRET` | ChillPay checksum |
| `CHILLPAY_MODE` | `sandbox` / `production` |
| `CHILLPAY_ROUTE_NO` | Optional, default `1` |
| `ONTHELINE_WEBHOOK_SECRET` | Fallback HMAC (Firestore `config/webhook` preferred) |
| `ONTHELINE_ALLOWED_IPS` | Optional IP allowlist |
| `DMCHAMP_API_KEY` | Fallback if Firestore config empty |
| `FREECURRENCY_API_KEY` | FX for ontheline amounts |
| `FX_RATE_USD_THB` | Optional FX override |
| `WEBHOOK_TEST_MODE` | Must be unset/false in production |
| `EMAIL_TEST_REWRITE_TO` | Should be unset in production |

Store values in a secure password manager / sealed file. **Do not commit to Git.**

### B. Firebase data (if keeping history)

Collections to export:

- `users`, `orders`, `packages`, `translations`
- `email_queue`, `webhook_events`, `payment_events`, `chillpay_events`, `audit_log`
- `ontheline_partners`, `ontheline_paygw`, `ontheline_currencies`
- `config/webhook`, `config/branding`, `config/payment`, `config/dmchamp`

Also export **Firebase Auth** users if accounts must move.

```bash
gcloud firestore export gs://BACKUP_BUCKET/dealmai-export --project=deal-pro-ai-web-app
firebase auth:export users.json --project deal-pro-ai-web-app --format=json
```

### C. Domain DNS

Registrar documented as Squarespace for `dealmai.com`.  
Capture current A/CNAME/TXT before changing nameservers / records.

### D. External callback registrations

After new host is live, update:

- ChillPay background / return URLs → new domain paths
- ontheline webhook URL → `/api/ontheline-webhook` (or `/.netlify/functions/ontheline-webhook`)
- Any Resend domain DNS if email stays on `dealmai.com`

---

## 4. Functions that must run on the new host

| Function | Trigger |
|----------|---------|
| `create-payment` | Checkout |
| `payment-callback` / `chillpay-callback` | Gateway POST |
| `payment-result` | Browser return (POST → redirect) |
| `check-payment-status` | Admin / polling |
| `settle-pending-payments` | Schedule every 10 min |
| `ontheline-webhook` | Partner POST |
| `send-queued-emails` | Schedule every 5 min |
| `provision-dmchamp` | Paid order / admin retry |
| `delete-customer` | Admin |
| `convert-currency` | Admin simulate webhook |

SPA catch-all: `/*` → `index.html` (static files first).

---

## 5. Recommended migration paths

### Option 1 — Same Firebase, new Netlify (fastest)

1. Create new Netlify site from GitHub `ziobiz/Dealmai` (or drop deploy).
2. Paste all env vars.
3. Deploy and test on `*.netlify.app`.
4. Point `dealmai.com` DNS to new site.
5. Update ChillPay + ontheline callback URLs if paths change.
6. Confirm schedules (email + settle) run on production deploy only.

### Option 2 — New Netlify + new Firebase (full move)

1. Create Firebase project, deploy `firestore.rules`.
2. Import Firestore + Auth exports.
3. Update Firebase web config in `app.js` and service-account env vars.
4. Then same hosting steps as Option 1.

### Option 3 — Non-Netlify host (Vercel / Cloudflare / VPS)

Possible, but **schedules + Netlify Function paths must be reimplemented**  
(e.g. cron jobs, Express/Cloudflare Workers adapters). Highest effort.

---

## 6. Cutover checklist

**Before DNS switch**

- [ ] New site deploys green
- [ ] Env vars present (no missing ChillPay / Firebase / Resend)
- [ ] Admin login works against Firebase
- [ ] Packages page loads from Firestore
- [ ] Test payment sandbox (if available)
- [ ] Test ontheline webhook signature (test mode only if needed)
- [ ] Email queue sends via Resend
- [ ] Old Netlify payment overdue / access confirmed with Owner if needed

**DNS switch**

- [ ] Lower TTL in advance
- [ ] Point domain to new host
- [ ] HTTPS certificate issued

**After DNS**

- [ ] Live checkout + callback
- [ ] ontheline live webhook
- [ ] Scheduled functions firing
- [ ] Branding / languages OK
- [ ] Retire or lock old Netlify site

---

## 7. Blockers (current status)

| Item | Status |
|------|--------|
| Source code | Ready |
| GitHub backup | Ready |
| Netlify env values | Need Owner / Developer access |
| Firestore / Auth export | Need Firebase Owner invite or export files |
| DNS (Squarespace) | Need registrar access or records from Owner |
| ChillPay / ontheline URL update | Need merchant dashboards |

Without env + (optionally) Firebase access, only a **shell site** can be redeployed; payments, webhooks, email, and historical data will not work.

---

## 8. Immediate next actions

1. Ask Netlify/Firebase/Squarespace Owner for: env export, Firebase invite, DNS access.  
2. Decide Option 1 vs 2.  
3. Create destination Netlify (or other) site and wire env.  
4. Dry-run on preview URL, then cut over DNS.

When destination platform is chosen, implement deploy wiring next.

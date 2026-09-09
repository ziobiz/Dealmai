// ===========================================================
// Deal Pro · AI Sales Agent — Web App
// Firebase + i18n + Routing + Package logic + Webhook + Email queue
// ===========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, deleteField, query, where, orderBy, limit, serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, updatePassword, sendPasswordResetEmail,
  EmailAuthProvider, reauthenticateWithCredential, setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

// ---------- Firebase init ----------
const firebaseConfig = {
  apiKey: "AIzaSyCtACqFPoAXDLDOL3bHjlRb3aZrgDLtK3o",
  authDomain: "dealmai-bcada.firebaseapp.com",
  projectId: "dealmai-bcada",
  storageBucket: "dealmai-bcada.firebasestorage.app",
  messagingSenderId: "376233750419",
  appId: "1:376233750419:web:99bf8984eb5ee9f2c90266"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);
// Persist session across reloads/tabs
setPersistence(auth, browserLocalPersistence).catch(e => console.warn("Auth persistence error:", e));

// ---------- Static data (canonical, will be merged with Firestore overrides) ----------
const SUPPORTED_LANGS = [
  { code:"en", name:"English",  native:"English" },
  { code:"th", name:"Thai",     native:"ไทย" },
  { code:"ko", name:"Korean",   native:"한국어" },
  { code:"ja", name:"Japanese", native:"日本語" }
];

// Master English strings — used as the canonical source AND as a fallback
// These will be written to Firestore on first run, and editable from Admin
const DEFAULT_STRINGS = {
  // Navigation
  "nav.home":"Home",
  "nav.packages":"Packages",
  "nav.admin":"Admin Console",
  "nav.login":"Sign In",
  "nav.signout":"Sign Out",

  // Drawer (mobile)
  "drawer.title":"Menu",
  "drawer.lang":"Language",
  "drawer.account":"Account",

  // Hero
  "hero.eyebrow":"AI SALES AGENT · LIVE NETWORK",
  "hero.title-html":'Sell<br/>while you <span class="grad">sleep.</span><br/><span class="outline">Literally.</span>',
  "hero.lede":"{brand} is an autonomous AI sales agent that qualifies leads, handles objections, books meetings and closes deals across WhatsApp, Instagram, Messenger and your site — 24 hours a day, in four languages.",
  "hero.cta-primary":"Browse Packages",
  "hero.cta-secondary":"Open Admin Console",
  "hero.cta-admin":"Open Admin Console",
  "hero.cta-account":"Go to My Account",
  "hero.cta-signin":"Sign In",

  // Capabilities
  "caps.num":"01 / CAPABILITIES",
  "caps.title-html":'Not a bot. A <span class="grad">closer.</span>',
  "caps.lede":"Drop in your URL. The agent reads your products, pricing and value props — and starts selling in fifteen minutes. No code, no prompts.",
  "cap.01.t":"Truly Human-like",
  "cap.01.d":"Conversational across voice notes, images, video and PDFs. Sounds like your best closer on their best day.",
  "cap.02.t":"Multi-Channel",
  "cap.02.d":"WhatsApp · Instagram · Messenger · web chat — one memory across every surface.",
  "cap.03.t":"15-Min Setup",
  "cap.03.d":"Paste your website URL. The AI reads your products and pricing automatically. No code, no prompts.",
  "cap.04.t":"Multimodal",
  "cap.04.d":"Understands voice notes, images, documents/PDFs and videos — not just text.",
  "cap.05.t":"In-chat Booking",
  "cap.05.d":"Detects buying signals and books appointments inside the conversation. No external links.",
  "cap.06.t":"Memory & Context",
  "cap.06.d":"Remembers prior conversations and preferences to build long-term relationships.",
  "cap.07.t":"Campaigns & Follow-ups",
  "cap.07.d":"Outbound messaging, automated follow-ups, and Comment-to-DM on IG and Facebook.",
  "cap.08.t":"Self-Improving",
  "cap.08.d":'One-click optimization studies your best-closed conversations and raises conversion rates.',

  // Packages
  "pkg.num":"02 / PRICING",
  "pkg.title-html":'Three ways to <span class="grad">launch.</span>',
  "pkg.lede":"Pay-as-you-go credit, unlimited-by-the-day access, or rolling subscription. Every plan provisions instantly with credentials by email.",
  "pkg.tab.credit":"Credit Purchase",
  "pkg.tab.onetime":"1-Time Access",
  "pkg.tab.sub":"Subscription",
  "pkg.sub.note":"Credit on a subscription expires at the end of each cycle. To continue mid-cycle when credit is depleted, add a Credit Purchase top-up.",
  "pkg.select":"Select",
  "pkg.subscribe":"Subscribe",
  "pkg.configure":"Configure",
  "pkg.featured":"Most Picked",
  "pkg.manual.title":"Manual Input",
  "pkg.manual.desc":"Enter your own amount — used for top-ups and ontheline remainders.",
  "pkg.manual.label":"Enter amount (USD)",

  // Credit Purchase packages
  "pkg.credit.5.t":"Starter",
  "pkg.credit.5.d":"Light credit top-up for trials and small campaigns.",
  "pkg.credit.10.t":"Essentials",
  "pkg.credit.10.d":"Enough credit for a week of moderate activity.",
  "pkg.credit.20.t":"Studio",
  "pkg.credit.20.d":"The sweet spot for solo operators and consultants.",
  "pkg.credit.50.t":"Atelier",
  "pkg.credit.50.d":"For small teams running concurrent campaigns.",
  "pkg.credit.100.t":"House",
  "pkg.credit.100.d":"Power tier for agencies and high-volume sellers.",

  // 1-Time Access
  "pkg.onetime.3d.t":"3 Days",
  "pkg.onetime.3d.d":"Unlimited credit for 72 hours.",
  "pkg.onetime.7d.t":"7 Days",
  "pkg.onetime.7d.d":"A full week of unrestricted access.",
  "pkg.onetime.14d.t":"14 Days",
  "pkg.onetime.14d.d":"A fortnight of unlimited activity.",
  "pkg.onetime.1m.t":"1 Month",
  "pkg.onetime.1m.d":"Best for monthly campaign cycles.",
  "pkg.onetime.3m.t":"3 Months",
  "pkg.onetime.3m.d":"Quarterly access — chosen by most agencies.",
  "pkg.onetime.6m.t":"6 Months",
  "pkg.onetime.6m.d":"Half-year commitment with priority support.",
  "pkg.onetime.12m.t":"12 Months",
  "pkg.onetime.12m.d":"Annual access — the workhorse plan.",
  "pkg.onetime.24m.t":"24 Months",
  "pkg.onetime.24m.d":"Two-year tenure — best value per day.",

  // Subscription
  "pkg.sub.1m.t":"1 Month",
  "pkg.sub.1m.d":"Rolling monthly. Cancel anytime.",
  "pkg.sub.3m.t":"3 Months",
  "pkg.sub.3m.d":"Quarterly cadence — most popular tier.",
  "pkg.sub.6m.t":"6 Months",
  "pkg.sub.6m.d":"Half-year commitment with priority queue.",
  "pkg.sub.12m.t":"12 Months",
  "pkg.sub.12m.d":"Annual subscription — recommended.",
  "pkg.sub.24m.t":"24 Months",
  "pkg.sub.24m.d":"Two-year tenure with locked pricing.",

  // Checkout
  "checkout.num":"03 / SETTLEMENT",
  "checkout.title-html":'Almost <span class="grad">yours.</span>',
  "checkout.section.customer":"Customer Details",
  "checkout.section.payment":"Payment Method",
  "checkout.section.delivery":"Receipt Delivery",
  "checkout.field.name":"Full Name",
  "checkout.field.email":"Email",
  "checkout.field.company":"Company",
  "checkout.field.country":"Country",
  "checkout.field.taxid":"Tax ID",
  "checkout.field.optional":"optional",
  "checkout.field.taxid.hint":"For a full tax invoice (ใบกำกับภาษีเต็มรูปแบบ). Thai companies: 13-digit Tax ID.",
  "checkout.ph.name":"e.g. Soraya Kanchanaporn",
  "checkout.ph.email":"e.g. soraya@studiokanchana.com",
  "checkout.ph.company":"e.g. Studio Kanchana",
  "checkout.ph.taxid":"e.g. 0105564016423",
  "checkout.terms.intro-html":"Before you pay, please review our <a class=\"terms-link\" onclick=\"App.openTermsModal()\">Terms of Service and Privacy Policy</a>.",
  "checkout.terms.consent":"I confirm that I am purchasing for business use, and I have read and agree to the Terms of Service and Privacy Policy. I understand that credit top-ups automatically expire 24 hours after purchase and are strictly non-refundable.",
  "toast.checkout.needName":"Please enter your full name",
  "toast.checkout.needEmail":"Please enter your email address",
  "toast.checkout.badEmail":"Please enter a valid email address",
  "toast.checkout.needTerms":"Please read and accept the Terms of Service before paying",
  "about.eyebrow":"About ONTHELINE & DealMai",
  "about.heading-html":"Every inquiry becomes a <em>growth opportunity</em>.",
  "about.teaser-html":"At <strong>ONTHELINE</strong>, we recognized that traditional chatbots and delayed responses cause businesses to lose valuable leads every day. We created <strong>DealMai</strong> to bridge this gap through 24/7 AI-driven engagement. Operating across major messaging channels like WhatsApp, Instagram, and LINE, DealMai delivers human-like conversations that qualify prospects, book appointments, and reactivate contacts in your brand\'s exact voice. As part of the global ONTHELINE network (Thailand, Japan, South Korea), we help businesses turn every inquiry into a growth opportunity, nonstop.",
  "about.readmore":"Read our story",
  "about.modal.kicker":"About Us",
  "about.modal.title":"ONTHELINE & DealMai",
  "about.modal.sub":"Bridging the gap in global lead engagement · Thailand · Japan · South Korea",
  "terms.modal.kicker":"Legal",
  "terms.modal.title":"Terms of Service & Privacy Policy",
  "terms.modal.sub":"DealMai Master Terms of Service & Platform Agreement · Effective July 31, 2026",
  "doc.close":"Close",
  "checkout.field.card":"Card Number",
  "checkout.field.expiry":"Expiry",
  "checkout.field.cvc":"CVC",
  "checkout.field.via":"Send Receipt Via",
  "checkout.field.lang":"Receipt Language",
  "checkout.payment.intro":"You'll be redirected to Payment Gateway's secure payment page to complete the payment.",
  "checkout.channel.any":"Choose at next step",
  "checkout.channel.card":"Credit / Debit Card",
  "checkout.channel.qr":"QR PromptPay",
  "checkout.channel.mobile":"Mobile Banking",
  "checkout.channel.ewallet":"E-Wallet",
  "checkout.summary.title":"Order Summary",
  "checkout.summary.package":"Package",
  "checkout.summary.activation":"Activation",
  "checkout.summary.activation-val":"Immediate",
  "checkout.summary.subtotal":"Subtotal",
  "checkout.summary.vat":"VAT 7%",
  "checkout.summary.total":"Total Due",
  "checkout.summary.cta":"Confirm & Pay",
  "checkout.summary.secure":"256-bit · PCI DSS · Encrypted",
  "checkout.summary.redirecting":"Redirecting to Payment Gateway…",
  "checkout.summary.powered":"Powered by Payment Gateway · Thai PSP",

  // Payment Result (return from ChillPay)
  "result.pending.title-html":'Payment <span class="grad">in progress.</span>',
  "result.pending.sub":"Your payment is being processed. You'll receive a confirmation email at {email} once Payment Gateway confirms — usually within a minute.",
  "result.success.title-html":'Payment <span class="grad">confirmed.</span>',
  "result.success.sub":"Thank you. Your receipt and credentials are on their way to {email}. Onboarding takes under five minutes.",
  "result.failed.title-html":'Payment <span class="grad">not completed.</span>',
  "result.failed.sub":"The payment was cancelled or declined. Nothing was charged. You can try again or pick a different method.",
  "result.notfound.title-html":'Order <span class="grad">not found.</span>',
  "result.notfound.sub":"We couldn't locate this order. If you just paid, please give us a moment — the confirmation may still be in transit.",
  "result.ref":"Order Reference",
  "result.amount":"Amount",
  "result.method":"Payment Method",
  "result.status":"Status",
  "result.cta-retry":"Try Again",
  "result.cta-back":"Back to Packages",
  "result.cta-home":"Back to Home",

  // Confirmation
  "confirm.title-html":'Welcome aboard, <span class="grad">{name}.</span>',
  "confirm.sub":"Your AI agent is being provisioned. Credentials and your receipt have been dispatched to {email}. Onboarding takes under five minutes.",
  "confirm.ref":"Order Reference",
  "confirm.package":"Package",
  "confirm.amount":"Amount Charged",
  "confirm.portal":"Portal Link",
  "confirm.invoice":"Invoice / Receipt",
  "confirm.invoice-val":"PDF · delivered by email",
  "confirm.cta-portal":"Open Portal",
  "confirm.cta-back":"Back to Packages",

  // Nav (customer)
  "nav.account":"My Account",
  "nav.orders":"My Orders",

  // Customer Portal · My Account
  "account.crumbs":"Portal / My Account",
  "account.welcome":"Welcome back, {name}.",
  "account.sub":"Your packages, orders, and account in one place.",
  "account.active.title-html":'Active <span class="grad">subscription</span>',
  "account.active.none":"No active subscription. Browse packages to get started.",
  "account.active.status.active":"Active",
  "account.active.status.expired":"Expired",
  "account.active.status.expiring":"Expiring Soon",
  "account.active.expires":"Expires on {date}",
  "account.active.daysLeft":"{n} days remaining",
  "account.active.expiredOn":"Expired on {date}",
  "account.active.noExpiry":"No expiry · credit balance",
  "account.stats.orders":"Total Orders",
  "account.stats.spent":"Total Spent",
  "account.stats.credits":"Credits Earned",
  "account.stats.member":"Member Since",
  "account.credits.note":"This is the total credits earned from your purchases. Check your remaining balance and live usage in your DM Champ Portal.",
  "account.cta.browse":"Browse Packages",
  "account.cta.changePassword":"Change Password",
  "account.changePw.title":"Change your password",
  "account.changePw.sub":"Enter your current password, then choose a new one. This updates your Deal Pro account password.",
  "account.changePw.cta":"Update Password",
  "account.cta.orders":"View My Orders",
  "account.passwordPrompt.title":"Change your password",
  "account.passwordPrompt.sub":"For security, please choose a new password before continuing.",
  "account.passwordPrompt.cta":"Update Password",

  // Customer Portal · My Orders
  "orders.crumbs":"Portal / My Orders",
  "orders.title-html":'My <span class="grad">orders</span>',
  "orders.sub":"All your purchases — past and present.",
  "orders.empty":"No orders yet. Browse packages to make your first purchase.",
  "orders.col.ref":"Reference",
  "orders.col.date":"Date",
  "orders.col.package":"Package",
  "orders.col.amount":"Amount",
  "orders.col.credits":"Credits",
  "orders.col.expires":"Expires",
  "orders.col.status":"Status",
  "orders.col.actions":"Actions",
  "orders.action.view":"Details",
  "orders.status.paid":"Paid",
  "orders.status.pending":"Pending",
  "orders.status.failed":"Failed",
  "orders.status.expired":"Expired",
  "orders.status.cancelled":"Cancelled",
  "orders.modal.title":"Order Details",
  "orders.modal.customer":"Customer",
  "orders.modal.items":"Items",
  "orders.modal.subtotal":"Subtotal",
  "orders.modal.vat":"VAT 7%",
  "orders.modal.total":"Total",
  "orders.modal.paymentMethod":"Payment Method",
  "orders.modal.paidAt":"Paid At",
  "orders.modal.expiresAt":"Expires At",
  "orders.modal.resendInvoice":"Resend Invoice",
  "orders.modal.resendCredentials":"Resend Credentials",
  "orders.modal.close":"Close",
  "orders.toast.resent":"Email queued for delivery",
  "orders.toast.resendFailed":"Could not queue email: {error}",

  // Admin · sidebar
  "admin.side.console":"Console",
  "admin.side.orders":"Orders",
  "admin.side.users":"Users",
  "admin.side.packages":"Packages",
  "admin.side.webhook":"ontheline Webhook",
  "admin.side.partners":"ontheline Partners",
  "admin.side.paygw":"ontheline Payment Gateways",
  "admin.side.currencies":"ontheline Currencies",
  "admin.currencies.title":"ontheline Currencies",
  "admin.currencies.sub":"Manage the currency codes ontheline may send in the webhook <code>currency</code> field. An incoming webhook whose currency doesn't match one of these is rejected. The symbol is shown in Orders next to the amount; the USD value (for credit calculation) is derived via a live FX rate.",
  "admin.currencies.add":"Add Currency",
  "admin.currencies.empty":"No currencies yet. Add one (e.g. USD $) to start accepting ontheline webhooks.",
  "admin.currencies.add.title":"Add Currency",
  "admin.currencies.edit.title":"Edit Currency",
  "admin.currencies.col.code":"Code (ISO 4217)",
  "admin.currencies.col.symbol":"Symbol",
  "admin.currencies.col.label":"Label",
  "admin.currencies.code.ph":"e.g. USD, THB, JPY, KRW",
  "admin.currencies.symbol.ph":"e.g. $, ฿, ¥, ₩",
  "admin.currencies.label.ph":"e.g. US Dollar",
  "admin.currencies.hint":"Code is matched case-insensitively against the webhook currency value and used for FX conversion to USD. Use the standard 3-letter ISO 4217 code so the exchange-rate API recognises it.",
  "admin.partners.title":"ontheline Partners",
  "admin.partners.sub":"Manage the partner codes ontheline may send in webhook calls. An incoming webhook whose <code>partner</code> value doesn't match one of these codes is rejected.",
  "admin.partners.add":"Add Partner",
  "admin.partners.empty":"No partners yet. Add one to start accepting ontheline webhooks with a partner code.",
  "admin.partners.add.title":"Add Partner",
  "admin.partners.edit.title":"Edit Partner",
  "admin.paygw.title":"ontheline Payment Gateways",
  "admin.paygw.sub":"Manage the payment-gateway codes ontheline may send in webhook calls. An incoming webhook whose <code>paygw</code> value doesn't match one of these codes is rejected.",
  "admin.paygw.add":"Add Payment Gateway",
  "admin.paygw.empty":"No payment gateways yet. Add one to start accepting ontheline webhooks with a paygw code.",
  "admin.paygw.add.title":"Add Payment Gateway",
  "admin.paygw.edit.title":"Edit Payment Gateway",
  "admin.codelist.col.code":"Code",
  "admin.codelist.col.company":"Company Name",
  "admin.codelist.col.actions":"Actions",
  "admin.codelist.edit":"Edit",
  "admin.codelist.delete":"Delete",
  "admin.codelist.save":"Save",
  "admin.codelist.code.ph":"e.g. PARTNER01",
  "admin.codelist.company.ph":"e.g. Acme Travel Co., Ltd.",
  "admin.codelist.code.hint":"Code is matched exactly (case-insensitive) against the webhook value. Company name is for your reference and shown in Orders.",
  "admin.side.chillpay":"Payment Gateway Events",
  "admin.side.paymentgw":"Payment Gateway",
  "admin.paymentgw.crumbs":"Console / Payment Gateway",
  "admin.paymentgw.title-html":"Payment <span class=\"grad\">gateway</span>",
  "admin.paymentgw.sub":"Choose which provider settles new direct (web) payments. Orders already in progress keep the gateway they were created with.",
  "admin.paymentgw.note-html":"Credentials live in Netlify environment variables, never in the database. This page only records <em>which</em> gateway is selected — set a provider\'s keys in Netlify first, then activate it here.",
  "admin.paymentgw.note.default":"No selection saved yet — new payments use the default gateway. Choosing one below makes it explicit.",
  "admin.paymentgw.state.ready":"Configured and ready to use.",
  "admin.paymentgw.state.missing":"Not configured. Missing environment variables: {list}",
  "admin.paymentgw.badge.active":"Active",
  "admin.paymentgw.btn.use":"Use this gateway",
  "admin.paymentgw.btn.inuse":"In use",
  "admin.paymentgw.btn.needenv":"Set this gateway\'s environment variables in Netlify first",
  "admin.paymentgw.btn.copy":"Copy",
  "admin.paymentgw.lbl.channels":"Payment channels",
  "admin.paymentgw.lbl.callback":"Callback URL — register this in the provider dashboard",
  "admin.paymentgw.hint.callback":"Server-to-server. This is the source of truth for payment status. Register it as the URL Background / webhook for every enabled channel.",
  "admin.paymentgw.lbl.returnurl":"Return URL (URL Result) — register this too",
  "admin.paymentgw.hint.returnurl":"Where the customer's browser lands after paying. Same for every gateway, since it is our own page.",
  "admin.paymentgw.lbl.env":"Environment variables",
  "admin.paymentgw.empty":"No payment gateways are registered.",
  "admin.paymentgw.err.diag":"Could not reach the payment function. Deploy the site, then reload this page.",
  "toast.paymentgw.unknown":"That gateway is not registered",
  "toast.paymentgw.needenv":"Set the environment variables first — missing: {list}",
  "toast.paymentgw.confirm":"Route all new payments through {name}?\n\nOrders already in progress are unaffected — each one settles with the gateway it started on.",
  "toast.paymentgw.saved":"New payments now go through {name}",
  "toast.paymentgw.failed":"Could not save: {error}",
  "admin.side.emails":"Email Queue",
  "admin.side.languages":"Languages",
  "admin.side.branding":"Branding",
  "admin.side.dmchamp":"DM Champ",
  "admin.side.account":"Account",
  "admin.side.password":"Change Password",
  "admin.side.signout":"Sign Out",

  // Admin · branding
  "admin.branding.crumbs":"Console / Branding",
  "admin.branding.title-html":'Site <span class="grad">branding</span>',
  "admin.branding.sub":"Change your site name and logo. Updates apply instantly across the entire app — header, footer, browser tab, and customer-facing pages — without requiring anyone to refresh.",
  "admin.branding.name.title":"Site Name",
  "admin.branding.name.hint":"Replaces every instance of \"Deal Pro\" across the public site, admin console, footer, and browser tab. Max 60 characters.",
  "admin.branding.name.save":"Save Name",
  "admin.branding.name.reset":"Reset",
  "admin.branding.name.reset.title":"Reset to \"Deal Pro\"",
  "admin.branding.name.preview":"Preview:",
  "admin.branding.logo.title":"Logo Image",
  "admin.branding.logo.hint":"Upload a custom logo to show in the site header. Recommended: transparent PNG, ~300×100 pixels. Max 500 KB.",
  "admin.branding.logo.upload":"Upload Logo",
  "admin.branding.logo.reset":"Reset",
  "admin.branding.logo.reset.title":"Reset to default logo",
  "admin.branding.logo.limits":"Accepted: PNG, JPEG, SVG, WebP · Max 500 KB",
  "admin.branding.favicon.title":"Browser Tab Icon (Favicon)",
  "admin.branding.favicon.hint":"The small icon shown in the browser tab, next to the site name. Use a square image (at least 32×32 px); a transparent PNG or SVG works best. Applies to every visitor's browser tab in realtime.",
  "admin.branding.favicon.preview":"Tab preview",
  "admin.branding.favicon.upload":"Upload Favicon",
  "admin.branding.favicon.reset":"Reset",
  "admin.branding.favicon.reset.title":"Remove custom favicon and use the default icon",
  "admin.branding.favicon.using.custom":"Showing custom uploaded favicon",
  "admin.branding.favicon.using.default":"Using the default browser-tab icon",
  "admin.branding.favicon.limits":"Accepted: PNG, ICO, SVG, WebP · Square · Max 100 KB",
  "admin.branding.logo.using.default":"Showing default logo",
  "admin.branding.logo.using.custom":"Showing custom uploaded logo",
  "admin.branding.lastUpdated":"Last updated {date} by {by}",

  // Admin · DM Champ integration
  "admin.dmchamp.crumbs":"Console / Integrations",
  "admin.dmchamp.title-html":'DM Champ <span class="grad">integration</span>',
  "admin.dmchamp.sub":"Auto-provision a DM Champ AI workspace for every paying customer. Sub-accounts are created on the agency tier of your DM Champ plan.",
  "admin.dmchamp.status.configured":"Connected · API key on file",
  "admin.dmchamp.status.missing":"Not connected · Enter an API key below",
  "admin.dmchamp.status.disabled":"Integration disabled · Toggle on to auto-provision",
  "admin.dmchamp.apiKey":"DM Champ API Key",
  "admin.dmchamp.apiKey.hint":"Find it in DM Champ → Settings → API Access. Stored securely in Firestore (config/dmchamp); never shown again after save.",
  "admin.dmchamp.apiKey.placeholder":"Paste API key…",
  "admin.dmchamp.apiKey.masked":"Current key on file: {masked} — paste a new one to replace",
  "admin.dmchamp.enabled":"Enable auto-provisioning",
  "admin.dmchamp.enabled.hint":"When on, every successful payment automatically creates a DM Champ sub-account.",
  "admin.dmchamp.creditsPerUsd":"Credits per USD",
  "admin.dmchamp.creditsPerUsd.hint":"How many DM Champ credits each USD the customer pays converts to. e.g. 100 means $5 → 500 credits, $10 → 1,000.",
  "admin.dmchamp.defaultCredits":"Default monthly credits",
  "admin.dmchamp.defaultCredits.hint":"Used when the order amount cannot be converted (rare). Acts as a safe minimum.",
  "admin.dmchamp.rollover":"Roll over unused credits",
  "admin.dmchamp.rollover.hint":"When on, unused credits carry over to the next month. When off, credits reset monthly.",
  "admin.dmchamp.timezone":"Default time zone",
  "admin.dmchamp.country":"Default country (ISO-2)",
  "admin.dmchamp.portalUrl":"Portal URL",
  "admin.dmchamp.openPortal":"Open DM Champ Portal",
  "admin.dmchamp.portalUrl.hint":"The DM Champ sign-in URL surfaced to customers (in emails + portal buttons). Use https://app.dmchamp.com by default, or your White-Label custom domain (e.g. https://app.dealmai.com) so customers see your brand.",
  "admin.dmchamp.save":"Save Settings",
  "admin.dmchamp.test":"Test API Connection",
  "admin.dmchamp.preview":"Conversion preview",
  "admin.dmchamp.preview.row":"${usd} → {credits} credits",

  // Toasts
  "toast.dmchamp.saved":"DM Champ settings saved",
  "toast.dmchamp.saveFail":"Could not save DM Champ settings: {error}",
  "toast.dmchamp.provisioning":"Provisioning DM Champ sub-account…",
  "toast.dmchamp.provisioned":"DM Champ sub-account created for {email}",
  "toast.dmchamp.alreadyProvisioned":"Already provisioned — no changes",
  "toast.dmchamp.linked":"Existing DM Champ account linked to this order ({email})",
  "toast.dmchamp.provisionFail":"DM Champ provisioning failed: {error}",

  // Customer portal · DM Champ workspace card
  "account.dmchamp.title":"Ai Portal Workspace",
  "account.dmchamp.intro":"Your AI sales agent workspace.",
  "account.dmchamp.email":"Email",
  "account.dmchamp.uid":"Account ID",
  "account.dmchamp.credits":"Monthly Credits",
  "account.dmchamp.tempPassword":"Temporary Password",
  "account.dmchamp.tempPasswordHint":"Change this on first sign-in.",
  "account.dmchamp.open":"Open Ai Portal",
  "account.dmchamp.pending":"Your Ai Portal workspace is being prepared. We will email your credentials shortly.",
  "account.dmchamp.failed":"We could not create your Ai Portal workspace. Please contact support and we will set it up manually.",
  "account.dmchamp.linked":"Your existing Ai Portal account is linked to this purchase. Use your current sign-in credentials below.",
  "account.dmchamp.toppedUp":"Credits from this purchase have been added to your Ai Portal account. Sign in with your existing credentials below.",

  // Order View modal · DM Champ section
  "admin.orders.view.dmchamp":"DM Champ Sub-Account",
  "admin.orders.view.ontheline":"ontheline Partner / Payment Gateway",
  "admin.orders.view.partner":"Partner",
  "admin.orders.view.paygw":"Payment Gateway",
  "admin.orders.view.event":"Event",
  "admin.orders.view.amount":"Amount",
  "admin.orders.view.dmchamp.notProvisioned":"Not provisioned yet",
  "admin.orders.view.dmchamp.provision":"Provision DM Champ",
  "admin.orders.view.dmchamp.retry":"Retry Provisioning",
  "admin.orders.view.dmchamp.lastError":"Last error: {error}",
  "admin.orders.view.dmchamp.linked":"Linked to existing DM Champ account",
  "admin.orders.view.dmchamp.linkedNote":"Customer already had a DM Champ workspace at this email. No new sub-account was created — they sign in with their existing credentials.",

  // Admin · orders
  "admin.orders.title-html":'Recent <span class="grad">orders</span>',
  "admin.orders.export":"Export CSV",
  // Orders count stat label, by date filter
  "admin.orders.stat.today":"Today · Orders",
  "admin.orders.stat.month":"This Month · Orders",
  "admin.orders.stat.yesterday":"Yesterday · Orders",
  "admin.orders.stat.lastMonth":"Last Month · Orders",
  "admin.orders.stat.period":"Period · Orders",
  "admin.orders.stat.online":"From ontheline",
  "admin.orders.stat.direct":"Direct Web",
  // Revenue stat label, by date filter
  "admin.orders.stat.revenue":"Revenue Today",
  "admin.orders.stat.revenue.month":"Revenue This Month",
  "admin.orders.stat.revenue.yesterday":"Revenue Yesterday",
  "admin.orders.stat.revenue.lastMonth":"Revenue Last Month",
  "admin.orders.stat.revenue.period":"Revenue · Period",
  "admin.orders.h":"All transactions",
  "admin.orders.col.ref":"Reference",
  "admin.orders.col.txId":"Transaction ID",
  "admin.orders.col.customer":"Customer",
  "admin.orders.col.email":"Email",
  "admin.orders.col.source":"Source",
  "admin.orders.col.partnerGw":"Partner / PayGW",
  "admin.orders.filter.partner.all":"All Partners",
  "admin.orders.filter.partner.title":"Filter by ontheline partner",
  "admin.orders.filter.paygw.all":"All Payment Gateways",
  "admin.orders.filter.currency.all":"All Currencies",
  "admin.orders.filter.currency.title":"Filter by ontheline currency",
  "admin.orders.filter.paygw.title":"Filter by ontheline payment gateway",
  "admin.orders.col.package":"Package",
  "admin.orders.col.amount":"Amount",
  "admin.orders.col.credits":"Credits",
  "admin.orders.col.status":"Status",
  "admin.orders.col.date":"Date",
  "admin.orders.col.expires":"Expires",
  "admin.orders.col.actions":"Actions",
  "admin.orders.view.credits.label":"Credits Earned",
  "admin.orders.view.credits.note":"Credits earned by this customer across all paid orders. Remaining balance and live usage are visible in the DM Champ Portal.",
  "admin.orders.view.credits.topup":"Topped up by {credits} credits",
  "admin.orders.view.credits.new":"New sub-account · {credits} credits granted",
  "admin.orders.view.credits.linked":"Linked to existing sub-account · grant failed, manual top-up required",
  "admin.orders.action.view":"View",
  "admin.orders.action.resend":"Resend",
  "admin.orders.filter.all":"All",
  "admin.orders.filter.online":"ontheline",
  "admin.orders.filter.direct":"Direct",
  "admin.orders.filter.chillpay":"Payment Gateway",
  "admin.orders.filter.paid":"Paid",
  "admin.orders.filter.pending":"Pending",
  "admin.orders.filter.email.placeholder":"Filter by customer email…",
  "admin.orders.filter.email.clear":"Clear",
  "admin.orders.date.today":"Today",
  "admin.orders.date.yesterday":"Yesterday",
  "admin.orders.date.lastMonth":"Last Month",
  "admin.orders.date.month":"This Month",
  "admin.orders.date.period":"Period",
  "admin.orders.date.label":"Period:",
  "admin.orders.unit.orders":"orders",
  "admin.orders.period.title-html":'Select <span class="grad">period</span>',
  "admin.orders.period.start":"Start date",
  "admin.orders.period.end":"End date",
  "admin.orders.period.apply":"Apply",
  "admin.orders.period.summary":"Showing orders from {start} to {end}",
  "admin.orders.export.empty":"No orders to export in the current view",
  "admin.orders.export.done":"Exported {count} orders to CSV",
  "admin.orders.expires.never":"—",
  "admin.orders.expires.daysLeft":"{n}d left",
  "admin.orders.expires.expired":"Expired",

  // Admin · users
  "admin.users.title-html":'Users & <span class="grad">customers</span>',
  "admin.users.add":"Add User",
  "admin.users.h":"All users",
  "admin.users.col.name":"Name",
  "admin.users.col.email":"Email",
  "admin.users.col.role":"Role",
  "admin.users.col.plan":"Plan",
  "admin.users.col.activePackage":"Active Package",
  "admin.users.col.credits":"Credits",
  "admin.users.col.created":"Created",
  "admin.users.col.status":"Status",
  "admin.users.action.reset":"Reset PW",
  "admin.users.action.delete":"Delete",
  "admin.users.role.admin":"Admin",
  "admin.users.role.customer":"Customer",
  "admin.users.activePackage.none":"—",
  "admin.users.activePackage.expiringSoon":"Expiring in {n}d",
  "admin.users.modal.title-html":'Add new <span class="grad">user</span>',
  "admin.users.modal.sub":"User will receive credentials by email and must change the password on first sign-in.",
  "admin.users.modal.name":"Full Name",
  "admin.users.modal.email":"Email",
  "admin.users.modal.role":"Role",
  "admin.users.modal.password":"Initial Password",
  "admin.users.modal.cta":"Create User",

  // Admin · webhook
  "admin.webhook.title-html":'ontheline <span class="grad">integration</span>',
  "admin.webhook.regen":"Regenerate Secret",
  "admin.webhook.secret.title":"Webhook Secret",
  "admin.webhook.secret.hint":"Used to sign requests from ontheline. Copy this into your ontheline dashboard. Regenerate if you suspect it has been compromised — note that ontheline will immediately need the new value.",
  "admin.webhook.secret.show":"Show",
  "admin.webhook.secret.hide":"Hide",
  "admin.webhook.secret.copy":"Copy",
  "admin.webhook.secret.copied":"Secret copied",
  "admin.webhook.secret.none":"No secret generated yet — click Regenerate Secret to create one.",
  "admin.webhook.secret.regenConfirm":"Generate a new webhook secret? The old one will stop working immediately and any active ontheline integration will need the new value.",
  "admin.webhook.secret.regenerated":"New secret generated",
  "admin.webhook.flow.title":"Endpoint & flow",
  "admin.webhook.flow.sub":"Incoming purchases match against the closest package. Remainder gets routed to Credit Purchase via Manual Input.",
  "admin.webhook.flow.s1.t":"RECEIVE",
  "admin.webhook.flow.s1.d":"ontheline POSTs customer payload and the paid amount to our secure endpoint.",
  "admin.webhook.flow.s2.t":"MATCH",
  "admin.webhook.flow.s2.d":"System selects the largest package fitting under the amount paid.",
  "admin.webhook.flow.s3.t":"REMAINDER",
  "admin.webhook.flow.s3.d":"Any leftover converted to Credit Purchase via Manual Input.",
  "admin.webhook.flow.s4.t":"PROVISION",
  "admin.webhook.flow.s4.d":"User created, credentials generated, portal link prepared.",
  "admin.webhook.flow.s5.t":"DELIVER",
  "admin.webhook.flow.s5.d":"Invoice & receipt emailed; record stored under Orders → ontheline.",
  "admin.webhook.endpoint.title":"Endpoint URL",
  "admin.webhook.test.title":"Simulate ontheline webhook",
  "admin.webhook.test.hint":"Test the matching engine — enter customer details and a paid amount.",
  "admin.webhook.test.fire":"Fire Test Webhook",
  "admin.webhook.events.h":"Recent webhook events",
  "admin.webhook.events.col.time":"Time",
  "admin.webhook.events.col.customer":"Customer",
  "admin.webhook.events.col.txId":"Transaction ID",
  "admin.webhook.events.col.amount":"Amount",
  "admin.webhook.events.col.partnerGw":"Partner / PayGW",
  "admin.webhook.events.col.matched":"Matched",
  "admin.webhook.events.col.status":"Status",

  // Admin · chillpay events
  "admin.chillpay.title-html":'Payment Gateway <span class="grad">events</span>',
  "admin.chillpay.sub":"Audit log of every payment creation and callback from Payment Gateway. Use this to debug checksum mismatches, missing callbacks, or status discrepancies.",
  "admin.chillpay.endpoint.title":"Callback Endpoint URL (URL Background)",
  "admin.chillpay.endpoint.hint":"Server-to-server callback. Configure this URL in your Payment Gateway merchant dashboard → Settings → Payment Channel → URL Background (for each enabled channel). This is the source of truth for payment status.",
  "admin.chillpay.result.title":"Customer Return URL (URL Result)",
  "admin.chillpay.result.hint":"Browser-side return after payment. Configure this URL in your Payment Gateway merchant dashboard → Settings → Payment Channel → URL Result (for each enabled channel). Payment Gateway POSTs the customer's browser to this URL; the page shows them the payment outcome.",
  "admin.chillpay.mode.label":"Current mode",
  "admin.chillpay.mode.sandbox":"Sandbox",
  "admin.chillpay.mode.production":"Production",
  "admin.chillpay.stat.total":"Total events",
  "admin.chillpay.stat.creates":"Payment creations",
  "admin.chillpay.stat.callbacks":"Callbacks received",
  "admin.chillpay.stat.verified":"Verified callbacks",
  "admin.chillpay.events.h":"Recent Payment Gateway events",
  "admin.chillpay.col.time":"Time",
  "admin.chillpay.col.kind":"Kind",
  "admin.chillpay.col.ref":"Order Ref",
  "admin.chillpay.col.orderno":"Payment Gateway OrderNo",
  "admin.chillpay.col.verified":"Verified",
  "admin.chillpay.col.status":"Result",
  "admin.chillpay.col.actions":"Actions",
  "admin.chillpay.action.view":"Details",
  "admin.chillpay.empty":"No Payment Gateway events yet. Once customers start paying through Payment Gateway, every API call and callback will appear here.",
  "admin.chillpay.checksum.ok":"verified",
  "admin.chillpay.checksum.fail":"failed",
  "admin.chillpay.checksum.skip":"skipped (test mode)",
  "admin.chillpay.checkstatus":"Check Status",
  "toast.paymentstatus.checking":"Asking the payment gateway…",
  "toast.paymentstatus.settled":"Payment confirmed — {ref} is now paid. Account and receipt emails have been created.",
  "toast.paymentstatus.stillPending":"{ref}: the gateway still reports this as unpaid (status {status})",
  "toast.paymentstatus.failedPayment":"{ref}: the gateway reports this payment as failed",
  "toast.paymentstatus.failed":"Status check failed: {error}",

  // Admin · emails
  "admin.emails.title-html":'Email <span class="grad">queue</span>',
  "admin.emails.sub":"Outgoing invoices, receipts and credentials. Items remain pending until a Cloud Function dispatches them.",
  "admin.emails.col.time":"Queued",
  "admin.emails.col.to":"To",
  "admin.emails.col.subject":"Subject",
  "admin.emails.col.kind":"Kind",
  "admin.emails.col.status":"Status",
  "admin.emails.action.view":"View",
  "admin.emails.status.supportOnly":"support only",
  "admin.emails.status.supportOnly.title":"ontheline email — delivered to support inbox only; the customer was not emailed",
  "admin.emails.status.supportOnly.note":"This is an ontheline email. It was delivered to the support inbox only — the customer did NOT receive it (ontheline handles customer communication directly).",
  "admin.emails.action.resend":"Resend",
  "admin.emails.kind.invoice":"Invoice",
  "admin.emails.kind.receipt":"Receipt",
  "admin.emails.kind.credentials":"Credentials",

  // Admin · languages
  "admin.langs.title-html":'Language <span class="grad">management</span>',
  "admin.langs.add":"Add Language",
  "admin.langs.master":"English (master)",
  "admin.langs.locked":"Locked until ≥ 90% translated",
  "admin.langs.live":"Live to users",
  "admin.langs.continue":"Manage Translation",
  "admin.langs.toggle.label":"Visible to users",
  "admin.langs.toggle.on":"ON",
  "admin.langs.toggle.off":"OFF",
  "admin.langs.toggle.alwaysOn":"English is always available as the fallback language",
  "admin.langs.toggle.clickToEnable":"Click to show this language to end-users",
  "admin.langs.toggle.clickToDisable":"Click to hide this language from end-users",
  "admin.langs.autosave.hint":"Edits are saved automatically when you finish typing in a field (on blur). Changes apply instantly to users.",
  "admin.langs.translate-table.h":"Translate Strings",
  "admin.langs.translate-table.lang":"Target language",
  "admin.langs.translate-table.search":"Search keys or text",
  "admin.langs.translate-table.col.key":"Key",
  "admin.langs.translate-table.col.source":"English (source)",
  "admin.langs.translate-table.empty":"— not translated —",

  // Admin · packages
  "admin.packages.title-html":'Manage <span class="grad">packages</span>',
  "admin.packages.add":"Add Package",
  "admin.packages.bucket.credit":"Credit Purchase",
  "admin.packages.bucket.onetime":"1-Time Access",
  "admin.packages.bucket.sub":"Subscription",
  "admin.packages.col.order":"Order",
  "admin.packages.col.id":"ID",
  "admin.packages.col.title":"Title",
  "admin.packages.col.desc":"Description",
  "admin.packages.col.price":"Price",
  "admin.packages.col.duration":"Duration",
  "admin.packages.col.featured":"Featured",
  "admin.packages.col.actions":"Actions",
  "admin.packages.action.edit":"Edit",
  "admin.packages.action.delete":"Delete",
  "admin.packages.intro":"Add, edit and delete packages across all three buckets. Changes reflect on the public Packages page in real-time.",
  "admin.packages.modal.duration":"Duration (days)",
  "admin.packages.modal.duration.hint":"How many days of access this package grants. Leave blank for credit packages that have no time limit.",
  "admin.packages.duration.none":"No expiry",
  "admin.packages.duration.days":"{n} days",

  // Admin · password
  "admin.password.title-html":'Change <span class="grad">password</span>',
  "admin.password.current":"Current Password",
  "admin.password.new":"New Password",
  "admin.password.confirm":"Confirm New Password",
  "admin.password.cta":"Update Password",

  // Login modal
  "login.title-html":'Sign <span class="grad">In</span>',
  "login.sub":"Access your {brand} account",
  "login.email":"Email",
  "login.password":"Password",
  "login.cta":"Sign In",

  // Toast messages
  "toast.login.ok":"Welcome back, {name}.",
  "toast.login.fail":"Invalid email or password.",
  "toast.order.created":"Order created · invoice queued",
  "toast.user.created":"User created · password emailed",
  "toast.user.deleted":"User deleted",
  "toast.email.queued":"Email queued for delivery",
  "toast.password.updated":"Password updated",
  "toast.password.wrong":"Current password is incorrect",
  "toast.password.mismatch":"New passwords do not match",
  "toast.translation.saved":"Translation saved",
  "toast.webhook.fired":"Webhook processed · order #{ref}",
  "toast.webhook.firedEvent":"Webhook processed · {event} · order #{ref}",
  "toast.webhook.badPartner":"Unknown partner code: {code} — add it in ontheline Partners first",
  "toast.webhook.badPaygw":"Unknown paygw code: {code} — add it in ontheline Payment Gateways first",
  "toast.webhook.badCurrency":"Unknown currency: {code} — add it in ontheline Currencies first",
  "toast.webhook.dupEvent":"This transaction is already in \"{event}\" — duplicate event ignored",
  "toast.webhook.needPaidFirst":"\"{event}\" needs an existing Paid transaction. Fire Paid with this Transaction ID first.",
  "toast.webhook.fromPaid":"From Paid you can only go to Unpaid, Refund, or Partial Refund (not \"{event}\")",
  "toast.webhook.finalState":"\"{state}\" is a final state — this transaction can no longer change",
  "toast.webhook.fromFail":"From Fail you can only go to Paid (not \"{event}\")",
  "toast.webhook.refundTooBig":"Partial Refund amount must be less than the paid amount (${paid})",
  "toast.webhook.reversed":"{event} processed · {deducted} credits removed · {remaining} remaining",
  "admin.webhook.test.txid.ph":"leave blank to auto-generate",
  "admin.webhook.test.txid.hint":"Re-use the same Transaction ID to test the event flow (e.g. fire Paid, then Refund with the same ID). Leave blank to start a fresh transaction.",
  "toast.chillpay.redirecting":"Redirecting to Payment Gateway…",
  "toast.chillpay.failed":"Could not start payment: {error}",
  "toast.chillpay.status.refreshed":"Order status refreshed",
  "toast.packages.added":"{n} new package(s) added",
  "toast.packages.edited":"{n} package(s) updated",
  "toast.packages.removed":"{n} package(s) removed",
  "toast.checkout.price.updated":"Price updated for the selected package — please review before continuing",
  "toast.checkout.package.removed":"This package is no longer available — please choose again",
  "toast.branding.name.empty":"Site name cannot be empty",
  "toast.branding.name.tooLong":"Site name must be 60 characters or less",
  "toast.branding.name.saved":"Site name updated — applied across all browsers",
  "toast.branding.name.resetConfirm":"Reset the site name back to \"Deal Pro\"?",
  "toast.branding.name.reset.done":"Site name reset to default",
  "toast.branding.logo.tooLarge":"Logo file is too large — max {mb} MB",
  "toast.branding.logo.badType":"Unsupported image type — use PNG, JPEG, SVG, or WebP",
  "toast.branding.logo.uploaded":"Logo uploaded — applied across all browsers",
  "toast.branding.logo.resetConfirm":"Reset the logo back to the default Deal Pro image?",
  "toast.branding.logo.reset.done":"Logo reset to default",
  "toast.branding.favicon.uploaded":"Favicon uploaded — applied across all browser tabs",
  "toast.branding.favicon.tooLarge":"Favicon too large — max {kb} KB",
  "toast.branding.favicon.badType":"Unsupported format — use PNG, ICO, SVG, or WebP",
  "toast.branding.favicon.resetConfirm":"Remove the custom favicon and use the default tab icon?",
  "toast.branding.favicon.reset.done":"Favicon reset to default",
  "toast.langs.enabled":"{lang} enabled — now visible to users",
  "toast.langs.disabled":"{lang} disabled — hidden from users",
  "toast.langs.enToggle":"English can't be disabled — it's the fallback language",
  "toast.codelist.codeRequired":"Code is required",
  "toast.codelist.companyRequired":"Company name is required",
  "toast.codelist.dupCode":"Code \"{code}\" already exists",
  "toast.codelist.added":"Added successfully",
  "toast.currencies.symbolRequired":"Currency symbol is required",
  "toast.codelist.updated":"Updated successfully",
  "toast.codelist.deleted":"Deleted successfully",
  "toast.codelist.deleteConfirm":"Delete \"{code}\"? This can't be undone.",

  // Misc
  "footer.tag":"The AI Sales Agent that closes deals 24/7."
};

// ===========================================================
// FULL TRANSLATIONS for TH / KO / JA — Complete translations of DEFAULT_STRINGS
// Used by AdminActions.importAllTranslations() to bulk-import into Firestore.
// ===========================================================
const FULL_TRANSLATIONS = {
  th: {
    // Navigation
    "nav.home":"หน้าหลัก",
    "nav.packages":"แพ็คเกจ",
    "nav.admin":"แผงควบคุมผู้ดูแล",
    "nav.login":"เข้าสู่ระบบ",
    "nav.signout":"ออกจากระบบ",
    // Drawer
    "drawer.title":"เมนู",
    "drawer.lang":"ภาษา",
    "drawer.account":"บัญชี",
    // Hero
    "hero.eyebrow":"AI ตัวแทนขายอัจฉริยะ · ระบบทำงานสด",
    "hero.title-html":'ขายของ<br/>ขณะที่คุณ<span class="grad">หลับ</span><br/><span class="outline">ได้จริง</span>',
    "hero.lede":"{brand} คือ AI ตัวแทนขายอัจฉริยะที่คัดกรองลูกค้า รับมือข้อโต้แย้ง นัดหมาย และปิดการขายผ่าน WhatsApp, Instagram, Messenger และเว็บไซต์ของคุณ — ตลอด 24 ชั่วโมง รองรับ 4 ภาษา",
    "hero.cta-primary":"ดูแพ็คเกจ",
    "hero.cta-secondary":"เปิดแผงผู้ดูแล",
    "hero.cta-admin":"เปิดแผงผู้ดูแล",
    "hero.cta-account":"ไปยังบัญชีของฉัน",
    "hero.cta-signin":"เข้าสู่ระบบ",
    // Capabilities
    "caps.num":"01 / ความสามารถ",
    "caps.title-html":'ไม่ใช่บอท แต่คือ<span class="grad">นักปิดการขาย</span>',
    "caps.lede":"แค่วาง URL เว็บไซต์ของคุณ AI จะอ่านสินค้า ราคา และจุดขาย แล้วเริ่มขายภายใน 15 นาที ไม่ต้องเขียนโค้ดหรือ Prompt",
    "cap.01.t":"สนทนาเหมือนมนุษย์",
    "cap.01.d":"สนทนาได้ทั้งข้อความเสียง รูปภาพ วิดีโอ และ PDF เสมือนนักขายมือทองของคุณ",
    "cap.02.t":"หลายช่องทาง",
    "cap.02.d":"WhatsApp · Instagram · Messenger · เว็บแชต — ใช้ความจำเดียวกันทุกแพลตฟอร์ม",
    "cap.03.t":"ติดตั้งใน 15 นาที",
    "cap.03.d":"วาง URL เว็บไซต์ AI จะอ่านสินค้าและราคาให้อัตโนมัติ ไม่ต้องเขียนโค้ดหรือ Prompt",
    "cap.04.t":"เข้าใจหลายสื่อ",
    "cap.04.d":"เข้าใจข้อความเสียง รูปภาพ เอกสาร PDF และวิดีโอ ไม่ใช่แค่ข้อความ",
    "cap.05.t":"จองคิวในแชต",
    "cap.05.d":"ตรวจจับสัญญาณการซื้อและนัดหมายในแชตได้ทันที ไม่ต้องส่งลิงก์ภายนอก",
    "cap.06.t":"จดจำบริบท",
    "cap.06.d":"จดจำการสนทนาและความชอบของลูกค้าแต่ละคน เพื่อสร้างความสัมพันธ์ระยะยาว",
    "cap.07.t":"แคมเปญและติดตาม",
    "cap.07.d":"ส่งข้อความ Outbound ติดตามอัตโนมัติ และ Comment-to-DM บน IG และ Facebook",
    "cap.08.t":"พัฒนาตัวเอง",
    "cap.08.d":"One-click optimization วิเคราะห์บทสนทนาที่ปิดการขายได้ดีที่สุด เพื่อยกระดับอัตรา Conversion",
    // Packages
    "pkg.num":"02 / ราคา",
    "pkg.title-html":'สามวิธีในการ<span class="grad">เริ่มต้น</span>',
    "pkg.lede":"จ่ายตามการใช้งาน เข้าใช้ไม่จำกัดเป็นรายวัน หรือสมัครสมาชิก ทุกแพ็คเกจเปิดใช้งานทันทีพร้อมข้อมูลเข้าใช้ทางอีเมล",
    "pkg.tab.credit":"ซื้อเครดิต",
    "pkg.tab.onetime":"เข้าใช้ครั้งเดียว",
    "pkg.tab.sub":"สมาชิก",
    "pkg.sub.note":"เครดิตของสมาชิกจะหมดอายุเมื่อสิ้นรอบ หากใช้หมดก่อนกำหนด สามารถเติมเครดิตเพิ่มได้",
    "pkg.select":"เลือก",
    "pkg.subscribe":"สมัครสมาชิก",
    "pkg.configure":"กำหนดเอง",
    "pkg.featured":"ยอดนิยม",
    "pkg.manual.title":"กำหนดจำนวนเอง",
    "pkg.manual.desc":"ใส่จำนวนเงินที่ต้องการ ใช้สำหรับการเติมเครดิตและรับยอดจาก ontheline",
    "pkg.manual.label":"ใส่จำนวน (USD)",
    // Credit Purchase packages
    "pkg.credit.5.t":"เริ่มต้น",
    "pkg.credit.5.d":"เติมเครดิตเล็กน้อยสำหรับทดลองและแคมเปญเล็ก",
    "pkg.credit.10.t":"พื้นฐาน",
    "pkg.credit.10.d":"เครดิตเพียงพอสำหรับใช้งาน 1 สัปดาห์",
    "pkg.credit.20.t":"สตูดิโอ",
    "pkg.credit.20.d":"เหมาะที่สุดสำหรับ Freelance และที่ปรึกษา",
    "pkg.credit.50.t":"อะตอเลีย",
    "pkg.credit.50.d":"สำหรับทีมเล็กที่ทำแคมเปญพร้อมกัน",
    "pkg.credit.100.t":"องค์กร",
    "pkg.credit.100.d":"สำหรับเอเจนซีและผู้ขายปริมาณสูง",
    // 1-Time Access
    "pkg.onetime.3d.t":"3 วัน",
    "pkg.onetime.3d.d":"เครดิตไม่จำกัดเป็นเวลา 72 ชั่วโมง",
    "pkg.onetime.7d.t":"7 วัน",
    "pkg.onetime.7d.d":"เข้าใช้ไม่จำกัดเต็มสัปดาห์",
    "pkg.onetime.14d.t":"14 วัน",
    "pkg.onetime.14d.d":"ใช้งานไม่จำกัด 2 สัปดาห์เต็ม",
    "pkg.onetime.1m.t":"1 เดือน",
    "pkg.onetime.1m.d":"เหมาะกับแคมเปญรายเดือน",
    "pkg.onetime.3m.t":"3 เดือน",
    "pkg.onetime.3m.d":"เข้าใช้รายไตรมาส — เอเจนซีนิยมเลือก",
    "pkg.onetime.6m.t":"6 เดือน",
    "pkg.onetime.6m.d":"คอมมิตครึ่งปีพร้อมการสนับสนุนระดับพรีเมียม",
    "pkg.onetime.12m.t":"12 เดือน",
    "pkg.onetime.12m.d":"เข้าใช้รายปี — แพ็คเกจหลักของลูกค้าส่วนใหญ่",
    "pkg.onetime.24m.t":"24 เดือน",
    "pkg.onetime.24m.d":"คุ้มที่สุดต่อวัน สำหรับการใช้ระยะยาว 2 ปี",
    // Subscription
    "pkg.sub.1m.t":"1 เดือน",
    "pkg.sub.1m.d":"รายเดือนแบบต่อเนื่อง ยกเลิกเมื่อใดก็ได้",
    "pkg.sub.3m.t":"3 เดือน",
    "pkg.sub.3m.d":"รายไตรมาส — แพ็คเกจยอดนิยม",
    "pkg.sub.6m.t":"6 เดือน",
    "pkg.sub.6m.d":"คอมมิตครึ่งปีพร้อมคิวสนับสนุนระดับพรีเมียม",
    "pkg.sub.12m.t":"12 เดือน",
    "pkg.sub.12m.d":"สมาชิกรายปี — แนะนำ",
    "pkg.sub.24m.t":"24 เดือน",
    "pkg.sub.24m.d":"สมาชิก 2 ปี ล็อกราคาไว้คงที่",
    // Checkout
    "checkout.num":"03 / ชำระเงิน",
    "checkout.title-html":'ใกล้<span class="grad">เป็นของคุณแล้ว</span>',
    "checkout.section.customer":"ข้อมูลลูกค้า",
    "checkout.section.payment":"วิธีชำระเงิน",
    "checkout.section.delivery":"การจัดส่งใบเสร็จ",
    "checkout.field.name":"ชื่อ-นามสกุล",
    "checkout.field.email":"อีเมล",
    "checkout.field.company":"บริษัท",
    "checkout.field.country":"ประเทศ",
    "checkout.field.taxid":"เลขประจำตัวผู้เสียภาษี",
    "checkout.field.optional":"ไม่บังคับ",
    "checkout.field.taxid.hint":"สำหรับขอใบกำกับภาษีเต็มรูปแบบ · นิติบุคคลไทย: เลขประจำตัวผู้เสียภาษี 13 หลัก",
    "checkout.ph.name":"ตัวอย่าง: สรญา กาญจนาพร",
    "checkout.ph.email":"ตัวอย่าง: soraya@studiokanchana.com",
    "checkout.ph.company":"ตัวอย่าง: สตูดิโอ กาญจนา",
    "checkout.ph.taxid":"ตัวอย่าง: 0105564016423",
    "checkout.terms.intro-html":"ก่อนชำระเงิน กรุณาอ่าน <a class=\"terms-link\" onclick=\"App.openTermsModal()\">ข้อกำหนดในการให้บริการและนโยบายความเป็นส่วนตัว</a>",
    "checkout.terms.consent":"ข้าพเจ้ายืนยันว่าซื้อเพื่อใช้ในทางธุรกิจ และได้อ่านและยอมรับข้อกำหนดในการให้บริการและนโยบายความเป็นส่วนตัวแล้ว ข้าพเจ้าเข้าใจว่าเครดิตที่เติมจะหมดอายุอัตโนมัติภายใน 24 ชั่วโมงหลังการซื้อ และไม่สามารถขอคืนเงินได้ทุกกรณี",
    "toast.checkout.needName":"กรุณากรอกชื่อ-นามสกุล",
    "toast.checkout.needEmail":"กรุณากรอกอีเมล",
    "toast.checkout.badEmail":"กรุณากรอกอีเมลให้ถูกต้อง",
    "toast.checkout.needTerms":"กรุณาอ่านและยอมรับข้อกำหนดในการให้บริการก่อนชำระเงิน",
    "about.eyebrow":"เกี่ยวกับ ONTHELINE และ DealMai",
    "about.heading-html":"ทุกการติดต่อ คือ<em>โอกาสเติบโต</em>",
    "about.teaser-html":"ที่ <strong>ONTHELINE</strong> เราเห็นว่าแชทบอทแบบเดิมและการตอบกลับที่ล่าช้า ทำให้ธุรกิจสูญเสียลูกค้าที่มีคุณค่าไปทุกวัน เราจึงสร้าง <strong>DealMai</strong> ขึ้นมาเพื่อปิดช่องว่างนี้ด้วยการดูแลลูกค้าด้วย AI ตลอด 24 ชั่วโมง DealMai ทำงานบนช่องทางแชทหลักอย่าง WhatsApp, Instagram และ LINE พูดคุยได้เป็นธรรมชาติเหมือนมนุษย์ คัดกรองผู้สนใจ นัดหมาย และดึงลูกค้าเก่ากลับมา ด้วยน้ำเสียงของแบรนด์คุณเอง ในฐานะส่วนหนึ่งของเครือข่าย ONTHELINE ระดับสากล (ไทย ญี่ปุ่น เกาหลีใต้) เราช่วยให้ธุรกิจเปลี่ยนทุกการติดต่อให้เป็นโอกาสเติบโต แบบไม่มีหยุด",
    "about.readmore":"อ่านเรื่องราวของเรา",
    "about.modal.kicker":"เกี่ยวกับเรา",
    "about.modal.title":"ONTHELINE และ DealMai",
    "about.modal.sub":"ปิดช่องว่างการดูแลลูกค้าระดับโลก · ไทย · ญี่ปุ่น · เกาหลีใต้",
    "terms.modal.kicker":"ข้อกฎหมาย",
    "terms.modal.title":"ข้อกำหนดในการให้บริการและนโยบายความเป็นส่วนตัว",
    "terms.modal.sub":"ข้อกำหนดหลักในการให้บริการและข้อตกลงแพลตฟอร์ม DealMai · มีผล 31 กรกฎาคม 2026",
    "doc.close":"ปิด",
    "checkout.field.card":"หมายเลขบัตร",
    "checkout.field.expiry":"วันหมดอายุ",
    "checkout.field.cvc":"CVC",
    "checkout.field.via":"ส่งใบเสร็จทาง",
    "checkout.field.lang":"ภาษาของใบเสร็จ",
    "checkout.payment.intro":"ระบบจะนำคุณไปยังหน้าชำระเงินที่ปลอดภัยของ Payment Gateway เพื่อทำธุรกรรม",
    "checkout.channel.any":"เลือกในขั้นตอนถัดไป",
    "checkout.channel.card":"บัตรเครดิต / เดบิต",
    "checkout.channel.qr":"QR PromptPay",
    "checkout.channel.mobile":"Mobile Banking",
    "checkout.channel.ewallet":"E-Wallet",
    "checkout.summary.title":"สรุปการสั่งซื้อ",
    "checkout.summary.package":"แพ็คเกจ",
    "checkout.summary.activation":"เปิดใช้งาน",
    "checkout.summary.activation-val":"ทันที",
    "checkout.summary.subtotal":"ยอดรวม",
    "checkout.summary.vat":"VAT 7%",
    "checkout.summary.total":"ยอดที่ต้องชำระ",
    "checkout.summary.cta":"ยืนยันและชำระเงิน",
    "checkout.summary.secure":"เข้ารหัส 256-bit · PCI DSS",
    "checkout.summary.redirecting":"กำลังเปลี่ยนเส้นทางไปยัง Payment Gateway…",
    "checkout.summary.powered":"ขับเคลื่อนโดย Payment Gateway · ผู้ให้บริการชำระเงินไทย",
    // Payment Result
    "result.pending.title-html":'กำลัง<span class="grad">ดำเนินการชำระเงิน</span>',
    "result.pending.sub":"กำลังประมวลผลการชำระเงินของคุณ คุณจะได้รับอีเมลยืนยันที่ {email} เมื่อ Payment Gateway ยืนยัน ปกติใช้เวลาไม่เกิน 1 นาที",
    "result.success.title-html":'ยืนยันการ<span class="grad">ชำระเงินสำเร็จ</span>',
    "result.success.sub":"ขอบคุณค่ะ ใบเสร็จและข้อมูลเข้าใช้กำลังถูกส่งไปที่ {email} เริ่มต้นใช้งานได้ภายใน 5 นาที",
    "result.failed.title-html":'การชำระเงิน<span class="grad">ไม่สำเร็จ</span>',
    "result.failed.sub":"การชำระเงินถูกยกเลิกหรือถูกปฏิเสธ ไม่มีการเรียกเก็บเงิน คุณสามารถลองอีกครั้งหรือเลือกวิธีอื่น",
    "result.notfound.title-html":'ไม่พบ<span class="grad">คำสั่งซื้อ</span>',
    "result.notfound.sub":"เราไม่พบคำสั่งซื้อนี้ หากคุณเพิ่งชำระเงิน กรุณารอสักครู่ การยืนยันอาจยังเดินทางมาไม่ถึง",
    "result.ref":"เลขที่คำสั่งซื้อ",
    "result.amount":"จำนวนเงิน",
    "result.method":"วิธีชำระเงิน",
    "result.status":"สถานะ",
    "result.cta-retry":"ลองอีกครั้ง",
    "result.cta-back":"กลับไปหน้าแพ็คเกจ",
    "result.cta-home":"กลับหน้าหลัก",
    // Confirmation
    "confirm.title-html":'ยินดีต้อนรับ <span class="grad">{name}</span>',
    "confirm.sub":"AI Agent ของคุณกำลังเตรียมพร้อม ข้อมูลเข้าใช้และใบเสร็จได้ส่งไปที่ {email} แล้ว ใช้เวลาไม่เกิน 5 นาที",
    "confirm.ref":"เลขที่คำสั่งซื้อ",
    "confirm.package":"แพ็คเกจ",
    "confirm.amount":"ยอดที่ชำระ",
    "confirm.portal":"ลิงก์เข้าใช้งาน",
    "confirm.invoice":"ใบกำกับภาษี / ใบเสร็จ",
    "confirm.invoice-val":"PDF · ส่งทางอีเมล",
    "confirm.cta-portal":"เปิด Portal",
    "confirm.cta-back":"กลับไปหน้าแพ็คเกจ",
    // Nav (customer)
    "nav.account":"บัญชีของฉัน",
    "nav.orders":"คำสั่งซื้อของฉัน",
    // Customer Portal · My Account
    "account.crumbs":"พอร์ทัล / บัญชีของฉัน",
    "account.welcome":"ยินดีต้อนรับ คุณ{name}",
    "account.sub":"แพ็คเกจ คำสั่งซื้อ และบัญชีของคุณในที่เดียว",
    "account.active.title-html":'แพ็คเกจ<span class="grad">ที่ใช้งานอยู่</span>',
    "account.active.none":"ยังไม่มีแพ็คเกจที่ใช้งาน เลือกแพ็คเกจเพื่อเริ่มต้นใช้งาน",
    "account.active.status.active":"ใช้งานได้",
    "account.active.status.expired":"หมดอายุแล้ว",
    "account.active.status.expiring":"ใกล้หมดอายุ",
    "account.active.expires":"หมดอายุวันที่ {date}",
    "account.active.daysLeft":"เหลืออีก {n} วัน",
    "account.active.expiredOn":"หมดอายุเมื่อ {date}",
    "account.active.noExpiry":"ไม่มีกำหนดหมดอายุ · ยอดเครดิตคงเหลือ",
    "account.stats.orders":"คำสั่งซื้อทั้งหมด",
    "account.stats.spent":"ยอดใช้จ่ายรวม",
    "account.stats.credits":"เครดิตที่ได้รับ",
    "account.stats.member":"สมัครเมื่อ",
    "account.credits.note":"นี่คือเครดิตรวมที่คุณได้รับจากการซื้อทุกรายการ คุณสามารถตรวจสอบเครดิตคงเหลือและการใช้งานปัจจุบันได้ใน DM Champ Portal",
    "account.cta.browse":"ดูแพ็คเกจ",
    "account.cta.changePassword":"เปลี่ยนรหัสผ่าน",
    "account.changePw.title":"เปลี่ยนรหัสผ่าน",
    "account.changePw.sub":"กรอกรหัสผ่านปัจจุบัน แล้วตั้งรหัสผ่านใหม่ การเปลี่ยนนี้จะอัปเดตรหัสผ่านบัญชี Deal Pro ของคุณ",
    "account.changePw.cta":"อัปเดตรหัสผ่าน",
    "account.cta.orders":"ดูคำสั่งซื้อของฉัน",
    "account.passwordPrompt.title":"กรุณาเปลี่ยนรหัสผ่าน",
    "account.passwordPrompt.sub":"เพื่อความปลอดภัย โปรดตั้งรหัสผ่านใหม่ก่อนใช้งานระบบ",
    "account.passwordPrompt.cta":"อัปเดตรหัสผ่าน",
    // Customer Portal · My Orders
    "orders.crumbs":"พอร์ทัล / คำสั่งซื้อของฉัน",
    "orders.title-html":'คำสั่งซื้อ<span class="grad">ของฉัน</span>',
    "orders.sub":"รายการที่คุณซื้อทั้งหมด ทั้งในอดีตและปัจจุบัน",
    "orders.empty":"ยังไม่มีคำสั่งซื้อ ดูแพ็คเกจเพื่อเริ่มต้นใช้งาน",
    "orders.col.ref":"เลขที่",
    "orders.col.date":"วันที่",
    "orders.col.package":"แพ็คเกจ",
    "orders.col.amount":"จำนวนเงิน",
    "orders.col.credits":"เครดิต",
    "orders.col.expires":"หมดอายุ",
    "orders.col.status":"สถานะ",
    "orders.col.actions":"จัดการ",
    "orders.action.view":"ดูรายละเอียด",
    "orders.status.paid":"ชำระแล้ว",
    "orders.status.pending":"รอชำระ",
    "orders.status.failed":"ล้มเหลว",
    "orders.status.expired":"หมดอายุ",
    "orders.status.cancelled":"ยกเลิกแล้ว",
    "orders.modal.title":"รายละเอียดคำสั่งซื้อ",
    "orders.modal.customer":"ลูกค้า",
    "orders.modal.items":"รายการ",
    "orders.modal.subtotal":"ยอดรวม",
    "orders.modal.vat":"VAT 7%",
    "orders.modal.total":"ยอดรวมทั้งสิ้น",
    "orders.modal.paymentMethod":"วิธีชำระเงิน",
    "orders.modal.paidAt":"ชำระเมื่อ",
    "orders.modal.expiresAt":"หมดอายุเมื่อ",
    "orders.modal.resendInvoice":"ส่งใบกำกับใหม่",
    "orders.modal.resendCredentials":"ส่งข้อมูลเข้าใช้ใหม่",
    "orders.modal.close":"ปิด",
    "orders.toast.resent":"อีเมลถูกจัดคิวเพื่อส่งใหม่",
    "orders.toast.resendFailed":"ไม่สามารถจัดคิวอีเมลได้: {error}",
    // Admin · sidebar
    "admin.side.console":"แผงควบคุม",
    "admin.side.orders":"รายการสั่งซื้อ",
    "admin.side.users":"ผู้ใช้งาน",
    "admin.side.packages":"จัดการแพ็คเกจ",
    "admin.side.webhook":"ontheline Webhook",
    "admin.side.partners":"พาร์ทเนอร์ ontheline",
    "admin.side.paygw":"Payment Gateway ontheline",
    "admin.side.currencies":"สกุลเงิน ontheline",
    "admin.currencies.title":"สกุลเงิน ontheline",
    "admin.currencies.sub":"จัดการรหัสสกุลเงินที่ ontheline อาจส่งมาในฟิลด์ <code>currency</code> ของ webhook ถ้าสกุลเงินที่ส่งมาไม่ตรงกับที่กำหนดไว้ webhook จะถูกปฏิเสธ สัญลักษณ์จะแสดงในหน้า Orders ข้างจำนวนเงิน ส่วนมูลค่า USD (สำหรับคำนวณเครดิต) จะคำนวณจากอัตราแลกเปลี่ยนสด",
    "admin.currencies.add":"เพิ่มสกุลเงิน",
    "admin.currencies.empty":"ยังไม่มีสกุลเงิน เพิ่มรายการ (เช่น USD $) เพื่อเริ่มรับ webhook ของ ontheline",
    "admin.currencies.add.title":"เพิ่มสกุลเงิน",
    "admin.currencies.edit.title":"แก้ไขสกุลเงิน",
    "admin.currencies.col.code":"รหัส (ISO 4217)",
    "admin.currencies.col.symbol":"สัญลักษณ์",
    "admin.currencies.col.label":"ชื่อ",
    "admin.currencies.code.ph":"เช่น USD, THB, JPY, KRW",
    "admin.currencies.symbol.ph":"เช่น $, ฿, ¥, ₩",
    "admin.currencies.label.ph":"เช่น ดอลลาร์สหรัฐ",
    "admin.currencies.hint":"รหัสจะถูกเทียบแบบไม่สนตัวพิมพ์กับค่า currency ใน webhook และใช้แปลงเป็น USD ควรใช้รหัส ISO 4217 มาตรฐาน 3 ตัวอักษร เพื่อให้ API อัตราแลกเปลี่ยนรู้จัก",
    "admin.partners.title":"พาร์ทเนอร์ ontheline",
    "admin.partners.sub":"จัดการรหัสพาร์ทเนอร์ที่ ontheline อาจส่งมาใน webhook ถ้าค่า <code>partner</code> ที่ส่งมาไม่ตรงกับรหัสเหล่านี้ webhook จะถูกปฏิเสธ",
    "admin.partners.add":"เพิ่มพาร์ทเนอร์",
    "admin.partners.empty":"ยังไม่มีพาร์ทเนอร์ เพิ่มรายการเพื่อเริ่มรับ webhook ของ ontheline ที่มีรหัสพาร์ทเนอร์",
    "admin.partners.add.title":"เพิ่มพาร์ทเนอร์",
    "admin.partners.edit.title":"แก้ไขพาร์ทเนอร์",
    "admin.paygw.title":"Payment Gateway ontheline",
    "admin.paygw.sub":"จัดการรหัส payment gateway ที่ ontheline อาจส่งมาใน webhook ถ้าค่า <code>paygw</code> ที่ส่งมาไม่ตรงกับรหัสเหล่านี้ webhook จะถูกปฏิเสธ",
    "admin.paygw.add":"เพิ่ม Payment Gateway",
    "admin.paygw.empty":"ยังไม่มี payment gateway เพิ่มรายการเพื่อเริ่มรับ webhook ของ ontheline ที่มีรหัส paygw",
    "admin.paygw.add.title":"เพิ่ม Payment Gateway",
    "admin.paygw.edit.title":"แก้ไข Payment Gateway",
    "admin.codelist.col.code":"รหัส",
    "admin.codelist.col.company":"ชื่อบริษัท",
    "admin.codelist.col.actions":"จัดการ",
    "admin.codelist.edit":"แก้ไข",
    "admin.codelist.delete":"ลบ",
    "admin.codelist.save":"บันทึก",
    "admin.codelist.code.ph":"เช่น PARTNER01",
    "admin.codelist.company.ph":"เช่น บริษัท เอซเม่ ทราเวล จำกัด",
    "admin.codelist.code.hint":"รหัสจะถูกเทียบแบบตรงตัว (ไม่สนตัวพิมพ์เล็ก-ใหญ่) กับค่าใน webhook ส่วนชื่อบริษัทไว้อ้างอิงและแสดงในหน้า Orders",
    "admin.side.chillpay":"Payment Gateway Events",
    "admin.side.paymentgw":"Payment Gateway",
    "admin.paymentgw.crumbs":"คอนโซล / Payment Gateway",
    "admin.paymentgw.title-html":"Payment <span class=\"grad\">gateway</span>",
    "admin.paymentgw.sub":"เลือกผู้ให้บริการที่จะรับชำระเงินสำหรับรายการขายตรงใหม่ ส่วนรายการที่กำลังดำเนินการอยู่จะยังใช้ gateway เดิมที่สร้างไว้",
    "admin.paymentgw.note-html":"ข้อมูลลับ (credentials) เก็บอยู่ใน environment variables ของ Netlify ไม่ได้เก็บในฐานข้อมูล หน้านี้บันทึกเพียงว่า<em>เลือกใช้</em> gateway ใด กรุณาตั้งค่า key ใน Netlify ก่อน แล้วจึงมาเปิดใช้งานที่นี่",
    "admin.paymentgw.note.default":"ยังไม่ได้บันทึกการเลือก ระบบจะใช้ gateway ค่าเริ่มต้น เลือกจากด้านล่างเพื่อกำหนดให้ชัดเจน",
    "admin.paymentgw.state.ready":"ตั้งค่าครบ พร้อมใช้งาน",
    "admin.paymentgw.state.missing":"ยังตั้งค่าไม่ครบ ขาด environment variables: {list}",
    "admin.paymentgw.badge.active":"ใช้งานอยู่",
    "admin.paymentgw.btn.use":"ใช้ gateway นี้",
    "admin.paymentgw.btn.inuse":"กำลังใช้งาน",
    "admin.paymentgw.btn.needenv":"กรุณาตั้งค่า environment variables ของ gateway นี้ใน Netlify ก่อน",
    "admin.paymentgw.btn.copy":"คัดลอก",
    "admin.paymentgw.lbl.channels":"ช่องทางชำระเงิน",
    "admin.paymentgw.lbl.callback":"Callback URL — นำไปลงทะเบียนในระบบของผู้ให้บริการ",
    "admin.paymentgw.hint.callback":"เป็นการเรียกแบบ server-to-server และเป็นแหล่งข้อมูลหลักของสถานะการชำระเงิน ให้ลงทะเบียนเป็น URL Background / webhook ของทุกช่องทางที่เปิดใช้งาน",
    "admin.paymentgw.lbl.returnurl":"Return URL (URL Result) — ต้องลงทะเบียนด้วย",
    "admin.paymentgw.hint.returnurl":"หน้าที่ browser ของลูกค้าจะกลับมาหลังชำระเงิน ใช้ค่าเดียวกันทุก gateway เพราะเป็นหน้าเว็บของเราเอง",
    "admin.paymentgw.lbl.env":"Environment variables",
    "admin.paymentgw.empty":"ยังไม่มี payment gateway ที่ลงทะเบียนไว้",
    "admin.paymentgw.err.diag":"เชื่อมต่อกับฟังก์ชันชำระเงินไม่ได้ กรุณา deploy เว็บไซต์แล้วโหลดหน้านี้ใหม่",
    "toast.paymentgw.unknown":"ไม่พบ gateway นี้ในระบบ",
    "toast.paymentgw.needenv":"กรุณาตั้งค่า environment variables ก่อน ยังขาด: {list}",
    "toast.paymentgw.confirm":"ให้การชำระเงินใหม่ทั้งหมดผ่าน {name} ใช่หรือไม่\n\nรายการที่กำลังดำเนินการอยู่จะไม่ได้รับผลกระทบ แต่ละรายการจะจบด้วย gateway ที่เริ่มไว้",
    "toast.paymentgw.saved":"การชำระเงินใหม่จะผ่าน {name} แล้ว",
    "toast.paymentgw.failed":"บันทึกไม่สำเร็จ: {error}",
    "admin.side.emails":"คิวอีเมล",
    "admin.side.languages":"ภาษา",
    "admin.side.branding":"แบรนด์",
    "admin.side.dmchamp":"DM Champ",
    "admin.side.account":"บัญชี",
    "admin.side.password":"เปลี่ยนรหัสผ่าน",
    "admin.side.signout":"ออกจากระบบ",
    // Admin · branding
    "admin.branding.crumbs":"แผงควบคุม / แบรนด์",
    "admin.branding.title-html":'การจัดการ<span class="grad">แบรนด์</span>',
    "admin.branding.sub":"เปลี่ยนชื่อเว็บไซต์และโลโก้ การอัปเดตจะมีผลทันทีทั่วทั้งแอป — header, footer, แท็บเบราว์เซอร์ และหน้าลูกค้า — โดยไม่ต้อง refresh",
    "admin.branding.name.title":"ชื่อเว็บไซต์",
    "admin.branding.name.hint":"แทนที่คำว่า \"Deal Pro\" ทุกที่ในเว็บสาธารณะ แผงผู้ดูแล footer และแท็บเบราว์เซอร์ สูงสุด 60 ตัวอักษร",
    "admin.branding.name.save":"บันทึกชื่อ",
    "admin.branding.name.reset":"รีเซ็ต",
    "admin.branding.name.reset.title":"รีเซ็ตเป็น \"Deal Pro\"",
    "admin.branding.name.preview":"ตัวอย่าง:",
    "admin.branding.logo.title":"รูปโลโก้",
    "admin.branding.logo.hint":"อัปโหลดโลโก้ที่กำหนดเองเพื่อแสดงใน header แนะนำ: PNG พื้นหลังโปร่งใส ~300×100 pixels สูงสุด 500 KB",
    "admin.branding.logo.upload":"อัปโหลดโลโก้",
    "admin.branding.logo.reset":"รีเซ็ต",
    "admin.branding.logo.reset.title":"รีเซ็ตเป็นโลโก้เริ่มต้น",
    "admin.branding.logo.limits":"รองรับ: PNG, JPEG, SVG, WebP · สูงสุด 500 KB",
    "admin.branding.favicon.title":"ไอคอนแท็บเบราว์เซอร์ (Favicon)",
    "admin.branding.favicon.hint":"ไอคอนเล็กๆ ที่แสดงในแท็บเบราว์เซอร์ ข้างชื่อเว็บ ควรใช้รูปสี่เหลี่ยมจัตุรัส (อย่างน้อย 32×32 px) แนะนำ PNG แบบโปร่งใสหรือ SVG จะได้ผลดีที่สุด มีผลกับแท็บเบราว์เซอร์ของผู้เข้าชมทุกคนแบบเรียลไทม์",
    "admin.branding.favicon.preview":"ตัวอย่างแท็บ",
    "admin.branding.favicon.upload":"อัปโหลด Favicon",
    "admin.branding.favicon.reset":"รีเซ็ต",
    "admin.branding.favicon.reset.title":"ลบ favicon ที่กำหนดเองและใช้ไอคอนเริ่มต้น",
    "admin.branding.favicon.using.custom":"กำลังแสดง favicon ที่อัปโหลดเอง",
    "admin.branding.favicon.using.default":"กำลังใช้ไอคอนแท็บเบราว์เซอร์เริ่มต้น",
    "admin.branding.favicon.limits":"รองรับ: PNG, ICO, SVG, WebP · สี่เหลี่ยมจัตุรัส · สูงสุด 100 KB",
    "admin.branding.logo.using.default":"กำลังแสดงโลโก้เริ่มต้น",
    "admin.branding.logo.using.custom":"กำลังแสดงโลโก้ที่อัปโหลด",
    "admin.branding.lastUpdated":"อัปเดตล่าสุด {date} โดย {by}",

    // Admin · DM Champ integration
    "admin.dmchamp.crumbs":"Console / การเชื่อมต่อ",
    "admin.dmchamp.title-html":'เชื่อมต่อ <span class="grad">DM Champ</span>',
    "admin.dmchamp.sub":"สร้างบัญชี DM Champ ให้ลูกค้าทุกคนที่จ่ายเงินสำเร็จโดยอัตโนมัติ ต้องใช้แผน Agency ของ DM Champ",
    "admin.dmchamp.status.configured":"เชื่อมต่อแล้ว · มี API Key",
    "admin.dmchamp.status.missing":"ยังไม่ได้เชื่อมต่อ · กรอก API Key ด้านล่าง",
    "admin.dmchamp.status.disabled":"ปิดการเชื่อมต่อ · เปิดเพื่อสร้างบัญชีอัตโนมัติ",
    "admin.dmchamp.apiKey":"DM Champ API Key",
    "admin.dmchamp.apiKey.hint":"หาได้จาก DM Champ → Settings → API Access เก็บไว้ใน Firestore (config/dmchamp) อย่างปลอดภัย จะไม่แสดงอีกหลังบันทึก",
    "admin.dmchamp.apiKey.placeholder":"วาง API Key…",
    "admin.dmchamp.apiKey.masked":"Key ปัจจุบัน: {masked} — วาง Key ใหม่เพื่อแทนที่",
    "admin.dmchamp.enabled":"เปิดสร้างบัญชีอัตโนมัติ",
    "admin.dmchamp.enabled.hint":"เมื่อเปิด ทุกการจ่ายเงินสำเร็จจะสร้างบัญชี DM Champ อัตโนมัติ",
    "admin.dmchamp.creditsPerUsd":"เครดิตต่อ USD",
    "admin.dmchamp.creditsPerUsd.hint":"แต่ละ USD ที่ลูกค้าจ่าย จะแปลงเป็นกี่เครดิต DM Champ เช่น 100 หมายถึง $5 → 500 เครดิต, $10 → 1,000",
    "admin.dmchamp.defaultCredits":"เครดิตเริ่มต้นต่อเดือน",
    "admin.dmchamp.defaultCredits.hint":"ใช้เมื่อแปลงยอด USD ไม่ได้ (หายาก) ทำหน้าที่เป็นค่าขั้นต่ำ",
    "admin.dmchamp.rollover":"สะสมเครดิตที่ไม่ใช้",
    "admin.dmchamp.rollover.hint":"เมื่อเปิด เครดิตที่ใช้ไม่หมดจะยกไปเดือนถัดไป เมื่อปิด เครดิตจะรีเซ็ตทุกเดือน",
    "admin.dmchamp.timezone":"Time Zone เริ่มต้น",
    "admin.dmchamp.country":"ประเทศเริ่มต้น (ISO-2)",
    "admin.dmchamp.portalUrl":"URL พอร์ทัล",
    "admin.dmchamp.openPortal":"เปิดพอร์ทัล DM Champ",
    "admin.dmchamp.portalUrl.hint":"URL สำหรับเข้าสู่ระบบ DM Champ ที่จะแสดงในอีเมลและปุ่มในพอร์ทัลของลูกค้า ใช้ https://app.dmchamp.com เป็นค่าเริ่มต้น หรือใส่โดเมน White-Label ของคุณ (เช่น https://app.dealmai.com) เพื่อให้ลูกค้าเห็นแบรนด์ของคุณ",
    "admin.dmchamp.save":"บันทึกการตั้งค่า",
    "admin.dmchamp.test":"ทดสอบการเชื่อมต่อ",
    "admin.dmchamp.preview":"ดูตัวอย่างการแปลง",
    "admin.dmchamp.preview.row":"${usd} → {credits} เครดิต",

    // DM Champ toasts
    "toast.dmchamp.saved":"บันทึกการตั้งค่า DM Champ แล้ว",
    "toast.dmchamp.saveFail":"บันทึกไม่สำเร็จ: {error}",
    "toast.dmchamp.provisioning":"กำลังสร้างบัญชี DM Champ…",
    "toast.dmchamp.provisioned":"สร้างบัญชี DM Champ สำหรับ {email} แล้ว",
    "toast.dmchamp.alreadyProvisioned":"สร้างไปแล้ว — ไม่มีการเปลี่ยนแปลง",
    "toast.dmchamp.linked":"เชื่อมโยงบัญชี DM Champ ที่มีอยู่กับคำสั่งซื้อนี้แล้ว ({email})",
    "toast.dmchamp.provisionFail":"สร้างบัญชี DM Champ ไม่สำเร็จ: {error}",

    // Customer portal · DM Champ workspace card
    "account.dmchamp.title":"พื้นที่ทำงาน Ai Portal",
    "account.dmchamp.intro":"พื้นที่ทำงาน AI ตัวแทนขายของคุณ",
    "account.dmchamp.email":"อีเมล",
    "account.dmchamp.uid":"รหัสบัญชี",
    "account.dmchamp.credits":"เครดิตต่อเดือน",
    "account.dmchamp.tempPassword":"รหัสผ่านชั่วคราว",
    "account.dmchamp.tempPasswordHint":"กรุณาเปลี่ยนเมื่อเข้าใช้ครั้งแรก",
    "account.dmchamp.open":"เปิด Ai Portal",
    "account.dmchamp.pending":"กำลังเตรียมพื้นที่ทำงาน Ai Portal ของคุณ ระบบจะส่งข้อมูลเข้าใช้ทางอีเมลในไม่ช้า",
    "account.dmchamp.failed":"ไม่สามารถสร้างพื้นที่ทำงาน Ai Portal ของคุณได้ กรุณาติดต่อทีมสนับสนุน เราจะช่วยตั้งค่าด้วยตนเอง",
    "account.dmchamp.linked":"บัญชี Ai Portal ที่มีอยู่ของคุณเชื่อมโยงกับการซื้อนี้แล้ว ใช้ข้อมูลเข้าใช้ที่คุณมีอยู่ด้านล่าง",
    "account.dmchamp.toppedUp":"เครดิตจากการซื้อนี้ถูกเพิ่มเข้าบัญชี Ai Portal ของคุณแล้ว เข้าสู่ระบบด้วยข้อมูลที่คุณมีอยู่ด้านล่าง",

    // Order View modal · DM Champ section
    "admin.orders.view.dmchamp":"บัญชี DM Champ ที่สร้าง",
    "admin.orders.view.ontheline":"พาร์ทเนอร์ / Payment Gateway ของ ontheline",
    "admin.orders.view.partner":"พาร์ทเนอร์",
    "admin.orders.view.paygw":"Payment Gateway",
    "admin.orders.view.event":"เหตุการณ์",
    "admin.orders.view.amount":"จำนวนเงิน",
    "admin.orders.view.dmchamp.notProvisioned":"ยังไม่ได้สร้าง",
    "admin.orders.view.dmchamp.provision":"สร้างบัญชี DM Champ",
    "admin.orders.view.dmchamp.retry":"ลองสร้างอีกครั้ง",
    "admin.orders.view.dmchamp.lastError":"ข้อผิดพลาดล่าสุด: {error}",
    "admin.orders.view.dmchamp.linked":"เชื่อมโยงกับบัญชี DM Champ ที่มีอยู่",
    "admin.orders.view.dmchamp.linkedNote":"ลูกค้ามีบัญชี DM Champ ด้วยอีเมลนี้อยู่แล้ว ไม่มีการสร้างบัญชีใหม่ — ลูกค้าเข้าใช้ด้วยข้อมูลเข้าสู่ระบบเดิม",

    "toast.branding.name.empty":"ชื่อเว็บไซต์ห้ามว่าง",
    "toast.branding.name.tooLong":"ชื่อเว็บไซต์ต้องไม่เกิน 60 ตัวอักษร",
    "toast.branding.name.saved":"อัปเดตชื่อเว็บไซต์แล้ว — ใช้กับทุกเบราว์เซอร์",
    "toast.branding.name.resetConfirm":"รีเซ็ตชื่อเว็บไซต์กลับเป็น \"Deal Pro\"?",
    "toast.branding.name.reset.done":"รีเซ็ตชื่อเว็บไซต์เป็นค่าเริ่มต้นแล้ว",
    "toast.branding.logo.tooLarge":"ไฟล์โลโก้ใหญ่เกินไป — สูงสุด {mb} MB",
    "toast.branding.logo.badType":"ประเภทรูปไม่รองรับ — ใช้ PNG, JPEG, SVG, หรือ WebP",
    "toast.branding.logo.uploaded":"อัปโหลดโลโก้แล้ว — ใช้กับทุกเบราว์เซอร์",
    "toast.branding.logo.resetConfirm":"รีเซ็ตโลโก้กลับเป็นรูป Deal Pro เริ่มต้น?",
    "toast.branding.logo.reset.done":"รีเซ็ตโลโก้เป็นค่าเริ่มต้นแล้ว",
    "toast.branding.favicon.uploaded":"อัปโหลด favicon แล้ว — ใช้กับแท็บเบราว์เซอร์ทุกอัน",
    "toast.branding.favicon.tooLarge":"favicon ใหญ่เกินไป — สูงสุด {kb} KB",
    "toast.branding.favicon.badType":"รูปแบบไม่รองรับ — ใช้ PNG, ICO, SVG หรือ WebP",
    "toast.branding.favicon.resetConfirm":"ลบ favicon ที่กำหนดเองและใช้ไอคอนแท็บเริ่มต้น?",
    "toast.branding.favicon.reset.done":"รีเซ็ต favicon เป็นค่าเริ่มต้นแล้ว",
    "toast.langs.enabled":"เปิด {lang} แล้ว — ผู้ใช้เลือกได้แล้ว",
    "toast.langs.disabled":"ปิด {lang} แล้ว — ซ่อนจากผู้ใช้",
    "toast.langs.enToggle":"ปิดภาษาอังกฤษไม่ได้ — เป็นภาษาสำรอง",
    "toast.codelist.codeRequired":"กรุณากรอกรหัส",
    "toast.codelist.companyRequired":"กรุณากรอกชื่อบริษัท",
    "toast.codelist.dupCode":"รหัส \"{code}\" มีอยู่แล้ว",
    "toast.codelist.added":"เพิ่มสำเร็จ",
    "toast.currencies.symbolRequired":"กรุณากรอกสัญลักษณ์สกุลเงิน",
    "toast.codelist.updated":"อัปเดตสำเร็จ",
    "toast.codelist.deleted":"ลบสำเร็จ",
    "toast.codelist.deleteConfirm":"ลบ \"{code}\"? ไม่สามารถย้อนกลับได้",
    // Admin · orders
    "admin.orders.title-html":'รายการ<span class="grad">สั่งซื้อล่าสุด</span>',
    "admin.orders.export":"ส่งออก CSV",
    "admin.orders.stat.today":"วันนี้ · ออเดอร์",
    "admin.orders.stat.month":"เดือนนี้ · ออเดอร์",
    "admin.orders.stat.yesterday":"เมื่อวาน · ออเดอร์",
    "admin.orders.stat.lastMonth":"เดือนที่แล้ว · ออเดอร์",
    "admin.orders.stat.period":"ช่วงเวลา · ออเดอร์",
    "admin.orders.stat.online":"จาก ontheline",
    "admin.orders.stat.direct":"จากเว็บโดยตรง",
    "admin.orders.stat.revenue":"รายได้วันนี้",
    "admin.orders.stat.revenue.month":"รายได้เดือนนี้",
    "admin.orders.stat.revenue.yesterday":"รายได้เมื่อวาน",
    "admin.orders.stat.revenue.lastMonth":"รายได้เดือนที่แล้ว",
    "admin.orders.stat.revenue.period":"รายได้ในช่วงเวลา",
    "admin.orders.h":"รายการธุรกรรมทั้งหมด",
    "admin.orders.col.ref":"เลขอ้างอิง",
    "admin.orders.col.txId":"Transaction ID",
    "admin.orders.col.customer":"ลูกค้า",
    "admin.orders.col.email":"อีเมล",
    "admin.orders.col.source":"แหล่งที่มา",
    "admin.orders.col.partnerGw":"พาร์ทเนอร์ / PayGW",
    "admin.orders.filter.partner.all":"พาร์ทเนอร์ทั้งหมด",
    "admin.orders.filter.partner.title":"กรองตามพาร์ทเนอร์ ontheline",
    "admin.orders.filter.paygw.all":"Payment Gateway ทั้งหมด",
    "admin.orders.filter.currency.all":"สกุลเงินทั้งหมด",
    "admin.orders.filter.currency.title":"กรองตามสกุลเงิน ontheline",
    "admin.orders.filter.paygw.title":"กรองตาม payment gateway ontheline",
    "admin.orders.col.package":"แพ็คเกจ",
    "admin.orders.col.amount":"จำนวนเงิน",
    "admin.orders.col.credits":"เครดิต",
    "admin.orders.col.status":"สถานะ",
    "admin.orders.col.date":"วันที่",
    "admin.orders.col.actions":"จัดการ",
    "admin.orders.view.credits.label":"เครดิตที่ได้รับ",
    "admin.orders.view.credits.note":"เครดิตที่ลูกค้ารายนี้ได้รับจากคำสั่งซื้อทั้งหมด สามารถตรวจสอบเครดิตคงเหลือและการใช้งานปัจจุบันได้ใน DM Champ Portal",
    "admin.orders.view.credits.topup":"เพิ่มเครดิต {credits} หน่วย",
    "admin.orders.view.credits.new":"สร้างบัญชีใหม่ · เพิ่ม {credits} เครดิต",
    "admin.orders.view.credits.linked":"เชื่อมโยงกับบัญชีเดิม · เพิ่มเครดิตอัตโนมัติไม่สำเร็จ ต้องเพิ่มเครดิตด้วยตัวเอง",
    "admin.orders.action.view":"ดู",
    "admin.orders.action.resend":"ส่งใหม่",
    "admin.orders.filter.all":"ทั้งหมด",
    "admin.orders.filter.online":"ontheline",
    "admin.orders.filter.direct":"เว็บตรง",
    "admin.orders.filter.chillpay":"Payment Gateway",
    "admin.orders.filter.paid":"ชำระแล้ว",
    "admin.orders.filter.pending":"รอชำระ",
    "admin.orders.filter.email.placeholder":"กรองตามอีเมลลูกค้า…",
    "admin.orders.filter.email.clear":"ล้าง",
    "admin.orders.date.today":"วันนี้",
    "admin.orders.date.yesterday":"เมื่อวาน",
    "admin.orders.date.lastMonth":"เดือนที่แล้ว",
    "admin.orders.date.month":"เดือนนี้",
    "admin.orders.date.period":"ช่วงเวลา",
    "admin.orders.date.label":"ช่วงเวลา:",
    "admin.orders.unit.orders":"ออเดอร์",
    "admin.orders.period.title-html":'เลือก<span class="grad">ช่วงเวลา</span>',
    "admin.orders.period.start":"วันเริ่มต้น",
    "admin.orders.period.end":"วันสิ้นสุด",
    "admin.orders.period.apply":"ตกลง",
    "admin.orders.period.summary":"แสดงคำสั่งซื้อตั้งแต่ {start} ถึง {end}",
    "admin.orders.export.empty":"ไม่มีคำสั่งซื้อในมุมมองปัจจุบันสำหรับส่งออก",
    "admin.orders.export.done":"ส่งออก {count} คำสั่งซื้อเป็น CSV แล้ว",
    // Admin · users
    "admin.users.title-html":'ผู้ใช้และ<span class="grad">ลูกค้า</span>',
    "admin.users.add":"เพิ่มผู้ใช้",
    "admin.users.h":"ผู้ใช้ทั้งหมด",
    "admin.users.col.name":"ชื่อ",
    "admin.users.col.email":"อีเมล",
    "admin.users.col.role":"บทบาท",
    "admin.users.col.plan":"แผน",
    "admin.users.col.credits":"เครดิต",
    "admin.users.col.created":"สร้างเมื่อ",
    "admin.users.col.status":"สถานะ",
    "admin.users.action.reset":"รีเซ็ตรหัส",
    "admin.users.action.delete":"ลบ",
    "admin.users.role.admin":"ผู้ดูแล",
    "admin.users.role.customer":"ลูกค้า",
    "admin.users.modal.title-html":'เพิ่ม<span class="grad">ผู้ใช้ใหม่</span>',
    "admin.users.modal.sub":"ผู้ใช้จะได้รับข้อมูลเข้าใช้ทางอีเมลและต้องเปลี่ยนรหัสผ่านในการเข้าใช้ครั้งแรก",
    "admin.users.modal.name":"ชื่อ-นามสกุล",
    "admin.users.modal.email":"อีเมล",
    "admin.users.modal.role":"บทบาท",
    "admin.users.modal.password":"รหัสผ่านเริ่มต้น",
    "admin.users.modal.cta":"สร้างผู้ใช้",
    // Admin · webhook
    "admin.webhook.title-html":'การเชื่อมต่อ <span class="grad">ontheline</span>',
    "admin.webhook.regen":"สร้าง Secret ใหม่",
    "admin.webhook.secret.title":"Webhook Secret",
    "admin.webhook.secret.hint":"ใช้สำหรับเซ็น request จาก ontheline ให้คัดลอกค่านี้ไปใส่ในแดชบอร์ดของ ontheline สร้างใหม่หากสงสัยว่าโดนรั่วไหล — เมื่อสร้างใหม่แล้ว ontheline จะต้องใช้ค่าใหม่ทันที",
    "admin.webhook.secret.show":"แสดง",
    "admin.webhook.secret.hide":"ซ่อน",
    "admin.webhook.secret.copy":"คัดลอก",
    "admin.webhook.secret.copied":"คัดลอก Secret แล้ว",
    "admin.webhook.secret.none":"ยังไม่มี Secret — คลิก \"สร้าง Secret ใหม่\" เพื่อสร้าง",
    "admin.webhook.secret.regenConfirm":"สร้าง Secret ใหม่หรือไม่? Secret เดิมจะใช้ไม่ได้ทันที และต้องอัปเดตใน ontheline ด้วย",
    "admin.webhook.secret.regenerated":"สร้าง Secret ใหม่แล้ว",
    "admin.webhook.flow.title":"Endpoint และขั้นตอน",
    "admin.webhook.flow.sub":"คำสั่งซื้อที่เข้ามาจะถูกจับคู่กับแพ็คเกจที่ใกล้เคียงที่สุด ส่วนต่างจะถูกแปลงเป็น Credit Purchase ผ่าน Manual Input",
    "admin.webhook.flow.s1.t":"รับข้อมูล",
    "admin.webhook.flow.s1.d":"ontheline ส่งข้อมูลลูกค้าและจำนวนเงินมาที่ endpoint ของเรา",
    "admin.webhook.flow.s2.t":"จับคู่",
    "admin.webhook.flow.s2.d":"ระบบเลือกแพ็คเกจใหญ่ที่สุดที่ราคาไม่เกินจำนวนเงินที่ชำระ",
    "admin.webhook.flow.s3.t":"ส่วนต่าง",
    "admin.webhook.flow.s3.d":"จำนวนเงินที่เหลือถูกแปลงเป็น Credit Purchase ผ่าน Manual Input",
    "admin.webhook.flow.s4.t":"เตรียมพร้อม",
    "admin.webhook.flow.s4.d":"สร้างผู้ใช้ ออกข้อมูลเข้าใช้ และเตรียมลิงก์ Portal",
    "admin.webhook.flow.s5.t":"จัดส่ง",
    "admin.webhook.flow.s5.d":"ส่งใบกำกับและใบเสร็จทางอีเมล; เก็บบันทึกใต้ Orders → ontheline",
    "admin.webhook.endpoint.title":"URL ของ Endpoint",
    "admin.webhook.test.title":"จำลอง ontheline webhook",
    "admin.webhook.test.hint":"ทดสอบระบบจับคู่ — ใส่ข้อมูลลูกค้าและจำนวนเงินที่ชำระ",
    "admin.webhook.test.fire":"ส่ง Webhook ทดสอบ",
    "admin.webhook.events.h":"Webhook events ล่าสุด",
    "admin.webhook.events.col.time":"เวลา",
    "admin.webhook.events.col.customer":"ลูกค้า",
    "admin.webhook.events.col.txId":"Transaction ID",
    "admin.webhook.events.col.amount":"จำนวนเงิน",
    "admin.webhook.events.col.partnerGw":"พาร์ทเนอร์ / PayGW",
    "admin.webhook.events.col.matched":"จับคู่ได้",
    "admin.webhook.events.col.status":"สถานะ",
    // Admin · chillpay events
    "admin.chillpay.title-html":'Payment Gateway <span class="grad">Events</span>',
    "admin.chillpay.sub":"บันทึกตรวจสอบทุกครั้งที่สร้างการชำระเงินและรับ callback จาก Payment Gateway ใช้เพื่อตรวจสอบ checksum ที่ไม่ตรง callback ที่หายไป หรือสถานะที่ไม่สอดคล้อง",
    "admin.chillpay.endpoint.title":"URL Callback (URL Background)",
    "admin.chillpay.endpoint.hint":"Callback แบบ server-to-server ตั้งค่า URL นี้ใน Payment Gateway merchant dashboard → Settings → Payment Channel → URL Background (สำหรับทุกช่องทางที่เปิดใช้งาน) นี่คือแหล่งข้อมูลหลักของสถานะการชำระเงิน",
    "admin.chillpay.result.title":"URL หน้ากลับลูกค้า (URL Result)",
    "admin.chillpay.result.hint":"การเปลี่ยนเส้นทางผ่าน browser หลังชำระเงิน ตั้งค่า URL นี้ใน Payment Gateway merchant dashboard → Settings → Payment Channel → URL Result (สำหรับทุกช่องทางที่เปิดใช้งาน) Payment Gateway จะส่ง POST browser ของลูกค้ามายัง URL นี้ และหน้านี้จะแสดงผลการชำระเงินให้ลูกค้าดู",
    "admin.chillpay.mode.label":"โหมดปัจจุบัน",
    "admin.chillpay.mode.sandbox":"Sandbox",
    "admin.chillpay.mode.production":"Production",
    "admin.chillpay.stat.total":"เหตุการณ์ทั้งหมด",
    "admin.chillpay.stat.creates":"การสร้างการชำระเงิน",
    "admin.chillpay.stat.callbacks":"Callback ที่ได้รับ",
    "admin.chillpay.stat.verified":"Callback ที่ยืนยันแล้ว",
    "admin.chillpay.events.h":"เหตุการณ์ Payment Gateway ล่าสุด",
    "admin.chillpay.col.time":"เวลา",
    "admin.chillpay.col.kind":"ประเภท",
    "admin.chillpay.col.ref":"เลขที่คำสั่งซื้อ",
    "admin.chillpay.col.orderno":"Payment Gateway OrderNo",
    "admin.chillpay.col.verified":"ยืนยัน",
    "admin.chillpay.col.status":"ผลลัพธ์",
    "admin.chillpay.col.actions":"จัดการ",
    "admin.chillpay.action.view":"รายละเอียด",
    "admin.chillpay.empty":"ยังไม่มี Payment Gateway events เมื่อลูกค้าเริ่มชำระเงินผ่าน Payment Gateway ทุก API call และ callback จะปรากฏที่นี่",
    "admin.chillpay.checksum.ok":"ยืนยันแล้ว",
    "admin.chillpay.checksum.fail":"ล้มเหลว",
    "admin.chillpay.checksum.skip":"ข้าม (โหมดทดสอบ)",
    "admin.chillpay.checkstatus":"ตรวจสอบสถานะ",
    "toast.paymentstatus.checking":"กำลังสอบถามผู้ให้บริการชำระเงิน…",
    "toast.paymentstatus.settled":"ยืนยันการชำระเงินแล้ว — {ref} เปลี่ยนเป็นจ่ายแล้ว ระบบสร้างบัญชีและส่งอีเมลใบเสร็จให้เรียบร้อย",
    "toast.paymentstatus.stillPending":"{ref}: ผู้ให้บริการยังแจ้งว่ายังไม่ได้ชำระ (สถานะ {status})",
    "toast.paymentstatus.failedPayment":"{ref}: ผู้ให้บริการแจ้งว่าการชำระเงินล้มเหลว",
    "toast.paymentstatus.failed":"ตรวจสอบสถานะไม่สำเร็จ: {error}",
    // Admin · emails
    "admin.emails.title-html":'คิว<span class="grad">อีเมล</span>',
    "admin.emails.sub":"ใบกำกับ ใบเสร็จ และข้อมูลเข้าใช้ที่กำลังจะส่งออก รายการจะรอจนกว่า Cloud Function จะส่ง",
    "admin.emails.col.time":"เข้าคิวเมื่อ",
    "admin.emails.col.to":"ส่งถึง",
    "admin.emails.col.subject":"หัวข้อ",
    "admin.emails.col.kind":"ประเภท",
    "admin.emails.col.status":"สถานะ",
    "admin.emails.action.view":"ดู",
    "admin.emails.status.supportOnly":"เฉพาะ support",
    "admin.emails.status.supportOnly.title":"อีเมล ontheline — ส่งเข้ากล่อง support เท่านั้น ลูกค้าไม่ได้รับอีเมล",
    "admin.emails.status.supportOnly.note":"นี่คืออีเมลจาก ontheline ส่งเข้ากล่อง support เท่านั้น — ลูกค้าไม่ได้รับ (ontheline จัดการการสื่อสารกับลูกค้าเอง)",
    "admin.emails.action.resend":"ส่งใหม่",
    "admin.emails.kind.invoice":"ใบกำกับ",
    "admin.emails.kind.receipt":"ใบเสร็จ",
    "admin.emails.kind.credentials":"ข้อมูลเข้าใช้",
    // Admin · languages
    "admin.langs.title-html":'จัดการ<span class="grad">ภาษา</span>',
    "admin.langs.add":"เพิ่มภาษา",
    "admin.langs.master":"ภาษาอังกฤษ (หลัก)",
    "admin.langs.locked":"ล็อกอยู่จนกว่าจะแปล ≥ 90%",
    "admin.langs.live":"เปิดให้ผู้ใช้แล้ว",
    "admin.langs.continue":"จัดการการแปล",
    "admin.langs.toggle.label":"แสดงให้ผู้ใช้",
    "admin.langs.toggle.on":"เปิด",
    "admin.langs.toggle.off":"ปิด",
    "admin.langs.toggle.alwaysOn":"ภาษาอังกฤษเปิดเสมอเป็นภาษาสำรอง",
    "admin.langs.toggle.clickToEnable":"คลิกเพื่อแสดงภาษานี้ให้ผู้ใช้เลือก",
    "admin.langs.toggle.clickToDisable":"คลิกเพื่อซ่อนภาษานี้จากผู้ใช้",
    "admin.langs.autosave.hint":"การแก้ไขจะถูกบันทึกอัตโนมัติเมื่อคุณออกจากช่อง การเปลี่ยนแปลงจะมีผลทันทีสำหรับผู้ใช้",
    "admin.langs.translate-table.h":"แปลข้อความ",
    "admin.langs.translate-table.lang":"ภาษาเป้าหมาย",
    "admin.langs.translate-table.search":"ค้นหา key หรือข้อความ",
    "admin.langs.translate-table.col.key":"Key",
    "admin.langs.translate-table.col.source":"ภาษาอังกฤษ (ต้นฉบับ)",
    "admin.langs.translate-table.empty":"— ยังไม่ได้แปล —",
    // Admin · packages
    "admin.packages.title-html":'จัดการ<span class="grad">แพ็คเกจ</span>',
    "admin.packages.add":"เพิ่มแพ็คเกจ",
    "admin.packages.bucket.credit":"ซื้อเครดิต (Credit Purchase)",
    "admin.packages.bucket.onetime":"เข้าใช้ครั้งเดียว (1-Time Access)",
    "admin.packages.bucket.sub":"สมาชิก (Subscription)",
    "admin.packages.col.order":"ลำดับ",
    "admin.packages.col.id":"ID",
    "admin.packages.col.title":"ชื่อ",
    "admin.packages.col.desc":"คำอธิบาย",
    "admin.packages.col.price":"ราคา",
    "admin.packages.col.featured":"แนะนำ",
    "admin.packages.col.duration":"ระยะเวลา (วัน)",
    "admin.packages.col.actions":"จัดการ",
    "admin.packages.action.edit":"แก้ไข",
    "admin.packages.action.delete":"ลบ",
    "admin.packages.intro":"เพิ่ม แก้ไข และลบแพ็คเกจในทั้ง 3 หมวด การเปลี่ยนแปลงจะสะท้อนในหน้าแพ็คเกจของลูกค้าแบบเรียลไทม์",
    // Admin · password
    "admin.password.title-html":'เปลี่ยน<span class="grad">รหัสผ่าน</span>',
    "admin.password.current":"รหัสผ่านปัจจุบัน",
    "admin.password.new":"รหัสผ่านใหม่",
    "admin.password.confirm":"ยืนยันรหัสผ่านใหม่",
    "admin.password.cta":"อัปเดตรหัสผ่าน",
    // Login modal
    "login.title-html":'<span class="grad">เข้าสู่ระบบ</span>',
    "login.sub":"เข้าสู่บัญชี {brand} ของคุณ",
    "login.email":"อีเมล",
    "login.password":"รหัสผ่าน",
    "login.cta":"เข้าสู่ระบบ",
    // Toast messages
    "toast.login.ok":"ยินดีต้อนรับกลับมา {name}",
    "toast.login.fail":"อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "toast.order.created":"สร้างคำสั่งซื้อแล้ว · ส่งใบกำกับเข้าคิว",
    "toast.user.created":"สร้างผู้ใช้แล้ว · ส่งรหัสผ่านทางอีเมล",
    "toast.user.deleted":"ลบผู้ใช้แล้ว",
    "toast.email.queued":"จัดคิวอีเมลสำหรับการส่งแล้ว",
    "toast.password.updated":"อัปเดตรหัสผ่านแล้ว",
    "toast.password.wrong":"รหัสผ่านปัจจุบันไม่ถูกต้อง",
    "toast.password.mismatch":"รหัสผ่านใหม่ไม่ตรงกัน",
    "toast.translation.saved":"บันทึกการแปลแล้ว",
    "toast.webhook.fired":"ประมวลผล Webhook · order #{ref}",
    "toast.webhook.firedEvent":"ประมวลผล Webhook · {event} · order #{ref}",
    "toast.webhook.badPartner":"ไม่รู้จักรหัสพาร์ทเนอร์: {code} — เพิ่มใน ontheline Partners ก่อน",
    "toast.webhook.badPaygw":"ไม่รู้จักรหัส paygw: {code} — เพิ่มใน ontheline Payment Gateways ก่อน",
    "toast.webhook.badCurrency":"ไม่รู้จักสกุลเงิน: {code} — เพิ่มใน ontheline Currencies ก่อน",
    "toast.webhook.dupEvent":"transaction นี้เป็น \"{event}\" อยู่แล้ว — ข้าม event ซ้ำ",
    "toast.webhook.needPaidFirst":"\"{event}\" ต้องมี transaction ที่ Paid อยู่ก่อน ยิง Paid ด้วย Transaction ID นี้ก่อน",
    "toast.webhook.fromPaid":"จาก Paid เปลี่ยนได้แค่ Unpaid, Refund หรือ Partial Refund เท่านั้น (ไม่ใช่ \"{event}\")",
    "toast.webhook.finalState":"\"{state}\" เป็นสถานะสุดท้าย — transaction นี้เปลี่ยนไม่ได้แล้ว",
    "toast.webhook.fromFail":"จาก Fail เปลี่ยนได้แค่ Paid เท่านั้น (ไม่ใช่ \"{event}\")",
    "toast.webhook.refundTooBig":"ยอด Partial Refund ต้องน้อยกว่ายอดที่จ่าย (${paid})",
    "toast.webhook.reversed":"ประมวลผล {event} · หัก {deducted} เครดิต · เหลือ {remaining}",
    "admin.webhook.test.txid.ph":"เว้นว่างเพื่อสุ่มอัตโนมัติ",
    "admin.webhook.test.txid.hint":"ใช้ Transaction ID เดิมซ้ำเพื่อทดสอบ flow ของ event (เช่น ยิง Paid แล้วยิง Refund ด้วย ID เดิม) เว้นว่างเพื่อเริ่ม transaction ใหม่",
    "toast.chillpay.redirecting":"กำลังเปลี่ยนเส้นทางไปยัง Payment Gateway…",
    "toast.chillpay.failed":"ไม่สามารถเริ่มการชำระเงิน: {error}",
    "toast.chillpay.status.refreshed":"รีเฟรชสถานะคำสั่งซื้อแล้ว",
    "toast.packages.added":"เพิ่มแพ็คเกจใหม่ {n} รายการ",
    "toast.packages.edited":"อัปเดตแพ็คเกจ {n} รายการ",
    "toast.packages.removed":"ลบแพ็คเกจ {n} รายการ",
    "toast.checkout.price.updated":"ราคาของแพ็คเกจที่เลือกมีการอัปเดต — โปรดตรวจสอบก่อนดำเนินการต่อ",
    "toast.checkout.package.removed":"แพ็คเกจนี้ไม่มีให้บริการแล้ว — โปรดเลือกใหม่",
    // Customer portal — added in Phase 2
    "admin.orders.col.expires":"หมดอายุ",
    "admin.orders.expires.never":"—",
    "admin.orders.expires.daysLeft":"เหลือ {n} วัน",
    "admin.orders.expires.expired":"หมดอายุแล้ว",
    "admin.users.col.activePackage":"แพ็คเกจปัจจุบัน",
    "admin.users.activePackage.none":"—",
    "admin.users.activePackage.expiringSoon":"จะหมดอายุใน {n} วัน",
    "admin.packages.modal.duration":"ระยะเวลา (วัน)",
    "admin.packages.modal.duration.hint":"จำนวนวันที่ลูกค้าสามารถใช้แพ็คเกจนี้ ปล่อยว่างสำหรับแพ็คเกจเครดิตที่ไม่มีกำหนดอายุ",
    "admin.packages.duration.none":"ไม่มีกำหนดอายุ",
    "admin.packages.duration.days":"{n} วัน",
    // Misc
    "footer.tag":"AI ตัวแทนขายที่ปิดการขายให้คุณ 24/7"
  },

  ko: {
    // Navigation
    "nav.home":"홈",
    "nav.packages":"패키지",
    "nav.admin":"관리자 콘솔",
    "nav.login":"로그인",
    "nav.signout":"로그아웃",
    // Drawer
    "drawer.title":"메뉴",
    "drawer.lang":"언어",
    "drawer.account":"계정",
    // Hero
    "hero.eyebrow":"AI 영업 에이전트 · 실시간 네트워크",
    "hero.title-html":'잠자는 동안에도<br/><span class="grad">판매하세요.</span><br/><span class="outline">정말로.</span>',
    "hero.lede":"{brand}는 WhatsApp, Instagram, Messenger 및 귀하의 웹사이트에서 잠재 고객을 검증하고 반대 의견을 처리하며 미팅을 예약하고 거래를 성사시키는 자율 AI 영업 에이전트입니다 — 24시간, 4개 언어 지원.",
    "hero.cta-primary":"패키지 둘러보기",
    "hero.cta-secondary":"관리자 콘솔 열기",
    "hero.cta-admin":"관리자 콘솔 열기",
    "hero.cta-account":"내 계정으로 이동",
    "hero.cta-signin":"로그인",
    // Capabilities
    "caps.num":"01 / 주요 기능",
    "caps.title-html":'챗봇이 아닙니다. <span class="grad">클로저입니다.</span>',
    "caps.lede":"URL만 입력하세요. 에이전트가 제품, 가격 및 가치 제안을 읽고 15분 안에 판매를 시작합니다. 코드도, 프롬프트도 필요 없습니다.",
    "cap.01.t":"진짜 인간 같은",
    "cap.01.d":"음성 메모, 이미지, 비디오 및 PDF로 대화 가능. 최고의 클로저처럼 들립니다.",
    "cap.02.t":"멀티 채널",
    "cap.02.d":"WhatsApp · Instagram · Messenger · 웹 채팅 — 모든 채널에서 하나의 메모리.",
    "cap.03.t":"15분 설치",
    "cap.03.d":"웹사이트 URL을 붙여넣으세요. AI가 제품과 가격을 자동으로 읽습니다. 코드도 프롬프트도 없이.",
    "cap.04.t":"멀티모달",
    "cap.04.d":"음성 메모, 이미지, 문서/PDF 및 비디오 이해 — 텍스트뿐만 아니라.",
    "cap.05.t":"채팅 내 예약",
    "cap.05.d":"구매 신호를 감지하고 대화 내에서 약속을 예약합니다. 외부 링크 없이.",
    "cap.06.t":"메모리 & 컨텍스트",
    "cap.06.d":"이전 대화와 선호도를 기억하여 장기적인 관계를 구축합니다.",
    "cap.07.t":"캠페인 & 후속 조치",
    "cap.07.d":"아웃바운드 메시징, 자동 후속 조치, IG 및 Facebook에서 Comment-to-DM.",
    "cap.08.t":"자기 개선",
    "cap.08.d":"원클릭 최적화로 가장 잘 성사된 대화를 분석하여 전환율을 향상시킵니다.",
    // Packages
    "pkg.num":"02 / 가격",
    "pkg.title-html":'시작하는 <span class="grad">세 가지 방법</span>',
    "pkg.lede":"사용한 만큼 지불하는 크레딧, 일일 무제한 액세스 또는 롤링 구독. 모든 플랜은 이메일로 즉시 자격 증명과 함께 제공됩니다.",
    "pkg.tab.credit":"크레딧 구매",
    "pkg.tab.onetime":"1회 액세스",
    "pkg.tab.sub":"구독",
    "pkg.sub.note":"구독의 크레딧은 각 주기 종료 시 만료됩니다. 크레딧이 고갈된 후 주기 중에 계속하려면 크레딧 구매 충전을 추가하세요.",
    "pkg.select":"선택",
    "pkg.subscribe":"구독하기",
    "pkg.configure":"구성하기",
    "pkg.featured":"가장 인기",
    "pkg.manual.title":"수동 입력",
    "pkg.manual.desc":"원하는 금액을 입력하세요 — 충전 및 ontheline 차액에 사용됩니다.",
    "pkg.manual.label":"금액 입력 (USD)",
    // Credit Purchase packages
    "pkg.credit.5.t":"스타터",
    "pkg.credit.5.d":"평가판 및 소규모 캠페인을 위한 가벼운 크레딧 충전.",
    "pkg.credit.10.t":"에센셜",
    "pkg.credit.10.d":"중간 정도 활동의 1주일 사용에 충분한 크레딧.",
    "pkg.credit.20.t":"스튜디오",
    "pkg.credit.20.d":"솔로 운영자와 컨설턴트를 위한 최적의 선택.",
    "pkg.credit.50.t":"아틀리에",
    "pkg.credit.50.d":"동시 캠페인을 운영하는 소규모 팀을 위해.",
    "pkg.credit.100.t":"하우스",
    "pkg.credit.100.d":"에이전시 및 대용량 판매자를 위한 파워 티어.",
    // 1-Time Access
    "pkg.onetime.3d.t":"3일",
    "pkg.onetime.3d.d":"72시간 동안 무제한 크레딧.",
    "pkg.onetime.7d.t":"7일",
    "pkg.onetime.7d.d":"무제한 액세스의 일주일.",
    "pkg.onetime.14d.t":"14일",
    "pkg.onetime.14d.d":"무제한 활동의 2주.",
    "pkg.onetime.1m.t":"1개월",
    "pkg.onetime.1m.d":"월간 캠페인 주기에 가장 적합.",
    "pkg.onetime.3m.t":"3개월",
    "pkg.onetime.3m.d":"분기별 액세스 — 대부분의 에이전시가 선택.",
    "pkg.onetime.6m.t":"6개월",
    "pkg.onetime.6m.d":"우선 지원이 포함된 반년 약정.",
    "pkg.onetime.12m.t":"12개월",
    "pkg.onetime.12m.d":"연간 액세스 — 주력 플랜.",
    "pkg.onetime.24m.t":"24개월",
    "pkg.onetime.24m.d":"2년 사용 기간 — 일일 최고 가치.",
    // Subscription
    "pkg.sub.1m.t":"1개월",
    "pkg.sub.1m.d":"월간 갱신. 언제든지 취소.",
    "pkg.sub.3m.t":"3개월",
    "pkg.sub.3m.d":"분기별 — 가장 인기 있는 등급.",
    "pkg.sub.6m.t":"6개월",
    "pkg.sub.6m.d":"우선 큐가 포함된 반년 약정.",
    "pkg.sub.12m.t":"12개월",
    "pkg.sub.12m.d":"연간 구독 — 권장.",
    "pkg.sub.24m.t":"24개월",
    "pkg.sub.24m.d":"고정 가격의 2년 약정.",
    // Checkout
    "checkout.num":"03 / 결제",
    "checkout.title-html":'거의 <span class="grad">완료입니다.</span>',
    "checkout.section.customer":"고객 정보",
    "checkout.section.payment":"결제 방법",
    "checkout.section.delivery":"영수증 배송",
    "checkout.field.name":"성명",
    "checkout.field.email":"이메일",
    "checkout.field.company":"회사",
    "checkout.field.country":"국가",
    "checkout.field.taxid":"사업자등록번호",
    "checkout.field.optional":"선택",
    "checkout.field.taxid.hint":"세금계산서 발행용 · 태국 법인: 13자리 납세자번호",
    "checkout.ph.name":"예: Soraya Kanchanaporn",
    "checkout.ph.email":"예: soraya@studiokanchana.com",
    "checkout.ph.company":"예: Studio Kanchana",
    "checkout.ph.taxid":"예: 0105564016423",
    "checkout.terms.intro-html":"결제 전 <a class=\"terms-link\" onclick=\"App.openTermsModal()\">서비스 약관 및 개인정보 처리방침</a>을 확인해 주세요.",
    "checkout.terms.consent":"본인은 비즈니스 용도로 구매하며, 서비스 약관 및 개인정보 처리방침을 읽고 동의합니다. 충전한 크레딧은 구매 후 24시간이 지나면 자동으로 만료되며 환불이 불가함을 이해합니다.",
    "toast.checkout.needName":"이름을 입력해 주세요",
    "toast.checkout.needEmail":"이메일을 입력해 주세요",
    "toast.checkout.badEmail":"올바른 이메일 주소를 입력해 주세요",
    "toast.checkout.needTerms":"결제 전 서비스 약관을 읽고 동의해 주세요",
    "about.eyebrow":"ONTHELINE 및 DealMai 소개",
    "about.heading-html":"모든 문의가 <em>성장 기회</em>가 됩니다.",
    "about.teaser-html":"<strong>ONTHELINE</strong>은 기존 챗봇과 늦은 응답 때문에 기업이 매일 소중한 리드를 놓치고 있다는 점에 주목했습니다. 그래서 24시간 AI 기반 응대로 이 격차를 메우는 <strong>DealMai</strong>를 만들었습니다. WhatsApp, Instagram, LINE 등 주요 메시징 채널에서 사람처럼 자연스러운 대화로 잠재 고객을 선별하고, 예약을 잡고, 휴면 고객을 다시 활성화합니다 — 브랜드 고유의 목소리 그대로. 글로벌 ONTHELINE 네트워크(태국·일본·한국)의 일원으로서, 우리는 모든 문의를 멈춤 없는 성장 기회로 바꿉니다.",
    "about.readmore":"우리 이야기 보기",
    "about.modal.kicker":"회사 소개",
    "about.modal.title":"ONTHELINE & DealMai",
    "about.modal.sub":"글로벌 리드 응대의 격차를 메우다 · 태국 · 일본 · 한국",
    "terms.modal.kicker":"법적 고지",
    "terms.modal.title":"서비스 약관 및 개인정보 처리방침",
    "terms.modal.sub":"DealMai 마스터 서비스 약관 및 플랫폼 계약 · 2026년 7월 31일 시행",
    "doc.close":"닫기",
    "checkout.field.card":"카드 번호",
    "checkout.field.expiry":"유효기간",
    "checkout.field.cvc":"CVC",
    "checkout.field.via":"영수증 전송 방법",
    "checkout.field.lang":"영수증 언어",
    "checkout.payment.intro":"Payment Gateway의 보안 결제 페이지로 이동됩니다.",
    "checkout.channel.any":"다음 단계에서 선택",
    "checkout.channel.card":"신용 / 직불 카드",
    "checkout.channel.qr":"QR PromptPay",
    "checkout.channel.mobile":"모바일 뱅킹",
    "checkout.channel.ewallet":"전자 지갑",
    "checkout.summary.title":"주문 요약",
    "checkout.summary.package":"패키지",
    "checkout.summary.activation":"활성화",
    "checkout.summary.activation-val":"즉시",
    "checkout.summary.subtotal":"소계",
    "checkout.summary.vat":"VAT 7%",
    "checkout.summary.total":"결제 총액",
    "checkout.summary.cta":"확인 및 결제",
    "checkout.summary.secure":"256비트 · PCI DSS · 암호화",
    "checkout.summary.redirecting":"Payment Gateway로 이동 중…",
    "checkout.summary.powered":"Payment Gateway 제공 · 태국 PSP",
    // Payment Result
    "result.pending.title-html":'결제 <span class="grad">처리 중.</span>',
    "result.pending.sub":"결제가 처리되고 있습니다. Payment Gateway 확인 후 {email}로 확인 이메일이 전송됩니다. 보통 1분 이내에 완료됩니다.",
    "result.success.title-html":'결제 <span class="grad">확인 완료.</span>',
    "result.success.sub":"감사합니다. 영수증과 자격 증명이 {email}로 발송되고 있습니다. 온보딩은 5분 이내에 완료됩니다.",
    "result.failed.title-html":'결제가 <span class="grad">완료되지 않았습니다.</span>',
    "result.failed.sub":"결제가 취소되었거나 거부되었습니다. 청구된 금액은 없습니다. 다시 시도하거나 다른 방법을 선택할 수 있습니다.",
    "result.notfound.title-html":'주문을 <span class="grad">찾을 수 없습니다.</span>',
    "result.notfound.sub":"이 주문을 찾을 수 없습니다. 방금 결제하셨다면 잠시만 기다려 주세요. 확인이 아직 전송 중일 수 있습니다.",
    "result.ref":"주문 번호",
    "result.amount":"금액",
    "result.method":"결제 방법",
    "result.status":"상태",
    "result.cta-retry":"다시 시도",
    "result.cta-back":"패키지로 돌아가기",
    "result.cta-home":"홈으로",
    // Confirmation
    "confirm.title-html":'환영합니다, <span class="grad">{name}님.</span>',
    "confirm.sub":"AI 에이전트가 준비되고 있습니다. 자격 증명과 영수증이 {email}로 발송되었습니다. 온보딩은 5분 이내에 완료됩니다.",
    "confirm.ref":"주문 번호",
    "confirm.package":"패키지",
    "confirm.amount":"청구 금액",
    "confirm.portal":"포털 링크",
    "confirm.invoice":"인보이스 / 영수증",
    "confirm.invoice-val":"PDF · 이메일로 전송",
    "confirm.cta-portal":"포털 열기",
    "confirm.cta-back":"패키지로 돌아가기",
    // Admin · sidebar
    "admin.side.console":"콘솔",
    "admin.side.orders":"주문",
    "admin.side.users":"사용자",
    "admin.side.packages":"패키지",
    "admin.side.webhook":"ontheline 웹훅",
    "admin.side.partners":"ontheline 파트너",
    "admin.side.paygw":"ontheline 결제 게이트웨이",
    "admin.side.currencies":"ontheline 통화",
    "admin.currencies.title":"ontheline 통화",
    "admin.currencies.sub":"ontheline이 웹훅 <code>currency</code> 필드에 보낼 수 있는 통화 코드를 관리합니다. 일치하지 않는 통화의 웹훅은 거부됩니다. 기호는 주문에서 금액 옆에 표시되며 USD 값(크레딧 계산용)은 실시간 환율로 변환됩니다.",
    "admin.currencies.add":"통화 추가",
    "admin.currencies.empty":"통화가 없습니다. 추가하세요(예: USD $).",
    "admin.currencies.add.title":"통화 추가",
    "admin.currencies.edit.title":"통화 편집",
    "admin.currencies.col.code":"코드 (ISO 4217)",
    "admin.currencies.col.symbol":"기호",
    "admin.currencies.col.label":"이름",
    "admin.currencies.code.ph":"예: USD, THB, JPY, KRW",
    "admin.currencies.symbol.ph":"예: $, ฿, ¥, ₩",
    "admin.currencies.label.ph":"예: 미국 달러",
    "admin.currencies.hint":"코드는 웹훅 통화 값과 대소문자 구분 없이 일치하며 USD 변환에 사용됩니다. 환율 API가 인식하도록 표준 3자리 ISO 4217 코드를 사용하세요.",
    "admin.partners.title":"ontheline 파트너",
    "admin.partners.sub":"ontheline이 웹훅 호출에서 보낼 수 있는 파트너 코드를 관리합니다. 들어오는 웹훅의 <code>partner</code> 값이 이 코드 중 하나와 일치하지 않으면 거부됩니다.",
    "admin.partners.add":"파트너 추가",
    "admin.partners.empty":"파트너가 없습니다. 파트너 코드로 ontheline 웹훅을 수락하려면 추가하세요.",
    "admin.partners.add.title":"파트너 추가",
    "admin.partners.edit.title":"파트너 편집",
    "admin.paygw.title":"ontheline 결제 게이트웨이",
    "admin.paygw.sub":"ontheline이 웹훅 호출에서 보낼 수 있는 결제 게이트웨이 코드를 관리합니다. 들어오는 웹훅의 <code>paygw</code> 값이 이 코드 중 하나와 일치하지 않으면 거부됩니다.",
    "admin.paygw.add":"결제 게이트웨이 추가",
    "admin.paygw.empty":"결제 게이트웨이가 없습니다. paygw 코드로 ontheline 웹훅을 수락하려면 추가하세요.",
    "admin.paygw.add.title":"결제 게이트웨이 추가",
    "admin.paygw.edit.title":"결제 게이트웨이 편집",
    "admin.codelist.col.code":"코드",
    "admin.codelist.col.company":"회사명",
    "admin.codelist.col.actions":"작업",
    "admin.codelist.edit":"편집",
    "admin.codelist.delete":"삭제",
    "admin.codelist.save":"저장",
    "admin.codelist.code.ph":"예: PARTNER01",
    "admin.codelist.company.ph":"예: Acme Travel Co., Ltd.",
    "admin.codelist.code.hint":"코드는 웹훅 값과 정확히(대소문자 구분 없이) 일치해야 합니다. 회사명은 참고용이며 주문에 표시됩니다.",
    "admin.side.chillpay":"Payment Gateway 이벤트",
    "admin.side.paymentgw":"결제 게이트웨이",
    "admin.paymentgw.crumbs":"콘솔 / 결제 게이트웨이",
    "admin.paymentgw.title-html":"결제 <span class=\"grad\">게이트웨이</span>",
    "admin.paymentgw.sub":"새로운 직접(웹) 결제를 처리할 제공업체를 선택하세요. 이미 진행 중인 주문은 생성 당시의 게이트웨이를 그대로 사용합니다.",
    "admin.paymentgw.note-html":"자격 증명은 Netlify 환경 변수에만 저장되며 데이터베이스에는 저장되지 않습니다. 이 페이지는 <em>어떤</em> 게이트웨이를 사용할지만 기록합니다. 먼저 Netlify에 키를 설정한 뒤 여기서 활성화하세요.",
    "admin.paymentgw.note.default":"아직 선택이 저장되지 않아 기본 게이트웨이가 사용됩니다. 아래에서 선택하면 명시적으로 지정됩니다.",
    "admin.paymentgw.state.ready":"설정 완료, 사용 준비됨.",
    "admin.paymentgw.state.missing":"설정 미완료. 누락된 환경 변수: {list}",
    "admin.paymentgw.badge.active":"사용 중",
    "admin.paymentgw.btn.use":"이 게이트웨이 사용",
    "admin.paymentgw.btn.inuse":"사용 중",
    "admin.paymentgw.btn.needenv":"먼저 Netlify에서 이 게이트웨이의 환경 변수를 설정하세요",
    "admin.paymentgw.btn.copy":"복사",
    "admin.paymentgw.lbl.channels":"결제 채널",
    "admin.paymentgw.lbl.callback":"콜백 URL — 제공업체 대시보드에 등록하세요",
    "admin.paymentgw.hint.callback":"서버 간 호출이며 결제 상태의 신뢰할 수 있는 정보 소스입니다. 활성화된 모든 채널의 URL Background / 웹훅으로 등록하세요.",
    "admin.paymentgw.lbl.returnurl":"반환 URL (URL Result) — 함께 등록하세요",
    "admin.paymentgw.hint.returnurl":"결제 후 고객의 브라우저가 도착하는 페이지입니다. 자체 페이지이므로 모든 게이트웨이에서 동일합니다.",
    "admin.paymentgw.lbl.env":"환경 변수",
    "admin.paymentgw.empty":"등록된 결제 게이트웨이가 없습니다.",
    "admin.paymentgw.err.diag":"결제 함수에 연결할 수 없습니다. 사이트를 배포한 뒤 이 페이지를 새로고침하세요.",
    "toast.paymentgw.unknown":"등록되지 않은 게이트웨이입니다",
    "toast.paymentgw.needenv":"환경 변수를 먼저 설정하세요 — 누락: {list}",
    "toast.paymentgw.confirm":"모든 신규 결제를 {name}(으)로 처리할까요?\n\n진행 중인 주문은 영향을 받지 않으며, 각각 시작한 게이트웨이로 완료됩니다.",
    "toast.paymentgw.saved":"이제 신규 결제는 {name}(으)로 처리됩니다",
    "toast.paymentgw.failed":"저장하지 못했습니다: {error}",
    "admin.side.emails":"이메일 대기열",
    "admin.side.languages":"언어",
    "admin.side.branding":"브랜딩",
    "admin.side.dmchamp":"DM Champ",
    "admin.side.account":"계정",
    "admin.side.password":"비밀번호 변경",
    "admin.side.signout":"로그아웃",
    // Admin · branding
    "admin.branding.crumbs":"콘솔 / 브랜딩",
    "admin.branding.title-html":'사이트 <span class="grad">브랜딩</span>',
    "admin.branding.sub":"사이트 이름과 로고를 변경하세요. 업데이트는 헤더, 푸터, 브라우저 탭 및 고객 페이지를 포함한 앱 전체에 즉시 적용되며 새로 고침이 필요하지 않습니다.",
    "admin.branding.name.title":"사이트 이름",
    "admin.branding.name.hint":"공개 사이트, 관리자 콘솔, 푸터 및 브라우저 탭의 모든 \"Deal Pro\" 인스턴스를 대체합니다. 최대 60자.",
    "admin.branding.name.save":"이름 저장",
    "admin.branding.name.reset":"재설정",
    "admin.branding.name.reset.title":"\"Deal Pro\"로 재설정",
    "admin.branding.name.preview":"미리보기:",
    "admin.branding.logo.title":"로고 이미지",
    "admin.branding.logo.hint":"사이트 헤더에 표시할 사용자 정의 로고를 업로드하세요. 권장: 투명 PNG, ~300×100 픽셀. 최대 500 KB.",
    "admin.branding.logo.upload":"로고 업로드",
    "admin.branding.logo.reset":"재설정",
    "admin.branding.logo.reset.title":"기본 로고로 재설정",
    "admin.branding.logo.limits":"지원: PNG, JPEG, SVG, WebP · 최대 500 KB",
    "admin.branding.favicon.title":"브라우저 탭 아이콘 (파비콘)",
    "admin.branding.favicon.hint":"브라우저 탭에서 사이트 이름 옆에 표시되는 작은 아이콘입니다. 정사각형 이미지(최소 32×32px)를 사용하세요. 투명 PNG 또는 SVG가 가장 좋습니다. 모든 방문자의 브라우저 탭에 실시간으로 적용됩니다.",
    "admin.branding.favicon.preview":"탭 미리보기",
    "admin.branding.favicon.upload":"파비콘 업로드",
    "admin.branding.favicon.reset":"재설정",
    "admin.branding.favicon.reset.title":"사용자 지정 파비콘을 제거하고 기본 아이콘 사용",
    "admin.branding.favicon.using.custom":"업로드한 사용자 지정 파비콘 표시 중",
    "admin.branding.favicon.using.default":"기본 브라우저 탭 아이콘 사용 중",
    "admin.branding.favicon.limits":"지원: PNG, ICO, SVG, WebP · 정사각형 · 최대 100 KB",
    "admin.branding.logo.using.default":"기본 로고 표시 중",
    "admin.branding.logo.using.custom":"사용자 정의 로고 표시 중",
    "admin.branding.lastUpdated":"마지막 업데이트: {date} ({by})",

    // Admin · DM Champ integration
    "admin.dmchamp.crumbs":"콘솔 / 통합",
    "admin.dmchamp.title-html":'DM Champ <span class="grad">통합</span>',
    "admin.dmchamp.sub":"결제하는 모든 고객을 위해 DM Champ AI 워크스페이스를 자동 프로비저닝합니다. DM Champ 에이전시 등급이 필요합니다.",
    "admin.dmchamp.status.configured":"연결됨 · API 키 등록됨",
    "admin.dmchamp.status.missing":"연결되지 않음 · 아래에 API 키 입력",
    "admin.dmchamp.status.disabled":"통합 비활성화 · 자동 프로비저닝을 켜려면 토글",
    "admin.dmchamp.apiKey":"DM Champ API 키",
    "admin.dmchamp.apiKey.hint":"DM Champ → 설정 → API Access에서 찾을 수 있습니다. Firestore에 안전하게 저장됩니다. 저장 후에는 다시 표시되지 않습니다.",
    "admin.dmchamp.apiKey.placeholder":"API 키 붙여넣기…",
    "admin.dmchamp.apiKey.masked":"현재 키: {masked} — 새 키를 붙여넣어 교체",
    "admin.dmchamp.enabled":"자동 프로비저닝 활성화",
    "admin.dmchamp.enabled.hint":"활성화 시 모든 성공한 결제마다 자동으로 DM Champ 하위 계정이 생성됩니다.",
    "admin.dmchamp.creditsPerUsd":"USD당 크레딧",
    "admin.dmchamp.creditsPerUsd.hint":"고객이 지불한 각 USD를 DM Champ 크레딧으로 변환하는 비율. 예: 100은 $5 → 500크레딧을 의미합니다.",
    "admin.dmchamp.defaultCredits":"기본 월간 크레딧",
    "admin.dmchamp.defaultCredits.hint":"주문 금액을 변환할 수 없을 때 사용됩니다 (드물게). 안전한 최소값 역할.",
    "admin.dmchamp.rollover":"미사용 크레딧 이월",
    "admin.dmchamp.rollover.hint":"활성화 시 미사용 크레딧이 다음 달로 이월됩니다. 비활성화 시 매월 재설정됩니다.",
    "admin.dmchamp.timezone":"기본 시간대",
    "admin.dmchamp.country":"기본 국가 (ISO-2)",
    "admin.dmchamp.portalUrl":"포털 URL",
    "admin.dmchamp.openPortal":"DM Champ 포털 열기",
    "admin.dmchamp.portalUrl.hint":"이메일과 고객 포털 버튼에 표시되는 DM Champ 로그인 URL입니다. 기본값으로 https://app.dmchamp.com을 사용하거나, White-Label 사용자 정의 도메인(예: https://app.dealmai.com)을 입력하여 고객이 귀하의 브랜드를 볼 수 있도록 하세요.",
    "admin.dmchamp.save":"설정 저장",
    "admin.dmchamp.test":"API 연결 테스트",
    "admin.dmchamp.preview":"변환 미리보기",
    "admin.dmchamp.preview.row":"${usd} → {credits} 크레딧",

    // DM Champ toasts
    "toast.dmchamp.saved":"DM Champ 설정이 저장되었습니다",
    "toast.dmchamp.saveFail":"DM Champ 설정을 저장할 수 없습니다: {error}",
    "toast.dmchamp.provisioning":"DM Champ 하위 계정을 프로비저닝 중…",
    "toast.dmchamp.provisioned":"{email}에 대한 DM Champ 하위 계정이 생성되었습니다",
    "toast.dmchamp.alreadyProvisioned":"이미 프로비저닝됨 — 변경 사항 없음",
    "toast.dmchamp.linked":"기존 DM Champ 계정이 이 주문과 연결되었습니다 ({email})",
    "toast.dmchamp.provisionFail":"DM Champ 프로비저닝 실패: {error}",

    // Customer portal · DM Champ workspace card
    "account.dmchamp.title":"Ai Portal 워크스페이스",
    "account.dmchamp.intro":"AI 영업 에이전트 워크스페이스입니다.",
    "account.dmchamp.email":"이메일",
    "account.dmchamp.uid":"계정 ID",
    "account.dmchamp.credits":"월간 크레딧",
    "account.dmchamp.tempPassword":"임시 비밀번호",
    "account.dmchamp.tempPasswordHint":"첫 로그인 시 변경해 주세요.",
    "account.dmchamp.open":"Ai Portal 열기",
    "account.dmchamp.pending":"Ai Portal 워크스페이스를 준비 중입니다. 곧 자격 증명을 이메일로 보내드리겠습니다.",
    "account.dmchamp.failed":"Ai Portal 워크스페이스를 만들 수 없습니다. 지원팀에 문의하시면 수동으로 설정해 드립니다.",
    "account.dmchamp.linked":"기존 Ai Portal 계정이 이번 구매와 연결되었습니다. 아래의 기존 로그인 자격 증명을 사용하세요.",
    "account.dmchamp.toppedUp":"이번 구매의 크레딧이 Ai Portal 계정에 추가되었습니다. 아래의 기존 자격 증명으로 로그인하세요.",

    // Order View modal · DM Champ section
    "admin.orders.view.dmchamp":"DM Champ 하위 계정",
    "admin.orders.view.ontheline":"ontheline 파트너 / 결제 게이트웨이",
    "admin.orders.view.partner":"파트너",
    "admin.orders.view.paygw":"결제 게이트웨이",
    "admin.orders.view.event":"이벤트",
    "admin.orders.view.amount":"금액",
    "admin.orders.view.dmchamp.notProvisioned":"아직 프로비저닝되지 않음",
    "admin.orders.view.dmchamp.provision":"DM Champ 프로비저닝",
    "admin.orders.view.dmchamp.retry":"프로비저닝 재시도",
    "admin.orders.view.dmchamp.lastError":"마지막 오류: {error}",
    "admin.orders.view.dmchamp.linked":"기존 DM Champ 계정과 연결됨",
    "admin.orders.view.dmchamp.linkedNote":"고객이 이 이메일로 DM Champ 워크스페이스를 이미 보유하고 있습니다. 새 하위 계정은 만들어지지 않았으며 — 고객은 기존 자격 증명으로 로그인합니다.",

    "toast.branding.name.empty":"사이트 이름은 비워둘 수 없습니다",
    "toast.branding.name.tooLong":"사이트 이름은 60자 이하여야 합니다",
    "toast.branding.name.saved":"사이트 이름이 업데이트되었습니다 — 모든 브라우저에 적용됨",
    "toast.branding.name.resetConfirm":"사이트 이름을 \"Deal Pro\"로 재설정하시겠습니까?",
    "toast.branding.name.reset.done":"사이트 이름이 기본값으로 재설정되었습니다",
    "toast.branding.logo.tooLarge":"로고 파일이 너무 큽니다 — 최대 {mb} MB",
    "toast.branding.logo.badType":"지원되지 않는 이미지 유형 — PNG, JPEG, SVG 또는 WebP 사용",
    "toast.branding.logo.uploaded":"로고가 업로드되었습니다 — 모든 브라우저에 적용됨",
    "toast.branding.logo.resetConfirm":"로고를 기본 Deal Pro 이미지로 재설정하시겠습니까?",
    "toast.branding.logo.reset.done":"로고가 기본값으로 재설정되었습니다",
    "toast.branding.favicon.uploaded":"파비콘이 업로드되었습니다 — 모든 브라우저 탭에 적용됨",
    "toast.branding.favicon.tooLarge":"파비콘이 너무 큽니다 — 최대 {kb} KB",
    "toast.branding.favicon.badType":"지원되지 않는 형식 — PNG, ICO, SVG 또는 WebP 사용",
    "toast.branding.favicon.resetConfirm":"사용자 지정 파비콘을 제거하고 기본 탭 아이콘을 사용하시겠습니까?",
    "toast.branding.favicon.reset.done":"파비콘이 기본값으로 재설정되었습니다",
    "toast.langs.enabled":"{lang} 활성화됨 — 이제 사용자에게 표시됨",
    "toast.langs.disabled":"{lang} 비활성화됨 — 사용자에게 숨겨짐",
    "toast.langs.enToggle":"영어는 비활성화할 수 없습니다 — 대체 언어입니다",
    "toast.codelist.codeRequired":"코드를 입력하세요",
    "toast.codelist.companyRequired":"회사명을 입력하세요",
    "toast.codelist.dupCode":"코드 \"{code}\"가 이미 존재합니다",
    "toast.codelist.added":"추가되었습니다",
    "toast.currencies.symbolRequired":"통화 기호를 입력하세요",
    "toast.codelist.updated":"업데이트되었습니다",
    "toast.codelist.deleted":"삭제되었습니다",
    "toast.codelist.deleteConfirm":"\"{code}\"를 삭제하시겠습니까? 되돌릴 수 없습니다.",
    // Admin · orders
    "admin.orders.title-html":'최근 <span class="grad">주문</span>',
    "admin.orders.export":"CSV 내보내기",
    "admin.orders.stat.today":"오늘 · 주문",
    "admin.orders.stat.month":"이번 달 · 주문",
    "admin.orders.stat.yesterday":"어제 · 주문",
    "admin.orders.stat.lastMonth":"지난달 · 주문",
    "admin.orders.stat.period":"기간 · 주문",
    "admin.orders.stat.online":"ontheline에서",
    "admin.orders.stat.direct":"직접 웹",
    "admin.orders.stat.revenue":"오늘 매출",
    "admin.orders.stat.revenue.month":"이번 달 매출",
    "admin.orders.stat.revenue.yesterday":"어제 매출",
    "admin.orders.stat.revenue.lastMonth":"지난달 매출",
    "admin.orders.stat.revenue.period":"기간 매출",
    "admin.orders.h":"모든 거래",
    "admin.orders.col.ref":"참조",
    "admin.orders.col.txId":"거래 ID",
    "admin.orders.col.customer":"고객",
    "admin.orders.col.email":"이메일",
    "admin.orders.col.source":"출처",
    "admin.orders.col.partnerGw":"파트너 / PayGW",
    "admin.orders.filter.partner.all":"모든 파트너",
    "admin.orders.filter.partner.title":"ontheline 파트너로 필터링",
    "admin.orders.filter.paygw.all":"모든 결제 게이트웨이",
    "admin.orders.filter.currency.all":"모든 통화",
    "admin.orders.filter.currency.title":"ontheline 통화로 필터링",
    "admin.orders.filter.paygw.title":"ontheline 결제 게이트웨이로 필터링",
    "admin.orders.col.package":"패키지",
    "admin.orders.col.amount":"금액",
    "admin.orders.col.credits":"크레딧",
    "admin.orders.col.status":"상태",
    "admin.orders.col.date":"날짜",
    "admin.orders.col.actions":"작업",
    "admin.orders.view.credits.label":"적립된 크레딧",
    "admin.orders.view.credits.note":"이 고객이 결제 완료된 주문에서 적립한 크레딧입니다. 남은 잔액과 실시간 사용량은 DM Champ 포털에서 확인할 수 있습니다.",
    "admin.orders.view.credits.topup":"{credits} 크레딧 추가됨",
    "admin.orders.view.credits.new":"새 하위 계정 · {credits} 크레딧 부여됨",
    "admin.orders.view.credits.linked":"기존 하위 계정과 연결됨 · 자동 충전 실패, 수동 충전 필요",
    "admin.orders.action.view":"보기",
    "admin.orders.action.resend":"재전송",
    "admin.orders.filter.all":"전체",
    "admin.orders.filter.online":"ontheline",
    "admin.orders.filter.direct":"직접",
    "admin.orders.filter.chillpay":"Payment Gateway",
    "admin.orders.filter.paid":"결제됨",
    "admin.orders.filter.pending":"대기 중",
    "admin.orders.filter.email.placeholder":"고객 이메일로 필터…",
    "admin.orders.filter.email.clear":"지우기",
    "admin.orders.date.today":"오늘",
    "admin.orders.date.yesterday":"어제",
    "admin.orders.date.lastMonth":"지난달",
    "admin.orders.date.month":"이번 달",
    "admin.orders.date.period":"기간",
    "admin.orders.date.label":"기간:",
    "admin.orders.unit.orders":"건",
    "admin.orders.period.title-html":'<span class="grad">기간</span> 선택',
    "admin.orders.period.start":"시작 날짜",
    "admin.orders.period.end":"종료 날짜",
    "admin.orders.period.apply":"적용",
    "admin.orders.period.summary":"{start}부터 {end}까지의 주문 표시",
    "admin.orders.export.empty":"현재 보기에서 내보낼 주문이 없습니다",
    "admin.orders.export.done":"{count}건의 주문을 CSV로 내보냈습니다",
    // Admin · users
    "admin.users.title-html":'사용자 & <span class="grad">고객</span>',
    "admin.users.add":"사용자 추가",
    "admin.users.h":"모든 사용자",
    "admin.users.col.name":"이름",
    "admin.users.col.email":"이메일",
    "admin.users.col.role":"역할",
    "admin.users.col.plan":"플랜",
    "admin.users.col.credits":"크레딧",
    "admin.users.col.created":"생성일",
    "admin.users.col.status":"상태",
    "admin.users.action.reset":"PW 재설정",
    "admin.users.action.delete":"삭제",
    "admin.users.role.admin":"관리자",
    "admin.users.role.customer":"고객",
    "admin.users.modal.title-html":'<span class="grad">새 사용자</span> 추가',
    "admin.users.modal.sub":"사용자는 이메일로 자격 증명을 받게 되며 첫 로그인 시 비밀번호를 변경해야 합니다.",
    "admin.users.modal.name":"성명",
    "admin.users.modal.email":"이메일",
    "admin.users.modal.role":"역할",
    "admin.users.modal.password":"초기 비밀번호",
    "admin.users.modal.cta":"사용자 만들기",
    // Admin · webhook
    "admin.webhook.title-html":'ontheline <span class="grad">통합</span>',
    "admin.webhook.regen":"시크릿 재생성",
    "admin.webhook.flow.title":"엔드포인트 & 흐름",
    "admin.webhook.flow.sub":"수신된 구매는 가장 가까운 패키지와 매칭됩니다. 차액은 수동 입력을 통해 크레딧 구매로 라우팅됩니다.",
    "admin.webhook.flow.s1.t":"수신",
    "admin.webhook.flow.s1.d":"ontheline이 고객 정보와 결제 금액을 보안 엔드포인트로 POST합니다.",
    "admin.webhook.flow.s2.t":"매칭",
    "admin.webhook.flow.s2.d":"시스템은 지불된 금액 이하의 가장 큰 패키지를 선택합니다.",
    "admin.webhook.flow.s3.t":"차액",
    "admin.webhook.flow.s3.d":"남은 금액은 수동 입력을 통해 크레딧 구매로 변환됩니다.",
    "admin.webhook.flow.s4.t":"프로비저닝",
    "admin.webhook.flow.s4.d":"사용자 생성, 자격 증명 생성, 포털 링크 준비.",
    "admin.webhook.flow.s5.t":"전달",
    "admin.webhook.flow.s5.d":"인보이스 및 영수증 이메일 전송; 주문 → ontheline에 기록 저장.",
    "admin.webhook.endpoint.title":"엔드포인트 URL",
    "admin.webhook.test.title":"ontheline 웹훅 시뮬레이션",
    "admin.webhook.test.hint":"매칭 엔진 테스트 — 고객 정보와 결제 금액 입력.",
    "admin.webhook.test.fire":"테스트 웹훅 실행",
    "admin.webhook.events.h":"최근 웹훅 이벤트",
    "admin.webhook.events.col.time":"시간",
    "admin.webhook.events.col.customer":"고객",
    "admin.webhook.events.col.txId":"거래 ID",
    "admin.webhook.events.col.amount":"금액",
    "admin.webhook.events.col.partnerGw":"파트너 / PayGW",
    "admin.webhook.events.col.matched":"매칭됨",
    "admin.webhook.events.col.status":"상태",
    // Admin · chillpay events
    "admin.chillpay.title-html":'Payment Gateway <span class="grad">이벤트</span>',
    "admin.chillpay.sub":"Payment Gateway에서 발생한 모든 결제 생성 및 콜백 감사 로그. 체크섬 불일치, 누락된 콜백 또는 상태 불일치를 디버그하는 데 사용합니다.",
    "admin.chillpay.endpoint.title":"콜백 엔드포인트 URL (URL Background)",
    "admin.chillpay.endpoint.hint":"서버 간 콜백입니다. Payment Gateway 가맹점 대시보드 → 설정 → 결제 채널 → URL Background에서 이 URL을 구성하세요 (활성화된 각 채널에 대해). 결제 상태의 신뢰할 수 있는 정보 소스입니다.",
    "admin.chillpay.result.title":"고객 반환 URL (URL Result)",
    "admin.chillpay.result.hint":"결제 후 브라우저 측 반환. Payment Gateway 가맹점 대시보드 → 설정 → 결제 채널 → URL Result에서 이 URL을 구성하세요 (활성화된 각 채널에 대해). Payment Gateway는 고객의 브라우저를 이 URL로 POST하며, 페이지에서 결제 결과를 표시합니다.",
    "admin.chillpay.mode.label":"현재 모드",
    "admin.chillpay.mode.sandbox":"샌드박스",
    "admin.chillpay.mode.production":"프로덕션",
    "admin.chillpay.stat.total":"총 이벤트",
    "admin.chillpay.stat.creates":"결제 생성",
    "admin.chillpay.stat.callbacks":"수신된 콜백",
    "admin.chillpay.stat.verified":"검증된 콜백",
    "admin.chillpay.events.h":"최근 Payment Gateway 이벤트",
    "admin.chillpay.col.time":"시간",
    "admin.chillpay.col.kind":"종류",
    "admin.chillpay.col.ref":"주문 번호",
    "admin.chillpay.col.orderno":"Payment Gateway OrderNo",
    "admin.chillpay.col.verified":"검증됨",
    "admin.chillpay.col.status":"결과",
    "admin.chillpay.col.actions":"작업",
    "admin.chillpay.action.view":"세부 정보",
    "admin.chillpay.empty":"아직 Payment Gateway 이벤트가 없습니다. 고객이 Payment Gateway를 통해 결제하기 시작하면 모든 API 호출과 콜백이 여기에 표시됩니다.",
    "admin.chillpay.checksum.ok":"검증됨",
    "admin.chillpay.checksum.fail":"실패",
    "admin.chillpay.checksum.skip":"건너뜀 (테스트 모드)",
    "admin.chillpay.checkstatus":"상태 확인",
    "toast.paymentstatus.checking":"결제 게이트웨이에 조회 중…",
    "toast.paymentstatus.settled":"결제가 확인되었습니다 — {ref}이(가) 결제 완료로 변경되었고 계정과 영수증 메일이 생성되었습니다.",
    "toast.paymentstatus.stillPending":"{ref}: 게이트웨이는 아직 미결제로 보고합니다 (상태 {status})",
    "toast.paymentstatus.failedPayment":"{ref}: 게이트웨이가 결제 실패로 보고했습니다",
    "toast.paymentstatus.failed":"상태 확인 실패: {error}",
    // Admin · emails
    "admin.emails.title-html":'이메일 <span class="grad">대기열</span>',
    "admin.emails.sub":"발송 예정 인보이스, 영수증 및 자격 증명. 클라우드 함수가 디스패치할 때까지 대기 상태로 유지됩니다.",
    "admin.emails.col.time":"대기 시작",
    "admin.emails.col.to":"수신자",
    "admin.emails.col.subject":"제목",
    "admin.emails.col.kind":"종류",
    "admin.emails.col.status":"상태",
    "admin.emails.action.view":"보기",
    "admin.emails.status.supportOnly":"지원팀만",
    "admin.emails.status.supportOnly.title":"ontheline 이메일 — 지원팀 받은편지함으로만 전송됨; 고객에게는 전송되지 않음",
    "admin.emails.status.supportOnly.note":"이 이메일은 ontheline 이메일입니다. 지원팀 받은편지함으로만 전송되었으며 고객은 받지 않았습니다(ontheline이 고객 커뮤니케이션을 직접 처리함).",
    "admin.emails.action.resend":"재전송",
    "admin.emails.kind.invoice":"인보이스",
    "admin.emails.kind.receipt":"영수증",
    "admin.emails.kind.credentials":"자격 증명",
    // Admin · languages
    "admin.langs.title-html":'언어 <span class="grad">관리</span>',
    "admin.langs.add":"언어 추가",
    "admin.langs.master":"영어 (마스터)",
    "admin.langs.locked":"≥ 90% 번역될 때까지 잠김",
    "admin.langs.live":"사용자에게 라이브",
    "admin.langs.continue":"번역 관리",
    "admin.langs.toggle.label":"사용자에게 표시",
    "admin.langs.toggle.on":"켜짐",
    "admin.langs.toggle.off":"꺼짐",
    "admin.langs.toggle.alwaysOn":"영어는 항상 대체 언어로 제공됩니다",
    "admin.langs.toggle.clickToEnable":"이 언어를 사용자에게 표시하려면 클릭하세요",
    "admin.langs.toggle.clickToDisable":"이 언어를 사용자에게 숨기려면 클릭하세요",
    "admin.langs.autosave.hint":"필드 입력을 마치면 (포커스 해제 시) 편집이 자동으로 저장됩니다. 변경 사항은 사용자에게 즉시 적용됩니다.",
    "admin.langs.translate-table.h":"문자열 번역",
    "admin.langs.translate-table.lang":"대상 언어",
    "admin.langs.translate-table.search":"키 또는 텍스트 검색",
    "admin.langs.translate-table.col.key":"키",
    "admin.langs.translate-table.col.source":"영어 (소스)",
    "admin.langs.translate-table.empty":"— 번역되지 않음 —",
    // Admin · packages
    "admin.packages.title-html":'패키지 <span class="grad">관리</span>',
    "admin.packages.add":"패키지 추가",
    "admin.packages.bucket.credit":"크레딧 구매 (Credit Purchase)",
    "admin.packages.bucket.onetime":"1회 액세스 (1-Time Access)",
    "admin.packages.bucket.sub":"구독 (Subscription)",
    "admin.packages.col.order":"순서",
    "admin.packages.col.id":"ID",
    "admin.packages.col.title":"제목",
    "admin.packages.col.desc":"설명",
    "admin.packages.col.price":"가격",
    "admin.packages.col.featured":"추천",
    "admin.packages.col.duration":"기간 (일)",
    "admin.packages.col.actions":"작업",
    "admin.packages.action.edit":"편집",
    "admin.packages.action.delete":"삭제",
    "admin.packages.intro":"세 가지 버킷 전체에서 패키지를 추가, 편집 및 삭제합니다. 변경 사항은 공개 패키지 페이지에 실시간으로 반영됩니다.",
    // Admin · password
    "admin.password.title-html":'비밀번호 <span class="grad">변경</span>',
    "admin.password.current":"현재 비밀번호",
    "admin.password.new":"새 비밀번호",
    "admin.password.confirm":"새 비밀번호 확인",
    "admin.password.cta":"비밀번호 업데이트",
    // Login modal
    "login.title-html":'<span class="grad">로그인</span>',
    "login.sub":"{brand} 계정에 액세스",
    "login.email":"이메일",
    "login.password":"비밀번호",
    "login.cta":"로그인",
    // Toast messages
    "toast.login.ok":"다시 오신 것을 환영합니다, {name}님.",
    "toast.login.fail":"이메일 또는 비밀번호가 잘못되었습니다.",
    "toast.order.created":"주문 생성됨 · 인보이스 대기열에 추가",
    "toast.user.created":"사용자 생성됨 · 비밀번호 이메일 전송",
    "toast.user.deleted":"사용자 삭제됨",
    "toast.email.queued":"이메일 전송 대기 중",
    "toast.password.updated":"비밀번호 업데이트됨",
    "toast.password.wrong":"현재 비밀번호가 올바르지 않습니다",
    "toast.password.mismatch":"새 비밀번호가 일치하지 않습니다",
    "toast.translation.saved":"번역 저장됨",
    "toast.webhook.fired":"웹훅 처리됨 · 주문 #{ref}",
    "toast.webhook.firedEvent":"웹훅 처리됨 · {event} · 주문 #{ref}",
    "toast.webhook.badPartner":"알 수 없는 파트너 코드: {code} — ontheline 파트너에 먼저 추가하세요",
    "toast.webhook.badPaygw":"알 수 없는 paygw 코드: {code} — ontheline 결제 게이트웨이에 먼저 추가하세요",
    "toast.webhook.badCurrency":"알 수 없는 통화: {code} — ontheline 통화에 먼저 추가하세요",
    "toast.webhook.dupEvent":"이 거래는 이미 \"{event}\" 상태입니다 — 중복 이벤트 무시됨",
    "toast.webhook.needPaidFirst":"\"{event}\"에는 기존 Paid 거래가 필요합니다. 이 거래 ID로 먼저 Paid를 실행하세요.",
    "toast.webhook.fromPaid":"Paid에서는 Unpaid, Refund, Partial Refund로만 변경할 수 있습니다(\"{event}\" 아님)",
    "toast.webhook.finalState":"\"{state}\"은(는) 최종 상태입니다 — 이 거래는 더 이상 변경할 수 없습니다",
    "toast.webhook.fromFail":"Fail에서는 Paid로만 변경할 수 있습니다(\"{event}\" 아님)",
    "toast.webhook.refundTooBig":"부분 환불 금액은 결제 금액(${paid})보다 작아야 합니다",
    "toast.webhook.reversed":"{event} 처리됨 · 크레딧 {deducted} 차감 · {remaining} 남음",
    "admin.webhook.test.txid.ph":"비워두면 자동 생성",
    "admin.webhook.test.txid.hint":"동일한 거래 ID를 재사용하여 이벤트 흐름을 테스트하세요(예: Paid 실행 후 동일 ID로 Refund). 비워두면 새 거래를 시작합니다.",
    "toast.chillpay.redirecting":"Payment Gateway로 이동 중…",
    "toast.chillpay.failed":"결제를 시작할 수 없습니다: {error}",
    "toast.chillpay.status.refreshed":"주문 상태가 새로 고쳐졌습니다",
    "toast.packages.added":"새 패키지 {n}개 추가됨",
    "toast.packages.edited":"패키지 {n}개 업데이트됨",
    "toast.packages.removed":"패키지 {n}개 제거됨",
    "toast.checkout.price.updated":"선택한 패키지의 가격이 업데이트되었습니다 — 계속하기 전에 확인하세요",
    "toast.checkout.package.removed":"이 패키지는 더 이상 사용할 수 없습니다 — 다시 선택해 주세요",
    // Customer portal — Navigation
    "nav.account":"내 계정",
    "nav.orders":"내 주문",
    // Customer portal — My Account dashboard
    "account.crumbs":"포털 / 내 계정",
    "account.welcome":"다시 오신 것을 환영합니다, {name}님.",
    "account.sub":"패키지, 주문 및 계정을 한 곳에서 관리하세요.",
    "account.active.title-html":'활성 <span class="grad">구독</span>',
    "account.active.none":"활성 구독이 없습니다. 시작하려면 패키지를 둘러보세요.",
    "account.active.status.active":"활성",
    "account.active.status.expired":"만료됨",
    "account.active.status.expiring":"곧 만료",
    "account.active.expires":"{date}에 만료",
    "account.active.daysLeft":"{n}일 남음",
    "account.active.expiredOn":"{date}에 만료됨",
    "account.active.noExpiry":"만료 없음 · 크레딧 잔액",
    "account.stats.orders":"총 주문",
    "account.stats.spent":"총 지출",
    "account.stats.credits":"적립 크레딧",
    "account.stats.member":"가입일",
    "account.credits.note":"이는 구매를 통해 적립된 총 크레딧입니다. 남은 잔액과 실시간 사용량은 DM Champ 포털에서 확인하실 수 있습니다.",
    "account.cta.browse":"패키지 둘러보기",
    "account.cta.changePassword":"비밀번호 변경",
    "account.changePw.title":"비밀번호 변경",
    "account.changePw.sub":"현재 비밀번호를 입력한 후 새 비밀번호를 선택하세요. 이것은 Deal Pro 계정 비밀번호를 업데이트합니다.",
    "account.changePw.cta":"비밀번호 업데이트",
    "account.cta.orders":"내 주문 보기",
    "account.passwordPrompt.title":"비밀번호 변경",
    "account.passwordPrompt.sub":"보안을 위해 계속하기 전에 새 비밀번호를 선택해 주세요.",
    "account.passwordPrompt.cta":"비밀번호 업데이트",
    // Customer portal — My Orders
    "orders.crumbs":"포털 / 내 주문",
    "orders.title-html":'내 <span class="grad">주문</span>',
    "orders.sub":"모든 구매 내역 — 과거와 현재.",
    "orders.empty":"아직 주문이 없습니다. 첫 구매를 위해 패키지를 둘러보세요.",
    "orders.col.ref":"참조 번호",
    "orders.col.date":"날짜",
    "orders.col.package":"패키지",
    "orders.col.amount":"금액",
    "orders.col.credits":"크레딧",
    "orders.col.expires":"만료",
    "orders.col.status":"상태",
    "orders.col.actions":"작업",
    "orders.action.view":"세부 정보",
    "orders.status.paid":"결제 완료",
    "orders.status.pending":"대기 중",
    "orders.status.failed":"실패",
    "orders.status.expired":"만료됨",
    "orders.status.cancelled":"취소됨",
    "orders.modal.title":"주문 세부 정보",
    "orders.modal.customer":"고객",
    "orders.modal.items":"항목",
    "orders.modal.subtotal":"소계",
    "orders.modal.vat":"VAT 7%",
    "orders.modal.total":"총계",
    "orders.modal.paymentMethod":"결제 수단",
    "orders.modal.paidAt":"결제 일시",
    "orders.modal.expiresAt":"만료 일시",
    "orders.modal.resendInvoice":"인보이스 다시 보내기",
    "orders.modal.resendCredentials":"자격 증명 다시 보내기",
    "orders.modal.close":"닫기",
    "orders.toast.resent":"이메일이 전송 대기열에 추가되었습니다",
    "orders.toast.resendFailed":"이메일을 대기열에 추가할 수 없습니다: {error}",
    // Admin — new columns
    "admin.orders.col.expires":"만료",
    "admin.orders.expires.never":"—",
    "admin.orders.expires.daysLeft":"{n}일 남음",
    "admin.orders.expires.expired":"만료됨",
    "admin.users.col.activePackage":"활성 패키지",
    "admin.users.activePackage.none":"—",
    "admin.users.activePackage.expiringSoon":"{n}일 후 만료",
    // Admin — webhook secret
    "admin.webhook.secret.title":"웹훅 시크릿",
    "admin.webhook.secret.hint":"ontheline의 요청에 서명하는 데 사용됩니다. ontheline 대시보드에 복사하세요. 손상이 의심되면 재생성하세요 — ontheline은 즉시 새 값이 필요합니다.",
    "admin.webhook.secret.show":"표시",
    "admin.webhook.secret.hide":"숨기기",
    "admin.webhook.secret.copy":"복사",
    "admin.webhook.secret.copied":"시크릿이 복사되었습니다",
    "admin.webhook.secret.none":"아직 시크릿이 생성되지 않았습니다 — 생성하려면 시크릿 재생성을 클릭하세요.",
    "admin.webhook.secret.regenConfirm":"새 웹훅 시크릿을 생성하시겠습니까? 이전 시크릿은 즉시 작동을 중지하며 활성 ontheline 통합은 새 값이 필요합니다.",
    "admin.webhook.secret.regenerated":"새 시크릿이 생성되었습니다",
    // Admin — package duration
    "admin.packages.modal.duration":"기간 (일)",
    "admin.packages.modal.duration.hint":"이 패키지가 부여하는 액세스 일수입니다. 시간 제한이 없는 크레딧 패키지의 경우 비워 두세요.",
    "admin.packages.duration.none":"만료 없음",
    "admin.packages.duration.days":"{n}일",
    // Misc
    "footer.tag":"24/7 거래를 성사시키는 AI 영업 에이전트."
  },

  ja: {
    // Navigation
    "nav.home":"ホーム",
    "nav.packages":"パッケージ",
    "nav.admin":"管理コンソール",
    "nav.login":"ログイン",
    "nav.signout":"ログアウト",
    // Drawer
    "drawer.title":"メニュー",
    "drawer.lang":"言語",
    "drawer.account":"アカウント",
    // Hero
    "hero.eyebrow":"AI営業エージェント · ライブネットワーク",
    "hero.title-html":'眠っている間に<br/><span class="grad">販売しましょう。</span><br/><span class="outline">文字通り。</span>',
    "hero.lede":"{brand}は、WhatsApp、Instagram、Messenger、およびあなたのサイトでリードの選別、異議処理、ミーティング予約、取引成立を行う自律型AI営業エージェントです — 24時間、4言語対応。",
    "hero.cta-primary":"パッケージを見る",
    "hero.cta-secondary":"管理コンソールを開く",
    "hero.cta-admin":"管理コンソールを開く",
    "hero.cta-account":"マイアカウントへ",
    "hero.cta-signin":"ログイン",
    // Capabilities
    "caps.num":"01 / 機能",
    "caps.title-html":'ボットではありません。<span class="grad">クローザーです。</span>',
    "caps.lede":"URLを入力するだけ。エージェントが製品、価格、価値提案を読み取り、15分で販売を開始します。コードもプロンプトも不要。",
    "cap.01.t":"本当に人間のような",
    "cap.01.d":"音声メモ、画像、動画、PDFで会話可能。最高のクローザーのように聞こえます。",
    "cap.02.t":"マルチチャネル",
    "cap.02.d":"WhatsApp · Instagram · Messenger · ウェブチャット — すべての面で1つのメモリ。",
    "cap.03.t":"15分セットアップ",
    "cap.03.d":"ウェブサイトのURLを貼り付けるだけ。AIが製品と価格を自動的に読み取ります。コードもプロンプトも不要。",
    "cap.04.t":"マルチモーダル",
    "cap.04.d":"音声メモ、画像、ドキュメント/PDF、動画を理解 — テキストだけではありません。",
    "cap.05.t":"チャット内予約",
    "cap.05.d":"購入シグナルを検出し、会話内で予約を行います。外部リンクなし。",
    "cap.06.t":"メモリ & コンテキスト",
    "cap.06.d":"以前の会話や好みを記憶し、長期的な関係を構築します。",
    "cap.07.t":"キャンペーン & フォローアップ",
    "cap.07.d":"アウトバウンドメッセージング、自動フォローアップ、IGやFacebookでのComment-to-DM。",
    "cap.08.t":"自己改善",
    "cap.08.d":"ワンクリック最適化により、最も成約した会話を分析し、コンバージョン率を向上させます。",
    // Packages
    "pkg.num":"02 / 価格",
    "pkg.title-html":'始める<span class="grad">3つの方法</span>',
    "pkg.lede":"従量制のクレジット、日単位の無制限アクセス、またはローリングサブスクリプション。すべてのプランは、認証情報を含めてメールで即座にプロビジョニングされます。",
    "pkg.tab.credit":"クレジット購入",
    "pkg.tab.onetime":"1回アクセス",
    "pkg.tab.sub":"サブスクリプション",
    "pkg.sub.note":"サブスクリプションのクレジットは各サイクルの終了時に失効します。クレジットが枯渇した後にサイクル中に継続するには、クレジット購入のトップアップを追加してください。",
    "pkg.select":"選択",
    "pkg.subscribe":"登録",
    "pkg.configure":"設定",
    "pkg.featured":"人気No.1",
    "pkg.manual.title":"手動入力",
    "pkg.manual.desc":"金額を入力してください — トップアップとonthelineの残高に使用されます。",
    "pkg.manual.label":"金額を入力 (USD)",
    // Credit Purchase packages
    "pkg.credit.5.t":"スターター",
    "pkg.credit.5.d":"トライアルや小規模キャンペーン向けの軽量クレジットトップアップ。",
    "pkg.credit.10.t":"エッセンシャル",
    "pkg.credit.10.d":"中程度のアクティビティで1週間使用可能なクレジット。",
    "pkg.credit.20.t":"スタジオ",
    "pkg.credit.20.d":"個人事業主やコンサルタントに最適。",
    "pkg.credit.50.t":"アトリエ",
    "pkg.credit.50.d":"同時にキャンペーンを実行する小規模チーム向け。",
    "pkg.credit.100.t":"ハウス",
    "pkg.credit.100.d":"代理店および大量販売者向けのパワーティア。",
    // 1-Time Access
    "pkg.onetime.3d.t":"3日間",
    "pkg.onetime.3d.d":"72時間の無制限クレジット。",
    "pkg.onetime.7d.t":"7日間",
    "pkg.onetime.7d.d":"無制限アクセスの1週間。",
    "pkg.onetime.14d.t":"14日間",
    "pkg.onetime.14d.d":"無制限アクティビティの2週間。",
    "pkg.onetime.1m.t":"1か月",
    "pkg.onetime.1m.d":"月次キャンペーンサイクルに最適。",
    "pkg.onetime.3m.t":"3か月",
    "pkg.onetime.3m.d":"四半期アクセス — ほとんどの代理店が選択。",
    "pkg.onetime.6m.t":"6か月",
    "pkg.onetime.6m.d":"優先サポート付きの半年契約。",
    "pkg.onetime.12m.t":"12か月",
    "pkg.onetime.12m.d":"年間アクセス — 主力プラン。",
    "pkg.onetime.24m.t":"24か月",
    "pkg.onetime.24m.d":"2年契約 — 日割り最高価値。",
    // Subscription
    "pkg.sub.1m.t":"1か月",
    "pkg.sub.1m.d":"月次更新。いつでもキャンセル可能。",
    "pkg.sub.3m.t":"3か月",
    "pkg.sub.3m.d":"四半期 — 最も人気のあるティア。",
    "pkg.sub.6m.t":"6か月",
    "pkg.sub.6m.d":"優先キュー付きの半年契約。",
    "pkg.sub.12m.t":"12か月",
    "pkg.sub.12m.d":"年間サブスクリプション — 推奨。",
    "pkg.sub.24m.t":"24か月",
    "pkg.sub.24m.d":"固定価格の2年契約。",
    // Checkout
    "checkout.num":"03 / 決済",
    "checkout.title-html":'もうすぐ <span class="grad">あなたのものです。</span>',
    "checkout.section.customer":"お客様情報",
    "checkout.section.payment":"お支払い方法",
    "checkout.section.delivery":"領収書の配信",
    "checkout.field.name":"氏名",
    "checkout.field.email":"メール",
    "checkout.field.company":"会社",
    "checkout.field.country":"国",
    "checkout.field.taxid":"納税者番号",
    "checkout.field.optional":"任意",
    "checkout.field.taxid.hint":"適格請求書の発行用 · タイ法人: 13桁の納税者番号",
    "checkout.ph.name":"例: Soraya Kanchanaporn",
    "checkout.ph.email":"例: soraya@studiokanchana.com",
    "checkout.ph.company":"例: Studio Kanchana",
    "checkout.ph.taxid":"例: 0105564016423",
    "checkout.terms.intro-html":"お支払いの前に<a class=\"terms-link\" onclick=\"App.openTermsModal()\">利用規約およびプライバシーポリシー</a>をご確認ください。",
    "checkout.terms.consent":"事業目的での購入であることを確認し、利用規約およびプライバシーポリシーを読み、同意します。チャージしたクレジットは購入後24時間で自動的に失効し、返金は一切できないことを理解しています。",
    "toast.checkout.needName":"お名前を入力してください",
    "toast.checkout.needEmail":"メールアドレスを入力してください",
    "toast.checkout.badEmail":"有効なメールアドレスを入力してください",
    "toast.checkout.needTerms":"お支払いの前に利用規約をお読みのうえ同意してください",
    "about.eyebrow":"ONTHELINE と DealMai について",
    "about.heading-html":"すべての問い合わせが<em>成長の機会</em>に。",
    "about.teaser-html":"<strong>ONTHELINE</strong> は、従来のチャットボットや返信の遅れによって、企業が日々貴重なリードを失っていることに着目しました。そこで、24時間365日のAI対応でその溝を埋める <strong>DealMai</strong> を開発しました。WhatsApp、Instagram、LINE などの主要メッセージチャネルで、人間のように自然な会話を通じて見込み客を選別し、予約を取り、休眠顧客を再活性化します — すべて御社のブランドボイスのままで。グローバルな ONTHELINE ネットワーク（タイ・日本・韓国）の一員として、あらゆる問い合わせを止まることのない成長機会へと変えます。",
    "about.readmore":"私たちの物語を読む",
    "about.modal.kicker":"会社概要",
    "about.modal.title":"ONTHELINE & DealMai",
    "about.modal.sub":"グローバルなリード対応の溝を埋める · タイ · 日本 · 韓国",
    "terms.modal.kicker":"法的事項",
    "terms.modal.title":"利用規約およびプライバシーポリシー",
    "terms.modal.sub":"DealMai マスター利用規約およびプラットフォーム契約 · 2026年7月31日施行",
    "doc.close":"閉じる",
    "checkout.field.card":"カード番号",
    "checkout.field.expiry":"有効期限",
    "checkout.field.cvc":"CVC",
    "checkout.field.via":"領収書の送信方法",
    "checkout.field.lang":"領収書の言語",
    "checkout.payment.intro":"Payment Gatewayの安全な決済ページにリダイレクトされます。",
    "checkout.channel.any":"次のステップで選択",
    "checkout.channel.card":"クレジット / デビットカード",
    "checkout.channel.qr":"QR PromptPay",
    "checkout.channel.mobile":"モバイルバンキング",
    "checkout.channel.ewallet":"電子ウォレット",
    "checkout.summary.title":"注文概要",
    "checkout.summary.package":"パッケージ",
    "checkout.summary.activation":"有効化",
    "checkout.summary.activation-val":"即時",
    "checkout.summary.subtotal":"小計",
    "checkout.summary.vat":"VAT 7%",
    "checkout.summary.total":"お支払い合計",
    "checkout.summary.cta":"確認して支払う",
    "checkout.summary.secure":"256ビット · PCI DSS · 暗号化",
    "checkout.summary.redirecting":"Payment Gatewayにリダイレクト中…",
    "checkout.summary.powered":"Payment Gateway提供 · タイの決済サービス",
    // Payment Result
    "result.pending.title-html":'お支払い<span class="grad">処理中。</span>',
    "result.pending.sub":"お支払いを処理しています。Payment Gatewayの確認後、{email}に確認メールが届きます。通常1分以内に完了します。",
    "result.success.title-html":'お支払い<span class="grad">確認済み。</span>',
    "result.success.sub":"ありがとうございます。領収書と認証情報は{email}に送信されます。オンボーディングは5分以内に完了します。",
    "result.failed.title-html":'お支払いが<span class="grad">完了しませんでした。</span>',
    "result.failed.sub":"お支払いがキャンセルまたは拒否されました。請求は発生していません。再試行するか、別の方法を選択できます。",
    "result.notfound.title-html":'注文が<span class="grad">見つかりません。</span>',
    "result.notfound.sub":"この注文を見つけることができませんでした。先ほどお支払いされた場合は、少しお待ちください。確認がまだ送信中の可能性があります。",
    "result.ref":"注文番号",
    "result.amount":"金額",
    "result.method":"お支払い方法",
    "result.status":"ステータス",
    "result.cta-retry":"再試行",
    "result.cta-back":"パッケージに戻る",
    "result.cta-home":"ホームに戻る",
    // Confirmation
    "confirm.title-html":'ようこそ、<span class="grad">{name}様。</span>',
    "confirm.sub":"AIエージェントを準備中です。認証情報と領収書は{email}に送信されました。オンボーディングは5分以内に完了します。",
    "confirm.ref":"注文番号",
    "confirm.package":"パッケージ",
    "confirm.amount":"請求金額",
    "confirm.portal":"ポータルリンク",
    "confirm.invoice":"請求書 / 領収書",
    "confirm.invoice-val":"PDF · メールで配信",
    "confirm.cta-portal":"ポータルを開く",
    "confirm.cta-back":"パッケージに戻る",
    // Admin · sidebar
    "admin.side.console":"コンソール",
    "admin.side.orders":"注文",
    "admin.side.users":"ユーザー",
    "admin.side.packages":"パッケージ",
    "admin.side.webhook":"onthelineウェブフック",
    "admin.side.partners":"onthelineパートナー",
    "admin.side.paygw":"ontheline決済ゲートウェイ",
    "admin.side.currencies":"ontheline通貨",
    "admin.currencies.title":"ontheline通貨",
    "admin.currencies.sub":"onthelineがウェブフックの<code>currency</code>フィールドに送信する可能性のある通貨コードを管理します。一致しない通貨のウェブフックは拒否されます。記号は注文の金額の横に表示され、USD値（クレジット計算用）はライブ為替レートで変換されます。",
    "admin.currencies.add":"通貨を追加",
    "admin.currencies.empty":"通貨がありません。追加してください（例: USD $）。",
    "admin.currencies.add.title":"通貨を追加",
    "admin.currencies.edit.title":"通貨を編集",
    "admin.currencies.col.code":"コード (ISO 4217)",
    "admin.currencies.col.symbol":"記号",
    "admin.currencies.col.label":"名称",
    "admin.currencies.code.ph":"例: USD, THB, JPY, KRW",
    "admin.currencies.symbol.ph":"例: $, ฿, ¥, ₩",
    "admin.currencies.label.ph":"例: 米ドル",
    "admin.currencies.hint":"コードはウェブフック通貨値と大文字小文字を区別せず一致し、USD変換に使用されます。為替レートAPIが認識できるよう標準の3文字ISO 4217コードを使用してください。",
    "admin.partners.title":"onthelineパートナー",
    "admin.partners.sub":"onthelineがウェブフック呼び出しで送信する可能性のあるパートナーコードを管理します。受信ウェブフックの<code>partner</code>値がこれらのコードのいずれにも一致しない場合は拒否されます。",
    "admin.partners.add":"パートナーを追加",
    "admin.partners.empty":"パートナーがありません。パートナーコード付きのonthelineウェブフックを受け入れるには追加してください。",
    "admin.partners.add.title":"パートナーを追加",
    "admin.partners.edit.title":"パートナーを編集",
    "admin.paygw.title":"ontheline決済ゲートウェイ",
    "admin.paygw.sub":"onthelineがウェブフック呼び出しで送信する可能性のある決済ゲートウェイコードを管理します。受信ウェブフックの<code>paygw</code>値がこれらのコードのいずれにも一致しない場合は拒否されます。",
    "admin.paygw.add":"決済ゲートウェイを追加",
    "admin.paygw.empty":"決済ゲートウェイがありません。paygwコード付きのonthelineウェブフックを受け入れるには追加してください。",
    "admin.paygw.add.title":"決済ゲートウェイを追加",
    "admin.paygw.edit.title":"決済ゲートウェイを編集",
    "admin.codelist.col.code":"コード",
    "admin.codelist.col.company":"会社名",
    "admin.codelist.col.actions":"操作",
    "admin.codelist.edit":"編集",
    "admin.codelist.delete":"削除",
    "admin.codelist.save":"保存",
    "admin.codelist.code.ph":"例: PARTNER01",
    "admin.codelist.company.ph":"例: Acme Travel Co., Ltd.",
    "admin.codelist.code.hint":"コードはウェブフック値と完全に（大文字小文字を区別せず）一致します。会社名は参照用で注文に表示されます。",
    "admin.side.chillpay":"Payment Gateway イベント",
    "admin.side.paymentgw":"決済ゲートウェイ",
    "admin.paymentgw.crumbs":"コンソール / 決済ゲートウェイ",
    "admin.paymentgw.title-html":"決済<span class=\"grad\">ゲートウェイ</span>",
    "admin.paymentgw.sub":"新規の直接（ウェブ）決済を処理する事業者を選択します。進行中の注文は作成時のゲートウェイをそのまま使用します。",
    "admin.paymentgw.note-html":"認証情報は Netlify の環境変数にのみ保存され、データベースには保存されません。このページは<em>どの</em>ゲートウェイを使うかだけを記録します。先に Netlify でキーを設定してから、ここで有効化してください。",
    "admin.paymentgw.note.default":"まだ選択が保存されていないため、既定のゲートウェイが使用されます。下から選ぶと明示的に指定できます。",
    "admin.paymentgw.state.ready":"設定済み・利用可能です。",
    "admin.paymentgw.state.missing":"未設定です。不足している環境変数: {list}",
    "admin.paymentgw.badge.active":"使用中",
    "admin.paymentgw.btn.use":"このゲートウェイを使う",
    "admin.paymentgw.btn.inuse":"使用中",
    "admin.paymentgw.btn.needenv":"先に Netlify でこのゲートウェイの環境変数を設定してください",
    "admin.paymentgw.btn.copy":"コピー",
    "admin.paymentgw.lbl.channels":"決済チャネル",
    "admin.paymentgw.lbl.callback":"コールバック URL — 事業者の管理画面に登録してください",
    "admin.paymentgw.hint.callback":"サーバー間の通信で、決済ステータスの正となる情報源です。有効なすべてのチャネルの URL Background / Webhook として登録してください。",
    "admin.paymentgw.lbl.returnurl":"リターン URL (URL Result) — こちらも登録してください",
    "admin.paymentgw.hint.returnurl":"決済後にお客様のブラウザが戻るページです。自社ページのため、どのゲートウェイでも同じ値です。",
    "admin.paymentgw.lbl.env":"環境変数",
    "admin.paymentgw.empty":"登録されている決済ゲートウェイがありません。",
    "admin.paymentgw.err.diag":"決済ファンクションに接続できませんでした。サイトをデプロイしてからこのページを再読み込みしてください。",
    "toast.paymentgw.unknown":"登録されていないゲートウェイです",
    "toast.paymentgw.needenv":"先に環境変数を設定してください — 不足: {list}",
    "toast.paymentgw.confirm":"新規の決済をすべて {name} 経由にしますか？\n\n進行中の注文には影響しません。それぞれ開始したゲートウェイで完了します。",
    "toast.paymentgw.saved":"新規の決済は {name} 経由になりました",
    "toast.paymentgw.failed":"保存できませんでした: {error}",
    "admin.side.emails":"メールキュー",
    "admin.side.languages":"言語",
    "admin.side.branding":"ブランディング",
    "admin.side.dmchamp":"DM Champ",
    "admin.side.account":"アカウント",
    "admin.side.password":"パスワード変更",
    "admin.side.signout":"ログアウト",
    // Admin · branding
    "admin.branding.crumbs":"コンソール / ブランディング",
    "admin.branding.title-html":'サイト<span class="grad">ブランディング</span>',
    "admin.branding.sub":"サイト名とロゴを変更します。更新はヘッダー、フッター、ブラウザタブ、顧客向けページを含むアプリ全体に即座に適用され、リフレッシュは不要です。",
    "admin.branding.name.title":"サイト名",
    "admin.branding.name.hint":"公開サイト、管理コンソール、フッター、ブラウザタブにあるすべての\"Deal Pro\"を置き換えます。最大60文字。",
    "admin.branding.name.save":"名前を保存",
    "admin.branding.name.reset":"リセット",
    "admin.branding.name.reset.title":"\"Deal Pro\"にリセット",
    "admin.branding.name.preview":"プレビュー:",
    "admin.branding.logo.title":"ロゴ画像",
    "admin.branding.logo.hint":"サイトヘッダーに表示するカスタムロゴをアップロードします。推奨: 透明PNG、~300×100ピクセル。最大500 KB。",
    "admin.branding.logo.upload":"ロゴをアップロード",
    "admin.branding.logo.reset":"リセット",
    "admin.branding.logo.reset.title":"デフォルトロゴにリセット",
    "admin.branding.logo.limits":"対応: PNG, JPEG, SVG, WebP · 最大500 KB",
    "admin.branding.favicon.title":"ブラウザタブアイコン (ファビコン)",
    "admin.branding.favicon.hint":"ブラウザタブのサイト名の横に表示される小さなアイコンです。正方形の画像（最低32×32px）を使用してください。透過PNGまたはSVGが最適です。すべての訪問者のブラウザタブにリアルタイムで適用されます。",
    "admin.branding.favicon.preview":"タブプレビュー",
    "admin.branding.favicon.upload":"ファビコンをアップロード",
    "admin.branding.favicon.reset":"リセット",
    "admin.branding.favicon.reset.title":"カスタムファビコンを削除してデフォルトアイコンを使用",
    "admin.branding.favicon.using.custom":"アップロードしたカスタムファビコンを表示中",
    "admin.branding.favicon.using.default":"デフォルトのブラウザタブアイコンを使用中",
    "admin.branding.favicon.limits":"対応: PNG, ICO, SVG, WebP · 正方形 · 最大100 KB",
    "admin.branding.logo.using.default":"デフォルトロゴを表示中",
    "admin.branding.logo.using.custom":"カスタムロゴを表示中",
    "admin.branding.lastUpdated":"最終更新: {date} ({by})",

    // Admin · DM Champ integration
    "admin.dmchamp.crumbs":"コンソール / 統合",
    "admin.dmchamp.title-html":'DM Champ <span class="grad">統合</span>',
    "admin.dmchamp.sub":"支払い済みの顧客全員のためにDM Champ AIワークスペースを自動プロビジョニングします。DM Champのエージェンシープランが必要です。",
    "admin.dmchamp.status.configured":"接続済み · APIキー登録済み",
    "admin.dmchamp.status.missing":"未接続 · 以下にAPIキーを入力",
    "admin.dmchamp.status.disabled":"統合無効 · 自動プロビジョニングを有効化",
    "admin.dmchamp.apiKey":"DM Champ APIキー",
    "admin.dmchamp.apiKey.hint":"DM Champ → 設定 → API Accessで取得できます。Firestoreに安全に保存され、保存後は再表示されません。",
    "admin.dmchamp.apiKey.placeholder":"APIキーを貼り付け…",
    "admin.dmchamp.apiKey.masked":"現在のキー: {masked} — 新しいキーを貼り付けて置き換え",
    "admin.dmchamp.enabled":"自動プロビジョニングを有効化",
    "admin.dmchamp.enabled.hint":"有効にすると、支払いが成功するたびに自動的にDM Champサブアカウントが作成されます。",
    "admin.dmchamp.creditsPerUsd":"USDあたりのクレジット",
    "admin.dmchamp.creditsPerUsd.hint":"顧客が支払う各USDがDM Champクレジットに変換される比率。例: 100は$5 → 500クレジットを意味します。",
    "admin.dmchamp.defaultCredits":"デフォルト月間クレジット",
    "admin.dmchamp.defaultCredits.hint":"注文金額を変換できない場合に使用されます (まれ)。安全な最小値として機能します。",
    "admin.dmchamp.rollover":"未使用クレジットを繰り越し",
    "admin.dmchamp.rollover.hint":"有効にすると未使用クレジットが翌月に繰り越されます。無効の場合は毎月リセットされます。",
    "admin.dmchamp.timezone":"デフォルトタイムゾーン",
    "admin.dmchamp.country":"デフォルト国 (ISO-2)",
    "admin.dmchamp.portalUrl":"ポータルURL",
    "admin.dmchamp.openPortal":"DM Champポータルを開く",
    "admin.dmchamp.portalUrl.hint":"メールと顧客ポータルのボタンに表示されるDM Champのサインイン URL です。デフォルトは https://app.dmchamp.com を使用するか、White-Label カスタムドメイン（例：https://app.dealmai.com）を入力して、顧客にあなたのブランドを表示します。",
    "admin.dmchamp.save":"設定を保存",
    "admin.dmchamp.test":"API接続をテスト",
    "admin.dmchamp.preview":"変換プレビュー",
    "admin.dmchamp.preview.row":"${usd} → {credits} クレジット",

    // DM Champ toasts
    "toast.dmchamp.saved":"DM Champ設定が保存されました",
    "toast.dmchamp.saveFail":"DM Champ設定を保存できませんでした: {error}",
    "toast.dmchamp.provisioning":"DM Champサブアカウントをプロビジョニング中…",
    "toast.dmchamp.provisioned":"{email}のDM Champサブアカウントが作成されました",
    "toast.dmchamp.alreadyProvisioned":"既にプロビジョニング済み — 変更なし",
    "toast.dmchamp.linked":"既存のDM Champアカウントがこの注文にリンクされました ({email})",
    "toast.dmchamp.provisionFail":"DM Champプロビジョニングに失敗: {error}",

    // Customer portal · DM Champ workspace card
    "account.dmchamp.title":"Ai Portalワークスペース",
    "account.dmchamp.intro":"AI営業エージェントワークスペースです。",
    "account.dmchamp.email":"メール",
    "account.dmchamp.uid":"アカウントID",
    "account.dmchamp.credits":"月間クレジット",
    "account.dmchamp.tempPassword":"仮パスワード",
    "account.dmchamp.tempPasswordHint":"初回サインイン時に変更してください。",
    "account.dmchamp.open":"Ai Portalを開く",
    "account.dmchamp.pending":"Ai Portalワークスペースを準備中です。間もなく認証情報をメールでお送りします。",
    "account.dmchamp.failed":"Ai Portalワークスペースを作成できませんでした。サポートにお問い合わせください。手動で設定いたします。",
    "account.dmchamp.linked":"既存のAi Portalアカウントがこの購入にリンクされました。以下の既存のサインイン認証情報をご利用ください。",
    "account.dmchamp.toppedUp":"この購入のクレジットがAi Portalアカウントに追加されました。以下の既存の認証情報でサインインしてください。",

    // Order View modal · DM Champ section
    "admin.orders.view.dmchamp":"DM Champサブアカウント",
    "admin.orders.view.ontheline":"onthelineパートナー / 決済ゲートウェイ",
    "admin.orders.view.partner":"パートナー",
    "admin.orders.view.paygw":"決済ゲートウェイ",
    "admin.orders.view.event":"イベント",
    "admin.orders.view.amount":"金額",
    "admin.orders.view.dmchamp.notProvisioned":"未プロビジョニング",
    "admin.orders.view.dmchamp.provision":"DM Champをプロビジョニング",
    "admin.orders.view.dmchamp.retry":"プロビジョニング再試行",
    "admin.orders.view.dmchamp.lastError":"最終エラー: {error}",
    "admin.orders.view.dmchamp.linked":"既存のDM Champアカウントにリンク済み",
    "admin.orders.view.dmchamp.linkedNote":"このメールアドレスで既にDM Champワークスペースをお持ちです。新しいサブアカウントは作成されず、既存の認証情報でサインインします。",

    "toast.branding.name.empty":"サイト名は空にできません",
    "toast.branding.name.tooLong":"サイト名は60文字以下にしてください",
    "toast.branding.name.saved":"サイト名が更新されました — すべてのブラウザに適用",
    "toast.branding.name.resetConfirm":"サイト名を\"Deal Pro\"にリセットしますか?",
    "toast.branding.name.reset.done":"サイト名がデフォルトにリセットされました",
    "toast.branding.logo.tooLarge":"ロゴファイルが大きすぎます — 最大{mb} MB",
    "toast.branding.logo.badType":"サポートされていない画像タイプ — PNG、JPEG、SVG、またはWebPを使用",
    "toast.branding.logo.uploaded":"ロゴがアップロードされました — すべてのブラウザに適用",
    "toast.branding.logo.resetConfirm":"ロゴをデフォルトのDeal Pro画像にリセットしますか?",
    "toast.branding.logo.reset.done":"ロゴがデフォルトにリセットされました",
    "toast.branding.favicon.uploaded":"ファビコンがアップロードされました — すべてのブラウザタブに適用",
    "toast.branding.favicon.tooLarge":"ファビコンが大きすぎます — 最大{kb} KB",
    "toast.branding.favicon.badType":"サポートされていない形式 — PNG、ICO、SVG、またはWebPを使用",
    "toast.branding.favicon.resetConfirm":"カスタムファビコンを削除してデフォルトのタブアイコンを使用しますか？",
    "toast.branding.favicon.reset.done":"ファビコンがデフォルトにリセットされました",
    "toast.langs.enabled":"{lang}を有効化 — ユーザーに表示されます",
    "toast.langs.disabled":"{lang}を無効化 — ユーザーから非表示",
    "toast.langs.enToggle":"英語は無効化できません — フォールバック言語です",
    "toast.codelist.codeRequired":"コードを入力してください",
    "toast.codelist.companyRequired":"会社名を入力してください",
    "toast.codelist.dupCode":"コード \"{code}\" は既に存在します",
    "toast.codelist.added":"追加されました",
    "toast.currencies.symbolRequired":"通貨記号を入力してください",
    "toast.codelist.updated":"更新されました",
    "toast.codelist.deleted":"削除されました",
    "toast.codelist.deleteConfirm":"\"{code}\" を削除しますか？元に戻せません。",
    // Admin · orders
    "admin.orders.title-html":'最近の <span class="grad">注文</span>',
    "admin.orders.export":"CSVエクスポート",
    "admin.orders.stat.today":"本日 · 注文",
    "admin.orders.stat.month":"今月 · 注文",
    "admin.orders.stat.yesterday":"昨日 · 注文",
    "admin.orders.stat.lastMonth":"先月 · 注文",
    "admin.orders.stat.period":"期間 · 注文",
    "admin.orders.stat.online":"onthelineから",
    "admin.orders.stat.direct":"ダイレクトウェブ",
    "admin.orders.stat.revenue":"本日の売上",
    "admin.orders.stat.revenue.month":"今月の売上",
    "admin.orders.stat.revenue.yesterday":"昨日の売上",
    "admin.orders.stat.revenue.lastMonth":"先月の売上",
    "admin.orders.stat.revenue.period":"期間の売上",
    "admin.orders.h":"すべての取引",
    "admin.orders.col.ref":"参照",
    "admin.orders.col.txId":"取引ID",
    "admin.orders.col.customer":"顧客",
    "admin.orders.col.email":"メール",
    "admin.orders.col.source":"ソース",
    "admin.orders.col.partnerGw":"パートナー / PayGW",
    "admin.orders.filter.partner.all":"すべてのパートナー",
    "admin.orders.filter.partner.title":"onthelineパートナーで絞り込み",
    "admin.orders.filter.paygw.all":"すべての決済ゲートウェイ",
    "admin.orders.filter.currency.all":"すべての通貨",
    "admin.orders.filter.currency.title":"ontheline通貨で絞り込み",
    "admin.orders.filter.paygw.title":"ontheline決済ゲートウェイで絞り込み",
    "admin.orders.col.package":"パッケージ",
    "admin.orders.col.amount":"金額",
    "admin.orders.col.credits":"クレジット",
    "admin.orders.col.status":"ステータス",
    "admin.orders.col.date":"日付",
    "admin.orders.col.actions":"アクション",
    "admin.orders.view.credits.label":"獲得クレジット",
    "admin.orders.view.credits.note":"この顧客が支払い済み注文で獲得したクレジットです。残高と現在の使用状況はDM Champポータルで確認できます。",
    "admin.orders.view.credits.topup":"{credits}クレジット追加",
    "admin.orders.view.credits.new":"新規サブアカウント · {credits}クレジット付与",
    "admin.orders.view.credits.linked":"既存サブアカウントにリンク済み · 自動チャージ失敗、手動チャージが必要",
    "admin.orders.action.view":"表示",
    "admin.orders.action.resend":"再送信",
    "admin.orders.filter.all":"すべて",
    "admin.orders.filter.online":"ontheline",
    "admin.orders.filter.direct":"ダイレクト",
    "admin.orders.filter.chillpay":"Payment Gateway",
    "admin.orders.filter.paid":"支払い済み",
    "admin.orders.filter.pending":"保留中",
    "admin.orders.filter.email.placeholder":"顧客メールで絞り込み…",
    "admin.orders.filter.email.clear":"クリア",
    "admin.orders.date.today":"本日",
    "admin.orders.date.yesterday":"昨日",
    "admin.orders.date.lastMonth":"先月",
    "admin.orders.date.month":"今月",
    "admin.orders.date.period":"期間",
    "admin.orders.date.label":"期間:",
    "admin.orders.unit.orders":"件",
    "admin.orders.period.title-html":'<span class="grad">期間</span>を選択',
    "admin.orders.period.start":"開始日",
    "admin.orders.period.end":"終了日",
    "admin.orders.period.apply":"適用",
    "admin.orders.period.summary":"{start}から{end}までの注文を表示",
    "admin.orders.export.empty":"現在のビューにエクスポートする注文がありません",
    "admin.orders.export.done":"{count}件の注文をCSVにエクスポートしました",
    // Admin · users
    "admin.users.title-html":'ユーザー & <span class="grad">顧客</span>',
    "admin.users.add":"ユーザー追加",
    "admin.users.h":"すべてのユーザー",
    "admin.users.col.name":"名前",
    "admin.users.col.email":"メール",
    "admin.users.col.role":"役割",
    "admin.users.col.plan":"プラン",
    "admin.users.col.credits":"クレジット",
    "admin.users.col.created":"作成日",
    "admin.users.col.status":"ステータス",
    "admin.users.action.reset":"PWリセット",
    "admin.users.action.delete":"削除",
    "admin.users.role.admin":"管理者",
    "admin.users.role.customer":"顧客",
    "admin.users.modal.title-html":'<span class="grad">新規ユーザー</span> 追加',
    "admin.users.modal.sub":"ユーザーはメールで認証情報を受け取り、初回ログイン時にパスワードを変更する必要があります。",
    "admin.users.modal.name":"氏名",
    "admin.users.modal.email":"メール",
    "admin.users.modal.role":"役割",
    "admin.users.modal.password":"初期パスワード",
    "admin.users.modal.cta":"ユーザー作成",
    // Admin · webhook
    "admin.webhook.title-html":'ontheline <span class="grad">統合</span>',
    "admin.webhook.regen":"シークレット再生成",
    "admin.webhook.flow.title":"エンドポイント & フロー",
    "admin.webhook.flow.sub":"受信した購入は最も近いパッケージとマッチされます。差額は手動入力でクレジット購入にルーティングされます。",
    "admin.webhook.flow.s1.t":"受信",
    "admin.webhook.flow.s1.d":"onthelineが顧客情報と支払い金額を安全なエンドポイントにPOSTします。",
    "admin.webhook.flow.s2.t":"マッチング",
    "admin.webhook.flow.s2.d":"システムは支払い金額以下の最大パッケージを選択します。",
    "admin.webhook.flow.s3.t":"差額",
    "admin.webhook.flow.s3.d":"残りは手動入力でクレジット購入に変換されます。",
    "admin.webhook.flow.s4.t":"プロビジョニング",
    "admin.webhook.flow.s4.d":"ユーザー作成、認証情報生成、ポータルリンク準備。",
    "admin.webhook.flow.s5.t":"配信",
    "admin.webhook.flow.s5.d":"請求書と領収書をメール送信; 注文 → onthelineに記録保存。",
    "admin.webhook.endpoint.title":"エンドポイントURL",
    "admin.webhook.test.title":"onthelineウェブフックシミュレーション",
    "admin.webhook.test.hint":"マッチングエンジンをテスト — 顧客情報と支払い金額を入力。",
    "admin.webhook.test.fire":"テストウェブフック実行",
    "admin.webhook.events.h":"最近のウェブフックイベント",
    "admin.webhook.events.col.time":"時刻",
    "admin.webhook.events.col.customer":"顧客",
    "admin.webhook.events.col.txId":"取引ID",
    "admin.webhook.events.col.amount":"金額",
    "admin.webhook.events.col.partnerGw":"パートナー / PayGW",
    "admin.webhook.events.col.matched":"マッチ済み",
    "admin.webhook.events.col.status":"ステータス",
    // Admin · chillpay events
    "admin.chillpay.title-html":'Payment Gateway <span class="grad">イベント</span>',
    "admin.chillpay.sub":"Payment Gatewayからの決済作成およびコールバックの監査ログ。チェックサムの不一致、欠落したコールバック、ステータスの不一致をデバッグするために使用します。",
    "admin.chillpay.endpoint.title":"コールバックエンドポイントURL (URL Background)",
    "admin.chillpay.endpoint.hint":"サーバー間コールバック。Payment Gateway加盟店ダッシュボード → 設定 → 決済チャネル → URL Background でこのURLを構成してください (有効な各チャネルに対して)。これが決済ステータスの信頼できる情報源です。",
    "admin.chillpay.result.title":"顧客リターンURL (URL Result)",
    "admin.chillpay.result.hint":"決済後のブラウザ側リターン。Payment Gateway加盟店ダッシュボード → 設定 → 決済チャネル → URL Result でこのURLを構成してください (有効な各チャネルに対して)。Payment Gatewayは顧客のブラウザをこのURLにPOSTし、ページで決済結果を表示します。",
    "admin.chillpay.mode.label":"現在のモード",
    "admin.chillpay.mode.sandbox":"サンドボックス",
    "admin.chillpay.mode.production":"本番",
    "admin.chillpay.stat.total":"イベント総数",
    "admin.chillpay.stat.creates":"決済作成",
    "admin.chillpay.stat.callbacks":"受信コールバック",
    "admin.chillpay.stat.verified":"検証済みコールバック",
    "admin.chillpay.events.h":"最近のPayment Gatewayイベント",
    "admin.chillpay.col.time":"時刻",
    "admin.chillpay.col.kind":"種類",
    "admin.chillpay.col.ref":"注文番号",
    "admin.chillpay.col.orderno":"Payment Gateway OrderNo",
    "admin.chillpay.col.verified":"検証済み",
    "admin.chillpay.col.status":"結果",
    "admin.chillpay.col.actions":"操作",
    "admin.chillpay.action.view":"詳細",
    "admin.chillpay.empty":"Payment Gatewayイベントはまだありません。お客様がPayment Gateway経由で支払いを開始すると、すべてのAPI呼び出しとコールバックがここに表示されます。",
    "admin.chillpay.checksum.ok":"検証済み",
    "admin.chillpay.checksum.fail":"失敗",
    "admin.chillpay.checksum.skip":"スキップ (テストモード)",
    "admin.chillpay.checkstatus":"ステータス確認",
    "toast.paymentstatus.checking":"決済ゲートウェイに照会中…",
    "toast.paymentstatus.settled":"支払いを確認しました — {ref} は支払い済みになり、アカウントと領収書メールを作成しました。",
    "toast.paymentstatus.stillPending":"{ref}: ゲートウェイは未払いと報告しています（ステータス {status}）",
    "toast.paymentstatus.failedPayment":"{ref}: ゲートウェイは支払い失敗と報告しています",
    "toast.paymentstatus.failed":"ステータス確認に失敗しました: {error}",
    // Admin · emails
    "admin.emails.title-html":'メール <span class="grad">キュー</span>',
    "admin.emails.sub":"送信予定の請求書、領収書、認証情報。クラウド関数が処理するまで保留状態のままです。",
    "admin.emails.col.time":"キュー追加",
    "admin.emails.col.to":"宛先",
    "admin.emails.col.subject":"件名",
    "admin.emails.col.kind":"種類",
    "admin.emails.col.status":"ステータス",
    "admin.emails.action.view":"表示",
    "admin.emails.status.supportOnly":"サポートのみ",
    "admin.emails.status.supportOnly.title":"onthelineメール — サポート受信箱のみに配信。顧客には送信されていません",
    "admin.emails.status.supportOnly.note":"これはonthelineメールです。サポート受信箱のみに配信され、顧客は受信していません（onthelineが顧客とのやり取りを直接処理します）。",
    "admin.emails.action.resend":"再送信",
    "admin.emails.kind.invoice":"請求書",
    "admin.emails.kind.receipt":"領収書",
    "admin.emails.kind.credentials":"認証情報",
    // Admin · languages
    "admin.langs.title-html":'言語 <span class="grad">管理</span>',
    "admin.langs.add":"言語追加",
    "admin.langs.master":"英語 (マスター)",
    "admin.langs.locked":"≥ 90% 翻訳されるまでロック",
    "admin.langs.live":"ユーザーに公開",
    "admin.langs.continue":"翻訳管理",
    "admin.langs.toggle.label":"ユーザーに表示",
    "admin.langs.toggle.on":"オン",
    "admin.langs.toggle.off":"オフ",
    "admin.langs.toggle.alwaysOn":"英語は常にフォールバック言語として利用可能です",
    "admin.langs.toggle.clickToEnable":"この言語をユーザーに表示するにはクリック",
    "admin.langs.toggle.clickToDisable":"この言語をユーザーから隠すにはクリック",
    "admin.langs.autosave.hint":"フィールドの入力が完了すると (フォーカス解除時) 編集は自動的に保存されます。変更は即座にユーザーに適用されます。",
    "admin.langs.translate-table.h":"文字列翻訳",
    "admin.langs.translate-table.lang":"対象言語",
    "admin.langs.translate-table.search":"キーまたはテキストを検索",
    "admin.langs.translate-table.col.key":"キー",
    "admin.langs.translate-table.col.source":"英語 (ソース)",
    "admin.langs.translate-table.empty":"— 未翻訳 —",
    // Admin · packages
    "admin.packages.title-html":'パッケージ <span class="grad">管理</span>',
    "admin.packages.add":"パッケージ追加",
    "admin.packages.bucket.credit":"クレジット購入 (Credit Purchase)",
    "admin.packages.bucket.onetime":"1回アクセス (1-Time Access)",
    "admin.packages.bucket.sub":"サブスクリプション (Subscription)",
    "admin.packages.col.order":"順序",
    "admin.packages.col.id":"ID",
    "admin.packages.col.title":"タイトル",
    "admin.packages.col.desc":"説明",
    "admin.packages.col.price":"価格",
    "admin.packages.col.featured":"おすすめ",
    "admin.packages.col.duration":"期間 (日)",
    "admin.packages.col.actions":"アクション",
    "admin.packages.action.edit":"編集",
    "admin.packages.action.delete":"削除",
    "admin.packages.intro":"3つのバケット全体でパッケージを追加、編集、削除できます。変更は公開パッケージページにリアルタイムで反映されます。",
    // Admin · password
    "admin.password.title-html":'パスワード <span class="grad">変更</span>',
    "admin.password.current":"現在のパスワード",
    "admin.password.new":"新しいパスワード",
    "admin.password.confirm":"新しいパスワードの確認",
    "admin.password.cta":"パスワード更新",
    // Login modal
    "login.title-html":'<span class="grad">ログイン</span>',
    "login.sub":"{brand}アカウントにアクセス",
    "login.email":"メール",
    "login.password":"パスワード",
    "login.cta":"サインイン",
    // Toast messages
    "toast.login.ok":"おかえりなさい、{name}様。",
    "toast.login.fail":"メールまたはパスワードが無効です。",
    "toast.order.created":"注文作成完了 · 請求書キュー追加",
    "toast.user.created":"ユーザー作成完了 · パスワードメール送信",
    "toast.user.deleted":"ユーザー削除完了",
    "toast.email.queued":"配信のためにメールキューに追加",
    "toast.password.updated":"パスワード更新完了",
    "toast.password.wrong":"現在のパスワードが正しくありません",
    "toast.password.mismatch":"新しいパスワードが一致しません",
    "toast.translation.saved":"翻訳保存完了",
    "toast.webhook.fired":"ウェブフック処理完了 · 注文 #{ref}",
    "toast.webhook.firedEvent":"ウェブフック処理完了 · {event} · 注文 #{ref}",
    "toast.webhook.badPartner":"不明なパートナーコード: {code} — まずonthelineパートナーに追加してください",
    "toast.webhook.badPaygw":"不明なpaygwコード: {code} — まずontheline決済ゲートウェイに追加してください",
    "toast.webhook.badCurrency":"不明な通貨: {code} — まずontheline通貨に追加してください",
    "toast.webhook.dupEvent":"この取引はすでに「{event}」です — 重複イベントを無視しました",
    "toast.webhook.needPaidFirst":"「{event}」には既存のPaid取引が必要です。先にこの取引IDでPaidを送信してください。",
    "toast.webhook.fromPaid":"PaidからはUnpaid、Refund、Partial Refundのみ変更可能です（「{event}」は不可）",
    "toast.webhook.finalState":"「{state}」は最終状態です — この取引は変更できません",
    "toast.webhook.fromFail":"FailからはPaidのみ変更可能です（「{event}」は不可）",
    "toast.webhook.refundTooBig":"一部返金額は支払額（${paid}）より少なくする必要があります",
    "toast.webhook.reversed":"{event}処理完了 · クレジット{deducted}減算 · {remaining}残り",
    "admin.webhook.test.txid.ph":"空欄で自動生成",
    "admin.webhook.test.txid.hint":"同じ取引IDを再利用してイベントフローをテストできます（例: Paidを送信後、同じIDでRefund）。空欄で新しい取引を開始します。",
    "toast.chillpay.redirecting":"Payment Gatewayにリダイレクト中…",
    "toast.chillpay.failed":"決済を開始できませんでした: {error}",
    "toast.chillpay.status.refreshed":"注文ステータスを更新しました",
    "toast.packages.added":"新しいパッケージ{n}件追加されました",
    "toast.packages.edited":"パッケージ{n}件更新されました",
    "toast.packages.removed":"パッケージ{n}件削除されました",
    "toast.checkout.price.updated":"選択したパッケージの価格が更新されました — 続行する前にご確認ください",
    "toast.checkout.package.removed":"このパッケージは利用できなくなりました — 再度選択してください",
    // Customer portal — Navigation
    "nav.account":"マイアカウント",
    "nav.orders":"マイ注文",
    // Customer portal — My Account dashboard
    "account.crumbs":"ポータル / マイアカウント",
    "account.welcome":"{name}様、お帰りなさい。",
    "account.sub":"パッケージ、注文、アカウントを一箇所で管理。",
    "account.active.title-html":'アクティブ <span class="grad">サブスクリプション</span>',
    "account.active.none":"アクティブなサブスクリプションはありません。パッケージを閲覧して開始してください。",
    "account.active.status.active":"アクティブ",
    "account.active.status.expired":"期限切れ",
    "account.active.status.expiring":"まもなく期限切れ",
    "account.active.expires":"{date}に期限切れ",
    "account.active.daysLeft":"残り{n}日",
    "account.active.expiredOn":"{date}に期限切れ",
    "account.active.noExpiry":"期限なし · クレジット残高",
    "account.stats.orders":"総注文数",
    "account.stats.spent":"総支出",
    "account.stats.credits":"獲得クレジット",
    "account.stats.member":"会員開始日",
    "account.credits.note":"これはご購入により獲得した累計クレジットです。残高および現在の使用状況はDM Champポータルでご確認いただけます。",
    "account.cta.browse":"パッケージを閲覧",
    "account.cta.changePassword":"パスワード変更",
    "account.changePw.title":"パスワードを変更",
    "account.changePw.sub":"現在のパスワードを入力し、新しいパスワードを選択してください。これによりDeal Proアカウントのパスワードが更新されます。",
    "account.changePw.cta":"パスワード更新",
    "account.cta.orders":"マイ注文を表示",
    "account.passwordPrompt.title":"パスワードを変更",
    "account.passwordPrompt.sub":"セキュリティのため、続行する前に新しいパスワードを選択してください。",
    "account.passwordPrompt.cta":"パスワード更新",
    // Customer portal — My Orders
    "orders.crumbs":"ポータル / マイ注文",
    "orders.title-html":'マイ <span class="grad">注文</span>',
    "orders.sub":"過去と現在のすべての購入履歴。",
    "orders.empty":"まだ注文がありません。最初の購入のためにパッケージを閲覧してください。",
    "orders.col.ref":"参照番号",
    "orders.col.date":"日付",
    "orders.col.package":"パッケージ",
    "orders.col.amount":"金額",
    "orders.col.credits":"クレジット",
    "orders.col.expires":"期限",
    "orders.col.status":"ステータス",
    "orders.col.actions":"アクション",
    "orders.action.view":"詳細",
    "orders.status.paid":"支払い済み",
    "orders.status.pending":"保留中",
    "orders.status.failed":"失敗",
    "orders.status.expired":"期限切れ",
    "orders.status.cancelled":"キャンセル済み",
    "orders.modal.title":"注文詳細",
    "orders.modal.customer":"お客様",
    "orders.modal.items":"項目",
    "orders.modal.subtotal":"小計",
    "orders.modal.vat":"VAT 7%",
    "orders.modal.total":"合計",
    "orders.modal.paymentMethod":"支払い方法",
    "orders.modal.paidAt":"支払日時",
    "orders.modal.expiresAt":"有効期限",
    "orders.modal.resendInvoice":"請求書を再送信",
    "orders.modal.resendCredentials":"認証情報を再送信",
    "orders.modal.close":"閉じる",
    "orders.toast.resent":"メールが送信キューに追加されました",
    "orders.toast.resendFailed":"メールをキューに追加できませんでした: {error}",
    // Admin — new columns
    "admin.orders.col.expires":"期限",
    "admin.orders.expires.never":"—",
    "admin.orders.expires.daysLeft":"残り{n}日",
    "admin.orders.expires.expired":"期限切れ",
    "admin.users.col.activePackage":"アクティブパッケージ",
    "admin.users.activePackage.none":"—",
    "admin.users.activePackage.expiringSoon":"{n}日後に期限切れ",
    // Admin — webhook secret
    "admin.webhook.secret.title":"ウェブフックシークレット",
    "admin.webhook.secret.hint":"onthelineからのリクエストの署名に使用されます。onthelineダッシュボードにコピーしてください。漏洩が疑われる場合は再生成してください — onthelineは即座に新しい値が必要です。",
    "admin.webhook.secret.show":"表示",
    "admin.webhook.secret.hide":"非表示",
    "admin.webhook.secret.copy":"コピー",
    "admin.webhook.secret.copied":"シークレットをコピーしました",
    "admin.webhook.secret.none":"まだシークレットが生成されていません — 作成するにはシークレット再生成をクリックしてください。",
    "admin.webhook.secret.regenConfirm":"新しいウェブフックシークレットを生成しますか? 古いシークレットは即座に機能しなくなり、アクティブなontheline統合には新しい値が必要になります。",
    "admin.webhook.secret.regenerated":"新しいシークレットが生成されました",
    // Admin — package duration
    "admin.packages.modal.duration":"期間 (日)",
    "admin.packages.modal.duration.hint":"このパッケージが付与するアクセス日数。期限のないクレジットパッケージの場合は空白にしてください。",
    "admin.packages.duration.none":"期限なし",
    "admin.packages.duration.days":"{n}日",
    // Misc
    "footer.tag":"24/7取引を成立させるAI営業エージェント。"
  }
};

// ===========================================================
// Package catalog (prices in USD)
// Initial packages used to SEED Firestore on first run.
// After seeding, the live PACKAGES variable below is replaced by data from Firestore
// (collection "packages") and is what the rest of the app reads.
const DEFAULT_PACKAGES = {
  credit: [
    { id:"credit.5",   price:5,    titleKey:"pkg.credit.5.t",   descKey:"pkg.credit.5.d",   featured:false, order:1, durationDays:null },
    { id:"credit.10",  price:10,   titleKey:"pkg.credit.10.t",  descKey:"pkg.credit.10.d",  featured:false, order:2, durationDays:null },
    { id:"credit.20",  price:20,   titleKey:"pkg.credit.20.t",  descKey:"pkg.credit.20.d",  featured:true,  order:3, durationDays:null },
    { id:"credit.50",  price:50,   titleKey:"pkg.credit.50.t",  descKey:"pkg.credit.50.d",  featured:false, order:4, durationDays:null },
    { id:"credit.100", price:100,  titleKey:"pkg.credit.100.t", descKey:"pkg.credit.100.d", featured:false, order:5, durationDays:null }
  ],
  onetime: [
    { id:"onetime.3d",  price:100,   titleKey:"pkg.onetime.3d.t",  descKey:"pkg.onetime.3d.d",  featured:false, order:1, durationDays:3   },
    { id:"onetime.7d",  price:150,   titleKey:"pkg.onetime.7d.t",  descKey:"pkg.onetime.7d.d",  featured:false, order:2, durationDays:7   },
    { id:"onetime.14d", price:300,   titleKey:"pkg.onetime.14d.t", descKey:"pkg.onetime.14d.d", featured:false, order:3, durationDays:14  },
    { id:"onetime.1m",  price:500,   titleKey:"pkg.onetime.1m.t",  descKey:"pkg.onetime.1m.d",  featured:false, order:4, durationDays:30  },
    { id:"onetime.3m",  price:1000,  titleKey:"pkg.onetime.3m.t",  descKey:"pkg.onetime.3m.d",  featured:true,  order:5, durationDays:90  },
    { id:"onetime.6m",  price:3000,  titleKey:"pkg.onetime.6m.t",  descKey:"pkg.onetime.6m.d",  featured:false, order:6, durationDays:180 },
    { id:"onetime.12m", price:5000,  titleKey:"pkg.onetime.12m.t", descKey:"pkg.onetime.12m.d", featured:false, order:7, durationDays:365 },
    { id:"onetime.24m", price:10000, titleKey:"pkg.onetime.24m.t", descKey:"pkg.onetime.24m.d", featured:false, order:8, durationDays:730 }
  ],
  sub: [
    { id:"sub.1m",  price:500,   titleKey:"pkg.sub.1m.t",  descKey:"pkg.sub.1m.d",  featured:false, order:1, durationDays:30  },
    { id:"sub.3m",  price:1000,  titleKey:"pkg.sub.3m.t",  descKey:"pkg.sub.3m.d",  featured:true,  order:2, durationDays:90  },
    { id:"sub.6m",  price:3000,  titleKey:"pkg.sub.6m.t",  descKey:"pkg.sub.6m.d",  featured:false, order:3, durationDays:180 },
    { id:"sub.12m", price:5000,  titleKey:"pkg.sub.12m.t", descKey:"pkg.sub.12m.d", featured:false, order:4, durationDays:365 },
    { id:"sub.24m", price:10000, titleKey:"pkg.sub.24m.t", descKey:"pkg.sub.24m.d", featured:false, order:5, durationDays:730 }
  ]
};

// Live PACKAGES — populated from Firestore on boot, kept in sync via subscription.
// Same shape as DEFAULT_PACKAGES.
let PACKAGES = JSON.parse(JSON.stringify(DEFAULT_PACKAGES));

// Capability list shown on home
const CAPS = ["cap.01","cap.02","cap.03","cap.04","cap.05","cap.06","cap.07","cap.08"];

// Mock terminal lines for hero
const TERMINAL_LINES = [
  ['c','// live conversation with a qualified lead'],
  ['k','agent:  hi sara, i saw your comment on'],
  ['',  '        the spring collection 👋'],
  ['k','lead:   yes, is the linen blazer still'],
  ['',  '        available in size m?'],
  ['k','agent:  it is — last one in stock 🪡'],
  ['',  '        want me to hold it 5 min while'],
  ['',  '        you decide?'],
  ['k','lead:   yes please'],
  ['k','agent:  done. <span class="s">[hold:m_blazer:5m]</span>'],
  ['',  '        shall i book a 15-min styling'],
  ['',  '        call before purchase?'],
  ['k','lead:   tomorrow 4pm works'],
  ['k','agent:  booked ✓ <span class="s">[cal:tue_16:00]</span>'],
  ['',  '        sending checkout link now...'],
  ['k','status: <span class="n">CONVERSION_LIKELIHOOD: 0.87</span><span class="blink"></span>']
];

// ===========================================================
// STATE
// ===========================================================
const State = {
  user: null,                     // logged-in admin {email, name}
  currentLang: "en",
  langs: SUPPORTED_LANGS,
  strings: {},                    // {en:{key:val}, th:{...}, ...}
  langStatus: {},                 // {en:{pct:100,locked:false}, ...}
  selectedPackage: null,          // {bucket, id, price, title, manualAmount?}
  selectedChannel: "creditcard",  // default channel; user can change via pill click
  orders: [],
  users: [],
  emails: [],
  webhookEvents: [],
  webhookConfig: { secret: null, updatedAt: null, updatedBy: null },  // from Firestore config/webhook
  chillpayEvents: [],             // merged payment_events + chillpay_events (admin only)
  _payEventsNew: [],              // raw payment_events snapshot (all gateways)
  _payEventsLegacy: [],           // raw chillpay_events snapshot (pre-refactor history)
  onthelinePartners: [],          // ontheline_partners collection: {code, companyName}
  onthelinePaygw: [],             // ontheline_paygw collection: {code, companyName}
  onthelineCurrencies: [],        // ontheline_currencies collection: {code, symbol, companyName/label}
  unsubs: [],
  // Orders page filters — default to "month" so admins land on a useful overview
  orderDateFilter: "month",       // "today" | "month" | "period"
  orderPeriodStart: null,         // Date | null
  orderPeriodEnd: null,           // Date | null
  orderSourceFilter: "all",       // "all" | "ontheline" | "direct" (direct includes chillpay)
  orderEmailFilter: "",           // free-text email filter (case-insensitive substring match; empty = no filter)
  orderPartnerFilter: "",         // ontheline partner code filter ("" = all)
  orderPaygwFilter: "",           // ontheline paygw code filter ("" = all)
  orderCurrencyFilter: "",        // ontheline currency code filter ("" = all)
  // Branding (loaded from Firestore config/branding doc; falls back to defaults below)
  branding: {
    siteName: "Deal Pro",
    logoDataUrl: null,            // null = use DEFAULT_LOGO_DATA_URL fallback
    faviconDataUrl: null,         // null = use default browser-tab icon (the inline SVG in index.html)
    enabledLangs: null,           // null = all supported langs enabled; else array like ["en","th"]. "en" is always forced on.
    updatedAt: null,
    updatedBy: null
  },
  brandingUnsub: null,
  // DM Champ integration config (loaded on-demand when admin opens the page)
  // Payment gateway panel state (loaded on demand by renderAdminPaymentGw)
  paymentGw: { loaded:false, activeGateway:null, savedInFirestore:false, gateways:[], diagError:null },
  dmchamp: {
    loaded:                false,
    configured:            false,
    enabled:               true,
    creditsPerUsd:         100,
    defaultMonthlyCredits: 1000,
    rollOverToNextMonth:   false,
    timeZoneId:            "Asia/Bangkok",
    country:               "TH",
    apiKeyMasked:          "",    // never store the real key in client state
    // DM Champ sign-in URL — defaults to public app but agency White-Label
    // customers point this at their custom domain (e.g. https://app.dealmai.com)
    // through Admin → DM Champ → Portal URL. Used for the "Open DM Champ"
    // buttons in the customer portal and for links in DM Champ emails.
    portalUrl:             "https://app.dmchamp.com",
    updatedAt:             null,
    updatedBy:             null
  }
};

// ===========================================================
// I18N
// ===========================================================
// ===========================================================
// Stale-value overrides — applied at translation-lookup time so that
// outdated copies in Firestore don't override fresher in-code strings.
//
// When a string is intentionally renamed in a later release, the old value
// lingers in Firestore (since the admin's translations are user data). To
// avoid forcing every admin to manually re-edit, we list the old → new
// mappings here. I.t() returns the new value whenever it finds the old one.
//
// This is a read-side override; it does NOT mutate Firestore. The "Languages"
// admin UI will still display the old value (the admin can fix it manually
// when they get there), but every other surface of the app sees the new one.
// ===========================================================
const STALE_VALUE_OVERRIDES = {
  "nav.login": {
    en: { "Admin Login": "Sign In" },
    th: { "เข้าสู่ระบบผู้ดูแล": "เข้าสู่ระบบ" },
    ko: { "관리자 로그인": "로그인" },
    ja: { "管理者ログイン": "ログイン" }
  },
  "login.title-html": {
    en: { 'Admin <span class="grad">Login</span>': 'Sign <span class="grad">In</span>' },
    th: { '<span class="grad">เข้าสู่ระบบ</span> ผู้ดูแล': '<span class="grad">เข้าสู่ระบบ</span>' },
    ko: { '관리자 <span class="grad">로그인</span>': '<span class="grad">로그인</span>' },
    ja: { '管理者 <span class="grad">ログイン</span>': '<span class="grad">ログイン</span>' }
  },
  "login.sub": {
    en: { "Console Access · Restricted": "Access your {brand} account" },
    th: { "การเข้าใช้แผงควบคุม · จำกัดสิทธิ์": "เข้าสู่บัญชี {brand} ของคุณ" },
    ko: { "콘솔 액세스 · 제한됨": "{brand} 계정에 액세스" },
    ja: { "コンソールアクセス · 制限あり": "{brand}アカウントにアクセス" }
  },
  // "Open DM Champ" button was renamed to "Open Ai Portal" (30 May 2026).
  // Flip any Firestore-seeded copies of the old label to the new one at
  // runtime so all 4 languages update without a manual Firestore edit.
  "account.dmchamp.open": {
    en: { "Open DM Champ": "Open Ai Portal" },
    th: { "เปิด DM Champ": "เปิด Ai Portal" },
    ko: { "DM Champ 열기": "Ai Portal 열기" },
    ja: { "DM Champを開く": "Ai Portalを開く" }
  },
  "account.dmchamp.toppedUp": {
    en: { "Credits from this purchase have been added to your DM Champ account. Sign in with your existing credentials below.": "Credits from this purchase have been added to your Ai Portal account. Sign in with your existing credentials below." },
    th: { "เครดิตจากการซื้อนี้ถูกเพิ่มเข้าบัญชี DM Champ ของคุณแล้ว เข้าสู่ระบบด้วยข้อมูลที่คุณมีอยู่ด้านล่าง": "เครดิตจากการซื้อนี้ถูกเพิ่มเข้าบัญชี Ai Portal ของคุณแล้ว เข้าสู่ระบบด้วยข้อมูลที่คุณมีอยู่ด้านล่าง" },
    ko: { "이번 구매의 크레딧이 DM Champ 계정에 추가되었습니다. 아래의 기존 자격 증명으로 로그인하세요.": "이번 구매의 크레딧이 Ai Portal 계정에 추가되었습니다. 아래의 기존 자격 증명으로 로그인하세요." },
    ja: { "この購入のクレジットがDM Champアカウントに追加されました。以下の既存の認証情報でサインインしてください。": "この購入のクレジットがAi Portalアカウントに追加されました。以下の既存の認証情報でサインインしてください。" }
  },
  "account.dmchamp.title": {
    en: { "DM Champ Workspace": "Ai Portal Workspace" },
    th: { "พื้นที่ทำงาน DM Champ": "พื้นที่ทำงาน Ai Portal" },
    ko: { "DM Champ 워크스페이스": "Ai Portal 워크스페이스" },
    ja: { "DM Champワークスペース": "Ai Portalワークスペース" },
  },
  "account.dmchamp.pending": {
    en: { "Your DM Champ workspace is being prepared. We will email your credentials shortly.": "Your Ai Portal workspace is being prepared. We will email your credentials shortly." },
    th: { "กำลังเตรียมพื้นที่ทำงาน DM Champ ของคุณ ระบบจะส่งข้อมูลเข้าใช้ทางอีเมลในไม่ช้า": "กำลังเตรียมพื้นที่ทำงาน Ai Portal ของคุณ ระบบจะส่งข้อมูลเข้าใช้ทางอีเมลในไม่ช้า" },
    ko: { "DM Champ 워크스페이스를 준비 중입니다. 곧 자격 증명을 이메일로 보내드리겠습니다.": "Ai Portal 워크스페이스를 준비 중입니다. 곧 자격 증명을 이메일로 보내드리겠습니다." },
    ja: { "DM Champワークスペースを準備中です。間もなく認証情報をメールでお送りします。": "Ai Portalワークスペースを準備中です。間もなく認証情報をメールでお送りします。" },
  },
  "account.dmchamp.failed": {
    en: { "We could not create your DM Champ workspace. Please contact support and we will set it up manually.": "We could not create your Ai Portal workspace. Please contact support and we will set it up manually." },
    th: { "ไม่สามารถสร้างพื้นที่ทำงาน DM Champ ของคุณได้ กรุณาติดต่อทีมสนับสนุน เราจะช่วยตั้งค่าด้วยตนเอง": "ไม่สามารถสร้างพื้นที่ทำงาน Ai Portal ของคุณได้ กรุณาติดต่อทีมสนับสนุน เราจะช่วยตั้งค่าด้วยตนเอง" },
    ko: { "DM Champ 워크스페이스를 만들 수 없습니다. 지원팀에 문의하시면 수동으로 설정해 드립니다.": "Ai Portal 워크스페이스를 만들 수 없습니다. 지원팀에 문의하시면 수동으로 설정해 드립니다." },
    ja: { "DM Champワークスペースを作成できませんでした。サポートにお問い合わせください。手動で設定いたします。": "Ai Portalワークスペースを作成できませんでした。サポートにお問い合わせください。手動で設定いたします。" },
  },
  "account.dmchamp.linked": {
    en: { "Your existing DM Champ account is linked to this purchase. Use your current sign-in credentials below.": "Your existing Ai Portal account is linked to this purchase. Use your current sign-in credentials below." },
    th: { "บัญชี DM Champ ที่มีอยู่ของคุณเชื่อมโยงกับการซื้อนี้แล้ว ใช้ข้อมูลเข้าใช้ที่คุณมีอยู่ด้านล่าง": "บัญชี Ai Portal ที่มีอยู่ของคุณเชื่อมโยงกับการซื้อนี้แล้ว ใช้ข้อมูลเข้าใช้ที่คุณมีอยู่ด้านล่าง" },
    ko: { "기존 DM Champ 계정이 이번 구매와 연결되었습니다. 아래의 기존 로그인 자격 증명을 사용하세요.": "기존 Ai Portal 계정이 이번 구매와 연결되었습니다. 아래의 기존 로그인 자격 증명을 사용하세요." },
    ja: { "既存のDM Champアカウントがこの購入にリンクされました。以下の既存のサインイン認証情報をご利用ください。": "既存のAi Portalアカウントがこの購入にリンクされました。以下の既存のサインイン認証情報をご利用ください。" },
  },
  // Hero lede was originally seeded with "Deal Pro" hardcoded in the string.
  // The new code uses "{brand}" placeholder so the home page reflects the
  // admin's current Site Name in Branding. These overrides flip any Firestore
  // copies of the old wording to the new placeholder version at runtime, so
  // existing deployments don't need a manual Firestore edit to pick up the fix.
  "hero.lede": {
    en: {
      "Deal Pro is an autonomous AI sales agent that qualifies leads, handles objections, books meetings and closes deals across WhatsApp, Instagram, Messenger and your site — 24 hours a day, in four languages.":
        "{brand} is an autonomous AI sales agent that qualifies leads, handles objections, books meetings and closes deals across WhatsApp, Instagram, Messenger and your site — 24 hours a day, in four languages."
    },
    th: {
      "Deal Pro คือ AI ตัวแทนขายอัจฉริยะที่คัดกรองลูกค้า รับมือข้อโต้แย้ง นัดหมาย และปิดการขายผ่าน WhatsApp, Instagram, Messenger และเว็บไซต์ของคุณ — ตลอด 24 ชั่วโมง รองรับ 4 ภาษา":
        "{brand} คือ AI ตัวแทนขายอัจฉริยะที่คัดกรองลูกค้า รับมือข้อโต้แย้ง นัดหมาย และปิดการขายผ่าน WhatsApp, Instagram, Messenger และเว็บไซต์ของคุณ — ตลอด 24 ชั่วโมง รองรับ 4 ภาษา",
      "Deal Pro คือ AI ตัวแทนขายอัจฉริยะที่คัดกรองลูกค้า รับมือกับข้อโต้แย้ง นัดหมาย และปิดการขายผ่าน WhatsApp, Instagram, Messenger และเว็บไซต์ของคุณ — ตลอด 24 ชั่วโมง รองรับ 4 ภาษา":
        "{brand} คือ AI ตัวแทนขายอัจฉริยะที่คัดกรองลูกค้า รับมือกับข้อโต้แย้ง นัดหมาย และปิดการขายผ่าน WhatsApp, Instagram, Messenger และเว็บไซต์ของคุณ — ตลอด 24 ชั่วโมง รองรับ 4 ภาษา"
    },
    ko: {
      "Deal Pro는 WhatsApp, Instagram, Messenger 및 귀하의 웹사이트에서 잠재 고객을 검증하고 반대 의견을 처리하며 미팅을 예약하고 거래를 성사시키는 자율 AI 영업 에이전트입니다 — 24시간, 4개 언어 지원.":
        "{brand}는 WhatsApp, Instagram, Messenger 및 귀하의 웹사이트에서 잠재 고객을 검증하고 반대 의견을 처리하며 미팅을 예약하고 거래를 성사시키는 자율 AI 영업 에이전트입니다 — 24시간, 4개 언어 지원."
    },
    ja: {
      "Deal Proは、WhatsApp、Instagram、Messenger、およびあなたのサイトでリードの選別、異議処理、ミーティング予約、取引成立を行う自律型AI営業エージェントです — 24時間、4言語対応。":
        "{brand}は、WhatsApp、Instagram、Messenger、およびあなたのサイトでリードの選別、異議処理、ミーティング予約、取引成立を行う自律型AI営業エージェントです — 24時間、4言語対応。"
    }
  },
  "checkout.payment.intro": {
    en: { "You'll be redirected to ChillPay's secure payment page to complete the payment.": "You'll be redirected to Payment Gateway's secure payment page to complete the payment." },
    th: { "ระบบจะนำคุณไปยังหน้าชำระเงินที่ปลอดภัยของ ChillPay เพื่อทำธุรกรรม": "ระบบจะนำคุณไปยังหน้าชำระเงินที่ปลอดภัยของ Payment Gateway เพื่อทำธุรกรรม" },
    ko: { "ChillPay의 보안 결제 페이지로 이동됩니다.": "Payment Gateway의 보안 결제 페이지로 이동됩니다." },
    ja: { "ChillPayの安全な決済ページにリダイレクトされます。": "Payment Gatewayの安全な決済ページにリダイレクトされます。" },
  },
  "checkout.summary.redirecting": {
    en: { "Redirecting to ChillPay…": "Redirecting to Payment Gateway…" },
    th: { "กำลังเปลี่ยนเส้นทางไปยัง ChillPay…": "กำลังเปลี่ยนเส้นทางไปยัง Payment Gateway…" },
    ko: { "ChillPay로 이동 중…": "Payment Gateway로 이동 중…" },
    ja: { "ChillPayにリダイレクト中…": "Payment Gatewayにリダイレクト中…" },
  },
  "checkout.summary.powered": {
    en: { "Powered by ChillPay · Thai PSP": "Powered by Payment Gateway · Thai PSP" },
    th: { "ขับเคลื่อนโดย ChillPay · ผู้ให้บริการชำระเงินไทย": "ขับเคลื่อนโดย Payment Gateway · ผู้ให้บริการชำระเงินไทย" },
    ko: { "ChillPay 제공 · 태국 PSP": "Payment Gateway 제공 · 태국 PSP" },
    ja: { "ChillPay提供 · タイの決済サービス": "Payment Gateway提供 · タイの決済サービス" },
  },
  "result.pending.sub": {
    en: { "Your payment is being processed. You'll receive a confirmation email at {email} once ChillPay confirms — usually within a minute.": "Your payment is being processed. You'll receive a confirmation email at {email} once Payment Gateway confirms — usually within a minute." },
    th: { "กำลังประมวลผลการชำระเงินของคุณ คุณจะได้รับอีเมลยืนยันที่ {email} เมื่อ ChillPay ยืนยัน ปกติใช้เวลาไม่เกิน 1 นาที": "กำลังประมวลผลการชำระเงินของคุณ คุณจะได้รับอีเมลยืนยันที่ {email} เมื่อ Payment Gateway ยืนยัน ปกติใช้เวลาไม่เกิน 1 นาที" },
    ko: { "결제가 처리되고 있습니다. ChillPay 확인 후 {email}로 확인 이메일이 전송됩니다. 보통 1분 이내에 완료됩니다.": "결제가 처리되고 있습니다. Payment Gateway 확인 후 {email}로 확인 이메일이 전송됩니다. 보통 1분 이내에 완료됩니다." },
    ja: { "お支払いを処理しています。ChillPayの確認後、{email}に確認メールが届きます。通常1分以内に完了します。": "お支払いを処理しています。Payment Gatewayの確認後、{email}に確認メールが届きます。通常1分以内に完了します。" },
  },
  "admin.side.chillpay": {
    en: { "ChillPay Events": "Payment Gateway Events" },
    th: { "ChillPay Events": "Payment Gateway Events" },
    ko: { "ChillPay 이벤트": "Payment Gateway 이벤트" },
    ja: { "ChillPay イベント": "Payment Gateway イベント" },
  },
  "admin.orders.filter.chillpay": {
    en: { "ChillPay": "Payment Gateway" },
    th: { "ChillPay": "Payment Gateway" },
    ko: { "ChillPay": "Payment Gateway" },
    ja: { "ChillPay": "Payment Gateway" },
  },
  "admin.chillpay.title-html": {
    en: { "ChillPay <span class=\"grad\">events</span>": "Payment Gateway <span class=\"grad\">events</span>" },
    th: { "ChillPay <span class=\"grad\">Events</span>": "Payment Gateway <span class=\"grad\">Events</span>" },
    ko: { "ChillPay <span class=\"grad\">이벤트</span>": "Payment Gateway <span class=\"grad\">이벤트</span>" },
    ja: { "ChillPay <span class=\"grad\">イベント</span>": "Payment Gateway <span class=\"grad\">イベント</span>" },
  },
  "admin.chillpay.sub": {
    en: { "Audit log of every payment creation and callback from ChillPay. Use this to debug checksum mismatches, missing callbacks, or status discrepancies.": "Audit log of every payment creation and callback from Payment Gateway. Use this to debug checksum mismatches, missing callbacks, or status discrepancies." },
    th: { "บันทึกตรวจสอบทุกครั้งที่สร้างการชำระเงินและรับ callback จาก ChillPay ใช้เพื่อตรวจสอบ checksum ที่ไม่ตรง callback ที่หายไป หรือสถานะที่ไม่สอดคล้อง": "บันทึกตรวจสอบทุกครั้งที่สร้างการชำระเงินและรับ callback จาก Payment Gateway ใช้เพื่อตรวจสอบ checksum ที่ไม่ตรง callback ที่หายไป หรือสถานะที่ไม่สอดคล้อง" },
    ko: { "ChillPay에서 발생한 모든 결제 생성 및 콜백 감사 로그. 체크섬 불일치, 누락된 콜백 또는 상태 불일치를 디버그하는 데 사용합니다.": "Payment Gateway에서 발생한 모든 결제 생성 및 콜백 감사 로그. 체크섬 불일치, 누락된 콜백 또는 상태 불일치를 디버그하는 데 사용합니다." },
    ja: { "ChillPayからの決済作成およびコールバックの監査ログ。チェックサムの不一致、欠落したコールバック、ステータスの不一致をデバッグするために使用します。": "Payment Gatewayからの決済作成およびコールバックの監査ログ。チェックサムの不一致、欠落したコールバック、ステータスの不一致をデバッグするために使用します。" },
  },
  "admin.chillpay.endpoint.hint": {
    en: { "Server-to-server callback. Configure this URL in your ChillPay merchant dashboard → Settings → Payment Channel → URL Background (for each enabled channel). This is the source of truth for payment status.": "Server-to-server callback. Configure this URL in your Payment Gateway merchant dashboard → Settings → Payment Channel → URL Background (for each enabled channel). This is the source of truth for payment status." },
    th: { "Callback แบบ server-to-server ตั้งค่า URL นี้ใน ChillPay merchant dashboard → Settings → Payment Channel → URL Background (สำหรับทุกช่องทางที่เปิดใช้งาน) นี่คือแหล่งข้อมูลหลักของสถานะการชำระเงิน": "Callback แบบ server-to-server ตั้งค่า URL นี้ใน Payment Gateway merchant dashboard → Settings → Payment Channel → URL Background (สำหรับทุกช่องทางที่เปิดใช้งาน) นี่คือแหล่งข้อมูลหลักของสถานะการชำระเงิน" },
    ko: { "서버 간 콜백입니다. ChillPay 가맹점 대시보드 → 설정 → 결제 채널 → URL Background에서 이 URL을 구성하세요 (활성화된 각 채널에 대해). 결제 상태의 신뢰할 수 있는 정보 소스입니다.": "서버 간 콜백입니다. Payment Gateway 가맹점 대시보드 → 설정 → 결제 채널 → URL Background에서 이 URL을 구성하세요 (활성화된 각 채널에 대해). 결제 상태의 신뢰할 수 있는 정보 소스입니다." },
    ja: { "サーバー間コールバック。ChillPay加盟店ダッシュボード → 設定 → 決済チャネル → URL Background でこのURLを構成してください (有効な各チャネルに対して)。これが決済ステータスの信頼できる情報源です。": "サーバー間コールバック。Payment Gateway加盟店ダッシュボード → 設定 → 決済チャネル → URL Background でこのURLを構成してください (有効な各チャネルに対して)。これが決済ステータスの信頼できる情報源です。" },
  },
  "admin.chillpay.result.hint": {
    en: { "Browser-side return after payment. Configure this URL in your ChillPay merchant dashboard → Settings → Payment Channel → URL Result (for each enabled channel). ChillPay POSTs the customer's browser to this URL; the page shows them the payment outcome.": "Browser-side return after payment. Configure this URL in your Payment Gateway merchant dashboard → Settings → Payment Channel → URL Result (for each enabled channel). Payment Gateway POSTs the customer's browser to this URL; the page shows them the payment outcome." },
    th: { "การเปลี่ยนเส้นทางผ่าน browser หลังชำระเงิน ตั้งค่า URL นี้ใน ChillPay merchant dashboard → Settings → Payment Channel → URL Result (สำหรับทุกช่องทางที่เปิดใช้งาน) ChillPay จะส่ง POST browser ของลูกค้ามายัง URL นี้ และหน้านี้จะแสดงผลการชำระเงินให้ลูกค้าดู": "การเปลี่ยนเส้นทางผ่าน browser หลังชำระเงิน ตั้งค่า URL นี้ใน Payment Gateway merchant dashboard → Settings → Payment Channel → URL Result (สำหรับทุกช่องทางที่เปิดใช้งาน) Payment Gateway จะส่ง POST browser ของลูกค้ามายัง URL นี้ และหน้านี้จะแสดงผลการชำระเงินให้ลูกค้าดู" },
    ko: { "결제 후 브라우저 측 반환. ChillPay 가맹점 대시보드 → 설정 → 결제 채널 → URL Result에서 이 URL을 구성하세요 (활성화된 각 채널에 대해). ChillPay는 고객의 브라우저를 이 URL로 POST하며, 페이지에서 결제 결과를 표시합니다.": "결제 후 브라우저 측 반환. Payment Gateway 가맹점 대시보드 → 설정 → 결제 채널 → URL Result에서 이 URL을 구성하세요 (활성화된 각 채널에 대해). Payment Gateway는 고객의 브라우저를 이 URL로 POST하며, 페이지에서 결제 결과를 표시합니다." },
    ja: { "決済後のブラウザ側リターン。ChillPay加盟店ダッシュボード → 設定 → 決済チャネル → URL Result でこのURLを構成してください (有効な各チャネルに対して)。ChillPayは顧客のブラウザをこのURLにPOSTし、ページで決済結果を表示します。": "決済後のブラウザ側リターン。Payment Gateway加盟店ダッシュボード → 設定 → 決済チャネル → URL Result でこのURLを構成してください (有効な各チャネルに対して)。Payment Gatewayは顧客のブラウザをこのURLにPOSTし、ページで決済結果を表示します。" },
  },
  "admin.chillpay.events.h": {
    en: { "Recent ChillPay events": "Recent Payment Gateway events" },
    th: { "เหตุการณ์ ChillPay ล่าสุด": "เหตุการณ์ Payment Gateway ล่าสุด" },
    ko: { "최근 ChillPay 이벤트": "최근 Payment Gateway 이벤트" },
    ja: { "最近のChillPayイベント": "最近のPayment Gatewayイベント" },
  },
  "admin.chillpay.col.orderno": {
    en: { "ChillPay OrderNo": "Payment Gateway OrderNo" },
    th: { "ChillPay OrderNo": "Payment Gateway OrderNo" },
    ko: { "ChillPay OrderNo": "Payment Gateway OrderNo" },
    ja: { "ChillPay OrderNo": "Payment Gateway OrderNo" },
  },
  "admin.chillpay.empty": {
    en: { "No ChillPay events yet. Once customers start paying through ChillPay, every API call and callback will appear here.": "No Payment Gateway events yet. Once customers start paying through Payment Gateway, every API call and callback will appear here." },
    th: { "ยังไม่มี ChillPay events เมื่อลูกค้าเริ่มชำระเงินผ่าน ChillPay ทุก API call และ callback จะปรากฏที่นี่": "ยังไม่มี Payment Gateway events เมื่อลูกค้าเริ่มชำระเงินผ่าน Payment Gateway ทุก API call และ callback จะปรากฏที่นี่" },
    ko: { "아직 ChillPay 이벤트가 없습니다. 고객이 ChillPay를 통해 결제하기 시작하면 모든 API 호출과 콜백이 여기에 표시됩니다.": "아직 Payment Gateway 이벤트가 없습니다. 고객이 Payment Gateway를 통해 결제하기 시작하면 모든 API 호출과 콜백이 여기에 표시됩니다." },
    ja: { "ChillPayイベントはまだありません。お客様がChillPay経由で支払いを開始すると、すべてのAPI呼び出しとコールバックがここに表示されます。": "Payment Gatewayイベントはまだありません。お客様がPayment Gateway経由で支払いを開始すると、すべてのAPI呼び出しとコールバックがここに表示されます。" },
  },
  "toast.chillpay.redirecting": {
    en: { "Redirecting to ChillPay…": "Redirecting to Payment Gateway…" },
    th: { "กำลังเปลี่ยนเส้นทางไปยัง ChillPay…": "กำลังเปลี่ยนเส้นทางไปยัง Payment Gateway…" },
    ko: { "ChillPay로 이동 중…": "Payment Gateway로 이동 중…" },
    ja: { "ChillPayにリダイレクト中…": "Payment Gatewayにリダイレクト中…" },
  },
};

const I = {
  // Translate a key with optional placeholders.
  //
  // Two kinds of placeholder substitution happen here:
  //   1. {brand} — auto-substituted with State.branding.siteName so any i18n
  //      string that mentions the product name updates the moment the admin
  //      changes Site Name in Branding (real-time via Firestore onSnapshot).
  //      Used in hero.lede, login.sub, etc. — anywhere the brand appears as
  //      part of a sentence.
  //   2. Caller-supplied `ph` object — for one-off variables like {n}, {date},
  //      {credits} etc. Caller-supplied values win if a key collides.
  t(key, ph={}){
    const lang = State.currentLang;
    let v = (State.strings[lang] && State.strings[lang][key])
         || (State.strings.en && State.strings.en[key])
         || DEFAULT_STRINGS[key]
         || key;
    // Apply stale-value overrides (so renamed strings flip immediately
    // without needing a manual Firestore edit)
    const ovr = STALE_VALUE_OVERRIDES[key];
    if(ovr){
      const langMap = ovr[lang] || ovr.en;
      if(langMap && langMap[v] != null) v = langMap[v];
    }
    // Auto-inject {brand} from current branding state if the string uses it
    // and the caller didn't pass a custom value. Fast path: skip the work
    // if the string has no '{brand}' substring.
    if(ph.brand === undefined && v.indexOf("{brand}") !== -1){
      const brand = (State.branding && State.branding.siteName)
                  || (typeof DEFAULT_BRANDING !== "undefined" && DEFAULT_BRANDING.siteName)
                  || "Deal Pro";
      v = v.replace(/\{brand\}/g, brand);
    }
    Object.keys(ph).forEach(k => { v = v.replace(new RegExp(`{${k}}`,'g'), ph[k]); });
    // Provider-name migration: any time a translated string mentions "ChillPay"
    // (the legacy provider name baked into Firestore from an earlier seed),
    // replace it with the neutral "Payment Gateway" wording at render time.
    // This catches strings the STALE_VALUE_OVERRIDES table missed — e.g. when
    // an admin had hand-edited the value through the Translations admin UI so
    // the exact-string match against the original seed no longer works.
    // Two case variants are handled. Safe to apply unconditionally because no
    // current i18n VALUE intentionally contains the word "ChillPay" anymore.
    if(v.indexOf("ChillPay") !== -1) v = v.replace(/ChillPay/g, "Payment Gateway");
    if(v.indexOf("Chillpay") !== -1) v = v.replace(/Chillpay/g, "Payment Gateway");
    // Customer-portal product-name migration: in the customer-facing account
    // strings only (keys under "account.dmchamp."), the workspace is branded
    // "Ai Portal" instead of "DM Champ". This is scoped to account.dmchamp.*
    // ON PURPOSE — the admin console still refers to the provider as "DM Champ"
    // (that's the real product admins configure). Applying it here unconditionally
    // catches any Firestore value (seeded or hand-edited) the STALE table missed,
    // mirroring the ChillPay→Payment Gateway approach above. Safe because every
    // current account.dmchamp.* VALUE is meant to read "Ai Portal".
    if(key.indexOf("account.dmchamp.") === 0 && v.indexOf("DM Champ") !== -1){
      v = v.replace(/DM Champ/g, "Ai Portal");
    }
    return v;
  },

  // Apply i18n to all [data-i18n] elements currently in DOM
  apply(){
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const value = this.t(key);
      // Keys ending with -html are interpreted as HTML; others as text
      if(key.endsWith("-html")) el.innerHTML = value;
      else el.textContent = value;
    });
  },

  // Compute per-language coverage and locked status (locked if < 90%)
  recalcStatus(){
    const total = Object.keys(DEFAULT_STRINGS).length;
    State.langStatus = {};
    State.langs.forEach(l => {
      if(l.code === "en"){
        State.langStatus.en = { pct:100, count:total, total, locked:false, isMaster:true };
        return;
      }
      const dict = State.strings[l.code] || {};
      let filled = 0;
      Object.keys(DEFAULT_STRINGS).forEach(k => {
        if(dict[k] && dict[k].trim() !== "") filled++;
      });
      const pct = Math.round((filled / total) * 100);
      State.langStatus[l.code] = { pct, count:filled, total, locked: pct < 90, isMaster:false };
    });
  }
};

// ===========================================================
// FIRESTORE — load + subscribe
// ===========================================================
async function loadOrSeedTranslations(){
  // For each supported language, fetch its document. Seed English if missing.
  const langsCol = collection(db, "translations");

  // Seed English master if not present
  const enRef = doc(db, "translations", "en");
  const enSnap = await getDoc(enRef);
  if(!enSnap.exists()){
    await setDoc(enRef, { strings: DEFAULT_STRINGS, updatedAt: serverTimestamp() });
  }

  // Seed Thai with partial translation as example (94% to keep parity with mock-up)
  const thRef = doc(db, "translations", "th");
  const thSnap = await getDoc(thRef);
  if(!thSnap.exists()){
    const thStrings = {};
    // Translate a meaningful portion to demonstrate the language being available
    Object.assign(thStrings, {
      "nav.home":"หน้าหลัก", "nav.packages":"แพ็คเกจ", "nav.admin":"ผู้ดูแลระบบ", "nav.login":"เข้าสู่ระบบ", "nav.signout":"ออกจากระบบ",
      "drawer.title":"เมนู", "drawer.lang":"ภาษา", "drawer.account":"บัญชี",
      "hero.eyebrow":"AI ตัวแทนขายอัจฉริยะ · ระบบสด",
      "hero.title-html":'ขาย<br/>ขณะที่คุณ<span class="grad">หลับ</span><br/><span class="outline">ได้จริง</span>',
      "hero.lede":"{brand} คือ AI ตัวแทนขายอัจฉริยะที่คัดกรองลูกค้า รับมือกับข้อโต้แย้ง นัดหมาย และปิดการขายผ่าน WhatsApp, Instagram, Messenger และเว็บไซต์ของคุณ — ตลอด 24 ชั่วโมง รองรับ 4 ภาษา",
      "hero.cta-primary":"ดูแพ็คเกจ", "hero.cta-secondary":"เปิดหน้าผู้ดูแล",
      "caps.num":"01 / ความสามารถ",
      "caps.title-html":'ไม่ใช่บอท. คือ<span class="grad">นักปิดการขาย</span>',
      "caps.lede":"แค่วาง URL เว็บไซต์ของคุณ AI จะอ่านสินค้า ราคา และจุดขาย และเริ่มขายภายใน 15 นาที — ไม่ต้องเขียนโค้ดหรือ prompt",
      "cap.01.t":"เสมือนมนุษย์", "cap.01.d":"สนทนาได้ทั้งข้อความเสียง รูปภาพ วิดีโอ และ PDF เสมือนนักขายที่เก่งที่สุดของคุณ",
      "cap.02.t":"หลายช่องทาง", "cap.02.d":"WhatsApp · Instagram · Messenger · เว็บแชท — ความจำเดียวกันทุกช่องทาง",
      "cap.03.t":"ติดตั้งใน 15 นาที", "cap.03.d":"วาง URL เว็บไซต์ AI จะอ่านสินค้าและราคาให้อัตโนมัติ ไม่ต้องเขียนโค้ด",
      "cap.04.t":"เข้าใจหลายสื่อ", "cap.04.d":"เข้าใจข้อความเสียง รูปภาพ เอกสาร PDF และวิดีโอ — ไม่ใช่แค่ข้อความ",
      "cap.05.t":"จองนัดในแชท", "cap.05.d":"ตรวจจับสัญญาณซื้อและนัดหมายในแชทเลย ไม่ต้องส่งลิงก์ภายนอก",
      "cap.06.t":"จดจำบริบท", "cap.06.d":"จดจำการสนทนาและความชอบของลูกค้าแต่ละคนเพื่อสร้างความสัมพันธ์ระยะยาว",
      "cap.07.t":"แคมเปญและติดตาม", "cap.07.d":"ส่งข้อความ Outbound, ติดตามอัตโนมัติ และ Comment-to-DM บน IG และ Facebook",
      "cap.08.t":"พัฒนาตัวเอง", "cap.08.d":"One-click optimization วิเคราะห์บทสนทนาที่ปิดได้ดีที่สุดเพื่อยกระดับ Conversion rate",
      "pkg.num":"02 / ราคา",
      "pkg.title-html":'สามวิธีในการ<span class="grad">เริ่มต้น</span>',
      "pkg.lede":"จ่ายตามใช้ ใช้ไม่จำกัดเป็นรายวัน หรือสมัครสมาชิกรายเดือน — ทุกแพ็คเกจเปิดใช้ทันทีพร้อมส่งข้อมูลเข้าใช้ผ่านอีเมล",
      "pkg.tab.credit":"ซื้อเครดิต", "pkg.tab.onetime":"เข้าใช้ครั้งเดียว", "pkg.tab.sub":"สมาชิก",
      "pkg.sub.note":"เครดิตในแพ็คเกจสมาชิกจะหมดอายุเมื่อครบรอบ หากต้องการใช้ต่อก่อนรอบใหม่ ให้เติมเครดิตเพิ่ม",
      "pkg.select":"เลือก", "pkg.subscribe":"สมัคร", "pkg.configure":"กำหนดเอง", "pkg.featured":"ยอดนิยม",
      "pkg.manual.title":"กำหนดจำนวนเอง", "pkg.manual.desc":"ใส่จำนวนเงินที่ต้องการ — ใช้สำหรับเติมเพิ่มหรือรับยอดจาก ontheline",
      "pkg.manual.label":"ใส่จำนวน (USD)",
      "pkg.credit.5.t":"เริ่มต้น", "pkg.credit.5.d":"เติมเครดิตเล็กน้อยสำหรับทดลองและแคมเปญเล็ก",
      "pkg.credit.10.t":"พื้นฐาน", "pkg.credit.10.d":"เครดิตพอใช้สำหรับ 1 สัปดาห์",
      "pkg.credit.20.t":"สตูดิโอ", "pkg.credit.20.d":"จุดที่ดีที่สุดสำหรับ Freelance และที่ปรึกษา",
      "pkg.credit.50.t":"อตอเลีย", "pkg.credit.50.d":"สำหรับทีมเล็กที่ทำแคมเปญพร้อมกัน",
      "pkg.credit.100.t":"องค์กร", "pkg.credit.100.d":"สำหรับเอเจนซี่และผู้ขายปริมาณมาก",
      "checkout.num":"03 / ชำระเงิน",
      "checkout.title-html":'เกือบ<span class="grad">เป็นของคุณ</span>',
      "checkout.section.customer":"ข้อมูลลูกค้า", "checkout.section.payment":"วิธีชำระเงิน", "checkout.section.delivery":"จัดส่งใบเสร็จ",
      "checkout.field.name":"ชื่อ-นามสกุล", "checkout.field.email":"อีเมล", "checkout.field.company":"บริษัท", "checkout.field.country":"ประเทศ",
      "checkout.field.card":"หมายเลขบัตร", "checkout.field.expiry":"วันหมดอายุ", "checkout.field.cvc":"CVC",
      "checkout.field.via":"ส่งใบเสร็จทาง", "checkout.field.lang":"ภาษาของใบเสร็จ",
      "checkout.summary.title":"สรุปคำสั่งซื้อ", "checkout.summary.package":"แพ็คเกจ", "checkout.summary.activation":"การเปิดใช้งาน",
      "checkout.summary.activation-val":"ทันที", "checkout.summary.subtotal":"ยอดรวม", "checkout.summary.vat":"VAT 7%",
      "checkout.summary.total":"ยอดทั้งหมด", "checkout.summary.cta":"ยืนยันและชำระ", "checkout.summary.secure":"เข้ารหัส 256-bit · PCI DSS",
      "confirm.title-html":'ยินดีต้อนรับ <span class="grad">{name}</span>',
      "confirm.sub":"AI Agent ของคุณกำลังเตรียมพร้อม ข้อมูลเข้าใช้และใบเสร็จได้ส่งไปที่ {email} แล้ว ใช้เวลาไม่เกิน 5 นาที",
      "confirm.ref":"เลขที่คำสั่งซื้อ", "confirm.package":"แพ็คเกจ", "confirm.amount":"ยอดชำระ",
      "confirm.portal":"ลิงก์เข้าใช้งาน", "confirm.invoice":"ใบกำกับภาษี/ใบเสร็จ", "confirm.invoice-val":"PDF · ส่งทางอีเมล",
      "confirm.cta-portal":"เปิด Portal", "confirm.cta-back":"กลับไปหน้าแพ็คเกจ",
      "footer.tag":"AI ตัวแทนขายที่ปิดการขาย 24/7",
      "admin.side.packages":"จัดการแพ็คเกจ",
      "admin.packages.title-html":'จัดการ<span class="grad">แพ็คเกจ</span>',
      "admin.packages.add":"เพิ่มแพ็คเกจ",
      "admin.packages.bucket.credit":"ซื้อเครดิต (Credit Purchase)",
      "admin.packages.bucket.onetime":"เข้าใช้ครั้งเดียว (1-Time Access)",
      "admin.packages.bucket.sub":"สมาชิก (Subscription)",
      "admin.packages.col.order":"ลำดับ",
      "admin.packages.col.id":"ID",
      "admin.packages.col.title":"ชื่อ",
      "admin.packages.col.desc":"คำอธิบาย",
      "admin.packages.col.price":"ราคา",
      "admin.packages.col.featured":"แนะนำ",
      "admin.packages.col.actions":"จัดการ",
      "admin.packages.action.edit":"แก้ไข",
      "admin.packages.action.delete":"ลบ"
    });
    await setDoc(thRef, { strings: thStrings, updatedAt: serverTimestamp() });
  }

  // Korean and Japanese — seed with partial translations so they show as "locked"
  for(const lc of ["ko","ja"]){
    const lref = doc(db, "translations", lc);
    const lsnap = await getDoc(lref);
    if(!lsnap.exists()){
      const partial = lc === "ko"
        ? { "nav.home":"홈", "nav.packages":"패키지", "nav.admin":"관리자", "nav.login":"로그인", "nav.signout":"로그아웃",
            "pkg.tab.credit":"크레딧 구매", "pkg.featured":"인기" }
        : { "nav.home":"ホーム", "nav.packages":"パッケージ", "nav.admin":"管理者", "nav.login":"ログイン", "nav.signout":"ログアウト" };
      await setDoc(lref, { strings: partial, updatedAt: serverTimestamp() });
    }
  }

  // Now load all into state
  const snap = await getDocs(langsCol);
  State.strings = {};
  snap.forEach(d => { State.strings[d.id] = (d.data().strings) || {}; });
  I.recalcStatus();
}

// Check whether any admin exists. Returns true if at least one admin user document is present.
// We don't try to auto-create the admin anymore — Firebase Auth needs an interactive flow,
// so first-time setup is handled by the login modal showing a "Setup" mode instead.
// Load packages from Firestore into the live PACKAGES global.
// This is PUBLIC — anyone can read packages (rules allow read).
// If the collection is empty, we fall back to DEFAULT_PACKAGES for display
// until an admin signs in and seeds the collection.
async function loadPackages(){
  try{
    const snap = await getDocs(collection(db,"packages"));
    if(snap.empty){
      // Use defaults for now; seeding requires admin and happens after login.
      PACKAGES = JSON.parse(JSON.stringify(DEFAULT_PACKAGES));
      State.packagesNeedSeeding = true;
    }else{
      hydratePackagesFromSnap(snap);
      State.packagesNeedSeeding = false;
    }
  }catch(e){
    console.warn("loadPackages failed:", e.code || e.message);
    PACKAGES = JSON.parse(JSON.stringify(DEFAULT_PACKAGES));
  }
}

// Seed default packages into Firestore. Only callable when an admin is signed in.
async function seedPackagesIfNeeded(){
  if(!State.user) return;             // Need admin auth
  if(!State.packagesNeedSeeding) return; // Already populated
  try{
    // Double-check the collection is still empty (avoid duplicate seed on race)
    const snap = await getDocs(collection(db,"packages"));
    if(!snap.empty){
      hydratePackagesFromSnap(snap);
      State.packagesNeedSeeding = false;
      return;
    }
    const allDefaults = [
      ...DEFAULT_PACKAGES.credit.map(p => ({ ...p, bucket:"credit" })),
      ...DEFAULT_PACKAGES.onetime.map(p => ({ ...p, bucket:"onetime" })),
      ...DEFAULT_PACKAGES.sub.map(p => ({ ...p, bucket:"sub" }))
    ];
    let seeded = 0;
    for(const p of allDefaults){
      try{
        await setDoc(doc(db,"packages",p.id), {
          ...p,
          title: I.t(p.titleKey), // Bake in English text as the title
          desc:  I.t(p.descKey),  // Bake in English text as the description
          createdAt: serverTimestamp()
        });
        seeded++;
      }catch(seedErr){
        console.warn("Package seed failed for", p.id, "—", seedErr.code || seedErr.message);
      }
    }
    State.packagesNeedSeeding = false;
    if(seeded > 0){
      Toast.show(`Seeded ${seeded} default packages`,"ok");
    }
  }catch(e){
    console.warn("seedPackagesIfNeeded failed:", e.code || e.message);
  }
}

// Auto-fill missing translation keys in Firestore from the bundled FULL_TRANSLATIONS.
// Called once on admin login. Only writes keys that don't already exist in Firestore —
// never overwrites custom edits made through the Languages console.
async function syncMissingTranslationsToFirestore(){
  if(!State.user) return;

  // FORCED OVERWRITES: strings we've intentionally renamed in a later release.
  // Format: { lang: { key: { oldValues: [...], newValue: "..." } } }
  // For each entry, if Firestore currently holds one of the listed old values,
  // we overwrite it with the new value. This is safe because we ONLY touch
  // values that match what we previously shipped — never edits the admin's
  // custom translations.
  const FORCED_RENAMES = {
    th: { "nav.login": { oldValues: ["เข้าสู่ระบบผู้ดูแล"], newValue: "เข้าสู่ระบบ" } },
    ko: { "nav.login": { oldValues: ["관리자 로그인"], newValue: "로그인" } },
    ja: { "nav.login": { oldValues: ["管理者ログイン"], newValue: "ログイン" } }
  };

  let totalAdded = 0;
  let totalRenamed = 0;
  for(const lc of Object.keys(FULL_TRANSLATIONS)){
    try{
      const ref = doc(db,"translations",lc);
      const snap = await getDoc(ref);
      const existing = snap.exists() ? (snap.data().strings || {}) : {};

      // Find keys present in FULL_TRANSLATIONS but missing from Firestore
      const missing = {};
      for(const [k,v] of Object.entries(FULL_TRANSLATIONS[lc])){
        if(!(k in existing)) missing[k] = v;
      }
      const addedCount = Object.keys(missing).length;

      // Apply forced renames for this language (only when value matches a known old value)
      const renames = {};
      const langRenames = FORCED_RENAMES[lc] || {};
      for(const [k, rule] of Object.entries(langRenames)){
        const current = existing[k];
        if(current && rule.oldValues.includes(current) && current !== rule.newValue){
          renames[k] = rule.newValue;
        }
      }
      const renamedCount = Object.keys(renames).length;

      if(addedCount === 0 && renamedCount === 0) continue;

      const merged = { ...existing, ...missing, ...renames };
      await setDoc(ref, { strings: merged, updatedAt: serverTimestamp() }, { merge: true });
      State.strings[lc] = merged;
      totalAdded   += addedCount;
      totalRenamed += renamedCount;
    }catch(e){
      console.warn(`syncMissingTranslations[${lc}] failed:`, e.code || e.message);
    }
  }
  if(totalAdded > 0 || totalRenamed > 0){
    I.recalcStatus();
    I.apply();
    App.buildLangPicker();
    if(totalAdded > 0)   console.info(`Auto-added ${totalAdded} new translation entries to Firestore`);
    if(totalRenamed > 0) console.info(`Auto-renamed ${totalRenamed} stale translation entries in Firestore`);
  }
}

function hydratePackagesFromSnap(snap){
  const next = { credit:[], onetime:[], sub:[] };
  snap.forEach(d => {
    const data = d.data();
    if(next[data.bucket]) next[data.bucket].push({ id:d.id, ...data });
  });
  // Sort each bucket by order (fallback price)
  Object.keys(next).forEach(k => {
    next[k].sort((a,b) => (a.order ?? 999) - (b.order ?? 999) || a.price - b.price);
  });

  const totalLoaded = next.credit.length + next.onetime.length + next.sub.length;
  if(totalLoaded === 0){
    // Snapshot is empty (collection has no docs, or all were deleted).
    // Keep DEFAULT_PACKAGES so customers still see something to buy,
    // and flag that seeding is needed.
    PACKAGES = JSON.parse(JSON.stringify(DEFAULT_PACKAGES));
    State.packagesNeedSeeding = true;
  }else{
    PACKAGES = next;
    State.packagesNeedSeeding = false;
  }
}

// Check whether any admin exists. Returns true/false/null (null = can't tell due to rules).
async function adminExists(){
  try{
    const q = query(collection(db,"users"), where("role","==","admin"));
    const snap = await getDocs(q);
    return !snap.empty;
  }catch(e){
    console.warn("adminExists check failed:", e.code || e.message);
    if(e.code === "permission-denied"){
      // Rules are blocking us. Show a clear banner.
      State.rulesBlocked = true;
      return null; // signal "unknown"
    }
    return false;
  }
}

// Show a top banner instructing the user to fix Firestore rules
function showRulesBanner(){
  if(document.getElementById("rules-banner")) return;
  const banner = document.createElement("div");
  banner.id = "rules-banner";
  banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:1000;background:#c8463d;color:#fff;padding:10px 16px;font-family:'Kanit',sans-serif;font-size:13px;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.2);line-height:1.5";
  banner.innerHTML = `
    <strong>⚠ Firestore Security Rules are blocking access.</strong>
    Open Firebase Console → Firestore → Rules and publish the rules from the README.
    For local testing only: <code style="background:rgba(0,0,0,.25);padding:2px 6px;border-radius:4px;font-family:monospace">allow read, write: if true;</code>
    <button onclick="document.getElementById('rules-banner').remove()" style="margin-left:12px;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;padding:3px 10px;border-radius:6px;cursor:pointer;font-size:11px">Dismiss</button>
  `;
  document.body.appendChild(banner);
  // Push topbar down so it's not hidden
  const topbar = document.querySelector(".topbar");
  if(topbar) topbar.style.marginTop = banner.offsetHeight + "px";
}

// ============================================================
// Subscription error handler — shared by admin and customer subscriptions
// ============================================================
// Returns an onSnapshot error callback that:
//   * silently ignores errors after sign-out (transient until unsub runs)
//   * shows a clear toast for permission-denied (likely Firestore Rules issue)
//   * surfaces other errors to console + toast
function onErr(label){
  return (err) => {
    if(!State.user) return;   // We've signed out — ignore lingering errors
    if(err.code === "permission-denied"){
      console.warn(`[${label}] subscription denied — auth state or rules block`);
      Toast.show(`Cannot read ${label}: permission denied. Check Firestore Rules.`,"warn");
    }else{
      console.error(`[${label}] subscription error:`, err);
      Toast.show(`Subscription error on ${label}: ${err.code || err.message}`,"err");
    }
  };
}

function subscribeCollections(){
  // Unsubscribe any prior subscriptions before creating new ones
  unsubscribeCollections();

  // Guard: only subscribe to admin-only collections when an admin is signed in.
  // Otherwise listeners spam permission-denied errors.
  if(!State.user){
    console.info("subscribeCollections skipped — no signed-in admin");
    return;
  }

  // Orders
  const ordersQ = query(collection(db,"orders"), orderBy("createdAt","desc"), limit(50));
  State.unsubs.push(onSnapshot(ordersQ, snap => {
    State.orders = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if(document.getElementById("page-admin").classList.contains("show")) renderAdminOrders();
  }, onErr("orders")));

  // Users
  State.unsubs.push(onSnapshot(collection(db,"users"), snap => {
    State.users = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if(document.getElementById("page-admin").classList.contains("show")) renderAdminUsers();
  }, onErr("users")));

  // Email queue
  const emQ = query(collection(db,"email_queue"), orderBy("createdAt","desc"), limit(50));
  State.unsubs.push(onSnapshot(emQ, snap => {
    State.emails = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if(document.getElementById("page-admin").classList.contains("show")) renderAdminEmails();
  }, onErr("email_queue")));

  // Webhook events
  const whQ = query(collection(db,"webhook_events"), orderBy("createdAt","desc"), limit(50));
  State.unsubs.push(onSnapshot(whQ, snap => {
    State.webhookEvents = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if(document.getElementById("page-admin").classList.contains("show")) renderAdminWebhook();
  }, onErr("webhook_events")));

  // Payment gateway audit log (both create-payment and callback entries).
  //
  // Events now land in `payment_events` (with a `gateway` field so multiple
  // providers share one log). `chillpay_events` is the pre-refactor collection,
  // kept for history — we subscribe to BOTH and merge so the admin sees an
  // unbroken timeline. Docs use either `createdAt` (create-payment) or
  // `receivedAt` (callback), so sorting happens client-side over the merged set.
  const mergePaymentEvents = () => {
    const rows = [...(State._payEventsNew || []), ...(State._payEventsLegacy || [])];
    rows.sort((a,b) => {
      const ta = (a.receivedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0);
      const tb = (b.receivedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0);
      return tb - ta;
    });
    State.chillpayEvents = rows.slice(0, 100);
    if(document.getElementById("page-admin").classList.contains("show")) {
      const activeView = document.querySelector(".side-item.active")?.dataset.admin;
      if(activeView === "chillpay") renderAdminChillPay();
    }
  };

  const peQ = query(collection(db,"payment_events"), limit(100));
  State.unsubs.push(onSnapshot(peQ, snap => {
    State._payEventsNew = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    mergePaymentEvents();
  }, onErr("payment_events")));

  const cpQ = query(collection(db,"chillpay_events"), limit(100));
  State.unsubs.push(onSnapshot(cpQ, snap => {
    // Legacy docs predate the `gateway` field — they were all ChillPay.
    State._payEventsLegacy = snap.docs.map(d => ({ id:d.id, gateway:"chillpay", ...d.data() }));
    mergePaymentEvents();
  }, onErr("chillpay_events")));

  // Webhook config (single doc at config/webhook) — holds the shared HMAC secret
  // for ontheline. The Netlify function reads this same doc to verify incoming
  // signatures, so changes from the UI take effect immediately.
  const whCfgRef = doc(db,"config","webhook");
  State.unsubs.push(onSnapshot(whCfgRef, snap => {
    State.webhookConfig = snap.exists() ? snap.data() : { secret: null, updatedAt: null, updatedBy: null };
    if(document.getElementById("page-admin")?.classList.contains("show")) {
      const activeView = document.querySelector(".side-item.active")?.dataset.admin;
      if(activeView === "webhook") renderAdminWebhook();
    }
  }, onErr("config/webhook")));
  // ontheline Partners + Payment Gateways (admin-managed reference lists).
  // Each doc: { code, companyName, createdAt }. Used to validate incoming
  // ontheline webhooks and to populate Order filters/columns.
  State.unsubs.push(onSnapshot(collection(db,"ontheline_partners"), snap => {
    State.onthelinePartners = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if(document.getElementById("page-admin").classList.contains("show")){
      const v = document.querySelector(".side-item.active")?.dataset.admin;
      if(v === "partners") renderAdminPartners();
      if(v === "orders") renderAdminOrders();
    }
  }, onErr("ontheline_partners")));

  State.unsubs.push(onSnapshot(collection(db,"ontheline_paygw"), snap => {
    State.onthelinePaygw = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if(document.getElementById("page-admin").classList.contains("show")){
      const v = document.querySelector(".side-item.active")?.dataset.admin;
      if(v === "paygw") renderAdminPaygw();
      if(v === "orders") renderAdminOrders();
    }
  }, onErr("ontheline_paygw")));

  // ontheline accepted currencies — each doc: { code, symbol, label, createdAt }.
  // Used to validate the webhook `currency` param + render Orders amounts with
  // the right symbol and a USD-converted value in parentheses.
  State.unsubs.push(onSnapshot(collection(db,"ontheline_currencies"), snap => {
    State.onthelineCurrencies = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    if(document.getElementById("page-admin").classList.contains("show")){
      const v = document.querySelector(".side-item.active")?.dataset.admin;
      if(v === "currencies") renderAdminCurrencies();
      if(v === "orders") renderAdminOrders();
    }
  }, onErr("ontheline_currencies")));
}

function unsubscribeCollections(){
  (State.unsubs || []).forEach(fn => { try{ fn(); }catch{} });
  State.unsubs = [];
}

// Subscribe to a customer's own orders (scoped by email). Customers have
// no admin privileges; Firestore Rules restrict reads to orders where
// customer.email == request.auth.token.email. We don't subscribe to users,
// packages (handled via subscribePackages), or any of the admin-only
// collections (chillpay_events, webhook_events, email_queue).
function subscribeCustomerCollections(){
  unsubscribeCollections();
  if(!State.user?.email){
    console.warn("subscribeCustomerCollections called without an authed user email");
    return;
  }

  // Customer's own orders
  const oQ = query(
    collection(db,"orders"),
    where("customer.email","==", State.user.email)
  );
  State.unsubs.push(onSnapshot(oQ, snap => {
    const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    // Newest first
    rows.sort((a,b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    State.orders = rows;
    // Re-render whichever portal page is currently visible
    if(document.getElementById("page-account")?.classList.contains("show")) renderCustomerAccount();
    if(document.getElementById("page-orders")?.classList.contains("show")) renderCustomerOrders();
  }, onErr("orders (customer)")));
}

// Subscribe to packages — PUBLIC subscription (no auth required, rules allow read).
// This is what keeps the customer-facing Packages page in sync with admin edits.
// Stored separately so it doesn't get cleared on signOut.
// ===========================================================
// BRANDING
// ===========================================================
// Defaults shipped with the app. The default logo is the original Deal Pro
// shopping-cart image, embedded as a base64 PNG so it works fully offline
// (no network fetch). When an admin uploads a custom logo via the Branding
// admin view, it gets written to Firestore (config/branding.logoDataUrl)
// and overrides this fallback on every browser via the realtime listener.
const DEFAULT_BRANDING = {
  siteName: "Deal Pro",
  // Default site name in HTML wordmark glyph (the "D" in the box)
  // Used to compute first-letter when admin renames
};

// Base64 PNG of the original Deal Pro logo (320×95px, ~29KB).
// Inlined so the app works fully offline and we never depend on a CDN URL
// that could break. Encoded once from /assets/Deal_Pro_Logo_3D.png.
const DEFAULT_LOGO_DATA_URL = "data:image/png;base64,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";

// Apply current State.branding to every DOM surface that shows the brand.
// Called on boot, on every realtime branding update, and after page navigations.
function applyBranding(){
  const name = (State.branding.siteName || DEFAULT_BRANDING.siteName).trim() || DEFAULT_BRANDING.siteName;
  const logo = State.branding.logoDataUrl || null;

  // 1. Header — show uploaded image if present, otherwise fallback wordmark
  const logoEl    = document.getElementById("brand-logo-img");
  const fallback  = document.getElementById("brand-wordmark-fallback");
  const glyphEl   = document.getElementById("brand-glyph");
  const textEl    = document.getElementById("brand-text");
  if(logo && logoEl){
    logoEl.src = logo;
    logoEl.style.display = "block";
    if(fallback) fallback.style.display = "none";
  }else{
    if(logoEl) logoEl.style.display = "none";
    if(fallback) fallback.style.display = "flex";
    if(glyphEl) glyphEl.textContent = (name[0] || "D").toUpperCase();
    if(textEl){
      // Render as "First <em>Rest</em>" so the em-styled second word still has
      // the gradient look when present (e.g. "Deal Pro" → "Deal <em>Pro</em>")
      const parts = name.split(/\s+/);
      if(parts.length >= 2){
        const first = parts[0];
        const rest = parts.slice(1).join(" ");
        textEl.innerHTML = `${escapeHtml(first)} <em>${escapeHtml(rest)}</em>`;
      }else{
        textEl.textContent = name;
      }
    }
  }

  // 2. Footer brand name
  const footerEl = document.getElementById("footer-brand-name");
  if(footerEl) footerEl.textContent = name;

  // 3. Browser tab title (uses {brand} placeholder if present, otherwise default)
  document.title = `${name} · AI Sales Agent`;

  // 3b. Browser tab icon (favicon). Chrome caches favicons aggressively and
  //     often ignores an in-place href change on an existing <link>. To force a
  //     re-evaluation we REMOVE every icon link and recreate the one we want.
  //     - custom favicon set  → remove all icon links, append a fresh managed link
  //     - no custom favicon   → remove managed link, ensure the default link is
  //       present (recreate it if a previous run removed it)
  const favicon = State.branding.faviconDataUrl || null;
  const DEFAULT_FAVICON_HREF = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%230bb6c4'/%3E%3Cstop offset='1' stop-color='%23d6299b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='64' height='64' rx='14' fill='url(%23g)'/%3E%3Ctext x='32' y='44' font-family='Arial,sans-serif' font-size='38' font-weight='700' fill='%23fff' text-anchor='middle'%3ED%3C/text%3E%3C/svg%3E";
  // Remove ALL existing icon links (managed, default, or any stray rel="icon").
  document.querySelectorAll('link[rel~="icon"], link[data-brand-favicon], link[data-brand-favicon-default]').forEach(l => l.remove());
  // Recreate exactly one icon link with the correct href.
  const link = document.createElement("link");
  link.setAttribute("rel","icon");
  if(favicon){
    link.setAttribute("data-brand-favicon","1");
    const m = /^data:([^;,]+)[;,]/.exec(favicon);
    if(m && m[1]) link.setAttribute("type", m[1]);
    link.setAttribute("href", favicon);
  }else{
    link.setAttribute("data-brand-favicon-default","1");
    link.setAttribute("type","image/svg+xml");
    link.setAttribute("href", DEFAULT_FAVICON_HREF);
  }
  document.head.appendChild(link);

  // 4. Re-apply i18n so strings containing {brand} placeholder pick up the
  //    new site name. This is what makes the Home hero text, login subtitle,
  //    etc. update in real-time when an admin changes Site Name in Branding.
  //    Safe to call even before initial I.apply() — it's a no-op if no
  //    [data-i18n] elements are in the DOM yet.
  if(typeof I !== "undefined" && I && typeof I.apply === "function"){
    try { I.apply(); } catch(e) { /* element list may be empty pre-boot */ }
  }
}

// Subscribe to config/branding doc for realtime updates. Public read so
// guest/customer browsers also flip to the new brand the moment admin saves.
function subscribeBranding(){
  if(State.brandingUnsub){ try{ State.brandingUnsub(); }catch{} }
  State.brandingUnsub = onSnapshot(doc(db,"config","branding"), snap => {
    if(snap.exists()){
      const d = snap.data() || {};
      State.branding.siteName    = d.siteName || DEFAULT_BRANDING.siteName;
      State.branding.logoDataUrl = d.logoDataUrl || null;
      State.branding.faviconDataUrl = d.faviconDataUrl || null;
      // enabledLangs — which UI languages the picker offers. null/absent = all.
      // "en" is always forced on (fallback), enforced in buildLangPicker.
      State.branding.enabledLangs = Array.isArray(d.enabledLangs) ? d.enabledLangs.slice() : null;
      State.branding.updatedAt   = d.updatedAt || null;
      State.branding.updatedBy   = d.updatedBy || null;
      // dmchampPortalUrl — sync into State.dmchamp so customer-facing CTAs
      // (My Account "Open DM Champ" buttons) flip in realtime when admin
      // changes the White-Label custom domain.
      if(typeof d.dmchampPortalUrl === "string"){
        const cleaned = d.dmchampPortalUrl.trim().replace(/\/+$/, "");
        if(cleaned && /^https?:\/\//i.test(cleaned)){
          State.dmchamp.portalUrl = cleaned;
        }
      }
    }else{
      State.branding.siteName    = DEFAULT_BRANDING.siteName;
      State.branding.logoDataUrl = null;
      State.branding.faviconDataUrl = null;
      State.branding.enabledLangs = null;
    }
    applyBranding();
    // Languages the picker offers may have changed — rebuild it. If the current
    // language was just disabled, fall back to "en".
    try{
      if(!App.isLangEnabled(State.currentLang)){ App.setLang("en"); }
      else { App.buildLangPicker(); }
    }catch{}
    // If the branding admin view is open, re-render so the preview reflects latest
    if(document.getElementById("adm-branding")?.style.display !== "none"){
      try{ renderAdminBranding(); }catch{}
    }
    // If My Account is open, re-render so the DM Champ button URL updates immediately
    if(document.getElementById("page-account")?.classList.contains("show")){
      try{ renderCustomerAccount(); }catch{}
    }
  }, err => {
    if(err.code === "permission-denied"){
      console.warn("[branding] subscription denied — rules block public read");
    }else{
      console.error("[branding] subscription error:", err);
    }
  });
}

function subscribePackages(){
  if(State.packagesUnsub){ try{ State.packagesUnsub(); }catch{} }

  // Track whether this is the initial snapshot (don't toast on first load).
  // After the first snapshot, any subsequent change is a real edit by an admin.
  let isInitialSnapshot = true;

  // Build a digest of "what we have right now" so we can diff against the next
  // snapshot and tell the user exactly what changed (added / removed / edited
  // packages by id). We hash a few key fields per package so unrelated field
  // changes (timestamps from seeding) don't trigger a false toast.
  const snapshotDigest = (snap) => {
    const map = {};
    snap.forEach(d => {
      const p = d.data() || {};
      map[d.id] = JSON.stringify({
        title: p.title || "",
        price: p.price ?? null,
        featured: !!p.featured,
        durationDays: p.durationDays ?? null,
        order: p.order ?? null,
        bucket: p.bucket || ""
      });
    });
    return map;
  };
  let lastDigest = {};

  State.packagesUnsub = onSnapshot(collection(db,"packages"), snap => {
    // Compute diff vs previous snapshot (skipped on first load)
    const nextDigest = snapshotDigest(snap);
    let added = 0, removed = 0, edited = 0;
    if(!isInitialSnapshot){
      for(const id of Object.keys(nextDigest)){
        if(!(id in lastDigest)) added++;
        else if(lastDigest[id] !== nextDigest[id]) edited++;
      }
      for(const id of Object.keys(lastDigest)){
        if(!(id in nextDigest)) removed++;
      }
    }
    lastDigest = nextDigest;

    hydratePackagesFromSnap(snap);

    // Re-render public packages page if visible
    if(document.getElementById("page-packages")?.classList.contains("show")){
      App.renderPackages(/* flashChanged */ !isInitialSnapshot);
    }
    // Re-render admin packages view if visible — but skip if a modal is open
    // (admin is in the middle of editing/creating a package)
    if(document.getElementById("page-admin")?.classList.contains("show") &&
       document.getElementById("adm-packages")?.style.display !== "none"){
      const modalOpen = document.getElementById("generic-modal")?.classList.contains("show");
      if(!modalOpen) renderAdminPackages();
    }
    // Re-render checkout if customer is mid-checkout — refresh the selected package's price
    if(document.getElementById("page-checkout")?.classList.contains("show") && State.selectedPackage){
      // Look up the latest price/title for the selected package
      const sp = State.selectedPackage;
      if(!sp.manual){
        const fresh = (PACKAGES[sp.bucket] || []).find(p => p.id === sp.id);
        if(fresh){
          const priceChanged = Math.abs(State.selectedPackage.price - fresh.price) > 0.001;
          State.selectedPackage.price = fresh.price;
          State.selectedPackage.title = pkgTitle(fresh);
          if(priceChanged && !isInitialSnapshot){
            Toast.show(I.t("toast.checkout.price.updated"), "warn");
          }
        }else{
          // The package was deleted while customer was on checkout
          Toast.show(I.t("toast.checkout.package.removed"), "warn");
          App.go("packages");
          return;
        }
      }
      App.renderCheckout();
    }

    // Toast notification — only after the initial load, and only when the
    // user is actually looking at a page that displays packages. We don't
    // want to spam admins on other pages with "packages updated" alerts.
    if(!isInitialSnapshot && (added + removed + edited) > 0){
      const onPublicPackages = document.getElementById("page-packages")?.classList.contains("show");
      const onAdminPackages  = document.getElementById("page-admin")?.classList.contains("show")
                            && document.getElementById("adm-packages")?.style.display !== "none";
      const onCheckout       = document.getElementById("page-checkout")?.classList.contains("show");

      if(onPublicPackages || onAdminPackages || onCheckout){
        const parts = [];
        if(added)   parts.push(I.t("toast.packages.added",   { n: added }));
        if(edited)  parts.push(I.t("toast.packages.edited",  { n: edited }));
        if(removed) parts.push(I.t("toast.packages.removed", { n: removed }));
        Toast.show(parts.join(" · "), "ok");
      }
    }

    isInitialSnapshot = false;

    // If we end up with an empty collection AND an admin is signed in,
    // automatically seed the defaults. This handles "I deleted everything" cases.
    if(State.packagesNeedSeeding && State.user){
      seedPackagesIfNeeded().catch(e => console.warn("auto-seed packages:", e));
    }
  }, err => {
    if(err.code === "permission-denied"){
      console.warn("[packages] subscription denied — rules block public read");
    }else{
      console.error("[packages] subscription error:", err);
    }
  });
}

// Subscribe to translations — PUBLIC, real-time. When an admin edits text in the
// Languages console, every other open browser receives the update and re-renders
// the visible UI in the user's current language.
function subscribeTranslations(){
  if(State.translationsUnsub){ try{ State.translationsUnsub(); }catch{} }
  State.translationsUnsub = onSnapshot(collection(db,"translations"), snap => {
    let touched = false;
    snap.docChanges().forEach(change => {
      const docId = change.doc.id;
      const data = change.doc.data();
      if(change.type === "removed"){
        delete State.strings[docId];
      }else{
        State.strings[docId] = data.strings || {};
      }
      touched = true;
    });
    if(!touched) return;

    I.recalcStatus();
    // Re-render anything that uses strings, in the user's current language
    I.apply();
    App.buildLangPicker();
    App.updateAuthUI();
    // Pages that render dynamically (not just data-i18n)
    if(document.getElementById("page-home")?.classList.contains("show")) App.renderHome();
    if(document.getElementById("page-packages")?.classList.contains("show")) App.renderPackages();
    App.renderAboutBlocks();
    if(document.getElementById("page-checkout")?.classList.contains("show")) App.renderCheckout();
    if(document.getElementById("page-admin")?.classList.contains("show")){
      // Skip re-render if the user is currently editing a translation field —
      // we don't want to clobber what they're typing.
      const active = document.activeElement;
      const isEditingTranslation = active && active.matches && active.matches("#translate-table-body input, #translate-table-body textarea");
      if(isEditingTranslation){
        // Only refresh the language status cards (top of page) without touching the table
        I.recalcStatus();
      }else{
        const activeSide = document.querySelector(".side-item.active");
        if(activeSide?.dataset.admin) App.setAdmin(activeSide.dataset.admin);
      }
    }
  }, err => {
    if(err.code === "permission-denied"){
      console.warn("[translations] subscription denied — rules block public read");
    }else{
      console.error("[translations] subscription error:", err);
    }
  });
}

// ===========================================================
// PACKAGE LOGIC — matching engine for ontheline webhook
// ===========================================================
// Given a paid amount, return list of items to allocate:
// - Tries to find the largest single Credit Purchase or 1-Time Access matching the amount
// - Remainder goes to Credit Purchase via "Manual Input"
// For simplicity: this matches against Credit Purchase tier first (closest under amount),
// since per the spec "if remainder, use Credit Purchase Manual Input"
function matchPackagesForAmount(amount){
  amount = Number(amount) || 0;
  if(amount <= 0) return { items:[], remainder:0 };

  // Collect all fixed packages (credit + onetime) sorted by price desc
  const all = [
    ...PACKAGES.credit.map(p => ({ ...p, bucket:"credit" })),
    ...PACKAGES.onetime.map(p => ({ ...p, bucket:"onetime" }))
  ].sort((a,b) => b.price - a.price);

  // Find largest package that fits under or equal to amount
  let primary = null;
  for(const p of all){
    if(p.price <= amount){ primary = p; break; }
  }

  const items = [];
  let remainder = amount;
  if(primary){
    items.push({
      bucket: primary.bucket,
      id: primary.id,
      title: pkgTitle(primary),
      price: primary.price
    });
    remainder = amount - primary.price;
  }

  // Anything left → Credit Purchase Manual Input
  if(remainder > 0){
    items.push({
      bucket:"credit",
      id:"credit.manual",
      title: I.t("pkg.manual.title"),
      price: remainder,
      manual: true
    });
  }

  return { items, remainder: primary ? remainder : amount };
}

// ===========================================================
// ROUTING + RENDER
// ===========================================================
// DOCS — long-form legal / company documents rendered inside the document
// modal (.doc-modal). Kept as functions so the markup is only built when a
// reader actually opens it. Content mirrors the published PDF/TXT sources:
//   • aboutUs() — ONTHELINE / DealMai company overview
//   • terms()   — DealMai Master Terms of Service & Platform Agreement,
//                 followed by the Privacy Policy & APAC Data Protection Notice
// About Us is translated into all four UI languages (see ABOUT_DOC below).
// The Terms / Privacy document is intentionally English-only — that is the
// authoritative legal language in which it is published.
// ===========================================================
// Localised copy for the About Us document modal. Keyed by UI language code;
// aboutUs() falls back to "en" when a language isn't present here.
const ABOUT_DOC = {
  en: {
    h1: "Bridging the Gap in Global Lead Engagement",
    p1: "At <strong>ONTHELINE</strong>, we recognized a critical bottleneck facing modern businesses worldwide: traditional marketing, rigid chatbots, and delayed manual replies fail to engage audiences, allowing countless high-intent leads to fall through the cracks.",
    p2: "To solve this, we developed <strong>DealMai</strong> — an advanced AI automation platform designed to transform instant messaging channels into high-converting sales pipelines.",
    p3: "By unifying channels like WhatsApp, Instagram, LINE, and web chat with probability-based conversational AI, DealMai delivers human-like interactions that qualify prospects, schedule appointments, and reactivate dormant leads automatically. Operating 24/7 and adapting seamlessly to each brand's unique voice, DealMai ensures every customer inquiry becomes a measurable growth opportunity — without extra operational burden.",
    h2: "One Global Identity",
    p4: "As part of the <strong>ONTHELINE</strong> corporate group — with operations spanning Thailand, Japan, and South Korea — we combine regional market expertise with cutting-edge technology infrastructure. Whether you are a local enterprise or a cross-border business, ONTHELINE provides the AI tools and stability needed to scale your customer communications effortlessly across Asia and beyond.",
    callout: "<strong>Every inquiry, a growth opportunity.</strong> Nonstop engagement across the channels your customers already use — in your brand's exact voice.",
    lblEntity: "Entity", lblReg: "Registration", lblAddr: "Address",
    lblSupport: "Support", lblPlatform: "Platform",
    addr: "299/724, Sukhaphiban 5 Road, Anusawari Sub-district, Bang Khen District, Bangkok, Thailand"
  },
  th: {
    h1: "ปิดช่องว่างการดูแลลูกค้าทั่วโลก",
    p1: "ที่ <strong>ONTHELINE</strong> เรามองเห็นคอขวดสำคัญที่ธุรกิจยุคใหม่ทั่วโลกกำลังเผชิญ นั่นคือการตลาดแบบเดิม แชทบอทที่ตอบได้แค่รูปแบบตายตัว และการตอบกลับด้วยคนที่ล่าช้า ล้วนไม่สามารถรักษาความสนใจของลูกค้าไว้ได้ ทำให้ผู้ที่ตั้งใจจะซื้อจำนวนมากหลุดมือไปอย่างน่าเสียดาย",
    p2: "เราจึงพัฒนา <strong>DealMai</strong> ขึ้นมา แพลตฟอร์มระบบอัตโนมัติด้วย AI ที่ออกแบบมาเพื่อเปลี่ยนช่องทางแชทให้กลายเป็นสายการขายที่ปิดดีลได้จริง",
    p3: "ด้วยการรวมช่องทางอย่าง WhatsApp, Instagram, LINE และแชทบนเว็บไซต์ เข้ากับ AI สนทนาที่ทำงานบนหลักความน่าจะเป็น DealMai จึงพูดคุยได้เป็นธรรมชาติเหมือนมนุษย์ คัดกรองผู้ที่สนใจจริง นัดหมายให้อัตโนมัติ และดึงลูกค้าที่เงียบหายไปให้กลับมาสนใจอีกครั้ง ทำงานตลอด 24 ชั่วโมง และปรับน้ำเสียงให้เข้ากับเอกลักษณ์ของแต่ละแบรนด์ได้อย่างแนบเนียน DealMai จึงทำให้ทุกการติดต่อของลูกค้ากลายเป็นโอกาสเติบโตที่วัดผลได้ โดยไม่เพิ่มภาระให้ทีมงาน",
    h2: "หนึ่งเดียวในระดับสากล",
    p4: "ในฐานะส่วนหนึ่งของกลุ่มบริษัท <strong>ONTHELINE</strong> ซึ่งมีการดำเนินงานครอบคลุมประเทศไทย ญี่ปุ่น และเกาหลีใต้ เราผสานความเชี่ยวชาญตลาดในแต่ละภูมิภาคเข้ากับโครงสร้างพื้นฐานเทคโนโลยีที่ล้ำสมัย ไม่ว่าคุณจะเป็นธุรกิจท้องถิ่นหรือธุรกิจข้ามพรมแดน ONTHELINE พร้อมมอบเครื่องมือ AI และความมั่นคงของระบบ เพื่อให้คุณขยายการสื่อสารกับลูกค้าได้อย่างราบรื่นทั่วเอเชียและไกลกว่านั้น",
    callout: "<strong>ทุกการติดต่อ คือโอกาสเติบโต</strong> ดูแลลูกค้าอย่างต่อเนื่องบนช่องทางที่พวกเขาใช้อยู่แล้ว ด้วยน้ำเสียงของแบรนด์คุณเอง",
    lblEntity: "นิติบุคคล", lblReg: "เลขทะเบียน", lblAddr: "ที่อยู่",
    lblSupport: "ฝ่ายสนับสนุน", lblPlatform: "แพลตฟอร์ม",
    addr: "299/724 ถนนสุขาภิบาล 5 แขวงอนุสาวรีย์ เขตบางเขน กรุงเทพมหานคร ประเทศไทย"
  },
  ko: {
    h1: "글로벌 리드 응대의 격차를 메우다",
    p1: "<strong>ONTHELINE</strong>은 전 세계 현대 기업이 직면한 결정적인 병목에 주목했습니다. 전통적인 마케팅, 경직된 챗봇, 그리고 지연되는 수동 응답은 고객의 관심을 붙잡지 못하고, 구매 의향이 높은 수많은 리드를 놓치게 만듭니다.",
    p2: "이를 해결하기 위해 우리는 <strong>DealMai</strong>를 개발했습니다. 메시징 채널을 높은 전환율의 영업 파이프라인으로 바꾸도록 설계된 고도화된 AI 자동화 플랫폼입니다.",
    p3: "WhatsApp, Instagram, LINE, 웹 채팅과 같은 채널을 확률 기반 대화형 AI와 통합함으로써, DealMai는 사람처럼 자연스러운 상호작용으로 잠재 고객을 선별하고, 일정을 예약하며, 휴면 리드를 자동으로 재활성화합니다. 24시간 연중무휴로 작동하고 각 브랜드 고유의 목소리에 매끄럽게 적응하여, DealMai는 모든 고객 문의를 측정 가능한 성장 기회로 만듭니다 — 추가적인 운영 부담 없이.",
    h2: "하나의 글로벌 아이덴티티",
    p4: "태국, 일본, 한국에 걸쳐 사업을 운영하는 <strong>ONTHELINE</strong> 기업 그룹의 일원으로서, 우리는 지역 시장에 대한 전문성과 최첨단 기술 인프라를 결합합니다. 로컬 기업이든 국경을 넘나드는 비즈니스든, ONTHELINE은 아시아를 넘어 고객 커뮤니케이션을 손쉽게 확장하는 데 필요한 AI 도구와 안정성을 제공합니다.",
    callout: "<strong>모든 문의가 성장의 기회입니다.</strong> 고객이 이미 사용 중인 채널에서, 브랜드 고유의 목소리 그대로 멈춤 없이 응대합니다.",
    lblEntity: "법인", lblReg: "등록번호", lblAddr: "주소",
    lblSupport: "지원", lblPlatform: "플랫폼",
    addr: "299/724, Sukhaphiban 5 Road, Anusawari, Bang Khen, 방콕, 태국"
  },
  ja: {
    h1: "グローバルなリード対応の溝を埋める",
    p1: "<strong>ONTHELINE</strong> は、世界中の現代企業が直面する重大なボトルネックに着目しました。従来型のマーケティング、融通の利かないチャットボット、そして遅れがちな手動返信は顧客の関心をつなぎとめられず、購入意欲の高い数多くのリードを取りこぼしてしまいます。",
    p2: "この課題を解決するために、私たちは <strong>DealMai</strong> を開発しました。メッセージングチャネルを高い成約率を生む営業パイプラインへと変えるために設計された、先進的なAI自動化プラットフォームです。",
    p3: "WhatsApp、Instagram、LINE、ウェブチャットなどのチャネルを確率ベースの対話型AIと統合することで、DealMai は人間のように自然なやり取りを実現し、見込み客を選別し、アポイントを設定し、休眠リードを自動的に再活性化します。24時間365日稼働し、各ブランド固有のトーンにも滑らかに適応するため、DealMai はすべての顧客からの問い合わせを、運用負荷を増やすことなく測定可能な成長機会へと変えます。",
    h2: "ひとつのグローバル・アイデンティティ",
    p4: "タイ・日本・韓国にまたがって事業を展開する <strong>ONTHELINE</strong> グループの一員として、私たちは各地域の市場に対する知見と最先端の技術基盤を融合させています。ローカル企業でも国境を越えるビジネスでも、ONTHELINE はアジアとその先へ顧客コミュニケーションを無理なく拡張するために必要なAIツールと安定性を提供します。",
    callout: "<strong>すべての問い合わせが、成長の機会に。</strong> お客様がすでに使っているチャネルで、御社のブランドボイスのまま、途切れることなく対応します。",
    lblEntity: "法人", lblReg: "登記番号", lblAddr: "所在地",
    lblSupport: "サポート", lblPlatform: "プラットフォーム",
    addr: "299/724, Sukhaphiban 5 Road, Anusawari, Bang Khen, バンコク, タイ"
  }
};

const Docs = {
  // About Us is fully localised (EN / TH / KO / JA). The reader sees it in the
  // language they have selected, falling back to English for anything missing.
  aboutUs(){
    const lang = (State.currentLang && ABOUT_DOC[State.currentLang]) ? State.currentLang : "en";
    const d = ABOUT_DOC[lang];
    return `
      <h3>${d.h1}</h3>
      <p>${d.p1}</p>
      <p>${d.p2}</p>
      <p>${d.p3}</p>

      <h3>${d.h2}</h3>
      <p>${d.p4}</p>

      <div class="doc-callout good">${d.callout}</div>

      <div class="doc-meta">
        <div><span class="k">${d.lblEntity}</span>ONTHELINE INTERNATIONAL COMPANY LIMITED</div>
        <div><span class="k">${d.lblReg}</span>0105564016423</div>
        <div><span class="k">${d.lblAddr}</span>${d.addr}</div>
        <div><span class="k">${d.lblSupport}</span><a href="mailto:support@dealmai.com">support@dealmai.com</a></div>
        <div><span class="k">${d.lblPlatform}</span>dealmai.com · app.dealmai.com</div>
      </div>`;
  },

  terms(){
    return `
      <div class="doc-meta">
        <div><span class="k">Effective</span>July 31, 2026</div>
        <div><span class="k">Platform</span>dealmai.com · app.dealmai.com</div>
        <div><span class="k">Operating entity</span>ONTHELINE INTERNATIONAL COMPANY LIMITED (บริษัท ออนเดอะไลน์ อินเตอร์เนชั่นแนล จำกัด)</div>
        <div><span class="k">Registration</span>0105564016423</div>
        <div><span class="k">Address</span>299/724, Sukhaphiban 5 Road, Anusawari Sub-district, Bang Khen District, Bangkok, Thailand</div>
        <div><span class="k">Support</span><a href="mailto:support@dealmai.com">support@dealmai.com</a></div>
      </div>

      <p>You may also enter into additional agreements with us, such as a Data Processing Agreement,
      an order form, or an Agency Reseller Addendum. Where there is a conflict between those
      documents and these Terms, the more specific document controls for the matters it covers.</p>

      <h3>01. Definitions</h3>
      <ul>
        <li><strong>Services</strong> — the DealMai platform, including the web application at
        app.dealmai.com, white-label deployments, APIs, webhooks, mobile interfaces, documentation,
        and related automated agent services.</li>
        <li><strong>Customer</strong> (or "User", "Merchant") — the natural person or legal entity
        that has accepted these Terms or operates an account on DealMai.</li>
        <li><strong>Affiliates</strong> — any entity that directly or indirectly controls, is
        controlled by, or is under common control with ONTHELINE INTERNATIONAL COMPANY LIMITED.</li>
        <li><strong>AI</strong> — the large language models and supporting machine learning
        components utilized by the Services, including Anthropic Claude and Google Gemini
        architectures.</li>
        <li><strong>Credits</strong> — the unit of usage measurement used to meter AI operations and
        certain pass-through channel fees. One credit equals USD 0.50.</li>
        <li><strong>Sub-account</strong> — a client workspace created and managed by an Agency tier
        Customer for the benefit of its end clients.</li>
        <li><strong>White-Label</strong> — the rebranded deployment of the Services on a
        Customer-controlled domain with Customer branding.</li>
        <li><strong>Agency tier</strong> — the subscription tier that includes White-Label and
        Sub-account management rights as described in these Terms.</li>
        <li><strong>BYOK</strong> — "Bring Your Own Key", the option to use your own Anthropic API
        key for AI operations within DealMai.</li>
        <li><strong>Sub-processor</strong> — a third party engaged by ONTHELINE INTERNATIONAL
        COMPANY LIMITED or its Affiliates to process Customer Data on our behalf.</li>
        <li><strong>DPA</strong> — the Data Processing Agreement set out in Section 14 of these Terms.</li>
        <li><strong>Effective Date</strong> — the date you first accepted these Terms or the date
        stated at the top of this page, whichever is later.</li>
      </ul>

      <h3>02. Service Description</h3>
      <p>DealMai is an AI sales agent and enterprise automation platform operating across multiple
      messaging channels on behalf of you and your clients. The Services unify inbound and outbound
      messaging, AI conversation handling, contact management, campaign orchestration,
      comment-to-DM workflows, AI appointment booking, BYOK, custom functions, and third-party
      integrations into a single unified platform.</p>

      <h4>Supported Channels</h4>
      <ul>
        <li>WhatsApp Business API (via Twilio and Meta WhatsApp Cloud API)</li>
        <li>WhatsApp Web (via our managed connection service)</li>
        <li>Instagram Direct Messages (via Meta Business Platform)</li>
        <li>Facebook Messenger (via Meta Business Platform)</li>
        <li>Telegram (via a connected Telegram account)</li>
        <li>Email (via a connected email account)</li>
        <li>SMS (using your connected Twilio account; you are responsible for A2P 10DLC brand and
        campaign registration in your business name)</li>
        <li>Embedded Chat Widget for websites</li>
        <li>Beta Channels: iMessage (closed beta) and LINE Official Account integration (beta)</li>
      </ul>

      <h4>AI Processing &amp; Data Training Protections</h4>
      <p>AI conversations on DealMai are powered primarily by Anthropic Claude architectures.
      Specific media-processing tasks — such as voice note transcription, image understanding, and
      video analysis — utilize Google Gemini infrastructure.</p>
      <div class="doc-callout good">
        <strong>Strict Data Privacy Commitment:</strong> We do NOT use your data, your end users'
        data, or any Customer-uploaded content to train AI models, unless you have expressly agreed
        to such use in a separate written agreement with us. Our underlying AI sub-processors are
        contractually bound under enterprise terms not to train on Customer Data.
      </div>

      <h4>Other Core Capabilities</h4>
      <ul>
        <li>Multi-channel inbox with real-time conversation history, tagging, assignment, and team
        collaboration.</li>
        <li>Campaigns including comment-to-DM, follow-up sequences, and broadcast lists.</li>
        <li>AI appointment booking with two-way Google Calendar synchronization.</li>
        <li>BYOK support for Anthropic API keys on eligible subscription tiers.</li>
        <li>Custom functions to extend AI behavior and integrate with external backend systems.</li>
        <li>White-label and sub-account provision capabilities for Agency tier Customers.</li>
      </ul>
      <p>The Services evolve continuously. We may add, change, or refine features, and we may update
      these Terms accordingly in line with Section 23.</p>

      <h3>03. Eligibility &amp; Account Responsibilities</h3>
      <ol>
        <li><strong>Business Use Only:</strong> The Services are intended exclusively for business,
        trade, and professional use. By using DealMai, you confirm that you are at least 18 years old
        and operating on behalf of a legitimate commercial entity.</li>
        <li><strong>Account Credentials:</strong> You must provide accurate, current, and complete
        information when registering your account and keep it up to date. You are solely responsible
        for safeguarding your credentials and for all activity carried out under your account. Notify
        us immediately at support@dealmai.com if you suspect unauthorized access.</li>
        <li><strong>Workspace Responsibility:</strong> You are responsible for the actions of users
        you invite into your workspace and for any Sub-accounts created under your Agency tier.</li>
        <li><strong>Price Changes:</strong> We may change our subscription prices. We will provide at
        least 30 days' written notice (via email or in-app notification) before any price adjustment
        applies to your recurring subscription. You may cancel before the change takes effect to
        avoid updated fees.</li>
        <li><strong>Failed Payments:</strong> If a payment authorization fails, we will retry and
        notify you. We reserve the right to suspend access to the Services after a reasonable grace
        period if payment remains outstanding. Suspended accounts may be reactivated upon payment of
        outstanding balances.</li>
        <li><strong>Annual Plans:</strong> Where annual billing is selected, the plan carries a
        discounted rate over monthly billing. The same Terms apply unless otherwise agreed in
        writing.</li>
      </ol>

      <h3>04. BYOK (Bring Your Own Key)</h3>
      <p>BYOK enables you to connect your own Anthropic API key to your DealMai workspace. When BYOK
      is enabled:</p>
      <ul>
        <li><strong>Direct Billing:</strong> Your AI operations (chat responses, FAQ generation, tool
        execution, campaign optimization, web search, and AI calls) cease consuming DealMai platform
        credits and are billed directly to your account by Anthropic.</li>
        <li><strong>Exclusions from BYOK:</strong> Channel infrastructure costs, third-party network
        fees, and Gemini-powered media processing (e.g., voice note transcription, image analysis)
        continue to be billed by DealMai or passed through at cost.</li>
        <li><strong>Max Tier Campaigns:</strong> Campaigns whose AI quality is configured to the Max
        tier run on our optimized in-house model architecture and are always billed in DealMai
        platform credits (0.25 credits per action) — the Max tier does not utilize your BYOK
        Anthropic key. To run fully via BYOK, keep campaigns on a Claude-powered tier.</li>
        <li><strong>Supported Providers:</strong> BYOK is supported exclusively for Anthropic keys.
        We do not support BYOK for OpenAI or other third-party model providers at this time.</li>
        <li><strong>Risk &amp; Fallback:</strong> You are responsible for the security of your
        Anthropic API key, costs incurred against it, and compliance with Anthropic's terms.
        ONTHELINE INTERNATIONAL COMPANY LIMITED is not responsible for outages, rate limits, or
        billing disputes arising from your direct relationship with Anthropic. If your API key fails
        or hits rate limits, DealMai may automatically fall back to platform credit usage in
        accordance with your dashboard settings to preserve service continuity.</li>
      </ul>

      <h3>05. Credits, Pricing, Pass-Through Fees &amp; Refund Policy</h3>
      <p>One DealMai credit equals USD 0.50. Credits meter AI operations, automated agent functions,
      and pass-through network costs.</p>

      <div class="doc-callout">
        <strong>Disclaimer on credit metering and rates:</strong> All credit consumption rates, system
        metering multipliers, feature credit costs, and pass-through network rates set forth herein or
        displayed within the platform dashboard are subject to change and modification at any time
        without prior notice at the sole discretion of ONTHELINE INTERNATIONAL COMPANY LIMITED. Active
        billing rates displayed within your workspace admin dashboard at the exact time of operation
        execution shall govern.
      </div>

      <h4>Standard Credit Consumption Rates</h4>
      <table class="doc-table">
        <thead><tr><th>Operational action</th><th>Credit cost</th></tr></thead>
        <tbody>
          <tr><td>AI Responses (Chat Replies) — Standard Tier</td><td>1 / response</td></tr>
          <tr><td>AI Responses (Chat Replies) — Economy Tier</td><td>0.5 / response</td></tr>
          <tr><td>AI Responses (Chat Replies) — Max Tier</td><td>0.25 / response</td></tr>
          <tr><td>AI Tool Use (Function Calls) — Standard Tier</td><td>1 / call</td></tr>
          <tr><td>AI Tool Use (Function Calls) — Economy Tier</td><td>0.5 / call</td></tr>
          <tr><td>AI Tool Use (Function Calls) — Max Tier</td><td>0.25 / call</td></tr>
          <tr><td>AI Campaign Generation</td><td>1 / generation</td></tr>
          <tr><td>AI FAQ Generation</td><td>1 / generation</td></tr>
          <tr><td>WhatsApp Web Connection</td><td>50 / month per active connection</td></tr>
          <tr><td>WhatsApp Business API Delivery</td><td>0.05 / message</td></tr>
        </tbody>
      </table>

      <h4>Pass-Through Network Fees</h4>
      <p>Phone numbers and WhatsApp template messaging are billed at the underlying network
      provider's rate (e.g., Twilio or Meta) as pass-through charges.</p>

      <h4>Credit Roll-Over &amp; 24-Hour Expiration Rule</h4>
      <ol>
        <li><strong>Subscription Allowances:</strong> The monthly credit allowance included with your
        recurring subscription plan resets at the start of each billing cycle and does not roll
        over.</li>
        <li><strong>24-Hour Standalone Credit Expiration:</strong> Purchased credit top-ups or add-on
        token packs constitute digital goods valid for exactly twenty-four (24) hours from the exact
        timestamp they are credited to your account. Any unused standalone credits remaining upon the
        expiration of the 24-hour window will automatically expire and be forfeited. Expired credits
        cannot be restored, rolled over, or converted.</li>
        <li><strong>Auto-Recharge:</strong> You may enable auto-recharge in your dashboard to
        automatically purchase a credit pack when your balance falls below a selected threshold.
        Auto-recharge purchases are subject to these Terms and are non-refundable.</li>
      </ol>

      <h4>Comprehensive Refund &amp; Cancellation Policy</h4>
      <ol>
        <li><strong>Pre-Paid Subscriptions:</strong> All SaaS subscriptions are billed on a pre-paid
        basis (pay-first, use-after). You may cancel your subscription at any time via account
        settings or by contacting support@dealmai.com. Service access will continue until the end of
        the current pre-paid billing cycle. No pro-rated cash refunds are granted for unused
        days.</li>
        <li><strong>Consumed Credits Zero-Refund Rule:</strong> Credits consumed by AI interactions,
        workflow automations, API calls, or backend operations represent fully rendered computing
        services and are strictly non-refundable under any circumstances.</li>
      </ol>

      <div class="doc-callout danger">
        <strong>Mandatory Policy Statement (Bilingual Thai / English)</strong><br>
        All credit/token purchases are non-refundable once credited to the user account. Unused
        credits expire 24 hours after purchase, and consumed credits cannot be restored.<br><br>
        สินค้าประเภทเครดิต/โทเค็น เมื่อได้รับการเติมเข้าสู่บัญชีผู้ใช้แล้ว ไม่สามารถขอคืนเงินได้ทุกกรณี
        เครดิตที่ไม่ได้ใช้งานจะหมดอายุภายใน 24 ชั่วโมงหลังจากการซื้อ และเครดิตที่ใช้ไปแล้วไม่สามารถคืนได้
      </div>

      <h3>06. Corporate Tax Invoices (ใบกำกับภาษี)</h3>
      <p>Corporate users operating in Thailand may request a Full Tax Invoice
      (ใบกำกับภาษีเต็มรูปแบบ) pursuant to the Revenue Code of Thailand. To request a Tax Invoice:</p>
      <ol>
        <li>Submit an email request to support@dealmai.com within 7 business days of the transaction
        date.</li>
        <li>Provide legal company details: Full Corporate Name, 13-digit Tax Identification Number
        (เลขประจำตัวผู้เสียภาษี), Head Office / Branch designation, and Registered Corporate
        Address.</li>
        <li>Issued Tax Invoices will be transmitted electronically or via post upon corporate
        validation.</li>
      </ol>

      <h3>07. Data Hosting &amp; Infrastructure Security</h3>
      <h4>Data Location &amp; Storage Architecture</h4>
      <ul>
        <li><strong>Primary Conversation &amp; Account Data:</strong> Customer conversation records,
        message history, contacts, and campaign structures are hosted on secure, enterprise-grade
        cloud infrastructure located within the European Union (EU), utilizing isolated database
        environments and encrypted backups.</li>
        <li><strong>AI Model Transmission Disclaimer:</strong> Generating automated AI outputs
        requires transmitting prompt text to authorized third-party AI sub-processors (including
        Anthropic and Google infrastructure). Our sub-processors process data strictly under
        enterprise terms prohibiting AI model training on Customer Data.</li>
      </ul>

      <h4>Access Control &amp; Account Security</h4>
      <ul>
        <li><strong>Data Access Rights:</strong> Customer Data belongs exclusively to the Customer.
        Personnel access Customer Data strictly to operate the Service or resolve technical support
        issues explicitly authorized by the Customer.</li>
        <li><strong>Network Isolation:</strong> Core application databases are logically isolated
        behind secure firewall perimeters and are not directly exposed to the public internet.</li>
        <li><strong>Authentication Safeguards:</strong> User accounts support Multi-Factor
        Authentication (MFA/2FA) via standard authenticator applications.</li>
        <li><strong>API Key Security:</strong> API keys are stored using one-way cryptographic
        hashing algorithms. Keys cannot be retrieved or read back in plaintext following initial
        creation.</li>
      </ul>

      <h4>Platform Protection &amp; Encryption</h4>
      <ul>
        <li><strong>Data In Transit &amp; At Rest:</strong> All traffic across web application,
        mobile, and API endpoints is encrypted using Transport Layer Security (TLS 1.2 or higher).
        Stored data and backups are encrypted at rest using industry-standard AES-256
        encryption.</li>
        <li><strong>Edge &amp; DDoS Protection:</strong> Front-end applications and API endpoints are
        routed through Cloudflare security infrastructure, providing automated DDoS mitigation and
        malicious traffic filtering.</li>
        <li><strong>Brute-Force Prevention:</strong> Automated rate limiting and intrusion detection
        systems block repeated unauthorized access attempts.</li>
      </ul>

      <h4>Backups and Disaster Recovery</h4>
      <ul>
        <li><strong>Point-In-Time Restoration:</strong> System databases undergo daily encrypted
        backups maintained within secure EU environments. Continuous transaction logging enables
        point-in-time recovery during disaster recovery procedures.</li>
        <li><strong>Resilience Verification:</strong> Restoration workflows are routinely validated on
        isolated staging environments to ensure data recovery integrity.</li>
      </ul>

      <h3>08. Acceptable Use Policy (AUP)</h3>
      <p>You agree not to use the Services, nor permit end users or clients to use the Services,
      to:</p>
      <ol>
        <li>Send unsolicited bulk messages, spam, or automated messages to recipients who have not
        explicitly opted in where opt-in consent is legally required under the Thai Computer Crime Act
        B.E. 2550 (and amendments) or international marketing laws.</li>
        <li>Harass, threaten, defame, abuse, intimidate, or stalk any individual.</li>
        <li>Distribute illegal content, material exploiting minors, content infringing third-party IP
        rights, or content inciting violence or illegal acts.</li>
        <li>Distribute malware, viruses, ransomware, phishing links, or malicious code.</li>
        <li>Reverse engineer, decompile, disassemble, or attempt to derive the source code of
        DealMai.</li>
        <li>Probe, scan, or test the vulnerability of DealMai infrastructure without prior written
        authorization from ONTHELINE INTERNATIONAL COMPANY LIMITED.</li>
        <li>Resell or sublicense the Services outside the authorized Agency tier framework.</li>
        <li>Violate the policies of integrated third-party platforms, including Meta's Business
        Platform Terms, WhatsApp Business Messaging Policy, Twilio Acceptable Use Policies, Stripe
        Terms, or Anthropic Usage Policies.</li>
        <li>Send SMS or messaging broadcasts in violation of the U.S. Telephone Consumer Protection
        Act (TCPA), FCC A2P 10DLC regulations, EU ePrivacy Directive, or local telecommunications
        laws.</li>
        <li>Impersonate DealMai, ONTHELINE INTERNATIONAL COMPANY LIMITED, or any third party.</li>
      </ol>
      <p>We reserve the right to investigate suspected breaches and suspend or terminate accounts for
      severe or unaddressed AUP violations.</p>

      <h3>09. White-Label &amp; Agency Tier Terms</h3>
      <p>The Agency tier grants you the right to deploy a customized instance of DealMai and provision
      sub-accounts for your end clients under the following conditions:</p>
      <h4>White-Label Rights</h4>
      <ul>
        <li>Custom branding: logo, favicon, app name, primary/accent colors.</li>
        <li>Custom domain deployment with automatic SSL/TLS encryption.</li>
        <li>Custom SEO metadata, custom Terms &amp; Privacy URLs, and dedicated support email
        configurations.</li>
        <li>Sub-account provisioning and client pricing management (via credit reselling or
        off-platform direct invoicing).</li>
        <li>Assist Mode for hands-on sub-account configuration and campaign template distribution
        across client workspaces.</li>
      </ul>
      <h4>Data Roles &amp; Compliance</h4>
      <p>As an Agency Customer, you act as the Data Controller for your end clients' data processed
      through DealMai. ONTHELINE INTERNATIONAL COMPANY LIMITED acts as your Data Processor. Where your
      clients act as controllers, you remain their processor and must establish valid data processing
      terms with them. You are required to publish your own Privacy Policy and Terms of Service on
      your white-label domain.</p>
      <h4>Pricing Floor Policy</h4>
      <p>To protect ecosystem value, Agency Customers agree not to undercut DealMai's official direct
      pricing published on dealmai.com. Reselling platform access below standard direct tier
      equivalents is prohibited. We will issue one written notice upon identifying a breach, granting
      5 business days to cure. Uncured breaches may result in Agency tier termination.</p>
      <h4>First-Line Support</h4>
      <p>You are responsible for providing first-line technical support to your end clients. ONTHELINE
      INTERNATIONAL COMPANY LIMITED provides platform-level support and account management directly to
      you (the Agency) and will not contact your clients directly without express consent.</p>

      <h3>10. Customer Data &amp; Ownership</h3>
      <ol>
        <li><strong>Ownership:</strong> You retain all right, title, and interest in and to your
        Customer Data. "Customer Data" includes knowledge bases, FAQs, conversation transcripts,
        contact lists, custom functions, campaign content, and end-user messages routed through
        DealMai.</li>
        <li><strong>Processing Scope:</strong> We process Customer Data solely to provide, maintain,
        and secure the Services in accordance with your instructions and these Terms.</li>
        <li><strong>No Model Training:</strong> Customer Data is never used to train AI models.</li>
        <li><strong>Data Retention &amp; Backups:</strong> Encrypted backups of Customer Data are
        retained for up to 90 days following deletion solely for disaster recovery purposes.</li>
        <li><strong>Data Export:</strong> You may export your Customer Data from the dashboard
        throughout your subscription and for 30 days post-termination. Following the 30-day export
        window, Customer Data is permanently purged from active systems.</li>
      </ol>

      <h3>11. Intellectual Property</h3>
      <p>ONTHELINE INTERNATIONAL COMPANY LIMITED retains all right, title, and interest in and to
      DealMai, including all underlying software, machine learning architectures, system designs,
      branding, documentation, and platform improvements.</p>
      <p>Subject to compliance with these Terms and fee payment, we grant you a limited,
      non-exclusive, non-transferable, non-sublicensable, revocable license to access and use DealMai
      for your internal business operations (and client provisioning under Agency tiers) during your
      subscription term.</p>
      <ul>
        <li><strong>Feedback:</strong> Any feedback, ideas, or feature requests provided to us
        regarding DealMai may be incorporated into the platform without obligation or compensation to
        you.</li>
        <li><strong>Marketing Reference:</strong> We may identify your business as a customer and use
        your logo on dealmai.com for promotional purposes. You may revoke this permission at any time
        by emailing support@dealmai.com, and we will remove your brand references within 14 business
        days.</li>
      </ul>

      <h3>12. Confidentiality</h3>
      <p>"Confidential Information" refers to non-public operational, technical, or financial
      information disclosed by one party to the other. Customer Data is your Confidential Information.
      DealMai architecture, non-public pricing, and security documentation are our Confidential
      Information.</p>
      <p>Both parties agree to protect Confidential Information using reasonable commercial care.
      Disclosure is permitted only to employees, contractors, and legal advisors with a need to know
      under equivalent binding confidentiality obligations, or as required by binding order of a court
      or regulatory authority in Thailand.</p>

      <h3>13. Third-Party Services &amp; Sub-Processors</h3>
      <p>To deliver platform functionality, ONTHELINE INTERNATIONAL COMPANY LIMITED engages vetted
      Sub-processors for cloud hosting, database storage, and AI processing. Our current list of
      Sub-processors and data locations is maintained at
      <a href="https://dealmai.com/subprocessors" target="_blank" rel="noopener">dealmai.com/subprocessors</a>.</p>
      <p>All Sub-processors are bound by enterprise data processing agreements prohibiting model
      training on Customer Data. We will notify you via email or in-app notice at least 14 days before
      onboarding new Sub-processors, allowing you the opportunity to object on reasonable data
      protection grounds.</p>

      <h3>14. Data Protection &amp; Data Processing Agreement (DPA)</h3>
      <p>This Section 14 constitutes the binding Data Processing Agreement ("DPA") between you and
      ONTHELINE INTERNATIONAL COMPANY LIMITED, complying with Thailand's Personal Data Protection Act
      B.E. 2562 (PDPA) and international standards (including GDPR Art. 28 where applicable).</p>
      <h4>Roles &amp; Processing Scope</h4>
      <ul>
        <li>ONTHELINE INTERNATIONAL COMPANY LIMITED acts as Data Controller for account setup, billing
        records, authentication credentials, and platform security logs.</li>
        <li>You act as Data Controller for personal data contained in customer messages, contacts, and
        workflows processed through DealMai. We act as your Data Processor.</li>
      </ul>
      <h4>Processor Obligations</h4>
      <p>As Data Processor, ONTHELINE INTERNATIONAL COMPANY LIMITED will:</p>
      <ol>
        <li>Process Customer Data strictly under your documented instructions and for the duration of
        your active subscription.</li>
        <li>Ensure all personnel authorized to handle Customer Data are bound by strict
        confidentiality obligations.</li>
        <li>Implement robust technical measures, including TLS 1.2+ encryption in transit and AES-256
        encryption at rest, logical access controls, and regular vulnerability scanning.</li>
        <li>Notify you without undue delay (and within 72 hours) upon confirming any personal data
        security breach affecting your Customer Data.</li>
        <li>Assist you in fulfilling statutory Data Subject Rights requests under the PDPA (rights to
        access, correct, restrict, erase, or port data) submitted via support@dealmai.com.</li>
      </ol>

      <h3>15. Service Level &amp; Support SLA</h3>
      <ol>
        <li><strong>Uptime Target:</strong> We target a 99.5% monthly uptime for core DealMai platform
        services, excluding scheduled maintenance announced in advance.</li>
        <li><strong>Support Channels:</strong>
          <ul>
            <li>Starter &amp; Growth Tiers: Email support during business hours
            (support@dealmai.com).</li>
            <li>Pro Tier: Priority email support with a 48-hour SLA.</li>
            <li>Agency Tier: Dedicated Account Manager plus priority technical escalation.</li>
          </ul>
        </li>
        <li>Help documentation and self-serve resources are available 24/7 at help.dealmai.com.</li>
      </ol>

      <h3>16. Limitation of Liability</h3>
      <ol>
        <li><strong>"As-Is" Disclaimer:</strong> DealMai and all AI automation features are provided
        on an "AS IS" and "AS AVAILABLE" basis. ONTHELINE INTERNATIONAL COMPANY LIMITED disclaims all
        implied warranties of accuracy, fitness for a specific purpose, or non-infringement.</li>
        <li><strong>AI Content Responsibility:</strong> AI-generated outputs are probabilistic
        predictions. The Customer is solely responsible for reviewing and verifying automated
        responses, booking schedules, and messages before sending them to end users.</li>
        <li><strong>Liability Cap:</strong> To the maximum extent permitted under Thai law, the total
        aggregate liability of ONTHELINE INTERNATIONAL COMPANY LIMITED arising out of or related to
        these Terms or the Services shall not exceed the lesser of (a) the total fees paid by you to
        DealMai in the 12 months preceding the claim, or (b) USD 100 (or equivalent THB).</li>
        <li><strong>Exclusion of Consequential Losses:</strong> Neither party shall be liable for
        indirect, punitive, special, or consequential damages, lost profits, loss of data, or
        operational disruption.</li>
      </ol>

      <h3>17. Indemnification</h3>
      <p>You agree to defend, indemnify, and hold harmless ONTHELINE INTERNATIONAL COMPANY LIMITED,
      its directors, officers, employees, and Affiliates against any third-party claims, losses,
      liabilities, or legal expenses arising out of:</p>
      <ul>
        <li>Your breach of these Terms or the Acceptable Use Policy.</li>
        <li>Unverified AI content approved and transmitted to end users via your account.</li>
        <li>Infringement of third-party IP or privacy rights resulting from Customer Data uploaded to
        your workspace.</li>
      </ul>

      <h3>18. Term &amp; Termination</h3>
      <ol>
        <li><strong>Subscription Term:</strong> Subscriptions operate on a recurring monthly or annual
        basis and automatically renew unless canceled prior to the next billing date via your
        dashboard.</li>
        <li><strong>Cancellation:</strong> Cancellation takes effect at the end of the current
        pre-paid billing period. Prepaid subscription fees are non-refundable.</li>
        <li><strong>Termination for Cause:</strong> We may suspend or terminate your access
        immediately if you commit a material breach of these Terms, fail to clear outstanding
        invoices, or violate the Acceptable Use Policy.</li>
        <li><strong>Post-Termination Data Access:</strong> Upon termination, platform access ends.
        Your 30-day Customer Data export window remains available, after which data is purged in
        accordance with Section 10.</li>
      </ol>

      <h3>19. Beta Features</h3>
      <p>We may offer experimental, preview, or beta features (e.g., iMessage or LINE beta
      integrations). Beta features are provided "AS IS" without warranty or SLA coverage and may be
      modified or withdrawn at any time.</p>

      <h3>20. API &amp; Webhooks</h3>
      <p>API and webhook access is available on eligible plan tiers. API keys must be kept secure. We
      reserve the right to rate-limit or revoke API keys that show signs of security compromise or
      system abuse.</p>

      <h3>21. High-Value Transactions &amp; No Professional Advice</h3>
      <p>DealMai AI agents do not provide licensed professional, legal, medical, tax, or financial
      advice. Workflows involving high-value financial transactions, legal commitments, or critical
      health decisions must incorporate human review ("human-in-the-loop").</p>

      <h3>22. Export Controls &amp; Sanctions Compliance</h3>
      <p>You warrant that your business complies with applicable export controls and trade sanctions
      under Thai law, UN resolutions, and international regulations. Usage from comprehensively
      sanctioned jurisdictions is strictly prohibited.</p>

      <h3>23. Modifications to Terms</h3>
      <p>We may update these Terms periodically. For material changes, we will provide at least 30
      days' notice via email or dashboard notification before updates take effect. Non-material edits
      will be published directly to this page with an updated "Last Updated" timestamp. Continued use
      of DealMai after the effective date constitutes acceptance.</p>

      <h3>24. Governing Law &amp; Dispute Resolution</h3>
      <ol>
        <li><strong>Governing Law:</strong> These Terms, their interpretation, and any disputes
        arising out of or in connection with DealMai shall be governed exclusively by the laws of the
        Kingdom of Thailand.</li>
        <li><strong>Informal Resolution:</strong> In the event of a dispute, parties shall first
        attempt to resolve the matter in good faith by contacting support@dealmai.com for at least 30
        days.</li>
        <li><strong>Jurisdiction:</strong> If informal negotiation does not yield a resolution,
        disputes shall be submitted to the exclusive jurisdiction of the competent courts in Bangkok,
        Thailand.</li>
      </ol>

      <h3>25. General Provisions &amp; Group Affiliates</h3>
      <ul>
        <li><strong>Corporate Structure &amp; Affiliates:</strong> ONTHELINE INTERNATIONAL COMPANY
        LIMITED operates DealMai and may utilize its global Affiliates and regional group entities to
        provide technical support, software licensing, and operational assistance. Performance of
        obligations by an Affiliate shall satisfy the obligations of ONTHELINE INTERNATIONAL COMPANY
        LIMITED hereunder.</li>
        <li><strong>Entire Agreement:</strong> These Terms, along with our Privacy Policy and
        incorporated DPA, constitute the entire agreement between you and ONTHELINE INTERNATIONAL
        COMPANY LIMITED regarding DealMai.</li>
        <li><strong>Severability:</strong> If any provision is deemed unenforceable under Thai law,
        the remaining provisions shall remain in full force and effect.</li>
        <li><strong>Assignment:</strong> You may not assign or transfer your rights under these Terms
        without our prior written consent. We may assign this agreement in connection with a corporate
        reorganization, merger, or asset transfer to an Affiliate without consent.</li>
        <li><strong>Force Majeure:</strong> Neither party is liable for service delays caused by
        events beyond reasonable control, including natural disasters, acts of government,
        telecommunications failures, or upstream platform outages.</li>
        <li><strong>Official Notices:</strong> Legal notices to us must be sent to: ONTHELINE
        INTERNATIONAL COMPANY LIMITED, Attn: Legal &amp; Compliance Department, 299/724, Sukhaphiban 5
        Road, Anusawari Sub-district, Bang Khen District, Bangkok, Thailand ·
        support@dealmai.com</li>
      </ul>

      <h3 style="margin-top:38px">DealMai Privacy Policy &amp; APAC Regional Data Protection Notice</h3>
      <div class="doc-meta"><div><span class="k">Effective</span>July 31, 2026</div></div>

      <h4>1. Overview &amp; Data Controller Framework</h4>
      <p>ONTHELINE INTERNATIONAL COMPANY LIMITED ("Company", "We", "Us", or "Our") operates the
      DealMai AI Sales Agent and Automation Platform. We are committed to protecting the privacy and
      personal data of our commercial clients ("Merchants", "Customers") and their end users across
      the Asia-Pacific (APAC) region.</p>
      <ul>
        <li><strong>Data Controller Role:</strong> ONTHELINE INTERNATIONAL COMPANY LIMITED acts as the
        primary Data Controller responsible for user account management, billing, credentials,
        authentication logs, and platform administration.</li>
        <li><strong>Data Processor Role:</strong> When Merchants process messaging logs, customer
        contact lists, or automated chat workflows through DealMai, the Merchant acts as the Data
        Controller and ONTHELINE INTERNATIONAL COMPANY LIMITED acts as the Data Processor.</li>
        <li><strong>Third-Party Sub-processors:</strong> Enterprise infrastructure, database hosting,
        and underlying AI model vendors act as contractual Data Processors / Sub-processors.</li>
      </ul>

      <h4>2. Information We Collect</h4>
      <p>We collect data strictly necessary to deliver, secure, and operate the DealMai platform:</p>
      <ul>
        <li><strong>Account &amp; Billing Data:</strong> Name, business registration details,
        corporate email address, phone number, billing address, tax identification numbers, and
        transaction metadata.</li>
        <li><strong>Service &amp; Workspace Operational Data:</strong> Customer chat transcripts,
        uploaded knowledge base files, automated conversation scripts, contact lists, custom function
        configurations, and campaign execution records.</li>
        <li><strong>Technical &amp; Diagnostic Data:</strong> IP addresses, browser types, device
        identifiers, session timestamps, authentication tokens, and system event logs.</li>
      </ul>
      <div class="doc-callout good">
        <strong>Zero AI Model Training Guarantee:</strong> We do NOT use Customer Data, conversation
        logs, end-user text, or uploaded media files to train, retrain, or improve artificial
        intelligence models (including Anthropic Claude or Google Gemini architectures). Our
        underlying AI infrastructure sub-processors are contractually bound under enterprise
        agreements prohibiting model training on Customer Data.
      </div>

      <h4>3. Payment Gateway Security &amp; Card Data</h4>
      <ol>
        <li><strong>PCI-DSS Compliance:</strong> All payment processing (including Visa, Mastercard,
        QR PromptPay, Mobile Banking, and E-Wallets) is executed directly via secure, PCI-DSS
        certified payment gateway partners.</li>
        <li><strong>No Local Storage:</strong> ONTHELINE INTERNATIONAL COMPANY LIMITED does not
        process, store, or transmit full credit/debit card numbers or CVV codes on its primary
        application servers.</li>
      </ol>

      <h4>4. Cross-Border Data Transfers &amp; Infrastructure</h4>
      <p>Our core application databases and storage servers reside in enterprise data center
      facilities located within the European Union (EU). Generating automated AI responses requires
      routing prompt data securely via encrypted protocols to authorized AI sub-processors.</p>
      <p>We enforce appropriate technical, organizational, and contractual transfer mechanisms
      (including Standard Contractual Clauses and intra-group data protection addenda) to ensure
      cross-border transfers satisfy the statutory standards of all operating jurisdictions.</p>

      <h4>5. APAC Regional Compliance Addenda</h4>
      <p><strong>A. Thailand (PDPA B.E. 2562)</strong> — Data subjects possess statutory rights to
      access, rectify, port, restrict, erase, or object to the processing of their personal data.
      Transfers of personal data outside Thailand satisfy the protection adequacy requirements under
      Sections 28 and 29 of the PDPA.</p>
      <p><strong>B. Japan (APPI)</strong> — Users are notified that personal data may be processed on
      EU-based database cloud servers and US-based AI sub-processor infrastructure maintaining
      security standards equivalent to APPI requirements. Personal information collected from Japanese
      business users is utilized strictly for service delivery, system security, and contractual
      performance.</p>
      <p><strong>C. South Korea (PIPA)</strong> — We delegate processing tasks to vetted cloud
      sub-processors strictly under contractual requirements prohibiting unauthorized processing,
      secondary usage, or AI model training. Upon expiration of required statutory retention windows,
      personal data is irreversibly destroyed or anonymized.</p>
      <p><strong>D. Hong Kong (PDPO Cap. 486)</strong> — Personal data is collected solely for direct
      platform operations, customer support, and billing (DPP 3). Transfers outside Hong Kong follow
      the PCPD's recommended model contractual clauses and data governance frameworks.</p>
      <p><strong>E. Singapore (PDPA 2012)</strong> — In compliance with Section 26, any personal data
      transferred outside Singapore receives a standard of protection comparable to that guaranteed
      under Singapore law. Where DealMai processes end-user messages on behalf of Singapore business
      accounts, we act as a Data Intermediary adhering to strict security and retention
      limitations.</p>

      <h4>6. Summary of Data Subject Statutory Rights</h4>
      <table class="doc-table">
        <thead><tr><th>Right</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>Access &amp; Copy</td><td style="font-family:inherit;white-space:normal">Request confirmation of data processing and obtain copies of stored personal data.</td></tr>
          <tr><td>Rectification</td><td style="font-family:inherit;white-space:normal">Request correction or updating of inaccurate or incomplete personal records.</td></tr>
          <tr><td>Erasure / Deletion</td><td style="font-family:inherit;white-space:normal">Request permanent removal or anonymization of personal data under statutory conditions.</td></tr>
          <tr><td>Restrict / Object</td><td style="font-family:inherit;white-space:normal">Limit or object to specific processing operations, including direct marketing.</td></tr>
          <tr><td>Data Portability</td><td style="font-family:inherit;white-space:normal">Request transfer of personal data in a machine-readable, structured format.</td></tr>
        </tbody>
      </table>

      <h4>7. Data Retention &amp; Deletion Schedule</h4>
      <ol>
        <li><strong>Active Account Data:</strong> Stored for the duration of your active
        subscription.</li>
        <li><strong>Post-Termination Window:</strong> Customer Data remains available for dashboard
        export for 30 days following account cancellation, after which active records are purged.</li>
        <li><strong>Disaster Recovery Backups:</strong> Encrypted system backups are retained for up
        to 90 days post-deletion strictly for system recovery, after which they are automatically
        overwritten.</li>
        <li><strong>Tax &amp; Financial Records:</strong> Transaction details and invoice data are
        retained for up to 7 years to satisfy statutory corporate accounting and tax laws in
        Thailand.</li>
      </ol>

      <h4>8. Data Privacy Contact Information</h4>
      <div class="doc-meta">
        <div><span class="k">Entity</span>ONTHELINE INTERNATIONAL COMPANY LIMITED</div>
        <div><span class="k">Department</span>Privacy &amp; Data Compliance Team</div>
        <div><span class="k">Address</span>299/724, Sukhaphiban 5 Road, Anusawari Sub-district, Bang Khen District, Bangkok, Thailand</div>
        <div><span class="k">Email</span><a href="mailto:support@dealmai.com">support@dealmai.com</a></div>
        <div><span class="k">Response SLA</span>Statutory privacy requests addressed within 30 calendar days of receipt.</div>
      </div>`;
  }
};

// ===========================================================
// History API integration: every navigation pushes a history entry so the
// browser back button moves between pages within the SPA instead of exiting
// the site. A popstate listener (installed at the bottom of this file) takes
// over for back/forward presses — it calls _goNoPush() which renders without
// pushing another entry. Modals/drawers are closed by back-button before
// the page actually navigates (matches native mobile OS behaviour).
const App = {
  // The optional second argument is { fromPopstate: true } when called by
  // the popstate listener — that path skips the pushState at the end.
  go(name, opts){
    const fromPopstate = !!(opts && opts.fromPopstate);
    document.querySelectorAll(".page").forEach(p => p.classList.remove("show"));
    const target = document.getElementById("page-"+name);
    if(!target) return;
    target.classList.add("show");
    document.querySelectorAll(".nav-desktop button").forEach(b =>
      b.classList.toggle("active", b.dataset.nav === name)
    );
    // Block protected pages if not signed in
    if((name === "admin" || name === "account" || name === "orders") && !State.user){
      this.openLogin();
      return;
    }
    // Customers shouldn't reach the admin page
    if(name === "admin" && State.user && State.user.role !== "admin"){
      this.go("account", opts);
      return;
    }
    if(name === "admin") this.setAdmin("orders", null, opts);
    // Always re-render packages on navigation. The realtime listener only
    // re-renders pages that are currently `.show`-visible; if the customer
    // (or admin) was on another page when a package was added/edited/removed,
    // the cards on /packages would still be the stale version from initial
    // boot until they hit refresh. Re-rendering here ensures the latest
    // PACKAGES state (kept in sync by subscribePackages) is reflected
    // immediately when the page becomes visible.
    if(name === "packages") this.renderPackages();
    // About Us teaser lives on both Home and Packages — re-render on entry so
    // it picks up the current language.
    if(name === "home" || name === "packages") this.renderAboutBlocks();
    if(name === "checkout") this.renderCheckout();
    if(name === "confirm" && !State.lastOrder){ this.go("packages", opts); return; }
    if(name === "payment-result") this.renderPaymentResult();
    if(name === "account") renderCustomerAccount();
    if(name === "orders") renderCustomerOrders();
    window.scrollTo({ top:0, behavior:"smooth" });

    // Push a history entry unless we're already rendering in response to one
    // (i.e. the back/forward button is what got us here).
    if(!fromPopstate){
      try{
        const url = (name === "home") ? "/" : "/" + name;
        const state = { page: name };
        const cur = history.state;
        if(!(cur && cur.page === name)){
          history.pushState(state, "", url);
        }
      }catch(e){ /* history API may be disabled in some embedded views */ }
    }
  },

  // Language picker
  // Whether a UI language is enabled for end-users. "en" is always enabled
  // (fallback). When State.branding.enabledLangs is null/absent, all supported
  // languages are enabled (backwards-compatible default).
  isLangEnabled(code){
    if(code === "en") return true;
    const list = State.branding && State.branding.enabledLangs;
    if(!Array.isArray(list)) return true;     // null = all enabled
    return list.indexOf(code) !== -1;
  },

  buildLangPicker(){
    const wrap = document.getElementById("lang-picker");
    const drawer = document.getElementById("drawer-lang");
    if(!wrap || !drawer) return;
    wrap.innerHTML = "";
    drawer.innerHTML = "";
    State.langs.forEach(l => {
      // Hide languages the admin has disabled (en is always shown).
      if(!this.isLangEnabled(l.code)) return;
      const s = State.langStatus[l.code] || { locked:true };
      const disabled = s.locked && l.code !== "en";

      const btn = document.createElement("button");
      btn.textContent = l.code.toUpperCase();
      btn.className = (State.currentLang === l.code ? "on " : "") + (disabled ? "locked" : "");
      btn.title = disabled ? `Not yet translated (${s.pct||0}%)` : l.native;
      if(!disabled) btn.onclick = () => this.setLang(l.code);
      wrap.appendChild(btn);

      const b2 = document.createElement("button");
      b2.textContent = `${l.code.toUpperCase()} ${disabled?"·"+(s.pct||0)+"%":""}`;
      b2.className = (State.currentLang === l.code ? "on " : "") + (disabled ? "locked" : "");
      if(!disabled) b2.onclick = () => this.setLang(l.code);
      drawer.appendChild(b2);
    });

    // Receipt language select on checkout
    const sel = document.getElementById("co-lang");
    if(sel){
      sel.innerHTML = "";
      State.langs.forEach(l => {
        if(!this.isLangEnabled(l.code)) return;
        const s = State.langStatus[l.code] || {};
        if(!s.locked || l.code==="en"){
          const o = document.createElement("option");
          o.value = l.code; o.textContent = l.native;
          if(l.code === State.currentLang) o.selected = true;
          sel.appendChild(o);
        }
      });
    }
  },

  setLang(code){
    State.currentLang = code;
    I.apply();
    this.buildLangPicker();
    this.updateAuthUI();
    this.renderHome();
    this.renderPackages();
    this.renderAboutBlocks();
    // If the About document modal is open, rebuild it so its body switches
    // language too. (The Terms modal is English-only, so it's left alone.)
    if(document.querySelector('.doc-modal[data-doc="about"]')) this.openAboutModal();
    if(document.getElementById("page-checkout").classList.contains("show")) this.renderCheckout();
    // Customer-facing pages are built with JS template literals (not just
    // [data-i18n] elements), so I.apply() alone can't relabel their content +
    // buttons. Re-render whichever customer page is currently visible so the
    // whole page (cards, stats, CTA buttons) switches language immediately.
    if(document.getElementById("page-account")?.classList.contains("show")){
      try{ renderCustomerAccount(); }catch{}
    }
    if(document.getElementById("page-orders")?.classList.contains("show")){
      try{ renderCustomerOrders(); }catch{}
    }
    if(document.getElementById("page-admin").classList.contains("show")){
      const active = document.querySelector(".side-item.active");
      if(active) this.setAdmin(active.dataset.admin);
    }
  },

  // Drawer
  openDrawer(){ document.getElementById("drawer").classList.add("open"); document.getElementById("drawer-bg").classList.add("open"); },
  closeDrawer(){ document.getElementById("drawer").classList.remove("open"); document.getElementById("drawer-bg").classList.remove("open"); },

  // Login modal
  async openLogin(){
    // Re-check whether an admin exists every time the modal opens — the picture
    // may have changed (e.g. rules just got published, admin just got created).
    try{
      const result = await adminExists();
      if(result === null){
        // Rules still blocking
        State.hasAdmin = true;
        showRulesBanner();
      }else{
        State.hasAdmin = result;
      }
    }catch{}
    updateLoginModalMode();
    document.getElementById("login-modal").classList.add("show");
  },
  closeLogin(){ document.getElementById("login-modal").classList.remove("show"); },

  async doLogin(){
    const email = document.getElementById("li-email").value.trim().toLowerCase();
    const pass = document.getElementById("li-pass").value;
    if(!email || !pass) return Toast.show(I.t("toast.login.fail"),"err");

    // SETUP MODE: if no admin profile yet, the first login attempt creates the admin.
    // If the email is already registered in Auth (from a previous attempt), fall through
    // to sign-in and write the missing profile.
    if(!State.hasAdmin){
      try{
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db,"users",cred.user.uid), {
          uid: cred.user.uid,
          email,
          name: "Admin",
          role: "admin",
          mustChangePassword: false,
          createdAt: serverTimestamp()
        });
        State.hasAdmin = true;
        this.closeLogin();
        Toast.show("Admin account created — welcome!","ok");
        // onAuthStateChanged will handle navigation
        return;
      }catch(e){
        // If the Auth account already exists, try signing in with the same credentials
        // and create/update the Firestore admin profile
        if(e.code === "auth/email-already-in-use"){
          try{
            const cred = await signInWithEmailAndPassword(auth, email, pass);
            // Ensure the Firestore profile exists and is admin
            await setDoc(doc(db,"users",cred.user.uid), {
              uid: cred.user.uid,
              email,
              name: "Admin",
              role: "admin",
              mustChangePassword: false,
              createdAt: serverTimestamp()
            }, { merge: true });
            State.hasAdmin = true;
            this.closeLogin();
            Toast.show("Admin profile linked — welcome back!","ok");
            return;
          }catch(signinErr){
            console.error(signinErr);
            if(signinErr.code === "auth/invalid-credential" || signinErr.code === "auth/wrong-password"){
              return Toast.show("This email is already registered with a different password. Use the correct password.","err");
            }
            return Toast.show("Setup recovery failed: "+(signinErr.code||signinErr.message),"err");
          }
        }
        console.error(e);
        let msg = "Setup failed: " + (e.code || e.message);
        if(e.code === "auth/weak-password") msg = "Password too weak (min 6 chars)";
        if(e.code === "auth/invalid-email") msg = "Invalid email format";
        if(e.code === "auth/operation-not-allowed") msg = "Email/Password sign-in is not enabled in Firebase Console.";
        Toast.show(msg,"err");
      }
      return;
    }

    // SIGN IN MODE
    try{
      await signInWithEmailAndPassword(auth, email, pass);
      this.closeLogin();
      // onAuthStateChanged will populate State.user, show toast, and go to admin
    }catch(e){
      const code = e.code || "";
      // Special case: invalid credentials may mean the account doesn't exist yet.
      // Re-check whether there's any admin — if not, we should have been in setup mode all along.
      if(code === "auth/invalid-credential" || code === "auth/user-not-found"){
        try{
          const result = await adminExists();
          if(result === false){
            // No admin exists. Switch to setup mode and try creating the account instead.
            State.hasAdmin = false;
            updateLoginModalMode();
            Toast.show("No admin found — switching to setup mode. Click 'Create Admin' to register this account.","warn");
            return;
          }
        }catch{}
      }
      let msg = I.t("toast.login.fail");
      if(code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"){
        msg = I.t("toast.login.fail") + " — try 'Forgot Password?' below.";
      }else if(code === "auth/too-many-requests"){
        msg = "Too many failed attempts — please try again later.";
      }else if(code === "auth/operation-not-allowed"){
        msg = "Email/Password sign-in is not enabled in Firebase Console.";
      }else{
        msg = "Login error: " + (code || e.message);
      }
      Toast.show(msg,"err");
    }
  },

  async logout(){
    try{
      await signOut(auth);
      // onAuthStateChanged will clear State.user
      Toast.show("Signed out","ok");
      // Wipe any protected URL (like /admin) from the current entry so the
      // browser back button can't reveal it later. replaceState (not push)
      // is what gives us this guarantee.
      try{ history.replaceState({ page: "home" }, "", "/"); }catch(e){}
      this.go("home", { fromPopstate: true });  // skip the auto-push inside go()
    }catch(e){
      Toast.show("Sign out error: "+e.message,"err");
    }
  },

  // Single click target for the top-right auth button.
  // Behaves as "Sign In" when logged out and "Sign Out" when logged in.
  authButtonClick(){
    if(State.user){
      this.logout();
    }else{
      this.openLogin();
    }
  },

  // Sync the auth-related UI bits (top button label, admin nav visibility) with State.user
  updateAuthUI(){
    const isAuthed = !!State.user;
    const isAdmin = isAuthed && State.user.role === "admin";
    const isCustomer = isAuthed && State.user.role === "customer";

    // Top auth button (desktop)
    const authBtn = document.getElementById("auth-btn");
    if(authBtn){
      authBtn.textContent = isAuthed ? I.t("nav.signout") : I.t("nav.login");
      // Don't translate via data-i18n here — we set textContent directly
      authBtn.removeAttribute("data-i18n");
    }

    // Drawer auth button
    const drawerAuthBtn = document.getElementById("drawer-auth-btn");
    if(drawerAuthBtn){
      const span = drawerAuthBtn.querySelector("span");
      if(span){
        span.textContent = isAuthed ? I.t("nav.signout") : I.t("nav.login");
        span.removeAttribute("data-i18n");
      }
    }

    // Admin nav buttons — visible only for admin role
    const navAdminBtn = document.getElementById("nav-admin-btn");
    if(navAdminBtn) navAdminBtn.style.display = isAdmin ? "" : "none";
    const drawerAdminBtn = document.getElementById("drawer-admin-btn");
    if(drawerAdminBtn) drawerAdminBtn.style.display = isAdmin ? "" : "none";

    // Customer portal nav buttons — visible only for customer role
    const navAccountBtn = document.getElementById("nav-account-btn");
    if(navAccountBtn) navAccountBtn.style.display = isCustomer ? "" : "none";
    const navOrdersBtn = document.getElementById("nav-orders-btn");
    if(navOrdersBtn) navOrdersBtn.style.display = isCustomer ? "" : "none";
    const drawerAccountBtn = document.getElementById("drawer-account-btn");
    if(drawerAccountBtn) drawerAccountBtn.style.display = isCustomer ? "" : "none";
    const drawerOrdersBtn = document.getElementById("drawer-orders-btn");
    if(drawerOrdersBtn) drawerOrdersBtn.style.display = isCustomer ? "" : "none";

    // Hero secondary CTA — shows role-appropriate button. Logged out: "Sign In",
    // admin: "Open Admin Console", customer: "Go to My Account".
    const heroCtaAdmin   = document.getElementById("hero-cta-admin");
    const heroCtaAccount = document.getElementById("hero-cta-account");
    const heroCtaSignin  = document.getElementById("hero-cta-signin");
    if(heroCtaAdmin)   heroCtaAdmin.style.display   = isAdmin    ? "" : "none";
    if(heroCtaAccount) heroCtaAccount.style.display = isCustomer ? "" : "none";
    if(heroCtaSignin)  heroCtaSignin.style.display  = isAuthed   ? "none" : "";
  },

  async forgotPassword(){
    const email = (document.getElementById("li-email").value || "").trim().toLowerCase();
    if(!email){
      Toast.show("Enter your email above first, then click Forgot Password.","warn");
      return;
    }
    if(!confirm(`Send password reset email to ${email}?`)) return;
    try{
      await sendPasswordResetEmail(auth, email);
      Toast.show(`Password reset email sent to ${email}. Check your inbox.`,"ok");
    }catch(e){
      console.error(e);
      let msg = "Reset failed: " + (e.code || e.message);
      if(e.code === "auth/user-not-found") msg = "No account exists with that email.";
      if(e.code === "auth/invalid-email") msg = "Invalid email format.";
      Toast.show(msg,"err");
    }
  },

  // Generic modal
  showModal(html){
    document.getElementById("generic-modal-inner").innerHTML = html;
    document.getElementById("generic-modal").classList.add("show");
  },
  closeModal(){ document.getElementById("generic-modal").classList.remove("show"); },

  // ===== ABOUT US =====
  // Renders the short "About ONTHELINE & DealMai" teaser into the Home and
  // Packages pages. The full text opens in a scrollable document modal.
  renderAboutBlocks(){
    const html = `
      <div class="about-block">
        <div class="about-eyebrow">${I.t("about.eyebrow")}</div>
        <h3>${I.t("about.heading-html")}</h3>
        <p>${I.t("about.teaser-html")}</p>
        <button class="about-more" onclick="App.openAboutModal()">
          <span>${I.t("about.readmore")}</span><span class="arr">→</span>
        </button>
      </div>`;
    const homeEl = document.getElementById("about-home");
    const pkgEl  = document.getElementById("about-packages");
    if(homeEl) homeEl.innerHTML = html;
    if(pkgEl)  pkgEl.innerHTML  = html;
  },

  openAboutModal(){
    this.showModal(`
      <div class="doc-modal" data-doc="about">
        <div class="doc-head">
          <div class="kicker">${I.t("about.modal.kicker")}</div>
          <h2>${I.t("about.modal.title")}</h2>
          <div class="sub">${I.t("about.modal.sub")}</div>
        </div>
        <div class="doc-body">${Docs.aboutUs()}</div>
        <div class="doc-foot">
          <button class="btn-primary" onclick="App.closeModal()"><span>${I.t("doc.close")}</span></button>
        </div>
      </div>`);
  },

  // ===== TERMS OF SERVICE / PRIVACY POLICY =====
  openTermsModal(){
    this.showModal(`
      <div class="doc-modal">
        <div class="doc-head">
          <div class="kicker">${I.t("terms.modal.kicker")}</div>
          <h2>${I.t("terms.modal.title")}</h2>
          <div class="sub">${I.t("terms.modal.sub")}</div>
        </div>
        <div class="doc-body">${Docs.terms()}</div>
        <div class="doc-foot">
          <button class="btn-primary" onclick="App.closeModal()"><span>${I.t("doc.close")}</span></button>
        </div>
      </div>`);
  },

  // Enable/disable the Confirm & Pay button based on the consent checkbox.
  onTermsToggle(){
    const cb  = document.getElementById("co-terms");
    const btn = document.getElementById("co-submit-btn");
    const box = document.getElementById("co-terms-block");
    if(btn) btn.disabled = !(cb && cb.checked);
    if(box && cb && cb.checked) box.classList.remove("warn");
  },

  // Copy the value of a button's data-copy attribute to clipboard.
  // Used by the DM Champ sub-account card and other long-string fields
  // where inline JSON.stringify in onclick would corrupt the attribute.
  copyFromAttr(el){
    const val = el?.getAttribute("data-copy") || "";
    if(!val) return;
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(val).then(
        () => Toast.show("Copied", "ok"),
        () => Toast.show("Copy failed", "err")
      );
    }else{
      // Fallback for older browsers / non-secure contexts
      try{
        const ta = document.createElement("textarea");
        ta.value = val;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        Toast.show("Copied", "ok");
      }catch{
        Toast.show("Copy failed", "err");
      }
    }
  },

  // Tabs
  setTab(name){
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".pkg-set").forEach(s => s.classList.remove("show"));
    document.getElementById("set-"+name).classList.add("show");
  },

  // ============= RENDER METHODS =============
  renderHome(){
    // Capability cards
    const grid = document.getElementById("cap-grid");
    if(grid){
      grid.innerHTML = CAPS.map((c, i) => `
        <div class="cap">
          <div class="cap-icon">${String(i+1).padStart(2,"0")}</div>
          <h3>${I.t(c+".t")}</h3>
          <p>${I.t(c+".d")}</p>
        </div>
      `).join("");
    }
    // Marquee
    const strip = document.getElementById("strip-track");
    if(strip){
      const items = ["WhatsApp","Instagram","Messenger","Web Chat","Voice Notes","PDF Understanding","Calendar Booking","Comment-to-DM"];
      const html = `<span>${items.join("</span><span>")}</span>`;
      strip.innerHTML = html + html;
    }
    // Terminal
    const term = document.getElementById("hero-terminal");
    if(term){
      term.innerHTML = TERMINAL_LINES.map(([cls, txt]) =>
        cls ? `<span class="${cls}">${txt}</span>` : txt
      ).join("\n");
    }
  },

  renderPackages(flashChanged){
    // Capture pre-render digest of each card on the page so we can flash the
    // ones whose key fields (price/title/featured/duration) changed in this
    // re-render. Cards that disappeared are dropped naturally; new cards get
    // the "flash-new" treatment.
    const prevCards = {};
    document.querySelectorAll(".pkg-card[data-pid]").forEach(el => {
      prevCards[el.dataset.pid] = {
        price: parseFloat(el.dataset.price),
        title: el.querySelector(".pkg-label")?.textContent || "",
        featured: el.classList.contains("featured")
      };
    });

    const renderCard = (bucket, p) => {
      const featured = p.featured ? "featured" : "";
      const badge = p.featured ? `<div class="badge">${I.t("pkg.featured")}</div>` : "";
      const per = bucket === "sub" ? `<span class="per">/mo</span>` : "";
      const cta = bucket === "sub" ? "pkg.subscribe" : "pkg.select";
      const title = pkgTitle(p);
      const desc = pkgDesc(p);
      return `
        <div class="pkg-card ${featured}" data-bucket="${bucket}" data-pid="${p.id}" data-price="${p.price}" onclick="App.selectPackage(this.dataset.bucket,this.dataset.pid,parseFloat(this.dataset.price))">
          ${badge}
          <div class="pkg-label">${escapeHtml(title)}</div>
          <div class="pkg-price"><span class="cur">$</span>${p.price.toLocaleString()}${per}</div>
          <div class="pkg-meta">${escapeHtml(desc)}</div>
          <div class="pkg-cta"><span>${I.t(cta)}</span><span class="arr">→</span></div>
        </div>
      `;
    };

    // Credit Purchase — includes Manual Input card
    const gc = document.getElementById("grid-credit");
    if(gc){
      gc.innerHTML = PACKAGES.credit.map(p => renderCard("credit", p)).join("") +
        `<div class="pkg-card manual" onclick="App.openManual()">
          <div class="pkg-label">${I.t("pkg.manual.title")}</div>
          <div class="pkg-price">Custom</div>
          <div class="pkg-meta">${I.t("pkg.manual.desc")}</div>
          <div class="pkg-cta"><span>${I.t("pkg.configure")}</span><span class="arr">→</span></div>
        </div>`;
    }
    const go = document.getElementById("grid-onetime");
    if(go) go.innerHTML = PACKAGES.onetime.map(p => renderCard("onetime", p)).join("");
    const gs = document.getElementById("grid-sub");
    if(gs) gs.innerHTML = PACKAGES.sub.map(p => renderCard("sub", p)).join("");

    // Apply flash animation to changed/new cards. Done after innerHTML write
    // so the DOM nodes exist. The CSS class triggers a brief color pulse
    // (defined in index.html under .pkg-card.flash-changed / .flash-new).
    if(flashChanged){
      document.querySelectorAll(".pkg-card[data-pid]").forEach(el => {
        const pid = el.dataset.pid;
        const newPrice = parseFloat(el.dataset.price);
        const newTitle = el.querySelector(".pkg-label")?.textContent || "";
        const newFeatured = el.classList.contains("featured");
        const prev = prevCards[pid];
        if(!prev){
          // New card that wasn't there before
          el.classList.add("flash-new");
          setTimeout(() => el.classList.remove("flash-new"), 2400);
        }else if(
          Math.abs(prev.price - newPrice) > 0.001 ||
          prev.title !== newTitle ||
          prev.featured !== newFeatured
        ){
          el.classList.add("flash-changed");
          setTimeout(() => el.classList.remove("flash-changed"), 2400);
        }
      });
    }
  },

  selectPackage(bucket, id, price){
    const list = PACKAGES[bucket] || [];
    const found = list.find(p => p.id === id);
    if(!found) return;
    State.selectedPackage = {
      bucket,
      id,
      price,
      title: pkgTitle(found)
    };
    this.go("checkout");
  },

  openManual(){
    this.showModal(`
      <button class="close" onclick="App.closeModal()">×</button>
      <h2>${I.t("pkg.manual.title")}</h2>
      <div class="sub">Credit Purchase · Custom Amount</div>
      <div class="field">
        <label>${I.t("pkg.manual.label")}</label>
        <input type="number" id="manual-amt" placeholder="e.g. 35" min="1" step="0.01" />
      </div>
      <button class="btn-primary" onclick="App.submitManual()">
        <span>${I.t("pkg.select")}</span><span class="arr">→</span>
      </button>
    `);
  },

  submitManual(){
    const v = parseFloat(document.getElementById("manual-amt").value);
    if(!v || v <= 0) return Toast.show("Enter a valid amount","err");
    State.selectedPackage = {
      bucket:"credit",
      id:"credit.manual",
      price: v,
      title: I.t("pkg.manual.title"),
      manual: true
    };
    this.closeModal();
    this.go("checkout");
  },

  renderCheckout(){
    if(!State.selectedPackage) return this.go("packages");
    const p = State.selectedPackage;
    const vat = +(p.price * 0.07).toFixed(2);
    const total = +(p.price + vat).toFixed(2);

    const renewLabel = p.bucket === "sub" ? `<div class="summary-item"><span class="lab">Renewal cycle</span><span class="val">${p.title}</span></div>` : "";

    document.getElementById("checkout-summary").innerHTML = `
      <h3>${I.t("checkout.summary.title")}</h3>
      <div class="summary-item"><span class="lab">${I.t("checkout.summary.package")}</span><span class="val">${p.title}${p.manual?` · $${p.price}`:""}</span></div>
      ${renewLabel}
      <div class="summary-item"><span class="lab">${I.t("checkout.summary.activation")}</span><span class="val">${I.t("checkout.summary.activation-val")}</span></div>
      <div class="summary-item"><span class="lab">${I.t("checkout.summary.subtotal")}</span><span class="val">$${p.price.toFixed(2)}</span></div>
      <div class="summary-item"><span class="lab">${I.t("checkout.summary.vat")}</span><span class="val">$${vat.toFixed(2)}</span></div>
      <div class="summary-total"><span class="lab">${I.t("checkout.summary.total")}</span><span class="val">$${total.toFixed(2)}</span></div>
      <div class="terms-block" id="co-terms-block">
        <div class="terms-link-row">${I.t("checkout.terms.intro-html")}</div>
        <label class="terms-consent">
          <input type="checkbox" id="co-terms" onchange="App.onTermsToggle()">
          <span>${I.t("checkout.terms.consent")}</span>
        </label>
      </div>
      <button class="btn-primary" id="co-submit-btn" onclick="App.submitCheckout()" disabled><span id="co-submit-label">${I.t("checkout.summary.cta")}</span><span class="arr">→</span></button>
      <div class="secure"><span class="d"></span>${I.t("checkout.summary.secure")}</div>
      <div style="margin-top:10px;font-family:var(--mono);font-size:10px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;text-align:center">${I.t("checkout.summary.powered")}</div>
    `;

    // Customer details:
    //  • Signed in  → prefill the form with the account's real details.
    //  • Signed out → show sample values as PLACEHOLDERS only (grey, not real
    //    input), so nothing bogus is ever submitted. submitCheckout() validates
    //    that the required fields were actually filled in.
    const nameEl = document.getElementById("co-name");
    const mailEl = document.getElementById("co-email");
    const compEl = document.getElementById("co-company");
    const taxEl  = document.getElementById("co-taxid");
    const u = State.user;
    if(u && u.role === "customer"){
      if(!nameEl.value) nameEl.value = u.name || "";
      if(!mailEl.value) mailEl.value = u.email || "";
      // Company / Tax ID aren't part of the auth profile — leave them for the
      // customer to fill, but hint with the sample format.
      compEl.placeholder = I.t("checkout.ph.company");
      taxEl.placeholder  = I.t("checkout.ph.taxid");
    }else{
      nameEl.placeholder = I.t("checkout.ph.name");
      mailEl.placeholder = I.t("checkout.ph.email");
      compEl.placeholder = I.t("checkout.ph.company");
      taxEl.placeholder  = I.t("checkout.ph.taxid");
    }
    // Re-rendering rebuilds the summary, so the consent checkbox resets — make
    // sure the pay button starts disabled in sync with it.
    this.onTermsToggle();

    // ---- Payment channels ----
    // Rebuild the pills from the ACTIVE gateway's channel list so switching
    // provider changes the options automatically. The markup in index.html is
    // only a placeholder shown while the config loads (and a fallback if the
    // lookup fails), so checkout still works if the function is unreachable.
    const channelsWrap = document.getElementById("co-channels");
    const wireChannels = () => {
      if(!channelsWrap) return;
      channelsWrap.querySelectorAll(".pay-pill").forEach(pill => {
        pill.onclick = () => {
          const ch = pill.dataset.channel || "";
          State.selectedChannel = ch;
          channelsWrap.querySelectorAll(".pay-pill").forEach(p2 => p2.classList.toggle("on", p2 === pill));
        };
        // Restore previously selected channel
        if((pill.dataset.channel || "") === (State.selectedChannel || "")){
          channelsWrap.querySelectorAll(".pay-pill").forEach(p2 => p2.classList.remove("on"));
          pill.classList.add("on");
        }
      });
    };
    wireChannels();

    if(channelsWrap){
      loadActiveGatewayChannels().then(channels => {
        if(!channels || !channels.length) return;                  // keep the fallback pills
        // If the selected channel isn't offered by this gateway, reset it so we
        // never send a code the provider would reject.
        const codes = channels.map(c => c.code);
        if(State.selectedChannel && !codes.includes(State.selectedChannel)) State.selectedChannel = "";
        if(!State.selectedChannel) State.selectedChannel = codes[0] || "";

        channelsWrap.innerHTML = channels.map(c => {
          const label = I.t(c.labelKey) || c.label || c.code;
          const on = (c.code === State.selectedChannel) ? " on" : "";
          return `<div class="pay-pill${on}" data-channel="${escapeHtml(c.code)}"><span class="dot"></span><span>${escapeHtml(label)}</span></div>`;
        }).join("");
        wireChannels();
      }).catch(() => { /* keep fallback pills */ });
    }
  },

  async submitCheckout(){
    const p = State.selectedPackage;
    if(!p) return;
    const nameEl = document.getElementById("co-name");
    const mailEl = document.getElementById("co-email");
    const name = nameEl.value.trim();
    const email = mailEl.value.trim();
    const company = document.getElementById("co-company").value.trim();
    const taxId = (document.getElementById("co-taxid")?.value || "").trim();
    const country = document.getElementById("co-country").value;
    const recvLang = document.getElementById("co-lang").value || "en";

    // --- Validation: required customer details -------------------------------
    // Placeholders are only hints, so an untouched form arrives here empty.
    // Flag the offending field, focus it, and stop before payment.
    const flag = (el) => {
      if(!el) return;
      el.style.borderColor = "var(--red)";
      el.focus();
      setTimeout(() => { el.style.borderColor = ""; }, 2600);
    };
    if(!name){ flag(nameEl); return Toast.show(I.t("toast.checkout.needName"),"err"); }
    if(!email){ flag(mailEl); return Toast.show(I.t("toast.checkout.needEmail"),"err"); }
    // Quick client-side email format check
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ flag(mailEl); return Toast.show(I.t("toast.checkout.badEmail"),"err"); }

    // --- Validation: terms consent -------------------------------------------
    const termsCb = document.getElementById("co-terms");
    if(!termsCb || !termsCb.checked){
      const box = document.getElementById("co-terms-block");
      if(box){
        box.classList.remove("warn");
        void box.offsetWidth;          // restart the shake animation
        box.classList.add("warn");
        box.scrollIntoView({ behavior:"smooth", block:"center" });
      }
      return Toast.show(I.t("toast.checkout.needTerms"),"err");
    }

    const vat = +(p.price * 0.07).toFixed(2);
    const total = +(p.price + vat).toFixed(2);

    // UI: disable button + show "Redirecting to ChillPay…"
    const btn = document.getElementById("co-submit-btn");
    const lbl = document.getElementById("co-submit-label");
    if(btn) btn.disabled = true;
    if(lbl) lbl.textContent = I.t("checkout.summary.redirecting");
    Toast.show(I.t("toast.chillpay.redirecting"),"ok");

    // Build payload for the backend create-payment function. That function is
    // gateway-agnostic — it resolves whichever payment gateway is currently
    // active (config/payment.activeGateway) and returns a paymentUrl, so the
    // frontend never needs to know which provider is in use.
    const payload = {
      customer: { name, email, country, company, taxId, phone: "" },
      termsAcceptedAt: new Date().toISOString(),
      items: [ { id:p.id, bucket:p.bucket, title:p.title, price:p.price, manual:!!p.manual } ],
      subtotalUsd: p.price,
      vatUsd: vat,
      totalUsd: total,
      receiptLang: recvLang,
      channel: State.selectedChannel || ""
    };

    try{
      // Call the function directly: the /api/* alias is unreliable on
      // production (falls through to the SPA catch-all), same workaround used
      // by delete-customer and convert-currency.
      const res = await fetch("/.netlify/functions/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if(!res.ok || !data.ok || !data.paymentUrl){
        const errMsg = data.error || data.chillpayMessage || `HTTP ${res.status}`;
        console.error("create-payment failed:", data);
        Toast.show(I.t("toast.chillpay.failed", { error: errMsg }), "err");
        if(btn) btn.disabled = false;
        if(lbl) lbl.textContent = I.t("checkout.summary.cta");
        return;
      }

      // Remember orderRef so the result page can look it up after return from ChillPay
      try{ sessionStorage.setItem("dealpro_last_chillpay_ref", data.orderRef || ""); }catch{}

      // Redirect to ChillPay's hosted payment page
      window.location.assign(data.paymentUrl);
    }catch(e){
      console.error(e);
      Toast.show(I.t("toast.chillpay.failed", { error: e.message || "network error" }),"err");
      if(btn) btn.disabled = false;
      if(lbl) lbl.textContent = I.t("checkout.summary.cta");
    }
  },

  async queueEmail(to, kind, order, lang){
    // Language: explicit param > order.receiptLang > customer country mapping > en
    const countryToLang = { TH:"th", KR:"ko", JP:"ja" };
    const emailLang = lang
                   || order.receiptLang
                   || countryToLang[(order.customer?.country || "").toUpperCase()]
                   || "en";
    // Carry the order's source onto the queue doc. The email sender uses
    // source === 'ontheline' to decide delivery routing (ontheline mail is
    // sent to the support inbox only, never to the customer).
    const doc = {
      to,
      kind,
      orderRef: order.ref,
      lang: emailLang,
      status:"pending",
      payload: order,
      createdAt: serverTimestamp()
    };
    if(order.source) doc.source = order.source;
    await addDoc(collection(db,"email_queue"), doc);
  },

  renderConfirm(){
    const o = State.lastOrder;
    if(!o) return;
    const firstName = o.customer.name.split(" ")[0];
    const itemSummary = o.items.map(i => `${i.title}${i.manual?` $${i.price}`:""}`).join(" + ");
    document.getElementById("confirm-body").innerHTML = `
      <div class="seal"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <h1>${I.t("confirm.title-html",{name:firstName})}</h1>
      <p class="sub">${I.t("confirm.sub",{email:`<b>${o.customer.email}</b>`})}</p>
      <div class="confirm-grid">
        <div class="confirm-cell"><div class="lab">${I.t("confirm.ref")}</div><div class="val">${o.ref}</div></div>
        <div class="confirm-cell"><div class="lab">${I.t("confirm.package")}</div><div class="val">${itemSummary}</div></div>
        <div class="confirm-cell"><div class="lab">${I.t("confirm.amount")}</div><div class="val teal">$${o.total.toFixed(2)}</div></div>
        <div class="confirm-cell"><div class="lab">${I.t("confirm.portal")}</div><div class="val" style="font-size:14px;color:var(--teal-deep)">app.dealpro.io/s/${o.ref.toLowerCase()}</div></div>
        <div class="confirm-cell"><div class="lab">${I.t("confirm.invoice")}</div><div class="val" style="font-size:14px">${I.t("confirm.invoice-val")}</div></div>
        <div class="confirm-cell"><div class="lab">Status</div><div class="val teal">Paid · Active</div></div>
      </div>
      <div class="confirm-actions">
        <button class="btn-primary"><span>${I.t("confirm.cta-portal")}</span><span class="arr">→</span></button>
        <button class="btn-ghost" onclick="App.go('packages')">${I.t("confirm.cta-back")}</button>
      </div>
    `;
  },

  // ===================================================================
  // PAYMENT RESULT (return from ChillPay)
  // ===================================================================
  // ChillPay calls URL Result (configured in their dashboard) when the customer
  // is redirected back to our site after paying. We parse query params and look
  // up the order by ref. Important: ChillPay's callback (URL Background, server-
  // to-server) is the source of truth for "paid" status. URL Result is just for
  // showing the customer their result, so if the callback hasn't landed yet the
  // order will still be "pending" — we show a friendly pending page and poll.
  async renderPaymentResult(){
    const body = document.getElementById("payment-result-body");
    if(!body) return;

    // Try to read the order ref from URL ?ref=... OR sessionStorage (set in submitCheckout)
    const url = new URL(window.location.href);
    let ref = url.searchParams.get("ref") || url.searchParams.get("orderRef") || "";
    if(!ref){
      try{ ref = sessionStorage.getItem("dealpro_last_chillpay_ref") || ""; }catch{}
    }
    // ChillPay may also send these on the URL Result query string:
    const cpStatus = url.searchParams.get("status") || url.searchParams.get("PaymentStatus") || "";

    // No ref at all → "not found" state with helpful CTAs
    if(!ref){
      body.parentElement.classList.remove("pending","failed");
      body.innerHTML = `
        <div class="seal"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
        <h1>${I.t("result.notfound.title-html")}</h1>
        <p class="sub">${I.t("result.notfound.sub")}</p>
        <div class="confirm-actions">
          <button class="btn-primary" onclick="App.go('packages')"><span>${I.t("result.cta-back")}</span><span class="arr">→</span></button>
          <button class="btn-ghost" onclick="App.go('home')">${I.t("result.cta-home")}</button>
        </div>
      `;
      return;
    }

    // Render a quick loading state, then look up the order
    body.parentElement.classList.add("pending");
    body.innerHTML = `
      <div class="seal"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg></div>
      <h1>${I.t("result.pending.title-html")}</h1>
      <p class="sub" style="font-style:italic">Looking up order ${escapeHtml(ref)}…</p>
    `;

    // Look up the order by ref. The order doc was created by create-payment
    // before redirecting, so it should exist (subject to Firestore propagation delay).
    // Firestore rules allow read on /orders only to admin — but Realtime + the customer
    // doesn't have an account here. We use the public REST-like read via a Cloud Function?
    // For now: we use Firestore client SDK, which works because orders allow `create` by
    // anyone but `read` only by admin. To support the customer seeing their own result,
    // we'd need a public endpoint. Workaround: render based on URL params alone if read
    // fails, and poll silently for status changes.
    let order = null;
    try{
      const q = query(collection(db,"orders"), where("ref","==",ref), limit(1));
      const snap = await getDocs(q);
      if(!snap.empty) order = { id: snap.docs[0].id, ...snap.docs[0].data() };
    }catch(e){
      // Permission denied is expected for non-admin viewers. Fall through to URL-only render.
      console.warn("[result] order lookup denied or failed:", e.code || e.message);
    }

    // Decide which variant to show
    let variant; // "success" | "pending" | "failed"
    if(order){
      variant = order.status === "paid"     ? "success"
              : order.status === "failed"   ? "failed"
              : order.status === "cancelled" ? "failed"
              : "pending";
    }else if(/^paid$/i.test(cpStatus)){
      variant = "success";
    }else if(/^(fail|failed|cancel|cancelled|expired)$/i.test(cpStatus)){
      variant = "failed";
    }else{
      variant = "pending";
    }

    this._renderResultVariant(body, variant, ref, order);

    // If pending AND we managed to read the order, poll every 3s for up to 60s
    // for the callback to update status. We rely on the subscription via onSnapshot
    // would be cleaner, but the customer isn't authenticated as admin, so we use
    // polling getDoc instead. Bail out if user navigates away.
    if(variant === "pending" && order){
      this._pollPaymentResult(order.id, ref, 0);
    }
  },

  // Internal: render one of the three result variants into the body element
  _renderResultVariant(body, variant, ref, order){
    const page = body.parentElement;
    page.classList.remove("pending","failed");
    if(variant === "pending") page.classList.add("pending");
    if(variant === "failed")  page.classList.add("failed");

    const customerEmail = order?.customer?.email || "";
    const amount = order ? `$${Number(order.total || 0).toFixed(2)}` : "—";
    const method = order?.paymentChannel
      ? (order.paymentChannel === "select-on-page" ? "Payment Gateway" : `Payment Gateway · ${order.paymentChannel}`)
      : "Payment Gateway";

    const icon = {
      success: `<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12l5 5L20 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      pending: `<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>`,
      failed:  `<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`
    }[variant];

    const titleKey = `result.${variant}.title-html`;
    const subKey   = `result.${variant}.sub`;
    const subHtml  = I.t(subKey, { email: `<b>${escapeHtml(customerEmail || "your email")}</b>` });

    // Status label for the grid (translated paid/pending/failed)
    const statusLabel = order?.status || (variant === "success" ? "paid" : variant === "failed" ? "failed" : "pending");
    const statusClass = statusLabel === "paid" ? "paid" : (statusLabel === "failed" || statusLabel === "cancelled" ? "failed" : "pending");

    // Build action buttons — vary by variant
    const actions = variant === "success" ? `
      <button class="btn-primary" onclick="App.go('packages')"><span>${I.t("confirm.cta-portal")}</span><span class="arr">→</span></button>
      <button class="btn-ghost" onclick="App.go('home')">${I.t("result.cta-home")}</button>
    ` : variant === "failed" ? `
      <button class="btn-primary" onclick="App.goRetryCheckout()"><span>${I.t("result.cta-retry")}</span><span class="arr">→</span></button>
      <button class="btn-ghost" onclick="App.go('packages')">${I.t("result.cta-back")}</button>
    ` : `
      <button class="btn-ghost" onclick="App.go('packages')">${I.t("result.cta-back")}</button>
    `;

    body.innerHTML = `
      <div class="seal">${icon}</div>
      <h1>${I.t(titleKey)}</h1>
      <p class="sub">${subHtml}</p>
      <div class="confirm-grid">
        <div class="confirm-cell"><div class="lab">${I.t("result.ref")}</div><div class="val">${escapeHtml(ref)}</div></div>
        <div class="confirm-cell"><div class="lab">${I.t("result.amount")}</div><div class="val teal">${amount}</div></div>
        <div class="confirm-cell"><div class="lab">${I.t("result.method")}</div><div class="val" style="font-size:14px">${escapeHtml(method)}</div></div>
        <div class="confirm-cell" style="grid-column:1/-1"><div class="lab">${I.t("result.status")}</div><div class="val"><span class="status-tag ${statusClass}"><span class="d"></span>${escapeHtml(statusLabel)}</span></div></div>
      </div>
      <div class="confirm-actions">${actions}</div>
    `;
  },

  // Internal: poll the order doc every 3 seconds for up to 60s (20 attempts)
  // to detect callback-driven status changes while the customer is on the page.
  _pollPaymentResult(orderId, ref, attempt){
    // Stop if user navigated away from the result page
    if(!document.getElementById("page-payment-result").classList.contains("show")) return;
    if(attempt >= 20) return; // ~60s total

    setTimeout(async () => {
      // Re-check we're still on the page (defensive)
      if(!document.getElementById("page-payment-result").classList.contains("show")) return;
      try{
        const snap = await getDoc(doc(db, "orders", orderId));
        if(snap.exists()){
          const o = { id: snap.id, ...snap.data() };
          if(o.status !== "pending"){
            const variant = o.status === "paid" ? "success" : "failed";
            this._renderResultVariant(document.getElementById("payment-result-body"), variant, ref, o);
            return; // stop polling
          }
        }
      }catch(e){
        // Likely permission denied for non-admin — silently continue
      }
      this._pollPaymentResult(orderId, ref, attempt + 1);
    }, 3000);
  },

  // Retry checkout from the failure page — go back to checkout with the same selected package
  goRetryCheckout(){
    if(State.selectedPackage) this.go("checkout");
    else this.go("packages");
  },

  // ============= CUSTOMER PORTAL ACTIONS =============
  // Resend an email for an order (invoice / credentials). For customers,
  // we queue a fresh email_queue document so the scheduled function picks
  // it up; no admin privileges required because Firestore Rules allow a
  // customer to create email_queue items targeted at their own email.
  async resendEmail(orderId, kind){
    if(!State.user || !State.user.email){ Toast.show("Sign in required","err"); return; }
    const order = (State.orders || []).find(o => o.id === orderId);
    if(!order){ Toast.show("Order not found","err"); return; }
    if(order.customer?.email !== State.user.email){ Toast.show("Not your order","err"); return; }
    try{
      const lang = order.receiptLang || State.currentLang || "en";
      await addDoc(collection(db,"email_queue"),{
        to: order.customer.email,
        kind,
        orderRef: order.ref,
        lang,
        status:"pending",
        payload: {
          ref: order.ref,
          customer: order.customer,
          items: order.items,
          subtotal: order.subtotal,
          vat: order.vat,
          total: order.total,
          currency: order.currency || "USD",
          createdAt: order.createdAt,
          receiptLang: lang
          // NB: we don't include initialPassword on customer-triggered resends
          // — credentials emails will show "(check the original onboarding email)"
        },
        createdBy: "customer",
        createdAt: serverTimestamp()
      });
      Toast.show(I.t("orders.toast.resent"),"ok");
    }catch(e){
      console.error("resendEmail failed:", e);
      Toast.show(I.t("orders.toast.resendFailed",{error: e.code || e.message}),"err");
    }
  },

  // ============= CUSTOMER PORTAL ACTIONS =============
  // Open the order detail modal for a customer-owned order
  openCustomerOrderModal(orderId){
    const order = (State.orders || []).find(o => o.id === orderId);
    if(!order){ Toast.show("Order not found","err"); return; }
    const modal = document.getElementById("generic-modal");
    const body  = document.getElementById("generic-modal-inner");
    if(!modal || !body) return;

    const itemsHtml = (order.items || []).map(i => `
      <tr>
        <td>${escapeHtml(i.title || i.id)}</td>
        <td style="text-align:right">${fmtMoney(i.price)}</td>
      </tr>
    `).join("");

    const paidAt = order.paidAt ? fmtDate(order.paidAt) : "—";
    const expiresAt = toExpiryDate(order.expiresAt);
    // Gateway-settled web sales are labelled generically; the specific
    // provider is shown in the admin order view, not to the customer.
    const method = (order.source === "chillpay" || order.gateway) ? "Payment Gateway"
      : order.source === "ontheline" ? "ontheline"
      : (order.source || "—");

    body.innerHTML = `
      <h2 style="margin:0 0 14px;font-size:24px;letter-spacing:-0.01em">${I.t("orders.modal.title")}</h2>
      <div class="confirm-grid" style="grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
        <div class="confirm-cell"><div class="lab">${I.t("confirm.ref")}</div><div class="val" style="font-size:14px"><span class="ref-tag">${escapeHtml(order.ref || order.id)}</span></div></div>
        <div class="confirm-cell"><div class="lab">${I.t("orders.modal.paymentMethod")}</div><div class="val" style="font-size:14px">${escapeHtml(method)}</div></div>
        <div class="confirm-cell"><div class="lab">${I.t("orders.modal.paidAt")}</div><div class="val" style="font-size:14px">${paidAt}</div></div>
        <div class="confirm-cell"><div class="lab">${I.t("orders.modal.expiresAt")}</div><div class="val" style="font-size:14px">${expiresAt ? fmtDateOnly(expiresAt) : "—"}</div></div>
      </div>

      <div style="margin:18px 0 12px;font-family:var(--mono);font-size:11px;letter-spacing:.08em;color:var(--muted);text-transform:uppercase">${I.t("orders.modal.items")}</div>
      <table class="data-table" style="margin-bottom:18px">
        <tbody>${itemsHtml}</tbody>
      </table>

      <div style="border-top:1px solid var(--line);padding-top:14px;margin-bottom:22px">
        <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--muted);margin-bottom:6px"><span>${I.t("orders.modal.subtotal")}</span><span>${fmtMoney(order.subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--muted);margin-bottom:6px"><span>${I.t("orders.modal.vat")}</span><span>${fmtMoney(order.vat)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:600;color:var(--text);margin-top:8px"><span>${I.t("orders.modal.total")}</span><span class="teal">${fmtMoney(order.total)}</span></div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn-ghost" onclick="App.resendEmail('${escapeHtml(order.id)}','invoice')">${I.t("orders.modal.resendInvoice")}</button>
        <button class="btn-ghost" onclick="App.resendEmail('${escapeHtml(order.id)}','credentials')">${I.t("orders.modal.resendCredentials")}</button>
        <button class="btn-primary" onclick="App.closeGenericModal()"><span>${I.t("orders.modal.close")}</span></button>
      </div>
    `;
    modal.classList.add("show");
  },

  // Opens the change-password modal. Two entry points:
  //   - mustChangePassword nudge after first login (forced=true) → security wording
  //   - the "Change Password" button on the account page (forced=false) → neutral wording
  openCustomerPasswordModal(forced){
    const modal = document.getElementById("generic-modal");
    const body  = document.getElementById("generic-modal-inner");
    if(!modal || !body) return;
    const titleKey = forced ? "account.passwordPrompt.title" : "account.changePw.title";
    const subKey   = forced ? "account.passwordPrompt.sub"   : "account.changePw.sub";
    const ctaKey   = forced ? "account.passwordPrompt.cta"   : "account.changePw.cta";
    body.innerHTML = `
      <h2 style="margin:0 0 14px;font-size:24px;letter-spacing:-0.01em">${I.t(titleKey)}</h2>
      <p style="color:var(--muted);font-size:14px;margin:0 0 18px">${I.t(subKey)}</p>
      <div class="field"><label>${I.t("admin.password.current")}</label><input type="password" id="cpw-current" autocomplete="current-password"></div>
      <div class="field"><label>${I.t("admin.password.new")}</label><input type="password" id="cpw-new" autocomplete="new-password"></div>
      <div class="field"><label>${I.t("admin.password.confirm")}</label><input type="password" id="cpw-confirm" autocomplete="new-password"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px">
        <button class="btn-ghost" onclick="App.closeGenericModal()">${I.t("orders.modal.close")}</button>
        <button class="btn-primary" onclick="App.doCustomerPasswordChange()"><span>${I.t(ctaKey)}</span><span class="arrow">→</span></button>
      </div>
    `;
    modal.classList.add("show");
  },

  async doCustomerPasswordChange(){
    const cur = document.getElementById("cpw-current")?.value || "";
    const nw  = document.getElementById("cpw-new")?.value || "";
    const cn  = document.getElementById("cpw-confirm")?.value || "";
    if(!cur || !nw || !cn){ Toast.show(I.t("toast.password.wrong"),"err"); return; }
    if(nw !== cn){ Toast.show(I.t("toast.password.mismatch"),"err"); return; }
    if(nw.length < 6){ Toast.show("Password too short — at least 6 characters","err"); return; }
    try{
      const u = auth.currentUser;
      const cred = EmailAuthProvider.credential(u.email, cur);
      await reauthenticateWithCredential(u, cred);
      await updatePassword(u, nw);
      // Clear the mustChangePassword flag
      await updateDoc(doc(db,"users",u.uid),{ mustChangePassword:false });
      if(State.user) State.user.mustChangePassword = false;
      Toast.show(I.t("toast.password.updated"),"ok");
      this.closeGenericModal();
      renderCustomerAccount();
    }catch(e){
      console.error("customer password change failed:", e);
      if(e.code === "auth/invalid-credential" || e.code === "auth/wrong-password"){
        Toast.show(I.t("toast.password.wrong"),"err");
      }else{
        Toast.show("Password change failed: " + (e.code || e.message), "err");
      }
    }
  },

  closeGenericModal(){
    document.getElementById("generic-modal")?.classList.remove("show");
  },

  // ============= ADMIN =============
  setAdmin(name, ev, opts){
    const fromPopstate = !!(opts && opts.fromPopstate);
    if(!State.user){ this.openLogin(); return; }
    document.querySelectorAll(".side-item").forEach(s => s.classList.toggle("active", s.dataset.admin === name));
    document.querySelectorAll(".admin-view").forEach(v => v.style.display = "none");
    document.getElementById("adm-"+name).style.display = "block";
    if(name === "orders") renderAdminOrders();
    if(name === "users") renderAdminUsers();
    if(name === "packages") renderAdminPackages();
    if(name === "webhook") renderAdminWebhook();
    if(name === "partners") renderAdminPartners();
    if(name === "paygw") renderAdminPaygw();
    if(name === "currencies") renderAdminCurrencies();
    if(name === "chillpay") renderAdminChillPay();
    if(name === "emails") renderAdminEmails();
    if(name === "languages") renderAdminLanguages();
    if(name === "branding") renderAdminBranding();
    if(name === "dmchamp") renderAdminDmChamp();
    if(name === "paymentgw") renderAdminPaymentGw();
    if(name === "password") renderAdminPassword();
    this.renderAdminMobileTabs(name);

    // Push a sub-page history entry so back navigates between admin tabs.
    if(!fromPopstate){
      try{
        const state = { page: "admin", adminTab: name };
        const cur = history.state;
        if(!(cur && cur.page === "admin" && cur.adminTab === name)){
          history.pushState(state, "", "/admin/" + name);
        }
      }catch(e){ /* ignore */ }
    }
  },

  renderAdminMobileTabs(active){
    const wrap = document.getElementById("admin-mobile-tabs");
    if(!wrap) return;
    const tabs = [
      ["orders","admin.side.orders"],["users","admin.side.users"],["packages","admin.side.packages"],
      ["webhook","admin.side.webhook"],["partners","admin.side.partners"],["paygw","admin.side.paygw"],["currencies","admin.side.currencies"],["paymentgw","admin.side.paymentgw"],["chillpay","admin.side.chillpay"],["emails","admin.side.emails"],
      ["languages","admin.side.languages"],["branding","admin.side.branding"],
      ["dmchamp","admin.side.dmchamp"],["password","admin.side.password"]
    ];
    wrap.innerHTML = tabs.map(([k,i]) => `
      <button onclick="App.setAdmin('${k}')" class="filter-pill ${k===active?"on":""}" style="white-space:nowrap;flex:none">${I.t(i)}</button>
    `).join("");
  }
};

// ===========================================================
// ADMIN VIEWS
// ===========================================================
function fmtMoney(n){ return "$"+(Number(n||0)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDate(ts){
  if(!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
}
function escapeHtml(s){ return String(s??"").replace(/[<>&"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c])); }

// Resolve a package's display title/description.
// New admin-created packages have direct `title`/`desc` fields.
// Legacy seeded packages have `titleKey`/`descKey` for i18n lookup.
// Prefer direct fields when present.
function pkgTitle(p){
  if(p.title && String(p.title).trim() !== "") return p.title;
  if(p.titleKey) return I.t(p.titleKey);
  return p.id || "(untitled)";
}
function pkgDesc(p){
  if(p.desc && String(p.desc).trim() !== "") return p.desc;
  if(p.descKey) return I.t(p.descKey);
  return "";
}

// ===========================================================
// CUSTOMER PORTAL VIEWS
// ===========================================================
// Helpers for working with order expiry timestamps. expiresAt may be a
// Firestore Timestamp (from a live subscription), a Date, or null.
function toExpiryDate(expiresAt){
  if(!expiresAt) return null;
  const d = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
  return isNaN(d.getTime()) ? null : d;
}
function daysUntil(date){
  if(!date) return null;
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / (24*60*60*1000));
}
function fmtDateOnly(ts){
  if(!ts) return "—";
  const d = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  if(isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
}

// Map a bucket id to a human label
function bucketLabel(bucket){
  return I.t("admin.packages.bucket." + (bucket||"")) || "";
}

// Find the customer's currently-active package (i.e. the order with the
// furthest-future expiry that is still in the future). Returns the order
// object plus a `daysLeft` field, or null if no active subscription exists.
function findActiveOrder(orders){
  const now = Date.now();
  let best = null;
  let bestMs = -Infinity;
  for(const o of (orders || [])){
    if(o.status !== "paid") continue;
    const exp = toExpiryDate(o.expiresAt);
    if(!exp) continue;
    if(exp.getTime() <= now) continue;
    if(exp.getTime() > bestMs){
      best = o;
      bestMs = exp.getTime();
    }
  }
  if(!best) return null;
  const expDate = toExpiryDate(best.expiresAt);
  return { order: best, expDate, daysLeft: daysUntil(expDate) };
}

// Total credit-only purchases (no expiry) sum — used as the "credit balance"
// surfaced in My Account when the customer's bought credit packages.
function calculateCreditTotal(orders){
  let total = 0;
  for(const o of (orders || [])){
    // ontheline reversals reduce the credit balance by the refunded USD amount,
    // mirroring how Total Spent and Credits Earned already net out refunds.
    if(o.source === "ontheline" && ["Unpaid","Refund","Partial Refund"].includes(o.event)){
      total -= Number(o.refundAmountUsd) || 0;
      continue;
    }
    if(o.status !== "paid" && o.event !== "Paid") continue;
    for(const it of (o.items || [])){
      const bucket = (it.bucket || "").toLowerCase();
      if(bucket === "credit"){
        total += Number(it.price) || 0;
      }
    }
  }
  return Math.max(0, total);
}

// Total DM Champ credits earned across all paid orders. Each order's
// contribution is:
//   subtotal (USD, BEFORE VAT) × creditsPerUsd (snapshot at provision time)
//
// We prefer the per-order snapshot from order.dmchampSubAccount.creditsPerUsd
// (which is what was actually used when granting credits, even if the admin
// has since changed the rate). We fall back to State.dmchamp.creditsPerUsd
// for orders where provisioning didn't happen or didn't record the rate
// (e.g. legacy orders, or DM Champ integration was disabled at the time).
// Final fallback: the hard-coded default of 100 credits/USD that mirrors
// the backend's DEFAULTS.creditsPerUsd.
//
// IMPORTANT: subtotal is the price BEFORE VAT — VAT is collected for the
// tax authority and isn't part of the AI service value. This must match
// the calculation in provision-dmchamp.js so the number the customer sees
// equals the credits actually granted.
// Credits attributable to a single PAID order.
//
// Order of preference:
//   1. what DM Champ actually granted   (dmchampSubAccount.creditsGranted)
//   2. what we intended to grant        (dmchampSubAccount.monthlyCredits)
//   3. recompute subtotal × the rate, but ONLY once the rate is known
//
// Returning null for "not known yet" matters: config/dmchamp is admin-only, so
// on a customer page the rate arrives asynchronously (or via the public mirror
// in config/branding). Substituting the 100 default while it loads produced
// credit figures 100× too large that silently corrected themselves a moment
// later — better to render a placeholder than a wrong number.
function creditsForOrder(o){
  const sub = o.dmchampSubAccount || null;
  const granted = Number(sub && sub.creditsGranted);
  if(Number.isFinite(granted) && granted > 0) return granted;
  const intended = Number(sub && sub.monthlyCredits);
  if(Number.isFinite(intended) && intended > 0) return intended;

  const subUsd = Number.isFinite(Number(o.amountUsd)) && Number(o.amountUsd) > 0
    ? Number(o.amountUsd)
    : (Number.isFinite(Number(o.subtotal)) && Number(o.subtotal) > 0 ? Number(o.subtotal) : Number(o.total) || 0);
  if(subUsd <= 0) return 0;

  // A rate stored on the order is authoritative and always usable.
  const orderRate = Number(sub && sub.creditsPerUsd);
  if(Number.isFinite(orderRate) && orderRate > 0) return Math.max(1, Math.round(subUsd * orderRate));

  // Otherwise we need the live config — signal "unknown" until it loads.
  if(!(State.dmchamp && State.dmchamp.loaded)) return null;
  const rate = Number(State.dmchamp.creditsPerUsd);
  if(!Number.isFinite(rate) || rate <= 0) return null;
  return Math.max(1, Math.round(subUsd * rate));
}

function calculateCreditsEarned(orders){
  let total = 0;
  for(const o of (orders || [])){
    // ontheline reversal events (Unpaid / Refund / Partial Refund) SUBTRACT
    // the credits removed (stored as creditsDeducted on the reversal order).
    if(o.source === "ontheline" && ["Unpaid","Refund","Partial Refund"].includes(o.event)){
      total -= Number(o.creditsDeducted) || 0;
      continue;
    }
    // Credit-earning orders: paid (direct/chillpay) or an ontheline Paid event.
    const isPaid = o.status === "paid" || o.event === "Paid";
    if(!isPaid) continue;
    // creditsForOrder() prefers what DM Champ actually granted and returns null
    // while the rate is still unknown — skip those rather than guessing, so the
    // tile never shows an inflated total that later corrects itself.
    const c = creditsForOrder(o);
    if(c !== null) total += c;
  }
  return Math.max(0, total);
}

function renderCustomerAccount(){
  const el = document.getElementById("page-account");
  if(!el || !State.user) return;

  // Lazy-load DM Champ config (creditsPerUsd) so the credits-earned tile
  // shows correct numbers. Fire-and-forget: first render uses whatever's
  // in State (default 100), and the load triggers a re-render with the
  // correct rate. Skipped if already loaded.
  if(!State.dmchamp.loaded){
    loadDmChampConfig().then(() => {
      // Only re-render if the user is still on the account page
      if(document.getElementById("page-account")?.classList.contains("show")){
        renderCustomerAccount();
      }
    });
  }

  const orders = State.orders || [];
  const paidOrders = orders.filter(o => o.status === "paid" || o.event === "Paid");
  const active = findActiveOrder(orders);
  const creditTotal = calculateCreditTotal(orders);
  // Net spent = paid totals minus any ontheline refunds (full or partial).
  // BOTH sides use o.total (VAT-inclusive) so the figure matches the amounts
  // shown in the customer's My Orders table. (Using the pre-VAT refundAmountUsd
  // here would under-subtract and overstate Total Spent.)
  const grossSpent = paidOrders.reduce((s,o) => s + (Number(o.total)||0), 0);
  const refundedTotal = orders.reduce((s,o) => {
    if(o.source === "ontheline" && ["Unpaid","Refund","Partial Refund"].includes(o.event)){
      return s + (Number(o.total) || 0);
    }
    return s;
  }, 0);
  const totalSpent = Math.max(0, grossSpent - refundedTotal);
  const creditsEarned = calculateCreditsEarned(orders);

  // Member-since: earliest paid order createdAt
  const memberSince = paidOrders.length
    ? paidOrders.reduce((earliest, o) => {
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        return (!earliest || d < earliest) ? d : earliest;
      }, null)
    : null;

  // Build the active-package card
  let activeCard;
  if(active){
    const pkgName = (active.order.items || []).map(i => i.title || i.id).join(" + ");
    const daysLeft = active.daysLeft ?? 0;
    const isExpiringSoon = daysLeft <= 7;
    const statusClass = isExpiringSoon ? "pending" : "paid";
    const statusKey   = isExpiringSoon ? "expiring" : "active";
    const pctUsed = (() => {
      // Approximate progress: assume the package's total span = order paidAt → expiresAt
      const paidAt = active.order.paidAt?.toDate ? active.order.paidAt.toDate() : (active.order.paidAt ? new Date(active.order.paidAt) : null);
      if(!paidAt || !active.expDate) return 0;
      const totalMs = active.expDate.getTime() - paidAt.getTime();
      const usedMs  = Date.now() - paidAt.getTime();
      if(totalMs <= 0) return 100;
      return Math.max(0, Math.min(100, Math.round((usedMs / totalMs) * 100)));
    })();
    activeCard = `
      <div class="acct-active">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;flex-wrap:wrap">
          <div>
            <div class="num" style="margin-bottom:8px">${escapeHtml((active.order.items?.[0]?.bucket || "").toUpperCase())} · ${escapeHtml(active.order.ref || "")}</div>
            <div style="font-size:26px;font-weight:600;line-height:1.2;letter-spacing:-0.01em">${escapeHtml(pkgName)}</div>
          </div>
          <span class="status-tag ${statusClass}"><span class="d"></span>${I.t("account.active.status."+statusKey)}</span>
        </div>
        <div style="background:rgba(11,182,196,0.08);border-radius:9px;height:8px;overflow:hidden;margin:18px 0 14px">
          <div style="background:linear-gradient(90deg,#075d63,#0bb6c4);height:100%;width:${pctUsed}%;transition:width .4s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted);font-family:var(--mono);letter-spacing:.04em">
          <span>${I.t("account.active.expires",{date: fmtDateOnly(active.expDate)})}</span>
          <span style="color:${isExpiringSoon?'var(--accent-magenta)':'var(--text)'}"><b>${I.t("account.active.daysLeft",{n:daysLeft})}</b></span>
        </div>
      </div>
    `;
  }else if(creditTotal > 0){
    activeCard = `
      <div class="acct-active">
        <div class="num" style="margin-bottom:10px">CREDIT</div>
        <div style="font-size:28px;font-weight:600;letter-spacing:-0.01em;color:var(--text);margin-bottom:6px">${fmtMoney(creditTotal)}</div>
        <div style="font-size:13px;color:var(--muted)">${I.t("account.active.noExpiry")}</div>
      </div>
    `;
  }else{
    activeCard = `
      <div class="acct-active empty">
        <div style="font-size:15px;color:var(--muted);margin-bottom:14px">${I.t("account.active.none")}</div>
        <button class="btn-primary" onclick="App.go('packages')"><span>${I.t("account.cta.browse")}</span><span class="arrow">→</span></button>
      </div>
    `;
  }

  // Build the stats row
  // Includes a new "Credits Earned" tile only when the customer has actually
  // earned credits (avoids confusing first-time visitors who haven't paid yet).
  // The accompanying note clarifies that this is total-ever-earned, not the
  // live remaining balance — for that we direct them to the DM Champ Portal.
  const showCreditsEarned = creditsEarned > 0;
  const creditsTile = showCreditsEarned ? `
      <div class="acct-stat">
        <div class="lab">${I.t("account.stats.credits")}</div>
        <div class="val teal">${creditsEarned.toLocaleString()}</div>
      </div>
  ` : "";
  const creditsNote = showCreditsEarned ? `
    <div style="font-size:12px;color:var(--muted);line-height:1.55;margin:-4px 0 22px;padding:10px 14px;background:rgba(11,182,196,0.05);border-left:2px solid rgba(11,182,196,0.35);border-radius:0 6px 6px 0">
      <span style="color:rgba(11,182,196,0.85);font-weight:600;letter-spacing:.02em">ⓘ</span>
      ${I.t("account.credits.note")}
    </div>
  ` : "";

  const statsHtml = `
    <div class="acct-stats">
      <div class="acct-stat">
        <div class="lab">${I.t("account.stats.orders")}</div>
        <div class="val">${paidOrders.length}</div>
      </div>
      <div class="acct-stat">
        <div class="lab">${I.t("account.stats.spent")}</div>
        <div class="val teal">${fmtMoney(totalSpent)}</div>
      </div>
      ${creditsTile}
      <div class="acct-stat">
        <div class="lab">${I.t("account.stats.member")}</div>
        <div class="val" style="font-size:16px">${memberSince ? fmtDateOnly(memberSince) : "—"}</div>
      </div>
    </div>
  `;

  // Must-change-password banner (one-time, shown until they change it).
  // Note: we don't gate access to the dashboard on this; we just nudge.
  const pwBanner = State.user.mustChangePassword
    ? `<div class="rules-banner" style="background:rgba(214,138,28,.08);border-color:rgba(214,138,28,.4);margin-bottom:24px">
         <div>
           <div style="font-weight:600;margin-bottom:6px">${I.t("account.passwordPrompt.title")}</div>
           <div style="font-size:13px;color:var(--muted)">${I.t("account.passwordPrompt.sub")}</div>
         </div>
         <button class="btn-primary" onclick="App.openCustomerPasswordModal(true)"><span>${I.t("account.passwordPrompt.cta")}</span><span class="arrow">→</span></button>
       </div>`
    : "";

  // Build the DM Champ workspace card from the customer's most recent
  // paid order that has DM Champ provisioning info. Three render states:
  //   - created: show login info (with optional temp password)
  //   - failed:  show contact-support message
  //   - pending: show "being prepared" message (paid but no record yet)
  //   - none:    don't show the card at all (no paid orders, or feature
  //              wasn't enabled when their orders were processed)
  let dmchampCard = "";
  {
    // Pick the most recent paid order with any dmchampSubAccount field,
    // or — if none have it — the most recent paid order at all (so we can
    // still show a "pending" state while the auto-provision runs).
    const paidWithDm = paidOrders
      .filter(o => o.dmchampSubAccount)
      .sort((a,b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dbb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dbb - da;
      });
    const latestPaid = paidOrders.length
      ? paidOrders.slice().sort((a,b) => {
          const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const dbb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return dbb - da;
        })[0]
      : null;

    const sub = paidWithDm[0]?.dmchampSubAccount || null;
    const subStatus = sub?.status || (latestPaid ? "pending" : null);

    if(subStatus === "created"){
      const credits = Number.isFinite(Number(sub.monthlyCredits)) ? Number(sub.monthlyCredits).toLocaleString() : "—";
      dmchampCard = `
        <div class="acct-active" style="margin-top:18px;border-left:3px solid var(--teal)">
          <div class="num" style="margin-bottom:10px">${I.t("account.dmchamp.title").toUpperCase()}</div>
          <div style="font-size:14px;color:var(--muted);margin-bottom:14px">${I.t("account.dmchamp.intro")}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:13px;margin-bottom:16px">
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">${I.t("account.dmchamp.email")}</div>
              <div style="font-family:var(--mono);font-weight:600">${escapeHtml(sub.email || State.user.email)}</div>
            </div>
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">${I.t("account.dmchamp.credits")}</div>
              <div style="font-family:var(--mono);font-weight:600;color:var(--teal-deep)">${credits}</div>
            </div>
            ${sub.tempPassword ? `
            <div style="grid-column:1 / -1">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">${I.t("account.dmchamp.tempPassword")}</div>
              <div style="font-family:var(--mono);font-weight:600;color:var(--magenta);background:rgba(214,41,155,.06);padding:8px 12px;border-radius:6px;display:inline-block;letter-spacing:.05em">${escapeHtml(sub.tempPassword)}</div>
              <div style="font-size:11.5px;color:var(--muted);margin-top:6px">⚠ ${I.t("account.dmchamp.tempPasswordHint")}</div>
            </div>
            ` : ""}
          </div>
          <a href="${State.dmchamp.portalUrl || 'https://app.dmchamp.com'}" target="_blank" rel="noopener" class="btn-primary" style="display:inline-flex;text-decoration:none">
            <span>${I.t("account.dmchamp.open")}</span><span class="arrow">→</span>
          </a>
        </div>
      `;
    } else if(subStatus === "linked"){
      // Linked: existing DM Champ account associated with purchase. Show
      // email + credits + the "use your existing password" note. No temp
      // password block (we don't have one).
      const credits = Number.isFinite(Number(sub.monthlyCredits)) ? Number(sub.monthlyCredits).toLocaleString() : "—";
      dmchampCard = `
        <div class="acct-active" style="margin-top:18px;border-left:3px solid var(--teal)">
          <div class="num" style="margin-bottom:10px">${I.t("account.dmchamp.title").toUpperCase()}</div>
          <div style="font-size:14px;color:var(--text);margin-bottom:14px">🔗 ${I.t("account.dmchamp.linked")}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:13px;margin-bottom:16px">
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">${I.t("account.dmchamp.email")}</div>
              <div style="font-family:var(--mono);font-weight:600">${escapeHtml(sub.email || State.user.email)}</div>
            </div>
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">${I.t("account.dmchamp.credits")}</div>
              <div style="font-family:var(--mono);font-weight:600;color:var(--teal-deep)">${credits}</div>
            </div>
          </div>
          <a href="${State.dmchamp.portalUrl || 'https://app.dmchamp.com'}" target="_blank" rel="noopener" class="btn-primary" style="display:inline-flex;text-decoration:none">
            <span>${I.t("account.dmchamp.open")}</span><span class="arrow">→</span>
          </a>
        </div>
      `;
    } else if(subStatus === "topped_up"){
      // Topped up: either a repeat purchase that added credits to an existing
      // DM Champ account, OR an ontheline order where credits are mirrored for
      // display. Show email + credits + the "use your existing password" note,
      // same as linked (no temp password to show).
      const credits = Number.isFinite(Number(sub.creditsGranted)) ? Number(sub.creditsGranted).toLocaleString()
                    : Number.isFinite(Number(sub.monthlyCredits)) ? Number(sub.monthlyCredits).toLocaleString() : "—";
      dmchampCard = `
        <div class="acct-active" style="margin-top:18px;border-left:3px solid var(--teal)">
          <div class="num" style="margin-bottom:10px">${I.t("account.dmchamp.title").toUpperCase()}</div>
          <div style="font-size:14px;color:var(--text);margin-bottom:14px">✓ ${I.t("account.dmchamp.toppedUp")}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:13px;margin-bottom:16px">
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">${I.t("account.dmchamp.email")}</div>
              <div style="font-family:var(--mono);font-weight:600">${escapeHtml(sub.email || State.user.email)}</div>
            </div>
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">${I.t("account.dmchamp.credits")}</div>
              <div style="font-family:var(--mono);font-weight:600;color:var(--teal-deep)">${credits}</div>
            </div>
          </div>
          <a href="${State.dmchamp.portalUrl || 'https://app.dmchamp.com'}" target="_blank" rel="noopener" class="btn-primary" style="display:inline-flex;text-decoration:none">
            <span>${I.t("account.dmchamp.open")}</span><span class="arrow">→</span>
          </a>
        </div>
      `;
    } else if(subStatus === "failed"){
      dmchampCard = `
        <div class="acct-active" style="margin-top:18px;border-left:3px solid var(--amber)">
          <div class="num" style="margin-bottom:10px">${I.t("account.dmchamp.title").toUpperCase()}</div>
          <div style="font-size:14px;color:var(--muted)">${I.t("account.dmchamp.pending")}</div>
        </div>
      `;
    }
  }

  el.innerHTML = `
    <div class="section" style="max-width:1100px">
      <div class="section-head">
        <div class="num">${I.t("account.crumbs")}</div>
        <h2>${I.t("account.welcome",{name: escapeHtml(State.user.name)})}</h2>
        <p class="lede">${I.t("account.sub")}</p>
      </div>
      ${pwBanner}
      <div class="section-head" style="margin-top:20px;margin-bottom:14px">
        <h3 style="font-size:20px;margin:0">${I.t("account.active.title-html")}</h3>
      </div>
      <div class="acct-layout">
        ${activeCard}
        ${statsHtml}
      </div>
      ${creditsNote}
      ${dmchampCard}
      <div style="display:flex;gap:12px;margin-top:28px;flex-wrap:wrap">
        <button class="btn-primary" onclick="App.go('orders')"><span>${I.t("account.cta.orders")}</span><span class="arrow">→</span></button>
        <button class="btn-ghost" onclick="App.go('packages')">${I.t("account.cta.browse")}</button>
        <button class="btn-ghost" onclick="App.openCustomerPasswordModal()">${I.t("account.cta.changePassword")}</button>
      </div>
    </div>
  `;
}

function renderCustomerOrders(){
  const el = document.getElementById("page-orders");
  if(!el || !State.user) return;

  // Lazy-load DM Champ config (creditsPerUsd) so the Credits column shows
  // the right number on first paint. Same pattern as the My Account page.
  if(!State.dmchamp.loaded){
    loadDmChampConfig().then(() => {
      if(document.getElementById("page-orders")?.classList.contains("show")){
        renderCustomerOrders();
      }
    });
  }

  const orders = State.orders || [];

  const now = Date.now();
  const statusOf = (o) => {
    // ontheline reversal/lifecycle events carry the event in o.event/o.status.
    if(o.source === "ontheline" && o.event){
      return o.event;   // Paid / Unpaid / Refund / Partial Refund / Fail
    }
    // Treat expired+paid as a separate display status (UI label only —
    // we don't mutate the order doc)
    if(o.status === "paid"){
      const exp = toExpiryDate(o.expiresAt);
      if(exp && exp.getTime() < now) return "expired";
    }
    return o.status || "pending";
  };
  // Colour + human label for a status. ontheline events map onto the same
  // palette as the admin Orders table; "Fail" reads as "Failed".
  const statusClass = (s) => {
    const map = { "Paid":"paid", "paid":"paid", "Partial Refund":"pending", "Refund":"failed", "Unpaid":"pending", "Fail":"failed", "pending":"pending", "cancelled":"failed", "expired":"failed" };
    return map[s] || (s === "pending" ? "pending" : "failed");
  };
  const statusLabel = (s) => {
    // ontheline event labels are shown verbatim (Fail → Failed); the legacy
    // lowercase statuses use the existing orders.status.* i18n strings.
    if(["Paid","Unpaid","Refund","Partial Refund","Fail"].includes(s)){
      return s === "Fail" ? "Failed" : s;
    }
    // If a status has no translation the raw key would leak into the table
    // (e.g. "ORDERS.STATUS.CANCELLED"), so fall back to the status itself,
    // capitalised. I.t() returns the key unchanged when it isn't found.
    const key = "orders.status." + s;
    const label = I.t(key);
    if(label && label !== key) return label;
    return String(s || "").replace(/^./, c => c.toUpperCase());
  };

  const rows = orders.map(o => {
    const s = statusOf(o);
    const exp = toExpiryDate(o.expiresAt);
    // Credits earned by this order: subtotal × per-order rate (or fallback).
    // Mirrors the calculation in Admin Orders + Customer Portal stats so
    // the customer sees the same numbers across every page.
    let creditsCell;
    if(o.source === "ontheline" && ["Unpaid","Refund","Partial Refund"].includes(o.event)){
      // Reversal order — show credits removed as a negative red figure.
      const deducted = Number(o.creditsDeducted) || 0;
      creditsCell = deducted > 0
        ? `<span style="font-family:var(--mono);font-size:12.5px;color:#c8463d;font-weight:600">−${deducted.toLocaleString()}</span>`
        : '<span style="color:var(--muted)">—</span>';
    } else if(o.status === "paid" || o.event === "Paid"){
      const credits = creditsForOrder(o);
      creditsCell = credits === null
        // Rate not known yet — show a placeholder rather than a guessed number.
        // loadDmChampConfig() re-renders this table once it resolves.
        ? '<span style="color:var(--muted-2)">·</span>'
        : (credits > 0
            ? `<span style="font-family:var(--mono);font-size:12.5px;color:var(--teal-deep);font-weight:600">${credits.toLocaleString()}</span>`
            : '<span style="color:var(--muted)">—</span>');
    } else {
      creditsCell = '<span style="color:var(--muted)">—</span>';
    }
    return `
      <tr>
        <td><span class="ref-tag">${escapeHtml(o.ref || o.id)}</span></td>
        <td>${fmtDate(o.createdAt)}</td>
        <td>${escapeHtml((o.items||[]).map(i => i.title || i.id).join(" + "))}</td>
        <td>${fmtMoney(o.total)}</td>
        <td>${creditsCell}</td>
        <td>${exp ? fmtDateOnly(exp) : "—"}</td>
        <td><span class="status-tag ${statusClass(s)}"><span class="d"></span>${escapeHtml(statusLabel(s))}</span></td>
        <td><button class="btn-ghost" onclick="App.openCustomerOrderModal('${escapeHtml(o.id)}')">${I.t("orders.action.view")}</button></td>
      </tr>
    `;
  }).join("");

  el.innerHTML = `
    <div class="section" style="max-width:1100px">
      <div class="section-head">
        <div class="num">${I.t("orders.crumbs")}</div>
        <h2>${I.t("orders.title-html")}</h2>
        <p class="lede">${I.t("orders.sub")}</p>
      </div>
      ${orders.length === 0
        ? `<div class="acct-active empty"><div style="font-size:15px;color:var(--muted);margin-bottom:14px">${I.t("orders.empty")}</div><button class="btn-primary" onclick="App.go('packages')"><span>${I.t("account.cta.browse")}</span><span class="arrow">→</span></button></div>`
        : `<div class="table-wrap">
             <table class="data-table">
               <thead>
                 <tr>
                   <th>${I.t("orders.col.ref")}</th>
                   <th>${I.t("orders.col.date")}</th>
                   <th>${I.t("orders.col.package")}</th>
                   <th>${I.t("orders.col.amount")}</th>
                   <th>${I.t("orders.col.credits")}</th>
                   <th>${I.t("orders.col.expires")}</th>
                   <th>${I.t("orders.col.status")}</th>
                   <th>${I.t("orders.col.actions")}</th>
                 </tr>
               </thead>
               <tbody>${rows}</tbody>
             </table>
           </div>`
      }
    </div>
  `;
}

function renderAdminOrders(){
  const el = document.getElementById("adm-orders");
  const allOrders = State.orders;

  // Lazy-load DM Champ config (creditsPerUsd) — same pattern as the
  // Customer Portal. The Credits column in the orders table and the
  // Credits Earned section in the detail modal both use this rate.
  if(!State.dmchamp.loaded){
    loadDmChampConfig().then(() => {
      if(document.getElementById("adm-orders")?.classList.contains("show")){
        renderAdminOrders();
      }
    });
  }

  // --- Date filter: build the active date range ---
  const now = new Date();
  let rangeStart, rangeEnd, rangeLabel;

  if(State.orderDateFilter === "today"){
    rangeStart = new Date(now); rangeStart.setHours(0,0,0,0);
    rangeEnd   = new Date(now); rangeEnd.setHours(23,59,59,999);
    rangeLabel = I.t("admin.orders.date.today");
  }else if(State.orderDateFilter === "yesterday"){
    rangeStart = new Date(now); rangeStart.setDate(rangeStart.getDate()-1); rangeStart.setHours(0,0,0,0);
    rangeEnd   = new Date(now); rangeEnd.setDate(rangeEnd.getDate()-1); rangeEnd.setHours(23,59,59,999);
    rangeLabel = I.t("admin.orders.date.yesterday");
  }else if(State.orderDateFilter === "month"){
    rangeStart = new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0);
    rangeEnd   = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999);
    rangeLabel = I.t("admin.orders.date.month");
  }else if(State.orderDateFilter === "lastMonth"){
    rangeStart = new Date(now.getFullYear(), now.getMonth()-1, 1, 0,0,0,0);
    rangeEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59,999);
    rangeLabel = I.t("admin.orders.date.lastMonth");
  }else{
    // period — use State.orderPeriodStart/End (if not set, fall back to today)
    rangeStart = State.orderPeriodStart || new Date(new Date().setHours(0,0,0,0));
    rangeEnd   = State.orderPeriodEnd   || new Date(new Date().setHours(23,59,59,999));
    rangeLabel = I.t("admin.orders.date.period");
  }

  const dateInRange = (o) => {
    const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
    if(!d || isNaN(d.getTime())) return false;
    return d >= rangeStart && d <= rangeEnd;
  };

  // Apply date + source filters
  // Note: chillpay orders are treated as "direct" for filtering/display purposes
  // (they're functionally the same — both are direct purchases on our website,
  // just with different payment processors). The underlying o.source value is
  // kept as "chillpay" so payment-specific code (diagnostics, status checks)
  // still works.
  const dateFiltered = allOrders.filter(dateInRange);
  // (Row filtering now happens entirely in getFilteredOrders below — we keep
  // dateFiltered only for the stat counts, which intentionally reflect the
  // whole date range regardless of the source/partner/paygw/currency filters.)

  // The actual row list comes from getFilteredOrders() so it applies ALL
  // filters (date, source, email, partner, paygw, currency). Every transaction
  // row is shown (full event history per transaction_id) — the table, CSV
  // export, and dropdown filters all read this same list.
  const list = getFilteredOrders();

  // Stats — based on the date-filtered set (NOT the source-filtered one, so all source counts make sense)
  // "Direct" count includes both legacy direct orders and ChillPay orders.
  const onlineCount = dateFiltered.filter(o => o.source === "ontheline").length;
  const directCount = dateFiltered.filter(o => o.source === "direct" || o.source === "chillpay").length;
  // Revenue = the literal sum of every transaction that occurred within the
  // selected date range (date-of-event). Each row counts on the day it
  // happened:
  //   Paid                                 → + o.total (money in)
  //   Refund / Partial Refund / Unpaid     → − refunded amount (money out / reversed)
  //   Fail / failed / cancelled            → not counted
  // This is a true day-by-day total, so if a Paid order from an earlier day is
  // refunded today, today's Revenue can legitimately go negative.
  const revenue = dateFiltered.reduce((s,o) => {
    if(o.source === "ontheline"){
      if(["Unpaid","Refund","Partial Refund"].includes(o.event)){
        // refundAmountUsd is the VAT-inclusive amount reversed on this day.
        return s - (Number(o.refundAmountUsd) || Number(o.total) || 0);
      }
      if(o.event === "Fail") return s;            // failed → no money
      if(o.event === "Paid") return s + (Number(o.total) || 0);
      return s;
    }
    // Non-ontheline (direct web sales): count paid only. Gateway-settled
    // orders start as 'pending' and must NOT count until the callback confirms
    // payment — detect them by the `gateway` field (or the legacy
    // source==='chillpay') rather than the source name alone.
    const isGatewayOrder = !!o.gateway || o.source === "chillpay";
    const isCounted = (o.status === "paid") || (!isGatewayOrder && o.status !== "failed" && o.status !== "cancelled");
    return s + (isCounted ? (o.total || 0) : 0);
  }, 0);

  const rows = list.map(o => {
    const itemSummary = (o.items||[]).map(i => `${i.title}${i.manual?` $${i.price}`:""}`).join(" + ");
    // For gateway-settled orders show "Check Status" always; plus "Mark Paid" /
    // "Cancel" for pending ones. Matches on the `gateway` field so it keeps
    // working for every provider (and legacy source==='chillpay' orders).
    const isChillPay = !!o.gateway || o.source === "chillpay";
    const isPending = o.status === "pending";
    let extraAction = "";
    if(isChillPay){
      extraAction = `<button onclick="AdminActions.checkChillPayStatus('${o.id}')" title="${escapeHtml(I.t("admin.chillpay.checkstatus"))}">${escapeHtml(I.t("admin.chillpay.checkstatus"))}</button>`;
      if(isPending){
        extraAction += `
          <button onclick="AdminActions.markOrderPaid('${o.id}')" style="color:var(--lime);border-color:rgba(127,169,42,.3)" title="Mark order as paid (manual reconciliation)">Mark Paid</button>
          <button onclick="AdminActions.cancelOrder('${o.id}')" class="danger" title="Cancel this pending order">Cancel</button>`;
      }
    }
    // Credits earned by THIS order: subtotal (ex-VAT) × per-order snapshot rate.
    // Empty/zero for non-paid orders so the column stays uncluttered.
    let creditsCell;
    if(o.source === "ontheline" && ["Unpaid","Refund","Partial Refund"].includes(o.event)){
      // Reversal order — show the credits removed as a negative red figure.
      const deducted = Number(o.creditsDeducted) || 0;
      creditsCell = deducted > 0
        ? `<span style="font-family:var(--mono);font-size:12px;color:#c8463d;font-weight:600">−${deducted.toLocaleString()}</span>`
        : '<span style="color:var(--muted)">—</span>';
    } else if(o.status === "paid" || o.event === "Paid"){
      const credits = creditsForOrder(o);
      creditsCell = credits === null
        ? '<span style="color:var(--muted-2)">·</span>'      // rate not loaded yet
        : (credits > 0
            ? `<span style="font-family:var(--mono);font-size:12px;color:var(--teal-deep);font-weight:600">${credits.toLocaleString()}</span>`
            : '<span style="color:var(--muted)">—</span>');
    } else {
      creditsCell = '<span style="color:var(--muted)">—</span>';
    }
    return `
      <tr>
        <td style="font-family:var(--mono);font-size:12px">${escapeHtml(o.ref)}</td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--muted)">${o.transactionId || o.transaction_id ? escapeHtml(o.transactionId || o.transaction_id) : '<span style="color:var(--line-2)">—</span>'}</td>
        <td>${escapeHtml(o.customer?.name||"—")}</td>
        <td style="font-family:var(--mono);font-size:11.5px;color:var(--muted);word-break:break-all">${escapeHtml(o.customer?.email||"—")}</td>
        <td>${(() => {
          // Display label: legacy 'chillpay' orders collapse to 'direct' (they
          // are the same thing — a direct web sale). For direct sales we also
          // show WHICH gateway settled it, since that can now change over time.
          const displaySource = (o.source === "chillpay") ? "direct" : o.source;
          const gwId = o.gateway || (o.source === "chillpay" || o.chillpayOrderNo ? "chillpay" : null);
          const gwLine = (displaySource === "direct" && gwId)
            ? `<div style="font-family:var(--mono);font-size:9.5px;color:var(--muted-2);margin-top:3px;letter-spacing:.04em">${escapeHtml(gwId)}</div>`
            : "";
          return `<span class="src-tag ${displaySource}">${displaySource}</span>${gwLine}`;
        })()}</td>
        <td>${(() => {
          // Partner / PayGW — only meaningful for ontheline orders. We look up the
          // company name from the admin reference lists for a friendlier display,
          // falling back to the raw code. Non-ontheline orders show a dash.
          if(o.source !== "ontheline") return '<span style="color:var(--muted)">—</span>';
          const pName = (State.onthelinePartners || []).find(p => (p.code||"").toLowerCase() === (o.partner||"").toLowerCase());
          const gName = (State.onthelinePaygw || []).find(g => (g.code||"").toLowerCase() === (o.paygw||"").toLowerCase());
          const partnerTxt = o.partner ? `${escapeHtml(o.partner)}${pName ? ` · ${escapeHtml(pName.companyName)}` : ""}` : "—";
          const paygwTxt   = o.paygw   ? `${escapeHtml(o.paygw)}${gName ? ` · ${escapeHtml(gName.companyName)}` : ""}` : "—";
          return `<div style="font-family:var(--mono);font-size:10.5px;line-height:1.5">
            <div title="Partner"><span style="color:var(--muted)">P:</span> ${partnerTxt}</div>
            <div title="Payment Gateway"><span style="color:var(--muted)">G:</span> ${paygwTxt}</div>
          </div>`;
        })()}</td>
        <td>${escapeHtml(itemSummary)}</td>
        <td>${(() => {
          // ontheline orders show the original-currency amount with its symbol,
          // then the USD value in parentheses. We show the VAT-INCLUSIVE total
          // in USD so it matches the customer's My Orders amount (which also
          // shows o.total). (Credit math separately uses the pre-VAT amountUsd.)
          if(o.source === "ontheline" && o.currency && o.currency !== "USD"){
            const cur = (State.onthelineCurrencies || []).find(c => (c.code||"").toLowerCase() === (o.currency||"").toLowerCase());
            const sym = cur?.symbol || "";
            const orig = Number.isFinite(Number(o.amountOriginal)) ? Number(o.amountOriginal) : null;
            const usdTotal = Number.isFinite(Number(o.total)) ? Number(o.total)
                           : (Number.isFinite(Number(o.amountUsd)) ? Number(o.amountUsd) : Number(o.subtotal) || 0);
            const origTxt = orig !== null ? `${escapeHtml(sym)}${orig.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}` : "—";
            return `<div style="line-height:1.4"><div style="font-weight:600">${origTxt} <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">${escapeHtml(o.currency)}</span></div>
              <div style="font-size:11px;color:var(--muted)">(${fmtMoney(usdTotal)})</div></div>`;
          }
          return fmtMoney(o.total);
        })()}</td>
        <td>${creditsCell}</td>
        <td>${(() => {
          // ontheline orders show the latest event (Paid/Unpaid/Refund/Partial
          // Refund/Fail) as the status, colour-mapped. Others show o.status.
          // Note: ontheline "Fail" is shown as "Failed" so it reads identically
          // to a direct/chillpay order's "failed" status (same meaning + colour).
          if(o.source === "ontheline" && o.event){
            const map = { "Paid":"paid", "Partial Refund":"pending", "Refund":"failed", "Unpaid":"pending", "Fail":"failed" };
            const labelMap = { "Fail":"Failed" };
            const cls = map[o.event] || "pending";
            const label = labelMap[o.event] || o.event;
            return `<span class="status-tag ${cls}"><span class="d"></span>${escapeHtml(label)}</span>`;
          }
          return `<span class="status-tag ${o.status}"><span class="d"></span>${o.status}</span>`;
        })()}</td>
        <td>${fmtDate(o.createdAt)}</td>
        <td>${(() => {
          const exp = toExpiryDate(o.expiresAt);
          if(!exp) return '<span style="color:var(--muted)">—</span>';
          const daysLeft = Math.ceil((exp.getTime() - Date.now()) / (24*3600*1000));
          if(daysLeft < 0) return `<span style="color:var(--accent-magenta)" title="Expired">${fmtDateOnly(exp)}</span>`;
          if(daysLeft <= 7) return `<span style="color:var(--amber)" title="${daysLeft} days left">${fmtDateOnly(exp)}<br><small style="font-size:10.5px;color:var(--muted)">${daysLeft}d left</small></span>`;
          return `<span title="${daysLeft} days left">${fmtDateOnly(exp)}</span>`;
        })()}</td>
        <td>
          <div class="row-actions">
            <button onclick="AdminActions.viewOrder('${o.id}')">${I.t("admin.orders.action.view")}</button>
            <button onclick="AdminActions.resendOrderEmail('${o.id}')">${I.t("admin.orders.action.resend")}</button>
            ${extraAction}
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Period summary line (only shown when period mode is active)
  const fmtPeriodDate = (d) => d ? d.toISOString().slice(0,10) : "—";
  const periodSummary = State.orderDateFilter === "period"
    ? `<div style="font-size:12px;color:var(--muted);margin-top:8px;font-style:italic">${I.t("admin.orders.period.summary",{start: fmtPeriodDate(rangeStart), end: fmtPeriodDate(rangeEnd)})}</div>`
    : "";

  // Active class helper
  const dateBtnClass = (mode) => "filter-pill" + (State.orderDateFilter === mode ? " on" : "");
  const srcBtnClass  = (src)  => "filter-pill" + (State.orderSourceFilter === src ? " on" : "");

  // Stats labels — adapt to current date filter (uses i18n keys, editable from Firestore)
  const ordersStatLabel = State.orderDateFilter === "today"     ? I.t("admin.orders.stat.today")
                         : State.orderDateFilter === "yesterday" ? I.t("admin.orders.stat.yesterday")
                         : State.orderDateFilter === "month"     ? I.t("admin.orders.stat.month")
                         : State.orderDateFilter === "lastMonth"  ? I.t("admin.orders.stat.lastMonth")
                         : I.t("admin.orders.stat.period");
  const revenueStatLabel = State.orderDateFilter === "today"     ? I.t("admin.orders.stat.revenue")
                          : State.orderDateFilter === "yesterday" ? I.t("admin.orders.stat.revenue.yesterday")
                          : State.orderDateFilter === "month"     ? I.t("admin.orders.stat.revenue.month")
                          : State.orderDateFilter === "lastMonth"  ? I.t("admin.orders.stat.revenue.lastMonth")
                          : I.t("admin.orders.stat.revenue.period");

  el.innerHTML = `
    <div class="admin-head">
      <div>
        <div class="crumbs">Console / Orders · <span style="color:var(--teal-deep)">${escapeHtml(rangeLabel)}</span></div>
        <h1>${I.t("admin.orders.title-html")}</h1>
        ${periodSummary}
      </div>
      <button class="btn-primary" onclick="AdminActions.exportOrdersCSV()"><span>${I.t("admin.orders.export")}</span><span class="arr">→</span></button>
    </div>
    <div class="stats">
      <div class="stat"><div class="lab">${escapeHtml(ordersStatLabel)}</div><div class="val">${dateFiltered.length}<span class="unit">${I.t("admin.orders.unit.orders")}</span></div></div>
      <div class="stat"><div class="lab">${I.t("admin.orders.stat.online")}</div><div class="val">${onlineCount}<span class="unit">${I.t("admin.orders.unit.orders")}</span></div></div>
      <div class="stat"><div class="lab">${I.t("admin.orders.stat.direct")}</div><div class="val">${directCount}<span class="unit">${I.t("admin.orders.unit.orders")}</span></div></div>
      <div class="stat accent"><div class="lab">${escapeHtml(revenueStatLabel)}</div><div class="val"><span class="cur">$</span>${revenue.toLocaleString()}</div></div>
    </div>

    <!-- Date range filter — primary toggle row -->
    <div class="filters" style="margin:0 0 14px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <span style="font-size:11px;color:var(--muted);font-family:var(--mono);letter-spacing:.08em;text-transform:uppercase;margin-right:6px">${I.t("admin.orders.date.label")}</span>
      <button class="${dateBtnClass('today')}" onclick="AdminActions.setOrderDateFilter('today')">${I.t("admin.orders.date.today")}</button>
      <button class="${dateBtnClass('yesterday')}" onclick="AdminActions.setOrderDateFilter('yesterday')">${I.t("admin.orders.date.yesterday")}</button>
      <button class="${dateBtnClass('month')}" onclick="AdminActions.setOrderDateFilter('month')">${I.t("admin.orders.date.month")}</button>
      <button class="${dateBtnClass('lastMonth')}" onclick="AdminActions.setOrderDateFilter('lastMonth')">${I.t("admin.orders.date.lastMonth")}</button>
      <button class="${dateBtnClass('period')}" onclick="AdminActions.openPeriodPicker()">${I.t("admin.orders.date.period")}${State.orderDateFilter === 'period' ? ` · ${fmtPeriodDate(rangeStart)} → ${fmtPeriodDate(rangeEnd)}` : ""}</button>
    </div>

    <div class="panel">
      <div class="panel-h">
        <h3>${I.t("admin.orders.h")}</h3>
        <div class="filters">
          <button class="${srcBtnClass('all')}" onclick="AdminActions.setOrderSourceFilter('all')">${I.t("admin.orders.filter.all")}</button>
          <button class="${srcBtnClass('ontheline')}" onclick="AdminActions.setOrderSourceFilter('ontheline')">${I.t("admin.orders.filter.online")}</button>
          <button class="${srcBtnClass('direct')}" onclick="AdminActions.setOrderSourceFilter('direct')">${I.t("admin.orders.filter.direct")}</button>
          <div class="orders-email-filter">
            <input
              type="text"
              id="orders-email-filter-input"
              value="${escapeHtml(State.orderEmailFilter || "")}"
              placeholder="${escapeHtml(I.t("admin.orders.filter.email.placeholder"))}"
              oninput="AdminActions.setOrderEmailFilter(this.value)"
              autocomplete="off"
              spellcheck="false"
            />
            ${State.orderEmailFilter ? `<button type="button" class="orders-email-clear" onclick="AdminActions.setOrderEmailFilter('')" title="${escapeHtml(I.t("admin.orders.filter.email.clear"))}">×</button>` : ""}
          </div>
          <select class="orders-dropdown-filter" onchange="AdminActions.setOrderPartnerFilter(this.value)" title="${escapeHtml(I.t("admin.orders.filter.partner.title"))}">
            <option value="">${I.t("admin.orders.filter.partner.all")}</option>
            ${(State.onthelinePartners||[]).slice().sort((a,b)=>(a.code||"").localeCompare(b.code||"")).map(p =>
              `<option value="${escapeHtml(p.code)}" ${State.orderPartnerFilter===p.code?"selected":""}>${escapeHtml(p.code)}${p.companyName?` · ${escapeHtml(p.companyName)}`:""}</option>`
            ).join("")}
          </select>
          <select class="orders-dropdown-filter" onchange="AdminActions.setOrderPaygwFilter(this.value)" title="${escapeHtml(I.t("admin.orders.filter.paygw.title"))}">
            <option value="">${I.t("admin.orders.filter.paygw.all")}</option>
            ${(State.onthelinePaygw||[]).slice().sort((a,b)=>(a.code||"").localeCompare(b.code||"")).map(g =>
              `<option value="${escapeHtml(g.code)}" ${State.orderPaygwFilter===g.code?"selected":""}>${escapeHtml(g.code)}${g.companyName?` · ${escapeHtml(g.companyName)}`:""}</option>`
            ).join("")}
          </select>
          <select class="orders-dropdown-filter" onchange="AdminActions.setOrderCurrencyFilter(this.value)" title="${escapeHtml(I.t("admin.orders.filter.currency.title"))}">
            <option value="">${I.t("admin.orders.filter.currency.all")}</option>
            ${(State.onthelineCurrencies||[]).slice().sort((a,b)=>(a.code||"").localeCompare(b.code||"")).map(c =>
              `<option value="${escapeHtml(c.code)}" ${State.orderCurrencyFilter===c.code?"selected":""}>${escapeHtml(c.code)}${c.symbol?` (${escapeHtml(c.symbol)})`:""}</option>`
            ).join("")}
          </select>
        </div>
      </div>
      <div class="table-wrap">
        ${list.length === 0 ? `<div class="empty-state"><div class="em">No orders in this view</div>Try a wider date range or different filters.</div>` :
        `<table id="orders-table">
          <thead><tr>
            <th>${I.t("admin.orders.col.ref")}</th>
            <th>${I.t("admin.orders.col.txId")}</th>
            <th>${I.t("admin.orders.col.customer")}</th>
            <th>${I.t("admin.orders.col.email")}</th>
            <th>${I.t("admin.orders.col.source")}</th>
            <th>${I.t("admin.orders.col.partnerGw")}</th>
            <th>${I.t("admin.orders.col.package")}</th>
            <th>${I.t("admin.orders.col.amount")}</th>
            <th>${I.t("admin.orders.col.credits")}</th>
            <th>${I.t("admin.orders.col.status")}</th>
            <th>${I.t("admin.orders.col.date")}</th>
            <th>${I.t("admin.orders.col.expires")}</th>
            <th>${I.t("admin.orders.col.actions")}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`}
      </div>
    </div>
  `;
}

// Compute the active [start,end] date range from State.orderDateFilter.
// Shared by renderAdminOrders (label/summary) and getFilteredOrders (filtering)
// so the five modes (today/yesterday/month/lastMonth/period) stay in sync.
function computeOrderDateRange(){
  const now = new Date();
  let rangeStart, rangeEnd;
  if(State.orderDateFilter === "today"){
    rangeStart = new Date(now); rangeStart.setHours(0,0,0,0);
    rangeEnd   = new Date(now); rangeEnd.setHours(23,59,59,999);
  }else if(State.orderDateFilter === "yesterday"){
    rangeStart = new Date(now); rangeStart.setDate(rangeStart.getDate()-1); rangeStart.setHours(0,0,0,0);
    rangeEnd   = new Date(now); rangeEnd.setDate(rangeEnd.getDate()-1); rangeEnd.setHours(23,59,59,999);
  }else if(State.orderDateFilter === "month"){
    rangeStart = new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0);
    rangeEnd   = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999);
  }else if(State.orderDateFilter === "lastMonth"){
    rangeStart = new Date(now.getFullYear(), now.getMonth()-1, 1, 0,0,0,0);
    rangeEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59,999);
  }else{
    rangeStart = State.orderPeriodStart || new Date(new Date().setHours(0,0,0,0));
    rangeEnd   = State.orderPeriodEnd   || new Date(new Date().setHours(23,59,59,999));
  }
  return { rangeStart, rangeEnd };
}

// Helper used by exportOrdersCSV and renderAdminOrders to apply current filters
function getFilteredOrders(){
  const { rangeStart, rangeEnd } = computeOrderDateRange();

  const inRange = (o) => {
    const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
    if(!d || isNaN(d.getTime())) return false;
    return d >= rangeStart && d <= rangeEnd;
  };

  const dateFiltered = State.orders.filter(inRange);

  // Source filter — chillpay counts as direct (same payment path, different label).
  let sourceFiltered;
  if(State.orderSourceFilter === "all"){
    sourceFiltered = dateFiltered;
  } else if(State.orderSourceFilter === "direct"){
    sourceFiltered = dateFiltered.filter(o => o.source === "direct" || o.source === "chillpay");
  } else {
    sourceFiltered = dateFiltered.filter(o => o.source === State.orderSourceFilter);
  }

  // Email filter — case-insensitive substring match against customer.email.
  // Empty string disables the filter. We normalise both sides to lowercase
  // so admins can paste an email in any case and still find their match.
  const emailQuery = (State.orderEmailFilter || "").trim().toLowerCase();
  let filtered = sourceFiltered;
  if(emailQuery){
    filtered = filtered.filter(o => (o.customer?.email || "").toLowerCase().includes(emailQuery));
  }
  // Partner / PayGW dropdown filters — exact code match (case-insensitive),
  // only affect ontheline orders since others have no partner/paygw. Empty = all.
  const partnerQ = (State.orderPartnerFilter || "").trim().toLowerCase();
  if(partnerQ){
    filtered = filtered.filter(o => (o.partner || "").toLowerCase() === partnerQ);
  }
  const paygwQ = (State.orderPaygwFilter || "").trim().toLowerCase();
  if(paygwQ){
    filtered = filtered.filter(o => (o.paygw || "").toLowerCase() === paygwQ);
  }
  // Currency filter — exact code match (ontheline orders only carry currency).
  const curQ = (State.orderCurrencyFilter || "").trim().toLowerCase();
  if(curQ){
    filtered = filtered.filter(o => (o.currency || "").toLowerCase() === curQ);
  }

  // Show EVERY transaction row. ontheline sends a new order per event (Paid →
  // Refund → ...) and we now list them all so the full history of a
  // transaction_id is visible in the Orders table (previously only the latest
  // event per transaction_id was shown). Sorted newest-first so the most
  // recently updated transactions appear at the top.
  const toMs = (o) => {
    const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
    return (d && !isNaN(d.getTime())) ? d.getTime() : 0;
  };
  const all = filtered.slice();
  all.sort((a,b) => toMs(b) - toMs(a));
  return all;
}

function renderAdminUsers(){
  const el = document.getElementById("adm-users");

  // Lazy-load DM Champ config so the Credits column uses the live rate.
  if(!State.dmchamp.loaded){
    loadDmChampConfig().then(() => {
      if(document.getElementById("adm-users")?.classList.contains("show")){
        renderAdminUsers();
      }
    });
  }

  // Helper: find the currently-active paid order for a given user email
  // (parallels customer-side findActiveOrder, but for admin to see for each customer)
  const findActiveForEmail = (email) => {
    if(!email || !State.orders) return null;
    const now = Date.now();
    const candidates = State.orders.filter(o =>
      o.status === "paid" &&
      (o.customer?.email || "").toLowerCase() === email.toLowerCase()
    );
    let best = null, bestExp = 0;
    for(const o of candidates){
      const exp = toExpiryDate(o.expiresAt);
      if(!exp) continue;
      if(exp.getTime() <= now) continue;  // already expired
      if(exp.getTime() > bestExp){ best = o; bestExp = exp.getTime(); }
    }
    if(!best) return null;
    const expDate = toExpiryDate(best.expiresAt);
    const daysLeft = Math.max(0, Math.ceil((expDate.getTime() - now) / (24*3600*1000)));
    return { order: best, expDate, daysLeft };
  };

  // Helper: total DM Champ credits earned by all paid orders for this user.
  // Uses the same calculation as the Customer Portal (subtotal × per-order
  // snapshot rate, falling back to current admin rate, then default 100).
  const totalCreditsForEmail = (email) => {
    if(!email || !State.orders) return 0;
    const emailLower = email.toLowerCase();
    const fallbackRate = (State.dmchamp && Number(State.dmchamp.creditsPerUsd)) || 100;
    let total = 0;
    for(const o of State.orders){
      if((o.customer?.email || "").toLowerCase() !== emailLower) continue;

      // ontheline reversal events (Unpaid / Refund / Partial Refund) SUBTRACT
      // credits that a prior Paid order had granted. creditsDeducted is stored
      // on the reversal order by the webhook / Simulate.
      if(o.source === "ontheline" && ["Unpaid","Refund","Partial Refund"].includes(o.event)){
        total -= Number(o.creditsDeducted) || 0;
        continue;
      }

      // Credit-earning orders: paid (direct/chillpay) or ontheline Paid event.
      const isPaid = o.status === "paid" || o.event === "Paid";
      if(!isPaid) continue;
      const subUsd = Number.isFinite(Number(o.amountUsd)) && Number(o.amountUsd) > 0
        ? Number(o.amountUsd)
        : (Number.isFinite(Number(o.subtotal)) && Number(o.subtotal) > 0 ? Number(o.subtotal) : Number(o.total) || 0);
      if(subUsd <= 0) continue;
      const sub = o.dmchampSubAccount || null;
      const orderRate = Number(sub && sub.creditsPerUsd);
      const rate = Number.isFinite(orderRate) && orderRate > 0 ? orderRate : fallbackRate;
      total += Math.max(1, Math.round(subUsd * rate));
    }
    return Math.max(0, total);
  };

  const rows = State.users.map(u => {
    const statusLabel = u.disabled ? "Disabled" : (u.mustChangePassword ? "Pending Password" : "Active");
    const statusClass = u.disabled ? "failed" : (u.mustChangePassword ? "pending" : "paid");
    const isSelf = State.user && (u.id === State.user.uid);

    // Active package cell — only meaningful for customers
    let activePkgCell = "—";
    if(u.role === "customer"){
      const active = findActiveForEmail(u.email);
      if(active){
        const pkgName = (active.order.items || []).map(i => i.title || i.id).join(" + ");
        const isExpiringSoon = active.daysLeft <= 7;
        const pillClass = isExpiringSoon ? "pending" : "paid";
        activePkgCell = `
          <div style="line-height:1.45">
            <div style="font-size:12.5px">${escapeHtml(pkgName)}</div>
            <div style="font-size:11px;color:${isExpiringSoon?'var(--accent-magenta)':'var(--muted)'};font-family:var(--mono);letter-spacing:.04em;margin-top:2px">
              ${active.daysLeft} ${active.daysLeft === 1 ? "day" : "days"} left
            </div>
          </div>
        `;
      }
    }

    // Credits cell: sum across all paid orders for this user's email.
    // Only meaningful for customers; admins always show "—".
    let creditsCell = '<span style="color:var(--muted)">—</span>';
    if(u.role === "customer"){
      const total = totalCreditsForEmail(u.email);
      if(total > 0){
        creditsCell = `<span style="font-family:var(--mono);font-size:12.5px;color:var(--teal-deep);font-weight:600">${total.toLocaleString()}</span>`;
      }
    }

    return `
    <tr style="${u.disabled?'opacity:.55':''}">
      <td>${escapeHtml(u.name)}</td>
      <td style="font-family:var(--mono);font-size:12px">${escapeHtml(u.email)}</td>
      <td><span class="src-tag ${u.role==='admin'?'ontheline':'direct'}">${I.t('admin.users.role.'+(u.role||'customer'))}</span></td>
      <td>${escapeHtml(u.plan||"—")}</td>
      <td>${activePkgCell}</td>
      <td>${creditsCell}</td>
      <td>${fmtDate(u.createdAt)}</td>
      <td><span class="status-tag ${statusClass}"><span class="d"></span>${statusLabel}</span></td>
      <td>
        <div class="row-actions">
          ${u.disabled ? "" : `<button onclick="AdminActions.resetPassword('${u.id}')">${I.t("admin.users.action.reset")}</button>`}
          ${(!isSelf && !u.disabled) ? `<button class="danger" onclick="AdminActions.deleteUser('${u.id}')">${I.t("admin.users.action.delete")}</button>` : ""}
        </div>
      </td>
    </tr>
  `;}).join("");

  el.innerHTML = `
    <div class="admin-head">
      <div>
        <div class="crumbs">Console / Users</div>
        <h1>${I.t("admin.users.title-html")}</h1>
      </div>
      <button class="btn-primary" onclick="AdminActions.openAddUser()"><span>${I.t("admin.users.add")}</span><span class="arr">→</span></button>
    </div>
    <div class="panel">
      <div class="panel-h"><h3>${I.t("admin.users.h")}</h3></div>
      <div class="table-wrap">
        ${State.users.length === 0 ? `<div class="empty-state">${I.t("admin.users.h")} — none yet.</div>` :
        `<table>
          <thead><tr>
            <th>${I.t("admin.users.col.name")}</th>
            <th>${I.t("admin.users.col.email")}</th>
            <th>${I.t("admin.users.col.role")}</th>
            <th>${I.t("admin.users.col.plan")}</th>
            <th>${I.t("admin.users.col.activePackage")}</th>
            <th>${I.t("admin.users.col.credits")}</th>
            <th>${I.t("admin.users.col.created")}</th>
            <th>${I.t("admin.users.col.status")}</th>
            <th>${I.t("admin.orders.col.actions")}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`}
      </div>
    </div>
  `;
}

// ============================================================================
// ontheline Partners & Payment Gateways — admin-managed reference lists.
// Both are simple { code, companyName } CRUD tables stored in their own
// Firestore collections (ontheline_partners / ontheline_paygw). The ontheline
// webhook validates incoming `partner` / `paygw` params against these codes.
// ============================================================================
function renderAdminPartners(){ renderAdminCodeList("partners"); }
function renderAdminPaygw(){ renderAdminCodeList("paygw"); }

// Currencies have an extra "symbol" column (e.g. $, ฿, ¥, ₩) so they get a
// dedicated renderer rather than the generic code-list one.
function renderAdminCurrencies(){
  const el = document.getElementById("adm-currencies");
  if(!el) return;
  const rows = (State.onthelineCurrencies || []).slice().sort((a,b) => (a.code||"").localeCompare(b.code||""));
  const rowsHtml = rows.length ? rows.map(c => `
    <tr>
      <td style="font-family:var(--mono);font-size:13px;font-weight:500;color:var(--teal-deep)">${escapeHtml(c.code||"—")}</td>
      <td style="font-size:18px;text-align:center">${escapeHtml(c.symbol||"—")}</td>
      <td>${escapeHtml(c.label||c.companyName||"—")}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn-ghost" style="padding:6px 12px;font-size:11px" onclick="AdminActions.editCurrency('${c.id}')">${I.t("admin.codelist.edit")}</button>
        <button class="btn-danger" style="padding:6px 12px;font-size:11px;margin-left:4px" onclick="AdminActions.deleteCurrency('${c.id}')">${I.t("admin.codelist.delete")}</button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:28px">${I.t("admin.currencies.empty")}</td></tr>`;

  el.innerHTML = `
    <div class="admin-head">
      <div>
        <div class="crumbs">Console / ontheline Currencies</div>
        <h1>${I.t("admin.currencies.title")}</h1>
      </div>
      <button class="btn-primary" onclick="AdminActions.addCurrency()"><span>${I.t("admin.currencies.add")}</span><span class="arr">+</span></button>
    </div>
    <p style="font-size:13.5px;color:var(--muted);line-height:1.55;margin:0 0 22px;max-width:680px">${I.t("admin.currencies.sub")}</p>
    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>${I.t("admin.currencies.col.code")}</th>
            <th style="text-align:center">${I.t("admin.currencies.col.symbol")}</th>
            <th>${I.t("admin.currencies.col.label")}</th>
            <th style="text-align:right">${I.t("admin.codelist.col.actions")}</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}


// kind: "partners" | "paygw"
function renderAdminCodeList(kind){
  const cfg = kind === "partners"
    ? { el:"adm-partners", coll:"ontheline_partners", data:State.onthelinePartners,
        crumb:"ontheline Partners", titleKey:"admin.partners.title", subKey:"admin.partners.sub",
        addKey:"admin.partners.add", emptyKey:"admin.partners.empty" }
    : { el:"adm-paygw", coll:"ontheline_paygw", data:State.onthelinePaygw,
        crumb:"ontheline Payment Gateways", titleKey:"admin.paygw.title", subKey:"admin.paygw.sub",
        addKey:"admin.paygw.add", emptyKey:"admin.paygw.empty" };
  const el = document.getElementById(cfg.el);
  if(!el) return;
  const rows = (cfg.data || []).slice().sort((a,b) => (a.code||"").localeCompare(b.code||""));

  const rowsHtml = rows.length ? rows.map(r => `
    <tr>
      <td style="font-family:var(--mono);font-size:13px;font-weight:500;color:var(--teal-deep)">${escapeHtml(r.code||"—")}</td>
      <td>${escapeHtml(r.companyName||"—")}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn-ghost" style="padding:6px 12px;font-size:11px" onclick="AdminActions.editCodeItem('${kind}','${r.id}')">${I.t("admin.codelist.edit")}</button>
        <button class="btn-danger" style="padding:6px 12px;font-size:11px;margin-left:4px" onclick="AdminActions.deleteCodeItem('${kind}','${r.id}')">${I.t("admin.codelist.delete")}</button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:28px">${I.t(cfg.emptyKey)}</td></tr>`;

  el.innerHTML = `
    <div class="admin-head">
      <div>
        <div class="crumbs">Console / ${cfg.crumb}</div>
        <h1>${I.t(cfg.titleKey)}</h1>
      </div>
      <button class="btn-primary" onclick="AdminActions.addCodeItem('${kind}')"><span>${I.t(cfg.addKey)}</span><span class="arr">+</span></button>
    </div>
    <p style="font-size:13.5px;color:var(--muted);line-height:1.55;margin:0 0 22px;max-width:680px">${I.t(cfg.subKey)}</p>
    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>${I.t("admin.codelist.col.code")}</th>
            <th>${I.t("admin.codelist.col.company")}</th>
            <th style="text-align:right">${I.t("admin.codelist.col.actions")}</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminWebhook(){
  const el = document.getElementById("adm-webhook");
  const events = State.webhookEvents;

  // Build the real webhook URL from the current host
  // Netlify deployments expose functions at /.netlify/functions/<name>
  // Plus we have a clean alias at /api/ontheline-webhook configured in netlify.toml
  const origin = window.location.origin;
  const webhookEndpoint = (origin.includes("netlify.app") || origin.includes("localhost") || origin.startsWith("http://127"))
    ? `${origin}/.netlify/functions/ontheline-webhook`
    : `${origin}/api/ontheline-webhook`;

  const eventRows = events.map(e => `
    <tr>
      <td style="font-family:var(--mono);font-size:12px">${fmtDate(e.createdAt)}</td>
      <td>${escapeHtml(e.customer?.name||"—")}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--muted)">${e.transactionId ? escapeHtml(e.transactionId) : '<span style="color:var(--line-2)">—</span>'}</td>
      <td>${(() => {
        // Show original-currency amount (with symbol) + USD in parens, mirroring
        // the Orders table. Events store amount (original) + amountUsd.
        const cur = (State.onthelineCurrencies || []).find(c => (c.code||"").toLowerCase() === (e.currency||"").toLowerCase());
        const sym = cur?.symbol || "";
        const usd = Number.isFinite(Number(e.amountUsd)) ? Number(e.amountUsd) : Number(e.amount) || 0;
        if(e.currency && e.currency !== "USD"){
          const orig = Number.isFinite(Number(e.amount)) ? Number(e.amount) : null;
          const origTxt = orig !== null ? `${escapeHtml(sym)}${orig.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}` : "—";
          return `<div style="line-height:1.4"><div style="font-weight:600">${origTxt} <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">${escapeHtml(e.currency)}</span></div>
            <div style="font-size:11px;color:var(--muted)">(${fmtMoney(usd)})</div></div>`;
        }
        return fmtMoney(usd);
      })()}</td>
      <td>${(() => {
        const pName = (State.onthelinePartners || []).find(p => (p.code||"").toLowerCase() === (e.partner||"").toLowerCase());
        const gName = (State.onthelinePaygw || []).find(g => (g.code||"").toLowerCase() === (e.paygw||"").toLowerCase());
        const pTxt = e.partner ? `${escapeHtml(e.partner)}${pName?` · ${escapeHtml(pName.companyName)}`:""}` : "—";
        const gTxt = e.paygw   ? `${escapeHtml(e.paygw)}${gName?` · ${escapeHtml(gName.companyName)}`:""}` : "—";
        return `<div style="font-family:var(--mono);font-size:10.5px;line-height:1.5">
          <div><span style="color:var(--muted)">P:</span> ${pTxt}</div>
          <div><span style="color:var(--muted)">G:</span> ${gTxt}</div>
        </div>`;
      })()}</td>
      <td>${escapeHtml((e.items||[]).map(i=>i.title+(i.manual?` $${i.price}`:"")).join(" + ")||"—")}</td>
      <td>${(() => {
        // STATUS column shows the ontheline event (Paid/Unpaid/Refund/Partial
        // Refund/Fail), colour-mapped. Fall back to the old success/fail display
        // for legacy rows that have no event field.
        if(e.event){
          const map = { "Paid":"paid", "Partial Refund":"pending", "Refund":"failed", "Unpaid":"pending", "Fail":"failed" };
          const cls = map[e.event] || "pending";
          return `<span class="status-tag ${cls}"><span class="d"></span>${escapeHtml(e.event)}</span>`;
        }
        return `<span class="status-tag ${e.status==='success'?'paid':'failed'}"><span class="d"></span>${e.status==='success'?'200 OK':e.status}</span>`;
      })()}</td>
    </tr>
  `).join("");

  // ----- Webhook secret state (read from State.webhookConfig, live-updated by subscription) -----
  const cfg = State.webhookConfig || {};
  const hasSecret = !!cfg.secret;
  // Render the secret as masked unless user clicks "Show" — but we still embed
  // it in the DOM so the Show/Hide/Copy actions can flip on the client without
  // re-rendering the whole admin page. Stored in a data-attribute (escaped).
  const secretValue = hasSecret ? cfg.secret : "";
  const secretMask  = hasSecret ? "•".repeat(Math.min(48, secretValue.length)) : I.t("admin.webhook.secret.none");

  el.innerHTML = `
    <div class="admin-head">
      <div>
        <div class="crumbs">Console / ontheline Webhook</div>
        <h1>${I.t("admin.webhook.title-html")}</h1>
      </div>
      <button class="btn-ghost" onclick="AdminActions.regenerateWebhookSecret()">${I.t("admin.webhook.regen")}</button>
    </div>

    <div class="wh-card" style="margin-bottom:18px">
      <h3>${I.t("admin.webhook.secret.title")}</h3>
      <p class="sub">${I.t("admin.webhook.secret.hint")}</p>
      <div style="display:flex;gap:6px;align-items:center;margin-top:10px">
        <div class="endpoint" id="webhook-secret-display"
             data-secret="${escapeHtml(secretValue)}"
             data-masked="${escapeHtml(secretMask)}"
             data-revealed="0"
             style="flex:1;font-family:var(--mono);font-size:13px;word-break:break-all;${hasSecret?'':'color:var(--muted);font-style:italic;font-family:inherit'}">${escapeHtml(secretMask)}</div>
        <button class="btn-ghost" style="padding:9px 12px;font-size:11px" onclick="AdminActions.toggleWebhookSecret()" ${hasSecret?'':'disabled style="opacity:.4;cursor:not-allowed"'}>${I.t("admin.webhook.secret.show")}</button>
        <button class="btn-ghost" style="padding:9px 12px;font-size:11px" onclick="AdminActions.copyWebhookSecret()" ${hasSecret?'':'disabled style="opacity:.4;cursor:not-allowed"'}>${I.t("admin.webhook.secret.copy")}</button>
      </div>
      ${cfg.updatedAt ? `<div style="font-size:11px;color:var(--muted);font-family:var(--mono);letter-spacing:.04em;margin-top:8px">Last generated: ${fmtDate(cfg.updatedAt)}${cfg.updatedBy?` · by ${escapeHtml(cfg.updatedBy)}`:''}</div>` : ''}
    </div>

    <div class="webhook-grid">
      <div class="wh-card">
        <h3>${I.t("admin.webhook.flow.title")}</h3>
        <p class="sub">${I.t("admin.webhook.flow.sub")}</p>
        <div class="wh-flow">
          <div class="wh-step"><div class="n">01</div><div class="t"><b>${I.t("admin.webhook.flow.s1.t")}</b>${I.t("admin.webhook.flow.s1.d")}</div></div>
          <div class="wh-step"><div class="n">02</div><div class="t"><b>${I.t("admin.webhook.flow.s2.t")}</b>${I.t("admin.webhook.flow.s2.d")}</div></div>
          <div class="wh-step"><div class="n">03</div><div class="t"><b>${I.t("admin.webhook.flow.s3.t")}</b>${I.t("admin.webhook.flow.s3.d")}</div></div>
          <div class="wh-step"><div class="n">04</div><div class="t"><b>${I.t("admin.webhook.flow.s4.t")}</b>${I.t("admin.webhook.flow.s4.d")}</div></div>
          <div class="wh-step"><div class="n">05</div><div class="t"><b>${I.t("admin.webhook.flow.s5.t")}</b>${I.t("admin.webhook.flow.s5.d")}</div></div>
        </div>
      </div>
      <div class="wh-card">
        <h3>${I.t("admin.webhook.endpoint.title")}</h3>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">
          <div class="endpoint" id="webhook-endpoint" style="flex:1;cursor:pointer" onclick="AdminActions.copyWebhookEndpoint(this)" title="Click to copy">${webhookEndpoint}</div>
          <button class="btn-ghost" style="padding:9px 12px;font-size:11px" onclick="AdminActions.copyWebhookEndpoint(document.getElementById('webhook-endpoint'))" title="Copy URL">Copy</button>
        </div>
        <details style="margin-bottom:14px;font-size:12.5px;color:var(--muted);background:rgba(120,100,60,.04);border:1px solid var(--line);border-radius:9px;padding:10px 14px">
          <summary style="cursor:pointer;font-weight:500;color:var(--text);font-size:13px;font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase">⚙ Setup instructions for ontheline</summary>
          <div style="margin-top:10px;line-height:1.6">
            <p style="margin-bottom:8px"><b>1. Provide this endpoint URL to ontheline</b></p>
            <p style="margin-bottom:8px"><b>2. ontheline should POST a JSON payload</b> with these fields:</p>
            <pre style="background:rgba(31,33,38,.05);padding:10px;border-radius:6px;font-size:11.5px;overflow-x:auto;margin-bottom:8px">{
  "event": "Paid",
  "transaction_id": "ot_xxx",
  "customer": { "name": "...", "email": "...", "country": "TH" },
  "amount": 3550.00,
  "currency": "THB",
  "partner": "PARTNER01",
  "paygw": "PAYGW01"
}</pre>
            <p style="margin-bottom:8px"><b>event</b> — one of <code style="background:rgba(31,33,38,.08);padding:1px 5px;border-radius:4px;font-family:var(--mono);font-size:11px">Paid</code>, <code style="background:rgba(31,33,38,.08);padding:1px 5px;border-radius:4px;font-family:var(--mono);font-size:11px">Unpaid</code>, <code style="background:rgba(31,33,38,.08);padding:1px 5px;border-radius:4px;font-family:var(--mono);font-size:11px">Refund</code>, <code style="background:rgba(31,33,38,.08);padding:1px 5px;border-radius:4px;font-family:var(--mono);font-size:11px">Partial Refund</code>, <code style="background:rgba(31,33,38,.08);padding:1px 5px;border-radius:4px;font-family:var(--mono);font-size:11px">Fail</code>.</p>
            <div style="margin:8px 0 12px;padding:12px 16px;background:rgba(11,182,196,.05);border:1px solid var(--line);border-radius:8px;font-size:12.5px;line-height:1.7">
              <div style="font-weight:600;margin-bottom:6px;font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--teal-deep)">Event flow & rules</div>
              <ul style="margin:0;padding-left:18px">
                <li>Only <b>Paid</b> creates the customer account, sends emails, and records credits. <b>Fail</b> is logged for the audit trail only.</li>
                <li>The same <code style="font-family:var(--mono)">transaction_id</code> may receive multiple events over time — the Orders table lists <b>every</b> event (e.g. the original Paid row and its later Refund / Partial Refund rows are all shown), sorted newest-first so the most recently updated transactions appear at the top.</li>
                <li><b>State transitions</b> (anything else is rejected with HTTP 400):
                  <ul style="margin:4px 0;padding-left:18px">
                    <li>A <b>new</b> <code style="font-family:var(--mono)">transaction_id</code> can only start with <b>Paid</b> or <b>Fail</b>.</li>
                    <li>From <b>Paid</b> → only <b>Unpaid</b>, <b>Refund</b>, or <b>Partial Refund</b>.</li>
                    <li><b>Unpaid</b>, <b>Refund</b>, <b>Partial Refund</b> are <b>final</b> — no further changes.</li>
                    <li>From <b>Fail</b> → only <b>Paid</b>.</li>
                    <li>Sending <b>Unpaid</b>/<b>Refund</b>/<b>Partial Refund</b> for a <code style="font-family:var(--mono)">transaction_id</code> that doesn't exist yet is rejected.</li>
                  </ul>
                </li>
                <li><b>Credit reversal:</b> Paid → <b>Unpaid</b> or <b>Refund</b> removes ALL credits granted and refunds the full amount (customer is emailed). Paid → <b>Partial Refund</b> removes credits proportional to the refunded amount (<code style="font-family:var(--mono)">amount</code> = the portion refunded, which must be <b>less than</b> the original paid amount) and emails the customer their remaining balance.</li>
              </ul>
            </div>
            <p style="margin-bottom:8px"><b>amount + currency</b> — amount is in the order's own currency. <code style="font-family:var(--mono);font-size:11px">currency</code> must match a code in <em>ontheline Currencies</em> (it's converted to USD for credit calculation).</p>
            <p style="margin-bottom:8px"><b>partner + paygw</b> — must match codes in <em>ontheline Partners</em> / <em>ontheline Payment Gateways</em>.</p>
            <p style="margin-bottom:8px;color:var(--amber)"><b>⚠ Set up reference data first:</b> create at least one entry in <em>ontheline Partners</em>, <em>ontheline Payment Gateways</em>, and <em>ontheline Currencies</em> before going live — unknown or missing <code style="font-family:var(--mono);font-size:11px">partner</code>, <code style="font-family:var(--mono);font-size:11px">paygw</code>, <code style="font-family:var(--mono);font-size:11px">currency</code>, or <code style="font-family:var(--mono);font-size:11px">event</code> values are rejected with HTTP 400.</p>
            <p style="margin-bottom:8px"><b>3. Required header:</b> <code style="background:rgba(31,33,38,.08);padding:1px 6px;border-radius:4px;font-family:var(--mono);font-size:11px">X-OnTheLine-Signature: sha256=&lt;hex&gt;</code></p>
            <p style="margin-bottom:8px">The signature is HMAC-SHA256 of the raw JSON body using the shared secret.</p>
            <p>The endpoint responds with HTTP 200 on success and 401 on signature mismatch. Failed events are still logged under <em>webhook_events</em>.</p>
          </div>
        </details>
        <div class="test-webhook">
          <div class="hint"><b>${I.t("admin.webhook.test.title")}</b> — ${I.t("admin.webhook.test.hint")}</div>
          <div class="form-row">
            <div class="field"><label>Customer Name</label><input id="tw-name" value="Tanaka Hiroshi"/></div>
            <div class="field"><label>Email</label><input id="tw-email" value="tanaka@hiro-creative.jp"/></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Country</label><input id="tw-country" value="JP"/></div>
            <div class="field"><label>Event</label>
              <select id="tw-event">
                <option value="Paid" selected>Paid</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Refund">Refund</option>
                <option value="Partial Refund">Partial Refund</option>
                <option value="Fail">Fail</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="field"><label>Amount</label><input id="tw-amount" type="number" value="5020" step="0.01"/></div>
            <div class="field"><label>Currency</label>
              <select id="tw-currency">
                ${(State.onthelineCurrencies||[]).length
                  ? (State.onthelineCurrencies||[]).slice().sort((a,b)=>(a.code||"").localeCompare(b.code||"")).map((c,i) =>
                      `<option value="${escapeHtml(c.code)}" ${i===0?"selected":""}>${escapeHtml(c.code)}${c.symbol?` (${escapeHtml(c.symbol)})`:""}</option>`).join("")
                  : `<option value="USD">USD (no currencies configured)</option>`}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="field"><label>Partner</label>
              <select id="tw-partner">
                ${(State.onthelinePartners||[]).length
                  ? (State.onthelinePartners||[]).slice().sort((a,b)=>(a.code||"").localeCompare(b.code||"")).map((p,i) =>
                      `<option value="${escapeHtml(p.code)}" ${i===0?"selected":""}>${escapeHtml(p.code)}${p.companyName?` · ${escapeHtml(p.companyName)}`:""}</option>`).join("")
                  : `<option value="">(no partners configured)</option>`}
              </select>
            </div>
            <div class="field"><label>Payment Gateway</label>
              <select id="tw-paygw">
                ${(State.onthelinePaygw||[]).length
                  ? (State.onthelinePaygw||[]).slice().sort((a,b)=>(a.code||"").localeCompare(b.code||"")).map((g,i) =>
                      `<option value="${escapeHtml(g.code)}" ${i===0?"selected":""}>${escapeHtml(g.code)}${g.companyName?` · ${escapeHtml(g.companyName)}`:""}</option>`).join("")
                  : `<option value="">(no payment gateways configured)</option>`}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="field" style="flex:1">
              <label>Transaction ID</label>
              <input id="tw-txid" placeholder="${escapeHtml(I.t("admin.webhook.test.txid.ph"))}" autocomplete="off" spellcheck="false"/>
            </div>
          </div>
          <p style="font-size:11.5px;color:var(--muted);margin:2px 0 8px;line-height:1.5">${I.t("admin.webhook.test.txid.hint")}</p>
          <button class="btn-primary" onclick="AdminActions.fireTestWebhook()" style="margin-top:6px"><span>${I.t("admin.webhook.test.fire")}</span><span class="arr">→</span></button>
          <p style="font-size:11.5px;color:var(--muted);margin-top:8px;font-style:italic">Note: this in-browser test simulates the matching logic directly. To verify the actual deployed endpoint, send a real POST request from outside the app.</p>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-h"><h3>${I.t("admin.webhook.events.h")}</h3></div>
      <div class="table-wrap">
        ${events.length === 0 ? `<div class="empty-state">Fire a test webhook above to see events here.</div>` :
        `<table>
          <thead><tr>
            <th>${I.t("admin.webhook.events.col.time")}</th>
            <th>${I.t("admin.webhook.events.col.customer")}</th>
            <th>${I.t("admin.webhook.events.col.txId")}</th>
            <th>${I.t("admin.webhook.events.col.amount")}</th>
            <th>${I.t("admin.webhook.events.col.partnerGw")}</th>
            <th>${I.t("admin.webhook.events.col.matched")}</th>
            <th>${I.t("admin.webhook.events.col.status")}</th>
          </tr></thead>
          <tbody>${eventRows}</tbody>
        </table>`}
      </div>
    </div>
  `;
}

// ============================================================
// ADMIN · CHILLPAY EVENTS (audit log of API calls + callbacks)
// ============================================================
function renderAdminChillPay(){
  const el = document.getElementById("adm-chillpay");
  if(!el) return;
  const events = State.chillpayEvents || [];

  // The callback URL below is pinned to the ACTIVE gateway. If the admin
  // hasn't opened the Payment Gateway page yet we don't know which that is, so
  // load it once and re-render — otherwise this page would always suggest the
  // default provider's URL.
  if(!State.paymentGw?.loaded){
    loadPaymentGwConfig().then(() => {
      if(document.getElementById("adm-chillpay")?.classList.contains("show")) renderAdminChillPay();
    }).catch(() => {});
  }

  // Build the two endpoint URLs ChillPay needs to know about:
  //   - URL Background: server-to-server callback (source of truth for "paid")
  //   - URL Result:     browser-side return (POST → 303 redirect to SPA result page)
  // Both must be configured in the payment provider's merchant dashboard per
  // channel.
  //
  // We show the DIRECT function path with the gateway as a TRAILING PATH
  // SEGMENT — never "?gw=".
  //
  // ChillPay (and other providers) will not call a webhook URL that contains a
  // query string: the payment succeeds on their side but the notification is
  // left as "Pending" and no request ever reaches us, so the order stays
  // pending forever. The path form carries the same information without a '?'.
  //
  // The legacy /api/chillpay-callback and /.netlify/functions/chillpay-callback
  // URLs still work (thin wrappers that force gw=chillpay), so an already
  // registered dashboard doesn't break — but new registrations should use this.
  const origin = window.location.origin;
  const activeGwId = (State.paymentGw && State.paymentGw.activeGateway) || "chillpay";
  const callbackEndpoint = `${origin}/.netlify/functions/payment-callback/${activeGwId}`;
  const resultEndpoint   = `${origin}/payment-result`;

  // Counts by kind
  const createCount   = events.filter(e => e.kind === "create-payment").length;
  const callbackCount = events.filter(e => e.kind === "callback").length;
  const verifiedCount = events.filter(e => e.kind === "callback" && e.verified === true).length;

  // Row renderer — handles both "create-payment" and "callback" kinds in one table
  const rows = events.map(e => {
    const ts = e.receivedAt || e.createdAt;
    // Verified column: only meaningful for callbacks
    let verifiedCell = "—";
    if(e.kind === "callback"){
      if(e.verified === true){
        verifiedCell = `<span class="status-tag paid"><span class="d"></span>${escapeHtml(I.t("admin.chillpay.checksum.ok"))}</span>`;
      }else{
        verifiedCell = `<span class="status-tag failed"><span class="d"></span>${escapeHtml(I.t("admin.chillpay.checksum.fail"))}</span>`;
      }
    }
    // Result column: derived from finalStatus (callback) or responseStatus (create-payment)
    let resultCell;
    if(e.kind === "callback"){
      const fs = e.finalStatus || (e.matched ? (e.note || "—") : (e.error || "no match"));
      const cls = fs === "paid" ? "paid" : (fs === "failed" || (e.error && !e.matched) ? "failed" : "pending");
      resultCell = `<span class="status-tag ${cls}"><span class="d"></span>${escapeHtml(String(fs))}</span>`;
    }else{
      // create-payment: 200 = ok
      const ok = e.responseStatus === 200 || e.responseStatus === "200";
      resultCell = `<span class="status-tag ${ok ? "paid" : "failed"}"><span class="d"></span>HTTP ${escapeHtml(String(e.responseStatus ?? "?"))}</span>`;
    }
    return `
      <tr>
        <td style="font-family:var(--mono);font-size:12px">${fmtDate(ts)}</td>
        <td>
          <span class="src-tag ${escapeHtml(e.kind || "")}">${escapeHtml(e.kind || "?")}</span>
          ${e.gateway ? `<div style="font-family:var(--mono);font-size:9.5px;color:var(--muted-2);margin-top:3px;letter-spacing:.04em">${escapeHtml(e.gateway)}</div>` : ""}
        </td>
        <td style="font-family:var(--mono);font-size:12px">${escapeHtml(e.dealProRef || "—")}</td>
        <td style="font-family:var(--mono);font-size:11.5px;color:var(--muted)">${escapeHtml(e.gatewayOrderNo || e.chillpayOrderNo || e.rawParams?.OrderNo || "—")}</td>
        <td>${verifiedCell}</td>
        <td>${resultCell}</td>
        <td>
          <div class="row-actions">
            <button onclick="AdminActions.viewChillPayEvent('${e.id}')">${I.t("admin.chillpay.action.view")}</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  el.innerHTML = `
    <div class="admin-head">
      <div>
        <div class="crumbs">Console / Payment Gateway Events</div>
        <h1>${I.t("admin.chillpay.title-html")}</h1>
      </div>
      <button class="btn-ghost" onclick="AdminActions.refreshChillPayEvents()" title="Force a one-shot read of chillpay_events from Firestore">↻ Refresh</button>
    </div>
    <p style="color:var(--muted);font-size:13px;margin-bottom:20px;max-width:680px;line-height:1.55">${I.t("admin.chillpay.sub")}</p>

    <div class="webhook-grid">
      <div class="wh-card">
        <h3>${I.t("admin.chillpay.endpoint.title")}</h3>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">
          <div class="endpoint" id="chillpay-endpoint" style="flex:1;cursor:pointer" onclick="AdminActions.copyChillPayEndpoint(this)" title="Click to copy">${escapeHtml(callbackEndpoint)}</div>
          <button class="btn-ghost" style="padding:9px 12px;font-size:11px" onclick="AdminActions.copyChillPayEndpoint(document.getElementById('chillpay-endpoint'))" title="Copy URL">Copy</button>
        </div>
        <p style="font-size:12.5px;color:var(--muted);line-height:1.55;margin:0 0 18px">${I.t("admin.chillpay.endpoint.hint")}</p>

        <h3 style="margin-top:4px">${I.t("admin.chillpay.result.title")}</h3>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">
          <div class="endpoint" id="chillpay-result-endpoint" style="flex:1;cursor:pointer" onclick="AdminActions.copyChillPayResultEndpoint(this)" title="Click to copy">${escapeHtml(resultEndpoint)}</div>
          <button class="btn-ghost" style="padding:9px 12px;font-size:11px" onclick="AdminActions.copyChillPayResultEndpoint(document.getElementById('chillpay-result-endpoint'))" title="Copy URL">Copy</button>
        </div>
        <p style="font-size:12.5px;color:var(--muted);line-height:1.55;margin:0">${I.t("admin.chillpay.result.hint")}</p>
      </div>
      <div class="wh-card">
        <h3>${I.t("admin.chillpay.stat.total")}</h3>
        <div class="stats" style="grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          <div class="stat" style="padding:14px"><div class="lab" style="font-size:9.5px">${I.t("admin.chillpay.stat.creates")}</div><div class="val" style="font-size:24px">${createCount}</div></div>
          <div class="stat" style="padding:14px"><div class="lab" style="font-size:9.5px">${I.t("admin.chillpay.stat.callbacks")}</div><div class="val" style="font-size:24px">${callbackCount}</div></div>
          <div class="stat" style="padding:14px"><div class="lab" style="font-size:9.5px">${I.t("admin.chillpay.stat.verified")}</div><div class="val" style="font-size:24px">${verifiedCount}</div></div>
          <div class="stat" style="padding:14px"><div class="lab" style="font-size:9.5px">${I.t("admin.chillpay.stat.total")}</div><div class="val" style="font-size:24px">${events.length}</div></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-h"><h3>${I.t("admin.chillpay.events.h")}</h3></div>
      <div class="table-wrap">
        ${events.length === 0 ? `<div class="empty-state">${I.t("admin.chillpay.empty")}</div>` :
        `<table>
          <thead><tr>
            <th>${I.t("admin.chillpay.col.time")}</th>
            <th>${I.t("admin.chillpay.col.kind")}</th>
            <th>${I.t("admin.chillpay.col.ref")}</th>
            <th>${I.t("admin.chillpay.col.orderno")}</th>
            <th>${I.t("admin.chillpay.col.verified")}</th>
            <th>${I.t("admin.chillpay.col.status")}</th>
            <th>${I.t("admin.chillpay.col.actions")}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`}
      </div>
    </div>
  `;
}

function renderAdminEmails(){
  const el = document.getElementById("adm-emails");

  // Derive a display subject if the doc doesn't have one (new emails store kind+orderRef,
  // server renders the actual subject at send time)
  const subjectFor = (e) => {
    if(e.subject) return e.subject;
    const o = e.payload || {};
    const refStr = o.ref || e.orderRef || "";
    if(e.kind === "invoice")     return `Invoice ${refStr}`;
    if(e.kind === "receipt")     return `Receipt ${refStr}`;
    if(e.kind === "credentials") return `Welcome — credentials for ${e.to}`;
    return `${e.kind} ${refStr}`;
  };

  // Stats by status
  const counts = State.emails.reduce((a,e) => { a[e.status]=(a[e.status]||0)+1; return a; }, {});
  const pendingCount = counts.pending || 0;
  const processedCount = (counts.sent||0) + (counts.failed||0) + (counts.cancelled||0);

  const rows = State.emails.map(e => {
    const attemptInfo = e.sendAttempts && e.status === "pending"
      ? ` <span style="color:var(--muted);font-size:11px">· retry ${e.sendAttempts}</span>`
      : "";
    // Status badge — handle cancelled as a separate look
    const statusTag = e.status === "sent"      ? `<span class="status-tag sent"><span class="d"></span>sent</span>`
                    : e.status === "sent_support_only" ? `<span class="status-tag" style="background:rgba(11,182,196,.12);color:var(--teal-deep)" title="${escapeHtml(I.t('admin.emails.status.supportOnly.title'))}"><span class="d" style="background:var(--teal-deep)"></span>${I.t('admin.emails.status.supportOnly')}</span>`
                    : e.status === "failed"    ? `<span class="status-tag failed"><span class="d"></span>failed</span>`
                    : e.status === "cancelled" ? `<span class="status-tag" style="background:rgba(120,120,120,.12);color:#787878"><span class="d" style="background:#787878"></span>cancelled</span>`
                    : `<span class="status-tag pending"><span class="d"></span>pending</span>`;
    // Actions vary by status: pending can be cancelled; everything else can be resent
    const actions = e.status === "pending"
      ? `<button onclick="AdminActions.viewEmail('${e.id}')">${I.t("admin.emails.action.view")}</button>
         <button class="danger" onclick="AdminActions.cancelEmail('${e.id}')">Cancel</button>`
      : `<button onclick="AdminActions.viewEmail('${e.id}')">${I.t("admin.emails.action.view")}</button>
         <button onclick="AdminActions.resendEmail('${e.id}')">${I.t("admin.emails.action.resend")}</button>`;

    return `
      <tr>
        <td style="font-family:var(--mono);font-size:12px">${fmtDate(e.createdAt)}</td>
        <td style="font-family:var(--mono);font-size:12px">${escapeHtml(e.to)}</td>
        <td>${escapeHtml(subjectFor(e))}${attemptInfo}</td>
        <td><span class="src-tag direct">${I.t('admin.emails.kind.'+e.kind)}</span></td>
        <td>${statusTag}</td>
        <td>
          <div class="row-actions">${actions}</div>
        </td>
      </tr>
    `;
  }).join("");

  el.innerHTML = `
    <div class="admin-head">
      <div>
        <div class="crumbs">Console / Email Queue</div>
        <h1>${I.t("admin.emails.title-html")}</h1>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${pendingCount > 0 ? `<button class="btn-ghost" onclick="AdminActions.cancelAllPending()" style="border-color:var(--amber);color:var(--amber)">Cancel All Pending (${pendingCount})</button>` : ""}
        ${processedCount > 0 ? `<button class="btn-ghost" onclick="AdminActions.clearProcessedEmails()">Clear Processed (${processedCount})</button>` : ""}
      </div>
    </div>
    <p style="color:var(--muted);font-size:13px;margin-bottom:20px;max-width:680px;line-height:1.55">${I.t("admin.emails.sub")}</p>
    <div class="panel">
      <div class="table-wrap">
        ${State.emails.length === 0 ? `<div class="empty-state">No emails queued yet.</div>` :
        `<table>
          <thead><tr>
            <th>${I.t("admin.emails.col.time")}</th>
            <th>${I.t("admin.emails.col.to")}</th>
            <th>${I.t("admin.emails.col.subject")}</th>
            <th>${I.t("admin.emails.col.kind")}</th>
            <th>${I.t("admin.emails.col.status")}</th>
            <th>${I.t("admin.orders.col.actions")}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`}
      </div>
    </div>
  `;
}

// ============================================================
// ADMIN · PACKAGES (CRUD)
// ============================================================
function renderAdminPackages(){
  const el = document.getElementById("adm-packages");
  if(!el) return;

  const bucketRows = (bucketKey) => {
    const list = PACKAGES[bucketKey] || [];
    if(list.length === 0){
      return `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px;font-style:italic">— ${I.t("admin.packages.add")} —</td></tr>`;
    }
    return list.map(p => `
      <tr>
        <td style="font-family:var(--mono);font-size:12px">${p.order ?? "—"}</td>
        <td style="font-family:var(--mono);font-size:12px;color:var(--teal-deep)">${escapeHtml(p.id)}</td>
        <td>${escapeHtml(pkgTitle(p))}</td>
        <td style="font-size:12.5px;color:var(--muted);max-width:280px">${escapeHtml(pkgDesc(p))}</td>
        <td style="font-family:var(--mono);font-size:13px">${fmtMoney(p.price)}</td>
        <td>${p.featured ? `<span class="src-tag direct">★ ${I.t("admin.packages.col.featured")}</span>` : ""}</td>
        <td>
          <div class="row-actions">
            <button onclick="AdminActions.openPackageModal('${escapeHtml(bucketKey)}','${escapeHtml(p.id)}')">${I.t("admin.packages.action.edit")}</button>
            <button class="danger" onclick="AdminActions.deletePackage('${escapeHtml(p.id)}')">${I.t("admin.packages.action.delete")}</button>
          </div>
        </td>
      </tr>
    `).join("");
  };

  const bucketSection = (key, labelKey) => `
    <div class="panel" style="margin-bottom:18px">
      <div class="panel-h">
        <h3>${I.t(labelKey)}</h3>
        <button class="btn-ghost" style="padding:7px 14px;font-size:12px" onclick="AdminActions.openPackageModal('${key}',null)">+ ${I.t("admin.packages.add")}</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>${I.t("admin.packages.col.order")}</th>
            <th>${I.t("admin.packages.col.id")}</th>
            <th>${I.t("admin.packages.col.title")}</th>
            <th>${I.t("admin.packages.col.desc")}</th>
            <th>${I.t("admin.packages.col.price")}</th>
            <th>${I.t("admin.packages.col.featured")}</th>
            <th>${I.t("admin.packages.col.actions")}</th>
          </tr></thead>
          <tbody>${bucketRows(key)}</tbody>
        </table>
      </div>
    </div>
  `;

  el.innerHTML = `
    <div class="admin-head">
      <div>
        <div class="crumbs">Console / Packages</div>
        <h1>${I.t("admin.packages.title-html")}</h1>
      </div>
      <button class="btn-ghost" onclick="AdminActions.resetPackagesToDefaults()" title="Restore the original starter set of packages">
        ↺ Reset to Defaults
      </button>
    </div>
    <p style="color:var(--muted);font-size:13px;margin-bottom:20px;max-width:680px;line-height:1.55">
      ${I.t("admin.packages.intro")}
    </p>
    ${bucketSection("credit",  "admin.packages.bucket.credit")}
    ${bucketSection("onetime", "admin.packages.bucket.onetime")}
    ${bucketSection("sub",     "admin.packages.bucket.sub")}
  `;
}


function renderAdminLanguages(){
  const el = document.getElementById("adm-languages");
  I.recalcStatus();

  const cards = State.langs.map(l => {
    const s = State.langStatus[l.code];
    const isLocked = s.locked;
    const status = s.isMaster ? "100% · master" : `${s.pct}% · ${isLocked ? I.t("admin.langs.locked") : I.t("admin.langs.live")}`;
    const isEnabled = App.isLangEnabled(l.code);
    const isEn = l.code === "en";
    // Enable/disable toggle — controls whether end-users see this language in
    // the picker. "en" is always on (fallback) so its toggle is shown disabled.
    const toggleBtn = isEn
      ? `<button class="lang-toggle on locked" disabled title="${I.t("admin.langs.toggle.alwaysOn")}">${I.t("admin.langs.toggle.on")}</button>`
      : `<button class="lang-toggle ${isEnabled?"on":"off"}" onclick="AdminActions.toggleLangEnabled('${l.code}')" title="${I.t(isEnabled?"admin.langs.toggle.clickToDisable":"admin.langs.toggle.clickToEnable")}">${I.t(isEnabled?"admin.langs.toggle.on":"admin.langs.toggle.off")}</button>`;
    return `
      <div class="lang-card ${isLocked?"locked":"active"}${isEnabled?"":" lang-disabled"}">
        <div class="flag">${l.code.toUpperCase()}</div>
        <div class="pct">${status}</div>
        <div class="bar"><div class="bar-fill" style="width:${s.pct}%"></div></div>
        <div class="meta">${escapeHtml(l.native)} — ${s.isMaster?I.t("admin.langs.master"):(isLocked?I.t("admin.langs.locked"):I.t("admin.langs.live"))}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:8px">
          <span style="font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">${I.t("admin.langs.toggle.label")}</span>
          ${toggleBtn}
        </div>
        <button onclick="AdminActions.editLang('${l.code}')" style="margin-top:8px">${I.t("admin.langs.continue")}</button>
      </div>
    `;
  }).join("");

  el.innerHTML = `
    <div class="admin-head">
      <div>
        <div class="crumbs">Console / Languages</div>
        <h1>${I.t("admin.langs.title-html")}</h1>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-ghost" onclick="AdminActions.importAllTranslations(false)" title="Merge full TH/KO/JA translations — existing custom edits are kept where keys differ">
          ⇪ Import TH / KO / JA
        </button>
        <button class="btn-ghost" onclick="AdminActions.importAllTranslations(true)" title="Wipe TH/KO/JA and replace with full bundled translations" style="border-color:var(--amber);color:var(--amber)">
          ⇪ Import + Overwrite
        </button>
      </div>
    </div>
    <div class="lang-grid">${cards}</div>

    <div class="panel">
      <div class="panel-h">
        <h3>${I.t("admin.langs.translate-table.h")}</h3>
        <div class="translate-controls" style="margin:0">
          <select id="tl-lang" onchange="renderAdminLanguages_TranslateTable()">
            ${State.langs.map(l => `<option value="${l.code}">${l.native} (${l.code.toUpperCase()})${l.code==="en"?" — master":""}</option>`).join("")}
          </select>
          <input class="search" id="tl-search" placeholder="${I.t("admin.langs.translate-table.search")}" oninput="renderAdminLanguages_TranslateTable()" />
        </div>
      </div>
      <div style="padding:12px 22px;background:rgba(127,169,42,.08);border-bottom:1px solid var(--line);font-size:12.5px;color:var(--muted-2);display:flex;align-items:center;gap:8px">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--lime);box-shadow:0 0 6px var(--lime);flex:none"></span>
        <span>${I.t("admin.langs.autosave.hint")}</span>
      </div>
      <div id="translate-table-body"></div>
    </div>
  `;

  renderAdminLanguages_TranslateTable();
}

window.renderAdminLanguages_TranslateTable = function(){
  const lang = document.getElementById("tl-lang")?.value || "en";
  const search = (document.getElementById("tl-search")?.value || "").toLowerCase();
  const dict = State.strings[lang] || {};
  const isMaster = (lang === "en");

  const keys = Object.keys(DEFAULT_STRINGS).filter(k => {
    if(!search) return true;
    return k.toLowerCase().includes(search) ||
           (DEFAULT_STRINGS[k]||"").toLowerCase().includes(search) ||
           (dict[k]||"").toLowerCase().includes(search);
  });

  const rows = keys.map(k => {
    const src = DEFAULT_STRINGS[k];           // English baseline (always shown as reference)
    const val = isMaster                       // What appears in the editable field
      ? (dict[k] ?? src)                       // For EN: show current value (or default)
      : (dict[k] || "");                       // For others: show translation (blank if missing)
    const isLong = (src.length > 60) || (val.length > 60);
    const escapedVal = escapeHtml(val);
    const input = isLong
      ? `<textarea data-tk="${escapeHtml(k)}" data-orig="${escapedVal}" onfocus="this.dataset.orig=this.value" onblur="AdminActions.saveTranslationOnBlur('${lang}','${escapeHtml(k)}',this)">${escapedVal}</textarea>`
      : `<input data-tk="${escapeHtml(k)}" data-orig="${escapedVal}" value="${escapedVal}" placeholder="${escapeHtml(I.t('admin.langs.translate-table.empty'))}" onfocus="this.dataset.orig=this.value" onblur="AdminActions.saveTranslationOnBlur('${lang}','${escapeHtml(k)}',this)" />`;
    return `
      <div class="translate-row">
        <div class="key">${escapeHtml(k)}</div>
        <div><span style="font-size:13px">${escapeHtml(src)}</span></div>
        <div>${input}</div>
      </div>
    `;
  }).join("");

  const targetLang = State.langs.find(l => l.code === lang);
  const colHeaderRight = isMaster
    ? `${targetLang?.native || "English"} (EN) — Editable Master`
    : `${targetLang?.native || lang} (${lang.toUpperCase()}) — Translation`;

  document.getElementById("translate-table-body").innerHTML = `
    <div class="translate-table">
      <div class="translate-row head">
        <div>${I.t("admin.langs.translate-table.col.key")}</div>
        <div>${I.t("admin.langs.translate-table.col.source")}</div>
        <div>${colHeaderRight}</div>
      </div>
      ${rows}
    </div>
  `;
};

function renderAdminBranding(){
  const el = document.getElementById("adm-branding");
  if(!el) return;
  const currentName = State.branding.siteName || DEFAULT_BRANDING.siteName;
  const currentLogo = State.branding.logoDataUrl || DEFAULT_LOGO_DATA_URL;
  const usingCustomLogo = !!State.branding.logoDataUrl;
  const currentFavicon = State.branding.faviconDataUrl || null;
  const usingCustomFavicon = !!State.branding.faviconDataUrl;

  el.innerHTML = `
    <div class="admin-head">
      <div>
        <div class="crumbs">${I.t("admin.branding.crumbs")}</div>
        <h1>${I.t("admin.branding.title-html")}</h1>
        <p class="sub" style="max-width:680px">${I.t("admin.branding.sub")}</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:12px">
      <!-- LEFT: Site name editor -->
      <div class="wh-card">
        <h3>${I.t("admin.branding.name.title")}</h3>
        <p style="font-size:12.5px;color:var(--muted);line-height:1.55;margin:0 0 14px">${I.t("admin.branding.name.hint")}</p>
        <input id="brand-name-input" type="text" maxlength="60"
               value="${escapeHtml(currentName)}"
               style="width:100%;padding:11px 13px;font-size:15px;background:var(--bg);border:1px solid var(--line-2);border-radius:8px;color:var(--text);margin-bottom:10px">
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn-primary" onclick="AdminActions.saveBrandName()" style="flex:1"><span>${I.t("admin.branding.name.save")}</span><span class="arr">→</span></button>
          <button class="btn-ghost" onclick="AdminActions.resetBrandName()" title="${I.t("admin.branding.name.reset.title")}">${I.t("admin.branding.name.reset")}</button>
        </div>
        <div style="margin-top:14px;padding:12px 14px;background:rgba(7,93,99,.04);border-radius:8px;font-size:12px;color:var(--muted)">
          <b style="color:var(--text)">${I.t("admin.branding.name.preview")}</b><br>
          <span style="font-size:15px;color:var(--text);font-weight:600;margin-top:4px;display:inline-block">© 2026 ${escapeHtml(currentName)}</span>
        </div>
      </div>

      <!-- RIGHT: Logo upload -->
      <div class="wh-card">
        <h3>${I.t("admin.branding.logo.title")}</h3>
        <p style="font-size:12.5px;color:var(--muted);line-height:1.55;margin:0 0 14px">${I.t("admin.branding.logo.hint")}</p>

        <!-- Current logo preview -->
        <div style="background:#1a1a1a;border:1px solid var(--line);border-radius:9px;padding:18px;text-align:center;margin-bottom:12px;min-height:90px;display:flex;align-items:center;justify-content:center">
          <img src="${currentLogo}" alt="logo preview" style="max-height:60px;max-width:260px;object-fit:contain">
        </div>
        <div style="font-size:11px;font-family:var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);text-align:center;margin-bottom:14px">
          ${usingCustomLogo ? I.t("admin.branding.logo.using.custom") : I.t("admin.branding.logo.using.default")}
        </div>

        <input id="brand-logo-input" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
               style="display:none" onchange="AdminActions.uploadBrandLogo(event)">
        <div style="display:flex;gap:8px">
          <button class="btn-primary" onclick="document.getElementById('brand-logo-input').click()" style="flex:1"><span>${I.t("admin.branding.logo.upload")}</span><span class="arr">→</span></button>
          ${usingCustomLogo ? `<button class="btn-ghost" onclick="AdminActions.resetBrandLogo()" title="${I.t("admin.branding.logo.reset.title")}">${I.t("admin.branding.logo.reset")}</button>` : ""}
        </div>
        <p style="font-size:11px;color:var(--muted);margin-top:10px;text-align:center">
          ${I.t("admin.branding.logo.limits")}
        </p>
      </div>
    </div>

    <!-- Favicon (browser tab icon) — full width row -->
    <div class="wh-card" style="margin-top:20px">
      <h3>${I.t("admin.branding.favicon.title")}</h3>
      <p style="font-size:12.5px;color:var(--muted);line-height:1.55;margin:0 0 16px;max-width:680px">${I.t("admin.branding.favicon.hint")}</p>
      <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
        <!-- Tab preview — mimics a browser tab so admin sees exactly how it looks -->
        <div style="flex-shrink:0">
          <div style="font-size:11px;font-family:var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:8px">${I.t("admin.branding.favicon.preview")}</div>
          <div style="display:inline-flex;align-items:center;gap:8px;background:var(--bg-2);border:1px solid var(--line-2);border-radius:9px 9px 0 0;padding:9px 14px;max-width:230px">
            ${usingCustomFavicon
              ? `<img src="${currentFavicon}" alt="favicon" style="width:18px;height:18px;object-fit:contain;border-radius:3px;flex-shrink:0">`
              : `<span style="width:18px;height:18px;border-radius:3px;background:var(--grad-1-soft);display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:var(--teal-deep);flex-shrink:0">●</span>`}
            <span style="font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(currentName)}</span>
            <span style="color:var(--muted);font-size:14px;flex-shrink:0">✕</span>
          </div>
        </div>
        <!-- Controls -->
        <div style="flex:1;min-width:240px">
          <div style="font-size:11px;font-family:var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:10px">
            ${usingCustomFavicon ? I.t("admin.branding.favicon.using.custom") : I.t("admin.branding.favicon.using.default")}
          </div>
          <input id="brand-favicon-input" type="file" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/webp"
                 style="display:none" onchange="AdminActions.uploadBrandFavicon(event)">
          <div style="display:flex;gap:8px">
            <button class="btn-primary" onclick="document.getElementById('brand-favicon-input').click()"><span>${I.t("admin.branding.favicon.upload")}</span><span class="arr">→</span></button>
            ${usingCustomFavicon ? `<button class="btn-ghost" onclick="AdminActions.resetBrandFavicon()" title="${I.t("admin.branding.favicon.reset.title")}">${I.t("admin.branding.favicon.reset")}</button>` : ""}
          </div>
          <p style="font-size:11px;color:var(--muted);margin-top:10px">${I.t("admin.branding.favicon.limits")}</p>
        </div>
      </div>
    </div>

    ${State.branding.updatedAt ? `
      <div style="margin-top:18px;padding:12px 16px;background:rgba(7,93,99,.04);border-radius:8px;font-size:12px;color:var(--muted)">
        ${I.t("admin.branding.lastUpdated", { date: fmtDate(State.branding.updatedAt), by: escapeHtml(State.branding.updatedBy || "—") })}
      </div>
    ` : ""}
  `;
}

// ============================================================
// DM Champ integration admin panel
// ============================================================
// Loads config/dmchamp on-demand (one-shot read; not realtime). The page
// re-fetches whenever it's opened so admins always see what's saved in
// Firestore. The API key is loaded masked (only first 4 + last 4 chars
// shown); admin must paste a fresh key to replace it.
//
// Save flow goes through Firestore directly (admin role is enforced by
// Firestore Security Rules — same pattern as config/branding).
// ============================================================
// Loads config/dmchamp into State.dmchamp. Idempotent — safe to call from
// multiple admin pages. The Customer Portal also benefits indirectly because
// the credits-earned calculation falls back to State.dmchamp.creditsPerUsd
// when an order doesn't have a per-order snapshot rate.
//
// `force=true` re-reads even if already loaded (used after admin saves new
// config values to refresh other open admin pages).
async function loadDmChampConfig({ force = false } = {}){
  if(State.dmchamp.loaded && !force) return State.dmchamp;
  let cfg = {};
  let brandingDoc = {};
  // Admin-only fields (apiKey, creditsPerUsd, etc.) — may fail for customers
  try {
    const snap = await getDoc(doc(db, "config", "dmchamp"));
    cfg = snap.exists() ? (snap.data() || {}) : {};
  } catch(e) {
    // EXPECTED for customers: config/dmchamp holds the API key so it is
    // admin-read-only. Not an error — the non-secret values we still need
    // (creditsPerUsd) are mirrored into the public config/branding doc below.
    cfg = {};
  }
  // Public read — portalUrl lives here so customer portal can show "Open DM Champ" buttons
  try {
    const bsnap = await getDoc(doc(db, "config", "branding"));
    brandingDoc = bsnap.exists() ? (bsnap.data() || {}) : {};
  } catch(e) {
    console.warn("[dmchamp] config/branding read failed:", e.message || e);
  }
  State.dmchamp.loaded                = true;
  State.dmchamp.configured            = !!(cfg.apiKey);
  State.dmchamp.enabled               = cfg.enabled !== false;
  // creditsPerUsd: admins read the authoritative value from config/dmchamp;
  // customers can't (it's admin-only), so we fall back to the public mirror in
  // config/branding. Without the mirror every customer silently got the
  // default 100 and saw wrong credit numbers on My Account / My Orders.
  State.dmchamp.creditsPerUsd         = Number.isFinite(Number(cfg.creditsPerUsd)) && Number(cfg.creditsPerUsd) > 0
                                          ? Number(cfg.creditsPerUsd)
                                          : (Number.isFinite(Number(brandingDoc.dmchampCreditsPerUsd)) && Number(brandingDoc.dmchampCreditsPerUsd) > 0
                                              ? Number(brandingDoc.dmchampCreditsPerUsd)
                                              : 100);
  State.dmchamp.defaultMonthlyCredits = Number.isFinite(Number(cfg.defaultMonthlyCredits)) ? Number(cfg.defaultMonthlyCredits) : 1000;
  State.dmchamp.rollOverToNextMonth   = !!cfg.rollOverToNextMonth;
  State.dmchamp.timeZoneId            = cfg.timeZoneId || "Asia/Bangkok";
  State.dmchamp.country               = cfg.country    || "TH";
  // portalUrl: prefer config/branding.dmchampPortalUrl (public), fall back to
  // config/dmchamp.portalUrl (backwards compat) and finally to the default.
  const rawPortal = (typeof brandingDoc.dmchampPortalUrl === "string" && brandingDoc.dmchampPortalUrl.trim())
                       ? brandingDoc.dmchampPortalUrl
                       : (typeof cfg.portalUrl === "string" ? cfg.portalUrl : "");
  const cleaned = (rawPortal || "").trim().replace(/\/+$/, "");
  State.dmchamp.portalUrl             = (cleaned && /^https?:\/\//i.test(cleaned))
                                          ? cleaned
                                          : "https://app.dmchamp.com";
  State.dmchamp.updatedAt             = cfg.updatedAt  || null;
  State.dmchamp.updatedBy             = cfg.updatedBy  || null;
  State.dmchamp.apiKeyMasked          = cfg.apiKey ? maskApiKey(cfg.apiKey) : "";
  return State.dmchamp;
}

// Channels offered by the ACTIVE payment gateway, for the checkout pills.
// Cached for the session: the answer only changes when an admin switches
// provider, and checkout shouldn't pay a network round-trip on every render.
// Resolves to [] on any failure so the caller keeps its fallback markup.
let _gwChannelsCache = null;
async function loadActiveGatewayChannels(){
  if(_gwChannelsCache) return _gwChannelsCache;
  try{
    const res = await fetch("/.netlify/functions/create-payment");
    if(!res.ok) return [];
    const diag = await res.json();
    const active = (diag.gateways || []).find(g => g.id === diag.activeGateway);
    _gwChannelsCache = active?.channels || [];
    return _gwChannelsCache;
  }catch(e){
    console.warn("[checkout] could not load gateway channels:", e.message || e);
    return [];
  }
}

// ===========================================================
// ADMIN — PAYMENT GATEWAY (direct/web sales)
// ===========================================================
// Chooses which provider settles NEW direct orders. Only the SELECTION lives
// in Firestore (config/payment.activeGateway) — credentials stay in Netlify
// env vars, since the frontend can read Firestore.
//
// The list of available gateways + whether each one's env vars are present
// comes from the create-payment function's GET diagnostic, so the panel always
// reflects what the server can actually do rather than a hard-coded list.
// ===========================================================
async function loadPaymentGwConfig(){
  // Which gateway is currently selected (Firestore)
  let activeGateway = null;
  try{
    const snap = await getDoc(doc(db,"config","payment"));
    if(snap.exists()) activeGateway = snap.data().activeGateway || null;
  }catch(e){ console.warn("[paymentgw] config read failed:", e); }

  // What the backend supports + env status (server diagnostic)
  let diag = null, diagError = null;
  try{
    const res = await fetch("/.netlify/functions/create-payment");
    if(res.ok) diag = await res.json();
    else diagError = `HTTP ${res.status}`;
  }catch(e){ diagError = String(e.message || e); }

  State.paymentGw = {
    loaded: true,
    activeGateway: activeGateway || diag?.activeGateway || null,
    savedInFirestore: !!activeGateway,
    gateways: diag?.gateways || [],
    diagError
  };
  return State.paymentGw;
}

async function renderAdminPaymentGw(){
  const el = document.getElementById("adm-paymentgw");
  if(!el) return;

  const head = `
    <div class="admin-head">
      <div>
        <div class="crumbs">${I.t("admin.paymentgw.crumbs")}</div>
        <h1>${I.t("admin.paymentgw.title-html")}</h1>
        <p class="sub" style="max-width:720px">${I.t("admin.paymentgw.sub")}</p>
      </div>
    </div>`;

  el.innerHTML = head + `<div style="padding:40px 0;text-align:center;color:var(--muted);font-size:13px">Loading…</div>`;

  const cfg = await loadPaymentGwConfig();

  // Backend unreachable — show the error rather than an empty page.
  if(cfg.diagError && !cfg.gateways.length){
    el.innerHTML = head + `
      <div style="margin-top:14px;padding:14px 16px;background:rgba(200,70,61,.06);border-left:3px solid var(--red);border-radius:6px;font-size:13.5px">
        <strong style="color:var(--red)">●</strong> ${I.t("admin.paymentgw.err.diag")}
        <div style="font-family:var(--mono);font-size:11.5px;color:var(--muted);margin-top:6px">${escapeHtml(cfg.diagError)}</div>
      </div>`;
    return;
  }

  const active = cfg.activeGateway;
  const siteBase = window.location.origin;

  const cards = cfg.gateways.map(g => {
    const isActive = g.id === active;
    const ok = g.configured;
    const statusColor = ok ? "var(--lime)" : "var(--amber)";
    const statusText  = ok ? I.t("admin.paymentgw.state.ready")
                           : I.t("admin.paymentgw.state.missing", { list: (g.missingEnv||[]).join(", ") });
    // Path form, NOT ?gw= — ChillPay and others silently refuse to call a
    // webhook URL containing a query string (the transaction is left "Pending"
    // on their side and nothing arrives). The trailing segment identifies the
    // gateway just as well.
    const callbackUrl = `${siteBase}/.netlify/functions/payment-callback/${g.id}`;
    // Browser-side return after payment. Gateway-independent (it's our own
    // page), so it's the same value for every provider — shown on each card
    // because both URLs must be registered together in the provider dashboard.
    const returnUrl = `${siteBase}/payment-result`;

    const envRows = Object.entries(g.env || {}).map(([k,v]) =>
      `<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid var(--line);font-size:12px">
         <span style="font-family:var(--mono);color:var(--muted)">${escapeHtml(k)}</span>
         <span style="font-family:var(--mono);color:${/NOT SET/.test(String(v)) ? "var(--red)" : "var(--text)"}">${escapeHtml(String(v))}</span>
       </div>`).join("");

    const chips = (g.channels||[]).map(c =>
      `<span style="display:inline-block;padding:3px 9px;margin:0 5px 5px 0;border-radius:999px;background:var(--surface-2);border:1px solid var(--line);font-family:var(--mono);font-size:10px;color:var(--muted)">${escapeHtml(I.t(c.labelKey) || c.code)}</span>`
    ).join("");

    return `
      <div style="border:1.5px solid ${isActive ? "var(--teal)" : "var(--line)"};border-radius:14px;padding:18px 20px;margin-bottom:16px;background:${isActive ? "rgba(11,182,196,.04)" : "var(--surface)"}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:12px">
          <div>
            <div style="font-size:16px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:9px">
              ${escapeHtml(g.displayName)}
              ${isActive ? `<span style="padding:2px 9px;border-radius:999px;background:var(--grad-1);color:#fff;font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase">${I.t("admin.paymentgw.badge.active")}</span>` : ""}
            </div>
            <div style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-top:4px">
              ${escapeHtml(g.id)} · ${escapeHtml(g.currency || "")} · ${escapeHtml(g.mode || "")}
            </div>
          </div>
          ${isActive
            ? `<button class="btn-ghost" disabled style="opacity:.5;cursor:default">${I.t("admin.paymentgw.btn.inuse")}</button>`
            : (ok
                ? `<button class="btn-primary" onclick="AdminActions.setActiveGateway('${escapeHtml(g.id)}')">
                     <span>${I.t("admin.paymentgw.btn.use")}</span><span class="arr">→</span>
                   </button>`
                : `<button class="btn-primary" disabled style="opacity:.45;cursor:not-allowed" title="${escapeHtml(I.t("admin.paymentgw.btn.needenv"))}">
                     <span>${I.t("admin.paymentgw.btn.use")}</span><span class="arr">→</span>
                   </button>`)}
        </div>

        <div style="padding:9px 13px;border-radius:8px;background:${ok ? "rgba(127,169,42,.07)" : "rgba(214,138,28,.07)"};font-size:12.5px;margin-bottom:13px">
          <strong style="color:${statusColor}">●</strong> ${escapeHtml(statusText)}
        </div>

        <div style="font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2);margin-bottom:7px">${I.t("admin.paymentgw.lbl.channels")}</div>
        <div style="margin-bottom:14px">${chips || `<span style="font-size:12px;color:var(--muted)">—</span>`}</div>

        <div style="font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2);margin-bottom:7px">${I.t("admin.paymentgw.lbl.callback")}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
          <code style="flex:1;min-width:260px;font-family:var(--mono);font-size:11px;padding:8px 11px;background:var(--surface-2);border:1px solid var(--line);border-radius:7px;word-break:break-all;color:var(--text-2)">${escapeHtml(callbackUrl)}</code>
          <button class="btn-ghost" style="font-size:12px;padding:7px 13px" data-copy="${escapeHtml(callbackUrl)}" onclick="App.copyFromAttr(this)">${I.t("admin.paymentgw.btn.copy")}</button>
        </div>
        <div style="font-size:11.5px;color:var(--muted);margin-bottom:14px;line-height:1.55">${I.t("admin.paymentgw.hint.callback")}</div>

        <div style="font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2);margin-bottom:7px">${I.t("admin.paymentgw.lbl.returnurl")}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
          <code style="flex:1;min-width:260px;font-family:var(--mono);font-size:11px;padding:8px 11px;background:var(--surface-2);border:1px solid var(--line);border-radius:7px;word-break:break-all;color:var(--text-2)">${escapeHtml(returnUrl)}</code>
          <button class="btn-ghost" style="font-size:12px;padding:7px 13px" data-copy="${escapeHtml(returnUrl)}" onclick="App.copyFromAttr(this)">${I.t("admin.paymentgw.btn.copy")}</button>
        </div>
        <div style="font-size:11.5px;color:var(--muted);margin-bottom:14px;line-height:1.55">${I.t("admin.paymentgw.hint.returnurl")}</div>

        <details>
          <summary style="cursor:pointer;font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-2)">${I.t("admin.paymentgw.lbl.env")}</summary>
          <div style="margin-top:9px">${envRows || "—"}</div>
        </details>
      </div>`;
  }).join("");

  el.innerHTML = head + `
    <div style="margin:12px 0 20px;padding:13px 16px;background:rgba(11,182,196,.06);border-left:3px solid var(--teal);border-radius:6px;font-size:13px;line-height:1.65">
      ${I.t("admin.paymentgw.note-html")}
    </div>
    ${!cfg.savedInFirestore ? `
      <div style="margin-bottom:18px;padding:11px 15px;background:rgba(214,138,28,.07);border-left:3px solid var(--amber);border-radius:6px;font-size:12.5px">
        <strong style="color:var(--amber)">●</strong> ${I.t("admin.paymentgw.note.default")}
      </div>` : ""}
    ${cards || `<div class="empty-state">${I.t("admin.paymentgw.empty")}</div>`}
  `;
}

async function renderAdminDmChamp(){
  const el = document.getElementById("adm-dmchamp");
  if(!el) return;

  // Initial loading skeleton
  el.innerHTML = `
    <div class="admin-head">
      <div>
        <div class="crumbs">${I.t("admin.dmchamp.crumbs")}</div>
        <h1>${I.t("admin.dmchamp.title-html")}</h1>
        <p class="sub" style="max-width:680px">${I.t("admin.dmchamp.sub")}</p>
      </div>
    </div>
    <div style="padding:40px 0;text-align:center;color:var(--muted);font-size:13px">Loading…</div>
  `;

  // Pull config via shared loader (force=true so we always show the latest
  // even if the admin just saved new values on another tab).
  await loadDmChampConfig({ force: true });

  const d = State.dmchamp;

  // Status banner colour
  let statusKey, statusBg, statusColor;
  if(!d.configured){
    statusKey = "admin.dmchamp.status.missing"; statusBg = "rgba(214,138,28,.08)"; statusColor = "var(--amber)";
  } else if(!d.enabled){
    statusKey = "admin.dmchamp.status.disabled"; statusBg = "rgba(120,120,120,.08)"; statusColor = "var(--muted)";
  } else {
    statusKey = "admin.dmchamp.status.configured"; statusBg = "rgba(127,169,42,.08)"; statusColor = "var(--green)";
  }

  // Conversion preview table — show common purchase amounts
  const previewAmounts = [5, 10, 20, 50, 100];
  const previewRows = previewAmounts.map(amt => {
    const credits = Math.max(1, Math.round(amt * d.creditsPerUsd));
    return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line);font-size:13px">
      <span style="font-family:var(--mono);color:var(--muted)">$${amt}</span>
      <span style="font-weight:600;color:var(--teal-deep)">${credits.toLocaleString()}</span>
    </div>`;
  }).join("");

  el.innerHTML = `
    <div class="admin-head">
      <div>
        <div class="crumbs">${I.t("admin.dmchamp.crumbs")}</div>
        <h1>${I.t("admin.dmchamp.title-html")}</h1>
        <p class="sub" style="max-width:680px">${I.t("admin.dmchamp.sub")}</p>
      </div>
    </div>

    <!-- Status banner -->
    <div style="margin:12px 0 22px 0;padding:12px 16px;background:${statusBg};border-left:3px solid ${statusColor};border-radius:6px;font-size:13.5px;color:var(--text);display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
      <span><strong style="color:${statusColor}">●</strong> ${I.t(statusKey)}</span>
      <a href="${escapeHtml(d.portalUrl || "https://app.dmchamp.com")}" target="_blank" rel="noopener"
         class="btn-ghost" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none;white-space:nowrap;font-size:13px;padding:7px 14px">
        <span>${I.t("admin.dmchamp.openPortal")}</span><span class="arr">↗</span>
      </a>
    </div>

    <div style="display:flex;flex-direction:column;gap:20px;max-width:760px">
      <!-- TOP: settings form (always full width — friendlier on mobile) -->
      <div class="wh-card">
        <h3>${I.t("admin.dmchamp.apiKey")}</h3>
        <p style="font-size:12.5px;color:var(--muted);line-height:1.55;margin:0 0 10px">${I.t("admin.dmchamp.apiKey.hint")}</p>
        ${d.apiKeyMasked ? `
        <div style="font-family:var(--mono);font-size:12px;color:var(--muted);margin-bottom:8px">${I.t("admin.dmchamp.apiKey.masked", { masked: d.apiKeyMasked })}</div>
        ` : ""}
        <input id="dm-apikey" type="password" autocomplete="off" placeholder="${I.t("admin.dmchamp.apiKey.placeholder")}"
               style="width:100%;padding:11px 13px;font-size:14px;background:var(--bg);border:1px solid var(--line-2);border-radius:8px;color:var(--text);margin-bottom:18px;font-family:var(--mono)">

        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500">
            <input id="dm-enabled" type="checkbox" ${d.enabled ? "checked" : ""} style="width:16px;height:16px;cursor:pointer">
            <span>${I.t("admin.dmchamp.enabled")}</span>
          </label>
        </div>
        <p style="font-size:12px;color:var(--muted);margin:0 0 18px 24px">${I.t("admin.dmchamp.enabled.hint")}</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="field">
            <label>${I.t("admin.dmchamp.creditsPerUsd")}</label>
            <input id="dm-rate" type="number" min="1" step="1" value="${d.creditsPerUsd}" oninput="AdminActions.dmchampPreviewRefresh()"
                   style="width:100%;padding:10px 12px;font-size:14px;background:var(--bg);border:1px solid var(--line-2);border-radius:8px">
            <p style="font-size:11.5px;color:var(--muted);margin:4px 0 0">${I.t("admin.dmchamp.creditsPerUsd.hint")}</p>
          </div>
          <div class="field">
            <label>${I.t("admin.dmchamp.defaultCredits")}</label>
            <input id="dm-default" type="number" min="1" step="1" value="${d.defaultMonthlyCredits}"
                   style="width:100%;padding:10px 12px;font-size:14px;background:var(--bg);border:1px solid var(--line-2);border-radius:8px">
            <p style="font-size:11.5px;color:var(--muted);margin:4px 0 0">${I.t("admin.dmchamp.defaultCredits.hint")}</p>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:10px;margin-top:18px;margin-bottom:6px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500">
            <input id="dm-rollover" type="checkbox" ${d.rollOverToNextMonth ? "checked" : ""} style="width:16px;height:16px;cursor:pointer">
            <span>${I.t("admin.dmchamp.rollover")}</span>
          </label>
        </div>
        <p style="font-size:12px;color:var(--muted);margin:0 0 18px 24px">${I.t("admin.dmchamp.rollover.hint")}</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:22px">
          <div class="field">
            <label>${I.t("admin.dmchamp.timezone")}</label>
            <input id="dm-tz" type="text" value="${escapeHtml(d.timeZoneId)}"
                   style="width:100%;padding:10px 12px;font-size:14px;background:var(--bg);border:1px solid var(--line-2);border-radius:8px;font-family:var(--mono)">
          </div>
          <div class="field">
            <label>${I.t("admin.dmchamp.country")}</label>
            <input id="dm-country" type="text" maxlength="2" value="${escapeHtml(d.country)}"
                   style="width:100%;padding:10px 12px;font-size:14px;background:var(--bg);border:1px solid var(--line-2);border-radius:8px;text-transform:uppercase;font-family:var(--mono)">
          </div>
        </div>

        <div class="field" style="margin-bottom:22px">
          <label>${I.t("admin.dmchamp.portalUrl")}</label>
          <input id="dm-portalurl" type="url"
                 value="${escapeHtml(d.portalUrl || "https://app.dmchamp.com")}"
                 placeholder="https://app.dmchamp.com"
                 style="width:100%;padding:10px 12px;font-size:14px;background:var(--bg);border:1px solid var(--line-2);border-radius:8px;font-family:var(--mono)">
          <p style="font-size:11.5px;color:var(--muted);margin:4px 0 0">${I.t("admin.dmchamp.portalUrl.hint")}</p>
        </div>

        <button class="btn-primary" onclick="AdminActions.saveDmChampConfig()" style="width:100%">
          <span>${I.t("admin.dmchamp.save")}</span><span class="arr">→</span>
        </button>

        ${d.updatedAt ? `
        <div style="margin-top:14px;padding:10px 14px;background:rgba(7,93,99,.04);border-radius:8px;font-size:12px;color:var(--muted)">
          ${I.t("admin.branding.lastUpdated", { date: fmtDate(d.updatedAt), by: escapeHtml(d.updatedBy || "—") })}
        </div>
        ` : ""}
      </div>

      <!-- BOTTOM: conversion preview (below the settings card) -->
      <div class="wh-card">
        <h3>${I.t("admin.dmchamp.preview")}</h3>
        <p style="font-size:12px;color:var(--muted);margin:0 0 14px">$1 = <span id="dm-rate-echo" style="color:var(--teal-deep);font-weight:600">${d.creditsPerUsd}</span> credits</p>
        <div id="dm-preview-rows">${previewRows}</div>
      </div>
    </div>
  `;
}

// Mask an API key for display: first 4 chars + ••• + last 4 chars
function maskApiKey(key){
  if(!key || typeof key !== "string") return "";
  const k = key.trim();
  if(k.length <= 10) return "•".repeat(Math.max(0, k.length - 2)) + k.slice(-2);
  return `${k.slice(0,4)}${"•".repeat(8)}${k.slice(-4)}`;
}

function renderAdminPassword(){
  const el = document.getElementById("adm-password");
  if(!el) return;
  el.innerHTML = `
    <div class="admin-head">
      <div>
        <div class="crumbs">Console / Account</div>
        <h1>${I.t("admin.password.title-html")}</h1>
      </div>
    </div>
    <div style="max-width:520px">
      <div class="panel" style="padding:28px">
        <div class="field" style="margin-bottom:16px"><label>${I.t("admin.password.current")}</label><input id="pw-curr" type="password" /></div>
        <div class="field" style="margin-bottom:16px"><label>${I.t("admin.password.new")}</label><input id="pw-new" type="password" /></div>
        <div class="field" style="margin-bottom:22px"><label>${I.t("admin.password.confirm")}</label><input id="pw-conf" type="password" /></div>
        <button class="btn-primary" onclick="AdminActions.changePassword()"><span>${I.t("admin.password.cta")}</span><span class="arr">→</span></button>
      </div>
    </div>
  `;
}

// ===========================================================
// ADMIN ACTIONS
// ===========================================================
const AdminActions = {
  // ===== ORDERS: date + source filters + CSV export =====
  setOrderDateFilter(mode){
    State.orderDateFilter = mode;
    // Reset period dates when leaving period mode (so toggle back-and-forth is clean)
    if(mode !== "period"){
      State.orderPeriodStart = null;
      State.orderPeriodEnd = null;
    }
    renderAdminOrders();
  },

  setOrderSourceFilter(src){
    // Legacy: callers may pass "chillpay"; normalize to "direct" since we
    // collapsed the two sources in the UI.
    if(src === "chillpay") src = "direct";
    State.orderSourceFilter = src;
    renderAdminOrders();
  },

  // Partner / PayGW dropdown filters for Admin → Orders. Exact code match,
  // affect both the table and the CSV export (both read getFilteredOrders).
  setOrderPartnerFilter(code){
    State.orderPartnerFilter = String(code || "");
    renderAdminOrders();
  },
  setOrderPaygwFilter(code){
    State.orderPaygwFilter = String(code || "");
    renderAdminOrders();
  },
  setOrderCurrencyFilter(code){
    State.orderCurrencyFilter = String(code || "");
    renderAdminOrders();
  },

  // Email filter for Admin → Orders. Debounced so typing doesn't trigger
  // a re-render (and DOM throw-away of the input) on every keystroke —
  // which would also blur the input and lose focus.
  //
  // Behaviour:
  //   - oninput → setOrderEmailFilter(value)
  //   - We store the value immediately so it's reflected in State (and
  //     in getFilteredOrders → CSV export uses the latest value too).
  //   - We debounce the re-render by ~180ms; if the user clears the
  //     filter (empty string) we re-render immediately for snappy feedback.
  setOrderEmailFilter(value){
    State.orderEmailFilter = String(value || "");
    if(this._emailFilterTimer){
      clearTimeout(this._emailFilterTimer);
      this._emailFilterTimer = null;
    }
    const render = () => {
      // Preserve the focused input across re-renders. After renderAdminOrders
      // re-builds the DOM, find the input again and restore caret position.
      const prev = document.getElementById("orders-email-filter-input");
      const hadFocus = prev && document.activeElement === prev;
      const caret = prev ? prev.selectionStart : null;
      renderAdminOrders();
      if(hadFocus){
        const next = document.getElementById("orders-email-filter-input");
        if(next){
          next.focus();
          if(caret !== null){
            try { next.setSelectionRange(caret, caret); } catch(e) { /* ignore */ }
          }
        }
      }
    };
    if(State.orderEmailFilter === ""){
      render();
    } else {
      this._emailFilterTimer = setTimeout(render, 180);
    }
  },

  openPeriodPicker(){
    // Pre-fill with current period if set, otherwise first day of current month → today
    const now = new Date();
    const defStart = State.orderPeriodStart || new Date(now.getFullYear(), now.getMonth(), 1);
    const defEnd   = State.orderPeriodEnd   || now;
    const fmt = (d) => d.toISOString().slice(0,10);

    App.showModal(`
      <button class="close" onclick="App.closeModal()">×</button>
      <h2>${I.t("admin.orders.period.title-html")}</h2>
      <div class="sub">${I.t("admin.orders.h")}</div>
      <div class="user-form-grid">
        <div class="field">
          <label>${I.t("admin.orders.period.start")}</label>
          <input type="date" id="period-start" value="${fmt(defStart)}" />
        </div>
        <div class="field">
          <label>${I.t("admin.orders.period.end")}</label>
          <input type="date" id="period-end" value="${fmt(defEnd)}" />
        </div>
      </div>
      <button class="btn-primary" onclick="AdminActions.applyPeriod()" style="margin-top:18px;width:100%;justify-content:center">
        <span>${I.t("admin.orders.period.apply")}</span><span class="arr">→</span>
      </button>
    `);
  },

  applyPeriod(){
    const startStr = document.getElementById("period-start").value;
    const endStr   = document.getElementById("period-end").value;
    if(!startStr || !endStr) return Toast.show("Please pick both start and end dates","err");

    const start = new Date(startStr + "T00:00:00");
    const end   = new Date(endStr   + "T23:59:59.999");
    if(isNaN(start.getTime()) || isNaN(end.getTime())) return Toast.show("Invalid dates","err");
    if(start > end) return Toast.show("Start date must be before end date","err");

    State.orderPeriodStart = start;
    State.orderPeriodEnd = end;
    State.orderDateFilter = "period";
    App.closeModal();
    renderAdminOrders();
  },

  exportOrdersCSV(){
    const list = getFilteredOrders();
    if(list.length === 0){
      return Toast.show(I.t("admin.orders.export.empty"),"warn");
    }

    // Escape a single CSV cell — wrap in quotes and double any internal quotes
    const esc = (v) => {
      if(v === null || v === undefined) return "";
      const s = String(v);
      // Always quote to be safe with commas/newlines/Thai characters
      return `"${s.replace(/"/g, '""')}"`;
    };

    const headers = [
      "Reference","Source","Gateway","Status / Event","Customer Name","Customer Email","Country",
      "Partner Code","Partner Company","PayGW Code","PayGW Company",
      "Items","Currency","Amount (Original)","Amount (USD)","VAT (USD)","Total (USD)","Credits Earned","Transaction ID","Created At (ISO)"
    ];

    const rows = list.map(o => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      const dateIso = (d && !isNaN(d.getTime())) ? d.toISOString() : "";
      const items = (o.items||[]).map(i => `${i.title}${i.manual?` ($${i.price})`:""}`).join(" + ");
      // Credits earned: subtotal × per-order rate (same formula as the
      // Customer Portal and Admin Orders table). Counted for orders that earn
      // credits (paid / Partial Refund). Empty otherwise so accounting tools
      // don't double-count refunds/fails.
      let creditsEarned = "";
      const earnsCredits = o.status === "paid" || o.event === "Paid" || o.event === "Partial Refund";
      if(earnsCredits){
        const subUsd = Number.isFinite(Number(o.amountUsd)) && Number(o.amountUsd) > 0
          ? Number(o.amountUsd)
          : (Number.isFinite(Number(o.subtotal)) && Number(o.subtotal) > 0 ? Number(o.subtotal) : Number(o.total) || 0);
        const sub = o.dmchampSubAccount || null;
        const orderRate = Number(sub && sub.creditsPerUsd);
        const fallbackRate = (State.dmchamp && Number(State.dmchamp.creditsPerUsd)) || 100;
        const rate = Number.isFinite(orderRate) && orderRate > 0 ? orderRate : fallbackRate;
        if(subUsd > 0) creditsEarned = Math.max(1, Math.round(subUsd * rate));
      }
      // Partner / PayGW — code from the order + resolved company name from the
      // admin reference lists. Only ontheline orders carry these. Note: the
      // customer email here is the raw stored value (NO Zero-Width Space —
      // ZWSP is only injected at Resend send-time, never persisted or exported).
      const pName = (State.onthelinePartners || []).find(p => (p.code||"").toLowerCase() === (o.partner||"").toLowerCase());
      const gName = (State.onthelinePaygw || []).find(g => (g.code||"").toLowerCase() === (o.paygw||"").toLowerCase());
      // Status/Event column: ontheline shows the event; others show status.
      const statusOrEvent = (o.source === "ontheline" && o.event) ? o.event : o.status;
      // Original-currency amount (ontheline) vs USD. amountUsd is what credit
      // math uses; amountOriginal is the figure ontheline actually sent.
      const amountOriginal = Number.isFinite(Number(o.amountOriginal)) ? Number(o.amountOriginal)
                            : (Number.isFinite(Number(o.subtotal)) ? Number(o.subtotal) : "");
      const amountUsd = Number.isFinite(Number(o.amountUsd)) ? Number(o.amountUsd)
                       : (Number.isFinite(Number(o.subtotal)) ? Number(o.subtotal) : "");
      // Which payment gateway settled this order. Direct sales carry it
      // explicitly; legacy orders predate the field and were all ChillPay.
      // ontheline orders settle outside DealMai, so the column stays empty.
      const gatewayId = o.gateway
        || ((o.source === "chillpay" || o.chillpayOrderNo) ? "chillpay" : "");
      return [
        o.ref, o.source, gatewayId, statusOrEvent,
        o.customer?.name || "", o.customer?.email || "", o.customer?.country || "",
        o.partner || "", pName ? pName.companyName : "",
        o.paygw || "", gName ? gName.companyName : "",
        items,
        o.currency || "USD",
        amountOriginal, amountUsd,
        o.vat ?? "", o.total ?? "",
        creditsEarned,
        o.transactionId || "",
        dateIso
      ].map(esc).join(",");
    });

    // BOM prefix for Excel UTF-8 compatibility (so Thai characters show correctly)
    const csv = "\uFEFF" + headers.map(esc).join(",") + "\n" + rows.join("\n");

    // Build filename based on current filter
    const tsPart = new Date().toISOString().slice(0,10);
    const now = new Date();
    let scopePart;
    if(State.orderDateFilter === "today"){
      scopePart = `today_${tsPart}`;
    }else if(State.orderDateFilter === "yesterday"){
      const y = new Date(now); y.setDate(y.getDate()-1);
      scopePart = `yesterday_${y.toISOString().slice(0,10)}`;
    }else if(State.orderDateFilter === "month"){
      scopePart = `month_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    }else if(State.orderDateFilter === "lastMonth"){
      const lm = new Date(now.getFullYear(), now.getMonth()-1, 1);
      scopePart = `lastmonth_${lm.getFullYear()}-${String(lm.getMonth()+1).padStart(2,"0")}`;
    }else{
      const s = State.orderPeriodStart, e = State.orderPeriodEnd;
      scopePart = `period_${s.toISOString().slice(0,10)}_to_${e.toISOString().slice(0,10)}`;
    }
    if(State.orderSourceFilter !== "all") scopePart += `_${State.orderSourceFilter}`;
    if(State.orderPartnerFilter) scopePart += `_p-${State.orderPartnerFilter}`;
    if(State.orderPaygwFilter) scopePart += `_g-${State.orderPaygwFilter}`;
    if(State.orderCurrencyFilter) scopePart += `_${State.orderCurrencyFilter}`;
    const filename = `dealpro_orders_${scopePart}.csv`;

    // Trigger browser download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    Toast.show(I.t("admin.orders.export.done", { count: list.length }),"ok");
  },

  // Legacy method — kept for backwards compatibility if anything still calls it.
  // The new UI uses setOrderSourceFilter() instead.
  filterOrders(btn, kind){
    this.setOrderSourceFilter(kind);
  },

  viewOrder(id){
    const o = State.orders.find(x => x.id === id);
    if(!o) return;
    const items = (o.items||[]).map(i => `
      <tr><td>${escapeHtml(i.title)}${i.manual?` <span style="color:#888">(Manual)</span>`:""}</td><td>${fmtMoney(i.price)}</td></tr>
    `).join("");

    // Payment-gateway diagnostics — shown for any gateway-settled (direct)
    // order. Helps debug missing-callback / status discrepancies by showing
    // the raw callback payload and the key settlement fields.
    //
    // Reads the gateway-neutral fields first and falls back to the legacy
    // chillpay* names, so orders created before the multi-gateway refactor
    // still render. `gatewayData` holds whatever the provider's adapter chose
    // to keep — we display it generically rather than assuming ChillPay's
    // field names.
    let chillpayBlock = "";
    const gwIdForOrder = o.gateway
      || ((o.source === "chillpay" || o.chillpayOrderNo) ? "chillpay" : null);
    if(gwIdForOrder && o.source !== "ontheline"){
      const gd = o.gatewayData || {};
      const rawCallback = o.gatewayRawCallback || o.chillpayRawCallback;
      const rawCallbackText = rawCallback
        ? JSON.stringify(rawCallback, null, 2)
        : "(no callback received yet — Firestore field is empty/missing)";
      const callbackBg = rawCallback ? "rgba(127,169,42,.05)" : "rgba(214,138,28,.06)";
      const callbackBorder = rawCallback ? "rgba(127,169,42,.3)" : "rgba(214,138,28,.4)";
      const expiresAt = toExpiryDate(o.expiresAt);

      const orderNo    = o.gatewayOrderNo  || o.chillpayOrderNo || "—";
      const txId       = o.gatewayRef      || gd.transactionId || o.chillpayTransactionId || "—";
      const rawStatus  = o.gatewayStatus ?? o.chillpayPaymentStatus ?? "—";
      const bankRef    = gd.bankRefCode    || o.chillpayBankRefCode || "—";
      const bankCode   = gd.bankCode       || o.chillpayBankCode || "—";
      const channel    = gd.channelCode    || o.chillpayChannelCode || o.paymentChannel || "—";
      const payDate    = gd.paymentDate    || o.chillpayPaymentDate || "—";
      const settled    = Number.isFinite(Number(o.gatewayAmount)) ? Number(o.gatewayAmount)
                       : (Number.isFinite(Number(o.chillpayAmount)) ? Number(o.chillpayAmount) : null);
      const settledCur = o.gatewayCurrency || o.chillpayCurrency || "";

      chillpayBlock = `
        <div style="margin-top:18px;padding:14px 16px;background:rgba(7,93,99,.04);border:1px solid var(--line);border-radius:9px">
          <h3 style="margin:0 0 12px;font-size:13px;font-family:var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--teal-deep)">
            Payment Gateway Diagnostics
            <span style="margin-left:8px;padding:2px 8px;border-radius:999px;background:var(--surface-2);border:1px solid var(--line);font-size:9.5px;color:var(--muted);letter-spacing:.06em">${escapeHtml(gwIdForOrder)}</span>
          </h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;font-size:12.5px">
            <div><span style="color:var(--muted)">Order No:</span> <span style="font-family:var(--mono)">${escapeHtml(String(orderNo))}</span></div>
            <div><span style="color:var(--muted)">Transaction Id:</span> <span style="font-family:var(--mono)">${escapeHtml(String(txId))}</span></div>
            <div><span style="color:var(--muted)">Gateway status:</span> <span style="font-family:var(--mono)">${escapeHtml(String(rawStatus))}</span></div>
            <div><span style="color:var(--muted)">Bank ref:</span> <span style="font-family:var(--mono)">${escapeHtml(String(bankRef))}</span></div>
            <div><span style="color:var(--muted)">Bank code:</span> <span style="font-family:var(--mono)">${escapeHtml(String(bankCode))}</span></div>
            <div><span style="color:var(--muted)">Channel:</span> <span style="font-family:var(--mono)">${escapeHtml(String(channel))}</span></div>
            <div><span style="color:var(--muted)">Payment date:</span> <span style="font-family:var(--mono)">${escapeHtml(String(payDate))}</span></div>
            <div><span style="color:var(--muted)">PaidAt:</span> ${o.paidAt ? fmtDate(o.paidAt) : "<span style='color:var(--muted)'>—</span>"}</div>
            <div><span style="color:var(--muted)">ExpiresAt:</span> ${expiresAt ? fmtDateOnly(expiresAt) : "<span style='color:var(--muted)'>— (no expiry)</span>"}</div>
            <div><span style="color:var(--muted)">Settled amount:</span> <span style="font-family:var(--mono)">${settled !== null ? escapeHtml(String(settled)) + (settledCur ? " " + escapeHtml(String(settledCur)) : "") : "—"}</span></div>
          </div>
          <div style="font-size:11px;font-family:var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:6px">raw callback</div>
          <pre style="background:${callbackBg};border:1px solid ${callbackBorder};padding:12px 14px;border-radius:7px;font-size:11.5px;font-family:var(--mono);line-height:1.5;max-height:280px;overflow:auto;margin:0;white-space:pre-wrap;word-break:break-all">${escapeHtml(rawCallbackText)}</pre>
          ${!rawCallback ? `<div style="font-size:11.5px;color:var(--amber);margin-top:8px;font-style:italic">⚠ The order has no callback payload stored. The status may have been set manually via "Mark Paid", or the callback arrived but failed to save (check Netlify Function logs).</div>` : ""}
        </div>
      `;
    }

    // DM Champ sub-account section — shown for every PAID order regardless of
    // source (chillpay, ontheline, etc) since provisioning runs on all of them.
    // Three states: created (green), failed (red + retry button), absent (amber + provision button)
    let dmchampBlock = "";
    if(o.status === "paid"){
      const sub = o.dmchampSubAccount || null;
      const subStatus = sub?.status || null;

      let bodyHtml, actionBtn;
      if(subStatus === "created"){
        const credits = Number.isFinite(Number(sub.monthlyCredits)) ? Number(sub.monthlyCredits).toLocaleString() : "—";

        // Helper: a labeled field that wraps cleanly even for long opaque strings
        // (UIDs, JWT-style tempPasswords). The value uses word-break:break-all so
        // it stays inside the card on narrow screens, and an optional copy button
        // makes the long string useful without selecting by hand.
        //
        // Copy button: we store the raw value in a data-* attribute (HTML-escaped)
        // and call App.copyFromAttr(el) — NOT inline JSON.stringify(), because
        // the value may contain " or ' chars that break the onclick attribute.
        const field = (label, value, opts = {}) => {
          if(value === null || value === undefined || value === "") {
            return `
              <div style="min-width:0">
                <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">${label}</div>
                <div style="color:var(--muted);font-size:12.5px">—</div>
              </div>
            `;
          }
          const valStr = String(value);
          const color = opts.color || "var(--text)";
          const mono  = opts.mono !== false;
          const copyBtn = opts.copy
            ? `<button type="button" data-copy="${escapeHtml(valStr)}" onclick="App.copyFromAttr(this)" style="font-size:10.5px;padding:2px 8px;border:1px solid var(--line-2);background:var(--bg);border-radius:4px;color:var(--muted);cursor:pointer;flex-shrink:0;font-family:var(--kanit)">Copy</button>`
            : "";
          return `
            <div style="min-width:0">
              <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">${label}</div>
              <div style="display:flex;gap:6px;align-items:flex-start">
                <div style="${mono ? "font-family:var(--mono);" : ""}font-size:12.5px;color:${color};font-weight:${opts.bold ? 600 : 400};word-break:break-all;overflow-wrap:anywhere;flex:1;min-width:0;line-height:1.5">${escapeHtml(valStr)}</div>
                ${copyBtn}
              </div>
            </div>
          `;
        };

        bodyHtml = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px 16px">
            ${field("Email", sub.email)}
            ${field("UID", sub.uid, { copy: true })}
            ${field("Monthly Credits", credits, { color: "var(--teal-deep)", bold: true })}
            ${field("Source", sub.source || "auto")}
            ${field("Created", sub.createdAt ? fmtDate(sub.createdAt) : null, { mono: false })}
            ${sub.tempPassword ? field("Temp Password", sub.tempPassword, { color: "var(--magenta)", bold: true, copy: true }) : ""}
          </div>
        `;
        actionBtn = `<button class="btn-ghost" onclick="AdminActions.retryDmChampForOrder('${escapeHtml(o.ref)}','${escapeHtml(o.id)}')" style="margin-top:14px;font-size:12px">Re-provision (force new sub-account)</button>`;
      } else if(subStatus === "topped_up"){
        // Two sub-cases:
        //   (a) ontheline order (sub.source === 'ontheline') — Deal Pro never
        //       called the DM Champ API; credits were recorded for display only
        //       because ontheline manages DM Champ on its own side. Show JUST
        //       the "Topped up by N credits" line, nothing else.
        //   (b) chillpay/direct repeat purchase — credits were actually granted
        //       via the Grant Credits API; show the fuller detail (email, uid,
        //       grant date, retry button).
        const granted = Number.isFinite(Number(sub.creditsGranted)) ? Number(sub.creditsGranted).toLocaleString() : "—";
        const isOntheline = sub.source === "ontheline";
        if(isOntheline){
          // Minimal display — credits only, no API-related fields or retry.
          bodyHtml = `
            <div style="font-size:13.5px;color:var(--teal-deep);font-weight:600">✓ ${I.t("admin.orders.view.credits.topup", { credits: granted })}</div>
          `;
          actionBtn = "";   // no retry — there's nothing to retry (no API call is ever made)
        } else {
          // Repeat-purchase top-up via the Grant Credits API.
          bodyHtml = `
            <div style="font-size:13.5px;color:var(--teal-deep);font-weight:600;margin-bottom:6px">✓ ${I.t("admin.orders.view.credits.topup", { credits: granted })}</div>
            <div style="font-size:12.5px;color:var(--muted);margin-bottom:10px;line-height:1.5">${I.t("admin.orders.view.dmchamp.linkedNote")}</div>
            <div style="font-size:12.5px;display:flex;flex-wrap:wrap;gap:14px">
              <div><span style="color:var(--muted)">Email:</span> <span style="font-family:var(--mono)">${escapeHtml(sub.email || "—")}</span></div>
              ${sub.uid ? `<div><span style="color:var(--muted)">UID:</span> <span style="font-family:var(--mono);word-break:break-all">${escapeHtml(sub.uid)}</span></div>` : ""}
              ${sub.newBalance != null ? `<div><span style="color:var(--muted)">New balance:</span> ${Number(sub.newBalance).toLocaleString()}</div>` : ""}
              <div><span style="color:var(--muted)">Granted:</span> ${sub.createdAt ? fmtDate(sub.createdAt) : "—"}</div>
            </div>
          `;
          actionBtn = `<button class="btn-ghost" onclick="AdminActions.retryDmChampForOrder('${escapeHtml(o.ref)}','${escapeHtml(o.id)}')" style="margin-top:10px;font-size:12px">Re-run grant (in case it was reverted)</button>`;
        }
      } else if(subStatus === "linked"){
        // Linked: customer already had a DM Champ account with this email,
        // but the automated top-up failed (or wasn't attempted in legacy code).
        // Admin must grant credits manually via DM Champ dashboard.
        bodyHtml = `
          <div style="font-size:13.5px;color:var(--amber);font-weight:600;margin-bottom:6px">⚠ ${I.t("admin.orders.view.credits.linked")}</div>
          <div style="font-size:12.5px;color:var(--muted);margin-bottom:10px;line-height:1.5">${I.t("admin.orders.view.dmchamp.linkedNote")}</div>
          <div style="font-size:12.5px;display:flex;flex-wrap:wrap;gap:14px">
            <div><span style="color:var(--muted)">Email:</span> <span style="font-family:var(--mono)">${escapeHtml(sub.email || "—")}</span></div>
            <div><span style="color:var(--muted)">Linked:</span> ${sub.createdAt ? fmtDate(sub.createdAt) : "<span style='color:var(--muted)'>—</span>"}</div>
          </div>
        `;
        actionBtn = `<button class="btn-ghost" onclick="AdminActions.retryDmChampForOrder('${escapeHtml(o.ref)}','${escapeHtml(o.id)}')" style="margin-top:10px;font-size:12px">Retry top-up</button>`;
      } else if(subStatus === "failed"){
        bodyHtml = `
          <div style="font-size:13px;color:var(--red);margin-bottom:6px">${I.t("admin.orders.view.dmchamp.lastError", { error: escapeHtml(sub.error || "Unknown error") })}</div>
          <div style="font-size:12px;color:var(--muted)">Attempts: ${sub.attempts || 1} · Last try: ${sub.lastAttemptAt ? fmtDate(sub.lastAttemptAt) : "—"}</div>
        `;
        actionBtn = `<button class="btn-primary" onclick="AdminActions.retryDmChampForOrder('${escapeHtml(o.ref)}','${escapeHtml(o.id)}')" style="margin-top:10px"><span>${I.t("admin.orders.view.dmchamp.retry")}</span><span class="arr">→</span></button>`;
      } else {
        bodyHtml = `<div style="font-size:13px;color:var(--muted);margin-bottom:6px">${I.t("admin.orders.view.dmchamp.notProvisioned")}</div>`;
        actionBtn = `<button class="btn-primary" onclick="AdminActions.retryDmChampForOrder('${escapeHtml(o.ref)}','${escapeHtml(o.id)}')" style="margin-top:10px"><span>${I.t("admin.orders.view.dmchamp.provision")}</span><span class="arr">→</span></button>`;
      }

      const accentColor = subStatus === "created"   ? "var(--green)"
                       : subStatus === "topped_up" ? "var(--teal-deep)"
                       : subStatus === "linked"    ? "var(--amber)"
                       : subStatus === "failed"    ? "var(--red)"
                       : "var(--amber)";

      // ---- Credits Earned summary block ----
      // Shown for every PAID order regardless of dmchamp status. Calculates
      // from subtotal × creditsPerUsd (using the snapshot rate stored on
      // dmchampSubAccount if available, falling back to current admin config).
      // Note clarifies that this is the amount granted by THIS order; live
      // remaining balance is in the DM Champ Portal.
      const subUsdForOrder = Number.isFinite(Number(o.subtotal)) && Number(o.subtotal) > 0
        ? Number(o.subtotal)
        : Number(o.total) || 0;
      const orderRate = Number(sub && sub.creditsPerUsd);
      const fallbackRate = (State.dmchamp && Number(State.dmchamp.creditsPerUsd)) || 100;
      const rateUsed = Number.isFinite(orderRate) && orderRate > 0 ? orderRate : fallbackRate;
      const creditsForOrder = subUsdForOrder > 0
        ? Math.max(1, Math.round(subUsdForOrder * rateUsed))
        : 0;
      // For ontheline orders we suppress the detailed "Credits Earned" formula
      // block (it describes a DM Champ API grant that never happened for
      // ontheline). The single "✓ Topped up by N credits" line inside the
      // DM Champ Sub-Account block below is all the user wants to see.
      const isOnthelineOrder = (sub && sub.source === "ontheline");
      const creditsBlock = (creditsForOrder > 0 && !isOnthelineOrder) ? `
        <div style="margin-top:14px;padding:14px 16px;background:rgba(11,182,196,0.04);border:1px solid var(--line);border-radius:9px;border-left:3px solid var(--teal-deep)">
          <h3 style="margin:0 0 10px;font-size:13px;font-family:var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--teal-deep)">${I.t("admin.orders.view.credits.label")}</h3>
          <div style="font-size:22px;font-weight:600;color:var(--teal-deep);letter-spacing:-0.01em;margin-bottom:4px">${creditsForOrder.toLocaleString()}</div>
          <div style="font-size:11.5px;color:var(--muted);font-family:var(--mono);letter-spacing:.04em;margin-bottom:10px">
            ${fmtMoney(subUsdForOrder)} (subtotal, ex. VAT) × ${rateUsed} credits/USD
          </div>
          <div style="font-size:12px;color:var(--muted);line-height:1.5;padding-top:8px;border-top:1px solid var(--line)">
            <span style="color:var(--teal-deep);font-weight:600">ⓘ</span>
            ${I.t("admin.orders.view.credits.note")}
          </div>
        </div>
      ` : "";

      dmchampBlock = creditsBlock + `
        <div style="margin-top:18px;padding:14px 16px;background:rgba(7,93,99,.04);border:1px solid var(--line);border-radius:9px;border-left:3px solid ${accentColor}">
          <h3 style="margin:0 0 12px;font-size:13px;font-family:var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--teal-deep)">${I.t("admin.orders.view.dmchamp")}</h3>
          ${bodyHtml}
          ${actionBtn}
        </div>
      `;
    }

    // ontheline partner / payment-gateway block — only for ontheline orders.
    let onthelineBlock = "";
    if(o.source === "ontheline"){
      const pName = (State.onthelinePartners || []).find(p => (p.code||"").toLowerCase() === (o.partner||"").toLowerCase());
      const gName = (State.onthelinePaygw || []).find(g => (g.code||"").toLowerCase() === (o.paygw||"").toLowerCase());
      const cur = (State.onthelineCurrencies || []).find(c => (c.code||"").toLowerCase() === (o.currency||"").toLowerCase());
      const sym = cur?.symbol || "";
      const origAmt = Number.isFinite(Number(o.amountOriginal)) ? Number(o.amountOriginal) : null;
      const usdAmt  = Number.isFinite(Number(o.amountUsd)) ? Number(o.amountUsd) : Number(o.subtotal) || 0;
      const amountTxt = origAmt !== null
        ? `${escapeHtml(sym)}${origAmt.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} ${escapeHtml(o.currency||"")} <span style="color:var(--muted)">(${fmtMoney(usdAmt)})</span>`
        : fmtMoney(usdAmt);
      const eventTxt = o.event ? escapeHtml(o.event) : "—";
      onthelineBlock = `
        <div style="margin-top:18px;padding:14px 16px;background:rgba(214,41,155,.04);border:1px solid var(--line);border-radius:9px;border-left:3px solid var(--magenta)">
          <h3 style="margin:0 0 12px;font-size:13px;font-family:var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--magenta-deep)">${I.t("admin.orders.view.ontheline")}</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px">
            <div><div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">${I.t("admin.orders.view.partner")}</div>
              <div style="font-family:var(--mono)">${escapeHtml(o.partner || "—")}</div>
              ${pName ? `<div style="font-size:12px;color:var(--muted)">${escapeHtml(pName.companyName)}</div>` : ""}</div>
            <div><div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">${I.t("admin.orders.view.paygw")}</div>
              <div style="font-family:var(--mono)">${escapeHtml(o.paygw || "—")}</div>
              ${gName ? `<div style="font-size:12px;color:var(--muted)">${escapeHtml(gName.companyName)}</div>` : ""}</div>
            <div><div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">${I.t("admin.orders.view.event")}</div>
              <div>${eventTxt}</div></div>
            <div><div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:4px">${I.t("admin.orders.view.amount")}</div>
              <div>${amountTxt}</div></div>
          </div>
        </div>
      `;
    }

    const brandName = (State.branding && State.branding.siteName) || DEFAULT_BRANDING.siteName || "Deal Pro";
    App.showModal(`
      <button class="close" onclick="App.closeModal()">×</button>
      <h2>Invoice <span class="grad">${escapeHtml(o.ref)}</span></h2>
      <div class="sub">${escapeHtml(o.customer.name)} · ${escapeHtml(o.customer.email)}</div>
      <div class="email-preview">
        <h2 style="margin-bottom:4px">${escapeHtml(brandName)}</h2>
        <div class="ref">Invoice ${escapeHtml(o.ref)} · ${fmtDate(o.createdAt)}</div>
        <div class="greeting"><b>Bill to:</b> ${escapeHtml(o.customer.name)}<br>${escapeHtml(o.customer.email)}<br>${escapeHtml(o.customer.company||"")} · ${escapeHtml(o.customer.country||"")}</div>
        <table class="invoice">
          <thead><tr><th>Item</th><th>Price</th></tr></thead>
          <tbody>
            ${items}
            <tr><td>Subtotal</td><td>${fmtMoney(o.subtotal)}</td></tr>
            <tr><td>VAT 7%</td><td>${fmtMoney(o.vat)}</td></tr>
            <tr class="total-row"><td>Total Paid</td><td>${fmtMoney(o.total)}</td></tr>
          </tbody>
        </table>
        <div class="creds">User ID: ${escapeHtml(o.customer.email)}<br>Temp Password: ${escapeHtml(o.initialPassword || "(set on first sign-in)")}<br>Portal: app.dealpro.io/s/${o.ref.toLowerCase()}</div>
        <div class="footer-em">Source: ${o.source.toUpperCase()} · Thank you for choosing ${escapeHtml(brandName)}.</div>
      </div>
      ${onthelineBlock}
      ${chillpayBlock}
      ${dmchampBlock}
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn-primary" style="flex:1" onclick="AdminActions.resendOrderEmail('${o.id}');App.closeModal()"><span>Resend Receipt</span><span class="arr">→</span></button>
        <button class="btn-ghost" onclick="App.closeModal()">Close</button>
      </div>
    `);
  },

  async resendOrderEmail(id){
    const o = State.orders.find(x => x.id === id);
    if(!o) return;
    // Determine language from order's receiptLang or customer's country
    const countryToLang = { TH:"th", KR:"ko", JP:"ja" };
    const lang = o.receiptLang
              || countryToLang[(o.customer?.country || "").toUpperCase()]
              || "en";
    // Queue both receipt + credentials (typical "resend" needs)
    await App.queueEmail(o.customer.email, "receipt", o, lang);
    Toast.show(I.t("toast.email.queued"),"ok");
  },

  viewEmail(id){
    const e = State.emails.find(x => x.id === id);
    if(!e) return;
    const o = e.payload || {};
    const items = (o.items||[]).map(i => `<tr><td>${escapeHtml(i.title)}</td><td>${fmtMoney(i.price)}</td></tr>`).join("");
    // Derive a display subject if not stored on the doc (older docs may not have it)
    const displaySubject = e.subject || `${e.kind} · ${o.ref || e.orderRef || ""}`;
    const statusBadge = e.status === "sent" ? `<span style="display:inline-block;padding:2px 8px;background:#7fa92a;color:#fff;border-radius:4px;font-size:11px;font-weight:500">✓ SENT</span>`
                     : e.status === "sent_support_only" ? `<span style="display:inline-block;padding:2px 8px;background:#0bb6c4;color:#fff;border-radius:4px;font-size:11px;font-weight:500">✓ SUPPORT ONLY</span>`
                     : e.status === "failed" ? `<span style="display:inline-block;padding:2px 8px;background:#c8463d;color:#fff;border-radius:4px;font-size:11px;font-weight:500">FAILED</span>`
                     : `<span style="display:inline-block;padding:2px 8px;background:#d68a1c;color:#fff;border-radius:4px;font-size:11px;font-weight:500">PENDING</span>`;
    // For ontheline mail that was redirected to support only, show an info note
    // so the admin understands the customer did NOT receive this email.
    const supportOnlyNote = e.status === "sent_support_only"
      ? `<div style="margin:12px 0;padding:10px 14px;background:rgba(11,182,196,.08);border-left:3px solid #0bb6c4;border-radius:4px;font-size:12.5px;color:var(--teal-deep)">${I.t("admin.emails.status.supportOnly.note")}</div>`
      : "";
    const errorBlock = e.lastError
      ? `<div style="margin:12px 0;padding:10px 14px;background:rgba(200,70,61,.08);border-left:3px solid #c8463d;border-radius:4px;font-size:12.5px;color:#c8463d"><b>Last error:</b> ${escapeHtml(e.lastError)} ${e.sendAttempts ? `(attempts: ${e.sendAttempts})` : ""}</div>`
      : "";
    const brandName = (State.branding && State.branding.siteName) || DEFAULT_BRANDING.siteName || "Deal Pro";
    App.showModal(`
      <button class="close" onclick="App.closeModal()">×</button>
      <h2>${escapeHtml(displaySubject)}</h2>
      <div class="sub">To: ${escapeHtml(e.to)} · ${escapeHtml(e.kind)} · ${escapeHtml(e.lang||"en").toUpperCase()} ${statusBadge}</div>
      ${supportOnlyNote}
      ${errorBlock}
      <div class="email-preview">
        <h2>${escapeHtml(brandName)}</h2>
        <div class="ref">${escapeHtml(e.kind.toUpperCase())} · ${escapeHtml(o.ref||e.orderRef||"")}</div>
        <div class="greeting">Hi ${escapeHtml((o.customer?.name||"").split(" ")[0])},<br><br>Thank you for your purchase. Below are the details for your ${escapeHtml(e.kind)}.</div>
        <table class="invoice">
          <thead><tr><th>Item</th><th>Price</th></tr></thead>
          <tbody>
            ${items}
            <tr class="total-row"><td>Total</td><td>${fmtMoney(o.total)}</td></tr>
          </tbody>
        </table>
        ${e.kind === "credentials" ? `<div class="creds">User ID: ${escapeHtml(o.customer?.email||"")}<br>Temp Password: ${escapeHtml(o.initialPassword || e.payload?.initialPassword || "(set on first sign-in)")}<br><br>Please change your password on first sign-in.</div>` : ""}
        <div class="footer-em">© ${escapeHtml(brandName)} · ${escapeHtml((e.lang||"en").toUpperCase())} · This is a preview — actual email is rendered server-side and sent via Resend.</div>
      </div>
    `);
  },

  async resendEmail(id){
    const e = State.emails.find(x => x.id === id);
    if(!e) return;
    // Reset to pending so the scheduled function picks it up.
    // We update the existing doc instead of creating a duplicate.
    await updateDoc(doc(db,"email_queue",id), {
      status: "pending",
      sendAttempts: 0,
      lastError: deleteField(),
      resendRequestedAt: serverTimestamp()
    });
    Toast.show("Queued for resend — will be sent within 5 minutes","ok");
  },

  // Cancel a pending email so the scheduled function stops trying.
  // Useful when an email is failing repeatedly (e.g. invalid recipient) and you
  // don't want it consuming retries.
  async cancelEmail(id){
    const e = State.emails.find(x => x.id === id);
    if(!e) return;
    if(e.status !== "pending"){
      Toast.show("Only pending emails can be cancelled","warn");
      return;
    }
    if(!confirm(`Cancel this pending email?\n\nTo: ${e.to}\nKind: ${e.kind}\n\nIt will no longer be sent.`)) return;
    await updateDoc(doc(db,"email_queue",id), {
      status: "cancelled",
      cancelledAt: serverTimestamp()
    });
    Toast.show("Email cancelled","ok");
  },

  // Bulk-cancel all currently pending emails — useful when many are stuck
  // due to a config error (e.g. wrong Resend FROM domain)
  async cancelAllPending(){
    const pending = State.emails.filter(e => e.status === "pending");
    if(pending.length === 0){ Toast.show("No pending emails","warn"); return; }
    if(!confirm(`Cancel all ${pending.length} pending email(s)?\n\nThey will no longer be sent.`)) return;
    let cancelled = 0;
    for(const e of pending){
      try{
        await updateDoc(doc(db,"email_queue",e.id), {
          status: "cancelled",
          cancelledAt: serverTimestamp()
        });
        cancelled++;
      }catch(err){ console.warn("cancel failed for", e.id, err); }
    }
    Toast.show(`Cancelled ${cancelled} email(s)`,"ok");
  },

  // Delete all emails that are NOT pending (sent / failed / cancelled).
  // Keeps the queue tidy. Pending emails are preserved.
  async clearProcessedEmails(){
    const processed = State.emails.filter(e => e.status !== "pending");
    if(processed.length === 0){ Toast.show("No processed emails to clear","warn"); return; }
    if(!confirm(`Delete ${processed.length} processed email(s) from the queue?\n\nThis removes records of sent / failed / cancelled emails. Pending emails are kept.\n\nThis cannot be undone.`)) return;
    let deleted = 0;
    for(const e of processed){
      try{
        await deleteDoc(doc(db,"email_queue",e.id));
        deleted++;
      }catch(err){ console.warn("delete failed for", e.id, err); }
    }
    Toast.show(`Cleared ${deleted} email(s) from queue`,"ok");
  },

  openAddUser(){
    App.showModal(`
      <button class="close" onclick="App.closeModal()">×</button>
      <h2>${I.t("admin.users.modal.title-html")}</h2>
      <div class="sub">${I.t("admin.users.modal.sub")}</div>
      <div class="user-form-grid">
        <div class="field"><label>${I.t("admin.users.modal.name")}</label><input id="nu-name" /></div>
        <div class="field"><label>${I.t("admin.users.modal.email")}</label><input id="nu-email" type="email" /></div>
        <div class="field"><label>${I.t("admin.users.modal.role")}</label><select id="nu-role"><option value="customer">${I.t("admin.users.role.customer")}</option><option value="admin">${I.t("admin.users.role.admin")}</option></select></div>
        <div class="field"><label>${I.t("admin.users.modal.password")}</label><input id="nu-pass" type="text" placeholder="e.g. Welcome123!" /></div>
      </div>
      <button class="btn-primary" onclick="AdminActions.createUser()" style="margin-top:18px"><span>${I.t("admin.users.modal.cta")}</span><span class="arr">→</span></button>
    `);
  },

  async createUser(){
    const name = document.getElementById("nu-name").value.trim();
    const email = document.getElementById("nu-email").value.trim().toLowerCase();
    const role = document.getElementById("nu-role").value;
    const password = document.getElementById("nu-pass").value;
    if(!name || !email || !password) return Toast.show("All fields required","err");
    if(password.length < 6) return Toast.show("Password must be at least 6 characters","err");

    // CAVEAT: createUserWithEmailAndPassword signs in the newly-created user, kicking the
    // current admin out of their session. To preserve the admin session we use a secondary
    // Firebase App instance just for the create-user call, then sign out from that secondary.
    let secondaryApp;
    try{
      secondaryApp = initializeApp(firebaseConfig, "secondary-" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);

      // Create the Auth account. If the email already exists it may be a
      // "ghost" — an Auth account whose Firestore profile write failed on a
      // previous attempt (so it never appeared in the Users table). In that
      // case we sign in with the supplied password to recover the uid and heal
      // it by writing the missing profile. If sign-in fails, the email truly
      // belongs to someone else (different password), so we surface that.
      let uid;
      try{
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        uid = cred.user.uid;
      }catch(createErr){
        if(createErr.code !== "auth/email-already-in-use") throw createErr;
        let signedIn;
        try{
          signedIn = await signInWithEmailAndPassword(secondaryAuth, email, password);
        }catch(signInErr){
          const err = new Error("email-in-use-other");
          err.code = "email-in-use-other";
          throw err;
        }
        uid = signedIn.user.uid;
        const existing = await getDoc(doc(db,"users",uid));
        if(existing.exists()){
          const err = new Error("user-already-exists");
          err.code = "user-already-exists";
          throw err;
        }
        // No profile → this is our ghost; fall through to write it (heal).
      }

      // Write profile to Firestore using uid as the doc id
      await setDoc(doc(db,"users",uid), {
        uid,
        email, name, role,
        mustChangePassword: true,
        createdAt: serverTimestamp()
      });

      // Queue welcome / credentials email
      await addDoc(collection(db,"email_queue"),{
        to: email, kind:"credentials",
        subject:`Welcome to Deal Pro · Your credentials`,
        orderRef:`USR-${Date.now().toString(36).toUpperCase().slice(-5)}`,
        lang:"en", status:"pending",
        payload:{
          customer:{name,email},
          items:[{title:`${role} access`,price:0}],
          total:0, ref:`USR-${Date.now()}`,
          // Note: we send the initial password in the welcome email so the user can sign in once.
          // They will be required to change it on first sign-in via Firebase Auth.
          initialPassword: password
        },
        createdAt: serverTimestamp()
      });

      await signOut(secondaryAuth);
      Toast.show(I.t("toast.user.created"),"ok");
      App.closeModal();
    }catch(e){
      console.error(e);
      let msg = "Error: " + (e.code || e.message);
      if(e.code === "auth/email-already-in-use") msg = "Email already in use";
      if(e.code === "email-in-use-other") msg = "This email is already registered to another account (the password you entered doesn't match it). Use a different email, or delete the existing account first.";
      if(e.code === "user-already-exists") msg = "A user with this email already exists.";
      if(e.code === "auth/weak-password") msg = "Password too weak (min 6 chars)";
      if(e.code === "auth/invalid-email") msg = "Invalid email format";
      Toast.show(msg,"err");
    }finally{
      // The secondary app must be cleaned up; otherwise it keeps connections open
      if(secondaryApp){
        try{
          const { deleteApp } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js");
          await deleteApp(secondaryApp);
        }catch{}
      }
    }
  },

  async deleteUser(id){
    const target = State.users.find(u => u.id === id);
    if(!target) return;
    if(!confirm(
      `Permanently delete user ${target.email}?\n\n` +
      `This removes BOTH:\n` +
      `  • The Firestore profile (users/${id})\n` +
      `  • The Firebase Authentication account\n\n` +
      `The email can be re-used for a new purchase immediately afterwards.\n` +
      `This cannot be undone.`
    )) return;

    try{
      // Get Firebase ID token for the currently signed-in admin so the
      // Netlify Function can verify our admin status server-side.
      const current = auth.currentUser;
      if(!current) return Toast.show("Not signed in","err");
      const idToken = await current.getIdToken(/* forceRefresh */ false);

      // Use the direct Netlify Function path (not the /api/* alias). This
      // sidesteps any stale-redirect issues during deploys — the alias in
      // netlify.toml exists for cleanliness but the .netlify/functions URL
      // is always live as soon as the function ships.
      const res = await fetch("/.netlify/functions/delete-customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + idToken
        },
        body: JSON.stringify({ uid: id })
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok || !data.ok){
        const msg = data.error || data.detail || `HTTP ${res.status}`;
        console.error("[deleteUser] failed:", data);
        return Toast.show("Delete failed: " + msg, "err");
      }

      // Compose a clear toast describing what actually happened on each side
      const parts = [];
      if(data.authDeleted)    parts.push("Firebase Auth ✓");
      if(data.profileDeleted) parts.push("Firestore profile ✓");
      Toast.show(`User ${target.email} deleted (${parts.join(", ") || "no-op"})`, "ok");
    }catch(e){
      console.error("[deleteUser] error:", e);
      Toast.show("Delete failed: " + (e.message || "network error"), "err");
    }
  },

  async resetPassword(id){
    const target = State.users.find(u => u.id === id);
    if(!target) return;
    if(!confirm(`Send password reset email to ${target.email}?`)) return;
    try{
      await sendPasswordResetEmail(auth, target.email);
      // Also mark in Firestore that the user is expected to reset
      await updateDoc(doc(db,"users",id),{ mustChangePassword: true });
      Toast.show(`Password reset email sent to ${target.email}`,"ok");
    }catch(e){
      console.error(e);
      Toast.show("Error: "+(e.code||e.message),"err");
    }
  },

  async changePassword(){
    const curr = document.getElementById("pw-curr").value;
    const next = document.getElementById("pw-new").value;
    const conf = document.getElementById("pw-conf").value;
    if(!curr || !next || !conf) return Toast.show("All fields required","err");
    if(next !== conf) return Toast.show(I.t("toast.password.mismatch"),"err");
    if(next.length < 6) return Toast.show("New password must be at least 6 characters","err");

    const current = auth.currentUser;
    if(!current) return Toast.show("Not signed in","err");

    try{
      // Re-authenticate to verify the current password — required by Firebase Auth
      const credential = EmailAuthProvider.credential(current.email, curr);
      await reauthenticateWithCredential(current, credential);
      await updatePassword(current, next);

      // Sync Firestore flag
      if(State.user?.uid){
        await updateDoc(doc(db,"users",State.user.uid),{ mustChangePassword:false });
      }

      document.getElementById("pw-curr").value="";
      document.getElementById("pw-new").value="";
      document.getElementById("pw-conf").value="";
      Toast.show(I.t("toast.password.updated"),"ok");
    }catch(e){
      console.error(e);
      if(e.code === "auth/wrong-password" || e.code === "auth/invalid-credential"){
        return Toast.show(I.t("toast.password.wrong"),"err");
      }
      if(e.code === "auth/weak-password"){
        return Toast.show("New password too weak","err");
      }
      if(e.code === "auth/requires-recent-login"){
        return Toast.show("Please sign out and sign in again before changing password","err");
      }
      Toast.show("Error: "+(e.code||e.message),"err");
    }
  },

  async fireTestWebhook(){
    const name = document.getElementById("tw-name").value.trim();
    const email = document.getElementById("tw-email").value.trim();
    const country = document.getElementById("tw-country").value.trim();
    const amount = parseFloat(document.getElementById("tw-amount").value);
    const eventStatus = document.getElementById("tw-event")?.value || "Paid";
    const currency = (document.getElementById("tw-currency")?.value || "USD").toUpperCase();
    const partner = document.getElementById("tw-partner")?.value || "";
    const paygw = document.getElementById("tw-paygw")?.value || "";
    if(!name || !email || !amount) return Toast.show("Fill all fields","err");

    // Mirror the deployed webhook's validation so the simulation behaves the same.
    if(partner && !(State.onthelinePartners||[]).some(p => (p.code||"").toLowerCase() === partner.toLowerCase()))
      return Toast.show(I.t("toast.webhook.badPartner", { code: partner }) ,"err");
    if(paygw && !(State.onthelinePaygw||[]).some(g => (g.code||"").toLowerCase() === paygw.toLowerCase()))
      return Toast.show(I.t("toast.webhook.badPaygw", { code: paygw }),"err");
    if(!(State.onthelineCurrencies||[]).some(c => (c.code||"").toLowerCase() === currency.toLowerCase()))
      return Toast.show(I.t("toast.webhook.badCurrency", { code: currency }),"err");

    // Convert the amount to USD for matching / credits / display. We call the
    // backend convert-currency function so the simulation uses the SAME
    // Free Currency API key + logic as the real webhook (the key never reaches
    // the browser). If that fails we fall back to the keyless open.er-api.com,
    // then to treating the amount as USD. USD passes through untouched.
    let usdAmount = amount, fxRate = 1, fxSource = "identity";
    if(currency !== "USD"){
      let converted = false;
      try{
        // Call the function directly at /.netlify/functions/ rather than the
        // /api/ alias. This project's /api/* redirect aliases have a known
        // caching issue on production (same as delete-customer / provision-
        // dmchamp, which also call /.netlify/functions/ directly).
        const res = await fetch(`/.netlify/functions/convert-currency?amount=${encodeURIComponent(amount)}&currency=${encodeURIComponent(currency)}`);
        if(res.ok){
          const d = await res.json();
          if(d && d.ok && Number.isFinite(Number(d.usd))){
            usdAmount = Number(d.usd); fxRate = Number(d.rate) || 1; fxSource = d.source || "freecurrencyapi.com"; converted = true;
          }
        }
      }catch(e){ console.warn("convert-currency endpoint failed, trying fallback:", e.message); }
      if(!converted){
        try{
          const res = await fetch("https://open.er-api.com/v6/latest/USD");
          const data = await res.json();
          const r = data?.rates?.[currency];
          if(Number.isFinite(r) && r > 0){ usdAmount = Math.round((amount / r) * 100) / 100; fxRate = r; fxSource = "open.er-api.com"; }
        }catch{ /* keep usdAmount = amount as a last resort */ }
      }
    }

    // ontheline sends a VAT-INCLUSIVE amount (exactly what the customer paid),
    // so the converted USD figure is the grand total. Recover the pre-VAT
    // subtotal (total ÷ 1.07) for package matching + credit calculation; never
    // add VAT on top of an ontheline amount.
    const total = +Number(usdAmount).toFixed(2);        // VAT-inclusive (what the customer paid)
    usdAmount = +(total / 1.07).toFixed(2);              // pre-VAT subtotal
    const vat = +(total - usdAmount).toFixed(2);
    const matched = matchPackagesForAmount(usdAmount);
    const ref = "DP-OT-" + Date.now().toString(36).toUpperCase().slice(-6);
    // Transaction ID: use the value typed in the form, or auto-generate one.
    // Re-using the same transaction_id lets you test the state machine
    // (e.g. fire Paid, then fire Refund with the same id).
    const typedTxId = (document.getElementById("tw-txid")?.value || "").trim();
    const txId = typedTxId || ("ot_test_" + Date.now().toString(36));

    // ---- State machine (mirrors the deployed webhook) --------------------
    // Find the current state of this transaction_id from existing orders.
    const sameTx = (State.orders || [])
      .filter(o => o.source === "ontheline" && (o.transactionId || o.transaction_id) === txId)
      .sort((a,b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime() || 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime() || 0;
        return tb - ta;
      });
    const currentState = sameTx.length ? (sameTx[0].event || null) : null;
    const paidOrder = sameTx.find(o => o.event === "Paid") || null;

    // Exact same-event replay guard
    if(currentState === eventStatus){
      return Toast.show(I.t("toast.webhook.dupEvent", { event: eventStatus }), "err");
    }
    // Transition rules
    if(currentState === null){
      if(eventStatus !== "Paid" && eventStatus !== "Fail")
        return Toast.show(I.t("toast.webhook.needPaidFirst", { event: eventStatus }), "err");
    }else if(currentState === "Paid"){
      if(!["Unpaid","Refund","Partial Refund"].includes(eventStatus))
        return Toast.show(I.t("toast.webhook.fromPaid", { event: eventStatus }), "err");
    }else if(["Unpaid","Refund","Partial Refund"].includes(currentState)){
      return Toast.show(I.t("toast.webhook.finalState", { state: currentState }), "err");
    }else if(currentState === "Fail"){
      if(eventStatus !== "Paid")
        return Toast.show(I.t("toast.webhook.fromFail", { event: eventStatus }), "err");
    }

    const isReversal = ["Unpaid","Refund","Partial Refund"].includes(eventStatus) && currentState === "Paid";
    const shouldProvision = eventStatus === "Paid";

    // ---- Reversal: deduct credits + queue refund email -------------------
    if(isReversal){
      const dmCfg = State.dmchamp || {};
      const creditsPerUsd = Number(paidOrder?.dmchampSubAccount?.creditsPerUsd) || Number(dmCfg.creditsPerUsd) || 100;
      const paidUsd = Number(paidOrder?.amountUsd) || Number(paidOrder?.subtotal) || 0;
      // Credits the Paid order granted. Prefer the stored value, but fall back
      // to recomputing from the paid USD amount × rate (the Simulate Paid path
      // doesn't always store a dmchampSubAccount, so creditsGranted may be 0).
      let grantedCredits = Number(paidOrder?.dmchampSubAccount?.creditsGranted) || 0;
      if(grantedCredits <= 0 && paidUsd > 0){
        grantedCredits = Math.max(1, Math.round(paidUsd * creditsPerUsd));
      }
      let creditsDeducted, creditsRemaining, refundUsd, refundUsdTotal, refundOriginal;
      if(eventStatus === "Partial Refund"){
        // amount = refunded portion (VAT-inclusive); usdAmount is its pre-VAT
        // subtotal, total is VAT-inclusive. Must be less than paid subtotal.
        refundOriginal = amount; refundUsd = usdAmount; refundUsdTotal = total;
        if(refundUsd >= paidUsd)
          return Toast.show(I.t("toast.webhook.refundTooBig", { paid: paidUsd }), "err");
        creditsDeducted = Math.round(refundUsd * creditsPerUsd);
        creditsRemaining = Math.max(0, grantedCredits - creditsDeducted);
      }else{
        // Full reversal: refund the full amount paid (use the Paid order's figures).
        refundOriginal = Number(paidOrder?.amountOriginal) || amount;
        refundUsd = paidUsd;
        refundUsdTotal = Number(paidOrder?.total) || total;
        creditsDeducted = grantedCredits; creditsRemaining = 0;
      }
      const reversalOrder = {
        ref, source:"ontheline", status:eventStatus, event:eventStatus, transactionId:txId,
        customer:{ name, email, country },
        items: paidOrder?.items || matched.items,
        subtotal: refundUsd, vat: +(refundUsdTotal - refundUsd).toFixed(2), total: refundUsdTotal, currency,
        amountOriginal: refundOriginal, amountUsd: refundUsd, fxRate, fxSource,
        partner, paygw,
        receiptLang: paidOrder?.receiptLang || "en",
        reversalOf: paidOrder?.ref || null,
        creditsDeducted, creditsRemaining,
        refundAmountUsd: refundUsdTotal, refundAmountOriginal: refundOriginal,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      };
      try{
        await addDoc(collection(db,"webhook_events"),{
          event:eventStatus, transactionId:txId, customer:{name,email,country},
          amount, currency, amountUsd:usdAmount, fxRate, fxSource, partner, paygw,
          items: reversalOrder.items, orderRef:ref, status:"success", provisioned:false,
          createdAt: serverTimestamp()
        });
        await addDoc(collection(db,"orders"), reversalOrder);
        await App.queueEmail(email, eventStatus === "Partial Refund" ? "partial_refund" : "refund_cancel", {
          ...reversalOrder,
          refundAmountOriginal: refundOriginal, refundAmountUsd: refundUsd,
          creditsDeducted, creditsRemaining
        });
        Toast.show(I.t("toast.webhook.reversed", { event:eventStatus, deducted:creditsDeducted, remaining:creditsRemaining }), "ok");
      }catch(e){ console.error(e); Toast.show("Webhook error: "+e.message,"err"); }
      return;
    }

    const order = {
      ref, source:"ontheline",
      status: eventStatus === "Paid" ? "paid" : eventStatus,
      event: eventStatus,
      transactionId: txId,
      customer:{ name, email, country },
      items: matched.items,
      subtotal: usdAmount, vat, total,
      currency,
      amountOriginal: amount,
      amountUsd: usdAmount,
      fxRate, fxSource,
      partner, paygw,
      receiptLang:"en",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try{
      // Save webhook event (STATUS column shows the event)
      await addDoc(collection(db,"webhook_events"),{
        event: eventStatus,
        transactionId: txId,
        customer:{ name, email, country },
        amount, currency,
        amountUsd: usdAmount, fxRate, fxSource,
        partner, paygw,
        items: matched.items,
        orderRef: ref,
        status:"success",
        provisioned: shouldProvision,
        createdAt: serverTimestamp()
      });
      // Create order
      await addDoc(collection(db,"orders"), order);

      // Non-provisioning events stop here (lean audit order only).
      if(!shouldProvision){
        Toast.show(I.t("toast.webhook.firedEvent",{ref, event:eventStatus}),"ok");
        return;
      }

      // Auto-provision a customer account using Firebase Auth via a secondary app
      // (so we don't kick the admin out of their session).
      const usersQ = query(collection(db,"users"), where("email","==",email));
      const usersSnap = await getDocs(usersQ);
      if(usersSnap.empty){
        const tempPass = `dp_${ref.toLowerCase()}_${Math.random().toString(36).slice(2,6)}`;
        let secondaryApp;
        try{
          secondaryApp = initializeApp(firebaseConfig, "wh-secondary-" + Date.now());
          const secondaryAuth = getAuth(secondaryApp);
          const cred = await createUserWithEmailAndPassword(secondaryAuth, email, tempPass);
          await setDoc(doc(db,"users",cred.user.uid), {
            uid: cred.user.uid,
            email, name, role:"customer",
            mustChangePassword: true,
            plan: matched.items.map(i=>i.title).join(" + "),
            source: "ontheline",
            createdAt: serverTimestamp()
          });
          await signOut(secondaryAuth);
          order.initialPassword = tempPass;
        }catch(authErr){
          console.warn("Auth provisioning skipped:", authErr.code || authErr.message);
        }finally{
          if(secondaryApp){
            try{
              const { deleteApp } = await import("https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js");
              await deleteApp(secondaryApp);
            }catch{}
          }
        }
      }
      // Queue emails
      await App.queueEmail(email,"invoice",order);
      await App.queueEmail(email,"receipt",order);
      await App.queueEmail(email,"credentials",order);

      Toast.show(I.t("toast.webhook.fired",{ref}),"ok");
    }catch(e){
      console.error(e);
      Toast.show("Webhook error: "+e.message,"err");
    }
  },

  async saveTranslation(lang, key, value){
    try{
      const ref = doc(db,"translations",lang);
      const snap = await getDoc(ref);
      const current = snap.exists() ? (snap.data().strings || {}) : {};
      current[key] = value;
      await setDoc(ref,{ strings: current, updatedAt: serverTimestamp() }, { merge:true });
      State.strings[lang] = current;
      I.recalcStatus();
      App.buildLangPicker();
      // Re-apply translations in case the changed key is currently visible
      I.apply();
      return true;
    }catch(e){
      Toast.show("Error saving: "+(e.code || e.message),"err");
      return false;
    }
  },

  // Triggered on blur of a translation input.
  // Skips the write if the value hasn't changed, and shows brief inline feedback.
  async saveTranslationOnBlur(lang, key, el){
    const orig = el.dataset.orig ?? "";
    const value = el.value;
    if(value === orig) return; // No change, skip

    // Visual feedback: highlight the field while saving
    const prevBorder = el.style.borderColor;
    el.style.transition = "background .25s, border-color .25s";
    el.style.background = "rgba(214,138,28,.12)"; // amber while saving

    const ok = await this.saveTranslation(lang, key, value);

    if(ok){
      el.style.background = "rgba(127,169,42,.18)"; // green = saved
      el.dataset.orig = value;
      Toast.show(I.t("toast.translation.saved"),"ok");
      setTimeout(() => { el.style.background = ""; }, 1200);
    }else{
      el.style.background = "rgba(200,70,61,.15)"; // red = failed
      setTimeout(() => { el.style.background = ""; }, 1800);
    }
  },

  editLang(code){
    App.setAdmin("languages");
    setTimeout(() => {
      const sel = document.getElementById("tl-lang");
      if(sel){ sel.value = code; renderAdminLanguages_TranslateTable(); }
    }, 50);
  },

  // ============= PACKAGE CRUD =============
  openPackageModal(bucket, id){
    const isEdit = !!id;
    const p = isEdit
      ? (PACKAGES[bucket] || []).find(x => x.id === id)
      : null;
    if(isEdit && !p){ Toast.show("Package not found","err"); return; }

    // For new packages, suggest a default id pattern
    const suggestedId = isEdit ? p.id : `${bucket}.${Date.now().toString(36).slice(-4)}`;
    const nextOrder = isEdit ? (p.order ?? 1) : ((PACKAGES[bucket] || []).length + 1);

    App.showModal(`
      <button class="close" onclick="App.closeModal()">×</button>
      <h2>${isEdit ? "Edit" : "New"} <span class="grad">package</span></h2>
      <div class="sub">${I.t("admin.packages.bucket."+bucket)}</div>
      <div class="user-form-grid">
        <div class="field full">
          <label>${I.t("admin.packages.col.id")} <span style="color:var(--muted);text-transform:none;letter-spacing:0">(unique, e.g. credit.20, onetime.3m, sub.6m)</span></label>
          <input id="pkg-id" value="${escapeHtml(suggestedId)}" ${isEdit?'readonly style="opacity:.6;cursor:not-allowed"':''} />
        </div>
        <div class="field">
          <label>${I.t("admin.packages.col.title")}</label>
          <input id="pkg-title" value="${escapeHtml(isEdit ? pkgTitle(p) : "")}" placeholder="e.g. Studio" />
        </div>
        <div class="field">
          <label>${I.t("admin.packages.col.price")} (USD)</label>
          <input id="pkg-price" type="number" step="0.01" min="0" value="${isEdit ? p.price : ""}" placeholder="e.g. 20" />
        </div>
        <div class="field full">
          <label>${I.t("admin.packages.col.desc")}</label>
          <textarea id="pkg-desc" rows="2" style="width:100%;padding:12px 14px;background:rgba(255,251,243,.65);border:1px solid var(--line-2);border-radius:9px;font-size:14px;font-weight:300;font-family:inherit;color:var(--text);resize:vertical">${escapeHtml(isEdit ? pkgDesc(p) : "")}</textarea>
        </div>
        <div class="field">
          <label>${I.t("admin.packages.col.order")}</label>
          <input id="pkg-order" type="number" min="1" value="${nextOrder}" />
        </div>
        <div class="field">
          <label>${I.t("admin.packages.col.featured")}</label>
          <select id="pkg-featured">
            <option value="false" ${isEdit && !p.featured ? "selected" : ""}>No</option>
            <option value="true" ${isEdit && p.featured ? "selected" : ""}>Yes (★ highlight)</option>
          </select>
        </div>
        <div class="field full">
          <label>${I.t("admin.packages.col.duration")} <span style="color:var(--muted);text-transform:none;letter-spacing:0">${bucket === 'credit' ? '(leave empty — credit purchases do not expire)' : '(days of access after payment, e.g. 7 = 7 days, 30 = 1 month, 365 = 1 year)'}</span></label>
          <input id="pkg-duration" type="number" min="0" step="1" value="${isEdit && p.durationDays != null ? p.durationDays : ''}" placeholder="${bucket === 'credit' ? 'No expiry' : 'e.g. 30'}" ${bucket === 'credit' ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''} />
        </div>
      </div>
      <input type="hidden" id="pkg-bucket" value="${escapeHtml(bucket)}" />
      <input type="hidden" id="pkg-is-edit" value="${isEdit ? "1" : "0"}" />
      <button class="btn-primary" onclick="AdminActions.savePackage()" style="margin-top:18px;width:100%;justify-content:center">
        <span>${isEdit ? "Save Changes" : "Create Package"}</span><span class="arr">→</span>
      </button>
    `);
  },

  async savePackage(){
    const id       = document.getElementById("pkg-id").value.trim();
    const title    = document.getElementById("pkg-title").value.trim();
    const desc     = document.getElementById("pkg-desc").value.trim();
    const price    = parseFloat(document.getElementById("pkg-price").value);
    const order    = parseInt(document.getElementById("pkg-order").value, 10);
    const featured = document.getElementById("pkg-featured").value === "true";
    const bucket   = document.getElementById("pkg-bucket").value;
    const isEdit   = document.getElementById("pkg-is-edit").value === "1";

    // Duration: null for credit (always no expiry), otherwise parse the input
    // (empty = null = no expiry; 0 or negative also normalized to null)
    let durationDays = null;
    if(bucket !== "credit"){
      const raw = document.getElementById("pkg-duration").value.trim();
      if(raw !== ""){
        const n = parseInt(raw, 10);
        if(isFinite(n) && n > 0) durationDays = n;
      }
    }

    if(!id) return Toast.show("ID is required","err");
    if(!/^[a-z0-9._-]+$/i.test(id)) return Toast.show("ID can contain only letters, numbers, dot, dash, underscore","err");
    if(!title) return Toast.show("Title is required","err");
    if(!isFinite(price) || price <= 0) return Toast.show("Valid price required","err");
    if(!isFinite(order) || order < 1) return Toast.show("Order must be ≥ 1","err");
    if(!["credit","onetime","sub"].includes(bucket)) return Toast.show("Invalid bucket","err");
    if(bucket !== "credit" && durationDays == null){
      // Warn but don't block — admin may intentionally leave duration off
      if(!confirm(`No duration set for this ${bucket} package — purchases won't track an expiry date. Continue?`)) return;
    }

    try{
      // Diagnostic: confirm we're authenticated
      if(!State.user || !State.user.uid){
        return Toast.show("Not signed in as admin — please log in again","err");
      }

      // For new packages, ensure id is not already taken
      if(!isEdit){
        const existsSnap = await getDoc(doc(db,"packages",id));
        if(existsSnap.exists()) return Toast.show("This ID is already in use — pick another","err");
      }

      const payload = {
        id, bucket, title, desc, price, order, featured,
        durationDays,  // null for credit, integer for onetime/sub
        updatedAt: serverTimestamp(),
        updatedBy: State.user?.email || "admin"
      };
      if(!isEdit) payload.createdAt = serverTimestamp();

      // Use merge so existing fields (like titleKey for legacy) aren't blown away
      await setDoc(doc(db,"packages",id), payload, { merge: true });

      App.closeModal();
      Toast.show(isEdit ? "Package updated" : "Package created","ok");
      // Subscription will pick this up and re-render automatically
    }catch(e){
      console.error("savePackage failed:", e);
      let msg = "Save failed: " + (e.code || e.message);
      if(e.code === "permission-denied"){
        msg = "Save failed: Firestore Rules don't allow admin to write packages. Check Rules in Firebase Console.";
      }
      Toast.show(msg,"err");
    }
  },

  async deletePackage(id){
    const p = [...(PACKAGES.credit||[]), ...(PACKAGES.onetime||[]), ...(PACKAGES.sub||[])]
      .find(x => x.id === id);
    if(!p){ Toast.show("Package not found","err"); return; }
    if(!confirm(`Delete package "${pkgTitle(p)}" (${id})?\n\nThis cannot be undone.`)) return;
    try{
      await deleteDoc(doc(db,"packages",id));
      Toast.show("Package deleted","ok");
    }catch(e){
      console.error(e);
      Toast.show("Delete failed: " + (e.code || e.message),"err");
    }
  },

  // Re-seed Firestore with the original default package set.
  // Existing packages with the same ID are overwritten (merge:true) — but additional
  // custom packages NOT in defaults are preserved.
  async resetPackagesToDefaults(){
    if(!State.user){ Toast.show("Not signed in","err"); return; }
    if(!confirm("Reset packages to default set?\n\n• All 18 default packages will be (re-)created\n• Existing packages with the same ID will be overwritten with default values\n• Any custom packages you added (with different IDs) will be kept\n\nContinue?")) return;

    const allDefaults = [
      ...DEFAULT_PACKAGES.credit.map(p => ({ ...p, bucket:"credit" })),
      ...DEFAULT_PACKAGES.onetime.map(p => ({ ...p, bucket:"onetime" })),
      ...DEFAULT_PACKAGES.sub.map(p => ({ ...p, bucket:"sub" }))
    ];
    let written = 0, failed = 0;
    for(const p of allDefaults){
      try{
        await setDoc(doc(db,"packages",p.id), {
          id: p.id,
          bucket: p.bucket,
          title: I.t(p.titleKey),    // Bake current English label
          desc:  I.t(p.descKey),     // Bake current English description
          price: p.price,
          order: p.order,
          featured: !!p.featured,
          durationDays: p.durationDays ?? null,   // null for credit; integer for onetime/sub
          updatedAt: serverTimestamp(),
          updatedBy: State.user?.email || "admin",
          createdAt: serverTimestamp()
        }, { merge: true });
        written++;
      }catch(e){
        console.warn("Reset failed for", p.id, "—", e.code || e.message);
        failed++;
      }
    }
    if(written > 0){
      Toast.show(`Reset complete · ${written} default packages restored${failed?` (${failed} failed)`:""}`,"ok");
    }else{
      Toast.show(`Reset failed — check Firestore Rules. ${failed} write attempts denied.`,"err");
    }
  },

  // Copy the displayed webhook endpoint URL to clipboard
  copyWebhookEndpoint(el){
    const text = (el?.textContent || "").trim();
    if(!text) return;
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(text).then(
        () => Toast.show("Endpoint URL copied to clipboard","ok"),
        () => Toast.show("Copy failed — select and copy manually","err")
      );
    }else{
      // Fallback for older browsers
      const r = document.createRange();
      r.selectNode(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(r);
      try{ document.execCommand("copy"); Toast.show("Endpoint URL copied","ok"); }
      catch{ Toast.show("Copy failed — select manually","err"); }
      window.getSelection().removeAllRanges();
    }
  },

  // ----- Webhook Secret management (Firestore config/webhook doc) -----
  // Toggles between showing the masked dot string and the real secret.
  // Mutates the DOM directly so we don't need to re-render the whole page.
  toggleWebhookSecret(){
    const el = document.getElementById("webhook-secret-display");
    if(!el) return;
    const revealed = el.getAttribute("data-revealed") === "1";
    const real = el.getAttribute("data-secret") || "";
    const mask = el.getAttribute("data-masked") || "";
    if(!real) return;  // no secret to show
    if(revealed){
      el.textContent = mask;
      el.setAttribute("data-revealed","0");
    }else{
      el.textContent = real;
      el.setAttribute("data-revealed","1");
    }
    // Update the corresponding button label (it's the next sibling to el's parent's child).
    // We search by text content within the same wrapper to keep this resilient to layout tweaks.
    const wrap = el.parentElement;
    if(wrap){
      const btns = wrap.querySelectorAll("button");
      btns.forEach(b => {
        const t = (b.textContent || "").trim();
        if(t === I.t("admin.webhook.secret.show") || t === I.t("admin.webhook.secret.hide")){
          b.textContent = revealed ? I.t("admin.webhook.secret.show") : I.t("admin.webhook.secret.hide");
        }
      });
    }
  },

  // Copy current secret to clipboard. Reads from the data-attribute so it
  // works whether or not the user has clicked "Show" first.
  copyWebhookSecret(){
    const el = document.getElementById("webhook-secret-display");
    if(!el) return;
    const real = el.getAttribute("data-secret") || "";
    if(!real){ Toast.show("No secret to copy yet","warn"); return; }
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(real).then(
        () => Toast.show(I.t("admin.webhook.secret.copied"),"ok"),
        () => Toast.show("Copy failed — try Show first then select manually","err")
      );
    }else{
      // Older browsers — put real value in a temp textarea
      const ta = document.createElement("textarea");
      ta.value = real;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try{ document.execCommand("copy"); Toast.show(I.t("admin.webhook.secret.copied"),"ok"); }
      catch{ Toast.show("Copy failed","err"); }
      document.body.removeChild(ta);
    }
  },

  // Generate a new cryptographically random secret and write it to
  // Firestore config/webhook. The backend (ontheline-webhook.js) reads
  // that same doc on every request so the change takes effect immediately.
  async regenerateWebhookSecret(){
    if(!State.user?.uid){ Toast.show("Not signed in","err"); return; }
    if(!confirm(I.t("admin.webhook.secret.regenConfirm"))) return;

    // 32 bytes of randomness → 64 hex chars. crypto.getRandomValues is sync
    // and available in every modern browser.
    let secret;
    try{
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      secret = Array.from(bytes).map(b => b.toString(16).padStart(2,"0")).join("");
    }catch(e){
      console.error("Random generation failed:", e);
      Toast.show("Could not generate random bytes — your browser may not support crypto","err");
      return;
    }

    try{
      await setDoc(doc(db,"config","webhook"), {
        secret,
        updatedAt: serverTimestamp(),
        updatedBy: State.user?.email || "admin"
      }, { merge: true });
      Toast.show(I.t("admin.webhook.secret.regenerated"),"ok");
      // Subscription will re-render automatically; no manual re-render needed.
    }catch(e){
      console.error("Regenerate webhook secret failed:", e);
      let msg = "Save failed: " + (e.code || e.message);
      if(e.code === "permission-denied"){
        msg = "Save failed: Firestore Rules don't allow admin to write config/webhook. Update rules.";
      }
      Toast.show(msg,"err");
    }
  },

  // Copy ChillPay callback URL — same logic as webhook copy, separate handler
  // so changing one doesn't accidentally re-flow the other.
  copyChillPayEndpoint(el){
    this.copyWebhookEndpoint(el);
  },

  // Copy ChillPay URL Result (browser return after payment) — same copy logic
  copyChillPayResultEndpoint(el){
    this.copyWebhookEndpoint(el);
  },

  // Open a modal showing the full raw event data — useful for debugging
  // checksum mismatches and callback shape issues
  viewChillPayEvent(id){
    const e = State.chillpayEvents.find(x => x.id === id);
    if(!e) return Toast.show("Event not found","err");
    const ts = e.receivedAt || e.createdAt;

    // Pretty-print rawParams (callback) or responseBody (create-payment).
    // Debug fields (checksumProbes, concatString, sentFieldList, etc.) were
    // removed once the checksum algorithm was empirically validated against
    // real ChillPay callbacks — keeping the modal compact and the audit doc
    // small. If a mismatch ever recurs, receivedChecksum/computedChecksum
    // and the rawParams are enough to debug.
    const detailObj = e.kind === "callback"
      ? {
          rawParams: e.rawParams,
          headers: e.headers,
          verified: e.verified,
          receivedChecksum: e.receivedChecksum,
          computedChecksum: e.computedChecksum,
          error: e.error,
          note: e.note
        }
      : { requestParams: e.requestParams, responseStatus: e.responseStatus, responseBody: e.responseBody };
    const jsonStr = JSON.stringify(detailObj, null, 2);

    App.showModal(`
      <button class="close" onclick="App.closeModal()">×</button>
      <h2>${I.t("admin.chillpay.action.view")} · <span class="grad">${escapeHtml(e.kind || "?")}</span></h2>
      <div class="sub" style="margin-bottom:14px">
        <span style="font-family:var(--mono)">${fmtDate(ts)}</span>
        ${e.dealProRef ? ` · Ref: <b>${escapeHtml(e.dealProRef)}</b>` : ""}
        ${e.chillpayOrderNo ? ` · OrderNo: <b style="font-family:var(--mono)">${escapeHtml(e.chillpayOrderNo)}</b>` : ""}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
        <div class="confirm-cell" style="padding:14px">
          <div class="lab">${I.t("admin.chillpay.col.verified")}</div>
          <div class="val" style="font-size:14px">${e.kind === "callback" ? (e.verified ? "yes" : "no") : "—"}</div>
        </div>
        <div class="confirm-cell" style="padding:14px">
          <div class="lab">${I.t("admin.chillpay.col.status")}</div>
          <div class="val" style="font-size:14px">${escapeHtml(String(e.finalStatus || e.responseStatus || "—"))}</div>
        </div>
        <div class="confirm-cell" style="padding:14px">
          <div class="lab">Matched</div>
          <div class="val" style="font-size:14px">${e.kind === "callback" ? (e.matched ? "yes" : "no") : "—"}</div>
        </div>
      </div>
      ${e.error ? `<div style="background:rgba(200,70,61,.08);border:1px solid rgba(200,70,61,.25);border-radius:8px;padding:12px;margin-bottom:14px;color:var(--red);font-size:13px">⚠ ${escapeHtml(e.error)}</div>` : ""}
      <h3 style="font-size:13px;font-family:var(--mono);letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;color:var(--muted)">Raw data</h3>
      <pre style="background:rgba(31,33,38,.04);padding:14px;border-radius:8px;font-size:11.5px;overflow:auto;max-height:380px;font-family:var(--mono);line-height:1.5;border:1px solid var(--line)">${escapeHtml(jsonStr)}</pre>
    `);
  },

  // Force a one-shot read of chillpay_events directly from Firestore.
  // Use this if the realtime subscription seems stuck or if you want to verify
  // that documents actually exist in the collection. Bypasses the live snapshot.
  async refreshChillPayEvents(){
    if(!State.user) return Toast.show("Not signed in","err");
    try{
      const snap = await getDocs(query(collection(db,"chillpay_events"), limit(100)));
      const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      rows.sort((a,b) => {
        const ta = (a.receivedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0);
        const tb = (b.receivedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0);
        return tb - ta;
      });
      State.chillpayEvents = rows;
      renderAdminChillPay();
      Toast.show(`Fetched ${rows.length} Payment Gateway events directly from Firestore`,"ok");
    }catch(e){
      console.error(e);
      Toast.show(`Refresh failed: ${e.code || e.message}`,"err");
    }
  },

  // Ask the payment gateway what actually happened to this order.
  //
  // Gateways drop webhooks — when that happens a customer who really paid is
  // left on a 'pending' order with no account, credits or receipt. This polls
  // the provider directly and, if the payment did succeed, runs the same
  // settlement the callback would have (account + emails + credits).
  async checkChillPayStatus(orderId){
    if(!State.user) return Toast.show("Not signed in","err");
    Toast.show(I.t("toast.paymentstatus.checking"),"ok");
    try{
      const res = await fetch("/.netlify/functions/check-payment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json().catch(() => ({}));
      const r = data.result || {};

      if(!res.ok || !data.ok){
        console.error("[check-payment-status]", data);
        return Toast.show(I.t("toast.paymentstatus.failed", { error: r.error || data.error || `HTTP ${res.status}` }),"err");
      }
      if(r.settled){
        Toast.show(I.t("toast.paymentstatus.settled", { ref: r.ref }),"ok");
      }else if(r.newStatus === "failed"){
        Toast.show(I.t("toast.paymentstatus.failedPayment", { ref: r.ref }),"warn");
      }else{
        Toast.show(I.t("toast.paymentstatus.stillPending", { ref: r.ref, status: r.rawStatus || r.gatewayStatus || "?" }),"warn");
      }
      // The orders subscription picks up any change on the next snapshot.
      renderAdminOrders();
    }catch(e){
      console.error(e);
      Toast.show(I.t("toast.paymentstatus.failed", { error: e.message || e }),"err");
    }
  },

  // Manually mark a pending order as paid — used when the callback was confirmed
  // successful on the ChillPay side but didn't reach our server (e.g. checksum
  // mismatch, network issue). This will also provision the customer's account
  // and queue the receipt/credentials emails, exactly like the callback would.
  async markOrderPaid(orderId){
    if(!State.user) return Toast.show("Not signed in","err");
    try{
      const snap = await getDoc(doc(db,"orders",orderId));
      if(!snap.exists()) return Toast.show("Order not found","err");
      const o = { id: snap.id, ...snap.data() };

      if(o.status === "paid"){
        return Toast.show(`Order ${o.ref} is already paid`,"warn");
      }

      const confirmMsg = `Mark order ${o.ref} as PAID?\n\n` +
        `Customer: ${o.customer?.name || "—"} (${o.customer?.email || "no email"})\n` +
        `Amount: $${(o.total || 0).toFixed(2)}\n\n` +
        `This will:\n` +
        `• Update order status to "paid"\n` +
        `• Queue receipt + credentials emails\n` +
        `• Make the order final\n\n` +
        `Use this only when you've confirmed the payment succeeded on Payment Gateway's side.`;
      if(!confirm(confirmMsg)) return;

      // Update status
      await updateDoc(doc(db,"orders",orderId), {
        status: "paid",
        paidAt: serverTimestamp(),
        manuallyMarkedPaid: true,
        manuallyMarkedPaidBy: State.user.email,
        manuallyMarkedPaidAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Queue emails (receipt + credentials — invoice would have already been sent at order creation, but ChillPay flow doesn't queue invoice so we'll send receipt + credentials)
      const email = o.customer?.email;
      if(email){
        // Build a minimal order payload for the email queue (matching the create-payment shape)
        const emailOrder = {
          ref: o.ref,
          customer: o.customer,
          items: o.items || [],
          subtotal: o.subtotal,
          vat: o.vat,
          total: o.total,
          currency: o.currency || "USD",
          receiptLang: o.receiptLang || "en",
          source: o.source   // preserve source so ontheline mail routes to support only
        };
        try{
          await App.queueEmail(email, "receipt", emailOrder);
          await App.queueEmail(email, "credentials", emailOrder);
          Toast.show(`Order ${o.ref} marked paid · receipt + credentials emails queued`,"ok");
        }catch(emailErr){
          console.error("Email queue error:", emailErr);
          Toast.show(`Order marked paid, but email queue failed: ${emailErr.message}`,"warn");
        }
      }else{
        Toast.show(`Order ${o.ref} marked paid · no customer email to send to`,"ok");
      }

      renderAdminOrders();
    }catch(e){
      console.error(e);
      Toast.show("Mark paid failed: " + (e.code || e.message), "err");
    }
  },

  // Manually cancel a pending order — used to clean up orders where the customer
  // never completed payment, or duplicates from retries.
  async cancelOrder(orderId){
    if(!State.user) return Toast.show("Not signed in","err");
    try{
      const snap = await getDoc(doc(db,"orders",orderId));
      if(!snap.exists()) return Toast.show("Order not found","err");
      const o = { id: snap.id, ...snap.data() };

      if(o.status === "paid"){
        return Toast.show(`Cannot cancel a paid order. If a refund is needed, process it through Payment Gateway.`,"err");
      }
      if(o.status === "cancelled"){
        return Toast.show(`Order ${o.ref} is already cancelled`,"warn");
      }

      const confirmMsg = `Cancel pending order ${o.ref}?\n\n` +
        `Customer: ${o.customer?.name || "—"}\n` +
        `Amount: $${(o.total || 0).toFixed(2)}\n\n` +
        `The order will be marked as "cancelled" and removed from the active stats.\n` +
        `This action is reversible — you can still see the cancelled order in the period view.`;
      if(!confirm(confirmMsg)) return;

      await updateDoc(doc(db,"orders",orderId), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: State.user.email,
        updatedAt: serverTimestamp()
      });
      Toast.show(`Order ${o.ref} cancelled`,"ok");
      renderAdminOrders();
    }catch(e){
      console.error(e);
      Toast.show("Cancel failed: " + (e.code || e.message), "err");
    }
  },

  // Import complete TH/KO/JA translations into Firestore.
  // Uses MERGE so any custom changes to individual keys are preserved by default;
  // pass overwrite=true to wipe and replace entirely.
  async importAllTranslations(overwrite = false){
    if(!State.user){ Toast.show("Not signed in","err"); return; }
    const langs = Object.keys(FULL_TRANSLATIONS);
    const totalKeys = langs.reduce((s,l) => s + Object.keys(FULL_TRANSLATIONS[l]).length, 0);
    const mode = overwrite ? "OVERWRITE" : "merge with existing";
    if(!confirm(`Import full translations for ${langs.map(l=>l.toUpperCase()).join(", ")}?\n\n• ${totalKeys} string entries total (${langs.length} languages)\n• Mode: ${mode}\n• Existing master English will NOT be touched\n\nContinue?`)) return;

    let totalWritten = 0;
    let failed = 0;

    for(const lc of langs){
      try{
        const ref = doc(db,"translations",lc);
        if(overwrite){
          // Replace entire strings map
          await setDoc(ref, {
            strings: FULL_TRANSLATIONS[lc],
            updatedAt: serverTimestamp()
          });
        }else{
          // Merge: load existing, override only the keys from FULL_TRANSLATIONS,
          // keep any extra keys the admin may have added
          const snap = await getDoc(ref);
          const existing = snap.exists() ? (snap.data().strings || {}) : {};
          const merged = { ...existing, ...FULL_TRANSLATIONS[lc] };
          await setDoc(ref, {
            strings: merged,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
        // Update local state so UI reflects immediately
        State.strings[lc] = overwrite
          ? { ...FULL_TRANSLATIONS[lc] }
          : { ...(State.strings[lc] || {}), ...FULL_TRANSLATIONS[lc] };
        totalWritten += Object.keys(FULL_TRANSLATIONS[lc]).length;
      }catch(e){
        console.error(`Import failed for ${lc}:`, e);
        failed++;
      }
    }

    I.recalcStatus();
    App.buildLangPicker();
    I.apply();
    // Re-render dynamic content
    App.renderHome();
    App.renderPackages();
    if(document.getElementById("page-admin").classList.contains("show")){
      const active = document.querySelector(".side-item.active");
      if(active?.dataset.admin) App.setAdmin(active.dataset.admin);
    }

    if(failed === 0){
      Toast.show(`Imported ${totalWritten} translation entries across ${langs.length} languages`,"ok");
    }else{
      Toast.show(`Imported with ${failed} failure(s) — check console`,"warn");
    }
  },

  // ============================================================
  // BRANDING ACTIONS
  // ============================================================
  async saveBrandName(){
    if(!State.user) return Toast.show("Not signed in","err");
    const input = document.getElementById("brand-name-input");
    if(!input) return;
    const newName = (input.value || "").trim();
    if(!newName) return Toast.show(I.t("toast.branding.name.empty"),"err");
    if(newName.length > 60) return Toast.show(I.t("toast.branding.name.tooLong"),"err");
    try{
      await setDoc(doc(db,"config","branding"), {
        siteName: newName,
        updatedAt: serverTimestamp(),
        updatedBy: State.user.email || State.user.uid
      }, { merge: true });
      Toast.show(I.t("toast.branding.name.saved"),"ok");
    }catch(e){
      console.error("[branding] save name failed:", e);
      Toast.show("Save failed: " + (e.code || e.message),"err");
    }
  },

  async resetBrandName(){
    if(!State.user) return Toast.show("Not signed in","err");
    if(!confirm(I.t("toast.branding.name.resetConfirm"))) return;
    try{
      await setDoc(doc(db,"config","branding"), {
        siteName: DEFAULT_BRANDING.siteName,
        updatedAt: serverTimestamp(),
        updatedBy: State.user.email || State.user.uid
      }, { merge: true });
      Toast.show(I.t("toast.branding.name.reset.done"),"ok");
    }catch(e){
      console.error("[branding] reset name failed:", e);
      Toast.show("Reset failed: " + (e.code || e.message),"err");
    }
  },

  async uploadBrandLogo(event){
    if(!State.user) return Toast.show("Not signed in","err");
    const file = event.target.files && event.target.files[0];
    if(!file) return;
    // Size limit: 500 KB raw. Base64 inflates ~33%, plus a Firestore doc has
    // a 1 MB hard limit total — 500 KB raw keeps us well under that.
    const MAX_BYTES = 500 * 1024;
    if(file.size > MAX_BYTES){
      event.target.value = "";
      return Toast.show(I.t("toast.branding.logo.tooLarge", { mb: "0.5" }),"err");
    }
    if(!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type)){
      event.target.value = "";
      return Toast.show(I.t("toast.branding.logo.badType"),"err");
    }
    try{
      // Read file as base64 data URL
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      await setDoc(doc(db,"config","branding"), {
        logoDataUrl: dataUrl,
        updatedAt: serverTimestamp(),
        updatedBy: State.user.email || State.user.uid
      }, { merge: true });
      Toast.show(I.t("toast.branding.logo.uploaded"),"ok");
      event.target.value = "";  // clear input so re-uploading the same file re-triggers
    }catch(e){
      console.error("[branding] upload logo failed:", e);
      event.target.value = "";
      Toast.show("Upload failed: " + (e.code || e.message),"err");
    }
  },

  async resetBrandLogo(){
    if(!State.user) return Toast.show("Not signed in","err");
    if(!confirm(I.t("toast.branding.logo.resetConfirm"))) return;
    try{
      // Use updateDoc + deleteField to actually remove the field (so the
      // subscriber sees logoDataUrl as absent and reverts to fallback).
      await updateDoc(doc(db,"config","branding"), {
        logoDataUrl: deleteField(),
        updatedAt: serverTimestamp(),
        updatedBy: State.user.email || State.user.uid
      });
      Toast.show(I.t("toast.branding.logo.reset.done"),"ok");
    }catch(e){
      console.error("[branding] reset logo failed:", e);
      Toast.show("Reset failed: " + (e.code || e.message),"err");
    }
  },

  // ── ontheline Partners / Payment Gateways CRUD ──────────────────────────
  // kind: "partners" | "paygw". Both are {code, companyName} docs.
  _codeListColl(kind){ return kind === "partners" ? "ontheline_partners" : "ontheline_paygw"; },
  _codeListData(kind){ return kind === "partners" ? State.onthelinePartners : State.onthelinePaygw; },

  addCodeItem(kind){ this._openCodeItemModal(kind, null); },
  editCodeItem(kind, id){
    const item = (this._codeListData(kind) || []).find(x => x.id === id);
    this._openCodeItemModal(kind, item || null);
  },
  _openCodeItemModal(kind, item){
    const modal = document.getElementById("generic-modal");
    const body  = document.getElementById("generic-modal-inner");
    if(!modal || !body) return;
    const isEdit = !!item;
    const titleKey = kind === "partners"
      ? (isEdit ? "admin.partners.edit.title" : "admin.partners.add.title")
      : (isEdit ? "admin.paygw.edit.title" : "admin.paygw.add.title");
    body.innerHTML = `
      <h2 style="margin:0 0 14px;font-size:24px;letter-spacing:-0.01em">${I.t(titleKey)}</h2>
      <div class="field"><label>${I.t("admin.codelist.col.code")}</label>
        <input type="text" id="ci-code" value="${item ? escapeHtml(item.code||"") : ""}" placeholder="${I.t("admin.codelist.code.ph")}" autocomplete="off"></div>
      <div class="field"><label>${I.t("admin.codelist.col.company")}</label>
        <input type="text" id="ci-company" value="${item ? escapeHtml(item.companyName||"") : ""}" placeholder="${I.t("admin.codelist.company.ph")}" autocomplete="off"></div>
      <p style="font-size:12px;color:var(--muted);line-height:1.5;margin:0 0 18px">${I.t("admin.codelist.code.hint")}</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn-ghost" onclick="App.closeGenericModal()">${I.t("orders.modal.close")}</button>
        <button class="btn-primary" onclick="AdminActions.saveCodeItem('${kind}', ${item ? `'${item.id}'` : "null"})"><span>${I.t("admin.codelist.save")}</span><span class="arrow">→</span></button>
      </div>
    `;
    modal.classList.add("show");
  },
  async saveCodeItem(kind, id){
    if(!State.user) return Toast.show("Not signed in","err");
    const code = (document.getElementById("ci-code")?.value || "").trim();
    const companyName = (document.getElementById("ci-company")?.value || "").trim();
    if(!code) return Toast.show(I.t("toast.codelist.codeRequired"),"err");
    if(!companyName) return Toast.show(I.t("toast.codelist.companyRequired"),"err");
    // Enforce unique code within the collection (case-insensitive).
    const existing = (this._codeListData(kind) || []).find(x =>
      (x.code||"").toLowerCase() === code.toLowerCase() && x.id !== id);
    if(existing) return Toast.show(I.t("toast.codelist.dupCode", { code }),"err");
    const coll = this._codeListColl(kind);
    try{
      if(id){
        await updateDoc(doc(db, coll, id), {
          code, companyName,
          updatedAt: serverTimestamp(),
          updatedBy: State.user.email || State.user.uid
        });
      }else{
        await addDoc(collection(db, coll), {
          code, companyName,
          createdAt: serverTimestamp(),
          createdBy: State.user.email || State.user.uid
        });
      }
      App.closeGenericModal();
      Toast.show(I.t(id ? "toast.codelist.updated" : "toast.codelist.added"),"ok");
    }catch(e){
      console.error("[codelist] save failed:", e);
      Toast.show("Save failed: " + (e.code || e.message),"err");
    }
  },
  async deleteCodeItem(kind, id){
    if(!State.user) return Toast.show("Not signed in","err");
    const item = (this._codeListData(kind) || []).find(x => x.id === id);
    if(!item) return;
    if(!confirm(I.t("toast.codelist.deleteConfirm", { code: item.code || "" }))) return;
    try{
      await deleteDoc(doc(db, this._codeListColl(kind), id));
      Toast.show(I.t("toast.codelist.deleted"),"ok");
    }catch(e){
      console.error("[codelist] delete failed:", e);
      Toast.show("Delete failed: " + (e.code || e.message),"err");
    }
  },

  // ── ontheline Currencies CRUD (code + symbol + label) ───────────────────
  addCurrency(){ this._openCurrencyModal(null); },
  editCurrency(id){
    const item = (State.onthelineCurrencies || []).find(x => x.id === id);
    this._openCurrencyModal(item || null);
  },
  _openCurrencyModal(item){
    const modal = document.getElementById("generic-modal");
    const body  = document.getElementById("generic-modal-inner");
    if(!modal || !body) return;
    const isEdit = !!item;
    body.innerHTML = `
      <h2 style="margin:0 0 14px;font-size:24px;letter-spacing:-0.01em">${I.t(isEdit ? "admin.currencies.edit.title" : "admin.currencies.add.title")}</h2>
      <div class="field"><label>${I.t("admin.currencies.col.code")}</label>
        <input type="text" id="cur-code" value="${item ? escapeHtml(item.code||"") : ""}" placeholder="${I.t("admin.currencies.code.ph")}" autocomplete="off" maxlength="8"></div>
      <div class="field"><label>${I.t("admin.currencies.col.symbol")}</label>
        <input type="text" id="cur-symbol" value="${item ? escapeHtml(item.symbol||"") : ""}" placeholder="${I.t("admin.currencies.symbol.ph")}" autocomplete="off" maxlength="4"></div>
      <div class="field"><label>${I.t("admin.currencies.col.label")}</label>
        <input type="text" id="cur-label" value="${item ? escapeHtml(item.label||item.companyName||"") : ""}" placeholder="${I.t("admin.currencies.label.ph")}" autocomplete="off"></div>
      <p style="font-size:12px;color:var(--muted);line-height:1.5;margin:0 0 18px">${I.t("admin.currencies.hint")}</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn-ghost" onclick="App.closeGenericModal()">${I.t("orders.modal.close")}</button>
        <button class="btn-primary" onclick="AdminActions.saveCurrency(${item ? `'${item.id}'` : "null"})"><span>${I.t("admin.codelist.save")}</span><span class="arrow">→</span></button>
      </div>
    `;
    modal.classList.add("show");
  },
  async saveCurrency(id){
    if(!State.user) return Toast.show("Not signed in","err");
    const code = (document.getElementById("cur-code")?.value || "").trim().toUpperCase();
    const symbol = (document.getElementById("cur-symbol")?.value || "").trim();
    const label = (document.getElementById("cur-label")?.value || "").trim();
    if(!code) return Toast.show(I.t("toast.codelist.codeRequired"),"err");
    if(!symbol) return Toast.show(I.t("toast.currencies.symbolRequired"),"err");
    // Unique code (case-insensitive)
    const existing = (State.onthelineCurrencies || []).find(x =>
      (x.code||"").toLowerCase() === code.toLowerCase() && x.id !== id);
    if(existing) return Toast.show(I.t("toast.codelist.dupCode", { code }),"err");
    try{
      if(id){
        await updateDoc(doc(db, "ontheline_currencies", id), {
          code, symbol, label,
          updatedAt: serverTimestamp(),
          updatedBy: State.user.email || State.user.uid
        });
      }else{
        await addDoc(collection(db, "ontheline_currencies"), {
          code, symbol, label,
          createdAt: serverTimestamp(),
          createdBy: State.user.email || State.user.uid
        });
      }
      App.closeGenericModal();
      Toast.show(I.t(id ? "toast.codelist.updated" : "toast.codelist.added"),"ok");
    }catch(e){
      console.error("[currencies] save failed:", e);
      Toast.show("Save failed: " + (e.code || e.message),"err");
    }
  },
  async deleteCurrency(id){
    if(!State.user) return Toast.show("Not signed in","err");
    const item = (State.onthelineCurrencies || []).find(x => x.id === id);
    if(!item) return;
    if(!confirm(I.t("toast.codelist.deleteConfirm", { code: item.code || "" }))) return;
    try{
      await deleteDoc(doc(db, "ontheline_currencies", id));
      Toast.show(I.t("toast.codelist.deleted"),"ok");
    }catch(e){
      console.error("[currencies] delete failed:", e);
      Toast.show("Delete failed: " + (e.code || e.message),"err");
    }
  },

  // Toggle whether an end-user-facing UI language is enabled. Stores the full
  // enabled list in config/branding.enabledLangs. "en" can never be disabled.
  async toggleLangEnabled(code){
    if(!State.user) return Toast.show("Not signed in","err");
    if(code === "en") return Toast.show(I.t("toast.langs.enToggle"),"err");
    // Build the current enabled set (null = all enabled).
    let enabled = Array.isArray(State.branding.enabledLangs)
      ? State.branding.enabledLangs.slice()
      : State.langs.map(l => l.code);   // expand "all" to explicit list
    const isOn = enabled.indexOf(code) !== -1;
    if(isOn) enabled = enabled.filter(c => c !== code);
    else enabled.push(code);
    // Always keep "en" present.
    if(enabled.indexOf("en") === -1) enabled.unshift("en");
    // Keep canonical order (per SUPPORTED_LANGS).
    enabled = State.langs.map(l => l.code).filter(c => enabled.indexOf(c) !== -1);
    try{
      await setDoc(doc(db,"config","branding"), {
        enabledLangs: enabled,
        updatedAt: serverTimestamp(),
        updatedBy: State.user.email || State.user.uid
      }, { merge: true });
      Toast.show(I.t(isOn ? "toast.langs.disabled" : "toast.langs.enabled", { lang: code.toUpperCase() }),"ok");
      // subscribeBranding will re-render the picker; also refresh the admin page.
      try{ renderAdminLanguages(); }catch{}
    }catch(e){
      console.error("[langs] toggle failed:", e);
      Toast.show("Update failed: " + (e.code || e.message),"err");
    }
  },

  async uploadBrandFavicon(event){
    if(!State.user) return Toast.show("Not signed in","err");
    const file = event.target.files && event.target.files[0];
    if(!file) return;
    // Favicons are tiny — cap at 100 KB raw. Keeps the Firestore doc small
    // (it shares the 1 MB doc limit with logoDataUrl).
    const MAX_BYTES = 100 * 1024;
    if(file.size > MAX_BYTES){
      event.target.value = "";
      return Toast.show(I.t("toast.branding.favicon.tooLarge", { kb: "100" }),"err");
    }
    // Accept PNG, ICO, SVG, WebP. ICO reports as image/x-icon or image/vnd.microsoft.icon.
    if(!/^image\/(png|x-icon|vnd\.microsoft\.icon|svg\+xml|webp)$/.test(file.type)){
      event.target.value = "";
      return Toast.show(I.t("toast.branding.favicon.badType"),"err");
    }
    try{
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      await setDoc(doc(db,"config","branding"), {
        faviconDataUrl: dataUrl,
        updatedAt: serverTimestamp(),
        updatedBy: State.user.email || State.user.uid
      }, { merge: true });
      Toast.show(I.t("toast.branding.favicon.uploaded"),"ok");
      event.target.value = "";
    }catch(e){
      console.error("[branding] upload favicon failed:", e);
      event.target.value = "";
      Toast.show("Upload failed: " + (e.code || e.message),"err");
    }
  },

  async resetBrandFavicon(){
    if(!State.user) return Toast.show("Not signed in","err");
    if(!confirm(I.t("toast.branding.favicon.resetConfirm"))) return;
    try{
      await updateDoc(doc(db,"config","branding"), {
        faviconDataUrl: deleteField(),
        updatedAt: serverTimestamp(),
        updatedBy: State.user.email || State.user.uid
      });
      Toast.show(I.t("toast.branding.favicon.reset.done"),"ok");
    }catch(e){
      console.error("[branding] reset favicon failed:", e);
      Toast.show("Reset failed: " + (e.code || e.message),"err");
    }
  },

  // ============================================================
  // DM CHAMP INTEGRATION ACTIONS
  // ============================================================
  // Live-refresh the conversion preview as admin types in the rate input.
  // Pure DOM read/write — no Firestore traffic.
  dmchampPreviewRefresh(){
    const rateInput = document.getElementById("dm-rate");
    const echoEl    = document.getElementById("dm-rate-echo");
    const rowsEl    = document.getElementById("dm-preview-rows");
    if(!rateInput || !rowsEl) return;
    const rate = Math.max(1, Number(rateInput.value) || 1);
    if(echoEl) echoEl.textContent = rate.toLocaleString();
    const amounts = [5, 10, 20, 50, 100];
    rowsEl.innerHTML = amounts.map(amt => {
      const credits = Math.max(1, Math.round(amt * rate));
      return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line);font-size:13px">
        <span style="font-family:var(--mono);color:var(--muted)">$${amt}</span>
        <span style="font-weight:600;color:var(--teal-deep)">${credits.toLocaleString()}</span>
      </div>`;
    }).join("");
  },

  // Switch which payment gateway settles NEW direct orders.
  // Only the selection is stored — credentials live in Netlify env vars.
  // Orders already in flight are unaffected: each order records the gateway it
  // was created under, and payment-callback settles it with that one.
  async setActiveGateway(gatewayId){
    if(!State.user) return Toast.show("Not signed in","err");
    const gw = (State.paymentGw?.gateways || []).find(g => g.id === gatewayId);
    if(!gw) return Toast.show(I.t("toast.paymentgw.unknown"),"err");
    if(!gw.configured){
      return Toast.show(I.t("toast.paymentgw.needenv", { list:(gw.missingEnv||[]).join(", ") }),"err");
    }
    if(!confirm(I.t("toast.paymentgw.confirm", { name: gw.displayName }))) return;

    try{
      await setDoc(doc(db,"config","payment"), {
        activeGateway: gatewayId,
        updatedAt: serverTimestamp(),
        updatedBy: State.user.email || State.user.uid || "admin"
      }, { merge:true });
      Toast.show(I.t("toast.paymentgw.saved", { name: gw.displayName }),"ok");
      // The checkout pills are cached per session — drop it so the new
      // gateway's channels appear without a page reload.
      _gwChannelsCache = null;
      await renderAdminPaymentGw();
    }catch(e){
      console.error("[paymentgw] save failed:", e);
      Toast.show(I.t("toast.paymentgw.failed", { error: String(e.message || e) }),"err");
    }
  },

  async saveDmChampConfig(){
    if(!State.user) return Toast.show("Not signed in","err");

    const apiKeyInput  = document.getElementById("dm-apikey");
    const enabledEl    = document.getElementById("dm-enabled");
    const rateEl       = document.getElementById("dm-rate");
    const defaultEl    = document.getElementById("dm-default");
    const rolloverEl   = document.getElementById("dm-rollover");
    const tzEl         = document.getElementById("dm-tz");
    const countryEl    = document.getElementById("dm-country");
    const portalUrlEl  = document.getElementById("dm-portalurl");

    const rate    = Math.max(1, Math.round(Number(rateEl?.value)    || 100));
    const def     = Math.max(1, Math.round(Number(defaultEl?.value) || 1000));
    const tz      = (tzEl?.value      || "Asia/Bangkok").trim();
    const country = (countryEl?.value || "TH").trim().toUpperCase().slice(0,2);

    // portalUrl: trim trailing slash, require http(s) prefix. Empty → default.
    // Validate here so admins can't accidentally save a non-clickable URL into
    // every future email template.
    //
    // STORED IN config/branding (public-read) not config/dmchamp (admin-only),
    // so the customer portal can read it for the "Open DM Champ" buttons.
    // config/dmchamp itself stays admin-only because it holds the API key.
    let portalUrl = (portalUrlEl?.value || "").trim().replace(/\/+$/, "");
    if(portalUrl && !/^https?:\/\//i.test(portalUrl)){
      return Toast.show(I.t("admin.dmchamp.portalUrl.invalid") || "Portal URL must start with http:// or https://", "err");
    }
    if(!portalUrl) portalUrl = "https://app.dmchamp.com";

    // Build update payload for config/dmchamp — only include apiKey if admin
    // entered something (empty input means "keep existing key"). portalUrl is
    // saved separately to config/branding (see below).
    const payload = {
      enabled:               !!enabledEl?.checked,
      creditsPerUsd:         rate,
      defaultMonthlyCredits: def,
      rollOverToNextMonth:   !!rolloverEl?.checked,
      timeZoneId:            tz,
      country:               country,
      updatedAt:             serverTimestamp(),
      updatedBy:             State.user.email || State.user.uid
    };

    const newApiKey = (apiKeyInput?.value || "").trim();
    if(newApiKey){
      payload.apiKey = newApiKey;
    }

    try{
      await setDoc(doc(db,"config","dmchamp"), payload, { merge: true });
      // Mirror the NON-SECRET values into config/branding, which is
      // public-read: config/dmchamp holds the API key so customers can't read
      // it, yet the customer portal needs the portal URL and the credit rate
      // (otherwise every customer falls back to the default 100 and sees wrong
      // credit numbers on My Account / My Orders). The API key is never copied.
      await setDoc(doc(db,"config","branding"), {
        dmchampPortalUrl:     portalUrl,
        dmchampCreditsPerUsd: rate,
        updatedAt:            serverTimestamp(),
        updatedBy:            State.user.email || State.user.uid
      }, { merge: true });
      Toast.show(I.t("toast.dmchamp.saved"),"ok");
      // Clear the input so the masked-key display takes over again
      if(apiKeyInput) apiKeyInput.value = "";
      // Refresh local State so the customer portal reflects immediately
      State.dmchamp.portalUrl     = portalUrl;
      State.dmchamp.creditsPerUsd = rate;
      // Re-render so the masked key + status banner reflect the new state
      try{ renderAdminDmChamp(); }catch{}
    }catch(e){
      console.error("[dmchamp] save failed:", e);
      Toast.show(I.t("toast.dmchamp.saveFail", { error: e.code || e.message }),"err");
    }
  },

  // Manually trigger DM Champ provisioning for a specific order.
  // Calls the Netlify Function directly (NOT via /api/provision-dmchamp alias)
  // because Netlify's edge cache sometimes serves stale 404s for /api/* aliases
  // until the redirect propagates. Same workaround used by delete-customer.
  async retryDmChampForOrder(orderRef, orderId){
    if(!State.user) return Toast.show("Not signed in","err");
    Toast.show(I.t("toast.dmchamp.provisioning"),"info");
    try{
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch("/.netlify/functions/provision-dmchamp", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(orderId ? { orderId } : { orderRef })
      });
      const data = await resp.json().catch(() => ({}));
      if(!resp.ok || !data.ok){
        const err = data.error || `HTTP ${resp.status}`;
        Toast.show(I.t("toast.dmchamp.provisionFail", { error: err }),"err");
        return;
      }
      if(data.alreadyProvisioned){
        Toast.show(I.t("toast.dmchamp.alreadyProvisioned"),"info");
      }else if(data.linked){
        Toast.show(I.t("toast.dmchamp.linked", { email: data.data?.email || "" }),"info");
      }else{
        Toast.show(I.t("toast.dmchamp.provisioned", { email: data.data?.email || "" }),"ok");
      }
      // Re-render orders (and close+re-open the modal so its DM Champ section refreshes)
      try{ renderAdminOrders(); }catch{}
      // If the View modal is open, close it — admin can reopen to see fresh data
      try{ document.getElementById("generic-modal")?.classList.remove("show"); }catch{}
    }catch(e){
      console.error("[dmchamp] retry failed:", e);
      Toast.show(I.t("toast.dmchamp.provisionFail", { error: e.message || String(e) }),"err");
    }
  }
};

// ===========================================================
// TOAST
// ===========================================================
const Toast = {
  show(msg, kind="ok"){
    const wrap = document.getElementById("toast-wrap");
    const t = document.createElement("div");
    t.className = "toast " + kind;
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => {
      t.style.transition = "opacity .3s, transform .3s";
      t.style.opacity = "0";
      t.style.transform = "translateX(20px)";
      setTimeout(() => t.remove(), 320);
    }, 3200);
  }
};

// ===========================================================
// BOOT
// ===========================================================
async function boot(){
  // Auth state listener — single source of truth for who is signed in
  onAuthStateChanged(auth, async (fbUser) => {
    if(fbUser){
      // Try to load Firestore profile by uid. There's a benign race during initial setup:
      // createUserWithEmailAndPassword fires this listener BEFORE setDoc(profile) completes,
      // so we retry once after a short delay if the profile isn't there yet.
      const profileRef = doc(db,"users",fbUser.uid);
      let profileSnap;
      try{
        profileSnap = await getDoc(profileRef);
        if(!profileSnap.exists()){
          // wait briefly then retry
          await new Promise(r => setTimeout(r, 700));
          profileSnap = await getDoc(profileRef);
        }
      }catch(e){
        console.error("Profile load error:", e.code || e.message);
        Toast.show("Error loading profile: " + (e.code || e.message), "err");
        return;
      }

      if(profileSnap && profileSnap.exists()){
        const data = profileSnap.data();
        if(data.role !== "admin" && data.role !== "customer"){
          await signOut(auth);
          Toast.show("This account does not have a recognized role","err");
          return;
        }
        if(data.disabled){
          await signOut(auth);
          Toast.show("This account is disabled","err");
          return;
        }
        const wasAlreadyAuthed = !!State.user; // true if this is a re-fire, not a fresh login
        State.user = {
          uid: fbUser.uid,
          email: fbUser.email,
          name: data.name || (data.role === "admin" ? "Admin" : "Customer"),
          role: data.role,
          mustChangePassword: !!data.mustChangePassword
        };
        if(!wasAlreadyAuthed){
          Toast.show(I.t("toast.login.ok",{name: State.user.name}),"ok");
        }
        // Subscribe to Firestore data appropriate to the role.
        // Admins get all collections; customers get a scoped subscription
        // to their own orders only.
        if(data.role === "admin"){
          subscribeCollections();
        }else{
          subscribeCustomerCollections();
        }
        App.updateAuthUI();
        // Admin-only initialization tasks
        if(data.role === "admin"){
          // Seed default packages if none exist yet (requires admin auth)
          seedPackagesIfNeeded().catch(e => console.warn("seed packages:", e));
          // Auto-merge any NEW translation keys from FULL_TRANSLATIONS into Firestore.
          // This means if I ship new UI strings in an app update, they're automatically
          // available in TH/KO/JA without admin needing to manually click "Import".
          // Existing translations are NEVER overwritten — only missing keys are filled in.
          syncMissingTranslationsToFirestore().catch(e => console.warn("sync translations:", e));
        }
        // Only navigate on first authentication, not on every re-fire
        if(!wasAlreadyAuthed){
          if(data.role === "admin"){
            App.go("admin");
          }else{
            // Customer: go to My Account dashboard.
            // The dashboard itself surfaces the "must change password" prompt
            // when mustChangePassword=true, so we don't need a separate flow.
            App.go("account");
          }
        }
      }else{
        // Auth account exists but no Firestore profile, even after retry.
        // Don't sign out — the caller (setup flow) is responsible for writing the profile.
        // Just wait silently; another auth state change will re-trigger this.
        console.warn("Auth user has no Firestore profile yet (uid=" + fbUser.uid + ")");
      }
    }else{
      // Signed out
      State.user = null;
      unsubscribeCollections();
      App.updateAuthUI();
      // If currently on admin or customer-portal page, bounce back to home
      const onProtectedPage = document.getElementById("page-admin").classList.contains("show")
        || document.getElementById("page-account")?.classList.contains("show")
        || document.getElementById("page-orders")?.classList.contains("show");
      if(onProtectedPage){
        App.go("home");
      }
    }
  });

  try{
    const result = await adminExists();
    if(result === null){
      // Rules are blocking us — we can't tell whether admin exists.
      // Show a banner. Default modal to "Sign In" so user doesn't accidentally
      // try to create a duplicate admin.
      State.hasAdmin = true;
      showRulesBanner();
    }else{
      State.hasAdmin = result;
    }
    updateLoginModalMode();
    await loadOrSeedTranslations();
    await loadPackages();
    // Public subscriptions — keep customer-facing pages live even before login
    subscribePackages();
    subscribeTranslations();
    subscribeBranding();
  }catch(e){
    console.error("Firestore init error:", e);
    Toast.show("Database connection error — check console","err");
  }
  // Note: subscribeCollections() is now called only after admin login succeeds.
  I.apply();
  applyBranding();   // Apply defaults immediately; subscribeBranding() will update once snapshot arrives
  App.buildLangPicker();
  App.updateAuthUI();
  App.renderHome();
  App.renderPackages();
  App.renderAboutBlocks();

  // ----------------------------------------------------------------
  // Initial routing from URL pathname (deep-linking support)
  // ----------------------------------------------------------------
  // The SPA treats /packages, /admin, /admin/orders, /account, etc. as
  // real URLs. If the user types or refreshes on one of those, route there.
  // The page guard inside go() will bounce protected URLs to login.
  try{
    const path = location.pathname;
    const hash = (location.hash || "").replace(/^#/, "");

    const KNOWN_ROUTES = new Set([
      "packages", "checkout", "confirm", "payment-result",
      "account", "orders", "admin"
    ]);

    // Existing /payment-result + #payment-result behaviour preserved
    const onPaymentResultPath = path === "/payment-result" || path.startsWith("/payment-result/");
    const hashIsPaymentResult = hash === "payment-result";

    if(onPaymentResultPath || hashIsPaymentResult){
      App.go("payment-result");
    } else if(path.startsWith("/admin")){
      // /admin or /admin/<tab>
      const m = path.match(/^\/admin\/([^/?#]+)/);
      const subTab = (m && m[1]) || "orders";
      // App.go("admin") will eventually call setAdmin("orders") by default;
      // we override that by calling setAdmin directly after the page swap.
      App.go("admin");
      // If a sub-tab was specified in the URL and user has admin access by
      // the time go() finishes, switch to it. State.user may not be set yet
      // on a cold refresh — in that case the login modal will be open
      // courtesy of go()'s guard, and the requested tab is irrelevant.
      if(subTab !== "orders" && State.user && State.user.role === "admin"){
        App.setAdmin(subTab);
      }
    } else if(path !== "/" && path !== "/index.html"){
      const seg = path.replace(/^\//, "").replace(/\/$/, "").split("/")[0];
      if(KNOWN_ROUTES.has(seg)){
        App.go(seg);
      }
    } else {
      // Landed on /. Seed history.state so popstate has something to work with.
      try{ history.replaceState({ page: "home" }, "", "/"); }catch(e){}
    }
  }catch(e){
    console.warn("Initial route resolution failed:", e);
  }

  // ----------------------------------------------------------------
  // popstate listener — browser back/forward button support.
  // ----------------------------------------------------------------
  // If a modal/drawer is open, back closes it INSTEAD of navigating away.
  // This matches the native Android pattern. Closing a modal via back is
  // implemented by re-pushing the state we just popped, so the next back
  // press will actually navigate.
  window.addEventListener("popstate", (ev) => {
    // Close any open overlay first
    const loginOpen   = document.getElementById("login-modal")?.classList.contains("show");
    const genericOpen = document.getElementById("generic-modal")?.classList.contains("show");
    const drawerOpen  = document.getElementById("drawer")?.classList.contains("open");

    const rePushIfState = () => {
      if(ev.state){
        const url = ev.state.adminTab
          ? "/admin/" + ev.state.adminTab
          : (ev.state.page === "home" ? "/" : "/" + ev.state.page);
        try{ history.pushState(ev.state, "", url); }catch(e){}
      }
    };

    if(loginOpen){   App.closeLogin();        rePushIfState(); return; }
    if(genericOpen){ App.closeGenericModal(); rePushIfState(); return; }
    if(drawerOpen){  App.closeDrawer();       rePushIfState(); return; }

    // No overlay — render the restored state.
    const state = ev.state || { page: "home" };
    if(state.page === "admin" && state.adminTab){
      App.go("admin", { fromPopstate: true });
      App.setAdmin(state.adminTab, null, { fromPopstate: true });
    } else {
      App.go(state.page || "home", { fromPopstate: true });
    }
  });
}

// Adjusts the login modal copy/CTA depending on whether an admin already exists.
// First-time visitors with no admin see a "Setup" mode; afterwards everyone sees "Sign In".
function updateLoginModalMode(){
  const modal = document.getElementById("login-modal");
  if(!modal) return;
  const h2 = modal.querySelector("h2");
  const sub = modal.querySelector(".sub");
  const cta = modal.querySelector(".btn-primary span:first-child");
  const helpText = modal.querySelector("p");
  const emailInput = document.getElementById("li-email");
  const passInput = document.getElementById("li-pass");

  if(!State.hasAdmin){
    if(h2) h2.innerHTML = 'Initial <span class="grad">Setup</span>';
    if(sub) sub.textContent = "Create the first admin account";
    if(cta) cta.textContent = "Create Admin";
    if(helpText) helpText.textContent = "No admin exists yet. The first sign-in creates one.";
    if(emailInput && emailInput.value === "admin@dealpro.io") emailInput.value = "";
    if(passInput) passInput.value = "";
  }else{
    if(h2) h2.innerHTML = I.t("login.title-html");
    if(sub) sub.textContent = I.t("login.sub");
    if(cta) cta.textContent = I.t("login.cta");
    if(helpText) helpText.textContent = "Sign in with your Firebase admin credentials.";
  }
}

// Expose to global so inline onclick handlers work
window.App = App;
window.AdminActions = AdminActions;
window.matchPackagesForAmount = matchPackagesForAmount;
window.updateLoginModalMode = updateLoginModalMode;

boot();

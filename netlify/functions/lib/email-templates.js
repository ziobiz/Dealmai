// ============================================================
// Email Templates Module
// ============================================================
// Provides HTML email templates for invoice, receipt, and credentials
// in 4 languages (EN/TH/KO/JA). Each template returns { subject, html, text }.
//
// Usage:
//   const { renderEmail } = require('./lib/email-templates');
//   const { subject, html, text } = await renderEmail('receipt', 'th', orderData, db);
//
// IMPORTANT: renderEmail is now async (since 29 May 2026) because it reads
// the runtime brand name + portal URL from Firestore config/branding so the
// emails reflect the admin's current "Site Name" setting. Callers must await
// it. If `db` is not passed, falls back to BRAND_DEFAULTS values.
// ============================================================

// Default branding values — used as fallback when Firestore is unavailable
// or when db is not passed to renderEmail (e.g. unit tests). Production
// values come from Firestore config/branding via loadBranding().
const BRAND_DEFAULTS = {
  name: 'Deal Pro',
  tagline: 'AI Sales Agent',
  portalUrl: 'https://deal-pro-ai.netlify.app',
  supportEmail: 'support@deal-pro-ai.example',
  // DM Champ sign-in URL surfaced in emails / CTA buttons. Default is the
  // public app; agency customers with a White-Label custom domain override
  // this via Firestore config/dmchamp.portalUrl (e.g. https://app.dealmai.com)
  // so customers see the branded URL in their inbox.
  dmchampPortalUrl: 'https://app.dmchamp.com'
};

// Design tokens (matching the web app) — these don't change with branding
// settings, so they stay on the module.
const COLORS = {
  bg: '#f6f2ea',
  text: '#1f2126',
  muted: '#6b6b6b',
  teal: '#0bb6c4',
  tealDeep: '#075d63',
  magenta: '#d6299b',
  line: '#e5dfd2'
};

// ------------------------------------------------------------
// Runtime branding loader — reads config/branding from Firestore
// and merges with defaults. Caches the result for 30s to avoid
// hammering Firestore when many emails are sent in a batch.
//
// Also reads PUBLIC_SITE_URL env var as a portalUrl override, since
// that env var represents the production domain (e.g. https://dealmai.com)
// and Firestore branding doesn't store a URL field.
// ------------------------------------------------------------
let _brandCache = null;
let _brandCacheAt = 0;
const BRAND_CACHE_MS = 30_000;

async function loadBranding(db) {
  // Cache hit
  if (_brandCache && (Date.now() - _brandCacheAt) < BRAND_CACHE_MS) {
    return _brandCache;
  }
  // Start from defaults, layer Firestore on top, then env-var overrides
  const merged = { ...BRAND_DEFAULTS };

  // Portal URL: prefer PUBLIC_SITE_URL env var (set in Netlify) since this
  // is the production domain. Falls back to default only if not set.
  if (process.env.PUBLIC_SITE_URL && process.env.PUBLIC_SITE_URL.trim()) {
    merged.portalUrl = process.env.PUBLIC_SITE_URL.trim().replace(/\/+$/, '');
  }
  if (process.env.EMAIL_REPLY_TO && process.env.EMAIL_REPLY_TO.trim()) {
    merged.supportEmail = process.env.EMAIL_REPLY_TO.trim();
  }

  // Firestore: config/branding has { siteName, logoDataUrl, dmchampPortalUrl, ... }
  // This doc is public-read so we can also use it for runtime config that
  // the customer portal needs (the DM Champ portal URL).
  if (db) {
    try {
      const snap = await db.collection('config').doc('branding').get();
      if (snap.exists) {
        const data = snap.data() || {};
        if (data.siteName && typeof data.siteName === 'string' && data.siteName.trim()) {
          merged.name = data.siteName.trim();
        }
        // dmchampPortalUrl — trim trailing slash, require http(s) prefix
        if (typeof data.dmchampPortalUrl === 'string') {
          const trimmed = data.dmchampPortalUrl.trim().replace(/\/+$/, '');
          if (trimmed && /^https?:\/\//i.test(trimmed)) {
            merged.dmchampPortalUrl = trimmed;
          }
        }
      }
    } catch (e) {
      console.warn('[email-templates] Could not load config/branding from Firestore:', e.message || e);
      // Fall through with defaults
    }
  }

  _brandCache = merged;
  _brandCacheAt = Date.now();
  return merged;
}

// Legacy export — kept so any caller still doing `const { BRAND } = require(...)`
// doesn't crash. New code should use loadBranding(db) instead. Note: this
// object is FROZEN at module-load time and won't reflect runtime branding.
const BRAND = {
  ...BRAND_DEFAULTS,
  colors: COLORS
};

// ------------------------------------------------------------
// i18n strings for emails (separate from web app translations
// since these are server-side and don't change at runtime)
// ------------------------------------------------------------
const EMAIL_STRINGS = {
  en: {
    'subject.invoice': 'Invoice {ref} · {brand}',
    'subject.receipt': 'Receipt {ref} · {brand}',
    'subject.credentials': 'Welcome to {brand} · Your access credentials',
    'common.greeting': 'Hello {name},',
    'common.thanks': 'Thank you for choosing {brand}.',
    'common.support': 'Need help? Reply to this email or contact {email}.',
    'common.footer': '{brand} · AI Sales Agent that closes deals 24/7',
    'common.orderRef': 'Order Reference',
    'common.amount': 'Amount',
    'common.date': 'Date',
    'common.items': 'Items',
    'common.subtotal': 'Subtotal',
    'common.vat': 'VAT 7%',
    'common.total': 'Total',
    'invoice.title': 'Invoice',
    'invoice.intro': 'Please find your invoice below. Payment will be processed shortly.',
    'invoice.status': 'Pending payment',
    'receipt.title': 'Payment Receipt',
    'receipt.intro': 'Your payment has been received. Below is your receipt.',
    'receipt.status': 'Paid',
    'creds.title': 'Welcome to {brand}',
    'creds.intro': 'Your AI Sales Agent account has been created. Here are your login credentials:',
    'creds.email': 'Email',
    'creds.password': 'Initial Password',
    'creds.changeNote': 'For security, you will be required to change this password on your first login.',
    'creds.cta': 'Sign In to Portal',
    // DM Champ access email
    'subject.dmchamp': 'Your DealMai Ai workspace is ready',
    'dmchamp.title': 'Your AI workspace is live',
    'dmchamp.intro': 'We have provisioned your DealMai Ai sub-account. Sign in to start configuring your AI sales agent.',
    'dmchamp.email': 'DealMai Ai Email',
    'dmchamp.password': 'Temporary Password',
    'dmchamp.credits': 'Monthly Credits',
    'dmchamp.changeNote': 'Please change this password after your first sign-in. Credits reset on the same day each month.',
    'dmchamp.cta': 'Open DealMai Ai',
    // DM Champ "already exists" linked email
    'subject.dmchamp.linked': 'Your DealMai Ai workspace is linked to this purchase',
    'dmchamp.linked.title': 'Your existing DealMai Ai workspace is now linked',
    'dmchamp.linked.intro': 'We noticed you already have a DealMai Ai account with this email. Your recent purchase has been associated with your existing workspace — please continue to use your current sign-in credentials.',
    'dmchamp.linked.note': 'If you cannot remember your DealMai Ai password, use the "Forgot password" link on the DealMai Ai sign-in page.',
    'subject.refund.cancel': 'Your purchase {ref} was cancelled & refunded',
    'subject.refund.partial': 'Partial refund processed for {ref}',
    'refund.cancel.title': 'Purchase cancelled & refunded',
    'refund.cancel.intro': 'Your recent purchase has been cancelled.',
    'refund.cancel.body': 'We have cancelled your purchase and refunded the amount you paid. The credits that were added with this purchase have been removed from your account.',
    'refund.partial.title': 'Partial refund processed',
    'refund.partial.intro': 'Part of your purchase has been refunded.',
    'refund.partial.body': 'We have refunded part of your payment. Your credit balance from this purchase has been reduced accordingly, as shown below.',
    'refund.amount': 'Refunded amount',
    'refund.creditsRemoved': 'Credits removed',
    'refund.creditsRemaining': 'Credits remaining'
  },
  th: {
    'subject.invoice': 'ใบกำกับ {ref} · {brand}',
    'subject.receipt': 'ใบเสร็จ {ref} · {brand}',
    'subject.credentials': 'ยินดีต้อนรับสู่ {brand} · ข้อมูลเข้าใช้ของคุณ',
    'common.greeting': 'สวัสดี คุณ{name},',
    'common.thanks': 'ขอบคุณที่เลือกใช้ {brand}',
    'common.support': 'ต้องการความช่วยเหลือ? ตอบกลับอีเมลนี้ หรือติดต่อ {email}',
    'common.footer': '{brand} · AI ตัวแทนขายที่ปิดการขายให้คุณ 24/7',
    'common.orderRef': 'เลขที่คำสั่งซื้อ',
    'common.amount': 'จำนวนเงิน',
    'common.date': 'วันที่',
    'common.items': 'รายการ',
    'common.subtotal': 'ยอดรวม',
    'common.vat': 'VAT 7%',
    'common.total': 'ยอดที่ต้องชำระ',
    'invoice.title': 'ใบกำกับภาษี',
    'invoice.intro': 'กรุณาตรวจสอบใบกำกับด้านล่าง การชำระเงินกำลังดำเนินการ',
    'invoice.status': 'รอการชำระเงิน',
    'receipt.title': 'ใบเสร็จรับเงิน',
    'receipt.intro': 'ระบบได้รับการชำระเงินของคุณแล้ว ด้านล่างคือใบเสร็จของคุณ',
    'receipt.status': 'ชำระเงินแล้ว',
    'creds.title': 'ยินดีต้อนรับสู่ {brand}',
    'creds.intro': 'บัญชี AI ตัวแทนขายของคุณถูกสร้างเรียบร้อยแล้ว ด้านล่างคือข้อมูลเข้าใช้:',
    'creds.email': 'อีเมล',
    'creds.password': 'รหัสผ่านเริ่มต้น',
    'creds.changeNote': 'เพื่อความปลอดภัย ระบบจะให้คุณเปลี่ยนรหัสผ่านในการเข้าใช้ครั้งแรก',
    'creds.cta': 'เข้าสู่ระบบ',
    // DM Champ access email
    'subject.dmchamp': 'ระบบ DealMai Ai ของคุณพร้อมใช้งานแล้ว',
    'dmchamp.title': 'ระบบ AI ของคุณพร้อมใช้งาน',
    'dmchamp.intro': 'เราได้สร้างบัญชี DealMai Ai ให้คุณเรียบร้อยแล้ว เข้าสู่ระบบเพื่อเริ่มตั้งค่า AI ตัวแทนขายของคุณ',
    'dmchamp.email': 'อีเมล DealMai Ai',
    'dmchamp.password': 'รหัสผ่านชั่วคราว',
    'dmchamp.credits': 'เครดิตต่อเดือน',
    'dmchamp.changeNote': 'กรุณาเปลี่ยนรหัสผ่านนี้หลังจากเข้าสู่ระบบครั้งแรก เครดิตจะรีเซ็ตในวันเดียวกันของทุกเดือน',
    'dmchamp.cta': 'เปิด DealMai Ai',
    // DM Champ "already exists" linked email
    'subject.dmchamp.linked': 'บัญชี DealMai Ai ของคุณเชื่อมโยงกับการซื้อนี้แล้ว',
    'dmchamp.linked.title': 'บัญชี DealMai Ai ที่มีอยู่ของคุณเชื่อมโยงเรียบร้อยแล้ว',
    'dmchamp.linked.intro': 'เราพบว่าคุณมีบัญชี DealMai Ai ด้วยอีเมลนี้อยู่แล้ว การซื้อล่าสุดของคุณได้เชื่อมโยงกับพื้นที่ทำงานเดิมของคุณ — กรุณาเข้าใช้ด้วยข้อมูลเข้าสู่ระบบที่คุณมีอยู่',
    'dmchamp.linked.note': 'หากจำรหัสผ่าน DealMai Ai ไม่ได้ ใช้ลิงก์ "ลืมรหัสผ่าน" ที่หน้าเข้าสู่ระบบของ DealMai Ai',
    'subject.refund.cancel': 'การซื้อ {ref} ถูกยกเลิกและคืนเงินแล้ว',
    'subject.refund.partial': 'คืนเงินบางส่วนสำหรับ {ref} แล้ว',
    'refund.cancel.title': 'ยกเลิกการซื้อและคืนเงินแล้ว',
    'refund.cancel.intro': 'การซื้อล่าสุดของคุณถูกยกเลิกแล้ว',
    'refund.cancel.body': 'เราได้ยกเลิกการซื้อและคืนยอดเงินที่คุณชำระมาให้แล้ว เครดิตที่ได้รับจากการซื้อนี้ถูกหักออกจากบัญชีของคุณเรียบร้อยแล้ว',
    'refund.partial.title': 'คืนเงินบางส่วนเรียบร้อยแล้ว',
    'refund.partial.intro': 'ส่วนหนึ่งของการซื้อของคุณได้รับการคืนเงินแล้ว',
    'refund.partial.body': 'เราได้คืนเงินบางส่วนให้คุณแล้ว ยอดเครดิตจากการซื้อนี้ถูกปรับลดตามที่แสดงด้านล่าง',
    'refund.amount': 'ยอดเงินที่คืน',
    'refund.creditsRemoved': 'เครดิตที่ถูกหัก',
    'refund.creditsRemaining': 'เครดิตคงเหลือ'
  },
  ko: {
    'subject.invoice': '인보이스 {ref} · {brand}',
    'subject.receipt': '영수증 {ref} · {brand}',
    'subject.credentials': '{brand}에 오신 것을 환영합니다 · 액세스 자격 증명',
    'common.greeting': '안녕하세요, {name}님',
    'common.thanks': '{brand}를 선택해 주셔서 감사합니다.',
    'common.support': '도움이 필요하신가요? 이 이메일에 답장하거나 {email}로 문의하세요.',
    'common.footer': '{brand} · 24/7 거래를 성사시키는 AI 영업 에이전트',
    'common.orderRef': '주문 번호',
    'common.amount': '금액',
    'common.date': '날짜',
    'common.items': '항목',
    'common.subtotal': '소계',
    'common.vat': 'VAT 7%',
    'common.total': '결제 총액',
    'invoice.title': '인보이스',
    'invoice.intro': '아래 인보이스를 확인해 주세요. 결제가 곧 처리됩니다.',
    'invoice.status': '결제 대기 중',
    'receipt.title': '결제 영수증',
    'receipt.intro': '결제가 접수되었습니다. 아래는 귀하의 영수증입니다.',
    'receipt.status': '결제 완료',
    'creds.title': '{brand}에 오신 것을 환영합니다',
    'creds.intro': 'AI 영업 에이전트 계정이 생성되었습니다. 다음은 로그인 자격 증명입니다:',
    'creds.email': '이메일',
    'creds.password': '초기 비밀번호',
    'creds.changeNote': '보안을 위해 첫 로그인 시 이 비밀번호를 변경해야 합니다.',
    'creds.cta': '포털 로그인',
    // DM Champ access email
    'subject.dmchamp': 'DealMai Ai 워크스페이스가 준비되었습니다',
    'dmchamp.title': 'AI 워크스페이스가 활성화되었습니다',
    'dmchamp.intro': 'DealMai Ai 하위 계정이 생성되었습니다. 로그인하여 AI 영업 에이전트 구성을 시작하세요.',
    'dmchamp.email': 'DealMai Ai 이메일',
    'dmchamp.password': '임시 비밀번호',
    'dmchamp.credits': '월간 크레딧',
    'dmchamp.changeNote': '첫 로그인 후 이 비밀번호를 변경해 주세요. 크레딧은 매월 같은 날짜에 재설정됩니다.',
    'dmchamp.cta': 'DealMai Ai 열기',
    // DM Champ "already exists" linked email
    'subject.dmchamp.linked': 'DealMai Ai 워크스페이스가 이번 구매와 연결되었습니다',
    'dmchamp.linked.title': '기존 DealMai Ai 워크스페이스가 연결되었습니다',
    'dmchamp.linked.intro': '이 이메일로 이미 DealMai Ai 계정이 있는 것을 확인했습니다. 최근 구매가 기존 워크스페이스에 연결되었습니다 — 현재 로그인 자격 증명을 계속 사용해 주세요.',
    'dmchamp.linked.note': 'DealMai Ai 비밀번호를 기억할 수 없다면 DealMai Ai 로그인 페이지의 "비밀번호 찾기" 링크를 사용하세요.',
    'subject.refund.cancel': '구매 {ref}이(가) 취소 및 환불되었습니다',
    'subject.refund.partial': '{ref}에 대한 부분 환불이 처리되었습니다',
    'refund.cancel.title': '구매 취소 및 환불 완료',
    'refund.cancel.intro': '최근 구매가 취소되었습니다.',
    'refund.cancel.body': '구매를 취소하고 결제하신 금액을 환불해 드렸습니다. 이 구매로 추가된 크레딧은 계정에서 제거되었습니다.',
    'refund.partial.title': '부분 환불 처리 완료',
    'refund.partial.intro': '구매의 일부가 환불되었습니다.',
    'refund.partial.body': '결제 금액의 일부를 환불해 드렸습니다. 이 구매의 크레딧 잔액이 아래와 같이 차감되었습니다.',
    'refund.amount': '환불 금액',
    'refund.creditsRemoved': '차감된 크레딧',
    'refund.creditsRemaining': '남은 크레딧'
  },
  ja: {
    'subject.invoice': '請求書 {ref} · {brand}',
    'subject.receipt': '領収書 {ref} · {brand}',
    'subject.credentials': '{brand}へようこそ · アクセス認証情報',
    'common.greeting': '{name}様、こんにちは',
    'common.thanks': '{brand}をお選びいただきありがとうございます。',
    'common.support': 'お困りですか? このメールに返信するか、{email}までお問い合わせください。',
    'common.footer': '{brand} · 24/7取引を成立させるAI営業エージェント',
    'common.orderRef': '注文番号',
    'common.amount': '金額',
    'common.date': '日付',
    'common.items': '項目',
    'common.subtotal': '小計',
    'common.vat': 'VAT 7%',
    'common.total': 'お支払い合計',
    'invoice.title': '請求書',
    'invoice.intro': '以下の請求書をご確認ください。お支払いはまもなく処理されます。',
    'invoice.status': 'お支払い保留中',
    'receipt.title': '支払い領収書',
    'receipt.intro': 'お支払いを受け付けました。以下は領収書です。',
    'receipt.status': 'お支払い済み',
    'creds.title': '{brand}へようこそ',
    'creds.intro': 'AI営業エージェントアカウントが作成されました。以下はログイン認証情報です:',
    'creds.email': 'メール',
    'creds.password': '初期パスワード',
    'creds.changeNote': 'セキュリティのため、初回ログイン時にこのパスワードを変更する必要があります。',
    'creds.cta': 'ポータルにサインイン',
    // DM Champ access email
    'subject.dmchamp': 'DealMai Aiワークスペースの準備が整いました',
    'dmchamp.title': 'AIワークスペースが有効になりました',
    'dmchamp.intro': 'DealMai Aiのサブアカウントを作成しました。サインインしてAI営業エージェントの設定を開始してください。',
    'dmchamp.email': 'DealMai Aiメール',
    'dmchamp.password': '仮パスワード',
    'dmchamp.credits': '月間クレジット',
    'dmchamp.changeNote': '初回サインイン後、このパスワードを変更してください。クレジットは毎月同じ日にリセットされます。',
    'dmchamp.cta': 'DealMai Aiを開く',
    // DM Champ "already exists" linked email
    'subject.dmchamp.linked': 'DealMai Aiワークスペースがこの購入にリンクされました',
    'dmchamp.linked.title': '既存のDealMai Aiワークスペースがリンクされました',
    'dmchamp.linked.intro': 'このメールアドレスで既にDealMai Aiアカウントをお持ちであることを確認しました。最近のご購入は既存のワークスペースに関連付けられました — 現在のサインイン認証情報をそのままご利用ください。',
    'dmchamp.linked.note': 'DealMai Aiのパスワードを思い出せない場合は、DealMai Aiのサインインページの「パスワードをお忘れですか」リンクをご利用ください。',
    'subject.refund.cancel': 'ご購入 {ref} はキャンセル・返金されました',
    'subject.refund.partial': '{ref} の一部返金が処理されました',
    'refund.cancel.title': '購入のキャンセルと返金',
    'refund.cancel.intro': '最近のご購入はキャンセルされました。',
    'refund.cancel.body': 'ご購入をキャンセルし、お支払いいただいた金額を返金いたしました。この購入で追加されたクレジットはアカウントから削除されました。',
    'refund.partial.title': '一部返金の処理完了',
    'refund.partial.intro': 'ご購入の一部が返金されました。',
    'refund.partial.body': 'お支払いの一部を返金いたしました。この購入のクレジット残高は以下のとおり減算されました。',
    'refund.amount': '返金額',
    'refund.creditsRemoved': '削除されたクレジット',
    'refund.creditsRemaining': '残りのクレジット'
  }
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
// Look up an i18n string for emails and substitute {placeholder} vars.
//
// IMPORTANT: when calling from a render function that has access to the
// runtime brand name (via loadBranding(db)), always pass `brand` in vars
// so {brand} placeholders in the string get filled in. Strings like
// 'creds.title' = 'Welcome to {brand}' depend on this — without `brand`
// in vars, the literal '{brand}' would appear in the email.
//
// Example:
//   const brand = await loadBranding(db);
//   t('en', 'creds.title', { brand: brand.name })  // → "Welcome to Dealmai"
function t(lang, key, vars = {}) {
  const dict = EMAIL_STRINGS[lang] || EMAIL_STRINGS.en;
  let s = dict[key] || EMAIL_STRINGS.en[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return s;
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtMoney(n, currency = 'USD') {
  const num = Number(n) || 0;
  return `${currency === 'USD' ? '$' : ''}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d, lang = 'en') {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const locale = { en: 'en-US', th: 'th-TH', ko: 'ko-KR', ja: 'ja-JP' }[lang] || 'en-US';
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
}

// ------------------------------------------------------------
// Shared HTML wrapper — keeps consistent branding across all emails
// ------------------------------------------------------------
function wrapHtml(lang, title, contentHtml, brand) {
  const c = COLORS;
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${c.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;color:${c.text};line-height:1.6">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${c.bg};padding:40px 20px">
  <tr><td align="center">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.05)">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,${c.tealDeep} 0%,${c.teal} 100%);padding:32px 40px">
        <div style="color:#ffffff;font-size:13px;letter-spacing:.15em;text-transform:uppercase;opacity:.8;margin-bottom:6px">${brand.tagline}</div>
        <div style="color:#ffffff;font-size:28px;font-weight:600;letter-spacing:-.02em">${brand.name}</div>
      </td></tr>
      <!-- Content -->
      <tr><td style="padding:40px">
        ${contentHtml}
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#fafaf6;padding:24px 40px;border-top:1px solid ${c.line};text-align:center">
        <p style="margin:0;font-size:12px;color:${c.muted}">${esc(t(lang, 'common.footer', { brand: brand.name }))}</p>
        <p style="margin:8px 0 0 0;font-size:11px;color:${c.muted}">
          <a href="${brand.portalUrl}" style="color:${c.tealDeep};text-decoration:none">${brand.portalUrl}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ------------------------------------------------------------
// Order line items table (used by invoice + receipt)
// ------------------------------------------------------------
function renderItemsTable(items, lang, currency) {
  const c = COLORS;
  const rows = (items || []).map(item => `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid ${c.line};font-size:14px">
        ${esc(item.title || item.id || '')}${item.manual ? ` <span style="color:${c.muted};font-size:12px">(manual)</span>` : ''}
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid ${c.line};font-size:14px;text-align:right;font-variant-numeric:tabular-nums">
        ${fmtMoney(item.price, currency)}
      </td>
    </tr>
  `).join('');

  return `
    <table cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0">
      <thead>
        <tr>
          <th align="left"  style="padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};font-weight:500;border-bottom:2px solid ${c.line}">${esc(t(lang, 'common.items'))}</th>
          <th align="right" style="padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};font-weight:500;border-bottom:2px solid ${c.line}">${esc(t(lang, 'common.amount'))}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderTotalsTable(order, lang) {
  const c = COLORS;
  const cur = order.currency || 'USD';
  return `
    <table cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:16px">
      <tr>
        <td style="padding:6px 8px;font-size:14px;color:${c.muted}">${esc(t(lang, 'common.subtotal'))}</td>
        <td style="padding:6px 8px;font-size:14px;text-align:right;font-variant-numeric:tabular-nums">${fmtMoney(order.subtotal, cur)}</td>
      </tr>
      <tr>
        <td style="padding:6px 8px;font-size:14px;color:${c.muted}">${esc(t(lang, 'common.vat'))}</td>
        <td style="padding:6px 8px;font-size:14px;text-align:right;font-variant-numeric:tabular-nums">${fmtMoney(order.vat, cur)}</td>
      </tr>
      <tr>
        <td style="padding:12px 8px;font-size:16px;font-weight:600;border-top:2px solid ${c.text}">${esc(t(lang, 'common.total'))}</td>
        <td style="padding:12px 8px;font-size:18px;font-weight:600;text-align:right;color:${c.tealDeep};font-variant-numeric:tabular-nums;border-top:2px solid ${c.text}">${fmtMoney(order.total, cur)}</td>
      </tr>
    </table>
  `;
}

// ------------------------------------------------------------
// Invoice template
// ------------------------------------------------------------
function renderInvoice(lang, order, brand) {
  const c = COLORS;
  const name = order.customer?.name || '';
  const dateStr = fmtDate(order.createdAt || new Date(), lang);

  const content = `
    <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:600;color:${c.text}">${esc(t(lang, 'invoice.title'))}</h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:${c.muted}">${esc(t(lang, 'invoice.intro'))}</p>
    <p style="margin:0 0 16px 0;font-size:15px">${esc(t(lang, 'common.greeting', { name }))}</p>
    <table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf6;border-radius:8px;padding:0;margin:16px 0">
      <tr>
        <td style="padding:16px 20px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:4px">${esc(t(lang, 'common.orderRef'))}</div>
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:16px;font-weight:600">${esc(order.ref)}</div>
        </td>
        <td style="padding:16px 20px;text-align:right">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:4px">${esc(t(lang, 'common.date'))}</div>
          <div style="font-size:14px">${esc(dateStr)}</div>
        </td>
      </tr>
    </table>
    <div style="display:inline-block;padding:6px 12px;background:${c.bg};border-radius:6px;font-size:12px;color:${c.muted};margin-bottom:16px">
      ${esc(t(lang, 'invoice.status'))}
    </div>
    ${renderItemsTable(order.items, lang, order.currency)}
    ${renderTotalsTable(order, lang)}
    <p style="margin:32px 0 0 0;font-size:13px;color:${c.muted}">${esc(t(lang, 'common.support', { email: brand.supportEmail }))}</p>
  `;

  const subject = t(lang, 'subject.invoice', { ref: order.ref, brand: brand.name });
  const text = [
    t(lang, 'invoice.title'),
    '',
    t(lang, 'common.greeting', { name }),
    t(lang, 'invoice.intro'),
    '',
    `${t(lang, 'common.orderRef')}: ${order.ref}`,
    `${t(lang, 'common.date')}: ${dateStr}`,
    `${t(lang, 'invoice.status')}`,
    '',
    `${t(lang, 'common.items')}:`,
    ...(order.items || []).map(i => `  - ${i.title}${i.manual ? ' (manual)' : ''}: ${fmtMoney(i.price, order.currency)}`),
    '',
    `${t(lang, 'common.subtotal')}: ${fmtMoney(order.subtotal, order.currency)}`,
    `${t(lang, 'common.vat')}: ${fmtMoney(order.vat, order.currency)}`,
    `${t(lang, 'common.total')}: ${fmtMoney(order.total, order.currency)}`,
    '',
    t(lang, 'common.support', { email: brand.supportEmail }),
    '',
    t(lang, 'common.footer', { brand: brand.name })
  ].join('\n');

  return { subject, html: wrapHtml(lang, subject, content, brand), text };
}

// ------------------------------------------------------------
// Receipt template
// ------------------------------------------------------------
function renderReceipt(lang, order, brand) {
  const c = COLORS;
  const name = order.customer?.name || '';
  const dateStr = fmtDate(order.createdAt || new Date(), lang);

  const content = `
    <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:600;color:${c.text}">${esc(t(lang, 'receipt.title'))}</h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:${c.muted}">${esc(t(lang, 'receipt.intro'))}</p>
    <p style="margin:0 0 16px 0;font-size:15px">${esc(t(lang, 'common.greeting', { name }))}</p>
    <p style="margin:0 0 16px 0;font-size:15px">${esc(t(lang, 'common.thanks', { brand: brand.name }))}</p>
    <table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf6;border-radius:8px;padding:0;margin:16px 0">
      <tr>
        <td style="padding:16px 20px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:4px">${esc(t(lang, 'common.orderRef'))}</div>
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:16px;font-weight:600">${esc(order.ref)}</div>
        </td>
        <td style="padding:16px 20px;text-align:right">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:4px">${esc(t(lang, 'common.date'))}</div>
          <div style="font-size:14px">${esc(dateStr)}</div>
        </td>
      </tr>
    </table>
    <div style="display:inline-block;padding:6px 12px;background:${c.teal};color:#ffffff;border-radius:6px;font-size:12px;font-weight:500;margin-bottom:16px">
      ✓ ${esc(t(lang, 'receipt.status'))}
    </div>
    ${renderItemsTable(order.items, lang, order.currency)}
    ${renderTotalsTable(order, lang)}
    <p style="margin:32px 0 0 0;font-size:13px;color:${c.muted}">${esc(t(lang, 'common.support', { email: brand.supportEmail }))}</p>
  `;

  const subject = t(lang, 'subject.receipt', { ref: order.ref, brand: brand.name });
  const text = [
    t(lang, 'receipt.title'),
    '',
    t(lang, 'common.greeting', { name }),
    t(lang, 'receipt.intro'),
    t(lang, 'common.thanks', { brand: brand.name }),
    '',
    `${t(lang, 'common.orderRef')}: ${order.ref}`,
    `${t(lang, 'common.date')}: ${dateStr}`,
    `Status: ${t(lang, 'receipt.status')} ✓`,
    '',
    `${t(lang, 'common.items')}:`,
    ...(order.items || []).map(i => `  - ${i.title}${i.manual ? ' (manual)' : ''}: ${fmtMoney(i.price, order.currency)}`),
    '',
    `${t(lang, 'common.subtotal')}: ${fmtMoney(order.subtotal, order.currency)}`,
    `${t(lang, 'common.vat')}: ${fmtMoney(order.vat, order.currency)}`,
    `${t(lang, 'common.total')}: ${fmtMoney(order.total, order.currency)}`,
    '',
    t(lang, 'common.support', { email: brand.supportEmail }),
    '',
    t(lang, 'common.footer', { brand: brand.name })
  ].join('\n');

  return { subject, html: wrapHtml(lang, subject, content, brand), text };
}

// ------------------------------------------------------------
// Credentials template (welcome email with initial password)
// ------------------------------------------------------------
function renderCredentials(lang, order, brand) {
  const c = COLORS;
  const name = order.customer?.name || '';
  const email = order.customer?.email || '';
  const password = order.initialPassword;

  const content = `
    <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:600;color:${c.text}">${esc(t(lang, 'creds.title', { brand: brand.name }))}</h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:${c.muted}">${esc(t(lang, 'creds.intro'))}</p>
    <p style="margin:0 0 16px 0;font-size:15px">${esc(t(lang, 'common.greeting', { name }))}</p>
    ${password ? `
    <table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf6;border-radius:8px;margin:24px 0">
      <tr>
        <td style="padding:20px 24px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:6px">${esc(t(lang, 'creds.email'))}</div>
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:15px;font-weight:600;margin-bottom:16px">${esc(email)}</div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:6px">${esc(t(lang, 'creds.password'))}</div>
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:15px;font-weight:600;color:${c.magenta};background:#ffffff;padding:8px 12px;border-radius:6px;display:inline-block;letter-spacing:.05em">${esc(password)}</div>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0;padding:12px 16px;background:#fef9e7;border-left:3px solid ${c.magenta};font-size:13px;color:${c.muted};border-radius:4px">
      ⚠ ${esc(t(lang, 'creds.changeNote'))}
    </p>
    ` : `
    <p style="margin:16px 0;font-size:14px;color:${c.muted}">
      Account: <strong style="color:${c.text}">${esc(email)}</strong>
    </p>
    `}
    <table cellspacing="0" cellpadding="0" border="0" style="margin:32px 0">
      <tr><td>
        <a href="${brand.portalUrl}" style="display:inline-block;padding:14px 28px;background:${c.tealDeep};color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:500">${esc(t(lang, 'creds.cta'))} →</a>
      </td></tr>
    </table>
    <p style="margin:32px 0 0 0;font-size:13px;color:${c.muted}">${esc(t(lang, 'common.support', { email: brand.supportEmail }))}</p>
  `;

  const subject = t(lang, 'subject.credentials', { brand: brand.name });
  const textLines = [
    t(lang, 'creds.title', { brand: brand.name }),
    '',
    t(lang, 'common.greeting', { name }),
    t(lang, 'creds.intro'),
    '',
    `${t(lang, 'creds.email')}: ${email}`
  ];
  if (password) {
    textLines.push(`${t(lang, 'creds.password')}: ${password}`);
    textLines.push('');
    textLines.push(`⚠ ${t(lang, 'creds.changeNote')}`);
  }
  textLines.push('');
  textLines.push(`${t(lang, 'creds.cta')}: ${brand.portalUrl}`);
  textLines.push('');
  textLines.push(t(lang, 'common.support', { email: brand.supportEmail }));
  textLines.push('');
  textLines.push(t(lang, 'common.footer', { brand: brand.name }));

  return { subject, html: wrapHtml(lang, subject, content, brand), text: textLines.join('\n') };
}

// ------------------------------------------------------------
// DM Champ access template (sub-account credentials)
// ------------------------------------------------------------
function renderDmChampAccess(lang, order, brand) {
  const c = COLORS;
  const name = order.customer?.name || '';
  const dm = order.dmchamp || {};
  const dmEmail    = dm.email || order.customer?.email || '';
  const dmPassword = dm.tempPassword || '';
  const dmCredits  = Number.isFinite(Number(dm.monthlyCredits)) ? Number(dm.monthlyCredits) : null;
  const portalUrl  = brand.dmchampPortalUrl;

  const content = `
    <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:600;color:${c.text}">${esc(t(lang, 'dmchamp.title'))}</h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:${c.muted}">${esc(t(lang, 'dmchamp.intro'))}</p>
    <p style="margin:0 0 16px 0;font-size:15px">${esc(t(lang, 'common.greeting', { name }))}</p>
    <table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf6;border-radius:8px;margin:24px 0">
      <tr>
        <td style="padding:20px 24px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:6px">${esc(t(lang, 'dmchamp.email'))}</div>
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:15px;font-weight:600;margin-bottom:16px">${esc(dmEmail)}</div>
          ${dmPassword ? `
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:6px">${esc(t(lang, 'dmchamp.password'))}</div>
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:15px;font-weight:600;color:${c.magenta};background:#ffffff;padding:8px 12px;border-radius:6px;display:inline-block;letter-spacing:.05em;margin-bottom:16px">${esc(dmPassword)}</div>
          ` : ''}
          ${dmCredits !== null ? `
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:6px">${esc(t(lang, 'dmchamp.credits'))}</div>
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:15px;font-weight:600;color:${c.tealDeep}">${dmCredits.toLocaleString()}</div>
          ` : ''}
        </td>
      </tr>
    </table>
    ${dmPassword ? `
    <p style="margin:16px 0;padding:12px 16px;background:#fef9e7;border-left:3px solid ${c.magenta};font-size:13px;color:${c.muted};border-radius:4px">
      ⚠ ${esc(t(lang, 'dmchamp.changeNote'))}
    </p>` : ''}
    <table cellspacing="0" cellpadding="0" border="0" style="margin:32px 0">
      <tr><td>
        <a href="${portalUrl}" style="display:inline-block;padding:14px 28px;background:${c.tealDeep};color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:500">${esc(t(lang, 'dmchamp.cta'))} →</a>
      </td></tr>
    </table>
    <p style="margin:32px 0 0 0;font-size:13px;color:${c.muted}">${esc(t(lang, 'common.support', { email: brand.supportEmail }))}</p>
  `;

  const subject = t(lang, 'subject.dmchamp');
  const textLines = [
    t(lang, 'dmchamp.title'),
    '',
    t(lang, 'common.greeting', { name }),
    t(lang, 'dmchamp.intro'),
    '',
    `${t(lang, 'dmchamp.email')}: ${dmEmail}`
  ];
  if (dmPassword) {
    textLines.push(`${t(lang, 'dmchamp.password')}: ${dmPassword}`);
  }
  if (dmCredits !== null) {
    textLines.push(`${t(lang, 'dmchamp.credits')}: ${dmCredits.toLocaleString()}`);
  }
  if (dmPassword) {
    textLines.push('');
    textLines.push(`⚠ ${t(lang, 'dmchamp.changeNote')}`);
  }
  textLines.push('');
  textLines.push(`${t(lang, 'dmchamp.cta')}: ${portalUrl}`);
  textLines.push('');
  textLines.push(t(lang, 'common.support', { email: brand.supportEmail }));
  textLines.push('');
  textLines.push(t(lang, 'common.footer', { brand: brand.name }));

  return { subject, html: wrapHtml(lang, subject, content, brand), text: textLines.join('\n') };
}

// ------------------------------------------------------------
// DM Champ "linked" template (existing account associated with purchase)
// Sent when DM Champ rejects sub-account create because the email is
// already in use. Differs from the access template: no temp password,
// no first-sign-in warning — the customer already has their own creds.
// ------------------------------------------------------------
function renderDmChampLinked(lang, order, brand) {
  const c = COLORS;
  const name = order.customer?.name || '';
  const dm = order.dmchamp || {};
  const dmEmail   = dm.email || order.customer?.email || '';
  const dmCredits = Number.isFinite(Number(dm.monthlyCredits)) ? Number(dm.monthlyCredits) : null;
  const portalUrl = brand.dmchampPortalUrl;

  const content = `
    <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:600;color:${c.text}">${esc(t(lang, 'dmchamp.linked.title'))}</h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:${c.muted}">${esc(t(lang, 'dmchamp.linked.intro'))}</p>
    <p style="margin:0 0 16px 0;font-size:15px">${esc(t(lang, 'common.greeting', { name }))}</p>
    <table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf6;border-radius:8px;margin:24px 0">
      <tr>
        <td style="padding:20px 24px">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:6px">${esc(t(lang, 'dmchamp.email'))}</div>
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:15px;font-weight:600;margin-bottom:16px">${esc(dmEmail)}</div>
          ${dmCredits !== null ? `
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:6px">${esc(t(lang, 'dmchamp.credits'))}</div>
          <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:15px;font-weight:600;color:${c.tealDeep}">${dmCredits.toLocaleString()}</div>
          ` : ''}
        </td>
      </tr>
    </table>
    <p style="margin:16px 0;padding:12px 16px;background:rgba(11,182,196,.06);border-left:3px solid ${c.teal};font-size:13px;color:${c.muted};border-radius:4px">
      ℹ ${esc(t(lang, 'dmchamp.linked.note'))}
    </p>
    <table cellspacing="0" cellpadding="0" border="0" style="margin:32px 0">
      <tr><td>
        <a href="${portalUrl}" style="display:inline-block;padding:14px 28px;background:${c.tealDeep};color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:500">${esc(t(lang, 'dmchamp.cta'))} →</a>
      </td></tr>
    </table>
    <p style="margin:32px 0 0 0;font-size:13px;color:${c.muted}">${esc(t(lang, 'common.support', { email: brand.supportEmail }))}</p>
  `;

  const subject = t(lang, 'subject.dmchamp.linked');
  const textLines = [
    t(lang, 'dmchamp.linked.title'),
    '',
    t(lang, 'common.greeting', { name }),
    t(lang, 'dmchamp.linked.intro'),
    '',
    `${t(lang, 'dmchamp.email')}: ${dmEmail}`
  ];
  if (dmCredits !== null) {
    textLines.push(`${t(lang, 'dmchamp.credits')}: ${dmCredits.toLocaleString()}`);
  }
  textLines.push('');
  textLines.push(`ℹ ${t(lang, 'dmchamp.linked.note')}`);
  textLines.push('');
  textLines.push(`${t(lang, 'dmchamp.cta')}: ${portalUrl}`);
  textLines.push('');
  textLines.push(t(lang, 'common.support', { email: brand.supportEmail }));
  textLines.push('');
  textLines.push(t(lang, 'common.footer', { brand: brand.name }));

  return { subject, html: wrapHtml(lang, subject, content, brand), text: textLines.join('\n') };
}

// ------------------------------------------------------------
// Refund / cancel emails (ontheline reversal events)
//   refund_cancel  → Unpaid / Refund: full reversal, all credits removed
//   partial_refund → Partial Refund: partial reversal, some credits remain
// ------------------------------------------------------------
function fmtCur(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ''}`.trim();
}

function renderRefundCancel(lang, order, brand) {
  const c = COLORS;
  const name = order.customer?.name || '';
  const refundTxt = fmtCur(order.refundAmountOriginal, order.currency);
  const creditsDeducted = Number(order.creditsDeducted) || 0;

  const content = `
    <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:600;color:${c.text}">${esc(t(lang, 'refund.cancel.title'))}</h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:${c.muted}">${esc(t(lang, 'refund.cancel.intro'))}</p>
    <p style="margin:0 0 16px 0;font-size:15px">${esc(t(lang, 'common.greeting', { name }))}</p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6">${esc(t(lang, 'refund.cancel.body'))}</p>
    <table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf6;border-radius:8px;margin:24px 0">
      <tr><td style="padding:20px 24px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:6px">${esc(t(lang, 'refund.amount'))}</div>
        <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:18px;font-weight:600;color:${c.text};margin-bottom:16px">${esc(refundTxt)}</div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:6px">${esc(t(lang, 'refund.creditsRemoved'))}</div>
        <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:18px;font-weight:600;color:#c8463d">−${creditsDeducted.toLocaleString()}</div>
      </td></tr>
    </table>
    <p style="margin:32px 0 0 0;font-size:13px;color:${c.muted}">${esc(t(lang, 'common.support', { email: brand.supportEmail }))}</p>
  `;
  const subject = t(lang, 'subject.refund.cancel', { ref: order.ref });
  const text = [
    t(lang, 'refund.cancel.title'), '',
    t(lang, 'common.greeting', { name }),
    t(lang, 'refund.cancel.body'), '',
    `${t(lang, 'refund.amount')}: ${refundTxt}`,
    `${t(lang, 'refund.creditsRemoved')}: -${creditsDeducted.toLocaleString()}`, '',
    t(lang, 'common.support', { email: brand.supportEmail }), '',
    t(lang, 'common.footer', { brand: brand.name })
  ].join('\n');
  return { subject, html: wrapHtml(lang, subject, content, brand), text };
}

function renderPartialRefund(lang, order, brand) {
  const c = COLORS;
  const name = order.customer?.name || '';
  const refundTxt = fmtCur(order.refundAmountOriginal, order.currency);
  const creditsDeducted = Number(order.creditsDeducted) || 0;
  const creditsRemaining = Number(order.creditsRemaining) || 0;

  const content = `
    <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:600;color:${c.text}">${esc(t(lang, 'refund.partial.title'))}</h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:${c.muted}">${esc(t(lang, 'refund.partial.intro'))}</p>
    <p style="margin:0 0 16px 0;font-size:15px">${esc(t(lang, 'common.greeting', { name }))}</p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6">${esc(t(lang, 'refund.partial.body'))}</p>
    <table cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#fafaf6;border-radius:8px;margin:24px 0">
      <tr><td style="padding:20px 24px">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:6px">${esc(t(lang, 'refund.amount'))}</div>
        <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:18px;font-weight:600;color:${c.text};margin-bottom:16px">${esc(refundTxt)}</div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:6px">${esc(t(lang, 'refund.creditsRemoved'))}</div>
        <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:16px;font-weight:600;color:#c8463d;margin-bottom:16px">−${creditsDeducted.toLocaleString()}</div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${c.muted};margin-bottom:6px">${esc(t(lang, 'refund.creditsRemaining'))}</div>
        <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:18px;font-weight:600;color:${c.tealDeep}">${creditsRemaining.toLocaleString()}</div>
      </td></tr>
    </table>
    <p style="margin:32px 0 0 0;font-size:13px;color:${c.muted}">${esc(t(lang, 'common.support', { email: brand.supportEmail }))}</p>
  `;
  const subject = t(lang, 'subject.refund.partial', { ref: order.ref });
  const text = [
    t(lang, 'refund.partial.title'), '',
    t(lang, 'common.greeting', { name }),
    t(lang, 'refund.partial.body'), '',
    `${t(lang, 'refund.amount')}: ${refundTxt}`,
    `${t(lang, 'refund.creditsRemoved')}: -${creditsDeducted.toLocaleString()}`,
    `${t(lang, 'refund.creditsRemaining')}: ${creditsRemaining.toLocaleString()}`, '',
    t(lang, 'common.support', { email: brand.supportEmail }), '',
    t(lang, 'common.footer', { brand: brand.name })
  ].join('\n');
  return { subject, html: wrapHtml(lang, subject, content, brand), text };
}

// ------------------------------------------------------------
// Public API: renderEmail(kind, lang, orderData, db)
//
// ASYNC since 29 May 2026 — loads runtime branding (site name) from
// Firestore config/branding so emails reflect the admin's current
// "Site Name" setting. Pass the firebase-admin Firestore instance as
// the 4th argument; if omitted, falls back to BRAND_DEFAULTS.
// ------------------------------------------------------------
async function renderEmail(kind, lang, order, db) {
  // Normalize language code — fallback to 'en' if unsupported
  const lc = EMAIL_STRINGS[lang] ? lang : 'en';
  // Load runtime branding (cached 30s). Falls back to defaults if db missing.
  const brand = await loadBranding(db);
  // order is expected to have: ref, customer{name,email,country}, items, subtotal, vat, total, currency, createdAt, [initialPassword]
  switch (kind) {
    case 'invoice':         return renderInvoice(lc, order, brand);
    case 'receipt':         return renderReceipt(lc, order, brand);
    case 'credentials':     return renderCredentials(lc, order, brand);
    case 'dmchamp_access':  return renderDmChampAccess(lc, order, brand);
    case 'dmchamp_linked':  return renderDmChampLinked(lc, order, brand);
    case 'refund_cancel':   return renderRefundCancel(lc, order, brand);
    case 'partial_refund':  return renderPartialRefund(lc, order, brand);
    default:
      throw new Error(`Unknown email kind: ${kind}`);
  }
}

module.exports = { renderEmail, loadBranding, BRAND, BRAND_DEFAULTS };

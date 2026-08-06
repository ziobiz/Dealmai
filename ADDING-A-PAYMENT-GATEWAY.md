# คู่มือ: เพิ่ม Payment Gateway ใหม่ใน DealMai

เอกสารนี้สรุปทุกขั้นตอนสำหรับเพิ่มผู้ให้บริการรับชำระเงินรายใหม่ (เช่น Omise, 2C2P, GB Prime, Stripe)
เข้าระบบ DealMai สำหรับรายการขายตรง (direct/web)

> **หลักการ:** ตรรกะทางธุรกิจทั้งหมด (สร้าง order, คำนวณ VAT, สร้างผู้ใช้, ส่งอีเมล, ให้เครดิต DM Champ)
> เป็นกลางอยู่แล้ว — สิ่งที่ต้องเขียนใหม่คือ **ไฟล์ adapter ไฟล์เดียว** ที่แปลงภาษาของผู้ให้บริการ
> ให้เป็นภาษากลางของระบบ

---

## ภาพรวม 10 ขั้นตอน

| # | ขั้นตอน | ทำที่ไหน | เวลาโดยประมาณ |
|---|---|---|---|
| 1 | รวบรวมข้อมูลจากผู้ให้บริการ | เอกสาร API ของผู้ให้บริการ | — |
| 2 | เขียนไฟล์ adapter | `lib/gateways/<id>.js` | หลัก |
| 3 | ลงทะเบียนใน registry | `lib/gateways/index.js` | 1 บรรทัด |
| 4 | เพิ่มคำแปลของช่องทางชำระเงิน | `app.js` (4 ภาษา) | ถ้ามีช่องทางใหม่ |
| 5 | ตั้ง environment variables | Netlify dashboard | — |
| 6 | Deploy | Netlify | — |
| 7 | ตรวจสอบด้วย diagnostic | เบราว์เซอร์ | 1 นาที |
| 8 | ลงทะเบียน URL กับผู้ให้บริการ | dashboard ของผู้ให้บริการ | — |
| 9 | ทดสอบใน sandbox | เว็บ + admin | สำคัญที่สุด |
| 10 | เปิดใช้งานจริง | Admin → Payment Gateway | 1 คลิก |

---

## ขั้นที่ 1 — รวบรวมข้อมูลจากผู้ให้บริการ

ก่อนเขียนโค้ด ต้องได้คำตอบเหล่านี้จากเอกสาร API:

- **Endpoint** สำหรับสร้างรายการชำระเงิน (sandbox + production แยกกัน)
- **Credentials** ที่ต้องใช้ (merchant id, api key, secret key ฯลฯ)
- **วิธีเซ็น request** (MD5 / HMAC-SHA256 / Basic Auth / Bearer token) และ**ลำดับฟิลด์**ที่ใช้คำนวณ
- **รูปแบบ payload** ที่ต้องส่ง (form-urlencoded หรือ JSON)
- **รูปแบบ response** — ฟิลด์ไหนคือ URL ที่ต้อง redirect ลูกค้าไป
- **รูปแบบ callback** ที่ผู้ให้บริการจะยิงกลับมา (form / JSON, ฟิลด์อะไรบ้าง)
- **วิธีตรวจสอบ callback** ว่าเป็นของจริง (checksum / signature header)
- **รหัสสถานะ** — ค่าไหนแปลว่าจ่ายสำเร็จ ค่าไหนแปลว่าล้มเหลว
- **สกุลเงินที่รับ** และ**ยอดขั้นต่ำ**
- **หน่วยของจำนวนเงิน** — บาท หรือ สตางค์ (ChillPay ใช้สตางค์: 35.00 บาท = `3500`)
- **รหัสช่องทางชำระเงิน** (credit card, QR, mobile banking ฯลฯ)

> ⚠️ **บทเรียนจาก ChillPay:** ลำดับฟิลด์ในการคำนวณ checksum ในเอกสารอาจไม่ตรงกับของจริง
> ต้องทดสอบกับ sandbox จริงเสมอ อย่าเชื่อเอกสารอย่างเดียว

---

## ขั้นที่ 2 — เขียนไฟล์ adapter

สร้างไฟล์ `netlify/functions/lib/gateways/<id>.js`
วิธีที่เร็วที่สุดคือ **คัดลอก `chillpay.js` มาแก้** เพราะมีคอมเมนต์อธิบายทุกจุดอยู่แล้ว

### สัญญาที่ต้อง implement

```js
module.exports = {
  // ---------- ข้อมูลพื้นฐาน ----------
  id: 'omise',                    // ตัวพิมพ์เล็ก ใช้เป็น key ทุกที่ (?gw=omise)
  displayName: 'Omise',           // ชื่อที่แสดงใน admin
  currency: 'THB',                // สกุลที่ใช้ชำระจริง (ระบบจะแปลง USD → สกุลนี้ให้)
  minAmount: 20,                  // ยอดขั้นต่ำในสกุลข้างบน
  refPrefix: 'OM',                // จะได้ ref เป็น DP-OM-XXXXXX (ต้องไม่ซ้ำเจ้าอื่น)
  channels: [                     // ช่องทางที่จะแสดงเป็นปุ่มในหน้า checkout
    { code: 'credit_card',  labelKey: 'checkout.channel.card' },
    { code: 'promptpay',    labelKey: 'checkout.channel.qr' },
  ],

  // ---------- ตรวจสอบการตั้งค่า ----------
  validateConfig() {
    const missing = [];
    if (!process.env.OMISE_PUBLIC_KEY) missing.push('OMISE_PUBLIC_KEY');
    if (!process.env.OMISE_SECRET_KEY) missing.push('OMISE_SECRET_KEY');
    return { ok: missing.length === 0, missing };
  },

  // ---------- ข้อมูลสำหรับหน้า admin (ห้ามคืนค่าลับ!) ----------
  describe() {
    return {
      id: 'omise',
      displayName: 'Omise',
      mode: process.env.OMISE_MODE || 'test',
      endpoint: '...',
      currency: 'THB',
      env: {
        // แสดงแค่ "set" / "(NOT SET)" หรือค่าที่ไม่ลับ เช่น merchant code
        OMISE_SECRET_KEY: process.env.OMISE_SECRET_KEY ? 'set' : '(NOT SET)',
      }
    };
  },

  // ---------- แปลง USD → สกุลที่ใช้ชำระ ----------
  async convertAmount(totalUsd) {
    const fx = await convertUsdToThb(totalUsd);
    return { amount: fx.amount, rate: fx.rate, source: fx.source };
    // ถ้าผู้ให้บริการรับ USD ตรงๆ ให้คืน:
    // return { amount: totalUsd, rate: 1, source: 'identity' };
  },

  // ---------- สร้างรายการชำระเงิน ----------
  async createPayment({ customer, items, amount, channel, headers }) {
    // ...เรียก API ของผู้ให้บริการ...
    return {
      ok: true,
      paymentUrl: '...',          // URL ที่จะ redirect ลูกค้าไป (จำเป็น)
      gatewayOrderNo: '...',      // เลขที่อ้างอิงของเรา ใช้ค้นหา order ตอน callback (จำเป็น)
      gatewayRef: '...',          // transaction id ฝั่งผู้ให้บริการ
      expiresAt: '...',
      request: redactedRequest,   // payload ที่ส่ง (ปิดบังค่าลับแล้ว) สำหรับ audit log
      raw: responseBody,
      httpStatus: 200
    };
    // กรณีล้มเหลว: { ok:false, error, code, gatewayOrderNo, request, raw, httpStatus }
    // ⚠️ ห้าม throw — ให้คืน ok:false เสมอ (รวมถึงกรณี network error)
  },

  // ---------- แปลง raw body ของ callback เป็น object ----------
  parseBody(rawBody, headers) {
    return JSON.parse(rawBody);          // ถ้าผู้ให้บริการส่ง JSON
    // ถ้าเป็น form-urlencoded ให้คัดลอกฟังก์ชันจาก chillpay.js
  },

  // ---------- ตรวจสอบว่า callback เป็นของจริง ----------
  verifyCallback({ params, headers, rawBody }) {
    // ตรวจ signature / checksum
    if (!valid) return { ok: false, reason: 'signature mismatch' };
    return { ok: true };
  },

  // ---------- แปลง callback เป็นภาษากลาง ----------
  parseCallback(params) {
    return {
      gatewayOrderNo: params.reference,           // ต้องตรงกับที่ส่งใน createPayment
      status: params.status === 'successful' ? 'paid' : 'failed',
      rawStatus: params.status,                   // เก็บค่าดิบไว้ debug
      gatewayRef: params.id,
      currency: params.currency,
      fields: { /* ฟิลด์อื่นๆ ที่อยากเก็บไว้ตรวจสอบ */ }
    };
  }
};
```

### 🔑 กฎเหล็ก 5 ข้อ

1. **`createPayment` ต้องไม่ throw** — คืน `{ ok:false, error }` เสมอ แม้ network error
2. **`gatewayOrderNo` ต้องเป็นค่าที่ผู้ให้บริการส่งกลับมาใน callback** เพราะระบบใช้ค้นหา order
3. **`describe()` และ `request` ห้ามมีค่าลับ** — ต้อง redact ก่อน (เพราะ admin เห็นได้)
4. **`refPrefix` ต้องไม่ซ้ำ** กับเจ้าอื่น (`CP` = ChillPay, `OT` = ontheline, `DR` = direct เดิม)
5. **ระวังหน่วยเงิน** — ถ้าผู้ให้บริการใช้สตางค์ ต้องคูณ 100 ใน `createPayment`

---

## ขั้นที่ 3 — ลงทะเบียนใน registry

แก้ `netlify/functions/lib/gateways/index.js` 2 บรรทัด:

```js
const chillpayAdapter = require('./chillpay');
const omiseAdapter    = require('./omise');        // ← เพิ่ม

const ADAPTERS = {
  chillpay: chillpayAdapter,
  omise:    omiseAdapter,                          // ← เพิ่ม
};
```

**เท่านี้จบ** — ไม่ต้องแก้ `create-payment.js` หรือ `payment-callback.js` เลย

---

## ขั้นที่ 4 — เพิ่มคำแปลของช่องทางชำระเงิน (ถ้ามีช่องทางใหม่)

ถ้า `channels` ใช้ `labelKey` ที่มีอยู่แล้ว (`checkout.channel.card`, `.qr`, `.mobile`, `.ewallet`)
ข้ามขั้นนี้ได้เลย

ถ้ามีช่องทางใหม่ (เช่น Apple Pay) ต้องเพิ่ม key ใน `app.js` **ครบทั้ง 4 ภาษา**
(`DEFAULT_STRINGS` สำหรับ en และ `FULL_TRANSLATIONS` สำหรับ th/ko/ja):

```js
"checkout.channel.applepay":"Apple Pay",        // en
"checkout.channel.applepay":"Apple Pay",        // th
...
```

---

## ขั้นที่ 5 — ตั้ง environment variables

ที่ **Netlify → Site settings → Environment variables** เพิ่ม key ของผู้ให้บริการรายใหม่

> 🔒 **ห้ามเก็บ credentials ใน Firestore เด็ดขาด** — frontend อ่าน Firestore ได้
> ฐานข้อมูลเก็บเพียงว่า*เลือกใช้*เจ้าไหน (`config/payment.activeGateway`)

---

## ขั้นที่ 6 — Deploy

ลาก deploy package ทั้งโฟลเดอร์เข้า Netlify (ต้องมี `lib/gateways/<id>.js` ไฟล์ใหม่ด้วย)

---

## ขั้นที่ 7 — ตรวจสอบด้วย diagnostic

เปิดในเบราว์เซอร์:

```
https://dealmai.com/.netlify/functions/create-payment
```

ต้องเห็น gateway ใหม่ในรายการ พร้อม `"configured": true`
ถ้าเป็น `false` จะบอกว่าขาด env ตัวไหน

หรือดูใน **Admin → Payment Gateway** จะเห็นการ์ดของเจ้าใหม่ขึ้นมาเอง

---

## ขั้นที่ 8 — ลงทะเบียน URL กับผู้ให้บริการ

คัดลอกจากการ์ดใน Admin → Payment Gateway (มีปุ่ม Copy):

| ประเภท | ค่า |
|---|---|
| **Callback / Webhook (server-to-server)** | `https://dealmai.com/.netlify/functions/payment-callback/<id>` |
| **Return URL (ลูกค้ากลับมา)** | `https://dealmai.com/payment-result` |

> ⚠️ **ต้องลงท้ายด้วย `/<id>` และห้ามใช้ query string (`?gw=`)**
> ผู้ให้บริการหลายราย (รวมถึง ChillPay) **จะไม่ยิง webhook ที่ URL มี `?`** — การจ่ายเงินสำเร็จฝั่งเขา
> แต่สถานะการแจ้งเตือนค้างเป็น "Pending" และไม่มี request มาถึงเราเลย ทำให้ order ค้าง pending ตลอด
> (เจอจริงกับ ChillPay เมื่อ 4 ส.ค. 2026 — ใช้เวลาไล่หาหลายชั่วโมง)
>
> ⚠️ อย่าใช้ `/api/*` — path นั้นไม่น่าเชื่อถือบน production (ตกไปที่หน้า HTML)

---

## ขั้นที่ 9 — ทดสอบใน sandbox ⭐ สำคัญที่สุด

**ยังไม่ต้องเปิดใช้งานจริง** — สลับไปเจ้าใหม่ชั่วคราวในช่วงเงียบ แล้วทดสอบให้ครบ:

- [ ] เลือกแพ็กเกจ → กด Confirm & Pay → redirect ไปหน้าจ่ายเงินของผู้ให้บริการได้
- [ ] จ่ายสำเร็จ → กลับมาหน้า payment-result แสดงผลถูกต้อง
- [ ] เข้า Admin → Orders → order เปลี่ยนเป็น **paid** (ถ้ายัง pending = callback ไม่เข้า)
- [ ] Admin → Payment Gateway Events → callback ขึ้น **verified ✓** (ถ้า verify ไม่ผ่าน = signature ผิด)
- [ ] ลูกค้าได้รับอีเมล invoice + receipt + credentials
- [ ] เข้าสู่ระบบด้วยรหัสในอีเมลได้
- [ ] เครดิต DM Champ ถูกเพิ่มให้
- [ ] **ทดสอบกรณีจ่ายไม่สำเร็จด้วย** → order ต้องเป็น failed
- [ ] เปิด order ใน admin → บล็อก Payment Gateway Diagnostics แสดงข้อมูลครบ

> 🔍 ถ้า callback ไม่เข้าเลย ให้ดู **Netlify → Functions → payment-callback → Logs**

---

## ขั้นที่ 10 — เปิดใช้งานจริง

**Admin → Payment Gateway → กด "Use this gateway"** ที่การ์ดของเจ้าใหม่

ผลทันที (ไม่ต้อง deploy):
- รายการชำระเงิน**ใหม่**ทั้งหมดจะไปที่เจ้าใหม่
- ปุ่มช่องทางชำระเงินในหน้า checkout เปลี่ยนตามเจ้าใหม่อัตโนมัติ

---

## 🛡️ เรื่องที่ระบบจัดการให้แล้ว (ไม่ต้องกังวล)

**order ที่ค้างอยู่ตอนสลับ**
ทุก order บันทึกว่าใช้ gateway ไหนตั้งแต่ตอนสร้าง เวลา callback กลับมา ระบบจะตรวจสอบ
ด้วย credentials ของ gateway **ที่ order นั้นใช้** ไม่ใช่เจ้าที่ active อยู่ตอนนี้
→ ลูกค้าที่กำลังจ่ายเงินค้างอยู่จะไม่ได้รับผลกระทบ เงินไม่หาย

**ข้อมูลเก่า**
order ที่สร้างก่อนหน้ายังอ่านได้ปกติ ไม่ต้อง migrate

**สลับกลับ**
กดเลือกเจ้าเดิมได้ทันที ไม่มีผลข้างเคียง

---

## 🔧 กรณีพิเศษที่อาจต้องปรับระบบเพิ่ม

| สถานการณ์ | สิ่งที่ต้องทำเพิ่ม |
|---|---|
| ผู้ให้บริการใช้ **client SDK ฝังหน้า** (ไม่ redirect ออก) | ต้องเพิ่ม `mode: 'client_sdk'` ในสัญญา + แก้หน้า checkout — ปัจจุบันรองรับเฉพาะ redirect |
| อยาก**รัน 2 เจ้าพร้อมกัน** (แยกตามประเทศ/สกุลเงิน) | เปลี่ยน `config/payment` จาก `activeGateway` เดี่ยว เป็น rule-based (โครงสร้างเผื่อไว้แล้ว) |
| อยากยิง **refund ผ่าน API** | เพิ่ม method `refund()` ในสัญญา + ปุ่มในหน้า admin |
| ผู้ให้บริการรับ **USD ตรงๆ** | `convertAmount` คืน `{ amount: totalUsd, rate: 1, source: 'identity' }` |

---

## 📁 ไฟล์อ้างอิง

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/gateways/index.js` | registry + คำอธิบายสัญญาแบบเต็ม |
| `lib/gateways/chillpay.js` | ตัวอย่างจริงที่ใช้งานอยู่ (ใช้เป็นแม่แบบ) |
| `create-payment.js` | ตรรกะกลางตอนสร้างการชำระเงิน (ไม่ต้องแก้) |
| `payment-callback.js` | ตรรกะกลางตอนรับ callback (ไม่ต้องแก้) |
| `PROJECT_STATE.md` | บันทึกการเปลี่ยนแปลงทั้งหมดของระบบ |

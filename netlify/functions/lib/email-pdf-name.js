'use strict';

/** Stable folder and file labels. They do not follow the admin UI language. */
const KIND_LABEL = {
  invoice: '주문확인서',
  receipt: '결제영수증',
  credentials: '로그인정보',
  dmchamp_access: 'AI워크스페이스안내',
  dmchamp_linked: 'AI워크스페이스연결',
  refund_cancel: '환불취소',
  partial_refund: '부분환불'
};

function kindLabel(kind) {
  return KIND_LABEL[kind] || String(kind || '메일').replace(/[^\w가-힣.-]+/g, '');
}

function safePart(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function seoulStamp(when) {
  const date = when instanceof Date ? when : new Date(when || Date.now());
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return {
    date: `${parts.year}${parts.month}${parts.day}`,
    time: `${parts.hour}${parts.minute}${parts.second}`
  };
}

/**
 * 파일성격_일자_시간_내용.pdf
 * Example: 주문확인서_20261021_233045_DP-OT-HMP7JX.pdf
 */
function buildEmailPdfName({ kind, when, ref, to }) {
  const stamp = seoulStamp(when || new Date());
  const content = safePart(ref) || safePart(String(to || '').split('@')[0]) || 'mail';
  return `${kindLabel(kind)}_${stamp.date}_${stamp.time}_${content}.pdf`;
}

module.exports = { KIND_LABEL, kindLabel, buildEmailPdfName, safePart };

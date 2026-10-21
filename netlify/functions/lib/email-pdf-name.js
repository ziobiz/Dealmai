'use strict';

/** English folder and file titles. They do not follow the admin UI language. */
const KIND_LABEL = {
  invoice: 'Invoice',
  receipt: 'Receipt',
  credentials: 'Credentials',
  dmchamp_access: 'AI_Workspace_Access',
  dmchamp_linked: 'AI_Workspace_Linked',
  refund_cancel: 'Refund_Cancel',
  partial_refund: 'Partial_Refund'
};

function kindLabel(kind) {
  return KIND_LABEL[kind] || String(kind || 'Mail').replace(/[^\w.-]+/g, '_');
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
 * Example: Invoice_20261021_233045_DP-OT-HMP7JX.pdf
 */
function buildEmailPdfName({ kind, when, ref, to }) {
  const stamp = seoulStamp(when || new Date());
  const content = safePart(ref) || safePart(String(to || '').split('@')[0]) || 'mail';
  return `${kindLabel(kind)}_${stamp.date}_${stamp.time}_${content}.pdf`;
}

module.exports = { KIND_LABEL, kindLabel, buildEmailPdfName, safePart };

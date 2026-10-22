'use strict';

const JSZip = require('jszip');

const EMAIL_ZIP_MAX = 50;

function uniqueZipName(used, name) {
  const clean = String(name || 'email.pdf').replace(/[\\/:*?"<>|]+/g, '_');
  if (!used.has(clean)) {
    used.add(clean);
    return clean;
  }
  const dot = clean.lastIndexOf('.');
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : '';
  let n = 2;
  let next = `${base}_${n}${ext}`;
  while (used.has(next)) {
    n += 1;
    next = `${base}_${n}${ext}`;
  }
  used.add(next);
  return next;
}

async function packEmailPdfs(files) {
  const zip = new JSZip();
  const used = new Set();
  for (const file of files) {
    if (!file || !file.pdf) continue;
    zip.file(uniqueZipName(used, file.filename), file.pdf);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { EMAIL_ZIP_MAX, uniqueZipName, packEmailPdfs };

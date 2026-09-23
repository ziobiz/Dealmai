#!/usr/bin/env node
/**
 * Verify bundled i18n coverage in app.js.
 * Exit 0 when all DEFAULT_STRINGS keys exist (non-empty) in th/ko/ja/zh,
 * or when --keys restricts the check to a required subset.
 *
 * Usage:
 *   node scripts/verify-i18n.js
 *   node scripts/verify-i18n.js --keys pager.,admin.orders.date.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app.js');
const LOCALES = ['th', 'ko', 'ja', 'zh'];

const FEATURE_PREFIXES = [
  'pager.',
  'admin.orders.date.',
];

function parseArgs(argv){
  const out = { keys: null, prefixes: null, quiet: false };
  for(let i = 2; i < argv.length; i++){
    const a = argv[i];
    if(a === '--quiet') out.quiet = true;
    else if(a === '--keys' && argv[i + 1]){
      out.prefixes = String(argv[++i]).split(',').map(s => s.trim()).filter(Boolean);
    }else if(a === '--feature'){
      out.prefixes = FEATURE_PREFIXES;
    }
  }
  return out;
}

function extractObjectLiteral(src, marker){
  const start = src.indexOf(marker);
  if(start < 0) throw new Error('Marker not found: ' + marker);
  const brace = src.indexOf('{', start);
  let depth = 0;
  let inStr = null;
  let esc = false;
  for(let i = brace; i < src.length; i++){
    const ch = src[i];
    if(inStr){
      if(esc){ esc = false; continue; }
      if(ch === '\\'){ esc = true; continue; }
      if(ch === inStr) inStr = null;
      continue;
    }
    if(ch === '"' || ch === "'" || ch === '`'){ inStr = ch; continue; }
    if(ch === '{') depth++;
    else if(ch === '}'){
      depth--;
      if(depth === 0) return src.slice(brace, i + 1);
    }
  }
  throw new Error('Unclosed object for ' + marker);
}

function parseKeyedStrings(objectSrc){
  const map = Object.create(null);
  const re = /"((?:\\.|[^"\\])*)"\s*:\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`)/g;
  let m;
  while((m = re.exec(objectSrc))){
    const key = m[1].replace(/\\"/g, '"');
    const raw = m[2] != null ? m[2] : (m[3] != null ? m[3] : m[4]);
    const val = String(raw).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
    map[key] = val;
  }
  return map;
}

function main(){
  const args = parseArgs(process.argv);
  const src = fs.readFileSync(APP, 'utf8');
  const enObj = extractObjectLiteral(src, 'const DEFAULT_STRINGS =');
  const en = parseKeyedStrings(enObj);

  const ftStart = src.indexOf('const FULL_TRANSLATIONS =');
  if(ftStart < 0) throw new Error('FULL_TRANSLATIONS not found');
  const ftObj = extractObjectLiteral(src, 'const FULL_TRANSLATIONS =');

  const locales = {};
  for(const lc of LOCALES){
    const marker = lc + ':';
    const idx = ftObj.indexOf(marker);
    if(idx < 0) throw new Error('Locale block missing: ' + lc);
    // find `{` after `th:` etc.
    const brace = ftObj.indexOf('{', idx);
    let depth = 0;
    let inStr = null;
    let esc = false;
    let end = -1;
    for(let i = brace; i < ftObj.length; i++){
      const ch = ftObj[i];
      if(inStr){
        if(esc){ esc = false; continue; }
        if(ch === '\\'){ esc = true; continue; }
        if(ch === inStr) inStr = null;
        continue;
      }
      if(ch === '"' || ch === "'" || ch === '`'){ inStr = ch; continue; }
      if(ch === '{') depth++;
      else if(ch === '}'){
        depth--;
        if(depth === 0){ end = i; break; }
      }
    }
    if(end < 0) throw new Error('Unclosed locale: ' + lc);
    locales[lc] = parseKeyedStrings(ftObj.slice(brace, end + 1));
  }

  let keys = Object.keys(en);
  if(args.prefixes && args.prefixes.length){
    keys = keys.filter(k => args.prefixes.some(p => k.startsWith(p) || k === p));
  }

  const missing = [];
  const empty = [];
  const report = {};

  for(const lc of LOCALES){
    report[lc] = { missing: [], empty: [] };
    for(const k of keys){
      if(!(k in locales[lc])){
        report[lc].missing.push(k);
        missing.push(`${lc}: ${k}`);
      }else if(!String(locales[lc][k]).trim()){
        report[lc].empty.push(k);
        empty.push(`${lc}: ${k}`);
      }
    }
  }

  const totalEn = Object.keys(en).length;
  if(!args.quiet){
    console.log(`EN keys: ${totalEn}`);
    console.log(`Checked keys: ${keys.length}${args.prefixes ? ` (prefixes: ${args.prefixes.join(', ')})` : ''}`);
    for(const lc of LOCALES){
      const filled = keys.filter(k => locales[lc][k] && String(locales[lc][k]).trim()).length;
      const pct = keys.length ? Math.round((filled / keys.length) * 100) : 100;
      console.log(`  ${lc}: ${filled}/${keys.length} (${pct}%)  missing=${report[lc].missing.length} empty=${report[lc].empty.length}`);
    }
  }

  if(missing.length || empty.length){
    if(missing.length){
      console.error('\nMissing translations:');
      missing.forEach(line => console.error('  - ' + line));
    }
    if(empty.length){
      console.error('\nEmpty translations:');
      empty.forEach(line => console.error('  - ' + line));
    }
    process.exit(1);
  }

  // Spot-check placeholder parity for checked keys that use {n} etc.
  const phRe = /\{[a-zA-Z_][a-zA-Z0-9_]*\}/g;
  const phMismatch = [];
  for(const k of keys){
    const enPh = (en[k].match(phRe) || []).sort().join(',');
    for(const lc of LOCALES){
      const lcPh = (String(locales[lc][k]).match(phRe) || []).sort().join(',');
      if(enPh !== lcPh){
        phMismatch.push(`${lc}: ${k}  en=[${enPh}] lc=[${lcPh}]`);
      }
    }
  }
  if(phMismatch.length){
    console.error('\nPlaceholder mismatches:');
    phMismatch.forEach(line => console.error('  - ' + line));
    process.exit(1);
  }

  console.log('\ni18n OK');
  process.exit(0);
}

main();

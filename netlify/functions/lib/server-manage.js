'use strict';

/**
 * HQ-style server / SSL summary (port of ziobiz/PG HqServerManageService).
 * Reads Let's Encrypt PEM, host memory/disk, Node process stats, certbot timer.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { X509Certificate } = require('crypto');

const SSL_DAYS_WARN = 30;
const SSL_DAYS_DANGER = 14;
const DISK_PCT_WARN = 75;
const DISK_PCT_DANGER = 90;
const SYS_MEM_PCT_WARN = 70;
const SYS_MEM_PCT_DANGER = 90;
const HEAP_PCT_WARN = 80;
const HEAP_PCT_DANGER = 92;
const LOAD_MULT = 2;

function trimStr(v) {
  if (v == null) return '';
  return String(v).trim();
}

function toIntOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function hostFromUrl(url) {
  const t = trimStr(url);
  if (!t) return null;
  try {
    const u = new URL(t.includes('://') ? t : `https://${t}`);
    return u.hostname || null;
  } catch {
    return null;
  }
}

function normalizeHttpsUrl(url) {
  const t = trimStr(url);
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t.replace(/\/+$/, '');
  return `https://${t}`.replace(/\/+$/, '');
}

function resolvePemPath(configuredPath, leDomain) {
  const cfg = trimStr(configuredPath);
  if (cfg && fs.existsSync(cfg) && fs.statSync(cfg).isFile()) return cfg;

  const envPath = trimStr(process.env.DEALMAI_SSL_CERT_PATH || process.env.PG_SSL_CERT_PATH);
  if (envPath && fs.existsSync(envPath) && fs.statSync(envPath).isFile()) return envPath;

  const le = trimStr(leDomain);
  if (le) {
    const p = path.join('/etc/letsencrypt/live', le, 'fullchain.pem');
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

function extractSanDnsNames(cert) {
  const out = [];
  try {
    const san = cert.subjectAltName || '';
    // e.g. "DNS:dealmai.com, DNS:www.dealmai.com"
    for (const part of String(san).split(',')) {
      const m = part.trim().match(/^DNS:(.+)$/i);
      if (m) out.push(m[1].trim());
    }
  } catch {
    /* ignore */
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return out;
}

function readSslInfo(pemPath) {
  const m = {
    sanDnsNames: [],
    leLiveCertName: pemPath ? path.basename(path.dirname(pemPath)) : ''
  };
  if (!pemPath || !fs.existsSync(pemPath)) {
    m.status = 'N/A';
    m.detail =
      'Certificate file not found. Save fullchain.pem path or LE live folder name (e.g. dealmai.com).';
    return m;
  }
  try {
    const pem = fs.readFileSync(pemPath, 'utf8');
    const begin = pem.indexOf('-----BEGIN CERTIFICATE-----');
    const end = pem.indexOf('-----END CERTIFICATE-----');
    if (begin < 0 || end < 0) {
      m.status = 'ERROR';
      m.detail = 'Not a PEM certificate.';
      return m;
    }
    const leafPem = pem.slice(begin, end + '-----END CERTIFICATE-----'.length);
    const cert = new X509Certificate(leafPem);
    const notBefore = new Date(cert.validFrom);
    const notAfter = new Date(cert.validTo);
    const daysRemaining = Math.floor((notAfter.getTime() - Date.now()) / 86400000);
    m.status = 'OK';
    m.subjectDn = cert.subject;
    m.issuerDn = cert.issuer;
    m.notBefore = notBefore.toISOString();
    m.notAfter = notAfter.toISOString();
    m.daysRemaining = daysRemaining;
    m.fingerprintSha256 = crypto.createHash('sha256').update(cert.raw).digest('hex');
    m.sanDnsNames = extractSanDnsNames(cert);
    m.leLiveCertName = path.basename(path.dirname(pemPath));
  } catch (ex) {
    m.status = 'ERROR';
    m.detail = ex.message || 'parse failed';
  }
  return m;
}

function readHostInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    hostname: os.hostname(),
    osFamily: os.type(),
    osVersion: os.release(),
    arch: os.arch(),
    memoryTotalMb: Math.round(total / (1024 * 1024)),
    memoryAvailableMb: Math.round(free / (1024 * 1024))
  };
}

function readNodeInfo() {
  const mem = process.memoryUsage();
  const heapUsed = mem.heapUsed;
  const heapMax = mem.heapTotal;
  const heapPct = heapMax > 0 ? Math.round((heapUsed * 1000) / heapMax) / 10 : 0;
  const cpuN = Math.max(1, os.cpus()?.length || 1);
  const loads = os.loadavg();
  return {
    nodeVersion: process.version,
    heapUsedMb: Math.round(heapUsed / (1024 * 1024)),
    heapMaxMb: Math.round(heapMax / (1024 * 1024)),
    heapUsedPct: heapPct,
    rssMb: Math.round(mem.rss / (1024 * 1024)),
    cpuCount: cpuN,
    systemLoadAverage: loads[0] != null ? Math.round(loads[0] * 100) / 100 : null,
    uptimeMs: Math.round(process.uptime() * 1000)
  };
}

function readDiskInfo() {
  const m = {};
  try {
    // Prefer df of the app root on Linux
    const base = process.cwd();
    if (process.platform !== 'win32') {
      const out = execFileSync('df', ['-k', base], { encoding: 'utf8', timeout: 5000 });
      const lines = out.trim().split(/\r?\n/);
      if (lines.length >= 2) {
        const parts = lines[lines.length - 1].trim().split(/\s+/);
        // Filesystem 1K-blocks Used Available Use% Mounted
        const totalK = Number(parts[1]);
        const usedK = Number(parts[2]);
        const availK = Number(parts[3]);
        if (Number.isFinite(totalK) && totalK > 0) {
          const total = totalK * 1024;
          const used = usedK * 1024;
          const usable = availK * 1024;
          m.ok = true;
          m.pathRoot = base;
          m.fileSystem = parts[0];
          m.totalBytes = total;
          m.usableBytes = usable;
          m.usedBytes = used;
          m.usedPct = Math.round((used * 1000) / total) / 10;
          return m;
        }
      }
    }
    m.ok = false;
    m.error = 'disk probe unavailable on this platform';
  } catch (ex) {
    m.ok = false;
    m.error = ex.message || 'disk';
  }
  return m;
}

function execShort(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      timeout: 4000,
      stdio: ['ignore', 'pipe', 'pipe']
    })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

function readCertbotInfo() {
  const m = { renewalConfFiles: [], certbotTimer: { active: 'N/A', next: 'N/A' } };
  const renewalDir = '/etc/letsencrypt/renewal';
  try {
    if (fs.existsSync(renewalDir) && fs.statSync(renewalDir).isDirectory()) {
      m.renewalConfFiles = fs
        .readdirSync(renewalDir)
        .filter((f) => f.endsWith('.conf'))
        .sort();
    }
  } catch {
    /* ignore */
  }
  if (process.platform !== 'win32') {
    m.certbotTimer = {
      active: execShort('systemctl', ['is-active', 'certbot.timer']) || 'unknown',
      next: execShort('systemctl', ['show', 'certbot.timer', '-p', 'NextElapseUSecRealtime', '--value']) || ''
    };
  }
  return m;
}

async function readNginxStub() {
  const url = trimStr(process.env.NGINX_STUB_STATUS_URL);
  if (!url) return { status: 'SKIPPED' };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    let body = await resp.text();
    if (body.length > 500) body = `${body.slice(0, 500)}...`;
    return {
      status: resp.status === 200 ? 'OK' : `HTTP_${resp.status}`,
      bodyPreview: body
    };
  } catch (ex) {
    return { status: 'ERROR', detail: ex.message || 'request failed' };
  }
}

function formatGbFromMb(mbVal) {
  const n = Number(mbVal);
  if (!Number.isFinite(n) || n <= 0) return '0 GB';
  return `${(n / 1024).toFixed(2)} GB`;
}

function contractPeriodSuffix(cfg) {
  const s = trimStr(cfg.contractStart);
  const e = trimStr(cfg.contractEnd);
  if (!s && !e) return '';
  return ` · ${s || '?'} ~ ${e || '?'}`;
}

function rowMetric(id, status, label, criteria, value) {
  return { id, status, label, criteria, value };
}

function buildHealth(host, node, disk, ssl, cfg) {
  const alerts = [];
  const rows = [];

  const end = trimStr(cfg.contractEnd);
  if (end) {
    const endDate = new Date(`${end}T00:00:00Z`);
    if (!Number.isNaN(endDate.getTime())) {
      const days = Math.floor((endDate.getTime() - Date.now()) / 86400000);
      if (days < 0) alerts.push('Hosting contract has expired.');
      else if (days <= 14) alerts.push(`Hosting contract ends in ${days} day(s).`);
    }
  }

  const totalMb = Number(host.memoryTotalMb) || 0;
  const availMb = Number(host.memoryAvailableMb) || 0;
  const sysMemPct = totalMb > 0 ? Math.round(((totalMb - availMb) * 1000) / totalMb) / 10 : 0;
  let sysStatus = 'ok';
  if (sysMemPct >= SYS_MEM_PCT_DANGER) {
    sysStatus = 'danger';
    alerts.push(`System memory ≥ ${SYS_MEM_PCT_DANGER}%`);
  } else if (sysMemPct >= SYS_MEM_PCT_WARN) sysStatus = 'warn';
  rows.push(
    rowMetric(
      'sys_mem',
      sysStatus,
      'System memory',
      `warn ≥${SYS_MEM_PCT_WARN}% · danger ≥${SYS_MEM_PCT_DANGER}%`,
      `${sysMemPct}% (avail ${availMb} / total ${totalMb} MB)`
    )
  );

  const heapPct = Number(node.heapUsedPct) || 0;
  let heapStatus = 'ok';
  if (heapPct >= HEAP_PCT_DANGER) {
    heapStatus = 'danger';
    alerts.push(`Node heap ≥ ${HEAP_PCT_DANGER}%`);
  } else if (heapPct >= HEAP_PCT_WARN) heapStatus = 'warn';
  rows.push(
    rowMetric(
      'node_heap',
      heapStatus,
      'Node heap',
      `warn ≥${HEAP_PCT_WARN}% · danger ≥${HEAP_PCT_DANGER}%`,
      `${node.heapUsedMb} / ${node.heapMaxMb} MB (${heapPct}%)`
    )
  );

  const load = node.systemLoadAverage;
  const cpuN = Number(node.cpuCount) || 1;
  let loadStatus = 'ok';
  if (load != null && load >= 0) {
    if (load > cpuN * LOAD_MULT) {
      loadStatus = 'danger';
      alerts.push(`Load average high (> ${cpuN * LOAD_MULT})`);
    } else if (load > cpuN) loadStatus = 'warn';
  }
  rows.push(
    rowMetric(
      'load_avg',
      loadStatus,
      'Load average (1m)',
      `cores ${cpuN} · danger > ${cpuN * LOAD_MULT}`,
      load == null || load < 0 ? '—' : String(load)
    )
  );

  let diskStatus = 'ok';
  let diskVal = '—';
  if (disk.ok) {
    const dPct = Number(disk.usedPct) || 0;
    diskVal = `${dPct}%`;
    if (dPct >= DISK_PCT_DANGER) {
      diskStatus = 'danger';
      alerts.push(`Disk usage ≥ ${DISK_PCT_DANGER}%`);
    } else if (dPct >= DISK_PCT_WARN) diskStatus = 'warn';
  } else {
    diskStatus = 'warn';
    diskVal = disk.error || 'unavailable';
  }
  rows.push(
    rowMetric(
      'disk',
      diskStatus,
      'Disk (app path)',
      `warn ≥${DISK_PCT_WARN}% · danger ≥${DISK_PCT_DANGER}%`,
      diskVal
    )
  );

  let sslStatus = 'ok';
  let sslVal = '—';
  if (ssl.status === 'OK') {
    const days = Number(ssl.daysRemaining);
    sslVal = `${days} day(s) remaining`;
    if (days < SSL_DAYS_DANGER) {
      sslStatus = 'danger';
      alerts.push(`SSL expires in under ${SSL_DAYS_DANGER} days`);
    } else if (days < SSL_DAYS_WARN) {
      sslStatus = 'warn';
      alerts.push(`SSL expires in under ${SSL_DAYS_WARN} days`);
    }
  } else if (ssl.status === 'N/A') {
    sslStatus = 'warn';
    sslVal = 'Certificate not found';
  } else if (ssl.status === 'ERROR') {
    sslStatus = 'danger';
    sslVal = ssl.detail || 'SSL read error';
    alerts.push('SSL certificate read failed');
  }
  rows.push(
    rowMetric(
      'ssl',
      sslStatus,
      'SSL certificate',
      `warn <${SSL_DAYS_WARN}d · danger <${SSL_DAYS_DANGER}d`,
      sslVal
    )
  );

  const contractDiskMb = toIntOrNull(cfg.contractDiskMb);
  if (contractDiskMb && contractDiskMb > 0 && disk.ok) {
    const usedMb = (Number(disk.usedBytes) || 0) / (1024 * 1024);
    const pctContract = Math.round((usedMb * 1000) / contractDiskMb) / 10;
    let cDiskStatus = 'ok';
    if (pctContract >= DISK_PCT_DANGER) {
      cDiskStatus = 'danger';
      alerts.push(`Contract disk ≥ ${DISK_PCT_DANGER}% of ${formatGbFromMb(contractDiskMb)}`);
    } else if (pctContract >= DISK_PCT_WARN) cDiskStatus = 'warn';
    rows.push(
      rowMetric(
        'contract_disk',
        cDiskStatus,
        'Contract disk',
        `${formatGbFromMb(contractDiskMb)}${contractPeriodSuffix(cfg)}`,
        `${formatGbFromMb(usedMb)} / ${formatGbFromMb(contractDiskMb)} (${pctContract}%)`
      )
    );
  }

  const contractTrafficMb = toIntOrNull(cfg.contractTrafficMb);
  const trafficUsedMb = toIntOrNull(cfg.trafficUsedMb);
  if (contractTrafficMb && contractTrafficMb > 0) {
    if (trafficUsedMb == null) {
      rows.push(
        rowMetric(
          'contract_traffic',
          'warn',
          'Contract traffic',
          `${formatGbFromMb(contractTrafficMb)}${contractPeriodSuffix(cfg)}`,
          'Usage not entered'
        )
      );
    } else {
      const pctT = Math.round((trafficUsedMb * 1000) / contractTrafficMb) / 10;
      let tStatus = 'ok';
      if (pctT >= DISK_PCT_DANGER) {
        tStatus = 'danger';
        alerts.push(`Contract traffic ≥ ${DISK_PCT_DANGER}%`);
      } else if (pctT >= DISK_PCT_WARN) tStatus = 'warn';
      rows.push(
        rowMetric(
          'contract_traffic',
          tStatus,
          'Contract traffic',
          `${formatGbFromMb(contractTrafficMb)}${contractPeriodSuffix(cfg)}`,
          `${formatGbFromMb(trafficUsedMb)} / ${formatGbFromMb(contractTrafficMb)} (${pctT}%)`
        )
      );
    }
  }

  let worst = 'ok';
  for (const r of rows) {
    if (r.status === 'danger') {
      worst = 'danger';
      break;
    }
    if (r.status === 'warn') worst = 'warn';
  }

  return { alerts, rows, worstStatus: worst };
}

function resolveRefreshSeconds(stored, envDefault) {
  if (stored != null && stored >= 15 && stored <= 3600) return stored;
  let d = Number(envDefault);
  if (!Number.isFinite(d) || d < 15) d = 120;
  if (d > 3600) d = 3600;
  return d;
}

async function buildSummary(cfg) {
  const c = cfg || {};
  const pemPath = resolvePemPath(c.sslCertPath, c.sslLeDomain);
  const host = readHostInfo();
  const node = readNodeInfo();
  const disk = readDiskInfo();
  const ssl = readSslInfo(pemPath);
  const certbot = readCertbotInfo();
  const nginxStub = await readNginxStub();
  const refreshEff = resolveRefreshSeconds(
    toIntOrNull(c.uiRefreshSec),
    process.env.DEALMAI_SERVER_MANAGE_REFRESH_SEC || 120
  );

  return {
    generatedAt: new Date().toISOString(),
    nginxStubStatusUrlConfigured: Boolean(trimStr(process.env.NGINX_STUB_STATUS_URL)),
    uiAutoRefreshSeconds: refreshEff,
    serverManageUiRefreshSec: toIntOrNull(c.uiRefreshSec),
    serverManageSslCertPath: trimStr(c.sslCertPath),
    serverManageSslLeDomain: trimStr(c.sslLeDomain),
    sslResolvedPath: pemPath || '',
    ssl,
    host,
    node,
    // alias for PG-shaped UI that expects jvm
    jvm: {
      javaVersion: node.nodeVersion,
      heapUsedMb: node.heapUsedMb,
      heapMaxMb: node.heapMaxMb,
      heapUsedPct: node.heapUsedPct,
      cpuCount: node.cpuCount,
      systemLoadAverage: node.systemLoadAverage,
      uptimeMs: node.uptimeMs
    },
    disk,
    health: buildHealth(host, node, disk, ssl, c),
    certbot,
    nginxStub,
    sslOpsGuide: {
      dns:
        'Confirm DNS A records for the site hostnames point to this VPS IP. Clear stale ISP DNS cache if old IPs remain.',
      leSan:
        'Add hostnames with: certbot --nginx -d dealmai.com -d www.dealmai.com then reload nginx.',
      cloudflare:
        'If using Cloudflare proxy, Origin Certificate or Full(strict) must match the Origin PEM monitored here.'
    },
    serverManageContractDiskMb: toIntOrNull(c.contractDiskMb),
    serverManageContractTrafficMb: toIntOrNull(c.contractTrafficMb),
    serverManageContractStart: trimStr(c.contractStart),
    serverManageContractEnd: trimStr(c.contractEnd),
    serverManageTrafficUsedMb: toIntOrNull(c.trafficUsedMb),
    serverManageContract: {
      diskMb: toIntOrNull(c.contractDiskMb),
      trafficMb: toIntOrNull(c.contractTrafficMb),
      trafficUsedMb: toIntOrNull(c.trafficUsedMb),
      periodStart: trimStr(c.contractStart),
      periodEnd: trimStr(c.contractEnd)
    },
    publicSiteUrl: trimStr(c.publicSiteUrl) || trimStr(process.env.PUBLIC_SITE_URL),
    envPublicSiteUrl: trimStr(process.env.PUBLIC_SITE_URL)
  };
}

function buildSslDomainLinkage(domainCfg, serverCfg) {
  const d = domainCfg || {};
  const s = serverCfg || {};
  const pemPath = resolvePemPath(s.sslCertPath, s.sslLeDomain);
  const ssl = readSslInfo(pemPath);
  const san = Array.isArray(ssl.sanDnsNames) ? ssl.sanDnsNames : [];
  const sanLower = new Set(san.map((x) => x.toLowerCase()));

  const siteUrl = normalizeHttpsUrl(d.publicSiteUrl || process.env.PUBLIC_SITE_URL || '');
  const wwwUrl = normalizeHttpsUrl(d.publicWwwUrl || '');
  const apiUrl = normalizeHttpsUrl(d.publicApiBaseUrl || '');

  const configuredRows = [];
  const missing = [];

  function addRow(host, sourceKind, label) {
    if (!host) return;
    const hn = host.trim();
    const ok = sanLower.has(hn.toLowerCase());
    const row = { hostname: hn, sourceKind, label: label || '', inCertificate: ok };
    configuredRows.push(row);
    if (!ok) missing.push({ hostname: hn, sourceKind, label: label || '' });
  }

  addRow(hostFromUrl(siteUrl), 'SITE', 'Public site URL');
  addRow(hostFromUrl(wwwUrl), 'WWW', 'www URL');
  addRow(hostFromUrl(apiUrl), 'API', 'API base URL');

  const referred = new Set(configuredRows.map((r) => r.hostname.toLowerCase()));
  const sanOnly = san.filter((h) => !referred.has(h.toLowerCase()));

  return {
    sslStatus: ssl.status,
    sslDetail: ssl.detail || '',
    notAfter: ssl.notAfter || '',
    daysRemaining: ssl.daysRemaining ?? null,
    leLiveCertName: ssl.leLiveCertName || '',
    sanDnsNames: san,
    configuredHostRows: configuredRows,
    hostsMissingFromCert: missing,
    sanWithoutConfiguredUrl: sanOnly,
    linkageHint:
      'If a configured hostname is missing from the certificate SAN, browsers will show HTTPS warnings. Hosts only in SAN should be reviewed for operational use.',
    publicSiteUrl: siteUrl,
    publicWwwUrl: wwwUrl,
    publicApiBaseUrl: apiUrl
  };
}

function parseServerManageBody(body) {
  const b = body || {};
  const out = {};
  if ('sslCertPath' in b || 'serverManageSslCertPath' in b) {
    out.sslCertPath = trimStr(b.sslCertPath ?? b.serverManageSslCertPath);
  }
  if ('sslLeDomain' in b || 'serverManageSslLeDomain' in b) {
    out.sslLeDomain = trimStr(b.sslLeDomain ?? b.serverManageSslLeDomain);
  }
  if ('uiRefreshSec' in b || 'serverManageUiRefreshSec' in b) {
    const sec = toIntOrNull(b.uiRefreshSec ?? b.serverManageUiRefreshSec);
    out.uiRefreshSec = sec != null && sec >= 15 && sec <= 3600 ? sec : null;
  }
  if ('contractDiskMb' in b || 'serverManageContractDiskMb' in b) {
    out.contractDiskMb = toIntOrNull(b.contractDiskMb ?? b.serverManageContractDiskMb);
  }
  if ('contractTrafficMb' in b || 'serverManageContractTrafficMb' in b) {
    out.contractTrafficMb = toIntOrNull(b.contractTrafficMb ?? b.serverManageContractTrafficMb);
  }
  if ('trafficUsedMb' in b || 'serverManageTrafficUsedMb' in b) {
    const u = toIntOrNull(b.trafficUsedMb ?? b.serverManageTrafficUsedMb);
    out.trafficUsedMb = u != null && u >= 0 ? u : null;
  }
  if ('contractStart' in b || 'serverManageContractStart' in b) {
    out.contractStart = trimStr(b.contractStart ?? b.serverManageContractStart);
  }
  if ('contractEnd' in b || 'serverManageContractEnd' in b) {
    out.contractEnd = trimStr(b.contractEnd ?? b.serverManageContractEnd);
  }
  return out;
}

function parseDomainBody(body) {
  const b = body || {};
  return {
    publicSiteUrl: normalizeHttpsUrl(b.publicSiteUrl),
    publicWwwUrl: normalizeHttpsUrl(b.publicWwwUrl),
    publicApiBaseUrl: normalizeHttpsUrl(b.publicApiBaseUrl)
  };
}

module.exports = {
  buildSummary,
  buildSslDomainLinkage,
  parseServerManageBody,
  parseDomainBody,
  normalizeHttpsUrl,
  hostFromUrl,
  resolvePemPath,
  readSslInfo
};

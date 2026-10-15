/**
 * Local-only FTP deploy helper. Password via FTP_PASS env (never commit secrets).
 * Usage:
 *   node _ftp-upload.js ui
 *   node _ftp-upload.js api
 */
const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');

const HOST = '162.222.225.78';
const PASS = process.env.FTP_PASS;
const ROOT = __dirname;
const MODE = (process.argv[2] || '').toLowerCase();

if (!PASS) {
  console.error('FTP_PASS missing');
  process.exit(1);
}
if (MODE !== 'ui' && MODE !== 'api') {
  console.error('Usage: node _ftp-upload.js ui|api');
  process.exit(1);
}

const UI_SKIP_DIRS = new Set([
  'api',
  'deploy-live-api',
  'deploy-live-api-node16',
  'deploy-staging',
  '_nm_build',
  'node_modules',
  '.git',
  '.cursor',
  'agent-transcripts',
  'mcps',
  'App_Data',
  'assets',
]);

const UI_SKIP_FILES = new Set([
  '.gitignore',
  'package.json',
  'package-lock.json',
  'TECHNICAL.md',
  'deploy-live-api.zip',
  'sekar-api-new-server.zip',
  'sekar-api-node16-full.zip',
  'node_modules-complete.zip',
]);

const API_SKIP_DIRS = new Set(['node_modules', '.git', '.pgdata-local']);
const API_SKIP_FILES = new Set(['.env', 'dev.sqlite', 'dev.sqlite3']);

function shouldSkipUi(name, isDir, relPosix) {
  const parts = relPosix.split('/').filter(Boolean);
  if (parts.some((p) => UI_SKIP_DIRS.has(p))) return true;
  if (name.startsWith('_ftp')) return true;
  if (name.startsWith('~$')) return true;
  if (name.endsWith('.zip')) return true;
  if (name.endsWith('.original.mp4')) return true;
  if (name.endsWith('.docx')) return true;
  if (name.endsWith('.py')) return true;
  if (!isDir && UI_SKIP_FILES.has(name)) return true;
  return false;
}

function shouldSkipApi(name, isDir) {
  if (isDir && API_SKIP_DIRS.has(name)) return true;
  if (!isDir && (API_SKIP_FILES.has(name) || name.startsWith('.env') || name.endsWith('.sqlite') || name.endsWith('.sqlite3'))) {
    return true;
  }
  if (name.startsWith('_ftp')) return true;
  return false;
}

function collectFiles(dir, relBase, out, skipFn) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
    if (skipFn(ent.name, ent.isDirectory(), rel)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) collectFiles(full, rel, out, skipFn);
    else out.push({ full, rel: rel.replace(/\\/g, '/') });
  }
}

async function ensureDir(client, remoteDir) {
  if (!remoteDir || remoteDir === '/' || remoteDir === '.') return;
  const parts = remoteDir.split('/').filter(Boolean);
  let cur = '';
  for (const part of parts) {
    cur += `/${part}`;
    try {
      await client.ensureDir(cur);
    } catch (_) {
      /* exists */
    }
  }
}

async function uploadList(client, files, label) {
  let ok = 0;
  let fail = 0;
  const started = Date.now();
  for (let i = 0; i < files.length; i++) {
    const { full, rel } = files[i];
    const remoteDir = path.posix.dirname(rel);
    const remoteName = path.posix.basename(rel);
    try {
      if (remoteDir && remoteDir !== '.') {
        await client.cd('/');
        await ensureDir(client, remoteDir);
        await client.cd(remoteDir.startsWith('/') ? remoteDir : `/${remoteDir}`);
      } else {
        await client.cd('/');
      }
      await client.uploadFrom(full, remoteName);
      ok += 1;
      if ((i + 1) % 10 === 0 || i === files.length - 1) {
        const mb = (fs.statSync(full).size / 1e6).toFixed(2);
        console.log(`[${label}] ${i + 1}/${files.length} ok=${ok} last=${rel} (${mb} MB)`);
      }
    } catch (err) {
      fail += 1;
      console.error(`[${label}] FAIL ${rel}: ${err.message}`);
      try {
        await client.cd('/');
      } catch (_) {
        /* reconnect handled by caller if needed */
      }
    }
  }
  console.log(`[${label}] done ok=${ok} fail=${fail} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return { ok, fail };
}

async function main() {
  const client = new ftp.Client(120000);
  client.ftp.verbose = false;

  if (MODE === 'ui') {
    const files = [];
    collectFiles(ROOT, '', files, shouldSkipUi);
    files.sort((a, b) => a.rel.localeCompare(b.rel));
    console.log(`UI files to upload: ${files.length}`);
    await client.access({ host: HOST, user: 'sekar', password: PASS, secure: false });
    console.log('Connected as sekar, pwd=', await client.pwd());
    const result = await uploadList(client, files, 'ui');
    client.close();
    process.exit(result.fail ? 1 : 0);
  }

  // API from api/ package (live Node app on apisekar)
  const apiRoot = path.join(ROOT, 'api');
  const files = [];
  collectFiles(apiRoot, '', files, shouldSkipApi);
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  console.log(`API files to upload: ${files.length}`);
  await client.access({ host: HOST, user: 'apisekar', password: PASS, secure: false });
  console.log('Connected as apisekar, pwd=', await client.pwd());
  const result = await uploadList(client, files, 'api');
  client.close();
  process.exit(result.fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

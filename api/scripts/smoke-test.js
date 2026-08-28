/**
 * Smoke test: health + one public GET.
 * Usage: node scripts/smoke-test.js [baseUrl]
 */
const base = process.argv[2] || process.env.SMOKE_BASE || 'http://127.0.0.1:3001';

async function check(path) {
  const res = await fetch(`${base}${path}`);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${path} → ${res.status} ${text}`);
  }
  return body;
}

(async () => {
  console.log(`Smoke testing ${base} …`);
  const health = await check('/api/health');
  console.log('1/9 health:', health.ok ? 'OK' : 'FAIL');
  const infra = await check('/api/public/infrastructure');
  console.log(`2/9 infrastructure: hero="${infra.hero && infra.hero.title}", inventory=${infra.inventory && infra.inventory.length}`);
  const ongoing = await check('/api/public/ongoing-projects');
  console.log(`3/9 ongoing-projects: ${ongoing.projects && ongoing.projects.length} rows`);
  const completed = await check('/api/public/completed-projects');
  console.log(`4/9 completed-projects: ${completed.projects && completed.projects.length} rows`);
  const gallery = await check('/api/public/gallery');
  console.log(`5/9 gallery: ${gallery.items && gallery.items.length} items`);
  const fleet = await check('/api/public/fleet');
  console.log(`6/9 fleet: ${fleet && fleet.length} assets`);
  const financials = await check('/api/public/financials');
  console.log(`7/9 financials: ${financials && financials.length} sections`);
  const team = await check('/api/public/team-photos');
  console.log(`8/9 team-photos: ${team && team.length} photos`);
  console.log('SMOKE OK — ALL 8 ENDPOINTS VERIFIED');
})().catch((err) => {
  console.error('SMOKE FAILED:', err.message);
  process.exit(1);
});

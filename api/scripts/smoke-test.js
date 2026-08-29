/**
 * Smoke test: health + public GETs.
 * Optional live HRPops apply (creates a real applicant) only when HRPOPS_SMOKE_APPLY=1.
 *
 * Test email convention for any apply to HRPops:
 *   sekar.test+{unix}@mailinator.com
 * Candidate name: "Sekar Test Applicant"
 * Do not use real candidate emails in tests.
 *
 * Usage: node scripts/smoke-test.js [baseUrl]
 * Optional: HRPOPS_SMOKE_APPLY=1 node scripts/smoke-test.js
 */
const base = process.argv[2] || process.env.SMOKE_BASE || 'http://127.0.0.1:3001';
const LIVE_APPLY = String(process.env.HRPOPS_SMOKE_APPLY || '').trim() === '1';

/** Labeled disposable address for HRPops apply tests only. */
function testApplicantEmail() {
  return `sekar.test+${Date.now()}@mailinator.com`;
}

const TEST_APPLICANT_NAME = 'Sekar Test Applicant';

/** Minimal valid PDF bytes for multipart resume upload. */
const MINI_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
  'utf8'
);

/** 1x1 PNG for profile photo upload. */
const MINI_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

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

/**
 * Live apply against HRPops via the public proxy.
 * Only called when HRPOPS_SMOKE_APPLY=1 — creates a real applicant row.
 */
async function smokeApply(jobPostId, skill) {
  const countries = await check('/api/public/careers/countries');
  const india = (countries.countries || []).find((c) => c.name === 'India');
  if (!india) throw new Error('careers/countries: India not found');

  const states = await check(`/api/public/careers/states/${india.id}`);
  const tn = (states.states || []).find((s) => /Tamil/i.test(s.name)) || (states.states || [])[0];
  if (!tn) throw new Error('careers/states: no state for India');

  const cities = await check(`/api/public/careers/cities/${tn.id}`);
  const city =
    (cities.cities || []).find((c) => /Chennai|Mamallapuram|Mahabalipuram/i.test(c.name)) ||
    (cities.cities || [])[0];
  if (!city) throw new Error('careers/cities: no city');

  const email = testApplicantEmail();
  const form = new FormData();
  form.append('JobPostID', String(jobPostId));
  form.append('CandidateName', TEST_APPLICANT_NAME);
  form.append('Email', email);
  form.append('PhoneNumber', '9000000000');
  form.append('Dob', '1990-01-15');
  form.append('Gender', 'Male');
  form.append('MaritalStatus', 'Single');
  form.append('WorkModePreference', 'Onsite');
  form.append('Relocated', 'Yes');
  form.append('CurrentAddress', 'Sekar Test Address — ignore');
  form.append('PermanentAddress', 'Sekar Test Address — ignore');
  form.append('ExpectedSalary', '1');
  form.append('CurrentCTC', '1');
  form.append('JoinPeriod', 'Immediate');
  form.append('InterviewMode', 'Online');
  form.append('AboutYourSelf', 'Automated smoke test applicant — safe to delete in HRPops.');
  form.append('ReasonForQuit', 'N/A — smoke test');
  form.append('Experience', '0');
  form.append('HighestQualification', 'Graduate');
  form.append('Pincode', '600001');
  form.append('CurrentPincode', '600001');
  form.append('CountryId', String(india.id));
  form.append('StateId', String(tn.id));
  form.append('CityId', String(city.id));
  form.append('CurrentCountryId', String(india.id));
  form.append('CurrentStateId', String(tn.id));
  form.append('CurrentCityId', String(city.id));
  form.append(
    'LanguagesJson',
    JSON.stringify([
      { language: 'English', read: 'Fluent', write: 'Fluent', speak: 'Fluent', isMotherTongue: 'No' },
    ])
  );

  if (skill) {
    form.append('skillsRating[0].JobpostId', String(jobPostId));
    form.append('skillsRating[0].SkillId', String(skill.skillId || skill.SkillId || skill.id));
    form.append('skillsRating[0].Skill', String(skill.skill || skill.Skill || skill.name || 'General'));
    form.append('skillsRating[0].ExperienceYear', '0');
    form.append('skillsRating[0].ExperienceMonth', '0');
    form.append('skillsRating[0].Rating', '3');
  } else {
    form.append('skillsRating[0].JobpostId', String(jobPostId));
    form.append('skillsRating[0].SkillId', '0');
    form.append('skillsRating[0].Skill', 'General');
    form.append('skillsRating[0].ExperienceYear', '0');
    form.append('skillsRating[0].ExperienceMonth', '0');
    form.append('skillsRating[0].Rating', '3');
  }

  form.append('Resume', new Blob([MINI_PDF], { type: 'application/pdf' }), 'sekar-test-resume.pdf');
  form.append('ProfilePic', new Blob([MINI_PNG], { type: 'image/png' }), 'sekar-test-photo.png');

  const res = await fetch(`${base}/api/public/careers/apply`, { method: 'POST', body: form });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`careers/apply → ${res.status} ${text}`);
  }
  return { email, status: res.status };
}

(async () => {
  console.log(`Smoke testing ${base} …`);
  if (!LIVE_APPLY) {
    console.log('(HRPops live apply SKIPPED — set HRPOPS_SMOKE_APPLY=1 to enable)');
  }

  const health = await check('/api/health');
  console.log('1/12 health:', health.ok ? 'OK' : 'FAIL');
  const infra = await check('/api/public/infrastructure');
  console.log(`2/12 infrastructure: hero="${infra.hero && infra.hero.title}", inventory=${infra.inventory && infra.inventory.length}`);
  const ongoing = await check('/api/public/ongoing-projects');
  console.log(`3/12 ongoing-projects: ${ongoing.projects && ongoing.projects.length} rows`);
  const completed = await check('/api/public/completed-projects');
  console.log(`4/12 completed-projects: ${completed.projects && completed.projects.length} rows`);
  const gallery = await check('/api/public/gallery');
  console.log(`5/12 gallery: ${gallery.items && gallery.items.length} items`);
  const fleet = await check('/api/public/fleet');
  console.log(`6/12 fleet: ${fleet && fleet.length} assets`);
  const financials = await check('/api/public/financials');
  console.log(`7/12 financials: ${financials && financials.length} sections`);
  const team = await check('/api/public/team-photos');
  console.log(`8/12 team-photos: ${team && team.length} photos`);

  let careersJob = null;
  let careersSkill = null;
  try {
    const careers = await check('/api/public/careers/jobs');
    console.log(`9/12 careers/jobs: ${careers.jobs && careers.jobs.length} openings (company ${careers.companyId})`);
    const countries = await check('/api/public/careers/countries');
    console.log(`10/12 careers/countries: ${countries.countries && countries.countries.length} countries`);
    if (careers.jobs && careers.jobs[0]) {
      careersJob = careers.jobs[0];
      const detail = await check(`/api/public/careers/jobs/${careersJob.jobPostId}`);
      careersSkill =
        (detail.job && detail.job.skillSets && detail.job.skillSets[0]) || null;
      console.log(
        `11/12 careers/job detail: ${detail.job && detail.job.title} skills=${(detail.job && detail.job.skillSets && detail.job.skillSets.length) || 0}`
      );
    } else {
      console.log('11/12 careers/job detail: SKIP (no openings)');
    }
  } catch (err) {
    if (String(err.message).includes('503')) {
      console.log('9-11/12 careers: SKIP (HRPOPS unavailable)');
    } else {
      throw err;
    }
  }

  if (LIVE_APPLY) {
    if (!careersJob) {
      console.log('12/12 careers/apply: SKIP (no openings or HRPOPS unavailable)');
    } else {
      const applied = await smokeApply(careersJob.jobPostId, careersSkill);
      console.log(
        `12/12 careers/apply: OK (${applied.status}) as "${TEST_APPLICANT_NAME}" <${applied.email}>`
      );
    }
  } else {
    console.log('12/12 careers/apply: SKIP (set HRPOPS_SMOKE_APPLY=1 for live apply with test email)');
  }

  console.log('SMOKE OK — ENDPOINTS VERIFIED');
})().catch((err) => {
  console.error('SMOKE FAILED:', err.message);
  process.exit(1);
});

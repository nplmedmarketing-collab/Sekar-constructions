const config = require('../config');

const CANDIDATE_PORTAL = '/api/CandidatePortal';
const DROPDOWN = '/api/Dropdown';
const DEFAULT_COMPANY_ID = 215;
const DEFAULT_CAREERS_PORTAL_URL = 'https://www.hrpops.com/careers/{companyId}';
const RESUME_MIME_ALLOW = /pdf|msword|officedocument|plain|octet-stream/i;
const RESUME_EXT_ALLOW = /\.(pdf|doc|docx)$/i;
const PHOTO_MIME_ALLOW = /^image\/(jpeg|jpg|png|webp)$/i;
const PHOTO_EXT_ALLOW = /\.(jpe?g|png|webp)$/i;
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const RESUME_MAX_BYTES = 5 * 1024 * 1024;

const APPLY_SCALARS = [
  'JobPostID',
  'CandidateName',
  'Dob',
  'Gender',
  'PhoneNumber',
  'Email',
  'Experience',
  'AboutYourSelf',
  'ExpectedSalary',
  'JoinPeriod',
  'PermanentAddress',
  'CurrentAddress',
  'Pincode',
  'CurrentPincode',
  'Relocated',
  'ReasonForQuit',
  'CurrentCTC',
  'WorkModePreference',
  'MaritalStatus',
  'HighestQualification',
  'InterviewMode',
  'CountryId',
  'StateId',
  'CityId',
  'CurrentCountryId',
  'CurrentStateId',
  'CurrentCityId',
];

function getCompanyId() {
  const raw = config.HRPOPS_COMPANY_ID;
  const parsed = Number(raw === '' || raw == null ? DEFAULT_COMPANY_ID : raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_COMPANY_ID;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function authHeaders(extra) {
  const headers = {
    Accept: 'application/json',
    ...(extra || {}),
  };

  if (!config.HRPOPS_API_KEY) return headers;

  const mode = String(config.HRPOPS_AUTH_MODE || 'bearer').toLowerCase();
  if (mode === 'api-key' || mode === 'x-api-key') {
    headers['X-Api-Key'] = config.HRPOPS_API_KEY;
  } else if (mode === 'header') {
    headers.ApiKey = config.HRPOPS_API_KEY;
  } else {
    headers.Authorization = `Bearer ${config.HRPOPS_API_KEY}`;
  }

  return headers;
}

function usesInlineApply() {
  return !String(config.HRPOPS_APPLY_URL_TEMPLATE || '').trim();
}

function buildApplyUrl(jobPostId) {
  const template = String(config.HRPOPS_APPLY_URL_TEMPLATE || '').trim();
  if (!template) return null;

  const companyId = getCompanyId();
  return template
    .replace(/\{companyId\}/g, String(companyId))
    .replace(/\{jobPostId\}/g, String(jobPostId));
}

function normalizeSkillSets(row) {
  const raw = (row && (row.skillSets || row.SkillSets || row.skillsets)) || [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => ({
      skillId: s.skillId ?? s.SkillId ?? null,
      skill: String(s.skill ?? s.Skill ?? '').trim(),
    }))
    .filter((s) => s.skillId != null && s.skill);
}

function normalizeJob(row) {
  if (!row || typeof row !== 'object') return null;

  const jobPostId = row.jobPostId ?? row.id;
  if (jobPostId == null) return null;

  const experienceRaw = row.experienceLabel ?? row.experience;
  const experience = experienceRaw
    ? `${String(experienceRaw).trim()}${/\d/.test(String(experienceRaw)) && !/year/i.test(String(experienceRaw)) ? ' years' : ''}`
    : '';

  const descriptionText = stripHtml(row.description || row.mustHave || row.responsibilities || '');

  return {
    jobPostId,
    title: row.postName || row.title || 'Opening',
    department: row.departmentName || row.department || '',
    experience,
    location: row.locationLabel || row.location || '',
    vacancies: row.noOfVacancies ?? row.vacancies ?? null,
    category: row.categoryName || row.category || '',
    descriptionText,
    postedAt: row.postedAt || row.createdAt || null,
    expiryDate: row.expiryDate || null,
    applyUrl: buildApplyUrl(jobPostId),
    skillSets: normalizeSkillSets(row),
    skillNames: row.skillNames || null,
  };
}

function normalizeDropdownItem(row) {
  if (!row || typeof row !== 'object') return null;
  const id = row.Id ?? row.id;
  const name = row.Name ?? row.name;
  if (id == null || name == null || String(name).trim() === '') return null;
  return { id: Number(id), name: String(name).trim() };
}

function upstreamMessage(body, fallback) {
  if (!body || typeof body !== 'object') return fallback;
  const msg =
    body.message ||
    body.Message ||
    body.error ||
    body.title ||
    (body.errors && String(body.errors)) ||
    null;
  if (msg == null) return fallback;
  const text = typeof msg === 'string' ? msg.trim() : String(msg).trim();
  return text || fallback;
}

async function hrpopsFetch(url, options = {}) {
  // Never set Content-Type for FormData — fetch must add the multipart boundary.
  const headers = authHeaders(options.headers);

  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (cause) {
    const err = new Error(
      (cause && cause.message) || 'Could not reach the HRPops careers service.'
    );
    err.status = 502;
    err.code = 'HRPOPS_UNAVAILABLE';
    err.cause = cause;
    throw err;
  }

  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_err) {
    const err = new Error(
      res.ok
        ? 'Invalid response from HRPOPS API.'
        : `HRPOPS request failed (${res.status}).`
    );
    err.status = 502;
    err.code = 'HRPOPS_BAD_RESPONSE';
    throw err;
  }

  if (!res.ok) {
    // Keep 4xx as 4xx; collapse upstream 5xx to 502 so clients get the real message
    // instead of the generic "Unexpected server error." mask.
    const err = new Error(upstreamMessage(body, `HRPOPS request failed (${res.status}).`));
    err.status = res.status >= 400 && res.status < 500 ? res.status : 502;
    err.code = 'HRPOPS_UPSTREAM_ERROR';
    err.upstreamStatus = res.status;
    throw err;
  }

  if (body && body.status === false) {
    const err = new Error(upstreamMessage(body, 'HRPOPS request failed.'));
    err.status = 502;
    err.code = 'HRPOPS_UPSTREAM_ERROR';
    throw err;
  }

  return body;
}

async function hrpopsRequest(path, options = {}) {
  const url = `${config.HRPOPS_API_BASE}${CANDIDATE_PORTAL}${path}`;
  return hrpopsFetch(url, options);
}

async function dropdownRequest(path) {
  const url = `${config.HRPOPS_API_BASE}${DROPDOWN}${path}`;
  const payload = await hrpopsFetch(url);
  const rows = Array.isArray(payload && payload.data) ? payload.data : [];
  return rows.map(normalizeDropdownItem).filter(Boolean);
}

async function listJobs() {
  const payload = await hrpopsRequest('/jobs');
  const companyId = getCompanyId();
  const rows = Array.isArray(payload && payload.data) ? payload.data : [];
  return rows
    .filter((job) => job && job.publicJobPost !== false && Number(job.companyId) === companyId)
    .map(normalizeJob)
    .filter(Boolean);
}

async function getJob(jobPostId) {
  const id = String(jobPostId || '').trim();
  if (!/^\d+$/.test(id)) {
    const err = new Error('Invalid jobPostId.');
    err.status = 400;
    err.code = 'INVALID_JOB_ID';
    throw err;
  }

  const companyId = getCompanyId();
  const payload = await hrpopsRequest(`/jobs/${companyId}/${id}`);
  return normalizeJob(payload && payload.data ? payload.data : null);
}

async function listCountries() {
  return dropdownRequest('/GetCountry/list');
}

async function listStates(countryId) {
  const id = String(countryId || '').trim();
  if (!/^\d+$/.test(id)) {
    const err = new Error('Invalid countryId.');
    err.status = 400;
    err.code = 'INVALID_COUNTRY_ID';
    throw err;
  }
  return dropdownRequest(`/GetState/list/${id}`);
}

async function listCities(stateId) {
  const id = String(stateId || '').trim();
  if (!/^\d+$/.test(id)) {
    const err = new Error('Invalid stateId.');
    err.status = 400;
    err.code = 'INVALID_STATE_ID';
    throw err;
  }
  // HRPops exposes only GetCity (no GetDistrict). For India this list mixes
  // municipal cities and localities (e.g. Chennai and Adyar for Tamil Nadu).
  return dropdownRequest(`/GetCity/list/${id}`);
}

/**
 * Multipart filename for HRPops: basename only.
 * Never forward Windows/POSIX absolute paths (or directory segments) as the
 * Content-Disposition filename — some upstreams have stored those paths and
 * then built broken public URLs like /Resources/Resume/C:/Inetpub/.../file.pdf.
 */
function safeUploadFilename(name, fallback = 'upload.bin') {
  let base = String(name || '')
    .replace(/\0/g, '')
    .replace(/^.*[/\\]/, '')
    .trim();
  if (!base || base === '.' || base === '..') return fallback;
  // Quotes/newlines break Content-Disposition; keep spaces/parens common in resumes.
  base = base.replace(/["\r\n]/g, '_');
  if (base.length > 180) {
    const extMatch = base.match(/(\.[a-zA-Z0-9]{1,10})$/);
    const ext = extMatch ? extMatch[1] : '';
    base = `${base.slice(0, Math.max(1, 180 - ext.length))}${ext}`;
  }
  return base;
}

function assertResumeFile(file) {
  if (!file || !file.buffer || !file.buffer.length) {
    const err = new Error('Resume file is required.');
    err.status = 400;
    err.code = 'RESUME_REQUIRED';
    throw err;
  }
  if (file.size > RESUME_MAX_BYTES || file.buffer.length > RESUME_MAX_BYTES) {
    const err = new Error('Resume must be 5MB or smaller.');
    err.status = 400;
    err.code = 'RESUME_TOO_LARGE';
    throw err;
  }
  const name = safeUploadFilename(file.originalname, 'resume.pdf');
  const mime = String(file.mimetype || '');
  if (!RESUME_MIME_ALLOW.test(mime) && !RESUME_EXT_ALLOW.test(name)) {
    const err = new Error('Resume must be a PDF or Word document.');
    err.status = 400;
    err.code = 'INVALID_RESUME';
    throw err;
  }
}

function assertProfilePic(file) {
  if (!file || !file.buffer || !file.buffer.length) {
    const err = new Error('Profile photo is required.');
    err.status = 400;
    err.code = 'PHOTO_REQUIRED';
    throw err;
  }
  if (file.size > PHOTO_MAX_BYTES || file.buffer.length > PHOTO_MAX_BYTES) {
    const err = new Error('Profile photo must be 2MB or smaller.');
    err.status = 400;
    err.code = 'PHOTO_TOO_LARGE';
    throw err;
  }
  const name = safeUploadFilename(file.originalname, 'profile.jpg');
  const mime = String(file.mimetype || '');
  if (!PHOTO_MIME_ALLOW.test(mime) && !PHOTO_EXT_ALLOW.test(name)) {
    const err = new Error('Profile photo must be JPG, PNG, or WEBP.');
    err.status = 400;
    err.code = 'INVALID_PHOTO';
    throw err;
  }
}

function appendFile(form, fieldName, file, fallbackName) {
  if (!file || !file.buffer) return;
  const safeName = safeUploadFilename(file.originalname, fallbackName);
  // Copy into Uint8Array — some Node/undici builds mishandle Buffer views in Blob.
  const bytes = new Uint8Array(file.buffer.buffer, file.buffer.byteOffset, file.buffer.byteLength);
  const blob = new Blob([bytes], {
    type: file.mimetype || 'application/octet-stream',
  });
  form.append(fieldName, blob, safeName);
}

function parseSkillsRating(raw) {
  if (raw == null || raw === '') return [];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') return Object.values(raw);
  return [];
}

function parseLanguagesJson(raw) {
  if (raw == null || raw === '') return [];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      const err = new Error('LanguagesJson must be valid JSON.');
      err.status = 400;
      err.code = 'INVALID_LANGUAGES';
      throw err;
    }
  }
  if (Array.isArray(raw)) return raw;
  return [];
}

function truthyMotherTongue(value) {
  if (value === true || value === 1) return true;
  const text = String(value == null ? '' : value).trim().toLowerCase();
  return text === 'true' || text === 'yes' || text === '1';
}

/** Normalize to the HRPops client shape: language/read/write/speak/isMotherTongue. */
function normalizeLanguages(rawList) {
  return (rawList || [])
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const language = String(row.language ?? row.Language ?? '').trim();
      const read = String(row.read ?? row.Read ?? '').trim();
      const write = String(row.write ?? row.Write ?? '').trim();
      const speak = String(row.speak ?? row.Speak ?? '').trim();
      if (!language || !read || !write || !speak) return null;
      return {
        language,
        read,
        write,
        speak,
        isMotherTongue: truthyMotherTongue(row.isMotherTongue ?? row.IsMotherTongue),
      };
    })
    .filter(Boolean);
}

function normalizeSkills(rawList, jobPostId) {
  const out = [];
  (rawList || []).forEach((skill) => {
    if (!skill || typeof skill !== 'object') return;
    const skillName = String(skill.Skill || skill.skill || '').trim();
    const rating = skill.Rating ?? skill.rating;
    if (!skillName || rating == null || rating === '') return;
    out.push({
      JobpostId: Number(skill.JobpostId ?? skill.jobPostId ?? jobPostId) || jobPostId,
      SkillId: Number(skill.SkillId ?? skill.skillId ?? 0) || 0,
      Skill: skillName,
      ExperienceYear: Number(skill.ExperienceYear ?? skill.experienceYear ?? 0) || 0,
      ExperienceMonth: Number(skill.ExperienceMonth ?? skill.experienceMonth ?? 0) || 0,
      Rating: Number(rating),
    });
  });
  return out;
}

function requiredString(value, label) {
  const text = String(value == null ? '' : value).trim();
  if (!text) {
    const err = new Error(`${label} is required.`);
    err.status = 400;
    err.code = 'VALIDATION';
    throw err;
  }
  return text;
}

async function apply(application) {
  const companyId = getCompanyId();
  const fields = (application && application.fields) || {};
  const jobPostId = Number(fields.JobPostID || fields.jobPostId || application.jobPostId);

  if (!Number.isFinite(jobPostId) || jobPostId <= 0) {
    const err = new Error('JobPostID is required.');
    err.status = 400;
    err.code = 'INVALID_JOB_ID';
    throw err;
  }

  const email = requiredString(fields.Email || fields.email, 'Email');
  requiredString(fields.CandidateName || fields.name, 'CandidateName');
  requiredString(fields.PhoneNumber || fields.phone, 'PhoneNumber');
  requiredString(fields.Dob, 'Dob');
  requiredString(fields.Gender, 'Gender');
  requiredString(fields.MaritalStatus, 'MaritalStatus');
  requiredString(fields.WorkModePreference, 'WorkModePreference');
  requiredString(fields.Relocated, 'Relocated');
  requiredString(fields.CurrentAddress, 'CurrentAddress');
  requiredString(fields.PermanentAddress, 'PermanentAddress');
  requiredString(fields.ExpectedSalary, 'ExpectedSalary');
  requiredString(fields.CurrentCTC, 'CurrentCTC');
  requiredString(fields.JoinPeriod, 'JoinPeriod');
  requiredString(fields.InterviewMode, 'InterviewMode');
  requiredString(fields.AboutYourSelf, 'AboutYourSelf');
  requiredString(fields.ReasonForQuit, 'ReasonForQuit');

  assertResumeFile(application && application.resume);
  assertProfilePic(application && application.profilePic);

  const skills = normalizeSkills(
    parseSkillsRating(fields.skillsRating || application.skillsRating),
    jobPostId
  );
  if (!skills.length) {
    const err = new Error('At least one skill assessment is required.');
    err.status = 400;
    err.code = 'SKILLS_REQUIRED';
    throw err;
  }

  const languages = normalizeLanguages(
    parseLanguagesJson(fields.LanguagesJson || application.languagesJson)
  );
  if (!languages.length) {
    const err = new Error(
      'At least one language with read, write, and speak levels is required.'
    );
    err.status = 400;
    err.code = 'LANGUAGES_REQUIRED';
    throw err;
  }

  const form = new FormData();
  form.append('JobPostID', String(jobPostId));

  for (const key of APPLY_SCALARS) {
    if (key === 'JobPostID') continue;
    let value = fields[key];
    if (value == null || value === '') {
      // Accept camelCase aliases from older clients
      const aliasMap = {
        CandidateName: fields.name,
        PhoneNumber: fields.phone,
        Email: fields.email,
        AboutYourSelf: fields.message,
      };
      value = aliasMap[key];
    }
    if (value == null || value === '') continue;
    form.append(key, String(value).trim());
  }

  form.append('LanguagesJson', JSON.stringify(languages));

  skills.forEach((skill, index) => {
    form.append(`skillsRating[${index}].JobpostId`, String(skill.JobpostId));
    form.append(`skillsRating[${index}].SkillId`, String(skill.SkillId));
    form.append(`skillsRating[${index}].Skill`, skill.Skill);
    form.append(`skillsRating[${index}].ExperienceYear`, String(skill.ExperienceYear));
    form.append(`skillsRating[${index}].ExperienceMonth`, String(skill.ExperienceMonth));
    form.append(`skillsRating[${index}].Rating`, String(skill.Rating));
  });

  appendFile(form, 'Resume', application.resume, 'resume.pdf');
  appendFile(form, 'ProfilePic', application.profilePic, 'profile.jpg');

  const payload = await hrpopsRequest(`/apply/${companyId}`, {
    method: 'POST',
    body: form,
  });
  return payload;
}

function getApplyPortalUrl() {
  const companyId = getCompanyId();
  if (config.HRPOPS_CANDIDATE_PORTAL_URL) {
    const base = String(config.HRPOPS_CANDIDATE_PORTAL_URL).replace(/\/$/, '');
    if (base.includes('{companyId}')) {
      return base.replace(/\{companyId\}/g, String(companyId));
    }
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}companyId=${companyId}`;
  }
  return DEFAULT_CAREERS_PORTAL_URL.replace(/\{companyId\}/g, String(companyId));
}

module.exports = {
  listJobs,
  getJob,
  listCountries,
  listStates,
  listCities,
  apply,
  getApplyPortalUrl,
  getCompanyId,
  usesInlineApply,
  safeUploadFilename,
};

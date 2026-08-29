/**
 * Sekar Construction — Careers page (HRPops integration)
 * Loads openings from the Express proxy and submits a 2-step apply wizard.
 */
(function (window, document) {
  'use strict';

  var ORG = {
    name: 'Sekar Constructions',
    url: 'https://www.sekarconstructions.com/',
    logo: 'https://www.sekarconstructions.com/logo-final.png'
  };

  var LANG_LEVELS = ['Basic', 'Intermediate', 'Advanced', 'No'];
  var RATING_OPTIONS = [
    { value: '1', label: '1 — Beginner' },
    { value: '2', label: '2 — Intermediate' },
    { value: '3', label: '3 — Advanced' },
    { value: '4', label: '4 — Expert' }
  ];

  var wizardState = {
    jobPostId: '',
    jobTitle: '',
    skillSets: [],
    step: 1,
    countriesLoaded: false
  };

  function getApiBase() {
    var raw = (window.SekarConfig && window.SekarConfig.apiBaseUrl) || '';
    return String(raw).trim().replace(/\/$/, '');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatEmploymentType(category) {
    var value = String(category || '').trim().toLowerCase();
    if (!value) return 'Full-time';
    if (value.indexOf('temp') !== -1 || value.indexOf('contract') !== -1) return 'Contract';
    if (value.indexOf('part') !== -1) return 'Part-time';
    return 'Full-time';
  }

  function formatDateIso(value) {
    if (!value) return new Date().toISOString().slice(0, 10);
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
    return date.toISOString().slice(0, 10);
  }

  async function apiGet(path) {
    var base = getApiBase();
    if (!base) throw new Error('API is not configured for this site.');
    var res = await fetch(base + path, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include'
    });
    var text = await res.text();
    var body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (err) {
      body = { raw: text };
    }
    if (!res.ok) {
      var msg = (body && body.error && body.error.message) || res.statusText || 'Request failed.';
      throw new Error(msg);
    }
    return body;
  }

  async function fetchJobs() {
    return apiGet('/api/public/careers/jobs');
  }

  async function fetchJobDetail(jobPostId) {
    return apiGet('/api/public/careers/jobs/' + encodeURIComponent(jobPostId));
  }

  function renderStatus(container, type, message) {
    container.innerHTML =
      '<div class="careers-openings-status careers-openings-status--' + type + '" role="status">' +
        '<p>' + escapeHtml(message) + '</p>' +
      '</div>';
  }

  function buildMetaItems(job) {
    var items = [];
    if (job.department) {
      items.push('<li><i class="fa-solid fa-building" aria-hidden="true"></i> ' + escapeHtml(job.department) + '</li>');
    }
    if (job.experience) {
      items.push('<li><i class="fa-solid fa-briefcase" aria-hidden="true"></i> ' + escapeHtml(job.experience) + '</li>');
    }
    if (job.location) {
      items.push('<li><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ' + escapeHtml(job.location) + '</li>');
    }
    if (job.vacancies) {
      items.push('<li><i class="fa-solid fa-users" aria-hidden="true"></i> ' + escapeHtml(String(job.vacancies)) + ' vacancies</li>');
    }
    return items.join('');
  }

  function renderJobCard(job, index) {
    var badge = formatEmploymentType(job.category);
    var applyUrl = job.applyUrl;
    var actionHtml;

    if (applyUrl) {
      actionHtml =
        '<a href="' + escapeHtml(applyUrl) + '" target="_blank" rel="noopener noreferrer" ' +
          'class="btn btn-primary careers-apply-btn" data-job-id="' + escapeHtml(job.jobPostId) + '">' +
          'Apply Now <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>' +
        '</a>';
    } else {
      actionHtml =
        '<button type="button" class="btn btn-primary careers-apply-btn careers-apply-btn--modal" ' +
          'data-job-id="' + escapeHtml(job.jobPostId) + '" data-job-title="' + escapeHtml(job.title) + '">' +
          'Apply Now' +
        '</button>';
    }

    return (
      '<article class="careers-opening-card" style="--job-i: ' + index + '">' +
        '<div class="careers-opening-card__main">' +
          '<div class="careers-opening-card__badge">' + escapeHtml(badge) + '</div>' +
          '<h3 class="careers-opening-card__title">' + escapeHtml(job.title) + '</h3>' +
          '<ul class="careers-opening-card__meta">' + buildMetaItems(job) + '</ul>' +
        '</div>' +
        '<div class="careers-opening-card__action">' + actionHtml + '</div>' +
      '</article>'
    );
  }

  function updateJsonLd(jobs) {
    var existing = document.getElementById('careers-jobposting-ld');
    if (existing) existing.remove();
    if (!jobs.length) return;

    var postings = jobs.map(function (job) {
      return {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: job.title,
        description: job.descriptionText || job.title,
        datePosted: formatDateIso(job.postedAt),
        validThrough: job.expiryDate ? formatDateIso(job.expiryDate) : undefined,
        employmentType: formatEmploymentType(job.category).toUpperCase().replace('-', '_'),
        hiringOrganization: {
          '@type': 'Organization',
          name: ORG.name,
          sameAs: ORG.url,
          logo: ORG.logo
        },
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: job.location || 'Chennai',
            addressRegion: 'Tamil Nadu',
            addressCountry: 'IN'
          }
        },
        directApply: true
      };
    });

    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'careers-jobposting-ld';
    script.textContent = JSON.stringify(postings);
    document.head.appendChild(script);
  }

  function optionHtml(value, label, selected) {
    return (
      '<option value="' + escapeHtml(value) + '"' + (selected ? ' selected' : '') + '>' +
        escapeHtml(label) +
      '</option>'
    );
  }

  function fillSelect(select, items, placeholder, selectedId) {
    if (!select) return;
    var html = '<option value="">' + escapeHtml(placeholder || 'Select') + '</option>';
    (items || []).forEach(function (item) {
      html += optionHtml(String(item.id), item.name, String(item.id) === String(selectedId || ''));
    });
    select.innerHTML = html;
    select.disabled = !(items && items.length);
  }

  function initialsFromName(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'SC';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function yearOptions(max) {
    var html = '<option value="">Select Years</option>';
    for (var i = 0; i <= max; i += 1) {
      html += optionHtml(String(i), String(i));
    }
    return html;
  }

  function monthOptions() {
    var html = '<option value="">Select Months</option>';
    for (var i = 0; i <= 11; i += 1) {
      html += optionHtml(String(i), String(i));
    }
    return html;
  }

  function ratingOptionsHtml() {
    var html = '<option value="">Select Rating</option>';
    RATING_OPTIONS.forEach(function (opt) {
      html += optionHtml(opt.value, opt.label);
    });
    return html;
  }

  function langLevelOptionsHtml(placeholder) {
    var html = '<option value="">' + escapeHtml(placeholder) + '</option>';
    LANG_LEVELS.forEach(function (level) {
      html += optionHtml(level, level);
    });
    return html;
  }

  function skillOptionsHtml(selectedId) {
    var html = '<option value="">Select skill</option>';
    wizardState.skillSets.forEach(function (skill) {
      html += optionHtml(String(skill.skillId), skill.skill, String(skill.skillId) === String(selectedId || ''));
    });
    return html;
  }

  function buildSkillRow(skill) {
    var selectedId = skill && skill.skillId != null ? skill.skillId : '';
    return (
      '<div class="careers-wizard__dyn-row careers-wizard__skill-row" data-row="skill">' +
        '<label class="careers-wizard__field">' +
          '<span>Skill</span>' +
          '<select name="skillId" required>' + skillOptionsHtml(selectedId) + '</select>' +
        '</label>' +
        '<label class="careers-wizard__field">' +
          '<span>Ratings</span>' +
          '<select name="skillRating" required>' + ratingOptionsHtml() + '</select>' +
        '</label>' +
        '<label class="careers-wizard__field">' +
          '<span>Experience</span>' +
          '<div class="careers-wizard__split">' +
            '<select name="skillYears" required>' + yearOptions(40) + '</select>' +
            '<select name="skillMonths" required>' + monthOptions() + '</select>' +
          '</div>' +
        '</label>' +
        '<button type="button" class="careers-wizard__icon-btn" data-remove-row aria-label="Remove skill">' +
          '<i class="fa-solid fa-trash" aria-hidden="true"></i>' +
        '</button>' +
      '</div>'
    );
  }

  function buildLanguageRow() {
    return (
      '<div class="careers-wizard__dyn-row careers-wizard__lang-row" data-row="language">' +
        '<label class="careers-wizard__field">' +
          '<span>Language</span>' +
          '<input type="text" name="language" placeholder="e.g. Tamil" maxlength="80" required>' +
        '</label>' +
        '<label class="careers-wizard__field">' +
          '<span>Read</span>' +
          '<select name="langRead" required>' + langLevelOptionsHtml('Select Read Level') + '</select>' +
        '</label>' +
        '<label class="careers-wizard__field">' +
          '<span>Write</span>' +
          '<select name="langWrite" required>' + langLevelOptionsHtml('Select Write Level') + '</select>' +
        '</label>' +
        '<label class="careers-wizard__field">' +
          '<span>Speak</span>' +
          '<select name="langSpeak" required>' + langLevelOptionsHtml('Select Speak Level') + '</select>' +
        '</label>' +
        '<label class="careers-wizard__toggle">' +
          '<span>Mother Tongue</span>' +
          '<input type="checkbox" name="motherTongue">' +
        '</label>' +
        '<button type="button" class="careers-wizard__icon-btn" data-remove-row aria-label="Remove language">' +
          '<i class="fa-solid fa-trash" aria-hidden="true"></i>' +
        '</button>' +
      '</div>'
    );
  }

  function addressBlock(prefix, title, extraHeaderHtml) {
    return (
      '<div class="careers-wizard__address" data-address="' + prefix + '">' +
        '<div class="careers-wizard__address-head">' +
          '<h4 class="careers-wizard__subtitle">' + escapeHtml(title) + '</h4>' +
          (extraHeaderHtml || '') +
        '</div>' +
        '<div class="careers-wizard__grid careers-wizard__grid--2">' +
          '<label class="careers-wizard__field careers-wizard__field--full">' +
            '<span>Door No &amp; Street Name <em>*</em></span>' +
            '<input type="text" name="' + prefix + 'Street" maxlength="255" required>' +
          '</label>' +
          '<label class="careers-wizard__field careers-wizard__field--full">' +
            '<span>Area <em>*</em></span>' +
            '<input type="text" name="' + prefix + 'Area" maxlength="255" required>' +
          '</label>' +
          '<label class="careers-wizard__field">' +
            '<span>Country <em>*</em></span>' +
            '<select name="' + prefix + 'CountryId" data-geo="country" data-prefix="' + prefix + '" required>' +
              '<option value="">Select Country</option>' +
            '</select>' +
          '</label>' +
          '<label class="careers-wizard__field">' +
            '<span>State <em>*</em></span>' +
            '<select name="' + prefix + 'StateId" data-geo="state" data-prefix="' + prefix + '" required disabled>' +
              '<option value="">Select State</option>' +
            '</select>' +
          '</label>' +
          '<label class="careers-wizard__field">' +
            '<span>City / Locality <em>*</em></span>' +
            '<select name="' + prefix + 'CityId" data-geo="city" data-prefix="' + prefix + '" required disabled>' +
              '<option value="">Select City / Locality</option>' +
            '</select>' +
          '</label>' +
          '<label class="careers-wizard__field">' +
            '<span>Postal code <em>*</em></span>' +
            '<input type="text" name="' + prefix + 'Pincode" placeholder="Enter a Postal Code" maxlength="16" required>' +
          '</label>' +
        '</div>' +
      '</div>'
    );
  }

  function ensureApplyModal() {
    var modal = document.getElementById('careersApplyModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'careersApplyModal';
    modal.className = 'careers-apply-modal';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="careers-apply-modal__backdrop" data-close-modal></div>' +
      '<div class="careers-apply-modal__panel careers-apply-modal__panel--wizard" role="dialog" aria-modal="true" aria-labelledby="careersApplyModalTitle">' +
        '<button type="button" class="careers-apply-modal__close" data-close-modal aria-label="Close application form">&times;</button>' +
        '<div class="careers-wizard__top">' +
          '<h3 id="careersApplyModalTitle" class="careers-apply-modal__title">Apply for role</h3>' +
          '<p class="careers-apply-modal__lead">Complete both steps. Your application is sent to our HR team via HRPops — no account signup required.</p>' +
          '<ol class="careers-wizard__steps" aria-label="Application steps">' +
            '<li class="careers-wizard__step is-active" data-step-indicator="1">' +
              '<span class="careers-wizard__step-num">1</span>' +
              '<span class="careers-wizard__step-label">Personal Details</span>' +
            '</li>' +
            '<li class="careers-wizard__step" data-step-indicator="2">' +
              '<span class="careers-wizard__step-num">2</span>' +
              '<span class="careers-wizard__step-label">Professional &amp; Documents</span>' +
            '</li>' +
          '</ol>' +
        '</div>' +
        '<form id="careersApplyForm" class="careers-wizard" novalidate>' +
          '<input type="hidden" name="JobPostID" id="careersApplyJobId" value="">' +
          '<input type="hidden" name="JobTitle" id="careersApplyJobTitle" value="">' +

          '<div class="careers-wizard__pane is-active" data-step="1">' +
            '<h4 class="careers-wizard__section-title">Personal Details</h4>' +
            '<div class="careers-wizard__personal">' +
              '<div class="careers-wizard__photo">' +
                '<div class="careers-wizard__photo-preview" id="careersPhotoPreview" aria-hidden="true">SC</div>' +
                '<label class="careers-wizard__photo-btn">' +
                  '<input type="file" name="ProfilePic" id="careersProfilePic" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp">' +
                  '<span>Upload Photo</span>' +
                '</label>' +
                '<p class="careers-wizard__hint">JPG, PNG, WEBP (max 2MB)<em>*</em></p>' +
              '</div>' +
              '<div class="careers-wizard__grid careers-wizard__grid--2">' +
                '<label class="careers-wizard__field">' +
                  '<span>Full Name <em>*</em></span>' +
                  '<input type="text" name="CandidateName" id="careersCandidateName" maxlength="255" autocomplete="name" required>' +
                '</label>' +
                '<label class="careers-wizard__field">' +
                  '<span>Date of Birth <em>*</em></span>' +
                  '<input type="date" name="DobInput" id="careersDob" min="1940-01-01" max="2015-12-31" required>' +
                  '<span class="careers-wizard__hint">Born between 1940 and 2015</span>' +
                '</label>' +
                '<label class="careers-wizard__field">' +
                  '<span>Gender <em>*</em></span>' +
                  '<select name="Gender" required>' +
                    '<option value="">Select Gender</option>' +
                    '<option value="Male">Male</option>' +
                    '<option value="Female">Female</option>' +
                    '<option value="Others">Others</option>' +
                  '</select>' +
                '</label>' +
                '<label class="careers-wizard__field">' +
                  '<span>Marital Status <em>*</em></span>' +
                  '<select name="MaritalStatus" required>' +
                    '<option value="">Select Marital Status</option>' +
                    '<option value="Single">Single</option>' +
                    '<option value="Married">Married</option>' +
                  '</select>' +
                '</label>' +
                '<label class="careers-wizard__field">' +
                  '<span>Primary Phone No. <em>*</em></span>' +
                  '<input type="tel" name="PhoneNumber" placeholder="Enter primary phone number" maxlength="20" autocomplete="tel" required>' +
                '</label>' +
                '<label class="careers-wizard__field">' +
                  '<span>Email <em>*</em></span>' +
                  '<input type="email" name="Email" maxlength="255" autocomplete="email" required>' +
                '</label>' +
                '<label class="careers-wizard__field">' +
                  '<span>Qualification</span>' +
                  '<input type="text" name="HighestQualification" placeholder="Enter qualification" maxlength="255">' +
                '</label>' +
                '<label class="careers-wizard__field">' +
                  '<span>Work Mode <em>*</em></span>' +
                  '<select name="WorkModePreference" required>' +
                    '<option value="">Select Work Mode</option>' +
                    '<option value="Work From Office">Work From Office</option>' +
                    '<option value="Remote">Remote</option>' +
                    '<option value="Hybrid">Hybrid</option>' +
                  '</select>' +
                '</label>' +
                '<label class="careers-wizard__field">' +
                  '<span>Willing to Relocate? <em>*</em></span>' +
                  '<select name="Relocated" required>' +
                    '<option value="">Select Relocate Preference</option>' +
                    '<option value="Yes">Yes</option>' +
                    '<option value="No">No</option>' +
                  '</select>' +
                '</label>' +
              '</div>' +
            '</div>' +

            '<h4 class="careers-wizard__section-title">Address Information</h4>' +
            '<div class="careers-wizard__addresses">' +
              addressBlock('current', 'Current Address') +
              addressBlock(
                'permanent',
                'Permanent Address',
                '<label class="careers-wizard__same-addr">' +
                  '<input type="checkbox" id="careersSameAddress" name="sameAsCurrent">' +
                  '<span>Same as Current Address</span>' +
                '</label>'
              ) +
            '</div>' +
          '</div>' +

          '<div class="careers-wizard__pane" data-step="2" hidden>' +
            '<h4 class="careers-wizard__section-title">Professional Details</h4>' +
            '<div class="careers-wizard__grid careers-wizard__grid--3">' +
              '<label class="careers-wizard__field">' +
                '<span>Experience (years)</span>' +
                '<input type="number" name="Experience" min="0" max="70" step="1" placeholder="0-70 years">' +
              '</label>' +
              '<label class="careers-wizard__field">' +
                '<span>Expected Salary <em>*</em></span>' +
                '<input type="text" name="ExpectedSalary" placeholder="e.g. 800000 (up to crores)" required>' +
              '</label>' +
              '<label class="careers-wizard__field">' +
                '<span>Current CTC <em>*</em></span>' +
                '<input type="text" name="CurrentCTC" placeholder="e.g. 600000 (up to crores)" required>' +
              '</label>' +
              '<label class="careers-wizard__field">' +
                '<span>Joining Period (days) <em>*</em></span>' +
                '<input type="number" name="JoinPeriod" min="0" max="365" step="1" placeholder="e.g. 30" required>' +
              '</label>' +
              '<label class="careers-wizard__field">' +
                '<span>Interview Mode <em>*</em></span>' +
                '<select name="InterviewMode" required>' +
                  '<option value="">Select Interview Mode</option>' +
                  '<option value="In-Person">In-Person</option>' +
                  '<option value="Video Call">Video Call</option>' +
                  '<option value="Phone">Phone</option>' +
                '</select>' +
              '</label>' +
              '<label class="careers-wizard__field careers-wizard__field--full">' +
                '<span>About Yourself <em>*</em></span>' +
                '<textarea name="AboutYourSelf" rows="4" maxlength="4000" placeholder="Brief summary about yourself" required></textarea>' +
              '</label>' +
              '<label class="careers-wizard__field careers-wizard__field--full">' +
                '<span>Reason for quitting previous job <em>*</em></span>' +
                '<input type="text" name="ReasonForQuit" maxlength="500" placeholder="Enter reason" required>' +
              '</label>' +
            '</div>' +

            '<h4 class="careers-wizard__section-title">Resume <em>*</em></h4>' +
            '<label class="careers-wizard__dropzone">' +
              '<input type="file" name="Resume" id="careersResume" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required>' +
              '<i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>' +
              '<strong>Click to upload your resume</strong>' +
              '<span>Supported formats: PDF, DOC, DOCX (max 5MB)</span>' +
              '<em id="careersResumeName" class="careers-wizard__file-name" hidden></em>' +
            '</label>' +

            '<div class="careers-wizard__dyn-block">' +
              '<div class="careers-wizard__dyn-head">' +
                '<h4 class="careers-wizard__section-title">Skill Assessment <em>*</em></h4>' +
                '<button type="button" class="btn careers-wizard__add-btn" id="careersAddSkill">+ Add</button>' +
              '</div>' +
              '<div id="careersSkillsList" class="careers-wizard__dyn-list"></div>' +
            '</div>' +

            '<div class="careers-wizard__dyn-block">' +
              '<div class="careers-wizard__dyn-head">' +
                '<h4 class="careers-wizard__section-title">Languages Known <em>*</em></h4>' +
                '<button type="button" class="btn careers-wizard__add-btn" id="careersAddLanguage">+ Add</button>' +
              '</div>' +
              '<div id="careersLanguagesList" class="careers-wizard__dyn-list"></div>' +
            '</div>' +
          '</div>' +

          '<p id="careersApplyFormStatus" class="careers-apply-modal__status" role="status" hidden></p>' +
          '<div class="careers-wizard__actions">' +
            '<button type="button" class="btn careers-wizard__back" id="careersWizardBack" hidden>Back</button>' +
            '<button type="button" class="btn btn-primary careers-apply-btn" id="careersWizardNext">Save &amp; Next</button>' +
            '<button type="submit" class="btn btn-primary careers-apply-btn" id="careersWizardSubmit" hidden>Submit Application</button>' +
          '</div>' +
        '</form>' +
        '<div id="careersApplySuccess" class="careers-apply-success" hidden>' +
          '<div class="careers-apply-success__icon" aria-hidden="true">' +
            '<i class="fa-solid fa-circle-check"></i>' +
          '</div>' +
          '<h3 class="careers-apply-success__title">Successfully applied</h3>' +
          '<p class="careers-apply-success__message">' +
            'Application submitted successfully. Thank you for applying.' +
          '</p>' +
          '<p class="careers-apply-success__note">' +
            'Our HR team will review your application and contact shortlisted candidates.' +
          '</p>' +
          '<button type="button" class="btn btn-primary careers-apply-btn" data-close-modal>Close</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    return modal;
  }

  function setStatus(message, type) {
    var status = document.getElementById('careersApplyFormStatus');
    if (!status) return;
    if (!message) {
      status.hidden = true;
      status.textContent = '';
      status.className = 'careers-apply-modal__status';
      return;
    }
    status.hidden = false;
    status.textContent = message;
    status.className = 'careers-apply-modal__status careers-apply-modal__status--' + (type || 'pending');
  }

  function setStep(step) {
    wizardState.step = step;
    var form = document.getElementById('careersApplyForm');
    if (!form) return;

    form.querySelectorAll('[data-step]').forEach(function (pane) {
      var active = Number(pane.getAttribute('data-step')) === step;
      pane.hidden = !active;
      pane.classList.toggle('is-active', active);
    });

    document.querySelectorAll('[data-step-indicator]').forEach(function (el) {
      var n = Number(el.getAttribute('data-step-indicator'));
      el.classList.toggle('is-active', n === step);
      el.classList.toggle('is-done', n < step);
    });

    var back = document.getElementById('careersWizardBack');
    var next = document.getElementById('careersWizardNext');
    var submit = document.getElementById('careersWizardSubmit');
    // Step 1: Save & Next active. Step 2: Save & Next hidden+disabled; Submit active.
    if (back) {
      back.hidden = step === 1;
      back.disabled = false;
      back.setAttribute('aria-hidden', step === 1 ? 'true' : 'false');
    }
    if (next) {
      next.hidden = step !== 1;
      next.disabled = step !== 1;
      next.setAttribute('aria-hidden', step !== 1 ? 'true' : 'false');
      if (step !== 1) next.setAttribute('tabindex', '-1');
      else next.removeAttribute('tabindex');
    }
    if (submit) {
      submit.hidden = step !== 2;
      submit.disabled = step !== 2;
      submit.setAttribute('aria-hidden', step !== 2 ? 'true' : 'false');
      if (step !== 2) submit.setAttribute('tabindex', '-1');
      else submit.removeAttribute('tabindex');
    }
  }

  function showApplyWizard() {
    var panel = document.querySelector('#careersApplyModal .careers-apply-modal__panel');
    var top = document.querySelector('#careersApplyModal .careers-wizard__top');
    var form = document.getElementById('careersApplyForm');
    var success = document.getElementById('careersApplySuccess');
    if (panel) panel.classList.remove('is-success');
    if (top) top.hidden = false;
    if (form) form.hidden = false;
    if (success) success.hidden = true;
    setStatus('', '');
  }

  function showApplySuccess() {
    var panel = document.querySelector('#careersApplyModal .careers-apply-modal__panel');
    var top = document.querySelector('#careersApplyModal .careers-wizard__top');
    var form = document.getElementById('careersApplyForm');
    var success = document.getElementById('careersApplySuccess');
    var successMsg = success && success.querySelector('.careers-apply-success__message');
    // Clear status first so "Submitting…" never remains under the success view.
    setStatus('', '');
    if (panel) panel.classList.add('is-success');
    if (top) top.hidden = true;
    if (form) form.hidden = true;
    if (success) {
      success.hidden = false;
      if (successMsg) {
        successMsg.textContent = wizardState.jobTitle
          ? 'Application submitted successfully for ' + wizardState.jobTitle + '. Thank you for applying.'
          : 'Application submitted successfully. Thank you for applying.';
      }
      var closeBtn = success.querySelector('[data-close-modal]');
      if (closeBtn) closeBtn.focus();
    }
  }

  function resetDynamicLists() {
    var skillsList = document.getElementById('careersSkillsList');
    var langsList = document.getElementById('careersLanguagesList');
    if (skillsList) {
      if (wizardState.skillSets.length) {
        skillsList.innerHTML = wizardState.skillSets.map(function (skill) {
          return buildSkillRow(skill);
        }).join('');
      } else {
        skillsList.innerHTML = buildSkillRow(null);
      }
    }
    if (langsList) {
      langsList.innerHTML = buildLanguageRow();
    }
  }

  async function loadCountries(preferIndia) {
    var data = await apiGet('/api/public/careers/countries');
    var countries = Array.isArray(data.countries) ? data.countries : [];
    var india = countries.find(function (c) {
      return String(c.name).toLowerCase() === 'india';
    });
    var selected = preferIndia && india ? india.id : '';

    ['current', 'permanent'].forEach(function (prefix) {
      var select = document.querySelector('select[name="' + prefix + 'CountryId"]');
      fillSelect(select, countries, 'Select Country', selected);
      if (selected) {
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    wizardState.countriesLoaded = true;
  }

  function cityPlaceholder() {
    return 'Select City / Locality';
  }

  function isSameAsCurrent() {
    var same = document.getElementById('careersSameAddress');
    return !!(same && same.checked);
  }

  function applyPermanentLock() {
    if (isSameAsCurrent()) setPermanentDisabled(true);
  }

  async function loadStates(prefix, countryId, selectedStateId) {
    var stateSelect = document.querySelector('select[name="' + prefix + 'StateId"]');
    var citySelect = document.querySelector('select[name="' + prefix + 'CityId"]');
    fillSelect(citySelect, [], cityPlaceholder());
    applyPermanentLock();
    if (!countryId) {
      fillSelect(stateSelect, [], 'Select State');
      applyPermanentLock();
      return;
    }
    stateSelect.disabled = true;
    fillSelect(stateSelect, [], 'Loading…');
    try {
      var data = await apiGet('/api/public/careers/states/' + encodeURIComponent(countryId));
      fillSelect(stateSelect, data.states || [], 'Select State', selectedStateId);
      applyPermanentLock();
    } catch (err) {
      fillSelect(stateSelect, [], 'Select State');
      applyPermanentLock();
      throw err;
    }
  }

  async function loadCities(prefix, stateId, selectedCityId) {
    var citySelect = document.querySelector('select[name="' + prefix + 'CityId"]');
    if (!stateId) {
      fillSelect(citySelect, [], cityPlaceholder());
      applyPermanentLock();
      return;
    }
    citySelect.disabled = true;
    fillSelect(citySelect, [], 'Loading…');
    try {
      var data = await apiGet('/api/public/careers/cities/' + encodeURIComponent(stateId));
      fillSelect(citySelect, data.cities || [], cityPlaceholder(), selectedCityId);
      applyPermanentLock();
    } catch (err) {
      fillSelect(citySelect, [], cityPlaceholder());
      applyPermanentLock();
      throw err;
    }
  }

  /**
   * Copy current → permanent. Awaits geo dropdown population so validation
   * can read permanent State/City values (or callers may skip permanent checks).
   */
  async function syncPermanentFromCurrent() {
    var form = document.getElementById('careersApplyForm');
    if (!form) return;

    form.elements.permanentStreet.value = form.elements.currentStreet.value;
    form.elements.permanentArea.value = form.elements.currentArea.value;
    form.elements.permanentPincode.value = form.elements.currentPincode.value;

    var curCountry = form.elements.currentCountryId.value;
    var curState = form.elements.currentStateId.value;
    var curCity = form.elements.currentCityId.value;

    form.elements.permanentCountryId.value = curCountry;
    await loadStates('permanent', curCountry, curState);
    if (curState) {
      await loadCities('permanent', curState, curCity);
    }
    applyPermanentLock();
  }

  function setPermanentDisabled(disabled) {
    var block = document.querySelector('[data-address="permanent"]');
    if (!block) return;
    block.querySelectorAll('input, select').forEach(function (el) {
      if (el.id === 'careersSameAddress' || el.name === 'sameAsCurrent') return;
      el.disabled = disabled;
    });
  }

  /** Resolve address field values, preferring current when same-as-current is on. */
  function addressFieldValue(form, permanentName, currentName) {
    if (isSameAsCurrent()) {
      return String(form.elements[currentName].value || '').trim();
    }
    return String(form.elements[permanentName].value || '').trim();
  }

  function isoToDob(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    var parts = iso.split('-');
    return parts[2] + '-' + parts[1] + '-' + parts[0];
  }

  function validateDob(iso) {
    if (!iso) return 'Date of birth is required.';
    var year = Number(iso.slice(0, 4));
    if (year < 1940 || year > 2015) return 'Date of birth must be between 1940 and 2015.';
    return '';
  }

  function validateStep1(form) {
    var required = [
      ['CandidateName', 'Full name'],
      ['Gender', 'Gender'],
      ['MaritalStatus', 'Marital status'],
      ['PhoneNumber', 'Primary phone'],
      ['Email', 'Email'],
      ['WorkModePreference', 'Work mode'],
      ['Relocated', 'Relocation preference'],
      ['currentStreet', 'Current street'],
      ['currentArea', 'Current area'],
      ['currentCountryId', 'Current country'],
      ['currentStateId', 'Current state'],
      ['currentCityId', 'Current city / locality'],
      ['currentPincode', 'Current postal code']
    ];

    if (!isSameAsCurrent()) {
      required = required.concat([
        ['permanentStreet', 'Permanent street'],
        ['permanentArea', 'Permanent area'],
        ['permanentCountryId', 'Permanent country'],
        ['permanentStateId', 'Permanent state'],
        ['permanentCityId', 'Permanent city / locality'],
        ['permanentPincode', 'Permanent postal code']
      ]);
    }

    for (var i = 0; i < required.length; i += 1) {
      var el = form.elements[required[i][0]];
      if (!el || !String(el.value || '').trim()) {
        return required[i][1] + ' is required.';
      }
    }

    var dobErr = validateDob(form.elements.DobInput.value);
    if (dobErr) return dobErr;

    var email = String(form.elements.Email.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';

    var phone = String(form.elements.PhoneNumber.value || '').trim();
    if (phone.replace(/\D/g, '').length < 8) return 'Enter a valid phone number.';

    var photo = form.elements.ProfilePic && form.elements.ProfilePic.files && form.elements.ProfilePic.files[0];
    if (!photo) return 'Please upload a profile photo (JPG, PNG, or WEBP).';
    if (photo.size > 2 * 1024 * 1024) return 'Profile photo must be 2MB or smaller.';
    if (!/\.(jpe?g|png|webp)$/i.test(photo.name) && !/^image\/(jpeg|png|webp)$/i.test(photo.type)) {
      return 'Profile photo must be JPG, PNG, or WEBP.';
    }

    return '';
  }

  function collectSkills(form) {
    var rows = form.querySelectorAll('[data-row="skill"]');
    var skills = [];
    rows.forEach(function (row) {
      var skillSelect = row.querySelector('[name="skillId"]');
      var rating = row.querySelector('[name="skillRating"]');
      var years = row.querySelector('[name="skillYears"]');
      var months = row.querySelector('[name="skillMonths"]');
      if (!skillSelect || !skillSelect.value || !rating || !rating.value) return;
      var opt = skillSelect.options[skillSelect.selectedIndex];
      skills.push({
        SkillId: Number(skillSelect.value) || 0,
        Skill: opt ? opt.textContent : '',
        Rating: Number(rating.value),
        ExperienceYear: Number(years && years.value ? years.value : 0),
        ExperienceMonth: Number(months && months.value ? months.value : 0),
        JobpostId: Number(wizardState.jobPostId)
      });
    });
    return skills;
  }

  function collectLanguages(form) {
    var rows = form.querySelectorAll('[data-row="language"]');
    var languages = [];
    rows.forEach(function (row) {
      var language = row.querySelector('[name="language"]');
      var read = row.querySelector('[name="langRead"]');
      var write = row.querySelector('[name="langWrite"]');
      var speak = row.querySelector('[name="langSpeak"]');
      var mother = row.querySelector('[name="motherTongue"]');
      if (!language || !String(language.value || '').trim()) return;
      if (!read.value || !write.value || !speak.value) return;
      languages.push({
        language: String(language.value).trim(),
        read: read.value,
        write: write.value,
        speak: speak.value,
        isMotherTongue: !!(mother && mother.checked)
      });
    });
    return languages;
  }

  function validateStep2(form) {
    var required = [
      ['ExpectedSalary', 'Expected salary'],
      ['CurrentCTC', 'Current CTC'],
      ['JoinPeriod', 'Joining period'],
      ['InterviewMode', 'Interview mode'],
      ['AboutYourSelf', 'About yourself'],
      ['ReasonForQuit', 'Reason for quitting']
    ];
    for (var i = 0; i < required.length; i += 1) {
      var el = form.elements[required[i][0]];
      if (!el || !String(el.value || '').trim()) return required[i][1] + ' is required.';
    }

    var resume = form.elements.Resume && form.elements.Resume.files && form.elements.Resume.files[0];
    if (!resume) return 'Please upload your résumé (PDF or Word).';
    if (resume.size > 5 * 1024 * 1024) return 'Resume must be 5MB or smaller.';
    if (!/\.(pdf|doc|docx)$/i.test(resume.name)) return 'Resume must be PDF, DOC, or DOCX.';

    if (wizardState.skillSets.length && !collectSkills(form).length) {
      return 'Add at least one skill assessment using the job skill list.';
    }
    if (!wizardState.skillSets.length) {
      return 'This job has no skill sets configured in HRPops. Please contact HR.';
    }
    if (!collectLanguages(form).length) {
      return 'Add at least one language with read, write, and speak levels.';
    }
    return '';
  }

  function combineAddress(street, area) {
    return [String(street || '').trim(), String(area || '').trim()].filter(Boolean).join(', ');
  }

  /** Basename only for multipart filename (never a full path). */
  function safeUploadFileName(name, fallback) {
    var base = String(name || '')
      .replace(/\0/g, '')
      .replace(/^.*[/\\]/, '')
      .replace(/["\r\n]/g, '_')
      .trim();
    if (!base || base === '.' || base === '..') return fallback || 'upload.bin';
    if (base.length > 180) base = base.slice(0, 180);
    return base;
  }

  async function submitApplication(form) {
    var base = getApiBase();
    var submitBtn = document.getElementById('careersWizardSubmit');
    var nextBtn = document.getElementById('careersWizardNext');
    var backBtn = document.getElementById('careersWizardBack');

    var step2Error = validateStep2(form);
    if (step2Error) {
      setStatus(step2Error, 'error');
      return;
    }

    if (isSameAsCurrent()) {
      try {
        await syncPermanentFromCurrent();
      } catch (err) {
        setStatus(err.message || 'Could not sync permanent address.', 'error');
        return;
      }
    }

    var skills = collectSkills(form);
    var languages = collectLanguages(form);
    var resume = form.elements.Resume.files[0];
    var photo = form.elements.ProfilePic && form.elements.ProfilePic.files && form.elements.ProfilePic.files[0];

    var permanentStreet = addressFieldValue(form, 'permanentStreet', 'currentStreet');
    var permanentArea = addressFieldValue(form, 'permanentArea', 'currentArea');
    var permanentCountryId = addressFieldValue(form, 'permanentCountryId', 'currentCountryId');
    var permanentStateId = addressFieldValue(form, 'permanentStateId', 'currentStateId');
    var permanentCityId = addressFieldValue(form, 'permanentCityId', 'currentCityId');
    var permanentPincode = addressFieldValue(form, 'permanentPincode', 'currentPincode');

    var payload = new FormData();
    payload.append('JobPostID', String(wizardState.jobPostId));
    if (wizardState.jobTitle) {
      payload.append('JobTitle', String(wizardState.jobTitle));
    }
    payload.append('CandidateName', form.elements.CandidateName.value.trim());
    payload.append('Dob', isoToDob(form.elements.DobInput.value));
    payload.append('Gender', form.elements.Gender.value);
    payload.append('MaritalStatus', form.elements.MaritalStatus.value);
    payload.append('PhoneNumber', form.elements.PhoneNumber.value.trim());
    payload.append('Email', form.elements.Email.value.trim());
    payload.append('HighestQualification', form.elements.HighestQualification.value.trim());
    payload.append('WorkModePreference', form.elements.WorkModePreference.value);
    payload.append('Relocated', form.elements.Relocated.value);

    payload.append('CurrentAddress', combineAddress(form.elements.currentStreet.value, form.elements.currentArea.value));
    payload.append('CurrentCountryId', form.elements.currentCountryId.value);
    payload.append('CurrentStateId', form.elements.currentStateId.value);
    payload.append('CurrentCityId', form.elements.currentCityId.value);
    payload.append('CurrentPincode', form.elements.currentPincode.value.trim());

    payload.append('PermanentAddress', combineAddress(permanentStreet, permanentArea));
    payload.append('CountryId', permanentCountryId);
    payload.append('StateId', permanentStateId);
    payload.append('CityId', permanentCityId);
    payload.append('Pincode', permanentPincode);

    if (form.elements.Experience.value !== '') {
      payload.append('Experience', String(form.elements.Experience.value));
    }
    payload.append('ExpectedSalary', form.elements.ExpectedSalary.value.trim());
    payload.append('CurrentCTC', form.elements.CurrentCTC.value.trim());
    payload.append('JoinPeriod', String(form.elements.JoinPeriod.value).trim());
    payload.append('InterviewMode', form.elements.InterviewMode.value);
    payload.append('AboutYourSelf', form.elements.AboutYourSelf.value.trim());
    payload.append('ReasonForQuit', form.elements.ReasonForQuit.value.trim());
    payload.append('LanguagesJson', JSON.stringify(languages));
    payload.append('skillsRating', JSON.stringify(skills));

    payload.append('Resume', resume, safeUploadFileName(resume.name, 'resume.pdf'));
    payload.append('ProfilePic', photo, safeUploadFileName(photo.name, 'profile.jpg'));

    if (submitBtn) submitBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (backBtn) backBtn.disabled = true;
    setStatus('Submitting application…', 'pending');

    try {
      var res = await fetch(base + '/api/public/careers/apply', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
        body: payload
      });
      var text = await res.text();
      var body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch (err) {
        body = { raw: text };
      }
      if (!res.ok) {
        var msg = (body && body.error && body.error.message) || 'Application could not be submitted.';
        throw new Error(msg);
      }
      showApplySuccess();
    } catch (err) {
      setStatus(err.message || 'Application could not be submitted.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = wizardState.step !== 2;
      if (nextBtn) nextBtn.disabled = wizardState.step !== 1;
      if (backBtn) backBtn.disabled = false;
    }
  }

  async function openApplyModal(jobId, jobTitle) {
    var modal = ensureApplyModal();
    var title = document.getElementById('careersApplyModalTitle');
    var jobInput = document.getElementById('careersApplyJobId');
    var jobTitleInput = document.getElementById('careersApplyJobTitle');
    var form = document.getElementById('careersApplyForm');

    wizardState.jobPostId = String(jobId || '');
    wizardState.jobTitle = jobTitle || 'Selected role';
    wizardState.skillSets = [];

    if (title) title.textContent = 'Apply — ' + wizardState.jobTitle;
    if (jobInput) jobInput.value = wizardState.jobPostId;
    if (jobTitleInput) jobTitleInput.value = wizardState.jobTitle;
    if (form) form.reset();
    if (jobInput) jobInput.value = wizardState.jobPostId;
    if (jobTitleInput) jobTitleInput.value = wizardState.jobTitle;
    setStatus('', '');
    showApplyWizard();
    setStep(1);
    setPermanentDisabled(false);

    var preview = document.getElementById('careersPhotoPreview');
    if (preview) {
      preview.textContent = 'SC';
      preview.style.backgroundImage = '';
      preview.classList.remove('has-image');
    }
    var resumeName = document.getElementById('careersResumeName');
    if (resumeName) {
      resumeName.hidden = true;
      resumeName.textContent = '';
    }

    modal.hidden = false;
    document.body.classList.add('careers-modal-open');

    setStatus('Loading application form…', 'pending');
    try {
      var detail = await fetchJobDetail(wizardState.jobPostId);
      wizardState.skillSets = (detail.job && Array.isArray(detail.job.skillSets)) ? detail.job.skillSets : [];
      if (detail.job && detail.job.title) {
        wizardState.jobTitle = detail.job.title;
        if (title) title.textContent = 'Apply — ' + wizardState.jobTitle;
        if (jobTitleInput) jobTitleInput.value = wizardState.jobTitle;
      }
      resetDynamicLists();
      await loadCountries(true);
      setStatus('', '');
      var firstField = form && form.querySelector('input[name="CandidateName"]');
      if (firstField) firstField.focus();
    } catch (err) {
      setStatus(err.message || 'Could not load application form.', 'error');
    }
  }

  function closeApplyModal() {
    var modal = document.getElementById('careersApplyModal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('careers-modal-open');
    // Restore wizard visibility so the next open is not stuck on success.
    showApplyWizard();
  }

  function bindWizardEvents() {
    var form = document.getElementById('careersApplyForm');
    if (!form || form.getAttribute('data-bound') === '1') return;
    form.setAttribute('data-bound', '1');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (wizardState.step !== 2) return;
      submitApplication(form);
    });

    document.getElementById('careersWizardNext').addEventListener('click', async function () {
      var nextBtn = document.getElementById('careersWizardNext');
      if (nextBtn) nextBtn.disabled = true;
      try {
        if (isSameAsCurrent()) {
          setStatus('Copying current address…', 'pending');
          try {
            await syncPermanentFromCurrent();
          } catch (syncErr) {
            setStatus(syncErr.message || 'Could not copy current address.', 'error');
            return;
          }
        }
        var err = validateStep1(form);
        if (err) {
          setStatus(err, 'error');
          return;
        }
        setStatus('', '');
        setStep(2);
      } finally {
        // Re-enable only while still on Step 1 (validation/sync failure).
        // On Step 2, setStep() already hides and disables Save & Next.
        if (nextBtn && wizardState.step === 1) nextBtn.disabled = false;
      }
    });

    document.getElementById('careersWizardBack').addEventListener('click', function () {
      setStatus('', '');
      setStep(1);
    });

    document.getElementById('careersAddSkill').addEventListener('click', function () {
      var list = document.getElementById('careersSkillsList');
      list.insertAdjacentHTML('beforeend', buildSkillRow(null));
    });

    document.getElementById('careersAddLanguage').addEventListener('click', function () {
      var list = document.getElementById('careersLanguagesList');
      list.insertAdjacentHTML('beforeend', buildLanguageRow());
    });

    form.addEventListener('click', function (event) {
      var removeBtn = event.target.closest('[data-remove-row]');
      if (!removeBtn) return;
      var row = removeBtn.closest('[data-row]');
      if (!row) return;
      var list = row.parentElement;
      if (list && list.querySelectorAll('[data-row]').length <= 1) {
        setStatus('Keep at least one row.', 'error');
        return;
      }
      row.remove();
    });

    form.addEventListener('change', function (event) {
      var target = event.target;
      if (target && target.getAttribute('data-geo') === 'country') {
        var prefix = target.getAttribute('data-prefix');
        loadStates(prefix, target.value).then(function () {
          if (isSameAsCurrent() && prefix === 'current') {
            return syncPermanentFromCurrent();
          }
        }).catch(function (err) {
          setStatus(err.message || 'Could not load states.', 'error');
        });
        return;
      }
      if (target && target.getAttribute('data-geo') === 'state') {
        var prefixState = target.getAttribute('data-prefix');
        loadCities(prefixState, target.value).then(function () {
          if (isSameAsCurrent() && prefixState === 'current') {
            return syncPermanentFromCurrent();
          }
        }).catch(function (err) {
          setStatus(err.message || 'Could not load cities.', 'error');
        });
        return;
      }
      if (target && target.getAttribute('data-geo') === 'city') {
        if (isSameAsCurrent() && target.getAttribute('data-prefix') === 'current') {
          syncPermanentFromCurrent().catch(function (err) {
            setStatus(err.message || 'Could not copy current address.', 'error');
          });
        }
        return;
      }
      if (
        isSameAsCurrent() &&
        target &&
        target.name &&
        (target.name === 'currentStreet' || target.name === 'currentArea' || target.name === 'currentPincode')
      ) {
        form.elements.permanentStreet.value = form.elements.currentStreet.value;
        form.elements.permanentArea.value = form.elements.currentArea.value;
        form.elements.permanentPincode.value = form.elements.currentPincode.value;
      }
    });

    var same = document.getElementById('careersSameAddress');
    if (same) {
      same.addEventListener('change', async function () {
        if (same.checked) {
          setPermanentDisabled(true);
          setStatus('Copying current address…', 'pending');
          try {
            await syncPermanentFromCurrent();
            setStatus('', '');
          } catch (err) {
            setStatus(err.message || 'Could not copy current address.', 'error');
          }
        } else {
          setPermanentDisabled(false);
        }
      });
    }

    var nameInput = document.getElementById('careersCandidateName');
    var photoPreview = document.getElementById('careersPhotoPreview');
    if (nameInput && photoPreview) {
      nameInput.addEventListener('input', function () {
        if (photoPreview.classList.contains('has-image')) return;
        photoPreview.textContent = initialsFromName(nameInput.value);
      });
    }

    var photoInput = document.getElementById('careersProfilePic');
    if (photoInput && photoPreview) {
      photoInput.addEventListener('change', function () {
        var file = photoInput.files && photoInput.files[0];
        if (!file) {
          photoPreview.style.backgroundImage = '';
          photoPreview.classList.remove('has-image');
          photoPreview.textContent = initialsFromName(nameInput && nameInput.value);
          return;
        }
        if (file.size > 2 * 1024 * 1024) {
          setStatus('Profile photo must be 2MB or smaller.', 'error');
          photoInput.value = '';
          return;
        }
        var url = URL.createObjectURL(file);
        photoPreview.style.backgroundImage = 'url("' + url + '")';
        photoPreview.classList.add('has-image');
        photoPreview.textContent = '';
      });
    }

    var resumeInput = document.getElementById('careersResume');
    var resumeName = document.getElementById('careersResumeName');
    if (resumeInput && resumeName) {
      resumeInput.addEventListener('change', function () {
        var file = resumeInput.files && resumeInput.files[0];
        if (!file) {
          resumeName.hidden = true;
          resumeName.textContent = '';
          return;
        }
        resumeName.hidden = false;
        resumeName.textContent = file.name;
      });
    }
  }

  function bindInteractions(listEl, applyPortalUrl) {
    listEl.addEventListener('click', function (event) {
      var btn = event.target.closest('.careers-apply-btn--modal');
      if (!btn) return;
      openApplyModal(btn.getAttribute('data-job-id'), btn.getAttribute('data-job-title'));
    });

    ensureApplyModal();
    bindWizardEvents();

    document.addEventListener('click', function (event) {
      if (event.target.matches('[data-close-modal]')) closeApplyModal();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeApplyModal();
    });

    var generalApply = document.getElementById('careersGeneralApply');
    if (generalApply && applyPortalUrl) {
      // Keep on-page openings as primary CTA when inline apply is active.
      generalApply.href = '#careers-openings';
      generalApply.removeAttribute('target');
      generalApply.removeAttribute('rel');
      generalApply.innerHTML = 'View Open Positions';
    }
  }

  async function init() {
    var listEl = document.getElementById('careersOpeningsList');
    if (!listEl) return;

    renderStatus(listEl, 'loading', 'Loading current openings…');

    try {
      var data = await fetchJobs();
      var jobs = Array.isArray(data && data.jobs) ? data.jobs : [];

      if (!jobs.length) {
        renderStatus(listEl, 'empty', 'No open positions at the moment. Send your résumé to ho@sekarconstructions.com and we will contact you when a suitable role opens.');
        updateJsonLd([]);
        return;
      }

      listEl.innerHTML = jobs.map(renderJobCard).join('');
      updateJsonLd(jobs);
      bindInteractions(listEl, data.applyPortalUrl || null);
    } catch (err) {
      renderStatus(listEl, 'error', err.message || 'Unable to load openings right now. Please email ho@sekarconstructions.com for career enquiries.');
      updateJsonLd([]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);

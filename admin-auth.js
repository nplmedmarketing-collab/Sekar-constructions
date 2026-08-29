/**
 * Sekar Construction - Super Admin engine (admin-login / admin-dashboard only)
 * API auth (bcrypt sessions), audit logger, lockout UI, inquiry admin, CMS writes.
 * Public marketing pages must load cms-public.js instead — no secrets ship here.
 * API auth: bcrypt sessions, CSRF on cookie mutations, server-side TOTP 2FA.
 */

(function (window) {
  'use strict';

  const STORAGE_KEYS = {
    ADMIN_CONFIG: 'sc_admin_config_v1',
    SESSION_TOKEN: 'sc_admin_session_v1',
    LOGIN_CHALLENGE: 'sc_admin_login_challenge_v1',
    LOCKOUT_STATE: 'sc_admin_lockout_v1',
    AUDIT_LOGS: 'sc_admin_audit_logs_v1',
    INQUIRIES: 'sc_admin_inquiries_v1'
  };

  /**
   * Client inactivity / lockout UI settings only.
   * No password hash, salt, TOTP secret, or backup PIN ships in this file.
   * Auth is API-only (apiBaseUrl + SEED_ADMIN_PASSWORD on the server).
   */
  const CONFIG_DEFAULTS = {
    maxFailedAttempts: 3,
    lockoutDurationMinutes: 15,
    // Client inactivity watchdog (API mode). Server cookie/session is SESSION_HOURS (default 8h).
    sessionTimeoutMinutes: 15,
    sessionWarningMinutes: 2
  };


  class AdminSecurityEngine {
    constructor() {
      this._cmsCache = {};
      this._apiToken = null;
      this._csrfToken = null;
      this._loginChallenge = null;
      this._totpSetupCache = null;
      this.initStorage();
      this.hydrateSessionFromStorage();
      this.sessionTimer = null;
      this.warningTimer = null;
      this.activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
      this.boundResetTimer = this.resetInactivityTimer.bind(this);
      this.apiReady = this.useApi() ? this.hydrateFromApi() : Promise.resolve();
    }

    /** @returns {string} API base URL without trailing slash, or '' if offline/local mode */
    getApiBase() {
      const raw = (window.SekarConfig && window.SekarConfig.apiBaseUrl) || '';
      return String(raw).trim().replace(/\/$/, '');
    }

    useApi() {
      return Boolean(this.getApiBase());
    }

    hydrateSessionFromStorage() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
        if (!raw) return;
        const session = JSON.parse(raw);
        // Prefer apiToken; fall back to token (same value after API login).
        const bearer = session.apiToken || session.token || null;
        if (bearer) this._apiToken = bearer;
        if (session.csrfToken) this._csrfToken = session.csrfToken;
      } catch (e) { /* ignore */ }
    }

    /** Read mustChangePassword from the client session blob (set at login). */
    sessionMustChangePassword() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
        if (!raw) return false;
        return !!(JSON.parse(raw).mustChangePassword);
      } catch (e) {
        return false;
      }
    }

    clearMustChangePasswordFlag() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
        if (!raw) return;
        const session = JSON.parse(raw);
        session.mustChangePassword = false;
        sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, JSON.stringify(session));
      } catch (e) { /* ignore */ }
    }

    persistSessionExtras(sessionObj) {
      sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, JSON.stringify(sessionObj));
      this._apiToken = sessionObj.apiToken || sessionObj.token || null;
      this._csrfToken = sessionObj.csrfToken || null;
    }

    async refreshCsrfToken() {
      if (!this.useApi() || !this.isSessionValid()) return null;
      this.hydrateSessionFromStorage();
      const data = await this.apiFetch('/api/auth/csrf', { method: 'GET' });
      if (data && data.csrfToken) {
        this._csrfToken = data.csrfToken;
        try {
          const raw = sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
          if (raw) {
            const session = JSON.parse(raw);
            session.csrfToken = data.csrfToken;
            sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, JSON.stringify(session));
          }
        } catch (e) { /* ignore */ }
      }
      return this._csrfToken;
    }

    async apiFetch(path, options = {}) {
      const base = this.getApiBase();
      if (!base) throw new Error('API base URL not configured');
      const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
      let token = this._apiToken;
      if (!token) {
        this.hydrateSessionFromStorage();
        token = this._apiToken;
      }
      if (token) headers.Authorization = 'Bearer ' + token;

      const method = (options.method || 'GET').toUpperCase();
      const isMutation = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
      if (isMutation) {
        if (!this._csrfToken) this.hydrateSessionFromStorage();
        if (this._csrfToken) headers['X-CSRF-Token'] = this._csrfToken;
      }

      const res = await fetch(base + path, Object.assign({}, options, {
        headers,
        credentials: 'include'
      }));
      let body = null;
      const text = await res.text();
      try { body = text ? JSON.parse(text) : null; } catch (e) { body = { raw: text }; }
      if (!res.ok) {
        const code = body && body.error && body.error.code;
        if (res.status === 403 && (code === 'CSRF_TOKEN_INVALID' || code === 'CSRF_TOKEN_REQUIRED')) {
          await this.refreshCsrfToken();
          if (this._csrfToken && isMutation && !options._csrfRetried) {
            return this.apiFetch(path, Object.assign({}, options, { _csrfRetried: true }));
          }
        }
        const msg = (body && body.error && body.error.message) || res.statusText || 'Request failed';
        const err = new Error(msg);
        err.status = res.status;
        err.body = body;
        throw err;
      }
      return body;
    }

    async hydrateFromApi() {
      if (!this.useApi()) return;
      // Financials: use admin GET when logged in so unpublished turnover years stay editable.
      const financialsPath = this.isSessionValid()
        ? '/api/admin/financials'
        : '/api/public/financials';
      const endpoints = [
        ['infrastructure', '/api/public/infrastructure'],
        ['ongoing', '/api/public/ongoing-projects'],
        ['completed', '/api/public/completed-projects'],
        ['gallery', '/api/public/gallery'],
        ['fleet', '/api/public/fleet'],
        ['financials', financialsPath],
        ['team', '/api/public/team-photos']
      ];
      await Promise.all(endpoints.map(async ([key, path]) => {
        try {
          this._cmsCache[key] = await this.apiFetch(path, { method: 'GET', headers: {} });
        } catch (err) {
          console.warn('Failed to hydrate CMS from API:', path, err.message);
        }
      }));
    }

    /**
     * Initialize LocalStorage defaults.
     * Never writes password hashes / TOTP secrets. Auth requires apiBaseUrl.
     */
    initStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.INQUIRIES);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const cleaned = list.filter((i) => !/^INQ-2026-00[1-4]$/.test(String(i.id || '')));
            if (cleaned.length !== list.length) {
              localStorage.setItem(STORAGE_KEYS.INQUIRIES, JSON.stringify(cleaned));
            }
          }
        } else {
          localStorage.setItem(STORAGE_KEYS.INQUIRIES, JSON.stringify([]));
        }
      } catch (e) {
        localStorage.setItem(STORAGE_KEYS.INQUIRIES, JSON.stringify([]));
      }

      if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
        const initialLogs = [
          {
            id: 'LOG-001',
            timestamp: new Date().toISOString(),
            event: 'SYSTEM_INITIALIZED',
            details: this.useApi()
              ? 'Admin client loaded in API mode (server auth).'
              : 'Admin client loaded without apiBaseUrl — configure config.js for login.',
            level: 'INFO',
            ip: '127.0.0.1'
          }
        ];
        localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(initialLogs));
      }
    }

    /**
     * RFC 6238 TOTP (Time-based One-Time Password) Implementation
     * Decodes Base32 secret and computes 6-digit rolling OTP code for current 30s window.
     */
    base32Decode(base32) {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let bits = 0;
      let value = 0;
      let output = [];

      for (let i = 0; i < base32.length; i++) {
        const char = base32.charAt(i).toUpperCase();
        if (char === '=') break;
        const val = alphabet.indexOf(char);
        if (val === -1) continue;

        value = (value << 5) | val;
        bits += 5;

        if (bits >= 8) {
          output.push((value >>> (bits - 8)) & 255);
          bits -= 8;
        }
      }
      return new Uint8Array(output);
    }

    async generateTOTPCode(secretBase32, timeOffsetSteps = 0) {
      try {
        const keyBytes = this.base32Decode(secretBase32 || '');
        if (!keyBytes || !keyBytes.length) return null;
        const epoch = Math.floor(Date.now() / 1000);
        const counter = Math.floor(epoch / 30) + timeOffsetSteps;

        // Counter to 8-byte array
        const counterBytes = new Uint8Array(8);
        let tempCounter = counter;
        for (let i = 7; i >= 0; i--) {
          counterBytes[i] = tempCounter & 0xff;
          tempCounter = Math.floor(tempCounter / 256);
        }

        const cryptoKey = await window.crypto.subtle.importKey(
          'raw',
          keyBytes,
          { name: 'HMAC', hash: 'SHA-1' },
          false,
          ['sign']
        );

        const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBytes);
        const hash = new Uint8Array(signature);
        const offset = hash[hash.length - 1] & 0xf;

        const binary =
          ((hash[offset] & 0x7f) << 24) |
          ((hash[offset + 1] & 0xff) << 16) |
          ((hash[offset + 2] & 0xff) << 8) |
          (hash[offset + 3] & 0xff);

        const otp = binary % 1000000;
        return otp.toString().padStart(6, '0');
      } catch (err) {
        console.warn('TOTP calculation failed:', err);
        return null;
      }
    }

    /**
     * Synchronous Helper to verify TOTP across clock skew window (current, -1, +1 step)
     */
    async verifyTOTP(enteredPin, secretBase32) {
      if (!secretBase32 || !enteredPin) return false;

      // Check rolling TOTP codes for current time window (-1 step, 0 step, +1 step)
      for (let offset of [0, -1, 1]) {
        const validOtp = await this.generateTOTPCode(secretBase32, offset);
        if (enteredPin === validOtp) {
          return true;
        }
      }
      return false;
    }

    /**
     * Web Crypto API: Hash password string using PBKDF2 with SHA-256
     */
    async hashPassword(password, salt) {
      try {
        const encoder = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
          'raw',
          encoder.encode(password),
          { name: 'PBKDF2' },
          false,
          ['deriveBits', 'deriveKey']
        );
        const saltBuffer = encoder.encode(salt);
        const derivedBits = await window.crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations: 100000,
            hash: 'SHA-256'
          },
          keyMaterial,
          256
        );
        return Array.from(new Uint8Array(derivedBits))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } catch (err) {
        return this.simpleHash(password + salt);
      }
    }

    simpleHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      return Math.abs(hash).toString(16).padStart(32, '0');
    }

    /**
     * Check anti-brute force lockout state
     */
    getLockoutState() {
      const data = localStorage.getItem(STORAGE_KEYS.LOCKOUT_STATE);
      if (!data) return { locked: false, attempts: 0, unlockTime: null };
      
      const lockout = JSON.parse(data);
      if (lockout.locked && new Date().getTime() > lockout.unlockTime) {
        const resetState = { locked: false, attempts: 0, unlockTime: null };
        localStorage.setItem(STORAGE_KEYS.LOCKOUT_STATE, JSON.stringify(resetState));
        this.addAuditLog('LOCKOUT_EXPIRED', 'Account automatically unlocked after cooldown period.', 'INFO');
        return resetState;
      }
      return lockout;
    }

    recordFailedAttempt() {
      const config = this.getConfig();
      let lockout = this.getLockoutState();
      
      lockout.attempts += 1;
      this.addAuditLog('LOGIN_FAILED', `Invalid credential attempt (${lockout.attempts}/${config.maxFailedAttempts}).`, 'WARNING');

      if (lockout.attempts >= config.maxFailedAttempts) {
        const unlockTimestamp = new Date().getTime() + config.lockoutDurationMinutes * 60 * 1000;
        lockout = {
          locked: true,
          attempts: lockout.attempts,
          unlockTime: unlockTimestamp
        };
        this.addAuditLog('ACCOUNT_LOCKED', `Too many failed attempts. Super Admin locked out for ${config.lockoutDurationMinutes} minutes.`, 'CRITICAL');
      }

      localStorage.setItem(STORAGE_KEYS.LOCKOUT_STATE, JSON.stringify(lockout));
      return lockout;
    }

    clearLockoutState() {
      localStorage.setItem(STORAGE_KEYS.LOCKOUT_STATE, JSON.stringify({ locked: false, attempts: 0, unlockTime: null }));
    }

    /**
     * Step 1 Authentication: Validate Username & Password.
     * API mode only (server bcrypt). Offline local-auth secrets are not shipped.
     */
    async authenticateCredentials(username, password) {
      const userClean = (username || '').toLowerCase().trim();
      const pwdClean = (password || '').trim();

      if (!this.useApi()) {
        return {
          success: false,
          message: 'Admin login requires config.js apiBaseUrl. Seed the API with SEED_ADMIN_PASSWORD.'
        };
      }

      try {
        const data = await this.apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: userClean, password: pwdClean })
        });

        if (data.requires2FA) {
          this._loginChallenge = data.challengeToken;
          sessionStorage.setItem(STORAGE_KEYS.LOGIN_CHALLENGE, JSON.stringify({
            challengeToken: data.challengeToken,
            username: data.user && data.user.username,
            savedAt: new Date().toISOString()
          }));
          return {
            success: true,
            requires2FA: true,
            message: data.message || 'Enter the 6-digit code from Google Authenticator.'
          };
        }

        const sessionObj = {
          token: data.token,
          apiToken: data.token,
          csrfToken: data.csrfToken,
          username: data.user && data.user.username,
          loginTime: new Date().toISOString(),
          expiresAt: data.expiresAt || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          mustChangePassword: !!(data.user && data.user.mustChangePassword),
          totpEnabled: !!(data.user && data.user.totpEnabled),
          apiMode: true
        };
        this.persistSessionExtras(sessionObj);
        sessionStorage.removeItem(STORAGE_KEYS.LOGIN_CHALLENGE);
        return {
          success: true,
          requires2FA: false,
          mustChangePassword: sessionObj.mustChangePassword,
          message: sessionObj.mustChangePassword
            ? 'Logged in. Change the default password before production go-live.'
            : 'Authenticated. Redirecting to Super Admin Dashboard...'
        };
      } catch (err) {
        const locked = err.status === 423 || (err.body && err.body.error && err.body.error.locked);
        return {
          success: false,
          locked: !!locked,
          message: err.message || 'Login failed.'
        };
      }
    }

    /**
     * Step 2 Authentication: verify server-side TOTP after password challenge.
     */
    async verify2FAPin(pin) {
      if (!this.useApi()) {
        return { success: false, message: '2FA requires apiBaseUrl and a live API session.' };
      }
      let challengeToken = this._loginChallenge;
      if (!challengeToken) {
        try {
          const raw = sessionStorage.getItem(STORAGE_KEYS.LOGIN_CHALLENGE);
          if (raw) challengeToken = JSON.parse(raw).challengeToken;
        } catch (e) { /* ignore */ }
      }
      if (!challengeToken) {
        return { success: false, message: 'Login session expired. Sign in with your password again.' };
      }
      try {
        const data = await this.apiFetch('/api/auth/verify-totp', {
          method: 'POST',
          body: JSON.stringify({ challengeToken, code: String(pin || '').replace(/\s/g, '') })
        });
        const sessionObj = {
          token: data.token,
          apiToken: data.token,
          csrfToken: data.csrfToken,
          username: data.user && data.user.username,
          loginTime: new Date().toISOString(),
          expiresAt: data.expiresAt || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          mustChangePassword: !!(data.user && data.user.mustChangePassword),
          totpEnabled: true,
          apiMode: true
        };
        this.persistSessionExtras(sessionObj);
        sessionStorage.removeItem(STORAGE_KEYS.LOGIN_CHALLENGE);
        this._loginChallenge = null;
        return {
          success: true,
          message: 'Two-factor authentication verified. Redirecting…'
        };
      } catch (err) {
        return { success: false, message: err.message || 'Invalid authenticator code.' };
      }
    }

    createSession() {
      const array = new Uint8Array(32);
      window.crypto.getRandomValues(array);
      const token = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');

      let username = 'admin';
      try {
        const raw = sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
        if (raw) username = JSON.parse(raw).username || username;
      } catch (e) { /* ignore */ }

      const sessionObj = {
        token: token,
        username: username,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.getConfig().sessionTimeoutMinutes * 60 * 1000).toISOString()
      };

      sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, JSON.stringify(sessionObj));
      return token;
    }

    isSessionValid() {
      const raw = sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
      if (!raw) return false;

      try {
        const session = JSON.parse(raw);
        if (!session.token || !session.expiresAt) return false;

        if (new Date().getTime() > new Date(session.expiresAt).getTime()) {
          this.terminateSession('SESSION_EXPIRED', 'Session expired due to timeout.');
          return false;
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    extendSession() {
      const raw = sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
      if (raw) {
        try {
          const session = JSON.parse(raw);
          session.expiresAt = new Date(Date.now() + this.getConfig().sessionTimeoutMinutes * 60 * 1000).toISOString();
          sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, JSON.stringify(session));
        } catch (e) {}
      }
    }

    terminateSession(reasonCode = 'LOGOUT', reasonText = 'Super Admin manual logout.') {
      if (this.useApi()) {
        this.apiFetch('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
      }
      if (sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN)) {
        this.addAuditLog(reasonCode, reasonText, 'INFO');
      }
      this._apiToken = null;
      this._csrfToken = null;
      this._loginChallenge = null;
      sessionStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
      sessionStorage.removeItem(STORAGE_KEYS.LOGIN_CHALLENGE);
      this.stopInactivityWatchdog();
    }

    startInactivityWatchdog(onWarningCallback, onTimeoutCallback) {
      this.onWarningCallback = onWarningCallback;
      this.onTimeoutCallback = onTimeoutCallback;

      this.activityEvents.forEach(evt => {
        window.addEventListener(evt, this.boundResetTimer, { passive: true });
      });

      this.resetInactivityTimer();
    }

    stopInactivityWatchdog() {
      this.activityEvents.forEach(evt => {
        window.removeEventListener(evt, this.boundResetTimer);
      });
      if (this.sessionTimer) clearTimeout(this.sessionTimer);
      if (this.warningTimer) clearTimeout(this.warningTimer);
    }

    resetInactivityTimer() {
      if (!this.isSessionValid()) return;

      this.extendSession();

      if (this.sessionTimer) clearTimeout(this.sessionTimer);
      if (this.warningTimer) clearTimeout(this.warningTimer);

      const config = this.getConfig();
      const warningMs = (config.sessionTimeoutMinutes - config.sessionWarningMinutes) * 60 * 1000;
      const timeoutMs = config.sessionTimeoutMinutes * 60 * 1000;

      this.warningTimer = setTimeout(() => {
        if (typeof this.onWarningCallback === 'function') {
          this.onWarningCallback(config.sessionWarningMinutes);
        }
      }, warningMs);

      this.sessionTimer = setTimeout(() => {
        this.terminateSession('AUTO_LOGOUT', 'Automatic logout due to 15 minutes of inactivity.');
        if (typeof this.onTimeoutCallback === 'function') {
          this.onTimeoutCallback();
        }
      }, timeoutMs);
    }

    addAuditLog(event, details, level = 'INFO') {
      const logs = this.getAuditLogs();
      const newEntry = {
        id: `LOG-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString(),
        event: event,
        details: details,
        level: level,
        ip: '127.0.0.1 (Local Verified)'
      };
      logs.unshift(newEntry);
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs.slice(0, 100)));
    }

    getAuditLogs() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) || [];
      } catch (e) {
        return [];
      }
    }

    getInquiries() {
      if (this.useApi()) {
        return Array.isArray(this._cmsCache.inquiries) ? this._cmsCache.inquiries : [];
      }
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.INQUIRIES)) || [];
      } catch (e) {
        return [];
      }
    }

    async refreshInquiriesFromApi() {
      if (!this.useApi()) return this.getInquiries();
      const data = await this.apiFetch('/api/admin/inquiries');
      this._cmsCache.inquiries = data.inquiries || [];
      return this._cmsCache.inquiries;
    }

    async updateInquiryStatus(inquiryId, newStatus) {
      if (this.useApi()) {
        try {
          await this.apiFetch('/api/admin/inquiries/' + encodeURIComponent(inquiryId), {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
          });
          await this.refreshInquiriesFromApi();
          return { success: true, message: 'Inquiry status updated.' };
        } catch (err) {
          return { success: false, message: 'Save failed — status not updated. ' + err.message };
        }
      }
      const inquiries = this.getInquiries();
      const target = inquiries.find(i => i.id === inquiryId);
      if (target) {
        const oldStatus = target.status;
        target.status = newStatus;
        localStorage.setItem(STORAGE_KEYS.INQUIRIES, JSON.stringify(inquiries));
        this.addAuditLog('INQUIRY_STATUS_UPDATED', `Inquiry ${inquiryId} status changed from ${oldStatus} to ${newStatus}.`, 'INFO');
        return { success: true, message: 'Inquiry status updated.' };
      }
      return { success: false, message: 'Inquiry not found.' };
    }

    async addInquiry(inquiryData) {
      if (this.useApi()) {
        return await this.apiFetch('/api/inquiries', {
          method: 'POST',
          body: JSON.stringify({
            name: inquiryData.name || 'Anonymous',
            company: inquiryData.company || 'Private Client',
            email: inquiryData.email,
            phone: inquiryData.phone || null,
            subject: inquiryData.subject || 'General Project Query',
            message: inquiryData.message,
            value: inquiryData.value || null
          })
        });
      }
      const inquiries = this.getInquiries();
      const newInquiry = {
        id: `INQ-2026-${(inquiries.length + 1).toString().padStart(3, '0')}`,
        name: inquiryData.name || 'Anonymous',
        company: inquiryData.company || 'Private Client',
        email: inquiryData.email,
        phone: inquiryData.phone || 'N/A',
        subject: inquiryData.subject || 'General Project Query',
        message: inquiryData.message,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'NEW',
        priority: 'HIGH',
        value: inquiryData.value || 'TBD'
      };
      inquiries.unshift(newInquiry);
      localStorage.setItem(STORAGE_KEYS.INQUIRIES, JSON.stringify(inquiries));
      this.addAuditLog('NEW_INQUIRY_RECEIVED', `New tender inquiry received from ${newInquiry.name} (${newInquiry.company}).`, 'INFO');
      return newInquiry;
    }

    deleteInquiry(inquiryId) {
      let inquiries = this.getInquiries();
      inquiries = inquiries.filter(i => i.id !== inquiryId);
      localStorage.setItem(STORAGE_KEYS.INQUIRIES, JSON.stringify(inquiries));
      this.addAuditLog('INQUIRY_DELETED', `Inquiry ${inquiryId} removed by Super Admin.`, 'WARNING');
    }

    getConfig() {
      // Inactivity / lockout settings only — no client-side password hash or TOTP secret.
      return {
        sessionTimeoutMinutes: CONFIG_DEFAULTS.sessionTimeoutMinutes,
        sessionWarningMinutes: CONFIG_DEFAULTS.sessionWarningMinutes,
        maxFailedAttempts: CONFIG_DEFAULTS.maxFailedAttempts,
        lockoutDurationMinutes: CONFIG_DEFAULTS.lockoutDurationMinutes
      };
    }

    /**
     * Fetch TOTP provisioning QR/secret from API (requires active session).
     * Secrets are never shown without a valid API session. First-login accounts
     * with mustChangePassword must update the master password before setup is allowed.
     */
    async fetchTOTPSetupInfo(forceRefresh) {
      if (!this.useApi() || !this.isSessionValid()) {
        return {
          secret: '',
          otpauthUrl: '',
          qrImageUrl: '',
          totpEnabled: false,
          blocked: true,
          blockReason: 'session',
          message: 'Sign in again, then reopen this panel to load the QR code and secret.'
        };
      }
      if (this.sessionMustChangePassword()) {
        return {
          secret: '',
          otpauthUrl: '',
          qrImageUrl: '',
          totpEnabled: false,
          blocked: true,
          blockReason: 'password',
          message: 'Update your Master Password on the right first (Current + New → Update Password). The QR code unlocks after that.'
        };
      }
      if (this._totpSetupCache && !forceRefresh) return this._totpSetupCache;
      try {
        this.hydrateSessionFromStorage();
        const data = await this.apiFetch('/api/auth/totp/setup', { method: 'GET' });
        this._totpSetupCache = {
          secret: data.secret || '',
          otpauthUrl: data.otpauthUrl || '',
          qrImageUrl: data.qrImageUrl || '',
          totpEnabled: !!data.totpEnabled,
          blocked: false,
          blockReason: '',
          message: data.totpEnabled
            ? '2FA is enabled. Rotate below to issue a new secret.'
            : 'Scan the QR code, then enter a live authenticator code and click Enable 2FA.'
        };
        return this._totpSetupCache;
      } catch (err) {
        const code = err.body && err.body.error && err.body.error.code;
        const isPasswordPending =
          err.status === 403 ||
          code === 'PASSWORD_CHANGE_REQUIRED' ||
          (err.message && err.message.toLowerCase().includes('password'));
        const isUnauthorized = err.status === 401 || code === 'UNAUTHORIZED';
        let message;
        if (isPasswordPending) {
          message = 'Update your Master Password on the right first (Current + New → Update Password). The QR code unlocks after that.';
        } else if (isUnauthorized) {
          message = 'API session expired or invalid. Sign out, log in again, then reopen this panel — Current Master Password alone does not load the QR.';
        } else {
          message = err.message || 'Could not load 2FA setup.';
        }
        return {
          secret: '',
          otpauthUrl: '',
          qrImageUrl: '',
          totpEnabled: false,
          blocked: true,
          blockReason: isPasswordPending ? 'password' : (isUnauthorized ? 'session' : 'error'),
          message
        };
      }
    }

    getTOTPSetupInfo() {
      return this._totpSetupCache || {
        secret: '',
        otpauthUrl: '',
        qrImageUrl: '',
        totpEnabled: false,
        blocked: true,
        blockReason: 'pending',
        message: 'Open this panel while logged in to load the QR code and secret.'
      };
    }

    async enableTotp(secret, code) {
      if (!this.useApi()) return { success: false, message: '2FA requires apiBaseUrl.' };
      try {
        await this.apiFetch('/api/auth/totp/enable', {
          method: 'POST',
          body: JSON.stringify({ secret, code: String(code || '').replace(/\s/g, '') })
        });
        this._totpSetupCache = null;
        return { success: true, message: 'Google Authenticator 2FA enabled.' };
      } catch (err) {
        return { success: false, message: err.message || 'Failed to enable 2FA.' };
      }
    }

    async disableTotp(password, code) {
      if (!this.useApi()) return { success: false, message: '2FA requires apiBaseUrl.' };
      try {
        await this.apiFetch('/api/auth/totp/disable', {
          method: 'POST',
          body: JSON.stringify({ password, code: String(code || '').replace(/\s/g, '') })
        });
        this._totpSetupCache = null;
        return { success: true, message: 'Two-factor authentication disabled.' };
      } catch (err) {
        return { success: false, message: err.message || 'Failed to disable 2FA.' };
      }
    }

    async rotateTotp(password, code) {
      if (!this.useApi()) return { success: false, message: '2FA requires apiBaseUrl.' };
      try {
        const data = await this.apiFetch('/api/auth/totp/rotate', {
          method: 'POST',
          body: JSON.stringify({ password, code: String(code || '').replace(/\s/g, '') })
        });
        this._totpSetupCache = {
          secret: data.secret || '',
          otpauthUrl: data.otpauthUrl || '',
          qrImageUrl: data.qrImageUrl || '',
          totpEnabled: true,
          message: 'Secret rotated — scan the new QR in your authenticator app.'
        };
        return { success: true, message: this._totpSetupCache.message, setup: this._totpSetupCache };
      } catch (err) {
        return { success: false, message: err.message || 'Failed to rotate TOTP secret.' };
      }
    }

    async updateCredentials(currentPassword, newPassword) {
      if (!this.useApi()) {
        return { success: false, message: 'Password changes require apiBaseUrl and a live API session.' };
      }
      if (!newPassword) {
        return { success: false, message: 'New password is required.' };
      }
      try {
        const data = await this.apiFetch('/api/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword })
        });
        this.clearMustChangePasswordFlag();
        this._totpSetupCache = null;
        return {
          success: true,
          message: data.message || 'Password updated. Other sessions were signed out. QR setup can load now.'
        };
      } catch (err) {
        return { success: false, message: err.message || 'Password change failed.' };
      }
    }

    /**
     * Fleet Inventory & Asset Counts Management
     */
    getFleetInventory() {
      if (this.useApi()) {
        return Array.isArray(this._cmsCache.fleet) ? this._cmsCache.fleet : [];
      }
      const STORAGE_KEY = 'sc_admin_fleet_v1';
      const DEFAULT_FLEET = [
        { key: 'rmc', name: 'RMC Batching Plants', count: '5', icon: 'fa-industry' },
        { key: 'mixers', name: 'Transit Mixers', count: '12', icon: 'fa-truck' },
        { key: 'pumps', name: 'Mobile Concrete Pumps', count: '8', icon: 'fa-droplet' },
        { key: 'tippers', name: 'Tipper Trucks', count: '15', icon: 'fa-truck-moving' },
        { key: 'excavators', name: 'Excavators & JCBS', count: '4', icon: 'fa-tractor' },
        { key: 'crushers', name: 'Crusher Units', count: '3', icon: 'fa-gears' },
        { key: 'quarries', name: 'Blue Metal Quarries', count: '3', icon: 'fa-mountain' },
        { key: 'bending', name: 'Bar Bending Machines', count: '2', icon: 'fa-screwdriver-wrench' },
        { key: 'shearing', name: 'Bar Shearing Machines', count: '2', icon: 'fa-scissors' },
        { key: 'scaffolding', name: 'Scaffolding Pipes', count: '30k', icon: 'fa-layer-group' }
      ];

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return DEFAULT_FLEET;
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FLEET));
        return DEFAULT_FLEET;
      } catch (e) {
        return DEFAULT_FLEET;
      }
    }


    async updateFleetInventory(updatedFleet) {
      if (this.useApi()) {
        try {
          await this.apiFetch('/api/admin/fleet', {
            method: 'PUT',
            body: JSON.stringify(updatedFleet)
          });
          this._cmsCache.fleet = updatedFleet;
          return { success: true, message: 'Fleet asset counts published live.' };
        } catch (err) {
          return { success: false, message: 'Save failed — changes not published. ' + err.message };
        }
      }
      const STORAGE_KEY = 'sc_admin_fleet_v1';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFleet));
      this.addAuditLog('FLEET_INVENTORY_UPDATED', 'Asset inventory counts updated and published to public website.', 'INFO');
      return { success: true, message: 'Fleet asset counts updated and published live to website!' };
    }

    /**
     * Financial Capacity & Quality Standards Management
     */
    getDefaultTurnoverSeries() {
      return [
        { year: '2020-21', amount: 560, source: 'published', visible: true },
        { year: '2021-22', amount: 720, source: 'published', visible: true },
        { year: '2022-23', amount: 850, source: 'published', visible: true },
        { year: '2023-24', amount: 990, source: 'published', visible: true },
        { year: '2024-25', amount: 1175, source: 'published', visible: true },
        { year: '2025-26', amount: 1420, source: 'published', visible: true },
        { year: '2026-27', amount: 1650, source: 'published', visible: false },
        { year: '2027-28', amount: 1900, source: 'published', visible: false },
        { year: '2028-29', amount: 2200, source: 'published', visible: false },
        { year: '2029-30', amount: 2500, source: 'published', visible: false },
        { year: '2030-31', amount: 2800, source: 'published', visible: false }
      ];
    }



    getTurnoverCurrencyOptions() {
      return [
        { id: 'inr_millions', selectLabel: 'INR / Rs. (millions)', short: 'Rs.', unit: 'millions', axis: 'Rs. Millions', chartUnit: 'Rs. millions · FY' },
        { id: 'inr_crore', selectLabel: 'INR / Rs. (Crore)', short: 'Rs.', unit: 'Crore', axis: 'Rs. Crore', chartUnit: 'Rs. Crore · FY' },
        { id: 'usd_millions', selectLabel: 'USD (millions)', short: 'USD', unit: 'millions', axis: 'USD Millions', chartUnit: 'USD millions · FY' },
        { id: 'eur_millions', selectLabel: 'EUR (millions)', short: 'EUR', unit: 'millions', axis: 'EUR Millions', chartUnit: 'EUR millions · FY' }
      ];
    }

    getTurnoverCurrencyMeta(currencyId) {
      const options = this.getTurnoverCurrencyOptions();
      return options.find((opt) => opt.id === currencyId) || options[0];
    }

    getDefaultFinancialsData() {
      return [
        {
          key: 'turnover',
          title: 'Annual Turnover',
          icon: 'fa-chart-line',
          text: 'Our financial progress reached a whopping annual turnover to the tune of Rs.1420 millions during the Financial Year 2025–26.',
          currency: 'inr_millions',
          series: this.getDefaultTurnoverSeries()
        },
        {
          key: 'resources',
          title: 'Financial Resources',
          icon: 'fa-vault',
          text: 'The financial credibility of the firm has enabled it to secure a Cash Credit Limit of Rs.10.00 Crore and Bank Guarantee Limit of Rs. 25.00 Crore from HDFC, Kalpakkam. Besides this, we are well supported by Banks and Partners.'
        },
        {
          key: 'quality',
          title: 'Quality Assurance',
          icon: 'fa-award',
          text: 'Timely completion with Absolute Quality Control has long been the specialty of Sekar Constructions. Continuous orders from the Department of Atomic Energy and allied premier institutions stand as evidence of that commitment.'
        }
      ];
    }

    normalizeFinancialsData(storedData) {
      const defaults = this.getDefaultFinancialsData();
      const defaultSeries = this.getDefaultTurnoverSeries();
      if (!Array.isArray(storedData)) return defaults;

      const storedMap = {};
      storedData.forEach((item) => {
        if (item && item.key) storedMap[item.key] = item;
      });

      return defaults.map((def) => {
        const stored = storedMap[def.key] || {};
        const merged = {
          key: def.key,
          title: typeof stored.title === 'string' && stored.title.trim() ? stored.title.trim() : def.title,
          icon: stored.icon || def.icon,
          text: typeof stored.text === 'string' && stored.text.trim() ? stored.text.trim() : def.text
        };

        if (def.key === 'turnover') {
          const currencyId = stored.currency || def.currency;
          merged.currency = this.getTurnoverCurrencyMeta(currencyId).id;

          const seriesMap = {};
          defaultSeries.forEach((row) => {
            seriesMap[row.year] = { year: row.year, amount: row.amount, source: row.source, visible: row.visible !== false };
          });

          if (Array.isArray(stored.series)) {
            stored.series.forEach((row) => {
              if (!row || !row.year || !seriesMap[row.year]) return;
              const amount = Number(row.amount);
              if (!Number.isFinite(amount) || amount < 0) return;
              seriesMap[row.year] = {
                year: row.year,
                amount: amount,
                source: row.source === 'placeholder' ? 'placeholder' : 'admin',
                visible: row.visible !== false
              };
            });
          }

          merged.series = defaultSeries.map((row) => seriesMap[row.year]);
        }

        return merged;
      });
    }

    getFinancialsData() {
      if (this.useApi()) {
        if (Array.isArray(this._cmsCache.financials) && this._cmsCache.financials.length > 0) {
          return this.normalizeFinancialsData(this._cmsCache.financials);
        }
        return this.normalizeFinancialsData(this.getDefaultFinancialsData());
      }
      const STORAGE_KEY = 'sc_admin_financials_v4';
      const DEFAULT_FINANCIALS = this.getDefaultFinancialsData();

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return DEFAULT_FINANCIALS;
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return this.normalizeFinancialsData(parsed);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FINANCIALS));
        return DEFAULT_FINANCIALS;
      } catch (e) {
        return DEFAULT_FINANCIALS;
      }
    }

    async updateFinancialsData(updatedFinancials) {
      const normalized = this.normalizeFinancialsData(updatedFinancials);
      if (this.useApi()) {
        try {
          await this.apiFetch('/api/admin/financials', {
            method: 'PUT',
            body: JSON.stringify(normalized)
          });
          this._cmsCache.financials = normalized;
          return { success: true, message: 'Financials & Quality Standards published live.' };
        } catch (err) {
          return { success: false, message: 'Save failed — changes not published. ' + err.message };
        }
      }
      const STORAGE_KEY = 'sc_admin_financials_v4';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      this.addAuditLog('FINANCIALS_UPDATED', 'Financial Capacity & Quality Standards updated and published to public website.', 'INFO');
      return { success: true, message: 'Financials & Quality Standards updated live on website!' };
    }


    /**
     * Dynamic Executive Team Photo Gallery Management
     */
    getGalleryPhotos() {
      // API mode: never resurrect hardcoded team URLs when hydrate fails.
      if (this.useApi()) {
        return Array.isArray(this._cmsCache.team) ? this._cmsCache.team : [];
      }
      const STORAGE_KEY = 'sc_admin_team_gallery_v1';
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }

    async addGalleryPhoto(photoObj) {
      const current = this.getGalleryPhotos().slice();
      const newPhoto = {
        id: 'img-' + Date.now(),
        url: photoObj.url,
        caption: photoObj.caption || 'Sekar Constructions Team Photo'
      };
      current.push(newPhoto);
      if (this.useApi()) {
        try {
          await this.apiFetch('/api/admin/team-photos', {
            method: 'PUT',
            body: JSON.stringify(current)
          });
          this._cmsCache.team = current;
          return { success: true, message: 'Photo uploaded and added to Executive Team Gallery!' };
        } catch (err) {
          return { success: false, message: 'Save failed — changes not published. ' + err.message };
        }
      }
      const STORAGE_KEY = 'sc_admin_team_gallery_v1';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      this.addAuditLog('GALLERY_PHOTO_ADDED', `New team photo added: "${newPhoto.caption}"`, 'INFO');
      return { success: true, message: 'Photo uploaded and added to Executive Team Gallery!' };
    }

    async deleteGalleryPhoto(id) {
      const current = this.getGalleryPhotos().filter(p => p.id !== id);
      if (this.useApi()) {
        try {
          await this.apiFetch('/api/admin/team-photos', {
            method: 'PUT',
            body: JSON.stringify(current)
          });
          this._cmsCache.team = current;
          return { success: true, message: 'Photo removed successfully!' };
        } catch (err) {
          return { success: false, message: 'Save failed — changes not published. ' + err.message };
        }
      }
      const STORAGE_KEY = 'sc_admin_team_gallery_v1';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      this.addAuditLog('GALLERY_PHOTO_DELETED', `Team photo ID ${id} removed from Executive Team Gallery.`, 'WARNING');
      return { success: true, message: 'Photo removed successfully!' };
    }

    /**
     * Gallery submenu media (Plant & Machinery, Founder & Clients, Certificates, logo strips)
     * Storage keys: sc_admin_gallery_media_<section>_v1
     */
    getGalleryMediaSections() {
      return ['plant_machinery', 'founder_clients', 'certificates', 'founder_logos'];
    }

    normalizeGalleryMediaSection(section) {
      return String(section || '')
        .trim()
        .replace(/-/g, '_');
    }

    galleryMediaStorageKey(section) {
      return 'sc_admin_gallery_media_' + this.normalizeGalleryMediaSection(section) + '_v1';
    }

    galleryMediaApiPath(section) {
      return '/api/admin/gallery-media/' + this.normalizeGalleryMediaSection(section).replace(/_/g, '-');
    }

    normalizeGalleryMediaItem(item, index, section) {
      const src = item && typeof item === 'object' ? item : {};
      const meta = Array.isArray(src.meta)
        ? src.meta
            .map((m) => {
              if (typeof m === 'string') return { icon: '', text: String(m).trim() };
              return {
                icon: String((m && m.icon) || '').trim(),
                text: String((m && m.text) || '').trim()
              };
            })
            .filter((m) => m.text)
        : [];
      const id = String(src.id || '').trim() || (section + '-' + (index + 1));
      return {
        id: id,
        url: String(src.url || '').trim(),
        title: String(src.title || '').trim(),
        badge: String(src.badge || '').trim(),
        badgeIcon: String(src.badgeIcon || '').trim(),
        location: String(src.location || '').trim(),
        locationIcon: String(src.locationIcon || '').trim(),
        description: String(src.description || '').trim(),
        author: String(src.author || '').trim(),
        quote: String(src.quote || '').trim(),
        meta: meta
      };
    }

    normalizeGalleryMediaList(list, section) {
      const key = this.normalizeGalleryMediaSection(section);
      return (Array.isArray(list) ? list : [])
        .map((item, i) => this.normalizeGalleryMediaItem(item, i, key))
        .filter((item) => item.url);
    }

    getDefaultGalleryMedia(section) {
      const key = this.normalizeGalleryMediaSection(section);
      // Mirror of api/src/data/defaults.js galleryMedia (kept lean for offline admin).
      const bundled = {
        plant_machinery: [
          { id: 'plant-schwing-m1c-1', url: 'images/plant-machinery/schwing-stetter-m1c-ecr-manamai-1.png', title: 'Schwing Stetter M1C Batching Plant', badge: 'Batching Plant', location: 'ECR, Manamai, Tamil Nadu', locationIcon: 'fa-location-dot', description: 'Owned high-capacity concrete batching plant supporting coastal infrastructure & Class-I civil works along ECR corridor.' },
          { id: 'plant-schwing-m1c-2', url: 'images/plant-machinery/schwing-stetter-m1c-ecr-manamai-2.png', title: 'Aggregate Conveyor & Batching Unit', badge: 'Concrete Production', location: 'ECR, Manamai, Tamil Nadu', locationIcon: 'fa-location-dot', description: 'Automated aggregate feeding and continuous concrete mixing setup for high-grade structural pours.' },
          { id: 'plant-schwing-transit', url: 'images/plant-machinery/schwing-stetter-m1c-transit-mixer.png', title: 'Schwing Stetter M1C & Transit Mixer Fleet', badge: 'Transit Operations', location: 'ECR, Manamai, Tamil Nadu', locationIcon: 'fa-location-dot', description: 'Direct transit mixer loading for seamless concrete delivery across major industrial & infrastructure project sites.' },
          { id: 'plant-yellow-silo', url: 'images/plant-machinery/batching-plant-yellow-silo.png', title: 'Vertical Cement & Flyash Storage Silo', badge: 'Storage & Dosage', location: 'Site Plant Facility, Tamil Nadu', locationIcon: 'fa-location-dot', description: 'High-capacity vertical silo storage system ensuring continuous supply of raw cementitious materials.' },
          { id: 'plant-aquarius', url: 'images/plant-machinery/aquarius-batching-plant.png', title: 'Aquarius Batching Plant & Control Cabin', badge: 'Plant Fleet', location: 'Project Asset Line, Tamil Nadu', locationIcon: 'fa-location-dot', description: 'Automated batching control system and aggregate bin feeder for specialized structural concrete grades.' },
          { id: 'plant-boom-pump', url: 'images/plant-machinery/schwing-stetter-s36x-boom-pump.jpg', title: 'Schwing Stetter S36X Concrete Boom Pump', badge: 'Boom Pump (2 Nos)', location: 'Site Equipment Fleet, Tamil Nadu', locationIcon: 'fa-location-dot', description: 'Heavy-duty truck-mounted 36-meter concrete placing boom pump (2 Nos) owned for high-reach structural pours & rapid placement.' },
          { id: 'plant-transit-fleet', url: 'images/plant-machinery/sekar-constructions-transit-mixer-fleet.jpg', title: 'Transit Mixer Fleet & Batching Base', badge: 'Transit Fleet', location: 'ECR Batching Yard, Tamil Nadu', locationIcon: 'fa-location-dot', description: 'Owned fleet of high-capacity transit mixers lined up at site batching facility for uninterrupted RMC supply.' }
        ],
        founder_clients: [
          { id: 'founder-isro-shawl', url: 'images/isro-chairman-felicitating-sekar-shawl.jpg', title: 'Felicitation by ISRO Chairman Dr. S. Somanath', badge: 'ISRO Felicitation', location: 'IPRC, Mahendragiri, Tamil Nadu', locationIcon: 'fa-rocket', description: 'ISRO Chairman Dr. S. Somanath honouring Mr. Ethiraj Sekar with a traditional golden shawl during the inauguration of the C25 Stage Integration Complex.' },
          { id: 'founder-isro-bouquet', url: 'images/isro-chairman-felicitating-sekar-bouquet.jpg', title: 'C25 Stage Integration Complex Inauguration', badge: 'Inauguration & Award', location: 'ISRO Propulsion Complex (IPRC), Mahendragiri', locationIcon: 'fa-award', description: 'Dr. S. Somanath presenting floral honors during the inauguration & award function for successful completion of the C25 Stage Integration Complex & area development works.' },
          { id: 'founder-gl-blueprint', url: 'images/great-lakes-site-blueprint-review.jpg', title: 'Engineering Blueprint Review — Great Lakes Campus', badge: 'Site Inspection', location: 'ECR, Manamai, Tamil Nadu', locationIcon: 'fa-location-dot', description: 'Mr. Ethiraj Sekar and senior engineering management inspecting structural drawings for Class Rooms, Residential Quarters & Compound Wall at Great Lakes Institute of Management.' },
          { id: 'founder-gl-award', url: 'images/great-lakes-award-function-bala-balachandran.jpg', title: 'Award & Appreciation Function — Great Lakes Campus', badge: 'Award & Recognition', location: 'ECR, Manamai (Near Mamallapuram), TN', locationIcon: 'fa-trophy', description: 'Felicitation and appreciation award presentation by Founder Dr. Bala V. Balachandran at Great Lakes Institute of Management for milestone campus delivery.' },
          { id: 'founder-dignitaries', url: 'images/site-inspection-dignitaries.png', title: 'Site Inspection with Senior Officers & Dignitaries', badge: 'Dignitary Visit', location: 'Institutional Site, Tamil Nadu', locationIcon: 'fa-shield-halved', description: 'Mr. Ethiraj Sekar interacting with senior IPS officers and government dignitaries during high-security facility site reviews.' }
        ],
        certificates: [
          { id: 'cert-isro-c25', url: 'images/certificates/certificate-isro-c25-stage-integration-complex.jpg', title: 'C25 Stage Integration Complex — ISRO Propulsion Complex', badge: 'ISRO Certificate of Experience', badgeIcon: 'fa-rocket', author: '<strong>Government of India — Department of Space</strong> | ISRO Mahendragiri', description: 'Official Certificate of Experience for execution of C25 Stage Integration Complex (₹56.30 Crore value). High Bays 26m height cleanroom, 11,380 sqm plinth area, 13,300 CUM RCC concrete, and 2,388 MT steel reinforcement executed with zero defects.', meta: [{ icon: 'fa-check-double', text: 'Value: ₹56.30 Cr' }, { icon: 'fa-file-signature', text: 'Performance: Satisfactory' }] },
          { id: 'cert-great-lakes-letter', url: 'images/appreciation-letter-great-lakes-dr-bala-balachandran.png', title: 'Letter of Appreciation — Great Lakes Institute of Management', badge: 'Client Recommendation', badgeIcon: 'fa-certificate', author: '<strong>Dr. Bala V. Balachandran</strong> (Founder & Dean, Great Lakes Institute of Management; Kellogg Professor, Northwestern University)', quote: '"Choosing Sekar to convert our architectural plans into brick and mortar was the best decision we made. Sekar has not only breathed life into our buildings, but did it so effortlessly... Thanks for your outstanding service to Great Lakes beyond imagination!"', meta: [{ icon: 'fa-award', text: '28-Acre LEED Platinum Campus' }, { icon: 'fa-calendar-days', text: 'Official Letter of Recommendation' }] },
          { id: 'cert-dae-quarters', url: 'images/certificates/certificate-dae-116-quarters-performance-report.png', title: '116 Type II-B Residential Quarters — DAE Township, Kalpakkam', badge: 'DAE Performance Report (Form-E)', badgeIcon: 'fa-atom', author: '<strong>Department of Atomic Energy (DAE)</strong> | Government of India', description: 'Official Form-E Performance Report (Completed Cost: ₹25.83 Crore / Rs. 2,583.04 Lakhs). Completed on schedule with <strong>Very Good</strong> performance ratings across Quality of Work, Financial Soundness, Technical Proficiency, Resourcefulness, and Time Consciousness.', meta: [{ icon: 'fa-circle-check', text: 'Value: ₹25.83 Cr' }, { icon: 'fa-star', text: 'Performance: VERY GOOD' }] },
          { id: 'cert-igcar-ausc', url: 'images/certificates/certificate-igcar-ausc-lab-performance-report.png', title: 'High Temperature Advance Facility — IGCAR Kalpakkam', badge: 'IGCAR Performance Report', badgeIcon: 'fa-microscope', author: '<strong>Indira Gandhi Centre for Atomic Research (IGCAR)</strong> | Chief Engineer N. Suresh', description: 'Official Performance Report for Development and Testing Studies of High Temperature Advance Facility (AUSC Lab Building, ₹13.12 Crore value). Rated <strong>Very Good</strong> across Quality of Work, Technical Proficiency, Resourcefulness, and Adherence of Time Schedule.', meta: [{ icon: 'fa-building-circle-check', text: 'Value: ₹13.12 Cr' }, { icon: 'fa-shield-check', text: 'Rating: VERY GOOD' }] },
          { id: 'cert-cmwssb-150', url: 'images/certificates/certificate-cmwssb-150mld-desalination.png', title: '150 MLD Seawater Desalination Plant — CMWSSB Nemmeli', badge: 'CMWSSB Official Certificate', badgeIcon: 'fa-droplet', author: '<strong>Chennai Metropolitan Water Supply & Sewerage Board</strong> | Chief Engineer A. Malaichamy', description: 'Official Certificate of Experience confirming successful execution of structural concrete water-retaining basins, intake structures, and pump house civil works for the 150 MLD Nemmeli SWRO Desalination facility.', meta: [{ icon: 'fa-water', text: 'Water Retaining Structures' }, { icon: 'fa-certificate', text: 'Signed by Chief Engineer' }] },
          { id: 'cert-cobra-completion', url: 'images/certificates/certificate-cobratecton-150mld-completion.png', title: '150 MLD Desalination Civil & RMC Works — Nemmeli', badge: 'COBRA-TECTON Completion Certificate', badgeIcon: 'fa-industry', author: '<strong>COBRA TECTON Private Limited</strong> | General Manager Construction D. Anbuselvarani', description: 'Completion Certificate for ₹56.95 Crore civil works (₹42.60 Cr main civil + ₹3.92 Cr RMC supply + materials hire). Plinth area 5,600+ sqm, 17,777 CUM concrete, 46,545 sqm formwork, and 2,016 MT steel. Performance: <strong>Very Good</strong>.', meta: [{ icon: 'fa-coins', text: 'Value: ₹56.95 Cr' }, { icon: 'fa-star', text: 'Performance: VERY GOOD' }] },
          { id: 'cert-cobra-appreciation', url: 'images/certificates/certificate-cobratecton-appreciation-letter.png', title: 'Letter of Appreciation — COBRA TECTON Private Limited', badge: 'Letter of Commendation', badgeIcon: 'fa-heart-pulse', author: '<strong>COBRA TECTON Consortium</strong> | 150 MLD Nemmeli SWRO Project', quote: '"M/s. Sekar Constructions commitment to quality, adherence to safety standards, and timely execution of civil works have been commendable and have significantly contributed to the successful progression of this critical infrastructure project."', meta: [{ icon: 'fa-truck-ramp-box', text: 'RMC & Scaffolding Supply' }, { icon: 'fa-award', text: 'Valued Infrastructure Partner' }] }
        ],
        founder_logos: [
          { id: 'logo-strip-1', url: 'images/clients-logos-strip-1.png' },
          { id: 'logo-strip-2', url: 'images/clients-logos-strip-2.png' },
          { id: 'logo-strip-3', url: 'images/clients-logos-strip-3.png' },
          { id: 'logo-strip-4', url: 'images/clients-logos-strip-4.png' },
          { id: 'logo-strip-5', url: 'images/clients-logos-strip-5.png' }
        ]
      };
      return this.normalizeGalleryMediaList(bundled[key] || [], key);
    }

    getGalleryMediaContent(section) {
      const key = this.normalizeGalleryMediaSection(section);
      if (!this.getGalleryMediaSections().includes(key)) return [];

      if (this.useApi()) {
        const bag = this._cmsCache.galleryMedia;
        if (bag && typeof bag === 'object' && Array.isArray(bag[key]) && bag[key].length > 0) {
          return this.normalizeGalleryMediaList(bag[key], key);
        }
        return this.getDefaultGalleryMedia(key);
      }

      try {
        const stored = localStorage.getItem(this.galleryMediaStorageKey(key));
        if (!stored) return this.getDefaultGalleryMedia(key);
        const parsed = JSON.parse(stored);
        const list = this.normalizeGalleryMediaList(parsed, key);
        return list.length ? list : this.getDefaultGalleryMedia(key);
      } catch (e) {
        return this.getDefaultGalleryMedia(key);
      }
    }

    async updateGalleryMediaContent(section, list) {
      const key = this.normalizeGalleryMediaSection(section);
      if (!this.getGalleryMediaSections().includes(key)) {
        return { success: false, message: 'Unknown gallery media section.' };
      }
      const normalized = this.normalizeGalleryMediaList(list, key);
      const labels = {
        plant_machinery: 'Plant & Machinery',
        founder_clients: 'Founder & Clients',
        certificates: 'Certificates & Accreditations',
        founder_logos: 'Client Logo Strips'
      };
      const label = labels[key] || key;

      if (this.useApi()) {
        try {
          const saved = await this.apiFetch(this.galleryMediaApiPath(key), {
            method: 'PUT',
            body: JSON.stringify(normalized)
          });
          if (!this._cmsCache.galleryMedia || typeof this._cmsCache.galleryMedia !== 'object') {
            this._cmsCache.galleryMedia = {};
          }
          this._cmsCache.galleryMedia[key] = Array.isArray(saved) ? saved : normalized;
          return { success: true, message: label + ' published live (' + normalized.length + ' items).' };
        } catch (err) {
          return { success: false, message: 'Save failed — changes not published. ' + err.message };
        }
      }

      localStorage.setItem(this.galleryMediaStorageKey(key), JSON.stringify(normalized));
      this.addAuditLog('GALLERY_MEDIA_UPDATED', label + ' published (' + normalized.length + ' items).', 'INFO');
      return { success: true, message: label + ' updated and published live to website!' };
    }

    /**
     * Infrastructure page content (hero, highlights, full inventory table)
     * Storage: localStorage key sc_admin_infrastructure_v2
     */
    getDefaultInfrastructureData() {
      return {
        hero: {
          brand: 'Sekar Constructions',
          title: 'Infrastructure & Assets',
          lead: 'Owned quarries, crushing plants, batching machinery, and a full fleet - engineered for quality, schedule certainty, and self-reliant execution.',
          ctaLabel: 'Explore Inventory',
          ctaHref: '#infra-inventory',
          image: 'bhel-btg-civil.jpg'
        },
        highlights: [
          { key: 'quarries', label: 'Quarries', value: '4', note: 'Blue metal quarries under direct ownership' },
          { key: 'crushing', label: 'Crushing Plants', value: '3', note: 'Dedicated crushing capacity for project supply' },
          { key: 'assets', label: 'Asset Lines', value: '44', note: 'Owned equipment inventory line items' }
        ],
        inventory: [
          { id: 'infra-1', category: 'own-equipments', description: 'Concrete Boom Pump - 40.10ZX, S36X', qty: '3', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-2', category: 'own-equipments', description: 'Batching Plant - M1T, M1C, KYB 450 & CP45, Z30 & CP30', qty: '6', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-3', category: 'own-equipments', description: 'RMC Transit Mixer', qty: '14', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-4', category: 'own-equipments', description: 'Concrete Pump 1800', qty: '4', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-5', category: 'own-equipments', description: 'Mobile Tower Crane [ACE Make]', qty: '3', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-6', category: 'own-equipments', description: 'Excavator - Hitachi EX 210', qty: '2', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-7', category: 'own-equipments', description: 'JCB', qty: '8', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-8', category: 'own-equipments', description: 'Vibromax 10T - Roller', qty: '1', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-9', category: 'own-equipments', description: 'Walking Roller 1MT', qty: '3', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-10', category: 'own-equipments', description: 'BOBCAT S450', qty: '5', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-11', category: 'own-equipments', description: 'Tipper 10 Wheel', qty: '4', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-12', category: 'own-equipments', description: 'Tractor', qty: '4', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-13', category: 'own-equipments', description: 'TATA Diesel Tanker', qty: '1', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-14', category: 'own-equipments', description: 'Mahindra & Eicher Van', qty: '8', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-15', category: 'own-equipments', description: 'Building Hoist', qty: '5', unit: 'Sets.', categoryLabel: 'Own Equipments' },
          { id: 'infra-16', category: 'own-equipments', description: 'MS Cuplock System', qty: '400', unit: 'MT', categoryLabel: 'Own Equipments' },
          { id: 'infra-17', category: 'own-equipments', description: 'System Form Work', qty: '4,120', unit: 'Sqm', categoryLabel: 'Own Equipments' },
          { id: 'infra-18', category: 'own-equipments', description: 'MS Jolly (Platform)', qty: '6,500', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-19', category: 'own-equipments', description: 'MS Scaffolding Pipes', qty: '30,000', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-20', category: 'own-equipments', description: 'Props 2+2m, 2+3m, 3+3m', qty: '3,500', unit: 'Sets.', categoryLabel: 'Own Equipments' },
          { id: 'infra-21', category: 'own-equipments', description: 'Agrow Spans 2.4m & 3.0m', qty: '1,500', unit: 'Sets.', categoryLabel: 'Own Equipments' },
          { id: 'infra-22', category: 'own-equipments', description: 'Centering Sheets 3\' x 2\', 4\' x 2\'', qty: '1,500', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-23', category: 'own-equipments', description: 'MS Velor 1.50m & 1.20m', qty: '1,300', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-24', category: 'own-equipments', description: 'Bar Shearing Machine', qty: '15', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-25', category: 'own-equipments', description: 'Bar Bending Machine', qty: '15', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-26', category: 'own-equipments', description: 'Bar Rings Machine', qty: '2', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-27', category: 'own-equipments', description: 'Bar Threading Machine', qty: '1', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-28', category: 'own-equipments', description: 'Concrete Vibrators', qty: '28', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-29', category: 'own-equipments', description: 'Watering & De-Watering Pumps 5HP, 3HP', qty: '21', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-30', category: 'own-equipments', description: 'Total Station', qty: '7', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-31', category: 'own-equipments', description: 'Levelling Instrument', qty: '18', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-32', category: 'own-equipments', description: 'Cube Testing Machine', qty: '10', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-33', category: 'own-equipments', description: 'Soil Compacting Machine', qty: '7', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-34', category: 'own-equipments', description: 'Wood Plaining Machine', qty: '3', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-35', category: 'own-equipments', description: 'Wood Circular Saw Machine', qty: '25', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-36', category: 'own-equipments', description: 'Welding Machine 3PH & 1PH', qty: '15', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-37', category: 'own-equipments', description: 'Hydraulic Block Making Machine', qty: '2', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-38', category: 'own-equipments', description: 'Fly Ash brick manufacturing Machine', qty: '1', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-39', category: 'own-equipments', description: 'Paver/Cover block Vibration Machine', qty: '1', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-40', category: 'own-equipments', description: 'Stone Crushing Machine', qty: '1', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-41', category: 'own-equipments', description: 'Mixer Machine - Diesel & Electrical', qty: '3', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-42', category: 'own-equipments', description: 'Crusher Plant', qty: '3', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-43', category: 'own-equipments', description: 'Blue Metal Quarry', qty: '4', unit: 'Nos', categoryLabel: 'Own Equipments' },
          { id: 'infra-44', category: 'own-equipments', description: 'Weight Bridge 100MT', qty: '1', unit: 'Nos', categoryLabel: 'Own Equipments' }
        ]
      };
    }

    getInfrastructureCategoryOptions() {
      return [
        { value: 'own-equipments', label: 'Own Equipments', badge: 'badge-custom' },
        { value: 'machinery', label: 'Concrete Machinery', badge: 'badge-machinery' },
        { value: 'scaffolding', label: 'Scaffolding & Formwork', badge: 'badge-scaffolding' },
        { value: 'heavy', label: 'Lifting & Excavation', badge: 'badge-heavy' },
        { value: 'vehicles', label: 'Vehicles & Transport', badge: 'badge-vehicles' },
        { value: 'instruments', label: 'Site Instruments', badge: 'badge-instruments' },
        { value: 'quarry', label: 'Quarry & Crushing', badge: 'badge-quarry' }
      ];
    }

    slugifyInfrastructureCategory(label) {
      const base = String(label || '')
        .toLowerCase()
        .trim()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
      return base || `custom-${Date.now()}`;
    }

    normalizeInfrastructureData(raw) {
      const defaults = this.getDefaultInfrastructureData();
      const data = raw && typeof raw === 'object' ? raw : {};
      const cats = this.getInfrastructureCategoryOptions();
      const catMap = Object.fromEntries(cats.map((c) => [c.value, c]));
      const reserved = new Set(cats.map((c) => c.value).concat(['all', 'other', 'custom']));

      const inventory = Array.isArray(data.inventory) ? data.inventory : defaults.inventory;
      const normalizedInventory = inventory.map((row, index) => {
        const preset = catMap[row.category] || null;
        let category;
        let categoryLabel;

        if (preset) {
          category = preset.value;
          categoryLabel = String(row.categoryLabel || preset.label).trim() || preset.label;
        } else {
          categoryLabel = String(row.categoryLabel || row.category || '').trim() || 'Custom';
          const rawKey = String(row.category || '').trim();
          if (rawKey && !reserved.has(rawKey) && !catMap[rawKey]) {
            category = rawKey;
          } else {
            category = this.slugifyInfrastructureCategory(categoryLabel);
            if (reserved.has(category) || catMap[category]) {
              category = `custom-${category}`;
            }
          }
        }

        return {
          id: row.id || `infra-${index + 1}-${Date.now()}`,
          category,
          description: String(row.description || '').trim(),
          qty: String(row.qty || '').trim(),
          unit: String(row.unit || 'Nos').trim(),
          categoryLabel
        };
      }).filter((row) => row.description);

      const highlightsIn = Array.isArray(data.highlights) && data.highlights.length
        ? data.highlights
        : defaults.highlights;

      return {
        hero: {
          brand: (data.hero && data.hero.brand) || defaults.hero.brand,
          title: (data.hero && data.hero.title) || defaults.hero.title,
          lead: (data.hero && data.hero.lead) || defaults.hero.lead,
          ctaLabel: (data.hero && data.hero.ctaLabel) || defaults.hero.ctaLabel,
          ctaHref: (data.hero && data.hero.ctaHref) || defaults.hero.ctaHref,
          image: (data.hero && data.hero.image) || defaults.hero.image
        },
        highlights: highlightsIn.slice(0, 3).map((h, i) => ({
          key: h.key || defaults.highlights[i].key,
          label: String(h.label || defaults.highlights[i].label).trim(),
          value: String(h.value || defaults.highlights[i].value).trim(),
          note: String(h.note || defaults.highlights[i].note).trim()
        })),
        inventory: normalizedInventory
      };
    }

    getInfrastructureContent() {
      if (this.useApi()) {
        if (this._cmsCache.infrastructure) {
          return this.normalizeInfrastructureData(this._cmsCache.infrastructure);
        }
        return {
          hero: { brand: '', title: '', lead: '', ctaLabel: '', ctaHref: '', image: '' },
          highlights: [],
          inventory: []
        };
      }
      const STORAGE_KEY = 'sc_admin_infrastructure_v2';
      const defaults = this.getDefaultInfrastructureData();
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          const seeded = this.normalizeInfrastructureData(defaults);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
          return seeded;
        }
        const parsed = JSON.parse(stored);
        const normalized = this.normalizeInfrastructureData(parsed);
        if (!normalized.inventory.length && defaults.inventory.length) {
          const seeded = this.normalizeInfrastructureData(defaults);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
          return seeded;
        }
        return normalized;
      } catch (e) {
        return this.normalizeInfrastructureData(defaults);
      }
    }

    async updateInfrastructureContent(payload) {
      const normalized = this.normalizeInfrastructureData(payload);
      if (this.useApi()) {
        try {
          await this.apiFetch('/api/admin/infrastructure', {
            method: 'PUT',
            body: JSON.stringify(normalized)
          });
          this._cmsCache.infrastructure = normalized;
          return { success: true, message: 'Infrastructure page content published live.' };
        } catch (err) {
          return { success: false, message: 'Save failed — changes not published. ' + err.message };
        }
      }
      const STORAGE_KEY = 'sc_admin_infrastructure_v2';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      this.addAuditLog(
        'INFRASTRUCTURE_UPDATED',
        `Infrastructure page published (${normalized.inventory.length} inventory rows).`,
        'INFO'
      );
      return { success: true, message: 'Infrastructure page content updated and published live to website!' };
    }

    /**
     * Ongoing Projects page content (highlights + regional project table)
     * Storage: localStorage key sc_admin_ongoing_projects_v1
     */
    getDefaultOngoingProjectsData() {
      return {
        hero: {
          brand: 'Sekar Constructions',
          title: 'Ongoing Projects',
          lead: 'High-value industrial, utility, and heavy structural contracts across Tamil Nadu and Andhra Pradesh — tracked live by progress, scope, and location.',
          ctaLabel: 'View Active Sites',
          ctaHref: '#ongoing-projects',
          image: 'kochar-warehouse.jpg'
        },
        highlights: [
          { key: 'active', label: 'Active Projects', value: '9', note: 'Live contracts currently under execution' },
          { key: 'tn', label: 'Tamil Nadu', value: '7', note: 'Active sites across Chennai and Kalpakkam' },
          { key: 'ap', label: 'Andhra Pradesh', value: '2', note: 'BARC campus works near Visakhapatnam' }
        ],
        projects: [
          {
            id: 'ongoing-tn-1',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '1',
            name: 'Construction of Warehouse 8 Civil works, Ancillary Building and external works in Kochar Industrial Park at Kandamangalam, Tiruvallur Dist - 602105',
            patron: 'M/S. Kochar Properties Pvt Ltd. Chennai',
            valueLakhs: '2,926',
            progress: '25'
          },
          {
            id: 'ongoing-tn-3',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '3',
            name: 'Civil, Structural & Architectural works for foundation & superstructure of various buildings & other miscellaneous structures of Unit # 2 of BTG area at 2x660MW Ennore SEZ STPP (on the ash dyke of NCTPS)',
            patron: 'BHEL (TNEB) Chennai',
            valueLakhs: '9,313',
            progress: '76'
          },
          {
            id: 'ongoing-tn-4',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '4',
            name: 'Construction of 400 MLD SWRO Desalination Plant for CMWSSB at Perur, Chennai.',
            patron: 'CMWSSB, Chennai',
            valueLakhs: '6,688',
            progress: '65'
          },
          {
            id: 'ongoing-tn-5',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '5',
            name: 'Construction of Power Station 2 at FRFCF, DAE, Kalpakkam site',
            patron: 'FRFCF, DAE, Kalpakkam',
            valueLakhs: '938',
            progress: '80'
          },
          {
            id: 'ongoing-tn-6',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '6',
            name: 'Construction of Air Supply, Storage & Exhaust Building for SWPB of CWMF, BARCF at Kalpakkam',
            patron: 'CWMF, BARCF, Kalpakkam',
            valueLakhs: '691',
            progress: '58'
          },
          {
            id: 'ongoing-tn-7',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '7',
            name: 'Construction of Commercial Building B+G+3 at Thoraipakkam',
            patron: 'M/S. Jain Group Chennai',
            valueLakhs: '1,505',
            progress: '28'
          },
          {
            id: 'ongoing-tn-8',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '8',
            name: 'Construction of Hostel Building G+4 for NMV University',
            patron: 'M/S. Savitha Group of Colleges',
            valueLakhs: '2,666',
            progress: '8'
          },
          {
            id: 'ongoing-ap-1',
            region: 'ap',
            regionLabel: 'Andhra Pradesh',
            slNo: '1',
            name: 'Construction of E & F superstructure works of TL-3, finishing works and other miscellaneous works of TL 123 at BARC main campus, Near Visakhapatnam, AP',
            patron: 'BARC, Vizag',
            valueLakhs: '1,755',
            progress: '84'
          },
          {
            id: 'ongoing-ap-2',
            region: 'ap',
            regionLabel: 'Andhra Pradesh',
            slNo: '2',
            name: 'Supply laying installation testing of underground Chilled water pipeline works from UC-1 CAP towards eastern & western side of campus to cover nearby facilities including provision for future expansion at BARC (V), Atchutapuram near Visakhapatnam',
            patron: 'BARC, Vizag',
            valueLakhs: '1,380',
            progress: '25'
          }
        ]
      };
    }

    getOngoingRegionPresets() {
      // Full India states + UTs. Keep legacy keys tn / ap for existing stored projects.
      return [
        { value: 'ap', label: 'Andhra Pradesh', badge: 'AP' },
        { value: 'ar', label: 'Arunachal Pradesh', badge: 'AR' },
        { value: 'as', label: 'Assam', badge: 'AS' },
        { value: 'br', label: 'Bihar', badge: 'BR' },
        { value: 'cg', label: 'Chhattisgarh', badge: 'CG' },
        { value: 'ga', label: 'Goa', badge: 'GA' },
        { value: 'gj', label: 'Gujarat', badge: 'GJ' },
        { value: 'hr', label: 'Haryana', badge: 'HR' },
        { value: 'hp', label: 'Himachal Pradesh', badge: 'HP' },
        { value: 'jh', label: 'Jharkhand', badge: 'JH' },
        { value: 'ka', label: 'Karnataka', badge: 'KA' },
        { value: 'kl', label: 'Kerala', badge: 'KL' },
        { value: 'mp', label: 'Madhya Pradesh', badge: 'MP' },
        { value: 'mh', label: 'Maharashtra', badge: 'MH' },
        { value: 'mn', label: 'Manipur', badge: 'MN' },
        { value: 'ml', label: 'Meghalaya', badge: 'ML' },
        { value: 'mz', label: 'Mizoram', badge: 'MZ' },
        { value: 'nl', label: 'Nagaland', badge: 'NL' },
        { value: 'od', label: 'Odisha', badge: 'OD' },
        { value: 'pb', label: 'Punjab', badge: 'PB' },
        { value: 'rj', label: 'Rajasthan', badge: 'RJ' },
        { value: 'sk', label: 'Sikkim', badge: 'SK' },
        { value: 'tn', label: 'Tamil Nadu', badge: 'TN' },
        { value: 'ts', label: 'Telangana', badge: 'TS' },
        { value: 'tr', label: 'Tripura', badge: 'TR' },
        { value: 'up', label: 'Uttar Pradesh', badge: 'UP' },
        { value: 'uk', label: 'Uttarakhand', badge: 'UK' },
        { value: 'wb', label: 'West Bengal', badge: 'WB' },
        { value: 'an', label: 'Andaman and Nicobar Islands', badge: 'AN' },
        { value: 'ch', label: 'Chandigarh', badge: 'CH' },
        { value: 'dn', label: 'Dadra and Nagar Haveli and Daman and Diu', badge: 'DN' },
        { value: 'dl', label: 'Delhi', badge: 'DL' },
        { value: 'jk', label: 'Jammu and Kashmir', badge: 'JK' },
        { value: 'la', label: 'Ladakh', badge: 'LA' },
        { value: 'ld', label: 'Lakshadweep', badge: 'LD' },
        { value: 'py', label: 'Puducherry', badge: 'PY' }
      ];
    }

    /** Preferred admin/public table order: TN, AP, then remaining presets A–Z, then any custom. */
    getOngoingRegionDisplayOrder(regions) {
      const list = Array.isArray(regions) ? regions.slice() : this.getOngoingRegionPresets();
      const priority = { tn: 0, ap: 1 };
      return list.sort((a, b) => {
        const pa = priority[a.value] ?? 100;
        const pb = priority[b.value] ?? 100;
        if (pa !== pb) return pa - pb;
        return String(a.label || a.value).localeCompare(String(b.label || b.value), 'en');
      });
    }

    slugifyOngoingRegion(label) {
      const base = String(label || '')
        .toLowerCase()
        .trim()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
      return base || `region-${Date.now()}`;
    }

    /**
     * Region options for Ongoing Projects.
     * Always includes TN + AP presets; merges any extra regions found on project rows.
     */
    getOngoingRegionOptions(projects) {
      const presets = this.getOngoingRegionPresets();
      const map = new Map(presets.map((r) => [r.value, { ...r }]));
      const reserved = new Set(presets.map((r) => r.value).concat(['all', 'other', 'custom', 'region']));

      (Array.isArray(projects) ? projects : []).forEach((row) => {
        if (!row) return;
        const label = String(row.regionLabel || '').trim();
        let key = String(row.region || '').trim();
        if (!key && label) key = this.slugifyOngoingRegion(label);
        if (!key || reserved.has(key) && !map.has(key)) {
          if (!label) return;
          key = this.slugifyOngoingRegion(label);
          if (reserved.has(key) || map.has(key)) key = `region-${key}`;
        }
        if (map.has(key)) {
          if (label && !presets.some((p) => p.value === key)) {
            map.get(key).label = label;
          }
          return;
        }
        const badge = (label || key)
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase())
          .join('')
          .slice(0, 4) || key.toUpperCase().slice(0, 4);
        map.set(key, { value: key, label: label || key, badge });
      });

      return Array.from(map.values());
    }

    normalizeOngoingProgress(raw) {
      const cleaned = String(raw == null ? '' : raw).replace(/%/g, '').trim();
      if (!cleaned) return '0';
      const num = parseFloat(cleaned.replace(/,/g, ''));
      if (Number.isNaN(num)) return cleaned;
      const clamped = Math.max(0, Math.min(100, Math.round(num)));
      return String(clamped);
    }

    normalizeOngoingProjectsData(raw) {
      const defaults = this.getDefaultOngoingProjectsData();
      const data = raw && typeof raw === 'object' ? raw : {};
      const presets = this.getOngoingRegionPresets();
      const presetMap = Object.fromEntries(presets.map((r) => [r.value, r]));
      const reserved = new Set(presets.map((r) => r.value).concat(['all', 'other', 'custom', 'region']));

      const projectsIn = Array.isArray(data.projects) ? data.projects : defaults.projects;
      const normalizedProjects = projectsIn.map((row, index) => {
        const labelHint = String(row.regionLabel || '').trim();
        const presetByKey = presetMap[row.region] || null;
        const presetByLabel = !presetByKey && labelHint
          ? presets.find((p) => p.label.toLowerCase() === labelHint.toLowerCase()) || null
          : null;
        const preset = presetByKey || presetByLabel;
        let regionKey;
        let regionLabel;

        if (preset) {
          regionKey = preset.value;
          regionLabel = String(row.regionLabel || preset.label).trim() || preset.label;
        } else {
          regionLabel = labelHint || String(row.region || '').trim() || 'Custom Region';
          const rawKey = String(row.region || '').trim();
          if (rawKey && !reserved.has(rawKey) && !presetMap[rawKey]) {
            regionKey = rawKey;
          } else {
            regionKey = this.slugifyOngoingRegion(regionLabel);
            if (reserved.has(regionKey) || presetMap[regionKey]) {
              regionKey = `region-${regionKey}`;
            }
          }
        }

        return {
          id: row.id || `ongoing-${regionKey}-${index + 1}-${Date.now()}`,
          region: regionKey,
          regionLabel,
          slNo: String(row.slNo != null ? row.slNo : index + 1).trim() || String(index + 1),
          name: String(row.name || '').trim(),
          patron: String(row.patron || '').trim(),
          valueLakhs: String(row.valueLakhs || '').trim(),
          progress: this.normalizeOngoingProgress(row.progress)
        };
      }).filter((row) => row.name);

      const highlightsIn = Array.isArray(data.highlights) && data.highlights.length
        ? data.highlights
        : defaults.highlights;

      return {
        hero: {
          brand: (data.hero && data.hero.brand) || defaults.hero.brand,
          title: (data.hero && data.hero.title) || defaults.hero.title,
          lead: (data.hero && data.hero.lead) || defaults.hero.lead,
          ctaLabel: (data.hero && data.hero.ctaLabel) || defaults.hero.ctaLabel,
          ctaHref: (data.hero && data.hero.ctaHref) || defaults.hero.ctaHref,
          image: (data.hero && data.hero.image) || defaults.hero.image
        },
        highlights: highlightsIn.slice(0, 3).map((h, i) => ({
          key: h.key || defaults.highlights[i].key,
          label: String(h.label || defaults.highlights[i].label).trim(),
          value: String(h.value || defaults.highlights[i].value).trim(),
          note: String(h.note || defaults.highlights[i].note).trim()
        })),
        projects: normalizedProjects
      };
    }

    getOngoingProjectsContent() {
      if (this.useApi()) {
        if (this._cmsCache.ongoing) {
          return this.normalizeOngoingProjectsData(this._cmsCache.ongoing);
        }
        return {
          hero: { brand: '', title: '', lead: '', ctaLabel: '', ctaHref: '', image: '' },
          highlights: [],
          projects: []
        };
      }
      const STORAGE_KEY = 'sc_admin_ongoing_projects_v1';
      const defaults = this.getDefaultOngoingProjectsData();
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          const seeded = this.normalizeOngoingProjectsData(defaults);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
          return seeded;
        }
        const parsed = JSON.parse(stored);
        const normalized = this.normalizeOngoingProjectsData(parsed);
        if (!normalized.projects.length && defaults.projects.length) {
          const seeded = this.normalizeOngoingProjectsData(defaults);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
          return seeded;
        }
        return normalized;
      } catch (e) {
        return this.normalizeOngoingProjectsData(defaults);
      }
    }

    async updateOngoingProjectsContent(payload) {
      const normalized = this.normalizeOngoingProjectsData(payload);
      if (this.useApi()) {
        try {
          await this.apiFetch('/api/admin/ongoing-projects', {
            method: 'PUT',
            body: JSON.stringify(normalized)
          });
          this._cmsCache.ongoing = normalized;
          return { success: true, message: 'Ongoing Projects page content published live.' };
        } catch (err) {
          return { success: false, message: 'Save failed — changes not published. ' + err.message };
        }
      }
      const STORAGE_KEY = 'sc_admin_ongoing_projects_v1';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      this.addAuditLog(
        'ONGOING_PROJECTS_UPDATED',
        `Ongoing Projects page published (${normalized.projects.length} project rows).`,
        'INFO'
      );
      return { success: true, message: 'Ongoing Projects page content updated and published live to website!' };
    }

    /**
     * Completed Projects / Completed Major Works
     * Storage: localStorage key sc_admin_completed_projects_v1
     * Columns: Sl. No., Description of Works, Total Value (In Lakhs)
     * Reuses India state/UT region presets from Ongoing Projects.
     */
    getDefaultCompletedProjectsData() {
      return {
        hero: {
          brand: 'Sekar Constructions',
          title: 'Completed Projects',
          lead: 'Since 1995, Sekar Constructions has built an impeccable reputation for executing critical civil engineering structures across India.',
          ctaLabel: 'View Completed Works',
          ctaHref: '#completed-projects',
          image: 'kochar-warehouse.jpg'
        },
        highlights: [
          { key: 'completed', label: 'Completed Works', value: '12', note: 'Audited major works directory' },
          { key: 'value', label: 'Combined Value', value: '502', note: '₹ Crores across completed major contracts' },
          { key: 'years', label: 'Since', value: '1995', note: 'Class-I civil engineering track record' }
        ],
        projects: [
          {
            id: 'completed-tn-1',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '1',
            name: 'Site Development and Compound wall works & Construction of Warehouse (7nos) Civil works, Ancillary Building, external works and Plumbing in Kochar Industrial Park at Kandamangalam, Tiruvallur Dist - 602105',
            valueLakhs: '10006.62'
          },
          {
            id: 'completed-tn-2',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '2',
            name: 'Construction of On-Site Emergency support centre at Kalpakkam site',
            valueLakhs: '6080.00'
          },
          {
            id: 'completed-tn-3',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '3',
            name: 'Construction of C25 Stage Integration Complex and area development works around the facility at IPRC, Mahendragiri (Civil, PH, storm water drains work and mechanical doors)',
            valueLakhs: '5630.00'
          },
          {
            id: 'completed-tn-4',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '4',
            name: 'Construction of 150 MLD SWRO Desalination Plant for CMWSSB, Nemmeli on behalf of Cobratecton Pvt. Ltd., Chennai.',
            valueLakhs: '5232.66'
          },
          {
            id: 'completed-tn-5',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '5',
            name: 'Construction of Engineering Hall – V in IGCAR at Kalpakkam',
            valueLakhs: '3654.76'
          },
          {
            id: 'completed-tn-6',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '6',
            name: 'Construction of Proposed Factory Building, Warehouse Buildings and Ancillary Building Works including Plumbing at Irungattukottai, Chennai',
            valueLakhs: '7150.72'
          },
          {
            id: 'completed-tn-7',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '7',
            name: 'Construction of Student Hostel block, Academic block, Ware House, Canteen, Substation, Library, Plumbing work, Sewage Treatment Plant and other miscellaneous work under Phase – III at Great Lakes Institute of Management, Manamai at Kalpakkam.',
            valueLakhs: '3146.00'
          },
          {
            id: 'completed-tn-8',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '8',
            name: 'Construction of 116 Nos. of type II-B Residential Quarters in DAE Township at Kalpakkam [including electrical work]',
            valueLakhs: '2583.04'
          },
          {
            id: 'completed-tn-9',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '9',
            name: 'Construction of 233 Nos of New academic block including Civil, Mechanical, Electrical, Public health and other miscellaneous works under Phase - IV at Great Lakes Institute of Management, ECR, Manamai.',
            valueLakhs: '2357.00'
          },
          {
            id: 'completed-tn-10',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '10',
            name: 'Construction of AUSE Lab Building at IGCAR, Kalpakkam',
            valueLakhs: '1645.08'
          },
          {
            id: 'completed-tn-11',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '11',
            name: 'Construction of Balance works for 120 nos. of type IIIC quarters (Tower 4 -G+15 story) in DAE Township at Anupuram.',
            valueLakhs: '1384.33'
          },
          {
            id: 'completed-tn-12',
            region: 'tn',
            regionLabel: 'Tamil Nadu',
            slNo: '12',
            name: 'Construction of Infrastructure facilities for Store and workshop for FRFCF at IGCAR, Kalpakkam on behalf of Consolidated Construction Consortium Ltd, Chennai.',
            valueLakhs: '1360.00'
          }
        ]
      };
    }

    getCompletedRegionPresets() {
      return this.getOngoingRegionPresets();
    }

    getCompletedRegionDisplayOrder(regions) {
      return this.getOngoingRegionDisplayOrder(regions);
    }

    slugifyCompletedRegion(label) {
      return this.slugifyOngoingRegion(label);
    }

    getCompletedRegionOptions(projects) {
      return this.getOngoingRegionOptions(projects);
    }

    normalizeCompletedProjectsData(raw) {
      const defaults = this.getDefaultCompletedProjectsData();
      const data = raw && typeof raw === 'object' ? raw : {};
      const presets = this.getCompletedRegionPresets();
      const presetMap = Object.fromEntries(presets.map((r) => [r.value, r]));
      const reserved = new Set(presets.map((r) => r.value).concat(['all', 'other', 'custom', 'region']));

      const projectsIn = Array.isArray(data.projects) ? data.projects : defaults.projects;
      const normalizedProjects = projectsIn.map((row, index) => {
        const labelHint = String(row.regionLabel || '').trim();
        const presetByKey = presetMap[row.region] || null;
        const presetByLabel = !presetByKey && labelHint
          ? presets.find((p) => p.label.toLowerCase() === labelHint.toLowerCase()) || null
          : null;
        const preset = presetByKey || presetByLabel;
        let regionKey;
        let regionLabel;

        if (preset) {
          regionKey = preset.value;
          regionLabel = String(row.regionLabel || preset.label).trim() || preset.label;
        } else {
          regionLabel = labelHint || String(row.region || '').trim() || 'Tamil Nadu';
          const rawKey = String(row.region || '').trim();
          if (rawKey && !reserved.has(rawKey) && !presetMap[rawKey]) {
            regionKey = rawKey;
          } else {
            regionKey = this.slugifyCompletedRegion(regionLabel);
            if (reserved.has(regionKey) || presetMap[regionKey]) {
              regionKey = `region-${regionKey}`;
            }
          }
        }

        return {
          id: row.id || `completed-${regionKey}-${index + 1}-${Date.now()}`,
          region: regionKey,
          regionLabel,
          slNo: String(row.slNo != null ? row.slNo : index + 1).trim() || String(index + 1),
          name: String(row.name || '').trim(),
          valueLakhs: String(row.valueLakhs != null ? row.valueLakhs : '').trim()
        };
      }).filter((row) => row.name);

      const highlightsIn = Array.isArray(data.highlights) && data.highlights.length
        ? data.highlights
        : defaults.highlights;

      return {
        hero: {
          brand: (data.hero && data.hero.brand) || defaults.hero.brand,
          title: (data.hero && data.hero.title) || defaults.hero.title,
          lead: (data.hero && data.hero.lead) || defaults.hero.lead,
          ctaLabel: (data.hero && data.hero.ctaLabel) || defaults.hero.ctaLabel,
          ctaHref: (data.hero && data.hero.ctaHref) || defaults.hero.ctaHref,
          image: (data.hero && data.hero.image) || defaults.hero.image
        },
        highlights: highlightsIn.slice(0, 3).map((h, i) => ({
          key: h.key || defaults.highlights[i].key,
          label: String(h.label || defaults.highlights[i].label).trim(),
          value: String(h.value || defaults.highlights[i].value).trim(),
          note: String(h.note || defaults.highlights[i].note).trim()
        })),
        projects: normalizedProjects
      };
    }

    getCompletedProjectsContent() {
      if (this.useApi()) {
        if (this._cmsCache.completed) {
          return this.normalizeCompletedProjectsData(this._cmsCache.completed);
        }
        return {
          hero: { brand: '', title: '', lead: '', ctaLabel: '', ctaHref: '', image: '' },
          highlights: [],
          projects: []
        };
      }
      const STORAGE_KEY = 'sc_admin_completed_projects_v1';
      const defaults = this.getDefaultCompletedProjectsData();
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          const seeded = this.normalizeCompletedProjectsData(defaults);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
          return seeded;
        }
        const parsed = JSON.parse(stored);
        const normalized = this.normalizeCompletedProjectsData(parsed);
        if (!normalized.projects.length && defaults.projects.length) {
          const seeded = this.normalizeCompletedProjectsData(defaults);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
          return seeded;
        }
        return normalized;
      } catch (e) {
        return this.normalizeCompletedProjectsData(defaults);
      }
    }

    async updateCompletedProjectsContent(payload) {
      const normalized = this.normalizeCompletedProjectsData(payload);
      if (this.useApi()) {
        try {
          await this.apiFetch('/api/admin/completed-projects', {
            method: 'PUT',
            body: JSON.stringify(normalized)
          });
          this._cmsCache.completed = normalized;
          return { success: true, message: 'Completed Projects page content published live.' };
        } catch (err) {
          return { success: false, message: 'Save failed — changes not published. ' + err.message };
        }
      }
      const STORAGE_KEY = 'sc_admin_completed_projects_v1';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      this.addAuditLog(
        'COMPLETED_PROJECTS_UPDATED',
        `Completed Projects page published (${normalized.projects.length} project rows).`,
        'INFO'
      );
      return { success: true, message: 'Completed Projects page content updated and published live to website!' };
    }

    /**
     * Public Project Gallery (case-study image grid + lightbox)
     * Storage: localStorage key sc_admin_project_gallery_v3 (migrates v1/v2)
     * Distinct from Executive Team Photos (sc_admin_team_gallery_v1).
     * Case studies support images[] (cover = images[0]; legacy image coerced to 1-item array).
     */
    getProjectGalleryCategoryPresets() {
      return [
        { value: 'infrastructure', label: 'Infrastructure' },
        { value: 'industrial', label: 'Industrial' },
        { value: 'commercial', label: 'Commercial' }
      ];
    }

    slugifyProjectGalleryCategory(label) {
      return String(label || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'category';
    }

    getProjectGalleryCategoryOptions(items) {
      const presets = this.getProjectGalleryCategoryPresets();
      const presetMap = Object.fromEntries(presets.map((c) => [c.value, c]));
      const list = Array.isArray(items) ? items : [];
      const extras = [];
      list.forEach((item) => {
        const key = String(item.category || '').trim();
        if (!key || presetMap[key] || extras.some((e) => e.value === key)) return;
        extras.push({
          value: key,
          label: String(item.categoryFilterLabel || item.categoryLabel || key).trim() || key
        });
      });
      return presets.concat(extras);
    }

    getDefaultProjectGalleryData() {
      return {
        hero: {
          brand: 'Sekar Constructions',
          title: 'Project Gallery',
          lead: 'A visual tour of landmark civil works — power, desalination, industrial parks, and institutional campuses across Tamil Nadu.',
          ctaLabel: 'Browse Case Studies',
          ctaHref: '#project-gallery',
          image: 'desalination-plant.jpg'
        },
        highlights: [
          { key: 'studies', label: 'Case Studies', value: '12', note: 'Featured visual project stories' },
          { key: 'sectors', label: 'Sectors', value: '3', note: 'Infrastructure, industrial & commercial' },
          { key: 'years', label: 'Since', value: '1995', note: 'Documented Class-I delivery track record' }
        ],
        items: [
          {
            id: 'gallery-bhel-ennore',
            category: 'industrial',
            categoryLabel: 'Power Station & Energy',
            title: 'BHEL Ennore SEZ STPP',
            fullTitle: 'BHEL, 2 x 660 MW Ennore SEZ STPP',
            client: 'BHEL / TANGEDCO',
            value: '₹88.40 Crore',
            valueBadge: '₹88.40 Cr',
            location: 'Ennore, Chennai, TN',
            scope: 'Thermal power plant turbine foundations, boiler structures, substations',
            image: 'bhel-power-plant.jpg',
            images: ['bhel-power-plant.jpg'],
            shortDesc: 'Civil foundations and boiler structural framing works for the 2 x 660 MW Thermal Power Plant at Ennore.',
            description: 'Heavy civil infrastructure works for the 2 x 660 MW supercritical Ennore SEZ Thermal Power Project. Scope included constructing heavy concrete turbine generator foundations, boiler support structures, sub-station structures, auxiliary plant buildings, and surrounding utility trenches.'
          },
          {
            id: 'gallery-bhel-btg',
            category: 'industrial',
            categoryLabel: 'Power Station & Energy',
            title: 'BHEL BTG Area Civil Works',
            fullTitle: 'BTG Area Civil Works, BHEL Thermal Power Plant',
            client: 'TNEB / BHEL',
            value: '₹93.13 Crore',
            valueBadge: '₹93.13 Cr',
            location: 'Voyalur PO, Minjur, Ponneri, Tiruvallur Dist., TN',
            scope: 'Civil, Structural & Architectural works for Unit #2 BTG area',
            image: 'bhel-btg-civil.jpg',
            images: ['bhel-btg-civil.jpg'],
            shortDesc: 'Civil, structural, and architectural superstructure works for Unit #2 BTG area at Ennore SEZ STPP.',
            description: 'Execution of civil, structural, and architectural works for the foundation and superstructure of various buildings and miscellaneous structures within Unit #2 of the Boiler-Turbine-Generator (BTG) area at the 2x660MW Ennore SEZ Supercritical Thermal Power Project.'
          },
          {
            id: 'gallery-desal-400',
            category: 'infrastructure',
            categoryLabel: 'Water Utilities',
            title: '400 MLD Desalination Plant',
            fullTitle: 'Construction of 400 MLD Desalination Plant for CMWSSB',
            client: 'Cobratecton / CMWSSB',
            value: '₹120.40 Crore',
            valueBadge: '₹120.40 Cr',
            location: 'East Coast Road, Chennai, TN',
            scope: 'Desalination plant basins, pump houses, SWRO intake foundations',
            image: 'desal-400-site-aerial.png',
            images: [
              'desal-400-site-aerial.png',
              'desal-400-excavation.png',
              'desal-400-foundation.png',
              'desal-400-concrete-pour.png',
              'desal-400-circular-tank.png',
              'desal-400-clarifiers.png',
              'desal-400-reservoir.png',
              'desal-400-coastal-basins.png'
            ],
            shortDesc: 'Marine-grade concrete process basins, intake structures, and pump house civil works for CMWSSB along ECR.',
            description: 'Executed marine-grade concrete containment basins and processing structures for the 400 MLD Seawater Reverse Osmosis (SWRO) desalination facility for CMWSSB. Used highly resilient anti-corrosive concrete mixes to withstand high-salinity environment and coastal elements.'
          },
          {
            id: 'gallery-desal-150',
            category: 'infrastructure',
            categoryLabel: 'Water Utilities',
            title: '150 MLD Nemmeli SWRO Plant',
            fullTitle: 'Construction of Civil work at 150 MLD SWRO Desalination plant at ECR, Nemmeli, Chennai on behalf of Cobratecton Private Limited.',
            client: 'Cobratecton Pvt. Ltd. Chennai',
            value: '₹52.32 Crore',
            valueBadge: '₹52.32 Cr',
            location: 'ECR, Nemmeli, Chennai, TN',
            scope: 'SWRO plant civil works, process basins, foundations',
            image: 'nemmeli-desalination.jpg',
            images: [
              'nemmeli-desalination.jpg',
              'nemmeli-desal-aerial.png',
              'nemmeli-desal-basins.png',
              'nemmeli-desal-civil-works.png'
            ],
            shortDesc: 'Civil works for the 150 MLD SWRO desalination plant at ECR, Nemmeli on behalf of Cobratecton Private Limited.',
            description: 'Execution of civil engineering works for the 150 MLD Seawater Reverse Osmosis (SWRO) desalination plant at ECR, Nemmeli, Chennai on behalf of Cobratecton Private Limited. The project involved constructing robust structural concrete systems, massive water storage basins, and foundations for processing machinery under strict marine environmental specifications.'
          },
          {
            id: 'gallery-desal-perur',
            category: 'infrastructure',
            categoryLabel: 'Water Utilities',
            title: 'Perur 400 MLD SWRO Plant',
            fullTitle: 'Perur 400 MLD Desalination Project',
            client: 'VA TECH WABAG Ltd. / CMWSSB',
            value: '₹66.88 Crore',
            valueBadge: '₹66.88 Cr',
            location: 'Perur, ECR, Chennai, TN',
            scope: 'SWRO plant civil works, massive intake sump, process plant foundations',
            image: 'perur-desalination.jpg',
            images: ['perur-desalination.jpg'],
            shortDesc: 'Civil and concrete structural works for the mega 400 MLD SWRO plant at Perur on behalf of VA TECH WABAG Ltd.',
            description: 'Civil, structural, and architectural construction works for the mega 400 MLD Seawater Reverse Osmosis (SWRO) desalination plant at Perur, Chennai on behalf of VA TECH WABAG Ltd. Works include deep excavation, high-durability marine concrete foundations, water collection reservoirs, and structural framing for main processing halls.'
          },
          {
            id: 'gallery-kochar',
            category: 'industrial',
            categoryLabel: 'Logistics Park',
            title: 'Kochar Industrial Park',
            fullTitle: 'Kochar Industrial & Logistics Park',
            client: 'Kochar Group',
            value: '₹40.46 Crore',
            valueBadge: '₹40.46 Cr',
            location: 'Tiruvallur, Chennai, TN',
            scope: 'Industrial warehouses, concrete perimeter walling, external roads',
            image: 'kochar-warehouse.jpg',
            images: ['kochar-warehouse.jpg', 'kochar-entrance.png', 'kochar-aerial.png', 'kochar-warehouse-01.png', 'kochar-warehouse-07.png'],
            shortDesc: 'Site development, concrete compound walls, construction of Warehouse 1, and external road works.',
            description: 'Site development and warehouse block construction inside the Kochar Industrial Park at Tiruvallur. The contract included massive grading, sub-station foundations, heavy compound walls, external drainage, and high-load internal asphalt roads.'
          },
          {
            id: 'gallery-polyhose',
            category: 'industrial',
            categoryLabel: 'Industrial Facility',
            title: 'Polyhose Factory & PEB Warehouse',
            fullTitle: 'Construction of Factory Buildings, Warehouses And Ancillary Buildings for Polyhose India, Irungattukottai',
            client: 'Polyhose India Pvt. Ltd.',
            value: '₹71.51 Crore',
            valueBadge: '₹71.51 Cr',
            location: 'Irungattukottai, Chennai, TN',
            scope: 'Factory buildings, warehouses, PEB structure, ancillary buildings, plumbing',
            image: 'polyhose-facility.png',
            images: [
              'polyhose-facility.png',
              'polyhose-foundation.png',
              'polyhose-facility-front.png',
              'polyhose-aerial-solar.png',
              'polyhose-warehouses-aerial.png',
              'polyhose-peb-warehouse.png'
            ],
            shortDesc: 'Factory buildings, warehouses, PEB works, and ancillary buildings for Polyhose India at Irungattukottai.',
            description: 'Construction of proposed factory buildings, warehouse buildings including PEB works, and ancillary building works including plumbing for Polyhose India at Irungattukottai, Chennai. Scope covers structural framing, machinery foundations, PEB steel framing and cladding, interior flooring, utility integration, and external service pathways across the industrial campus.'
          },
          {
            id: 'gallery-isro-c25',
            category: 'industrial',
            categoryLabel: 'Aerospace / Institutional',
            title: 'ISRO C25 Integration Complex',
            fullTitle: 'Construction of C25 Stage Integration Complex and area development works around the facility at IPRC, Mahendragiri',
            client: 'Indian Space Research Organisation (ISRO)',
            value: '₹56.30 Crore',
            valueBadge: '₹56.30 Cr',
            location: 'IPRC, Mahendragiri, TN',
            scope: 'C25 Stage Integration Complex, 1,00,000 CUM clean room, civil, PH, storm water drains, mechanical doors, area development',
            image: 'isro-c25-integration-exterior.png',
            images: [
              'isro-c25-integration-exterior.png',
              'isro-c25-facade.png',
              'isro-clean-room-interior.png'
            ],
            shortDesc: 'C25 Stage Integration Complex with 1,00,000 CUM clean room and area development works at IPRC, Mahendragiri.',
            description: 'Construction of the C25 Stage Integration Complex and area development works around the facility at IPRC, Mahendragiri for the ISRO Propulsion Complex. Scope included civil works, public health, storm water drains, mechanical doors, and a 1,00,000 CUM capacity clean room for stage integration.'
          },
          {
            id: 'gallery-igcar-hall-v',
            category: 'industrial',
            categoryLabel: 'Nuclear / Institutional',
            title: 'IGCAR Engineering Hall V',
            fullTitle: 'Construction of Engineering Hall – V in IGCAR at Kalpakkam',
            client: 'Indira Gandhi Centre for Atomic Research (IGCAR)',
            value: '₹36.55 Crore',
            valueBadge: '₹36.55 Cr',
            location: 'IGCAR, Kalpakkam, TN',
            scope: 'Engineering Hall – V civil construction',
            image: 'igcar-engineering-hall-v.png',
            images: ['igcar-engineering-hall-v.png'],
            shortDesc: 'Engineering Hall – V civil construction for IGCAR at Kalpakkam.',
            description: 'Construction of Engineering Hall – V in IGCAR at Kalpakkam for the Indira Gandhi Centre for Atomic Research (Department of Atomic Energy).'
          },
          {
            id: 'gallery-igcar-water-tank',
            category: 'infrastructure',
            categoryLabel: 'Water Utilities',
            title: 'IGCAR Water Tank',
            fullTitle: 'Construction of Water Tanker 4.5Lakhs Capacity 18m Height at IGCAR, Kalpakkam',
            client: 'Indira Gandhi Centre for Atomic Research (IGCAR)',
            value: '',
            valueBadge: '',
            location: 'IGCAR, Kalpakkam, TN',
            scope: 'Elevated water tank, 4.5 lakh litre capacity, 18 m height',
            image: 'igcar-water-tank.png',
            images: ['igcar-water-tank.png'],
            shortDesc: '4.5 lakh litre capacity elevated water tank (18 m height) under construction at IGCAR, Kalpakkam.',
            description: 'Construction of an elevated water tank of 4.5 lakh litre capacity and 18 m height at IGCAR, Kalpakkam for the Indira Gandhi Centre for Atomic Research (Department of Atomic Energy).'
          },
          {
            id: 'gallery-great-lakes',
            category: 'commercial',
            categoryLabel: 'Commercial & Institutional',
            title: 'Great Lakes Campus',
            fullTitle: 'Construction of Great Lakes Institute of Management Campus at Manamai',
            client: 'Great Lakes Institute of Management',
            value: '₹31.46 Crore',
            valueBadge: '₹31.46 Cr',
            location: 'Manamai, ECR, Chennai, TN',
            scope: 'Academic block, student hostel block, canteen, substation, infrastructure development',
            image: 'great-lakes-campus.jpg',
            images: ['great-lakes-campus.jpg', 'great-lakes-entrance.png', 'great-lakes-building.png', 'great-lakes-hostel-court.png'],
            shortDesc: 'Academic block, hostel, utility systems, STP, and landscaping for the premier management campus at Manamai.',
            description: 'Construction of the main campus facilities for the Great Lakes Institute of Management at Manamai. The project included structural and finishing works for the academic block, student hostel blocks, warehouse, canteen, electric sub-station, library, plumbing works, sewage treatment plant, and comprehensive site development.'
          },
          {
            id: 'gallery-dae-quarters',
            category: 'commercial',
            categoryLabel: 'Residential Township',
            title: 'DAE Type II-B Quarters',
            fullTitle: 'Construction of 116 Nos. of type II-B Residential quarters in DAE Township at Kalpakkam [including electrical work]',
            client: 'Department of Atomic Energy (DAE)',
            value: '₹25.83 Crore',
            valueBadge: '₹25.83 Cr',
            location: 'DAE Township, Kalpakkam, TN',
            scope: '116 Nos. Type II-B residential quarters including electrical work',
            image: 'dae-kalpakkam-type-iib-quarters.png',
            images: ['dae-kalpakkam-type-iib-quarters.png'],
            shortDesc: '116 Type II-B residential quarters with electrical works in DAE Township at Kalpakkam.',
            description: 'Construction of 116 Nos. of type II-B Residential quarters in DAE Township at Kalpakkam, including electrical work. The project delivered multi-storey township housing blocks with associated electrical installations for Department of Atomic Energy residential accommodation.'
          }
        ]
      };
    }

    normalizeProjectGalleryData(raw) {
      const defaults = this.getDefaultProjectGalleryData();
      const data = raw && typeof raw === 'object' ? raw : {};
      const presets = this.getProjectGalleryCategoryPresets();
      const presetMap = Object.fromEntries(presets.map((c) => [c.value, c]));
      const reserved = new Set(presets.map((c) => c.value).concat(['all', 'other', 'custom', 'category']));

      const itemsIn = Array.isArray(data.items) ? data.items : defaults.items;
      // Drop retired split id; fold its photos into gallery-polyhose when present.
      const retiredPolyhosePeb = 'gallery-polyhose-peb';
      const pebExtras = [];
      const itemsSansRetired = [];
      itemsIn.forEach((row) => {
        if (!row) return;
        if (String(row.id || '') === retiredPolyhosePeb) {
          const imgs = Array.isArray(row.images)
            ? row.images.map((s) => String(s || '').trim()).filter(Boolean)
            : [];
          if (!imgs.length && row.image) imgs.push(String(row.image).trim());
          imgs.forEach((url) => {
            if (url && !pebExtras.includes(url)) pebExtras.push(url);
          });
          return;
        }
        itemsSansRetired.push(row);
      });
      if (pebExtras.length) {
        const poly = itemsSansRetired.find((row) => String(row.id || '') === 'gallery-polyhose');
        if (poly) {
          const existing = Array.isArray(poly.images)
            ? poly.images.map((s) => String(s || '').trim()).filter(Boolean)
            : [];
          if (!existing.length && poly.image) existing.push(String(poly.image).trim());
          pebExtras.forEach((url) => {
            if (url && !existing.includes(url)) existing.push(url);
          });
          poly.images = existing;
          if (!poly.image && existing[0]) poly.image = existing[0];
        }
      }

      const normalizedItems = itemsSansRetired.map((row, index) => {
        const labelHint = String(row.categoryFilterLabel || '').trim();
        const catLabel = String(row.categoryLabel || '').trim();
        const presetByKey = presetMap[row.category] || null;
        const presetByFilter = !presetByKey && labelHint
          ? presets.find((p) => p.label.toLowerCase() === labelHint.toLowerCase()) || null
          : null;
        const preset = presetByKey || presetByFilter;

        let category;
        let categoryFilterLabel;
        if (preset) {
          category = preset.value;
          categoryFilterLabel = preset.label;
        } else {
          categoryFilterLabel = labelHint || String(row.category || '').trim() || 'Industrial';
          const rawKey = String(row.category || '').trim();
          if (rawKey && !reserved.has(rawKey) && !presetMap[rawKey]) {
            category = rawKey;
          } else {
            category = this.slugifyProjectGalleryCategory(categoryFilterLabel);
            if (reserved.has(category) || presetMap[category]) {
              category = `cat-${category}`;
            }
          }
        }

        const title = String(row.title || '').trim();
        const fullTitle = String(row.fullTitle || row.title || '').trim();
        // Multi-image: prefer images[]; migrate legacy single image → 1-item array
        let images = [];
        if (Array.isArray(row.images)) {
          images = row.images.map((s) => String(s || '').trim()).filter(Boolean);
        }
        if (!images.length) {
          const legacy = String(row.image || '').trim();
          if (legacy) images = [legacy];
        }
        const image = images[0] || '';

        return {
          id: row.id || `gallery-${category}-${index + 1}-${Date.now()}`,
          category,
          categoryFilterLabel,
          categoryLabel: catLabel || categoryFilterLabel,
          title,
          fullTitle: fullTitle || title,
          client: String(row.client || '').trim(),
          value: String(row.value || '').trim(),
          valueBadge: String(row.valueBadge || row.value || '').trim(),
          location: String(row.location || '').trim(),
          scope: String(row.scope || '').trim(),
          image,
          images,
          shortDesc: String(row.shortDesc || '').trim(),
          description: String(row.description || row.shortDesc || '').trim()
        };
      }).filter((row) => row.title && row.images.length);

      // Upgrade stale image lists when bundled defaults are richer (e.g. Kochar /
      // Polyhose multi-photo). Prefer defaults when CMS is shorter or still holds
      // photos that now belong to a different bundled case study.
      const defaultItems = defaults.items || [];
      const defaultImagesById = Object.fromEntries(
        defaultItems.map((item) => [item.id, item.images || []])
      );
      const defaultItemById = Object.fromEntries(
        defaultItems.map((item) => [item.id, item])
      );
      const imageOwnerByUrl = {};
      defaultItems.forEach((item) => {
        (item.images || []).forEach((url) => {
          if (url && !imageOwnerByUrl[url]) imageOwnerByUrl[url] = item.id;
        });
      });

      const enrichedItems = normalizedItems.map((item) => {
        const defImgs = defaultImagesById[item.id];
        if (!Array.isArray(defImgs) || !defImgs.length) return item;
        const current = item.images || [];
        const hasMisassigned = current.some(
          (url) => imageOwnerByUrl[url] && imageOwnerByUrl[url] !== item.id
        );
        if (defImgs.length > current.length || hasMisassigned) {
          const defMeta = defaultItemById[item.id] || {};
          const next = Object.assign({}, item, {
            images: defImgs.slice(),
            image: defImgs[0] || item.image
          });
          // Refresh title/copy from defaults when photos were reassigned or the
          // bundled study is richer (e.g. merged Polyhose carousel).
          if (hasMisassigned || defImgs.length > current.length) {
            if (defMeta.title) next.title = defMeta.title;
            if (defMeta.fullTitle) next.fullTitle = defMeta.fullTitle;
            if (defMeta.location) next.location = defMeta.location;
            if (defMeta.scope) next.scope = defMeta.scope;
            if (defMeta.shortDesc) next.shortDesc = defMeta.shortDesc;
            if (defMeta.description) next.description = defMeta.description;
            if (defMeta.categoryLabel) next.categoryLabel = defMeta.categoryLabel;
            if (Object.prototype.hasOwnProperty.call(defMeta, 'value')) next.value = defMeta.value || '';
            if (Object.prototype.hasOwnProperty.call(defMeta, 'valueBadge')) {
              next.valueBadge = defMeta.valueBadge || '';
            }
          }
          return next;
        }
        return item;
      });

      // Insert bundled case studies missing from older CMS / localStorage seeds.
      const presentIds = new Set(enrichedItems.map((item) => item.id));
      const missingDefaults = defaultItems.filter((item) => item.id && !presentIds.has(item.id));
      let mergedItems = enrichedItems;
      if (missingDefaults.length) {
        const byId = Object.fromEntries(enrichedItems.map((item) => [item.id, item]));
        missingDefaults.forEach((def) => {
          const imgs = Array.isArray(def.images) && def.images.length
            ? def.images.slice()
            : (def.image ? [def.image] : []);
          byId[def.id] = {
            id: def.id,
            category: def.category,
            categoryFilterLabel: def.category === 'infrastructure' ? 'Infrastructure'
              : def.category === 'industrial' ? 'Industrial'
                : def.category === 'commercial' ? 'Commercial' : (def.categoryLabel || def.category),
            categoryLabel: def.categoryLabel || def.category,
            title: def.title,
            fullTitle: def.fullTitle || def.title,
            client: def.client || '',
            value: def.value || '',
            valueBadge: def.valueBadge || def.value || '',
            location: def.location || '',
            scope: def.scope || '',
            image: imgs[0] || '',
            images: imgs,
            shortDesc: def.shortDesc || '',
            description: def.description || def.shortDesc || ''
          };
        });
        const ordered = [];
        const seen = new Set();
        defaultItems.forEach((def) => {
          if (byId[def.id]) {
            ordered.push(byId[def.id]);
            seen.add(def.id);
          }
        });
        enrichedItems.forEach((item) => {
          if (!seen.has(item.id)) ordered.push(item);
        });
        mergedItems = ordered;
      }

      const highlightsIn = Array.isArray(data.highlights) && data.highlights.length
        ? data.highlights
        : defaults.highlights;

      return {
        hero: {
          brand: (data.hero && data.hero.brand) || defaults.hero.brand,
          title: (data.hero && data.hero.title) || defaults.hero.title,
          lead: (data.hero && data.hero.lead) || defaults.hero.lead,
          ctaLabel: (data.hero && data.hero.ctaLabel) || defaults.hero.ctaLabel,
          ctaHref: (data.hero && data.hero.ctaHref) || defaults.hero.ctaHref,
          image: (data.hero && data.hero.image) || defaults.hero.image
        },
        highlights: highlightsIn.slice(0, 3).map((h, i) => ({
          key: h.key || defaults.highlights[i].key,
          label: String(h.label || defaults.highlights[i].label).trim(),
          value: String(h.value || defaults.highlights[i].value).trim(),
          note: String(h.note || defaults.highlights[i].note).trim()
        })),
        items: mergedItems
      };
    }

    getProjectGalleryContent() {
      if (this.useApi()) {
        if (this._cmsCache.gallery) {
          return this.normalizeProjectGalleryData(this._cmsCache.gallery);
        }
        // Fail soft — do not seed hardcoded case-study images over client API edits.
        return {
          hero: {
            brand: '',
            title: '',
            lead: '',
            ctaLabel: 'Browse Case Studies',
            ctaHref: '#project-gallery',
            image: ''
          },
          highlights: [],
          items: []
        };
      }
      // v3: multi-image case studies (images[]); migrates v1/v2 single-image rows
      const STORAGE_KEY = 'sc_admin_project_gallery_v3';
      const LEGACY_KEYS = ['sc_admin_project_gallery_v2', 'sc_admin_project_gallery_v1'];
      const defaults = this.getDefaultProjectGalleryData();
      try {
        let stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          for (let i = 0; i < LEGACY_KEYS.length; i += 1) {
            const legacy = localStorage.getItem(LEGACY_KEYS[i]);
            if (!legacy) continue;
            try {
              const legacyParsed = JSON.parse(legacy);
              const legacyNorm = this.normalizeProjectGalleryData(legacyParsed);
              if (legacyNorm.items.length) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyNorm));
                stored = JSON.stringify(legacyNorm);
              }
            } catch (legacyErr) { /* ignore corrupt legacy */ }
            break;
          }
          LEGACY_KEYS.forEach((key) => {
            try { localStorage.removeItem(key); } catch (rmErr) { /* ignore */ }
          });
        }
        if (!stored) {
          const seeded = this.normalizeProjectGalleryData(defaults);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
          return seeded;
        }
        const parsed = JSON.parse(stored);
        const normalized = this.normalizeProjectGalleryData(parsed);
        if (!normalized.items.length && defaults.items.length) {
          const seeded = this.normalizeProjectGalleryData(defaults);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
          return seeded;
        }
        return normalized;
      } catch (e) {
        return this.normalizeProjectGalleryData(defaults);
      }
    }

    async updateProjectGalleryContent(payload) {
      const normalized = this.normalizeProjectGalleryData(payload);
      if (this.useApi()) {
        try {
          await this.apiFetch('/api/admin/gallery', {
            method: 'PUT',
            body: JSON.stringify(normalized)
          });
          this._cmsCache.gallery = normalized;
          return { success: true, message: 'Project Gallery content published live.' };
        } catch (err) {
          return { success: false, message: 'Save failed — changes not published. ' + err.message };
        }
      }
      const STORAGE_KEY = 'sc_admin_project_gallery_v3';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      ['sc_admin_project_gallery_v2', 'sc_admin_project_gallery_v1'].forEach((key) => {
        try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
      });
      this.addAuditLog(
        'PROJECT_GALLERY_UPDATED',
        `Project Gallery page published (${normalized.items.length} case studies).`,
        'INFO'
      );
      return { success: true, message: 'Project Gallery content updated and published live to website!' };
    }
  }

  window.SekarAdminSecurity = new AdminSecurityEngine();
  window.SekarAdminReady = window.SekarAdminSecurity.apiReady;
})(window);




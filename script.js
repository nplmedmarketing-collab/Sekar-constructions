// Sekar Construction Website JavaScript Logic
// Handles navigation scroll effects, scroll observers for fade-ins, animated count-ups, parallax zoom, and portfolio case study modals.

document.addEventListener('DOMContentLoaded', async () => {
  // Document scrollport (curtain pages still scroll the window / <html>, not .sc-curtain-stack).
  function getScrollY() {
    return window.scrollY
      || window.pageYOffset
      || (document.scrollingElement && document.scrollingElement.scrollTop)
      || document.documentElement.scrollTop
      || 0;
  }

  // 1. Sticky header — bind BEFORE awaiting CMS so a slow/hung API cannot block nav UX.
  //    layout.js injects <header> into #site-header (sync, before this script).
  //    Hide on scroll-down / show on scroll-up (always visible near top).
  const header = document.querySelector('header');
  const scrollTopBtn = document.querySelector('.scroll-top');
  let lastHeaderScrollY = getScrollY();
  let headerScrollTicking = false;
  const HEADER_TOP_SHOW = 50;
  const HEADER_HIDE_DELTA = 8;

  function isMobileNavOpen() {
    const menu = document.getElementById('navMenu');
    return !!(menu && menu.classList.contains('open'));
  }

  function syncHeaderScrollState() {
    if (!header) return;
    const y = getScrollY();

    if (y > HEADER_TOP_SHOW) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Keep nav visible at page top and while the mobile menu is open
    if (y <= HEADER_TOP_SHOW || isMobileNavOpen()) {
      header.classList.remove('nav-hidden');
    } else {
      const delta = y - lastHeaderScrollY;
      if (Math.abs(delta) >= HEADER_HIDE_DELTA) {
        if (delta > 0) {
          header.classList.add('nav-hidden');
        } else {
          header.classList.remove('nav-hidden');
        }
      }
    }

    lastHeaderScrollY = y;
  }

  syncHeaderScrollState();
  // Listen on window + document — some WebViews only emit on one of them.
  const onHeaderScroll = () => {
    if (headerScrollTicking) return;
    headerScrollTicking = true;
    requestAnimationFrame(() => {
      syncHeaderScrollState();

      if (scrollTopBtn) {
        if (getScrollY() > 300) {
          scrollTopBtn.classList.add('show');
        } else {
          scrollTopBtn.classList.remove('show');
        }
      }
      headerScrollTicking = false;
    });
  };
  window.addEventListener('scroll', onHeaderScroll, { passive: true });
  document.addEventListener('scroll', onHeaderScroll, { passive: true, capture: true });

  // 2. Scroll to Top Click
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // CMS hydrate may hang if the API host is unreachable — never block chrome on it.
  if (window.SekarAdminReady) {
    try {
      await Promise.race([
        window.SekarAdminReady,
        new Promise((resolve) => setTimeout(resolve, 4000))
      ]);
    } catch (err) {
      console.warn('Sekar CMS API hydrate failed; using local fallback where available.', err);
    }
  }

  // 0. Curtain hang + reveal spacer
  // Hang ≈ half CTA height so the card nests over sticky navy; spacer adds
  // scroll so the cream curtain can lift fully clear of the pinned footer.
  const syncCurtainRevealSpacer = () => {
    // Sticky pin lives on #site-footer (mount); measure painted <footer> height.
    const footerMount = document.getElementById('site-footer');
    const footer = document.querySelector('footer');
    const curtain = document.querySelector('.page-curtain');
    const cta = document.querySelector('.footer-cta');
    if ((!footer && !footerMount) || !curtain) return;

    const root = document.documentElement;

    if (cta) {
      const ctaH = cta.getBoundingClientRect().height;
      if (ctaH > 0) {
        // Desktop/tablet: true half-overlap. Mobile: shallower so contact stays usable.
        const narrow = window.matchMedia('(max-width: 600px)').matches;
        const mid = window.matchMedia('(max-width: 900px)').matches;
        const ratio = narrow ? 0.36 : mid ? 0.42 : 0.5;
        const hang = Math.round(ctaH * ratio);
        const overlap = hang + (narrow ? 40 : mid ? 52 : 64);
        root.style.setProperty('--curtain-cta-hang', `${hang}px`);
        root.style.setProperty('--curtain-overlap', `${overlap}px`);
      }
    }

    const styles = getComputedStyle(root);
    const overlap = parseFloat(styles.getPropertyValue('--curtain-overlap')) || 0;
    const hang = parseFloat(styles.getPropertyValue('--curtain-cta-hang')) || 0;
    const footerH = (footer || footerMount).offsetHeight;
    // Clear room so the cream curtain can lift above the pinned footer.
    // Use max(minClear, capped clearRoom) — never sum clearRoom + overlap + hang
    // (that stacked to ~700px of empty navy on typical viewports).
    // Keep spacer even under prefers-reduced-motion — reveal is scroll-driven.
    const clearRoom = Math.max(0, window.innerHeight - footerH);
    const minClear = overlap + hang + 24;
    const spacer = Math.max(minClear, Math.min(clearRoom, 280));
    root.style.setProperty('--curtain-reveal-spacer', `${Math.ceil(spacer)}px`);
  };
  syncCurtainRevealSpacer();
  window.addEventListener('resize', syncCurtainRevealSpacer);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncCurtainRevealSpacer).catch(() => {});
  }
  const ctaEl = document.querySelector('.footer-cta');
  if (ctaEl && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => syncCurtainRevealSpacer());
    ro.observe(ctaEl);
  }

  // 3. Hero video: force mobile autoplay + parallax; fall back to poster if blocked
  const heroVideo = document.querySelector('.hero-video');
  if (heroVideo) {
    heroVideo.muted = true;
    heroVideo.setAttribute('playsinline', '');
    heroVideo.setAttribute('webkit-playsinline', '');

    const tryPlayHero = () => {
      const playPromise = heroVideo.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Autoplay blocked (Low Power Mode / data saver) — keep poster visible
          heroVideo.removeAttribute('autoplay');
        });
      }
    };

    if (heroVideo.readyState >= 2) {
      tryPlayHero();
    } else {
      heroVideo.addEventListener('loadeddata', tryPlayHero, { once: true });
      heroVideo.addEventListener('canplay', tryPlayHero, { once: true });
    }

    // Retry once on first user interaction (required by some mobile browsers)
    const resumeOnGesture = () => {
      tryPlayHero();
      document.removeEventListener('touchstart', resumeOnGesture);
      document.removeEventListener('click', resumeOnGesture);
    };
    document.addEventListener('touchstart', resumeOnGesture, { once: true, passive: true });
    document.addEventListener('click', resumeOnGesture, { once: true });

    window.addEventListener('scroll', () => {
      const scrollPos = window.scrollY;
      heroVideo.style.transform = `scale(${1.05 + scrollPos * 0.0003}) translateY(${scrollPos * 0.15}px)`;
    }, { passive: true });
  }

  // 4. Hamburger Menu Toggle (all pages)
  const menuToggle = document.getElementById('menuToggleBtn');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  function setDropdownOpen(toggle, menu, open) {
    if (!toggle || !menu) return;
    menu.classList.toggle('show', open);
    menu.style.display = open ? 'block' : 'none';
    toggle.setAttribute('aria-expanded', String(open));
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.nav-menu .dropdown-toggle').forEach((toggle) => {
      setDropdownOpen(toggle, toggle.nextElementSibling, false);
    });
  }

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navMenu.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.classList.toggle('active', isOpen);
      // Opening the menu must keep the header visible (no awkward hide mid-menu)
      if (isOpen && header) {
        header.classList.remove('nav-hidden');
      }
    });

    // Handle nav links clicks and dropdown toggles
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        if (link.classList.contains('dropdown-toggle')) {
          e.preventDefault();
          e.stopPropagation();
          const dropdownMenu = link.nextElementSibling;
          if (dropdownMenu) {
            const willOpen = !dropdownMenu.classList.contains('show');
            closeAllDropdowns();
            setDropdownOpen(link, dropdownMenu, willOpen);
          }
          return;
        }
        navMenu.classList.remove('open');
        menuToggle.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
        closeAllDropdowns();
      });

      if (link.classList.contains('dropdown-toggle')) {
        link.addEventListener('keydown', (e) => {
          const dropdownMenu = link.nextElementSibling;
          if (!dropdownMenu) return;
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            setDropdownOpen(link, dropdownMenu, true);
            const firstItem = dropdownMenu.querySelector('a');
            if (firstItem) firstItem.focus();
          } else if (e.key === 'Escape') {
            setDropdownOpen(link, dropdownMenu, false);
            link.focus();
          }
        });
      }
    });

    // Close menu when a dropdown child link is clicked
    navMenu.querySelectorAll('.dropdown-menu a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        menuToggle.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
        closeAllDropdowns();
      });
      link.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          const toggle = link.closest('.dropdown')?.querySelector('.dropdown-toggle');
          closeAllDropdowns();
          if (toggle) toggle.focus();
        }
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-menu li.dropdown')) {
        closeAllDropdowns();
      }
    });
  }

  // Hover Intent Delay for Desktop Dropdowns (Portfolio, Gallery, etc.)
  document.querySelectorAll('.nav-menu li.dropdown').forEach((dropdownLi) => {
    const menu = dropdownLi.querySelector('.dropdown-menu');
    const toggle = dropdownLi.querySelector('.dropdown-toggle');
    if (!menu || !toggle) return;

    let timeoutId = null;

    dropdownLi.addEventListener('mouseenter', () => {
      if (window.innerWidth > 1024) {
        clearTimeout(timeoutId);
        closeAllDropdowns();
        setDropdownOpen(toggle, menu, true);
      }
    });

    dropdownLi.addEventListener('mouseleave', () => {
      if (window.innerWidth > 1024) {
        timeoutId = setTimeout(() => {
          setDropdownOpen(toggle, menu, false);
        }, 200); // 200ms grace period to transition mouse
      }
    });

    menu.addEventListener('mouseenter', () => {
      if (window.innerWidth > 1024) {
        clearTimeout(timeoutId);
      }
    });

    menu.addEventListener('mouseleave', () => {
      if (window.innerWidth > 1024) {
        timeoutId = setTimeout(() => {
          setDropdownOpen(toggle, menu, false);
        }, 200);
      }
    });
  });
  // 5. Homepage ScrollSpy — Home ↔ Services (curtain-safe)
  const isHomepage = document.querySelector('.hero') !== null;

  if (isHomepage) {
    const homeSection = document.getElementById('home');
    const servicesSection = document.getElementById('services');

    if (homeSection && servicesSection) {
      const setHomeNavActive = (currentLink) => {
        navLinks.forEach(link => {
          const href = link.getAttribute('href') || '';
          const isHomeLink = href === '#home' || href.indexOf('#home') !== -1;
          const isServicesLink = href === '#services' || href.indexOf('#services') !== -1;
          if (!isHomeLink && !isServicesLink) return;

          link.classList.remove('active');
          if (currentLink === 'services' && isServicesLink) {
            link.classList.add('active');
          } else if (currentLink === 'home' && isHomeLink) {
            link.classList.add('active');
          }
        });
      };

      const updateHomeNavFromScroll = () => {
        const probe = 140; // below sticky header
        const homeRect = homeSection.getBoundingClientRect();
        const servicesRect = servicesSection.getBoundingClientRect();

        // Hero is sticky under the curtain — treat it as Home while it still
        // fills most of the viewport and Services has not reached the probe line.
        const heroDominant =
          homeRect.top <= probe &&
          homeRect.bottom > window.innerHeight * 0.55 &&
          servicesRect.top > probe;

        let currentLink = 'home';
        if (!heroDominant && servicesRect.top <= probe && servicesRect.bottom > probe) {
          currentLink = 'services';
        } else if (!heroDominant && servicesRect.top <= probe) {
          // Past services (fleet/contact) — keep Services as nearest in-page section
          currentLink = 'services';
        }

        setHomeNavActive(currentLink);
      };

      window.addEventListener('scroll', updateHomeNavFromScroll, { passive: true });
      updateHomeNavFromScroll();
    }
  }

  // 6. Scroll Fade-in Observer (Subtle Scroll Animations)
  const fadeSections = document.querySelectorAll('.fade-in-section');
  
  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      threshold: 0.01,
      rootMargin: '100px 0px 100px 0px'
    });

    fadeSections.forEach(section => {
      sectionObserver.observe(section);
      const rect = section.getBoundingClientRect();
      if (rect.top < window.innerHeight * 1.5) {
        section.classList.add('is-visible');
      }
    });
  } else {
    fadeSections.forEach(section => {
      section.classList.add('is-visible');
    });
  }

  // 7. Interactive Stats Count-Up Animation
  const statsBar = document.querySelector('.stats-bar');
  const statNumbers = document.querySelectorAll('.stat-number');
  let animated = false;

  if (statsBar && statNumbers.length > 0 && 'IntersectionObserver' in window) {
    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !animated) {
          animateCounters();
          animated = true;
          statsObserver.unobserve(statsBar);
        }
      });
    }, { threshold: 0.3 });

    statsObserver.observe(statsBar);
  } else {
    // Immediate fallback animation if observer is not present
    setTimeout(animateCounters, 500);
  }

  function animateCounters() {
    statNumbers.forEach(counter => {
      const dataTarget = counter.getAttribute('data-target');
      if (dataTarget === null) return;
      const target = +dataTarget;
      if (isNaN(target)) return;

      const suffix = counter.getAttribute('data-suffix') || '';
      let count = 0;
      const duration = 1500; // Animation duration in ms
      const startTime = performance.now();

      const updateCount = (timestamp) => {
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing out quadratic function
        const easeProgress = progress * (2 - progress);
        count = Math.floor(easeProgress * target);

        counter.textContent = count + suffix;

        if (progress < 1) {
          requestAnimationFrame(updateCount);
        } else {
          counter.textContent = target + suffix;
        }
      };

      requestAnimationFrame(updateCount);
    });
  }

  // 8. Portfolio Filtering Logic
  const filterButtons = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');

  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterButtons.forEach(button => button.classList.remove('active'));
      e.target.classList.add('active');

      const filterValue = e.target.getAttribute('data-filter');

      projectCards.forEach(card => {
        const category = card.getAttribute('data-category');
        
        if (filterValue === 'all' || category === filterValue) {
          card.classList.remove('hide');
          card.style.opacity = '0';
          card.style.transform = 'scale(0.95)';
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
            card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
          }, 50);
        } else {
          card.classList.add('hide');
        }
      });
    });
  });

  // 9. Case Study Modal Overlay Logic
  const modal = document.getElementById('case-study-modal');
  const modalClose = document.getElementById('modalCloseBtn');
  
  const modalImg = document.getElementById('modalProjectImg');
  const modalTitle = document.getElementById('modalProjectTitle');
  const modalCat = document.getElementById('modalProjectCat');
  const modalDesc = document.getElementById('modalProjectDesc');
  const modalClient = document.getElementById('modalProjectClient');
  const modalValue = document.getElementById('modalProjectValue');
  const modalLoc = document.getElementById('modalProjectLoc');
  const modalScope = document.getElementById('modalProjectScope');
  const modalImgPrev = document.getElementById('modalImgPrev');
  const modalImgNext = document.getElementById('modalImgNext');
  const modalImgCounter = document.getElementById('modalImgCounter');
  const modalThumbs = document.getElementById('modalProjectThumbs');

  const caseStudyModalGallery = {
    images: [],
    index: 0,
    alt: 'Project image'
  };

  function parseCaseStudyCardImages(card) {
    if (!card) return [];
    const raw = card.getAttribute('data-images');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((s) => String(s || '').trim()).filter(Boolean);
        }
      } catch (err) { /* fall through to single image */ }
    }
    const single = card.getAttribute('data-image');
    return single ? [single] : [];
  }

  function setCaseStudyModalSlide(index) {
    const images = caseStudyModalGallery.images;
    if (!images.length || !modalImg) return;
    const nextIndex = ((index % images.length) + images.length) % images.length;
    caseStudyModalGallery.index = nextIndex;
    modalImg.src = images[nextIndex];
    modalImg.alt = caseStudyModalGallery.alt || 'Project image';
    if (modalImgCounter) {
      modalImgCounter.textContent = `${nextIndex + 1} / ${images.length}`;
    }
    if (modalThumbs) {
      modalThumbs.querySelectorAll('.modal-thumb').forEach((btn, i) => {
        btn.classList.toggle('is-active', i === nextIndex);
        btn.setAttribute('aria-selected', i === nextIndex ? 'true' : 'false');
      });
    }
  }

  function renderCaseStudyModalGallery(images, alt) {
    const list = Array.isArray(images) ? images.filter(Boolean) : [];
    const safeAlt = alt || 'Project case study photograph';
    caseStudyModalGallery.images = list.length ? list : [];
    caseStudyModalGallery.alt = safeAlt;
    caseStudyModalGallery.index = 0;

    const multi = list.length > 1;
    if (modalImgPrev) modalImgPrev.hidden = !multi;
    if (modalImgNext) modalImgNext.hidden = !multi;
    if (modalImgCounter) modalImgCounter.hidden = !multi;

    if (modalThumbs) {
      if (!multi) {
        modalThumbs.hidden = true;
        modalThumbs.innerHTML = '';
      } else {
        modalThumbs.hidden = false;
        modalThumbs.innerHTML = list.map((src, i) => `
          <button type="button" class="modal-thumb${i === 0 ? ' is-active' : ''}" data-index="${i}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-label="Show image ${i + 1}">
            <img src="${escapeInfraHtml(src)}" alt="${escapeInfraHtml(safeAlt)} — photo ${i + 1}" loading="lazy">
          </button>
        `).join('');
      }
    }

    if (list.length && modalImg) {
      setCaseStudyModalSlide(0);
    } else if (modalImg) {
      modalImg.src = '';
      modalImg.alt = safeAlt;
    }
  }

  function stepCaseStudyModalGallery(delta) {
    if (caseStudyModalGallery.images.length < 2) return;
    setCaseStudyModalSlide(caseStudyModalGallery.index + delta);
  }

  if (modalImgPrev) {
    modalImgPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      stepCaseStudyModalGallery(-1);
    });
  }
  if (modalImgNext) {
    modalImgNext.addEventListener('click', (e) => {
      e.stopPropagation();
      stepCaseStudyModalGallery(1);
    });
  }
  if (modalThumbs) {
    modalThumbs.addEventListener('click', (e) => {
      const btn = e.target.closest('.modal-thumb');
      if (!btn || !modalThumbs.contains(btn)) return;
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      if (!Number.isNaN(idx)) setCaseStudyModalSlide(idx);
    });
  }

  if (modal && projectCards.length > 0) {
    projectCards.forEach(card => {
      card.addEventListener('click', () => {
        // Retrieve card dataset elements
        const title = card.getAttribute('data-title');
        const client = card.getAttribute('data-client');
        const value = card.getAttribute('data-value');
        const loc = card.getAttribute('data-loc');
        const scope = card.getAttribute('data-scope');
        const desc = card.getAttribute('data-desc');
        const categoryText = card.querySelector('.project-cat')?.textContent || '';

        // Populate Modal Fields
        renderCaseStudyModalGallery(parseCaseStudyCardImages(card), title);
        modalTitle.textContent = title;
        modalCat.textContent = categoryText;
        modalDesc.textContent = desc;
        modalClient.textContent = client;
        modalValue.textContent = value;
        modalLoc.textContent = loc;
        modalScope.textContent = scope;

        // Open Modal overlay
        modal.classList.add('open');
        document.body.style.overflow = 'hidden'; // Stop page scroll
      });
    });

    // Close Modal on Close Button click
    if (modalClose) {
      modalClose.addEventListener('click', closeModalHandler);
    }

    // Close Modal on clicking outside modal container
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModalHandler();
      }
    });

    // Close Modal on ESC key; arrow keys for multi-image
    document.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('open')) return;
      if (e.key === 'Escape') {
        closeModalHandler();
      } else if (e.key === 'ArrowLeft') {
        stepCaseStudyModalGallery(-1);
      } else if (e.key === 'ArrowRight') {
        stepCaseStudyModalGallery(1);
      }
    });
  }

  function closeModalHandler() {
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = ''; // Restore page scroll
  }

  // 10. Contact Form Submission
  const contactForm = document.getElementById('contactForm');
  const formStatus = document.getElementById('formStatus');
  const enquiryShell = document.querySelector('.enquiry-form-shell');

  if (enquiryShell) {
    const revealEnquiry = () => enquiryShell.classList.add('is-ready');
    if ('IntersectionObserver' in window) {
      const enquiryObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            revealEnquiry();
            enquiryObserver.disconnect();
          }
        });
      }, { threshold: 0.2 });
      enquiryObserver.observe(enquiryShell);
    } else {
      revealEnquiry();
    }
  }

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const message = document.getElementById('message').value.trim();

      if (!name || !email || !message) {
        showStatus('Please fill in all required fields.', 'error');
        return;
      }

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');

      (async () => {
        try {
          if (window.SekarAdminSecurity) {
            const phone = document.getElementById('phone') ? document.getElementById('phone').value.trim() : '';
            const subject = document.getElementById('subject') ? document.getElementById('subject').value.trim() : '';
            await window.SekarAdminSecurity.addInquiry({
              name: name,
              email: email,
              phone: phone,
              subject: subject,
              message: message,
              company: 'Website Enquiry'
            });
          }
          contactForm.reset();
          showStatus('Your enquiry has been submitted successfully. Our team will get back to you shortly.', 'success');
        } catch (err) {
          console.error('Contact form submission failed:', err);
          showStatus(`Unable to submit enquiry (${err.message || 'Connection error'}). Please contact us directly at ho@sekarconstructions.com or call +91 94432 21644 / +91 63825 97029.`, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-loading');
        }
      })();
    });
  }

  function showStatus(msg, type) {
    if (!formStatus) return;
    formStatus.textContent = msg;
    formStatus.className = `form-status ${type}`;
    formStatus.style.display = 'block';
    
    formStatus.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    setTimeout(() => {
      formStatus.style.opacity = '0';
      formStatus.style.transition = 'opacity 0.5s ease';
      setTimeout(() => {
        formStatus.className = 'form-status';
        formStatus.style.opacity = '1';
        formStatus.style.display = 'none';
      }, 500);
    }, 8000);
  }

  // 11. Super Admin Stealth Access Shortcut (Ctrl + Shift + A)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      window.location.href = 'admin-login.html';
    }
  });

  // 12. Dynamic Fleet Inventory Sync from Super Admin Engine
  function syncFleetInventoryCounts() {
    if (!window.SekarAdminSecurity) return;
    const fleetData = window.SekarAdminSecurity.getFleetInventory();
    if (!fleetData || !Array.isArray(fleetData)) return;

    const fleetCards = document.querySelectorAll('.fleet-card');
    fleetCards.forEach(card => {
      const nameEl = card.querySelector('.fleet-name');
      const countEl = card.querySelector('.fleet-count');
      if (nameEl && countEl) {
        const cardName = nameEl.textContent.trim().toLowerCase();
        const match = fleetData.find(item => item.name.toLowerCase() === cardName);
        if (match) {
          countEl.textContent = match.count;
        }
      }
    });
  }

  syncFleetInventoryCounts();

  // Dynamic Executive Team Gallery Sync from Super Admin Engine
  function syncTeamGalleryPhotos() {
    if (!window.SekarAdminSecurity) return;
    const photos = window.SekarAdminSecurity.getGalleryPhotos();
    if (!photos || !Array.isArray(photos)) return;

    const galleryContainer = document.querySelector('.dynamic-team-gallery');
    if (!galleryContainer) return;

    // API mode: apply API result only (including empty) — do not keep stale hardcoded markup.
    const apiMode = typeof window.SekarAdminSecurity.useApi === 'function' && window.SekarAdminSecurity.useApi();
    if (!photos.length && !apiMode) return;

    galleryContainer.innerHTML = photos.map(photo => `
      <div class="gallery-item">
        <img src="${photo.url}" alt="${photo.caption || 'Sekar Constructions team'}">
      </div>
    `).join('');
  }

  syncTeamGalleryPhotos();

  // 13. Dynamic Financial Capacity & Quality Standards Sync from Super Admin Engine

  function niceTurnoverAxisMax(maxVal) {
    if (!Number.isFinite(maxVal) || maxVal <= 0) return 100;
    const padded = maxVal * 1.08;
    const magnitude = Math.pow(10, Math.floor(Math.log10(padded)));
    const normalized = padded / magnitude;
    let nice = 10;
    if (normalized <= 1) nice = 1;
    else if (normalized <= 2) nice = 2;
    else if (normalized <= 5) nice = 5;
    return nice * magnitude;
  }

  function formatTurnoverFyDisplay(year) {
    return String(year || '').replace('-', '–');
  }

  function shortFyLabel(year) {
    const parts = String(year || '').split('-');
    if (parts.length !== 2) return year;
    return parts[0].slice(-2) + '-' + parts[1].slice(-2);
  }

  function applyTurnoverChartFromSeries(card, series, currencyId) {
    if (!card || !Array.isArray(series) || series.length === 0) return;
    const svg = card.querySelector('.turnover-chart-svg');
    if (!svg) return;

    const meta = window.SekarAdminSecurity && window.SekarAdminSecurity.getTurnoverCurrencyMeta
      ? window.SekarAdminSecurity.getTurnoverCurrencyMeta(currencyId)
      : { axis: 'Rs. Millions', chartUnit: 'Rs. millions · FY', short: 'Rs.', unit: 'millions' };

    const values = series.map((row) => Number(row.amount) || 0);
    const maxVal = Math.max.apply(null, values);
    const axisMax = niceTurnoverAxisMax(maxVal);
    const plotTop = 28;
    const plotBottom = 148;
    const plotHeight = plotBottom - plotTop;
    const numVisible = series.length;
    let barXs = [];
    if (numVisible === 6) {
      barXs = [60, 108, 156, 204, 252, 300];
    } else if (numVisible === 7) {
      barXs = [60, 100, 140, 180, 220, 260, 300];
    } else {
      const step = numVisible > 1 ? (300 - 60) / (numVisible - 1) : 0;
      barXs = series.map((_, i) => Math.round(60 + i * step));
    }
    const centerXs = barXs.map((x) => x + 11);

    const valueToY = (value) => plotBottom - (Math.max(0, value) / axisMax) * plotHeight;

    let peakIdx = 0;
    values.forEach((val, idx) => {
      if (val >= values[peakIdx]) peakIdx = idx;
    });

    const barsGroup = svg.querySelector('.turnover-chart-bars');
    const bars = barsGroup ? barsGroup.querySelectorAll('rect') : [];
    const dotsGroup = svg.querySelector('.turnover-chart-dots');
    const circles = dotsGroup ? dotsGroup.querySelectorAll('circle') : [];
    const xLabels = svg.querySelectorAll('.turnover-chart-xlabels text');

    // Hide extra SVG elements if series has fewer items than default template
    bars.forEach((bar, idx) => {
      if (idx >= numVisible) bar.style.display = 'none';
      else bar.style.display = '';
    });
    circles.forEach((circle, idx) => {
      if (idx >= numVisible) circle.style.display = 'none';
      else circle.style.display = '';
    });
    xLabels.forEach((label, idx) => {
      if (idx >= numVisible) label.style.display = 'none';
      else label.style.display = '';
    });

    const placeholderYears = [];

    series.forEach((row, idx) => {
      const amount = values[idx];
      const y = valueToY(amount);
      const height = Math.max(0, plotBottom - y);
      const isPlaceholder = row.source === 'placeholder';
      if (isPlaceholder) placeholderYears.push(row.year);

      const bar = bars[idx];
      if (bar) {
        bar.setAttribute('x', String(barXs[idx]));
        bar.setAttribute('y', String(y));
        bar.setAttribute('height', String(height));
        bar.setAttribute('data-fy', row.year);
        bar.setAttribute('data-value', String(amount));
        bar.setAttribute('data-source', isPlaceholder ? 'placeholder' : (row.source || 'admin'));
        const opacitySteps = [0.55, 0.6, 0.65, 0.7, 0.75, 0.85, 1];
        bar.setAttribute('opacity', isPlaceholder ? String(opacitySteps[Math.min(idx, opacitySteps.length - 1)]) : (idx === peakIdx ? '1' : String(0.7 + idx * 0.04)));
      }
    });

    if (barsGroup) {
      barsGroup.setAttribute('data-placeholder-years', placeholderYears.join(','));
    }

    const line = svg.querySelector('.turnover-chart-line');
    if (line) {
      const points = series.map((row, idx) => centerXs[idx] + ',' + valueToY(values[idx])).join(' ');
      line.setAttribute('points', points);
    }

    if (dotsGroup) {
      series.forEach((row, idx) => {
        const circle = circles[idx];
        if (!circle) return;
        circle.setAttribute('cx', String(centerXs[idx]));
        circle.setAttribute('cy', String(valueToY(values[idx])));
        circle.setAttribute('r', idx === peakIdx ? '3.5' : '3');
      });
    }

    const yLabels = svg.querySelectorAll('.turnover-chart-ylabels text');
    const tickFracs = [1, 0.75, 0.5, 0.25];
    yLabels.forEach((label, idx) => {
      const tickVal = axisMax * tickFracs[idx];
      label.textContent = Number.isInteger(tickVal) ? String(tickVal) : tickVal.toFixed(0);
    });

    xLabels.forEach((label, idx) => {
      if (!series[idx]) return;
      label.setAttribute('x', String(centerXs[idx]));
      label.textContent = shortFyLabel(series[idx].year);
    });


    let peakLabel = svg.querySelector('.turnover-peak-label');
    if (!peakLabel) {
      peakLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      peakLabel.setAttribute('class', 'turnover-peak-label');
      peakLabel.setAttribute('text-anchor', 'middle');
      peakLabel.setAttribute('fill', '#1a1a2e');
      peakLabel.setAttribute('font-family', 'Plus Jakarta Sans, sans-serif');
      peakLabel.setAttribute('font-size', '10');
      peakLabel.setAttribute('font-weight', '600');
      svg.appendChild(peakLabel);
    }
    const peakY = valueToY(values[peakIdx]);
    peakLabel.setAttribute('x', String(centerXs[peakIdx]));
    peakLabel.setAttribute('y', String(Math.max(14, peakY - 8)));
    peakLabel.textContent = String(values[peakIdx]);

    const axisY = svg.querySelector('.turnover-axis-y');
    if (axisY) axisY.textContent = 'Turnover (' + meta.axis + ')';

    const axisX = svg.querySelector('.turnover-axis-x');
    if (axisX) axisX.textContent = 'Fiscal Year (FY)';

    const unitEl = card.querySelector('.turnover-chart-unit');
    if (unitEl) unitEl.textContent = meta.chartUnit;

    const peakYear = series[peakIdx].year;
    const noteEl = card.querySelector('.turnover-chart-note');
    if (noteEl) {
      noteEl.textContent = placeholderYears.length
        ? ('Earlier years illustrative · peak FY ' + formatTurnoverFyDisplay(peakYear))
        : ('Peak FY ' + formatTurnoverFyDisplay(peakYear));
    }

    const chartWrap = card.querySelector('.turnover-chart');
    if (chartWrap) {
      const unitWord = meta.unit || 'units';
      chartWrap.setAttribute(
        'aria-label',
        'Bar and line chart of annual turnover from FY ' + series[0].year + ' to FY ' + series[series.length - 1].year +
          ', peaking at ' + values[peakIdx] + ' ' + unitWord + ' in FY ' + peakYear +
          (placeholderYears.length ? '. Earlier years are illustrative placeholders.' : '.')
      );
    }

    card.setAttribute('data-turnover-series', placeholderYears.length ? 'mixed' : 'admin');
  }

  function syncFinancialsData() {
    if (!window.SekarAdminSecurity) return;
    const finData = window.SekarAdminSecurity.getFinancialsData();
    if (!finData || !Array.isArray(finData)) return;

    const cards = document.querySelectorAll('.financials-grid .financial-card');
    cards.forEach(card => {
      const key = card.getAttribute('data-fin-key');
      const titleEl = card.querySelector('.financial-card-face--front h3') || card.querySelector('h3');
      const textEl = card.querySelector('.financial-card-face--front p') || card.querySelector(':scope > p') || card.querySelector('p');
      let match = null;
      if (key) {
        match = finData.find(item => item.key === key);
      }
      if (!match && titleEl) {
        const titleText = titleEl.textContent.trim().toLowerCase();
        match = finData.find(item => item.title.toLowerCase() === titleText);
      }
      if (!match) return;

      if (titleEl) titleEl.textContent = match.title;
      if (textEl) textEl.textContent = match.text;

      if (match.key === 'turnover' && Array.isArray(match.series)) {
        const visibleSeries = match.series.filter(row => row && row.visible !== false);
        applyTurnoverChartFromSeries(card, visibleSeries.length > 0 ? visibleSeries : match.series, match.currency || 'inr_millions');
      }

    });
  }

  syncFinancialsData();

  // Financial flip cards (Turnover, Resources, Quality) — tap toggle on touch; keyboard via Enter/Space; hover uses CSS
  const fineHoverFlip = window.matchMedia('(hover: hover) and (pointer: fine)');
  document.querySelectorAll('.financial-card--flip').forEach((flipCard) => {
    const setFlipState = (flipped) => {
      flipCard.classList.toggle('is-flipped', flipped);
      flipCard.setAttribute('aria-pressed', flipped ? 'true' : 'false');
      const back = flipCard.querySelector('.financial-card-face--back');
      if (back) back.setAttribute('aria-hidden', flipped ? 'false' : 'true');
    };

    flipCard.addEventListener('click', () => {
      if (fineHoverFlip.matches) return;
      setFlipState(!flipCard.classList.contains('is-flipped'));
    });

    flipCard.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setFlipState(!flipCard.classList.contains('is-flipped'));
      } else if (event.key === 'Escape' && flipCard.classList.contains('is-flipped')) {
        setFlipState(false);
      }
    });
  });


  // 13. About financial capacity cards — staggered entrance
  const financialsGrid = document.querySelector('.financials-grid');
  const financialCards = document.querySelectorAll('.financials-grid .financial-card');

  if (financialsGrid && financialCards.length > 0) {
    const revealFinancialCards = () => {
      financialsGrid.classList.add('is-ready');
      financialCards.forEach((card) => card.classList.add('is-visible'));
    };

    const prefersReducedMotionFinancials = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotionFinancials) {
      revealFinancialCards();
    } else if ('IntersectionObserver' in window) {
      const financialsObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            revealFinancialCards();
            observer.unobserve(entry.target);
          }
        });
      }, {
        root: null,
        threshold: 0.2,
        rootMargin: '0px 0px -32px 0px'
      });

      financialsObserver.observe(financialsGrid);
    } else {
      revealFinancialCards();
    }
  }

  // 14. About workstream columns — staggered entrance
  const aboutWorkstreams = document.querySelector('.about-workstreams');
  const aboutStreams = document.querySelectorAll('.about-stream');

  if (aboutWorkstreams && aboutStreams.length > 0) {
    const revealAboutStreams = () => {
      aboutWorkstreams.classList.add('is-ready');
      aboutStreams.forEach((stream) => stream.classList.add('is-visible'));
    };

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      revealAboutStreams();
    } else if ('IntersectionObserver' in window) {
      const streamObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            revealAboutStreams();
            observer.unobserve(entry.target);
          }
        });
      }, {
        root: null,
        threshold: 0.18,
        rootMargin: '0px 0px -40px 0px'
      });

      streamObserver.observe(aboutWorkstreams);
    } else {
      revealAboutStreams();
    }
  }

  // 15. About quotes — shared scroll reveal (expertise, customers, quality)
  const aboutQuoteBlocks = document.querySelectorAll('.about-quote');

  if (aboutQuoteBlocks.length) {
    const prefersReducedMotionQuote = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotionQuote) {
      aboutQuoteBlocks.forEach((quote) => quote.classList.add('is-visible'));
    } else if ('IntersectionObserver' in window) {
      const quoteObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, {
        root: null,
        threshold: 0.35,
        rootMargin: '0px 0px -24px 0px'
      });

      aboutQuoteBlocks.forEach((quote) => quoteObserver.observe(quote));
    } else {
      aboutQuoteBlocks.forEach((quote) => quote.classList.add('is-visible'));
    }
  }

  // 16. About leading customers — soft scroll reveal
  const aboutCustomersSection = document.querySelector('.about-customers-section');

  if (aboutCustomersSection) {
    const revealCustomers = () => aboutCustomersSection.classList.add('is-visible');
    const prefersReducedMotionCustomers = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotionCustomers) {
      revealCustomers();
    } else if ('IntersectionObserver' in window) {
      const customersObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            revealCustomers();
            observer.unobserve(entry.target);
          }
        });
      }, {
        root: null,
        threshold: 0.2,
        rootMargin: '0px 0px -32px 0px'
      });

      customersObserver.observe(aboutCustomersSection);
    } else {
      revealCustomers();
    }
  }

  // 17. About leadership portraits — staggered scroll reveal (hover in CSS)
  const leadershipPeople = document.querySelectorAll('.leadership-person');

  if (leadershipPeople.length) {
    const prefersReducedMotionLeadership = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotionLeadership) {
      leadershipPeople.forEach((person) => person.classList.add('is-visible'));
    } else if ('IntersectionObserver' in window) {
      const leadershipObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, {
        root: null,
        threshold: 0.22,
        rootMargin: '0px 0px -28px 0px'
      });

      leadershipPeople.forEach((person) => leadershipObserver.observe(person));
    } else {
      leadershipPeople.forEach((person) => person.classList.add('is-visible'));
    }
  }

  // 18. About page — left content list (TOC) scroll spy
  const aboutToc = document.querySelector('.about-toc');
  if (aboutToc) {
    const tocLinks = Array.from(aboutToc.querySelectorAll('.about-toc-link[data-toc-target]'));
    const tocIds = [...new Set(tocLinks.map((link) => link.getAttribute('data-toc-target')).filter(Boolean))];
    const tocSections = tocIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const setActiveToc = (id) => {
      tocLinks.forEach((link) => {
        link.classList.toggle('is-active', link.getAttribute('data-toc-target') === id);
      });
    };

    if (tocSections.length > 0) {
      if ('IntersectionObserver' in window) {
        const visibleSet = new Set();

        const tocObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              visibleSet.add(entry.target.id);
            } else {
              visibleSet.delete(entry.target.id);
            }
          });

          // Last intersecting id in TOC order wins (handles nested stream targets)
          let activeId = null;
          tocIds.forEach((id) => {
            if (visibleSet.has(id)) activeId = id;
          });
          if (activeId) setActiveToc(activeId);
        }, {
          root: null,
          threshold: 0,
          rootMargin: '-22% 0px -62% 0px'
        });

        tocSections.forEach((section) => tocObserver.observe(section));
        setActiveToc(tocSections[0].id);
      } else {
        setActiveToc(tocSections[0].id);
      }
    }

    aboutToc.addEventListener('click', (event) => {
      const link = event.target.closest('.about-toc-link[data-toc-target]');
      if (!link) return;

      const targetId = link.getAttribute('data-toc-target');
      if (targetId) setActiveToc(targetId);

      const mobileDetails = aboutToc.querySelector('.about-toc-mobile');
      if (mobileDetails && mobileDetails.open && window.matchMedia('(max-width: 1024px)').matches) {
        mobileDetails.open = false;
      }
    });
  }

  // —— Infrastructure page: CMS sync, filter, count-up, PDF download ——
  const infraSearch = document.getElementById('infraSearch');
  const infraFilter = document.getElementById('infraFilter');
  const infraTable = document.getElementById('infraTable');
  const infraPdfBtn = document.getElementById('infraPdfBtn');

  const INFRA_BADGE_BY_CATEGORY = {
    'own-equipments': 'badge-custom',
    machinery: 'badge-machinery',
    scaffolding: 'badge-scaffolding',
    heavy: 'badge-heavy',
    vehicles: 'badge-vehicles',
    instruments: 'badge-instruments',
    quarry: 'badge-quarry'
  };

  function escapeInfraHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function syncInfrastructurePageFromAdmin() {
    if (!window.SekarAdminSecurity || typeof window.SekarAdminSecurity.getInfrastructureContent !== 'function') {
      return null;
    }
    const data = window.SekarAdminSecurity.getInfrastructureContent();
    if (!data) return null;

    // Hero stays static in infrastructure.html (not CMS-driven).

    const hlRoot = document.getElementById('infraHighlights');
    if (hlRoot && Array.isArray(data.highlights)) {
      hlRoot.innerHTML = data.highlights.map((h) => {
        const raw = String(h.value || '').trim();
        const numeric = /^\d+$/.test(raw);
        const countAttr = numeric ? ` data-count="${escapeInfraHtml(raw)}"` : '';
        return `
        <div class="infra-highlight">
          <span class="infra-highlight-label">${escapeInfraHtml(h.label)}</span>
          <span class="infra-highlight-value"${countAttr}>${escapeInfraHtml(raw)}</span>
          <p class="infra-highlight-note">${escapeInfraHtml(h.note)}</p>
        </div>
      `;
      }).join('');
    }

    if (infraTable && Array.isArray(data.inventory)) {
      const tbody = infraTable.querySelector('tbody');
      if (tbody) {
        tbody.innerHTML = data.inventory.map((row, index) => {
          const badge = INFRA_BADGE_BY_CATEGORY[row.category] || 'badge-custom';
          return `
            <tr data-category="${escapeInfraHtml(row.category)}">
              <td style="text-align: center; font-weight: 500; color: var(--text-muted);">${index + 1}</td>
              <td class="col-desc" style="font-weight: 600; color: var(--primary);">${escapeInfraHtml(row.description)}</td>
              <td style="text-align: center; font-weight: 700; color: var(--primary);">${escapeInfraHtml(row.qty)}</td>
              <td style="text-align: center; color: var(--text-muted); font-size: 0.9rem;">${escapeInfraHtml(row.unit)}</td>
              <td style="text-align: center;"><span class="infra-cat-badge ${badge}">${escapeInfraHtml(row.categoryLabel)}</span></td>
            </tr>
          `;
        }).join('');
      }

      // Rebuild filter options from inventory (includes custom categories)
      if (infraFilter) {
        const current = infraFilter.value || 'all';
        const seen = new Map();
        data.inventory.forEach((row) => {
          if (!row.category || seen.has(row.category)) return;
          seen.set(row.category, row.categoryLabel || row.category);
        });
        const presetOrder = ['machinery', 'scaffolding', 'heavy', 'vehicles', 'instruments', 'quarry'];
        const ordered = [];
        presetOrder.forEach((key) => {
          if (seen.has(key)) {
            ordered.push([key, seen.get(key)]);
            seen.delete(key);
          }
        });
        [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach((pair) => ordered.push(pair));

        infraFilter.innerHTML = [
          '<option value="all">All Categories</option>',
          ...ordered.map(([value, label]) =>
            `<option value="${escapeInfraHtml(value)}">${escapeInfraHtml(label)}</option>`
          )
        ].join('');

        if ([...infraFilter.options].some((opt) => opt.value === current)) {
          infraFilter.value = current;
        } else {
          infraFilter.value = 'all';
        }
      }
    }

    return data;
  }

  if (infraTable) {
    syncInfrastructurePageFromAdmin();

    let infraRows = Array.from(infraTable.querySelectorAll('tbody tr'));
    const infraResultCount = document.getElementById('infraResultCount');
    const infraEmpty = document.getElementById('infraEmpty');
    const infraControls = document.getElementById('infraControls');
    const infraTbody = infraTable.querySelector('tbody');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (infraTbody && !reduceMotion) {
      infraTbody.classList.add('is-animated');
    }

    const refreshInfraRows = () => {
      infraRows = Array.from(infraTable.querySelectorAll('tbody tr'));
    };

    const filterInfraTable = () => {
      if (!infraSearch || !infraFilter) return;
      refreshInfraRows();
      const query = infraSearch.value.toLowerCase().trim();
      const category = infraFilter.value;
      let visible = 0;

      if (infraControls) {
        infraControls.classList.remove('is-filtering');
        void infraControls.offsetWidth;
        infraControls.classList.add('is-filtering');
      }

      infraRows.forEach((row) => {
        const description = (row.querySelector('.col-desc, .infra-col-desc') || row.cells[1] || row)
          .textContent
          .toLowerCase();
        const rowCategory = row.getAttribute('data-category') || '';
        const matchesSearch = !query || description.includes(query);
        const matchesCategory = category === 'all' || rowCategory === category;
        const show = matchesSearch && matchesCategory;
        row.classList.toggle('hidden', !show);
        if (show) visible += 1;
      });

      if (infraResultCount) {
        infraResultCount.textContent = `${visible} item${visible === 1 ? '' : 's'}`;
      }
      if (infraEmpty) {
        infraEmpty.classList.toggle('is-visible', visible === 0);
      }
    };

    if (infraSearch) infraSearch.addEventListener('input', filterInfraTable);
    if (infraFilter) infraFilter.addEventListener('change', filterInfraTable);
    filterInfraTable();

    // Highlight reveal + count-up
    const highlightRoot = document.getElementById('infraHighlights');
    const highlightValues = () => document.querySelectorAll('.infra-highlight-value[data-count]');

    const animateInfraCounts = () => {
      highlightValues().forEach((el) => {
        const target = parseInt(el.getAttribute('data-count'), 10);
        if (Number.isNaN(target)) {
          // Non-numeric display values (e.g. "30k") — leave as authored
          return;
        }
        if (reduceMotion) {
          el.textContent = String(target);
          return;
        }
        const start = performance.now();
        const duration = 1100;
        const tick = (now) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = String(Math.round(target * eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    };

    if (highlightRoot) {
      const highlights = () => highlightRoot.querySelectorAll('.infra-highlight');
      if ('IntersectionObserver' in window) {
        let counted = false;
        const ho = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            highlights().forEach((h) => h.classList.add('is-visible'));
            if (!counted) {
              counted = true;
              animateInfraCounts();
            }
            ho.disconnect();
          });
        }, { threshold: 0.25 });
        ho.observe(highlightRoot);
      } else {
        highlights().forEach((h) => h.classList.add('is-visible'));
        animateInfraCounts();
      }
    }

    // Subtle hero parallax on media layer (zoom stays on the image)
    const heroMedia = document.querySelector('.infra-hero-media');
    if (heroMedia && !reduceMotion) {
      const onHeroScroll = () => {
        const y = window.scrollY;
        if (y > window.innerHeight * 1.25) return;
        heroMedia.style.transform = `translateY(${Math.min(y, 420) * 0.18}px)`;
      };
      window.addEventListener('scroll', onHeroScroll, { passive: true });
    }

    // Download as PDF → client-side jsPDF + autoTable (direct file save)
    if (infraPdfBtn) {
      const PDF_LABEL = `
            <i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i>
            Download as PDF
          `;

      const setPdfBusy = (busy) => {
        infraPdfBtn.disabled = busy;
        infraPdfBtn.classList.toggle('is-loading', busy);
        infraPdfBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
        infraPdfBtn.innerHTML = busy
          ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Preparing PDF…'
          : PDF_LABEL;
      };

      const collectInfraPdfRows = () => {
        refreshInfraRows();
        return infraRows.map((row, index) => {
          const cells = row.querySelectorAll('td');
          const desc = (row.querySelector('.col-desc, .infra-col-desc') || cells[1])?.textContent?.trim() || '';
          const qty = cells[2]?.textContent?.trim() || '';
          const unit = cells[3]?.textContent?.trim() || '';
          const category = cells[4]?.textContent?.trim() || '';
          const sl = cells[0]?.textContent?.trim() || String(index + 1);
          return [sl, desc, qty, unit, category];
        });
      };

      const loadScriptOnce = (src) =>
        new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
          }
          const s = document.createElement('script');
          s.src = src;
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error(`Failed to load ${src}`));
          document.head.appendChild(s);
        });

      const ensurePdfLibraries = async () => {
        const hasJsPdf = !!(window.jspdf && window.jspdf.jsPDF);
        const hasAutoTable = !!(hasJsPdf && typeof window.jspdf.jsPDF.API.autoTable === 'function');
        if (hasJsPdf && hasAutoTable) return;
        if (!hasJsPdf) {
          await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }
        if (!(window.jspdf && window.jspdf.jsPDF && typeof window.jspdf.jsPDF.API.autoTable === 'function')) {
          await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js');
        }
        if (!(window.jspdf && window.jspdf.jsPDF)) {
          throw new Error('PDF library failed to load');
        }
      };

      const loadInfraLogoDataUrl = () =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const size = Math.min(img.naturalWidth || 256, 256);
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, size, size);
              resolve(canvas.toDataURL('image/png'));
            } catch (_) {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = 'logo-final.png?v=6';
        });

      const generateInfraPdf = async () => {
        await ensurePdfLibraries();
        const JsPDF = window.jspdf.jsPDF;
        const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const marginX = 14;
        let cursorY = 16;

        const logoData = await loadInfraLogoDataUrl();
        if (logoData) {
          try {
            doc.addImage(logoData, 'PNG', marginX, 10, 16, 16);
          } catch (_) {
            /* text-only header fallback */
          }
        }

        const titleX = logoData ? marginX + 20 : marginX;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text('Sekar Constructions', titleX, cursorY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(162, 123, 60);
        doc.text('Class-I Civil Engineers & DAE Contractors', titleX, cursorY + 5);

        doc.setDrawColor(162, 123, 60);
        doc.setLineWidth(0.6);
        doc.line(marginX, 30, pageWidth - marginX, 30);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text('Infrastructure & Assets Inventory', marginX, 38);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(
          'Full owned-asset listing — machinery, scaffolding, fleet, instruments, quarries & crushing.',
          marginX,
          44
        );
        doc.text(
          `Generated ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}  ·  sekarconstructions.com`,
          marginX,
          49
        );

        const body = collectInfraPdfRows();

        doc.autoTable({
          startY: 54,
          head: [['Sl. No.', 'Description', 'Qty', 'Unit', 'Category']],
          body,
          theme: 'grid',
          styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 2.2,
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
            valign: 'middle'
          },
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8
          },
          alternateRowStyles: {
            fillColor: [250, 249, 246]
          },
          columnStyles: {
            0: { cellWidth: 16, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
            3: { cellWidth: 18, halign: 'center' },
            4: { cellWidth: 42 }
          },
          margin: { left: marginX, right: marginX },
          didDrawPage: (data) => {
            const pageCount = doc.internal.getNumberOfPages();
            const page = data.pageNumber;
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(
              `Page ${page} of ${pageCount}`,
              pageWidth - marginX,
              doc.internal.pageSize.getHeight() - 8,
              { align: 'right' }
            );
            doc.text('Sekar Constructions — Confidential inventory summary', marginX, doc.internal.pageSize.getHeight() - 8);
          }
        });

        doc.save('Sekar-Construction-Infrastructure.pdf');
      };

      infraPdfBtn.addEventListener('click', async () => {
        if (infraPdfBtn.disabled) return;
        setPdfBusy(true);
        try {
          await generateInfraPdf();
        } catch (err) {
          console.error('Infrastructure PDF download failed:', err);
          window.alert('Sorry — the PDF could not be generated. Please refresh and try again.');
        } finally {
          setPdfBusy(false);
        }
      });
    }
  }

  // —— Ongoing projects page: CMS sync, filter, count-up, PDF download ——
  const ongoingSearch = document.getElementById('ongoingSearch');
  const ongoingFilter = document.getElementById('ongoingFilter');
  const ongoingTable = document.getElementById('ongoingTable');
  const ongoingPdfBtn = document.getElementById('ongoingPdfBtn');
  const projectsTableBody = document.getElementById('projectsTableBody');

  function formatOngoingCostLakhs(valueLakhs) {
    const display = String(valueLakhs || '').trim();
    if (!display) return '—';
    const numeric = parseFloat(display.replace(/,/g, ''));
    if (Number.isNaN(numeric)) {
      return `&#8377;${escapeInfraHtml(display)} Lakhs`;
    }
    const cr = (numeric / 100).toFixed(2);
    return `&#8377;${escapeInfraHtml(display)} Lakhs <span class="cost-sub">(&#8377;${escapeInfraHtml(cr)} Cr)</span>`;
  }

  function ongoingProgressClass(pct) {
    if (pct >= 70) return 'progress-high';
    if (pct >= 40) return 'progress-medium';
    return 'progress-low';
  }

  function syncOngoingProjectsPageFromAdmin() {
    if (!window.SekarAdminSecurity || typeof window.SekarAdminSecurity.getOngoingProjectsContent !== 'function') {
      return null;
    }
    const data = window.SekarAdminSecurity.getOngoingProjectsContent();
    if (!data) return null;

    const hlRoot = document.getElementById('ongoingHighlights');
    if (hlRoot && Array.isArray(data.highlights)) {
      hlRoot.innerHTML = data.highlights.map((h) => {
        const raw = String(h.value || '').trim();
        const numeric = /^\d+$/.test(raw);
        const countAttr = numeric ? ` data-count="${escapeInfraHtml(raw)}"` : '';
        return `
        <div class="infra-highlight">
          <span class="infra-highlight-label">${escapeInfraHtml(h.label)}</span>
          <span class="infra-highlight-value"${countAttr}>${escapeInfraHtml(raw)}</span>
          <p class="infra-highlight-note">${escapeInfraHtml(h.note)}</p>
        </div>
      `;
      }).join('');
    }

    if (projectsTableBody && Array.isArray(data.projects)) {
      let regionMeta = typeof window.SekarAdminSecurity.getOngoingRegionOptions === 'function'
        ? window.SekarAdminSecurity.getOngoingRegionOptions(data.projects)
        : [
            { value: 'tn', label: 'Tamil Nadu', badge: 'TN' },
            { value: 'ap', label: 'Andhra Pradesh', badge: 'AP' }
          ];
      if (typeof window.SekarAdminSecurity.getOngoingRegionDisplayOrder === 'function') {
        regionMeta = window.SekarAdminSecurity.getOngoingRegionDisplayOrder(regionMeta);
      }

      const byRegion = {};
      data.projects.forEach((row) => {
        const key = row.region || 'tn';
        if (!byRegion[key]) byRegion[key] = [];
        byRegion[key].push(row);
      });

      Object.keys(byRegion).forEach((key) => {
        byRegion[key].sort((a, b) => {
          const sa = parseInt(String(a.slNo).replace(/\D/g, ''), 10) || 0;
          const sb = parseInt(String(b.slNo).replace(/\D/g, ''), 10) || 0;
          return sa - sb;
        });
      });

      // Public filter: All + every region that currently has projects
      const ongoingFilterEl = document.getElementById('ongoingFilter');
      if (ongoingFilterEl) {
        const presentKeys = Object.keys(byRegion).filter((k) => (byRegion[k] || []).length);
        const presentMeta = regionMeta.filter((r) => presentKeys.includes(r.value));
        // Include any present key missing from meta
        presentKeys.forEach((key) => {
          if (!presentMeta.some((r) => r.value === key)) {
            presentMeta.push({ value: key, label: key, badge: key.toUpperCase() });
          }
        });
        const orderedPresent = typeof window.SekarAdminSecurity.getOngoingRegionDisplayOrder === 'function'
          ? window.SekarAdminSecurity.getOngoingRegionDisplayOrder(presentMeta)
          : presentMeta;
        const prev = ongoingFilterEl.value || 'all';
        ongoingFilterEl.innerHTML = [
          '<option value="all">All Regions / States</option>',
          ...orderedPresent.map((r) =>
            `<option value="${escapeInfraHtml(r.value)}">${escapeInfraHtml(r.label)}</option>`
          )
        ].join('');
        if ([...ongoingFilterEl.options].some((o) => o.value === prev)) {
          ongoingFilterEl.value = prev;
        }
      }

      const parts = [];
      const orderedKeys = regionMeta.map((r) => r.value);
      // Append any leftover region keys not in meta
      Object.keys(byRegion).forEach((key) => {
        if (!orderedKeys.includes(key)) orderedKeys.push(key);
      });

      orderedKeys.forEach((key) => {
        const rows = byRegion[key] || [];
        if (!rows.length) return;
        const meta = regionMeta.find((r) => r.value === key) || {
          label: rows[0].regionLabel || key,
          badge: key.toUpperCase()
        };
        parts.push(`
          <tr class="state-header-row" data-region="${escapeInfraHtml(key)}">
            <td colspan="5">${escapeInfraHtml(meta.label)} <span class="state-badge">${escapeInfraHtml(meta.badge || key.toUpperCase())}</span></td>
          </tr>
        `);
        rows.forEach((row) => {
          const pct = parseInt(String(row.progress).replace(/\D/g, ''), 10) || 0;
          const barClass = ongoingProgressClass(pct);
          parts.push(`
            <tr data-region="${escapeInfraHtml(row.region)}">
              <td style="text-align: center; font-weight: 500; color: var(--text-muted);">${escapeInfraHtml(row.slNo)}</td>
              <td class="col-desc" style="font-weight: 600; color: var(--primary);">${escapeInfraHtml(row.name)}</td>
              <td class="col-client">${escapeInfraHtml(row.patron)}</td>
              <td class="col-cost" style="text-align: center; font-weight: 700; color: var(--secondary);">${formatOngoingCostLakhs(row.valueLakhs)}</td>
              <td style="text-align: center;">
                <div class="progress-container">
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill ${barClass}" style="width: ${pct}%;"></div>
                  </div>
                  <span class="progress-text">${pct}%</span>
                </div>
              </td>
            </tr>
          `);
        });
      });

      projectsTableBody.innerHTML = parts.join('');
    }

    return data;
  }

  if (ongoingTable && projectsTableBody) {
    syncOngoingProjectsPageFromAdmin();

    const ongoingResultCount = document.getElementById('ongoingResultCount');
    const ongoingEmpty = document.getElementById('ongoingEmpty');
    const ongoingControls = document.getElementById('ongoingControls');
    const reduceMotionOngoing = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ongoingProjectRows = Array.from(projectsTableBody.querySelectorAll('tr:not(.state-header-row)'));
    let ongoingStateHeaders = Array.from(projectsTableBody.querySelectorAll('.state-header-row'));

    if (!reduceMotionOngoing) {
      projectsTableBody.classList.add('is-animated');
    }

    const filterOngoingTable = () => {
      if (!ongoingSearch || !ongoingFilter) return;
      ongoingProjectRows = Array.from(projectsTableBody.querySelectorAll('tr:not(.state-header-row)'));
      ongoingStateHeaders = Array.from(projectsTableBody.querySelectorAll('.state-header-row'));
      const query = ongoingSearch.value.toLowerCase().trim();
      const selectedRegion = ongoingFilter.value;
      let visible = 0;
      const regionHasMatch = {};

      if (ongoingControls) {
        ongoingControls.classList.remove('is-filtering');
        void ongoingControls.offsetWidth;
        ongoingControls.classList.add('is-filtering');
      }

      ongoingProjectRows.forEach((row) => {
        const description = (row.querySelector('.col-desc') || row.cells[1] || row)
          .textContent
          .toLowerCase();
        const client = (row.querySelector('.col-client') || row.cells[2] || row)
          .textContent
          .toLowerCase();
        const region = row.getAttribute('data-region') || '';
        const matchesSearch = !query || description.includes(query) || client.includes(query);
        const matchesRegion = selectedRegion === 'all' || region === selectedRegion;
        const show = matchesSearch && matchesRegion;
        row.classList.toggle('hidden', !show);
        if (show) {
          visible += 1;
          regionHasMatch[region] = true;
        }
      });

      ongoingStateHeaders.forEach((header) => {
        const region = header.getAttribute('data-region') || '';
        const showHeader =
          !!regionHasMatch[region] &&
          (selectedRegion === 'all' || selectedRegion === region);
        header.classList.toggle('hidden', !showHeader);
      });

      if (ongoingResultCount) {
        ongoingResultCount.textContent = `${visible} project${visible === 1 ? '' : 's'}`;
      }
      if (ongoingEmpty) {
        ongoingEmpty.classList.toggle('is-visible', visible === 0);
      }
    };

    if (ongoingSearch) ongoingSearch.addEventListener('input', filterOngoingTable);
    if (ongoingFilter) ongoingFilter.addEventListener('change', filterOngoingTable);
    filterOngoingTable();

    // Highlight reveal + count-up
    const ongoingHighlightRoot = document.getElementById('ongoingHighlights');
    const ongoingHighlightValues = () =>
      document.querySelectorAll('#ongoingHighlights .infra-highlight-value[data-count]');

    const animateOngoingCounts = () => {
      ongoingHighlightValues().forEach((el) => {
        const target = parseInt(el.getAttribute('data-count'), 10);
        if (Number.isNaN(target)) return;
        if (reduceMotionOngoing) {
          el.textContent = String(target);
          return;
        }
        const start = performance.now();
        const duration = 1100;
        const tick = (now) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = String(Math.round(target * eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    };

    if (ongoingHighlightRoot) {
      const highlights = () => ongoingHighlightRoot.querySelectorAll('.infra-highlight');
      if ('IntersectionObserver' in window) {
        let counted = false;
        const ho = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            highlights().forEach((h) => h.classList.add('is-visible'));
            if (!counted) {
              counted = true;
              animateOngoingCounts();
            }
            ho.disconnect();
          });
        }, { threshold: 0.25 });
        ho.observe(ongoingHighlightRoot);
      } else {
        highlights().forEach((h) => h.classList.add('is-visible'));
        animateOngoingCounts();
      }
    }

    // Subtle hero parallax on media layer
    const ongoingHeroMedia = document.querySelector('.infra-hero-media');
    if (ongoingHeroMedia && !reduceMotionOngoing && !document.getElementById('infraTable')) {
      const onHeroScroll = () => {
        const y = window.scrollY;
        if (y > window.innerHeight * 1.25) return;
        ongoingHeroMedia.style.transform = `translateY(${Math.min(y, 420) * 0.18}px)`;
      };
      window.addEventListener('scroll', onHeroScroll, { passive: true });
    }

    // Download as PDF → client-side jsPDF + autoTable
    if (ongoingPdfBtn) {
      const ONGOING_PDF_LABEL = `
            <i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i>
            Download as PDF
          `;

      const setOngoingPdfBusy = (busy) => {
        ongoingPdfBtn.disabled = busy;
        ongoingPdfBtn.classList.toggle('is-loading', busy);
        ongoingPdfBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
        ongoingPdfBtn.innerHTML = busy
          ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Preparing PDF…'
          : ONGOING_PDF_LABEL;
      };

      const REGION_LABELS = {
        tn: 'Tamil Nadu',
        ap: 'Andhra Pradesh'
      };

      const collectOngoingPdfRows = () => {
        const rows = Array.from(projectsTableBody.querySelectorAll('tr:not(.state-header-row)'));
        return rows.map((row, index) => {
          const cells = row.querySelectorAll('td');
          const sl = cells[0]?.textContent?.trim() || String(index + 1);
          const project = (row.querySelector('.col-desc') || cells[1])?.textContent?.trim() || '';
          const client = (row.querySelector('.col-client') || cells[2])?.textContent?.trim() || '';
          const cost = (cells[3]?.textContent || '').replace(/\s+/g, ' ').trim();
          const progressEl = row.querySelector('.progress-text, .scheduled-badge');
          const progress = (progressEl?.textContent || cells[4]?.textContent || '').replace(/\s+/g, ' ').trim();
          const region = REGION_LABELS[row.getAttribute('data-region')] || '';
          return [sl, project, client, cost, progress, region];
        });
      };

      const loadScriptOnce = (src) =>
        new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
          }
          const s = document.createElement('script');
          s.src = src;
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error(`Failed to load ${src}`));
          document.head.appendChild(s);
        });

      const ensurePdfLibraries = async () => {
        const hasJsPdf = !!(window.jspdf && window.jspdf.jsPDF);
        const hasAutoTable = !!(hasJsPdf && typeof window.jspdf.jsPDF.API.autoTable === 'function');
        if (hasJsPdf && hasAutoTable) return;
        if (!hasJsPdf) {
          await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }
        if (!(window.jspdf && window.jspdf.jsPDF && typeof window.jspdf.jsPDF.API.autoTable === 'function')) {
          await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js');
        }
        if (!(window.jspdf && window.jspdf.jsPDF)) {
          throw new Error('PDF library failed to load');
        }
      };

      const loadOngoingLogoDataUrl = () =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const size = Math.min(img.naturalWidth || 256, 256);
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, size, size);
              resolve(canvas.toDataURL('image/png'));
            } catch (_) {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = 'logo-final.png?v=6';
        });

      const generateOngoingPdf = async () => {
        await ensurePdfLibraries();
        const JsPDF = window.jspdf.jsPDF;
        const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const marginX = 14;
        let cursorY = 16;

        const logoData = await loadOngoingLogoDataUrl();
        if (logoData) {
          try {
            doc.addImage(logoData, 'PNG', marginX, 10, 16, 16);
          } catch (_) {
            /* text-only header fallback */
          }
        }

        const titleX = logoData ? marginX + 20 : marginX;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text('Sekar Constructions', titleX, cursorY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(162, 123, 60);
        doc.text('Class-I Civil Engineers & DAE Contractors', titleX, cursorY + 5);

        doc.setDrawColor(162, 123, 60);
        doc.setLineWidth(0.6);
        doc.line(marginX, 30, pageWidth - marginX, 30);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text('Ongoing Projects', marginX, 38);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(
          'Active industrial, utility, and heavy structural contracts across Tamil Nadu and Andhra Pradesh.',
          marginX,
          44
        );
        doc.text(
          `Generated ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}  ·  sekarconstructions.com`,
          marginX,
          49
        );

        const body = collectOngoingPdfRows();

        doc.autoTable({
          startY: 54,
          head: [['Sl. No.', 'Project / Location', 'Owner / Client', 'Cost', 'Progress', 'Region']],
          body,
          theme: 'grid',
          styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: 2,
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
            valign: 'middle'
          },
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8
          },
          alternateRowStyles: {
            fillColor: [250, 249, 246]
          },
          columnStyles: {
            0: { cellWidth: 14, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 42 },
            3: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
            4: { cellWidth: 24, halign: 'center' },
            5: { cellWidth: 28, halign: 'center' }
          },
          margin: { left: marginX, right: marginX },
          didDrawPage: (data) => {
            const pageCount = doc.internal.getNumberOfPages();
            const page = data.pageNumber;
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(
              `Page ${page} of ${pageCount}`,
              pageWidth - marginX,
              doc.internal.pageSize.getHeight() - 8,
              { align: 'right' }
            );
            doc.text('Sekar Constructions — Ongoing projects summary', marginX, doc.internal.pageSize.getHeight() - 8);
          }
        });

        doc.save('Sekar-Construction-Ongoing-Projects.pdf');
      };

      ongoingPdfBtn.addEventListener('click', async () => {
        if (ongoingPdfBtn.disabled) return;
        setOngoingPdfBusy(true);
        try {
          await generateOngoingPdf();
        } catch (err) {
          console.error('Ongoing projects PDF download failed:', err);
          window.alert('Sorry — the PDF could not be generated. Please refresh and try again.');
        } finally {
          setOngoingPdfBusy(false);
        }
      });
    }
  }

  // —— Completed projects page: CMS sync, filter, count-up, PDF download ——
  const completedSearch = document.getElementById('completedSearch');
  const completedFilter = document.getElementById('completedFilter');
  const completedTable = document.getElementById('completedTable');
  const completedPdfBtn = document.getElementById('completedPdfBtn');
  const completedProjectsTableBody = document.getElementById('completedProjectsTableBody');

  function formatCompletedCostLakhs(valueLakhs) {
    const display = String(valueLakhs || '').trim();
    if (!display) return '—';
    const numeric = parseFloat(display.replace(/,/g, ''));
    if (Number.isNaN(numeric)) {
      return `&#8377;${escapeInfraHtml(display)} Lakhs`;
    }
    const formatted = numeric.toLocaleString('en-IN', {
      minimumFractionDigits: display.includes('.') ? (display.split('.')[1] || '').length : 0,
      maximumFractionDigits: 2
    });
    const cr = (numeric / 100).toFixed(2);
    return `&#8377;${escapeInfraHtml(formatted)} Lakhs <span class="cost-sub">(&#8377;${escapeInfraHtml(cr)} Cr)</span>`;
  }

  function syncCompletedProjectsPageFromAdmin() {
    if (!window.SekarAdminSecurity || typeof window.SekarAdminSecurity.getCompletedProjectsContent !== 'function') {
      return null;
    }
    const data = window.SekarAdminSecurity.getCompletedProjectsContent();
    if (!data) return null;

    const hlRoot = document.getElementById('completedHighlights');
    if (hlRoot && Array.isArray(data.highlights)) {
      hlRoot.innerHTML = data.highlights.map((h) => {
        const raw = String(h.value || '').trim();
        const numeric = /^\d+$/.test(raw);
        const countAttr = numeric ? ` data-count="${escapeInfraHtml(raw)}"` : '';
        return `
        <div class="infra-highlight">
          <span class="infra-highlight-label">${escapeInfraHtml(h.label)}</span>
          <span class="infra-highlight-value"${countAttr}>${escapeInfraHtml(raw)}</span>
          <p class="infra-highlight-note">${escapeInfraHtml(h.note)}</p>
        </div>
      `;
      }).join('');
    }

    if (completedProjectsTableBody && Array.isArray(data.projects)) {
      let regionMeta = typeof window.SekarAdminSecurity.getCompletedRegionOptions === 'function'
        ? window.SekarAdminSecurity.getCompletedRegionOptions(data.projects)
        : [{ value: 'tn', label: 'Tamil Nadu', badge: 'TN' }];
      if (typeof window.SekarAdminSecurity.getCompletedRegionDisplayOrder === 'function') {
        regionMeta = window.SekarAdminSecurity.getCompletedRegionDisplayOrder(regionMeta);
      }

      const byRegion = {};
      data.projects.forEach((row) => {
        const key = row.region || 'tn';
        if (!byRegion[key]) byRegion[key] = [];
        byRegion[key].push(row);
      });

      Object.keys(byRegion).forEach((key) => {
        byRegion[key].sort((a, b) => {
          const sa = parseInt(String(a.slNo).replace(/\D/g, ''), 10) || 0;
          const sb = parseInt(String(b.slNo).replace(/\D/g, ''), 10) || 0;
          return sa - sb;
        });
      });

      // Public filter: All + every Indian state/UT (presets), even if zero projects
      const completedFilterEl = document.getElementById('completedFilter');
      if (completedFilterEl) {
        const filterMeta = regionMeta.slice();
        Object.keys(byRegion).forEach((key) => {
          if (!filterMeta.some((r) => r.value === key)) {
            const sample = (byRegion[key] || [])[0];
            filterMeta.push({
              value: key,
              label: (sample && sample.regionLabel) || key,
              badge: key.toUpperCase()
            });
          }
        });
        const orderedAll = typeof window.SekarAdminSecurity.getCompletedRegionDisplayOrder === 'function'
          ? window.SekarAdminSecurity.getCompletedRegionDisplayOrder(filterMeta)
          : filterMeta;
        const prev = completedFilterEl.value || 'all';
        completedFilterEl.innerHTML = [
          '<option value="all">All Regions / States</option>',
          ...orderedAll.map((r) =>
            `<option value="${escapeInfraHtml(r.value)}">${escapeInfraHtml(r.label)}</option>`
          )
        ].join('');
        if ([...completedFilterEl.options].some((o) => o.value === prev)) {
          completedFilterEl.value = prev;
        }
      }

      const parts = [];
      const orderedKeys = regionMeta.map((r) => r.value);
      Object.keys(byRegion).forEach((key) => {
        if (!orderedKeys.includes(key)) orderedKeys.push(key);
      });

      orderedKeys.forEach((key) => {
        const rows = byRegion[key] || [];
        if (!rows.length) return;
        const meta = regionMeta.find((r) => r.value === key) || {
          label: rows[0].regionLabel || key,
          badge: key.toUpperCase()
        };
        parts.push(`
          <tr class="state-header-row" data-region="${escapeInfraHtml(key)}">
            <td colspan="3">${escapeInfraHtml(meta.label)} <span class="state-badge">${escapeInfraHtml(meta.badge || key.toUpperCase())}</span></td>
          </tr>
        `);
        rows.forEach((row) => {
          parts.push(`
            <tr data-region="${escapeInfraHtml(row.region)}">
              <td style="text-align: center; font-weight: 500; color: var(--text-muted);">${escapeInfraHtml(row.slNo)}</td>
              <td class="col-desc" style="font-weight: 600; color: var(--primary);">${escapeInfraHtml(row.name)}</td>
              <td class="col-cost" style="text-align: center; font-weight: 700; color: var(--secondary);">${formatCompletedCostLakhs(row.valueLakhs)}</td>
            </tr>
          `);
        });
      });

      completedProjectsTableBody.innerHTML = parts.join('');
    }

    return data;
  }

  if (completedTable && completedProjectsTableBody) {
    syncCompletedProjectsPageFromAdmin();

    const completedResultCount = document.getElementById('completedResultCount');
    const completedEmpty = document.getElementById('completedEmpty');
    const completedControls = document.getElementById('completedControls');
    const reduceMotionCompleted = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let completedProjectRows = Array.from(completedProjectsTableBody.querySelectorAll('tr:not(.state-header-row)'));
    let completedStateHeaders = Array.from(completedProjectsTableBody.querySelectorAll('.state-header-row'));

    if (!reduceMotionCompleted) {
      completedProjectsTableBody.classList.add('is-animated');
    }

    const filterCompletedTable = () => {
      if (!completedSearch || !completedFilter) return;
      completedProjectRows = Array.from(completedProjectsTableBody.querySelectorAll('tr:not(.state-header-row)'));
      completedStateHeaders = Array.from(completedProjectsTableBody.querySelectorAll('.state-header-row'));
      const query = completedSearch.value.toLowerCase().trim();
      const selectedRegion = completedFilter.value;
      let visible = 0;
      const regionHasMatch = {};

      if (completedControls) {
        completedControls.classList.remove('is-filtering');
        void completedControls.offsetWidth;
        completedControls.classList.add('is-filtering');
      }

      completedProjectRows.forEach((row) => {
        const description = (row.querySelector('.col-desc') || row.cells[1] || row)
          .textContent
          .toLowerCase();
        const region = row.getAttribute('data-region') || '';
        const matchesSearch = !query || description.includes(query);
        const matchesRegion = selectedRegion === 'all' || region === selectedRegion;
        const show = matchesSearch && matchesRegion;
        row.classList.toggle('hidden', !show);
        if (show) {
          visible += 1;
          regionHasMatch[region] = true;
        }
      });

      completedStateHeaders.forEach((header) => {
        const region = header.getAttribute('data-region') || '';
        const showHeader =
          !!regionHasMatch[region] &&
          (selectedRegion === 'all' || selectedRegion === region);
        header.classList.toggle('hidden', !showHeader);
      });

      if (completedResultCount) {
        completedResultCount.textContent = `${visible} project${visible === 1 ? '' : 's'}`;
      }
      if (completedEmpty) {
        completedEmpty.classList.toggle('is-visible', visible === 0);
      }
    };

    if (completedSearch) completedSearch.addEventListener('input', filterCompletedTable);
    if (completedFilter) completedFilter.addEventListener('change', filterCompletedTable);
    filterCompletedTable();

    const completedHighlightRoot = document.getElementById('completedHighlights');
    const completedHighlightValues = () =>
      document.querySelectorAll('#completedHighlights .infra-highlight-value[data-count]');

    const animateCompletedCounts = () => {
      completedHighlightValues().forEach((el) => {
        const target = parseInt(el.getAttribute('data-count'), 10);
        if (Number.isNaN(target)) return;
        if (reduceMotionCompleted) {
          el.textContent = String(target);
          return;
        }
        const start = performance.now();
        const duration = 1100;
        const tick = (now) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = String(Math.round(target * eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    };

    if (completedHighlightRoot) {
      const highlights = () => completedHighlightRoot.querySelectorAll('.infra-highlight');
      if ('IntersectionObserver' in window) {
        let counted = false;
        const ho = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            highlights().forEach((h) => h.classList.add('is-visible'));
            if (!counted) {
              counted = true;
              animateCompletedCounts();
            }
            ho.disconnect();
          });
        }, { threshold: 0.25 });
        ho.observe(completedHighlightRoot);
      } else {
        highlights().forEach((h) => h.classList.add('is-visible'));
        animateCompletedCounts();
      }
    }

    const completedHeroMedia = document.querySelector('.infra-hero-media');
    if (
      completedHeroMedia &&
      !reduceMotionCompleted &&
      !document.getElementById('infraTable') &&
      !document.getElementById('ongoingTable')
    ) {
      const onHeroScroll = () => {
        const y = window.scrollY;
        if (y > window.innerHeight * 1.25) return;
        completedHeroMedia.style.transform = `translateY(${Math.min(y, 420) * 0.18}px)`;
      };
      window.addEventListener('scroll', onHeroScroll, { passive: true });
    }

    if (completedPdfBtn) {
      const COMPLETED_PDF_LABEL = `
            <i class="fa-solid fa-file-arrow-down" aria-hidden="true"></i>
            Download as PDF
          `;

      const setCompletedPdfBusy = (busy) => {
        completedPdfBtn.disabled = busy;
        completedPdfBtn.classList.toggle('is-loading', busy);
        completedPdfBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
        completedPdfBtn.innerHTML = busy
          ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Preparing PDF…'
          : COMPLETED_PDF_LABEL;
      };

      const collectCompletedPdfRows = () => {
        const rows = Array.from(completedProjectsTableBody.querySelectorAll('tr:not(.state-header-row)'));
        const regionLabels = {};
        if (window.SekarAdminSecurity && typeof window.SekarAdminSecurity.getCompletedRegionOptions === 'function') {
          window.SekarAdminSecurity.getCompletedRegionOptions(
            (window.SekarAdminSecurity.getCompletedProjectsContent() || {}).projects || []
          ).forEach((r) => {
            regionLabels[r.value] = r.label;
          });
        }
        return rows.map((row, index) => {
          const cells = row.querySelectorAll('td');
          const sl = cells[0]?.textContent?.trim() || String(index + 1);
          const project = (row.querySelector('.col-desc') || cells[1])?.textContent?.trim() || '';
          const cost = (cells[2]?.textContent || '').replace(/\s+/g, ' ').trim();
          const regionKey = row.getAttribute('data-region') || '';
          const region = regionLabels[regionKey] || regionKey;
          return [sl, project, cost, region];
        });
      };

      const loadScriptOnce = (src) =>
        new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
          }
          const s = document.createElement('script');
          s.src = src;
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error(`Failed to load ${src}`));
          document.head.appendChild(s);
        });

      const ensurePdfLibraries = async () => {
        const hasJsPdf = !!(window.jspdf && window.jspdf.jsPDF);
        const hasAutoTable = !!(hasJsPdf && typeof window.jspdf.jsPDF.API.autoTable === 'function');
        if (hasJsPdf && hasAutoTable) return;
        if (!hasJsPdf) {
          await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }
        if (!(window.jspdf && window.jspdf.jsPDF && typeof window.jspdf.jsPDF.API.autoTable === 'function')) {
          await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js');
        }
        if (!(window.jspdf && window.jspdf.jsPDF)) {
          throw new Error('PDF library failed to load');
        }
      };

      const loadCompletedLogoDataUrl = () =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const size = Math.min(img.naturalWidth || 256, 256);
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, size, size);
              resolve(canvas.toDataURL('image/png'));
            } catch (_) {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = 'logo-final.png?v=6';
        });

      const generateCompletedPdf = async () => {
        await ensurePdfLibraries();
        const JsPDF = window.jspdf.jsPDF;
        const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const marginX = 14;
        let cursorY = 16;

        const logoData = await loadCompletedLogoDataUrl();
        if (logoData) {
          try {
            doc.addImage(logoData, 'PNG', marginX, 10, 16, 16);
          } catch (_) {
            /* text-only header fallback */
          }
        }

        const titleX = logoData ? marginX + 20 : marginX;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text('Sekar Constructions', titleX, cursorY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(162, 123, 60);
        doc.text('Class-I Civil Engineers & DAE Contractors', titleX, cursorY + 5);

        doc.setDrawColor(162, 123, 60);
        doc.setLineWidth(0.6);
        doc.line(marginX, 30, pageWidth - marginX, 30);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text('Completed Major Works', marginX, 38);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(
          'Audited directory of completed civil engineering contracts.',
          marginX,
          44
        );
        doc.text(
          `Generated ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}  ·  sekarconstructions.com`,
          marginX,
          49
        );

        const body = collectCompletedPdfRows();

        doc.autoTable({
          startY: 54,
          head: [['Sl. No.', 'Description of Works', 'Total Value (In Lakhs)', 'Region']],
          body,
          theme: 'grid',
          styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: 2,
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
            valign: 'middle'
          },
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8
          },
          alternateRowStyles: {
            fillColor: [250, 249, 246]
          },
          columnStyles: {
            0: { cellWidth: 16, halign: 'center' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 42, halign: 'center', fontStyle: 'bold' },
            3: { cellWidth: 32, halign: 'center' }
          },
          margin: { left: marginX, right: marginX },
          didDrawPage: (data) => {
            const pageCount = doc.internal.getNumberOfPages();
            const page = data.pageNumber;
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(
              `Page ${page} of ${pageCount}`,
              pageWidth - marginX,
              doc.internal.pageSize.getHeight() - 8,
              { align: 'right' }
            );
            doc.text('Sekar Constructions — Completed major works', marginX, doc.internal.pageSize.getHeight() - 8);
          }
        });

        doc.save('Sekar-Construction-Completed-Projects.pdf');
      };

      completedPdfBtn.addEventListener('click', async () => {
        if (completedPdfBtn.disabled) return;
        setCompletedPdfBusy(true);
        try {
          await generateCompletedPdf();
        } catch (err) {
          console.error('Completed projects PDF download failed:', err);
          window.alert('Sorry — the PDF could not be generated. Please refresh and try again.');
        } finally {
          setCompletedPdfBusy(false);
        }
      });
    }
  }

  // —— Project Gallery page (curtain hero + CMS grid + lightbox) ——
  const galleryGrid = document.getElementById('galleryGrid');
  const galleryFilters = document.getElementById('galleryFilters');
  const galleryResultCount = document.getElementById('galleryResultCount');
  const galleryEmpty = document.getElementById('galleryEmpty');
  const galleryModal = document.getElementById('case-study-modal');

  function readStaticGalleryCaseStudies(grid) {
    if (!grid) return [];
    return Array.from(grid.querySelectorAll('.gallery-card')).map((card) => {
      const images = parseCaseStudyCardImages(card);
      const cover = String(card.getAttribute('data-image') || images[0] || '').trim();
      const badgeEl = card.querySelector('.gallery-value-badge');
      return {
        id: String(card.getAttribute('data-id') || '').trim(),
        category: String(card.getAttribute('data-category') || '').trim(),
        categoryLabel: String(card.getAttribute('data-cat-label') || '').trim(),
        title: String(card.querySelector('.gallery-card-title')?.textContent || '').trim(),
        fullTitle: String(card.getAttribute('data-title') || '').trim(),
        client: String(card.getAttribute('data-client') || '').trim(),
        value: String(card.getAttribute('data-value') || '').trim(),
        valueBadge: String(badgeEl?.textContent || '').trim(),
        location: String(card.getAttribute('data-loc') || '').trim(),
        scope: String(card.getAttribute('data-scope') || '').trim(),
        image: cover,
        images: images.length ? images : (cover ? [cover] : []),
        shortDesc: String(card.querySelector('.gallery-card-desc')?.textContent || '').trim(),
        description: String(card.getAttribute('data-desc') || '').trim()
      };
    }).filter((item) => item.title || item.fullTitle);
  }

  function galleryCaseStudyMatchKeys(item) {
    const keys = [];
    const id = String(item.id || '').trim().toLowerCase();
    if (id) keys.push(`id:${id}`);
    const title = String(item.fullTitle || item.title || '').trim().toLowerCase();
    if (title) keys.push(`title:${title}`);
    const cover = String(
      (Array.isArray(item.images) && item.images[0]) || item.image || ''
    ).trim().toLowerCase();
    if (cover) keys.push(`cover:${cover}`);
    return keys;
  }

  function syncProjectGalleryPageFromAdmin() {
    if (!window.SekarAdminSecurity || typeof window.SekarAdminSecurity.getProjectGalleryContent !== 'function') {
      return null;
    }
    // Capture hardcoded markup before CMS replace — used to re-insert studies
    // missing from stale API / localStorage (e.g. gallery-isro-c25, gallery-igcar-hall-v).
    const staticItems = readStaticGalleryCaseStudies(galleryGrid);
    let data;
    try {
      data = window.SekarAdminSecurity.getProjectGalleryContent();
    } catch (err) {
      console.warn('Project gallery CMS sync failed; keeping markup cards.', err);
      return null;
    }
    if (!data || !Array.isArray(data.items) || !data.items.length) {
      const apiMode = typeof window.SekarAdminSecurity.useApi === 'function' && window.SekarAdminSecurity.useApi();
      // API empty + no static fallback: clear. Otherwise keep markup (Live Server).
      if (apiMode && galleryGrid && !staticItems.length) {
        galleryGrid.innerHTML = '';
        if (galleryEmpty) galleryEmpty.hidden = false;
        if (galleryResultCount) galleryResultCount.textContent = '0 studies';
      }
      return null;
    }

    const brandEl = document.getElementById('galleryHeroBrand');
    const titleEl = document.getElementById('galleryHeroTitle');
    const leadEl = document.getElementById('galleryHeroLead');
    const ctaEl = document.getElementById('galleryHeroCta');
    const heroImg = document.getElementById('galleryHeroImg');
    if (data.hero) {
      if (brandEl) brandEl.textContent = data.hero.brand || '';
      if (titleEl) titleEl.textContent = data.hero.title || '';
      if (leadEl) leadEl.textContent = data.hero.lead || '';
      if (ctaEl) {
        ctaEl.textContent = data.hero.ctaLabel || 'Browse Case Studies';
        if (data.hero.ctaHref) ctaEl.setAttribute('href', data.hero.ctaHref);
      }
      if (heroImg && data.hero.image) heroImg.src = data.hero.image;
    }

    // Drop retired Polyhose PEB-only split; keep one merged carousel.
    const retiredPolyhoseIds = new Set(['gallery-polyhose-peb']);
    const retiredPolyhoseTitleHints = [
      'construction of warehouse including peb works for polyhose'
    ];
    let displayItems = data.items.filter((item) => {
      const id = String(item.id || '').trim();
      if (retiredPolyhoseIds.has(id)) return false;
      const titleKey = String(item.fullTitle || item.title || '').trim().toLowerCase();
      return !retiredPolyhoseTitleHints.some((hint) => titleKey.includes(hint));
    });

    // Insert bundled markup case studies missing from stale CMS / localStorage / API.
    if (staticItems.length) {
      const cmsByKey = new Map();
      displayItems.forEach((item) => {
        galleryCaseStudyMatchKeys(item).forEach((key) => {
          if (key && !cmsByKey.has(key)) cmsByKey.set(key, item);
        });
      });
      const merged = [];
      const used = new Set();
      staticItems.forEach((staticItem) => {
        let fromCms = null;
        for (const key of galleryCaseStudyMatchKeys(staticItem)) {
          fromCms = cmsByKey.get(key);
          if (fromCms) break;
        }
        if (fromCms) {
          const cmsImgs = Array.isArray(fromCms.images)
            ? fromCms.images.filter(Boolean)
            : (fromCms.image ? [fromCms.image] : []);
          const staticImgs = Array.isArray(staticItem.images)
            ? staticItem.images.filter(Boolean)
            : (staticItem.image ? [staticItem.image] : []);
          // Prefer richer multi-image markup (+ refreshed title/meta) when CMS
          // still has a stale single cover (Kochar / Nemmeli pattern).
          if (staticImgs.length > cmsImgs.length) {
            merged.push(Object.assign({}, fromCms, {
              images: staticImgs.slice(),
              image: staticImgs[0] || fromCms.image,
              title: staticItem.title || fromCms.title,
              fullTitle: staticItem.fullTitle || fromCms.fullTitle,
              shortDesc: staticItem.shortDesc || fromCms.shortDesc,
              description: staticItem.description || fromCms.description,
              scope: staticItem.scope || fromCms.scope,
              location: staticItem.location || fromCms.location,
              client: staticItem.client || fromCms.client,
              categoryLabel: staticItem.categoryLabel || fromCms.categoryLabel,
              value: staticItem.value || fromCms.value,
              valueBadge: staticItem.valueBadge || fromCms.valueBadge,
              id: fromCms.id || staticItem.id
            }));
          } else {
            merged.push(fromCms);
          }
          used.add(fromCms);
        } else {
          merged.push(staticItem);
        }
      });
      displayItems.forEach((item) => {
        if (!used.has(item)) merged.push(item);
      });
      displayItems = merged;
    }

    const hlRoot = document.getElementById('galleryHighlights');
    if (hlRoot && Array.isArray(data.highlights)) {
      hlRoot.innerHTML = data.highlights.map((h) => {
        let raw = String(h.value || '').trim();
        const key = String(h.key || '').trim().toLowerCase();
        // Keep case-study count aligned when markup inserts missing studies.
        if (key === 'studies' && /^\d+$/.test(raw) && displayItems.length > Number(raw)) {
          raw = String(displayItems.length);
        }
        const numeric = /^\d+$/.test(raw);
        const countAttr = numeric ? ` data-count="${escapeInfraHtml(raw)}"` : '';
        return `
        <div class="infra-highlight">
          <span class="infra-highlight-label">${escapeInfraHtml(h.label)}</span>
          <span class="infra-highlight-value"${countAttr}>${escapeInfraHtml(raw)}</span>
          <p class="infra-highlight-note">${escapeInfraHtml(h.note)}</p>
        </div>
      `;
      }).join('');
    }

    if (galleryGrid) {
      // Prefer richer multi-image lists from static markup when CMS/API still
      // has a stale single cover (e.g. Kochar before Save & Publish / re-seed).
      // Match by full title first, then by cover filename (survives title renames).
      const staticMultiImages = {};
      const staticByCover = {};
      staticItems.forEach((item) => {
        const titleKey = String(item.fullTitle || item.title || '').trim().toLowerCase();
        const coverKey = String(item.image || '').trim().toLowerCase();
        const imgs = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
        if (titleKey && imgs.length > 1) {
          staticMultiImages[titleKey] = imgs;
        }
        if (coverKey && imgs.length > 1) {
          staticByCover[coverKey] = imgs;
        }
      });

      galleryGrid.innerHTML = displayItems.map((item) => {
        let images = Array.isArray(item.images) && item.images.length
          ? item.images.filter(Boolean)
          : (item.image ? [item.image] : []);
        const titleKey = String(item.fullTitle || item.title || '').trim().toLowerCase();
        const coverKey = String(images[0] || item.image || '').trim().toLowerCase();
        const staticImgs = staticMultiImages[titleKey] || staticByCover[coverKey];
        if (staticImgs && staticImgs.length > images.length) {
          images = staticImgs.slice();
        }
        const cover = images[0] || item.image || '';
        const itemId = String(item.id || '').trim();
        return `
        <article class="gallery-card"${itemId ? ` data-id="${escapeInfraHtml(itemId)}"` : ''}
          data-category="${escapeInfraHtml(item.category)}"
          data-title="${escapeInfraHtml(item.fullTitle || item.title)}"
          data-client="${escapeInfraHtml(item.client)}"
          data-value="${escapeInfraHtml(item.value)}"
          data-loc="${escapeInfraHtml(item.location)}"
          data-scope="${escapeInfraHtml(item.scope)}"
          data-image="${escapeInfraHtml(cover)}"
          data-images="${escapeInfraHtml(JSON.stringify(images))}"
          data-desc="${escapeInfraHtml(item.description)}"
          data-cat-label="${escapeInfraHtml(item.categoryLabel || item.categoryFilterLabel || item.category)}">
          <div class="gallery-img-wrapper">
            <img src="${escapeInfraHtml(cover)}" alt="${escapeInfraHtml(item.title)}" loading="lazy">
            ${item.valueBadge ? `<div class="gallery-value-badge">${escapeInfraHtml(item.valueBadge)}</div>` : ''}
            <div class="gallery-overlay"></div>
            <div class="gallery-zoom-prompt"><i class="fa-solid fa-expand" aria-hidden="true"></i> View details</div>
          </div>
          <div class="gallery-card-content">
            <div>
              <span class="gallery-card-cat">${escapeInfraHtml(item.categoryLabel || item.categoryFilterLabel || '')}</span>
              <h3 class="gallery-card-title">${escapeInfraHtml(item.title)}</h3>
              <p class="gallery-card-desc">${escapeInfraHtml(item.shortDesc)}</p>
            </div>
            <div class="gallery-card-meta">
              <span>Client<strong>${escapeInfraHtml(item.client)}</strong></span>
              <span>Scope<strong>${escapeInfraHtml(item.scope)}</strong></span>
            </div>
          </div>
        </article>
      `;
      }).join('');
    }

    if (galleryFilters) {
      let cats = typeof window.SekarAdminSecurity.getProjectGalleryCategoryOptions === 'function'
        ? window.SekarAdminSecurity.getProjectGalleryCategoryOptions(displayItems)
        : [
            { value: 'infrastructure', label: 'Infrastructure' },
            { value: 'industrial', label: 'Industrial' },
            { value: 'commercial', label: 'Commercial' }
          ];
      const present = new Set(displayItems.map((i) => i.category));
      cats = cats.filter((c) => present.has(c.value));
      const prev = galleryFilters.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all';
      galleryFilters.innerHTML = [
        '<button type="button" class="filter-btn" data-filter="all">All Gallery</button>',
        ...cats.map((c) =>
          `<button type="button" class="filter-btn" data-filter="${escapeInfraHtml(c.value)}">${escapeInfraHtml(c.label)}</button>`
        )
      ].join('');
      const activeBtn =
        galleryFilters.querySelector(`[data-filter="${prev}"]`) ||
        galleryFilters.querySelector('[data-filter="all"]');
      if (activeBtn) activeBtn.classList.add('active');
    }

    return data;
  }

  if (galleryGrid) {
    syncProjectGalleryPageFromAdmin();

    const reduceMotionGallery = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotionGallery) {
      galleryGrid.classList.add('is-animated');
    }

    const filterGalleryCards = () => {
      const activeFilter =
        galleryFilters?.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all';
      const cards = Array.from(galleryGrid.querySelectorAll('.gallery-card'));
      let visible = 0;
      cards.forEach((card) => {
        const cat = card.getAttribute('data-category') || '';
        const show = activeFilter === 'all' || cat === activeFilter;
        card.classList.toggle('hidden', !show);
        if (show) visible += 1;
      });
      if (galleryResultCount) {
        galleryResultCount.textContent = `${visible} stud${visible === 1 ? 'y' : 'ies'}`;
      }
      if (galleryEmpty) {
        galleryEmpty.classList.toggle('is-visible', visible === 0);
      }
    };

    if (galleryFilters) {
      galleryFilters.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-btn');
        if (!btn || !galleryFilters.contains(btn)) return;
        galleryFilters.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        filterGalleryCards();
      });
    }
    filterGalleryCards();

    const galleryHighlightRoot = document.getElementById('galleryHighlights');
    const galleryHighlightValues = () =>
      document.querySelectorAll('#galleryHighlights .infra-highlight-value[data-count]');

    const animateGalleryCounts = () => {
      galleryHighlightValues().forEach((el) => {
        const target = parseInt(el.getAttribute('data-count'), 10);
        if (Number.isNaN(target)) return;
        if (reduceMotionGallery) {
          el.textContent = String(target);
          return;
        }
        const start = performance.now();
        const duration = 1100;
        const tick = (now) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = String(Math.round(target * eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    };

    if (galleryHighlightRoot) {
      const highlights = () => galleryHighlightRoot.querySelectorAll('.infra-highlight');
      if ('IntersectionObserver' in window) {
        let counted = false;
        const ho = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            highlights().forEach((h) => h.classList.add('is-visible'));
            if (!counted) {
              counted = true;
              animateGalleryCounts();
            }
            ho.disconnect();
          });
        }, { threshold: 0.25 });
        ho.observe(galleryHighlightRoot);
      } else {
        highlights().forEach((h) => h.classList.add('is-visible'));
        animateGalleryCounts();
      }
    }

    const galleryHeroMedia = document.querySelector('.infra-hero-media');
    if (
      galleryHeroMedia &&
      !reduceMotionGallery &&
      !document.getElementById('infraTable') &&
      !document.getElementById('ongoingTable') &&
      !document.getElementById('completedTable')
    ) {
      const onHeroScroll = () => {
        const y = window.scrollY;
        if (y > window.innerHeight * 1.25) return;
        galleryHeroMedia.style.transform = `translateY(${Math.min(y, 420) * 0.18}px)`;
      };
      window.addEventListener('scroll', onHeroScroll, { passive: true });
    }

    const openGalleryModal = (card) => {
      if (!galleryModal || !card) return;
      const modalTitle = document.getElementById('modalProjectTitle');
      const modalDesc = document.getElementById('modalProjectDesc');
      const modalClient = document.getElementById('modalProjectClient');
      const modalValue = document.getElementById('modalProjectValue');
      const modalLoc = document.getElementById('modalProjectLoc');
      const modalScope = document.getElementById('modalProjectScope');
      const modalCat = document.getElementById('modalProjectCat');
      const title = card.getAttribute('data-title') || '';

      renderCaseStudyModalGallery(parseCaseStudyCardImages(card), title);
      if (modalTitle) modalTitle.textContent = title;
      if (modalDesc) modalDesc.textContent = card.getAttribute('data-desc') || '';
      if (modalClient) modalClient.textContent = card.getAttribute('data-client') || '';
      if (modalValue) modalValue.textContent = card.getAttribute('data-value') || '';
      if (modalLoc) modalLoc.textContent = card.getAttribute('data-loc') || '';
      if (modalScope) modalScope.textContent = card.getAttribute('data-scope') || '';
      if (modalCat) {
        modalCat.textContent = (
          card.getAttribute('data-cat-label') ||
          card.getAttribute('data-category') ||
          ''
        ).toUpperCase();
      }

      galleryModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    };

    const closeGalleryModal = () => {
      if (!galleryModal) return;
      galleryModal.classList.remove('open');
      document.body.style.overflow = '';
    };

    galleryGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.gallery-card');
      if (!card || card.classList.contains('hidden')) return;
      openGalleryModal(card);
    });

    const modalCloseBtn = document.getElementById('modalCloseBtn');
    if (modalCloseBtn && !projectCards.length) {
      modalCloseBtn.addEventListener('click', closeGalleryModal);
    }
    if (galleryModal && !projectCards.length) {
      galleryModal.addEventListener('click', (e) => {
        if (e.target === galleryModal) closeGalleryModal();
      });
      document.addEventListener('keydown', (e) => {
        if (!galleryModal.classList.contains('open')) return;
        if (e.key === 'Escape') {
          closeGalleryModal();
        } else if (e.key === 'ArrowLeft') {
          stepCaseStudyModalGallery(-1);
        } else if (e.key === 'ArrowRight') {
          stepCaseStudyModalGallery(1);
        }
      });
    }
  }

  // Certificate Carousel Initialization (re-callable after CMS rebuild)
  let certificateCarouselCleanup = null;

  function initCertificateCarousel() {
    if (typeof certificateCarouselCleanup === 'function') {
      try { certificateCarouselCleanup(); } catch (e) { /* ignore */ }
      certificateCarouselCleanup = null;
    }

    const track = document.getElementById('certCarouselTrack');
    if (!track) return;

    const slides = Array.from(track.querySelectorAll('.cert-slide'));
    const prevBtn = document.getElementById('certPrevBtn');
    const nextBtn = document.getElementById('certNextBtn');
    const dotsContainer = document.getElementById('certCarouselDots');
    if (!slides.length) {
      if (dotsContainer) dotsContainer.innerHTML = '';
      return;
    }

    let currentIndex = 0;
    let autoplayTimer = null;

    if (dotsContainer) {
      dotsContainer.innerHTML = slides.map((_, i) =>
        `<button class="cert-dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Go to slide ${i + 1}"></button>`
      ).join('');
    }

    const dots = dotsContainer ? Array.from(dotsContainer.querySelectorAll('.cert-dot')) : [];

    function goToSlide(index) {
      if (index < 0) index = slides.length - 1;
      if (index >= slides.length) index = 0;
      currentIndex = index;
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
      slides.forEach((slide, i) => slide.classList.toggle('active', i === currentIndex));
      dots.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
    }

    const onPrev = () => { goToSlide(currentIndex - 1); resetAutoplay(); };
    const onNext = () => { goToSlide(currentIndex + 1); resetAutoplay(); };
    if (prevBtn) prevBtn.addEventListener('click', onPrev);
    if (nextBtn) nextBtn.addEventListener('click', onNext);

    const onDotClick = (e) => {
      const targetIndex = parseInt(e.currentTarget.getAttribute('data-index'), 10);
      if (!isNaN(targetIndex)) { goToSlide(targetIndex); resetAutoplay(); }
    };
    dots.forEach((dot) => dot.addEventListener('click', onDotClick));

    let startX = 0;
    let isSwiping = false;
    const onTouchStart = (e) => { startX = e.touches[0].clientX; isSwiping = true; };
    const onTouchEnd = (e) => {
      if (!isSwiping) return;
      const diffX = startX - e.changedTouches[0].clientX;
      if (Math.abs(diffX) > 40) {
        if (diffX > 0) goToSlide(currentIndex + 1);
        else goToSlide(currentIndex - 1);
        resetAutoplay();
      }
      isSwiping = false;
    };
    track.addEventListener('touchstart', onTouchStart, { passive: true });
    track.addEventListener('touchend', onTouchEnd, { passive: true });

    // Lightbox modal trigger for certificate image inspection
    const modal = document.getElementById('certLightboxModal');
    const modalImg = document.getElementById('certLightboxImg');
    const modalTitle = document.getElementById('certLightboxTitle');
    const modalAuthor = document.getElementById('certLightboxAuthor');
    const modalDetails = document.getElementById('certLightboxDetails');
    const modalBadge = document.getElementById('certLightboxBadge');
    const modalDownload = document.getElementById('certLightboxDownloadBtn');
    const modalClose = document.getElementById('certLightboxClose');
    const modalBackdrop = document.getElementById('certLightboxBackdrop');

    function openCertLightbox(slide) {
      if (!modal || !modalImg) return;
      const img = slide.querySelector('.cert-slide-media img');
      const title = slide.querySelector('.cert-slide-title');
      const author = slide.querySelector('.cert-slide-author');
      const badge = slide.querySelector('.cert-slide-badge');
      const desc = slide.querySelector('.cert-slide-desc') || slide.querySelector('.cert-slide-quote');
      
      if (img) {
        modalImg.src = img.src;
        modalImg.alt = img.alt || 'Official Government Certificate';
        if (modalDownload) modalDownload.href = img.src;
      }
      if (title && modalTitle) modalTitle.textContent = title.textContent;
      if (author && modalAuthor) modalAuthor.innerHTML = author.innerHTML;
      if (badge && modalBadge) modalBadge.innerHTML = badge.innerHTML;
      if (desc && modalDetails) modalDetails.innerHTML = desc.innerHTML;

      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
    }

    function closeCertLightbox() {
      if (!modal) return;
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
    }

    slides.forEach((slide) => {
      const media = slide.querySelector('.cert-slide-media');
      if (media) {
        media.style.cursor = 'zoom-in';
        media.addEventListener('click', () => openCertLightbox(slide));
      }
    });

    if (modalClose) modalClose.addEventListener('click', closeCertLightbox);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeCertLightbox);

    function startAutoplay() {
      autoplayTimer = setInterval(() => goToSlide(currentIndex + 1), 6000);
    }
    function resetAutoplay() {
      if (autoplayTimer) clearInterval(autoplayTimer);
      startAutoplay();
    }
    startAutoplay();

    certificateCarouselCleanup = () => {
      if (autoplayTimer) clearInterval(autoplayTimer);
      if (prevBtn) prevBtn.removeEventListener('click', onPrev);
      if (nextBtn) nextBtn.removeEventListener('click', onNext);
      dots.forEach((dot) => dot.removeEventListener('click', onDotClick));
      track.removeEventListener('touchstart', onTouchStart);
      track.removeEventListener('touchend', onTouchEnd);
    };
  }

  function escapeGalleryMediaHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeRichGalleryHtml(html) {
    return escapeGalleryMediaHtml(html)
      .replace(/&lt;(\/?)(strong|em|b|i|br\s*\/?)&gt;/gi, '<$1$2>');
  }

  function buildGalleryMediaCardHtml(item) {
    const locIcon = String(item.locationIcon || 'fa-location-dot').replace(/^fa-solid\s+/, '');
    const badge = item.badge
      ? `<div class="gallery-card-overlay"><span class="gallery-card-badge">${escapeGalleryMediaHtml(item.badge)}</span></div>`
      : '';
    const location = item.location
      ? `<p class="gallery-card-location"><i class="fa-solid ${escapeGalleryMediaHtml(locIcon)}"></i> ${escapeGalleryMediaHtml(item.location)}</p>`
      : '';
    return `
      <div class="gallery-card">
        <div class="gallery-card-media">
          <img src="${escapeGalleryMediaHtml(item.url)}" alt="${escapeGalleryMediaHtml(item.title || '')}" loading="lazy">
          ${badge}
        </div>
        <div class="gallery-card-body">
          <h3 class="gallery-card-title">${escapeGalleryMediaHtml(item.title || '')}</h3>
          ${location}
          <p class="gallery-card-desc">${escapeGalleryMediaHtml(item.description || '')}</p>
        </div>
      </div>`;
  }

  function buildCertificateSlideHtml(item, index) {
    const badgeIcon = String(item.badgeIcon || 'fa-certificate').replace(/^fa-solid\s+/, '');
    const metaHtml = (Array.isArray(item.meta) ? item.meta : [])
      .filter((m) => m && m.text)
      .map((m) => {
        const icon = String(m.icon || 'fa-circle-check').replace(/^fa-solid\s+/, '');
        return `<span><i class="fa-solid ${escapeGalleryMediaHtml(icon)}"></i> ${escapeGalleryMediaHtml(m.text)}</span>`;
      })
      .join('');
    const body = item.quote
      ? `<blockquote class="cert-slide-quote">${sanitizeRichGalleryHtml(item.quote)}</blockquote>`
      : `<p class="cert-slide-desc">${sanitizeRichGalleryHtml(item.description || '')}</p>`;
    return `
      <div class="cert-slide${index === 0 ? ' active' : ''}">
        <div class="cert-slide-inner">
          <div class="cert-slide-media">
            <img src="${escapeGalleryMediaHtml(item.url)}" alt="${escapeGalleryMediaHtml(item.title || '')}" loading="lazy">
          </div>
          <div class="cert-slide-content">
            <span class="cert-slide-badge"><i class="fa-solid ${escapeGalleryMediaHtml(badgeIcon)}"></i> ${escapeGalleryMediaHtml(item.badge || '')}</span>
            <h3 class="cert-slide-title">${escapeGalleryMediaHtml(item.title || '')}</h3>
            <p class="cert-slide-author">${sanitizeRichGalleryHtml(item.author || '')}</p>
            ${body}
            ${metaHtml ? `<div class="cert-slide-meta">${metaHtml}</div>` : ''}
          </div>
        </div>
      </div>`;
  }

  function syncPlantMachineryPageFromAdmin() {
    const grid = document.getElementById('plantMachineryGrid');
    if (!grid || !window.SekarAdminSecurity || typeof window.SekarAdminSecurity.getGalleryMediaContent !== 'function') return;
    let items = [];
    try {
      items = window.SekarAdminSecurity.getGalleryMediaContent('plant_machinery') || [];
    } catch (err) {
      console.warn('Plant machinery CMS sync failed; keeping static markup.', err);
      return;
    }
    if (!Array.isArray(items) || !items.length) return;
    grid.innerHTML = items.map(buildGalleryMediaCardHtml).join('');
  }

  function syncFounderClientsPageFromAdmin() {
    const grid = document.getElementById('founderClientsGrid');
    const hasApi = window.SekarAdminSecurity && typeof window.SekarAdminSecurity.getGalleryMediaContent === 'function';
    if (!hasApi || !grid) return;

    let items = [];
    try {
      items = window.SekarAdminSecurity.getGalleryMediaContent('founder_clients') || [];
    } catch (err) {
      console.warn('Founder clients CMS sync failed; keeping static markup.', err);
      return;
    }
    if (Array.isArray(items) && items.length) {
      grid.innerHTML = items.map(buildGalleryMediaCardHtml).join('');
    }
    // Clients marquee uses static HTML strips on gallery-founder-clients.html (not CMS-managed).
  }

  function syncCertificatesPageFromAdmin() {
    const track = document.getElementById('certCarouselTrack');
    if (!track || !window.SekarAdminSecurity || typeof window.SekarAdminSecurity.getGalleryMediaContent !== 'function') return;
    let items = [];
    try {
      items = window.SekarAdminSecurity.getGalleryMediaContent('certificates') || [];
    } catch (err) {
      console.warn('Certificates CMS sync failed; keeping static markup.', err);
      return;
    }
    if (!Array.isArray(items) || !items.length) return;
    track.innerHTML = items.map((item, i) => buildCertificateSlideHtml(item, i)).join('');
    initCertificateCarousel();
  }

  syncPlantMachineryPageFromAdmin();
  syncFounderClientsPageFromAdmin();
  syncCertificatesPageFromAdmin();
  initCertificateCarousel();
});

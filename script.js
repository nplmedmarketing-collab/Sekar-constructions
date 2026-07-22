// Sekar Construction Website JavaScript Logic
// Handles navigation scroll effects, scroll observers for fade-ins, animated count-ups, parallax zoom, and portfolio case study modals.

document.addEventListener('DOMContentLoaded', () => {
  // 1. Sticky Header scroll effect
  const header = document.querySelector('header');
  const scrollTopBtn = document.querySelector('.scroll-top');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Scroll to Top button visibility
    if (window.scrollY > 300) {
      scrollTopBtn.classList.add('show');
    } else {
      scrollTopBtn.classList.remove('show');
    }
  });

  // 2. Scroll to Top Click
  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  // 3. Cinematic Hero Parallax Zoom Scroll
  const heroVideo = document.querySelector('.hero-video');
  window.addEventListener('scroll', () => {
    if (heroVideo) {
      const scrollPos = window.scrollY;
      // Scale slightly and translate slower than the scroll rate (parallax)
      heroVideo.style.transform = `scale(${1.05 + scrollPos * 0.0003}) translateY(${scrollPos * 0.15}px)`;
    }
  });

  // 4. Hamburger Menu Toggle
  const menuToggle = document.getElementById('menuToggleBtn');
  const navMenu = document.getElementById('navMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', isOpen);
    });

    // Handle nav links clicks and dropdown toggles
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        if (link.classList.contains('dropdown-toggle')) {
          e.preventDefault();
          e.stopPropagation();
          const dropdownMenu = link.nextElementSibling;
          if (dropdownMenu) {
            const isHidden = dropdownMenu.style.display === 'none' || dropdownMenu.style.display === '';
            dropdownMenu.style.display = isHidden ? 'block' : 'none';
            dropdownMenu.classList.toggle('show');
          }
          return;
        }
        navMenu.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      const dropdowns = document.querySelectorAll('.dropdown-menu');
      dropdowns.forEach(menu => {
        const toggle = menu.previousElementSibling;
        if (toggle && !toggle.contains(e.target) && !menu.contains(e.target)) {
          menu.style.display = 'none';
          menu.classList.remove('show');
        }
      });
    });
  }

  // Hover Intent Delay for Desktop Dropdown
  const dropdownLi = document.querySelector('.nav-menu li.dropdown');
  if (dropdownLi) {
    const menu = dropdownLi.querySelector('.dropdown-menu');
    let timeoutId = null;

    dropdownLi.addEventListener('mouseenter', () => {
      if (window.innerWidth > 1024) {
        clearTimeout(timeoutId);
        menu.style.display = 'block';
        setTimeout(() => {
          menu.classList.add('show');
        }, 10);
      }
    });

    dropdownLi.addEventListener('mouseleave', () => {
      if (window.innerWidth > 1024) {
        timeoutId = setTimeout(() => {
          menu.classList.remove('show');
          setTimeout(() => {
            if (!menu.classList.contains('show')) {
              menu.style.display = 'none';
            }
          }, 300);
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
          menu.classList.remove('show');
          setTimeout(() => {
            if (!menu.classList.contains('show')) {
              menu.style.display = 'none';
            }
          }, 300);
        }, 200);
      }
    });
  }
  // 5. Custom Homepage Scroll Active Link (ScrollSpy for Services only)
  const isHomepage = document.querySelector('.hero') !== null;
  
  if (isHomepage) {
    const servicesSection = document.getElementById('services');
    
    if (servicesSection) {
      window.addEventListener('scroll', () => {
        const scrollPos = window.scrollY + 120; // Offset for sticky nav
        const sectionTop = servicesSection.offsetTop;
        const sectionHeight = servicesSection.offsetHeight;
        
        let currentLink = 'home'; // Default to Home
        
        // If we are currently scrolling inside the services section, switch highlight to Services
        if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
          currentLink = 'services';
        }
        
        // Update navigation underlines
        navLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href && href.startsWith('#')) {
            link.classList.remove('active');
            if (currentLink === 'services' && href === '#services') {
              link.classList.add('active');
            } else if (currentLink === 'home' && href === '#home') {
              link.classList.add('active');
            }
          }
        });
      });
    }
  }

  // 6. Scroll Fade-in Observer (Subtle Scroll Animations)
  const fadeSections = document.querySelectorAll('.fade-in-section');
  
  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      threshold: 0.15,
      rootMargin: '0px 0px -50px 0px'
    });

    fadeSections.forEach(section => {
      sectionObserver.observe(section);
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

  if (modal && projectCards.length > 0) {
    projectCards.forEach(card => {
      card.addEventListener('click', () => {
        // Retrieve card dataset elements
        const title = card.getAttribute('data-title');
        const client = card.getAttribute('data-client');
        const value = card.getAttribute('data-value');
        const loc = card.getAttribute('data-loc');
        const scope = card.getAttribute('data-scope');
        const img = card.getAttribute('data-image');
        const desc = card.getAttribute('data-desc');
        const categoryText = card.querySelector('.project-cat').textContent;

        // Populate Modal Fields
        modalImg.src = img;
        modalImg.alt = title;
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

    // Close Modal on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) {
        closeModalHandler();
      }
    });
  }

  function closeModalHandler() {
    modal.classList.remove('open');
    document.body.style.overflow = ''; // Restore page scroll
  }

  // 10. Contact Form Submission
  const contactForm = document.getElementById('contactForm');
  const formStatus = document.getElementById('formStatus');

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

      // Submitting state indicators
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      setTimeout(() => {
        contactForm.reset();
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        showStatus('Your message has been sent successfully. We will get back to you shortly.', 'success');
      }, 1500);
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
});

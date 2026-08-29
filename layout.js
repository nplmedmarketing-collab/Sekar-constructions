/**
 * Shared site header & footer injection for Sekar Constructions public pages.
 * Place empty #site-header / #site-footer mounts in HTML; this fills them on load.
 */
(function () {
  var pathname = (window.location.pathname || '').replace(/\\/g, '/');
  var parts = pathname.split('/').filter(function (segment) {
    return segment.length > 0;
  });
  var lastPart = parts.length ? parts[parts.length - 1] : '';

  var path;
  if (!lastPart) {
    path = 'index.html';
  } else if (lastPart === 'index.html' && parts.length >= 2) {
    path = parts[parts.length - 2] + '.html';
  } else if (lastPart.indexOf('.html') !== -1) {
    path = lastPart;
  } else if (lastPart.indexOf('.') === -1) {
    path = lastPart + '.html';
  } else {
    path = lastPart;
  }

  var inContactFolder = parts.indexOf('contact') !== -1 && path === 'contact.html';
  var baseDir = inContactFolder ? '../' : '';
  var isHome = path === 'index.html' && parts.length <= 1;

  var jobsSiteUrl = String(
    (window.SekarConfig && window.SekarConfig.jobsSiteUrl) || 'https://jobs.sekarconstructions.com'
  ).replace(/\/$/, '');
  var host = (typeof window !== 'undefined' && window.location.hostname
    ? String(window.location.hostname)
    : ''
  ).toLowerCase();
  var onJobsHost = host === 'jobs.sekarconstructions.com';
  // jobs.sekarconstructions.com has no DNS yet. Keep same-origin careers.html on
  // GitHub Pages / local / production until SekarConfig.useJobsSite is opted in.
  var useJobsSite =
    !onJobsHost &&
    !!(window.SekarConfig && window.SekarConfig.useJobsSite === true) &&
    !/\.github\.io$/i.test(host) &&
    host !== 'localhost' &&
    host !== '127.0.0.1' &&
    (typeof window === 'undefined' || window.location.protocol !== 'file:');

  function careersHref() {
    if (useJobsSite) return jobsSiteUrl + '/careers.html';
    return baseDir + 'careers.html';
  }

  function isCareersHref(href) {
    var n = normalizeHref(href);
    return n === 'careers.html' || /\/careers\.html$/i.test(String(href || ''));
  }

  var galleryPages = [
    'gallery.html',
    'gallery-plant-machinery.html',
    'gallery-founder-clients.html',
    'gallery-certificates.html'
  ];
  var isGallery = galleryPages.indexOf(path) !== -1;
  var isPortfolio = path === 'portfolio.html' || path === 'ongoing-projects.html';

  function normalizeHref(href) {
    if (!href || href === '#') return '';
    var normalized = href.split('#')[0].split('?')[0];
    normalized = normalized.replace(/^(\.\.\/)+/, '');
    if (normalized.charAt(0) === '/') {
      normalized = normalized.replace(/^\/+/, '');
    }
    return normalized;
  }

  function isActive(page) {
    if (page === 'home') return isHome;
    return path === page;
  }

  function navClass(page) {
    return 'nav-link' + (isActive(page) ? ' active' : '');
  }

  function itemActive(page) {
    return path === page ? ' active' : '';
  }

  function homeHref(hash) {
    return isHome ? hash : baseDir + 'index.html' + hash;
  }

  function applyActiveNav(headerMount) {
    var allLinks = headerMount.querySelectorAll('.nav-link, .dropdown-menu a');
    for (var i = 0; i < allLinks.length; i++) {
      allLinks[i].classList.remove('active');
    }

    var navLinks = headerMount.querySelectorAll('.nav-link');
    for (var j = 0; j < navLinks.length; j++) {
      var link = navLinks[j];
      var href = link.getAttribute('href') || '';

      if (link.classList.contains('dropdown-toggle')) {
        if (isPortfolio && link.id === 'portfolioDropdownBtn') {
          link.classList.add('active');
        } else if (isGallery && link.id === 'galleryDropdownBtn') {
          link.classList.add('active');
        }
        continue;
      }

      if (isHome) {
        if (href === '#home' || href === 'index.html#home' || href.indexOf('#home') !== -1) {
          link.classList.add('active');
        }
        continue;
      }

      if (normalizeHref(href) === path) {
        link.classList.add('active');
      } else if (path === 'careers.html' && href.indexOf('jobs.sekarconstructions.com') !== -1) {
        link.classList.add('active');
      }
    }

    var menuItems = headerMount.querySelectorAll('.dropdown-menu a');
    for (var k = 0; k < menuItems.length; k++) {
      if (normalizeHref(menuItems[k].getAttribute('href') || '') === path) {
        menuItems[k].classList.add('active');
      }
    }
  }

  function renderHeader() {
    var logoHref = isHome ? '#' : baseDir + 'index.html';
    return (
      '<header>' +
        '<div class="container nav-container">' +
          '<a href="' + logoHref + '" class="logo">' +
            '<img src="' + baseDir + 'logo-final.png?v=6" alt="Sekar Constructions Logo">' +
          '</a>' +
          '<button class="menu-toggle" id="menuToggleBtn" aria-label="Toggle Menu" aria-expanded="false">' +
            '<span></span><span></span><span></span>' +
          '</button>' +
          '<ul class="nav-menu" id="navMenu">' +
            '<li><a href="' + homeHref('#home') + '" class="' + navClass('home') + '">Home</a></li>' +
            '<li><a href="' + homeHref('#services') + '" class="nav-link">Services</a></li>' +
            '<li><a href="' + baseDir + 'about.html" class="' + navClass('about.html') + '">About Us</a></li>' +
            '<li><a href="' + baseDir + 'infrastructure.html" class="' + navClass('infrastructure.html') + '">Infrastructure</a></li>' +
            '<li class="dropdown">' +
              '<a href="#" class="nav-link dropdown-toggle' + (isPortfolio ? ' active' : '') + '" aria-haspopup="true" aria-expanded="false" id="portfolioDropdownBtn">' +
                'Portfolio <i class="fa-solid fa-chevron-down dropdown-chevron" aria-hidden="true"></i>' +
              '</a>' +
              '<ul class="dropdown-menu" id="portfolioDropdownMenu" role="menu" aria-label="Portfolio">' +
                '<li role="none"><a role="menuitem" href="' + baseDir + 'ongoing-projects.html"' + itemActive('ongoing-projects.html') + '>Ongoing Projects</a></li>' +
                '<li role="none"><a role="menuitem" href="' + baseDir + 'portfolio.html"' + itemActive('portfolio.html') + '>Completed Projects</a></li>' +
              '</ul>' +
            '</li>' +
            '<li class="dropdown">' +
              '<a href="#" class="nav-link dropdown-toggle' + (isGallery ? ' active' : '') + '" aria-haspopup="true" aria-expanded="false" id="galleryDropdownBtn">' +
                'Gallery <i class="fa-solid fa-chevron-down dropdown-chevron" aria-hidden="true"></i>' +
              '</a>' +
              '<ul class="dropdown-menu dropdown-menu--gallery" id="galleryDropdownMenu" role="menu" aria-label="Gallery">' +
                '<li role="none"><a role="menuitem" href="' + baseDir + 'gallery.html"' + itemActive('gallery.html') + '>Projects</a></li>' +
                '<li role="none"><a role="menuitem" href="' + baseDir + 'gallery-plant-machinery.html"' + itemActive('gallery-plant-machinery.html') + '>Plant &amp; Machinery</a></li>' +
                '<li role="none"><a role="menuitem" href="' + baseDir + 'gallery-founder-clients.html"' + itemActive('gallery-founder-clients.html') + '>Founder &amp; Clients</a></li>' +
                '<li role="none"><a role="menuitem" href="' + baseDir + 'gallery-certificates.html" aria-label="Certificates &amp; Accreditations"' + itemActive('gallery-certificates.html') + '>' +
                  '<span class="nav-label-long">Certificates &amp; Accreditations</span>' +
                  '<span class="nav-label-short">Certificates</span>' +
                '</a></li>' +
              '</ul>' +
            '</li>' +
            '<li><a href="' + careersHref() + '" class="' + navClass('careers.html') + '">Careers</a></li>' +
            '<li><a href="' + baseDir + 'contact.html" class="' + navClass('contact.html') + '">Contact</a></li>' +
          '</ul>' +
        '</div>' +
      '</header>'
    );
  }

  function renderFooter() {
    return (
      '<footer>' +
        '<div class="container footer-grid">' +
          '<div class="footer-brand">' +
            '<div class="footer-logo">' +
              '<img src="' + baseDir + 'logo-final.png?v=6" alt="Sekar Constructions Logo">' +
            '</div>' +
            '<p>A Class-I civil engineering construction firm executing high-value public utilities, atomic energy plant structures, commercial quarters, and water desalination facilities since 1995.</p>' +
            '<p class="footer-badge"><i class="fa-solid fa-award"></i> Class-I Civil Engineers &amp; DAE Contractors</p>' +
          '</div>' +
          '<div class="footer-links">' +
            '<h4>Quick Navigation</h4>' +
            '<ul>' +
              '<li><a href="' + baseDir + 'index.html">Home</a></li>' +
              '<li><a href="' + baseDir + 'about.html">About Us</a></li>' +
              '<li><a href="' + baseDir + 'index.html#services">Our Services</a></li>' +
              '<li><a href="' + baseDir + 'infrastructure.html">Infrastructure</a></li>' +
              '<li><a href="' + baseDir + 'portfolio.html">Portfolio</a></li>' +
              '<li><a href="' + baseDir + 'gallery.html">Gallery</a></li>' +
              '<li><a href="' + careersHref() + '">Careers</a></li>' +
              '<li><a href="' + baseDir + 'contact.html">Contact</a></li>' +
            '</ul>' +
          '</div>' +
          '<div class="footer-contact">' +
            '<h4>Head Office Details</h4>' +
            '<div class="footer-contact-items">' +
              '<p><i class="fa-solid fa-location-dot"></i> No. 22, First Cross Street, Vedachalam Nagar, Mamallapuram – 603 104.</p>' +
              '<p><i class="fa-solid fa-envelope"></i> ho@sekarconstructions.com</p>' +
              '<p><i class="fa-solid fa-phone"></i> +91 94432 21644, +91 63825 97029</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="container footer-bottom">' +
          '<p>&copy; 2026 Sekar Constructions. All Rights Reserved.</p>' +
          '<p>Redesigned &amp; Modernized | Powered by Antigravity</p>' +
        '</div>' +
      '</footer>'
    );
  }

  function applyCareersLinks(root) {
    if (!root || onJobsHost || !useJobsSite) return;
    var target = careersHref();
    var links = root.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (isCareersHref(href) && href.indexOf('jobs.sekarconstructions.com') === -1) {
        links[i].setAttribute('href', target);
      }
    }
  }

  function mount() {
    var headerMount = document.getElementById('site-header');
    var footerMount = document.getElementById('site-footer');
    if (headerMount) {
      if (!headerMount.firstElementChild) {
        headerMount.innerHTML = renderHeader();
      }
      applyCareersLinks(headerMount);
      applyActiveNav(headerMount);
    }
    if (footerMount) {
      if (!footerMount.firstElementChild) {
        footerMount.innerHTML = renderFooter();
      }
      applyCareersLinks(footerMount);
    }
  }

  mount();
})();

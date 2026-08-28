/**
 * Shared site header & footer injection for Sekar Constructions public pages.
 * Place empty #site-header / #site-footer mounts in HTML; this fills them on load.
 */
(function () {
  var path = (window.location.pathname || '').split('/').pop() || 'index.html';
  if (!path || path === '') path = 'index.html';
  var isHome = path === 'index.html' || path === '/' || path === '';
  var galleryPages = [
    'gallery.html',
    'gallery-plant-machinery.html',
    'gallery-founder-clients.html',
    'gallery-certificates.html'
  ];
  var isGallery = galleryPages.indexOf(path) !== -1;
  var isPortfolio = path === 'portfolio.html' || path === 'ongoing-projects.html';

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
    return isHome ? hash : 'index.html' + hash;
  }

  function renderHeader() {
    var logoHref = isHome ? '#' : 'index.html';
    return (
      '<header>' +
        '<div class="container nav-container">' +
          '<a href="' + logoHref + '" class="logo">' +
            '<img src="logo-final.png?v=6" alt="Sekar Constructions Logo">' +
          '</a>' +
          '<button class="menu-toggle" id="menuToggleBtn" aria-label="Toggle Menu" aria-expanded="false">' +
            '<span></span><span></span><span></span>' +
          '</button>' +
          '<ul class="nav-menu" id="navMenu">' +
            '<li><a href="' + homeHref('#home') + '" class="' + navClass('home') + '">Home</a></li>' +
            '<li><a href="' + homeHref('#services') + '" class="nav-link">Services</a></li>' +
            '<li><a href="about.html" class="' + navClass('about.html') + '">About Us</a></li>' +
            '<li><a href="infrastructure.html" class="' + navClass('infrastructure.html') + '">Infrastructure</a></li>' +
            '<li class="dropdown">' +
              '<a href="#" class="nav-link dropdown-toggle' + (isPortfolio ? ' active' : '') + '" aria-haspopup="true" aria-expanded="false" id="portfolioDropdownBtn">' +
                'Portfolio <i class="fa-solid fa-chevron-down dropdown-chevron" aria-hidden="true"></i>' +
              '</a>' +
              '<ul class="dropdown-menu" id="portfolioDropdownMenu" role="menu" aria-label="Portfolio">' +
                '<li role="none"><a role="menuitem" href="ongoing-projects.html"' + itemActive('ongoing-projects.html') + '>Ongoing Projects</a></li>' +
                '<li role="none"><a role="menuitem" href="portfolio.html"' + itemActive('portfolio.html') + '>Completed Projects</a></li>' +
              '</ul>' +
            '</li>' +
            '<li class="dropdown">' +
              '<a href="#" class="nav-link dropdown-toggle' + (isGallery ? ' active' : '') + '" aria-haspopup="true" aria-expanded="false" id="galleryDropdownBtn">' +
                'Gallery <i class="fa-solid fa-chevron-down dropdown-chevron" aria-hidden="true"></i>' +
              '</a>' +
              '<ul class="dropdown-menu dropdown-menu--gallery" id="galleryDropdownMenu" role="menu" aria-label="Gallery">' +
                '<li role="none"><a role="menuitem" href="gallery.html"' + itemActive('gallery.html') + '>Projects</a></li>' +
                '<li role="none"><a role="menuitem" href="gallery-plant-machinery.html"' + itemActive('gallery-plant-machinery.html') + '>Plant &amp; Machinery</a></li>' +
                '<li role="none"><a role="menuitem" href="gallery-founder-clients.html"' + itemActive('gallery-founder-clients.html') + '>Founder &amp; Clients</a></li>' +
                '<li role="none"><a role="menuitem" href="gallery-certificates.html" aria-label="Certificates &amp; Accreditations"' + itemActive('gallery-certificates.html') + '>' +
                  '<span class="nav-label-long">Certificates &amp; Accreditations</span>' +
                  '<span class="nav-label-short">Certificates</span>' +
                '</a></li>' +
              '</ul>' +
            '</li>' +
            '<li><a href="careers.html" class="' + navClass('careers.html') + '">Careers</a></li>' +
            '<li><a href="contact.html" class="' + navClass('contact.html') + '">Contact</a></li>' +
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
              '<img src="logo-final.png?v=6" alt="Sekar Constructions Logo">' +
            '</div>' +
            '<p>A Class-I civil engineering construction firm executing high-value public utilities, atomic energy plant structures, commercial quarters, and water desalination facilities since 1995.</p>' +
            '<p class="footer-badge"><i class="fa-solid fa-award"></i> Class-I Civil Engineers &amp; DAE Contractors</p>' +
          '</div>' +
          '<div class="footer-links">' +
            '<h4>Quick Navigation</h4>' +
            '<ul>' +
              '<li><a href="index.html">Home</a></li>' +
              '<li><a href="about.html">About Us</a></li>' +
              '<li><a href="index.html#services">Our Services</a></li>' +
              '<li><a href="infrastructure.html">Infrastructure</a></li>' +
              '<li><a href="portfolio.html">Portfolio</a></li>' +
              '<li><a href="gallery.html">Gallery</a></li>' +
              '<li><a href="careers.html">Careers</a></li>' +
              '<li><a href="contact.html">Contact</a></li>' +
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

  function mount() {
    var headerMount = document.getElementById('site-header');
    var footerMount = document.getElementById('site-footer');
    if (headerMount) {
      if (!headerMount.firstElementChild) {
        headerMount.innerHTML = renderHeader();
      }
      // Update active links
      var links = headerMount.querySelectorAll('.nav-link');
      for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href') || '';
        if (href === path || (isHome && (href === '#' || href === 'index.html' || href === 'index.html#home'))) {
          links[i].classList.add('active');
        }
      }
    }
    if (footerMount && !footerMount.firstElementChild) {
      footerMount.innerHTML = renderFooter();
    }
  }

  mount();
})();

/* Minimal theme behaviour: hide the preloader and run the back-to-top button. */
(function () {
  'use strict';

  // Hide the preloader once the page has finished loading (with a safety timeout).
  function hidePreloader() {
    var p = document.querySelector('.preloader');
    if (!p) return;
    p.style.opacity = '0';
    setTimeout(function () { p.style.display = 'none'; }, 300);
  }
  window.addEventListener('load', hidePreloader);
  setTimeout(hidePreloader, 4000);

  // Back-to-top button.
  var btn = document.getElementById('scroll-top');
  if (btn) {
    window.addEventListener('scroll', function () {
      btn.classList.toggle('show', window.scrollY > 300);
    });
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();

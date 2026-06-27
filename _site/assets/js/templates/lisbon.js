/*
 * lisbon.js — renderer for the "Lisbon" Portuguese menu template.
 *
 * Drives three pages:
 *   /templates/lisbon/           (#menu-root      — homepage with editorial layout)
 *   /templates/lisbon/category/  (#category-root  — category items list)
 *   /templates/lisbon/item/      (#item-root       — item detail)
 *
 * Data: real tenant menu from S3 when ?tenant= is present; otherwise the
 * bundled lisbon-menu.json is used so the template is previewable standalone.
 *
 * Design palette:
 *   Azul Atlântico  #1A4A7A  — primary (buttons, headings, borders)
 *   Terracota Suave #C4622D  — accent  ("New" badge, hover, YouTube)
 *   Cal Branco      #F5F3EF  — background
 *   Verde Garrafa   #1F4D3A  — diet icons
 */
(function (global) {
  'use strict';

  var Core = global.MenuCore;
  var esc = Core.escapeHtml;
  var CONFIG = global.AKUT_CONFIG || {};
  var BUNDLED_MENU = (CONFIG.baseUrl || '').replace(/\/$/, '') + '/assets/data/lisbon-menu.json';

  var state = { menu: null, tenant: null, menuId: null, lang: null, langs: [] };

  /* ---------------------------------------------------------- i18n strings */

  var LS_STRINGS = {
    backToMenu:      { English: 'Back to Menu',    Portuguese: 'Voltar ao Menu',    Spanish: 'Volver al Menú',    French: 'Retour au Menu' },
    backToMenuShort: { English: 'Back to Menu',    Portuguese: 'Voltar',            Spanish: 'Volver al Menú',    French: 'Retour au Menu' },
    backToCategory: { English: 'Back to Category', Portuguese: 'Voltar à Categoria', Spanish: 'Volver a la Categoría', French: 'Retour à la Catégorie' },
    viewItems:      { English: 'View Items',       Portuguese: 'Ver Itens',         Spanish: 'Ver Artículos',     French: 'Voir les Articles' },
    viewItem:       { English: 'View item',        Portuguese: 'Ver item',          Spanish: 'Ver artículo',      French: 'Voir l\'article' },
    explore:        { English: 'Explore →',        Portuguese: 'Explorar →',        Spanish: 'Explorar →',        French: 'Explorer →' },
    categories:     { English: 'categories',       Portuguese: 'categorias',        Spanish: 'categorías',        French: 'catégories' },
    dishes:         { English: 'dishes',           Portuguese: 'pratos',            Spanish: 'platos',            French: 'plats' },
    dish:           { English: 'dish',             Portuguese: 'prato',             Spanish: 'plato',             French: 'plat' },
    watchOnYouTube: { English: 'Watch on YouTube', Portuguese: 'Ver no YouTube',    Spanish: 'Ver en YouTube',    French: 'Voir sur YouTube' },
    howItsMade:     { English: "How it's made",    Portuguese: 'Como é feito',      Spanish: 'Cómo se hace',      French: 'Comment c\'est fait' },
    video:          { English: 'Vídeo',            Portuguese: 'Vídeo',             Spanish: 'Vídeo',             French: 'Vidéo' }
  };

  function lsText(key) {
    var entry = LS_STRINGS[key] || {};
    return (state.lang && entry[state.lang]) || entry.English || '';
  }

  /* ------------------------------------------------------------------ init */

  document.addEventListener('DOMContentLoaded', function () {
    state.tenant = queryTenant();
    state.menuId = queryMenuId();
    var menuRoot     = document.getElementById('menu-root');
    var categoryRoot = document.getElementById('category-root');
    var itemRoot     = document.getElementById('item-root');
    var fallback     = menuRoot || categoryRoot || itemRoot || document.querySelector('main');

    loadMenu(state.tenant, state.menuId)
      .then(function (menu) {
        state.menu  = menu;
        state.langs = Core.availableLanguages(menu);
        state.lang  = Core.pickLanguage(menu, state.langs, state.menuId);
        setupChrome();
        setupLangSwitcher();
        if (menuRoot)          renderIndex(menuRoot);
        else if (categoryRoot) renderCategory(categoryRoot);
        else if (itemRoot)     renderItem(itemRoot);
      })
      .catch(function (err) {
        Core.renderError(fallback, err, state.lang);
      });
  });

  /* ---------------------------------------------------------------- helpers */

  function queryTenant() {
    var q = new global.URLSearchParams(global.location.search).get('tenant');
    return q && q.trim() ? q.trim() : null;
  }

  function queryMenuId() {
    var q = new global.URLSearchParams(global.location.search).get('menu');
    return q && q.trim() ? q.trim() : null;
  }

  function getCategoryId() {
    return new global.URLSearchParams(global.location.search).get('category');
  }

  function loadMenu(tenant, menuId) {
    if (tenant) return Core.fetchMenu(tenant, menuId);
    return global.fetch(BUNDLED_MENU, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('bundled menu unavailable');
        return res.json();
      })
      .catch(function () {
        var e = new Error('NETWORK'); e.code = 'NETWORK'; throw e;
      });
  }

  function L(field) { return Core.t(field, state.lang); }

  function homeUrl() {
    var url = Core.templatePath('main', state.menu.TemplateId);
    return state.tenant ? Core.withTenant(url, state.tenant, state.menuId) : url;
  }

  function categoryUrl(catId) {
    var url   = Core.templatePath('category', state.menu.TemplateId);
    var param = 'category=' + encodeURIComponent(catId);
    return state.tenant
      ? Core.withTenant(url, state.tenant, state.menuId, param)
      : url + (url.indexOf('?') === -1 ? '?' : '&') + param;
  }

  function itemUrl(itemId) {
    var url   = Core.templatePath('detail', state.menu.TemplateId);
    var param = 'item=' + encodeURIComponent(itemId);
    return state.tenant
      ? Core.withTenant(url, state.tenant, state.menuId, param)
      : url + (url.indexOf('?') === -1 ? '?' : '&') + param;
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (el) { el.textContent = value || ''; });
  }

  function sortedCategories() {
    return (state.menu.Categories || []).slice().sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); });
  }

  function sortedItems(cat) {
    return (cat.Items || []).slice().sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); });
  }

  function buildImages(item) {
    return (item.Images || [])
      .slice()
      .sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); })
      .map(function (im) { return (im.Link && im.Link.FullSize) || im.Url || null; })
      .filter(Boolean);
  }

  function firstImage(item) {
    var imgs = buildImages(item);
    return imgs.length ? imgs[0] : null;
  }

  function youTubeId(url) {
    if (!url) return null;
    var m = String(url).match(
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    );
    return m ? m[1] : null;
  }

  function findItem(itemId) {
    var cats = state.menu.Categories || [];
    for (var c = 0; c < cats.length; c++) {
      var items = cats[c].Items || [];
      for (var i = 0; i < items.length; i++) {
        if (String(items[i].Id) === String(itemId)) return { item: items[i], category: cats[c] };
      }
    }
    return null;
  }

  /* ------------------------------------------------------------ shared chrome */

  function setupChrome() {
    var menu    = state.menu;
    var name    = L(menu.Name) || Core.uiText('menu', state.lang);
    var logoUrl = menu.Logo && menu.Logo.Link && menu.Logo.Link.Thumbnail;

    if (logoUrl) {
      document.querySelectorAll('.ls-brand-mark').forEach(function (mark) {
        mark.innerHTML = '<img src="' + esc(logoUrl) + '" alt="' + esc(name) + '">';
      });
    }

    document.querySelectorAll('[data-menu-home]').forEach(function (a) { a.setAttribute('href', homeUrl()); });
    setText('[data-menu-name]',        name);
    setText('[data-menu-description]', L(menu.Description));
    setText('[data-availability]', Core.formatAvailability(menu, state.lang));
    var founded = Core.formatFoundedYear(menu, state.lang);
    setText('[data-founded-year]', founded ? ' · ' + founded : '');
    setText('[data-current-year]',     new Date().getFullYear());
    document.title = name;
    applyI18n();
  }

  function applyI18n() {
    document.querySelectorAll('[data-ls-i18n]').forEach(function (el) {
      el.textContent = lsText(el.getAttribute('data-ls-i18n'));
    });
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = Core.uiText(el.getAttribute('data-i18n'), state.lang);
    });
  }

  /* ----------------------------------------------------------- lang switcher */

  function setupLangSwitcher() {
    var wrap = document.querySelector('[data-lang-switcher]');
    if (!wrap) return;
    if (state.langs.length <= 1) { wrap.hidden = true; return; }
    wrap.hidden = false;

    var label = wrap.querySelector('[data-lang-current-label]');
    var list  = wrap.querySelector('[data-lang-menu]');
    var btn   = wrap.querySelector('.lang-current');

    function paint() {
      if (label) label.textContent = Core.languageLabel(state.lang);
      list.innerHTML = state.langs.map(function (key) {
        var active = key === state.lang ? ' active' : '';
        return '<li><button type="button" class="' + active.trim() + '" data-lang="' + esc(key) + '">' +
               esc(Core.languageLabel(key)) + '</button></li>';
      }).join('');
    }
    paint();

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      wrap.classList.toggle('open');
      btn.setAttribute('aria-expanded', wrap.classList.contains('open') ? 'true' : 'false');
    });
    list.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-lang]');
      if (!b) return;
      state.lang = b.getAttribute('data-lang');
      Core.saveLang(state.lang, state.menuId);
      wrap.classList.remove('open');
      paint();
      setupChrome();
      rerenderCurrentView();
    });
    document.addEventListener('click', function () { wrap.classList.remove('open'); });
  }

  function rerenderCurrentView() {
    var menuRoot     = document.getElementById('menu-root');
    var categoryRoot = document.getElementById('category-root');
    var itemRoot     = document.getElementById('item-root');
    if (menuRoot)          renderIndex(menuRoot);
    else if (categoryRoot) renderCategory(categoryRoot);
    else if (itemRoot)     renderItem(itemRoot);
  }

  /* ========================================================= INDEX PAGE */

  function renderIndex(root) {
    var cats  = sortedCategories();
    var total = cats.reduce(function (n, c) { return n + (c.Items || []).length; }, 0);

    /* stats in the editorial sidebar */
    var statsEl = document.getElementById('ls-stats');
    if (statsEl) {
      statsEl.innerHTML =
        '<span>' + esc(cats.length + ' ' + lsText('categories')) + '</span>' +
        '<span class="ls-stats-dot"></span>' +
        '<span>' + esc(total + ' ' + lsText('dishes')) + '</span>';
    }

    if (!cats.length) {
      root.innerHTML = '<div class="ls-loading"><p>' + esc(Core.uiText('noItems', state.lang)) + '</p></div>';
      return;
    }

    var rows = cats.map(function (cat, idx) { return renderCatRow(cat, idx); }).join('');
    root.innerHTML = '<div class="ls-cat-list">' + rows + '</div>';
  }

  function renderCatRow(cat, idx) {
    var items = sortedItems(cat);
    var desc  = L(cat.Description);
    var sub   = L(cat.Name) !== cat.Name.Portuguese
      ? (cat.Name.Portuguese || '') + ' · ' + items.length + ' ' + (items.length === 1 ? lsText('dish') : lsText('dishes'))
      : items.length + ' ' + (items.length === 1 ? lsText('dish') : lsText('dishes'));

    return '' +
      '<a class="ls-cat-row" href="' + esc(categoryUrl(cat.Id)) + '">' +
        '<div class="ls-cat-row-inner">' +
          '<div class="ls-cat-info">' +
            '<span class="ls-cat-num">' + String(idx + 1).padStart(2, '0') + '</span>' +
            '<span class="ls-cat-name">' + esc(L(cat.Name)) + '</span>' +
            '<span class="ls-cat-sub">' + esc(sub) + '</span>' +
          '</div>' +
          '<span class="ls-cat-action">' + esc(lsText('explore')) + '</span>' +
        '</div>' +
        (desc
          ? '<div class="ls-cat-desc-wrap"><p class="ls-cat-desc">' + esc(desc) + '</p></div>'
          : '') +
      '</a>';
  }

  /* ======================================================= CATEGORY PAGE */

  function renderCategory(root) {
    var menu  = state.menu;
    var catId = getCategoryId();
    var cat   = null;
    var cats  = menu.Categories || [];
    for (var c = 0; c < cats.length; c++) {
      if (String(cats[c].Id) === String(catId)) { cat = cats[c]; break; }
    }

    if (!cat) {
      Core.renderError(root, { code: 'NOT_FOUND' }, state.lang);
      return;
    }

    document.title = L(cat.Name) || Core.uiText('category', state.lang);

    var items = sortedItems(cat);
    var desc  = L(cat.Description);

    var headerHtml =
      '<div class="ls-cat-header">' +
        '<div class="ls-cat-header-inner">' +
          '<p class="ls-eyebrow ls-eyebrow-accent ls-cat-eyebrow">' +
            esc(Core.uiText('category', state.lang)) +
          '</p>' +
          '<h1 class="ls-cat-title">' + esc(L(cat.Name)) + '</h1>' +
          '<div class="ls-cat-header-rule"></div>' +
          (desc ? '<p class="ls-cat-header-desc">' + esc(desc) + '</p>' : '') +
        '</div>' +
      '</div>';

    var itemsHtml =
      '<section class="ls-items-section">' +
        '<div class="ls-container">' +
          '<ul class="ls-item-list">' +
            items.map(function (item) { return renderItemCard(item, cat); }).join('') +
          '</ul>' +
          '<div class="ls-bottom-back">' +
            '<a class="ls-back-btn" href="' + esc(homeUrl()) + '">' +
              '<span class="ls-back-btn-arrow" aria-hidden="true">←</span>' +
              '<span class="ls-back-btn-label">' + esc(lsText('backToMenu')) + '</span>' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</section>';

    root.innerHTML = headerHtml + itemsHtml;
    initGalleries(root);
  }

  function renderItemCard(item, cat) {
    var images      = buildImages(item);
    var price       = Core.formatPrice(item.Price, state.menu.Currency);
    var diets       = Core.dietLabels(item.Diets, state.lang);
    var allergens   = L(item.Allergens);
    var ingredients = L(item.Ingredients);
    var shortDesc   = L(item.ShortDescription);
    var fullDesc    = L(item.FullDescription) || shortDesc;
    var ytUrl       = (item.YouTubeVideoUrls || [])[0] || null;
    var nameAlt     = L(item.Name);
    var namePt      = item.Name.Portuguese !== nameAlt ? item.Name.Portuguese : '';
    var hasDetail   = Core.templatePath('detail', state.menu.TemplateId);

    var detailHref = hasDetail ? itemUrl(item.Id) : null;
    var mediaHtml = renderGallery(images, nameAlt);

    var newBadge = item.IsNew
      ? '<span class="ls-new-badge">' + esc(Core.uiText('newBadge', state.lang)) + '</span>'
      : '';

    var dietTags = diets.length
      ? '<div class="ls-tags">' + diets.map(function (d) {
          return '<span class="ls-tag">' + esc(d) + '</span>';
        }).join('') + '</div>'
      : '';

    var dlParts = [];
    if (ingredients) {
      dlParts.push(
        '<div><dt class="ls-item-dt">' + esc(Core.uiText('ingredients', state.lang)) + '</dt>' +
        '<dd class="ls-item-dd">' + esc(ingredients) + '</dd></div>'
      );
    }
    if (allergens) {
      dlParts.push(
        '<div><dt class="ls-item-dt">' + esc(Core.uiText('allergens', state.lang)) + '</dt>' +
        '<dd class="ls-item-dd">' + esc(allergens) + '</dd></div>'
      );
    }
    var dlHtml = dlParts.length
      ? '<dl class="ls-item-dl">' + dlParts.join('') + '</dl>'
      : '';

    /* YouTube link stays interactive above the card overlay (z-index handled in CSS) */
    var ytHtml = ytUrl
      ? '<a class="ls-yt-btn" href="' + esc(ytUrl) + '" target="_blank" rel="noopener noreferrer">' +
          '<i class="bi bi-play-circle" aria-hidden="true"></i> ' +
          esc(lsText('watchOnYouTube')) +
        '</a>'
      : '';

    /* Stretched link covers the whole card; gallery controls & yt-btn sit above it via z-index */
    var cardLinkHtml = detailHref
      ? '<a class="ls-item-card-link" href="' + esc(detailHref) + '" aria-label="' + esc(nameAlt) + '"></a>'
      : '';

    return '' +
      '<li>' +
        '<article class="ls-item-card">' +
          cardLinkHtml +
          '<div class="ls-item-media" data-gallery>' + mediaHtml + '</div>' +
          '<div class="ls-item-content">' +
            '<div class="ls-item-head">' +
              '<div class="ls-item-name-wrap">' +
                '<div class="ls-item-name-row">' +
                  '<h2 class="ls-item-name">' + esc(nameAlt) + '</h2>' +
                  newBadge +
                '</div>' +
                (namePt ? '<p class="ls-item-name-pt">' + esc(namePt) + '</p>' : '') +
              '</div>' +
              (price ? '<div class="ls-item-price">' + esc(price) + '</div>' : '') +
            '</div>' +
            (shortDesc ? '<p class="ls-item-short-desc">' + esc(shortDesc) + '</p>' : '') +
            (fullDesc && fullDesc !== shortDesc ? '<p class="ls-item-full-desc">' + esc(fullDesc) + '</p>' : '') +
            dietTags +
            dlHtml +
            (ytHtml ? '<div class="ls-item-footer">' + ytHtml + '</div>' : '') +
          '</div>' +
        '</article>' +
      '</li>';
  }

  /* ========================================================= ITEM PAGE */

  function renderItem(root) {
    var itemId = Core.getItemId();
    var result = itemId ? findItem(itemId) : null;

    if (!result) {
      Core.renderError(root, { code: 'NOT_FOUND' }, state.lang);
      return;
    }

    var item = result.item;
    var cat  = result.category;

    document.title = L(item.Name) + ' — ' + (L(state.menu.Name) || '');

    var images      = buildImages(item);
    var price       = Core.formatPrice(item.Price, state.menu.Currency);
    var diets       = Core.dietLabels(item.Diets, state.lang);
    var allergens   = L(item.Allergens);
    var ingredients = L(item.Ingredients);
    var shortDesc   = L(item.ShortDescription);
    var fullDesc    = L(item.FullDescription) || shortDesc;
    var nameAlt     = L(item.Name);
    var namePt      = item.Name.Portuguese !== nameAlt ? item.Name.Portuguese : '';
    var ytUrl       = (item.YouTubeVideoUrls || [])[0] || null;
    var videoId     = youTubeId(ytUrl);

    var mediaHtml = renderGallery(images, nameAlt);

    var newBadge = item.IsNew
      ? '<span class="ls-new-badge">' + esc(Core.uiText('newBadge', state.lang)) + '</span>'
      : '';

    var dietSection = diets.length
      ? '<div>' +
          '<dt class="ls-item-detail-dt">' + esc(Core.uiText('details', state.lang)) + '</dt>' +
          '<dd class="ls-item-detail-dd">' +
            '<div class="ls-tags">' + diets.map(function (d) {
              return '<span class="ls-tag">' + esc(d) + '</span>';
            }).join('') + '</div>' +
          '</dd>' +
        '</div>'
      : '';

    var ytSection = ytUrl
      ? '<div>' +
          '<dt class="ls-item-detail-dt">Video</dt>' +
          '<dd class="ls-item-detail-dd">' +
            '<a class="ls-yt-btn" href="' + esc(ytUrl) + '" target="_blank" rel="noopener noreferrer">' +
              '<i class="bi bi-play-circle" aria-hidden="true"></i> ' +
              esc(lsText('watchOnYouTube')) +
            '</a>' +
          '</dd>' +
        '</div>'
      : '';

    var dlParts = [];
    if (ingredients) {
      dlParts.push(
        '<div>' +
          '<dt class="ls-item-detail-dt">' + esc(Core.uiText('ingredients', state.lang)) + '</dt>' +
          '<dd class="ls-item-detail-dd">' + esc(ingredients) + '</dd>' +
        '</div>'
      );
    }
    if (allergens) {
      dlParts.push(
        '<div>' +
          '<dt class="ls-item-detail-dt">' + esc(Core.uiText('allergens', state.lang)) + '</dt>' +
          '<dd class="ls-item-detail-dd">' + esc(allergens) + '</dd>' +
        '</div>'
      );
    }
    if (dietSection) dlParts.push(dietSection);
    if (ytSection)   dlParts.push(ytSection);

    var breadcrumbHtml =
      '<nav class="ls-breadcrumb" aria-label="breadcrumb">' +
        '<a href="' + esc(homeUrl()) + '">' + esc(Core.uiText('menu', state.lang)) + '</a>' +
        '<span class="ls-breadcrumb-sep" aria-hidden="true">·</span>' +
        '<a href="' + esc(categoryUrl(cat.Id)) + '">' + esc(L(cat.Name)) + '</a>' +
      '</nav>';

    var videoEmbed = videoId
      ? '<section class="ls-video-section">' +
          '<p class="ls-eyebrow ls-eyebrow-accent ls-video-eyebrow">' + esc(lsText('video')) + '</p>' +
          '<h2 class="ls-video-title">' + esc(lsText('howItsMade')) + '</h2>' +
          '<div class="ls-video-embed">' +
            '<iframe src="https://www.youtube.com/embed/' + esc(videoId) + '" ' +
              'title="' + esc(nameAlt) + '" ' +
              'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
              'allowfullscreen></iframe>' +
          '</div>' +
        '</section>'
      : '';

    root.innerHTML =
      '<div class="ls-item-page">' +
        breadcrumbHtml +
        '<div class="ls-item-layout">' +
          '<div class="ls-item-media" data-gallery>' + mediaHtml + '</div>' +
          '<article class="ls-item-detail">' +
            '<div class="ls-item-detail-eyebrow">' +
              '<span class="ls-item-detail-cat">' + esc(L(cat.Name)) + '</span>' +
              newBadge +
            '</div>' +
            '<h1 class="ls-item-detail-title">' + esc(nameAlt) + '</h1>' +
            (namePt ? '<p class="ls-item-detail-name-pt">' + esc(namePt) + '</p>' : '') +
            '<div class="ls-item-detail-rule"></div>' +
            (price ? '<p class="ls-item-detail-price">' + esc(price) + '</p>' : '') +
            (shortDesc ? '<p class="ls-item-detail-short">' + esc(shortDesc) + '</p>' : '') +
            (fullDesc && fullDesc !== shortDesc ? '<p class="ls-item-detail-full">' + esc(fullDesc) + '</p>' : '') +
            (dlParts.length
              ? '<hr class="ls-item-detail-hr"><dl class="ls-item-detail-dl">' + dlParts.join('') + '</dl>'
              : '') +
          '</article>' +
        '</div>' +
        videoEmbed +
        '<div class="ls-back-primary-section">' +
          '<a class="ls-back-btn" href="' + esc(homeUrl()) + '">' +
            '<span class="ls-back-btn-arrow" aria-hidden="true">←</span>' +
            '<span class="ls-back-btn-label">' + esc(lsText('backToMenu')) + '</span>' +
          '</a>' +
        '</div>' +
      '</div>';

    initGalleries(root);
  }

  /* ====================================================== IMAGE GALLERY */

  function renderGallery(images, alt) {
    if (!images.length) {
      return '<div class="ls-gallery"><div class="ls-gallery-no-img"><i class="bi bi-image" aria-hidden="true"></i></div></div>';
    }

    var trackHtml = images.map(function (url, i) {
      return '<img class="ls-gallery-img' + (i === 0 ? ' active' : '') + '" ' +
        'src="' + esc(url) + '" alt="' + esc(alt) + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '">';
    }).join('');

    var arrowsHtml = images.length > 1
      ? '<button type="button" class="ls-img-arrow ls-img-arrow-prev" data-img-prev aria-label="Previous image">' +
          '<i class="bi bi-chevron-left"></i>' +
        '</button>' +
        '<button type="button" class="ls-img-arrow ls-img-arrow-next" data-img-next aria-label="Next image">' +
          '<i class="bi bi-chevron-right"></i>' +
        '</button>'
      : '';

    var dotsHtml = images.length > 1
      ? '<div class="ls-img-dots">' +
          images.map(function (_, i) {
            return '<span class="ls-img-dot' + (i === 0 ? ' active' : '') + '"></span>';
          }).join('') +
        '</div>'
      : '';

    /* Zoom button — top-right corner; opens full-size via Magnific Popup */
    var zoomHtml = '<a class="ls-zoom" data-zoom href="' + esc(images[0]) + '" aria-label="Zoom image">' +
      '<i class="bi bi-zoom-in"></i>' +
    '</a>';

    return '<div class="ls-gallery">' +
      '<div class="ls-gallery-track">' + trackHtml + '</div>' +
      arrowsHtml +
      dotsHtml +
      zoomHtml +
    '</div>';
  }

  function initGalleries(root) {
    root.querySelectorAll('[data-gallery]').forEach(function (container) {
      var imgs = Array.prototype.slice.call(container.querySelectorAll('.ls-gallery-img'));
      var dots = Array.prototype.slice.call(container.querySelectorAll('.ls-img-dot'));
      var prev = container.querySelector('[data-img-prev]');
      var next = container.querySelector('[data-img-next]');
      var zoom = container.querySelector('[data-zoom]');

      /* Wire up Magnific Popup lightbox on the zoom anchor */
      if (zoom && global.jQuery && global.jQuery.fn.magnificPopup) {
        global.jQuery(zoom).magnificPopup({ type: 'image' });
      }

      if (imgs.length <= 1) return;

      var current = 0;

      function goTo(idx) {
        imgs[current].classList.remove('active');
        dots[current].classList.remove('active');
        current = (idx + imgs.length) % imgs.length;
        imgs[current].classList.add('active');
        dots[current].classList.add('active');
        /* Keep zoom href in sync with the visible slide */
        if (zoom) zoom.setAttribute('href', imgs[current].src);
      }

      if (prev) prev.addEventListener('click', function () { goTo(current - 1); });
      if (next) next.addEventListener('click', function () { goTo(current + 1); });

      dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () { goTo(i); });
      });
    });
  }

})(window);

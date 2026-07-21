/*
 * trattoria.js — renderer for the "Trattoria" Italian menu template.
 *
 * Drives three pages:
 *   /templates/trattoria/           (#menu-root      — homepage with hero + category grid)
 *   /templates/trattoria/category/  (#category-root  — category items grid)
 *   /templates/trattoria/item/      (#item-root       — item detail)
 *
 * Data: real tenant menu from S3 when ?tenant= is present; otherwise the
 * bundled trattoria-menu.json is used so the template is previewable standalone.
 *
 * Design palette:
 *   Rosso Italiano  #CD212A  — primary accent (badges, links, price)
 *   Verde Oliva      #157A3D  — secondary accent (eyebrows, diet tags)
 *   Terracotta       #C1440E  — tertiary accent (chef's pick, hover)
 *   Crema            #F7F4EC  — background
 *   Inchiostro       #2B241F  — foreground / body text
 */
(function (global) {
  'use strict';

  var Core = global.MenuCore;
  var esc = Core.escapeHtml;
  var CONFIG = global.AKUT_CONFIG || {};
  var BUNDLED_MENU = (CONFIG.baseUrl || '').replace(/\/$/, '') + '/assets/data/trattoria-menu.json';

  var state = { menu: null, tenant: null, menuId: null, lang: null, langs: [] };

  /* ---------------------------------------------------------- i18n strings */

  var TR_STRINGS = {
    welcomeTo:       { English: 'Welcome to',        Portuguese: 'Bem-vindo a',              Spanish: 'Bienvenido a',              French: 'Bienvenue à',            Italian: 'Benvenuti a' },
    ilMenu:          { English: 'The Menu',          Portuguese: 'O Menu',                   Spanish: 'El Menú',                   French: 'Le Menu',                Italian: 'Il Menù' },
    categories:      { English: 'Categories',        Portuguese: 'Categorias',               Spanish: 'Categorías',                French: 'Catégories',             Italian: 'Categorie' },
    buonAppetito:    { English: 'Enjoy your meal',     Portuguese: 'Bom apetite',              Spanish: 'Buen provecho',             French: 'Bon appétit',            Italian: 'Buon Appetito' },
    allCategories:   { English: 'All categories',     Portuguese: 'Todas as categorias',      Spanish: 'Todas las categorías',      French: 'Toutes les catégories',  Italian: 'Tutte le categorie' },
    backToMenuShort: { English: 'Menu',               Portuguese: 'Menu',                     Spanish: 'Menú',                      French: 'Menu',                   Italian: 'Menu' },
    backToMenu:      { English: 'Back to Menu',       Portuguese: 'Voltar ao Menu',            Spanish: 'Volver al Menú',            French: 'Retour au Menu',         Italian: 'Torna al Menu' },
    viewMenu:        { English: 'View menu',          Portuguese: 'Ver menu',                 Spanish: 'Ver menú',                  French: 'Voir le menu',           Italian: 'Vedi il menù' },
    items:           { English: 'items',              Portuguese: 'pratos',                   Spanish: 'platos',                    French: 'plats',                  Italian: 'piatti' },
    item:            { English: 'item',               Portuguese: 'prato',                    Spanish: 'plato',                     French: 'plat',                   Italian: 'piatto' },
    categoria:       { English: 'Category',           Portuguese: 'Categoria',                Spanish: 'Categoría',                 French: 'Catégorie',              Italian: 'Categoria' },
    ancheDaProvare:  { English: 'Also worth trying',   Portuguese: 'Também vale a pena provar', Spanish: 'También vale la pena probar', French: 'À essayer aussi',      Italian: 'Anche da provare' },
    seeAll:          { English: 'See all',             Portuguese: 'Ver tudo',                 Spanish: 'Ver todo',                  French: 'Voir tout',              Italian: 'Vedi tutti' },
    none:            { English: 'None',                Portuguese: 'Nenhum',                   Spanish: 'Ninguno',                   French: 'Aucun',                  Italian: 'Nessuno' },
    watchVideo:      { English: 'Watch video',         Portuguese: 'Ver vídeo',                Spanish: 'Ver vídeo',                 French: 'Voir la vidéo',          Italian: 'Guarda il video' },
    estFrom:         { English: 'Est. {year}',         Portuguese: 'Desde {year}',             Spanish: 'Desde {year}',              French: 'Depuis {year}',          Italian: 'Dal {year}' }
  };

  function trText(key, vars) {
    var entry = TR_STRINGS[key] || {};
    var s = (state.lang && entry[state.lang]) || entry.English || '';
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace('{' + k + '}', vars[k] == null ? '' : vars[k]);
      });
    }
    return s;
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
        if (Core.isPreview()) Core.renderPreviewBand('trattoria');
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
    if (tenant) {
      return Core.isPreview()
        ? Core.fetchPreviewMenu(tenant, menuId)
        : Core.fetchMenu(tenant, menuId);
    }
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
    return Core.sortItemsAvailableFirst(cat.Items);
  }

  function firstCategoryImage(cat) {
    var items = sortedItems(cat);
    for (var i = 0; i < items.length; i++) {
      var img = buildImages(items[i])[0];
      if (img) return img;
    }
    return null;
  }

  function buildImages(item) {
    return (item.Images || [])
      .slice()
      .sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); })
      .map(function (im) { return (im.Link && im.Link.FullSize) || im.Url || null; })
      .filter(Boolean);
  }

  function youTubeEmbedId(url) {
    if (!url) return null;
    var m = String(url).match(
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    );
    return m ? m[1] : null;
  }

  function buildSlides(item) {
    var slides = buildImages(item).map(function (src) { return { type: 'image', src: src }; });
    (item.YouTubeVideoUrls || []).forEach(function (url) {
      var id = youTubeEmbedId(url);
      if (id) slides.push({ type: 'video', src: 'https://www.youtube.com/embed/' + id });
    });
    return slides;
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
      document.querySelectorAll('.tr-brand-mark').forEach(function (mark) {
        mark.innerHTML = '<img src="' + esc(logoUrl) + '" alt="' + esc(name) + '">';
      });
    }

    document.querySelectorAll('[data-menu-home]').forEach(function (a) { a.setAttribute('href', homeUrl()); });
    setText('[data-menu-name]',        name);
    setText('[data-menu-description]', L(menu.Description));

    var availability = Core.formatAvailability(menu, state.lang);
    setText('[data-availability]', availability);
    document.querySelectorAll('[data-availability-chip]').forEach(function (el) { el.hidden = !availability; });
    document.querySelectorAll('[data-availability-sep]').forEach(function (el) { el.hidden = !availability; });

    var founded = Core.formatFoundedYear(menu, state.lang);
    var foundedLabel = founded ? trText('estFrom', { year: menu.FoundedYear }) : '';
    setText('[data-founded-year]', foundedLabel);
    document.querySelectorAll('[data-founded-chip]').forEach(function (el) { el.hidden = !foundedLabel; });

    setText('[data-current-year]', new Date().getFullYear());
    document.title = name;
    applyI18n();
  }

  function applyI18n() {
    document.querySelectorAll('[data-tr-i18n]').forEach(function (el) {
      el.textContent = trText(el.getAttribute('data-tr-i18n'));
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
    var cats = sortedCategories();

    if (!cats.length) {
      root.innerHTML = '<div class="tr-loading"><p>' + esc(Core.uiText('noItems', state.lang)) + '</p></div>';
      return;
    }

    var cards = cats.map(function (cat) { return renderCatCard(cat); }).join('');
    root.innerHTML = '<ul class="tr-cat-grid">' + cards + '</ul>';
  }

  function renderCatCard(cat) {
    var count   = sortedItems(cat).length;
    var desc    = L(cat.Description);
    var noun    = count === 1 ? trText('item') : trText('items');
    var imgUrl  = firstCategoryImage(cat);
    var mediaHtml = imgUrl
      ? '<img src="' + esc(imgUrl) + '" alt="' + esc(L(cat.Name)) + '" loading="lazy">'
      : '<div class="tr-cat-card-noimg"><i class="bi bi-image" aria-hidden="true"></i></div>';

    return '' +
      '<li>' +
        '<a class="tr-cat-card" href="' + esc(categoryUrl(cat.Id)) + '">' +
          '<div class="tr-cat-card-media">' +
            mediaHtml +
            '<span class="tr-checkered-chip" aria-hidden="true"></span>' +
            '<span class="tr-cat-card-count">' + esc(count + ' ' + noun) + '</span>' +
          '</div>' +
          '<div class="tr-cat-card-body">' +
            '<h3 class="tr-cat-card-title">' + esc(L(cat.Name)) + '</h3>' +
            (desc ? '<p class="tr-cat-card-desc">' + esc(desc) + '</p>' : '') +
            '<span class="tr-cat-card-cta">' + esc(trText('viewMenu')) + ' <i class="bi bi-chevron-right"></i></span>' +
          '</div>' +
        '</a>' +
      '</li>';
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

    document.title = L(cat.Name) || trText('categoria');

    var items = sortedItems(cat);
    var desc  = L(cat.Description);

    var headerHtml =
      '<section class="tr-cat-banner">' +
        '<div class="tr-container">' +
          '<p class="tr-script tr-cat-eyebrow">' + esc(trText('categoria')) + '</p>' +
          '<h1 class="tr-cat-title">' + esc(L(cat.Name)) + '</h1>' +
          (desc ? '<p class="tr-cat-desc">' + esc(desc) + '</p>' : '') +
        '</div>' +
        '<div class="tr-tricolore tr-container"></div>' +
      '</section>';

    var itemsHtml = !items.length
      ? '<section class="tr-items-section"><div class="tr-container"><p class="tr-empty">' +
          esc(Core.uiText('noItems', state.lang)) + '</p></div></section>'
      : '<section class="tr-items-section">' +
          '<div class="tr-container">' +
            '<ul class="tr-item-grid">' +
              items.map(function (item) { return renderItemCard(item); }).join('') +
            '</ul>' +
          '</div>' +
        '</section>';

    root.innerHTML = headerHtml + itemsHtml;
  }

  function renderItemCard(item) {
    var images    = buildImages(item);
    var price     = Core.formatPrice(item.Price, state.menu.Currency, state.lang);
    var diets     = Core.dietLabels(item.Diets, state.lang);
    var shortDesc = L(item.ShortDescription);
    var nameAlt   = L(item.Name);
    var faded     = Core.isTemporarilyUnavailable(item) ? ' menu-item-faded' : '';
    var availNote = Core.standardAvailabilityText(item, state.lang);
    var badge     = Core.tagBadge(item, state.lang, 'tr-badge');

    var mediaHtml = images.length
      ? '<img src="' + esc(images[0]) + '" alt="' + esc(nameAlt) + '" loading="lazy">'
      : '<div class="tr-item-card-noimg"><i class="bi bi-image" aria-hidden="true"></i></div>';

    var dietsHtml = diets.length
      ? '<div class="tr-diet-tags">' + diets.map(function (d) {
          return '<span class="tr-diet-tag">' + esc(d) + '</span>';
        }).join('') + '</div>'
      : '';

    return '' +
      '<li>' +
        '<a class="tr-item-card' + faded + '" href="' + esc(itemUrl(item.Id)) + '">' +
          '<div class="tr-item-card-media">' +
            mediaHtml +
            (badge ? '<div class="tr-item-card-badge">' + badge + '</div>' : '') +
          '</div>' +
          '<div class="tr-item-card-body">' +
            '<div class="tr-item-card-head">' +
              '<h3 class="tr-item-card-title">' + esc(nameAlt) + '</h3>' +
              (price ? '<span class="tr-item-card-price">' + esc(price) + '</span>' : '') +
            '</div>' +
            (shortDesc ? '<p class="tr-item-card-desc">' + esc(shortDesc) + '</p>' : '') +
            (availNote ? '<p class="menu-availability-note"><i class="bi bi-calendar2-week" aria-hidden="true"></i> ' + esc(availNote) + '</p>' : '') +
            dietsHtml +
          '</div>' +
        '</a>' +
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

    var price       = Core.formatPrice(item.Price, state.menu.Currency, state.lang);
    var diets       = Core.dietLabels(item.Diets, state.lang);
    var allergens   = Core.allergenLabels(item.Allergens, state.lang);
    var ingredients = L(item.Ingredients);
    var shortDesc   = L(item.ShortDescription);
    var fullDesc    = L(item.FullDescription) || shortDesc;
    var nameAlt     = L(item.Name);
    var availNote   = Core.standardAvailabilityText(item, state.lang);
    var badge       = Core.tagBadge(item, state.lang, 'tr-badge');

    var slides    = buildSlides(item);
    var mediaHtml = renderMedia(slides, nameAlt);

    var dietsHtml = diets.length
      ? '<div class="tr-diet-tags">' + diets.map(function (d) {
          return '<span class="tr-diet-tag">' + esc(d) + '</span>';
        }).join('') + '</div>'
      : '';

    var allergensHtml = allergens.length
      ? '<ul class="tr-allergen-list">' + allergens.map(function (a) {
          return '<li class="tr-allergen-chip">' + esc(a) + '</li>';
        }).join('') + '</ul>'
      : '<p class="tr-muted-text">' + esc(trText('none')) + '</p>';

    var breadcrumbHtml =
      '<nav class="tr-breadcrumb" aria-label="breadcrumb">' +
        '<a href="' + esc(categoryUrl(cat.Id)) + '">' +
          '<i class="bi bi-chevron-left" aria-hidden="true"></i> ' + esc(L(cat.Name)) +
        '</a>' +
      '</nav>';

    var detailHtml =
      '<div class="tr-item-detail">' +
        '<div class="tr-item-detail-eyebrow">' +
          '<span class="tr-script">' + esc(L(cat.Name)) + '</span>' +
          badge +
        '</div>' +
        '<h1 class="tr-item-detail-title">' + esc(nameAlt) + '</h1>' +
        '<div class="tr-item-detail-price-row">' +
          (price ? '<span class="tr-item-detail-price">' + esc(price) + '</span>' : '') +
          dietsHtml +
        '</div>' +
        '<div class="tr-checkered-rule" aria-hidden="true"></div>' +
        (fullDesc ? '<p class="tr-item-detail-desc">' + esc(fullDesc) + '</p>' : '') +
        (availNote ? '<p class="menu-availability-note"><i class="bi bi-calendar2-week" aria-hidden="true"></i> ' + esc(availNote) + '</p>' : '') +
        '<div class="tr-item-detail-card">' +
          '<div>' +
            '<p class="tr-script tr-item-detail-card-label">' + esc(Core.uiText('ingredients', state.lang)) + '</p>' +
            '<p class="tr-item-detail-card-text">' + (ingredients ? esc(ingredients) : '<span class="tr-muted-text">' + esc(trText('none')) + '</span>') + '</p>' +
          '</div>' +
          '<div>' +
            '<p class="tr-script tr-item-detail-card-label">' + esc(Core.uiText('allergens', state.lang)) + '</p>' +
            allergensHtml +
          '</div>' +
        '</div>' +
      '</div>';

    var related = sortedItems(cat).filter(function (i) {
      return String(i.Id) !== String(item.Id) && !Core.isTemporarilyUnavailable(i);
    }).slice(0, 3);
    var relatedHtml = related.length
      ? '<section class="tr-related">' +
          '<div class="tr-container">' +
            '<div class="tr-section-head">' +
              '<div>' +
                '<p class="tr-script tr-section-eyebrow">' + esc(trText('ancheDaProvare')) + '</p>' +
                '<h2 class="tr-section-title">' + esc(Core.uiText('moreFrom', state.lang, { name: L(cat.Name) })) + '</h2>' +
              '</div>' +
              '<a class="tr-related-see-all" href="' + esc(categoryUrl(cat.Id)) + '">' + esc(trText('seeAll')) + '</a>' +
            '</div>' +
            '<ul class="tr-related-grid">' +
              related.map(function (r) { return renderRelatedCard(r); }).join('') +
            '</ul>' +
          '</div>' +
        '</section>'
      : '';

    root.innerHTML =
      '<div class="tr-item-page">' +
        '<div class="tr-container">' +
          breadcrumbHtml +
          '<div class="tr-item-layout">' +
            mediaHtml +
            detailHtml +
          '</div>' +
        '</div>' +
      '</div>' +
      relatedHtml;

    initMedia(root);
  }

  function renderRelatedCard(item) {
    var images  = buildImages(item);
    var price   = Core.formatPrice(item.Price, state.menu.Currency, state.lang);
    var nameAlt = L(item.Name);
    var mediaHtml = images.length
      ? '<img src="' + esc(images[0]) + '" alt="' + esc(nameAlt) + '" loading="lazy">'
      : '<div class="tr-related-card-noimg"><i class="bi bi-image" aria-hidden="true"></i></div>';

    return '' +
      '<li>' +
        '<a class="tr-related-card" href="' + esc(itemUrl(item.Id)) + '">' +
          '<div class="tr-related-card-media">' + mediaHtml + '</div>' +
          '<div class="tr-related-card-body">' +
            '<div class="tr-related-card-title">' + esc(nameAlt) + '</div>' +
            (price ? '<div class="tr-related-card-price">' + esc(price) + '</div>' : '') +
          '</div>' +
        '</a>' +
      '</li>';
  }

  /* ====================================================== MEDIA CAROUSEL */

  function renderMedia(slides, alt) {
    if (!slides.length) {
      return '<div class="tr-media"><div class="tr-media-empty"><i class="bi bi-image" aria-hidden="true"></i></div></div>';
    }

    var trackHtml = slides.map(function (s, i) {
      if (s.type === 'video') {
        return '<div class="tr-slide tr-slide-video' + (i === 0 ? ' active' : '') + '">' +
          '<iframe src="' + esc(s.src) + '" title="' + esc(alt) + '" ' +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
            'allowfullscreen></iframe>' +
        '</div>';
      }
      return '<img class="tr-slide tr-slide-img' + (i === 0 ? ' active' : '') + '" ' +
        'src="' + esc(s.src) + '" alt="' + esc(alt) + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '">';
    }).join('');

    var arrowsHtml = slides.length > 1
      ? '<button type="button" class="tr-media-arrow tr-media-arrow-prev" data-media-prev aria-label="Previous">' +
          '<i class="bi bi-chevron-left"></i>' +
        '</button>' +
        '<button type="button" class="tr-media-arrow tr-media-arrow-next" data-media-next aria-label="Next">' +
          '<i class="bi bi-chevron-right"></i>' +
        '</button>'
      : '';

    var dotsHtml = slides.length > 1
      ? '<div class="tr-media-dots">' +
          slides.map(function (_, i) {
            return '<span class="tr-media-dot' + (i === 0 ? ' active' : '') + '"></span>';
          }).join('') +
        '</div>'
      : '';

    var firstImage = slides[0].type === 'image' ? slides[0].src : null;
    var zoomHtml = firstImage
      ? '<a class="tr-media-zoom" data-zoom href="' + esc(firstImage) + '" aria-label="Zoom image">' +
          '<i class="bi bi-zoom-in"></i>' +
        '</a>'
      : '';

    return '<div class="tr-media" data-media>' +
      '<div class="tr-media-track">' + trackHtml + '</div>' +
      arrowsHtml +
      dotsHtml +
      zoomHtml +
    '</div>';
  }

  function initMedia(root) {
    root.querySelectorAll('[data-media]').forEach(function (container) {
      var slides = Array.prototype.slice.call(container.querySelectorAll('.tr-slide'));
      var dots   = Array.prototype.slice.call(container.querySelectorAll('.tr-media-dot'));
      var prev   = container.querySelector('[data-media-prev]');
      var next   = container.querySelector('[data-media-next]');
      var zoom   = container.querySelector('[data-zoom]');

      if (zoom && global.jQuery && global.jQuery.fn.magnificPopup) {
        global.jQuery(zoom).magnificPopup({ type: 'image' });
      }

      if (slides.length <= 1) return;

      var current = 0;

      function goTo(idx) {
        slides[current].classList.remove('active');
        if (dots[current]) dots[current].classList.remove('active');
        current = (idx + slides.length) % slides.length;
        slides[current].classList.add('active');
        if (dots[current]) dots[current].classList.add('active');
        if (zoom) {
          var isImage = slides[current].tagName === 'IMG';
          zoom.style.display = isImage ? '' : 'none';
          if (isImage) zoom.setAttribute('href', slides[current].src);
        }
      }

      if (prev) prev.addEventListener('click', function () { goTo(current - 1); });
      if (next) next.addEventListener('click', function () { goTo(current + 1); });

      dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () { goTo(i); });
      });
    });
  }

})(window);

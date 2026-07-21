/*
 * brunch.js — renderer for the "Brunch" weekend-menu template.
 *
 * Drives three pages:
 *   /templates/brunch/           (#menu-root      — homepage with hero + category grid)
 *   /templates/brunch/category/  (#category-root  — category items grid)
 *   /templates/brunch/item/      (#item-root       — item detail)
 *
 * Data: real tenant menu from S3 when ?tenant= is present; otherwise the
 * bundled brunch-menu.json is used so the template is previewable standalone.
 *
 * Design palette:
 *   Toasted Caramel  #8C4A2C  — primary accent (badges, links, price)
 *   Herb Leaf        #5B8A63  — secondary accent (diet tags)
 *   Terracotta Jam   #B14B33  — tertiary accent (popular/chef badges)
 *   Cream            #FBF6EE  — background
 *   Espresso Ink     #3A2A1D  — foreground / body text
 */
(function (global) {
  'use strict';

  var Core = global.MenuCore;
  var esc = Core.escapeHtml;
  var CONFIG = global.AKUT_CONFIG || {};
  var BUNDLED_MENU = (CONFIG.baseUrl || '').replace(/\/$/, '') + '/assets/data/brunch-menu.json';

  var state = { menu: null, tenant: null, menuId: null, lang: null, langs: [] };

  /* ---------------------------------------------------------- i18n strings */

  var BN_STRINGS = {
    welcomeTo:       { English: 'Welcome to',       Portuguese: 'Bem-vindo a',              Spanish: 'Bienvenido a',              French: 'Bienvenue à',            Italian: 'Benvenuti a' },
    menuWord:         { English: 'Menu',             Portuguese: 'Menu',                     Spanish: 'Menú',                      French: 'Menu',                   Italian: 'Menu' },
    theMenu:          { English: 'The menu',         Portuguese: 'O menu',                   Spanish: 'El menú',                   French: 'Le menu',                Italian: 'Il menù' },
    chooseCourse:     { English: 'Choose a course',  Portuguese: 'Escolha um momento',       Spanish: 'Elige un momento',          French: 'Choisissez un service',  Italian: 'Scegli una portata' },
    estSlowMornings:  { English: 'Est. slow mornings', Portuguese: 'Manhãs devagar, desde sempre', Spanish: 'Mañanas tranquilas, desde siempre', French: 'Matins tranquilles, depuis toujours', Italian: 'Mattine lente, da sempre' },
    backToCategory:   { English: 'Back',              Portuguese: 'Voltar',                   Spanish: 'Volver',                    French: 'Retour',                 Italian: 'Indietro' },
    dish:             { English: 'dish',              Portuguese: 'prato',                    Spanish: 'plato',                     French: 'plat',                   Italian: 'piatto' },
    dishes:           { English: 'dishes',            Portuguese: 'pratos',                   Spanish: 'platos',                    French: 'plats',                  Italian: 'piatti' },
    viewCourse:       { English: 'View course',       Portuguese: 'Ver momento',              Spanish: 'Ver momento',               French: 'Voir le service',        Italian: 'Vedi portata' },
    alsoWorthTrying:  { English: 'Also worth trying', Portuguese: 'Também vale a pena provar', Spanish: 'También vale la pena probar', French: 'À essayer aussi',      Italian: 'Anche da provare' },
    seeAll:           { English: 'See all',           Portuguese: 'Ver tudo',                 Spanish: 'Ver todo',                  French: 'Voir tout',              Italian: 'Vedi tutti' },
    none:             { English: 'None',              Portuguese: 'Nenhum',                   Spanish: 'Ninguno',                   French: 'Aucun',                  Italian: 'Nessuno' },
    offMenu:          { English: 'Currently off the menu', Portuguese: 'Atualmente fora do menu', Spanish: 'Actualmente fuera del menú', French: 'Actuellement indisponible', Italian: 'Attualmente non disponibile' },
    description:      { English: 'Description',       Portuguese: 'Descrição',                Spanish: 'Descripción',               French: 'Description',            Italian: 'Descrizione' },
    ingredients:      { English: 'Ingredients',        Portuguese: 'Ingredientes',             Spanish: 'Ingredientes',              French: 'Ingrédients',            Italian: 'Ingredienti' },
    diets:            { English: 'Diets',              Portuguese: 'Dietas',                   Spanish: 'Dietas',                    French: 'Régimes',                Italian: 'Diete' },
    allergens:        { English: 'Allergens',          Portuguese: 'Alergénios',               Spanish: 'Alérgenos',                 French: 'Allergènes',             Italian: 'Allergeni' }
  };

  function bnText(key, vars) {
    var entry = BN_STRINGS[key] || {};
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
        if (Core.isPreview()) Core.renderPreviewBand('brunch');
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

  // First word in the ink color, remaining words in the italic caramel
  // accent — mirrors the "Sunday <i>Brunch</i>" two-tone wordmark.
  function brandNameHtml(name) {
    var trimmed = (name || '').trim();
    if (!trimmed) return '';
    var parts = trimmed.split(/\s+/);
    var first = parts.shift();
    var rest  = parts.join(' ');
    return '<span class="bn-brand-name-primary">' + esc(first) + '</span>' +
      (rest ? ' <span class="bn-brand-name-accent">' + esc(rest) + '</span>' : '');
  }

  function setupChrome() {
    var menu    = state.menu;
    var name    = L(menu.Name) || Core.uiText('menu', state.lang);
    var logoUrl = menu.Logo && menu.Logo.Link && menu.Logo.Link.Thumbnail;

    if (logoUrl) {
      document.querySelectorAll('.bn-brand-mark').forEach(function (mark) {
        mark.innerHTML = '<img src="' + esc(logoUrl) + '" alt="' + esc(name) + '">';
      });
    }

    document.querySelectorAll('[data-menu-home]').forEach(function (a) { a.setAttribute('href', homeUrl()); });
    setText('[data-menu-name]',        name);
    document.querySelectorAll('.bn-brand-name, .bn-topbar-brand').forEach(function (el) { el.innerHTML = brandNameHtml(name); });
    setText('[data-menu-description]', L(menu.Description));

    var availability = Core.formatAvailability(menu, state.lang);
    setText('[data-availability]', availability);
    document.querySelectorAll('[data-availability-chip]').forEach(function (el) { el.hidden = !availability; });

    setText('[data-current-year]', new Date().getFullYear());
    document.title = name;
    applyI18n();
  }

  function applyI18n() {
    document.querySelectorAll('[data-tr-i18n]').forEach(function (el) {
      el.textContent = bnText(el.getAttribute('data-tr-i18n'));
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
      root.innerHTML = '<div class="bn-loading"><p>' + esc(Core.uiText('noItems', state.lang)) + '</p></div>';
      return;
    }

    var cards = cats.map(function (cat) { return renderCatCard(cat); }).join('');
    root.innerHTML = '<div class="bn-cat-grid">' + cards + '</div>';
  }

  function renderCatCard(cat) {
    var count   = sortedItems(cat).length;
    var desc    = L(cat.Description);
    var noun    = count === 1 ? bnText('dish') : bnText('dishes');
    var imgUrl  = firstCategoryImage(cat) || (cat.Image && ((cat.Image.Link && cat.Image.Link.FullSize) || cat.Image.Url));
    var mediaHtml = imgUrl
      ? '<img src="' + esc(imgUrl) + '" alt="' + esc(L(cat.Name)) + '" loading="lazy">'
      : '<div class="bn-cat-card-noimg"><i class="bi bi-image" aria-hidden="true"></i></div>';

    return '' +
      '<a class="bn-cat-card" href="' + esc(categoryUrl(cat.Id)) + '">' +
        '<div class="bn-cat-card-media">' +
          mediaHtml +
        '</div>' +
        '<div class="bn-cat-card-body">' +
          '<div class="bn-cat-card-head">' +
            '<h3 class="bn-cat-card-title">' + esc(L(cat.Name)) + '</h3>' +
            '<i class="bi bi-arrow-up-right bn-cat-card-arrow" aria-hidden="true"></i>' +
          '</div>' +
          (desc ? '<p class="bn-cat-card-desc">' + esc(desc) + '</p>' : '') +
          '<span class="bn-cat-card-count">' + esc(count + ' ' + noun) + '</span>' +
        '</div>' +
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

    document.title = L(cat.Name) || bnText('menuWord');

    var items = sortedItems(cat);
    var desc  = L(cat.Description);

    var headerHtml =
      '<section class="bn-cat-banner">' +
        '<p class="bn-eyebrow">' + esc(L(menu.Name)) + '</p>' +
        '<h1 class="bn-cat-title">' + esc(L(cat.Name)) + '</h1>' +
        (desc ? '<p class="bn-cat-desc">' + esc(desc) + '</p>' : '') +
      '</section>';

    var itemsHtml = !items.length
      ? '<div class="bn-empty">' + esc(Core.uiText('noItems', state.lang)) + '</div>'
      : '<div class="bn-item-grid">' +
          items.map(function (item) { return renderItemCard(item); }).join('') +
        '</div>';

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
    var badge     = Core.tagBadge(item, state.lang, 'bn-badge');

    var mediaHtml = images.length
      ? '<img src="' + esc(images[0]) + '" alt="' + esc(nameAlt) + '" loading="lazy">'
      : '<div class="bn-item-card-noimg"><i class="bi bi-image" aria-hidden="true"></i></div>';

    var dietsHtml = diets.length
      ? '<div class="bn-diet-tags">' + diets.slice(0, 3).map(function (d) {
          return '<span class="bn-diet-tag">' + esc(d) + '</span>';
        }).join('') + '</div>'
      : '';

    return '' +
      '<a class="bn-item-card' + faded + '" href="' + esc(itemUrl(item.Id)) + '">' +
        '<div class="bn-item-card-media">' +
          mediaHtml +
          (badge ? '<div class="bn-item-card-badge">' + badge + '</div>' : '') +
        '</div>' +
        '<div class="bn-item-card-body">' +
          '<div class="bn-item-card-head">' +
            '<h3 class="bn-item-card-title">' + esc(nameAlt) + '</h3>' +
            (price ? '<span class="bn-item-card-price">' + esc(price) + '</span>' : '') +
          '</div>' +
          (shortDesc ? '<p class="bn-item-card-desc">' + esc(shortDesc) + '</p>' : '') +
          (availNote ? '<p class="menu-availability-note"><i class="bi bi-calendar2-week" aria-hidden="true"></i> ' + esc(availNote) + '</p>' : '') +
          dietsHtml +
        '</div>' +
      '</a>';
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
    var unavailable = Core.isTemporarilyUnavailable(item);
    var availNote   = Core.standardAvailabilityText(item, state.lang);
    var badge       = Core.tagBadge(item, state.lang, 'bn-badge');

    document.querySelectorAll('[data-menu-home]').forEach(function (a) {
      a.setAttribute('href', categoryUrl(cat.Id));
    });
    document.querySelectorAll('[data-tr-i18n="backToCategory"]').forEach(function (el) {
      el.textContent = L(cat.Name) || bnText('backToCategory');
    });

    var slides    = buildSlides(item);
    var mediaHtml = renderMedia(slides, nameAlt);

    var dietsHtml = diets.length
      ? '<div class="bn-diet-pills">' + diets.map(function (d) {
          return '<span class="bn-diet-pill">' + esc(d) + '</span>';
        }).join('') + '</div>'
      : '<p class="bn-muted-text">' + esc(bnText('none')) + '</p>';

    var allergensHtml = allergens.length
      ? '<ul class="bn-allergen-list">' + allergens.map(function (a) {
          return '<li>' + esc(a) + '</li>';
        }).join('') + '</ul>'
      : '<p class="bn-muted-text">' + esc(bnText('none')) + '</p>';

    var detailHtml =
      '<div class="bn-item-detail">' +
        '<div class="bn-item-detail-eyebrow">' +
          '<span class="bn-eyebrow">' + esc(L(cat.Name)) + '</span>' +
          badge +
        '</div>' +
        '<h1 class="bn-item-detail-title">' + esc(nameAlt) + '</h1>' +
        '<div class="bn-item-detail-price-row">' +
          (price ? '<span class="bn-item-detail-price">' + esc(price) + '</span>' : '') +
          (unavailable ? '<span class="bn-item-detail-unavailable">' + esc(bnText('offMenu')) + '</span>' : '') +
        '</div>' +

        '<section class="bn-detail-section">' +
          '<h3 class="bn-detail-label">' + esc(bnText('description')) + '</h3>' +
          (fullDesc ? '<p class="bn-detail-text">' + esc(fullDesc) + '</p>' : '') +
          (availNote ? '<p class="menu-availability-note"><i class="bi bi-calendar2-week" aria-hidden="true"></i> ' + esc(availNote) + '</p>' : '') +
        '</section>' +

        '<section class="bn-detail-section">' +
          '<h3 class="bn-detail-label">' + esc(bnText('ingredients')) + '</h3>' +
          '<p class="bn-detail-text">' + (ingredients ? esc(ingredients) : '<span class="bn-muted-text">' + esc(bnText('none')) + '</span>') + '</p>' +
        '</section>' +

        '<section class="bn-detail-section">' +
          '<h3 class="bn-detail-label">' + esc(bnText('diets')) + '</h3>' +
          dietsHtml +
        '</section>' +

        '<section class="bn-detail-section">' +
          '<h3 class="bn-detail-label">' + esc(bnText('allergens')) + '</h3>' +
          allergensHtml +
        '</section>' +
      '</div>';

    var related = sortedItems(cat).filter(function (i) {
      return String(i.Id) !== String(item.Id) && !Core.isTemporarilyUnavailable(i);
    }).slice(0, 3);
    var relatedHtml = related.length
      ? '<section class="bn-related">' +
          '<div class="bn-section-head">' +
            '<div>' +
              '<p class="bn-eyebrow">' + esc(bnText('alsoWorthTrying')) + '</p>' +
              '<h2 class="bn-section-title">' + esc(Core.uiText('moreFrom', state.lang, { name: L(cat.Name) })) + '</h2>' +
            '</div>' +
            '<a class="bn-related-see-all" href="' + esc(categoryUrl(cat.Id)) + '">' + esc(bnText('seeAll')) + '</a>' +
          '</div>' +
          '<div class="bn-item-grid">' +
            related.map(function (r) { return renderItemCard(r); }).join('') +
          '</div>' +
        '</section>'
      : '';

    root.innerHTML =
      '<div class="bn-item-page">' +
        '<div class="bn-item-layout">' +
          mediaHtml +
          detailHtml +
        '</div>' +
      '</div>' +
      relatedHtml;

    initMedia(root);
  }

  /* ====================================================== MEDIA CAROUSEL */

  function renderMedia(slides, alt) {
    if (!slides.length) {
      return '<div class="bn-media"><div class="bn-media-empty"><i class="bi bi-image" aria-hidden="true"></i></div>' +
        '<div class="bn-media-dots"></div></div>';
    }

    var trackHtml = slides.map(function (s, i) {
      if (s.type === 'video') {
        return '<div class="bn-slide bn-slide-video' + (i === 0 ? ' active' : '') + '">' +
          '<iframe src="' + esc(s.src) + '" title="' + esc(alt) + '" ' +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
            'allowfullscreen></iframe>' +
        '</div>';
      }
      return '<img class="bn-slide bn-slide-img' + (i === 0 ? ' active' : '') + '" ' +
        'src="' + esc(s.src) + '" alt="' + esc(alt) + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '">';
    }).join('');

    var arrowsHtml = slides.length > 1
      ? '<button type="button" class="bn-media-arrow bn-media-arrow-prev" data-media-prev aria-label="Previous">' +
          '<i class="bi bi-chevron-left"></i>' +
        '</button>' +
        '<button type="button" class="bn-media-arrow bn-media-arrow-next" data-media-next aria-label="Next">' +
          '<i class="bi bi-chevron-right"></i>' +
        '</button>'
      : '';

    // Always reserve the dots row's height, even for a single slide, so the
    // media block doesn't change size depending on how many images an item has.
    var dotsHtml = '<div class="bn-media-dots">' +
      (slides.length > 1
        ? slides.map(function (_, i) {
            return '<span class="bn-media-dot' + (i === 0 ? ' active' : '') + '"></span>';
          }).join('')
        : '') +
      '</div>';

    var firstImage = slides[0].type === 'image' ? slides[0].src : null;
    var zoomHtml = firstImage
      ? '<a class="bn-media-zoom" data-zoom href="' + esc(firstImage) + '" aria-label="Zoom image">' +
          '<i class="bi bi-zoom-in"></i>' +
        '</a>'
      : '';

    // Arrows/zoom live inside the track (not the outer wrapper) so their
    // absolute positioning anchors to the image itself, not to the wrapper's
    // total height — which also includes the always-reserved dots row.
    return '<div class="bn-media" data-media>' +
      '<div class="bn-media-track">' + trackHtml + arrowsHtml + zoomHtml + '</div>' +
      dotsHtml +
    '</div>';
  }

  function initMedia(root) {
    root.querySelectorAll('[data-media]').forEach(function (container) {
      var slides = Array.prototype.slice.call(container.querySelectorAll('.bn-slide'));
      var dots   = Array.prototype.slice.call(container.querySelectorAll('.bn-media-dot'));
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

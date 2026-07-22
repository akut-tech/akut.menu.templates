/*
 * brasserie.js — renderer for the "Brasserie" French classic menu template.
 *
 * Drives three pages:
 *   /templates/brasserie/           (#menu-root      — homepage with monogram hero + category grid)
 *   /templates/brasserie/category/  (#category-root  — category items grid)
 *   /templates/brasserie/item/      (#item-root       — item detail)
 *
 * Data: real tenant menu from S3 when ?tenant= is present; otherwise the
 * bundled brasserie-menu.json is used so the template is previewable standalone.
 *
 * Design palette:
 *   Bleu de France  #0055A4  — primary accent (eyebrows, price, links)
 *   Rouge Coquelicot #EF4135 — secondary accent (badges, ribbon)
 *   Charbon          #1A1A1A — foreground / body text / chef badge
 *   Or Pâle          #F2C94C — tertiary accent (seasonal badge, note banner)
 *   Améthyste        #7E57C2 — quaternary accent (limited-edition badge)
 *   Papier           #FAF9F6 — background
 */
(function (global) {
  'use strict';

  var Core = global.MenuCore;
  var esc = Core.escapeHtml;
  var CONFIG = global.AKUT_CONFIG || {};
  var BUNDLED_MENU = (CONFIG.baseUrl || '').replace(/\/$/, '') + '/assets/data/brasserie-menu.json';

  var state = { menu: null, tenant: null, menuId: null, lang: null, langs: [] };

  /* ---------------------------------------------------------- i18n strings */

  var BS_STRINGS = {
    artDeVivre:      { English: "The Art of Living",  Portuguese: 'A Arte de Viver',          Spanish: 'El Arte de Vivir',            French: "L'Art de Vivre",         Italian: "L'Arte di Vivere" },
    welcomeTo:       { English: 'Welcome to',         Portuguese: 'Bem-vindo a',              Spanish: 'Bienvenido a',                French: 'Bienvenue à',            Italian: 'Benvenuti a' },
    laCarte:         { English: 'The Menu',           Portuguese: 'A Carta',                  Spanish: 'La Carta',                    French: 'La Carte',               Italian: 'Il Menù' },
    theMenu:         { English: 'The Menu',           Portuguese: 'A Carta',                  Spanish: 'La Carta',                    French: 'La Carte',               Italian: 'Il Menù' },
    sections:        { English: 'sections',           Portuguese: 'secções',                  Spanish: 'secciones',                   French: 'sections',               Italian: 'sezioni' },
    section:         { English: 'section',            Portuguese: 'secção',                   Spanish: 'sección',                     French: 'section',                Italian: 'sezione' },
    dishes:          { English: 'dishes',             Portuguese: 'pratos',                   Spanish: 'platos',                      French: 'plats',                  Italian: 'piatti' },
    dish:            { English: 'dish',               Portuguese: 'prato',                    Spanish: 'plato',                       French: 'plat',                   Italian: 'piatto' },
    viewMenu:        { English: 'View section',       Portuguese: 'Ver secção',               Spanish: 'Ver sección',                 French: 'Voir la carte',          Italian: 'Vedi la sezione' },
    retour:          { English: 'Back',               Portuguese: 'Voltar',                   Spanish: 'Volver',                      French: 'Retour',                 Italian: 'Indietro' },
    backToMenuShort: { English: 'Menu',                Portuguese: 'Menu',                     Spanish: 'Menú',                        French: 'Menu',                   Italian: 'Menu' },
    sectionLabel:    { English: 'Section',             Portuguese: 'Secção',                   Spanish: 'Sección',                     French: 'Section',                Italian: 'Sezione' },
    price:           { English: 'Price',               Portuguese: 'Preço',                    Spanish: 'Precio',                       French: 'Prix',                   Italian: 'Prezzo' },
    photoComingSoon: { English: 'Photo coming soon',   Portuguese: 'Foto em breve',            Spanish: 'Foto próximamente',           French: 'Photo à venir',          Italian: 'Foto in arrivo' },
    noPhoto:         { English: 'No photo',            Portuguese: 'Sem foto',                 Spanish: 'Sin foto',                    French: 'Sans photo',             Italian: 'Senza foto' },
    alsoWorthTrying: { English: 'Also worth trying',   Portuguese: 'Também vale a pena provar', Spanish: 'También vale la pena probar', French: 'À essayer aussi',        Italian: 'Da provare anche' },
    seeAll:          { English: 'See all',             Portuguese: 'Ver tudo',                 Spanish: 'Ver todo',                    French: 'Voir tout',              Italian: 'Vedi tutti' },
    none:            { English: 'None',                Portuguese: 'Nenhum',                   Spanish: 'Ninguno',                     French: 'Aucun',                  Italian: 'Nessuno' },
    diets:           { English: 'Diets',                Portuguese: 'Regimes',                  Spanish: 'Dietas',                       French: 'Régimes',                Italian: 'Regimi' },
    watchVideo:      { English: 'Watch video',          Portuguese: 'Ver vídeo',                Spanish: 'Ver vídeo',                    French: 'Voir la vidéo',          Italian: 'Guarda il video' },
    footerTagline:   { English: 'Menu · French Classic Template', Portuguese: 'Menu · Modelo Clássico Francês', Spanish: 'Menú · Plantilla Clásica Francesa', French: 'Menu · Modèle Classique Français', Italian: 'Menu · Modello Classico Francese' },
    estFrom:         { English: 'Est. {year}',         Portuguese: 'Desde {year}',             Spanish: 'Desde {year}',                French: 'Depuis {year}',          Italian: 'Dal {year}' }
  };

  function bsText(key, vars) {
    var entry = BS_STRINGS[key] || {};
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
        if (Core.isPreview()) Core.renderPreviewBand('brasserie');
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
    var own = cat.Image && ((cat.Image.Link && cat.Image.Link.FullSize) || cat.Image.Url);
    if (own) return own;
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
      if (id) slides.push({ type: 'video', id: id });
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

  function initials(name) {
    var words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }

  /* ------------------------------------------------------------ shared chrome */

  function setupChrome() {
    var menu    = state.menu;
    var name    = L(menu.Name) || Core.uiText('menu', state.lang);
    var logoUrl = menu.Logo && menu.Logo.Link && menu.Logo.Link.Thumbnail;

    document.querySelectorAll('[data-brand-mark]').forEach(function (mark) {
      var inner = mark.querySelector('[data-brand-initials]');
      if (!inner) return;
      if (logoUrl) {
        inner.innerHTML = '<img src="' + esc(logoUrl) + '" alt="' + esc(name) + '">';
      } else {
        inner.textContent = initials(name);
      }
    });

    document.querySelectorAll('[data-menu-home]').forEach(function (a) { a.setAttribute('href', homeUrl()); });
    setText('[data-menu-name]',        name);
    setText('[data-menu-description]', L(menu.Description));

    var availability = Core.formatAvailability(menu, state.lang);
    setText('[data-availability]', availability);
    document.querySelectorAll('[data-availability-chip]').forEach(function (el) { el.hidden = !availability; });

    setText('[data-current-year]', new Date().getFullYear());
    document.title = name;
    applyI18n();
  }

  function applyI18n() {
    document.querySelectorAll('[data-bs-i18n]').forEach(function (el) {
      el.textContent = bsText(el.getAttribute('data-bs-i18n'));
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

    setText('[data-cat-count]', cats.length + ' ' + (cats.length === 1 ? bsText('section') : bsText('sections')));

    if (!cats.length) {
      root.innerHTML = '<div class="bs-loading"><p>' + esc(Core.uiText('noItems', state.lang)) + '</p></div>';
      return;
    }

    var cards = cats.map(function (cat, i) { return renderCatCard(cat, i); }).join('');
    root.innerHTML = '<div class="bs-cat-grid">' + cards + '</div>';
  }

  function renderCatCard(cat, index) {
    var num     = String(index + 1).length < 2 ? '0' + (index + 1) : String(index + 1);
    var count   = sortedItems(cat).length;
    var desc    = L(cat.Description);
    var noun    = count === 1 ? bsText('dish') : bsText('dishes');
    var imgUrl  = firstCategoryImage(cat);
    var mediaHtml = imgUrl
      ? '<img src="' + esc(imgUrl) + '" alt="" loading="lazy">'
      : '<div class="bs-cat-card-noimg"><span class="bs-cat-card-num">' + esc(num) + '</span><span>' + esc(bsText('photoComingSoon')) + '</span></div>';

    return '' +
      '<a class="bs-cat-card" href="' + esc(categoryUrl(cat.Id)) + '">' +
        '<div class="bs-cat-card-media">' +
          mediaHtml +
          '<span class="bs-cat-card-badge">' + esc(num) + '</span>' +
        '</div>' +
        '<div class="bs-cat-card-body">' +
          '<div class="bs-cat-card-text">' +
            '<h3 class="bs-cat-card-title">' + esc(L(cat.Name)) + '</h3>' +
            (desc ? '<p class="bs-cat-card-desc">' + esc(desc) + '</p>' : '') +
          '</div>' +
          '<span class="bs-cat-card-cta">' + esc(count + ' ' + noun) + ' <i class="bi bi-arrow-right"></i></span>' +
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

    document.title = L(cat.Name) || bsText('sectionLabel');

    var items = sortedItems(cat);
    var desc  = L(cat.Description);

    var headerHtml =
      '<header class="bs-cat-header">' +
        '<p class="bs-eyebrow">' + esc(L(menu.Name)) + ' · ' + esc(bsText('sectionLabel')) + '</p>' +
        '<h1 class="bs-cat-title">' + esc(L(cat.Name)) + '</h1>' +
        (desc ? '<p class="bs-cat-desc">' + esc(desc) + '</p>' : '') +
        '<div class="bs-cat-meta">' +
          '<span class="bs-hero-rule bs-hero-rule--sm"></span>' +
          '<span class="bs-cat-count">' + esc(items.length + ' ' + (items.length === 1 ? bsText('dish') : bsText('dishes'))) + '</span>' +
        '</div>' +
      '</header>';

    var itemsHtml = !items.length
      ? '<div class="bs-empty">' + esc(Core.uiText('noItems', state.lang)) + '</div>'
      : '<div class="bs-item-grid">' + items.map(function (item) { return renderItemCard(item); }).join('') + '</div>';

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
    var badge     = Core.tagBadge(item, state.lang, 'bs-badge');

    var mediaHtml = images.length
      ? '<img src="' + esc(images[0]) + '" alt="' + esc(nameAlt) + '" loading="lazy">'
      : '<div class="bs-item-card-noimg"><i class="bi bi-camera" aria-hidden="true"></i><span>' + esc(bsText('noPhoto')) + '</span></div>';

    var dietsHtml = diets.length
      ? '<div class="bs-diet-tags">' + diets.map(function (d) {
          return '<span class="bs-diet-tag">' + esc(d) + '</span>';
        }).join('') + '</div>'
      : '';

    return '' +
      '<a class="bs-item-card' + faded + '" href="' + esc(itemUrl(item.Id)) + '">' +
        '<div class="bs-item-card-media">' +
          mediaHtml +
          (badge ? '<div class="bs-item-card-badge">' + badge + '</div>' : '') +
        '</div>' +
        '<div class="bs-item-card-body">' +
          '<div class="bs-item-card-head">' +
            '<h3 class="bs-item-card-title">' + esc(nameAlt) + '</h3>' +
            (price ? '<span class="bs-item-card-price">' + esc(price) + '</span>' : '') +
          '</div>' +
          (shortDesc ? '<p class="bs-item-card-desc">' + esc(shortDesc) + '</p>' : '') +
          dietsHtml +
          (availNote ? '<p class="menu-availability-note"><i class="bi bi-calendar2-week" aria-hidden="true"></i> ' + esc(availNote) + '</p>' : '') +
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
    var availNote   = Core.standardAvailabilityText(item, state.lang);
    var badge       = Core.tagBadge(item, state.lang, 'bs-badge');

    var slides    = buildSlides(item);
    var mediaHtml = renderMedia(slides, nameAlt, badge);

    var dietsHtml = diets.length
      ? '<div class="bs-diet-tags bs-diet-tags--lg">' + diets.map(function (d) {
          return '<span class="bs-diet-tag">' + esc(d) + '</span>';
        }).join('') + '</div>'
      : '<p class="bs-muted-text">' + esc(bsText('none')) + '</p>';

    var allergensHtml = allergens.length
      ? '<div class="bs-allergen-list">' + allergens.map(function (a) {
          return '<span class="bs-allergen-chip">' + esc(a) + '</span>';
        }).join('') + '</div>'
      : '<p class="bs-muted-text">' + esc(bsText('none')) + '</p>';

    var breadcrumbHtml =
      '<nav class="bs-breadcrumb" aria-label="breadcrumb">' +
        '<a href="' + esc(homeUrl()) + '">' + esc(bsText('theMenu')) + '</a>' +
        '<span>·</span>' +
        '<a href="' + esc(categoryUrl(cat.Id)) + '">' + esc(L(cat.Name)) + '</a>' +
      '</nav>';

    var detailHtml =
      '<div class="bs-item-detail">' +
        '<header class="bs-item-detail-head">' +
          '<div class="bs-item-detail-head-text">' +
            '<h1 class="bs-item-detail-title">' + esc(nameAlt) + '</h1>' +
            (shortDesc ? '<p class="bs-item-detail-subtitle">' + esc(shortDesc) + '</p>' : '') +
          '</div>' +
          (price ? '<div class="bs-item-detail-price-box"><span>' + esc(bsText('price')) + '</span><strong>' + esc(price) + '</strong></div>' : '') +
        '</header>' +
        (availNote ? '<p class="menu-availability-note"><i class="bi bi-calendar2-week" aria-hidden="true"></i> ' + esc(availNote) + '</p>' : '') +
        (fullDesc ? '<p class="bs-item-detail-desc">' + esc(fullDesc) + '</p>' : '') +
        '<div class="bs-item-detail-card">' +
          '<div>' +
            '<p class="bs-item-detail-card-label">' + esc(Core.uiText('ingredients', state.lang)) + '</p>' +
            '<p class="bs-item-detail-card-text">' + (ingredients ? esc(ingredients) : '<span class="bs-muted-text">' + esc(bsText('none')) + '</span>') + '</p>' +
          '</div>' +
          '<div>' +
            '<p class="bs-item-detail-card-label">' + esc(bsText('diets')) + '</p>' +
            dietsHtml +
          '</div>' +
        '</div>' +
        '<div class="bs-item-detail-allergens">' +
          '<p class="bs-item-detail-card-label bs-item-detail-card-label--allergen">' + esc(Core.uiText('allergens', state.lang)) + '</p>' +
          allergensHtml +
        '</div>' +
      '</div>';

    var related = sortedItems(cat).filter(function (i) {
      return String(i.Id) !== String(item.Id) && !Core.isTemporarilyUnavailable(i);
    }).slice(0, 3);
    var relatedHtml = related.length
      ? '<section class="bs-related">' +
          '<div class="bs-container">' +
            '<div class="bs-section-head">' +
              '<h2 class="bs-section-title">' + esc(bsText('alsoWorthTrying')) + '</h2>' +
              '<a class="bs-related-see-all" href="' + esc(categoryUrl(cat.Id)) + '">' + esc(bsText('seeAll')) + '</a>' +
            '</div>' +
            '<div class="bs-related-grid">' +
              related.map(function (r) { return renderRelatedCard(r); }).join('') +
            '</div>' +
          '</div>' +
        '</section>'
      : '';

    root.innerHTML =
      '<article class="bs-item-page">' +
        mediaHtml +
        '<div class="bs-container bs-item-page-body">' +
          breadcrumbHtml +
          detailHtml +
        '</div>' +
      '</article>' +
      relatedHtml;

    initMedia(root);
  }

  function renderRelatedCard(item) {
    var images  = buildImages(item);
    var price   = Core.formatPrice(item.Price, state.menu.Currency, state.lang);
    var nameAlt = L(item.Name);
    var mediaHtml = images.length
      ? '<img src="' + esc(images[0]) + '" alt="' + esc(nameAlt) + '" loading="lazy">'
      : '<div class="bs-related-card-noimg"><i class="bi bi-camera" aria-hidden="true"></i></div>';

    return '' +
      '<a class="bs-related-card" href="' + esc(itemUrl(item.Id)) + '">' +
        '<div class="bs-related-card-media">' + mediaHtml + '</div>' +
        '<div class="bs-related-card-body">' +
          '<div class="bs-related-card-title">' + esc(nameAlt) + '</div>' +
          (price ? '<div class="bs-related-card-price">' + esc(price) + '</div>' : '') +
        '</div>' +
      '</a>';
  }

  /* ====================================================== MEDIA GALLERY */

  function renderMedia(slides, alt, badge) {
    if (!slides.length) {
      return '<div class="bs-media"><div class="bs-media-empty"><i class="bi bi-camera" aria-hidden="true"></i></div></div>';
    }

    var trackHtml = slides.map(function (s, i) {
      if (s.type === 'video') {
        // Lazy: render a poster + play button, not a live iframe, until the
        // user explicitly taps play — an always-present YouTube iframe can
        // swallow taps meant for the prev/next arrows on mobile even while
        // this slide isn't active (opacity/pointer-events aside, iframes are
        // known to ignore normal stacking-context hit-testing on touch).
        return '<div class="bs-slide bs-slide-video' + (i === 0 ? ' active' : '') + '" data-video-id="' + esc(s.id) + '">' +
          '<img class="bs-slide-video-poster" src="https://img.youtube.com/vi/' + esc(s.id) + '/hqdefault.jpg" alt="' + esc(alt) + '" loading="lazy">' +
          '<button type="button" class="bs-media-play" data-play-video aria-label="' + esc(bsText('watchVideo')) + '">' +
            '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 2.841A1.5 1.5 0 0 1 8.53 1.35l9.04 4.056a1.5 1.5 0 0 1 0 2.733l-9.04 4.056a1.5 1.5 0 0 1-2.23-1.491V2.841Z" /></svg>' +
          '</button>' +
        '</div>';
      }
      return '<img class="bs-slide bs-slide-img' + (i === 0 ? ' active' : '') + '" ' +
        'src="' + esc(s.src) + '" alt="' + esc(alt) + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '">';
    }).join('');

    var dotsHtml = slides.length > 1
      ? '<div class="bs-media-dots">' +
          slides.map(function (_, i) {
            return '<span class="bs-media-dot' + (i === 0 ? ' active' : '') + '"></span>';
          }).join('') +
        '</div>'
      : '';

    var arrowsHtml = slides.length > 1
      ? '<button type="button" class="bs-media-arrow bs-media-arrow-prev" data-media-prev aria-label="Previous"><i class="bi bi-chevron-left"></i></button>' +
        '<button type="button" class="bs-media-arrow bs-media-arrow-next" data-media-next aria-label="Next"><i class="bi bi-chevron-right"></i></button>'
      : '';

    return '<div class="bs-media" data-media>' +
      '<div class="bs-media-track">' + trackHtml + '</div>' +
      (badge ? '<div class="bs-media-badge">' + badge + '</div>' : '') +
      arrowsHtml +
      dotsHtml +
    '</div>';
  }

  function initMedia(root) {
    root.querySelectorAll('[data-media]').forEach(function (container) {
      var slides = Array.prototype.slice.call(container.querySelectorAll('.bs-slide'));
      var dots   = Array.prototype.slice.call(container.querySelectorAll('.bs-media-dot'));
      var prev   = container.querySelector('[data-media-prev]');
      var next   = container.querySelector('[data-media-next]');

      if (slides.length <= 1) return;

      var current = 0;

      function goTo(idx) {
        slides[current].classList.remove('active');
        if (dots[current]) dots[current].classList.remove('active');
        current = (idx + slides.length) % slides.length;
        slides[current].classList.add('active');
        if (dots[current]) dots[current].classList.add('active');
      }

      if (prev) prev.addEventListener('click', function () { goTo(current - 1); });
      if (next) next.addEventListener('click', function () { goTo(current + 1); });

      dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () { goTo(i); });
      });
    });

    root.querySelectorAll('[data-play-video]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slide = btn.closest('.bs-slide-video');
        if (!slide) return;
        var id     = slide.getAttribute('data-video-id');
        var poster = slide.querySelector('img');
        var alt    = poster ? poster.alt : '';
        slide.innerHTML = '<iframe src="https://www.youtube.com/embed/' + id + '?autoplay=1&rel=0" ' +
          'title="' + esc(alt) + '" ' +
          'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
          'allowfullscreen></iframe>';
      });
    });
  }

})(window);

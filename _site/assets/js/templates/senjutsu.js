/*
 * senjutsu.js — renderer for the "Senjutsu" Japanese menu template.
 *
 * Drives three pages:
 *   - /templates/senjutsu/           (index — category grid,  #menu-root)
 *   - /templates/senjutsu/category/  (category — items list, #category-root)
 *   - /templates/senjutsu/item/      (item detail — gallery + video, #item-root)
 *
 * Data source: a real tenant's menu is loaded from S3 when a tenant is present
 * (?tenant= query param); otherwise the bundled senjutsu-menu.json is used so
 * the template is fully previewable without a tenant.
 *
 * Multi-language: all text elements update when the language is switched via
 * the language selector in the topbar. Language state is persisted in
 * localStorage by MenuCore so it carries across page navigations.
 */
(function (global) {
  'use strict';

  var Core = global.MenuCore;
  var esc = Core.escapeHtml;
  var CONFIG = global.AKUT_CONFIG || {};
  var BUNDLED_MENU = (CONFIG.baseUrl || '').replace(/\/$/, '') + '/assets/data/senjutsu-menu.json';

  var state = { menu: null, tenant: null, menuId: null, lang: null, langs: [] };

  /* ---------------------------------------------------------------- i18n strings specific to senjutsu */

  var SJ_STRINGS = {
    viewCategory: {
      English: 'View Items', Portuguese: 'Ver Itens', Spanish: 'Ver Artículos', French: 'Voir les Articles', Italian: 'Vedi i Piatti'
    },
    backToCategories: {
      English: 'Back to Menu', Portuguese: 'Voltar ao Menu', Spanish: 'Volver al Menú', French: 'Retour au Menu', Italian: 'Torna al Menu'
    },
    categories: {
      English: 'Categories', Portuguese: 'Categorias', Spanish: 'Categorías', French: 'Catégories', Italian: 'Categorie'
    },
    kondate: {
      English: '献立 · Kondate', Portuguese: '献立 · Kondate', Spanish: '献立 · Kondate', French: '献立 · Kondate', Italian: '献立 · Kondate'
    },
    item: {
      English: 'item', Portuguese: 'item', Spanish: 'artículo', French: 'article', Italian: 'piatto'
    },
    itemPlural: {
      English: 'items', Portuguese: 'itens', Spanish: 'artículos', French: 'articles', Italian: 'piatti'
    },
    categoryLabel: {
      English: 'Category', Portuguese: 'Categoria', Spanish: 'Categoría', French: 'Catégorie', Italian: 'Categoria'
    },
    watchVideo: {
      English: 'Watch video', Portuguese: 'Ver vídeo', Spanish: 'Ver vídeo', French: 'Voir la vidéo', Italian: 'Guarda il video'
    },
    stopVideo: {
      English: 'Stop video', Portuguese: 'Parar vídeo', Spanish: 'Detener vídeo', French: 'Arrêter la vidéo', Italian: 'Ferma il video'
    },
    worthTrying: {
      English: 'Worth Trying', Portuguese: 'Vale a Pena Experimentar', Spanish: 'Vale la Pena Probar', French: 'À Essayer Aussi', Italian: 'Da Provare Anche'
    },
    seeAll: {
      English: 'See all', Portuguese: 'Ver todos', Spanish: 'Ver todos', French: 'Voir tout', Italian: 'Vedi tutti'
    },
    backToCategory: {
      English: 'Back to Category', Portuguese: 'Voltar à Categoria', Spanish: 'Volver a la Categoría', French: 'Retour à la Catégorie', Italian: 'Torna alla Categoria'
    }
  };

  /* Kanji symbols paired with each tag badge — one per MenuItemTag value.
     Chosen for the Senjutsu brush-stroke aesthetic. */
  var SJ_TAG_KANJI = {
    1: '新',  /* shin  — new        */
    2: '人気', /* ninki — popular    */
    3: '推',  /* oshi  — recommend  */
    4: '旬',  /* shun  — in-season  */
    5: '限'   /* gen   — limited    */
  };

  function sjText(key) {
    var entry = SJ_STRINGS[key] || {};
    return (state.lang && entry[state.lang]) || entry.English || '';
  }

  /* ---------------------------------------------------------------- init */

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
        if (Core.isPreview()) Core.renderPreviewBand('senjutsu');
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

  function youTubeId(url) {
    if (!url) return null;
    var m = String(url).match(
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    );
    return m ? m[1] : null;
  }

  function buildSlides(item) {
    var slides = buildItemImages(item).map(function (src) { return { type: 'image', src: src }; });
    (item.YouTubeVideoUrls || []).forEach(function (url) {
      var id = youTubeId(url);
      if (id) slides.push({ type: 'video', id: id });
    });
    return slides;
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (el) { el.textContent = value || ''; });
  }

  function firstCategoryImage(cat) {
    var items = sortedItems(cat);
    for (var i = 0; i < items.length; i++) {
      var img = firstItemImage(items[i]);
      if (img) return img;
    }
    return null;
  }

  function firstItemImage(item) {
    var imgs = (item.Images || []).slice().sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); });
    return imgs.length ? (imgs[0].Link && imgs[0].Link.FullSize) : null;
  }

  function buildItemImages(item) {
    return (item.Images || [])
      .slice()
      .sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); })
      .map(function (im) { return im.Link && im.Link.FullSize; })
      .filter(Boolean);
  }

  function sortedCategories(menu) {
    return (menu.Categories || []).slice().sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); });
  }

  function sortedItems(cat) {
    return Core.sortItemsAvailableFirst(cat.Items);
  }

  function itemCountLabel(count) {
    return count + ' ' + (count === 1 ? sjText('item') : sjText('itemPlural'));
  }

  // A temporarily-unavailable item shows an "Unavailable" badge (with the
  // 休 "closed/rest" kanji, matching the per-tag kanji suffix convention)
  // instead of its normal MenuItemTag badge.
  function renderTagBadge(item) {
    if (Core.isTemporarilyUnavailable(item)) {
      return '<span class="sj-badge sj-badge--unavailable">' +
        esc(Core.uiText('tagUnavailable', state.lang)) + ' · 休' +
        '</span>';
    }
    var tag = item && item.Tag;
    if (!tag) return '';
    var cfg = Core.TAG_CONFIG[tag];
    if (!cfg) return '';
    var kanji = SJ_TAG_KANJI[tag] || '';
    var suffix = kanji ? ' · ' + kanji : '';
    return '<span class="sj-badge sj-badge--' + cfg.slug + '">' +
      esc(Core.uiText(cfg.key, state.lang)) + suffix +
      '</span>';
  }

  /* ------------------------------------------------------------ shared chrome */

  function setupChrome() {
    var menu    = state.menu;
    var name    = L(menu.Name) || Core.uiText('menu', state.lang);
    var logoUrl = menu.Logo && menu.Logo.Link && menu.Logo.Link.Thumbnail;

    if (logoUrl) {
      document.querySelectorAll('.sj-brand').forEach(function (brand) {
        var mark = brand.querySelector('.sj-brand-mark');
        if (mark) mark.innerHTML = '<img src="' + esc(logoUrl) + '" alt="' + esc(name) + '">';
      });
    }

    document.querySelectorAll('[data-menu-home]').forEach(function (a) { a.setAttribute('href', homeUrl()); });
    setText('[data-menu-name]',        name);
    setText('[data-menu-description]', L(menu.Description));
    setText('[data-availability]', Core.formatAvailability(menu, state.lang));
    setText('[data-founded-year]', Core.formatFoundedYear(menu, state.lang));
    setText('[data-current-year]',     new Date().getFullYear());
    document.title = name;
    applyI18n();
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = Core.uiText(el.getAttribute('data-i18n'), state.lang);
    });
    document.querySelectorAll('[data-sj-i18n]').forEach(function (el) {
      el.textContent = sjText(el.getAttribute('data-sj-i18n'));
    });
  }

  /* ------------------------------------------------------------ lang switcher */

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

  /* ------------------------------------------------------------- index page */

  function renderIndex(root) {
    var cats = sortedCategories(state.menu);

    if (!cats.length) {
      root.innerHTML = '<div class="sj-empty"><p>' + esc(Core.uiText('noItems', state.lang)) + '</p></div>';
      return;
    }

    var cards = cats.map(function (cat, idx) { return renderCatCard(cat, idx); }).join('');
    root.innerHTML = '<div class="sj-cat-grid">' + cards + '</div>';
  }

  function renderCatCard(cat, idx) {
    var items = sortedItems(cat);
    var img   = firstCategoryImage(cat);
    var desc  = L(cat.Description);

    var mediaHtml = img
      ? '<img src="' + esc(img) + '" alt="' + esc(L(cat.Name)) + '" loading="lazy">'
      : '<div class="sj-cat-card-no-img"><div class="sj-cat-card-no-img-mark"></div></div>';

    return '' +
      '<a class="sj-cat-card" href="' + esc(categoryUrl(cat.Id)) + '">' +
        '<div class="sj-cat-card-media">' +
          mediaHtml +
          '<span class="sj-cat-card-num">' + String(idx + 1).padStart(2, '0') + '</span>' +
        '</div>' +
        '<div class="sj-cat-card-body">' +
          '<div class="sj-cat-card-row">' +
            '<h3 class="sj-cat-card-name">' + esc(L(cat.Name)) + '</h3>' +
            '<span class="sj-cat-card-count">' + esc(itemCountLabel(items.length)) + '</span>' +
          '</div>' +
          '<span class="sj-cat-card-rule"></span>' +
          (desc ? '<p class="sj-cat-card-desc">' + esc(desc) + '</p>' : '<p class="sj-cat-card-desc"></p>') +
          '<div class="sj-cat-card-action">' +
            '<span class="sj-cat-btn">' +
              esc(sjText('viewCategory')) +
              '<span aria-hidden="true">→</span>' +
            '</span>' +
          '</div>' +
        '</div>' +
      '</a>';
  }

  /* ---------------------------------------------------------- category page */

  function renderCategory(root) {
    var menu   = state.menu;
    var catId  = getCategoryId();
    var cats   = menu.Categories || [];
    var cat    = null;

    for (var c = 0; c < cats.length; c++) {
      if (String(cats[c].Id) === String(catId)) { cat = cats[c]; break; }
    }

    if (!cat) {
      Core.renderError(root, { code: 'NOT_FOUND' }, state.lang);
      return;
    }

    var catName = L(cat.Name);
    setText('[data-cat-name-crumb]', catName);
    document.title = catName || sjText('categoryLabel');

    var items = sortedItems(cat);
    var desc  = L(cat.Description);

    var headerHtml =
      '<header class="sj-cat-header">' +
        '<div class="sj-cat-header-inner">' +
          '<p class="sj-cat-eyebrow">' + esc(sjText('categoryLabel')) + '</p>' +
          '<h1 class="sj-cat-title">' + esc(catName) + '</h1>' +
          '<span class="sj-cat-rule"></span>' +
          (desc ? '<p class="sj-cat-desc-text">' + esc(desc) + '</p>' : '') +
        '</div>' +
      '</header>';

    var itemsHtml =
      '<section class="sj-items-section">' +
        '<div class="sj-container">' +
          '<ul class="sj-item-list">' +
            items.map(function (item, idx) { return renderItemCard(item, idx); }).join('') +
          '</ul>' +
          '<div class="sj-bottom-back">' +
            '<a class="sj-bottom-back-btn" href="' + esc(homeUrl()) + '">' +
              '← ' + esc(sjText('backToCategories')) +
            '</a>' +
          '</div>' +
        '</div>' +
      '</section>';

    root.innerHTML = headerHtml + itemsHtml;
  }

  function renderItemCard(item, idx) {
    var images = buildItemImages(item);
    var price  = Core.formatPrice(item.Price, state.menu.Currency, state.lang);
    var diets  = Core.dietLabels(item.Diets, state.lang);
    var allergens   = Core.allergenLabels(item.Allergens, state.lang).join(', ');
    var ingredients = L(item.Ingredients);
    var fullDesc    = L(item.FullDescription) || L(item.ShortDescription);
    var alt         = esc(L(item.Name));
    var faded       = Core.isTemporarilyUnavailable(item) ? ' menu-item-faded' : '';
    var availNote   = Core.standardAvailabilityText(item, state.lang);
    var hasDetail   = Core.templatePath('detail', state.menu.TemplateId);
    var detailHref  = hasDetail ? itemUrl(item.Id) : null;

    // Category list shows a single static thumbnail — the full gallery and
    // any video live on the item detail page (data-media carousel there).
    var mediaHtml = images.length
      ? '<img class="sj-item-thumb" src="' + esc(images[0]) + '" alt="' + alt + '" loading="' + (idx === 0 ? 'eager' : 'lazy') + '">'
      : '<div class="sj-item-no-img"><div class="sj-item-no-img-mark"></div></div>';

    var cardLinkHtml = detailHref
      ? '<a class="sj-item-card-link" href="' + esc(detailHref) + '" aria-label="' + alt + '"></a>'
      : '';

    var badge = renderTagBadge(item);

    var dietTags = diets.length
      ? '<div class="sj-tags">' + diets.map(function (d) {
          return '<span class="sj-tag">' + esc(d) + '</span>';
        }).join('') + '</div>'
      : '';

    var dlHtml = '';
    if (allergens || ingredients) {
      dlHtml = '<dl class="sj-item-dl">';
      if (allergens) {
        dlHtml +=
          '<div class="sj-item-dl-row">' +
            '<dt class="sj-item-dt">' + esc(Core.uiText('allergens', state.lang)) + ':</dt>' +
            '<dd class="sj-item-dd">' + esc(allergens) + '</dd>' +
          '</div>';
      }
      if (ingredients) {
        dlHtml +=
          '<div class="sj-item-dl-row">' +
            '<dt class="sj-item-dt">' + esc(Core.uiText('ingredients', state.lang)) + ':</dt>' +
            '<dd class="sj-item-dd">' + esc(ingredients) + '</dd>' +
          '</div>';
      }
      dlHtml += '</dl>';
    }

    return '' +
      '<li>' +
        '<article class="sj-item-card' + faded + '">' +
          cardLinkHtml +
          '<div class="sj-item-media">' +
            mediaHtml +
            badge +
          '</div>' +
          '<div class="sj-item-content">' +
            '<div class="sj-item-head">' +
              '<div>' +
                '<span class="sj-item-num">' + String(idx + 1).padStart(2, '0') + '</span>' +
                '<h2 class="sj-item-name">' + esc(L(item.Name)) + '</h2>' +
              '</div>' +
              (price ? '<div class="sj-item-price">' + esc(price) + '</div>' : '') +
            '</div>' +
            (L(item.ShortDescription)
              ? '<p class="sj-item-short-desc">' + esc(L(item.ShortDescription)) + '</p>'
              : '') +
            (availNote ? '<p class="menu-availability-note"><i class="bi bi-calendar2-week" aria-hidden="true"></i> ' + esc(availNote) + '</p>' : '') +
            '<span class="sj-item-rule"></span>' +
            (fullDesc ? '<p class="sj-item-full-desc">' + esc(fullDesc) + '</p>' : '') +
            dietTags +
            dlHtml +
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

    document.querySelectorAll('[data-menu-home]').forEach(function (a) {
      a.setAttribute('href', categoryUrl(cat.Id));
    });
    document.querySelectorAll('[data-sj-i18n="backToCategories"]').forEach(function (el) {
      el.textContent = L(cat.Name) || sjText('backToCategory');
    });

    var price       = Core.formatPrice(item.Price, state.menu.Currency, state.lang);
    var diets       = Core.dietLabels(item.Diets, state.lang);
    var allergens   = Core.allergenLabels(item.Allergens, state.lang).join(', ');
    var ingredients = L(item.Ingredients);
    var shortDesc   = L(item.ShortDescription);
    var fullDesc    = L(item.FullDescription) || shortDesc;
    var availNote   = Core.standardAvailabilityText(item, state.lang);
    var badge       = renderTagBadge(item);

    var slides    = buildSlides(item);
    var mediaHtml = renderMedia(slides, L(item.Name));

    var dietsHtml = diets.length
      ? '<div class="sj-tags">' + diets.map(function (d) {
          return '<span class="sj-tag">' + esc(d) + '</span>';
        }).join('') + '</div>'
      : '';

    var dlHtml = '';
    if (allergens || ingredients) {
      dlHtml = '<dl class="sj-item-dl">';
      if (allergens) {
        dlHtml +=
          '<div class="sj-item-dl-row">' +
            '<dt class="sj-item-dt">' + esc(Core.uiText('allergens', state.lang)) + ':</dt>' +
            '<dd class="sj-item-dd">' + esc(allergens) + '</dd>' +
          '</div>';
      }
      if (ingredients) {
        dlHtml +=
          '<div class="sj-item-dl-row">' +
            '<dt class="sj-item-dt">' + esc(Core.uiText('ingredients', state.lang)) + ':</dt>' +
            '<dd class="sj-item-dd">' + esc(ingredients) + '</dd>' +
          '</div>';
      }
      dlHtml += '</dl>';
    }

    var breadcrumbHtml =
      '<nav class="sj-breadcrumb" aria-label="breadcrumb">' +
        '<a href="' + esc(homeUrl()) + '">' + esc(Core.uiText('menu', state.lang)) + '</a>' +
        '<span aria-hidden="true">·</span>' +
        '<a href="' + esc(categoryUrl(cat.Id)) + '">' + esc(L(cat.Name)) + '</a>' +
      '</nav>';

    var related = sortedItems(cat).filter(function (i) {
      return String(i.Id) !== String(item.Id) && !Core.isTemporarilyUnavailable(i);
    }).slice(0, 3);
    var relatedHtml = related.length
      ? '<section class="sj-related">' +
          '<div class="sj-container">' +
            '<div class="sj-related-head">' +
              '<h2 class="sj-related-title">' + esc(sjText('worthTrying')) + '</h2>' +
              '<a class="sj-related-see-all" href="' + esc(categoryUrl(cat.Id)) + '">' + esc(sjText('seeAll')) + '</a>' +
            '</div>' +
            '<div class="sj-related-grid">' +
              related.map(function (r) { return renderRelatedCard(r); }).join('') +
            '</div>' +
          '</div>' +
        '</section>'
      : '';

    root.innerHTML =
      '<div class="sj-item-page">' +
        '<div class="sj-container">' +
          breadcrumbHtml +
          '<div class="sj-item-detail-layout">' +
            '<div class="sj-item-detail-media" data-media>' + mediaHtml + badge + '</div>' +
            '<article class="sj-item-detail">' +
              '<p class="sj-cat-eyebrow">' + esc(L(cat.Name)) + '</p>' +
              '<h1 class="sj-item-detail-title">' + esc(L(item.Name)) + '</h1>' +
              '<span class="sj-item-rule"></span>' +
              (price ? '<p class="sj-item-detail-price">' + esc(price) + '</p>' : '') +
              (shortDesc ? '<p class="sj-item-short-desc">' + esc(shortDesc) + '</p>' : '') +
              (availNote ? '<p class="menu-availability-note"><i class="bi bi-calendar2-week" aria-hidden="true"></i> ' + esc(availNote) + '</p>' : '') +
              (fullDesc && fullDesc !== shortDesc ? '<p class="sj-item-full-desc">' + esc(fullDesc) + '</p>' : '') +
              dietsHtml +
              dlHtml +
            '</article>' +
          '</div>' +
        '</div>' +
        relatedHtml +
        '<div class="sj-bottom-back">' +
          '<a class="sj-bottom-back-btn" href="' + esc(categoryUrl(cat.Id)) + '">' +
            '← ' + esc(L(cat.Name) || sjText('backToCategory')) +
          '</a>' +
        '</div>' +
      '</div>';

    initMedia(root);
  }

  function renderRelatedCard(item) {
    var images  = buildItemImages(item);
    var price   = Core.formatPrice(item.Price, state.menu.Currency, state.lang);
    var nameAlt = L(item.Name);
    var mediaHtml = images.length
      ? '<img src="' + esc(images[0]) + '" alt="' + esc(nameAlt) + '" loading="lazy">'
      : '<div class="sj-related-card-noimg"><div class="sj-item-no-img-mark"></div></div>';

    return '' +
      '<a class="sj-related-card" href="' + esc(itemUrl(item.Id)) + '">' +
        '<div class="sj-related-card-media">' + mediaHtml + '</div>' +
        '<div class="sj-related-card-body">' +
          '<div class="sj-related-card-title">' + esc(nameAlt) + '</div>' +
          (price ? '<div class="sj-related-card-price">' + esc(price) + '</div>' : '') +
        '</div>' +
      '</a>';
  }

  /* ================================================= ITEM MEDIA (images + video) */

  function videoPosterHtml(id, alt) {
    return '<img class="sj-gallery-video-poster" src="https://img.youtube.com/vi/' + esc(id) + '/hqdefault.jpg" alt="' + esc(alt) + '" loading="lazy">' +
      '<button type="button" class="sj-gallery-play" data-play-video aria-label="' + esc(sjText('watchVideo')) + '">' +
        '<i class="bi bi-play-fill" aria-hidden="true"></i>' +
      '</button>';
  }

  function renderMedia(slides, alt) {
    if (!slides.length) {
      return '<div class="sj-gallery-track"><div class="sj-item-no-img"><div class="sj-item-no-img-mark"></div></div></div>';
    }

    var trackHtml = slides.map(function (s, i) {
      if (s.type === 'video') {
        return '<div class="sj-gallery-slide sj-gallery-video' + (i === 0 ? ' active' : '') + '" ' +
          'data-video-id="' + esc(s.id) + '" data-video-alt="' + esc(alt) + '">' +
          videoPosterHtml(s.id, alt) +
        '</div>';
      }
      return '<img class="sj-gallery-slide sj-gallery-img' + (i === 0 ? ' active' : '') + '" ' +
        'src="' + esc(s.src) + '" alt="' + esc(alt) + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '">';
    }).join('');

    var arrowsHtml = slides.length > 1
      ? '<button type="button" class="sj-img-arrow sj-img-arrow-prev" data-img-prev aria-label="Previous slide"><i class="bi bi-chevron-left"></i></button>' +
        '<button type="button" class="sj-img-arrow sj-img-arrow-next" data-img-next aria-label="Next slide"><i class="bi bi-chevron-right"></i></button>'
      : '';

    var dotsHtml = slides.length > 1
      ? '<div class="sj-img-dots">' +
          slides.map(function (_, i) {
            return '<span class="sj-img-dot' + (i === 0 ? ' active' : '') + '"></span>';
          }).join('') +
        '</div>'
      : '';

    var firstImage = slides[0].type === 'image' ? slides[0].src : null;
    var zoomHtml = firstImage
      ? '<a class="sj-zoom" data-zoom href="' + esc(firstImage) + '" aria-label="Zoom image"><i class="bi bi-zoom-in"></i></a>'
      : '';

    return '<div class="sj-gallery-track">' + trackHtml + '</div>' + arrowsHtml + dotsHtml + zoomHtml;
  }

  // Reverts a video slide back to its poster + play button, discarding the
  // live iframe — the only reliable way to actually stop YouTube playback.
  function stopVideoSlide(slide) {
    if (!slide || !slide.querySelector('iframe')) return;
    var id  = slide.getAttribute('data-video-id');
    var alt = slide.getAttribute('data-video-alt') || '';
    slide.innerHTML = videoPosterHtml(id, alt);
  }

  function playVideoSlide(slide) {
    var id  = slide.getAttribute('data-video-id');
    var alt = slide.getAttribute('data-video-alt') || '';
    slide.innerHTML =
      '<iframe src="https://www.youtube.com/embed/' + id + '?autoplay=1&rel=0" ' +
        'title="' + esc(alt) + '" ' +
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
        'allowfullscreen></iframe>' +
      '<button type="button" class="sj-gallery-stop" data-stop-video aria-label="' + esc(sjText('stopVideo')) + '">' +
        '<i class="bi bi-x-lg"></i>' +
      '</button>';
  }

  function initMedia(root) {
    root.querySelectorAll('[data-media]').forEach(function (container) {
      var slides = Array.prototype.slice.call(container.querySelectorAll('.sj-gallery-slide'));
      var dots   = Array.prototype.slice.call(container.querySelectorAll('.sj-img-dot'));
      var prev   = container.querySelector('[data-img-prev]');
      var next   = container.querySelector('[data-img-next]');
      var zoom   = container.querySelector('[data-zoom]');

      if (zoom && global.jQuery && global.jQuery.fn.magnificPopup) {
        global.jQuery(zoom).magnificPopup({ type: 'image' });
      }

      if (slides.length <= 1) return;

      var current = 0;

      function goTo(idx) {
        var leaving = slides[current];
        slides[current].classList.remove('active');
        if (dots[current]) dots[current].classList.remove('active');
        current = (idx + slides.length) % slides.length;
        slides[current].classList.add('active');
        if (dots[current]) dots[current].classList.add('active');
        if (zoom) {
          var isImage = slides[current].classList.contains('sj-gallery-img');
          zoom.style.display = isImage ? '' : 'none';
          if (isImage) zoom.setAttribute('href', slides[current].src);
        }
        stopVideoSlide(leaving);
      }

      if (prev) prev.addEventListener('click', function () { goTo(current - 1); });
      if (next) next.addEventListener('click', function () { goTo(current + 1); });

      dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () { goTo(i); });
      });
    });

    // Delegated: the play/stop buttons are recreated (via innerHTML swaps)
    // every time a video is played or stopped, so listeners bound directly
    // to them would only ever work once.
    root.addEventListener('click', function (e) {
      var playBtn = e.target.closest('[data-play-video]');
      if (playBtn) {
        var slide = playBtn.closest('.sj-gallery-video');
        if (slide) playVideoSlide(slide);
        return;
      }
      var stopBtn = e.target.closest('[data-stop-video]');
      if (stopBtn) {
        var vSlide = stopBtn.closest('.sj-gallery-video');
        if (vSlide) stopVideoSlide(vSlide);
      }
    });
  }

})(window);

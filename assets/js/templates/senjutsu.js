/*
 * senjutsu.js — renderer for the "Senjutsu" Japanese menu template.
 *
 * Drives two pages (no item detail page in this template):
 *   - /templates/senjutsu/           (index — category grid,  #menu-root)
 *   - /templates/senjutsu/category/  (category — items list, #category-root)
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

  var state = { menu: null, tenant: null, lang: null, langs: [] };

  /* ---------------------------------------------------------------- i18n strings specific to senjutsu */

  var SJ_STRINGS = {
    viewCategory: {
      English: 'View Items', Portuguese: 'Ver Itens', Spanish: 'Ver Artículos', French: 'Voir les Articles'
    },
    backToCategories: {
      English: 'Back to Menu', Portuguese: 'Voltar ao Menu', Spanish: 'Volver al Menú', French: 'Retour au Menu'
    },
    categories: {
      English: 'Categories', Portuguese: 'Categorias', Spanish: 'Categorías', French: 'Catégories'
    },
    kondate: {
      English: '献立 · Kondate', Portuguese: '献立 · Kondate', Spanish: '献立 · Kondate', French: '献立 · Kondate'
    },
    item: {
      English: 'item', Portuguese: 'item', Spanish: 'artículo', French: 'article'
    },
    itemPlural: {
      English: 'items', Portuguese: 'itens', Spanish: 'artículos', French: 'articles'
    },
    categoryLabel: {
      English: 'Category', Portuguese: 'Categoria', Spanish: 'Categoría', French: 'Catégorie'
    },
    watchOnYouTube: {
      English: 'Watch on YouTube', Portuguese: 'Ver no YouTube', Spanish: 'Ver en YouTube', French: 'Voir sur YouTube'
    }
  };

  function sjText(key) {
    var entry = SJ_STRINGS[key] || {};
    return (state.lang && entry[state.lang]) || entry.English || '';
  }

  /* ---------------------------------------------------------------- init */

  document.addEventListener('DOMContentLoaded', function () {
    state.tenant = queryTenant();
    var menuRoot     = document.getElementById('menu-root');
    var categoryRoot = document.getElementById('category-root');
    var fallback     = menuRoot || categoryRoot || document.querySelector('main');

    loadMenu(state.tenant)
      .then(function (menu) {
        state.menu  = menu;
        state.langs = Core.availableLanguages(menu);
        state.lang  = Core.pickLanguage(menu, state.langs);
        setupChrome();
        setupLangSwitcher();
        if (menuRoot)     renderIndex(menuRoot);
        else if (categoryRoot) renderCategory(categoryRoot);
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

  function getCategoryId() {
    return new global.URLSearchParams(global.location.search).get('category');
  }

  function loadMenu(tenant) {
    if (tenant) return Core.fetchMenu(tenant);
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
    return state.tenant ? Core.withTenant(url, state.tenant) : url;
  }

  function categoryUrl(catId) {
    var url   = Core.templatePath('category', state.menu.TemplateId);
    var param = 'category=' + encodeURIComponent(catId);
    return state.tenant
      ? Core.withTenant(url, state.tenant, param)
      : url + (url.indexOf('?') === -1 ? '?' : '&') + param;
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
    return (cat.Items || []).slice().sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); });
  }

  function itemCountLabel(count) {
    return count + ' ' + (count === 1 ? sjText('item') : sjText('itemPlural'));
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
    setText('[data-menu-notes]',       menu.Notes || '');
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
      Core.saveLang(state.lang);
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
    if (menuRoot)     renderIndex(menuRoot);
    else if (categoryRoot) renderCategory(categoryRoot);
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
      '<article class="sj-cat-card">' +
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
            '<a class="sj-cat-btn" href="' + esc(categoryUrl(cat.Id)) + '">' +
              esc(sjText('viewCategory')) +
              '<span aria-hidden="true">→</span>' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</article>';
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
    initItemGalleries(root);
  }

  function initItemGalleries(root) {
    root.querySelectorAll('[data-gallery]').forEach(function (container) {
      var imgs = container.querySelectorAll('.sj-gallery-img');
      var dots = container.querySelectorAll('.sj-img-dot');
      var prev = container.querySelector('[data-img-prev]');
      var next = container.querySelector('[data-img-next]');
      if (imgs.length <= 1) return;

      var current = 0;

      function goTo(idx) {
        imgs[current].classList.remove('active');
        dots[current].classList.remove('active');
        current = (idx + imgs.length) % imgs.length;
        imgs[current].classList.add('active');
        dots[current].classList.add('active');
      }

      if (prev) prev.addEventListener('click', function () { goTo(current - 1); });
      if (next) next.addEventListener('click', function () { goTo(current + 1); });
    });
  }

  function firstYouTubeUrl(item) {
    var urls = item.YouTubeVideoUrls || [];
    return urls.length ? urls[0] : null;
  }

  function renderItemCard(item, idx) {
    var images = buildItemImages(item);
    var price  = Core.formatPrice(item.Price, state.menu.Currency);
    var diets  = Core.dietLabels(item.Diets, state.lang);
    var allergens   = L(item.Allergens);
    var ingredients = L(item.Ingredients);
    var fullDesc    = L(item.FullDescription) || L(item.ShortDescription);
    var ytUrl       = firstYouTubeUrl(item);
    var alt         = esc(L(item.Name));
    var multi       = images.length > 1;

    var trackHtml = images.length
      ? images.map(function (url, i) {
          return '<img class="sj-gallery-img' + (i === 0 ? ' active' : '') + '" src="' + esc(url) + '" alt="' + alt + '" loading="' + (i === 0 ? 'eager' : 'lazy') + '">';
        }).join('')
      : '<div class="sj-item-no-img"><div class="sj-item-no-img-mark"></div></div>';

    var arrowsHtml = multi
      ? '<button type="button" class="sj-img-arrow sj-img-arrow-prev" data-img-prev aria-label="Previous image"><i class="bi bi-chevron-left"></i></button>' +
        '<button type="button" class="sj-img-arrow sj-img-arrow-next" data-img-next aria-label="Next image"><i class="bi bi-chevron-right"></i></button>'
      : '';

    var dotsHtml = multi
      ? '<div class="sj-img-dots">' +
          images.map(function (_, i) {
            return '<span class="sj-img-dot' + (i === 0 ? ' active' : '') + '"></span>';
          }).join('') +
        '</div>'
      : '';

    var mediaHtml = '<div class="sj-gallery-track">' + trackHtml + '</div>' + arrowsHtml + dotsHtml;

    var newBadge = item.IsNew
      ? '<span class="sj-new-badge">' + esc(Core.uiText('newBadge', state.lang)) + ' · 新</span>'
      : '';

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
        '<article class="sj-item-card">' +
          '<div class="sj-item-media" data-gallery>' +
            mediaHtml +
            newBadge +
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
            '<span class="sj-item-rule"></span>' +
            (fullDesc ? '<p class="sj-item-full-desc">' + esc(fullDesc) + '</p>' : '') +
            dietTags +
            dlHtml +
            (ytUrl
              ? '<a class="sj-youtube-btn" href="' + esc(ytUrl) + '" target="_blank" rel="noopener noreferrer">' +
                  '<i class="bi bi-play-fill" aria-hidden="true"></i>' +
                  esc(sjText('watchOnYouTube')) +
                '</a>'
              : '') +
          '</div>' +
        '</article>' +
      '</li>';
  }

})(window);

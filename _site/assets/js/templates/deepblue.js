/*
 * deepblue.js — renderer for the "Deep Blue" template.
 *
 * Drives both pages:
 *   - /templates/deepblue/         (main menu,  container #menu-root)
 *   - /templates/deepblue/detail/  (item detail, container #detail-root)
 *
 * Data source: a real tenant's menu is loaded from S3 when a tenant is present
 * (?tenant= or path segment); otherwise the template renders from its own
 * bundled menu stored in the project at assets/data/deepblue-menu.json. This
 * keeps the template fully previewable on its own while still supporting the
 * shared multi-tenant runtime and every capability of the epicurean template.
 */
(function (global) {
  'use strict';

  var Core = global.MenuCore;
  var esc = Core.escapeHtml;
  var CONFIG = global.AKUT_CONFIG || {};
  var BUNDLED_MENU = (CONFIG.baseUrl || '').replace(/\/$/, '') + '/assets/data/deepblue-menu.json';

  var state = { menu: null, tenant: null, lang: null, langs: [] };

  /* ---------------------------------------------------- decorative motifs */
  // Thin hand-drawn line-art used as elegant section ornaments. They cycle per
  // category so each part of the menu carries a different sea creature.
  function svgMotif(inner, vb) {
    return '<svg class="db-motif" viewBox="' + vb + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  var MOTIF_SHELL = svgMotif(
    '<path d="M32 50 C 13 49 6 28 10 17 C 18 7 46 7 54 17 C 58 28 51 49 32 50 Z"/>' +
    '<path d="M32 50 L 13 19 M32 50 L 22 14 M32 50 L 32 12 M32 50 L 42 14 M32 50 L 51 19"/>' +
    '<path d="M27 49 C 29 52 35 52 37 49"/>', '0 0 64 56');
  var MOTIF_FISH = svgMotif(
    '<path d="M6 20 C 18 7 45 7 58 20 C 45 33 18 33 6 20 Z"/>' +
    '<path d="M58 20 C 64 14 70 12 75 10 C 72 16 72 24 75 30 C 70 28 64 26 58 20 Z"/>' +
    '<path d="M21 13 C 27 17 27 23 22 27"/>' +
    '<circle cx="16" cy="17" r="1.2" fill="currentColor" stroke="none"/>', '0 0 80 40');
  var MOTIF_SHRIMP = svgMotif(
    '<path d="M46 12 C 26 7 11 21 15 35 C 18 46 33 49 45 42"/>' +
    '<path d="M46 12 C 52 10 56 14 53 18"/>' +
    '<path d="M15 35 C 9 37 7 43 11 47"/>' +
    '<path d="M22 39 l -3 6 M29 43 l -2 6 M36 44 l -1 6"/>' +
    '<circle cx="46" cy="17" r="1.1" fill="currentColor" stroke="none"/>', '0 0 64 56');
  var MOTIF_CRAB = svgMotif(
    '<path d="M24 32 C 24 24 48 24 48 32 C 48 39 41 43 36 43 C 31 43 24 39 24 32 Z"/>' +
    '<path d="M31 26 V 20 M41 26 V 20"/>' +
    '<circle cx="31" cy="19" r="1.1" fill="currentColor" stroke="none"/>' +
    '<circle cx="41" cy="19" r="1.1" fill="currentColor" stroke="none"/>' +
    '<path d="M24 31 C 16 30 10 26 8 20 C 14 19 18 22 19 26"/>' +
    '<path d="M48 31 C 56 30 62 26 64 20 C 58 19 54 22 53 26"/>' +
    '<path d="M25 35 l -8 4 M27 38 l -7 5 M29 41 l -6 5"/>' +
    '<path d="M47 35 l 8 4 M45 38 l 7 5 M43 41 l 6 5"/>', '0 0 72 56');
  var MOTIF_STAR = svgMotif(
    '<path d="M28 7 L 33.5 21 L 48 22 L 37 31.5 L 41 46 L 28 38 L 15 46 L 19 31.5 L 8 22 L 22.5 21 Z"/>' +
    '<circle cx="28" cy="25" r="1" fill="currentColor" stroke="none"/>', '0 0 56 52');
  var MOTIFS = [MOTIF_SHELL, MOTIF_FISH, MOTIF_SHRIMP, MOTIF_CRAB, MOTIF_STAR];
  function motif(i) { return MOTIFS[((i % MOTIFS.length) + MOTIFS.length) % MOTIFS.length]; }

  document.addEventListener('DOMContentLoaded', function () {
    // Template pages always receive a real tenant via ?tenant= (the dispatcher
    // appends it). The path segment "deepblue" is the template name, not a
    // tenant — so resolve the tenant from the query string only and otherwise
    // fall back to the project-bundled menu.
    state.tenant = queryTenant();
    var menuRoot = document.getElementById('menu-root');
    var detailRoot = document.getElementById('detail-root');
    var fallback = menuRoot || detailRoot || document.querySelector('main');

    loadMenu(state.tenant)
      .then(function (menu) {
        state.menu = menu;
        state.langs = Core.availableLanguages(menu);
        state.lang = Core.pickLanguage(menu, state.langs);
        setupChrome();
        setupLangSwitcher();
        if (menuRoot) renderMain(menuRoot);
        else if (detailRoot) renderDetail(detailRoot);
      })
      .catch(function (err) {
        Core.renderError(fallback, err, state.lang);
      });
  });

  function queryTenant() {
    var q = new global.URLSearchParams(global.location.search).get('tenant');
    return q && q.trim() ? q.trim() : null;
  }

  // Tenant menu from S3 when present, otherwise the project-bundled menu.
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

  /* --------------------------------------------------------------- helpers */

  function L(field) { return Core.t(field, state.lang); }

  function homeUrl() {
    var url = Core.templatePath('main', state.menu.TemplateId);
    return state.tenant ? Core.withTenant(url, state.tenant) : url;
  }
  function detailUrl(itemId) {
    var url = Core.templatePath('detail', state.menu.TemplateId);
    var item = 'item=' + encodeURIComponent(itemId);
    return state.tenant
      ? Core.withTenant(url, state.tenant, item)
      : url + (url.indexOf('?') === -1 ? '?' : '&') + item;
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (el) { el.textContent = value || ''; });
  }

  function firstImage(item) {
    var imgs = (item.Images || []).slice().sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); });
    return imgs.length ? imgs[0].Link : null;
  }

  // Extracts the 11-char video id from common YouTube URL shapes.
  function youTubeId(url) {
    if (!url) return null;
    var m = String(url).match(
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    );
    return m ? m[1] : null;
  }

  // Images (sorted by Order) first, then parseable YouTube videos.
  function buildMedia(item) {
    var media = (item.Images || [])
      .slice()
      .sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); })
      .map(function (im) { return { type: 'image', url: im.Link, thumb: im.Link }; });

    (item.YouTubeVideoUrls || []).forEach(function (url) {
      var id = youTubeId(url);
      if (!id) return;
      media.push({
        type: 'video',
        url: url,
        embed: 'https://www.youtube.com/embed/' + id,
        thumb: 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg'
      });
    });
    return media;
  }

  function sortedCategories(menu) {
    return (menu.Categories || []).slice().sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); });
  }
  function sortedItems(cat) {
    return (cat.Items || []).slice().sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); });
  }

  function findItem(menu, itemId) {
    var cats = menu.Categories || [];
    for (var c = 0; c < cats.length; c++) {
      var items = cats[c].Items || [];
      for (var i = 0; i < items.length; i++) {
        if (String(items[i].Id) === String(itemId)) return { item: items[i], category: cats[c] };
      }
    }
    return null;
  }

  /* ----------------------------------------------------------- shared chrome */

  function setupChrome() {
    var menu = state.menu;
    var name = L(menu.Name) || Core.uiText('menu', state.lang);

    // The brand uses a logo image when the menu carries one; otherwise the
    // static icon + name already present in the markup is kept.
    var logoUrl = menu.Logo && menu.Logo.Link;
    if (logoUrl) {
      document.querySelectorAll('.db-brand').forEach(function (brand) {
        var mark = brand.querySelector('.db-brand-mark');
        if (mark) {
          mark.innerHTML = '<img src="' + esc(logoUrl) + '" alt="' + esc(name) + '">';
          mark.classList.add('db-brand-mark-img');
        }
      });
    }

    document.querySelectorAll('[data-menu-home]').forEach(function (a) { a.setAttribute('href', homeUrl()); });
    setText('[data-menu-name]', name);
    setText('[data-menu-description]', L(menu.Description));
    setText('[data-menu-notes]', menu.Notes || '');
    setText('[data-current-year]', new Date().getFullYear());
    document.title = name;
    applyI18n();
  }

  // Translate any static markup tagged with data-i18n="<key>".
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = Core.uiText(el.getAttribute('data-i18n'), state.lang);
    });
  }

  function setupLangSwitcher() {
    var wrap = document.querySelector('[data-lang-switcher]');
    if (!wrap) return;
    if (state.langs.length <= 1) { wrap.hidden = true; return; }
    wrap.hidden = false;

    var label = wrap.querySelector('[data-lang-current-label]');
    var list = wrap.querySelector('[data-lang-menu]');
    var btn = wrap.querySelector('.lang-current');

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
    var menuRoot = document.getElementById('menu-root');
    var detailRoot = document.getElementById('detail-root');
    if (menuRoot) renderMain(menuRoot);
    else if (detailRoot) renderDetail(detailRoot);
  }

  /* ----------------------------------------------------------- main menu page */

  function renderMain(root) {
    var menu = state.menu;
    var cats = sortedCategories(menu);

    if (!cats.length) {
      root.innerHTML = '<div class="db-empty"><p>' + esc(Core.uiText('noItems', state.lang)) + '</p></div>';
      return;
    }

    root.innerHTML =
      renderNav(cats) +
      cats.map(function (cat, i) { return renderCategory(cat, i); }).join('');
  }

  // Sticky in-page category jump nav.
  function renderNav(cats) {
    if (cats.length < 2) return '';
    return '<nav class="db-catnav"><ul class="custom-ul">' +
      cats.map(function (cat) {
        return '<li><a href="#db-cat-' + esc(cat.Id) + '">' + esc(L(cat.Name)) + '</a></li>';
      }).join('') +
    '</ul></nav>';
  }

  // Centered ornament: hairline — sea-creature motif — hairline.
  function ornament(index) {
    return '<span class="db-rule"><span class="db-rule-line"></span>' +
      '<span class="db-rule-mark">' + motif(index) + '</span>' +
      '<span class="db-rule-line"></span></span>';
  }

  function renderCategory(cat, index) {
    var items = sortedItems(cat);
    var desc = L(cat.Description);
    var head =
      '<div class="db-cat-head">' +
        '<h2 class="db-cat-title">' + esc(L(cat.Name)) + '</h2>' +
        ornament(index) +
        (desc ? '<p class="db-cat-desc">' + esc(desc) + '</p>' : '') +
      '</div>';

    var body = '<div class="db-grid">' + items.map(renderItem).join('') + '</div>';

    return '<section class="db-cat" id="db-cat-' + esc(cat.Id) + '">' + head + body + '</section>';
  }

  function renderItem(item) {
    var img = firstImage(item);
    var price = Core.formatPrice(item.Price, state.menu.Currency);
    var diets = Core.dietLabels(item.Diets, state.lang).map(function (d) {
      return '<span class="db-tag">' + esc(d) + '</span>';
    }).join('');
    var newBadge = item.IsNew ? '<span class="db-new">' + esc(Core.uiText('newBadge', state.lang)) + '</span>' : '';

    return '' +
      '<a class="db-card" href="' + esc(detailUrl(item.Id)) + '" aria-label="' + esc(L(item.Name)) + '">' +
        '<span class="db-card-media">' +
          (img
            ? '<img src="' + esc(img) + '" alt="' + esc(L(item.Name)) + '" loading="lazy">'
            : '<span class="db-card-noimg">' + MOTIF_SHELL + '</span>') +
          newBadge +
        '</span>' +
        '<span class="db-card-body">' +
          '<span class="db-card-head">' +
            '<span class="db-card-name">' + esc(L(item.Name)) + '</span>' +
            '<span class="db-card-price">' + esc(price) + '</span>' +
          '</span>' +
          '<span class="db-card-desc">' + esc(L(item.ShortDescription)) + '</span>' +
          (diets ? '<span class="db-tags">' + diets + '</span>' : '') +
        '</span>' +
      '</a>';
  }

  /* ------------------------------------------------------------- detail page */

  function renderDetail(root) {
    var menu = state.menu;
    var itemId = Core.getItemId();
    var found = itemId && findItem(menu, itemId);

    if (!found) {
      Core.renderError(root, { code: 'NOT_FOUND' }, state.lang);
      return;
    }

    var item = found.item;
    var category = found.category;
    setText('[data-item-name-crumb]', L(item.Name));
    document.title = L(item.Name) || Core.uiText('details', state.lang);

    var media = buildMedia(item);
    var price = Core.formatPrice(item.Price, menu.Currency);
    var diets = Core.dietLabels(item.Diets, state.lang);

    root.innerHTML =
      '<div class="db-detail">' +
        '<div class="db-detail-media">' + renderGallery(media, L(item.Name)) + '</div>' +
        '<div class="db-detail-info">' +
          '<span class="db-detail-cat">' + esc(L(category.Name)) + '</span>' +
          '<h1 class="db-detail-title">' + esc(L(item.Name)) +
            (item.IsNew ? '<span class="db-new">' + esc(Core.uiText('newBadge', state.lang)) + '</span>' : '') + '</h1>' +
          (price ? '<div class="db-detail-price">' + esc(price) + '</div>' : '') +
          '<p class="db-detail-lead">' + esc(L(item.ShortDescription)) + '</p>' +
          (diets.length ? '<div class="db-tags db-detail-tags">' +
            diets.map(function (d) { return '<span class="db-tag">' + esc(d) + '</span>'; }).join('') +
          '</div>' : '') +
          renderTabs(item) +
        '</div>' +
      '</div>' +
      renderRelated(category, item);

    initGallery(root);
  }

  function renderGallery(media, alt) {
    if (!media.length) {
      return '<div class="db-stage db-stage-empty"></div>';
    }

    var arrows = media.length > 1 ?
      '<button type="button" class="db-arrow db-arrow-prev" data-gallery-prev aria-label="Previous"><i class="bi bi-chevron-left"></i></button>' +
      '<button type="button" class="db-arrow db-arrow-next" data-gallery-next aria-label="Next"><i class="bi bi-chevron-right"></i></button>' : '';

    var stage = '<div class="db-stage" data-gallery-stage data-alt="' + esc(alt) + '">' +
      arrows +
      mediaStageHtml(media[0], alt) +
    '</div>';

    var thumbs = media.length > 1 ?
      '<div class="db-thumbs" data-gallery-thumbs>' +
        media.map(function (m, idx) {
          return '<button type="button" class="db-thumb' +
                 (idx === 0 ? ' active' : '') + (m.type === 'video' ? ' db-thumb-video' : '') + '" ' +
                 'data-type="' + m.type + '" ' +
                 'data-url="' + esc(m.url) + '" ' +
                 'data-embed="' + esc(m.embed || '') + '">' +
                 '<img src="' + esc(m.thumb) + '" alt="' + esc(alt) + '">' +
                 (m.type === 'video' ? '<span class="db-thumb-play"><i class="bi bi-play-fill"></i></span>' : '') +
                 '</button>';
        }).join('') +
      '</div>' : '';

    return stage + thumbs;
  }

  // The viewer keeps a single fixed-size frame for both images and videos so
  // the layout never jumps when switching media (the frame is sized in CSS).
  function mediaStageHtml(media, alt) {
    if (media.type === 'video') {
      return '<div class="db-frame db-frame-video">' +
        '<iframe data-gallery-video src="' + esc(media.embed) + '?rel=0" ' +
          'title="' + esc(alt) + '" frameborder="0" allowfullscreen ' +
          'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>' +
      '</div>';
    }
    return '<div class="db-frame db-frame-image">' +
      '<a class="db-zoom" data-gallery-zoom href="' + esc(media.url) + '" aria-label="Zoom"><i class="bi bi-zoom-in"></i></a>' +
      '<img data-gallery-main src="' + esc(media.url) + '" alt="' + esc(alt) + '">' +
    '</div>';
  }

  function initGallery(root) {
    var stage = root.querySelector('[data-gallery-stage]');
    var thumbs = root.querySelectorAll('[data-gallery-thumbs] .db-thumb');
    if (!stage) return;

    var alt = stage.getAttribute('data-alt') || '';
    var current = 0;

    function bindZoom() {
      var zoom = stage.querySelector('[data-gallery-zoom]');
      if (zoom && global.jQuery && global.jQuery.fn.magnificPopup) {
        global.jQuery(zoom).magnificPopup({ type: 'image' });
      }
    }

    function goTo(idx) {
      current = (idx + thumbs.length) % thumbs.length;
      var t = thumbs[current];
      var media = {
        type: t.getAttribute('data-type'),
        url: t.getAttribute('data-url'),
        embed: t.getAttribute('data-embed')
      };
      // Preserve the arrow buttons that live inside the stage wrapper.
      var arrows = stage.querySelectorAll('.db-arrow');
      stage.innerHTML = '';
      arrows.forEach(function (a) { stage.appendChild(a); });
      var holder = document.createElement('div');
      holder.innerHTML = mediaStageHtml(media, alt);
      while (holder.firstChild) { stage.appendChild(holder.firstChild); }
      bindZoom();
      thumbs.forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
    }

    thumbs.forEach(function (t, idx) {
      t.addEventListener('click', function () { goTo(idx); });
    });

    var prev = stage.querySelector('[data-gallery-prev]');
    var next = stage.querySelector('[data-gallery-next]');
    if (prev) prev.addEventListener('click', function () { goTo(current - 1); });
    if (next) next.addEventListener('click', function () { goTo(current + 1); });

    bindZoom();
  }

  function renderTabs(item) {
    var full = L(item.FullDescription) || L(item.ShortDescription);
    var ingredients = L(item.Ingredients);
    var allergens = L(item.Allergens);
    var hasInfo = ingredients || allergens;
    var uid = 'db-tab-' + (item.Id ? String(item.Id).replace(/[^A-Za-z0-9_-]/g, '') : 'x');

    return '' +
      '<div class="db-tabs">' +
        '<ul class="nav db-tabnav nav-pills" role="tablist">' +
          '<li class="nav-item" role="presentation">' +
            '<button class="nav-link active" data-bs-toggle="pill" data-bs-target="#' + uid + '-desc" type="button" role="tab">' +
              esc(Core.uiText('description', state.lang)) + '</button>' +
          '</li>' +
          (hasInfo ?
          '<li class="nav-item" role="presentation">' +
            '<button class="nav-link" data-bs-toggle="pill" data-bs-target="#' + uid + '-info" type="button" role="tab">' +
              esc(Core.uiText('ingredientsAllergens', state.lang)) + '</button>' +
          '</li>' : '') +
        '</ul>' +
        '<div class="tab-content db-tabbody">' +
          '<div class="tab-pane fade show active" id="' + uid + '-desc" role="tabpanel">' +
            '<p>' + esc(full) + '</p>' +
          '</div>' +
          (hasInfo ?
          '<div class="tab-pane fade" id="' + uid + '-info" role="tabpanel">' +
            (ingredients ? '<div class="db-info-block"><h4>' + esc(Core.uiText('ingredients', state.lang)) + '</h4><p>' + esc(ingredients) + '</p></div>' : '') +
            (allergens ? '<div class="db-info-block"><h4>' + esc(Core.uiText('allergens', state.lang)) + '</h4><p>' + esc(allergens) + '</p></div>' : '') +
          '</div>' : '') +
        '</div>' +
      '</div>';
  }

  function renderRelated(category, currentItem) {
    var others = sortedItems(category).filter(function (i) { return String(i.Id) !== String(currentItem.Id); });
    if (!others.length) return '';
    others = others.slice(0, 6);

    return '' +
      '<section class="db-related">' +
        '<div class="db-cat-head">' +
          '<h2 class="db-cat-title">' + esc(Core.uiText('moreFrom', state.lang, { name: L(category.Name) })) + '</h2>' +
          ornament(1) +
        '</div>' +
        '<div class="db-grid">' + others.map(renderItem).join('') + '</div>' +
      '</section>';
  }

})(window);

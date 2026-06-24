/*
 * epicurean.js — renderer for the "Epicurean" template (the default).
 *
 * Drives both pages:
 *   - /templates/epicurean/         (main menu, container #menu-root)
 *   - /templates/epicurean/detail/  (item detail, container #detail-root)
 *
 * All dynamic content comes from the tenant menu JSON loaded by menu-core.js.
 */
(function (global) {
  'use strict';

  var Core = global.MenuCore;
  var esc = Core.escapeHtml;

  var state = { menu: null, tenant: null, lang: null, langs: [] };

  document.addEventListener('DOMContentLoaded', function () {
    state.tenant = Core.getTenant();
    var menuRoot = document.getElementById('menu-root');
    var detailRoot = document.getElementById('detail-root');
    var fallback = menuRoot || detailRoot || document.querySelector('main');

    Core.fetchMenu(state.tenant)
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
        Core.renderError(fallback, err);
      });
  });

  /* --------------------------------------------------------------- helpers */

  function L(field) { return Core.t(field, state.lang); }

  function homeUrl() {
    return Core.withTenant(Core.templatePath('main', state.menu.TemplateId), state.tenant);
  }
  function detailUrl(itemId) {
    return Core.withTenant(
      Core.templatePath('detail', state.menu.TemplateId),
      state.tenant,
      'item=' + encodeURIComponent(itemId)
    );
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (el) { el.textContent = value || ''; });
  }

  function firstImage(item) {
    var imgs = (item.Images || []).slice().sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); });
    return imgs.length ? imgs[0].Url : null;
  }

  // Extracts the 11-char video id from the common YouTube URL shapes
  // (watch?v=, youtu.be/, /embed/, /shorts/). Returns null if none found.
  function youTubeId(url) {
    if (!url) return null;
    var m = String(url).match(
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    );
    return m ? m[1] : null;
  }

  // Unifies images and YouTube videos into one ordered gallery list. Images
  // (sorted by Order) come first, then any parseable YouTubeVideoUrls.
  function buildMedia(item) {
    var media = (item.Images || [])
      .slice()
      .sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); })
      .map(function (im) { return { type: 'image', url: im.Url, thumb: im.Url }; });

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
    var logoUrl = menu.Logo && menu.Logo.Url;
    document.querySelectorAll('[data-menu-logo]').forEach(function (img) {
      if (logoUrl) { img.src = logoUrl; img.alt = L(menu.Name) || 'Logo'; }
    });
    document.querySelectorAll('[data-menu-home]').forEach(function (a) { a.setAttribute('href', homeUrl()); });

    setText('[data-menu-name]', L(menu.Name));
    setText('[data-menu-description]', L(menu.Description));
    setText('[data-menu-notes]', menu.Notes || '');
    setText('[data-current-year]', new Date().getFullYear());
    document.title = L(menu.Name) || 'Menu';
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
      root.innerHTML = '<div class="text-center"><p>This menu has no items yet.</p></div>';
      return;
    }

    root.innerHTML = cats.map(renderCategory).join('');
  }

  function renderCategory(cat) {
    var items = sortedItems(cat);
    var desc = L(cat.Description);
    var head =
      '<div class="row">' +
        '<div class="col-lg-12">' +
          '<div class="section-title text-center">' +
            '<span>Menu</span>' +
            '<h2 class="mt-2">' + esc(L(cat.Name)) + '</h2>' +
            (desc ? '<p class="menu-cat-desc">' + esc(desc) + '</p>' : '') +
          '</div>' +
        '</div>' +
      '</div>';

    var body =
      '<div class="row pt-60">' +
        '<div class="col-lg-12">' +
          '<div class="menu-book-box-wrap">' +
            items.map(renderMenuItem).join('') +
          '</div>' +
        '</div>' +
      '</div>';

    return '<div class="menu-category pb-120">' + head + body + '</div>';
  }

  function renderMenuItem(item) {
    var img = firstImage(item);
    var price = Core.formatPrice(item.Price, state.menu.Currency);
    var diets = Core.dietLabels(item.Diets).map(function (d) {
      return '<span class="menu-diet-tag">' + esc(d) + '</span>';
    }).join('');
    var newBadge = item.IsNew ? '<span class="menu-new-badge">New</span>' : '';

    return '' +
      '<div class="menu-book-box d-flex justify-content-between align-items-center">' +
        '<a class="menu-book-link" href="' + esc(detailUrl(item.Id)) + '" aria-label="' + esc(L(item.Name)) + '"></a>' +
        '<div class="menu-book-info-wrap d-flex flex-column flex-xl-row align-items-xl-center">' +
          (img ? '<div class="menu-book-img flex-shrink-0"><img src="' + esc(img) + '" alt="' + esc(L(item.Name)) + '" loading="lazy"></div>' : '') +
          '<div class="menu-book-info">' +
            '<h2 class="h2 mb-1">' + esc(L(item.Name)) + newBadge + '</h2>' +
            '<p>' + esc(L(item.ShortDescription)) + '</p>' +
            (diets ? '<div class="menu-diet-tags">' + diets + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="dots"></div>' +
        '<div class="menu-book-price"><h2>' + esc(price) + '</h2></div>' +
      '</div>';
  }

  /* ------------------------------------------------------------- detail page */

  function renderDetail(root) {
    var menu = state.menu;
    var itemId = Core.getItemId();
    var found = itemId && findItem(menu, itemId);

    if (!found) {
      Core.renderError(root, { code: 'NOT_FOUND' });
      return;
    }

    var item = found.item;
    var category = found.category;
    setText('[data-item-name]', L(item.Name));
    setText('[data-item-name-crumb]', L(item.Name));
    document.title = L(item.Name) || 'Item details';

    var media = buildMedia(item);
    var price = Core.formatPrice(item.Price, menu.Currency);
    var diets = Core.dietLabels(item.Diets);

    root.innerHTML =
      '<div class="row gy-4">' +
        '<div class="col-lg-6">' + renderGallery(media, L(item.Name)) + '</div>' +
        '<div class="col-lg-6">' +
          '<div class="shop-details-info-wrap">' +
            '<a class="detail-back-link" href="' + esc(homeUrl()) + '"><i class="bi bi-arrow-left"></i> Back to menu</a>' +
            '<div class="section-title"><h2>' + esc(L(item.Name)) +
              (item.IsNew ? '<span class="menu-new-badge">New</span>' : '') + '</h2></div>' +
            (price ? '<h2 class="price-number-tag">' + esc(price) + '</h2>' : '') +
            '<p>' + esc(L(item.ShortDescription)) + '</p>' +
            (diets.length ? '<div class="menu-diet-tags detail-diet-tags">' +
              diets.map(function (d) { return '<span class="menu-diet-tag">' + esc(d) + '</span>'; }).join('') +
              '</div>' : '') +
            renderTagRow('Category', [L(category.Name)]) +
          '</div>' +
        '</div>' +
      '</div>' +
      renderTabs(item) +
      renderRelated(category, item);

    initGallery(root);
  }

  function renderGallery(media, alt) {
    if (!media.length) {
      return '<div class="shop-main-img-wrap"><div class="menu-loading" style="min-height:300px"></div></div>';
    }

    var arrows = media.length > 1 ?
      '<button type="button" class="gallery-arrow gallery-arrow-prev" data-gallery-prev aria-label="Previous"><i class="bi bi-chevron-left"></i></button>' +
      '<button type="button" class="gallery-arrow gallery-arrow-next" data-gallery-next aria-label="Next"><i class="bi bi-chevron-right"></i></button>' : '';

    var stage = '<div class="gallery-stage-wrap" data-gallery-stage data-alt="' + esc(alt) + '">' +
      arrows +
      mediaStageHtml(media[0], alt) +
    '</div>';

    var thumbs = media.length > 1 ?
      '<div class="d-flex flex-wrap gap-2 mt-2" data-gallery-thumbs>' +
        media.map(function (m, idx) {
          return '<button type="button" class="gallery-thumb' +
                 (idx === 0 ? ' active' : '') + (m.type === 'video' ? ' gallery-thumb-video' : '') + '" ' +
                 'data-type="' + m.type + '" ' +
                 'data-url="' + esc(m.url) + '" ' +
                 'data-embed="' + esc(m.embed || '') + '">' +
                 '<img src="' + esc(m.thumb) + '" alt="' + esc(alt) + '">' +
                 (m.type === 'video' ? '<span class="gallery-thumb-play"><i class="bi bi-play-fill"></i></span>' : '') +
                 '</button>';
        }).join('') +
      '</div>' : '';

    return stage + thumbs;
  }

  // Markup for the main viewer: a zoomable image, or an embedded YouTube player.
  function mediaStageHtml(media, alt) {
    if (media.type === 'video') {
      return '<div class="shop-main-img-wrap menu-video-wrap overflow-hidden mb-3">' +
        '<iframe data-gallery-video src="' + esc(media.embed) + '?rel=0" ' +
          'title="' + esc(alt) + '" frameborder="0" allowfullscreen ' +
          'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>' +
      '</div>';
    }
    return '<div class="shop-main-img-wrap overflow-hidden mb-3">' +
      '<a class="shop-main-zm" data-gallery-zoom href="' + esc(media.url) + '">' +
        '<i class="bi bi-zoom-in"></i>' +
      '</a>' +
      '<img data-gallery-main src="' + esc(media.url) + '" alt="' + esc(alt) + '">' +
    '</div>';
  }

  function initGallery(root) {
    var stage = root.querySelector('[data-gallery-stage]');
    var thumbs = root.querySelectorAll('[data-gallery-thumbs] .gallery-thumb');
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
      // Preserve the arrow buttons that live inside the stage wrapper
      var arrows = stage.querySelectorAll('.gallery-arrow');
      stage.innerHTML = '';
      arrows.forEach(function (a) { stage.appendChild(a); });
      var stageContent = document.createElement('div');
      stageContent.innerHTML = mediaStageHtml(media, alt);
      while (stageContent.firstChild) { stage.appendChild(stageContent.firstChild); }
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

  function renderTagRow(label, values) {
    var clean = (values || []).filter(Boolean);
    if (!clean.length) return '';
    return '<div class="details-tag-wrap d-flex flex-column flex-md-row border-0 mt-4">' +
      '<span>' + esc(label) + ':</span>' +
      '<ul class="sidebar-tag custom-ul d-flex flex-wrap">' +
        clean.map(function (v) { return '<li><span>' + esc(v) + '</span></li>'; }).join('') +
      '</ul></div>';
  }

  function renderTabs(item) {
    var full = L(item.FullDescription) || L(item.ShortDescription);
    var ingredients = L(item.Ingredients);
    var allergens = L(item.Allergens);
    var hasInfo = ingredients || allergens;

    return '' +
      '<div class="shop-info-area pt-120">' +
        '<div class="row"><div class="col-lg-12">' +
          '<ul class="nav shop-info-nav nav-pills" role="tablist">' +
            '<li class="nav-item" role="presentation">' +
              '<button class="nav-link active" data-bs-toggle="pill" data-bs-target="#tab-desc" type="button" role="tab">Description</button>' +
            '</li>' +
            (hasInfo ?
            '<li class="nav-item" role="presentation">' +
              '<button class="nav-link" data-bs-toggle="pill" data-bs-target="#tab-info" type="button" role="tab">Ingredients &amp; Allergens</button>' +
            '</li>' : '') +
          '</ul>' +
          '<div class="tab-content mt-5">' +
            '<div class="tab-pane fade show active" id="tab-desc" role="tabpanel">' +
              '<p>' + esc(full) + '</p>' +
            '</div>' +
            (hasInfo ?
            '<div class="tab-pane fade" id="tab-info" role="tabpanel">' +
              '<div class="row gy-4">' +
                (ingredients ? '<div class="col-lg-6"><h2 class="h2 mb-2">Ingredients</h2><p>' + esc(ingredients) + '</p></div>' : '') +
                (allergens ? '<div class="col-lg-6"><h2 class="h2 mb-2">Allergens</h2><p>' + esc(allergens) + '</p></div>' : '') +
              '</div>' +
            '</div>' : '') +
          '</div>' +
        '</div></div>' +
      '</div>';
  }

  function renderRelated(category, currentItem) {
    var others = sortedItems(category).filter(function (i) { return String(i.Id) !== String(currentItem.Id); });
    if (!others.length) return '';
    others = others.slice(0, 8);

    return '' +
      '<div class="pt-120">' +
        '<div class="row"><div class="col-lg-12"><h2 class="h2">More from ' + esc(L(category.Name)) + '</h2></div></div>' +
        '<div class="row pt-60"><div class="col-lg-12"><div class="menu-book-box-wrap">' +
          others.map(renderMenuItem).join('') +
        '</div></div></div>' +
      '</div>';
  }

})(window);

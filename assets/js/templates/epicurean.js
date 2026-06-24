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
    setText('[data-menu-tagline]', L(menu.Description));
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

    var images = (item.Images || []).slice().sort(function (a, b) { return (a.Order || 0) - (b.Order || 0); });
    var price = Core.formatPrice(item.Price, menu.Currency);
    var diets = Core.dietLabels(item.Diets);

    root.innerHTML =
      '<div class="row gy-4">' +
        '<div class="col-lg-6">' + renderGallery(images, L(item.Name)) + '</div>' +
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

  function renderGallery(images, alt) {
    if (!images.length) {
      return '<div class="shop-main-img-wrap"><div class="menu-loading" style="min-height:300px"></div></div>';
    }
    var main =
      '<div class="shop-main-img-wrap overflow-hidden mb-3">' +
        '<a class="shop-main-zm" data-gallery-zoom href="' + esc(images[0].Url) + '">' +
          '<i class="bi bi-zoom-in"></i>' +
        '</a>' +
        '<img data-gallery-main src="' + esc(images[0].Url) + '" alt="' + esc(alt) + '">' +
      '</div>';

    var thumbs = images.length > 1 ?
      '<div class="d-flex flex-wrap gap-2" data-gallery-thumbs>' +
        images.map(function (im, idx) {
          return '<img class="gallery-thumb' + (idx === 0 ? ' active' : '') + '" ' +
                 'style="width:72px;height:72px;object-fit:cover;border-radius:6px;cursor:pointer" ' +
                 'data-src="' + esc(im.Url) + '" src="' + esc(im.Url) + '" alt="' + esc(alt) + '">';
        }).join('') +
      '</div>' : '';

    return main + thumbs;
  }

  function initGallery(root) {
    var mainImg = root.querySelector('[data-gallery-main]');
    var zoom = root.querySelector('[data-gallery-zoom]');
    var thumbs = root.querySelectorAll('[data-gallery-thumbs] .gallery-thumb');
    thumbs.forEach(function (t) {
      t.addEventListener('click', function () {
        var src = t.getAttribute('data-src');
        if (mainImg) mainImg.src = src;
        if (zoom) zoom.setAttribute('href', src);
        root.querySelectorAll('.gallery-thumb').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
      });
    });
    if (global.jQuery && global.jQuery.fn.magnificPopup && zoom) {
      global.jQuery(zoom).magnificPopup({ type: 'image' });
    }
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

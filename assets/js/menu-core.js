/*
 * menu-core.js — shared runtime for all Akut menu templates.
 *
 * Responsibilities:
 *   - resolve the tenant from the URL (path segment or ?tenant=)
 *   - fetch the tenant's menu JSON from the public S3 bucket
 *   - language (i18n) helpers driven by the keys present in the data
 *   - price / diet formatting from the configured enums
 *   - a friendly error renderer used when the menu cannot be loaded
 *
 * Configuration is injected by Jekyll into window.AKUT_CONFIG.
 */
(function (global) {
  'use strict';

  var CONFIG = global.AKUT_CONFIG || {};
  var S3_BASE = CONFIG.s3Base || '';
  var BASE_URL = (CONFIG.baseUrl || '').replace(/\/$/, '');
  var RESERVED = CONFIG.reservedPaths || ['templates', 'assets'];
  var LANG_KEY = 'akut_lang';

  /* ----------------------------------------------------------------- tenant */

  function getTenant() {
    var params = new global.URLSearchParams(global.location.search);
    var q = params.get('tenant');
    if (q && q.trim()) return q.trim();

    var path = global.location.pathname;
    if (BASE_URL && path.indexOf(BASE_URL) === 0) path = path.slice(BASE_URL.length);

    var segs = path.split('/').filter(function (s) {
      return s && !/\.html?$/i.test(s) && RESERVED.indexOf(s) === -1;
    });
    return segs.length ? decodeURIComponent(segs[0]) : null;
  }

  function getItemId() {
    return new global.URLSearchParams(global.location.search).get('item');
  }

  /* ------------------------------------------------------------------ fetch */

  function menuUrl(tenant) {
    return S3_BASE + encodeURIComponent(tenant) + '.json';
  }

  function fetchMenu(tenant) {
    if (!tenant) return Promise.reject(makeError('NO_TENANT'));
    return global.fetch(menuUrl(tenant), { cache: 'no-cache' })
      .then(function (res) {
        // Public buckets commonly return 403 for a missing key, so treat it as "not found".
        if (!res.ok) throw makeError((res.status === 404 || res.status === 403) ? 'NOT_FOUND' : 'HTTP_ERROR', res.status);
        return res.json();
      })
      .catch(function (err) {
        if (err && err.code) throw err;          // already classified
        throw makeError('NETWORK', null, err);   // network / CORS / parse
      });
  }

  function makeError(code, status, cause) {
    var e = new Error(code);
    e.code = code;
    e.status = status || null;
    e.cause = cause || null;
    return e;
  }

  /* ------------------------------------------------------------------- i18n */

  // Collect every language key that appears on any localized field.
  function availableLanguages(menu) {
    var seen = {};
    var order = [];
    function scan(obj) {
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        Object.keys(obj).forEach(function (k) {
          if (typeof obj[k] === 'string' && !seen[k]) { seen[k] = true; order.push(k); }
        });
      }
    }
    scan(menu.Name); scan(menu.Description);
    (menu.Categories || []).forEach(function (c) {
      scan(c.Name); scan(c.Description);
      (c.Items || []).forEach(function (i) {
        scan(i.Name); scan(i.ShortDescription); scan(i.FullDescription);
        scan(i.Ingredients); scan(i.Allergens);
      });
    });
    return order;
  }

  // Pick the initial language: saved choice -> DefaultLanguage enum -> first.
  function pickLanguage(menu, available) {
    var saved = readLang();
    if (saved && available.indexOf(saved) !== -1) return saved;

    var map = CONFIG.languages || {};
    var mapped = map[menu.DefaultLanguage] && map[menu.DefaultLanguage].key;
    if (mapped && available.indexOf(mapped) !== -1) return mapped;

    return available[0] || null;
  }

  // Display label for a language key (falls back to the key itself).
  function languageLabel(key) {
    var map = CONFIG.languages || {};
    for (var k in map) {
      if (map[k] && map[k].key === key) return map[k].label || key;
    }
    return key;
  }

  // Read a localized value, falling back to any available language.
  function t(field, lang) {
    if (field == null) return '';
    if (typeof field === 'string') return field;
    if (typeof field !== 'object') return String(field);
    if (lang && field[lang] != null) return field[lang];
    var keys = Object.keys(field);
    return keys.length ? field[keys[0]] : '';
  }

  function readLang() { try { return global.localStorage.getItem(LANG_KEY); } catch (e) { return null; } }
  function saveLang(l) { try { global.localStorage.setItem(LANG_KEY, l); } catch (e) {} }

  // Translations for the templates' own UI labels (not menu data). Keyed by the
  // same language keys used in the data (e.g. "English", "Portuguese"); falls
  // back to English. `{name}`-style placeholders are filled from `vars`.
  var UI_STRINGS = {
    moreFrom: {
      English:    'More from {name}',
      Portuguese: 'Mais de {name}',
      Spanish:    'Más de {name}',
      French:     'Plus de {name}',
      German:     'Mehr aus {name}',
      Italian:    'Altro da {name}'
    }
  };

  function uiText(key, lang, vars) {
    var entry = UI_STRINGS[key] || {};
    var s = (lang && entry[lang]) || entry.English || '';
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace('{' + k + '}', vars[k] == null ? '' : vars[k]);
      });
    }
    return s;
  }

  /* -------------------------------------------------------------- formatting */

  function formatPrice(value, currencyEnum) {
    if (value == null || isNaN(value)) return '';
    var cur = (CONFIG.currencies || {})[currencyEnum] || {};
    var symbol = cur.symbol || '';
    var num = Number(value).toFixed(2).replace(/\.00$/, '');
    return symbol + num;
  }

  function dietLabels(diets) {
    var map = CONFIG.diets || {};
    return (diets || []).map(function (d) {
      return (map[d] != null) ? map[d] : ('Diet ' + d);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ------------------------------------------------------------------- links */

  function templatePath(kind, templateId) {
    var tpls = CONFIG.templates || {};
    var aliases = CONFIG.templateAliases || {};
    var id = String(templateId || '').toLowerCase();
    if (aliases[id]) id = aliases[id];
    var tpl = tpls[id] || tpls[CONFIG.defaultTemplate] || {};
    return BASE_URL + (tpl[kind] || '');
  }

  function withTenant(url, tenant, extra) {
    var qs = 'tenant=' + encodeURIComponent(tenant);
    if (extra) qs += '&' + extra;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + qs;
  }

  /* -------------------------------------------------------- friendly errors */

  function errorMessage(err) {
    var code = (err && err.code) || 'NETWORK';
    var map = {
      NO_TENANT: {
        title: 'No restaurant selected',
        body: 'Add a tenant to the address, for example <code>' +
              escapeHtml((BASE_URL || '') + '/your-restaurant') + '</code>.'
      },
      NOT_FOUND: {
        title: 'Menu not found',
        body: "We couldn't find a menu for this restaurant yet. Please check the link or try again later."
      },
      HTTP_ERROR: {
        title: 'Menu temporarily unavailable',
        body: 'The menu service responded with an error. Please try again in a few minutes.'
      },
      NETWORK: {
        title: 'Menu temporarily unavailable',
        body: "We couldn't reach the menu service. Please check your connection and try again."
      }
    };
    return map[code] || map.NETWORK;
  }

  // Render the friendly fallback into a container element.
  function renderError(container, err) {
    if (!container) return;
    var msg = errorMessage(err);
    container.innerHTML =
      '<div class="menu-error">' +
        '<div class="menu-error-card">' +
          '<div class="menu-error-emoji">🍽️</div>' +
          '<h1>' + escapeHtml(msg.title) + '</h1>' +
          '<p>' + msg.body + '</p>' +
          '<button type="button" class="common-btn" onclick="location.reload()"><span>Try again</span></button>' +
        '</div>' +
      '</div>';
  }

  /* ------------------------------------------------------------------ export */

  global.MenuCore = {
    config: CONFIG,
    getTenant: getTenant,
    getItemId: getItemId,
    fetchMenu: fetchMenu,
    availableLanguages: availableLanguages,
    pickLanguage: pickLanguage,
    languageLabel: languageLabel,
    t: t,
    saveLang: saveLang,
    readLang: readLang,
    uiText: uiText,
    formatPrice: formatPrice,
    dietLabels: dietLabels,
    escapeHtml: escapeHtml,
    templatePath: templatePath,
    withTenant: withTenant,
    renderError: renderError,
    errorMessage: errorMessage
  };
})(window);

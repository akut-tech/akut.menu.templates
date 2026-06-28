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

  function getMenuId() {
    var params = new global.URLSearchParams(global.location.search);
    var q = params.get('menu');
    if (q && q.trim()) return q.trim();

    var path = global.location.pathname;
    if (BASE_URL && path.indexOf(BASE_URL) === 0) path = path.slice(BASE_URL.length);

    var segs = path.split('/').filter(function (s) {
      return s && !/\.html?$/i.test(s) && RESERVED.indexOf(s) === -1;
    });
    return segs.length > 1 ? decodeURIComponent(segs[1]) : null;
  }

  function getItemId() {
    return new global.URLSearchParams(global.location.search).get('item');
  }

  /* ------------------------------------------------------------------ fetch */

  function menuUrl(tenant, menuId) {
    return S3_BASE + encodeURIComponent(tenant) + '/active/' + encodeURIComponent(menuId) + '.json';
  }

  function fetchMenu(tenant, menuId) {
    if (!tenant) return Promise.reject(makeError('NO_TENANT'));
    if (!menuId) return Promise.reject(makeError('NOT_FOUND'));
    return global.fetch(menuUrl(tenant, menuId), { cache: 'no-cache' })
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
        scan(i.Ingredients);
      });
    });
    return order;
  }

  // Pick the initial language: saved choice (per menu) -> DefaultLanguage enum -> first.
  function pickLanguage(menu, available, menuId) {
    var saved = readLang(menuId);
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

  function langKey(menuId) { return menuId ? LANG_KEY + '_' + menuId : LANG_KEY; }
  function readLang(menuId) { try { return global.localStorage.getItem(langKey(menuId)); } catch (e) { return null; } }
  function saveLang(l, menuId) { try { global.localStorage.setItem(langKey(menuId), l); } catch (e) {} }

  // Translations for the templates' own UI labels (not menu data). Keyed by the
  // same language keys used in the data (e.g. "English", "Portuguese"); falls
  // back to English. `{name}`-style placeholders are filled from `vars`.
  var UI_STRINGS = {
    moreFrom: {
      English: 'More from {name}', Portuguese: 'Mais de {name}',
      Spanish: 'Más de {name}',    French: 'Plus de {name}'
    },
    menu: {
      English: 'Menu', Portuguese: 'Menu', Spanish: 'Menú', French: 'Menu'
    },
    details: {
      English: 'Details', Portuguese: 'Detalhes', Spanish: 'Detalles', French: 'Détails'
    },
    description: {
      English: 'Description', Portuguese: 'Descrição', Spanish: 'Descripción', French: 'Description'
    },
    ingredients: {
      English: 'Ingredients', Portuguese: 'Ingredientes', Spanish: 'Ingredientes', French: 'Ingrédients'
    },
    allergens: {
      English: 'Allergens', Portuguese: 'Alergénios', Spanish: 'Alérgenos', French: 'Allergènes'
    },
    ingredientsAllergens: {
      English: 'Ingredients & Allergens', Portuguese: 'Ingredientes e Alergénios',
      Spanish: 'Ingredientes y Alérgenos', French: 'Ingrédients & Allergènes'
    },
    backToMenu: {
      English: 'Back to menu', Portuguese: 'Voltar ao menu',
      Spanish: 'Volver al menú', French: 'Retour au menu'
    },
    category: {
      English: 'Category', Portuguese: 'Categoria', Spanish: 'Categoría', French: 'Catégorie'
    },
    tagNew:     { English: 'New',           Portuguese: 'Novo',            Spanish: 'Nuevo',              French: 'Nouveau' },
    tagPopular: { English: 'Popular',       Portuguese: 'Popular',         Spanish: 'Popular',            French: 'Populaire' },
    tagChef:    { English: "Chef's Pick",   Portuguese: 'Escolha do Chef', Spanish: 'Selección del Chef', French: 'Choix du Chef' },
    tagSeasonal:{ English: 'Seasonal',      Portuguese: 'Sazonal',         Spanish: 'Temporada',          French: 'Saisonnier' },
    tagLimitedEdition: { English: 'Limited Edition', Portuguese: 'Edição Limitada', Spanish: 'Edición Limitada', French: 'Édition Limitée' },
    noItems: {
      English: 'This menu has no items yet.',
      Portuguese: 'Este menu ainda não tem itens.',
      Spanish: 'Este menú aún no tiene artículos.',
      French: 'Ce menu n’a pas encore d’articles.'
    },
    freshFromOcean: {
      English: 'Fresh from the ocean', Portuguese: 'Fresco do oceano',
      Spanish: 'Fresco del océano', French: 'Fraîcheur de l’océan'
    },
    tryAgain: {
      English: 'Try again', Portuguese: 'Tentar novamente',
      Spanish: 'Reintentar', French: 'Réessayer'
    },
    availability: {
      English: 'Available {from}–{to}',
      Portuguese: 'Disponível {from}–{to}',
      Spanish: 'Disponible {from}–{to}',
      French: 'Disponible {from}–{to}'
    },
    foundedYear: {
      English: 'since {year}',
      Portuguese: 'desde {year}',
      Spanish: 'desde {year}',
      French: 'depuis {year}'
    }
  };

  var TAG_CONFIG = {
    1: { key: 'tagNew',     slug: 'new',     icon: 'bi-stars' },
    2: { key: 'tagPopular', slug: 'popular', icon: 'bi-graph-up-arrow' },
    3: { key: 'tagChef',    slug: 'chef',    icon: 'bi-award' },
    4: { key: 'tagSeasonal',       slug: 'seasonal',        icon: 'bi-flower2' },
    5: { key: 'tagLimitedEdition', slug: 'limited-edition', icon: 'bi-hourglass-split' }
  };

  // EU-regulated list of 14 allergens, keyed by the Allergen enum integer value.
  var ALLERGEN_LABELS = {
    1:  { English: 'Gluten',       Portuguese: 'Glúten',                French: 'Gluten',          Spanish: 'Gluten' },
    2:  { English: 'Crustaceans',  Portuguese: 'Crustáceos',            French: 'Crustacés',        Spanish: 'Crustáceos' },
    3:  { English: 'Eggs',         Portuguese: 'Ovos',                  French: 'Œufs',             Spanish: 'Huevos' },
    4:  { English: 'Fish',         Portuguese: 'Peixe',                 French: 'Poisson',          Spanish: 'Pescado' },
    5:  { English: 'Peanuts',      Portuguese: 'Amendoins',             French: 'Cacahuètes',       Spanish: 'Cacahuetes' },
    6:  { English: 'Soybeans',     Portuguese: 'Soja',                  French: 'Soja',             Spanish: 'Soja' },
    7:  { English: 'Milk',         Portuguese: 'Leite',                 French: 'Lait',             Spanish: 'Leche' },
    8:  { English: 'Nuts',         Portuguese: 'Frutos de casca rija',  French: 'Fruits à coque',   Spanish: 'Frutos de cáscara' },
    9:  { English: 'Celery',       Portuguese: 'Aipo',                  French: 'Céleri',           Spanish: 'Apio' },
    10: { English: 'Mustard',      Portuguese: 'Mostarda',              French: 'Moutarde',         Spanish: 'Mostaza' },
    11: { English: 'Sesame',       Portuguese: 'Sésamo',                French: 'Sésame',           Spanish: 'Sésamo' },
    12: { English: 'Sulphites',    Portuguese: 'Sulfitos',              French: 'Sulfites',         Spanish: 'Sulfitos' },
    13: { English: 'Lupin',        Portuguese: 'Tremoço',               French: 'Lupin',            Spanish: 'Altramuces' },
    14: { English: 'Molluscs',     Portuguese: 'Moluscos',              French: 'Mollusques',       Spanish: 'Moluscos' }
  };

  // Map an array of allergen IDs to translated label strings.
  // Unknown IDs are silently skipped (no broken display on schema extensions).
  function allergenLabels(ids, lang) {
    if (!Array.isArray(ids) || !ids.length) return [];
    return ids.reduce(function (acc, id) {
      var entry = ALLERGEN_LABELS[id];
      if (!entry) return acc;
      var label = (lang && entry[lang]) || entry.English;
      if (label) acc.push(label);
      return acc;
    }, []);
  }

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

  function tagBadge(item, lang, cssPrefix) {
    var tag = item && item.Tag;
    if (!tag) return '';
    var cfg = TAG_CONFIG[tag];
    if (!cfg) return '';
    return '<span class="' + cssPrefix + ' ' + cssPrefix + '--' + cfg.slug + '">' +
      '<i class="bi ' + cfg.icon + '" aria-hidden="true"></i> ' +
      escapeHtml(uiText(cfg.key, lang)) +
      '</span>';
  }

  /* -------------------------------------------------------------- formatting */

  // Always show two decimals (e.g. 1.00, 18.90) per the configured currency.
  function formatPrice(value, currencyEnum) {
    if (value == null || isNaN(value)) return '';
    var cur = (CONFIG.currencies || {})[currencyEnum] || {};
    var symbol = cur.symbol || '';
    return symbol + Number(value).toFixed(2);
  }

  // Diet labels are template-owned (not S3 data); each entry in `_data/diets.yml`
  // may be a plain string (legacy) or a per-language object keyed like the menu
  // localized fields. Resolves to `lang`, then English, then the first value.
  function dietLabels(diets, lang) {
    var map = CONFIG.diets || {};
    return (diets || []).map(function (d) {
      var entry = map[d];
      if (entry == null) return 'Diet ' + d;
      if (typeof entry === 'string') return entry;
      if (lang && entry[lang] != null) return entry[lang];
      if (entry.English != null) return entry.English;
      var keys = Object.keys(entry);
      return keys.length ? entry[keys[0]] : ('Diet ' + d);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* -------------------------------------------------------------- availability */

  function formatTime(timeStr, lang) {
    if (!timeStr) return '';
    var parts = String(timeStr).split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1] || '0', 10);
    if (isNaN(h)) return '';
    if (lang === 'English') {
      var suffix = h >= 12 ? 'pm' : 'am';
      var h12 = h % 12 || 12;
      return m ? h12 + ':' + (m < 10 ? '0' + m : m) + suffix : h12 + suffix;
    }
    return h + (m ? ':' + (m < 10 ? '0' + m : m) : '') + 'h';
  }

  function formatAvailability(menu, lang) {
    var av = menu && menu.AvailabilityTime;
    if (!av || !av.From || !av.To) return '';
    return uiText('availability', lang, {
      from: formatTime(av.From, lang),
      to: formatTime(av.To, lang)
    });
  }

  function formatFoundedYear(menu, lang) {
    var year = menu && menu.FoundedYear;
    if (!year || isNaN(year)) return '';
    return uiText('foundedYear', lang, { year: String(year) });
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

  function withTenant(url, tenant, menuId, extra) {
    var qs = 'tenant=' + encodeURIComponent(tenant);
    if (menuId) qs += '&menu=' + encodeURIComponent(menuId);
    if (extra) qs += '&' + extra;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + qs;
  }

  /* -------------------------------------------------------- friendly errors */

  // Friendly error copy, translated like the rest of the UI. `{code}` in the
  // NO_TENANT body is replaced with an example address.
  var ERROR_STRINGS = {
    NO_TENANT: {
      English:    { title: 'No restaurant selected',    body: 'Add a tenant to the address, for example {code}.' },
      Portuguese: { title: 'Nenhum restaurante selecionado', body: 'Adicione um restaurante ao endereço, por exemplo {code}.' },
      Spanish:    { title: 'Ningún restaurante seleccionado', body: 'Añada un restaurante a la dirección, por ejemplo {code}.' },
      French:     { title: 'Aucun restaurant sélectionné', body: 'Ajoutez un restaurant à l’adresse, par exemple {code}.' }
    },
    NOT_FOUND: {
      English:    { title: 'Menu not found', body: "We couldn't find a menu for this restaurant yet. Please check the link or try again later." },
      Portuguese: { title: 'Menu não encontrado', body: 'Ainda não encontrámos um menu para este restaurante. Verifique o link ou tente mais tarde.' },
      Spanish:    { title: 'Menú no encontrado', body: 'Aún no encontramos un menú para este restaurante. Comprueba el enlace o inténtalo más tarde.' },
      French:     { title: 'Menu introuvable', body: 'Nous n’avons pas encore trouvé de menu pour ce restaurant. Vérifiez le lien ou réessayez plus tard.' }
    },
    HTTP_ERROR: {
      English:    { title: 'Menu temporarily unavailable', body: 'The menu service responded with an error. Please try again in a few minutes.' },
      Portuguese: { title: 'Menu temporariamente indisponível', body: 'O serviço de menus respondeu com um erro. Tente novamente dentro de alguns minutos.' },
      Spanish:    { title: 'Menú temporalmente no disponible', body: 'El servicio de menús respondió con un error. Inténtalo de nuevo en unos minutos.' },
      French:     { title: 'Menu temporairement indisponible', body: 'Le service de menus a renvoyé une erreur. Veuillez réessayer dans quelques minutes.' }
    },
    NETWORK: {
      English:    { title: 'Menu temporarily unavailable', body: "We couldn't reach the menu service. Please check your connection and try again." },
      Portuguese: { title: 'Menu temporariamente indisponível', body: 'Não foi possível contactar o serviço de menus. Verifique a sua ligação e tente novamente.' },
      Spanish:    { title: 'Menú temporalmente no disponible', body: 'No pudimos conectar con el servicio de menús. Comprueba tu conexión e inténtalo de nuevo.' },
      French:     { title: 'Menu temporairement indisponible', body: 'Impossible de joindre le service de menus. Vérifiez votre connexion et réessayez.' }
    }
  };

  function errorMessage(err, lang) {
    var code = (err && err.code) || 'NETWORK';
    var entry = ERROR_STRINGS[code] || ERROR_STRINGS.NETWORK;
    var key = (lang && entry[lang]) ? lang : (readLang() && entry[readLang()] ? readLang() : 'English');
    var msg = entry[key] || entry.English;
    var body = msg.body.replace(
      '{code}', '<code>' + escapeHtml((BASE_URL || '') + '/your-restaurant') + '</code>'
    );
    return { title: msg.title, body: body };
  }

  // Render the friendly fallback into a container element.
  function renderError(container, err, lang) {
    if (!container) return;
    var msg = errorMessage(err, lang);
    container.innerHTML =
      '<div class="menu-error">' +
        '<div class="menu-error-card">' +
          '<div class="menu-error-emoji">🍽️</div>' +
          '<h1>' + escapeHtml(msg.title) + '</h1>' +
          '<p>' + msg.body + '</p>' +
          '<button type="button" class="common-btn" onclick="location.reload()"><span>' +
            escapeHtml(uiText('tryAgain', lang || readLang())) +
          '</span></button>' +
        '</div>' +
      '</div>';
  }

  /* ------------------------------------------------------------------ export */

  global.MenuCore = {
    config: CONFIG,
    getTenant: getTenant,
    getMenuId: getMenuId,
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
    errorMessage: errorMessage,
    formatAvailability: formatAvailability,
    formatFoundedYear: formatFoundedYear,
    TAG_CONFIG: TAG_CONFIG,
    tagBadge: tagBadge,
    ALLERGEN_LABELS: ALLERGEN_LABELS,
    allergenLabels: allergenLabels
  };
})(window);

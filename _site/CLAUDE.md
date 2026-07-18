# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A [Jekyll](https://jekyllrb.com/) site that renders restaurant menus from per-tenant JSON hosted on
a public S3 bucket. The site is **static** — the dynamic part (pick tenant → fetch menu → render)
happens in the browser, so the same build serves every tenant:

```
<base-url>/<tenant>/<menuId>   →  loads the menu for <tenant> / <menuId>
                                  https://s3-akut-prod-01.s3.eu-west-1.amazonaws.com/products/menu/<tenant>/<menuId>.json
```

## Commands

```bash
bundle install                 # install gems (Jekyll 4.3)
bundle exec jekyll serve       # local dev server, http://localhost:4001
bundle exec jekyll build       # production build → _site/
```

There is no JS test suite, linter, or bundler — templates are plain ES5 IIFEs loaded directly by
the browser, so "testing a change" means loading the page and checking it in a browser:

- `http://localhost:4001/templates/<name>/?tenant=test` — a template directly, live S3 `test` menu
- `http://localhost:4001/templates/<name>/` — templates with bundled demo data (deepblue, lisbon,
  senjutsu, trattoria) render standalone with no `?tenant=`, using their own
  `assets/data/<name>-menu.json`
- `assets/data/sample-menu.json` — generic bundled demo menu for reference/offline design work

CI (`.github/workflows/jekyll.yml`) just runs `bundle exec jekyll build` and deploys `_site/` to
GitHub Pages on push to `main`. No test/lint step exists to satisfy before committing.

**`_site/` is committed to git**, not gitignored — some files under it (e.g.
`_site/assets/js/templates/*.js`) are hardlinked to their `assets/js/templates/*.js` counterparts,
so editing one edits both automatically. Verify with `ls -i` if unsure before editing both by hand.

## Architecture

1. **Dispatcher** (`index.html` is the showcase/gallery page; `404.html` is the actual dispatcher):
   resolves the tenant from the URL, fetches its JSON from S3, reads `TemplateId`, and redirects
   (`location.replace`) to that template's main page — falling back to `default_template: classic`
   (`_config.yml`) when `TemplateId` is missing/unknown. On static hosts that don't rewrite unknown
   paths to `index.html` (S3 website hosting, GitHub Pages), a clean tenant URL like `/test` has no
   matching file and is served as `404.html`, which is wired to act as this same dispatcher.
2. **Template pages** (`templates/<name>/`): a static HTML shell (Jekyll front matter + markup) plus
   a renderer in `assets/js/templates/<name>.js` that fetches the menu JSON and fills the shell.
   Each template is an ES5 IIFE registered on `window`, driven by `DOMContentLoaded`, looking for a
   root container (`#menu-root`, `#category-root`, `#item-root`, or `#detail-root` depending on the
   template's page set).
3. **Shared runtime** (`assets/js/menu-core.js`, exposed as `window.MenuCore`): tenant/menu-id URL
   resolution, S3 fetch (`fetchMenu` / `fetchPreviewMenu`), i18n helpers, price/diet/allergen/
   availability formatting, and the friendly error screen (`renderError`). Every template script
   calls into this instead of duplicating logic.
4. **Runtime config** (`_includes/menu-config.html`): Jekyll injects `_config.yml` and `_data/*.yml`
   into `window.AKUT_CONFIG` at build time (S3 base URLs, reserved path segments, template registry,
   language/currency/diet enum maps). `menu-core.js` reads everything from this object — nothing is
   hardcoded in JS.

### Tenant and menu routing

Tenant, in order: `?tenant=` query string, then the first path segment (segments listed in
`_config.yml`'s `reserved_paths` — `templates`, `assets`, `preview` — are skipped).
Menu ID, in order: `?menu=` query string (used to carry the value across template page
navigations), then the second path segment.

### Templates

Templates live under `templates/<name>/` and are registered in `_data/templates.yml`, which maps a
menu's `TemplateId` (case-insensitive, with `aliases:` for legacy/typo values like `epicurean` →
`classic`) to that template's page URLs. Any unrecognized `TemplateId` falls back to `default`
(`classic`). Two page-set shapes exist:

- **Two-page** (classic, deepblue): `main` (`#menu-root`, category grid) + `detail`
  (`#detail-root`, item detail) — front matter is `detail.html`, not a subdirectory.
- **Three-page** (senjutsu, lisbon, trattoria): `main` (`#menu-root`, homepage) + `category`
  (`#category-root`, items grid — `category/index.html`) + `detail` (`#item-root`, item page —
  `item/index.html`, except senjutsu which has no detail page).

Each template page's front matter drives `_layouts/base.html`:
- `template_js: <name>` — loads `assets/js/templates/<name>.js`
- `template_css: <name>` — optionally loads `assets/css/<name>.css` (per-template-only styling)
- `no_chrome: true` — template supplies its own header/footer instead of the shared
  `_includes/header.html` / `footer.html`

### Menu JSON shape

```jsonc
{
  "Id": "…",
  "Logo": { "Url": "…", "Title": "…" },
  "Name": { "English": "Lunch Menu" },        // localized: object keyed by language name
  "Description": { "English": "…" },
  "Notes": "Available 12pm–3pm",
  "TemplateId": "default",                    // matched against _data/templates.yml
  "DefaultLanguage": 2,                       // enum → _data/languages.yml
  "Currency": 1,                              // enum → _data/currencies.yml (mirrors akut.domain: 1=Euro, 2=Dollar, 3=Pound)
  "Status": 1,
  "Categories": [
    {
      "Id": "…", "Order": 1,
      "Name": { "English": "Starters" },
      "Description": { "English": "…" },
      "Items": [
        {
          "Id": "…", "Order": 1,
          "Diets": [2, 3],                    // enum → _data/diets.yml
          "Images": [{ "Url": "…", "Order": 0 }],
          "Name": { "English": "Tomato Soup" },
          "ShortDescription": { "English": "…" },
          "FullDescription": { "English": "…" },
          "Ingredients": { "English": "…" },
          "Allergens": [7, 1, 8],              // enum → EU 14-allergen list, see below
          "Price": 5.5,
          "Tag": 1                             // nullable enum → MenuItemTag, see below
        }
      ]
    }
  ]
}
```

Localized fields are objects keyed by **language name** (e.g. `"English"`), not language codes. The
language switcher on each template is built from the keys actually present in that menu's data —
not from a fixed list. Initial language: saved per-menu choice (`localStorage`) → `DefaultLanguage`
enum mapped through `_data/languages.yml` → first available key.
`DefaultLanguage` mirrors the `akut.domain` enum: `1=Portuguese, 2=English, 3=Spanish, 4=French,
5=Italian`.

`Allergens` is a numeric ID array (like `Diets`), not a localized text field — item-level
`Ingredients`/`FullDescription` etc. are free-text-per-language, but the structured allergen list is
resolved through `menu-core.js`'s `ALLERGEN_LABELS`, a hardcoded map of the EU's 14 regulated
allergens to per-language labels. Templates call `MenuCore.allergenLabels(item.Allergens, lang)`,
which maps each ID to its translated label (falling back to English) and silently drops any ID not
in the table, so an unrecognized/future enum value never breaks rendering — it just doesn't display.
`ALLERGEN_LABELS` / `allergenLabels` are exported on `MenuCore` the same way `dietLabels` and
`formatPrice` are.

`Tag` (`MenuItemTag`) is a single nullable enum per item — not an array like `Diets`/`Allergens` —
resolved through `menu-core.js`'s `TAG_CONFIG` (menu-core.js:301-307), which maps each of the 5 tag
values to a `UI_STRINGS` key, a CSS slug, and a Bootstrap icon class:

```js
var TAG_CONFIG = {
  1: { key: 'tagNew',            slug: 'new',             icon: 'bi-stars' },
  2: { key: 'tagPopular',        slug: 'popular',         icon: 'bi-graph-up-arrow' },
  3: { key: 'tagChef',           slug: 'chef',            icon: 'bi-award' },
  4: { key: 'tagSeasonal',       slug: 'seasonal',        icon: 'bi-flower2' },
  5: { key: 'tagLimitedEdition', slug: 'limited-edition', icon: 'bi-hourglass-split' }
};
```

`MenuCore.tagBadge(item, lang, cssPrefix)` builds the badge HTML, taking a caller-supplied CSS
prefix so each template gets its own class names (`menu-badge--new`, `db-badge--chef`,
`tr-badge--seasonal`, …) while sharing the same enum/label logic. It returns `''` when `item.Tag` is
falsy or not in `TAG_CONFIG`. If the item is temporarily unavailable
(`Availability.Temporary.Unavailable === true`), it renders an "Unavailable" badge instead — the two
never combine. Classic, deepblue, lisbon, and trattoria all call `Core.tagBadge` directly; senjutsu
has its own `renderTagBadge(item)` (senjutsu.js:183-198) that reimplements the same lookup and
unavailable-override logic but appends a kanji suffix per tag (`SJ_TAG_KANJI`) to match its
Japanese-aesthetic badges.

In category/item grid cards, unavailable items are not hidden or disabled — every template applies
two independent, `isTemporarilyUnavailable`-driven treatments to the same card:
1. **Fade**: the card gets an extra `menu-item-faded` class (e.g. `trattoria.js:381`, same pattern
   in classic/deepblue/lisbon/senjutsu), styled by the shared rule in `assets/css/menu.css:67-68` —
   `opacity: .45`, rising to `.65` on hover/focus. The card stays clickable.
2. **Badge**: `Core.tagBadge`/`renderTagBadge` renders the "Unavailable" badge (icon
   `bi-slash-circle`, or `· 休` suffix for senjutsu) in the same slot a `Tag` badge would occupy,
   overlaid on the card's image.
The item keeps its normal position, image, name, and price — it just reads as dimmed-with-a-badge
rather than being removed from the grid.

### i18n conventions

There are two separate i18n string tables, both keyed by language name with English as the
fallback, both supporting `{placeholder}` substitution:

- `menu-core.js`'s `UI_STRINGS` — labels shared across templates (Details, Ingredients, Back to
  menu, tag badges, error copy, availability text, allergen labels for the EU 14-allergen list).
  Read via `MenuCore.uiText(key, lang, vars)`.
- Each `assets/js/templates/<name>.js` has its own local string table (e.g. `TR_STRINGS` in
  trattoria.js) for template-specific copy (hero taglines, template-flavored microcopy) not shared
  elsewhere. Read via a local `trText(key, vars)`-style helper.

Adding a new template-specific string requires only editing that template's local table — no
registration elsewhere. Adding a shared string goes in `menu-core.js`'s `UI_STRINGS`.
`data-tr-i18n=` / `data-i18n=` attributes in the HTML shell hold English/mixed placeholder text
that's overwritten on load; the placeholder text itself is cosmetic (pre-JS flash) and doesn't need
to be translated.

### Preview mode

`?preview=1` (or a `/preview/<tenant>/<menuId>` path, handled by `404.html`) fetches from the
**ephemeral** S3 bucket (`s3_ephemeral_base`, never cached, for unpublished draft menus) instead of
the production bucket, and renders a template-aware "PREVIEW" band via
`MenuCore.renderPreviewBand(templateSlug)`.

### Adding a new template

1. Create `templates/<name>/index.html` (+ `category/index.html`, `item/index.html` or
   `detail.html` as needed) with front matter setting `permalink`, `template_js: <name>`, optionally
   `template_css: <name>` and `no_chrome: true`.
2. Add `assets/js/templates/<name>.js` as an ES5 IIFE exporting the same render behavior against
   `MenuCore`, filling the appropriate root container(s).
3. Register the page URLs in `_data/templates.yml`.
4. Any menu whose `TemplateId` matches `<name>` now renders with it.

## Deployment

`bundle exec jekyll build` produces the fully static `_site/`, served from GitHub Pages (see
`.github/workflows/jekyll.yml`) or any static host. The S3 menu bucket must allow cross-origin
`GET` — see `deploy/README.md` for the CORS policy and hosting/rewrite notes.

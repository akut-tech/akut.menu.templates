# akut.menu.templates

A [Jekyll](https://jekyllrb.com/) site that renders restaurant menus from
per-tenant JSON hosted on a public S3 bucket. The site is **static** — the
dynamic part (pick tenant → fetch menu → render) happens in the browser, so the
same build serves every tenant.

```
<base-url>/<tenant>            →  loads the menu for <tenant>
                                  https://s3-akut-prod-01.s3.eu-west-1.amazonaws.com/products/menu/active/<tenant>.json
```

For example `<base-url>/test` renders the `test.json` menu.

## How it works

1. **Dispatcher** (`index.html` and `404.html`): resolves the tenant, fetches
   its JSON, reads `TemplateId`, and redirects to that template's main page
   (falling back to the default template when `TemplateId` is missing/unknown).
2. **Template pages** (`templates/<name>/`): a static HTML shell + a renderer in
   `assets/js/templates/<name>.js` that fills the shell from the JSON.
3. **Shared runtime** (`assets/js/menu-core.js`): tenant resolution, fetching,
   i18n, price/diet formatting, and the friendly error screen.

### Tenant routing

The tenant is taken from, in order:

1. the `?tenant=` query string (works on any host), then
2. the first path segment, e.g. `/test` (reserved segments in `_config.yml`
   are ignored).

On static hosts that don't rewrite unknown paths to `index.html`, a clean URL
like `/test` is served as **`404.html`**, which is wired to act as the same
dispatcher — so path-based tenant URLs work on S3 website hosting and GitHub
Pages without extra configuration.

### Templates

Templates live under `templates/<name>/` and each has **two pages**:

| Page   | URL                              | Container       |
| ------ | -------------------------------- | --------------- |
| Main   | `/templates/<name>/`             | `#menu-root`    |
| Detail | `/templates/<name>/detail/`      | `#detail-root`  |

The registry in `_data/templates.yml` maps a `TemplateId` to its pages. The
value `"default"` (used in the sample data) is aliased to `epicurean`.

#### Implemented templates

- **epicurean** (default) — adapted from the Epicurean food template. Main page
  is the food-menu layout; detail page is the shop-details layout, both trimmed
  to the parts relevant to a menu (cart, search, blog, reviews, e-commerce
  widgets removed).
- **deepblue** — a built-from-scratch, deep-ocean seafood theme (dark navy
  palette, gold/aqua accents, vintage display type). Fully responsive across all
  screen sizes with its own self-contained stylesheet
  (`assets/css/deepblue.css`) and chrome (it sets `no_chrome: true` and ships its
  own header/footer). Supports every epicurean capability — multilanguage,
  categories, diet tags, prices, "New" badges, the image **and** YouTube gallery
  (both rendered in one fixed-size 16:9 frame so the layout never jumps), the
  description / ingredients & allergens tabs, related items, and the friendly
  error screen. Its demo content is **stored in the project** at
  `assets/data/deepblue-menu.json` (free imagery from Unsplash): when no
  `?tenant=` is present it renders that bundled menu, and with a tenant it loads
  that tenant's menu from S3 like any other template. Preview it at
  `/templates/deepblue/`.

## Menu JSON shape

```jsonc
{
  "Id": "…",
  "Logo": { "Url": "…", "Title": "…" },
  "Name":        { "English": "Lunch Menu" },      // localized
  "Description": { "English": "…" },               // localized
  "Notes": "Available 12pm–3pm",
  "TemplateId": "default",                          // which template renders it
  "DefaultLanguage": 2,                             // enum → _data/languages.yml
  "Currency": 1,                                    // enum → _data/currencies.yml
  "Status": 1,
  "Categories": [
    {
      "Id": "…", "Order": 1,
      "Name": { "English": "Starters" },
      "Description": { "English": "…" },
      "Items": [
        {
          "Id": "…", "Order": 1,
          "Diets": [2, 3],                          // enum → _data/diets.yml
          "Images": [{ "Url": "…", "Order": 0 }],
          "Name":             { "English": "Tomato Soup" },
          "ShortDescription": { "English": "…" },
          "FullDescription":  { "English": "…" },
          "Ingredients":      { "English": "…" },
          "Allergens":        { "English": "…" },
          "Price": 5.5,
          "IsNew": false
        }
      ]
    }
  ]
}
```

### Multilanguage

Localized fields are objects keyed by **language name** (e.g. `"English"`). The
language switcher is built from the keys actually present in the data. The
initial language is the saved choice, then `DefaultLanguage`, then the first
available key.

### Enum mappings (configurable)

The numeric enums are mapped in `_data/`:

- `languages.yml` — `DefaultLanguage` → language key + display label
- `currencies.yml` — `Currency` → code + symbol (mirrors the `akut.domain`
  `Currency` enum: `1 = Euro`, `2 = Dollar`, `3 = Pound`)
- `diets.yml` — `Diets` values → labels

> `Currency` mirrors the `akut.domain` enum. The remaining `DefaultLanguage`
> and `Diets` mappings are inferred from sample data (`DefaultLanguage: 2 =
> English`, `Diets: 2,3`) — update those files to match the real Akut enums.

## Error handling

If the menu can't be loaded (no tenant, 404, network/CORS, or a service error),
a friendly screen is shown via `MenuCore.renderError` instead of a blank page.

## Local development

```bash
bundle install
bundle exec jekyll serve
```

Then open:

- `http://localhost:4001/?tenant=test` — live `test` menu from S3
- `http://localhost:4001/templates/epicurean/?tenant=test` — template directly

A bundled demo menu lives at `assets/data/sample-menu.json` for reference and
offline design work.

## Deployment

The site is fully static — `bundle exec jekyll build` produces `_site/`, which
can be served from any static host.

> **Important:** the menu bucket must allow cross-origin `GET` requests or the
> browser will block every fetch. See [`deploy/README.md`](./deploy/README.md)
> for the required S3 CORS policy and hosting/rewrite options.

## Adding a new template

1. Create `templates/<name>/index.html` and `templates/<name>/detail/…` (set
   `permalink` and `template_js: <name>`). Optionally set `template_css: <name>`
   to load `assets/css/<name>.css` for that template only, and `no_chrome: true`
   if the template supplies its own header/footer instead of the shared chrome
   (see **deepblue** for an example of both).
2. Add `assets/js/templates/<name>.js` exporting the same render behaviour
   (fill `#menu-root` / `#detail-root`).
3. Register it in `_data/templates.yml`.
4. Any menu whose `TemplateId` is `<name>` now renders with it.

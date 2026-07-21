# Ticket — Create New `<TEMPLATE_NAME>` Menu Template

> **This is a generic/reusable ticket template.** Duplicate it for each new menu template and fill
> in the placeholders marked `<…>` — theme, name, colors, page-set shape. Everything else
> (data schema, enums, technical constraints) is stable across templates and shouldn't need
> editing.

### Summary
Develop a new template (`assets/js/templates/<template-slug>.js` + HTML shell(s) under
`templates/<template-slug>/`) for the menu rendering site, themed around `<THEME, e.g. "brunch",
"steakhouse", "wine bar">`. The template must consume the existing menu JSON schema as-is and
render via `_data/templates.yml` registration under `TemplateId: "<template-slug>"`.

The visual theme should evoke `<mood/imagery description, e.g. "eggs, bread, salads, coffee, and
juices for a warm brunch atmosphere">`. The template must be fully compatible with the existing
localization, currency, diet, allergen, and tag enums documented below — no schema changes.

---

## Goals
- Create a `<adjectives, e.g. "warm, modern">` `<THEME>`-style UI.
- Ensure full compatibility with the provided menu JSON shape — no new/renamed fields.
- Provide a responsive layout suitable for mobile, tablet, and desktop.
- Support dynamic language switching based on the localized keys actually present in the data
  (not a fixed list).
- Support dynamic currency rendering via the `Currency` enum.
- Reuse `window.MenuCore` for all shared logic (fetch, i18n, formatting, badges) — no duplicated
  business logic in the template's own JS.

---

## Page-set shape (decide before starting)
Two shapes already exist in this codebase — pick one and delete the other section below:

- **Two-page** (pattern used by `classic`, `deepblue`): `main` page (`#menu-root`, category grid)
  + `detail` page (`#detail-root`, item detail). Front matter file for the detail page is
  `detail.html` directly under `templates/<template-slug>/`, not a subdirectory.
- **Three-page** (pattern used by `senjutsu`, `lisbon`, `trattoria`): `main` page (`#menu-root`,
  homepage/category overview) + `category` page (`#category-root`, `category/index.html`, items
  grid for one category) + `detail` page (`#item-root`, `item/index.html`, full item info). The
  detail page is optional — `senjutsu` has none and links straight from the category grid back to
  itself/no further drill-down.

`<PAGE_SET_SHAPE: two-page | three-page — TBD>`

---

## Deliverables

### Page 1 — Index / Home (`#menu-root`)
- Header: logo, menu name (localized), description (localized), notes (`Notes`, plain string, not
  localized).
- Grid/list of all categories (three-page) — or, for two-page templates, this page shows the full
  category → item hierarchy directly.
- Each category entry: name (localized), description (localized, optional), link to its category
  or detail view.
- Language switcher (built from the keys present in the loaded menu's localized fields).
- Currency is inferred from the menu, not user-selectable.

### Page 2 — Category (`#category-root`, three-page only)
- Header: category name + description (localized).
- List/grid of items in that category, each card showing:
  - First image from `Images[]` (sorted/selected by `Order`), or a placeholder if none.
  - Item name (localized), short description (localized).
  - Price, formatted via `MenuCore.formatPrice(item.Price, menu.Currency, lang)` — always two
    decimals, symbol from the `Currency` enum.
  - Diet labels via `MenuCore.dietLabels(item.Diets, lang)`.
  - Tag badge via `MenuCore.tagBadge(item, lang, '<cssPrefix>-badge')` — see **Tags** below for the
    unavailable-override behavior that also happens on this page.
  - Link to the item detail page (or to an in-page expand/modal for two-page templates).

### Page 3 — Item Detail (`#detail-root` or `#item-root`)
- Media gallery/carousel combining `Images[]` (ordered by `Order`) **and** `YouTubeVideoUrls[]`
  (an item can have both). Classic, deepblue, and trattoria merge them into one ordered gallery —
  images first, then any parseable YouTube videos, each rendered as an embedded player slide;
  lisbon and senjutsu instead show a separate "Watch on YouTube" link/button alongside the image
  gallery rather than embedding the video inline. Pick one pattern per the chosen design. Only the
  first URL is guaranteed to be used by some templates (`lisbon.js`) — check whether this template
  should support multiple videos per item or just the first.
- Item name (localized), tag value (rendered same as the badge, or as plain text per design).
- Full description (`FullDescription`, localized).
- Ingredients (`Ingredients`, localized free text).
- Allergens: full labeled list via `MenuCore.allergenLabels(item.Allergens, lang)`.
- Diets: full labeled list via `MenuCore.dietLabels(item.Diets, lang)`.
- Availability: temporarily-unavailable state (see **Availability** below) and, if present, the
  recurring-schedule note via `MenuCore.standardAvailabilityText(item, lang)` (e.g. "Available only
  on weekends" — renders `''` when `Availability.Standard.Days` covers all 7 days or is unset).
- Price.
- Back navigation to the category (or index) page.

---

## Loading State
Every template needs its own themed loading animation — reusing the default "Epicurean" amber ring
spinner is only correct for the `classic` template. There are **two** separate loading moments to
design for, both CSS-only (transform/opacity, no images/GIFs) for performance:

1. **Boot preloader** — the full-screen overlay shown from first paint until page assets finish
   loading (`.preloader` in `_layouts/base.html`, shared across all templates). Add a
   `.preloader--<template-slug>` block to `assets/css/<template-slug>.css` that hides the generic
   ring + logo and styles the shared 4-element `.preloader-theme-el` slot into this template's
   shape. Because `.preloader` sits outside the template's root wrapper in the DOM, this block must
   redeclare any CSS custom properties (colors) it needs — they are not inherited from `.db`/`.sj`/
   etc. See `CLAUDE.md`'s **Loading states** section for the exact convention and gotcha.
2. **In-content loader** — the small placeholder inside `#menu-root` / `#category-root` /
   `#item-root` / `#detail-root`, shown while the S3 menu JSON is being fetched. Static markup
   baked into each page: `<div class="<prefix>-loading"><div class="<prefix>-loader">…</div>
   <span>Loading…</span></div>`, styled in the same `assets/css/<template-slug>.css`.

Look at `deepblue`/`senjutsu`/`lisbon`/`trattoria`/`brunch` for reference implementations (bubbles,
pulsing disc, tile grid, flag bars, coffee beans) — same technique, different shape per theme.

Add this template's two loading swatches (boot preloader + in-content loader) to
`dev/loading-preview.html` (`/dev/loading-preview/`) — it's a static, hand-maintained reference
page and does not pick up new templates automatically.

---

## Color Schema — `<THEME>` (placeholder values, replace before implementation)
The palette should evoke `<mood, e.g. "warmth, freshness, and morning comfort">`.

### Primary Colors
- `<#HEXHEX>` — `<name, e.g. "Warm cream (background base)">`
- `<#HEXHEX>` — `<name>`
- `<#HEXHEX>` — `<name>`
- `<#HEXHEX>` — `<name, e.g. "accent/buttons">`

### Secondary Colors
- `<#HEXHEX>` — `<name>`
- `<#HEXHEX>` — `<name>`
- `<#HEXHEX>` — `<name>`

### Typography Colors
- `<#HEXHEX>` — Primary text
- `<#HEXHEX>` — Secondary text
- `<#HEXHEX>` — Text on dark backgrounds

### Status / Tag Colors
(One color per `Tag` enum value — see the **Item Tags** table below for the fixed set of 5.)
- New — `<#HEXHEX>`
- Popular — `<#HEXHEX>`
- Recommended by Chef — `<#HEXHEX>`
- Seasonal — `<#HEXHEX>`
- Limited Edition — `<#HEXHEX>`
- Unavailable (not a `Tag` value — see **Availability** below) — `<#HEXHEX, typically a neutral/grey>`

### UI Behavior
- Soft shadows, rounded corners (`<8–12px or per design>`).
- Optional subtle `<THEME>`-referencing texture/imagery.
- Hover states using slightly darker/lighter tones of the primary colors.
- Define the palette as CSS custom properties (`:root { --<prefix>-color-…: … }`) in
  `assets/css/<template-slug>.css` rather than hardcoding hex values in markup or JS.

---

## Data Schema Integration

### Localization
All text fields (`Name`, `Description`, `ShortDescription`, `FullDescription`, `Ingredients`) are
objects keyed by **language name** (e.g. `"English"`), not language codes. Render using the
currently-selected language key, falling back to English. The language switcher must be built from
the keys actually present in the loaded menu's data — never from a fixed list — since not every
tenant provides every language.

Copy needed only by this template (hero taglines, template-flavored microcopy) goes in a local
string table inside `<template-slug>.js` (pattern: `TR_STRINGS`/`trText()` in `trattoria.js`) — do
**not** add template-specific copy to `menu-core.js`'s shared `UI_STRINGS`. Only propose additions
to the shared table for strings that are genuinely reusable across templates (e.g. a new shared
label).

### Currency
Render price via `MenuCore.formatPrice(price, menu.Currency, lang)`. Currency is per-menu, not
user-selectable; symbol comes from the `Currency` enum (see table below).

### Media (images & YouTube videos)
An item's media comes from two fields: `Images[]` (sorted by `Order`, each entry exposing
`Link.Thumbnail` / `Link.FullSize` URLs) and `YouTubeVideoUrls[]` (an array of full YouTube URLs,
not IDs — parse the 11-char video ID out of `watch?v=`, `youtu.be/`, `/embed/`, and `/shorts/`
shapes; a URL that doesn't parse should be skipped, not shown as broken). Both are optional and
independent — an item can have images only, video only, both, or neither.

Existing templates diverge on how these combine on the item detail page, so **pick one pattern
and document the choice**:
- **Merged gallery** (classic, deepblue, trattoria): images and videos are unified into one ordered
  gallery — all images first (in `Order`), then each parseable video as its own embedded-player
  slide (`https://www.youtube.com/embed/<id>`), using a YouTube thumbnail
  (`https://img.youtube.com/vi/<id>/hqdefault.jpg`) for its slide/thumbnail preview.
- **Separate video link** (lisbon, senjutsu): the image gallery stays images-only, and a distinct
  "Watch on YouTube" button/link sits alongside it, opening/playing only the first
  `YouTubeVideoUrls[0]`.

If multiple videos matter for this template, use the merged-gallery pattern — the separate-link
pattern in the existing templates only surfaces the first URL.

### Diets
Display via `MenuCore.dietLabels(item.Diets, lang)` — returns translated label strings, English
fallback per entry.

### Allergens
Display via `MenuCore.allergenLabels(item.Allergens, lang)`. Any ID not in the table is silently
dropped (not rendered, no error) — this is intentional forward-compatibility with future enum
values, don't "fix" it by throwing/logging.

### Tags
`Tag` is a single nullable enum per item (not an array). Render via
`MenuCore.tagBadge(item, lang, '<cssPrefix>-badge')`, passing this template's own CSS prefix so
badge classes don't collide with other templates (e.g. `tr-badge--seasonal`, `db-badge--chef`).
Returns `''` when `item.Tag` is falsy or unrecognized.

### Availability (temporarily-unavailable items)
This is **not** a `Tag` value — it's an independent flag,
`item.Availability.Temporary.Unavailable === true`, checked via
`MenuCore.isTemporarilyUnavailable(item)`. It affects rendering in two places at once, and the two
never combine with a normal tag badge:

1. **List/grid cards** (Page 2 and, for two-page templates, Page 1): the card gets an extra
   `menu-item-faded` class (shared rule in `assets/css/menu.css`: `opacity: .45`, rising to `.65`
   on hover/focus) — the card stays clickable, it's just visually dimmed. `MenuCore.tagBadge`
   checks `isTemporarilyUnavailable` **first**: if true, it returns an "Unavailable" badge (icon
   `bi-slash-circle`) in the same slot a `Tag` badge would occupy, instead of looking at `item.Tag`
   at all.
2. **Detail page**: show the same "Unavailable" state clearly (badge and/or inline text via
   `MenuCore.uiText('tagUnavailable', lang)`), plus the recurring-schedule note
   (`MenuCore.standardAvailabilityText`) if set — these are independent: an item can have a
   recurring schedule note, a temporary-unavailable flag, both, or neither.

Do not build a separate 6th "tag" for unavailable — it must stay a distinct availability signal
layered on top of (and overriding) the tag badge, matching every existing template's behavior.

### Preview mode
Support `?preview=1` (fetches from the ephemeral S3 bucket instead of production, for unpublished
draft menus) by calling `MenuCore.fetchPreviewMenu` where applicable and rendering the "PREVIEW"
band via `MenuCore.renderPreviewBand('<template-slug>')`.

---

## Technical Requirements
- ES5 IIFE in `assets/js/templates/<template-slug>.js`, driven by `DOMContentLoaded`, matching the
  existing templates' style (no build step, no frameworks/bundlers — loaded directly by the
  browser).
- HTML shell(s) under `templates/<template-slug>/` with Jekyll front matter: `permalink`,
  `template_js: <template-slug>`, optionally `template_css: <template-slug>` (loads
  `assets/css/<template-slug>.css`) and `no_chrome: true` if the template supplies its own
  header/footer instead of the shared `_includes/header.html` / `footer.html`.
- Register all page URLs under `_data/templates.yml` → `list.<template-slug>`, matching the chosen
  page-set shape.
- CSS custom properties for the color schema; class names prefixed per-template (e.g. `<prefix>-`)
  to avoid collisions with other templates' shared-page CSS.
- Reusable markup/CSS components: category card, item card, tag badge, diet/allergen display,
  unavailable state.
- Add bundled demo data at `assets/data/<template-slug>-menu.json` so the template renders
  standalone at `templates/<template-slug>/` with no `?tenant=` query string (matching classic,
  deepblue, senjutsu, lisbon, trattoria).
- Reminder: `_site/` is committed and some files under it are hardlinked to their
  `assets/js/templates/*.js` counterparts — check with `ls -i` before editing generated output by
  hand.

---

## Domain data reference

### Menu JSON shape
```jsonc
{
  "Id": "…",
  "Logo": { "Url": "…", "Title": "…" },
  "Name": { "English": "Lunch Menu" },        // localized: object keyed by language NAME
  "Description": { "English": "…" },
  "Notes": "Available 12pm–3pm",
  "TemplateId": "default",                    // matched against _data/templates.yml
  "DefaultLanguage": 2,                        // enum, see Languages below
  "Currency": 1,                               // enum, see Currencies below
  "Status": 1,
  "Categories": [
    {
      "Id": "…", "Order": 1,
      "Name": { "English": "Starters" },
      "Description": { "English": "…" },
      "Items": [
        {
          "Id": "…", "Order": 1,
          "Diets": [2, 3],                     // enum array, see Diets below
          "Images": [{
            "Order": 0,
            "Title": "…",
            "Link": { "Thumbnail": "…", "FullSize": "…" }
          }],
          "YouTubeVideoUrls": ["https://www.youtube.com/watch?v=…"], // see Media below, optional
          "Name": { "English": "Tomato Soup" },
          "ShortDescription": { "English": "…" },
          "FullDescription": { "English": "…" },
          "Ingredients": { "English": "…" },
          "Allergens": [7, 1, 8],              // enum array, see Allergens below (EU 14-allergen list)
          "Price": 5.5,
          "Tag": 1,                            // nullable single enum, see Tags below
          "Availability": {
            "Temporary": { "Unavailable": false },
            "Standard": { "Days": [] }         // optional recurring schedule, e.g. [6,7] = weekends only
          }
        }
      ]
    }
  ]
}
```

Localized fields (`Name`, `Description`, `ShortDescription`, `FullDescription`, `Ingredients`) are
objects keyed by **language name** (e.g. `"English"`), not language codes. The language switcher is
built from the keys actually present in a given menu's data, not from a fixed list.

### Languages (`DefaultLanguage`, mirrors `akut.domain` `Language` enum)
| Id | Key (used as JSON key) | Code | Label |
|----|------------------------|------|-------|
| 1 | Portuguese | pt | Português |
| 2 | English    | en | English |
| 3 | Spanish    | es | Español |
| 4 | French     | fr | Français |
| 5 | Italian    | it | Italiano |

Initial language resolution order: saved per-menu choice (`localStorage`) → `DefaultLanguage` enum
→ first available key in the menu's localized objects.

### Currencies (`Currency`, mirrors `akut.domain` `Currency` enum)
| Id | Code | Symbol |
|----|------|--------|
| 1 | EUR | € |
| 2 | USD | $ |
| 3 | GBP | £ |

### Diets (`Diets[]`, mirrors `akut.domain` `FoodDietType` enum)
| Id | English | Portuguese | Spanish | French | Italian |
|----|---------|------------|---------|--------|---------|
| 1 | Vegan | Vegano | Vegano | Végétalien | Vegano |
| 2 | Vegetarian | Vegetariano | Vegetariano | Végétarien | Vegetariano |
| 3 | Gluten-Free | Sem Glúten | Sin Gluten | Sans Gluten | Senza Glutine |
| 4 | Lactose-Free | Sem Lactose | Sin Lactosa | Sans Lactose | Senza Lattosio |
| 5 | Egg-Free | Sem Ovos | Sin Huevo | Sans Œuf | Senza Uova |
| 6 | Sugar-Free | Sem Açúcar | Sin Azúcar | Sans Sucre | Senza Zucchero |
| 7 | Caffeine-Free | Sem Cafeína | Sin Cafeína | Sans Caféine | Senza Caffeina |
| 8 | Alcohol-Free | Sem Álcool | Sin Alcohol | Sans Alcool | Senza Alcol |
| 9 | Low-Carb | Baixo em Carboidratos | Bajo en Carbohidratos | Pauvre en Glucides | Povero di Carboidrati |
| 10 | Low-Fat | Baixo em Gordura | Bajo en Grasa | Pauvre en Matières Grasses | Povero di Grassi |
| 11 | Low-Salt | Baixo em Sal | Bajo en Sal | Pauvre en Sel | Povero di Sale |
| 12 | Low-Sugar | Baixo em Açúcar | Bajo en Azúcar | Pauvre en Sucre | Povero di Zucchero |
| 13 | Organic | Biológico | Orgánico | Biologique | Biologico |
| 14 | Bio | Bio | Bio | Bio | Bio |
| 15 | Kosher | Kosher | Kosher | Casher | Kosher |
| 16 | Raw | Cru | Crudo | Cru | Crudo |
| 17 | Spicy | Picante | Picante | Épicé | Piccante |

### Allergens (`Allergens[]`, EU 14-allergen list, resolved via `MenuCore.allergenLabels`)
| Id | English | Portuguese | Spanish | French | Italian |
|----|---------|------------|---------|--------|---------|
| 1 | Gluten | Glúten | Gluten | Gluten | Glutine |
| 2 | Crustaceans | Crustáceos | Crustáceos | Crustacés | Crostacei |
| 3 | Eggs | Ovos | Huevos | Œufs | Uova |
| 4 | Fish | Peixe | Pescado | Poisson | Pesce |
| 5 | Peanuts | Amendoins | Cacahuetes | Cacahuètes | Arachidi |
| 6 | Soybeans | Soja | Soja | Soja | Soia |
| 7 | Milk | Leite | Leche | Lait | Latte |
| 8 | Nuts | Frutos de casca rija | Frutos de cáscara | Fruits à coque | Frutta a guscio |
| 9 | Celery | Aipo | Apio | Céleri | Sedano |
| 10 | Mustard | Mostarda | Mostaza | Moutarde | Senape |
| 11 | Sesame | Sésamo | Sésamo | Sésame | Sesamo |
| 12 | Sulphites | Sulfitos | Sulfitos | Sulfites | Solfiti |
| 13 | Lupin | Tremoço | Altramuces | Lupin | Lupini |
| 14 | Molluscs | Moluscos | Moluscos | Mollusques | Molluschi |

An ID not present in this table is silently dropped by `allergenLabels` — no broken rendering on
schema extensions.

### Item Tags (`Tag`, single nullable enum per item — an item has at most one tag)
| Id | Tag name |
|----|----------|
| 1 | New |
| 2 | Popular |
| 3 | Recommended by Chef |
| 4 | Seasonal |
| 5 | Limited Edition |

### Availability (not a `Tag` enum — a separate flag, see **Availability** above)
| Field | Meaning |
|-------|---------|
| `Availability.Temporary.Unavailable === true` | Item is temporarily out of stock/off-menu. Rendered as a faded card (`opacity: .45`) + an "Unavailable" badge that replaces (never combines with) the `Tag` badge. |
| `Availability.Standard.Days` | Optional recurring-availability schedule (array of weekday numbers). Renders a human-readable note (e.g. "Available only on weekends") when set to fewer than all 7 days; renders nothing otherwise. Independent of the temporary-unavailable flag. |

### Existing template registry (`_data/templates.yml`), for reference
| Key | Page-set shape | Pages |
|-----|-----------------|-------|
| classic (default) | Two-page | main (`#menu-root`) + detail (`#detail-root`) |
| deepblue | Two-page | main (`#menu-root`) + detail (`#detail-root`) |
| senjutsu | Three-page, no detail page | main (`#menu-root`) + category (`#category-root`) |
| lisbon | Three-page | main (`#menu-root`) + category (`#category-root`) + item (`#item-root`) |
| trattoria | Three-page | main (`#menu-root`) + category (`#category-root`) + item (`#item-root`) |

Legacy `TemplateId` aliases resolved to `classic`: `default`, `epicurean`, `epicureanm`.

---

## Acceptance Criteria
- [ ] A menu with `"TemplateId": "<template-slug>"` redirects (via the `404.html` dispatcher) to
      this template's main page and renders correctly.
- [ ] All three (or two, per chosen shape) pages render correctly using the standard JSON shape.
- [ ] Template renders standalone at `templates/<template-slug>/` using its own bundled demo JSON,
      with no `?tenant=` needed.
- [ ] Template renders live S3 data at `?tenant=test`.
- [ ] Visual design matches the `<THEME>` mood and the color schema above.
- [ ] Language switching works dynamically across whatever keys are present in the loaded menu.
- [ ] Currency renders correctly per the `Currency` enum.
- [ ] Diets, allergens, and tag badges render per the enum tables above, with unrecognized IDs
      silently dropped (no broken rendering).
- [ ] Temporarily-unavailable items show the faded-card + "Unavailable" badge treatment (never
      combined with a `Tag` badge) in both grid and detail views.
- [ ] Recurring-availability note (`Availability.Standard.Days`) renders when applicable.
- [ ] Preview mode (`?preview=1`) works and shows the "PREVIEW" band.
- [ ] Template has its own themed boot preloader and in-content loader (not the default classic
      ring spinner) — see **Loading State** above.
- [ ] This template's loading swatches are added to `dev/loading-preview.html`.
- [ ] No broken rendering when optional fields (`Description`, `ShortDescription`, `Images`,
      `Notes`, `Tag`, `Diets`, `Allergens`) are missing.
- [ ] Fully responsive across mobile, tablet, desktop.
- [ ] `bundle exec jekyll build` completes with no errors.

## Out of scope
- Backend/`akut.domain` changes — this ticket is presentation-layer only, consuming the existing
  menu JSON schema and enums as-is.
- New enum values (languages, currencies, diets, allergens, tags) — if a future design requires new
  values here, that's a separate cross-repo ticket.

## Open questions / placeholders to fill in per use
- Template name / `TemplateId` value: `<template-slug>`
- Theme / mood / target imagery: `<THEME>`
- Color palette hex values: see **Color Schema** section
- Page-set shape (two-page vs three-page): `<TBD>`
- Does this template need its own header/footer (`no_chrome: true`) or use the shared chrome?
  `<TBD>`

# Design Brief — New Menu Template: `<TEMPLATE_NAME>`

> **This is a reusable design brief.** Duplicate it for each new template and fill in the
> placeholders marked `<…>` — theme, mood, colors, imagery. This version is written for designers
> and other non-technical stakeholders: it describes what needs to be designed and why, not how
> it gets built. For the engineering/implementation ticket, see `new-template-ticket.md` in this
> same folder.

## What we're designing
A new visual style ("template") for digital restaurant menus. Diners scan a QR code or open a
link, and land on a menu that uses this design. One design has to work for **every restaurant**
that picks this template — so it's a *system* (reusable page layouts + components), not a single
one-off menu design for one restaurant.

**Theme / mood:** `<e.g. "brunch — warm, fresh, morning comfort">`
**Reference imagery / inspiration:** `<mood board link, Pinterest, competitor screenshots, etc.>`

---

## The three screens

Every menu in this style is made of up to three screens, viewed in this order. (Some templates
skip the middle screen and go straight from the overview to an item's details — flag if you want
to explore that too.)

### 1. Menu Overview
The landing screen. Shows the restaurant's branding and the list of menu categories (e.g.
"Starters", "Mains", "Desserts", "Drinks") as the way into the menu.

**Needs to show:**
- Restaurant/menu logo
- Menu name (e.g. "Lunch Menu", "Dinner Menu")
- Menu description (optional — not every restaurant fills this in)
- A short note field some restaurants use for things like "Available 12pm–3pm" (optional)
- Each category, as a card or list entry: category name + a short category description (optional)
- A language switcher, if the restaurant has translated their menu (see **Languages** below)

### 2. Category Screen
Reached by tapping a category from the overview. Shows every dish/drink within that one category.

**Needs to show, per item:**
- Item photo (may be missing — design a placeholder/empty state)
- Item name
- A short one-line description (optional)
- Price
- Small dietary icons/labels (e.g. Vegan, Gluten-Free — see **Diets** below)
- A badge for special items (New / Popular / Chef's pick / Seasonal / Limited — see **Tags**
  below) — **at most one badge per item**
- A visual treatment for items that are temporarily out of stock (see **Unavailable items** below)

### 3. Item Detail Screen
Reached by tapping an item. The full picture of one dish/drink.

**Needs to show:**
- One or more photos **and/or YouTube videos**, in a gallery/carousel — an item can have any mix of
  the two (photos only, video only, both, or neither). Design how a video slide reads within the
  gallery (e.g. a play-button overlay on its thumbnail) as well as a standalone "watch video"
  button as an alternative pattern, in case the layout works better with the video kept separate
  from the photo gallery rather than mixed into it — flag which approach fits this design.
- Item name
- The same special-item badge as the category screen, if it has one
- A longer, full description
- An ingredients list (free text, e.g. "Tomato, basil, mozzarella, olive oil")
- Full allergen list, written out (not just icons) — see **Allergens** below
- Full diet list, written out
- Price
- Unavailable state, if applicable, shown more prominently than on the category screen
- An occasional extra note like "Available only on weekends" for items with limited scheduling
  (optional — most items won't have this)
- A clear way back to the category (or overview)

---

## Components to design
Design these as reusable pieces, since the same component repeats many times per menu:

- **Category card** (overview screen)
- **Item card** (category screen) — needs an image state and a no-image state
- **Special-item badge** — 5 variants (New, Popular, Chef's Pick, Seasonal, Limited Edition), each
  visually distinct but part of one family
- **Unavailable treatment** — how a card looks when the dish is temporarily out of stock (this
  replaces the special-item badge, it never shows alongside one — see below)
- **Diet icon/label set** — see **Diets**, 17 possible values, but most menus only use a handful
- **Allergen list style** — see **Allergens**, 14 EU-regulated values, always shown as full labels
  (icons optional/nice-to-have, not required)
- **Language switcher**
- **Price display** — must accommodate 3 currencies (€, $, £)
- **Media gallery/carousel** (item detail screen) — mixes photos and YouTube videos; design a video
  slide/thumbnail treatment (e.g. play-button overlay) plus a standalone "watch video" button as
  the alternative layout pattern
- **Empty/placeholder states**: no photo, no video, no description, no category description, no
  notes — all of these fields are optional per-restaurant, so every screen needs to look
  intentional when they are missing, not broken
- **Loading animation** — a small, simple motif that reads as "this theme" at a glance (e.g. rising
  bubbles for a seafood theme, coffee beans for a brunch theme). It appears twice: briefly
  full-screen while the page itself loads, and again as a small inline placeholder while the menu
  data loads. Keep it minimal and quick to render — one or two shapes animating with a simple
  loop, not an illustration or multi-second sequence.

---

## Unavailable items — important interaction detail
Some dishes are temporarily out of stock (e.g. kitchen ran out today) without being removed from
the menu entirely. This needs a distinct, consistent visual treatment across the category and
detail screens:

- The item stays visible in its normal place — it is **not** hidden or removed.
- It reads as visually "dimmed" or de-emphasized compared to available items.
- It shows a clear "Unavailable" label/badge.
- This label **replaces** the special-item badge (New/Popular/etc.) — an item is never shown with
  both at once, so design them as mutually exclusive states of the same badge slot, not two
  separate elements.

---

## Languages — design for variable text length
A restaurant may offer their menu in up to 5 languages: Portuguese, English, Spanish, French,
Italian. Not every restaurant translates into all 5 — the language switcher only shows the
languages that restaurant actually provided.

**Design implication:** every text element (names, descriptions, badges, category titles) needs to
gracefully handle noticeably longer strings in some languages (French and Portuguese phrases tend
to run longer than the English equivalent) without breaking the layout — plan for wrapping,
truncation with "read more," or flexible-height cards rather than fixed pixel-perfect text boxes.

---

## Currency — design for 3 symbols
Prices can appear in €, $, or £ depending on the restaurant's country. Design the price display so
the symbol and number work in any of the three, at both the category-card (compact) and
detail-page (larger, potentially with a "from"/prominent price treatment) sizes.

---

## Diets (up to 17 possible values per item, shown as a set of small labels/icons)
Vegan, Vegetarian, Gluten-Free, Lactose-Free, Egg-Free, Sugar-Free, Caffeine-Free, Alcohol-Free,
Low-Carb, Low-Fat, Low-Salt, Low-Sugar, Organic, Bio, Kosher, Raw, Spicy.

An item can have zero, one, or several of these at once. Design a compact label/icon style that
still reads clearly when an item has 3–4 diet tags stacked together on a small card.

## Allergens (the 14 EU-regulated allergens, always written out in full on the detail screen)
Gluten, Crustaceans, Eggs, Fish, Peanuts, Soybeans, Milk, Nuts, Celery, Mustard, Sesame,
Sulphites, Lupin, Molluscs.

This is a legal/safety disclosure, so it must always be legible text (icons can supplement, not
replace, the written label) and should be easy to scan on the detail screen.

## Special-item badges — the fixed set of 5
New, Popular, Recommended by Chef, Seasonal, Limited Edition.

An item has **at most one** of these (never more). Design them as one visual family (shared shape/
style) with a distinguishing color or icon per type, so users learn to recognize "this is a
special badge" at a glance regardless of which one it is.

---

## Color palette (placeholder — replace before handoff)
### Primary
- `<#HEXHEX>` — `<e.g. "background base">`
- `<#HEXHEX>` — `<e.g. "card background">`
- `<#HEXHEX>` — `<e.g. "primary accent">`
- `<#HEXHEX>` — `<e.g. "buttons/CTAs">`

### Secondary
- `<#HEXHEX>` — `<name>`
- `<#HEXHEX>` — `<name>`
- `<#HEXHEX>` — `<name>`

### Typography
- `<#HEXHEX>` — Primary text
- `<#HEXHEX>` — Secondary text
- `<#HEXHEX>` — Text on dark backgrounds

### Badge colors (one per special-item type)
- New — `<#HEXHEX>`
- Popular — `<#HEXHEX>`
- Recommended by Chef — `<#HEXHEX>`
- Seasonal — `<#HEXHEX>`
- Limited Edition — `<#HEXHEX>`
- Unavailable — `<#HEXHEX, typically neutral/grey>`

### Look & feel notes
- Corner rounding: `<e.g. "8–12px, soft">`
- Shadows: `<e.g. "soft, subtle depth on cards">`
- Hover/tap states: `<e.g. "slightly darker tone of the base color">`
- Optional theme texture/imagery: `<e.g. "subtle background pattern referencing the theme">`

---

## Devices & responsiveness
Menus are viewed almost entirely on **phones** (diners scanning a QR code at their table) — design
mobile-first. The same screens also need to hold up on tablet and desktop for restaurants that
display the menu on a larger screen (host stand, in-store display), so provide layouts for all
three: mobile, tablet, desktop.

---

## What "done" looks like for this brief
- [ ] Overview, category, and detail screens designed at mobile / tablet / desktop widths.
- [ ] All components listed above designed, including their empty/placeholder states.
- [ ] Special-item badges (5 types) and the Unavailable state designed as one coherent family.
- [ ] Diet and allergen display styles designed, including a "several diets on one card" case.
- [ ] Text treatments checked against a long-string example (e.g. a French item name/description)
      to confirm layouts don't break.
- [ ] Price display designed for all 3 currency symbols.
- [ ] Loading animation designed (full-screen and small inline versions). Once built, it's viewable
      alongside every other template's at `/dev/loading-preview/` (engineering dev page) for a
      quick side-by-side sanity check.
- [ ] Color palette and type styles finalized and handed off as tokens/styles (not just used ad hoc
      in the mockup).
- [ ] Final files/handoff format: `<e.g. Figma link, exported specs, asset export>`

## Not part of this brief
- How the menu data is stored, fetched, or updated — that's handled by the existing system.
- Editing which languages, currencies, diets, allergens, or badge types exist — this design must
  work within the fixed sets listed above; adding new ones is a separate, larger initiative.

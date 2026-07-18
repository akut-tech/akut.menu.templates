## Ticket — Create New Brunch Menu HTML Template (3-Page Structure)

### Summary
Develop a new HTML/CSS template for a brunch-themed restaurant menu. The template must support the existing menu JSON schema and render three distinct pages:
1. Index Page — Displays all categories
2. Category Page — Displays all items within a selected category
3. Item Details Page — Displays full item information, including images, diets, allergens, and descriptions

The visual theme should evoke a brunch atmosphere using elements such as eggs, bread, salads, coffee, and juices. The template must be fully compatible with the existing localization, currency, diet, allergen, and tag enums.

---

## Goals
- Create a warm, modern brunch-style UI.
- Ensure full compatibility with the provided menu JSON shape.
- Provide a responsive layout suitable for mobile, tablet, and desktop.
- Support dynamic language switching based on available localized fields.
- Support dynamic currency rendering.
- Provide reusable components for category cards, item cards, and item detail sections.

---

## Deliverables
### 1. HTML Structure
#### Page 1 — Index (Categories Overview)
- Header with logo, menu name, description, notes.
- Grid or card layout listing all categories.
- Each category card includes:
    - Category name (localized)
    - Category description (optional)
    - Category image (optional future extension)
    - Link to category page

#### Page 2 — Category Page (Items List)
- Header with category name + description
- List of items with:
    - Item image (first image in `Images[]`)
    - Item name (localized)
    - Short description (localized)
    - Price (with currency symbol)
    - Diet icons (based on `Diets[]`)
    - Allergen icons (based on `Allergens[]`)
    - Tag badge (e.g., “New”, “Popular”, “Seasonal”)
    - Link to item details page

#### Page 3 — Item Details
- Carrossel with large item images and youtube videos
- Item name
- Tag value
- Full description
- Ingredients
- Allergens (full list with labels)
- Diets (full list with labels)
- Availability (temporary unavailable state)
- Price
- Back navigation to category

---

## Color Schema (Brunch Theme)
The palette should evoke warmth, freshness, and morning comfort.

### Primary Colors
- #F7EEDB — Warm cream (background base)
- #E8CFAE — Toasted beige (cards, category blocks)
- #D9A86C — Golden brown (bread/coffee accent)
- #C46B33 — Egg-yolk orange (buttons, highlights)

### Secondary Colors
- #8FBF8F — Fresh green (salads, healthy items)
- #A3D9FF — Soft sky blue (refreshing juices)
- #6B4F4F — Coffee brown (headers, typography accents)

### Typography Colors
- #2E2E2E — Primary text
- #5A5A5A — Secondary text
- #FFFFFF — Text on dark backgrounds

### Status / Tag Colors
- New — #C46B33
- Popular — #D97A00
- Recommended — #8FBF8F
- Seasonal — #A3D9FF
- Limited Edition — #6B4F4F

### UI Behavior
- Soft shadows, rounded corners (8–12px)
- Light textures referencing brunch elements (optional, subtle)
- Hover states using slightly darker tones of primary colors

---

## Data Schema Integration
### Localization
- All text fields must be rendered using the selected language key (e.g., `"English"`).
- Language switcher must detect available keys dynamically.

### Currency
- Render price using `Currency` enum → symbol mapping.

### Diets
- Display diet icons or labels based on `Diets[]`.

### Allergens
- Display allergen icons or labels based on `Allergens[]`.

### Tags
- Single tag badge per item (nullable).

### Availability
- If `Temporary.Unavailable = true`, show a “Currently Unavailable” badge.

---

## Technical Requirements
- Pure HTML/CSS + minimal JS (no frameworks).
- Responsive layout (mobile-first).
- CSS variables for color schema.
- Reusable components for:
    - Category card
    - Item card
    - Tag badge
    - Diet/allergen icons
- Clean separation between data and template (JSON injected via JS).


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
          "Images": [{ "Url": "…", "Order": 0 }],
          "Name": { "English": "Tomato Soup" },
          "ShortDescription": { "English": "…" },
          "FullDescription": { "English": "…" },
          "Ingredients": { "English": "…" },
          "Allergens": [7, 1, 8],              // enum array, see Allergens below (EU 14-allergen list)
          "Price": 5.5,
          "Tag": 1,                            // nullable single enum, see Tags below
          "Availability": { "Temporary": { "Unavailable": false } }
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
---

## Acceptance Criteria
- All three pages render correctly using the provided JSON shape.
- Template visually matches brunch theme and color schema.
- Localization and currency switching work dynamically.
- Diets, allergens, tags, and availability are correctly displayed.
- No broken rendering when optional fields are missing.
- Fully responsive and visually consistent across pages.


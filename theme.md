# Banana — Theme Specification

This document defines every design token and every themed surface in Banana.
It is the single source of truth for the app's appearance. Implement it in
`src/theme/` exactly as specified; do not invent colours, sizes or radii.

Theme tokens are consumed through `useAppTheme()`. Raw hex values must never be
written inline in a component — see `AGENTS.md` §11.

---

## 1. Design Lineage

Banana is a sibling of **Coconut** (`../Coconut`, a budget app) and **Cherry**
(`../PassionFruit`, a coffee journal). The three are one family.

What is borrowed **unchanged** from Coconut and Cherry:

- Material Design 3 via React Native Paper, `version: 3`, `isV3: true`
- The exact same token *shapes* and token *file layout*
- The same spacing scale, radii scale, elevation model and type scale
- The same `buildTheme` / `buildSemanticColors` / `buildElevation` /
  `buildFontScale` / `buildNavigationTheme` construction
- The same `ThemeMode` / `ThemePreference` (`light` | `dark` | `system`) mechanism
- System font only. No custom font files. `fonts.regular === 'System'`
- The same chart palette **role** (a fixed 8-entry categorical series palette)

What is deliberately **different**:

- The colour values. Banana is a ripening-fruit theme: a ripe-banana gold
  primary and a leaf-green secondary, on a fresh ivory paper, with a cool
  water-teal and a rum-amber as the third and fourth brand scales. Where Cherry
  is roasted and warm, Banana is bright and fresh.
- Every colour in this document is contrast-verified to WCAG 2.1 AA, exactly as
  Cherry is; Coconut is not; see §8.

---

## 2. Token File Layout

```
src/theme/
├── index.tsx        # BananaThemeProvider, useAppTheme()
├── types.ts         # BananaTheme, ThemeMode, ThemePreference, BrandTokens
├── theme.ts         # buildBananaTheme(raw, scheme)
├── light.ts         # lightTheme = buildBananaTheme(lightColors, 'light')
├── dark.ts          # darkTheme  = buildBananaTheme(darkColors,  'dark')
├── fonts.ts         # buildFontScale()
├── semantic.ts      # buildSemanticColors(tokens, onAccent)
├── navigation.ts    # buildNavigationTheme(theme)
└── tokens/
    ├── colors.ts    # ColorTokens, lightColors, darkColors
    ├── spacing.ts   # spacing
    ├── radii.ts     # radii
    ├── elevation.ts # buildElevation(shadowColor)
    ├── typography.ts# typography, fonts
    ├── chart.ts     # chartPaletteLight, chartPaletteDark, ChartColor
    └── index.ts     # barrel
```

This is byte-for-byte the same structure as Coconut's and Cherry's `src/theme/`.
Only the values and the type names differ.

---

## 3. Colour Token Shape

Identical to Coconut and Cherry. Four brand scales, three semantic scales plus
`onErrorContainer`.

```
ColorTokens
├── surfaces  : background, surface, surfaceSecondary, surfaceTertiary,
│               surfaceHover, surfacePressed, elevation1..elevation5
├── borders   : border, borderStrong, borderSubtle
├── text      : primary, secondary, tertiary, disabled, onAccent
├── primary   : BrandScale   # ripe-banana gold
├── secondary : BrandScale   # leaf green
├── water     : BrandScale   # cool teal
├── warm      : BrandScale   # rum amber
└── semantic  : success/successLight/successBorder,
                warning/warningLight/warningBorder,
                error/errorLight/errorBorder/onErrorContainer,
                info/infoLight/infoBorder

BrandScale = { base, hover, pressed, light, muted }
```

The names `water` and `warm` are kept from Coconut on purpose so that a reader
with a sibling open in another window is never confused. In Banana, `water`
is the cool counterweight to the gold and `warm` is the rum-amber highlight.

### Brand scale semantics

| Role | Meaning | Use for |
| --- | --- | --- |
| `base` | The colour itself | Primary actions, active states, selected tab |
| `hover` | Lighter (dark mode) / darker (light mode) | Press-and-hold feedback |
| `pressed` | Clearly pressed | Momentary press |
| `light` | Tinted container | Chips, banners, soft badges, FAB container |
| `muted` | Desaturated border-weight version | Chips borders, inactive series, dividers on tinted surfaces |

---

## 4. Light Scheme

### 4.1 Surfaces

A fresh ivory paper. Deliberately the same *temperature family* as Coconut's
`#F7F4EC` and Cherry's `#FCF9F3` so the three apps read as one product, but
paler and greener, like an unripe-paper page.

| Token | Value |
| --- | --- |
| `background` | `#F7F4E7` |
| `surface` | `#FDFBF2` |
| `surfaceSecondary` | `#EEEAD8` |
| `surfaceTertiary` | `#E4DEC6` |
| `surfaceHover` | `#F3F0DF` |
| `surfacePressed` | `#DED7BB` |
| `elevation1` | `#FBF9EE` |
| `elevation2` | `#F7F4E7` |
| `elevation3` | `#F3EFDD` |
| `elevation4` | `#EFEBD3` |
| `elevation5` | `#EBE6C9` |

### 4.2 Borders

| Token | Value |
| --- | --- |
| `border` | `#DFD8BE` |
| `borderStrong` | `#C7BE9C` |
| `borderSubtle` | `#EBE6D2` |

### 4.3 Text

| Token | Value | Contrast on `surface` |
| --- | --- | --- |
| `primary` | `#26241A` | 15.01 |
| `secondary` | `#56524A` | 7.50 |
| `tertiary` | `#77735F` | 4.60 |
| `disabled` | `#A6A08C` | 2.52 |
| `onAccent` | `#FFFDF9` | — |

### 4.4 Brand scales

| Scale | `base` | `hover` | `pressed` | `light` | `muted` |
| --- | --- | --- | --- | --- | --- |
| `primary` (banana gold) | `#6E5406` | `#614B05` | `#544003` | `#F2EBCB` | `#CDBC84` |
| `secondary` (leaf) | `#3F6B34` | `#365E2C` | `#2D5025` | `#E2EBD8` | `#B9CCA8` |
| `water` (teal) | `#2C6A66` | `#265D59` | `#214F4C` | `#DCEBE6` | `#AECCC5` |
| `warm` (rum) | `#8A4F16` | `#794513` | `#693B10` | `#F0E3D3` | `#D9BF9A` |

Contrast of each `base` against `surface` / `background` / `surfaceSecondary`:

| Scale | on `surface` | on `background` | on `surfaceSecondary` |
| --- | --- | --- | --- |
| `primary` | 6.90 | 6.49 | 5.93 |
| `secondary` | 6.02 | 5.66 | 5.17 |
| `water` | 6.03 | 5.67 | 5.18 |
| `warm` | 6.31 | 5.93 | 5.42 |

Contrast of `onAccent` (`#FFFDF9`) against each `base`: 7.05 / 6.14 / 6.15 / 6.44.
All clear 4.5:1.

### 4.5 Semantic

| Token | Value | on `surface` |
| --- | --- | --- |
| `success` | `#4F7A34` | 4.86 |
| `successLight` | `#E4EBD8` | — |
| `successBorder` | `#C2D2A8` | — |
| `warning` | `#8A5A16` | 5.70 |
| `warningLight` | `#F1E4CE` | — |
| `warningBorder` | `#DCC196` | — |
| `error` | `#A8323A` | 6.37 |
| `errorLight` | `#F3DEDE` | — |
| `errorBorder` | `#E5BEBD` | — |
| `onErrorContainer` | `#6E1B22` | — |
| `info` | `#3F6E86` | 5.35 |
| `infoLight` | `#E6EBEC` | — |
| `infoBorder` | `#C0CFD5` | — |

---

## 5. Dark Scheme

### 5.1 Surfaces

A warm charcoal with a faint olive cast, like the shadowed interior of a
fruit crate. Structure mirrors Coconut's and Cherry's ladder, shifted to the
green side.

| Token | Value |
| --- | --- |
| `background` | `#0F0F0A` |
| `surface` | `#15150F` |
| `surfaceSecondary` | `#1D1D14` |
| `surfaceTertiary` | `#262518` |
| `surfaceHover` | `#22211A` |
| `surfacePressed` | `#2C2A1D` |
| `elevation1` | `#17160F` |
| `elevation2` | `#1A1911` |
| `elevation3` | `#1D1C13` |
| `elevation4` | `#201F16` |
| `elevation5` | `#242218` |

### 5.2 Borders

| Token | Value |
| --- | --- |
| `border` | `#33301F` |
| `borderStrong` | `#47432C` |
| `borderSubtle` | `#2A2818` |

### 5.3 Text

| Token | Value | Contrast on `surface` |
| --- | --- | --- |
| `primary` | `#F5F2E4` | 16.32 |
| `secondary` | `#C9C4B2` | 10.49 |
| `tertiary` | `#9E9A87` | 6.48 |
| `disabled` | `#6B675A` | 3.24 |
| `onAccent` | `#15150F` | — |

> **Note.** `onAccent` is the *dark background colour* in dark mode, not a
> near-white. Because Banana's brand `base` values are light in dark mode, the
> on-colour must be dark. Do not "fix" this back to a near-white.

### 5.4 Brand scales

In dark mode the brand `base` becomes the light tint, `hover` goes lighter,
`pressed` returns to near-`base`, and `light`/`muted` become deep desaturated
shells. Identical transformation to the siblings, different values.

| Scale | `base` | `hover` | `pressed` | `light` | `muted` |
| --- | --- | --- | --- | --- | --- |
| `primary` (banana gold) | `#E0C24B` | `#E5CB63` | `#E1C550` | `#3A3013` | `#5F5220` |
| `secondary` (leaf) | `#8FC77E` | `#9CCE84` | `#92C981` | `#26301F` | `#3C4E30` |
| `water` (teal) | `#7FC4BC` | `#8FCBC4` | `#82C6BE` | `#20302E` | `#35524D` |
| `warm` (rum) | `#E0A45C` | `#E4B074` | `#E1A760` | `#3A2B19` | `#5E4527` |

Contrast of each `base` against `surface`: 10.46 / 9.28 / 9.18 / 8.41.
Contrast of `onAccent` (`#15150F`) against each `base`: 10.46 / 9.28 / 9.18 / 8.41.

### 5.5 Semantic

| Token | Value | on `surface` |
| --- | --- | --- |
| `success` | `#7DBE6A` | 8.24 |
| `successLight` | `#232D1E` | — |
| `successBorder` | `#3B5234` | — |
| `warning` | `#E0A45C` | 8.41 |
| `warningLight` | `#362A1C` | — |
| `warningBorder` | `#65502E` | — |
| `error` | `#E2817D` | 6.69 |
| `errorLight` | `#362420` | — |
| `errorBorder` | `#6A3D38` | — |
| `onErrorContainer` | `#F6BDB8` | — |
| `info` | `#8BBEDA` | 9.14 |
| `infoLight` | `#2A2D2E` | — |
| `infoBorder` | `#3F5866` | — |

---

## 6. MD3 Mapping

`buildBananaTheme` maps the raw tokens onto `MD3Colors` exactly as Coconut and
Cherry do:

```
primary          = raw.primary.base          onPrimary        = text.onAccent
secondary        = raw.secondary.base        onSecondary      = text.onAccent
tertiary         = raw.water.base            onTertiary       = text.onAccent
background       = surfaces.background       onBackground     = text.primary
surface          = surfaces.surface          onSurface        = text.primary
surfaceVariant   = surfaces.surfaceSecondary onSurfaceVariant = text.secondary
error            = semantic.error            onError          = text.onAccent
```

Return object additionally carries: `scheme`, `brand`, `surfaces`, `borders`,
`text`, `semantic`, `spacing`, `radii`, `elevation`, `typography`, `chart`.
`chart` holds the **active** scheme's palette (§7).

`roundness: radii.medium`, `animation: { scale: 1 }`, `fonts: buildFontScale()`.

`buildNavigationTheme` maps `primary → brand.primary.base`,
`background → surfaces.background`, `card → surfaces.surface`,
`text → text.primary`, `border → borders.border`,
`notification → semantic.info`, `dark → scheme === 'dark'`.

---

## 7. Chart Palette

Banana has two `chartPalette`s, like Cherry, because a single set cannot clear
3:1 against a near-white surface without collapsing the perceptual gaps between
series.

```
tokens/chart.ts
├── chartPaletteLight  # marks on ivory surfaces
├── chartPaletteDark   # marks on charcoal surfaces
└── type ChartColor
```

`buildTheme` picks by scheme; `theme.chart` is always a `readonly string[]` of 8.

**Light series** (all ≥ 4.86:1 on `#FDFBF2`):

| # | Hex | Reads as |
| --- | --- | --- |
| 1 | `#8C5A12` | Ripe gold |
| 2 | `#A8323A` | Berry |
| 3 | `#4F7A34` | Leaf |
| 4 | `#2C6A66` | Teal |
| 5 | `#3A5A8C` | Slate |
| 6 | `#6B3A7A` | Plum |
| 7 | `#9C3B5A` | Rose |
| 8 | `#5C4620` | Stout |

**Dark series** (all ≥ 7.73:1 on `#15150F`):

| # | Hex |
| --- | --- |
| 1 | `#E0B25C` |
| 2 | `#EE8E8E` |
| 3 | `#9CCB6B` |
| 4 | `#6FD0BE` |
| 5 | `#85A8F0` |
| 6 | `#C79AE8` |
| 7 | `#F08CB4` |
| 8 | `#C9A87E` |

**Rules for charts.** A chart that distinguishes series by colour alone is not
acceptable (WCAG 1.4.1). Every multi-series chart must additionally encode series
by at least one of: a direct label on each series, a distinct marker or dash
pattern, or fixed legend order that never changes between renders. Charts default
to at most 5 series; the 6th–8th entries exist for stacked compositions and
method-coloured scatter points, which are position-separated anyway.

---

## 8. Contrast Verification (mandatory before any colour change)

Every colour pair in this document was verified with the WCAG 2.1 relative
luminance formula. Current state: **0 failures**.

Thresholds applied: 4.5:1 for text and text-adjacent glyphs; 3.0:1 for UI
component boundaries, focus indicators, chart marks and brand-on-container
combinations. `disabled` is exempt as it is never the only carrier of meaning.

Re-verify with a throwaway script before committing any change:

```js
const lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lum = h => { const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(h.substr(i, 2), 16) / 255));
                   return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
```

---

## 9. Spacing, Radii, Elevation, Typography

Copied from Coconut and Cherry unchanged. This is what makes the three apps feel
identical.

### 9.1 Spacing

`spacing[1]=4, [2]=8, [3]=12, [4]=16, [5]=20, [6]=24, [7]=32, [8]=40, [9]=48, [10]=64`

Screen horizontal padding is always `spacing[4]` (16). Card inner padding is
`spacing[4]`. Gap between stacked cards is `spacing[3]` (12) or `spacing[4]` (16).
Gap between sections is `spacing[6]` (24).

### 9.2 Radii

`small: 6, medium: 10, large: 14, xl: 18, dialog: 12, pill: 999`

- Chips and badges: `pill`
- Cards: `large`
- Sheets and dialogs: `dialog`
- Nested thumbnails and avatars: `medium`
- Small inline elements: `small`

**Never use a percentage border radius.** `theme.radii.dialog` must be used for
every dialog via the `AppDialog` wrapper.

### 9.3 Elevation

`buildElevation(shadowColor)` returns `level0..level5`; shadow colour is
`brand.primary.base` in light mode and `#000000` in dark mode.

| Level | Offset Y | Opacity | Radius | Android elevation |
| --- | --- | --- | --- | --- |
| 0 | 0 | 0 | 0 | 0 |
| 1 | 1 | 0.08 | 2 | 1 |
| 2 | 1 | 0.10 | 3 | 2 |
| 3 | 2 | 0.12 | 6 | 4 |
| 4 | 2 | 0.14 | 8 | 6 |
| 5 | 3 | 0.16 | 10 | 8 |

Usage: screen background `level0`; flat cards `level1`; the FAB and sticky
bottom bars `level3`; dialogs and menus `level5`. Never nest a level-3 card
inside a level-3 card.

### 9.4 Typography

Two scales exist and both must be present.

**`theme.fonts` (MD3Typescale)** — drives every `<Text variant=...>`:

| Variant | Size / Weight / Line | Tracking |
| --- | --- | --- |
| `displayLarge` | 32 / 700 / 38 | 0.2 |
| `displayMedium` | 28 / 700 / 34 | 0.2 |
| `displaySmall` | 24 / 600 / 30 | 0.2 |
| `headlineLarge` | 22 / 600 / 28 | 0.15 |
| `headlineMedium` | 20 / 600 / 26 | 0.15 |
| `headlineSmall` | 18 / 600 / 24 | 0.15 |
| `titleLarge` | 20 / 600 / 26 | 0.15 |
| `titleMedium` | 19 / 600 / 24 | 0.15 |
| `titleSmall` | 16 / 600 / 22 | 0.15 |
| `labelLarge` | 14 / 600 / 20 | 0.15 |
| `labelMedium` | 12 / 600 / 16 | 0.15 |
| `labelSmall` | 11 / 500 / 14 | 0.15 |
| `bodyLarge` | 16 / 400 / 23 | 0.15 |
| `bodyMedium` | 14 / 400 / 20 | 0.15 |
| `bodySmall` | 12 / 500 / 16 | 0.4 |

**`theme.typography` (semantic roles)** — use these for the named slots below:

| Role | Size / Weight / Line | Where |
| --- | --- | --- |
| `screenTitle` | 28 / 700 / 34 | Top of a root tab screen, week/date headline |
| `sectionHeading` | 19 / 650 / 24 | Card titles, group headers inside a screen |
| `body` | 16 / 400 / 23 | Default reading text |
| `secondaryBody` | 14 / 400 / 20 | Supporting text, descriptions |
| `caption` | 12 / 500 / 16 | Units, timestamps, axis labels, helper text |
| `metricValue` | 32 / 700 / 38 | The single hero number on a tab or a hero card |

Weights `650` and `500` are not MD3 legal weights; the `TypeStyle` type allows
`'650'` because these roles are applied with explicit styles rather than through
Paper's `variant` prop. Never feed them to a Paper `variant`.

---

## 10. Semantic Colour Layer

`buildSemanticColors(semanticTokens, onAccent)` returns the names the app actually
uses in components:

```
success, successContainer, onSuccess, successBorder
warning, warningContainer, onWarning, warningBorder
error,   errorContainer,   onError,   errorBorder
info,    infoContainer,    onInfo,    infoBorder
saving,  savingContainer,  onSaving,  savingBorder    // replaces goodBudget
pricey,  priceyContainer,  onPricey,  priceyBorder    // replaces overBudget
delete,  deleteContainer
```

Banana renames the budget pair to match its domain while keeping the fields:

```
goodBudget -> saving    // a deal or a week is under budget
overBudget -> pricey    // a deal or a week is at or over budget
```

**Rule.** `saving` and `pricey` are the only two colours allowed to express a
judgement about price or budget fit. A week is `saving` when its estimated cost
is within `weekly_budget_cents`, and `pricey` when it is not; a deal is `saving`
against its reference price. Every other positive/negative judgement uses
`success` / `error`. Do not invent new semantic names to express a one-off state —
extend `tokens/colors.ts` and this document in the same commit.

`onSaving` uses the semantic `success` on-accent; `pricey` maps to `semantic.warning`.

---

## 11. Component Theming Rules

1. **Never hardcode a hex in a component.** Use `theme.colors`, `theme.brand.*`,
   `theme.semantic.*`, `theme.surfaces`, `theme.text`, `theme.borders`.
2. **Every dialog goes through `AppDialog`**, which applies `theme.radii.dialog`.
3. **Every screen uses `ScreenFade`** and scrolls inside
   `KeyboardAwareScrollView`. There are no screens that render a bare `View`.
4. **Stat tiles use `StatCard`** with `Tone = 'neutral' | 'good' | 'bad' | 'attention'`.
   `good → semantic.saving`, `bad → semantic.pricey`, `attention → semantic.warning`.
5. **The add-meal FAB** is the app's one persistent primary action on the Plan
   screen. It uses `brand.primary.base`. It is the only FAB in the app.
6. **All icons** come from `@expo/vector-icons/MaterialCommunityIcons`.
   `react-native-vector-icons` is forbidden.
7. **Tone must reach icons as well as text.** A value shown in `semantic.pricey`
   gets its leading icon in `semantic.pricey` too.
8. **No hardcoded `borderRadius: 0`.** Use the scale.

---

## 12. Iconography

MaterialCommunityIcons outlines throughout, matching the siblings. Reserved
glyphs — reusing one of these for a different meaning is a bug:

| Meaning | Icon |
| --- | --- |
| Plan tab | `calendar-week-outline` |
| Recipes tab | `silverware-fork-knife` |
| Shopping tab | `cart-outline` |
| Deals tab | `tag-outline` |
| Settings tab | `cog-outline` |
| Add meal | `plus` |
| Breakfast slot | `weather-sunset-up` |
| Lunch slot | `white-balance-sunny` |
| Dinner slot | `weather-sunset-down` |
| Snack slot | `food-apple-outline` |
| No cook day | `car-outline` |
| Leftovers day | `pot-steam-outline` |
| Cook minutes | `timer-outline` |
| Servings | `account-multiple-outline` |
| Recipe | `book-open-page-variant-outline` |
| Ingredient | `food-variant` |
| Pantry, stocked | `package-variant-closed` |
| Pantry, low | `package-variant` |
| Pantry, out | `package-variant-remove` |
| Allergies | `alert-octagon-outline` |
| Diet | `leaf` |
| Budget | `currency-eur` |
| Saving | `trending-down` |
| Pricey | `trending-up` |
| Store deal | `sale-outline` |
| Deal matched | `link-variant` |
| Store Lidl | `storefront-outline` |
| Store Hofer | `storefront-outline` |
| Store Spar | `storefront-outline` |
| Refresh deals | `refresh` |
| AI planner | `creation-outline` |
| Scrape status | `cloud-download-outline` |
| Backup | `content-save-outline` |
| Restore | `content-save-move-outline` |
| Tutorial | `school-outline` |
| What's New | `star-four-points-outline` |
| About | `information-outline` |
| Rating, 1–5 | `star` / `star-outline` / `star-half-full` |

---

## 13. Contrast Verification Summary

The palette and chart sets in this document are verified to WCAG 2.1 AA with
**0 failures**. The verification is repeated before any colour change as part of
the Definition of Done (`AGENTS.md` §15.8). If a colour must change, update
`src/theme/tokens/colors.ts`, the relevant table above, and re-run the script in
§8.

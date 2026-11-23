# AGENTS.md — Banana Coding Conventions

This file is the single source of truth for AI agents working on Banana.
Read `idea.txt` for the full product and architecture specification.
Read `theme.md` for every design token and component-theming rule.

The user is working **100% via AI agents**. Nothing here is advisory. If a task
seems to require breaking a rule in this file, stop and ask first.

---

## 1. Project Overview

Banana is a private, local-first Android app that plans your next week of
meals, tells you what to buy, and spends your food budget where the deals are.
You set how much time you have on each day and anything you specifically want
to eat; Banana proposes a plan that fits both, then turns it into one organised
shopping list, aware of the current offers at Lidl, Hofer and Spar.

It is the sibling of **Coconut** (`../Coconut`, a budget app) and **Cherry**
(`../PassionFruit`, a coffee journal). Same Material Design 3 foundation, same
architecture, same offline-first discipline, same documentation conventions,
different colours and a different domain. Explore the siblings read-only when
you need a pattern; **never modify anything under the Coconut or PassionFruit
directories.**

Local SQLite is the single source of truth. The app works fully offline. There
are four permitted outbound network uses:

1. the AI provider the user configured, and only when the user invokes an AI
   feature;
2. the **deal scraper**, which reads the public offers page of an enabled
   retailer once per refresh.
3. SeedWorks authentication, profile/username retrieval, usage reporting and
   optional cross-device sync in the Supabase `banana` schema, including
   consent-based shared-household membership and data sharing.
4. User-enabled release checks and APK downloads, following Coconut's
   implementation and respecting Android installation consent.

Items 3–4 are user-approved for 0.3.0. Keep network transports separate from pure
services. Personal datasets remain isolated from shared household datasets;
leaving a household restores the personal context without deleting either.
SeedWorks' public project URL and publishable client identifier may be bundled,
as in Coconut; these are not secret credentials. Never bundle a service-role key.

Tech stack (mandatory, do not deviate without explicit user approval):

- React Native via Expo SDK (same SDK line as Coconut and Cherry)
- TypeScript (strict mode)
- expo-sqlite for local storage
- Expo Router for navigation
- React Native Paper (Material Design 3) for UI components
- dayjs for date handling
- expo-notifications for local notifications
- expo-file-system and expo-sharing for backup
- @expo/vector-icons for all icons
- Jest + jest-expo + @testing-library/react-native for tests
- react-native-web + react-dom (desktop/web build support)

Forbidden additions:

- Redux / MobX / Zustand or any state-management framework
- Any backend or cloud service except the approved SeedWorks integration
- Any network use except AI, deal scraping, SeedWorks and release updates
- Ads, analytics, telemetry, or crash-reporting SDKs
- `react-native-vector-icons` (use `@expo/vector-icons`, which ships with Expo)
- An HTML-parsing library for the scraper (use `fetch` and string parsing)
- Any new dependency at all without checking first whether the platform,
  React Native Paper, dayjs or existing code can already do the job

Never hardcode an API key, base URL or model name for a real provider. The
provider base URL, key and model are entered in the in-app AI settings screen and
stored only in the local `ai_state` singleton.

---

## 2. Report and Plan

### Versioned release plans

When the prompt names `release-plans/<version>`, that file is the task specification.
Read it in full, then implement its tasks strictly in written order. A task may
span multiple lines. Test and verify each task before starting the next; stop
and report ambiguity, failures or unavailable required device checks. Record
progress and exact verification results in the plan without rewriting requirements.
After every task and the Definition of Done pass, write user-facing
`release-notes/<version>.md` describing only completed, verified changes.
Use paragraphs, `###` headings and `-` bullets; no outer Release Notes heading
or HTML markers. Do not add new hardcoded What's New entries.
Do not bump versions, run release scripts, commit, tag, push or publish unless
separately asked. See `release-plans/README.md` for the shared contract.

Opening What's New explicitly requests the official GitHub release notes,
independent of automatic-update settings. This is an approved public-data network
use; never send personal data or refresh notes at startup.

When starting work:

1. Read `idea.txt` — it defines the product.
2. Read `theme.md` — it defines the appearance.
3. Read this file — it defines how to build.
4. State the plan of what you will implement **before** writing code.
5. Ask when a decision is ambiguous. Do not guess on anything in `idea.txt` §5
   (deals), §6 (the shopping list) or §9 (the network boundary).

Do NOT implement things the user has not asked for.

---

## 3. The Development Environment

- OS: Linux. Shell: zsh.
- Node.js 22+.
- JDK 21 (`~/.sdkman/candidates/java/current`, `/usr/lib/jvm/java-21-openjdk`).
- `ANDROID_HOME=/home/4urelius/Android/Sdk`.
- Installed SDK: `platforms/android-36` and `android-37.0`,
  `build-tools/35.0.0` and `36.0.0`, `cmake/3.22.1`,
  `ndk/27.1.12297006`. The NDK is required by `expo-sqlite`'s native build.
- Target device: the **Pixel 6a** emulator. `minSdkVersion` is 29.

| Command                     | Description                        |
| --------------------------- | ---------------------------------- |
| `npm install`               | Install dependencies               |
| `npm run start`             | Start the Expo dev server          |
| `npm run android`           | Run in the Android emulator        |
| `npm run web`               | Run the desktop/web build          |
| `npm test`                  | Run unit tests                     |
| `npm run typecheck`         | TypeScript check (`tsc --noEmit`)  |
| `npm run lint`              | Lint the code (`expo lint`)        |
| `npx expo export --platform web` | Verify the web build compiles |

---

## 4. The Android Emulator Is Off Limits — NEVER Wipe It

**NEVER, EVER, UNDER ANY CIRCUMSTANCES wipe, reset, erase, or recreate the
Android emulator or any of its data. This is absolute and non-negotiable.**

The user's emulator holds real, hand-entered data that exists nowhere else.
Treat every emulator wipe as permanent data loss for the user.

Never run, suggest, recommend, or fall back to any of the following:

- `adb emu kill` (kills the emulator process)
- `adb emu avd name` / any AVD deletion
- `emulator -avd <name> -wipe-data` (the `-wipe-data` flag)
- `adb shell pm clear com.banana.app` (clears app data)
- `adb uninstall com.banana.app`
- Deleting or re-creating the AVD via Android Studio / Device Manager
- Any "reset emulator", "cold boot", or "wipe app data" button in an IDE or GUI
- Deleting the emulator's userdata directory from disk
- Any other command or action whose effect is to erase emulator or app data

Allowed, and preferred, for verification: read-only inspection
(`adb shell dumpsys`, `adb logcat`, `adb shell run-as ... ls`), rebuilding and
reinstalling the APK (`npx expo run:android`), and `adb shell am force-stop` to
restart the app process. None of these erase data.

If a task seems to require a fresh emulator, STOP and ask the user first. Never
assume permission, and never treat a wipe as an acceptable debugging step.

**Real-device rule for the network layers.** For release 0.3.0 the user performs
real-device acceptance testing after implementation and automated/static checks.
Report this handoff explicitly; mocked tests and emulator checks are not evidence
that real-device network calls work.

---

## 5. Project Structure

```
src/
├── app/           # Expo Router screens and layouts (file-based routing)
│   ├── (tabs)/    # plan, recipes, shopping, deals, settings
│   └── _layout.tsx
├── components/    # Reusable UI components (React Native Paper based)
├── database/      # SQLite schema, migrations, and data-access layer
├── models/        # TypeScript types and interfaces (domain model)
├── services/      # Business logic / planning / list building (pure TS)
├── ai/            # Cloud provider transport, prompts, schemas, planner
├── deals/         # Scraper transport, per-store parsers, matching
├── theme/         # Material 3 theming (see theme.md)
├── config/        # App metadata, What's New, tutorial, repository
├── data/          # DataProvider (React context that owns app state)
└── utils/         # Generic helpers (date, currency, units, labels)
tests/             # Jest tests, mirroring src/
assets/            # App icons, logo, splash
```

Platform-specific modules are written as `name.android.tsx` / `name.web.tsx`
pairs (or `.native.ts` / `.web.ts`), so the same import resolves correctly on
Android and desktop/web. Do not branch on `Platform.OS` inside a shared file
where a `.web` variant is the cleaner solution.

`tests/` mirrors the structure of `src/` and `src/app/`.

---

## 6. Naming Conventions

- Files: `kebab-case.ts` / `kebab-case.tsx` (e.g. `week-setup.tsx`).
- React components: `PascalCase`.
- Non-component functions and variables: `camelCase`.
- Types: `PascalCase`. Module constants: `UPPER_SNAKE_CASE`.
- SQLite tables: `snake_case`, plural, e.g. `weeks`, `recipe_ingredients`.
- SQLite columns: `snake_case`, no type prefix (e.g. `cook_minutes`, not
  `int_cook_minutes`).
- Money always ends in `_cents`. Durations always end in `_minutes`. Ingredient
  amounts are `quantity` plus a `unit`. There is no bare `price` or `amount`
  column anywhere.
- Timestamps end in `_at`; dates end in `_date`; validity windows are
  `valid_from` / `valid_to`.
- Test ids for interactive controls follow the pattern `<thing>-<value>`, e.g.
  `budget-45`, `slot-dinner-mon`, `tab-shopping`.

---

## 7. Database Layer

- All database access lives in `src/database/`. Never call SQL directly from UI.
- Use a single database file via `expo-sqlite`. One `getDatabase()` singleton in
  `src/database/database.ts`, opening the file, setting
  `PRAGMA journal_mode = WAL`, running pending migrations, then resolving.
- Schema changes require a migration: a numbered migration appended to
  `src/database/migrations.ts`. **Never mutate an existing migration.**
- Migrations are `{ id: number; description: string; sql: string }`, tracked by
  SQLite's own `PRAGMA user_version` inside the same transaction as the SQL.
  There is no migration bookkeeping table. Copy the siblings' `migrate()`.
- Every `CREATE TABLE`, `CREATE INDEX` and `CREATE TRIGGER` uses
  `IF NOT EXISTS`, so each migration is re-runnable against a restored backup.
- Every domain table carries `uuid TEXT` with a `UNIQUE` index and
  `updated_at TEXT` **from migration 1**, because `idea.txt` §13.4 reserves the
  door for future sync and because AI payloads reference entities by `uuid`.
- **Money is integer cents** (`price_cents`, `weekly_budget_cents`). Never a
  float. **Physical quantities are REAL** (`quantity`, `prep_minutes` may be
  INTEGER minutes). Never store a physical amount as a money column or vice
  versa.
- Booleans are `INTEGER NOT NULL DEFAULT 0` / `DEFAULT 1`; decode with
  `row.active === 1`, encode with `input.active ? 1 : 0`.
- Enums are `TEXT` with `CHECK (col IS NULL OR col IN (...))`, built from an
  `as const` array in `src/models`. Add the CHECK in the `CREATE TABLE`.
- Nullable is the bare absence of `NOT NULL`. Non-nullable is reserved for
  identity, timestamps and foreign keys.
- Foreign keys: `ON DELETE CASCADE` for true children, `ON DELETE SET NULL` for
  references that must survive. SQLite foreign-key enforcement is not globally
  enabled; delete-ordering is explicit in repository code.
- Timestamps `TEXT` in ISO-8601 with milliseconds and `Z`. Dates `TEXT` as
  `YYYY-MM-DD`.
- One repository module per aggregate: `settings.ts`, `aiState.ts`,
  `preferences.ts`, `ingredients.ts`, `recipes.ts`, `recipeIngredients.ts`,
  `recipeSteps.ts`, `pantry.ts`, `stores.ts`, `deals.ts`, `dealMatches.ts`,
  `weeks.ts`, `weekDayBudgets.ts`, `slots.ts`, `shoppingItems.ts`,
  `scrapeRuns.ts`, `aiRuns.ts`.
- Every repository function starts with
  `const database = db ?? (await getDatabase());` and takes a trailing
  `db?: SQLiteDatabase`, so callers inside a transaction reuse one handle.
- Repository API naming, following Coconut and Cherry exactly:
  `get<Thing>(id, db?)`, `getAll<Things>(db?)`, `get<Things>By<Dimension>(...)`,
  `create<Thing>(input, db?) => Promise<number>`, `update<Thing>(id, input, db?)`,
  `set<Thing><Field>(id, value, db?)`, `delete<Thing>(id, db?)`,
  `upsert<Thing>(...)`, `reorder<Things>(orderedIds, db?)`.
- Write functions accept a `...Input` DTO, never a full model.
- Row interfaces and `rowTo<Thing>` mappers are module-private and never exported.
- Read functions return `T | null`; nullable model fields are `T | null`, never
  optional `?:`, except for genuinely derived or computed properties.
- Derived values (recipe `totalMinutes`, `rating`, a week's estimated cost, the
  shopping list, deal savings) are **never stored** (`idea.txt` §13.3). If you
  find yourself adding such a column, stop.

---

## 8. Business Logic

- All calculations live in `src/services/` as pure TypeScript functions. No
  React, no Expo imports, no database imports, no network — a service takes data
  in and returns data out.
- UI components must NOT contain planning math, list aggregation, unit
  conversion, deal matching, or cost estimation. Call a service.
- Key services (`idea.txt` §6–7):
  - `planning-service.ts` — the deterministic planner and its scoring.
  - `shopping-list-service.ts` — aggregation, unit conversion, aisle grouping,
    pantry subtraction, cost estimation.
  - `deal-service.ts` — relevance, savings, and best-deal-per-ingredient.
  - `preference-service.ts` — allergy filtering, diet checks, budget checks.
  - `recipe-service.ts` — derived total time, rating from history, search and
    filters.
  - `pantry-service.ts` — sufficiency and stocking suggestions.
  - `week-service.ts` — week range, day budgets, slot layout, progress.
- The deterministic planner is deterministic and pure. Given the same inputs it
  must return the same result. Use a **seeded** PRNG if a random choice is
  unavoidable (never `Math.random()`).
- Allergies are enforced **here**, in the service layer, never left to the LLM
  or the prompt.
- Every function in `src/services/` has a corresponding unit test in `tests/`.

---

## 9. The AI Layer

`src/ai/` is the only place the AI provider is reached. It is kept strictly
separate from `src/services/`, which stays pure.

- `provider.ts` defines the transport interface. `openai-compatible.ts`
  implements it over `fetch`. Anything that needs the AI depends on the
  interface, never on `fetch` directly.
- `schemas.ts` derives the JSON schema and the candidate types from the domain
  models. Adding a nullable field to a model **requires** updating the schema in
  the same change, with a fixture that exercises it.
- `prompts.ts` holds versioned prompt templates. Every prompt has an id and a
  version; the version is recorded on the `ai_run`.
- `planner.ts` parses, validates, repairs and diffs. It never writes to the
  domain tables.

**Non-negotiable AI rules** (identical to Cherry):

1. No local LLM inference or bundled weights. User-approved exception:
   dictation uses Android's built-in on-device speech recognizer; audio stays
   local. Expo Audio is approved for background leaflet recording.
2. Credentials are never hardcoded, never logged, never committed, never included
   in a backup, and never sent anywhere except the configured base URL.
3. Network failures never destroy data. A failed AI call is inert.
4. The LLM never writes to the database. It returns candidates; the user and the
   service layer dispose.
5. The LLM never decides a plan. `planning-service.ts` produces a valid plan on
   its own. If the AI is unavailable, a deterministic template produces the
   narrative and the plan is still complete.
6. Manual entry is always a complete equal of the AI path. Every field the AI can
   propose is editable by hand.
7. No test ever makes a real network call. Tests use a fake transport with fixed
   fixtures.

---

## 10. The Deals Layer

`src/deals/` is the only place a retailer is reached. It is separate from both
`src/services/` and `src/ai/`.

- `types.ts` defines `DealsProvider` and `ParsedDeal`.
- `lidl.ts`, `hofer.ts`, `spar.ts` each export a **pure parser**
  `(html: string, store: Store) => ParsedDeal[]` and a page URL.
- `fetcher.ts` is the only place `fetch` is called for a store. It sets a
  descriptive `User-Agent`, a timeout, checks `robots.txt` for the path, and
  makes exactly one request per store per refresh.
- `index.ts` orchestrates a refresh across enabled stores and writes the result
  to the `deals` cache and a `scrape_runs` audit row.
- `matcher.ts` is a **pure** function mapping a deal product to an ingredient.

**Rules** (`idea.txt` §9):

1. The scraper reads public offers pages only. No login, no form submission, no
   personal data, ever.
2. Parsers are pure and tested against saved HTML fixtures. No test touches the
   network.
3. A failed scrape never blocks the app and never deletes cached deals.
4. The app never renders deals from the network; it renders from SQLite and
   refreshes the cache on request.
5. New stores are out of scope for v1; do not add one without approval.

---

## 11. UI Components

- Use React Native Paper components (Card, List, Button, TextInput, Chip, etc.).
- Read `theme.md` before writing any style. Colors come from `useAppTheme()` —
  never a raw hex, never a hardcoded radius, never a hardcoded spacing number.
- Reuse the shared component vocabulary rather than re-rolling it: `StatCard`,
  `AppDialog`, `EmptyState`, `ScreenFade`, `FadeIn`, `AnimatedNumber`,
  `LoadingScreen`, `KeyboardAwareScrollView`, `NumberField`, `OptionField`,
  `ScreenToast`, `CustomTabBar`. Coconut and Cherry are the reference.
- Every screen uses `ScreenFade` and scrolls inside `KeyboardAwareScrollView`.
- Every dialog goes through `AppDialog` so `theme.radii.dialog` is applied.
- All icons come from `@expo/vector-icons/MaterialCommunityIcons`.
- Use TypeScript types for all props. Never `any`.
- Keep components presentational where possible; screens own state.
- Every interactive control has an `accessibilityRole`, an `accessibilityLabel`
  and, where relevant, an `accessibilityState`.
- Tone must reach icons as well as text. A value shown in `semantic.error` gets
  its leading icon in `semantic.error` too.
- No inline `style` where a themed Paper variant or component exists.

---

## 12. TypeScript

- `strict: true` is always on. Never disable it.
- Prefer interfaces for object shapes; types for unions.
- Derive types from the domain models in `src/models/`.
- No `@ts-ignore`, `@ts-nocheck`, or `any` without explicit justification in a
  comment naming the reason.
- Enum-like unions that are also validated at runtime use the `as const` array
  pattern:
  ```ts
  export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  export type MealType = (typeof MEAL_TYPES)[number];
  ```
  There is no TypeScript `enum` anywhere in this project.

---

## 13. Testing

- Unit tests are mandatory for every function in `src/services/`.
- The planner and the shopping-list aggregation must be tested against fixture
  data with **known** expected answers, not snapshots of whatever the code
  happens to output.
- The scraper parsers are tested against saved HTML fixtures. The matcher is
  tested against fixed ingredient and deal fixtures. No test touches the
  network.
- All AI tests use a fake transport with fixed fixtures. No test touches the
  network.
- Data values in tests use integer cents (e.g. `1299` for €12.99) and explicit
  minutes.
- Tests must be deterministic. No randomness. Use explicit fixture data.
- Run with: `npm test`.

---

## 14. Git and Quality

- Keep commits small and focused; one logical change per commit.
- Only commit when the user explicitly asks. Never commit unprompted.
- Do not amend, force-push, or rewrite history unless explicitly told to.
- Never commit a real API key, personal data, or scraped personal information.
- Check `git diff` before every commit.
- No comments unless they explain a non-obvious business rule.
- No dead code, unused imports, or debug logging left behind.
- Keep functions small and focused; split when they grow.

---

## 15. Definition of Done

A task is done only when ALL of the following hold:

1. The feature matches the specification in `idea.txt` and, if it affects
   appearance, `theme.md`.
2. Unit tests for all new or changed business logic pass (`npm test`).
3. TypeScript compiles with no errors (`npm run typecheck`).
4. The app runs in the Pixel 6a emulator without warnings caused by your code,
   AND the web build compiles with no errors caused by your code
   (`npx expo export --platform web`).
5. No lint errors (`npm run lint`).
6. No new dependency was added without explicit approval.
7. No API key or credential is present in the diff.
8. If the change affects the appearance, the contrast verification in
   `theme.md` §8 still reports zero failures.
9. Network changes respect the approved boundaries. For 0.3.0 real-device
   acceptance testing is handed off to the user after automated/static checks
   and explicitly reported as pending.
10. If the change affects the schema, a **new** numbered migration was added and
    no existing migration was edited.
11. If the change touches `src/services/`, `src/ai/` or `src/deals/`, the
    corresponding tests use fixed fixtures and make **no** network call.

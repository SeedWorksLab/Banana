# Banana

<p align="center">
  <a href="https://seedworkslab.de/apps/banana/">
    <img src="https://seedworkslab.de/assets/readme/download-banana.svg" alt="Download Banana" width="340">
  </a>
</p>

<p align="center">
  <img src="assets/banana-banner.jpg" alt="Banana — a private, local-first meal planner" width="640">
</p>

<p align="center">
  A private, offline-first Android meal planner. Set how much time you have each day and what you fancy,<br>
  get a week that fits both, and turn it into one organised shopping list aware of the current deals at Lidl, Hofer and Spar.<br>
   Offline-first, with optional SeedWorks sync and shared households, your configured AI provider, public offers and release updates.
</p>

---

## About

Banana is a personal meal planner, not a social network. You
build a small library of the meals you actually cook, tell it how much time you
have on each weekday and anything you specifically want to eat, and Banana
proposes a plan that fits both. It then aggregates everything you need to buy
into a single shopping list, grouped by aisle, aware of the current offers at
three Austrian supermarkets.

All data lives in a local SQLite database on the device — the single source of
truth. The app works fully offline. Manual entry is always a complete equal of
the AI path. A SeedWorks account is optional. There is no advertising or analytics.

**Network boundaries are explicit.** One is the AI provider you
configure yourself, called only when you invoke an AI feature. The other is the
**deal scraper**, which reads the public offers page of an enabled retailer once
per refresh and caches the result in SQLite. Your base URL, API key and model
name are stored only on your device, are never included in a backup, and are
never sent anywhere else. No personal data is ever sent to a retailer.
Optional SeedWorks sync sends opted-in application data to the shared SeedWorks
Supabase project, in the `banana` schema. Shared-life households require an
accepted invitation and use a separate shared dataset; leaving restores your
personal data. SeedWorks also provides your username and aggregate usage reporting.
User-enabled update checks read official GitHub releases, and Update now downloads
an APK through Android's notification-visible download manager. Android requires
installation consent. Opening What's New reads official published release notes.

## Key features

- **Plan → Shop → Cook → Rate lifecycle** — plan the week, shop it in one trip,
  cook each meal, and rate how it went so the planner gets better.
- **Time-budget-aware planning** — set the minutes you have each weekday, or
  mark a day `no cook` or `leftovers`; the deterministic planner fits meals to
  the time you actually have.
- **Wishes honoured** — pin anything you specifically want to eat and the
  planner works around it.
- **Cook once, eat twice** — batch cooking and leftovers are first-class,
  scored objectives, not an afterthought.
- **Three supermarkets** — Lidl, Hofer and Spar. Enable the ones you shop at and
  Banana watches their public offers.
- **Deal-aware shopping list** — one list, grouped by aisle, with the cheapest
  matching offer flagged per ingredient and the savings shown.
- **Recipe library** — ingredients, quantities, units, steps, cook and prep
  time, servings, tags, and a rating derived from your cooking history.
- **Pantry** — mark what you already have stocked, low or out, and the list
  subtracts it.
- **Preferences & allergies** — diet (omnivore, vegetarian, vegan, pescatarian),
  allergies enforced in the service layer, dislikes, default servings and a
  weekly budget in euro.
- **AI planner (optional)** — a cloud LLM proposes slot candidates and writes
  the week's narrative; the deterministic planner still decides, and the LLM
  never writes to the database.
- **Notifications** — a shopping reminder and a plan-your-week nudge.
- **Theme** — Material Design 3 with light, dark and system appearances.
- **Backup & restore** — export your whole database to a portable file, or
  restore from one; the API key is stripped from every backup.

## Data & privacy

- Local-first: domain data leaves the device only for user-invoked AI, explicitly
  enabled SeedWorks sync, or a backup you export.
- Money is stored as integer cents; physical quantities (grams, millilitres,
  counts) as REAL; durations as integer minutes.
- External services are limited to configured AI, enabled retailers, SeedWorks,
  and official public releases. AI credentials and SeedWorks sessions are excluded
  from backups and synced domain data.
- No advertising, tracking analytics, or crash-reporting services.

## Tech stack

- React Native via **Expo SDK**
- **TypeScript** (strict mode)
- **expo-sqlite** for local storage
- **Expo Router** for file-based navigation
- **React Native Paper** (Material Design 3) for UI
- **dayjs** for date handling
- **expo-notifications** for local notifications
- **expo-file-system** / **expo-sharing** for backup
- **Jest** + jest-expo for unit tests
- **react-native-web** for the desktop/web build

## Getting started

Prerequisites:

- Node.js 22+
- JDK 21
- Android SDK (API 29 / Android 10 or newer) and the `Pixel_6a` emulator

| Command             | Description                        |
| ------------------- | ---------------------------------- |
| `npm install`       | Install dependencies               |
| `npm run start`     | Start the Expo dev server          |
| `npm run android`   | Run in the Android emulator        |
| `npm run web`       | Run the desktop/web build          |
| `npm test`          | Run unit tests                     |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`)  |
| `npm run lint`      | Lint the code (`expo lint`)        |

## Project structure

```
src/
├── app/           # Expo Router screens (file-based routing: (tabs), week, recipe, ...)
├── components/    # Reusable UI components (React Native Paper based)
├── config/        # App metadata and What's New entries
├── data/          # DataProvider (React context that owns app state)
├── database/      # SQLite schema, migrations, repositories and queries
├── models/        # TypeScript domain models
├── services/      # Pure business logic (planner, shopping list, deals, preferences)
├── ai/            # Cloud provider transport, prompts, schemas, planner
├── deals/         # Scraper transport, per-store parsers, matching
├── theme/         # Material 3 theming
└── utils/         # Generic helpers (date, currency, units, labels)
tests/             # Jest unit tests
assets/            # App icons, logo and banner
```

## Documentation

- [`idea.txt`](idea.txt) — full product and architecture specification
- [`theme.md`](theme.md) — complete design-token and component-theming spec
- [`AGENTS.md`](AGENTS.md) — coding conventions for AI agents

## License

AGPL-3.0 — see [LICENSE](LICENSE).

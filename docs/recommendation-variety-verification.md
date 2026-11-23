# Recommendation variety

Implemented on 2026-11-23. No dependency, schema migration, network request,
tracking record, version bump, release script, commit or publication was added.

## Changes

- Suitable least-used recipes take priority over repeats, even when pantry,
  offers or expiry heavily favour a particular recipe. Small catalogues rotate
  their available choices rather than applying the same flat repeat penalty.
- Future pins and preserved cooking meals are reserved before automatic picks.
  Scarce meal/time choices are allocated before flexible slots; output remains
  in its original day/meal order.
- Recent planned cooking meals provide a decaying 28-day cooldown. Cooking/
  rating completion is not required; leftover reservations and deleted data
  are not counted as additional cooking.
- Stable weekly tie ranks replace permanent low-id/alphabetical tie preference.
  Identical inputs still produce identical plans; tapping Plan my week is not
  a random shuffle.
- Near-identical ingredient combinations receive a soft variety penalty without
  removing ordinary shared-ingredient benefits.
- Discovery suggestions mix meal types and ingredients, apply recent rotation,
  and respect allergies, diet, dislikes and inactive/placeholder recipe status.
- Already pinned/cooked meals and explicit batch links are preserved.

## Verification

- Full Jest suite: 63 suites, 362 tests passed.
- Typecheck and lint: passed.
- Web and Android JavaScript exports: passed.
- Existing contrast tests: passed with zero failures.
- `git diff --check`: passed.
- Known fixtures verify seven unique dinners despite a dominant pantry/offer/
  expiry recipe, a three-recipe cycle of `1,2,3,1,2,3,1`, future-pin reservation,
  assigning the only quick option to a tight-time day, week-specific tie orders,
  recent-plan cooldown, near-duplicate ingredients, and partial replanning.
- SQLite tests verify the real historical query, lookback bounds, deleted and
  future exclusions, cooking-versus-leftover metadata, and using the result in
  the planner. UI tests verify history reaches discovery and that unsafe,
  inactive and placeholder suggestions are excluded. No test calls a network.

## Pending device acceptance

`adb devices` reports no attached device/emulator. Pixel 6a runtime verification
and inspection with the user's actual catalogue remain pending. No emulator or
app data was wiped, cleared or uninstalled.

On a week whose automatic meals you intend to regenerate:

1. Note its pinned meals, cooked meals and explicit leftover reservations.
2. Tap Plan my week. Check those reservations are unchanged and automatic meals
   fit their types and time limits without avoidable identical repeats.
3. Check a small eligible catalogue still fills valid meals with balanced repeats
   instead of inventing recipes or violating constraints.
4. Compare next week's automatic choices and discovery shortlist against recent
   planned weeks. Check diet/allergy exclusions remain respected.

Variety remains limited by the number of recipes that actually fit each meal
and its constraints. Existing saved automatic meals are not rewritten at startup.

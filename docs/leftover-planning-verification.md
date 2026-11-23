# Explicit leftover planning

Implemented on 2026-11-23. No new dependency, network use, version bump, release
script, commit or publication.

## Behaviour

- A meal in Leftovers mode explicitly selects an earlier recipe meal in the
  same week and home. Cross-meal-type and non-consecutive links are supported.
- The cooking meal is pinned and its portion total includes all reservations.
  The plan separately shows portions eaten there and each later reservation.
- Each leftover meal names its source day/meal and shows portions to eat with
  no additional cooking. Unlinked legacy leftovers are flagged for selection.
- Changing the source, resizing or removing a reservation updates its cooking
  total. The shopping list still includes ingredients only at cooking meals.
- Already cooked/eaten batches, other-home links, future/self references and
  replacing a cooking source with dependants are protected.
- Existing reservations are edited individually. Editing cooking-day portions
  retains them rather than rebuilding a different set of consecutive days.
- Migration 14 replaces the previous invalidation trigger so valid portion
  changes preserve existing links. Previous migrations are untouched.

## Verification

- `npm test -- --runInBand`: 58 suites, 317 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npx expo export --platform web`: passed.
- `npx expo export --platform android --output-dir /tmp/opencode/banana-leftovers-android-export`:
  passed.
- Contrast tests pass with zero failures; existing theme tokens are reused.
- `git diff --check`: passed.
- Fixed-fixture service tests cover portion calculations, chronological source
  eligibility, same-home constraints and protected meals.
- SQLite tests cover migration reapplication, persistence, resizing/relinking,
  preserving unrelated meal settings, shopping quantities and rollback on a
  simulated write failure.
- UI tests cover plan labels, choosing a source, direct leftover editing,
  cooking-day portions and requiring an explicit source.

## Pending device acceptance

`adb devices` reports no connected device or emulator. Pixel 6a runtime/visual
verification remains pending; automated tests are not evidence of device layout.
No emulator or app data was wiped, cleared or uninstalled.

Without clearing existing data:

1. Plan Tuesday dinner as curry for two portions.
2. Set Wednesday lunch to Leftovers from Tuesday dinner, two portions.
3. Confirm Tuesday shows four portions to cook, two to eat and two reserved for
   Wednesday lunch. Confirm Wednesday names Tuesday dinner and shows no cooking.
4. Link Friday dinner to the same batch with one portion; confirm the total
   becomes five. Resize Wednesday to one portion; confirm four portions total
   and both reservations remain.
5. Relink Wednesday to another eligible source. Check both source totals.
6. Change a leftover meal back to Cook. Confirm its reservation is removed and
   its old source total decreases without disturbing other reservations.
7. Edit a cooking meal's own portions; confirm linked meals remain intact.
8. Regenerate the shopping list and replan the week; verify ingredient quantities
   and pinned source/reservation meals remain correct. Restart to verify links.
9. Check already cooked/eaten meals cannot be reassigned/resized, and changing a
   linked day's home cannot split a batch across homes.

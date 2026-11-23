# Downloaded Whisper dictation

Implementation verification on 2026-11-23. No version bump, release script,
commit or publication was performed. Existing release-plan/note changes were
left untouched.

## Automated/static results

- `npm test -- --runInBand`: 56 suites, 294 tests passed. Includes existing
  contrast verification with zero failures. Tests use fixed fake audio,
  inference and download responses; no test downloads a model or calls a real
  network service.
- `npm run typecheck`: passed.
- `npm run lint`: passed, no errors or warnings.
- `npx expo export --platform web`: passed.
- `npx expo export --platform android --output-dir /tmp/opencode/banana-whisper-android-export`:
  passed.
- Android debug compilation for ARM64 and x86_64 with JDK 21:
  `JAVA_HOME=/usr/lib/jvm/java-21-openjdk NODE_ENV=development ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64 --console=plain`:
  passed. Dependencies emit existing/upstream deprecation warnings.
- `git diff --check`: passed.
- No database schema changes or bundled model weights. Device-specific settings
  use the existing settings key/value table and are outside the sync allowlist.
- Added approved native speech integration `whisper.rn`, plus its required
  `buffer` compatibility dependency. Installation required
  `--legacy-peer-deps` because of an existing Expo/worklets peer conflict.

## Pending device acceptance

`adb devices` reported no attached device/emulator. The Pixel 6a runtime check
and real-phone network/audio/inference checks have **not** been completed.
Mocked tests and successful builds are not evidence of device performance,
recognition accuracy or successful Android network downloads.

Use a rebuilt, normally signed Android app; Expo Go cannot provide these native
modules. Do not uninstall, clear app data, wipe or recreate an emulator.

- Open Settings → Dictation. Confirm Android remains selected on an existing
  installation and that the spoken language can differ from the app language.
- Confirm neither opening the page nor selecting Whisper starts a download.
- Download multilingual Base Q5_1 (59,707,625 bytes). Check progress, completion,
  verification and installed status. Repeat for Small Q5_1 (190,085,487 bytes).
- Cancel and interrupt downloads, then retry. Failed downloads must not remove
  the other installed model or affect application data.
- Select Whisper and the installed model. In airplane mode, dictate a recipe,
  meal wish and plan instruction. Check the processing indicator after Stop,
  cancellation during transcription, and starting another dictation afterward.
- Compare Base and Small on the Poco F3 with representative English/German/
  Hungarian speech, ingredient names, exact quantities and prices. Record
  latency, accuracy, memory pressure, heat and battery behaviour; no performance
  claims have been verified on this phone.
- Check explicit language selection and Whisper automatic detection.
- Record a leaflet while another app is foregrounded, then stop and transcribe.
  Check that local transcription works independently of Android's on-device
  recognizer, and that a failed transcription retains the source audio for retry.
  AI extraction still requires the configured provider/network.
- Close a dictation while inference is running; no late result should be applied
  or sent to the plan agent after cancellation.
- Restart Banana, then install a normally signed app update over it without
  uninstalling. Installed models must remain usable without a new download.
- Delete a model explicitly. Only that model should disappear; subsequent use
  must request a download rather than silently use a different engine.
- Return to Android recognition and verify the requested offline language is
  used, never an unrelated installed language.
- Verify backup/export and household sync contain no audio or model binaries.

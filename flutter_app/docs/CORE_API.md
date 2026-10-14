# App core API guide (for feature modules)

Written by the core builders on 12 Oct 2026 and kept as their reports. The code is the authority: when this guide and `lib/core/**` differ, read the code. Later fixes (bottom of this file) changed some details.

## UI foundation (module 0a)

Module 0a is built and passing: 114 tests (12 golden, 102 unit/widget), and `flutter analyze` is clean on every file I own. The Android resources and manifest merge, link and compile through Gradle. I did not build or run a full APK.

## Fonts YAML block
Also saved to `flutter_app/pubspec_fonts_block.txt`, together with the `assets:` block. Paste both into the `flutter:` section of `pubspec.yaml`.
```yaml
  fonts:
    - family: Gabarito
      fonts:
        - asset: assets/fonts/Gabarito-Regular.ttf
          weight: 400
        - asset: assets/fonts/Gabarito-Medium.ttf
          weight: 500
        - asset: assets/fonts/Gabarito-SemiBold.ttf
          weight: 600
        - asset: assets/fonts/Gabarito-Bold.ttf
          weight: 700
        - asset: assets/fonts/Gabarito-ExtraBold.ttf
          weight: 800
    - family: HankenGrotesk
      fonts:
        - asset: assets/fonts/HankenGrotesk-Regular.ttf
          weight: 400
        - asset: assets/fonts/HankenGrotesk-Medium.ttf
          weight: 500
        - asset: assets/fonts/HankenGrotesk-SemiBold.ttf
          weight: 600
        - asset: assets/fonts/HankenGrotesk-Bold.ttf
          weight: 700

  assets:
    - assets/mobi/
```
Add `assets/sample/` only when Module 2 creates that folder, because a missing asset directory fails the build.

## Files created
All paths are under `C:\Users\atish\Desktop\mockmob copy\mockmob-next\flutter_app\`.
- **Theme** (`lib/core/theme/`): `mm_colors.dart`, `mm_type.dart`, `tokens.dart`, `fonts.dart`, `theme.dart` (barrel, `buildTheme`, `context.mmColors` and `context.mmType`).
- **Motion and haptics:** `lib/core/motion/motion.dart` and `reduced_motion.dart` (`ReducedMotionSetting`, `ReducedMotionScope`, `reducedMotionOverrideProvider`). `lib/core/haptics/haptics.dart` holds `Haptics` (tick, settle, open, warn), `touchFeedbackProvider` (default on) and `hapticsProvider`.
- **Widgets** (`lib/core/widgets/`, import `widgets.dart`):
  - Keys: `KeyButton` and `KeyButtonFace` (the pure visual, which the goldens use for the pressed and focus states).
  - Layout and feedback: `Skeleton`, `StateView`, `MmSheet` helpers (`showMmSheet`, `MmSheetPage`, `MmSheetScaffold`), `InlineBanner`, `SavePill`, `ReceiptLine`, `MmSpinner`.
  - Painters and navigation: `WeekStrip`, `QuestionStrip`, `Mobi`, `MmBottomNav`.
- **Copy** (`lib/core/copy/`): `formatters.dart`, `state_words.dart` (`StateWords`, `Receipts`), `copy.dart`.
- **Router** (`lib/core/router/`): `routes.dart`, `router.dart`, `router_redirect.dart`, `action_router.dart`, `app_shell.dart`, `transitions.dart`, `screens.dart`, `placeholder_screen.dart`, `external_link_opener.dart`.
- **Android** (`android/app/src/main/`):
  - Manifest: INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, WAKE_LOCK, RECEIVE_BOOT_COMPLETED, `enableOnBackInvokedCallback`, singleTask, and the autoVerify App Links filter for `www.mockmob.in` (`/today`, `/result`, `/review`, `/dashboard`, `/learn`). There is no exact-alarm permission, and none comes in from the plugins either.
  - Splash: Android 12 and later (values-v31 and values-night-v31), with a pre-12 `launch_background`. Ground colour is `#F4F5F0` in light and `#0B100E` in night.
  - Icons: adaptive launcher icon (volt background, ink mark, monochrome layer) and regenerated legacy PNGs. `ic_stat_mockmob` is the notification small icon.
  - Stubs: empty `PlatformPackage.kt` and `NotificationsPackage.kt`.
- **Tests:** `test/helpers/fonts.dart` and `golden_harness.dart`, five golden test files with `goldens/*.png`, and nine files in `test/unit/core_ui/`.

## Test results
- **Goldens** (12 PNGs, light and dark, 360 by 780 at DPR 2): key button states, bottom nav (each tab active), save pill plus receipt, banner and skeleton, week strip, question strip, state view.
- **Unit and widget tests:** formatters, haptics, reduced motion, spec hex values, type roles, key press and commit behaviour, semantics, `ActionRouter`, redirect logic, and the router with all 4.2 routes.

## Goldens I looked at, and what I fixed
I opened all 12 PNGs.
- **State view:** it overflowed in a short frame, so it now scrolls instead of clipping. Mobi was missing, because images need real event-loop time to decode and `settleImages` waits for that.
- **Skeleton:** blocks with no width collapsed to nothing, so they now fill the available width.
- **Inline banner:** the action was squeezing the message. The action now sits under the message and lines up with it.
- **Key button:** the quiet key and the non-expanded keys were reserving spinner width and drifting. The loading goldens now use reduced motion, so the spinner is a visible ring rather than a speck.
- **Question strip:** the repaired notch was too small, so I enlarged it.
- **Key press timing:** a gesture recognizer delays the down event by 100 ms inside scrollables, so the face now responds on pointer down. The commit still comes from the tap recognizer on release.

## Decisions and notes for integration
- **Tab shell:** it uses the general `StatefulShellRoute(navigatorContainerBuilder:)` instead of `.indexedStack`. That keeps the same branch state and adds the 140 ms fade the spec asks for.
- **Fonts and numbers:** Gabarito has `tnum`; Hanken Grotesk does not. Numbers that must align should use Gabarito roles (`timer`, `figure`, `label`, `button`).
- **Icon weights:** the bottom nav uses `Lucide300` (1.55 stroke) for outline and the default `Lucide` (2.0 stroke) for active. Lucide has no 1.75 stroke.
- **`AuthController` dependency:** `auth_state.dart` now imports `auth_controller.dart`, which Module 0b owns. Earlier in my run that file failed to compile because `notification_service.dart` didn't exist yet. It compiled by the end, and my router tests override `authSnapshotProvider` with `overrideWithBuild`.
- **Wiring `lib/app.dart`:**
  - Wrap with `ProviderScope`, then `ReducedMotionScope`, then `MaterialApp.router(routerConfig: ref.watch(routerProvider), theme: buildTheme(Brightness.light), darkTheme: buildTheme(Brightness.dark))`.
  - Bind `reviewDotProvider` to `pending_result`.
  - The You module persists `reducedMotionOverrideProvider` and `touchFeedbackProvider`.
- **Replacing placeholders:** each feature module swaps one builder in `lib/core/router/screens.dart`. Sheet routes (`beforeYouStart`, `todayWhy`, `todayWeek`, `todayAlternatives`, `permissionsNotifications`) return a sheet body with no `Scaffold`, because `MmSheetPage` supplies the frame.
- **After-sign-in routing:** signed-in users on auth routes go to the remembered target or `/today`. To show `/before-you-start` first, the auth feature should call `ref.read(intendedRouteProvider).remember(AppRoutes.beforeYouStart)` before sign-in completes.
- **Tab re-tap:** deeper in the stack it pops to the branch root. At the root it publishes `tabReselectProvider` so the screen can scroll to top.
- **`ActionRouter`:**
  - Pricing, checkout, upgrade and signup links always return `UnsupportedTarget`.
  - Anything off `https://www.mockmob.in` (or the apex) is refused.
  - Unknown pages on our own domain become `ExternalTarget`, a Custom Tab (the spec's behaviour for unknown paths).
  - Dot segments are refused on the raw text, because `Uri` silently collapses `/../`.
- **Widget receiver and shortcuts meta-data:** I left them out of the manifest. They would reference classes Module 12 hasn't written yet, which would break the app at runtime. Module 12 should add them.
- **Week strip height:** a long label, such as "4 of 4 study days. This week is done.", wraps to three lines beside the circles, so the row grows past 44 dp. Callers can shorten the label if they need a strict 44.
- **`lib/main.dart` and `test/widget_test.dart`:** I did not touch either. `widget_test.dart` still refers to the default counter app and will need the app wiring to pass.

## Data foundation (module 0b)

Module 0b is finished. `flutter analyze` on the whole project reports no issues, and `flutter test test/unit` passes (479 tests, 377 of them in `test/unit/core_data`). Nothing was exercised on a device or the emulator: WorkManager, the headless token refresh, the Keystore storage, local notification scheduling, Supabase OTP and Google sign-in are all untested outside unit tests.

## Files (all under `flutter_app`)
- **`lib/core/config`**: `AppConfig` and `appConfigProvider`.
- **`lib/core/api`**: the dio client, typed errors, and the token-provider interface.
- **`lib/core/auth`**: Supabase wrapper, `AuthController`, the lock file and background refresher, and `auth_state.dart`.
- **`lib/core/storage`**: the drift database (13 tables), the secure store and `AppPrefs`.
- **`lib/core/repositories`**: the shared repositories listed below.
- **`lib/core/domain`**: the pure functions from spec section 5.6.
- **`lib/core/analytics`**, **`notifications`**, **`connectivity`**, **`permissions`**, **`models`**.
- **`lib/core/sync`**: the session engine (`sync/session/`), outbox and WorkManager tasks.
- **Barrels** for importing: `api/api.dart`, `auth/auth.dart`, `repositories/repositories.dart`, `models/models.dart`, `domain/domain.dart`, `analytics/analytics.dart`, `notifications/notifications.dart`, `sync/sync.dart`, `connectivity/connectivity.dart`, `storage/storage.dart`.
- **`dart_defines/`**: `README.md` and `.gitignore` (ignores `*.json`).
- **Tests and fakes**: `test/unit/core_data/**`.
- I did not edit `pubspec.yaml`, `pubspec.lock` or `build.yaml`. The generated `app_database.g.dart` is committed in place.

## API index for UI modules
**Auth**
- `authSnapshotProvider` is now a `NotifierProvider<AuthController, AuthSnapshot>`, so existing `ref.watch` code is unchanged. Router tests need `overrideWith` or `overrideWithBuild`, not `overrideWithValue`.
- `AuthSnapshot` keeps its old fields. I added `name`, `subjects`, `needsOnboarding`, `creditBalance`, `sessionExpired` and `loadFailed`.
- `sessionExpired` means a 401 signed the student out, so show "Please sign in again. Your work is still on this phone." Local drafts are kept in that case.
- `loadFailed` means a session exists but `/me` failed with no cache. The status stays `unknown`.
- Actions on `ref.read(authSnapshotProvider.notifier)`: `sendEmailCode`, `verifyEmailCode`, `signInWithGoogle` (returns false on cancel), `signOut` and `reload`. Failures throw `SignInException(AuthFailure…)`, never server text.
- `SignOutHooks.register(...)` lets other modules add work that runs at sign-out.

**API**
- `apiClientProvider` returns an `ApiClient` with `get/post/put/patch/delete/request` and `ApiOptions`.
- It sends the bearer token, refreshes once on a 401 then signs out, holds a family for 60 s after a 429, and retries a GET twice on transient failures.
- `ApiError` carries `status`, `code`, `kind`, `retryAfter`, a whitelisted `details` map and a fixed `message`. It never carries raw server text.
- Compare codes with `hasCode(ApiCodes.x)`, since the server mixes upper and lower case.

**Repositories**
- Server reads return a `RemoteState<T>`: `value`, `fetchedAt`, `fromCache`, `loading`, `error`, plus `isStale` and `isFailedEmpty`. Call `.notifier.refresh()` to read again.
- `planRepositoryProvider(minutes)`, `rhythmRepositoryProvider`, `creditsRepositoryProvider`, `goalRepositoryProvider` (`save`, `setPause`) and `notificationPrefsRepositoryProvider` (`update`, `effectivePrefs`).
- `attemptsRepositoryProvider` loads from the cache and only goes to the network when empty or on `refresh(force: true)`. It has `upsertSubmitted`. `attemptDetailProvider(id)` reads one attempt.
- `consentRepositoryProvider` (`setAgeBand`, `setAnalyticsAllowed`, `analyticsActive`), `quoteRepositoryProvider.quote(...)`, and `studentTimezoneProvider`.
- Local repositories: `sessionDraftRepositoryProvider` (`latest`, `watchLatest`, `generationKeyFor`, `summaryOf`, `unsentAnswerCount`), `pendingResultRepositoryProvider`, `rhythmSeenRepositoryProvider`, `dismissalRepositoryProvider`, `repairLocalRepositoryProvider`.
- Local streams: `latestSessionDraftProvider`, `unopenedResultsProvider`, `hasUnopenedResultProvider` (the Review tab dot) and `repairLocalRecordsProvider`.
- Subjects and chapters have models (`Subject`, `ChapterCatalog`) but no repository; the owning modules call those endpoints themselves.

**Domain (pure)**
- `markBreakdown` and `markBreakdownOf`, `mockOrdinal` / `nextMockNumber` / `isFirstMock`, `observedChapterBreakdown`, `repairCandidates` and `repairMinutes`.
- `repairDurationOptions`, `repairWalletShortfall`, `nextMoveState` (table-driven precedence), `defaultNextMoveMinutes`, `dismissalExpiry`, `resumableDraft` and `endedMockOutcome`.

**Session engine**
- `sessionEngineStarterProvider` and `sessionEngineRestorerProvider` build the engine via `SessionEngine.start` and `restore`.
- Inputs: `selectAnswer`, `goTo`, `setMarked`, `submit`, `onPaused`, `onResumed` and `onConnectivityRestored`.
- Outputs: the ticking `remaining`, `saveState`, `submitState` and `away` notifiers, and the `warnings` stream.
- A rapid `selectAnswer` is written to the journal before listeners are notified.
- `restore` returns null when `resumableDraft` fails.

**Other providers**
- Network: `networkStatusProvider` and `networkRestoredProvider`.
- Outbox: `syncCoordinatorProvider.enqueue(...)` stores a write with an idempotency key and flushes it when online.
- Analytics: `analyticsClientProvider.track(name, props: …)` queues only when the gate is open.
- Notifications: `notificationServiceProvider` (`schedule`, `showOngoing`, `cancel`, `cancelAll`).
- Permissions: `permissionRequesterProvider` is an interface with no implementation. It defaults to `unavailable` and never prompts.
- Push: `pushTransportProvider` is null until a transport is wired in.

## Bugs found and fixed while testing
- The background submit job's retry return value was inverted. It would have stopped retrying inside the window and kept retrying after it closed.
- A save-state / draft race in `onPaused`: the draft was saved before the acknowledgement came back.
- The submitter skipped persisting `pendingSubmission` when the engine had already set it in memory.
- An engine notifier was used after dispose.
- Concurrent 401s refreshed the token more than once.
- On Windows the lock file could be left behind when the owner write failed.
- Analytics clearing on sign-out and account switch depended on Riverpod listeners firing. It now also happens on the next track or flush.

## For integration (owners of main, router, Android and the other modules)
- `main` should call `initializeBackgroundWork()` after the first frame. It should also read `authSnapshotProvider` (that starts Supabase) and override `permissionRequesterProvider` with Module 11's implementation.
- The runner should call `engine.onPaused()` and `onResumed()` on lifecycle changes. It should call `onConnectivityRestored()` when `networkRestoredProvider` emits.
- After a submit, refresh `planRepositoryProvider(m)` and `rhythmRepositoryProvider`, and call `authSnapshotProvider.notifier.reload()` for credits. The engine already caches the attempt, records the pending result and clears dismissals.
- A background submit writes the attempts cache but does not update a live `attemptsRepositoryProvider` list. Call `refresh(force: true)` on resume when `unopenedResultsProvider` is non-empty.
- The dev README assumes the emulator can reach `http://10.0.2.2:3101`, but I found no cleartext traffic or network-security config under `android/app/src`. Module 0's Android owner needs to add it for debug builds.
- Left for Module 11: the "stop after 3 ignored" and "7 days of silence" notification rules, token upload, notification copy and actions. Analytics call sites in the features are also still to do.
- Still unverified on a device: which `verifyOTP` type succeeds (email or magiclink), Google sign-in configuration, Doze delay of the WorkManager job, and the lock's takeover of a stale file, which has one very narrow race.

## Fixes applied after review

All 11 findings are applied. `flutter analyze` reports no issues, `flutter test` passes all 507 tests, and `flutter build apk --debug` builds `build/app/outputs/flutter-apk/app-debug.apk`. I did not run the app, so the system-bar and cleartext fixes are verified only by build and tests.

I regenerated the goldens and looked at `key_button_light` and `status_dark`. The only change is that spinners are now ink instead of volt. I did not open the other regenerated goldens (`key_button_dark`, `status_light`). `pubspec.yaml` shows as modified in git; I did not edit it, and `pubspec.lock` is untouched.

**Session engine and background job (`lib/core/sync/**`)**
1. **Early submit:** I took the finding's alternative fix, a heartbeat, instead of removing the early schedule.
   - New `session_heartbeat.dart` writes a small `cache_entries` row. The engine beats about every 5 s and stops when it submits or is disposed.
   - `runSubmitSessionTask` returns `false` (retry) while the heartbeat is under 20 s old and the session has not ended.
   - The early schedule stays, so a crash while the app is in the foreground is still covered.
   - On resume, if the job already submitted and deleted the draft, the engine runs the idempotent submit to pick up the attempt.
   - I did not cancel the job in `dispose`, which the finding also suggested. A student who leaves the runner still has the backup job send their answers.
2. **Reconnect retry:** `onConnectivityRestored` now retries a pending submit, using the finding's guard plus a `submissionWindowOpen` check.
3. **Overwritten draft:** `SessionEngine.start` now submits an earlier unacknowledged draft for the same selection first. If that submit stays pending, it throws a new `PendingSubmitBlocksStart` carrying the old draft. Nothing in the UI catches it yet, so whoever builds the start flow needs to route to the pending submit.
4. **Conflict recovery:** the engine snapshots unsynced local answers, rebuilds from the server log, then re-appends any that differ (including clears) and calls `notifyChanged`. I did not add a separate notice. The re-appended answers show as unsynced on the save pill, but the existing away banner doesn't fit this case.
5. **Rejected submit:** `SessionDraft` has a new `rejected` flag. The submitter and engine clear `pendingSubmission` and set it, and `resumableDraft` and the background job both skip a rejected draft.
6. **Rate gate:** `submit` and `fetchAttempt` now pass `bypassRateGate: true`.

**Auth (`lib/core/auth/**`, `lib/core/api/**`)**
7. **Refresh on a dropped network:** `refresh()` now throws a new `RefreshUnavailable` (in `token_provider.dart`) for no network, timeouts and a busy lock, and returns `false` only for a definite rejection.
   - On `RefreshUnavailable` the 401 interceptor passes on an offline-style `ApiError` and does not call `onSessionLost`. `AuthService.accessToken` and `BackgroundTokenRefresher` handle it as well.
8. **Lock timing:** the lock goes stale after 90 s and the default wait is 100 s. The foreground refresh is capped at 30 s, and the background Dio timeouts drop to 8 s connect and 10 s receive.

**UI core and Android**
9. **System bars:** `app.dart` wraps the app in an `AnnotatedRegion` with transparent status bar, raised-colour nav bar and brightness-driven icons. `main.dart` sets edge-to-edge mode.
10. **Theme:** the colour scheme's primary is now ink, and the text selection colour is opaque `lineStrong`. New switch, checkbox, radio, progress and slider themes use ink for on states, and the switch shows a check glyph when on.
11. **Routed sheets:** `MmSheetPage` and `showMmSheet` now share one `_sheetAnimationStyle`, so routed sheets also fade when motion is reduced.
12. **Manifests:** the debug manifest allows cleartext traffic, and the main manifest sets `allowBackup="false"`.

**Tests**
- I added tests for each of the above and adjusted two existing ones (the theme primary-colour assertion and the old EVENT_CONFLICT test).
- A full `flutter test` run ran out of memory once, probably because the other agent was running builds alongside it. `-j 2` ran cleanly.

New file: `lib/core/sync/session/session_heartbeat.dart` (under `C:\Users\atish\Desktop\mockmob copy\mockmob-next\flutter_app`).

# The device demo build

`test/device_demo/demo_main.dart` is the real app (router, shell, dock, every screen) signed in
as a fixture student ("Asha Verma") with the repositories replaced by the in-memory fixtures the
tests use. It exists so signed-in screens can be driven on an emulator or phone without a real
sign-in. Nothing in it talks to an account. It is never shipped.

## It is a separate app

The demo installs beside the real app, never over it:

| | Real app (debug) | Demo |
|---|---|---|
| Launcher label | MockMob | **MockMob demo** |
| Application id | `in.mockmob.app.debug` | `in.mockmob.app.demo.debug` |

`android/app/build.gradle.kts` switches the demo on by itself whenever Flutter builds the
`device_demo` entry point (Flutter passes the entry point to Gradle as the `target` property),
so the demo cannot be built under the real app's id by accident. `-PmockmobDemo=true` forces it
for any other entry point.

## Build and install (from `flutter_app`, Git Bash)

```bash
bash tool/flutter_locked.sh build apk --debug -t test/device_demo/demo_main.dart
adb -s emulator-5554 install -r build/app/outputs/flutter-apk/app-debug.apk
adb -s emulator-5554 shell monkey -p in.mockmob.app.demo.debug -c android.intent.category.LAUNCHER 1
```

The real app for comparison (signed out, against the local staging site on port 3101):

```bash
bash tool/flutter_locked.sh build apk --debug --dart-define-from-file=dart_defines/phone.json
adb -s emulator-5554 reverse tcp:3101 tcp:3101
adb -s emulator-5554 install -r build/app/outputs/flutter-apk/app-debug.apk
adb -s emulator-5554 shell pm clear in.mockmob.app.debug   # a fresh first run
```

Both builds write the same `app-debug.apk` path, so install each right after building it.
Run `android/gradlew --stop` after building to free the Gradle daemon's memory.

## What the demo shows and what it cannot

- One record behind every screen (`demo_book.dart`): seven Accountancy mocks and a Business
  Studies Quick 10, every question with real text from its own chapter (`demo_questions.dart`,
  20 Business Studies questions). Today, Review, the record (`demo_insights.dart`), the rhythm,
  the week strip and the milestones are the app's own providers computed from it; only the data
  sources are replaced.
- Every start is a new session (`demo_session.dart`) in the chosen subject and length; a full
  mock or NTA mode is a 50-question, 60-minute paper. The clock runs (5 and 1 minute warnings,
  time up submits). A submit is marked from the answers given and added to the record at the
  moment it is sent, so an NTA paper after Mock 7 opens as Mock 8 with its real counts, and the
  practice receipt shows the submit time.
- A repair is explained from the question's own key and explanation and kept on the phone as
  the real flow keeps it; the week strip and the first-repair milestone follow it.
- The demo does not set FLAG_SECURE, so its exam screens can be captured; the real app does.
- The question stream, Ask and anything else that needs an account show their signed-out states.
  The CUET tools work from the files bundled with the app.

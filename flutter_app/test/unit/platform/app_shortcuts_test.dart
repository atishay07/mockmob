import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/platform/app_shortcuts.dart';
import 'package:mockmob/core/router/action_router.dart';
import 'package:mockmob/core/router/routes.dart';
import 'package:quick_actions/quick_actions.dart';

class _Surface implements ShortcutSurface {
  void Function(String)? handler;
  final List<List<String>> sets = [];
  int clears = 0;
  bool failInitialize = false;

  /// What Android does on start: it hands over the shortcut that launched the app.
  String? launchedWith;

  @override
  Future<void> initialize(void Function(String type) onType) async {
    if (failInitialize) throw StateError('no launcher');
    handler = onType;
    final type = launchedWith;
    if (type != null) onType(type);
  }

  @override
  Future<void> set(List<ShortcutItem> items) async => sets.add([for (final i in items) i.type]);

  @override
  Future<void> clear() async => clears++;
}

void main() {
  group('ActionRouter.forShortcut', () {
    test('resume opens the open session; with none it opens Practice', () {
      expect(ActionRouter.forShortcut(AppShortcutType.resume, sessionId: 'sess-1'), const NativeTarget('/run/sess-1'));
      expect(ActionRouter.forShortcut(AppShortcutType.resume), const NativeTarget(AppRoutes.practice));
    });

    test('a session id that is not a plain id opens nothing', () {
      expect(ActionRouter.forShortcut(AppShortcutType.resume, sessionId: '../today'), isA<UnsupportedTarget>());
    });

    test('repair opens tonight\'s mistake, else Review', () {
      expect(
        ActionRouter.forShortcut(AppShortcutType.repair, repairLocation: AppRoutes.reviewRepair('m7', 'm7-q0')),
        NativeTarget(AppRoutes.reviewRepair('m7', 'm7-q0')),
      );
      // The count tonight's repair was sized to travels with it.
      expect(
        ActionRouter.forShortcut(AppShortcutType.repair, repairLocation: '${AppRoutes.reviewRepair('m7', 'm7-q0')}?count=3'),
        NativeTarget('${AppRoutes.reviewRepair('m7', 'm7-q0')}?count=3'),
      );
      expect(ActionRouter.forShortcut(AppShortcutType.repair), const NativeTarget(AppRoutes.review));
      // A location that is not a repair never wins over Review.
      expect(ActionRouter.forShortcut(AppShortcutType.repair, repairLocation: '/pricing'), const NativeTarget(AppRoutes.review));
      expect(ActionRouter.forShortcut(AppShortcutType.repair, repairLocation: 'https://evil.example/review/repair/a/b'), const NativeTarget(AppRoutes.review));
    });

    test('Practice 10 opens the quick set of 10 questions', () {
      expect(
        ActionRouter.forShortcut(AppShortcutType.practice),
        NativeTarget(Uri(path: AppRoutes.practiceSetup('quick'), queryParameters: {'count': '10'}).toString()),
      );
    });

    test('an unknown type opens nothing', () {
      expect(ActionRouter.forShortcut('delete-everything'), isA<UnsupportedTarget>());
    });
  });

  group('shortcutItems', () {
    test('Resume is listed first, and only when a session can be resumed', () {
      expect([for (final i in shortcutItems(hasResume: true)) i.type], ['resume', 'repair', 'practice10']);
      expect([for (final i in shortcutItems(hasResume: false)) i.type], ['repair', 'practice10']);
    });

    test('titles are short sentence case with no punctuation noise', () {
      final titles = [for (final i in shortcutItems(hasResume: true)) i.localizedTitle];
      expect(titles, ['Resume', '10-min repair', 'Practice 10']);
      for (final t in titles) {
        expect(t, isNot(contains('!')));
        expect(t.length, lessThanOrEqualTo(25));
      }
    });
  });

  group('shortcut icons', () {
    final res = Directory('android/app/src/main/res');

    test('every shortcut names an icon, and each icon is a drawable that resource shrinking keeps', () {
      final items = shortcutItems(hasResume: true);
      expect([for (final i in items) i.icon], ['ic_shortcut_resume', 'ic_shortcut_repair', 'ic_shortcut_practice']);
      final keep = File('${res.path}/raw/keep.xml').readAsStringSync();
      for (final i in items) {
        final file = File('${res.path}/drawable/${i.icon}.xml');
        expect(file.existsSync(), isTrue, reason: '${i.icon} drawable');
        expect(keep, contains('@drawable/${i.icon}'), reason: '${i.icon} keep rule');
      }
    });

    test('the icons are monochrome ink on a light circle, with no other colour', () {
      for (final name in ['resume', 'repair', 'practice']) {
        final xml = File('${res.path}/drawable/ic_shortcut_$name.xml').readAsStringSync();
        final colours = RegExp(r'#[0-9A-Fa-f]{6,8}').allMatches(xml).map((m) => m.group(0)!.toUpperCase()).toSet();
        expect(colours, {'#F3EFE4', '#12110E'}, reason: name);
        expect(xml, contains('android:viewportWidth="48"'), reason: name);
        expect(xml, contains('android:strokeLineCap="round"'), reason: name);
      }
    });
  });

  group('ShortcutDispatcher', () {
    late _Surface surface;
    late List<String> went;
    late ShortcutSnapshot snapshot;
    late DateTime now;

    ShortcutDispatcher make({Future<void> Function(Duration)? wait}) => ShortcutDispatcher(
          surface: surface,
          read: () => snapshot,
          go: went.add,
          now: () => now,
          wait: wait ?? (d) async => now = now.add(d),
        );

    setUp(() {
      surface = _Surface();
      went = [];
      now = DateTime.utc(2026, 10, 14, 12);
      snapshot = const ShortcutSnapshot(auth: AuthStatus.signedIn);
    });

    test('warm start: a tap goes straight to its place', () async {
      snapshot = const ShortcutSnapshot(auth: AuthStatus.signedIn, resumeSessionId: 'sess-9');
      final d = make();
      await d.start();
      await d.handle('resume');
      await d.handle('practice10');
      expect(went, ['/run/sess-9', '/practice/setup/quick?count=10']);
    });

    test('cold start: the launching shortcut waits for the account, then opens once', () async {
      surface.launchedWith = 'practice10';
      snapshot = const ShortcutSnapshot(auth: AuthStatus.unknown);
      final d = make();
      await d.start();
      await Future<void>.delayed(Duration.zero);
      expect(went, isEmpty, reason: 'nothing opens while the splash is deciding who is signed in');

      snapshot = const ShortcutSnapshot(auth: AuthStatus.signedIn);
      await d.replayPending();
      expect(went, ['/practice/setup/quick?count=10']);

      await d.replayPending();
      expect(went, hasLength(1), reason: 'a launch shortcut is replayed once');
    });

    test('cold start: a shortcut held for more than 10 minutes is forgotten', () async {
      snapshot = const ShortcutSnapshot(auth: AuthStatus.unknown);
      final d = make();
      await d.handle('practice10');
      now = now.add(const Duration(minutes: 11));
      snapshot = const ShortcutSnapshot(auth: AuthStatus.signedIn);
      await d.replayPending();
      expect(went, isEmpty);
    });

    test('signed out: a shortcut does nothing', () async {
      snapshot = const ShortcutSnapshot(auth: AuthStatus.signedOut);
      final d = make();
      await d.handle('practice10');
      await d.handle('resume');
      expect(went, isEmpty);
    });

    test('an unknown type is ignored', () async {
      await make().handle('something-else');
      expect(went, isEmpty);
    });

    test('resume waits for the open session to load on a cold start', () async {
      snapshot = const ShortcutSnapshot(auth: AuthStatus.signedIn);
      final d = make(
        wait: (dur) async {
          now = now.add(dur);
          // The journal answers while the tap is waiting.
          snapshot = const ShortcutSnapshot(auth: AuthStatus.signedIn, resumeSessionId: 'sess-3');
        },
      );
      await d.handle('resume');
      expect(went, ['/run/sess-3']);
    });

    test('resume with no open session left (a stale shortcut) opens Practice', () async {
      await make().handle('resume');
      expect(went, [AppRoutes.practice]);
    });

    test('repair goes to tonight\'s mistake when it is known', () async {
      snapshot = ShortcutSnapshot(auth: AuthStatus.signedIn, repairLocation: AppRoutes.reviewRepair('m7', 'm7-q0'));
      await make().handle('repair');
      expect(went, [AppRoutes.reviewRepair('m7', 'm7-q0')]);
    });

    test('repair with nothing to repair opens Review', () async {
      await make().handle('repair');
      expect(went, [AppRoutes.review]);
    });

    test('start survives a device with no launcher shortcuts', () async {
      surface.failInitialize = true;
      await make().start();
      expect(went, isEmpty);
    });

    group('sync', () {
      test('signed in: the list is set, with Resume only while a session is open', () async {
        final d = make();
        await d.sync(auth: AuthStatus.signedIn, hasResume: false);
        await d.sync(auth: AuthStatus.signedIn, hasResume: false);
        await d.sync(auth: AuthStatus.signedIn, hasResume: true);
        await d.sync(auth: AuthStatus.signedIn, hasResume: false);
        expect(surface.sets, [
          ['repair', 'practice10'],
          ['resume', 'repair', 'practice10'],
          ['repair', 'practice10'],
        ]);
      });

      test('signed out clears the list; unknown leaves it alone', () async {
        final d = make();
        await d.sync(auth: AuthStatus.unknown, hasResume: false);
        expect(surface.sets, isEmpty);
        expect(surface.clears, 0);
        await d.sync(auth: AuthStatus.signedOut, hasResume: false);
        await d.sync(auth: AuthStatus.signedOut, hasResume: false);
        expect(surface.clears, 1);
      });
    });
  });
}

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/runner/nta/nta_paper_theme.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

class _Mockmob extends NtaStyleNotifier {
  @override
  NtaStyle build() => NtaStyle.mockmob;
}

/// The Dart side of FLAG_SECURE (MainActivity.kt's `in.mockmob.app/secure_window` channel): on
/// when an NTA paper opens, off when it closes, never for the Night Sheet runner (review round 3,
/// pkg-04 #7). The real `PlatformSecureWindow` talks to a fake channel here.
void main() {
  setUpAll(loadAppFonts);

  const channel = MethodChannel('in.mockmob.app/secure_window');
  late List<Object?> calls;

  setUp(() {
    calls = [];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, (call) async {
      expect(call.method, 'set');
      calls.add(call.arguments);
      return true;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, null);
  });

  /// The channel is Android only: the caller checks the platform first.
  Future<void> onAndroid(Future<void> Function() body) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    try {
      await body();
    } finally {
      debugDefaultTargetPlatformOverride = null;
    }
  }

  testWidgets('an NTA paper secures the window while open and releases it on leaving', (tester) async {
    await onAndroid(() async {
      final h = await pumpRunner(tester, session: FakeRunnerSession(mode: 'nta'));
      await settle(tester);
      expect(calls, [true]);
      h.router.go('/practice');
      await settle(tester);
      expect(calls, [true, false]);
    });
  });

  testWidgets('the submit page of the same paper keeps it secured, once', (tester) async {
    await onAndroid(() async {
      final h = await pumpRunner(tester, session: FakeRunnerSession(mode: 'nta'));
      await settle(tester);
      h.router.go('/run/sess-1/submit');
      await settle(tester);
      expect(calls, [true], reason: 'one holder count across the paper and its submit page');
      h.router.go('/practice');
      await settle(tester);
      expect(calls, [true, false]);
    });
  });

  testWidgets('the NTA paper in the MockMob look is still an exam: secured', (tester) async {
    await onAndroid(() async {
      final h = await pumpRunner(tester, session: FakeRunnerSession(mode: 'nta'), overrides: [ntaStyleProvider.overrideWith(_Mockmob.new)]);
      await settle(tester);
      expect(calls, [true]);
      h.router.go('/practice');
      await settle(tester);
      expect(calls, [true, false]);
    });
  });

  testWidgets('the Night Sheet runner (a MockMob mock or practice) never touches the window', (tester) async {
    await onAndroid(() async {
      for (final mode in ['full', 'quick']) {
        final h = await pumpRunner(tester, session: FakeRunnerSession(mode: mode, mockNumber: mode == 'full' ? 7 : null));
        await settle(tester);
        h.router.go('/practice');
        await settle(tester);
      }
      expect(calls, isEmpty);
    });
  });
}

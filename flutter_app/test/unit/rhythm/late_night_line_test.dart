import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_providers.dart';
import 'package:mockmob/core/repositories/notification_prefs_repository.dart' show studentTimezoneProvider;
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/rhythm/copy.dart';
import 'package:mockmob/features/rhythm/data/rhythm_prefs.dart' show rhythmPrefsStoreProvider;
import 'package:mockmob/features/rhythm/widgets/late_night_line.dart';
import 'package:mockmob/features/you/you_providers.dart' show PrefToggle, lateNightLinesProvider;

Widget _host(DateTime now, {bool on = true, PrefsStore? store}) => ProviderScope(
  key: UniqueKey(),
  overrides: [
    nowProvider.overrideWithValue(() => now),
    studentTimezoneProvider.overrideWithValue('Asia/Kolkata'),
    rhythmPrefsStoreProvider.overrideWithValue(store ?? MemoryPrefsStore()),
    lateNightLinesProvider.overrideWith(() => PrefToggle(initial: on, read: (_) async => on, write: (_, _) async {})),
  ],
  child: MaterialApp(
    theme: buildTheme(Brightness.light),
    home: const Scaffold(body: LateNightLine()),
  ),
);

// 23:30 and 14:00 in India, as UTC instants.
final _lateNight = DateTime.utc(2026, 10, 12, 18);
final _afternoon = DateTime.utc(2026, 10, 12, 8, 30);

void main() {
  testWidgets('shows once between 11 PM and 5 AM, then not again that night', (tester) async {
    final store = MemoryPrefsStore();
    await tester.pumpWidget(_host(_lateNight, store: store));
    await tester.pumpAndSettle();
    expect(find.text(RhythmCopy.lateNightStop), findsOneWidget);

    await tester.pumpWidget(_host(_lateNight, store: store));
    await tester.pumpAndSettle();
    expect(find.text(RhythmCopy.lateNightStop), findsNothing);
  });

  testWidgets('can be dismissed', (tester) async {
    await tester.pumpWidget(_host(_lateNight));
    await tester.pumpAndSettle();
    await tester.tap(find.text(RhythmCopy.lateNightDismiss));
    await tester.pumpAndSettle();
    expect(find.text(RhythmCopy.lateNightStop), findsNothing);
  });

  testWidgets('stays away in the daytime and when the setting is off', (tester) async {
    await tester.pumpWidget(_host(_afternoon));
    await tester.pumpAndSettle();
    expect(find.text(RhythmCopy.lateNightStop), findsNothing);

    await tester.pumpWidget(_host(_lateNight, on: false));
    await tester.pumpAndSettle();
    expect(find.text(RhythmCopy.lateNightStop), findsNothing);
  });
}

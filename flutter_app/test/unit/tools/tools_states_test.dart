// The states of the CUET tools that used to read as failure or as a dead end: Compass with
// nothing open (Hide must work, the list starts at the nearest five), the offline and error
// screens (sleepy and thinking Mobi, retry when the network returns), and the hub's first-open
// hop. Each runs the real screen against the real 2026 DU files.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/connectivity/connectivity_monitor.dart' show NetworkStatus;
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/widgets/mobi.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/compass/programme_rows.dart';
import 'package:mockmob/features/tools/copy.dart';
import 'package:mockmob/features/tools/hub/tools_hub_screen.dart';
import 'package:mockmob/features/tools/widgets/action_chip.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'tools_test_support.dart';

Finder _mobi(MobiPose pose) => find.byWidgetPredicate((w) => w is Mobi && w.pose == pose);

void main() {
  setUpAll(loadAppFonts);

  Future<void> compass(WidgetTester tester, {required MemoryPrefsStore prefs, FakeSource? source, NetworkStatus network = NetworkStatus.online, Stream<void>? restored}) async {
    await pumpMockmob(
      tester,
      const CompassScreen(),
      size: const Size(384, 9000),
      wrapInScaffold: false,
      disableAnimations: true,
      overrides: toolsOverrides(prefs: prefs, source: source, network: network, restored: restored),
    );
    await tester.pumpAndSettle();
  }

  group('Compass with no programme open', () {
    testWidgets('opens the nearest five, names what one more subject unlocks, and Mobi thinks', (tester) async {
      await compass(tester, prefs: savedCompass('english,business_studies,economics'));
      expect(find.text(ToolsCopy.noneOpenTitle), findsOneWidget);
      expect(find.text(ToolsCopy.noneOpenLine), findsOneWidget);
      expect(_mobi(MobiPose.think), findsOneWidget);
      // The old three-sentence paragraph is gone.
      expect(find.textContaining('one language and three domain subjects'), findsNothing);
      expect(find.text(ToolsCopy.unlocksHeading), findsOneWidget);
      final chips = tester.widgetList<ToolsActionChip>(find.byType(ToolsActionChip)).toList();
      expect(chips, isNotEmpty);
      expect(chips.every((c) => RegExp(r'^\+\d+$').hasMatch(c.trailing ?? '')), isTrue, reason: 'each chip says how many it opens');
      expect(find.byType(NearRow), findsNWidgets(5));
      expect(find.text(ToolsCopy.nearHide), findsOneWidget);
    });

    testWidgets('Hide collapses the list, Show brings back five, Show all brings back every row', (tester) async {
      await compass(tester, prefs: savedCompass('english,business_studies,economics'));
      await tester.tap(find.text(ToolsCopy.nearHide));
      await tester.pumpAndSettle();
      expect(find.byType(NearRow), findsNothing, reason: 'Hide must work with zero programmes open');
      expect(find.text(ToolsCopy.nearShow), findsOneWidget);

      await tester.tap(find.text(ToolsCopy.nearShow));
      await tester.pumpAndSettle();
      expect(find.byType(NearRow), findsNWidgets(5));

      await tester.tap(find.textContaining('Show all'));
      await tester.pumpAndSettle();
      expect(find.byType(NearRow).evaluate().length, greaterThan(5));
      expect(find.text(ToolsCopy.nearShowFewer), findsOneWidget);
    });

    testWidgets('with programmes open the list starts hidden and Show opens it', (tester) async {
      await compass(tester, prefs: savedCompass('english,accountancy,business_studies,economics'));
      expect(find.byType(NearRow), findsNothing);
      expect(find.text(ToolsCopy.nearShow), findsOneWidget);
      await tester.tap(find.text(ToolsCopy.nearShow));
      await tester.pumpAndSettle();
      expect(find.byType(NearRow), findsNWidgets(5));
      expect(find.text(ToolsCopy.nearHide), findsOneWidget);
    });

    testWidgets('no defensive footer is left on the screen', (tester) async {
      await compass(tester, prefs: savedCompass('english,accountancy,business_studies,economics'));
      expect(find.textContaining('not a prediction'), findsNothing);
      expect(find.textContaining('provisional'), findsNothing);
      expect(find.text(ToolsCopy.dataLine), findsOneWidget);
    });
  });

  group('when Compass cannot load', () {
    testWidgets('offline: sleepy Mobi and the promise that the work is saved', (tester) async {
      await compass(tester, prefs: MemoryPrefsStore(), source: FakeSource(offline: true));
      expect(find.text(ToolsCopy.offlineTitle), findsOneWidget);
      expect(find.text('Your answers and drafts are saved on this phone.'), findsOneWidget);
      expect(_mobi(MobiPose.sleepy), findsOneWidget);
    });

    testWidgets('a plain failure on a phone that says it is offline reads as offline too', (tester) async {
      await compass(tester, prefs: MemoryPrefsStore(), source: FakeSource(), network: NetworkStatus.offline);
      expect(find.text(ToolsCopy.offlineTitle), findsOneWidget);
      expect(_mobi(MobiPose.sleepy), findsOneWidget);
    });

    testWidgets('a failure with the network up shows thinking Mobi and Try again', (tester) async {
      await compass(tester, prefs: MemoryPrefsStore(), source: FakeSource());
      expect(find.text(ToolsCopy.errorTitle), findsOneWidget);
      expect(_mobi(MobiPose.think), findsOneWidget);
      expect(find.text(ToolsCopy.tryAgain), findsOneWidget);
    });

    testWidgets('retries by itself when the network returns', (tester) async {
      final source = realDuServer()..offline = true;
      final restored = StreamController<void>.broadcast();
      addTearDown(restored.close);
      await compass(tester, prefs: MemoryPrefsStore(), source: source, restored: restored.stream);
      expect(find.text(ToolsCopy.offlineTitle), findsOneWidget);

      source.offline = false;
      restored.add(null);
      await tester.pumpAndSettle();
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
      await tester.pumpAndSettle();
      expect(find.text(ToolsCopy.offlineTitle), findsNothing);
      expect(find.text(ToolsCopy.compassLead).evaluate().isNotEmpty || find.text('35 open to you').evaluate().isNotEmpty, isTrue);
    });
  });

  group('the tools hub', () {
    Future<void> hub(WidgetTester tester, MemoryPrefsStore prefs) async {
      await pumpMockmob(
        tester,
        const ToolsHubScreen(),
        wrapInScaffold: false,
        disableAnimations: true,
        overrides: toolsOverrides(prefs: prefs),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('Mobi hops the first time the hub is opened on a phone, and not again', (tester) async {
      final prefs = MemoryPrefsStore();
      await hub(tester, prefs);
      expect(_mobi(MobiPose.cheer), findsOneWidget);
      expect(prefs.values.keys.any((k) => k.contains('hub.seen')), isTrue);

      await tester.pumpWidget(const SizedBox.shrink());
      await hub(tester, prefs);
      expect(_mobi(MobiPose.cheer), findsNothing);
    });
  });
}

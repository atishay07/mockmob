import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/screens/ask_screen.dart';
import 'package:mockmob/features/insights/widgets/ask_messages.dart';
import 'package:mockmob/features/insights/widgets/entry_points.dart';
import 'package:mockmob/features/insights/widgets/insights_bits.dart';
import 'package:mockmob/features/insights/widgets/practice_card.dart';

import '../../golden/insights/insights_golden_support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import 'support/insights_fixtures.dart';

class _Counting implements HapticDriver {
  int selection = 0;

  @override
  Future<void> lightImpact() async {}

  @override
  Future<void> mediumImpact() async {}

  @override
  Future<void> selectionClick() async => selection++;
}

void _noop() {}

void main() {
  setUpAll(loadAppFonts);

  group('the subject thumb', () {
    testWidgets('a known subject is its drawn emblem, unframed, at every size', (tester) async {
      await pumpMockmob(
        tester,
        const Row(children: [SubjectThumb(subject: 'accountancy'), SubjectThumb(subject: 'business', size: 60), SubjectThumb(subject: 'hindi')]),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      final emblems = tester.widgetList<SubjectEmblem>(find.byType(SubjectEmblem)).toList();
      expect(emblems.map((e) => e.size), [44, 60, 44]);
      expect(emblems.every((e) => !e.framed), isTrue);
    });

    testWidgets('a subject the build does not know gets its initials, never another subject mark', (tester) async {
      await pumpMockmob(tester, const SubjectThumb(subject: 'legal_studies'), brightness: Brightness.dark, disableAnimations: true);
      expect(find.byType(SubjectEmblem), findsNothing);
      expect(find.text('LS'), findsOneWidget);
    });
  });

  group('Mobi in the thread', () {
    testWidgets('a reply is carried by the face of Mobi, and a reply that just landed nods', (tester) async {
      await pumpMockmob(
        tester,
        const Column(children: [
          AskMessageView(message: AskMessage.reply('You lost 35 marks in Partnership.', origin: AskOrigin.phone), onRetry: _noop),
          AskMessageView(message: AskMessage.reply('Try the cash flow chapter next.', origin: AskOrigin.phone), onRetry: _noop, animate: true),
        ]),
        brightness: Brightness.dark,
        disableAnimations: true,
      );
      final faces = tester.widgetList<MobiFace>(find.byType(MobiFace)).toList();
      expect(faces, hasLength(2));
      expect(faces.map((f) => f.entrance), [MobiAct.idle, MobiAct.correct]);
      // A thread is a list of many: its faces do not follow taps.
      expect(faces.every((f) => !f.watchTaps && f.size == 32), isTrue);
    });

    testWidgets('a pending reply shows a face that scans while the bubbles ink', (tester) async {
      await pumpMockmob(tester, const AskMessageView(message: AskMessage.sending(), onRetry: _noop), brightness: Brightness.dark, disableAnimations: true);
      expect(tester.widget<MobiFace>(find.byType(MobiFace)).entrance, MobiAct.loading);
    });
  });

  group('Ask stage', () {
    testWidgets('the stage Mobi has its own controller, so focusing the field reaches it', (tester) async {
      await pumpMockmob(tester, const AskScreen(), brightness: Brightness.dark, disableAnimations: true, overrides: insightsOverrides(), wrapInScaffold: false);
      final stage = tester.widget<MobiStage>(find.byType(MobiStage));
      expect(stage.controller, isNotNull);
      await tester.tap(find.byType(TextField));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.takeException(), isNull);
    });

    testWidgets('once there is a conversation the stage is gone and the header Mobi is the one that listens', (tester) async {
      await pumpMockmob(
        tester,
        const AskScreen(),
        brightness: Brightness.dark,
        disableAnimations: true,
        overrides: insightsOverrides(ask: const AskState(messages: [AskMessage.student('How is my week going?'), AskMessage.reply('Three sessions.', origin: AskOrigin.phone)])),
        wrapInScaffold: false,
      );
      expect(find.byType(MobiStage), findsNothing);
      await tester.tap(find.byType(TextField));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.takeException(), isNull);
    });
  });

  group('the answer to a practice question', () {
    for (final (pick, act) in [('A', MobiAct.correct), ('B', MobiAct.encourage)]) {
      testWidgets('picking $pick shows Mobi as ${act.name}, on the face only', (tester) async {
        await pumpMockmob(
          tester,
          SingleChildScrollView(child: PracticeCard(question: question('q1'), picked: pick, onPick: (_) {})),
          brightness: Brightness.dark,
          disableAnimations: true,
        );
        final face = tester.widget<MobiFace>(find.byType(MobiFace));
        expect(face.entrance, act);
        expect(face.watchTaps, isFalse);
      });
    }

    testWidgets('before an answer there is no Mobi', (tester) async {
      await pumpMockmob(tester, SingleChildScrollView(child: PracticeCard(question: question('q1'), picked: null, onPick: (_) {})), brightness: Brightness.dark, disableAnimations: true);
      expect(find.byType(MobiFace), findsNothing);
    });
  });

  group('press feel', () {
    testWidgets('an entry row ticks once and shows the press veil', (tester) async {
      final haptics = _Counting();
      var opened = 0;
      await pumpMockmob(
        tester,
        EntryRow(icon: Icons.bookmark, title: 'Saved questions', onTap: () => opened++),
        brightness: Brightness.dark,
        disableAnimations: true,
        overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: haptics))],
      );
      final press = tester.widget<MmPressable>(find.byType(MmPressable));
      expect(press.highlight, isTrue);
      await tester.tap(find.text('Saved questions'));
      await tester.pump();
      expect(opened, 1);
      expect(haptics.selection, 1);
    });
  });
}

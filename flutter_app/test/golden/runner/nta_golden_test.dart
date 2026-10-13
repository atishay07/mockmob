import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/practice_quote.dart';
import 'package:mockmob/core/sync/session/save_state.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/sync/session/session_engine.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/data/practice_quote.dart';
import 'package:mockmob/features/runner/nta/nta_instructions_parts.dart';
import 'package:mockmob/features/runner/nta/nta_instructions_screen.dart';
import 'package:mockmob/features/runner/nta/nta_paper_theme.dart';
import 'package:mockmob/features/runner/nta/nta_runner_screen.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart' show FileAssetBundle;
import '../../unit/runner/support/exam_font.dart';
import '../../unit/runner/support/fake_session.dart';
import '../../unit/runner/support/harness.dart';

class _MockmobLook extends NtaStyleNotifier {
  @override
  NtaStyle build() => NtaStyle.mockmob;
}

/// The app goes to the background and comes back: one warning.
void _leaveAndReturn(WidgetTester tester) {
  for (final st in [
    AppLifecycleState.inactive,
    AppLifecycleState.hidden,
    AppLifecycleState.paused,
    AppLifecycleState.hidden,
    AppLifecycleState.inactive,
    AppLifecycleState.resumed,
  ]) {
    tester.binding.handleAppLifecycleStateChanged(st);
  }
}

Map<String, int> _answered(int n) => {for (var i = 1; i <= n; i++) 'q$i': (i * 7) % 4};

String _suffix(Brightness b) => b == Brightness.dark ? 'night' : 'day';

Future<void> _shot(WidgetTester tester, String name, Brightness b) =>
    expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_${_suffix(b)}.png'));

FakeRunnerSession _mid({Duration remaining = const Duration(minutes: 41, seconds: 7), SaveSnapshot? save}) => FakeRunnerSession(
  mode: 'nta',
  currentIndex: 11,
  answers: {..._answered(11)..remove('q6'), 'q12': 0},
  marked: {'q4', 'q9', 'q12'},
  visited: {for (var i = 1; i <= 12; i++) 'q$i'},
  remaining: remaining,
  save: save ?? const SaveSnapshot(state: SaveState.saved),
);

final _quote = PracticeQuote.fromJson({
  'state': 'available',
  'launchable': true,
  'reasonCode': 'included',
  'count': 50,
  'durationSec': 3600,
  'creditCost': 0,
});

Future<void> _pumpPlain(WidgetTester tester, Widget child, Brightness b) async {
  tester.view.physicalSize = kRunnerSize * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ntaCandidateNameProvider.overrideWithValue('Asha Verma'),
        practiceQuoteProvider.overrideWith((ref, query) async => _quote),
      ],
      child: DefaultAssetBundle(
        bundle: FileAssetBundle(),
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: b == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
          home: child,
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await loadExamFont();
  });

  for (final b in [Brightness.dark, Brightness.light]) {
    group(_suffix(b), () {
      testWidgets('first question', (tester) async {
        await pumpRunner(tester, session: FakeRunnerSession(mode: 'nta', remaining: const Duration(minutes: 59, seconds: 52)), brightness: b);
        await settle(tester);
        await _shot(tester, 'nta_first', b);
      });

      testWidgets('answered and marked, mid paper', (tester) async {
        await pumpRunner(tester, session: _mid(save: const SaveSnapshot(state: SaveState.saving, unsyncedAnswers: 1)), brightness: b);
        await settle(tester);
        await _shot(tester, 'nta_answered', b);
      });

      testWidgets('palette drawer', (tester) async {
        final s = FakeRunnerSession(
          mode: 'nta',
          currentIndex: 23,
          answers: _answered(23)
            ..remove('q9')
            ..remove('q15'),
          marked: {'q4', 'q15', 'q21'},
          visited: {for (var i = 1; i <= 24; i++) 'q$i'},
        );
        await pumpRunner(tester, session: s, brightness: b);
        await tester.tap(find.bySemanticsLabel('Question palette'));
        await settle(tester);
        await _shot(tester, 'nta_palette', b);
      });

      testWidgets('first warning after leaving', (tester) async {
        await pumpRunner(tester, session: _mid(), brightness: b);
        await settle(tester);
        for (final st in [AppLifecycleState.inactive, AppLifecycleState.hidden, AppLifecycleState.paused]) {
          tester.binding.handleAppLifecycleStateChanged(st);
        }
        for (final st in [AppLifecycleState.hidden, AppLifecycleState.inactive, AppLifecycleState.resumed]) {
          tester.binding.handleAppLifecycleStateChanged(st);
        }
        await settle(tester);
        await _shot(tester, 'nta_warning', b);
      });

      testWidgets('a passage question', (tester) async {
        final s = FakeRunnerSession(mode: 'nta', questions: passageQuestions(), subject: 'english', currentIndex: 1, answers: {'p1': 0});
        await pumpRunner(tester, session: s, brightness: b);
        await settle(tester);
        await _shot(tester, 'nta_passage', b);
      });

      testWidgets('under a minute, with the warning line', (tester) async {
        final s = FakeRunnerSession(
          mode: 'nta',
          currentIndex: 47,
          answers: _answered(46),
          visited: {for (var i = 1; i <= 48; i++) 'q$i'},
          remaining: const Duration(seconds: 54),
        );
        await pumpRunner(tester, session: s, brightness: b);
        s.warningController.add(SessionWarning.oneMinute);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));
        await _shot(tester, 'nta_low_time', b);
        await tester.pump(const Duration(seconds: 4));
      });

      testWidgets('submit summary', (tester) async {
        final s = FakeRunnerSession(
          mode: 'nta',
          currentIndex: 49,
          answers: _answered(50)..removeWhere((k, _) => ['q9', 'q15', 'q31', 'q32', 'q47'].contains(k)),
          marked: {'q4', 'q15', 'q21', 'q40'},
          visited: {for (var i = 1; i <= 48; i++) 'q$i'},
          remaining: const Duration(minutes: 6, seconds: 18),
        );
        await pumpRunner(tester, session: s, brightness: b, location: '/run/sess-1/submit');
        await settle(tester);
        await _shot(tester, 'nta_submit', b);
      });

      testWidgets('question paper', (tester) async {
        await pumpRunner(tester, session: _mid(), brightness: b);
        await tester.tap(find.bySemanticsLabel('Question palette'));
        await settle(tester);
        await tester.tap(find.text('Question paper'));
        await settle(tester);
        await _shot(tester, 'nta_question_paper', b);
      });

      testWidgets('instructions', (tester) async {
        await _pumpPlain(tester, const NtaInstructionsScreen(subject: 'business_studies'), b);
        await settle(tester);
        await _shot(tester, 'nta_instructions', b);
      });

      testWidgets('instructions, read to the end', (tester) async {
        await _pumpPlain(tester, const NtaInstructionsScreen(subject: 'business_studies'), b);
        await settle(tester);
        await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -3000));
        await settle(tester);
        await tester.tap(find.text(NtaStartCopy.declare));
        await settle(tester);
        await _shot(tester, 'nta_instructions_end', b);
      });

      testWidgets('preparing', (tester) async {
        await _pumpPlain(
          tester,
          const Scaffold(
            body: Padding(
              padding: EdgeInsets.fromLTRB(16, 80, 16, 16),
              child: NtaPreparing(subject: 'Business Studies', phase: NtaPrepPhase.starting),
            ),
          ),
          b,
        );
        await tester.pump(const Duration(milliseconds: 300));
        await _shot(tester, 'nta_preparing', b);
      });

      testWidgets('tablet, two panes', (tester) async {
        await pumpRunner(tester, session: _mid(), brightness: b, size: const Size(1180, 820));
        await settle(tester);
        await _shot(tester, 'nta_tablet', b);
      });

      // Focus mode hides the status and navigation bars; only the camera cutout keeps an inset.
      // The exam bar runs up under it in its own blue, so no empty band is left above the paper.
      for (final size in [const Size(360, 780), const Size(384, 853)]) {
        testWidgets('focus mode at ${size.width.toInt()} by ${size.height.toInt()}', (tester) async {
          await pumpRunner(
            tester,
            session: FakeRunnerSession(mode: 'nta', remaining: const Duration(minutes: 59, seconds: 52)),
            brightness: b,
            size: size,
            systemInsets: const EdgeInsets.only(top: 28),
          );
          await settle(tester);
          await _shot(tester, 'nta_focus_${size.width.toInt()}', b);
        });
      }

      testWidgets('the second warning', (tester) async {
        final prefs = MemoryPrefsStore()..values['nta.strikes.sess-1'] = 1;
        await pumpRunner(tester, session: _mid(), brightness: b, prefs: prefs);
        await settle(tester);
        _leaveAndReturn(tester);
        await settle(tester);
        await _shot(tester, 'nta_warning_2', b);
      });

      testWidgets('the third warning ends the session', (tester) async {
        final prefs = MemoryPrefsStore()..values['nta.strikes.sess-1'] = 2;
        final s = _mid()..nextOutcome = null;
        await pumpRunner(tester, session: s, brightness: b, prefs: prefs);
        await settle(tester);
        _leaveAndReturn(tester);
        // The ended card holds over the paper, with the answers on their way, until Continue.
        await settle(tester);
        await _shot(tester, 'nta_ended', b);
        expect(find.text('Exam summary'), findsNothing);
        await tester.tap(find.text('Continue'));
        await settle(tester);
        expect(find.text('Exam summary'), findsOneWidget);
      });

      testWidgets('the leave sheet', (tester) async {
        await pumpRunner(tester, session: _mid(), brightness: b);
        await settle(tester);
        await tester.binding.handlePopRoute();
        await settle(tester);
        await _shot(tester, 'nta_leave', b);
      });

      testWidgets('the MockMob look', (tester) async {
        await pumpRunner(tester, session: _mid(), brightness: b, overrides: [ntaStyleProvider.overrideWith(_MockmobLook.new)]);
        await settle(tester);
        await _shot(tester, 'nta_mockmob', b);
      });

      testWidgets('large text on a small phone', (tester) async {
        await pumpRunner(tester, session: _mid(), brightness: b, size: const Size(360, 640), textScale: 2);
        await settle(tester);
        await _shot(tester, 'nta_large_text', b);
      });
    });
  }
}

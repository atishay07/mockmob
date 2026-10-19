// Final pass, H14 (final walk 18 Oct): the Start sheet's hero is Today's current lead, a pick from the
// Suggested stack included, with the lead's length; its subject chips are the account's own subjects, as
// the Practice tab shows them. A figure and its unit never part across a line.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/app_overrides.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/models/models.dart' show Subject;
import 'package:mockmob/core/router/quick_start.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/practice/data/practice_catalog.dart' show PracticeSubject, practiceSubjectProvider, practiceSubjectsProvider;
import 'package:mockmob/features/today/data/lead_pick.dart';
import 'package:mockmob/features/today/data/today_providers.dart';
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';

import 'support/today_fixtures.dart';

class _Auth extends AuthController {
  _Auth(this.subjects);

  final List<String> subjects;

  @override
  AuthSnapshot build() => AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', email: 'a@b.co', subjects: subjects);
}

ProviderContainer _container(TodayInputs inputs, {List<String> subjects = const ['accountancy', 'economics'], List<Override> more = const []}) {
  final c = ProviderContainer(
    overrides: [
      todayInputsProvider.overrideWithValue(inputs),
      authSnapshotProvider.overrideWith(() => _Auth(subjects)),
      ...liveAppOverrides(),
      ...more,
    ],
  );
  addTearDown(c.dispose);
  addTearDown(todayPicks.clear);
  return c;
}

/// Practice's subject without its stores (the default needs the database): the tab's own pick.
class _PracticeAt extends PracticeSubject {
  @override
  String build() => 'accountancy';
}

void main() {
  setUp(todayPicks.clear);

  final inputs = ashaInputs();
  final view = buildToday(inputs);
  final pickable = [
    for (final c in view.choices)
      if (c.hero != null) c,
  ];

  test('with no pick, Start leads with the same move Today leads with', () {
    final c = _container(inputs);
    final start = c.read(startTonightMoveProvider)!;
    final hero = view.hero! as MoveHero;
    expect(start.title, hero.summary);
    expect(start.location, (hero.primary.target as GoTo).location);
    expect(start.picked, isFalse);
  });

  test('a pick from the Suggested stack is what Start leads with: same words, place and kind', () {
    expect(pickable, isNotEmpty, reason: 'the fixture record offers at least one other move');
    for (final choice in pickable) {
      final c = _container(inputs);
      todayPicks.set(view.header.dateLine, choice.key);
      final lead = c.read(todayLeadMoveProvider)!;
      final start = c.read(startTonightMoveProvider);
      expect(lead.summary, choice.hero!.summary);
      expect(start, isNotNull, reason: choice.key);
      expect(start!.title, choice.hero!.summary);
      expect(start.location, (choice.hero!.primary.target as GoTo).location);
      expect(start.kind, choice.hero!.primary.actionType);
      expect(start.picked, isTrue);
      todayPicks.clear();
    }
  });

  test('Undo of a pick puts Start back on the recommended move', () {
    final c = _container(inputs);
    final hero = view.hero! as MoveHero;
    todayPicks.set(view.header.dateLine, pickable.first.key);
    expect(c.read(startTonightMoveProvider)!.picked, isTrue);
    todayPicks.set(view.header.dateLine, null);
    final start = c.read(startTonightMoveProvider)!;
    expect(start.title, hero.summary);
    expect(start.picked, isFalse);
  });

  test("a pick made on another day does not lead today's Start", () {
    final c = _container(inputs);
    todayPicks.set('Monday, 12 October', pickable.first.key);
    expect(c.read(startTonightMoveProvider)!.picked, isFalse);
  });

  test("the move's length travels with it, so the sheet says the minutes the card says", () {
    final c = _container(inputs);
    final start = c.read(startTonightMoveProvider)!;
    final hero = view.hero! as MoveHero;
    final shown = hero.selectedMinutes ?? int.tryParse(hero.primary.label.split(', ').last.split(' ').first);
    expect(start.minutes, shown);
  });

  test('the chips are the account subjects, as the Practice tab shows them, never the whole catalogue', () async {
    Subject subject(String id) => Subject(id: id, internalId: id, name: id, practice: 'supported');
    final c = _container(
      inputs,
      more: [
        practiceSubjectProvider.overrideWith(_PracticeAt.new),
        practiceSubjectsProvider.overrideWith(
          (ref) async => [for (final id in ['english', 'accountancy', 'biology', 'economics', 'business_studies']) subject(id)],
        ),
      ],
    );
    await c.read(practiceSubjectsProvider.future);
    final chips = c.read(startSubjectsProvider);
    expect(chips.toSet(), {'accountancy', 'economics'});
    expect(chips, isNot(contains('english')));
    expect(chips, isNot(contains('biology')));
  });

  group('a figure and its unit stay together', () {
    test('minutes, questions and marks take a no-break space', () {
      expect(keepUnitsTogether('Start Revise, 10 min'), 'Start Revise, 10 min');
      expect(keepUnitsTogether("Tonight's move, about 20 minutes."), "Tonight's move, about 20 minutes.");
      expect(keepUnitsTogether('50 questions, 60 minutes'), '50 questions, 60 minutes');
      expect(keepUnitsTogether('Win 5 marks'), 'Win 5 marks');
    });

    test('a number before another word is left alone', () {
      expect(keepUnitsTogether('Mock 7 from Sunday'), 'Mock 7 from Sunday');
      expect(keepUnitsTogether('10 Economics questions'), '10 Economics questions', reason: 'a word sits between the figure and its unit');
      expect(keepUnitsTogether('3 minutely'), '3 minutely');
    });

    test('the note names the length when the title does not, and never twice', () {
      const withLength = StartMove(title: 'Start Revise, 10 min', location: '/x', minutes: 10);
      expect(startMoveNote(withLength, 'tonight'), "Tonight's move.");
      const without = StartMove(title: 'Practise Partnership fundamentals', location: '/x', minutes: 20);
      expect(startMoveNote(without, 'tonight'), "Tonight's move, about 20 minutes.");
      const pick = StartMove(title: 'Practise Partnership fundamentals', location: '/x', minutes: 20, picked: true);
      expect(startMoveNote(pick, 'tonight'), 'Your pick, about 20 minutes.');
      const unknown = StartMove(title: 'Repair 4 mistakes', location: '/x');
      expect(startMoveNote(unknown, 'today'), "Today's move.");
    });
  });

  testWidgets('the hero in the sheet keeps "10 min" in one piece', (tester) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          resumeDraftProvider.overrideWith((ref) => null),
          resumeOfferProvider.overrideWith((ref) async => null),
          startSubjectsProvider.overrideWith((ref) => const ['accountancy', 'economics']),
          startDefaultSubjectProvider.overrideWith((ref) => 'accountancy'),
          startTonightMoveProvider.overrideWith((ref) => const StartMove(title: 'Start Revise, 10 min', location: '/revise', kind: 'revise', minutes: 10)),
        ],
        child: MaterialApp(
          theme: buildTheme(Brightness.light),
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () => showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => const Material(child: QuickStartSheet()),
                ),
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 900));
    expect(find.text('Start Revise, 10 min'), findsOneWidget);
    expect(find.text('Start Revise, 10 min'), findsNothing);
    // The note follows the clock ("Tonight's move." in the evening, "Today's move." earlier), so either is right.
    expect(find.text("Tonight's move.").evaluate().length + find.text("Today's move.").evaluate().length, 1);
  });
}

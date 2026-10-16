import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/my_colleges.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/du_catalog.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/model/plan.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/state/answers_store.dart';
import 'package:mockmob/features/onboarding/widgets/college_ladder.dart';
import 'package:mockmob/features/onboarding/widgets/sheet_lines.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

final DuCourse _course = DuCatalog.course('b-com-hons')!;

/// The ladder's rows, highest first, as the college names the answers keep.
List<String> get _names => [for (final o in _course.ladder('UR')) o.college];

OnboardingAnswers _with(List<String> colleges) => OnboardingAnswers(
      courseId: _course.id,
      colleges: colleges,
      subjects: const [SheetSubject.english, SheetSubject.accountancy, SheetSubject.businessStudies, SheetSubject.economics],
    );

/// The ladder with the same picks rule the controller has: up to [kMaxColleges], else refused.
class _Host extends StatefulWidget {
  const _Host({this.initial = const [], this.query = '', this.onRefused});

  final List<String> initial;
  final String query;
  final VoidCallback? onRefused;

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  late List<String> picks = [...widget.initial];

  bool toggle(String college) {
    final next = [...picks];
    if (next.remove(college)) {
      setState(() => picks = next);
      return true;
    }
    if (next.length >= kMaxColleges) {
      widget.onRefused?.call();
      return false;
    }
    setState(() => picks = [...next, college]);
    return true;
  }

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            LadderCount(picked: picks.length),
            CollegeLadder(course: _course, category: 'UR', picks: picks, onToggle: toggle, query: widget.query),
          ],
        ),
      );
}

Future<void> _show(WidgetTester tester, Widget host) async {
  await pumpMockmob(tester, host, brightness: Brightness.dark, size: const Size(390, 3200), disableAnimations: true);
}

Future<void> _tap(WidgetTester tester, String college) async {
  await tester.tap(find.text(displayCollege(college)).first);
  await tester.pump(const Duration(milliseconds: 400));
}

void main() {
  setUpAll(loadAppFonts);

  group('the sheet holds up to eight colleges', () {
    test('the limit is the My colleges limit', () {
      expect(kMaxColleges, 8);
      expect(kMaxColleges, MyColleges.maxColleges);
    });

    test('a sheet stored with three reads the same, one with more is cut at eight, and a repeat is dropped', () {
      final three = OnboardingAnswers.fromJson({
        'v': 1,
        'colleges': ['Hindu College', 'Hansraj College', 'Ramjas College'],
      });
      expect(three.colleges, ['Hindu College', 'Hansraj College', 'Ramjas College']);
      final many = OnboardingAnswers.fromJson({
        'v': 1,
        'colleges': [for (var i = 0; i < 12; i++) 'College $i'],
      });
      expect(many.colleges, [for (var i = 0; i < 8; i++) 'College $i']);
      final twice = OnboardingAnswers.fromJson({
        'v': 1,
        'colleges': ['Hindu College', 'Hindu College', 'Hansraj College'],
      });
      expect(twice.colleges, ['Hindu College', 'Hansraj College']);
    });

    test('the deck says it is version 2 and still has the nine steps in order', () {
      expect(kOnboardingDeck.version, 2);
      expect([for (final s in kOnboardingDeck.steps) s.id], [
        Steps.stage,
        Steps.course,
        Steps.subjects,
        Steps.worry,
        Steps.question,
        Steps.rhythm,
        Steps.plan,
        Steps.save,
        Steps.firstMove,
      ]);
    });

    test('the controller takes eight picks, refuses the ninth, and makes room when one is dropped', () async {
      final c = ProviderContainer(overrides: [answersStoreProvider.overrideWithValue(AnswersStore(MemoryPrefsStore()))]);
      addTearDown(c.dispose);
      await c.read(onboardingAnswersProvider.future);
      final controller = c.read(onboardingAnswersProvider.notifier)..setCourse(_course.id);
      final names = _names;
      for (final name in names.take(8)) {
        expect(controller.toggleCollege(name), isTrue, reason: name);
      }
      expect(c.read(onboardingAnswersProvider).value!.colleges, names.take(8));
      expect(controller.toggleCollege(names[8]), isFalse, reason: 'the ninth is refused');
      expect(c.read(onboardingAnswersProvider).value!.colleges, hasLength(8));
      expect(controller.toggleCollege(names[0]), isTrue, reason: 'dropping one is always allowed');
      expect(controller.toggleCollege(names[8]), isTrue, reason: 'and makes room for another');
      expect(c.read(onboardingAnswersProvider).value!.colleges.last, names[8], reason: 'the order picked is kept');
    });
  });

  group('what the sheet says about the colleges', () {
    test('the eligibility line counts the real subjects and colleges', () {
      expect(PlanSummary.eligibilityLine(_with(const [])), 'This set keeps B.Com (Hons) open.');
      expect(PlanSummary.eligibilityLine(_with(_names.take(1).toList())), 'Your 4 subjects open B.Com (Hons) at your college.');
      expect(PlanSummary.eligibilityLine(_with(_names.take(2).toList())), 'Your 4 subjects open B.Com (Hons) at both your colleges.');
      expect(PlanSummary.eligibilityLine(_with(_names.take(3).toList())), 'Your 4 subjects open B.Com (Hons) at all 3 of your colleges.');
      expect(PlanSummary.eligibilityLine(_with(_names.take(8).toList())), 'Your 4 subjects open B.Com (Hons) at all 8 of your colleges.');
    });

    test('the plan names the first three and counts the rest', () {
      final line = PlanSummary.aimLine(_with(_names.take(8).toList()))!;
      expect(line, startsWith('Aim: SRCC 924.3, Hindu 919.9, LSR 912.5 and 5 more.'));
      expect(PlanSummary.aimLine(_with(_names.take(2).toList())), startsWith('Aim: SRCC 924.3, Hindu 919.9.'));
    });

    test('the sheet line stays one line at eight picks', () {
      final lines = sheetLines(_with(_names.take(8).toList()));
      expect(lines.single, 'B.Com (Hons): SRCC, Hindu, LSR and 5 more');
    });
  });

  group('the ladder', () {
    testWidgets('only the first three picks say they show on Today, and each pick carries its number', (tester) async {
      await _show(tester, _Host(initial: _names.take(5).toList()));
      expect(find.text(OnboardingCopy.onToday), findsNWidgets(3));
      for (var n = 1; n <= 4; n++) {
        expect(find.text('$n'), findsOneWidget, reason: 'pick $n');
      }
      expect(find.text('5'), findsNWidgets(2), reason: 'the fifth pick and the count');
      expect(find.textContaining('of 8 picked'), findsOneWidget);
      expect(find.textContaining(OnboardingCopy.pickedTail), findsOneWidget);
    });

    testWidgets('with no pick the count has no second half', (tester) async {
      await _show(tester, const _Host());
      expect(find.textContaining('of 8 picked'), findsOneWidget);
      expect(find.textContaining(OnboardingCopy.pickedTail), findsNothing);
      expect(find.text(OnboardingCopy.onToday), findsNothing);
    });

    testWidgets('eight is the most: the ninth is refused with a line, and dropping one clears it', (tester) async {
      var refused = 0;
      await _show(tester, _Host(initial: _names.take(8).toList(), onRefused: () => refused++));
      expect(find.text(OnboardingCopy.eightIsMost), findsNothing);
      await tester.tap(find.text(OnboardingCopy.showAll(_course.ladder('UR').length)));
      await tester.pump(const Duration(milliseconds: 400));
      await _tap(tester, _names[8]);
      expect(refused, 1);
      expect(find.text(OnboardingCopy.eightIsMost), findsOneWidget);
      expect(find.text('9'), findsNothing);
      await _tap(tester, _names[0]);
      expect(find.text(OnboardingCopy.eightIsMost), findsNothing, reason: 'the line was about the refused tap');
    });

    testWidgets('a search narrows the ladder to the colleges it finds, and picks always stay in view', (tester) async {
      await _show(tester, _Host(initial: [_names.first], query: 'hans'));
      expect(find.text('Hansraj College'), findsOneWidget);
      expect(find.text(displayCollege(_names.first)), findsOneWidget, reason: 'a pick the search does not find is still shown');
      expect(find.text('Hindu College'), findsNothing);
      expect(find.text(OnboardingCopy.showAll(_course.ladder('UR').length)), findsNothing, reason: 'no Show all while searching');
    });

    testWidgets('a short name or a slip finds the college, and tapping the found row picks it', (tester) async {
      await _show(tester, const _Host(query: 'hansrj'));
      expect(find.text('Hansraj College'), findsOneWidget);
      await _tap(tester, 'Hansraj College');
      expect(find.text(OnboardingCopy.onToday), findsOneWidget);
      expect(find.text('1'), findsNWidgets(2), reason: 'the first pick and the count');
    });

    testWidgets('nothing found says so, in plain words', (tester) async {
      await _show(tester, const _Host(query: 'zzz'));
      expect(find.text(OnboardingCopy.noCollegeMatch('zzz')), findsOneWidget);
      expect(find.text('Hindu College'), findsNothing);
    });
  });

  group('copy', () {
    test('the Aim step has no filler or defensive line, and says what it means', () {
      expect(OnboardingCopy.ladderSupport, 'Lowest Round 1 score in 2026, out of 1000.');
      expect(OnboardingCopy.eightIsMost, '8 is the most. Drop one to add another.');
      expect(OnboardingCopy.notSureNote, 'You can pick one later in Colleges.');
      expect(OnboardingCopy.savedWhat, isNot(contains('stay on this phone')));
    });

    test('the sources of the onboarding, sign-in and account access carry none of the banned lines', () {
      final banned = RegExp(
        r'not affiliated|not a prediction|CSAS dashboard|stay on this phone for now|ad or analytics companies|(^|[ >"\x27])Fine\.',
        caseSensitive: false,
      );
      final roots = [Directory('lib/features/onboarding'), Directory('lib/features/auth'), Directory('lib/features/account_access')];
      final hits = <String>[];
      for (final root in roots) {
        for (final f in root.listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart'))) {
          final text = f.readAsStringSync();
          for (final m in banned.allMatches(text)) {
            hits.add('${f.path}: ${m.group(0)}');
          }
        }
      }
      expect(hits, isEmpty);
    });
  });
}

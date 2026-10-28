// Throwaway font audit for the device walk (16 Oct 2026). Report only: it renders, it scans, it
// asserts nothing. Run with MM_AUDIT_DIR set; see font_audit_support.dart.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockmob/core/api/api.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/connectivity/connectivity.dart';
import 'package:mockmob/core/mascot/mobi_ration.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/credits_repository.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/storage/app_prefs.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/core/storage/storage_providers.dart';
import 'package:mockmob/core/widgets/account/account_avatar.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/credits/data/credits_data.dart' show meCreditsProvider;
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/screens/onboarding_flow.dart';
import 'package:mockmob/features/practice/practice_routes.dart';
import 'package:mockmob/features/result/data/result_providers.dart';
import 'package:mockmob/features/result/model/recap_model.dart';
import 'package:mockmob/features/review/screens/review_screen.dart';
import 'package:mockmob/features/runner/runner_routes.dart' show ntaInstructionsScreen;
import 'package:mockmob/features/today/logic/today_builder.dart';
import 'package:mockmob/features/today/logic/today_inputs.dart';
import 'package:mockmob/features/today/logic/today_model.dart';
import 'package:mockmob/features/today/logic/why_model.dart';
import 'package:mockmob/features/today/screens/alternatives_sheet.dart';
import 'package:mockmob/features/today/screens/today_body.dart';
import 'package:mockmob/features/today/screens/why_sheet.dart';
import 'package:mockmob/features/tools/colleges/colleges_screen.dart';
import 'package:mockmob/features/tools/compass/compass_screen.dart';
import 'package:mockmob/features/tools/hub/tools_hub_screen.dart';
import 'package:mockmob/features/tools/my_colleges/my_colleges_parts.dart' show MyCollegesSection;
import 'package:mockmob/features/tools/my_colleges/my_colleges_sheet.dart';
import 'package:mockmob/features/you/you_hub_screen.dart';
import 'package:mockmob/core/theme/theme.dart';

import '../../helpers/golden_harness.dart';
import '../../unit/core_data/support/fixtures.dart' as cd;
import '../../unit/practice/support/harness.dart' as ph;
import '../../unit/result/support/fixtures.dart' as rf;
import '../../unit/result/support/harness.dart' as rh;
import '../../unit/review/support/review_fixtures.dart' as rvf;
import '../../unit/today/support/today_fixtures.dart' as tf;
import '../../unit/tools/my_colleges_support.dart' as mcs;
import '../../unit/tools/tools_test_support.dart' as tt;
import '../../unit/you/you_test_support.dart' as yt;
import '../onboarding/support.dart' as ob;
import '../review/review_golden_support.dart' as rv;
import '../today/today_golden_support.dart' as td;
import 'font_audit_support.dart';

/// Plain pump through the app theme (no router): the screen, its overrides, the frame.
Future<void> _plain(
  WidgetTester t,
  Widget child,
  Brightness b,
  double s,
  Size size,
  List<Override> overrides, {
  bool scaffold = false,
}) =>
    pumpMockmob(t, child, brightness: b, size: size, textScale: s, disableAnimations: true, overrides: overrides, wrapInScaffold: scaffold);

Future<void> _settle(WidgetTester t, {int frames = 8, int ms = 150}) async {
  for (var i = 0; i < frames; i++) {
    await t.pump(Duration(milliseconds: ms));
  }
  await settleImages(t);
}

// ------------------------------------------------------------------ Today

Widget _today(TodayInputs inputs) => td.PhoneFrame(
      child: TodayBody(view: buildToday(inputs), callbacks: td.noopCallbacks, skeletonDelay: Duration.zero),
    );

Widget _todaySheet(Widget body) => Builder(
      builder: (context) => td.PhoneFrame(
        dock: false,
        child: Stack(
          children: [
            Positioned.fill(child: TodayBody(view: buildToday(tf.ashaInputs()), callbacks: td.noopCallbacks)),
            Positioned.fill(child: ColoredBox(color: context.mmColors.scrim)),
            Align(
              alignment: Alignment.bottomCenter,
              child: MmSheetGlass(child: MmSheetScaffold(child: body)),
            ),
          ],
        ),
      ),
    );

void _todayCases() {
  audit('today', (t, b, s, z) async {
    StudyWeekLegendMemory.session.markSeen();
    await _plain(t, _today(tf.ashaInputs()), b, s, z, td.todayOverrides);
    await _settle(t);
  }, tall: true);
  audit('today_resume', (t, b, s, z) async {
    StudyWeekLegendMemory.session.markSeen();
    final now = tf.tuesdayEvening;
    await _plain(
      t,
      _today(tf.ashaInputs(
        draft: TodayDraft(
          sessionId: 's8',
          subject: 'accountancy',
          isMock: true,
          mockNumber: 8,
          total: 50,
          answered: 23,
          acknowledgedAnswered: 21,
          endsAt: now.add(const Duration(minutes: 34)),
          lastAckAt: now.subtract(const Duration(minutes: 3)),
          resumable: true,
        ),
      )),
      b, s, z, td.todayOverrides,
    );
    await _settle(t);
  });
  audit('today_sealed', (t, b, s, z) async {
    StudyWeekLegendMemory.session.markSeen();
    await _plain(t, _today(tf.ashaInputs(unopened: [(attemptId: 'm7', receivedAt: tf.tuesdayEvening.subtract(const Duration(minutes: 20)))])), b, s, z, td.todayOverrides);
    await _settle(t);
  });
  audit('today_offline', (t, b, s, z) async {
    StudyWeekLegendMemory.session.markSeen();
    await _plain(t, _today(tf.ashaInputs(offline: true)), b, s, z, td.todayOverrides);
    await _settle(t);
  });
  audit('today_late_night', (t, b, s, z) async {
    StudyWeekLegendMemory.session.markSeen();
    await _plain(t, _today(tf.ashaInputs(now: tf.tuesdayLate)), b, s, z, td.todayOverrides);
    await _settle(t);
  });
  audit('today_error', (t, b, s, z) async {
    StudyWeekLegendMemory.session.markSeen();
    await _plain(t, _today(TodayInputs(now: tf.tuesdayEvening, firstName: 'Asha', attemptsFailed: true, week: tf.tuesdayWeek)), b, s, z, td.todayOverrides);
    await _settle(t);
  });
  audit('today_why_sheet', (t, b, s, z) async {
    StudyWeekLegendMemory.session.markSeen();
    await _plain(
      t,
      _todaySheet(WhySheetBody(model: buildWhy(tf.ashaRecord(tf.tuesdayEvening), 'm7', toDate: tf.ashaInputs().date), onSeeAnswers: () {})),
      b, s, z, td.todayOverrides,
    );
    await _settle(t);
  });
  audit('today_alternatives_sheet', (t, b, s, z) async {
    StudyWeekLegendMemory.session.markSeen();
    await _plain(
      t,
      _todaySheet(AlternativesSheetBody(rows: alternativeRows(subject: 'accountancy'), onRow: (_) {}, onNotToday: () {}, animateIn: false)),
      b, s, z, td.todayOverrides,
    );
    await _settle(t);
  });
}

// --------------------------------------------------------------- Practice

final DateTime _evening = DateTime(2026, 10, 12, 20, 10);

List<GoRoute> _practiceRoutes() => [
      GoRoute(path: '/practice', builder: (c, s) => practiceScreen(c, s)),
      GoRoute(path: '/practice/setup/:mode', builder: (c, s) => practiceSetupScreen(c, s)),
      GoRoute(path: '/practice/start', builder: (c, s) => practiceStartScreen(c, s)),
      GoRoute(path: '/practice/result/:attemptId', builder: (c, s) => practiceResultScreen(c, s)),
      GoRoute(path: '/exam/nta', builder: (c, s) => ntaInstructionsScreen(c, s)),
      ph.stubRoute('/run/:sessionId'),
      ph.stubRoute('/today'),
    ];

ph.FakeQuoteRepository _tabQuotes() => ph.FakeQuoteRepository((s, m, c, p) {
      if (m == 'full') return ph.creditsQuote(cost: 50, balance: 120, mode: 'full', count: 50);
      if (m == 'nta') return ph.proGate();
      return ph.dailyFree(count: c ?? 10);
    });

Attempt _mock() => cd.attemptOf(
      id: 'm7',
      completedAt: _evening.subtract(const Duration(days: 1)).millisecondsSinceEpoch,
      questions: [
        ...cd.chapterOf('Admission of a partner', right: 2, wrong: 3, blank: 1),
        ...cd.chapterOf('Goodwill', right: 5, wrong: 1),
        ...cd.chapterOf('Issue of shares', right: 6),
      ],
    );

final _mixed = [
  for (var i = 0; i < 7; i++) ('Admission of a partner', cd.V.right),
  ('Admission of a partner', cd.V.wrong),
  ('Goodwill', cd.V.wrong),
  ('Admission of a partner', cd.V.blank),
];

AttemptDetail _detail(List<(String, cd.V)> questions) => AttemptDetail.fromJson({
      ...cd.attemptJson(id: 'p1', mode: 'quick', subject: 'accountancy', questions: questions),
      'answerReviews': <String, dynamic>{},
      'answerReviewState': 'ready',
    });

Future<void> _routed(WidgetTester t, String loc, Brightness b, double s, Size z, List<Override> o) async {
  await ph.pumpRouted(t, location: loc, routes: _practiceRoutes(), brightness: b, size: z, overrides: o, textScale: s);
  await _settle(t, frames: 6, ms: 150);
}

Future<void> _openMode(WidgetTester t, String label) async {
  await t.scrollUntilVisible(find.text(label), 200, scrollable: find.byType(Scrollable).first);
  await t.pump();
  await t.tap(find.text(label).first);
  await _settle(t, frames: 6, ms: 150);
}

void _practiceCases() {
  audit('practice_tab', (t, b, s, z) async {
    await _routed(t, '/practice', b, s, z, ph.practiceOverrides(quotes: _tabQuotes(), attempts: [_mock()], now: _evening));
  }, tall: true);
  audit('practice_tab_new', (t, b, s, z) async {
    await _routed(t, '/practice', b, s, z, ph.practiceOverrides(quotes: _tabQuotes(), attempts: const [], now: _evening));
  });
  audit('practice_tab_resume', (t, b, s, z) async {
    final endsAt = ph.testNow.add(const Duration(minutes: 47)).millisecondsSinceEpoch;
    final draft = cd.draftOf(sessionId: 'sess-7', count: 50, mode: 'full', endsAtWallMs: endsAt, mockNumber: 7, subject: 'economics');
    await _routed(t, '/practice', b, s, z, ph.practiceOverrides(quotes: _tabQuotes(), draft: draft, answered: 23));
  });
  audit('practice_tab_offline', (t, b, s, z) async {
    await _routed(
      t, '/practice', b, s, z,
      ph.practiceOverrides(quotes: _tabQuotes(), attempts: const [], network: NetworkStatus.offline, now: _evening, auth: ph.signedIn(subjects: const ['english', 'accountancy'])),
    );
  });
  audit('start_sheet_quick', (t, b, s, z) async {
    await _routed(t, '/practice', b, s, z, ph.practiceOverrides(quotes: _tabQuotes(), attempts: const [], now: _evening));
    await _openMode(t, 'Quick practice');
  });
  audit('start_sheet_full_mock', (t, b, s, z) async {
    await _routed(t, '/practice', b, s, z, ph.practiceOverrides(quotes: _tabQuotes(), attempts: const [], now: _evening));
    await _openMode(t, 'Full mock');
  });
  audit('start_sheet_chapter_credits', (t, b, s, z) async {
    final quotes = ph.FakeQuoteRepository((sub, m, c, p) => ph.creditsQuote(cost: 10, balance: 90, count: c ?? 10));
    await _routed(t, '/practice', b, s, z, ph.practiceOverrides(quotes: quotes, attempts: [_mock()], now: _evening));
    await _openMode(t, 'Start 10 questions');
  });
  audit('start_sheet_long_subject', (t, b, s, z) async {
    await _routed(t, '/practice/setup/quick?subject=political_science&count=20', b, s, z, ph.practiceOverrides(quotes: _tabQuotes(), attempts: const [], now: _evening));
  });
  audit('start_sheet_credits_low', (t, b, s, z) async {
    final quotes = ph.FakeQuoteRepository((sub, m, c, p) => c == 10 ? ph.dailyFree() : ph.lowCredits());
    await _routed(t, '/practice/setup/quick?subject=accountancy&count=15', b, s, z, ph.practiceOverrides(quotes: quotes));
  });
  audit('practice_result_mixed', (t, b, s, z) async {
    await _routed(t, '/practice/result/p1', b, s, z, ph.resultOverrides(attemptId: 'p1', detail: _detail(_mixed), chapter: 'Admission of a partner'));
    for (var i = 0; i < 12; i++) {
      await t.pump(const Duration(milliseconds: 250));
    }
  });
}

// ----------------------------------------------------------------- Review

void _reviewCases() {
  audit('review_tab', (t, b, s, z) async {
    await _plain(t, const ReviewScreen(), b, s, z, rv.reviewOverrides(records: [rvf.repairedRecord]));
    await _settle(t);
  }, tall: true);
  audit('review_history', (t, b, s, z) async {
    await _plain(t, const ReviewScreen(), b, s, z, rv.reviewOverrides(records: [rvf.repairedRecord]));
    await _settle(t);
    await t.tap(find.text('History'));
    await _settle(t);
  });
  audit('review_empty', (t, b, s, z) async {
    await _plain(t, const ReviewScreen(), b, s, z, rv.reviewOverrides(attempts: const []));
    await _settle(t);
  });
}

// ----------------------------------------------------------------- Result

RecapData _recap(RecapModel m) {
  final det = rf.detail();
  return RecapData(model: m, attempt: det.attempt, detail: det, fetchedAt: DateTime(2026, 10, 12, 22, 44));
}

Future<void> _result(WidgetTester t, String loc, Brightness b, double s, Size z) async {
  final m = rf.mock7();
  await rh.pumpResultRoute(
    t,
    location: loc,
    brightness: b,
    size: z,
    textScale: s,
    overrides: rh.resultOverrides(attemptId: m.attemptId, data: _recap(m), ritual: const RecapRitual(sheetsOpened: 1)),
  );
  await settleImages(t);
  await t.pump();
  for (var i = 0; i < 150; i++) {
    await t.pump(const Duration(milliseconds: 16));
  }
  await settleImages(t);
}

void _resultCases() {
  audit('result_sealed', (t, b, s, z) => _result(t, '/result/a7/sealed', b, s, z));
  for (final n in [1, 2, 3, 4]) {
    audit('result_card$n', (t, b, s, z) => _result(t, '/result/a7/recap/$n', b, s, z));
  }
}

// -------------------------------------------------------------------- You

void _youCases() {
  audit('you_hub', (t, b, s, z) async {
    await _plain(t, const YouHubScreen(), b, s, z, yt.youOverrides(target: yt.ashaTarget, rhythm: yt.FakeRhythm(yt.rhythmState(milestones: yt.earnedMilestones))));
    await t.pumpAndSettle();
  }, tall: true, tallSize: const Size(360, 4200));
  audit('avatar_sheet', (t, b, s, z) async {
    await _plain(
      t,
      const SafeArea(child: Padding(padding: EdgeInsets.fromLTRB(16, 8, 16, 0), child: TabRootHeader(title: 'Practice'))),
      b, s, z,
      [
        authSnapshotProvider.overrideWithBuild(
          (ref, n) => const AuthSnapshot(status: AuthStatus.signedIn, userId: 'u1', name: 'Asha Verma', email: 'asha.verma@gmail.com', creditBalance: 24),
        ),
        creditsRepositoryProvider.overrideWithBuild((ref, n) => const RemoteState<AiCredits>()),
        meCreditsProvider.overrideWith(() => yt.FakeMeCredits(yt.creditsState(practice: 24, ai: 18))),
        appPrefsProvider.overrideWithValue(AppPrefs(MemoryPrefsStore())),
      ],
    );
    await t.tap(find.byType(AccountAvatarButton));
    for (var i = 0; i < 12; i++) {
      await t.pump(const Duration(milliseconds: 60));
    }
    await settleImages(t);
  }, tall: true);
}

// ------------------------------------------------------- Compass, colleges

final _four = [
  mcs.mc('b-com-hons', 'Shri Ram College of Commerce', 'B.Com. (Hons.)'),
  mcs.mc('b-com-hons', 'Hindu College', 'B.Com. (Hons.)'),
  mcs.mc('b-a-hons-economics', 'Hansraj College', 'B.A. (Hons.) Economics'),
  mcs.mc('b-com-hons', 'Deshbandhu College', 'B.Com. (Hons.)'),
];

Widget _opener(bool adding) => Builder(
      builder: (context) => Scaffold(body: Center(child: TextButton(onPressed: () => showMyCollegesSheet(context, adding: adding), child: const Text('open')))),
    );

Future<void> _dataSettle(WidgetTester t) async {
  for (var i = 0; i < 3; i++) {
    await t.pumpAndSettle();
    await t.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 60)));
  }
  await t.pumpAndSettle();
}

void _toolsCases() {
  audit('tools_hub', (t, b, s, z) async {
    await _plain(t, const ToolsHubScreen(), b, s, z, tt.toolsOverrides());
    await _dataSettle(t);
  });
  audit('compass', (t, b, s, z) async {
    await _plain(t, const CompassScreen(), b, s, z, tt.toolsOverrides());
    await _dataSettle(t);
  }, tall: true, tallSize: const Size(360, 3400));
  audit('compass_score', (t, b, s, z) async {
    await _plain(
      t, const CompassScreen(), b, s, z,
      tt.toolsOverrides(prefs: tt.savedCompass('english,accountancy,business_studies,economics', category: 'OBC-NCL', score: '650')),
    );
    await _dataSettle(t);
  }, tall: true, tallSize: const Size(360, 3400));
  audit('compass_subject_picker', (t, b, s, z) async {
    await _plain(t, const CompassScreen(), b, s, z, tt.toolsOverrides());
    await _dataSettle(t);
    await t.tap(find.text('Edit subjects').first);
    await _dataSettle(t);
  });
  audit('my_colleges_section', (t, b, s, z) async {
    await _plain(
      t,
      const Scaffold(body: SafeArea(child: SingleChildScrollView(child: MyCollegesSection()))),
      b, s, z,
      tt.toolsOverrides(myColleges: mcs.FakeMyColleges(start: _four)),
    );
    await _dataSettle(t);
  });
  audit('my_colleges_sheet', (t, b, s, z) async {
    await _plain(t, _opener(false), b, s, z, tt.toolsOverrides(myColleges: mcs.FakeMyColleges(start: _four)));
    await t.tap(find.text('open'));
    await _dataSettle(t);
  });
  audit('my_colleges_chooser', (t, b, s, z) async {
    await _plain(t, _opener(true), b, s, z, tt.toolsOverrides(myColleges: mcs.FakeMyColleges(start: _four)));
    await t.tap(find.text('open'));
    await _dataSettle(t);
  });
  audit('colleges_tab', (t, b, s, z) async {
    await _plain(
      t, const CollegesScreen(), b, s, z,
      tt.toolsOverrides(myColleges: mcs.FakeMyColleges(start: _four), prefs: tt.savedCompass('english,accountancy,business_studies,economics', score: '640')),
    );
    await _dataSettle(t);
  }, tall: true, tallSize: const Size(360, 3000));
  audit('colleges_tab_empty', (t, b, s, z) async {
    await _plain(t, const CollegesScreen(), b, s, z, tt.toolsOverrides(myColleges: mcs.FakeMyColleges()));
    await _dataSettle(t);
  });
}

// ------------------------------------------------------------- Onboarding

Future<void> _onboarding(WidgetTester t, Brightness b, double s, Size z, Widget flow, List<Override> o, {Future<void> Function(WidgetTester)? act}) async {
  MobiRation.reset();
  addTearDown(MobiRation.reset);
  t.view.padding = const FakeViewPadding(top: 56, bottom: 40);
  addTearDown(t.view.resetPadding);
  await pumpMockmob(
    t,
    Builder(builder: (context) => ColoredBox(color: context.mmColors.ground, child: flow)),
    brightness: b,
    size: z,
    textScale: s,
    disableAnimations: true,
    overrides: o,
  );
  if (act != null) {
    await act(t);
    await settleImages(t);
  }
}

void _onboardingCases() {
  const flow = OnboardingFlow(skipColdOpen: true, startInDeck: true);
  void step(String id, List<Override> Function() o, {Future<void> Function(WidgetTester)? act, bool tall = false}) {
    audit('onb_$id', (t, b, s, z) => _onboarding(t, b, s, z, flow, o(), act: act), tall: tall);
  }

  audit('onb_welcome', (t, b, s, z) => _onboarding(t, b, s, z, const OnboardingFlow(skipColdOpen: true), ob.onboardingOverrides()));
  step('stage', () => ob.onboardingOverrides(answers: const OnboardingAnswers(step: Steps.stage)));
  step('stage_class12', () => ob.onboardingOverrides(answers: ob.studentUpTo(Steps.stage)));
  step('course_grid', () => ob.onboardingOverrides(answers: ob.studentUpTo(Steps.stage, step: Steps.course)));
  step('course_ladder', () => ob.onboardingOverrides(answers: ob.studentUpTo(Steps.course)), tall: true);
  step('subjects', () => ob.onboardingOverrides(answers: ob.studentUpTo(Steps.subjects)), tall: true);
  step('subjects_picker', () => ob.onboardingOverrides(answers: ob.studentUpTo(Steps.subjects)), act: (t) async {
    final add = find.text(OnboardingCopy.addSubject).first;
    await t.ensureVisible(add);
    await t.pump();
    await t.tap(add);
    await t.pumpAndSettle();
  });
  step('worry', () => ob.onboardingOverrides(answers: ob.studentUpTo(Steps.worry)));
  step('question_open', () => ob.onboardingOverrides(answers: ob.studentUpTo(Steps.worry, step: Steps.question)), tall: true);
  step('question_wrong', () => ob.onboardingOverrides(answers: ob.studentUpTo(Steps.question).copyWith(warmup: const WarmupResult(questionId: 'acc-1', chosen: 1, correct: false, millis: 52000))));
  step('rhythm', () => ob.onboardingOverrides(answers: ob.studentUpTo(Steps.rhythm)));
  step('plan', () => ob.onboardingOverrides(answers: ob.studentUpTo(Steps.rhythm, step: Steps.plan)));
  step('plan_sealed', () => ob.onboardingOverrides(answers: ob.studentUpTo(Steps.plan)), tall: true);
  step('save', () => ob.onboardingOverrides(answers: ob.studentUpTo(Steps.plan, step: Steps.save).copyWith(age: AgeAnswer.adult)));
  step('first_move', () => ob.onboardingOverrides(answers: ob.studentUpTo(Steps.plan, step: Steps.firstMove).copyWith(age: AgeAnswer.minor, notNow: true)), tall: true);
}

void main() {
  auditSetUp();
  _todayCases();
  _practiceCases();
  _reviewCases();
  _resultCases();
  _youCases();
  _toolsCases();
  _onboardingCases();
}

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/question.dart';
import 'package:mockmob/core/sync/session/session_engine.dart' show AwayInfo;
import 'package:mockmob/features/runner/widgets/runner_meta_row.dart';
import 'package:mockmob/features/runner/widgets/runner_top_bar.dart';
import 'package:mockmob/features/runner/widgets/timing_track.dart';

import '../../helpers/fonts.dart';
import 'support/fake_session.dart';
import 'support/harness.dart';

/// The line under the runner's top bar (walk-through round 3, P3-3): a long chapter name used to
/// be cut to "Business Studies, Princi..." beside the "Open until" chip at normal text size. The time
/// now lives in the top bar, so the subject has the whole line.
void main() {
  setUpAll(loadAppFonts);

  const longChapter = 'Nature and significance of management';

  /// Ten questions that all carry [chapter], in a practice with one answer given.
  FakeRunnerSession practice(String chapter, {String subject = 'business_studies'}) => FakeRunnerSession(
    questions: [
      for (final q in accountancyQuestions(10))
        SessionQuestion(id: q.id, subject: subject, chapter: chapter, question: q.question, options: q.options, difficulty: q.difficulty),
    ],
    mode: 'quick',
    subject: subject,
    mockNumber: null,
    answers: {'q1': 0},
  );

  /// The subject and chapter text of the meta line.
  RenderParagraph subjectParagraph(WidgetTester tester, String chapter) => tester.renderObject<RenderParagraph>(
    find.descendant(
      of: find.byType(RunnerMetaRow),
      matching: find.byWidgetPredicate((w) => w is RichText && w.text.toPlainText().contains(chapter)),
    ),
  );

  testWidgets('a long chapter name is read in full, in two lines at most', (tester) async {
    await pumpRunner(tester, session: practice(longChapter));
    await settle(tester);

    final paragraph = subjectParagraph(tester, longChapter);
    expect(paragraph.didExceedMaxLines, isFalse, reason: 'nothing is cut with an ellipsis');
    expect(paragraph.size.height, lessThanOrEqualTo(2 * 18 + 1), reason: 'at most two caption lines');
    // The time a practice is open until sits in the top bar, where a mock has its clock: it is
    // not on this line, so it can never touch the subject.
    expect(find.descendant(of: find.byType(RunnerMetaRow), matching: find.textContaining('Open until')), findsNothing);
    expect(find.descendant(of: find.byType(RunnerTopBar), matching: find.text('11:42 PM')), findsOneWidget);
    expect(find.descendant(of: find.byType(RunnerTopBar), matching: find.text('Open until')), findsOneWidget);
  });

  for (final scale in [1.0, 1.3]) {
    testWidgets('the line is the same height for a short name and a long one at ${scale}x text', (tester) async {
      await pumpRunner(tester, session: practice('Goodwill'), textScale: scale);
      await settle(tester);
      final short = tester.getSize(find.byType(RunnerMetaRow)).height;

      await tester.pumpWidget(const SizedBox()); // a fresh runner, not the one above
      await pumpRunner(tester, session: practice(longChapter), textScale: scale);
      await settle(tester);
      final long = tester.getSize(find.byType(RunnerMetaRow)).height;

      expect(long, short, reason: 'the lines are reserved, so nothing under the line moves');
      expect(subjectParagraph(tester, longChapter).didExceedMaxLines, isFalse, reason: 'the long name fits at ${scale}x');
      expect(find.text('11:42 PM'), findsOneWidget);
      if (scale == 1.0) expect(short, RunnerMetaRow.height);
    });
  }

  testWidgets('the return notice takes the subject place on the line and a tap sends it away', (tester) async {
    final s = practice('Goodwill');
    await pumpRunner(tester, session: s);
    await settle(tester);
    final before = tester.getSize(find.byType(RunnerMetaRow)).height;

    s.away.value = const AwayInfo(duration: Duration(minutes: 2, seconds: 10), allSaved: true, unsyncedAnswers: 0);
    await tester.pump();
    expect(find.text('Away for 2 minutes 10 seconds. Timer kept running. Answers saved.'), findsOneWidget);
    expect(tester.getSize(find.byType(RunnerMetaRow)).height, before, reason: 'nothing below the line moves');

    // Not a layer over the line: it is the line's own text, so it cannot cover the track.
    final notice = tester.getRect(find.text('Away for 2 minutes 10 seconds. Timer kept running. Answers saved.'));
    final track = tester.getRect(find.byType(TimingTrack));
    expect(notice.bottom, lessThanOrEqualTo(track.top + 0.5), reason: 'the notice ends where the track starts');

    await tester.tapAt(const Offset(180, 400));
    await tester.pump();
    expect(find.textContaining('Away for'), findsNothing);
  });
}

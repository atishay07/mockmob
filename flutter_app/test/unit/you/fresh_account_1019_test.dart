// The fresh-account walk of 19 Oct (tmp/walk-1019/BASELINE-FINDINGS.md, A1 items 4, 5 and 7):
//  4. a fresh account's name is its email prefix ("g16-fresh-1019a"): You, Ask Mobi and the Mob never
//     show it; You asks for a name where the name would stand, and the Mob's name field starts empty;
//  5. a 3-answer paper at 2:46 AM on a Monday left "0 of 4 study days" with no reason: the server
//     counts a paper from 5 answers (rhythm.js), and You and Today now say so;
//  7. the Mob says "sit this week's paper with you", not "start your ring", and names the subject
//     plainly ("Accountancy", not "Accountancy / Book-Keeping").
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/auth/auth_state.dart';
import 'package:mockmob/core/auth/display_name.dart';
import 'package:mockmob/core/domain/study_day.dart';
import 'package:mockmob/core/models/attempt.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/social/copy.dart';
import 'package:mockmob/features/social/data/mob_models.dart';
import 'package:mockmob/features/today/copy.dart';
import 'package:mockmob/features/you/copy.dart';
import 'package:mockmob/features/you/you_hub_screen.dart';

import '../../helpers/golden_harness.dart';
import '../core_data/support/fixtures.dart';
import 'you_test_support.dart';

const _fresh = AuthSnapshot(
  status: AuthStatus.signedIn,
  userId: 'u1',
  email: 'g16-fresh-1019a@example.com',
  name: 'g16-fresh-1019a',
  subjects: ['accountancy', 'business_studies', 'economics', 'english'],
);

/// 2:51 AM IST on Monday 19 October 2026, and the paper finished five minutes before.
final _now = DateTime.utc(2026, 10, 18, 21, 21);
final _paperAt = DateTime.utc(2026, 10, 18, 21, 16).millisecondsSinceEpoch;

Attempt _paper({required int right, required int wrong, int blank = 0, int? at}) => attemptOf(
  id: 'p$right$wrong',
  mode: 'quick',
  completedAt: at ?? _paperAt,
  questions: chapterOf('Partnership Fundamentals', right: right, wrong: wrong, blank: blank),
);

void main() {
  group('4. the name a fresh account starts with is never shown', () {
    test('shownName: the email prefix and handles are not names; a real name is', () {
      expect(shownName('g16-fresh-1019a', email: 'g16-fresh-1019a@example.com'), isNull);
      expect(shownName('freshstudent', email: 'freshstudent@example.com'), isNull, reason: 'the email prefix, even with letters only');
      expect(shownName('app-e2e-student'), isNull);
      expect(shownName('asha_v'), isNull);
      expect(shownName('  '), isNull);
      expect(shownName('Asha Verma', email: 'asha.verma@example.com'), 'Asha Verma');
      expect(shownFirstName('Asha Verma'), 'Asha');
      expect(shownFirstName('g16-fresh-1019a', email: 'g16-fresh-1019a@example.com'), isNull);
    });

    test('the Mob name field starts empty instead of "Fresh"', () {
      expect(mobNameFrom('g16-fresh-1019a'), 'Fresh', reason: 'the old prefill, from the handle');
      expect(mobNameFrom(shownName(_fresh.name, email: _fresh.email)), '');
      expect(mobNameFrom(shownName('Asha Verma', email: 'asha.verma@example.com')), 'Asha');
    });

    testWidgets('You: "Add your name" where the name stands, never the email prefix', (tester) async {
      await pumpMockmob(tester, const YouHubScreen(), disableAnimations: true, wrapInScaffold: false, size: const Size(360, 2400), overrides: youOverrides(auth: _fresh));
      await tester.pump();
      expect(find.text(YouCopy.sheetNameAdd), findsOneWidget);
      expect(find.textContaining('g16-fresh'), findsNothing);
    });

    testWidgets('You with a real name shows it', (tester) async {
      await pumpMockmob(tester, const YouHubScreen(), disableAnimations: true, wrapInScaffold: false, size: const Size(360, 2400), overrides: youOverrides());
      await tester.pump();
      expect(find.text('Asha Verma'), findsOneWidget);
      expect(find.text(YouCopy.sheetNameAdd), findsNothing);
    });
  });

  group('5. a paper that did not count says why', () {
    test('the rule: today (IST) papers under 5 answers', () {
      expect(studyDayMinAnswered, 5, reason: 'rhythm.js MIN_ANSWERED');
      expect(shortPaperToday([_paper(right: 2, wrong: 1, blank: 7)], _now), 3, reason: '2:46 AM on Monday is Monday in IST');
      expect(shortPaperToday([_paper(right: 4, wrong: 1, blank: 5)], _now), isNull, reason: '5 answers count');
      expect(shortPaperToday([_paper(right: 2, wrong: 1), _paper(right: 5, wrong: 0)], _now), isNull, reason: 'one counting paper is enough');
      expect(shortPaperToday([_paper(right: 0, wrong: 0, blank: 10)], _now), 0);
      final sunday = DateTime.utc(2026, 10, 18, 18, 0).millisecondsSinceEpoch; // 11:30 PM IST Sunday
      expect(shortPaperToday([_paper(right: 1, wrong: 1, at: sunday)], _now), isNull, reason: 'yesterday is not today');
      expect(shortPaperToday(const [], _now), isNull);
    });

    test('the lines read as whole sentences', () {
      expect(YouCopy.shortPaperToday(3), "Today's paper had 3 answers, so today does not count yet. A paper counts once you answer 5 questions in it.");
      expect(YouCopy.shortPaperToday(1), contains('had 1 answer,'));
      expect(YouCopy.shortPaperToday(0), contains('had no answers'));
      expect(TodayCopy.shortPaperToday(3), "Today's paper had 3 answers. A paper counts once you answer 5 questions in it.");
      expect(YouCopy.studyDayDefinition, 'A study day is any day you answer at least 5 questions in a practice or a mock, or finish a repair.');
    });

    testWidgets('You after a 3-answer paper: the week says why it is still 0', (tester) async {
      await pumpMockmob(
        tester,
        const YouHubScreen(),
        disableAnimations: true,
        wrapInScaffold: false,
        size: const Size(360, 2400),
        overrides: youOverrides(
          auth: _fresh,
          now: _now,
          attempts: RemoteState(value: [_paper(right: 2, wrong: 1, blank: 7)]),
          rhythm: FakeRhythm(rhythmState(streak: 0, best: 0, studyDayDates: const [])),
        ),
      );
      await tester.pump();
      expect(find.text(YouCopy.shortPaperToday(3)), findsOneWidget);
      expect(find.text(YouCopy.studyDayDefinition), findsNothing, reason: 'the reason replaces the general rule');
    });
  });

  group('7. the Mob in plain words', () {
    test('the invite line and the subject', () {
      expect(MobCopy.aloneLead, "Invite a friend to sit this week's paper with you.");
      expect(mobSubjectName('Accountancy / Book-Keeping', 'accountancy'), 'Accountancy');
      expect(mobSubjectName('Business Studies', 'business_studies'), 'Business Studies');
      expect(mobSubjectName(null, 'business_studies'), 'Business Studies');
      expect(MobRef.fromJson({'id': 'm1', 'subject': 'accountancy', 'subjectName': 'Accountancy / Book-Keeping'}).subjectName, 'Accountancy');
    });
  });
}

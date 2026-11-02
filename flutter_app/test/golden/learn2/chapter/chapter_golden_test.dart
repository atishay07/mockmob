// The Learn v2 chapter page at 360 dp, Night and Day (APP-1101 7): 10 minutes on Pro, 20 minutes on Free (capped), a pile left
// out, the next chapter on offer and added, a run to pick up, Free's day used, the first visit of a new student, loading and
// an error. The numbers are the recordings of the web preview's real engine (test/fixtures/learn2).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart' show MmSheetGlass, MmSheetScaffold;
import 'package:mockmob/features/learn2/chapter/chapter_length.dart' show OwnLengthBody;
import 'package:mockmob/features/learn2/chapter/chapter_page.dart';
import 'package:mockmob/features/learn2/data/learn_models.dart';
import 'package:mockmob/features/pro_nudge/pro_nudge.dart' show proNudgesOnProvider;

import '../../../unit/learn2/chapter/chapter_test_support.dart';
import '../../../unit/learn2/support/fixture_learn_api.dart' show learnFixtureOverrides;
import '../../keycards/kc_golden_support.dart';

/// A preview that never answers (the skeleton).
class _NeverApi extends ChapterApi {
  @override
  Future<LearnPreview> preview({required String chapterKey, required int minutes, List<String> leaveOut = const [], bool addNext = false}) =>
      Completer<LearnPreview>().future;
}

void _golden(
  String name,
  ChapterApi Function() api, {
  String chapter = l2Pf,
  int? minutes,
  Size size = const Size(360, 800),
  double textScale = 1,
  bool nudges = false,
  Future<void> Function(WidgetTester tester)? after,
}) {
  kcGolden(
    name,
    () => textScale == 1
        ? ChapterPage(chapterKey: chapter, minutes: minutes)
        : Builder(
            builder: (context) => MediaQuery(
              data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
              child: ChapterPage(chapterKey: chapter, minutes: minutes),
            ),
          ),
    overrides: () => [...learnFixtureOverrides(api()), proNudgesOnProvider.overrideWithValue(nudges)],
    size: size,
    after: after,
  );
}

void _noResume(Object? key, Map<String, dynamic> body) => body['resume'] = null;

void main() {
  // The web's own shot (40-chapter-10min): Basic Concepts, Pro, 10 minutes, a first look at the page.
  _golden('chapter_10min_pro', ChapterApi.new);

  // Free asked for 20 minutes: composed at 10, and the one line says so (41-chapter-free-20-capped).
  _golden(
    'chapter_free_20_capped',
    () => ChapterApi(pro: false, edit: _noResume),
    chapter: l2Aop,
    minutes: 20,
  );

  // The same line with Pro on offer: a quiet "See Pro" under it.
  _golden('chapter_free_20_capped_see_pro', () => ChapterApi(pro: false, edit: _noResume), chapter: l2Aop, minutes: 20, nudges: true);

  // A pile left out (Questions): it dims and reads "Left out"; the others re-balance from the new answer.
  _golden(
    'chapter_pile_left_out',
    () => ChapterApi(pick: (k) => k.leaveOut.contains('questions') ? 'preview_aop_10_out_questions_pro' : 'preview_aop_10_pro', edit: _noResume),
    chapter: l2Aop,
    after: (tester) async {
      await tester.tap(pileFinder('questions'));
      await settleChapter(tester);
    },
  );

  // A short chapter at 20 minutes: "Add the next chapter" as a fourth paper, two by two.
  _golden('chapter_add_next', ChapterApi.new, chapter: l2Ccss, minutes: 20);

  // The next chapter added: "Chapter 13 added", "+11 min", "Tap to remove".
  _golden(
    'chapter_next_added',
    ChapterApi.new,
    chapter: l2Ccss,
    minutes: 20,
    after: (tester) async {
      await tester.tap(pileFinder('next'));
      await settleChapter(tester);
    },
  );

  // Today's unfinished run comes first (42-chapter-resume).
  _golden('chapter_resume', ChapterApi.new, chapter: l2Aop);

  // Free's day is used: the questions and the mistakes wait until tomorrow.
  _golden('chapter_free_used', () => ChapterApi(pro: false, freeUsed: true), chapter: l2Pf);

  // A wider phone (412 dp), and large text (1.3) on the narrow one.
  _golden('chapter_10min_pro_412', ChapterApi.new, size: const Size(412, 915));
  _golden('chapter_10min_pro_text13', ChapterApi.new, textScale: 1.3, size: const Size(360, 900));
  _golden('chapter_add_next_text13', ChapterApi.new, chapter: l2Ccss, minutes: 20, textScale: 1.3, size: const Size(360, 900));

  // A new student's first visit to a chapter.
  _golden('chapter_first_visit', () => ChapterApi(newStudent: true), chapter: l2Aop);

  // Before the first answer: the page in outline at its real sizes.
  _golden('chapter_loading', _NeverApi.new, chapter: l2Pf);

  // The read failed and there is nothing to show: Try again, and the shelf's rows still open.
  _golden('chapter_error', () => ChapterApi(error: true), chapter: l2Pf);

  // The phone is offline.
  _golden('chapter_offline', () => ChapterApi(offline: true), chapter: l2Pf);

  // "Your own": the sheet, over the page.
  kcGolden(
    'chapter_own_sheet',
    () => Material(
      type: MaterialType.transparency,
      child: Align(
        alignment: Alignment.bottomCenter,
        child: MmSheetGlass(child: MmSheetScaffold(title: 'Your own length', child: OwnLengthBody(minutes: 10, onChoose: (_) {}))),
      ),
    ),
    overrides: () => const [],
    size: const Size(360, 420),
  );

  // A chapter the book list does not hold.
  _golden('chapter_not_found', () => ChapterApi(notFound: true), chapter: l2Missing);
}

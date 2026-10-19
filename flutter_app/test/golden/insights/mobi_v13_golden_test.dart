// Mobi v13 (MOBI-CONTRACT, 20 Oct): Ask Mobi's record door leads with Where you stand (ready, partial, thin, and ready
// with no colleges), the Ask now door's starters come from the student's weak chapters, and a doubt's thread shows its
// 2 real CUET questions answered, then closes after its one follow-up. 360 and 412 dp, Night and Day.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/repair_check.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/mobi_api.dart';
import 'package:mockmob/features/insights/data/mobi_models.dart';
import 'package:mockmob/features/insights/screens/ask_screen.dart';

import 'insights_golden_support.dart';

MobiStanding _standing(Map<String, Object?> j) => MobiStanding.tryParse({'ok': true, ...j})!;

const _papers = [
  {'subject': 'english', 'name': 'English', 'low': 168, 'mid': 176, 'high': 184, 'open': 30},
  {'subject': 'accountancy', 'name': 'Accountancy', 'low': 138, 'mid': 150, 'high': 162, 'open': 61},
  {'subject': 'business_studies', 'name': 'Business Studies', 'low': 160, 'mid': 168, 'high': 176, 'open': 44},
  {'subject': 'economics', 'name': 'Economics', 'low': 146, 'mid': 154, 'high': 162, 'open': 52},
];

const _close = [
  {'subject': 'accountancy', 'subjectName': 'Accountancy', 'chapter': 'Partnership Fundamentals', 'marks': 38, 'wrong': 6, 'blank': 2},
  {'subject': 'economics', 'subjectName': 'Economics', 'chapter': 'Money and Banking', 'marks': 22, 'wrong': 4, 'blank': 1},
  {'subject': 'business_studies', 'subjectName': 'Business Studies', 'chapter': 'Principles of Management', 'marks': 14, 'wrong': 3, 'blank': 0},
];

const _hindu = {
  'college': 'Hindu College',
  'programme': 'B.Com (Hons)',
  'programmeId': 'du-hindu-bcom-h',
  'cutoff': 712,
  'category': 'UR',
  'position': 'below',
  'gap': 64,
};

final ready = _standing({
  'status': 'ready',
  'band': {'low': 612, 'mid': 648, 'high': 684, 'max': 1000, 'count': 4, 'complete': true, 'papers': _papers},
  'colleges': [_hindu],
  'first': _hindu,
  'gap': 64,
  'closeFastest': _close,
});

final noColleges = _standing({
  'status': 'ready',
  'band': {'low': 612, 'mid': 648, 'high': 684, 'max': 1000, 'count': 4, 'complete': true, 'papers': _papers},
  'colleges': <Object>[],
  'closeFastest': _close,
});

final partial = _standing({
  'status': 'partial',
  'band': {
    'low': 138,
    'mid': 150,
    'high': 162,
    'max': 250,
    'count': 1,
    'complete': false,
    'papers': [_papers[1]],
  },
  'needed': ['English', 'Business Studies', 'Economics'],
  'colleges': [_hindu],
  'closeFastest': [_close[0]],
});

final thin = _standing({
  'status': 'thin',
  'thin': [
    {'subject': 'accountancy', 'name': 'Accountancy', 'needed': 12},
    {'subject': 'economics', 'name': 'Economics', 'needed': 25},
  ],
});

CheckQuestion _q(String id, String stem, List<String> options, String chapter) => CheckQuestion(
      checkQuestionId: id,
      question: stem,
      chapter: chapter,
      options: [for (var i = 0; i < options.length; i++) CheckOption(index: i, text: options[i])],
    );

final _c1 = ThreadCheck(
  question: _q(
    'c1',
    'A and B share profits 3:2. C is admitted for a 1/5 share, taken from A and B equally. What is the new ratio?',
    ['11:7:5', '13:7:5', '12:8:5', '3:2:1'],
    'Partnership Fundamentals',
  ),
);
final _c2 = ThreadCheck(
  question: _q(
    'c2',
    'In the absence of a partnership deed, interest on a partner’s loan to the firm is allowed at',
    ['6% a year', '12% a year', 'The bank rate', 'Nothing, unless agreed'],
    'Partnership Fundamentals',
  ),
);

const _doubt = 'Explain Partnership Fundamentals the way CUET asks it.';
const _reply =
    'CUET asks Partnership Fundamentals in two ways: a ratio you have to rebuild, and a rule that applies only when there is no deed. '
    'For a ratio, write the old shares as fractions, take away what each partner gives up, and add the new partner. '
    'For the no-deed rules, remember the Act: no interest on capital, no salary, profits shared equally and 6% a year on a partner’s loan.';

AskState _thread({bool full = false}) => AskState(
      messages: [
        const AskMessage.student(_doubt),
        const AskMessage.reply(_reply, origin: AskOrigin.model, charged: 1, left: 17, requestId: 'r1'),
        if (full) ...[
          const AskMessage.student('Why is the loan interest 6% and not the bank rate?'),
          const AskMessage.reply(
            'Because the Partnership Act fixes it at 6% a year when the deed is silent. The bank rate never comes into it unless the partners agree to it.',
            origin: AskOrigin.model,
            charged: 0,
            left: 17,
            requestId: 'r2',
          ),
        ],
      ],
      thread: DoubtThread(
        info: ThreadInfo(id: 't1', followUpsLeft: full ? 0 : 1, subject: 'accountancy', chapter: 'Partnership Fundamentals'),
        openedAt: 1,
        checks: [_c1, _c2],
        marks: const {
          'c1': CheckMark(
            right: true,
            pick: 1,
            keyIndex: 1,
            line: 'Right. A gives 1/10 and B gives 1/10, so the new ratio is 13:7:5.',
            explanation: 'A keeps 3/5 minus 1/10, which is 5/10; B keeps 2/5 minus 1/10, which is 3/10; C gets 2/10. Out of 25 that is 13:7:5.',
          ),
          'c2': CheckMark(
            right: false,
            pick: 2,
            keyIndex: 0,
            line: 'Not this time. The key is A, 6% a year.',
            explanation: 'Section 13(d) of the Partnership Act allows 6% a year on a partner’s loan when the deed says nothing.',
          ),
        },
      ),
    );

void main() {
  for (final w in [360.0, 412.0]) {
    final dp = w.toInt();
    for (final (name, s) in [('ready', ready), ('partial', partial), ('thin', thin), ('nocolleges', noColleges)]) {
      insightsGolden(
        'mobi_stand_${name}_$dp',
        () => const AskScreen(),
        size: Size(w, 1900),
        overrides: () => [...insightsOverrides(), mobiStandingProvider.overrideWith((ref) async => s)],
        after: (t) async => t.pump(),
      );
    }
    insightsGolden(
      'mobi_now_starters_$dp',
      () => const AskScreen(),
      size: Size(w, 1100),
      overrides: () => [...insightsOverrides(), mobiStandingProvider.overrideWith((ref) async => ready)],
      after: (t) async {
        await t.tap(find.byType(TextField).first);
        await t.pump();
        await t.pump(const Duration(milliseconds: 400));
      },
    );
    insightsGolden(
      'mobi_thread_checks_$dp',
      () => const AskScreen(),
      size: Size(w, 2300),
      overrides: () => [...insightsOverrides(ask: _thread()), mobiStandingProvider.overrideWith((ref) async => ready)],
    );
    insightsGolden(
      'mobi_thread_full_$dp',
      () => const AskScreen(),
      size: Size(w, 2500),
      overrides: () => [...insightsOverrides(ask: _thread(full: true)), mobiStandingProvider.overrideWith((ref) async => ready)],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/api/api_error.dart';
import 'package:mockmob/core/mascot/mascot.dart' show MobiRation;
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/features/insights/ask_mobi.dart';
import 'package:mockmob/features/insights/data/ask_controller.dart';
import 'package:mockmob/features/insights/data/ask_question.dart';
import 'package:mockmob/features/insights/data/ask_sheet_controller.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';
import '../../unit/insights/support/insights_fixtures.dart';
import 'insights_golden_support.dart';

/// The Ask Mobi sheet (ASK-MOBI-1018), opened over a question review, judged against the mocks in
/// tmp/design-1018/askmobi (app-412-*): every state at 412 or 360, Night and Day, and the two
/// busiest at 1.3 text scale.
const _w412 = Size(412, 915);
const _w360 = Size(360, 780);

AiCredits _wallet(int total, {String state = 'available'}) => AiCredits.fromJson({
      'state': state,
      'wallet': {
        'state': state,
        'known': true,
        'total': total,
        'spendable': total,
        'includedRemaining': total,
        'includedMonthlyCredits': 10,
        'bonusCredits': 0,
        'resetAt': '2026-10-31T18:30:00.000Z',
      },
    });

final _q7 = AskMobiContext.question(
  number: 7,
  ref: 'm3:m3-q7',
  stem: 'X and Y share profits in the ratio 3:2. Z is admitted for a 1/4 share, which he takes equally from X and Y. What is the new ratio?',
  chapter: 'Partnership',
  pickLetter: 'B',
  pickText: '9:6:5',
  keyLetter: 'C',
  keyText: '19:11:10',
);

const _mock3 = AskMobiContext.mock(
  label: 'Mock 3',
  attemptId: 'm3',
  lines: [
    'Partnership: 36 of the 78 marks slipped, 6 wrong and 1 left blank',
    'Cash flow statement: 18 of the 78 marks slipped, 3 wrong',
    'Money and banking: 10 of the 78 marks slipped, 2 left blank',
  ],
);

const _today = AskMobiContext.today(
  reason: 'From Mock 3, Accountancy, on 12 October.',
  facts: [
    '13 wrong, 31 right, 6 not attempted.',
    'Partnership: 6 wrong, 1 not attempted in 8 questions',
    'Cash flow statement: 3 wrong in 7 questions',
  ],
);

class _FixedSheet extends AskSheetController {
  _FixedSheet(this.fixed);

  final AskState fixed;

  @override
  AskState build() => fixed;
}

class _FixedHand extends AskQuestionController {
  _FixedHand([this.fixed]);

  final AskQuestionHand? fixed;

  @override
  AskQuestionHand? build() => fixed;

  @override
  Future<void> open(String? raw) async {}
}

/// A question review behind the sheet, so the sheet is judged where it opens.
class _Host extends StatefulWidget {
  const _Host(this.about);

  final AskMobiContext about;

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) openAskMobi(context, widget.about);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.gutter),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Mock 3 · 12 Oct, 9:40 pm', style: type.small.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s12),
              Text('Question 7', style: type.screenTitle),
              Text('Partnership: admission of a partner', style: type.small.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s16),
              Text('X and Y share profits in the ratio 3:2. Z is admitted for a 1/4 share, which he takes equally from X and Y. What is the new profit-sharing ratio?', style: type.body),
            ],
          ),
        ),
      ),
    );
  }
}

void _sheetGolden(
  String name,
  AskMobiContext about, {
  Size size = _w412,
  AskState ask = const AskState(),
  AiCredits? credits,
  bool emptyRecord = false,
  bool recordFailed = false,
  AskQuestionHand? hand,
  double textScale = 1,
}) {
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      MobiRation.reset();
      MobiRation.now = () => DateTime(2026, 10, 13, 19, 30);
      addTearDown(MobiRation.reset);
      final List<Override> overrides = [
        ...insightsOverrides(
          credits: credits ?? _wallet(9),
          insights: emptyRecord
              ? RemoteState(value: empty(), fetchedAt: DateTime.utc(2026, 10, 13))
              : recordFailed
                  ? const RemoteState<PrepInsights>(error: ApiError(kind: ApiErrorKind.network, code: 'network'))
                  : null,
          attempts: emptyRecord ? const [] : null,
        ),
        askSheetControllerProvider.overrideWith(() => _FixedSheet(ask)),
        askSheetQuestionProvider.overrideWith(() => _FixedHand(hand)),
      ];
      await pumpMockmob(tester, _Host(about), brightness: brightness, size: size, textScale: textScale, disableAnimations: true, overrides: overrides, wrapInScaffold: false);
      await tester.pumpAndSettle();
      await settleImages(tester);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/ask_sheet_${name}_$tag.png'));
      // The wait line's 12 s patience timer runs out before the test ends.
      await tester.pump(const Duration(seconds: 13));
    });
  }
}

final _answered = AskState(messages: [
  const AskMessage.student('Why is 19:11:10 right and 9:6:5 wrong?'),
  const AskMessage.reply(
    'The question says Z takes his share equally from X and Y, so each gives up the same 1/8. X keeps 3/5 - 1/8 = 19/40, '
    'Y keeps 2/5 - 1/8 = 11/40, and Z has 10/40.\n\n9:6:5 is what you get when Z takes his share in the old 3:2 ratio. Before '
    'you start the sum, find the word that says how the share is given up.',
    origin: AskOrigin.model,
    charged: 1,
    left: 8,
    actions: [('Practise 10 Partnership questions', '/review')],
  ),
]);

void main() {
  setUpAll(loadAppFonts);

  _sheetGolden('question_412', _q7);
  _sheetGolden('question_360', _q7, size: _w360);
  _sheetGolden('question_412_scale13', _q7, textScale: 1.3);
  _sheetGolden('answered_412', _q7, ask: _answered, credits: _wallet(8));
  _sheetGolden('mock_412', _mock3);
  _sheetGolden('mock_360_scale13', _mock3, size: _w360, textScale: 1.3);
  _sheetGolden('page_360', const AskMobiContext.page(), size: _w360);
  _sheetGolden('no_credits_412', _q7, credits: _wallet(0, state: 'empty'));
  _sheetGolden(
    'waiting_360',
    _q7,
    size: _w360,
    ask: const AskState(messages: [AskMessage.student('Why is 19:11:10 right and 9:6:5 wrong?'), AskMessage.sending()]),
  );
  _sheetGolden(
    'not_confirmed_412',
    _q7,
    ask: const AskState(messages: [
      AskMessage.student('Why is 19:11:10 right and 9:6:5 wrong?'),
      AskMessage.failed(AskFailure.offline, retryText: 'Why is 19:11:10 right and 9:6:5 wrong?', requestId: 'r1', questionRef: 'm3:m3-q7'),
    ]),
  );
  _sheetGolden('new_student_360', const AskMobiContext.page(), size: _w360, emptyRecord: true);
  _sheetGolden('new_student_412', const AskMobiContext.page(), emptyRecord: true);
  _sheetGolden('page_412', const AskMobiContext.page());
  _sheetGolden('today_412', _today);
  _sheetGolden('practice_412', const AskMobiContext.practice());
  _sheetGolden('paused_412', _q7, credits: _wallet(4, state: 'paused'));
  _sheetGolden('record_not_loaded_412', const AskMobiContext.page(), recordFailed: true);
  _sheetGolden(
    'question_failed_412',
    _q7,
    hand: const AskQuestionHand(ref: 'm3:m3-q7', status: AskQuestionStatus.error, message: askQuestionOpenFailed),
  );
}

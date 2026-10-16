import 'package:flutter/material.dart';
import 'package:mockmob/core/models/ai_credits.dart';
import 'package:mockmob/features/insights/data/ask_question.dart';
import 'package:mockmob/features/insights/screens/ask_screen.dart';

import 'insights_golden_support.dart';

/// Ask Mobi about a repaired mistake (`/ask?q=`), at 390 wide: the card with what Mobi will see, and the
/// blocked state when written replies cannot be bought.
const _size = Size(390, 820);

AiCredits _wallet(String state) => AiCredits.fromJson({
      'state': state,
      'wallet': {'state': state, 'known': true, 'total': 9, 'spendable': 9, 'resetAt': '2026-10-31T18:30:00.000Z'},
    });

AskQuestionHand _hand() => AskQuestionHand(
      ref: 'm7:m7-q0',
      status: AskQuestionStatus.ready,
      context: AskQuestionContext.tryParse({
        'ok': true,
        'context': {
          'question': 'Rao and Sen share profits 3:2. Which ratio follows when Iyer is admitted for 1/5?',
          'subject': 'accountancy',
          'chapter': 'Partnership Accounts',
          'rule': 'Split the sacrifice before you subtract.',
          'pick': {'letter': 'B'},
          'hasKey': true,
          'cost': {'credits': 1, 'pool': 'ai'},
        },
      }),
    );

class _FixedHand extends AskQuestionController {
  _FixedHand(this.initial);

  final AskQuestionHand? initial;

  @override
  AskQuestionHand? build() => initial;

  @override
  Future<void> open(String? raw) async {}
}

void main() {
  insightsGolden(
    'ask_question_ready',
    () => const AskScreen(questionRef: 'm7:m7-q0'),
    size: _size,
    overrides: () => [...insightsOverrides(credits: _wallet('available')), askQuestionProvider.overrideWith(() => _FixedHand(_hand()))],
  );

  insightsGolden(
    'ask_question_paused',
    () => const AskScreen(questionRef: 'm7:m7-q0'),
    size: _size,
    overrides: () => [...insightsOverrides(credits: _wallet('paused')), askQuestionProvider.overrideWith(() => _FixedHand(_hand()))],
  );
}

// A9 the Full mock together lobby (MOB-MINIMAL 3.3 as amended by MOB-V4-BUILD 1, D175: no free first mock
// anywhere): the facts row (50 questions | 60 minutes | +5 -1 marks each), the paper card "For you" with the
// server's price, a dashed rule and the general rule in one sentence, then what happens once you start.
//
// Every number is the server's (game.price = {costCredits, sitCredits, proSitsFree}; APP-API-CONTRACT 2.12): the
// card never guesses. A price block the server does not send shows no card at all.
//
//   Pro:                  "For you: included with Pro."
//   Free, enough credits: "For you: 50 credits" / "You have 120 credits."
//   Free, short:          "50 credits. You have 30, so you need 20 more." with Add credits and Get Pro.
//
// The sit sheet (sit_mock_sheet.dart, the mob-formats track) hosts [MockLobbyBody]; MOCK_CREDITS (402) opens it again
// with [MockForYou.refused] so the shortfall shows whatever the balance here says, MOCK_PRO_REQUIRED (403) maps to
// Get Pro. See tmp/v4-coord.md for the call.

import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../../../../core/widgets/key_button.dart';
import '../../../../core/widgets/pressable.dart';
import '../copy_v3.dart';

/// What the "For you" card says, from the server's price and the student's balance.
sealed class MockForYou {
  const MockForYou();

  /// The card for a mock game's `price` block. [costCredits]: what this student pays now (0 for Pro or once begun);
  /// [pro]: the student is on Pro; [balance]: their credits when known; [refused]: the server said MOCK_CREDITS.
  /// Null when there is nothing true to say (no price sent, or nothing to pay off Pro).
  static MockForYou? of({required int? costCredits, required bool pro, int? balance, bool refused = false}) {
    if (costCredits == null) return null;
    if (costCredits <= 0) return pro ? const MockIncluded() : null;
    if (refused || (balance != null && balance < costCredits)) return MockShort(cost: costCredits, have: balance);
    return MockCredits(cost: costCredits, have: balance);
  }
}

class MockIncluded extends MockForYou {
  const MockIncluded();
}

class MockCredits extends MockForYou {
  const MockCredits({required this.cost, this.have});
  final int cost;
  final int? have;
}

class MockShort extends MockForYou {
  const MockShort({required this.cost, this.have});
  final int cost;

  /// Null when the server refused and the balance here is not known: the card then names no number that may be wrong.
  final int? have;
}

/// The lobby's facts row: questions | minutes | marks each, condensed figures over quiet units, hairlines between.
class MockFactsRow extends StatelessWidget {
  const MockFactsRow({super.key, this.questions = 50, this.minutes = 60, this.right = 5, this.wrong = 1});

  final int questions;
  final int minutes;
  final int right;
  final int wrong;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    Widget cell(String figure, String unit) => Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s16),
            child: Column(
              children: [
                Text(figure, style: type.figureCompact.copyWith(color: c.ink, fontSize: 30, height: 1, fontFeatures: const [FontFeature.tabularFigures()])),
                const SizedBox(height: MmSpace.s8),
                Text(unit, style: type.small.copyWith(color: c.ink2), textAlign: TextAlign.center),
              ],
            ),
          ),
        );
    final rule = Container(width: 1, height: 72, color: c.line);
    return Semantics(
      label: '$questions ${MobV4ResultsCopy.factQuestions}, $minutes ${MobV4ResultsCopy.factMinutes}, plus $right minus $wrong ${MobV4ResultsCopy.factMarks}',
      excludeSemantics: true,
      child: DecoratedBox(
        key: const ValueKey('mock-facts'),
        decoration: BoxDecoration(border: Border.symmetric(horizontal: BorderSide(color: c.line))),
        child: Row(
          children: [
            cell('$questions', MobV4ResultsCopy.factQuestions),
            rule,
            cell('$minutes', MobV4ResultsCopy.factMinutes),
            rule,
            // A true minus sign, not a hyphen.
            cell('+$right −$wrong', MobV4ResultsCopy.factMarks),
          ],
        ),
      ),
    );
  }
}

/// The paper card "For you" (the lobby mock-up): the student's price on ruled paper, a dashed rule, then the
/// general rule with the server's Free price ([sitCredits]; left out when the server does not send it).
class MockForYouCard extends StatelessWidget {
  const MockForYouCard({super.key, required this.forYou, this.sitCredits, this.proSitsFree = true});

  final MockForYou forYou;
  final int? sitCredits;
  final bool proSitsFree;

  static const Color _paper = Color(0xFFEDE6D6);
  static const Color _ink = Color(0xFF1F1B16);
  static const Color _ink2 = Color(0xFF5C5446);

  /// "Pro members start full mocks, and anyone in the Mob can sit them. Pro members sit free. Free members pay 50
  /// credits." Only what the server said.
  static String ruleFor(int? sitCredits, bool proSitsFree) => [
        'Pro members start full mocks, and anyone in the Mob can sit them.',
        if (proSitsFree) 'Pro members sit free.',
        if (sitCredits != null && sitCredits > 0) 'Free members pay $sitCredits credits.',
      ].join(' ');

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final (String head, String? line) = switch (forYou) {
      MockIncluded() => (MobV4ResultsCopy.forYouIncluded, null),
      MockCredits(:final cost, :final have) => (MobV4ResultsCopy.forYouCredits(cost), have == null ? null : MobV4ResultsCopy.youHave(have)),
      MockShort(:final cost, :final have) => (
          have == null ? MobV4ResultsCopy.shortUnknown(cost) : MobV4ResultsCopy.shortOf(cost, have),
          null,
        ),
    };
    return Container(
      key: const ValueKey('mock-for-you'),
      width: double.infinity,
      decoration: BoxDecoration(color: _paper, borderRadius: BorderRadius.circular(24)),
      clipBehavior: Clip.antiAlias,
      child: CustomPaint(
        painter: _RuledPaper(),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s20, MmSpace.s20, MmSpace.s20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(head, key: const ValueKey('mock-for-you-head'), style: type.subhead.copyWith(color: _ink, fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()])),
              if (line != null) ...[
                const SizedBox(height: MmSpace.s4),
                Text(line, key: const ValueKey('mock-for-you-line'), style: type.body.copyWith(color: _ink, fontFeatures: const [FontFeature.tabularFigures()])),
              ],
              const SizedBox(height: MmSpace.s16),
              const CustomPaint(size: Size(double.infinity, 1), painter: _DashedRule(_ink2)),
              const SizedBox(height: MmSpace.s12),
              Text(ruleFor(sitCredits, proSitsFree), key: const ValueKey('mock-rule'), style: type.small.copyWith(color: _ink2)),
            ],
          ),
        ),
      ),
    );
  }
}

/// The lobby's middle, for the sit sheet or a lobby screen: facts, the card, and what happens once you start.
class MockLobbyBody extends StatelessWidget {
  const MockLobbyBody({super.key, required this.forYou, this.sitCredits, this.proSitsFree = true, this.questions = 50, this.minutes = 60});

  final MockForYou forYou;
  final int? sitCredits;
  final bool proSitsFree;
  final int questions;
  final int minutes;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MockFactsRow(questions: questions, minutes: minutes),
        const SizedBox(height: MmSpace.s20),
        MockForYouCard(forYou: forYou, sitCredits: sitCredits, proSitsFree: proSitsFree),
        const SizedBox(height: MmSpace.s16),
        Text(MobV4ResultsCopy.mockOnceStarted, style: type.body.copyWith(color: c.ink2)),
      ],
    );
  }
}

/// The lobby's keys for [forYou]: Sit the full mock (included), Sit it for 50 credits, or, short of credits, Get Pro
/// and Add credits. "Not now" sits under them as a quiet link. The caller owns what each does.
class MockLobbyKeys extends StatelessWidget {
  const MockLobbyKeys({super.key, required this.forYou, required this.onSit, required this.onAddCredits, required this.onPro, required this.onNotNow});

  final MockForYou forYou;
  final VoidCallback onSit;
  final VoidCallback onAddCredits;
  final VoidCallback? onPro;
  final VoidCallback onNotNow;

  @override
  Widget build(BuildContext context) {
    final c = context.mmColors;
    final type = context.mmType;
    final List<Widget> keys = switch (forYou) {
      MockIncluded() => [KeyButton(key: const ValueKey('mock-sit'), label: MobV4ResultsCopy.sitTheMock, onPressed: onSit)],
      MockCredits(:final cost) => [KeyButton(key: const ValueKey('mock-sit'), label: MobV4ResultsCopy.sitFor(cost), onPressed: onSit)],
      MockShort() => [
          if (onPro != null) KeyButton(key: const ValueKey('mock-pro'), label: MobV4ResultsCopy.getPro, onPressed: onPro),
          if (onPro != null) const SizedBox(height: MmSpace.s8),
          onPro != null
              ? KeyButton.secondary(key: const ValueKey('mock-add-credits'), label: MobV4ResultsCopy.addCredits, onPressed: onAddCredits)
              : KeyButton(key: const ValueKey('mock-add-credits'), label: MobV4ResultsCopy.addCredits, onPressed: onAddCredits),
        ],
    };
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ...keys,
        const SizedBox(height: MmSpace.s4),
        Center(
          child: MmPressable(
            key: const ValueKey('mock-not-now'),
            onTap: onNotNow,
            semanticsLabel: MobV4ResultsCopy.notNow,
            focusRadius: BorderRadius.circular(999),
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 44, minWidth: 88),
              child: Center(child: Text(MobV4ResultsCopy.notNow, style: type.body.copyWith(color: pressed ? c.ink3 : c.ink2))),
            ),
          ),
        ),
      ],
    );
  }
}

class _RuledPaper extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = const Color(0xFF1F1B16).withValues(alpha: 0.06)
      ..strokeWidth = 1;
    for (var y = 44.0; y < size.height; y += 22) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), p);
    }
  }

  @override
  bool shouldRepaint(_RuledPaper old) => false;
}

class _DashedRule extends CustomPainter {
  const _DashedRule(this.ink);
  final Color ink;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = ink.withValues(alpha: 0.6)
      ..strokeWidth = 1;
    for (var x = 0.0; x < size.width; x += 7) {
      canvas.drawLine(Offset(x, 0.5), Offset(x + 3.5, 0.5), p);
    }
  }

  @override
  bool shouldRepaint(_DashedRule old) => old.ink != ink;
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../../core/domain/domain.dart';
import '../copy.dart';
import '../../rhythm/rhythm.dart' show celebrationModeProvider;
import '../model/recap_model.dart';
import '../model/recap_variant.dart';
import '../widgets/breakdown_section.dart';
import '../widgets/evidence_link.dart';
import '../widgets/marks_flow.dart';
import '../widgets/result_space.dart';
import '../result_nav.dart';
import '../model/paper_read.dart' show PaperRead;
import '../widgets/finish_reveal.dart' show FinishBeats, PaperReadCard;
import 'card_page.dart';
import 'recap_mobi.dart';

/// Card 2 (spec 5.6.3): where the other marks went, as a flow that draws once: the paper's column
/// fills, then a ribbon runs to each place the marks went.
class BreakdownCard extends ConsumerStatefulWidget {
  const BreakdownCard({super.key, required this.model, required this.onNext, required this.onBack});

  final RecapModel model;
  final VoidCallback onNext;
  final VoidCallback onBack;

  @override
  ConsumerState<BreakdownCard> createState() => _BreakdownCardState();
}

class _BreakdownCardState extends ConsumerState<BreakdownCard> with TickerProviderStateMixin {
  late final AnimationController _grow = AnimationController(vsync: this, duration: MarksFlow.duration);

  /// Mobi's read under the flow: its blocks rise in once the ribbons have drawn.
  late final AnimationController _read = AnimationController(vsync: this, duration: FinishBeats.after);
  Timer? _wait;

  /// Mobi beside the headline (a result that is not lower, held or NTA) glances at the ribbon the
  /// student picks.
  final MobiController _mobi = MobiController();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_grow.status != AnimationStatus.dismissed) return;
    if (Motion.reduced(context)) {
      _grow.value = 1;
      _read.value = 1;
    } else {
      _grow.addStatusListener((s) {
        if (s == AnimationStatus.completed && mounted && _read.value == 0) _read.forward();
      });
      // After the headline and the lead have landed (the card page's stagger).
      _wait = Timer(const Duration(milliseconds: 260), () {
        if (mounted) _grow.forward();
      });
    }
  }

  @override
  void dispose() {
    _wait?.cancel();
    _grow.dispose();
    _read.dispose();
    _mobi.dispose();
    super.dispose();
  }

  /// The questions behind the lead line, from the paper itself: the wrong answers when the line
  /// speaks of them, the blanks otherwise. Null when there are none to show.
  ({bool wrongSide, List<int> numbers})? _evidence(MarkBreakdown b) {
    final wrongSide = b.wrong > 0 && b.takenOff + b.notEarnedOnWrong >= b.notEarnedOnBlank;
    final want = wrongSide ? BubbleState.wrong : BubbleState.blank;
    final cells = widget.model.cells;
    final numbers = [
      for (var i = 0; i < cells.length; i++)
        if (cells[i] == want) i + 1,
    ];
    return numbers.isEmpty ? null : (wrongSide: wrongSide, numbers: numbers);
  }

  /// "Fix these": the answers the read names that are still open, in one repair run.
  VoidCallback? _fix(PaperRead read) {
    final open = {for (final c in widget.model.candidates) c.questionId};
    final fixable = [
      for (final q in read.fixQids)
        if (open.contains(q)) q,
    ];
    if (fixable.isEmpty) return null;
    return () => context.go(ResultNav.repair(widget.model, startQuestionId: fixable.first, runCount: fixable.length));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final b = widget.model.breakdown;
    // At large text the secondary line ("Mock 7, Accountancy") gives way, so the flow gets the room.
    final largeText = MediaQuery.textScalerOf(context).scale(14) / 14 > 1.15;
    // Mobi is on this card only after a result that may be met with some warmth, and never in NTA
    // mode: the reaction table says whether it is there at all (lower and held results are calm).
    final mobi =
        !largeText &&
        widget.model.variant.celebratory &&
        recapReaction(
              variant: widget.model.variant,
              mode: ref.watch(celebrationModeProvider),
              isNta: widget.model.isNta,
              hour: MobiRation.now().hour,
            ) !=
            null;
    return RecapCardPage(
      onNext: widget.onNext,
      onBack: widget.onBack,
      footer: KeyButton(label: ResultCopy.nextFix, onPressed: widget.onNext),
      children: [
        const SizedBox(height: MmSpace.s16),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Semantics(
                header: true,
                child: Text(b.lost == 0 ? ResultCopy.allScored(b.max) : ResultCopy.breakdownTitle(b.lost, max: b.max), style: type.moment),
              ),
            ),
            if (mobi) ...[
              const SizedBox(width: MmSpace.s12),
              RecapMobi(pose: MobiPose.attentive, size: ResultSpace.mobi, controller: _mobi),
            ],
          ],
        ),
        const SizedBox(height: MmSpace.s8),
        if (b.lost > 0) ...[
          Text(ResultCopy.breakdownLead(b.wrong, b.takenOff + b.notEarnedOnWrong, b.notEarnedOnBlank), style: type.lead),
          if (_evidence(b) case final e?) ...[
            const SizedBox(height: MmSpace.s4),
            Align(
              alignment: Alignment.centerLeft,
              child: EvidenceLink(
                label: e.wrongSide ? ResultCopy.seeWrong : ResultCopy.seeBlank,
                onTap: () => ResultNav.toFullResult(context, widget.model.attemptId, question: e.numbers.first),
              ),
            ),
          ],
          const SizedBox(height: MmSpace.s4),
        ],
        if (!largeText) Text(widget.model.title, style: type.small.copyWith(color: colors.ink3)),
        SizedBox(height: largeText ? MmSpace.s12 : MmSpace.s24),
        BreakdownSection(
          breakdown: b,
          grow: _grow,
          caption: false,
          flow: true,
          cells: widget.model.cells,
          onOpenQuestion: (n) => ResultNav.toFullResult(context, widget.model.attemptId, question: n),
          onPick: (at) {
            if (at != null) _mobi.glance(at, hold: const Duration(milliseconds: 1400));
          },
        ),
        // Mobi's read of the paper (20 Oct): what went well, where the marks leaked, the marks within reach with one key
        // that repairs exactly those answers, and what to watch. A plain heading on an NTA paper (no Mobi there).
        if (widget.model.read case final read?) ...[
          const SizedBox(height: MmSpace.s24),
          PaperReadCard(
            read: read,
            t: _read,
            at: 0,
            plain: widget.model.isNta,
            lead: widget.model.readLead,
            leadDetail: widget.model.readLeadDetail,
            onFix: _fix(read),
          ),
        ],
      ],
    );
  }
}

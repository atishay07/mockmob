import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/mascot/mascot.dart';
import '../../../core/theme/theme.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;

/// Mobi beside the feedback of a concept check the student has just answered: one small `correct`
/// hop for a right answer, one `encourage` lean for a miss (the same acts as the repair run and the
/// website's `MobiReact`). He says nothing himself; the panel's own words carry the meaning.
///
/// Mobi at most once per screen and never a show:
/// - a reaction asks [MobiRation.reactNow] once, so answers tapped less than 2.5 s apart do not
///   each get one (the second answer's panel is simply there);
/// - the Celebrations setting mutes him: only Full shows him, Quiet and Off leave the words alone;
/// - large text (past 130 percent) keeps the line and drops him, so the words never wrap around art;
/// - reduced motion holds his pose still (the character does that itself).
///
/// Build it only for a step answered on this phone just now, never for one reopened from a saved
/// state: asking consumes the gate.
class FeedbackMobi extends ConsumerStatefulWidget {
  const FeedbackMobi({super.key, required this.right});

  /// A right answer plays `correct`; anything else `encourage`.
  final bool right;

  /// The key of the rate-limit gate, shared by every concept check of the app run.
  static const String gate = 'learn:feedback';

  /// Mobi's square in the panel's row, and the air between him and the words.
  static const double slot = 56;
  static const double gap = MmSpace.s12;

  /// The act played for a right or a missed answer (the shared moments table).
  static MobiAct actFor({required bool right}) => MobiMoments.act(right ? MobiEvent.answerRight : MobiEvent.answerWrong);

  @override
  ConsumerState<FeedbackMobi> createState() => _FeedbackMobiState();
}

class _FeedbackMobiState extends ConsumerState<FeedbackMobi> {
  final MobiController _mobi = MobiController();
  late final bool _allowed = MobiRation.reactNow(FeedbackMobi.gate);

  @override
  void initState() {
    super.initState();
    _mobi.setMood(widget.right ? MobiMood.happy : MobiMood.calm);
  }

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final full = ref.watch(celebrationModeProvider) == CelebrationMode.full;
    final largeText = MediaQuery.textScalerOf(context).scale(16) > 16 * 1.3;
    if (!_allowed || !full || largeText) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(left: FeedbackMobi.gap),
      child: SizedBox(
        width: FeedbackMobi.slot,
        height: FeedbackMobi.slot,
        child: ExcludeSemantics(
          child: RepaintBoundary(
            child: MobiCharacter(
              size: FeedbackMobi.slot,
              controller: _mobi,
              entrance: FeedbackMobi.actFor(right: widget.right),
              seed: 41,
            ),
          ),
        ),
      ),
    );
  }
}

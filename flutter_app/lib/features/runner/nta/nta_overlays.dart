import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'nta_copy.dart';
import 'nta_integrity.dart';
import 'nta_paper_theme.dart';

/// Opens [builder] as a solid drawer from the right edge (the exam's palette panel on a phone).
/// Pops with whatever the panel returns.
Future<T?> showNtaDrawer<T>({required BuildContext context, required WidgetBuilder builder}) {
  final colors = context.mmColors;
  final reduced = Motion.reduced(context);
  return showGeneralDialog<T>(
    context: context,
    useRootNavigator: false,
    barrierDismissible: true,
    barrierLabel: NtaCopy.close,
    barrierColor: colors.scrim,
    transitionDuration: reduced ? Motion.reducedFade : const Duration(milliseconds: 280),
    pageBuilder: (context, _, _) {
      final width = math.min(340.0, MediaQuery.sizeOf(context).width * 0.88);
      return Align(
        alignment: Alignment.centerRight,
        child: SizedBox(
          width: width,
          height: double.infinity,
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: Border(left: BorderSide(color: colors.line)),
              boxShadow: colors.glassShadow,
            ),
            // The dialog lives on the router's navigator: put it on the exam paper too.
            child: NtaStyleTheme(
              child: Material(type: MaterialType.transparency, child: Builder(builder: builder)),
            ),
          ),
        ),
      );
    },
    transitionBuilder: (context, animation, _, child) {
      if (reduced) return FadeTransition(opacity: animation, child: child);
      final curved = CurvedAnimation(parent: animation, curve: Motion.drawer, reverseCurve: Motion.exit);
      return SlideTransition(
        position: Tween(begin: const Offset(1, 0), end: Offset.zero).animate(curved),
        child: child,
      );
    },
  );
}

/// The warning card over the paper (ExamIntegrityGuard, phone edition). Answering waits behind
/// it until "Return to the exam". After the third warning it says the session ended while the
/// submit page takes over.
class NtaWarningOverlay extends StatelessWidget {
  const NtaWarningOverlay({super.key, required this.integrity});

  final NtaIntegrity integrity;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final ended = integrity.terminated;
    final n = integrity.strikes;
    final reason = (integrity.lastViolation ?? NtaViolation.left).reason;
    return Positioned.fill(
      child: ColoredBox(
        color: colors.ground.withValues(alpha: 0.94),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(MmSpace.gutter),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: DecoratedBox(
                  decoration: ShapeDecoration(
                    color: colors.raised,
                    shape: RoundedSuperellipseBorder(borderRadius: MmRadius.panelAll, side: BorderSide(color: colors.lineStrong)),
                    shadows: colors.glassShadow,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(MmSpace.s20),
                    child: Semantics(
                      liveRegion: true,
                      container: true,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            children: [
                              Icon(LucideIcons.shieldAlert, size: 22, color: n >= 2 ? colors.badText : colors.warnText),
                              const SizedBox(width: MmSpace.s8),
                              Expanded(
                                child: Semantics(
                                  header: true,
                                  child: Text(ended ? NtaCopy.endedTitle : NtaCopy.warningTitle(n), style: type.title),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: MmSpace.s12),
                          _StrikeBars(strikes: n),
                          const SizedBox(height: MmSpace.s16),
                          Text(
                            ended ? NtaCopy.endedBody : NtaCopy.warningBody(reason, n),
                            style: type.body.copyWith(color: colors.ink),
                          ),
                          if (!ended) ...[
                            const SizedBox(height: MmSpace.s16),
                            for (final rule in NtaCopy.rules)
                              Padding(
                                padding: const EdgeInsets.only(bottom: MmSpace.s6),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Padding(
                                      padding: const EdgeInsets.only(top: 3),
                                      child: Icon(LucideIcons.dot, size: 14, color: colors.ink3),
                                    ),
                                    const SizedBox(width: MmSpace.s6),
                                    Expanded(child: Text(rule, style: type.small.copyWith(color: colors.ink2))),
                                  ],
                                ),
                              ),
                            const SizedBox(height: MmSpace.s16),
                            KeyButton(label: NtaCopy.returnKey, onPressed: integrity.acknowledge, hapticOnCommit: false, autofocus: true),
                          ] else ...[
                            const SizedBox(height: MmSpace.s16),
                            Row(
                              children: [
                                MmSpinner(color: colors.ink2, size: 16, strokeWidth: 2),
                                const SizedBox(width: MmSpace.s8),
                                Text(NtaCopy.submitting, style: type.caption.copyWith(color: colors.ink2)),
                              ],
                            ),
                          ],
                          const SizedBox(height: MmSpace.s16),
                          Text(NtaCopy.finePrint, style: type.caption.copyWith(color: colors.ink3)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _StrikeBars extends StatelessWidget {
  const _StrikeBars({required this.strikes});

  final int strikes;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final tone = strikes >= 2 ? colors.badText : colors.warnText;
    return ExcludeSemantics(
      child: Row(
        children: [
          for (var i = 0; i < NtaRules.strikes; i++) ...[
            if (i > 0) const SizedBox(width: MmSpace.s6),
            Expanded(
              child: Container(
                height: 5,
                decoration: BoxDecoration(color: i < strikes ? tone : colors.raised2, borderRadius: MmRadius.pillAll),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

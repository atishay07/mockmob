import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/sync/session/session_engine.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import 'nta_copy.dart';
import 'nta_integrity.dart';
import 'nta_paper_theme.dart';
import 'nta_skin.dart';

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
              child: Material(
                type: MaterialType.transparency,
                child: Builder(builder: builder),
              ),
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
/// it until "Return to the exam". After the third warning it says the session ended and stays
/// until the student continues, so the reason is read before the submit page opens.
class NtaWarningOverlay extends StatelessWidget {
  const NtaWarningOverlay({super.key, required this.integrity, this.submitState, this.onContinue});

  final NtaIntegrity integrity;

  /// How the submit that the third warning started is going, shown on the ended card.
  final ValueListenable<SubmitUiState>? submitState;

  /// "Continue" on the ended card.
  final VoidCallback? onContinue;

  /// How far the paper is dimmed behind the card.
  static const double _scrimOpacity = 0.94;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final ended = integrity.terminated;
    final n = integrity.strikes;
    final reason = (integrity.lastViolation ?? NtaViolation.left).reason;
    final title = ended ? NtaCopy.endedTitle : NtaCopy.warningTitle(n);
    // The dim over the paper. The strip over the status bar is painted by the app above everything
    // (the exam bar's colour), so it is given the dimmed colour too, or one bright band would
    // sit over the dimmed exam.
    final scrim = colors.ground.withValues(alpha: _scrimOpacity);
    final strip = Color.alphaBlend(scrim, NtaBarColors.of(context).fill);
    final stripIcons = ThemeData.estimateBrightnessForColor(strip) == Brightness.dark ? Brightness.light : Brightness.dark;
    // A modal: it names the route, scopes the semantics tree to itself and, with the paper
    // beneath it excluded, "Return to the exam" is the one control TalkBack can reach.
    return Positioned.fill(
      child: StatusTint(
        color: strip,
        child: AnnotatedRegion<SystemUiOverlayStyle>(
          value: SystemUiOverlayStyle(
            statusBarColor: Colors.transparent,
            statusBarIconBrightness: stripIcons,
            statusBarBrightness: stripIcons == Brightness.light ? Brightness.dark : Brightness.light,
          ),
          child: Semantics(
            scopesRoute: true,
            explicitChildNodes: true,
            namesRoute: true,
            label: title,
            child: ColoredBox(
              color: scrim,
              child: SafeArea(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(MmSpace.gutter),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 440),
                      child: DecoratedBox(
                        decoration: ShapeDecoration(
                          color: colors.raised,
                          shape: RoundedSuperellipseBorder(
                            borderRadius: MmRadius.panelAll,
                            side: BorderSide(color: colors.lineStrong),
                          ),
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
                                // No Mobi here: the NTA paper is exam-faithful, and this card shows while the clock runs.
                                Row(
                                  children: [
                                    Icon(LucideIcons.shieldAlert, size: 22, color: n >= 2 ? colors.badText : colors.warnText),
                                    const SizedBox(width: MmSpace.s8),
                                    Expanded(
                                      child: Semantics(
                                        header: true,
                                        child: Text(title, style: type.title),
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
                                  // The rules are on the instructions page and the body above already says
                                  // what this warning costs: only the first warning offers them, folded.
                                  if (n == 1) ...[const SizedBox(height: MmSpace.s8), const _RulesDisclosure()],
                                  const SizedBox(height: MmSpace.s16),
                                  KeyButton(label: NtaCopy.returnKey, onPressed: integrity.acknowledge, hapticOnCommit: false, autofocus: true),
                                ] else ...[
                                  const SizedBox(height: MmSpace.s16),
                                  _EndedStatus(submitState: submitState),
                                  const SizedBox(height: MmSpace.s16),
                                  // Not live while the answers are still on their way: Continue opens the
                                  // submit page, and the card is where the student reads that they went.
                                  _ContinueKey(submitState: submitState, onContinue: onContinue),
                                ],
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
          ),
        ),
      ),
    );
  }
}

/// "What counts as a warning", folded: one quiet key that opens the four rules in place.
class _RulesDisclosure extends StatefulWidget {
  const _RulesDisclosure();

  @override
  State<_RulesDisclosure> createState() => _RulesDisclosureState();
}

class _RulesDisclosureState extends State<_RulesDisclosure> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.small.copyWith(color: colors.ink2);
    final dot = (style.fontSize ?? 14) * (style.height ?? 1.4) / 2 - 2;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          // The key's own padding is pulled back, so its words start on the card's edge.
          child: Transform.translate(
            offset: const Offset(-MmSpace.s16, 0),
            child: KeyButton.quiet(
              label: _open ? NtaCopy.rulesHide : NtaCopy.rulesShow,
              onPressed: () => setState(() => _open = !_open),
              hapticOnCommit: false,
            ),
          ),
        ),
        if (_open)
          for (final rule in NtaCopy.rules)
            Padding(
              padding: const EdgeInsets.only(bottom: MmSpace.s8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // A 4 dp bullet on the middle of the first line of its rule.
                  Padding(
                    padding: EdgeInsets.only(top: dot),
                    child: SizedBox.square(
                      dimension: 4,
                      child: DecoratedBox(decoration: BoxDecoration(color: colors.ink3, shape: BoxShape.circle)),
                    ),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(child: Text(rule, style: style)),
                ],
              ),
            ),
      ],
    );
  }
}

/// "Continue" on the ended card: off while the call is in flight (the line above says the answers
/// are being submitted, and a live key beside it would say the opposite), live once there is a
/// result to read (received, kept on this phone, not recorded). Idle means the submit did not
/// start: the page still opens with its own Submit key, so Continue stays live then.
class _ContinueKey extends StatelessWidget {
  const _ContinueKey({required this.submitState, required this.onContinue});

  final ValueListenable<SubmitUiState>? submitState;
  final VoidCallback? onContinue;

  @override
  Widget build(BuildContext context) {
    final listenable = submitState;
    if (listenable == null) return KeyButton(label: NtaCopy.endedContinue, onPressed: onContinue, hapticOnCommit: false, autofocus: true);
    return ValueListenableBuilder<SubmitUiState>(
      valueListenable: listenable,
      builder: (context, state, _) {
        final inFlight = state.stage == SubmitStage.sending;
        return KeyButton(label: NtaCopy.endedContinue, onPressed: inFlight ? null : onContinue, hapticOnCommit: false, autofocus: true);
      },
    );
  }
}

/// Where the submit stands while the ended card is up: sending, in, saved on this phone, or not
/// recorded. Never a spinner once nothing is in flight.
class _EndedStatus extends StatelessWidget {
  const _EndedStatus({required this.submitState});

  final ValueListenable<SubmitUiState>? submitState;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.caption.copyWith(color: colors.ink2);
    final listenable = submitState;
    if (listenable == null) return _line(colors, style, NtaCopy.submitting, busy: true);
    return ValueListenableBuilder<SubmitUiState>(
      valueListenable: listenable,
      builder: (context, state, _) => switch (state.stage) {
        SubmitStage.idle || SubmitStage.sending => _line(colors, style, NtaCopy.submitting, busy: true),
        SubmitStage.received => _line(colors, style, NtaCopy.endedReceived),
        SubmitStage.pending => _line(colors, style, RunnerCopy.pendingBody),
        SubmitStage.windowClosed || SubmitStage.rejected => _line(colors, style, NtaCopy.endedNotRecorded),
      },
    );
  }

  Widget _line(MmColors colors, TextStyle style, String text, {bool busy = false}) => Row(
    children: [
      if (busy) ...[MmSpinner(color: colors.ink2, size: 16, strokeWidth: 2), const SizedBox(width: MmSpace.s8)],
      Expanded(child: Text(text, style: style)),
    ],
  );
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

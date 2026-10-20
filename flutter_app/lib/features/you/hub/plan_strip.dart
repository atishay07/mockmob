// The plan strip near the top of You (K3 and K6, owner 20 Oct 2026). The credits balance used to be one row at the very
// bottom of You ("dug away at the bottom"), and a Free student had no way to Pro from You. This is one quiet card of two
// halves under the name: the credits, which open the Wallet, and the plan, which opens the Pro page (a Free student
// reads "Free plan" and "Upgrade to Pro"; a Pro student reads their plan instead). Every figure is the server's own; a
// balance that did not load is never 0.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/copy/formatters.dart' show formatDayMonth;
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../billing/billing.dart';
import '../../credits/credits.dart';
import '../../pro_nudge/copy.dart' show ProNudgeCopy;
import '../copy.dart';

class YouPlanStrip extends ConsumerWidget {
  const YouPlanStrip({super.key});

  static const double minHeight = 76;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final figures = ref.watch(creditFiguresProvider);
    final billingOn = ref.watch(playBillingEnabledProvider) && ref.watch(playBillingUserIdProvider) != null;
    final isPro = figures.isPro;
    // One credits balance (owner D78). An older server that still sends two pools gets its two figures said in words,
    // never added into a number it did not send.
    final total = figures.oneBalance ? figures.total : null;
    final twoPools = !figures.oneBalance && figures.practice != null && figures.ai != null ? YouCopy.planNote(figures.practice!, figures.ai!) : null;
    final figure = total != null ? '$total' : (twoPools ?? (figures.loading ? YouCopy.stripChecking : YouCopy.stripNotLoaded));

    void openWallet() => openCreditsPage(context);
    // The Pro page with Google Play on; with it off there is no page to open, so the plan half opens the Wallet,
    // which says the plan too (no key ever leads nowhere).
    void openPlan() => billingOn ? showGetProSheet(context) : openCreditsPage(context);

    final until = figures.proUntil;
    final proNote = until == null ? YouCopy.stripProActive : YouCopy.stripProUntil(formatDayMonth(until));

    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: RoundedSuperellipseBorder(borderRadius: MmRadius.panelAll, side: BorderSide(color: colors.line)),
        shadows: colors.isNight ? null : colors.cardShadow,
      ),
      child: MmClip(
        borderRadius: MmRadius.panelAll,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _Half(
                  semanticsLabel: YouCopy.stripCreditsLabel(total == null ? figure : '$total ${YouCopy.stripToSpend}'),
                  onTap: openWallet,
                  child: _CreditsHalf(figure: figure, known: total != null),
                ),
              ),
              Container(width: 1, color: colors.line),
              Expanded(
                child: _Half(
                  semanticsLabel: isPro ? YouCopy.stripProLabel(proNote) : (billingOn ? '${YouCopy.stripFreePlan}. ${ProNudgeCopy.gateAction}. ${YouCopy.stripOpensPro}' : YouCopy.stripFreeLabel),
                  onTap: openPlan,
                  // The plan half carries the Pro column's own light, the volt wash the Pro page's table gives Pro, so it
                  // reads as the way to the Pro page without a banner.
                  tint: billingOn || isPro ? colors.volt.withValues(alpha: colors.isNight ? 0.09 : 0.16) : null,
                  child: isPro ? _ProHalf(note: proNote) : _FreeHalf(upgrade: billingOn),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One pressable half of the strip: a faint ink wash while pressed, the whole half the target.
class _Half extends StatelessWidget {
  const _Half({required this.semanticsLabel, required this.onTap, required this.child, this.tint});

  final String semanticsLabel;
  final VoidCallback onTap;
  final Widget child;
  final Color? tint;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: semanticsLabel,
      haptic: MmPressHaptic.selection,
      pressedScale: 0.98,
      focusRadius: MmRadius.panelAll,
      builder: (context, pressed, focused) {
        final base = tint ?? colors.raised.withValues(alpha: 0);
        return ColoredBox(
          color: pressed ? Color.alphaBlend(colors.ink.withValues(alpha: 0.06), tint ?? colors.raised) : base,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: YouPlanStrip.minHeight),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s12, MmSpace.s12),
              child: child,
            ),
          ),
        );
      },
    );
  }
}

class _CreditsHalf extends StatelessWidget {
  const _CreditsHalf({required this.figure, required this.known});

  final String figure;
  final bool known;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Row(
                children: [
                  Icon(LucideIcons.wallet, size: 16, color: colors.ink2),
                  const SizedBox(width: MmSpace.s6),
                  Flexible(child: Text(YouCopy.stripCredits, style: type.caption.copyWith(color: colors.ink2))),
                ],
              ),
              const SizedBox(height: MmSpace.s4),
              Text.rich(
                TextSpan(children: [
                  TextSpan(
                    text: figure,
                    style: known
                        ? type.figureCompact.copyWith(color: colors.ink, fontSize: 24, height: 1.15, fontFeatures: const [FontFeature.tabularFigures()])
                        : type.small.copyWith(color: colors.ink3),
                  ),
                  if (known) TextSpan(text: ' ${YouCopy.stripToSpend}', style: type.caption.copyWith(color: colors.ink2)),
                ]),
              ),
            ],
          ),
        ),
        Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
      ],
    );
  }
}

class _FreeHalf extends StatelessWidget {
  const _FreeHalf({required this.upgrade});

  /// Google Play is on, so the Pro page can open.
  final bool upgrade;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(upgrade ? YouCopy.stripFreePlan : YouCopy.stripYourPlan, style: type.caption.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s4),
              Text(
                upgrade ? ProNudgeCopy.gateAction : YouCopy.stripFreePlan,
                style: type.labelLarge.copyWith(color: upgrade ? colors.accentText : colors.ink, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
        Icon(LucideIcons.chevronRight, size: 18, color: upgrade ? colors.accentText : colors.ink3),
      ],
    );
  }
}

class _ProHalf extends StatelessWidget {
  const _ProHalf({required this.note});

  final String note;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(YouCopy.stripYourPlan, style: type.caption.copyWith(color: colors.ink2)),
              const SizedBox(height: MmSpace.s4),
              Wrap(
                spacing: MmSpace.s8,
                runSpacing: MmSpace.s4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  // The Pro pill of the Pro page's table: volt, its darker edge, ink on volt.
                  DecoratedBox(
                    decoration: BoxDecoration(color: colors.volt, borderRadius: MmRadius.pillAll, border: Border.all(color: colors.voltEdge)),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: 2),
                      child: Text(YouCopy.stripPro, style: type.label.copyWith(color: colors.voltInk, fontWeight: FontWeight.w800)),
                    ),
                  ),
                  Text(note, style: type.caption.copyWith(color: colors.ink2)),
                ],
              ),
            ],
          ),
        ),
        Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
      ],
    );
  }
}

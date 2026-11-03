// The plan strip near the top of You (K3 and K6, owner 20 Oct 2026). The credits balance used to be one row at the very
// bottom of You ("dug away at the bottom"), and a Free student had no way to Pro from You. It sits under the name: the
// credits, which open the Wallet, and the plan, which opens the Pro page (a Free student reads "Free plan" and "Upgrade to
// Pro"; a Pro student reads their plan instead). Every figure is the server's own; a balance that did not load is never 0.
//
// One calm capsule since LK42 (owner, 2 Nov 2026: "where it shows Pro, and I think it's credits, wallet symbol, all that is
// very low-quality ... especially this wallet logo"), the web's account capsule (bd3c91db0) on You: a hairline capsule on
// the raised ground with two doors and a short rule between them. The balance is said in words ("108 credits", the
// number in the title cut with tabular figures; no wallet glyph, the unit is a word); Pro is a small accent word on its
// own faint wash, not a filled volt pill (the page's volt belongs to its primary key). Each door is the whole half, at
// least 56 dp tall, with its own press and focus.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/copy/formatters.dart' show formatDayMonth;
import '../../../core/motion/mm_light.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../billing/billing.dart';
import '../../credits/credits.dart';
import '../../pro_nudge/copy.dart' show ProNudgeCopy;
import '../copy.dart';

class YouPlanStrip extends ConsumerWidget {
  const YouPlanStrip({super.key});

  /// The capsule's least height: each door is a full target.
  static const double minHeight = 56;

  /// The balance door's width, as shares of the capsule.
  static const double creditsMinShare = 0.4;
  static const double creditsMaxShare = 0.5;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final figures = ref.watch(creditFiguresProvider);
    final billingOn = ref.watch(playBillingEnabledProvider) && ref.watch(playBillingUserIdProvider) != null;
    final isPro = figures.isPro;
    // One credits balance (owner D78). An older server that still sends two pools gets its two figures said in words,
    // never added into a number it did not send.
    final total = figures.oneBalance ? figures.total : null;
    final pools = !figures.oneBalance && figures.practice != null && figures.ai != null ? (practice: figures.practice!, ai: figures.ai!) : null;
    final twoPools = pools == null ? null : YouCopy.planNote(pools.practice, pools.ai);
    final state = figures.loading ? YouCopy.stripChecking : YouCopy.stripNotLoaded;
    final spoken = total != null ? YouCopy.stripBalance(total) : (twoPools ?? '${YouCopy.stripCredits}, $state');

    void openWallet() => openCreditsPage(context);
    // The Pro page with Google Play on; with it off there is no page to open, so the plan door opens the Wallet,
    // which says the plan too (no key ever leads nowhere).
    void openPlan() => billingOn ? showGetProSheet(context) : openCreditsPage(context);

    final until = figures.proUntil;
    final proNote = until == null ? YouCopy.stripProActive : YouCopy.stripProUntil(formatDayMonth(until));

    return DecoratedBox(
      decoration: ShapeDecoration(color: colors.raised, shape: StadiumBorder(side: BorderSide(color: colors.line))),
      child: MmClip(
        borderRadius: MmRadius.pillAll,
        // The balance door is as wide as its words, between 40% and half of the capsule; the plan takes the rest, so
        // "Upgrade to Pro" stays on one line at 360 dp with text at 1.3 and the capsule keeps one calm height.
        child: LayoutBuilder(
          builder: (context, box) => IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ConstrainedBox(
                  constraints: BoxConstraints(minWidth: box.maxWidth * creditsMinShare, maxWidth: box.maxWidth * creditsMaxShare),
                  child: _Door(
                    key: const ValueKey('you-strip-credits'),
                    semanticsLabel: YouCopy.stripCreditsLabel(spoken),
                    onTap: openWallet,
                    padding: const EdgeInsetsDirectional.fromSTEB(MmSpace.s20, MmSpace.s8, MmSpace.s12, MmSpace.s8),
                    child: _Balance(total: total, pools: pools, state: state),
                  ),
                ),
                // The rule between the doors: short and centred, so the capsule reads as one object.
                Center(child: SizedBox(width: 1, height: 24, child: ColoredBox(color: colors.line))),
                Expanded(
                  child: _Door(
                    key: const ValueKey('you-strip-plan'),
                    semanticsLabel: isPro ? YouCopy.stripProLabel(proNote) : (billingOn ? '${YouCopy.stripFreePlan}. ${ProNudgeCopy.gateAction}. ${YouCopy.stripOpensPro}' : YouCopy.stripFreeLabel),
                    onTap: openPlan,
                    padding: const EdgeInsetsDirectional.fromSTEB(MmSpace.s16, MmSpace.s8, MmSpace.s20, MmSpace.s8),
                    child: isPro ? _ProPlan(note: proNote) : _FreePlan(upgrade: billingOn),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One door of the capsule: the whole half is the target, it sinks to the sunken fill while pressed (no scale: the
/// capsule stays one still object) and draws the focus ring for the keyboard.
class _Door extends StatelessWidget {
  const _Door({super.key, required this.semanticsLabel, required this.onTap, required this.padding, required this.child});

  final String semanticsLabel;
  final VoidCallback onTap;
  final EdgeInsetsGeometry padding;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      onTap: onTap,
      semanticsLabel: semanticsLabel,
      haptic: MmPressHaptic.selection,
      pressedScale: 1,
      lift: false,
      focusRadius: MmRadius.pillAll,
      builder: (context, pressed, focused) => ColoredBox(
        color: pressed ? colors.sunken : colors.raised.withValues(alpha: 0),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: YouPlanStrip.minHeight),
          // As wide as its words where the row lets it be (the balance door), the whole half otherwise.
          child: Padding(padding: padding, child: Align(alignment: AlignmentDirectional.centerStart, widthFactor: 1, child: child)),
        ),
      ),
    );
  }
}

/// The balance in words: "108 credits", the number in the title cut. An older server's two pools are said as they
/// come; a balance that has not loaded says so under the word "Credits", never a 0.
class _Balance extends StatelessWidget {
  const _Balance({required this.total, required this.pools, required this.state});

  final int? total;
  final ({int practice, int ai})? pools;
  final String state;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final n = total;
    if (n != null) {
      return Text.rich(
        TextSpan(children: [
          TextSpan(
            text: '$n',
            style: type.title.copyWith(fontSize: 22, height: 1.15, color: colors.ink, fontFeatures: const [FontFeature.tabularFigures()]),
          ),
          TextSpan(text: ' ${YouCopy.stripBalanceWord(n)}', style: type.label.copyWith(fontSize: 14, color: colors.ink2)),
        ]),
        maxLines: 2,
      );
    }
    final two = pools;
    if (two != null) {
      // One pool to a line, so neither figure is split from its words.
      final style = type.label.copyWith(color: colors.ink);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [Text(YouCopy.planPracticePool(two.practice), style: style), Text(YouCopy.planAiPool(two.ai), style: style)],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(YouCopy.stripCredits, style: type.labelLarge.copyWith(color: colors.ink)),
        Text(state, style: type.caption.copyWith(color: colors.ink3)),
      ],
    );
  }
}

class _FreePlan extends StatelessWidget {
  const _FreePlan({required this.upgrade});

  /// Google Play is on, so the Pro page can open.
  final bool upgrade;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (!upgrade) return Text(YouCopy.stripFreePlan, style: type.labelLarge.copyWith(color: colors.ink));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(YouCopy.stripFreePlan, style: type.caption.copyWith(color: colors.ink2)),
        Text(ProNudgeCopy.gateAction, style: type.labelLarge.copyWith(color: colors.accentText, fontWeight: FontWeight.w700)),
      ],
    );
  }
}

class _ProPlan extends StatelessWidget {
  const _ProPlan({required this.note});

  final String note;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Wrap(
      spacing: MmSpace.s8,
      runSpacing: MmSpace.s4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        // Pro as a small accent word on its own faint wash (the web capsule's plan word).
        DecoratedBox(
          decoration: BoxDecoration(color: MmLight.washColor(context), borderRadius: BorderRadius.circular(6)),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            child: Text(YouCopy.stripPro, style: type.label.copyWith(fontSize: 12.5, height: 1.1, color: colors.accentText, fontWeight: FontWeight.w800)),
          ),
        ),
        Text(note, style: type.caption.copyWith(color: colors.ink2)),
      ],
    );
  }
}

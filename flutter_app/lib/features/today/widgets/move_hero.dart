// Tonight's move: the subject's object in lamp light (or Mobi at a human moment), one
// monumental number and what it means, the evidence one tap away, a duration chooser when the
// task can change size, and the screen's one volt pill. The number sits beside the object, so
// the card reads top to bottom without a hole; changing the duration rolls the number and
// reshapes the task in place without moving the pill.
import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/domain/next_move.dart' show NextMoveState;
import '../../../core/motion/flight.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/key_button_motion.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../copy_glance.dart';
import '../logic/move_price.dart' show quoteQueryFor;
import '../logic/today_model.dart';
import 'hero_stage.dart';
import 'number_block.dart';
import 'length_pill.dart';
import 'today_pill.dart';
import 'today_entrance.dart';
import 'today_type.dart';

class MoveHeroCard extends StatefulWidget {
  const MoveHeroCard({
    super.key,
    required this.move,
    required this.onAction,
    this.onMinutes,
    this.onShowMe,
    this.offline = false,
    this.retrying = false,
    this.mobiController,
    this.primaryKey,
    this.controlsKey,
    this.keyPulse,
    this.choices = const [],
    this.onMore,
    this.price,
  });

  final MoveHero move;

  /// What the key costs, in the server's own numbers ("Each repair uses 1 AI credit. You have
  /// 38."), or null while it is not known (then the line's place is kept, empty).
  final String? price;

  /// The other moves (TODAY-1018 6.1), shown under the card as the Suggested stack (D51): when
  /// there are any, the card takes its 1018 form (the value line and the price line). Empty keeps
  /// the older pills (a failed read's Practise anyway).
  final List<MoveChoice> choices;

  /// The alternatives sheet is offered under the card (in the Suggested stack): the card's body
  /// swaps in place when a suggested card is chosen.
  final VoidCallback? onMore;
  final void Function(TodayAction action) onAction;
  final ValueChanged<int>? onMinutes;
  final VoidCallback? onShowMe;
  final bool offline;

  /// A Try again read is running: a key that retries shows it is working.
  final bool retrying;

  /// Lets the screen make Mobi react later (a tap on a chip, coming back to the tab).
  final MobiController? mobiController;

  /// On the primary key, so the screen can tell whether it is in view (when it is not, the bar's
  /// capsule carries tonight's move).
  final GlobalKey? primaryKey;

  /// On the length selector, so the screen knows where the card's other controls are.
  final GlobalKey? controlsKey;

  /// A short pulse (0 to 1 to 0 over 160 ms) the screen plays on the primary key when it comes
  /// back into view after the bar's capsule stood in for it.
  final Animation<double>? keyPulse;

  /// Mobi never speaks in a bubble on Today (TODAY-1017 4.6): the title carries the words.
  static String? moodLine(MoveHero m) => null;

  @override
  State<MoveHeroCard> createState() => _MoveHeroCardState();
}

class _MoveHeroCardState extends State<MoveHeroCard> with SingleTickerProviderStateMixin {
  /// The hero object's answer to touch and to the duration chip, and the stage light that swells
  /// with it (full on a tap, 60% on a chip change, timed with the number's roll).
  late final HeroReact _react = HeroReact(vsync: this);

  @override
  void didUpdateWidget(MoveHeroCard old) {
    super.didUpdateWidget(old);
    final was = old.move.selectedMinutes;
    final now = widget.move.selectedMinutes;
    if (was != null && now != null && was != now && !Motion.reduced(context)) _react.fire(HeroReact.chipAmplitude);
  }

  @override
  void dispose() {
    _react.dispose();
    super.dispose();
  }

  void _touchObject() {
    // The object's own reaction gives the light tick; reduced motion keeps the tick, not the motion.
    _react.fire(1, animate: !Motion.reduced(context));
  }

  @override
  Widget build(BuildContext context) {
    final move = widget.move;
    final onAction = widget.onAction;
    final onMinutes = widget.onMinutes;
    final onShowMe = widget.onShowMe;
    final offline = widget.offline;
    final retrying = widget.retrying;
    final mobiController = widget.mobiController;
    final primaryKey = widget.primaryKey;
    final colors = context.mmColors;
    final type = context.mmType;
    final m = move;
    final mobi = m.art.isMobi;
    final blocked = offline && m.primary.startsSession;
    // A scheduled first check ("Your check is set for 8:00 PM.") is supporting detail: it sits
    // under the body copy, not between the title and the number.
    final headlineBelow = m.state == NextMoveState.newUser && m.headline != null;
    // A failed read says so in full contrast; every other body is the quieter second ink.
    final bodyColor = m.state == NextMoveState.historyUnavailable ? colors.ink : colors.ink2;
    // Beside the art box (the object, or Mobi at a real moment): the overline, the subject and the
    // number keep clear of it.
    const besideArt = heroArtClear - MmSpace.cardPadding;

    final top = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // A failed read has no overline: the bubble and the line under it already say so.
        if (m.overline.isNotEmpty)
          _OneLine(m.overline, style: type.caption.copyWith(color: colors.ink2, fontWeight: FontWeight.w600, letterSpacing: 0.2)),
        if (m.title != null) ...[
          if (m.overline.isNotEmpty) const SizedBox(height: MmSpace.s6),
          // The move's own title (TODAY-1018): two lines beside the object where it fits, a third when it takes one, and
          // never an ellipsis: a title cut to "Practise your weakest cha..." or "...did no..." lost the words that said
          // what the card is (v15.1 walk, 360 dp). The titles are our own short words, so the card only grows by a line.
          Semantics(
            header: true,
            child: Text(m.title!, style: type.title.copyWith(fontSize: 22, height: 27 / 22, color: colors.ink)),
          ),
        ] else if (m.subjectLine != null) ...[
          if (m.overline.isNotEmpty) const SizedBox(height: MmSpace.s4),
          // The subject is the stage's title: headline size, one line. Beside the object it keeps
          // the art's 12 dp of air (heroArtClear) and scales down rather than run into it.
          _OneLine(m.subjectLine!, style: type.headline),
        ],
      ],
    );
    final lines = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(right: besideArt),
          child: top,
        ),
        if (m.headline != null && !headlineBelow) ...[
          const SizedBox(height: MmSpace.s8),
          Padding(
            padding: EdgeInsets.only(right: besideArt),
            child: Semantics(header: true, child: Text(m.headline!, style: type.stageLead.copyWith(color: colors.ink))),
          ),
        ],
        if (m.number != null) ...[
          const SizedBox(height: MmSpace.s12),
          // The number stands clear of the object; its meaning goes beside it only when both
          // fit that column, otherwise under it on one line (where the object has ended).
          LayoutBuilder(
            builder: (context, box) => NumberBlock(
              number: m.number!,
              label: m.numberLabel,
              besideWidth: box.maxWidth - besideArt,
              // One figure per state and subject: a rebuilt hero rolls on from the count it showed.
              memoryKey: widget.choices.isEmpty ? 'today.hero.${m.state.name}.${m.subjectId ?? 'none'}' : 'today.hero.lead',
            ),
          ),
        ],
        // The value line (TODAY-1018 section 3): what the mistakes cost, and the length as a token
        // that opens the lengths.
        if (widget.choices.isNotEmpty && (m.valueLine != null || m.durations.length > 1)) ...[
          const SizedBox(height: MmSpace.s12),
          KeyedSubtree(
            key: widget.controlsKey,
            child: _ValueLine(
              text: m.valueLine,
              minutes: m.durations.length > 1 ? (m.selectedMinutes ?? m.durations.first.minutes) : null,
              exact: m.durations.length > 1 && _chosen(m).fullMock,
              onLength: onMinutes == null || m.durations.length < 2
                  ? null
                  : (pillContext) async {
                      final picked = await LengthPill.openPanel(
                        pillContext,
                        durations: m.durations,
                        selected: m.selectedMinutes ?? m.durations.first.minutes,
                        title: _lengthTitle(m),
                        quote: quoteQueryFor(m),
                      );
                      if (picked != null && picked != m.selectedMinutes) onMinutes(picked);
                    },
            ),
          ),
        ],
      ],
    );

    final evidence = (m.evidenceId != null || m.whyAction != null) && onShowMe != null;
    // The move can change size: its length is the pill beside the key.
    final sized = m.durations.length > 1;
    final content = Padding(
      // The card's own rhythm (SPACING.md 3.2): 20 at the top and 20 at the bottom.
      padding: const EdgeInsets.all(MmSpace.cardPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          lines,
          // The value line's token carries its own touch margin, so the gap under it is smaller.
          SizedBox(height: widget.choices.isNotEmpty && (m.valueLine != null || m.durations.length > 1) ? MmSpace.s12 : (mobi ? MmSpace.s12 : MmSpace.s8)),
          // First the number, then the details (Revolut's staging): the evidence rises in after.
          TodayEnter(
            delay: const Duration(milliseconds: 260),
            rise: 8,
            // With no number beside the art (a failed read), the words keep clear of the art box.
            child: Padding(
              padding: EdgeInsets.only(right: m.number == null ? besideArt : 0),
              child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // The line under the number changes with the length ("3 of the 4 open mistakes"
                // to "Every open mistake"): the words overlap on the shared rule and the card's
                // height eases with a second line instead of jumping. "Show me" ends the sentence
                // as its link, so the evidence is one tap away without a control of its own.
                MmSizeEase(
                  duration: Motion.ui,
                  curve: Motion.out,
                  alignment: Alignment.topLeft,
                  clipBehavior: Clip.none,
                  child: MmOverlapSwitcher.fade(
                    alignment: Alignment.topLeft,
                    child: evidence
                        ? MeaningWithShowMe(key: ValueKey(m.meaning), text: m.meaning, color: bodyColor, marks: m.evidence, onShowMe: onShowMe, link: m.whyLink ?? TodayCopy.seeWhy)
                        : Text(m.meaning, key: ValueKey(m.meaning), style: type.body.copyWith(color: bodyColor)),
                  ),
                ),
                if (headlineBelow) ...[
                  const SizedBox(height: MmSpace.s8),
                  Text(m.headline!, style: type.caption.copyWith(color: colors.ink2)),
                ],
                if (m.basisLine != null) ...[
                  const SizedBox(height: MmSpace.s8),
                  // "Tried again at 10:41 PM. Still not loading.": a new time cross-fades in, so a
                  // repeated Try again visibly ran (L01).
                  MmOverlapSwitcher.fade(
                    alignment: Alignment.topLeft,
                    child: Text(m.basisLine!, key: ValueKey(m.basisLine), style: type.caption.copyWith(color: colors.ink3)),
                  ),
                ],
              ],
            ),
            ),
          ),
          const SizedBox(height: MmSpace.s16),
          // Offline, the reason stands above the key where the eye is, not under it (that part
          // of the card sits behind the dock at rest).
          // It opens and closes with the connection instead of cutting in above the key.
          KeyReveal(show: blocked, child: const Padding(padding: EdgeInsets.only(bottom: MmSpace.s8), child: _NeedsConnection())),
          // One primary: the key says the verb and, in the same key, the length at a quieter weight
          // ("Start repair  15 min", TODAY-1017 4.2). Two outlined pills under it: Change length
          // (or the move's alternate) and Something else.
          LayoutBuilder(
            key: primaryKey,
            builder: (context, box) => _Pulse(
              pulse: widget.keyPulse,
              child: KeyButton(
                label: TodayCopy.keyVerb(m.primary.label),
                detail: TodayCopy.keyLength(m.primary.label),
                semanticsLabel: m.primary.label,
                onPressed: blocked
                    ? null
                    : () {
                        // The card grows into the page it opens (MOTION.md C4): the router's
                        // container pages take this rect; any other page ignores it. Its object
                        // flies on into the page when that page shows the same subject (M2).
                        if (m.primary.target is GoTo) {
                          MmLaunchRect.capture(context);
                          if (!mobi && m.subjectId != null) MmFlight.launch(this.context, m.subjectId);
                        }
                        onAction(m.primary);
                      },
                loading: retrying && m.primary.target is RetryLoad,
              ),
            ),
          ),
          // The price, before the press (W-060): its line's place is held from the first frame, so
          // a quote that lands a moment later never moves the card.
          if (widget.choices.isNotEmpty && m.kind != MoveKind.failure && m.kind != MoveKind.done && m.state != NextMoveState.historyUnavailable) ...[
            const SizedBox(height: MmSpace.s8),
            ConstrainedBox(
              constraints: BoxConstraints(minHeight: MediaQuery.textScalerOf(context).scale(13) * 18 / 13),
              child: MmOverlapSwitcher.fade(
                alignment: Alignment.topLeft,
                child: Text(widget.price ?? '', key: ValueKey(widget.price), style: type.caption.copyWith(fontSize: 13, height: 18 / 13, color: colors.ink2)),
              ),
            ),
          ],
          if (widget.choices.isEmpty && (sized || m.alternate != null || m.secondary != null)) ...[
            const SizedBox(height: MmSpace.s12),
            KeyedSubtree(
              key: widget.controlsKey,
              child: Row(
                children: [
                  if (sized)
                    Expanded(
                      child: Builder(
                        builder: (pillContext) => TodayPill(
                          label: TodayCopy.changeLength,
                          icon: LucideIcons.clock3,
                          semanticsLabel: TodayCopy.lengthPillSemantics(_lengthTitle(m), TodayCopy.lengthWords(_chosen(m))),
                          onTap: onMinutes == null
                              ? null
                              : () async {
                                  final picked = await LengthPill.openPanel(
                                    pillContext,
                                    durations: m.durations,
                                    selected: m.selectedMinutes ?? m.durations.first.minutes,
                                    title: _lengthTitle(m),
                                    quote: quoteQueryFor(m),
                                  );
                                  if (picked != null && picked != m.selectedMinutes) onMinutes(picked);
                                },
                        ),
                      ),
                    )
                  else if (m.alternate != null)
                    Expanded(
                      child: TodayPill(
                        label: m.alternate!.label,
                        icon: LucideIcons.bookCheck,
                        onTap: offline && m.alternate!.startsSession ? null : () => onAction(m.alternate!),
                      ),
                    ),
                  if ((sized || m.alternate != null) && m.secondary != null) const SizedBox(width: 10),
                  if (m.secondary != null)
                    Expanded(
                      child: TodayPill(
                        label: m.secondary!.label,
                        icon: _secondaryIcon(m.secondary!),
                        onTap: offline && m.secondary!.startsSession ? null : () => onAction(m.secondary!),
                      ),
                    ),
                ],
              ),
            ),
          ],
          // A dismissed move says until when, quietly, under the pills; it eases in and out.
          MmSizeEase(
            duration: Motion.ui,
            curve: Motion.out,
            alignment: Alignment.topCenter,
            clipBehavior: Clip.none,
            child: m.caption != null || m.dismissedLine != null
                ? Padding(
                    padding: const EdgeInsets.only(top: MmSpace.s8),
                    child: Text(m.dismissedLine ?? m.caption!, textAlign: TextAlign.center, style: type.caption.copyWith(color: colors.ink3)),
                  )
                : const SizedBox(width: double.infinity),
          ),
        ],
      ),
    );

    final swapKey = ValueKey('${m.choiceKey}:${m.kind.name}:${m.subjectId}');
    final art = mobi
        ? _MobiArt(pose: HeroArtView.poseFor(m.art.art), controller: mobiController)
        : HeroArtView(art: m.art, react: _react, onTap: _touchObject);
    if (widget.choices.isEmpty && widget.onMore == null) {
      return HeroStage(subjectId: m.subjectId, react: _react, art: art, child: content);
    }
    return HeroStage(
      subjectId: m.subjectId,
      react: _react,
      // The art box has a fixed size: the outgoing object keeps the whole box while it leaves.
      art: MoveSwap(fill: true, child: KeyedSubtree(key: swapKey, child: art)),
      // A suggested card swaps the body in place (6.2): the old one drops 6 dp and blurs out in
      // 140 ms, the new one rises in over 240 ms, and the card's height eases between them. The
      // card ends at its price line: the other moves are the Suggested stack under it (D51).
      child: MmSizeEase(
        duration: Motion.ui,
        curve: Motion.out,
        alignment: Alignment.topCenter,
        clipBehavior: Clip.none,
        child: MoveSwap(child: KeyedSubtree(key: swapKey, child: content)),
      ),
    );
  }
}

/// The swap between two moves: the outgoing body fades, blurs 2 px and drops 6 dp in 140 ms; the
/// incoming one rises into place in 240 ms. Reduced motion swaps at once.
class MoveSwap extends StatelessWidget {
  const MoveSwap({super.key, required this.child, this.fill = false});

  final Widget child;

  /// The outgoing child keeps the whole box (a fixed-size box such as the art corner), instead of
  /// its own height from the top (the body, whose height eases).
  final bool fill;

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    return AnimatedSwitcher(
      duration: reduced ? Duration.zero : const Duration(milliseconds: 240),
      reverseDuration: reduced ? Duration.zero : const Duration(milliseconds: 140),
      switchInCurve: const Cubic(0.23, 1, 0.32, 1),
      switchOutCurve: Motion.leave,
      layoutBuilder: (current, previous) => Stack(
        alignment: Alignment.topCenter,
        children: [
          for (final p in previous) fill ? Positioned.fill(child: p) : Positioned(left: 0, right: 0, top: 0, child: p),
          ?current,
        ],
      ),
      transitionBuilder: (child, animation) => AnimatedBuilder(
        animation: animation,
        child: child,
        builder: (context, child) {
          final t = animation.value.clamp(0.0, 1.0);
          final leaving = animation.status == AnimationStatus.reverse || animation.status == AnimationStatus.dismissed;
          // In: rises from 6 dp below. Out: drops 6 dp as it goes.
          final dy = leaving ? (1 - t) * 6 : (1 - t) * 6;
          final blur = (1 - t) * 2;
          Widget out = Opacity(opacity: t, child: Transform.translate(offset: Offset(0, dy), child: child));
          if (blur > 0.05) out = ImageFiltered(imageFilter: ImageFilter.blur(sigmaX: blur, sigmaY: blur), child: out);
          return out;
        },
      ),
      child: child,
    );
  }
}

/// "24 marks they cost you" with its figure in ink, and the length token beside it.
class _ValueLine extends StatelessWidget {
  const _ValueLine({this.text, this.minutes, this.exact = false, this.onLength});

  final String? text;
  final int? minutes;

  /// The length is exact (a full mock's 60 minutes), so the token drops "about".
  final bool exact;
  final Future<void> Function(BuildContext pillContext)? onLength;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final t = text;
    final style = type.body.copyWith(color: colors.ink2);
    Widget? words;
    if (t != null) {
      final space = t.indexOf(' ');
      final lead = space > 0 && int.tryParse(t.substring(0, space)) != null ? t.substring(0, space) : null;
      words = Text.rich(
        TextSpan(children: [
          if (lead != null)
            TextSpan(text: lead, style: TextStyle(color: colors.ink, fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()])),
          TextSpan(text: lead == null ? t : t.substring(space)),
        ]),
        style: style,
      );
    }
    final m = minutes;
    return Wrap(
      spacing: MmSpace.s12,
      runSpacing: MmSpace.s8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        ?words,
        if (m != null) Builder(builder: (pillContext) => _LengthToken(minutes: m, exact: exact, onTap: onLength == null ? null : () => onLength!(pillContext))),
      ],
    );
  }
}

/// "about 12 min" as a token: the lengths open from it (TODAY-1018 2.1).
class _LengthToken extends StatelessWidget {
  const _LengthToken({required this.minutes, this.exact = false, this.onTap});

  final int minutes;
  final bool exact;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // 36 dp to see, 48 dp to touch: the slop reaches past the pill without taking layout room.
    return MmHitSlop.toTarget(
      visual: 36,
      child: MmPressable(
      onTap: onTap,
      semanticsLabel: exact ? GlanceCopy.lengthTokenExactSemantics(minutes) : GlanceCopy.lengthTokenSemantics(minutes),
      focusRadius: MmRadius.pillAll,
      pressedScale: 0.97,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => Align(
          widthFactor: 1,
          heightFactor: 1,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 100),
            height: 36,
            padding: const EdgeInsets.only(left: MmSpace.s12, right: MmSpace.s8),
            decoration: ShapeDecoration(
              color: pressed ? colors.raised2 : colors.ground.withValues(alpha: colors.isNight ? 0.5 : 0.55),
              shape: StadiumBorder(side: BorderSide(color: colors.lineStrong)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(exact ? GlanceCopy.lengthTokenExact(minutes) : GlanceCopy.lengthToken(minutes), style: type.labelLarge.copyWith(fontSize: 14, fontWeight: FontWeight.w600, color: colors.ink)),
                const SizedBox(width: MmSpace.s4),
                Icon(LucideIcons.chevronsUpDown, size: 14, color: colors.ink2),
              ],
            ),
          ),
        ),
      ),
    );
  }
}


/// The move's sentence with "Show me" as its last words: three small marks for the wrong answers
/// it holds, then the link. The whole sentence is the touch target (at least 48 dp tall), so the
/// link never needs a pill of its own; a screen reader hears the sentence, then what opens.
class MeaningWithShowMe extends StatelessWidget {
  const MeaningWithShowMe({super.key, required this.text, required this.color, required this.onShowMe, this.marks, this.link = TodayCopy.seeWhy});

  /// The link's words at the end of the sentence ("See why", "See all 6").
  final String link;

  final String text;
  final Color color;
  final VoidCallback? onShowMe;
  final List<BubbleState>? marks;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final linkColor = colors.isNight ? colors.volt : colors.accentText;
    final shown = (marks ?? const <BubbleState>[]).take(3).toList();
    return MmPressable(
      semanticsLabel: '$text $link. ${TodayCopy.showMeSemantics}',
      focusRadius: MmRadius.smallAll,
      pressedScale: 0.99,
      haptic: MmPressHaptic.selection,
      onTap: onShowMe,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min, minWidth: double.infinity),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Text.rich(
            TextSpan(
              style: type.body.copyWith(color: color),
              children: [
                TextSpan(text: '$text '),
                // The marks and the words are one unit, so a line break never strands the marks
                // at the end of the sentence with the link alone on the next line.
                WidgetSpan(
                  alignment: PlaceholderAlignment.middle,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      if (shown.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(right: MmSpace.s6),
                          child: BubbleRow(states: shown, bubbleSize: 6, gap: 3),
                        ),
                      Text(
                        link,
                        style: type.body.copyWith(
                          color: pressed ? colors.ink2 : colors.ink,
                          fontWeight: FontWeight.w600,
                          decoration: TextDecoration.underline,
                          decorationColor: linkColor,
                          decorationThickness: 2,
                        ),
                      ),
                    ],
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

/// Why the key is off while the phone is offline: one quiet line with the offline mark.
class _NeedsConnection extends StatelessWidget {
  const _NeedsConnection();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(LucideIcons.wifiOff, size: 14, color: colors.ink2),
        const SizedBox(width: MmSpace.s6),
        Flexible(child: Text(TodayCopy.connectToStart, style: context.mmType.small.copyWith(color: colors.ink2), textAlign: TextAlign.center)),
      ],
    );
  }
}

/// A short label kept to one line: it scales down to fit instead of wrapping mid-word.
class _OneLine extends StatelessWidget {
  const _OneLine(this.text, {required this.style});

  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) => FittedBox(
    fit: BoxFit.scaleDown,
    alignment: Alignment.centerLeft,
    child: Text(text, style: style, maxLines: 1, softWrap: false),
  );
}

/// A short swell on its child (1 to 1.04 to 1), driven by [pulse]; the child when there is none.
class _Pulse extends StatelessWidget {
  const _Pulse({required this.pulse, required this.child});

  final Animation<double>? pulse;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final p = pulse;
    if (p == null) return child;
    return AnimatedBuilder(
      animation: p,
      child: child,
      builder: (context, child) => Transform.scale(scale: 1 + 0.04 * math.sin(math.pi * p.value), child: child),
    );
  }
}

/// What the lengths panel asks.
String _lengthTitle(MoveHero m) => m.durationPrompt ?? (m.durations.first.questions == null ? TodayCopy.repairLength : TodayCopy.practiceLength);

/// The length the key shows.
DurationChoice _chosen(MoveHero m) => m.durations.firstWhere((d) => d.minutes == m.selectedMinutes, orElse: () => m.durations.first);

/// The icon a pill's action reads with.
IconData _secondaryIcon(TodayAction a) => switch (a.target) {
      OpenAlternatives() => LucideIcons.listFilter,
      GoTo() when a.actionType == 'mock' => LucideIcons.fileText,
      _ => LucideIcons.layoutGrid,
    };

/// Mobi in the art box at a real moment (day one, coming back, a failed read): his entrance act
/// once, then the rig's idle; no bubble. The screen's controller lets him answer events.
class _MobiArt extends StatelessWidget {
  const _MobiArt({required this.pose, this.controller});

  final MobiPose pose;
  final MobiController? controller;

  @override
  Widget build(BuildContext context) => Center(
    child: MobiCharacter(
      controller: controller,
      size: 104,
      entrance: pose.act,
      interactive: true,
      seed: 7 + pose.index * 13,
    ),
  );
}

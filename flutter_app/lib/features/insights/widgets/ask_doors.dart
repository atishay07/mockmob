import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/art/art.dart' show HybridBell;
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/repositories/remote_state.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../pro_nudge/copy.dart' show ProReason;
import '../../pro_nudge/pro_nudge.dart' show proNudgesOnProvider, showUpgradeSheetIfOn;
import '../copy.dart';
import '../data/ask_controller.dart';
import '../data/ask_doors.dart';
import '../data/ask_wallet.dart';
import '../data/insights_models.dart';
import 'ask_marks.dart' show InkDots;
import 'ask_prompts.dart' show AskIntent, PromptGlyph;
import 'ask_wallet.dart' show askOneBalanceProvider;
import 'motion_bits.dart';

/// The pieces of Ask Mobi's own screen (ASK-MOBI-1019 option B): Mobi's greeting, the two big
/// stacked doors ("Ask now" and "Ask your record"), the rows that ask on one tap with their price
/// said first, and the credit line at the foot.

/// A raised row on a door: a step lighter than the door on Night and a step deeper on Day.
Color _rowFill(MmColors c) => Color.alphaBlend(c.litTile, c.raised);

// ---- Greeting -----------------------------------------------------------------------------

/// Mobi on his pool of lamp light, and his line beside him in a bubble.
class AskGreeting extends StatelessWidget {
  const AskGreeting({super.key, required this.controller, required this.entrance, required this.line, this.size = 96});

  final MobiController controller;
  final MobiAct entrance;
  final String line;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        MobiStage(controller: controller, size: size, entrance: entrance, bubble: false, interactive: true, semanticLabel: 'Mobi'),
        const SizedBox(width: MmSpace.s8),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: size * 0.28),
            child: CustomPaint(
              painter: _BubbleTail(fill: _rowFill(colors), edge: colors.line),
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  color: _rowFill(colors),
                  shape: RoundedSuperellipseBorder(borderRadius: const BorderRadius.all(Radius.circular(20)), side: BorderSide(color: colors.line)),
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s12, MmSpace.s16, MmSpace.s12),
                  child: Text(line, style: type.body.copyWith(fontWeight: FontWeight.w500, height: 22 / 16)),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// The bubble's small tail, pointing back at Mobi from its lower left.
class _BubbleTail extends CustomPainter {
  const _BubbleTail({required this.fill, required this.edge});

  final Color fill;
  final Color edge;

  @override
  void paint(Canvas canvas, Size size) {
    final y = size.height - 22;
    final path = Path()
      ..moveTo(1, y - 7)
      ..lineTo(-6, y)
      ..lineTo(1, y + 7)
      ..close();
    canvas.drawPath(path, Paint()..color = fill);
    final stroke = Paint()
      ..color = edge
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    canvas.drawPath(Path()..moveTo(0.5, y - 7)..lineTo(-6, y)..lineTo(0.5, y + 7), stroke);
  }

  @override
  bool shouldRepaint(_BubbleTail old) => old.fill != fill || old.edge != edge;
}

// ---- A door --------------------------------------------------------------------------------

/// One big door: a glass panel with its 30 sp headline, a line under it and its own art.
class _Door extends StatelessWidget {
  const _Door({required this.title, required this.children, this.line, this.art});

  final String title;
  final String? line;
  final Widget? art;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return FakeGlass(
      borderRadius: MmRadius.panelAll,
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.cardPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(header: true, child: Text(title, style: type.headline.copyWith(fontSize: 30, height: 32 / 30, letterSpacing: -0.4))),
                      if (line != null) ...[
                        const SizedBox(height: MmSpace.s6),
                        Text(line!, style: type.body.copyWith(color: colors.ink2, height: 22 / 16)),
                      ],
                    ],
                  ),
                ),
                if (art != null) ...[const SizedBox(width: MmSpace.s8), art!],
              ],
            ),
            ...children,
          ],
        ),
      ),
    );
  }
}

// ---- Prices and rows ------------------------------------------------------------------------

/// What an ask costs, before the tap: "Free" in the good ink, "1 credit" quiet, or a Pro lock.
class AskPriceTag extends StatelessWidget {
  const AskPriceTag(this.price, {super.key});

  final DoorPrice price;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final style = context.mmType.label.copyWith(fontSize: 13, height: 18 / 13);
    return switch (price) {
      DoorPrice.free => Text(AskDoorCopy.free, style: style.copyWith(color: colors.goodText)),
      DoorPrice.credit => Text(AskDoorCopy.oneCredit, style: style.copyWith(color: colors.ink3)),
      DoorPrice.pro => DecoratedBox(
          decoration: ShapeDecoration(shape: StadiumBorder(side: BorderSide(color: colors.lineStrong))),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(7, 3, 9, 3),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(LucideIcons.lock, size: 13, color: colors.ink2),
                const SizedBox(width: MmSpace.s4),
                Text(AskDoorCopy.pro, style: style.copyWith(color: colors.ink2)),
              ],
            ),
          ),
        ),
    };
  }
}

/// A row that asks on one tap: the question, one line from the record, the price on the right.
class AskStarterRow extends ConsumerWidget {
  const AskStarterRow({super.key, required this.text, required this.price, required this.onTap, this.preview});

  final String text;
  final String? preview;
  final DoorPrice price;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final priceWord = switch (price) {
      DoorPrice.free => AskDoorCopy.free,
      DoorPrice.credit => AskDoorCopy.oneCredit,
      DoorPrice.pro => 'Part of Pro',
    };
    return MmPressable(
      semanticsLabel: 'Ask: $text. ${preview == null ? '' : '$preview. '}$priceWord',
      focusRadius: const BorderRadius.all(Radius.circular(16)),
      pressedScale: 0.98,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? Color.alphaBlend(colors.litTile, _rowFill(colors)) : _rowFill(colors),
          shape: RoundedSuperellipseBorder(borderRadius: const BorderRadius.all(Radius.circular(16)), side: BorderSide(color: colors.line)),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 52),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(text, style: type.labelLarge.copyWith(color: price == DoorPrice.pro ? colors.ink2 : colors.ink)),
                      if (preview != null) ...[
                        const SizedBox(height: MmSpace.s2),
                        Text(preview!, style: type.caption.copyWith(color: colors.ink3)),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                AskPriceTag(price),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---- Ask now ------------------------------------------------------------------------------

/// The send disc: volt when there is something to send, quiet when there is not, the inking
/// bubbles while a reply is on its way.
class AskSendDisc extends StatelessWidget {
  const AskSendDisc({super.key, required this.enabled, required this.busy, required this.onTap});

  final bool enabled;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmPressable(
      semanticsLabel: busy ? InsightsCopy.askSending : InsightsCopy.askSend,
      onTap: enabled ? onTap : null,
      builder: (context, pressed, _) => SizedBox(
        width: MmTarget.min,
        height: MmTarget.min,
        child: Center(
          child: AnimatedContainer(
            duration: Motion.of(context, Motion.ui),
            curve: Motion.glide,
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: enabled ? colors.volt : colors.sunken,
              border: enabled ? null : Border.all(color: colors.line),
            ),
            child: Center(
              child: busy
                  ? const InkDots(size: 6, settleAfter: Duration(seconds: 12))
                  : Icon(LucideIcons.arrowUp, size: 22, color: enabled ? colors.voltInk : colors.ink3),
            ),
          ),
        ),
      ),
    );
  }
}

/// Door one: any CUET doubt. The field (sent with the keyboard's Send or the disc), the price of
/// what is typed said under it, then starters that send on one tap with no sheet first (D53).
class AskNowDoor extends StatefulWidget {
  const AskNowDoor({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.starters,
    required this.onSend,
    required this.note,
    this.shown = 2,
    this.busy = false,
    this.animate = true,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final List<String> starters;

  /// How many starters show before the field is touched (0 says "Tap the box"); all of them show
  /// once it has had focus.
  final int shown;
  final ValueChanged<String?> onSend;

  /// The price line for what is in the field.
  final String Function(String text) note;
  final bool busy;
  final bool animate;

  @override
  State<AskNowDoor> createState() => _AskNowDoorState();
}

class _AskNowDoorState extends State<AskNowDoor> {
  int _rings = 0;
  bool _open = false;

  @override
  void initState() {
    super.initState();
    widget.focusNode.addListener(_onFocus);
  }

  @override
  void didUpdateWidget(AskNowDoor old) {
    super.didUpdateWidget(old);
    if (old.focusNode != widget.focusNode) {
      old.focusNode.removeListener(_onFocus);
      widget.focusNode.addListener(_onFocus);
    }
  }

  @override
  void dispose() {
    widget.focusNode.removeListener(_onFocus);
    super.dispose();
  }

  void _onFocus() {
    if (!mounted) return;
    setState(() {
      // The bell answers the tap into the field once; every starter then shows.
      if (widget.focusNode.hasFocus) {
        if (!_open) _rings++;
        _open = true;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final focused = widget.focusNode.hasFocus;
    final count = _open ? widget.starters.length : widget.shown.clamp(0, widget.starters.length);
    const fieldRadius = BorderRadius.all(Radius.circular(18));
    return _Door(
      title: AskDoorCopy.nowTitle,
      line: AskDoorCopy.nowLine,
      art: Padding(
        padding: const EdgeInsets.only(top: 0),
        child: HybridBell(height: 64, rings: _rings),
      ),
      children: [
        const SizedBox(height: MmSpace.s16),
        DecoratedBox(
          position: DecorationPosition.foreground,
          decoration: ShapeDecoration(
            shape: RoundedSuperellipseBorder(
              borderRadius: fieldRadius,
              side: BorderSide(color: focused ? colors.focusRing : colors.lineStrong, width: focused ? 1.5 : 1),
            ),
          ),
          child: DecoratedBox(
            decoration: ShapeDecoration(color: colors.sunken, shape: const RoundedSuperellipseBorder(borderRadius: fieldRadius)),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 56),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s2, MmSpace.s4, MmSpace.s2),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: widget.controller,
                        focusNode: widget.focusNode,
                        minLines: 1,
                        maxLines: 4,
                        maxLength: askMaxChars,
                        textCapitalization: TextCapitalization.sentences,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => widget.busy ? null : widget.onSend(null),
                        style: type.body,
                        cursorColor: colors.ink,
                        decoration: InputDecoration(
                          hintText: AskDoorCopy.nowHint,
                          hintStyle: type.body.copyWith(color: colors.ink3),
                          counterText: '',
                          filled: false,
                          isDense: true,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
                        ),
                      ),
                    ),
                    const SizedBox(width: MmSpace.s4),
                    ValueListenableBuilder(
                      valueListenable: widget.controller,
                      builder: (context, value, _) => AskSendDisc(
                        enabled: !widget.busy && value.text.trim().isNotEmpty,
                        busy: widget.busy,
                        onTap: () => widget.onSend(null),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: MmSpace.s8),
        // The price of what is typed, before it is sent: free from the record, or 1 credit.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
          child: ValueListenableBuilder(
            valueListenable: widget.controller,
            builder: (context, value, _) {
              final note = widget.note(value.text);
              return Semantics(
                liveRegion: true,
                child: MmOverlapSwitcher.fade(
                  duration: Motion.crossFade,
                  alignment: Alignment.centerLeft,
                  child: Text(note, key: ValueKey(note), style: type.caption.copyWith(color: colors.ink3)),
                ),
              );
            },
          ),
        ),
        // With no room for a starter (a heavy record at 360 dp, so the record door's figure stays in view),
        // one line says where they are; a tap into the field brings all three.
        const SizedBox(height: MmSpace.s16),
        MmFadeThrough(
          alignment: Alignment.centerLeft,
          child: Text(
            count == 0 ? AskDoorCopy.nowTapBox : AskDoorCopy.nowTip,
            key: ValueKey(count == 0),
            style: type.label.copyWith(color: colors.ink3),
          ),
        ),
        AnimatedSize(
          duration: Motion.of(context, Motion.ui),
          curve: Motion.glide,
          alignment: Alignment.topCenter,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final (i, s) in widget.starters.take(count).indexed) ...[
                const SizedBox(height: MmSpace.s8),
                _maybeRise(
                  i,
                  AskStarterRow(text: s, price: DoorPrice.credit, onTap: () => widget.onSend(s)),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _maybeRise(int i, Widget child) =>
      widget.animate ? RiseIn(key: ValueKey('now-$i'), delay: Duration(milliseconds: 40 * i), dy: MmSpace.s8, duration: Motion.card, child: child) : child;
}

// ---- Ask your record ----------------------------------------------------------------------

/// Door two: questions answered from the student's own papers. It leads with the biggest leak as
/// a big figure; the next asks follow, and the rest open under "See all". A fresh account sees one
/// plain line on what the record needs and one key to start it.
class AskRecordDoor extends StatelessWidget {
  const AskRecordDoor({
    super.key,
    required this.record,
    required this.asks,
    required this.onAsk,
    required this.onPractise,
    required this.onRetry,
    this.expanded = false,
    this.onToggle,
    this.shown = 2,
    this.offline = false,
    this.animate = true,
  });

  final RemoteState<PrepInsights> record;

  /// Every record ask, the lead first ([recordDoorAsks]).
  final List<DoorAsk> asks;
  final ValueChanged<DoorAsk> onAsk;
  final VoidCallback? onPractise;
  final VoidCallback onRetry;
  final bool expanded;
  final VoidCallback? onToggle;

  /// How many asks follow the lead before "See all".
  final int shown;
  final bool offline;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final v = record.value;
    if (v == null) {
      final failed = record.error != null && !record.loading;
      return _Door(
        title: AskDoorCopy.recordTitle,
        children: [
          const SizedBox(height: MmSpace.s12),
          Text(
            failed ? (offline || (record.error?.isOffline ?? false) ? AskDoorCopy.readOffline : AskDoorCopy.readFailed) : AskDoorCopy.reading,
            style: type.body.copyWith(color: colors.ink2, height: 22 / 16),
          ),
          if (failed) ...[
            const SizedBox(height: MmSpace.s12),
            KeyButton.secondary(label: AskDoorCopy.tryAgain, expanded: false, minHeight: MmTarget.min, onPressed: onRetry),
          ],
        ],
      );
    }
    if (!v.isReady) {
      return _Door(
        title: AskDoorCopy.recordTitle,
        children: [
          const SizedBox(height: MmSpace.s12),
          Text(AskDoorCopy.emptySay, style: type.cardTitle),
          const SizedBox(height: MmSpace.s4),
          Text(AskDoorCopy.emptyBody, style: type.body.copyWith(color: colors.ink2, fontSize: 15, height: 21 / 15)),
          if (onPractise != null) ...[
            const SizedBox(height: MmSpace.s16),
            KeyButton.secondary(label: AskDoorCopy.emptyKey, minHeight: 52, onPressed: onPractise),
          ],
          const SizedBox(height: MmSpace.s12),
          Text(AskDoorCopy.emptyAfter, style: type.caption.copyWith(color: colors.ink3)),
        ],
      );
    }
    final lead = asks.first;
    final top = recordLead(v);
    final rest = asks.skip(1).toList();
    final visible = expanded ? rest : rest.take(shown).toList();
    return _Door(
      title: AskDoorCopy.recordTitle,
      line: AskDoorCopy.recordLine(v.sessions),
      children: [
        const SizedBox(height: MmSpace.s16),
        _LeadTile(ask: lead, top: top, onTap: () => onAsk(lead)),
        const SizedBox(height: MmSpace.s16),
        Text(AskDoorCopy.recordTip, style: type.label.copyWith(color: colors.ink3)),
        AnimatedSize(
          duration: Motion.of(context, Motion.ui),
          curve: Motion.glide,
          alignment: Alignment.topCenter,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final (i, a) in visible.indexed) ...[
                const SizedBox(height: MmSpace.s8),
                animate && i < shown
                    ? RiseIn(key: ValueKey('rec-$i'), delay: Duration(milliseconds: 60 + 40 * i), dy: MmSpace.s8, duration: Motion.card, child: _row(a))
                    : _row(a),
              ],
            ],
          ),
        ),
        if (rest.length > shown && onToggle != null) ...[
          const SizedBox(height: MmSpace.s4),
          _SeeAll(label: expanded ? AskDoorCopy.seeFewer : AskDoorCopy.seeAll(asks.length), expanded: expanded, onTap: onToggle!),
        ],
      ],
    );
  }

  Widget _row(DoorAsk a) => AskStarterRow(text: a.text, preview: a.preview, price: a.price, onTap: () => onAsk(a));
}

/// The record door's lead: the question, "Free", and the real figure in Bricolage Condensed.
class _LeadTile extends ConsumerWidget {
  const _LeadTile({required this.ask, required this.top, required this.onTap});

  final DoorAsk ask;
  final RecordLead? top;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final t = top;
    const radius = BorderRadius.all(Radius.circular(18));
    return MmPressable(
      semanticsLabel: t == null
          ? 'Ask: ${ask.text}. ${ask.preview ?? ''}. ${AskDoorCopy.free}'
          : 'Ask: ${ask.text}. ${t.lost} ${AskDoorCopy.leadFigureLine(t.chapter)}. ${AskDoorCopy.free}',
      focusRadius: radius,
      pressedScale: 0.98,
      onTap: () {
        ref.read(hapticsProvider).selection();
        onTap();
      },
      builder: (context, pressed, _) => LitEdge(
        borderRadius: radius,
        child: DecoratedBox(
          decoration: ShapeDecoration(
            color: pressed ? Color.alphaBlend(colors.litTile, colors.sunken) : colors.sunken,
            shape: RoundedSuperellipseBorder(borderRadius: radius, side: BorderSide(color: colors.lineStrong)),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.s16, 14, MmSpace.s16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: Text(ask.text, style: type.cardTitle.copyWith(letterSpacing: -0.1))),
                    const SizedBox(width: MmSpace.s8),
                    AskPriceTag(ask.price),
                  ],
                ),
                const SizedBox(height: MmSpace.s8),
                if (t != null)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${t.lost}',
                        style: type.figure.copyWith(fontSize: 54, height: 46 / 54, fontFeatures: const [FontFeature.tabularFigures()]),
                      ),
                      const SizedBox(width: MmSpace.s12),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 2),
                          child: Text(AskDoorCopy.leadFigureLine(t.chapter), style: type.small.copyWith(color: colors.ink2, fontSize: 14, height: 19 / 14)),
                        ),
                      ),
                    ],
                  )
                else
                  Row(
                    children: [
                      const PromptGlyph(intent: AskIntent.losing),
                      const SizedBox(width: MmSpace.s12),
                      Expanded(child: Text(ask.preview ?? '', style: type.caption.copyWith(color: colors.ink3))),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SeeAll extends StatelessWidget {
  const _SeeAll({required this.label, required this.expanded, required this.onTap});

  final String label;
  final bool expanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: label,
      onTap: onTap,
      focusRadius: MmRadius.smallAll,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Center(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  style: type.labelLarge.copyWith(
                    color: pressed ? colors.ink2 : colors.ink,
                    decoration: TextDecoration.underline,
                    decorationColor: colors.lineStrong,
                  ),
                ),
              ),
              const SizedBox(width: MmSpace.s4),
              Icon(expanded ? LucideIcons.chevronUp : LucideIcons.chevronDown, size: 18, color: colors.ink2),
            ],
          ),
        ),
      ),
    );
  }
}

// ---- The credit line ------------------------------------------------------------------------

/// The line at the foot of the doors: the real balance and when it renews (a link to the credit
/// details), then what costs what. Every number is the wallet's own; an unknown balance is never a
/// zero, and a pause says so.
class AskCreditLine extends ConsumerWidget {
  const AskCreditLine({super.key, required this.onTap, this.bottomInset = 0});

  final VoidCallback onTap;
  final double bottomInset;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final wallet = ref.watch(askWalletProvider);
    final one = ref.watch(askOneBalanceProvider);
    final renew = renewDay(wallet, ref.watch(nowProvider)());
    final (first, second) = creditLineWords(wallet, renew: renew, oneBalance: one);
    final base = type.caption.copyWith(color: colors.ink3);
    return DecoratedBox(
      decoration: BoxDecoration(color: colors.ground, border: Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter + 2, MmSpace.s4, MmSpace.gutter + 2, MmSpace.s12 + bottomInset),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            MmPressable(
              semanticsLabel: '$first ${InsightsCopy.creditDetails}',
              onTap: onTap,
              focusRadius: MmRadius.smallAll,
              haptic: MmPressHaptic.selection,
              builder: (context, pressed, _) => ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 32),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: MmOverlapSwitcher.fade(
                    duration: Motion.of(context, const Duration(milliseconds: 160)),
                    alignment: Alignment.centerLeft,
                    child: Text(
                      first,
                      key: ValueKey(first),
                      style: base.copyWith(
                        color: pressed ? colors.ink3 : colors.ink2,
                        decoration: TextDecoration.underline,
                        decorationColor: colors.lineStrong,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Text(second, style: base),
          ],
        ),
      ),
    );
  }
}

/// The two lines of the credit line, from the wallet: "38 of your 50 monthly credits left. They
/// renew on 1 November." then what costs what. "Of your 50 monthly" is said only when it is true:
/// a known monthly allowance and nothing bought beside it.
(String, String) creditLineWords(AskWallet? wallet, {required String renew, bool oneBalance = false}) {
  if (wallet?.paused ?? false) return (AskDoorCopy.creditsPaused, AskDoorCopy.pausedSecond);
  final total = wallet?.total;
  if (total == null) return (AskDoorCopy.creditsUnknown, AskDoorCopy.howItCosts);
  if (total == 0) return ('${AskDoorCopy.creditsNone} ${AskDoorCopy.renews(renew)}', AskDoorCopy.howItCostsNone);
  final monthly = wallet!.includedMonthly;
  final bought = wallet.bonus ?? 0;
  if (!oneBalance && monthly != null && bought == 0 && total <= monthly) {
    return ('${AskDoorCopy.creditsOfMonthly(total, monthly)} ${AskDoorCopy.renews(renew)}', AskDoorCopy.howItCosts);
  }
  return ('${AskDoorCopy.creditsLeft(total)} ${AskDoorCopy.freeOnesRenew(renew)}', AskDoorCopy.howItCosts);
}

// ---- Pro, visible but locked (D101) ----------------------------------------------------------

/// A Pro ask was tapped on Free. With Google Play billing on it opens the Upgrade sheet; with it
/// off, a calm sheet says what Pro adds, with no price and no link (anti-steering).
Future<void> showAskProSheet(BuildContext context, AskIntent intent) async {
  final container = ProviderScope.containerOf(context, listen: false);
  final reason = intent == AskIntent.changes ? ProReason.insightsChanges : ProReason.insightsPace;
  if (container.read(proNudgesOnProvider) && showUpgradeSheetIfOn(context, reason: reason)) return;
  final changes = intent == AskIntent.changes;
  await showMmSheet<void>(
    context: context,
    title: changes ? AskDoorCopy.proChangesTitle : AskDoorCopy.proPaceTitle,
    builder: (sheet) {
      final type = sheet.mmType;
      final colors = sheet.mmColors;
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(changes ? AskDoorCopy.proChangesBody : AskDoorCopy.proPaceBody, style: type.body.copyWith(color: colors.ink)),
          const SizedBox(height: MmSpace.s12),
          Text(AskDoorCopy.proSoon, style: type.small.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s24),
          KeyButton.secondary(label: AskDoorCopy.proDone, onPressed: () => Navigator.of(sheet).pop()),
        ],
      );
    },
  );
}

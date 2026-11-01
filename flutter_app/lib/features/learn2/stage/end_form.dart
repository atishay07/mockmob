/// The end of a study session (the web's `EndForm`, `KeptFan` and the feed's end layer; A1 3.9, B2, B7 E; one form
/// for the feed and the run), in one column at most 440 dp wide:
///
///   title     the chapter title (Bricolage 28, tight), then the done line ("All 21 done in 9 min." / "You stopped at
///             8 of 21.", 15.5 ink-2)
///   pile      the kept fan: up to four small real cards (112 x 140, radius 12) fanned by (i - mid) x 7 degrees and
///             (i - mid) x 26 dp, opening in 320 ms on `Motion.drawer` with 40 ms steps one frame after the end is
///             drawn; the top card shows its kind and front (five lines), the others three hairlines; then "3 kept" and
///             the server's line. Nothing kept: its own line.
///   lines     hairline rows: the label (112 dp, semibold ink) and the text (ink-2)
///   keys      the column of keys (10 dp apart), the lead volt key first, a text key centred
///   loading   the end's final shape in skeletons; error: its title and line with Try again (never invented numbers)
///
/// [StageEnd] is the layer the frame shows over itself: Close and the counter at its full count, then the form.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/skeleton.dart';
import '../../keycards/data/keycards_lines.dart' show cardFace;
import '../../keycards/data/keycards_models.dart';
import 'stage_balance.dart';
import 'stage_frame.dart' show StageCounter;
import 'stage_keys.dart';

/// A kept card as the fan draws it: its kind label and its front.
@immutable
class StagePileCard {
  const StagePileCard({required this.label, required this.front, this.id});

  /// From the server's short card (`{ id, kind, front }`): the kind's label and the front as a card shows them.
  factory StagePileCard.of({required String kind, required String front, String? id}) {
    final face = cardFace(KeyCard(id: id ?? 'pile', kind: kind, front: front, back: front));
    return StagePileCard(label: face.label, front: face.front, id: id);
  }

  final String label;
  final String front;
  final String? id;
}

/// What was kept: [count], up to four [cards] for the fan, the server's [line] ("They are first in Revise."), and
/// [none], the line for nothing kept.
@immutable
class StagePile {
  const StagePile({required this.count, this.cards = const [], this.line, this.none});

  final int count;
  final List<StagePileCard> cards;
  final String? line;
  final String? none;
}

/// One hairline row of the end: "Cards" / "12 seen, 3 kept".
typedef StageEndLine = ({String label, String text});

/// A failed end read: "Your feed is saved" / "Its summary did not load."
typedef StageEndError = ({String title, String line});

class EndForm extends StatelessWidget {
  const EndForm({
    super.key,
    required this.title,
    this.done,
    this.pile,
    this.lines = const [],
    this.note,
    this.keys = const [],
    this.loading = false,
    this.error,
    this.onRetry,
    this.retryKeys = const [],
    this.titleKey,
  });

  final String title;
  final String? done;
  final StagePile? pile;
  final List<StageEndLine> lines;

  /// A quiet line over the keys (Free's limit, with its own "See Pro").
  final Widget? note;

  /// The keys, the lead volt key first (`StageStepKey`, `StageTextKey`).
  final List<Widget> keys;
  final bool loading;
  final StageEndError? error;
  final VoidCallback? onRetry;

  /// Keys under Try again ("Back to Explore").
  final List<Widget> retryKeys;

  /// On the title, which takes the screen reader's focus when the end comes into view.
  final GlobalKey? titleKey;

  static const double maxWidth = 440;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // The app's moment headline at 28: its own tracking and word air, so the letters never touch.
    final titleStyle = type.headline.copyWith(fontSize: 28, height: 1.12, color: colors.ink);
    final quiet = type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2);

    if (loading) {
      return Semantics(
        label: 'Adding it up',
        liveRegion: true,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: maxWidth),
          child: const SkeletonGroup(
            label: 'Adding it up',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FractionallySizedBox(widthFactor: 0.6, child: Skeleton(height: 32, radius: 10)),
                SizedBox(height: 18),
                Skeleton(height: 156, radius: 10),
                SizedBox(height: 18),
                Skeleton(height: 44, radius: 10),
                SizedBox(height: 18),
                Skeleton(height: 44, radius: 10),
                SizedBox(height: 18),
                Skeleton(height: 52, radius: 10),
                SizedBox(height: 18),
                Skeleton(height: 52, radius: 10),
              ],
            ),
          ),
        ),
      );
    }

    final err = error;
    if (err != null) {
      return ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: maxWidth),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Semantics(key: titleKey, header: true, child: StageBalancedText(TextSpan(text: err.title, style: titleStyle))),
            const SizedBox(height: 22),
            Text(err.line, style: quiet),
            const SizedBox(height: 22),
            StageStepKey(label: 'Try again', onTap: onRetry),
            for (final k in retryKeys) ...[const SizedBox(height: 10), Center(child: k)],
          ],
        ),
      );
    }

    final p = pile;
    final main = <Widget>[
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(key: titleKey, header: true, child: StageBalancedText(TextSpan(text: title, style: titleStyle))),
          if (done != null) ...[
            const SizedBox(height: MmSpace.s8),
            Text(done!, style: type.body.copyWith(fontSize: 15.5, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2)),
          ],
        ],
      ),
      if (p != null && p.count > 0)
        Column(
          children: [
            StageKeptFan(cards: p.cards),
            const SizedBox(height: MmSpace.s12),
            Text('${p.count} kept', textAlign: TextAlign.center, style: quiet.copyWith(height: 1.45, fontWeight: FontWeight.w700, color: colors.ink)),
            if (p.line != null && p.line!.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(p.line!, textAlign: TextAlign.center, style: quiet.copyWith(height: 1.45)),
            ],
          ],
        )
      else if (p != null && p.none != null)
        Text(p.none!, style: quiet),
      if (lines.isNotEmpty) _Lines(lines: lines),
    ];
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: maxWidth),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final (i, m) in main.indexed) ...[
            if (i > 0) const SizedBox(height: 22),
            m,
          ],
          if (note != null || keys.isNotEmpty) const SizedBox(height: 22),
          if (note != null) ...[note!, if (keys.isNotEmpty) const SizedBox(height: 10)],
          for (final (i, k) in keys.indexed) ...[
            if (i > 0) const SizedBox(height: 10),
            k is StageTextKey ? Center(child: k) : k,
          ],
        ],
      ),
    );
  }
}

/// The hairline rows: a 1 dp line above each row and under the last, 11 dp padding.
class _Lines extends StatelessWidget {
  const _Lines({required this.lines});

  final List<StageEndLine> lines;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final text = type.body.copyWith(fontSize: 15, height: 1.45, fontWeight: FontWeight.w500, color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, l) in lines.indexed)
          DecoratedBox(
            decoration: BoxDecoration(
              border: Border(
                top: BorderSide(color: colors.line),
                bottom: i == lines.length - 1 ? BorderSide(color: colors.line) : BorderSide.none,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 11),
              child: MergeSemantics(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(width: 112, child: Text(l.label, style: text.copyWith(fontWeight: FontWeight.w600, color: colors.ink))),
                    const SizedBox(width: MmSpace.s12),
                    Expanded(child: Text(l.text, style: text)),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// The kept fan (the web's `KeptFan`): up to four small cards, fanned open one frame after they are drawn.
class StageKeptFan extends StatefulWidget {
  const StageKeptFan({super.key, required this.cards, this.open = true});

  final List<StagePileCard> cards;

  /// False holds the fan closed (a screen that opens it itself).
  final bool open;

  static const double height = 156;
  static const double cardWidth = 112;
  static const double cardHeight = 140;
  static const Duration step = Duration(milliseconds: 40);
  static const Duration duration = Duration(milliseconds: 320);

  @override
  State<StageKeptFan> createState() => _StageKeptFanState();
}

class _StageKeptFanState extends State<StageKeptFan> with SingleTickerProviderStateMixin {
  late final AnimationController _open = AnimationController(vsync: this, duration: StageKeptFan.duration + StageKeptFan.step * 3);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  @override
  void didUpdateWidget(StageKeptFan old) {
    super.didUpdateWidget(old);
    if (widget.open != old.open) _start();
  }

  void _start() {
    if (!mounted) return;
    if (!widget.open) {
      _open.value = 0;
    } else if (Motion.reduced(context)) {
      _open.value = 1;
    } else if (_open.value < 1 && !_open.isAnimating) {
      _open.forward();
    }
  }

  @override
  void dispose() {
    _open.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final shown = widget.cards.take(4).toList();
    final mid = (shown.length - 1) / 2;
    final total = _open.duration!.inMicroseconds;
    return ExcludeSemantics(
      child: SizedBox(
        height: StageKeptFan.height,
        width: double.infinity,
        child: AnimatedBuilder(
          animation: _open,
          builder: (context, _) => Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.topCenter,
            children: [
              for (final (i, c) in shown.indexed)
                Positioned(
                  top: 6,
                  child: Builder(
                    builder: (context) {
                      final start = StageKeptFan.step.inMicroseconds * i / total;
                      final span = StageKeptFan.duration.inMicroseconds / total;
                      final t = Motion.drawer.transform(((_open.value - start) / span).clamp(0.0, 1.0));
                      final k = (i - mid) * t;
                      return Transform.translate(
                        offset: Offset(26 * k, 0),
                        child: Transform.rotate(
                          angle: 7 * k * math.pi / 180,
                          alignment: const Alignment(0, 0.8),
                          child: _PileCard(card: c, top: i == shown.length - 1),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PileCard extends StatelessWidget {
  const _PileCard({required this.card, required this.top});

  final StagePileCard card;
  final bool top;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Container(
      width: StageKeptFan.cardWidth,
      height: StageKeptFan.cardHeight,
      padding: const EdgeInsets.fromLTRB(11, 11, 11, 12),
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.lineStrong),
        boxShadow: colors.cardShadow,
      ),
      child: top
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(card.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: type.label.copyWith(fontSize: 12, height: 1.2, color: colors.ink3)),
                const SizedBox(height: 6),
                Flexible(
                  child: Text(
                    card.front.replaceAll(RegExp(r'_{3,}'), '____'),
                    maxLines: 5,
                    overflow: TextOverflow.ellipsis,
                    style: type.title.copyWith(fontSize: 13, height: 1.28, letterSpacing: 0, wordSpacing: 0, color: colors.ink),
                  ),
                ),
              ],
            )
          : Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final (i, w) in [1.0, 1.0, 0.62].indexed) ...[
                    if (i > 0) const SizedBox(height: 10),
                    FractionallySizedBox(widthFactor: w, child: SizedBox(height: 1, child: ColoredBox(color: colors.lineStrong))),
                  ],
                ],
              ),
            ),
    );
  }
}

/// The end's layer over the stage: Close and the counter at its full count in a row at most 440 dp wide, 12 dp
/// above the [child] (an `EndForm`); the whole block centred in the screen and scrolling when it is taller.
class StageEnd extends StatelessWidget {
  const StageEnd({super.key, required this.onClose, required this.child, this.closeLabel = 'Close', this.position, this.of});

  final VoidCallback onClose;
  final String closeLabel;
  final int? position;
  final int? of;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final pad = MediaQuery.paddingOf(context);
    final top = pad.top + 16;
    final bottom = pad.bottom + 28;
    return ColoredBox(
      color: colors.ground,
      child: LayoutBuilder(
        builder: (context, c) => SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(MmSpace.gutter, top, MmSpace.gutter, bottom),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: math.max(0, c.maxHeight - top - bottom)),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: EndForm.maxWidth),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Transform.translate(offset: const Offset(-10, 0), child: StageCloseKey(onTap: onClose, semanticsLabel: closeLabel)),
                        const Spacer(),
                        if (position != null && of != null) StageCounter(position: position!, of: of!),
                      ],
                    ),
                    const SizedBox(height: MmSpace.s12),
                    child,
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

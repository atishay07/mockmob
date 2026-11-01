/// The study stage's frame on a phone (the web's `Stage`, `TopBar`, `KeptCount`, `ActionBar`; A1 3.2-3.6, B7):
///
///   top bar     solid ground, nothing scrolls under it: the ticks (safe top + 10), then a 44 dp row 6 dp lower with
///               Close, the title (or a note for 2.4 s), the kept count and the counter ("3 of 21", a button that
///               opens "This feed" when [StageFrame.onCounter] is set)
///   item area   12 dp above and below; the screen puts its `StagePager` here
///   action bar  solid ground: `56 | 1fr | 56`, 12 dp gaps, 6 top, 16 at the sides, the safe bottom + 8; the side
///               keys left and right and the step slot in the middle; [StageFrame.wide] (the checkpoint) gives the
///               middle the whole row for two keys
///   end         its own layer over the frame (`StageEnd`); the frame fades out under it in 200 ms
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/hit_slop.dart';
import 'stage_keys.dart';
import 'stage_motion.dart';

class StageFrame extends StatelessWidget {
  const StageFrame({
    super.key,
    required this.label,
    required this.onClose,
    this.closeLabel = 'Close',
    this.title = '',
    this.titleNote,
    this.ticks,
    this.kept = 0,
    this.keptKey,
    this.position,
    this.of,
    this.onCounter,
    this.counterLabel,
    this.child,
    this.left,
    this.right,
    this.main = const [],
    this.wide = false,
    this.showBar = true,
    this.end,
    this.busy = false,
    this.titleWidget,
  });

  /// What the stage is, for a screen reader ("Admission of a Partner feed").
  final String label;
  final VoidCallback onClose;
  final String closeLabel;

  /// The chapter's title, one line with an ellipsis.
  final String title;

  /// A note that stands in for the title for 2.4 s when it changes ("Picked up at 7 of 21"), then the title
  /// comes back (200 ms fades).
  final String? titleNote;

  /// The ticks row (`StageTicks`); null keeps the row's height empty.
  final Widget? ticks;

  /// Cards kept in this session; the count shows from the first one.
  final int kept;

  /// On the kept count: the Keep flight's target (`StageFlight.fly`).
  final GlobalKey? keptKey;

  /// "3" of "21" in the counter; null hides the counter.
  final int? position;
  final int? of;

  /// Opens "This feed" from the counter (a button with a chevron then).
  final VoidCallback? onCounter;

  /// The counter's spoken label ("3 of 21. Open the list of this feed").
  final String? counterLabel;

  /// The item area (a `StagePager`, a centred state, the stage skeleton's card).
  final Widget? child;

  /// The action bar's side keys (`StageSideKey`) and its step slot (one key, or two in [wide]).
  final Widget? left;
  final Widget? right;
  final List<Widget> main;
  final bool wide;

  /// False hides the action bar (the end has its keys in the screen).
  final bool showBar;

  /// The end's layer (`StageEnd`), drawn over the frame; the frame fades out under it.
  final Widget? end;

  /// Something is starting (a new feed): the item area says it is busy.
  final bool busy;

  /// Stands in for the title (the loading stage's skeleton bar).
  final Widget? titleWidget;

  /// Says [text] to a screen reader once, politely (the web's live region).
  static void say(BuildContext context, String text) {
    if (text.isEmpty) return;
    unawaited(SemanticsService.sendAnnouncement(View.of(context), text, Directionality.of(context)));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final inEnd = end != null;
    final frame = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        StageTopBar(
          onClose: onClose,
          closeLabel: closeLabel,
          title: title,
          titleNote: titleNote,
          ticks: ticks,
          kept: kept,
          keptKey: keptKey,
          position: position,
          of: of,
          onCounter: onCounter,
          counterLabel: counterLabel,
          titleWidget: titleWidget,
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
            child: Semantics(container: true, label: label, child: child ?? const SizedBox.expand()),
          ),
        ),
        if (showBar) StageActionBar(left: left, right: right, wide: wide, main: main),
      ],
    );
    return ColoredBox(
      color: colors.ground,
      child: Stack(
        fit: StackFit.expand,
        children: [
          AnimatedOpacity(
            opacity: inEnd ? 0 : 1,
            duration: Motion.of(context, const Duration(milliseconds: 200)),
            curve: Motion.out,
            child: IgnorePointer(
              ignoring: inEnd,
              child: ExcludeSemantics(excluding: inEnd, child: ExcludeFocus(excluding: inEnd, child: frame)),
            ),
          ),
          if (end != null) Positioned.fill(child: StageIn(child: end!)),
        ],
      ),
    );
  }
}

/// The phone's top bar on its own (the frame builds it; a screen may build it for a state of its own).
class StageTopBar extends StatelessWidget {
  const StageTopBar({
    super.key,
    required this.onClose,
    this.closeLabel = 'Close',
    this.title = '',
    this.titleNote,
    this.ticks,
    this.kept = 0,
    this.keptKey,
    this.position,
    this.of,
    this.onCounter,
    this.counterLabel,
    this.titleWidget,
  });

  final VoidCallback onClose;
  final String closeLabel;
  final String title;
  final String? titleNote;
  final Widget? ticks;
  final int kept;
  final GlobalKey? keptKey;
  final int? position;
  final int? of;
  final VoidCallback? onCounter;
  final String? counterLabel;

  /// Stands in for the title (the loading skeleton's bar).
  final Widget? titleWidget;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final top = MediaQuery.paddingOf(context).top;
    return ColoredBox(
      color: colors.ground,
      child: Padding(
        padding: EdgeInsets.only(top: top + 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
              child: SizedBox(height: 2, child: ticks ?? const SizedBox.shrink()),
            ),
            // The 44 dp keys sit 6 dp under the ticks; the row is 48 dp so their 48 dp targets lie inside it.
            const SizedBox(height: MmSpace.s4),
            // The row starts 10 dp left of the gutter (Close's own padding, so its X lines up with the gutter) and
            // ends 8 dp right of it (the counter's padding, so its words end on the gutter).
            Padding(
              padding: const EdgeInsets.only(left: MmSpace.gutter - 10, right: MmSpace.gutter - 8),
              child: SizedBox(
                height: 48,
                child: Row(
                  children: [
                    StageIconKey(icon: LucideIcons.x, size: 22, semanticsLabel: closeLabel, onTap: onClose),
                    const SizedBox(width: MmSpace.s6),
                    Expanded(child: titleWidget ?? _StageTitle(title: title, note: titleNote)),
                    if (kept > 0) ...[
                      const SizedBox(width: MmSpace.s6),
                      StageKeptCount(count: kept, targetKey: keptKey),
                    ] else if (keptKey != null)
                      // The flight's target stays laid out (zero wide) until the first card is kept.
                      SizedBox(key: keptKey, width: 0, height: 28),
                    if (position != null && of != null) ...[
                      const SizedBox(width: MmSpace.s6),
                      StageCounter(position: position!, of: of!, onTap: onCounter, semanticsLabel: counterLabel),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The title, or the note in its place for 2.4 s whenever the note changes (200 ms fades).
class _StageTitle extends StatefulWidget {
  const _StageTitle({required this.title, this.note});

  final String title;
  final String? note;

  static const Duration noteFor = Duration(milliseconds: 2400);

  @override
  State<_StageTitle> createState() => _StageTitleState();
}

class _StageTitleState extends State<_StageTitle> {
  String? _note;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _show(widget.note);
  }

  @override
  void didUpdateWidget(_StageTitle old) {
    super.didUpdateWidget(old);
    if (widget.note != old.note) _show(widget.note);
  }

  void _show(String? note) {
    _timer?.cancel();
    _note = note == null || note.isEmpty ? null : note;
    if (_note != null) {
      _timer = Timer(_StageTitle.noteFor, () {
        if (mounted) setState(() => _note = null);
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final words = _note ?? widget.title;
    return MmOverlapSwitcher.fade(
      duration: const Duration(milliseconds: 200),
      alignment: Alignment.centerLeft,
      child: Text(
        words,
        key: ValueKey<String>(words),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        softWrap: false,
        style: type.labelLarge.copyWith(fontSize: 15, height: 1.3, color: colors.ink2),
      ),
    );
  }
}

/// The kept count in the top bar: a filled bookmark in the select colour and the number, 13.5 semibold ink-2. It
/// comes in over 160 ms from 0.95, and a new number rises into place. [targetKey] marks it for the Keep flight.
class StageKeptCount extends StatelessWidget {
  const StageKeptCount({super.key, required this.count, this.targetKey});

  final int count;
  final GlobalKey? targetKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      label: '$count kept',
      excludeSemantics: true,
      child: StageIn(
        rise: 0,
        duration: const Duration(milliseconds: 160),
        child: _ScaleIn(
          child: SizedBox(
            key: targetKey,
            height: 28,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  StageBookmark(size: 14, color: stageSelect(colors)),
                  const SizedBox(width: MmSpace.s4),
                  ClipRect(
                    child: StageCount(
                      value: count,
                      child: Text(
                        '$count',
                        style: type.label.copyWith(fontSize: 13.5, height: 1, color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// From 0.95 to 1 over 160 ms when first built (the kept count's arrival).
class _ScaleIn extends StatefulWidget {
  const _ScaleIn({required this.child});

  final Widget child;

  @override
  State<_ScaleIn> createState() => _ScaleInState();
}

class _ScaleInState extends State<_ScaleIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 160), value: 1);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!Motion.reduced(context)) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _c,
    child: widget.child,
    builder: (context, child) => Transform.scale(scale: 0.95 + 0.05 * Motion.out.transform(_c.value), child: child),
  );
}

/// The counter: "3" in ink and " of 21" in ink-3, 13.5 semibold with tabular figures. With [onTap] it is a 44 dp
/// button with a 14 dp chevron (it opens "This feed").
class StageCounter extends StatelessWidget {
  const StageCounter({super.key, required this.position, required this.of, this.onTap, this.semanticsLabel});

  final int position;
  final int of;
  final VoidCallback? onTap;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final base = type.label.copyWith(fontSize: 13.5, height: 1, color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()]);
    final words = Text.rich(
      TextSpan(
        style: base,
        children: [
          TextSpan(text: '$position', style: TextStyle(color: colors.ink)),
          TextSpan(text: ' of $of'),
        ],
      ),
      maxLines: 1,
      softWrap: false,
    );
    final label = semanticsLabel ?? '$position of $of';
    if (onTap == null) {
      return Semantics(
        label: label,
        excludeSemantics: true,
        child: Padding(padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8), child: words),
      );
    }
    return MmHitSlop.toTarget(
      visual: 44,
      child: Semantics(
        container: true,
        button: true,
        label: label,
        excludeSemantics: true,
        onTap: onTap,
        child: _CounterPress(
          onTap: onTap!,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              words,
              const SizedBox(width: 3),
              Icon(LucideIcons.chevronDown, size: 14, color: colors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}

class _CounterPress extends StatefulWidget {
  const _CounterPress({required this.onTap, required this.child});

  final VoidCallback onTap;
  final Widget child;

  @override
  State<_CounterPress> createState() => _CounterPressState();
}

class _CounterPressState extends State<_CounterPress> {
  bool _down = false;
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return FocusableActionDetector(
      onShowFocusHighlight: (v) => setState(() => _focused = v),
      actions: {
        ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: (_) {
          widget.onTap();
          return null;
        }),
      },
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _down = true),
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: widget.onTap,
        child: Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8),
          decoration: BoxDecoration(
            color: _down ? colors.ink.withValues(alpha: colors.isNight ? 0.08 : 0.06) : null,
            borderRadius: BorderRadius.circular(12),
            border: _focused ? Border.all(color: colors.focusRing, width: 2) : null,
          ),
          child: widget.child,
        ),
      ),
    );
  }
}

/// The phone's action bar: `56 | 1fr | 56` with 12 dp gaps, padding 6 on top, 16 at the sides, the safe bottom + 8,
/// on the solid ground. The side slots keep their width when empty so the step key stays centred. [wide]: the
/// middle takes the whole row (the checkpoint's two keys, 10 dp apart).
class StageActionBar extends StatelessWidget {
  const StageActionBar({super.key, this.left, this.right, this.main = const [], this.wide = false});

  final Widget? left;
  final Widget? right;
  final List<Widget> main;
  final bool wide;

  static const double side = 56;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final bottom = MediaQuery.paddingOf(context).bottom;
    final middle = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final (i, k) in main.indexed) ...[
          if (i > 0) const SizedBox(width: 10),
          Expanded(child: k),
        ],
      ],
    );
    return ColoredBox(
      color: colors.ground,
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s6, MmSpace.gutter, MmSpace.s8 + bottom),
        child: wide
            ? middle
            : Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(width: side, child: Center(child: left)),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(child: middle),
                  const SizedBox(width: MmSpace.s12),
                  SizedBox(width: side, child: Center(child: right)),
                ],
              ),
      ),
    );
  }
}

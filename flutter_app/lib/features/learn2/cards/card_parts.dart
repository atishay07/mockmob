// The parts the Cards view and Find share (the website's cards.css and CardsView.jsx: FilterChips, Jump, PickBar, the section
// bar, the locked line and the loading shapes), drawn from the app's tokens. Only the parts both screens need are here; each
// screen's own layout is its own file.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/widgets/edge_fade.dart';
import '../../pro_nudge/pro_nudge.dart' show ProReason, proNudgesOnProvider, showUpgradeSheetIfOn;
import '../learn2_balance.dart';
import 'card_model.dart';
import 'card_styles.dart';
import 'cards_copy.dart';

// ------------------------------------------------------------------------------------------------------ keys

/// A quiet key: the words underlined in the hairline colour, with an optional chevron. 48 dp tall.
class CardsTextKey extends StatelessWidget {
  const CardsTextKey({super.key, required this.label, required this.onTap, this.semanticsLabel, this.icon, this.pressed = false, this.expanded});

  final String label;
  final VoidCallback? onTap;
  final String? semanticsLabel;
  final IconData? icon;

  /// A key that is on (Pick while picking): the words go to the ink.
  final bool pressed;
  final bool? expanded;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      semanticsLabel: semanticsLabel ?? label,
      selected: pressed ? true : null,
      focusRadius: const BorderRadius.all(Radius.circular(10)),
      pressedScale: 0.97,
      lift: false,
      highlight: true,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, down, focused) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min, minWidth: MmTarget.min),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: type.labelLarge.copyWith(
                  fontSize: 14.5,
                  height: 1.1,
                  fontWeight: FontWeight.w600,
                  color: pressed || down ? colors.ink : colors.ink2,
                  decoration: TextDecoration.underline,
                  decorationColor: pressed ? colors.ink2 : colors.lineStrong,
                ),
              ),
              if (icon != null) ...[const SizedBox(width: 4), Icon(icon, size: 16, color: colors.ink2)],
            ],
          ),
        ),
      ),
    );
  }
}

/// The one volt key of a screen, or its outline while the pick bar holds the volt one.
class CardsStudyKey extends StatelessWidget {
  const CardsStudyKey({super.key, required this.label, required this.volt, required this.onPressed});

  final String label;
  final bool volt;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) =>
      volt ? KeyButton(label: label, minHeight: 52, onPressed: onPressed) : KeyButton.secondary(label: label, minHeight: 52, onPressed: onPressed);
}

// ------------------------------------------------------------------------------------------------------ tools

/// "Show answers" with its switch on the left; the jump key and Pick on the right.
class CardsToolsRow extends StatelessWidget {
  const CardsToolsRow({super.key, required this.showAnswers, required this.onShowAnswers, required this.pickMode, required this.onPick, this.jump});

  final bool showAnswers;
  final ValueChanged<bool> onShowAnswers;
  final bool pickMode;
  final VoidCallback onPick;

  /// The "Sections" or "Chapters" key (null when the list has fewer than two groups).
  final Widget? jump;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: MmTarget.min),
      child: Row(
        children: [
          Expanded(
            child: Align(
              alignment: Alignment.centerLeft,
              // The switch and its words are one target: the whole label turns it, and a screen reader hears one switch.
              child: Semantics(
                container: true,
                toggled: showAnswers,
                label: CardsCopy.showAnswers,
                onTap: () => onShowAnswers(!showAnswers),
                excludeSemantics: true,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onShowAnswers(!showAnswers),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: MmTarget.min),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        MmSwitch(key: const ValueKey('cards-show-answers'), value: showAnswers, onChanged: onShowAnswers),
                        const SizedBox(width: 12),
                        Flexible(
                          child: Text(CardsCopy.showAnswers, style: type.labelLarge.copyWith(fontSize: 14.5, height: 1.2, fontWeight: FontWeight.w600, color: colors.ink2)),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          ?jump,
          CardsTextKey(
            key: const ValueKey('cards-pick'),
            label: pickMode ? CardsCopy.pickDone : CardsCopy.pick,
            semanticsLabel: pickMode ? CardsCopy.pickDoneLabel : CardsCopy.pickLabel,
            pressed: pickMode,
            onTap: onPick,
          ),
        ],
      ),
    );
  }
}

/// The jump key ("Sections" in the Cards view, "Chapters" in Find): it opens a sheet of the groups with their counts.
class CardsJumpKey extends StatelessWidget {
  const CardsJumpKey({super.key, required this.label, required this.sheetTitle, required this.groups, required this.onGo});

  final String label;
  final String sheetTitle;
  final List<CardGroup> groups;
  final ValueChanged<CardGroup> onGo;

  @override
  Widget build(BuildContext context) {
    if (groups.length < 2) return const SizedBox.shrink();
    return CardsTextKey(
      key: const ValueKey('cards-jump'),
      label: label,
      icon: LucideIcons.chevronDown,
      onTap: () => unawaited(_open(context)),
    );
  }

  Future<void> _open(BuildContext context) async {
    final chosen = await showMmSheet<CardGroup>(
      context: context,
      title: sheetTitle,
      builder: (sheet) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [for (final g in groups) _JumpRow(group: g, onTap: () => Navigator.of(sheet).pop(g))],
      ),
    );
    if (chosen != null) onGo(chosen);
  }
}

class _JumpRow extends StatelessWidget {
  const _JumpRow({required this.group, required this.onTap});

  final CardGroup group;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      key: ValueKey('cards-jump-${group.id}'),
      semanticsLabel: '${group.title}, ${group.countText}',
      focusRadius: const BorderRadius.all(Radius.circular(10)),
      pressedScale: 0.99,
      lift: false,
      highlight: true,
      haptic: MmPressHaptic.selection,
      onTap: onTap,
      builder: (context, pressed, focused) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 52),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(child: Text(group.title, style: type.body.copyWith(fontSize: 15, height: 1.3, fontWeight: FontWeight.w600, color: colors.ink))),
              const SizedBox(width: 12),
              Text(group.countText, style: type.label.copyWith(fontSize: 14, color: colors.ink3, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      ),
    );
  }
}

// ------------------------------------------------------------------------------------------------------ filters

/// One filter chip: its value, its words and its count.
class CardsFilterOption {
  const CardsFilterOption({required this.value, required this.label, required this.count});

  final String value;
  final String label;
  final int count;
}

/// The filters as one row of chips with ONE ink indicator that slides to the chosen chip (the website's FilterChips: the ink
/// fill moves, nothing arrives or leaves; volt stays on the Study key). The row scrolls sideways when the chips do not fit
/// and fades at the edge that has more behind it.
class CardsFilterRow extends StatefulWidget {
  const CardsFilterRow({super.key, required this.value, required this.options, required this.onChanged, this.label = CardsCopy.filtersLabel});

  final String value;
  final List<CardsFilterOption> options;
  final ValueChanged<String> onChanged;
  final String label;

  static const double chipHeight = 44;

  /// The row is a 48 dp target tall: the chips sit 2 dp in from its edges, so their touch band lies inside it.
  static const double height = 48;

  @override
  State<CardsFilterRow> createState() => _CardsFilterRowState();
}

class _CardsFilterRowState extends State<CardsFilterRow> with SingleTickerProviderStateMixin {
  final ScrollController _scroll = ScrollController();
  final GlobalKey _content = GlobalKey();
  late final AnimationController _slide = AnimationController(vsync: this, duration: const Duration(milliseconds: 240));
  final Map<String, GlobalKey> _keys = {};
  Rect? _from;
  Rect? _to;
  bool _ready = false;

  GlobalKey _key(String value) => _keys.putIfAbsent(value, GlobalKey.new);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _measure(animate: false));
  }

  @override
  void didUpdateWidget(CardsFilterRow old) {
    super.didUpdateWidget(old);
    final same = old.options.length == widget.options.length &&
        [for (var i = 0; i < old.options.length; i++) '${old.options[i].value}${old.options[i].count}'].join('|') ==
            [for (final o in widget.options) '${o.value}${o.count}'].join('|');
    if (old.value != widget.value || !same) WidgetsBinding.instance.addPostFrameCallback((_) => _measure(animate: old.value != widget.value));
  }

  @override
  void dispose() {
    _slide.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Rect? _rectOf(String value) {
    final box = _key(value).currentContext?.findRenderObject();
    final stack = _content.currentContext?.findRenderObject();
    if (box is! RenderBox || stack is! RenderBox || !box.attached || !stack.attached || !box.hasSize) return null;
    return box.localToGlobal(Offset.zero, ancestor: stack) & box.size;
  }

  void _measure({required bool animate}) {
    if (!mounted) return;
    final to = _rectOf(widget.value);
    if (to == null) return;
    if (_to == to && _ready) return;
    final duration = Motion.of(context, const Duration(milliseconds: 240));
    setState(() {
      _from = animate && _ready && duration > Duration.zero ? _current() ?? _to : to;
      _to = to;
      _ready = true;
    });
    if (animate && duration > Duration.zero && _from != _to) {
      _slide
        ..duration = duration
        ..forward(from: 0);
    } else {
      _slide.value = 1;
    }
  }

  Rect? _current() {
    final from = _from;
    final to = _to;
    if (to == null) return null;
    if (from == null) return to;
    return Rect.lerp(from, to, Motion.out.transform(_slide.value));
  }

  /// Brings the chosen chip whole into view when it sits under the edge (smooth, or at once under reduced motion).
  void _reveal(String value) {
    if (!_scroll.hasClients) return;
    final rect = _rectOf(value);
    if (rect == null) return;
    final p = _scroll.position;
    const gut = MmSpace.gutter;
    double? target;
    if (rect.left - gut < p.pixels) {
      target = (rect.left - gut).clamp(0.0, p.maxScrollExtent);
    } else if (rect.right + gut > p.pixels + p.viewportDimension) {
      target = (rect.right + gut - p.viewportDimension).clamp(0.0, p.maxScrollExtent);
    }
    if (target == null) return;
    final duration = Motion.of(context, const Duration(milliseconds: 240));
    if (duration == Duration.zero) {
      _scroll.jumpTo(target);
    } else {
      unawaited(_scroll.animateTo(target, duration: duration, curve: Motion.out));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final chips = [
      for (final o in widget.options)
        _Chip(
          key: _key(o.value),
          option: o,
          selected: o.value == widget.value,
          onTap: () {
            _reveal(o.value);
            widget.onChanged(o.value);
          },
        ),
    ];
    return Semantics(
      container: true,
      label: widget.label,
      child: SizedBox(
        height: CardsFilterRow.height,
        child: EdgeFade(
          extent: 36,
          child: SingleChildScrollView(
            controller: _scroll,
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: (CardsFilterRow.height - CardsFilterRow.chipHeight) / 2),
            clipBehavior: Clip.none,
            child: NotificationListener<SizeChangedLayoutNotification>(
              onNotification: (_) {
                WidgetsBinding.instance.addPostFrameCallback((_) => _measure(animate: false));
                return false;
              },
              child: SizeChangedLayoutNotifier(
                child: Stack(
                  key: _content,
                  clipBehavior: Clip.none,
                  children: [
                    if (_ready)
                      AnimatedBuilder(
                        animation: _slide,
                        builder: (context, _) {
                          final r = _current() ?? _to!;
                          return Positioned.fromRect(
                            rect: r,
                            child: IgnorePointer(
                              child: DecoratedBox(decoration: ShapeDecoration(color: colors.ink, shape: const StadiumBorder())),
                            ),
                          );
                        },
                      ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [for (final (i, c) in chips.indexed) ...[if (i > 0) const SizedBox(width: 4), c]],
                    ),
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

class _Chip extends StatelessWidget {
  const _Chip({super.key, required this.option, required this.selected, required this.onTap});

  final CardsFilterOption option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final duration = Motion.of(context, const Duration(milliseconds: 160));
    return MmHitSlop(
      slop: const EdgeInsets.symmetric(vertical: 2),
      child: MmPressable(
        key: ValueKey('cards-filter-${option.value}'),
        semanticsLabel: '${option.label}, ${option.count}',
        selected: selected,
        inMutuallyExclusiveGroup: true,
        pressedScale: 0.97,
        lift: false,
        haptic: MmPressHaptic.selection,
        onTap: onTap,
        builder: (context, pressed, focused) {
          final ink = selected ? colors.ground : (pressed ? colors.ink : colors.ink2);
          return AnimatedContainer(
            duration: duration,
            curve: Motion.out,
            height: CardsFilterRow.chipHeight,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: ShapeDecoration(shape: StadiumBorder(side: BorderSide(color: selected ? colors.ground.withValues(alpha: 0) : colors.lineStrong))),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedDefaultTextStyle(
                  duration: duration,
                  curve: Motion.out,
                  style: type.labelLarge.copyWith(fontSize: 14.5, height: 1, fontWeight: FontWeight.w600, color: ink),
                  child: Text(option.label, maxLines: 1, softWrap: false),
                ),
                const SizedBox(width: 6),
                AnimatedDefaultTextStyle(
                  duration: duration,
                  curve: Motion.out,
                  style: type.labelLarge.copyWith(fontSize: 14.5, height: 1, fontWeight: FontWeight.w600, color: ink.withValues(alpha: selected ? 0.75 : 0.7)),
                  child: Text('${option.count}', maxLines: 1, softWrap: false),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ------------------------------------------------------------------------------------------------------ bars

/// A group's bar: its name and its count, a hairline under it. Under a filter the bars are many and small, so they are
/// plain words, not headings. In Find the bar opens its chapter ([onTap]).
class CardsSectionBar extends StatelessWidget {
  const CardsSectionBar({super.key, required this.group, this.compact = false, this.onTap, this.opaque = false, this.header = true});

  final CardGroup group;
  final bool compact;
  final VoidCallback? onTap;

  /// The ground behind it, for a bar that pins over the rows scrolling under it.
  final bool opaque;
  final bool header;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final Widget face = DecoratedBox(
      decoration: BoxDecoration(
        color: opaque ? colors.ground : null,
        border: Border(bottom: BorderSide(color: compact ? colors.line : colors.lineStrong)),
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: onTap != null ? MmTarget.min : MmTarget.min - 4),
        child: Padding(
          padding: EdgeInsets.only(top: compact ? 10 : 14, bottom: compact ? 6 : 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(child: BalancedText(group.title, style: compact ? CardStyles.barCompact(context) : CardStyles.bar(context))),
              const SizedBox(width: 12),
              Text(group.countText, style: CardStyles.barCount(context)),
            ],
          ),
        ),
      ),
    );
    if (onTap != null) {
      return MmPressable(
        key: ValueKey('cards-bar-${group.id}'),
        semanticsLabel: '${group.title}, ${group.countText}',
        focusRadius: const BorderRadius.all(Radius.circular(6)),
        pressedScale: 0.995,
        lift: false,
        highlight: true,
        haptic: MmPressHaptic.selection,
        onTap: onTap,
        builder: (context, pressed, focused) => face,
      );
    }
    return Semantics(key: ValueKey('cards-section-${group.id}'), header: header, container: true, label: '${group.title}, ${group.countText}', excludeSemantics: true, child: face);
  }
}

/// Free's one locked line, where the first locked card sits: the server's own words and, where Pro nudges are on, See Pro.
class CardsLockedLine extends ConsumerWidget {
  const CardsLockedLine({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final nudges = ref.watch(proNudgesOnProvider);
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.lineStrong))),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(0, 18, 0, 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ExcludeSemantics(child: Padding(padding: const EdgeInsets.only(top: 3), child: Icon(LucideIcons.lock, size: 16, color: colors.ink3))),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(text, style: type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2)),
                  if (nudges) ...[
                    const SizedBox(height: 4),
                    KeyButton.secondary(
                      key: const ValueKey('cards-see-pro'),
                      label: CardsCopy.seePro,
                      expanded: false,
                      minHeight: MmTarget.min,
                      onPressed: () => showUpgradeSheetIfOn(context, reason: ProReason.keycards),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ------------------------------------------------------------------------------------------------------ pick bar

/// The bar that rides at the bottom of the screen while cards are picked: "8 picked", Clear, and the volt key "Study these 8".
/// It is drawn on the screen's Overlay (so it rides above the dock and the page, wherever the list is scrolled), built where
/// its host stands, so it clears the dock by the insets of that place.
class CardsPickBar extends StatefulWidget {
  const CardsPickBar({super.key, required this.show, required this.count, required this.onClear, required this.onStudy, required this.child});

  final bool show;
  final int count;
  final VoidCallback onClear;
  final VoidCallback onStudy;
  final Widget child;

  @override
  State<CardsPickBar> createState() => _CardsPickBarState();
}

class _CardsPickBarState extends State<CardsPickBar> {
  final OverlayPortalController _portal = OverlayPortalController();

  @override
  void initState() {
    super.initState();
    if (widget.show) WidgetsBinding.instance.addPostFrameCallback((_) => mounted && widget.show ? _portal.show() : null);
  }

  @override
  void didUpdateWidget(CardsPickBar old) {
    super.didUpdateWidget(old);
    if (widget.show == old.show) return;
    // Shown or hidden after this frame, never while it builds.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (widget.show) {
        _portal.show();
      } else {
        _portal.hide();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom + 12;
    return OverlayPortal(
      controller: _portal,
      overlayChildBuilder: (context) => Positioned(
        left: MmSpace.gutter,
        right: MmSpace.gutter,
        bottom: bottom,
        child: Align(
          alignment: Alignment.bottomCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: _PickBarBody(count: widget.count, onClear: widget.onClear, onStudy: widget.onStudy),
          ),
        ),
      ),
      child: widget.child,
    );
  }
}

class _PickBarBody extends StatelessWidget {
  const _PickBarBody({required this.count, required this.onClear, required this.onStudy});

  final int count;
  final VoidCallback onClear;
  final VoidCallback onStudy;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return CardFadeIn(
      duration: const Duration(milliseconds: 200),
      child: Semantics(
        container: true,
        label: CardsCopy.pickedLabel,
        child: Material(
          type: MaterialType.transparency,
          child: DecoratedBox(
            key: const ValueKey('cards-pick-bar'),
            decoration: BoxDecoration(
              color: colors.raised2,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: colors.lineStrong),
              boxShadow: [BoxShadow(color: colors.sheetScrim, blurRadius: 24, offset: const Offset(0, 8))],
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 8, 10),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Semantics(
                          liveRegion: true,
                          child: Text(CardsCopy.picked(count), style: type.labelLarge.copyWith(fontSize: 15, fontWeight: FontWeight.w700, color: colors.ink)),
                        ),
                      ),
                      CardsTextKey(key: const ValueKey('cards-pick-clear'), label: CardsCopy.clear, onTap: onClear),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: KeyButton(key: const ValueKey('cards-pick-study'), label: CardsCopy.studyThese(count), minHeight: MmTarget.min, onPressed: onStudy),
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

// ------------------------------------------------------------------------------------------------------ states

/// A placeholder row at the size a folded row has, so nothing moves when the cards land.
class CardsSkeletonRows extends StatelessWidget {
  const CardsSkeletonRows({super.key, this.groups = 2, this.rows = 3, this.bar = true});

  final int groups;
  final int rows;

  /// A section bar over each group (the Cards view); Find's rows run on.
  final bool bar;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var g = 0; g < groups; g++) ...[
          if (bar) const Padding(padding: EdgeInsets.fromLTRB(0, 14, 0, 12), child: Align(alignment: Alignment.centerLeft, child: FractionallySizedBox(widthFactor: 0.56, child: Skeleton(height: 22, radius: 8)))),
          for (var i = 0; i < rows; i++)
            DecoratedBox(
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: colors.line))),
              child: const SizedBox(
                height: 65,
                child: Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [Skeleton(width: 90, height: 12, radius: 8), SizedBox(height: 8), Skeleton(height: 20, radius: 8)],
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }
}

/// An empty list: a title and a line under a hairline.
class CardsEmpty extends StatelessWidget {
  const CardsEmpty({super.key, required this.title, required this.line});

  final String title;
  final String line;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return DecoratedBox(
      decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 26),
        child: Semantics(
          container: true,
          liveRegion: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(header: true, child: Text(title, style: type.title.copyWith(fontSize: 18, height: 1.3, letterSpacing: -0.27, color: colors.ink))),
              const SizedBox(height: 6),
              Text(line, style: type.body.copyWith(fontSize: 15, height: 1.55, fontWeight: FontWeight.w500, color: colors.ink2)),
            ],
          ),
        ),
      ),
    );
  }
}

/// A read that failed: what it was, what to do and Try again. Never a number that was not read.
class CardsError extends StatelessWidget {
  const CardsError({super.key, required this.title, required this.line, required this.onRetry, this.padding = const EdgeInsets.fromLTRB(0, 24, 0, 0)});

  final String title;
  final String line;
  final VoidCallback onRetry;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Padding(
      padding: padding,
      child: Semantics(
        container: true,
        liveRegion: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: type.title.copyWith(fontSize: 18, height: 1.3, letterSpacing: -0.27, color: colors.ink)),
            const SizedBox(height: 6),
            Text(line, style: type.body.copyWith(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500, color: colors.ink2)),
            const SizedBox(height: 16),
            KeyButton.secondary(key: const ValueKey('cards-retry'), label: CardsCopy.tryAgain, expanded: false, minHeight: MmTarget.min, onPressed: onRetry),
          ],
        ),
      ),
    );
  }
}

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../haptics/haptics.dart';
import '../motion/motion.dart';
import '../theme/theme.dart';

/// One of the five tabs (spec 4.1). The outline icon is the 1.55 stroke weight and the active
/// icon the heavier 2.0 weight, which is MockMob's "outline to filled" switch.
class MmTab {
  const MmTab(this.label, this.icon, this.activeIcon);

  final String label;
  final IconData icon;
  final IconData activeIcon;
}

const List<MmTab> kMmTabs = [
  MmTab('Today', LucideIcons.house300, LucideIcons.house),
  MmTab('Practice', LucideIcons.dumbbell300, LucideIcons.dumbbell),
  MmTab('Review', LucideIcons.clipboardCheck300, LucideIcons.clipboardCheck),
  MmTab('Learn', LucideIcons.bookOpen300, LucideIcons.bookOpen),
  MmTab('You', LucideIcons.user300, LucideIcons.user),
];

/// The semantic name of a tab: "Practice, tab 2 of 5". "Selected" comes from the selected flag.
String tabSemanticsLabel(int index, {bool newResult = false}) {
  final base = '${kMmTabs[index].label}, tab ${index + 1} of ${kMmTabs.length}';
  return newResult ? '$base, new result' : base;
}

/// The bottom navigation bar: five labelled tabs on a `raised` bar with a hairline on top.
/// The active tab has a 56 by 32 volt pill behind its icon that grows from 0.5 to 1 across
/// X and fades in over 200 ms while the icon dips 2 dp for 160 ms. A tick haptic fires when the
/// tab changes. Labels clamp the text scale at 1.3.
class MmBottomNav extends ConsumerWidget {
  const MmBottomNav({super.key, required this.currentIndex, required this.onTap, this.showReviewDot = false});

  final int currentIndex;

  /// Called for every tap, including a re-tap of the current tab.
  final ValueChanged<int> onTap;

  /// An 8 dp dot on Review while a received result has not been opened.
  final bool showReviewDot;

  static const double height = 64;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final inset = MediaQuery.viewPaddingOf(context).bottom;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.raised,
        border: Border(top: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: EdgeInsets.only(bottom: inset),
        child: SizedBox(
          height: height,
          child: Row(
            children: [
              for (var i = 0; i < kMmTabs.length; i++)
                Expanded(
                  child: _NavItem(
                    tab: kMmTabs[i],
                    semanticsLabel: tabSemanticsLabel(i, newResult: i == 2 && showReviewDot),
                    active: i == currentIndex,
                    showDot: i == 2 && showReviewDot,
                    onTap: () {
                      if (i != currentIndex) ref.read(hapticsProvider).tick();
                      onTap(i);
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

class _NavItem extends StatefulWidget {
  const _NavItem({
    required this.tab,
    required this.semanticsLabel,
    required this.active,
    required this.showDot,
    required this.onTap,
  });

  final MmTab tab;
  final String semanticsLabel;
  final bool active;
  final bool showDot;
  final VoidCallback onTap;

  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: Motion.ui,
    value: widget.active ? 1 : 0,
  );
  late final Animation<double> _curve = CurvedAnimation(parent: _controller, curve: Motion.out);

  @override
  void didUpdateWidget(_NavItem oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active == oldWidget.active) return;
    if (!widget.active) {
      _controller.value = 0;
    } else if (Motion.reduced(context)) {
      _controller.value = 1;
    } else {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final active = widget.active;

    final iconColor = active ? colors.voltInk : colors.ink3;

    final pill = FadeTransition(
      opacity: _curve,
      child: AnimatedBuilder(
        animation: _curve,
        builder: (context, child) => Transform(
          alignment: Alignment.center,
          transform: Matrix4.diagonal3Values(0.5 + 0.5 * _curve.value, 1, 1),
          child: child,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(color: colors.volt, borderRadius: MmRadius.pillAll),
          child: const SizedBox(width: 56, height: 32),
        ),
      ),
    );

    final icon = AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        // 160 ms of the 200 ms controller: a 2 dp dip and back.
        final dip = 2 * math.sin(math.pi * math.min(_controller.value / 0.8, 1.0));
        return Transform.translate(offset: Offset(0, dip), child: child);
      },
      child: Icon(active ? widget.tab.activeIcon : widget.tab.icon, size: 24, color: iconColor),
    );

    return Semantics(
      container: true,
      button: true,
      selected: active,
      label: widget.semanticsLabel,
      excludeSemantics: true,
      onTap: widget.onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        child: RepaintBoundary(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: 56,
                height: 32,
                child: Stack(
                  alignment: Alignment.center,
                  clipBehavior: Clip.none,
                  children: [
                    if (active) Positioned.fill(child: pill),
                    icon,
                    if (widget.showDot)
                      Positioned(
                        top: 2,
                        right: 10,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: colors.ink,
                            shape: BoxShape.circle,
                            border: Border.all(color: colors.raised, width: 1.5),
                          ),
                          child: const SizedBox.square(dimension: 8),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: MmSpace.s4),
              MediaQuery.withClampedTextScaling(
                maxScaleFactor: 1.3,
                child: Text(
                  widget.tab.label,
                  maxLines: 1,
                  overflow: TextOverflow.clip,
                  style: type.navLabel.copyWith(color: active ? colors.ink : colors.ink3),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

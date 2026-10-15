import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import 'review_layout.dart';

/// Review's empty, error and offline states: the same grammar as the full tab, so an empty Review
/// feels like the same app as a full one. A large Mobi stands in his own pool of lamp light, one
/// headline, one or two lines, and the volt key right under them. Nothing is boxed.
///
/// It takes the place of the shared [StateView] on Review because that one draws a small Mobi in
/// a faint pool; here Mobi is the hero of the screen.
class ReviewStateView extends StatefulWidget {
  const ReviewStateView({
    super.key,
    required this.kind,
    required this.title,
    this.message,
    this.primary,
    this.secondary,
    this.pose = MobiPose.idle,
    this.scene,
  }) : assert(primary != null || secondary == null, 'A secondary action needs a primary action.');

  final StateViewKind kind;
  final String title;
  final String? message;
  final StateAction? primary;
  final StateAction? secondary;

  /// [MobiPose.idle] lets the kind choose: reading for empty, resting for offline, thinking for error.
  final MobiPose pose;

  /// The painted room Mobi sits in: offline always shows the unplugged desk, an error the lamp
  /// with the loose cable and the repair kit, and an empty state the bare desk (nothing yet),
  /// unless it names another room ("nothing yet" is not "all repaired", so the all-clear room is
  /// only for an empty state that says so).
  final StateScene? scene;

  StateScene? get shownScene => switch (kind) {
        StateViewKind.offline => StateScene.offline,
        StateViewKind.empty => (scene?.forEmpty ?? false) ? scene : StateScene.nothingYet,
        StateViewKind.error => StateScene.unreachable,
      };

  @override
  State<ReviewStateView> createState() => _ReviewStateViewState();
}

class _ReviewStateViewState extends State<ReviewStateView> {
  final MobiController _mobi = MobiController();
  final GlobalKey _action = GlobalKey(debugLabel: 'review-state-action');

  @override
  void initState() {
    super.initState();
    // Mobi's eyes lead to the way out once the screen is laid out.
    if (widget.primary != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _mobi.lookAtWidget(_action);
      });
    }
  }

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  MobiPose get _pose {
    if (widget.pose != MobiPose.idle) return widget.pose;
    return switch (widget.kind) {
      StateViewKind.empty => MobiPose.read,
      StateViewKind.offline => MobiPose.rest,
      StateViewKind.error => MobiPose.think,
    };
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return LayoutBuilder(
      builder: (context, box) {
        final bounded = box.hasBoundedHeight;
        final compact = bounded && box.maxHeight < 560;
        final art = compact ? 120.0 : 176.0;
        final scene = widget.shownScene;
        return SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: bounded ? box.maxHeight : 0),
            child: Padding(
              padding: EdgeInsets.fromLTRB(ReviewSpace.moment, compact ? MmSpace.s24 : MmSpace.s48, ReviewSpace.moment, MmSpace.s32),
              // The stack sits at about 42% of the height, a little above the middle.
              child: Align(
                alignment: const Alignment(0, -0.16),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  // One entrance in reading order: Mobi settles, then the words, then the key.
                  child: MmStagger(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        MmStaggerItem(
                          index: 0,
                          rise: 8,
                          child: scene != null
                              // The painted room brings its own lamp: no extra pool under it.
                              ? SceneVignette(scene: scene, maxHeight: compact ? 150 : 248, controller: _mobi)
                              : SizedBox(
                            height: art * 1.45,
                            child: Stack(
                              clipBehavior: Clip.none,
                              alignment: Alignment.bottomCenter,
                              children: [
                                Positioned(
                                  left: -ReviewSpace.moment,
                                  right: -ReviewSpace.moment,
                                  top: -MmSpace.s32,
                                  bottom: -MmSpace.s16,
                                  child: IgnorePointer(
                                    child: LightField(
                                      pools: [
                                        LightPool(
                                          color: colors.lamp.withValues(alpha: colors.isNight ? 0.3 : 0.24),
                                          center: const Alignment(0, 0.2),
                                          radius: 0.3,
                                          aspect: 1.4,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                Mobi(pose: _pose, size: art, motion: MobiMotion.settle, controller: _mobi),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: MmSpace.s20),
                        MmStaggerItem(
                          index: 1,
                          child: Semantics(
                            header: true,
                            child: Text(widget.title, style: type.headline, textAlign: TextAlign.center),
                          ),
                        ),
                        if (widget.message != null) ...[
                          const SizedBox(height: MmSpace.s8),
                          MmStaggerItem(
                            index: 2,
                            child: Text(
                              widget.message!,
                              style: type.body.copyWith(color: colors.ink2),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                        if (widget.primary != null) ...[
                          const SizedBox(height: MmSpace.s24),
                          MmStaggerItem(
                            index: 3,
                            child: KeyedSubtree(
                              key: _action,
                              child: KeyButton(
                                label: widget.primary!.label,
                                onPressed: widget.primary!.onPressed,
                                loading: widget.primary!.loading,
                              ),
                            ),
                          ),
                        ],
                        if (widget.secondary != null) ...[
                          const SizedBox(height: MmSpace.s4),
                          MmStaggerItem(
                            index: 4,
                            child: Align(
                              child: KeyButton.quiet(label: widget.secondary!.label, onPressed: widget.secondary!.onPressed),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

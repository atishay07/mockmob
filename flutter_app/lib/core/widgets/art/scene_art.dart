import 'package:flutter/material.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../mobi.dart';

/// The approved painted scenes (the paper-cut set of 14 Oct 2026, `tmp/art-explore/final`). Each
/// file already ends in the exact ground of its theme (#12110E Night, #F3EFE6 Day), or is
/// feathered to transparent at every edge (the empty states), so it sits on the ground with no
/// seam. Mobi is never in the picture: he is drawn live on top, at the measured anchors.
///
/// Decoding: [provider] decodes at the width the scene is drawn, never at the file's 1080 or
/// 1200 px when the screen needs less, and the same provider is what [precache] warms, so a
/// precached scene is one cache hit and nothing is decoded while a moment runs.
enum SceneArt {
  welcomeHero('scene-welcome-hero-night', 1080, 2340),
  planSeal('scene-plan-seal-night', 1080, 2340),
  milestoneNight('scene-milestone-check-night', 1080, 2340),
  milestoneDay('scene-milestone-check-day', 1080, 2340),
  allClearNight('scene-empty-allclear-night', 1200, 800),
  allClearDay('scene-empty-allclear-day', 1200, 800),
  offlineNight('scene-empty-offline-night', 1200, 800),
  offlineDay('scene-empty-offline-day', 1200, 800);

  const SceneArt(this.file, this.pxWidth, this.pxHeight);

  final String file;
  final int pxWidth;
  final int pxHeight;

  String get asset => 'assets/art/$file.webp';

  /// Height over width.
  double get aspect => pxHeight / pxWidth;

  /// The milestone backdrop of the theme in [colors].
  static SceneArt milestone(MmColors colors) => colors.isNight ? milestoneNight : milestoneDay;

  /// Decoded [logicalWidth] wide at [dpr], never wider than the file. Widths are rounded up to
  /// 8 px so a box that moves by a fraction of a pixel never asks for a second decode.
  ImageProvider provider(double logicalWidth, double dpr) {
    final want = (logicalWidth * dpr / 8).ceil() * 8;
    return ResizeImage(AssetImage(asset), width: want.clamp(8, pxWidth));
  }

  /// Warms the decode the scene will be drawn with. Never throws: a missing file draws nothing.
  Future<void> precache(BuildContext context, double logicalWidth) async {
    try {
      await precacheImage(provider(logicalWidth, MediaQuery.devicePixelRatioOf(context)), context, onError: (_, _) {});
    } on Object {
      // Decorative.
    }
  }
}

/// A [SceneArt] drawn [width] wide (its height follows its aspect unless [height] is given). It
/// fades in over 200 ms if it was not yet decoded when first shown (never pops in), draws nothing
/// if the file is missing, and is decorative: excluded from semantics.
class SceneImage extends StatelessWidget {
  const SceneImage(this.art, {super.key, required this.width, this.height, this.fit = BoxFit.cover, this.alignment = Alignment.topCenter});

  final SceneArt art;
  final double width;
  final double? height;
  final BoxFit fit;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    final h = height ?? width * art.aspect;
    return RepaintBoundary(
      child: Image(
        image: art.provider(width, MediaQuery.devicePixelRatioOf(context)),
        width: width,
        height: h,
        fit: fit,
        alignment: alignment,
        filterQuality: FilterQuality.medium,
        gaplessPlayback: true,
        excludeFromSemantics: true,
        frameBuilder: (context, child, frame, sync) {
          if (sync) return child;
          return AnimatedOpacity(
            opacity: frame == null ? 0 : 1,
            duration: Motion.of(context, Motion.ui),
            curve: Motion.out,
            child: child,
          );
        },
        errorBuilder: (context, error, stack) => SizedBox(width: width, height: h),
      ),
    );
  }
}

/// Which painted empty state a [SceneVignette] shows.
enum StateScene {
  /// Everything is marked: the pinned sheet with every bubble filled. For "Nothing to repair" and
  /// every all-clear state, never for "nothing yet".
  allClear,

  /// The unplugged lamp-lit desk: every offline state.
  offline,
}

/// Where Mobi sits in an empty-state scene: his feet, as fractions of the 1200 by 800 image.
@immutable
class SceneAnchor {
  const SceneAnchor(this.x, this.y);

  final double x;
  final double y;

  /// Measured on the delivered files (`final/anchors.json`).
  static SceneAnchor of(StateScene scene, {required bool night}) => switch (scene) {
        StateScene.allClear => SceneAnchor(night ? 0.517 : 0.514, 0.80),
        StateScene.offline => const SceneAnchor(0.50, 0.775),
      };

  /// Mobi's height as a share of the image's height.
  static const double mobiShare = 0.42;
}

/// A painted empty state (3:2) at the width it is given, with the living Mobi sitting in its lit
/// ellipse. Night and Day each have their own painting; the edges are feathered to the theme's
/// ground, so it needs no border, radius or card. Mobi plays his own act (he sits down) and
/// holds still under reduced motion.
class SceneVignette extends StatelessWidget {
  const SceneVignette({super.key, required this.scene, this.maxHeight = 260, this.controller, this.pose = MobiPose.rest});

  final StateScene scene;

  /// The tallest the scene may be; a narrower phone or a short slot gets a smaller scene.
  final double maxHeight;
  final MobiController? controller;
  final MobiPose pose;

  static SceneArt artFor(StateScene scene, {required bool night}) => switch (scene) {
        StateScene.allClear => night ? SceneArt.allClearNight : SceneArt.allClearDay,
        StateScene.offline => night ? SceneArt.offlineNight : SceneArt.offlineDay,
      };

  @override
  Widget build(BuildContext context) {
    final night = context.mmColors.isNight;
    final art = artFor(scene, night: night);
    final anchor = SceneAnchor.of(scene, night: night);
    return LayoutBuilder(
      builder: (context, box) {
        final available = box.hasBoundedWidth ? box.maxWidth : 360.0;
        final w = available.clamp(0.0, maxHeight / art.aspect);
        final h = w * art.aspect;
        final mobi = h * SceneAnchor.mobiShare;
        final mobiBox = mobi * 1.6;
        return Center(
          child: SizedBox(
            width: w,
            height: h,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(child: SceneImage(art, width: w, height: h, fit: BoxFit.fill)),
                Positioned(
                  left: anchor.x * w - mobiBox / 2,
                  width: mobiBox,
                  top: anchor.y * h - mobi,
                  height: mobi,
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: Mobi(pose: pose, size: mobi, motion: MobiMotion.settle, controller: controller),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

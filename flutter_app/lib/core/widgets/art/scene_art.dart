import 'package:flutter/material.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';
import '../mobi.dart';
import 'scene_life.dart';

/// The approved painted scenes (the paper-cut set of 14 Oct 2026, `tmp/art-explore/final`, made
/// sharp on 15 Oct 2026). Each file already ends in the exact ground of its theme (#12110E Night,
/// #F3EFE6 Day), or is feathered to transparent at every edge (the empty states and the milestone
/// band), so it sits on the ground with no seam. Mobi is never in the picture: he is drawn live on
/// top, at the measured anchors (`shared/scene-anchors.json`, which the website reads too).
///
/// Sharpness: the generator's native sizes are 1536 by 1024 and, for a portrait, 1122 by 1402, so
/// the empty states and the milestone band ship at the native 1536 by 1024 (4 px per dp on a
/// 384 dp wide scene), and the two portrait rooms ship cropped to their painted part (the
/// ground under them is painted in code), re-encoded at the width a 3.5x phone draws them.
///
/// Decoding: [provider] decodes at the width the scene is drawn, never at the file's own width
/// when the screen needs less, and the same provider is what [precache] warms, so a precached
/// scene is one cache hit and nothing is decoded while a moment runs.
enum SceneArt {
  welcomeHero('scene-welcome-hero-night', 1296, 1620),
  planSeal('scene-plan-seal-night', 1296, 1944),
  milestoneNight('scene-milestone-check-night', 1536, 1024),
  milestoneDay('scene-milestone-check-day', 1536, 1024),
  allClearNight('scene-empty-allclear-night', 1536, 1024),
  allClearDay('scene-empty-allclear-day', 1536, 1024),
  offlineNight('scene-empty-offline-night', 1536, 1024),
  offlineDay('scene-empty-offline-day', 1536, 1024),
  nothingYetNight('scene-empty-nothing-night', 1536, 1024),
  nothingYetDay('scene-empty-nothing-day', 1536, 1024),
  savedNight('scene-empty-saved-night', 1536, 1024),
  savedDay('scene-empty-saved-day', 1536, 1024),
  noResultsNight('scene-empty-noresults-night', 1536, 1024),
  noResultsDay('scene-empty-noresults-day', 1536, 1024),
  unreachableNight('scene-empty-unreachable-night', 1536, 1024),
  unreachableDay('scene-empty-unreachable-day', 1536, 1024);

  const SceneArt(this.file, this.pxWidth, this.pxHeight);

  final String file;
  final int pxWidth;
  final int pxHeight;

  String get asset => 'assets/art/$file.webp';

  /// Height over width of the file.
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

/// Which painted quiet state a [SceneVignette] shows. Each has its own room, Night and Day, in the
/// same paper-cut dialect with the same empty lit ellipse for Mobi.
enum StateScene {
  /// Everything is marked: the pinned sheet with every bubble filled. For "Nothing to repair" and
  /// every all-clear state, never for "nothing yet".
  allClear,

  /// The unplugged lamp-lit desk: every offline state.
  offline,

  /// A bare desk with one blank sheet and a pencil: nothing here yet, work not started.
  nothingYet,

  /// A ribbon and two taped notes: the saved things, or a place where kept things will live.
  saved,

  /// An empty tray and a magnifier: a search or a filter that found nothing.
  noResults,

  /// A lamp with a loose cable and a small repair kit: the app could not reach its server. Calm,
  /// never alarming.
  unreachable;

  /// Whether an empty state may choose this scene itself (offline and unreachable belong to the
  /// offline and error kinds).
  bool get forEmpty => switch (this) {
        allClear || nothingYet || saved || noResults => true,
        offline || unreachable => false,
      };
}

/// Where Mobi sits in an empty-state scene: his feet, as fractions of the 1536 by 1024 image.
@immutable
class SceneAnchor {
  const SceneAnchor(this.x, this.y);

  final double x;
  final double y;

  /// Measured on the delivered files (`tool/build_scenes.py`); `shared/scene-anchors.json` holds the
  /// same numbers for the website, and a test keeps the two equal. Every room built on the floor
  /// lamp shares one lit ellipse, Night and Day; the unplugged desk has its own.
  static SceneAnchor of(StateScene scene, {required bool night}) => switch (scene) {
        StateScene.offline => const SceneAnchor(0.50, 0.776),
        StateScene.allClear || StateScene.nothingYet || StateScene.saved || StateScene.noResults || StateScene.unreachable => const SceneAnchor(0.514, 0.796),
      };

  /// Mobi's height as a share of the image's height.
  static const double mobiShare = 0.42;
}

/// A painted quiet state (3:2) at the width it is given, with the living Mobi sitting in its lit
/// ellipse. Night and Day each have their own painting; the edges are feathered to the theme's
/// ground, so it needs no border, radius or card. Mobi plays his own act (he sits down) and
/// holds still under reduced motion. The room itself is alive and quiet (the lamp breathes, a few
/// motes drift in its light, the window twinkles at night) for a few breaths, then rests; never
/// under reduced motion.
class SceneVignette extends StatelessWidget {
  const SceneVignette({super.key, required this.scene, this.maxHeight = 260, this.controller, this.pose = MobiPose.rest, this.entrance, this.life = true});

  final StateScene scene;

  /// The tallest the scene may be; a narrower phone or a short slot gets a smaller scene.
  final double maxHeight;
  final MobiController? controller;
  final MobiPose pose;

  /// The act Mobi plays on arriving, in place of the pose's own (the one shrug of an error).
  final MobiAct? entrance;

  /// Whether the room breathes (see [SceneLife]). Off for goldens that must not move.
  final bool life;

  static SceneArt artFor(StateScene scene, {required bool night}) => switch (scene) {
        StateScene.allClear => night ? SceneArt.allClearNight : SceneArt.allClearDay,
        StateScene.offline => night ? SceneArt.offlineNight : SceneArt.offlineDay,
        StateScene.nothingYet => night ? SceneArt.nothingYetNight : SceneArt.nothingYetDay,
        StateScene.saved => night ? SceneArt.savedNight : SceneArt.savedDay,
        StateScene.noResults => night ? SceneArt.noResultsNight : SceneArt.noResultsDay,
        StateScene.unreachable => night ? SceneArt.unreachableNight : SceneArt.unreachableDay,
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
        Widget picture = SceneImage(art, width: w, height: h, fit: BoxFit.fill);
        if (life) picture = SceneLife(scene: scene, night: night, child: picture);
        return Center(
          child: SizedBox(
            width: w,
            height: h,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(child: picture),
                Positioned(
                  left: anchor.x * w - mobiBox / 2,
                  width: mobiBox,
                  top: anchor.y * h - mobi,
                  height: mobi,
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: Mobi(pose: pose, size: mobi, motion: MobiMotion.settle, controller: controller, entrance: entrance),
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

// MockMob's branded icons (owner LK60, 3 Nov 2026: "Don't use these vague icons ... Make them into a proper branded icon,
// a generated image"). The web set, ported (web commit 930b6bcbd, docs/brain/learn-1031/r7/I-ICONS.md): one small desk
// object per meaning, from the same lamp-lit study desk as the subject objects (aged brass, cream paper, kraft, charcoal
// and one lime felt or foil accent), each a square transparent webp in assets/art/icons/ at 192 px (the web's largest
// file, never enlarged: sharp at 3x up to 64 dp).
//
//   BrandIcon(BrandIconName.keycards, size: 40)
//
// The box is a fixed square, laid out before the file decodes, so nothing shifts when it arrives. Decorative by default
// (the row says its words beside it); pass [BrandIcon.label] when it stands alone. Below 32 dp a photo-real object turns
// to mush (the subject objects' own rule), so a smaller request draws the line icon of the same meaning instead.
// Controls (chevrons, close, check, search, steppers) are never brand icons: they are the interface's verbs.
import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../motion/motion.dart';
import '../../theme/theme.dart';

/// The desk objects the app ships (the web set's names; the dock keeps its own icons, so Today, You, Saved and Your
/// papers are not in the app yet).
enum BrandIconName {
  /// A short stack of index cards, the top one with a lime felt tab. Key cards.
  keycards,

  /// An answer sheet with filled bubbles and a pencil. Questions only, Untimed questions.
  questions,

  /// A paper strip torn and mended with lime tape. Your mistakes.
  mistakes,

  /// A small open hardback with a lime ribbon marker. A lesson.
  lesson,

  /// A printed sheet with a lime binder clip. The print sheet, Must-know lines.
  print,

  /// Index cards held by a lime rubber band. Revise, Review again.
  revise,

  /// A fanned deck of tall portrait cards. Chapter feeds (the Explore door).
  feeds,

  /// Three felt pawns, one lime, one cream, one charcoal. The Mob.
  mob,

  /// A brass pocket compass with a lime needle. The Admission Compass.
  compass;

  /// The file.
  String get asset => 'assets/art/icons/$name.webp';

  /// The line icon of the same meaning, drawn below [BrandIcon.minObject].
  IconData get line => switch (this) {
        BrandIconName.keycards => LucideIcons.layers,
        BrandIconName.questions => LucideIcons.listChecks,
        BrandIconName.mistakes => LucideIcons.bandage,
        BrandIconName.lesson => LucideIcons.bookOpen,
        BrandIconName.print => LucideIcons.printer,
        BrandIconName.revise => LucideIcons.rotateCcw,
        BrandIconName.feeds => LucideIcons.galleryVerticalEnd,
        BrandIconName.mob => LucideIcons.usersRound,
        BrandIconName.compass => LucideIcons.compass,
      };
}

/// One desk object in a fixed [size] square (dp). See the file's head for the rules.
class BrandIcon extends StatelessWidget {
  const BrandIcon(this.name, {super.key, this.size = 40, this.label, this.dim = false});

  final BrandIconName name;

  /// The square's side in dp.
  final double size;

  /// What a screen reader says when the icon stands alone. Null (the default) leaves it out of the semantics tree.
  final String? label;

  /// A row that is shown but not pressed (Free's day used): the object at 60%, as on the web.
  final bool dim;

  /// Below this side the line icon is drawn instead of the object.
  static const double minObject = 32;

  /// Every file holds this many pixels a side.
  static const int filePixels = 192;

  /// The decode width for a [size] square at [devicePixelRatio]: the drawn width in device pixels, never more than
  /// the file holds.
  static int cacheWidth(double size, double devicePixelRatio) => (size * devicePixelRatio).round().clamp(1, filePixels);

  @override
  Widget build(BuildContext context) {
    final Widget art = size < minObject ? _line(context) : _object(context);
    final box = SizedBox.square(dimension: size, child: Center(child: dim ? Opacity(opacity: 0.6, child: art) : art));
    final text = label;
    if (text == null) return ExcludeSemantics(child: box);
    return Semantics(image: true, label: text, child: ExcludeSemantics(child: box));
  }

  Widget _line(BuildContext context) {
    final glyph = (size * 0.6).roundToDouble().clamp(14.0, 24.0);
    return Icon(name.line, size: glyph, color: context.mmColors.ink2);
  }

  Widget _object(BuildContext context) {
    final dpr = MediaQuery.maybeDevicePixelRatioOf(context) ?? 2;
    final reduced = Motion.reduced(context);
    return Image.asset(
      name.asset,
      width: size,
      height: size,
      fit: BoxFit.contain,
      cacheWidth: cacheWidth(size, dpr),
      filterQuality: FilterQuality.medium,
      gaplessPlayback: true,
      excludeFromSemantics: true,
      frameBuilder: (context, child, frame, synchronous) {
        if (synchronous || reduced) return child;
        // The first decode settles in rather than popping; the box was already there, so nothing moves.
        return AnimatedOpacity(opacity: frame == null ? 0 : 1, duration: Motion.ui, curve: Motion.out, child: child);
      },
      // A file that will not load leaves the meaning drawn in line, never an empty hole.
      errorBuilder: (context, error, stack) => _line(context),
    );
  }
}

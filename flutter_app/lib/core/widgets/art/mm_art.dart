import 'package:flutter/material.dart';

/// The generated Night Sheet art in `assets/art/` (made by `tool/convert_art.py`). Warm,
/// lamp-lit renders for the moment layer only; never behind anything a student reads.
///
/// Each entry may name a [fallback] that is shown if its own file is missing, and [ArtImage]
/// draws nothing (or the caller's placeholder) if both are missing, so a missing file never
/// breaks a screen.
enum MmArt {
  heroDesk('hero-desk'),
  heroSlab('hero-slab', fallback: MmArt.heroDesk),
  paperTile('paper-tile'),
  foilSeal('foil-seal'),
  mobiGreet('mobi-greet'),
  mobiPoint('mobi-point'),
  mobiThink('mobi-think'),
  mobiCheer('mobi-cheer'),
  mobiRest('mobi-rest'),
  mobiSleepy('mobi-sleepy'),
  mobiRead('mobi-read'),
  emptyAllClear('empty-allclear', fallback: MmArt.mobiRead),
  emptyOffline('empty-offline', fallback: MmArt.mobiSleepy),
  objAccountancy('obj-accountancy'),
  objBusiness('obj-business'),
  objEconomics('obj-economics'),
  objEnglish('obj-english'),
  objGeneralTest('obj-generaltest'),
  tokenFirstMock('token-first-mock'),
  tokenFirstRepair('token-first-repair'),
  tokenHeld('token-held');

  const MmArt(this.file, {this.fallback});

  final String file;
  final MmArt? fallback;

  String get asset => 'assets/art/$file.webp';

  /// The rendered object for an API subject id, or null.
  static MmArt? subjectObject(String? subjectId) => switch (subjectId) {
        'accountancy' => objAccountancy,
        'business_studies' || 'business' => objBusiness,
        'economics' => objEconomics,
        'english' => objEnglish,
        'general_test' || 'gat' => objGeneralTest,
        _ => null,
      };
}

/// Shows an [MmArt] image, decoded at the size it is drawn, falling back to [MmArt.fallback] and
/// then to [placeholder] when a file is missing. Decorative unless [semanticLabel] is given.
class ArtImage extends StatelessWidget {
  const ArtImage(
    this.art, {
    super.key,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
    this.alignment = Alignment.center,
    this.placeholder,
    this.semanticLabel,
  });

  final MmArt art;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Alignment alignment;
  final Widget? placeholder;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) => _image(context, art);

  Widget _image(BuildContext context, MmArt current) {
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final cacheHeight = height == null || !height!.isFinite ? null : (height! * dpr).round();
    final cacheWidth = cacheHeight == null && width != null && width!.isFinite ? (width! * dpr).round() : null;
    return Image.asset(
      current.asset,
      width: width,
      height: height,
      fit: fit,
      alignment: alignment,
      cacheHeight: cacheHeight,
      cacheWidth: cacheWidth,
      filterQuality: FilterQuality.medium,
      gaplessPlayback: true,
      semanticLabel: semanticLabel,
      excludeFromSemantics: semanticLabel == null,
      errorBuilder: (context, error, stack) {
        final next = current.fallback;
        if (next != null) return _image(context, next);
        return placeholder ?? SizedBox(width: width, height: height);
      },
    );
  }
}

import 'package:flutter/material.dart';

/// The generated Night Sheet art in `assets/art/` (made by `tool/convert_art.py`). Warm,
/// lamp-lit renders for the moment layer only; never behind anything a student reads.
///
/// Each entry may name a [fallback] that is shown if its own file is missing, and [ArtImage]
/// draws nothing (or the caller's placeholder) if both are missing, so a missing file never
/// breaks a screen.
enum MmArt {
  heroDesk('hero-desk'),
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
  objMathematics('obj-mathematics'),
  objPhysics('obj-physics'),
  objChemistry('obj-chemistry'),
  objBiology('obj-biology'),
  objHistory('obj-history'),
  objPoliticalScience('obj-politicalscience'),
  objGeography('obj-geography'),
  objPsychology('obj-psychology'),
  objSociology('obj-sociology'),
  objComputerScience('obj-computerscience'),

  /// The open notebook: the language papers and every subject without its own object.
  objLanguage('obj-language'),
  tokenFirstMock('token-first-mock'),
  tokenFirstRepair('token-first-repair'),
  tokenHeld('token-held');

  const MmArt(this.file, {this.fallback});

  final String file;
  final MmArt? fallback;

  String get asset => 'assets/art/$file.webp';

  /// The rendered object for a subject id (public or internal, as `GET /api/subjects` and the
  /// attempts send them). Every subject has one: the 15 practice subjects their own, the
  /// languages and the subjects MockMob does not offer the open notebook. Null only for no id.
  static MmArt? subjectObject(String? subjectId) {
    final id = subjectId?.trim().toLowerCase() ?? '';
    if (id.isEmpty) return null;
    return switch (id) {
      'accountancy' => objAccountancy,
      'business_studies' || 'business' => objBusiness,
      'economics' => objEconomics,
      'english' => objEnglish,
      'general_test' || 'gat' => objGeneralTest,
      'mathematics' || 'applied_mathematics' || 'maths' => objMathematics,
      'physics' => objPhysics,
      'chemistry' => objChemistry,
      'biology' => objBiology,
      'history' => objHistory,
      'political_science' => objPoliticalScience,
      'geography' => objGeography,
      'psychology' => objPsychology,
      'sociology' => objSociology,
      'computer_science' => objComputerScience,
      _ => objLanguage,
    };
  }
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
    this.opacity,
    this.ghost = false,
  });

  final MmArt art;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Alignment alignment;
  final Widget? placeholder;
  final String? semanticLabel;

  /// An optional opacity, applied by the image itself (no extra layer).
  final double? opacity;

  /// Drawn as a grey "not yet" ghost (a colour filter on the paint, no layer).
  final bool ghost;

  @override
  Widget build(BuildContext context) {
    final sized = (height != null && height!.isFinite) || (width != null && width!.isFinite);
    if (sized) return _image(context, art, null);
    // No size given: decode at the width of the box it lands in, never the full 512 px file.
    return LayoutBuilder(
      builder: (context, constraints) => _image(context, art, constraints.hasBoundedWidth ? constraints.maxWidth : null),
    );
  }

  Widget _image(BuildContext context, MmArt current, double? boxWidth) {
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final cacheHeight = height == null || !height!.isFinite ? null : (height! * dpr).round();
    final w = width != null && width!.isFinite ? width : boxWidth;
    final cacheWidth = cacheHeight == null && w != null ? (w * dpr).round() : null;
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
      opacity: opacity == null ? null : AlwaysStoppedAnimation(opacity!),
      // srcATop keeps the art's own outline (transparent stays transparent) and washes it grey.
      color: ghost ? const Color(0xD98A8578) : null,
      colorBlendMode: ghost ? BlendMode.srcATop : null,
      semanticLabel: semanticLabel,
      excludeFromSemantics: semanticLabel == null,
      errorBuilder: (context, error, stack) {
        final next = current.fallback;
        if (next != null) return _image(context, next, boxWidth);
        return placeholder ?? SizedBox(width: width, height: height);
      },
    );
  }
}

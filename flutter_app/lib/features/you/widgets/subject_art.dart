import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';

/// A subject's mark: under 56 dp its line glyph on its colour tile (the renders turn muddy that
/// small); larger, the lamp-lit object, with the subject's initials on a paper disc if the art is
/// missing (never a wrong object).
class SubjectArt extends StatelessWidget {
  const SubjectArt(this.subjectId, {super.key, this.size = 36});

  final String subjectId;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (size < 56) return SubjectGlyphTile(subjectId, size: size);
    final art = MmArt.subjectObject(subjectId);
    final monogram = _Monogram(subjectDisplayName(subjectId), size: size);
    return SizedBox.square(
      dimension: size,
      child: art == null ? monogram : ArtImage(art, height: size, placeholder: monogram),
    );
  }
}

class _Monogram extends StatelessWidget {
  const _Monogram(this.name, {required this.size});

  final String name;
  final double size;

  String get _letters {
    final words = name.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '?';
    if (words.length == 1) return words.first.substring(0, words.first.length.clamp(1, 2));
    return '${words[0][0]}${words[1][0]}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(shape: BoxShape.circle, color: colors.isNight ? colors.raised2 : colors.sunken),
      child: Center(
        child: Text(
          _letters,
          textScaler: TextScaler.noScaling,
          style: context.mmType.caption.copyWith(fontSize: size * 0.34, fontWeight: FontWeight.w700, color: colors.ink2),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../../core/art/art.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';

/// A subject's mark: its code-drawn emblem standing on its own light (legible from 24 dp up),
/// with the subject's initials on a paper disc for a subject the art set does not know (never a
/// wrong object).
class SubjectArt extends StatelessWidget {
  const SubjectArt(this.subjectId, {super.key, this.size = EmblemSizes.chip});

  final String subjectId;
  /// One of [EmblemSizes] (an off-scale size snaps to the nearest, so a subject is the same
  /// object on every screen).
  final double size;

  @override
  Widget build(BuildContext context) {
    final side = EmblemSizes.snap(size);
    if (SubjectIdentity.of(subjectId)?.hasEmblem ?? false) {
      return SubjectEmblem(subject: subjectId, size: side, framed: false);
    }
    return SizedBox.square(dimension: side, child: _Monogram(subjectDisplayName(subjectId), size: side));
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

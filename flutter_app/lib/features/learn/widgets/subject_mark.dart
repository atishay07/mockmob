import 'package:flutter/material.dart';

import '../../../core/art/art.dart';
import '../../../core/theme/theme.dart';

/// A subject's drawn emblem at [size], with the subject's initials on a paper disc when this
/// build has no emblem for the id. Decorative: the name sits beside it.
class SubjectMark extends StatelessWidget {
  const SubjectMark({
    super.key,
    required this.subjectId,
    required this.name,
    this.size = 56,
  });

  final String subjectId;
  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final drawn = SubjectIdentity.of(subjectId)?.hasEmblem ?? false;
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: drawn
            ? SubjectEmblem(subject: subjectId, size: size, framed: false)
            : SubjectMonogram(name: name, size: size),
      ),
    );
  }
}

/// A subject's initials on a paper disc.
class SubjectMonogram extends StatelessWidget {
  const SubjectMonogram({super.key, required this.name, required this.size});

  final String name;
  final double size;

  String get _letters {
    final words = name
        .split(RegExp(r'[\s_-]+'))
        .where((w) => w.isNotEmpty)
        .toList();
    if (words.isEmpty) return '?';
    if (words.length == 1)
      return words.first.substring(0, words.first.length.clamp(1, 2));
    return '${words[0][0]}${words[1][0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: colors.isNight ? colors.raised2 : colors.sunken,
        border: Border.all(color: colors.line),
      ),
      child: Center(
        child: Text(
          _letters,
          textScaler: TextScaler.noScaling,
          style: context.mmType.caption.copyWith(
            fontSize: size * 0.34,
            fontWeight: FontWeight.w700,
            color: colors.ink2,
          ),
        ),
      ),
    );
  }
}

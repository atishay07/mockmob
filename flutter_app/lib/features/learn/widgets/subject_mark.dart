import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// The subject ids that have their own object art, and the language papers that share the open
/// notebook. Anything else is a subject this build does not know yet: it gets its initials, never
/// a borrowed object.
const Set<String> _ownArt = {
  'accountancy', 'business_studies', 'business', 'economics', 'english', 'general_test', 'gat',
  'mathematics', 'applied_mathematics', 'maths', 'physics', 'chemistry', 'biology', 'history',
  'political_science', 'geography', 'psychology', 'sociology', 'computer_science',
};

const Set<String> _languages = {
  'hindi', 'sanskrit', 'bengali', 'tamil', 'telugu', 'kannada', 'malayalam', 'marathi', 'gujarati',
  'odia', 'punjabi', 'assamese', 'urdu', 'french', 'german', 'spanish', 'japanese', 'russian',
  'chinese', 'persian', 'arabic', 'italian', 'nepali', 'tibetan', 'sindhi', 'kashmiri', 'konkani',
  'bodo', 'dogri', 'maithili', 'manipuri', 'santhali',
};

/// A subject id as the art table spells it: lower case, words joined by underscores.
String normalSubjectId(String id) => id.trim().toLowerCase().replaceAll(RegExp(r'[\s-]+'), '_');

/// The art for [subjectId], or null when this build has none for it.
MmArt? learnSubjectArt(String subjectId) {
  final id = normalSubjectId(subjectId);
  if (_ownArt.contains(id) || _languages.contains(id)) return MmArt.subjectObject(id);
  return null;
}

/// A subject's lamp-lit object at [size], with the subject's initials on a paper disc when this
/// build has no art for the id or the file is missing. Decorative: the name sits beside it.
class SubjectMark extends StatelessWidget {
  const SubjectMark({super.key, required this.subjectId, required this.name, this.size = 56});

  final String subjectId;
  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final art = learnSubjectArt(subjectId);
    final monogram = SubjectMonogram(name: name, size: size);
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: art == null ? monogram : ArtImage(art, height: size, placeholder: monogram),
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
    final words = name.split(RegExp(r'[\s_-]+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '?';
    if (words.length == 1) return words.first.substring(0, words.first.length.clamp(1, 2));
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
          style: context.mmType.caption.copyWith(fontSize: size * 0.34, fontWeight: FontWeight.w700, color: colors.ink2),
        ),
      ),
    );
  }
}

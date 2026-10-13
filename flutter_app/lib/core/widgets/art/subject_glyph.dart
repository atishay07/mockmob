import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/theme.dart';

/// Each subject's line glyph, for places under 56 dp where the lamp-lit renders turn muddy
/// (lists, rows, the You sheet). One stroke family for all fifteen, so a row of them reads as a
/// set: a ledger calculator for Accountancy, an org chart for Business Studies, a rising line for
/// Economics, "Aa" for English, a puzzle piece for the General Test, sigma for Mathematics, an
/// atom, a flask, a leaf, code brackets, a columned hall for History, a ballot box for Political
/// Science, a globe, a mind and a group of people. The CUET language papers ([languageIds])
/// share the "translate" mark. Anything else is null: [SubjectGlyphTile] then draws the
/// subject's initials, never a wrong object (WEB-PARITY section 6).
IconData? subjectGlyph(String? subjectId) {
  final id = subjectId?.trim().toLowerCase() ?? '';
  if (languageIds.contains(id)) return LucideIcons.languages;
  return switch (id) {
    'accountancy' => LucideIcons.calculator,
    'business_studies' || 'business' => LucideIcons.network,
    'economics' => LucideIcons.trendingUp,
    'english' => LucideIcons.bookA,
    'general_test' || 'gat' => LucideIcons.puzzle,
    'mathematics' || 'applied_mathematics' || 'maths' => LucideIcons.sigma,
    'physics' => LucideIcons.atom,
    'chemistry' => LucideIcons.flaskConical,
    'biology' => LucideIcons.leaf,
    'computer_science' => LucideIcons.codeXml,
    'history' => LucideIcons.landmark,
    'political_science' => LucideIcons.vote,
    'geography' => LucideIcons.globe,
    'psychology' => LucideIcons.brain,
    'sociology' => LucideIcons.users,
    _ => null,
  };
}

/// The CUET UG language papers other than English, which carry the translate mark.
const Set<String> languageIds = {
  'hindi', 'assamese', 'bengali', 'gujarati', 'kannada', 'malayalam', 'marathi', 'odia', //
  'punjabi', 'tamil', 'telugu', 'urdu', 'sanskrit', 'arabic', 'bodo', 'chinese', 'dogri', //
  'french', 'german', 'italian', 'japanese', 'kashmiri', 'konkani', 'maithili', 'manipuri', //
  'nepali', 'persian', 'russian', 'santhali', 'sindhi', 'spanish', 'tibetan',
};

/// The initials a subject without a glyph shows: "Ph" for a one-word id, "CS" for two words.
/// Empty for no id.
String subjectMonogram(String? subjectId) {
  final words = (subjectId ?? '').trim().split(RegExp(r'[\s_-]+')).where((w) => w.isNotEmpty).toList();
  if (words.isEmpty) return '';
  if (words.length == 1) {
    final w = words.first;
    return w.length == 1 ? w.toUpperCase() : w[0].toUpperCase() + w[1].toLowerCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/// A subject's glyph on a tile of its own colour field (radius 12 at 40 dp, scaled with [size]).
/// A subject without a glyph shows its initials in the same tile. Decorative: the row it sits in
/// names the subject.
class SubjectGlyphTile extends StatelessWidget {
  const SubjectGlyphTile(this.subjectId, {super.key, this.size = 40});

  final String? subjectId;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final field = SubjectLight.forSubject(subjectId)?.of(Theme.of(context).brightness) ?? colors.raised2;
    final glyph = subjectGlyph(subjectId);
    final ink = colors.ink.withValues(alpha: 0.86);
    return ExcludeSemantics(
      child: DecoratedBox(
        decoration: ShapeDecoration(
          color: field,
          shape: RoundedSuperellipseBorder(
            borderRadius: BorderRadius.circular(size * 0.3),
            side: BorderSide(color: colors.ink.withValues(alpha: colors.isNight ? 0.08 : 0.06)),
          ),
        ),
        child: SizedBox.square(
          dimension: size,
          child: glyph != null
              ? Icon(glyph, size: size * 0.5, color: ink)
              : Center(
                  child: Text(
                    subjectMonogram(subjectId),
                    textScaler: TextScaler.noScaling,
                    style: context.mmType.labelLarge.copyWith(fontSize: size * 0.36, height: 1, fontWeight: FontWeight.w700, color: ink),
                  ),
                ),
        ),
      ),
    );
  }
}

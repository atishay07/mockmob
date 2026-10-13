import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/theme.dart';

/// Each subject's line glyph, for places under 56 dp where the lamp-lit renders turn muddy
/// (lists, rows, the You sheet). One stroke family for all fifteen, so a row of them reads as a
/// set: a ledger calculator for Accountancy, an org chart for Business Studies, a rising line for
/// Economics, "Aa" for English, a puzzle piece for the General Test, sigma for Mathematics, an
/// atom, a flask, a leaf, code brackets, a columned hall for History, a ballot box for Political
/// Science, a globe, a mind and a group of people. Languages share the "translate" mark.
IconData subjectGlyph(String? subjectId) {
  final id = subjectId?.trim().toLowerCase() ?? '';
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
    _ => LucideIcons.languages,
  };
}

/// A subject's glyph on a tile of its own colour field (radius 12 at 40 dp, scaled with [size]).
/// Decorative: the row it sits in names the subject.
class SubjectGlyphTile extends StatelessWidget {
  const SubjectGlyphTile(this.subjectId, {super.key, this.size = 40});

  final String? subjectId;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final field = SubjectLight.forSubject(subjectId)?.of(Theme.of(context).brightness) ?? colors.raised2;
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
          child: Icon(subjectGlyph(subjectId), size: size * 0.5, color: colors.ink.withValues(alpha: 0.86)),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

/// The subject light fields (brief section 3): low-saturation radial colour behind art only,
/// never behind text that is read. Each field is a centre colour that fades into the ground.
enum SubjectLight {
  accountancy(Color(0xFF3B2A10), Color(0xFFF6E8CF)),
  businessStudies(Color(0xFF14213F), Color(0xFFDCE3F7)),
  economics(Color(0xFF0F3330), Color(0xFFD3EEEA)),
  english(Color(0xFF3A1626), Color(0xFFF4DDE6)),
  generalTest(Color(0xFF22300F), Color(0xFFE2EDCF)),
  mathematics(Color(0xFF1C2638), Color(0xFFDEE4EE)),
  physics(Color(0xFF241C3A), Color(0xFFE4DEF2)),
  chemistry(Color(0xFF0E2F2A), Color(0xFFD2ECE6)),
  biology(Color(0xFF1C2E12), Color(0xFFDDEBD0)),
  history(Color(0xFF3A2414), Color(0xFFF3E2D2)),
  politicalScience(Color(0xFF38171A), Color(0xFFF2DADB)),
  geography(Color(0xFF102A3A), Color(0xFFD4E6F0)),
  psychology(Color(0xFF301A33), Color(0xFFEDDCEF)),
  sociology(Color(0xFF34280E), Color(0xFFF1E6CC)),
  computerScience(Color(0xFF14291C), Color(0xFFD6EADC)),
  language(Color(0xFF2E2418), Color(0xFFEFE5D6));

  const SubjectLight(this.night, this.day);

  final Color night;
  final Color day;

  Color of(Brightness brightness) => brightness == Brightness.dark ? night : day;

  /// Maps a subject id (`business_studies`, `general_test`, `gat`, ...) to its field. Every
  /// subject has one (languages and subjects without their own share the notebook's sepia);
  /// null only for no id.
  static SubjectLight? forSubject(String? subjectId) {
    final id = subjectId?.trim().toLowerCase() ?? '';
    if (id.isEmpty) return null;
    return switch (id) {
      'accountancy' => accountancy,
      'business_studies' || 'business' => businessStudies,
      'economics' => economics,
      'english' => english,
      'general_test' || 'gat' => generalTest,
      'mathematics' || 'applied_mathematics' || 'maths' => mathematics,
      'physics' => physics,
      'chemistry' => chemistry,
      'biology' => biology,
      'history' => history,
      'political_science' => politicalScience,
      'geography' => geography,
      'psychology' => psychology,
      'sociology' => sociology,
      'computer_science' => computerScience,
      _ => language,
    };
  }
}

import 'package:flutter/material.dart';

/// The subject light fields (brief section 3): low-saturation radial colour behind art only,
/// never behind text that is read. Each field is a centre colour that fades into the ground.
enum SubjectLight {
  accountancy(Color(0xFF3B2A10), Color(0xFFF6E8CF)),
  businessStudies(Color(0xFF14213F), Color(0xFFDCE3F7)),
  economics(Color(0xFF0F3330), Color(0xFFD3EEEA)),
  english(Color(0xFF3A1626), Color(0xFFF4DDE6)),
  generalTest(Color(0xFF22300F), Color(0xFFE2EDCF));

  const SubjectLight(this.night, this.day);

  final Color night;
  final Color day;

  Color of(Brightness brightness) => brightness == Brightness.dark ? night : day;

  /// Maps an API subject id (`business_studies`, `general_test`, ...) to its field, or null.
  static SubjectLight? forSubject(String? subjectId) => switch (subjectId) {
        'accountancy' => accountancy,
        'business_studies' || 'business' => businessStudies,
        'economics' => economics,
        'english' => english,
        'general_test' || 'gat' => generalTest,
        _ => null,
      };
}

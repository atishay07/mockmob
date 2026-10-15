import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/art/art.dart';
import 'package:mockmob/core/theme/light_fields.dart';

void main() {
  const fifteen = [
    'accountancy',
    'business_studies',
    'economics',
    'english',
    'general_test',
    'mathematics',
    'physics',
    'chemistry',
    'biology',
    'history',
    'political_science',
    'geography',
    'psychology',
    'sociology',
    'computer_science',
  ];

  test('the fifteen subjects each have their own drawn emblem', () {
    expect(SubjectIdentity.subjects.map((s) => s.id), fifteen);
    final kinds = {for (final s in SubjectIdentity.subjects) s.kind};
    expect(kinds, hasLength(15));
    for (final id in fifteen) {
      final s = SubjectIdentity.of(id)!;
      expect(s.id, id);
      expect(s.hasEmblem, isTrue, reason: id);
      expect(s.name, isNotEmpty);
      expect(s.short, isNotEmpty);
    }
  });

  test('aliases the API and older screens use resolve to the same subject', () {
    expect(SubjectIdentity.of('business')!.id, 'business_studies');
    expect(SubjectIdentity.of('Business Studies')!.id, 'business_studies');
    expect(SubjectIdentity.of('gat')!.id, 'general_test');
    expect(SubjectIdentity.of('general-test')!.id, 'general_test');
    expect(SubjectIdentity.of('applied_mathematics')!.id, 'mathematics');
    expect(SubjectIdentity.of('maths')!.id, 'mathematics');
    expect(SubjectIdentity.of(' ECONOMICS ')!.id, 'economics');
  });

  test('language papers share the language emblem; unknown subjects get initials', () {
    expect(SubjectIdentity.of('hindi')!.kind, EmblemKind.language);
    expect(SubjectIdentity.of('sanskrit')!.hasEmblem, isTrue);
    final other = SubjectIdentity.of('film_arts')!;
    expect(other.kind, EmblemKind.other);
    expect(other.hasEmblem, isFalse);
    expect(other.name, 'Film arts');
    expect(SubjectIdentity.monogram('film_arts'), 'FA');
    expect(SubjectIdentity.monogram('physics'), 'Ph');
    expect(SubjectIdentity.of(null), isNull);
    expect(SubjectIdentity.of('  '), isNull);
  });

  test('the thirteen subjects added on 15 Oct 2026 each have an object, by every id the API and the website use', () {
    const more = {
      'environmental_studies': EmblemKind.environmentalStudies,
      'mass_media': EmblemKind.massMedia,
      'home_science': EmblemKind.homeScience,
      'physical_education': EmblemKind.physicalEducation,
      'legal_studies': EmblemKind.legalStudies,
      'knowledge_tradition_india': EmblemKind.knowledgeTradition,
      'anthropology': EmblemKind.anthropology,
      'fine_arts': EmblemKind.fineArts,
      'performing_arts': EmblemKind.performingArts,
      'engineering_graphics': EmblemKind.engineeringGraphics,
      'entrepreneurship': EmblemKind.entrepreneurship,
      'agriculture': EmblemKind.agriculture,
      'teaching_aptitude': EmblemKind.teachingAptitude,
    };
    expect(SubjectIdentity.moreSubjects.map((s) => s.id), more.keys);
    for (final MapEntry(key: id, value: kind) in more.entries) {
      final s = SubjectIdentity.of(id)!;
      expect(s.kind, kind, reason: id);
      expect(s.id, id);
      expect(s.hasEmblem, isTrue, reason: id);
      expect(s.name, isNotEmpty);
      expect(s.short, isNotEmpty);
    }
    // Aliases and spellings other screens use.
    expect(SubjectIdentity.of('Environmental Studies')!.kind, EmblemKind.environmentalStudies);
    expect(SubjectIdentity.of('environmental-science')!.kind, EmblemKind.environmentalStudies);
    expect(SubjectIdentity.of('mass_communication')!.kind, EmblemKind.massMedia);
    expect(SubjectIdentity.of('visual-arts')!.kind, EmblemKind.fineArts);
    expect(SubjectIdentity.of(' AGRICULTURE ')!.kind, EmblemKind.agriculture);
    // The fifteen are untouched, and the language papers still share the notebook.
    expect(SubjectIdentity.subjects, hasLength(15));
    expect(SubjectIdentity.withObjects, hasLength(28));
    expect(SubjectIdentity.of('hindi')!.kind, EmblemKind.language);
  });

  test('every subject with an object floats on its own phase', () {
    final all = [...SubjectIdentity.withObjects, SubjectIdentity.language];
    final phases = all.map((s) => s.phase).toList()..sort();
    expect(phases.toSet(), hasLength(all.length));
    for (var i = 1; i < phases.length; i++) {
      expect(phases[i] - phases[i - 1], greaterThanOrEqualTo(0.01), reason: 'two subjects float almost together at ${phases[i]}');
    }
  });

  test('each subject keeps its existing light field', () {
    for (final id in fifteen) {
      expect(SubjectIdentity.of(id)!.light, SubjectLight.forSubject(id), reason: id);
    }
  });

  test('form inks are distinct, never volt, and readable on their own field', () {
    const volt = Color(0xFFD2F000);
    for (final b in Brightness.values) {
      final inks = {for (final s in SubjectIdentity.subjects) s.formInk(b).toARGB32()};
      expect(inks, hasLength(15), reason: '$b');
      for (final s in SubjectIdentity.subjects) {
        expect(s.formInk(b), isNot(volt));
        final ratio = _contrast(s.formInk(b), s.field(b));
        expect(ratio, greaterThanOrEqualTo(3.0), reason: '${s.id} $b ink on field is $ratio');
      }
    }
  });

  test('idle phases differ so a row of emblems never moves together', () {
    final phases = {for (final s in SubjectIdentity.subjects) s.phase};
    expect(phases, hasLength(15));
    for (final p in phases) {
      expect(p, inInclusiveRange(0, 1));
    }
  });

  test('detail follows size like optical sizes', () {
    expect(EmblemDetail.forSize(24), EmblemDetail.glyph);
    expect(EmblemDetail.forSize(39.9), EmblemDetail.glyph);
    expect(EmblemDetail.forSize(40), EmblemDetail.tile);
    expect(EmblemDetail.forSize(95), EmblemDetail.tile);
    expect(EmblemDetail.forSize(96), EmblemDetail.plate);
    expect(EmblemDetail.forSize(160), EmblemDetail.plate);
  });
}

double _contrast(Color a, Color b) {
  final la = a.computeLuminance(), lb = b.computeLuminance();
  final hi = la > lb ? la : lb, lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}

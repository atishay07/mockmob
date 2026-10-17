// The four papers CUET dropped in 2025 (entrepreneurship, teaching aptitude, legal studies and
// engineering graphics) are in no picker and no start path. Their rows stay on the server.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/subject.dart';
import 'package:mockmob/features/onboarding/data/subject_registry.dart';
import 'package:mockmob/features/practice/model/practice_link.dart';
import 'package:mockmob/features/practice/model/practice_selection.dart';

Map<String, dynamic> _row(String id, String practice, {String? name}) => {'id': id, 'internalId': id, 'name': name ?? id, 'practice': practice};

void main() {
  const hidden = ['entrepreneurship', 'teaching_aptitude', 'legal_studies', 'engineering_graphics'];

  test('the four dropped subjects are hidden, however the server marks them', () {
    for (final id in hidden) {
      expect(isHiddenSubject(id), isTrue, reason: id);
      expect(Subject.fromJson(_row(id, 'supported')).isOffered, isFalse, reason: '$id supported');
      expect(Subject.fromJson(_row(id, 'not_offered')).isOffered, isFalse, reason: '$id not offered');
    }
    expect(isHiddenSubject('accountancy'), isFalse);
    expect(Subject.fromJson(_row('accountancy', 'supported')).isOffered, isTrue);
  });

  test('the onboarding picker lists none of them, offered or not', () {
    final registry = SubjectRegistry.fromRows([
      _row('accountancy', 'supported', name: 'Accountancy'),
      _row('english', 'supported', name: 'English'),
      for (final id in hidden) _row(id, 'not_offered', name: id),
      _row('agriculture', 'not_offered', name: 'Agriculture'),
    ]);
    expect([for (final u in registry.unoffered) u.id], ['agriculture']);
  });

  test('a link that names a dropped subject starts in the student\'s own subject instead', () {
    final link = PracticeLink.of(Uri.parse('/practice/start?mode=quick&subject=legal_studies&count=10'));
    expect(link.subject, isNull);
    final sel = link.selectionFor(PracticeMode.quick, fallbackSubject: 'accountancy');
    expect(sel?.subjectId, 'accountancy');
    expect(PracticeLink.of(Uri.parse('/practice/start?subject=economics')).subject, 'economics');
  });
}

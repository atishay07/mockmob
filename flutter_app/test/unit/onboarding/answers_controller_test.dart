import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/storage/prefs_store.dart';
import 'package:mockmob/features/onboarding/data/du_catalog.dart';
import 'package:mockmob/features/onboarding/state/answers_controller.dart';
import 'package:mockmob/features/onboarding/state/answers_store.dart';

void main() {
  test('changing the category drops picks that category never seated', () async {
    // A course with one college that seated the default category but not another, and one
    // college that seated both.
    late DuCourse course;
    late String other, hidden, shared;
    search:
    for (final c in DuCatalog.courses) {
      for (final cat in DuCatalog.categories) {
        if (cat == DuCatalog.defaultCategory) continue;
        final gone = c.offerings.where((o) => o.scoreFor(DuCatalog.defaultCategory) != null && o.scoreFor(cat) == null);
        final kept = c.offerings.where((o) => o.scoreFor(DuCatalog.defaultCategory) != null && o.scoreFor(cat) != null);
        if (gone.isNotEmpty && kept.isNotEmpty) {
          course = c;
          other = cat;
          hidden = gone.first.college;
          shared = kept.first.college;
          break search;
        }
      }
    }

    final c = ProviderContainer(overrides: [answersStoreProvider.overrideWithValue(AnswersStore(MemoryPrefsStore()))]);
    addTearDown(c.dispose);
    await c.read(onboardingAnswersProvider.future);
    final answers = c.read(onboardingAnswersProvider.notifier)
      ..setCourse(course.id)
      ..toggleCollege(hidden)
      ..toggleCollege(shared)
      ..setCategory(other);

    final a = c.read(onboardingAnswersProvider).value!;
    expect(a.category, other);
    expect(a.colleges, [shared], reason: 'every pick left is a row on the ladder');
    expect(course.ladder(other).map((o) => o.college), containsAll(a.colleges));
    // The cap counts only what the student can see: two more picks fit.
    final more = course.ladder(other).map((o) => o.college).where((x) => x != shared).take(2);
    for (final college in more) {
      expect(answers.toggleCollege(college), isTrue);
    }
  });
}

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/models/models.dart';

/// A subject the student can pick on the subject step.
class SubjectOption {
  const SubjectOption(this.id, this.name);

  /// Public id sent to the API, for example `business_studies`.
  final String id;
  final String name;
}

/// The Commerce launch subjects (spec 5.1.2 and amendment A6), shown as the four main rows.
const List<SubjectOption> kCommerceSubjects = [
  SubjectOption('english', 'English'),
  SubjectOption('accountancy', 'Accountancy'),
  SubjectOption('business_studies', 'Business Studies'),
  SubjectOption('economics', 'Economics'),
];

/// The other supported subjects, used until `/api/subjects` answers and whenever it cannot.
const List<SubjectOption> kOtherSubjectsFallback = [
  SubjectOption('general_test', 'General Test'),
  SubjectOption('mathematics', 'Mathematics'),
  SubjectOption('physics', 'Physics'),
  SubjectOption('chemistry', 'Chemistry'),
  SubjectOption('biology', 'Biology'),
  SubjectOption('history', 'History'),
  SubjectOption('political_science', 'Political Science'),
  SubjectOption('geography', 'Geography'),
  SubjectOption('psychology', 'Psychology'),
  SubjectOption('sociology', 'Sociology'),
  SubjectOption('computer_science', 'Computer Science'),
];

class SubjectChoices {
  const SubjectChoices({this.commerce = kCommerceSubjects, this.others = kOtherSubjectsFallback});

  final List<SubjectOption> commerce;
  final List<SubjectOption> others;

  /// Display name for a subject id, or null when unknown.
  String? nameOf(String id) {
    for (final s in [...commerce, ...others]) {
      if (s.id == id) return s.name;
    }
    return null;
  }
}

/// The bundled lists straight away, refined from `GET /api/subjects` when the phone is online.
/// A failed read changes nothing: the bundled lists keep working offline.
final subjectChoicesProvider = NotifierProvider<SubjectChoicesNotifier, SubjectChoices>(SubjectChoicesNotifier.new);

class SubjectChoicesNotifier extends Notifier<SubjectChoices> {
  @override
  SubjectChoices build() {
    Future.microtask(refresh);
    return const SubjectChoices();
  }

  Future<void> refresh() async {
    try {
      final response = await ref.read(apiClientProvider).get('/api/subjects', options: const ApiOptions(authenticated: false, retries: 0));
      final subjects = [
        for (final raw in response.list)
          if (raw is Map) Subject.fromJson(Map<String, dynamic>.from(raw)),
      ].where((s) => s.isSupported && s.id.isNotEmpty).toList();
      if (subjects.isEmpty || !ref.mounted) return;
      final others = [
        for (final s in subjects)
          if (!launchSubjectIds.contains(s.id) && s.id != 'applied_mathematics') SubjectOption(s.id, s.name),
      ];
      if (others.isNotEmpty) state = SubjectChoices(others: others);
    } on ApiError {
      // Keep the bundled list.
    }
  }
}

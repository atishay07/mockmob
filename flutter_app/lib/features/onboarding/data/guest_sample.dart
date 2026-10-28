import 'dart:convert';

import '../../../core/storage/prefs_store.dart';

/// What the guest has done so far, kept on this phone until an account imports it.
///
/// [answers] maps a sample question id (`q1`) to the chosen option key (`A`). [imported] is set
/// only after the server acknowledged the import, so the sample is never sent twice.
class GuestSample {
  const GuestSample({this.importKey, this.subject, this.answers = const {}, this.imported = false});

  factory GuestSample.fromJson(Map<String, dynamic> json) => GuestSample(
        importKey: json['importKey'] as String?,
        subject: json['subject'] as String?,
        answers: {
          for (final e in ((json['answers'] as Map?) ?? const {}).entries) e.key as String: e.value as String,
        },
        imported: json['imported'] == true,
      );

  static const empty = GuestSample();

  final String? importKey;

  /// Public subject id chosen on the subject step, for example `accountancy`.
  final String? subject;
  final Map<String, String> answers;
  final bool imported;

  int get answeredCount => answers.length;
  bool get hasStarted => answers.isNotEmpty;
  bool isComplete(int total) => answers.length >= total;
  String? answerFor(String questionId) => answers[questionId];

  /// 1-based index of the first question without an answer, or null when all are answered.
  int? firstUnanswered(List<String> questionIds) {
    for (var i = 0; i < questionIds.length; i++) {
      if (!answers.containsKey(questionIds[i])) return i + 1;
    }
    return null;
  }

  GuestSample copyWith({String? importKey, String? subject, Map<String, String>? answers, bool? imported}) => GuestSample(
        importKey: importKey ?? this.importKey,
        subject: subject ?? this.subject,
        answers: answers ?? this.answers,
        imported: imported ?? this.imported,
      );

  Map<String, dynamic> toJson() => {
        'importKey': importKey,
        'subject': subject,
        'answers': answers,
        'imported': imported,
      };
}

/// Reads and writes the guest sample as one JSON string. A missing or damaged value reads as empty.
class GuestSampleStore {
  GuestSampleStore(this._prefs);

  final PrefsStore _prefs;

  static const storageKey = 'onboarding_guest_sample_v1';

  Future<GuestSample> load() async {
    try {
      final raw = await _prefs.getString(storageKey);
      if (raw == null) return GuestSample.empty;
      return GuestSample.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } on Object {
      return GuestSample.empty;
    }
  }

  Future<void> save(GuestSample sample) => _prefs.setString(storageKey, jsonEncode(sample.toJson()));
}

import 'dart:convert';

/// One answer option of a sample question. [key] is `A` to `D`, the key the server expects.
class SampleOption {
  const SampleOption({required this.key, required this.text});

  final String key;
  final String text;
}

/// One of the five bundled landing questions (`assets/sample/sample_questions.json`).
class SampleQuestion {
  const SampleQuestion({
    required this.id,
    required this.subject,
    required this.prompt,
    required this.options,
    required this.correctKey,
    required this.why,
  });

  /// `q1` to `q5`, the ids the server knows.
  final String id;
  final String subject;
  final String prompt;
  final List<SampleOption> options;
  final String correctKey;
  final String why;

  SampleOption optionFor(String key) => options.firstWhere((o) => o.key == key, orElse: () => options.first);
  SampleOption get correct => optionFor(correctKey);
}

/// The bundled sample: five questions, the version string and the disclaimer.
class SampleSet {
  const SampleSet({required this.version, required this.disclaimer, required this.questions});

  factory SampleSet.parse(String source) {
    final json = jsonDecode(source) as Map<String, dynamic>;
    final questions = <SampleQuestion>[
      for (final raw in (json['questions'] as List).cast<Map<String, dynamic>>())
        SampleQuestion(
          id: raw['id'] as String,
          subject: raw['subject'] as String,
          prompt: raw['q'] as String,
          options: [
            for (final o in (raw['options'] as List).cast<Map<String, dynamic>>())
              SampleOption(key: o['key'] as String, text: o['text'] as String),
          ],
          correctKey: raw['correct'] as String,
          why: raw['why'] as String,
        ),
    ];
    return SampleSet(
      version: json['sampleVersion'] as String,
      disclaimer: json['disclaimer'] as String,
      questions: questions,
    );
  }

  final String version;
  final String disclaimer;
  final List<SampleQuestion> questions;

  int get total => questions.length;
}

/// The server's sample id list, used before the bundled file has loaded.
const int kSampleQuestionCount = 5;

/// The question ids in order, known without reading the asset.
const List<String> kSampleQuestionIds = ['q1', 'q2', 'q3', 'q4', 'q5'];

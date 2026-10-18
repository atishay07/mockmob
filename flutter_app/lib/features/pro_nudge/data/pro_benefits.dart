import '../copy.dart';

/// What the app already holds about the student, as far as it is known. Every field is either a
/// real figure or empty: nothing here is a guess, and an unknown figure is null, never zero.
class ProFacts {
  const ProFacts({
    this.mocksTaken = 0,
    this.weakestChapter,
    this.weakestSubject,
    this.creditsUsed,
    this.creditsUsedAtLeast = false,
    this.practiceCredits,
    this.subjectCount = 0,
    this.targetColleges = 0,
  });

  /// Full mocks and exam-day mocks the student has submitted.
  final int mocksTaken;

  /// The chapter that has cost the student the most marks, when Review has a record.
  final String? weakestChapter;

  /// That chapter's subject, when the record names it. Used when there is no chapter to name.
  final String? weakestSubject;

  /// Practice credits spent, from the credits history. Null when the history is not known.
  final int? creditsUsed;

  /// The history has more pages than were read, so [creditsUsed] is a floor.
  final bool creditsUsedAtLeast;

  /// Practice credits left, null when unknown or out of date.
  final int? practiceCredits;
  final int subjectCount;
  final int targetColleges;

  static const empty = ProFacts();
}

/// One line the Upgrade sheet may show, with how relevant it is.
class ProBenefit {
  const ProBenefit({required this.id, required this.text, required this.weight});

  final String id;
  final String text;
  final int weight;
}

abstract final class ProBenefits {
  /// Below this many credits a Full mock cannot be taken, so "only N left" matters.
  static const int lowCredits = ProNudgeCopy.fullMockCredits;

  /// The most personal lines one sheet shows.
  static const int maxPersonal = 3;

  /// The student's own lines, most relevant first, at most [limit]. Each one appears only when its
  /// figure is known and true; with nothing to say this is empty and the caller shows the plain
  /// list. [reason] lifts the lines that belong with the feature that asked for Pro.
  static List<ProBenefit> personal(ProFacts f, {ProReason reason = ProReason.general, int limit = maxPersonal}) {
    final out = <ProBenefit>[];

    final chapter = f.weakestChapter?.trim();
    final subject = f.weakestSubject?.trim();
    if (chapter != null && chapter.isNotEmpty) {
      out.add(ProBenefit(id: 'weakest', text: ProNudgeCopy.weakestChapter(chapter), weight: 90));
    } else if (subject != null && subject.isNotEmpty) {
      out.add(ProBenefit(id: 'weakest', text: ProNudgeCopy.weakestSubject(subject), weight: 85));
    }

    final left = f.practiceCredits;
    if (left != null && left < lowCredits) {
      out.add(ProBenefit(id: 'left', text: ProNudgeCopy.creditsLeft(left), weight: 88));
    }

    final used = f.creditsUsed;
    if (used != null && used > 0) {
      out.add(ProBenefit(id: 'used', text: ProNudgeCopy.creditsUsed(used, atLeast: f.creditsUsedAtLeast), weight: 80));
    }

    if (f.mocksTaken > 0) {
      out.add(ProBenefit(id: 'mocks', text: ProNudgeCopy.mocksTaken(f.mocksTaken), weight: 70));
    }

    if (f.targetColleges > 0) {
      out.add(ProBenefit(id: 'colleges', text: ProNudgeCopy.colleges(f.targetColleges), weight: 60));
    }

    if (f.subjectCount >= 2) {
      out.add(ProBenefit(id: 'subjects', text: ProNudgeCopy.subjects(f.subjectCount), weight: 50));
    }

    final lift = _lift(reason);
    int score(ProBenefit b) => b.weight + (lift.contains(b.id) ? 30 : 0);
    out.sort((a, b) => score(b).compareTo(score(a)));
    return out.take(limit).toList();
  }

  /// The ids that belong with the feature that asked for Pro.
  static Set<String> _lift(ProReason reason) => switch (reason) {
        ProReason.ntaMode => {'subjects', 'mocks'},
        ProReason.unlimitedMocks => {'mocks'},
        ProReason.smartPractice || ProReason.difficulty || ProReason.reviewChapter || ProReason.insightsChapters => {'weakest'},
        ProReason.practiceCredits => {'left', 'used'},
        _ => const {},
      };

  /// The most lines one sheet shows, as on the website.
  static const int maxLines = 4;

  /// Which plain line each personal line speaks for, by the plain line's place in
  /// [ProNudgeCopy.plainBenefits] (unlimited, credits, NTA, Smart). A personal line stands in for its
  /// plain one, as on the website, so one benefit is never said twice.
  static const Map<String, int> _standsFor = {'mocks': 0, 'used': 1, 'left': 1, 'subjects': 2, 'weakest': 3};

  /// The lines the sheet draws: the student's own first, then the plain lines to fill to [maxLines].
  /// With nothing personal it is the plain list alone.
  static List<String> lines(ProFacts f, {ProReason reason = ProReason.general}) {
    const plain = ProNudgeCopy.plainBenefits;
    final mine = personal(f, reason: reason);
    final covered = {for (final b in mine) ?_standsFor[b.id]};
    final out = [for (final b in mine) b.text];
    for (var i = 0; i < plain.length && out.length < maxLines; i++) {
      if (!covered.contains(i)) out.add(plain[i]);
    }
    return out;
  }

  /// Whether [lines] opens with the student's own lines (the heading then says "built around your prep").
  static bool isPersonal(ProFacts f, {ProReason reason = ProReason.general}) => personal(f, reason: reason).isNotEmpty;
}

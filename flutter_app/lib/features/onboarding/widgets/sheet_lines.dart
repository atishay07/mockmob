import '../model/answers.dart';
import '../model/deck.dart';
import '../data/subjects.dart';
import '../model/plan.dart';

/// The lines engraved on the front of the sheet, one per answered step, in deck order.
List<String> sheetLines(OnboardingAnswers a) {
  final lines = <String>[];
  final stage = a.stage;
  if (stage != null) lines.add(stage.sheetLine);

  final course = a.course;
  if (course != null) {
    final picks = [for (final name in a.colleges) course.offeringAt(name)?.short ?? name];
    if (picks.isNotEmpty) {
      lines.add('${course.short}: ${picks.join(', ')}');
    } else {
      lines.add(a.openToAny ? '${course.short}, any college is fine' : course.short);
    }
  } else if (a.courseUndecided) {
    lines.add('Course: deciding later');
  }

  if (a.isDone(Steps.subjects) && a.subjects.isNotEmpty) {
    lines.add(subjectsLine(a));
  }

  if (a.worry != null) lines.add(FirstMove.of(a).line);

  final w = a.warmup;
  if (w != null) {
    // Never "0 s": a tap under half a second still took about a second.
    final seconds = (w.millis / 1000).round().clamp(1, 1 << 30);
    lines.add(w.correct ? 'Warm-up: right in $seconds s' : 'Warm-up: one trap found');
  }

  if (a.isDone(Steps.rhythm)) {
    lines.add(
      '${a.days.length} ${a.days.length == 1 ? a.window.plural.substring(0, a.window.plural.length - 1) : a.window.plural} a week, ${a.minutes} min, ${a.window.time}',
    );
  }
  return lines;
}

/// The subjects line. The order is only claimed when the ratings differ; a tie says so.
String subjectsLine(OnboardingAnswers a) {
  final ranked = a.ranked;
  if (ranked.length == 1) return 'Subject: ${ranked.first.label}';
  Confidence of(SheetSubject s) => a.confidence[s] ?? Confidence.okay;
  if (of(ranked[0]) != of(ranked[1])) return 'Weakest first: ${ranked[0].label}, then ${ranked[1].label}';
  final tied = [for (final s in ranked) if (of(s) == of(ranked[0])) s];
  final names = tied.length == 2 ? '${tied[0].label} and ${tied[1].label}' : '${tied.length} subjects';
  final both = tied.length == 2 ? 'both' : 'all';
  return '$names, $both ${of(ranked[0]).label}. Your check sorts them.';
}

import '../model/answers.dart';
import '../model/deck.dart';
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
      lines.add(a.openToAny ? '${course.short}, open to any college' : course.short);
    }
  } else if (a.courseUndecided) {
    lines.add('Course: deciding later');
  }

  if (a.isDone(Steps.subjects) && a.subjects.isNotEmpty) {
    final ranked = a.ranked;
    lines.add(ranked.length == 1 ? 'Subject: ${ranked.first.label}' : 'Weakest first: ${ranked[0].label}, then ${ranked[1].label}');
  }

  if (a.worry != null) lines.add(FirstMove.of(a).line);

  final w = a.warmup;
  if (w != null) {
    // Never "0 s": a tap under half a second still took about a second.
    final seconds = (w.millis / 1000).round().clamp(1, 1 << 30);
    lines.add(w.correct ? 'One real question: right in $seconds s' : 'One real question: one trap found');
  }

  if (a.isDone(Steps.rhythm)) {
    lines.add(
      '${a.days.length} ${a.days.length == 1 ? a.window.plural.substring(0, a.window.plural.length - 1) : a.window.plural} a week, ${a.minutes} min, ${a.window.time}',
    );
  }
  return lines;
}

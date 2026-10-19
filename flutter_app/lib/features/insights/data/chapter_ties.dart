// Ties in the record's chapter ranking (owner I14, 19 Oct; the Ask Mobi remainder on 20 Oct). Chapters that lost the
// same marks share one rank (core/domain/competition_rank.dart), so Ask Mobi never names one of two equal chapters as
// "the most". Review, the result line and Today say ties the same way.

import '../../../core/domain/competition_rank.dart' show rankOf;
import 'insights_models.dart';

/// [ranked] by marks lost, most first. Stable: chapters that lost the same marks keep the record's own order.
List<ChapterLine> byMarksLost(List<ChapterLine> ranked) {
  final indexed = [for (var i = 0; i < ranked.length; i++) (i, ranked[i])];
  indexed.sort((a, b) {
    final byLost = b.$2.lost.compareTo(a.$2.lost);
    return byLost != 0 ? byLost : a.$1.compareTo(b.$1);
  });
  return [for (final e in indexed) e.$2];
}

/// Every chapter that shares the first place by marks lost, most first. One chapter when it stands alone; empty when
/// nothing is ranked.
List<ChapterLine> costliestChapters(List<ChapterLine> ranked) {
  final sorted = byMarksLost(ranked);
  if (sorted.isEmpty) return const [];
  final top = sorted.first.lost;
  final place = rankOf(top, [for (final c in sorted) c.lost]);
  return sorted.take(place.tied).toList();
}

/// Names said together: "A and B", "A, B and C", "A, B and 2 more".
String namesTogether(List<String> names) => switch (names.length) {
      0 => '',
      1 => names.single,
      2 => '${names[0]} and ${names[1]}',
      3 => '${names[0]}, ${names[1]} and ${names[2]}',
      _ => '${names[0]}, ${names[1]} and ${names.length - 2} more',
    };

/// Where the tied chapters lost their marks, after "in": "Ray Optics" alone, "each of Ray Optics and Optics" for two,
/// "each of 4 chapters" for more.
String costliestPlace(List<String> names) => switch (names.length) {
      0 => '',
      1 => names.single,
      2 => 'each of ${namesTogether(names)}',
      _ => 'each of ${names.length} chapters',
    };

/// The record finding's headline (no full stop: the answer adds one).
/// "You lose the most marks in Ray Optics" / "Ray Optics and Optics tie for the most marks lost, 6 each" /
/// "4 chapters tie for the most marks lost, 12 each: A, B and 2 more".
String costliestHeadline(List<ChapterLine> tied) {
  if (tied.isEmpty) return '';
  final names = [for (final c in tied) c.chapter];
  if (names.length == 1) return 'You lose the most marks in ${names.single}';
  final each = tied.first.lost;
  if (names.length == 2) return '${namesTogether(names)} tie for the most marks lost, $each each';
  return '${names.length} chapters tie for the most marks lost, $each each: ${namesTogether(names)}';
}

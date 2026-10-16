import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'bar_live.dart';

/// The bar's badges (DOCK.md section 5.6, app-ia-1016.md 4.4): real counts only, never on
/// Today, Practice or Start, and nothing that counts streaks, credits or "new" content.
@immutable
class BarBadges {
  const BarBadges({this.reviewCount = 0, this.reviewDot = false, this.collegesDot = false, this.youDot = false});

  /// Mistakes in tonight's repair, until it is recorded. Shown as "9+" above 9.
  final int reviewCount;

  /// An 8 dp dot on Review: a marked result whose capsule was dismissed, until it is opened.
  /// Never shown with [reviewCount].
  final bool reviewDot;

  /// An 8 dp dot on Colleges: a saved college's cutoff data changed (once per data release),
  /// until the tab is opened.
  final bool collegesDot;

  /// An 8 dp dot on You: sign-in needs renewing, or a sync has failed for over 24 hours.
  final bool youDot;

  static const BarBadges none = BarBadges();

  /// The text of Review's badge, or null for none.
  String? get reviewText => reviewCount <= 0 ? null : (reviewCount > 9 ? '9+' : '$reviewCount');

  bool get showReviewDot => reviewDot && reviewCount <= 0;

  @override
  bool operator ==(Object other) => other is BarBadges && other.reviewCount == reviewCount && other.reviewDot == reviewDot && other.collegesDot == collegesDot && other.youDot == youDot;

  @override
  int get hashCode => Object.hash(reviewCount, reviewDot, collegesDot, youDot);
}

/// Tonight's repair count (Review's index). 0 by default; `main.dart` wires it.
final barReviewCountProvider = Provider<int>((ref) => 0);

/// A saved college's cutoff data changed since the Colleges tab was last opened. False by
/// default; the Colleges area wires it.
final barCollegesAttentionProvider = Provider<bool>((ref) => false);

/// Sign-in needs renewing, or a sync failed over 24 hours ago. False by default.
final barYouAttentionProvider = Provider<bool>((ref) => false);

/// The badges the bar draws now.
final barBadgesProvider = Provider<BarBadges>((ref) {
  final marked = ref.watch(barMarkedInputProvider);
  final dismissed = ref.watch(barDismissalsProvider);
  return BarBadges(
    reviewCount: ref.watch(barReviewCountProvider),
    reviewDot: marked != null && dismissed.contains(marked.identity),
    collegesDot: ref.watch(barCollegesAttentionProvider),
    youDot: ref.watch(barYouAttentionProvider),
  );
});

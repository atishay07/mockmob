import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// The motion guard (motion wave M1): no new bare `AnimatedSwitcher(` and no new `Curves.ease*`
/// outside `lib/core/motion`. Keyed swaps use `MmOverlapSwitcher` (fade, rise or axis), whose
/// overlap never flashes the ground; curves come from `Motion` (shared/motion-tokens.json), so the
/// app and the website ease alike.
///
/// The allow-lists hold what was there when the guard arrived (HEAD bd51ddce, 15 Oct 2026: 57 bare
/// switchers in 43 files, 133 `Curves.ease*` in 56 files), per file and per count, so a file may
/// only lose them. Migrating one is welcome: lower or delete its entry in the same change. Full-line
/// comments do not count.
void main() {
  final switcher = RegExp(r'\bAnimatedSwitcher\(');
  final ease = RegExp(r'\bCurves\.ease\w*');

  Map<String, int> count(RegExp pattern) {
    final found = <String, int>{};
    for (final entity in Directory('lib').listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      final path = entity.path.replaceAll(r'\', '/');
      if (path.startsWith('lib/core/motion/')) continue;
      final code = entity
          .readAsLinesSync()
          .where((line) => !line.trimLeft().startsWith('//'))
          .join('\n');
      final n = pattern.allMatches(code).length;
      if (n > 0) found[path] = n;
    }
    return found;
  }

  List<String> over(Map<String, int> found, Map<String, int> allowed) => [
        for (final e in found.entries)
          if (e.value > (allowed[e.key] ?? 0)) '${e.key}: ${e.value} (allowed ${allowed[e.key] ?? 0})',
      ]..sort();

  test('no new bare AnimatedSwitcher outside core/motion', () {
    final extra = over(count(switcher), _animatedSwitcherAllowed);
    expect(
      extra,
      isEmpty,
      reason: 'Use MmOverlapSwitcher (or .rise / .axis) from core/motion instead of a bare '
          'AnimatedSwitcher: its cross-fade dips to half strength and flashes the ground.',
    );
  });

  test('no new Curves.ease* outside core/motion', () {
    final extra = over(count(ease), _curvesEaseAllowed);
    expect(
      extra,
      isEmpty,
      reason: 'Use a Motion curve (glide, exit, emphasized, out, leave, sweep, drawer, inOut) so the '
          'app and the website share one motion language (shared/motion-tokens.json).',
    );
  });
}

const Map<String, int> _animatedSwitcherAllowed = {
  'lib/core/router/quick_start.dart': 1,
  'lib/core/widgets/bar/live_capsule.dart': 1,
  'lib/core/widgets/bar/mm_bar.dart': 1,
  'lib/core/widgets/key_button_face.dart': 1,
  'lib/features/account_access/widgets/problem_slot.dart': 1,
  'lib/features/account_access/widgets/sign_in_methods.dart': 1,
  'lib/features/auth/auth_page.dart': 2,
  'lib/features/insights/screens/stream_screen.dart': 1,
  'lib/features/insights/widgets/ask_messages.dart': 1,
  'lib/features/insights/widgets/ledger_hero.dart': 1,
  'lib/features/insights/widgets/trend_chart.dart': 1,
  'lib/features/learn/screens/learn_screen.dart': 1,
  'lib/features/learn/screens/run_screen.dart': 2,
  'lib/features/learn/widgets/run_step.dart': 1,
  'lib/features/notifications/screens/notification_settings_screen.dart': 2,
  'lib/features/notifications/screens/reminders_prompt_sheet.dart': 1,
  'lib/features/notifications/widgets/notification_header.dart': 1,
  'lib/features/notifications/widgets/notification_preview.dart': 1,
  'lib/features/notifications/widgets/settings_rows.dart': 1,
  'lib/features/notifications/widgets/time_sheet.dart': 1,
  'lib/features/onboarding/screens/onboarding_flow.dart': 3,
  'lib/features/onboarding/steps/course_step.dart': 1,
  'lib/features/practice/practice_screen.dart': 1,
  'lib/features/practice/practice_start_screen.dart': 2,
  'lib/features/practice/widgets/chapter_picker.dart': 1,
  'lib/features/practice/widgets/composer_ticket.dart': 3,
  'lib/features/result/recap/recap_flow.dart': 1,
  'lib/features/result/recap/record_parts.dart': 2,
  'lib/features/result/widgets/breakdown_section.dart': 1,
  'lib/features/review/widgets/mistake_view.dart': 1,
  'lib/features/rhythm/widgets/rhythm_body.dart': 4,
  'lib/features/rhythm/widgets/run_ribbon.dart': 1,
  'lib/features/rhythm/widgets/week_dial.dart': 1,
  'lib/features/rhythm/widgets/week_mobi_slot.dart': 1,
  'lib/features/runner/widgets/question_view.dart': 1,
  'lib/features/runner/widgets/runner_count.dart': 1,
  'lib/features/today/widgets/move_hero.dart': 1,
  'lib/features/today/widgets/today_header.dart': 1,
  'lib/features/today/widgets/week_ledger.dart': 2,
  'lib/features/tools/compass/compass_hero.dart': 1,
  'lib/features/tools/compass/compass_screen.dart': 2,
  'lib/features/you/privacy/usage_data_card.dart': 1,
  'lib/features/you/widgets/you_motion.dart': 2,
};

const Map<String, int> _curvesEaseAllowed = {
  'lib/core/art/emblem_arrive.dart': 1,
  'lib/core/art/emblem_painter.dart': 2,
  'lib/core/mascot/mobi_acts.dart': 35,
  'lib/core/mascot/mobi_details.dart': 3,
  'lib/core/mascot/mobi_sim.dart': 6,
  'lib/core/mascot/mobi_walker.dart': 2,
  'lib/core/widgets/brand/brand_logo.dart': 1,
  'lib/core/widgets/bubbles/bubble_painter.dart': 1,
  'lib/core/widgets/key_button_motion.dart': 1,
  'lib/core/widgets/skeleton.dart': 1,
  'lib/features/insights/screens/ask_screen.dart': 1,
  'lib/features/insights/widgets/answer_sheet.dart': 1,
  'lib/features/insights/widgets/answer_text.dart': 1,
  'lib/features/insights/widgets/ask_marks.dart': 1,
  'lib/features/insights/widgets/gesture_motion.dart': 2,
  'lib/features/learn/widgets/lesson_ring.dart': 1,
  'lib/features/notifications/widgets/day_shape.dart': 1,
  'lib/features/onboarding/steps/plan_step.dart': 2,
  'lib/features/onboarding/widgets/plan_seal_moment.dart': 2,
  'lib/features/onboarding/widgets/warmup_option.dart': 1,
  'lib/features/practice/practice_screen.dart': 1,
  'lib/features/practice/widgets/chapter_picker.dart': 2,
  'lib/features/practice/widgets/choice_glyphs.dart': 3,
  'lib/features/practice/widgets/composer_ticket.dart': 2,
  'lib/features/practice/widgets/finish_ceremony.dart': 5,
  'lib/features/practice/widgets/finish_stage.dart': 1,
  'lib/features/practice/widgets/get_panel.dart': 2,
  'lib/features/practice/widgets/length_dial.dart': 1,
  'lib/features/practice/widgets/practice_composer.dart': 1,
  'lib/features/practice/widgets/result_states.dart': 3,
  'lib/features/practice/widgets/resume_sheet.dart': 1,
  'lib/features/result/recap/card_page.dart': 1,
  'lib/features/result/widgets/answer_map.dart': 4,
  'lib/features/result/widgets/marks_bar.dart': 1,
  'lib/features/result/widgets/marks_flow.dart': 1,
  'lib/features/review/screens/repair_ending_screen.dart': 1,
  'lib/features/review/screens/review_screen.dart': 1,
  'lib/features/review/widgets/collapsible.dart': 1,
  'lib/features/review/widgets/ending_sheet.dart': 1,
  'lib/features/review/widgets/foil_burst.dart': 2,
  'lib/features/review/widgets/mistake_map.dart': 1,
  'lib/features/rhythm/widgets/goal_editor.dart': 1,
  'lib/features/rhythm/widgets/medal.dart': 1,
  'lib/features/rhythm/widgets/week_dial.dart': 9,
  'lib/features/rhythm/widgets/week_marks.dart': 1,
  'lib/features/runner/widgets/answer_sheet_view.dart': 2,
  'lib/features/runner/widgets/timing_track.dart': 3,
  'lib/features/today/widgets/paper_trend.dart': 1,
  'lib/features/today/widgets/resume_hero.dart': 1,
  'lib/features/today/widgets/road_timeline.dart': 1,
  'lib/features/today/widgets/week_ledger.dart': 5,
  'lib/features/tools/compass/programme_rows.dart': 1,
  'lib/features/tools/guide/guide_2027_screen.dart': 1,
  'lib/features/tools/widgets/chip_flight.dart': 1,
  'lib/features/tools/widgets/pop_on_select.dart': 2,
  'lib/features/you/appearance/theme_tiles.dart': 1,
};

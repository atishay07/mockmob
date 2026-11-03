import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mockmob/features/keycards/data/keycards_lines.dart' show KcFamily;
import 'package:mockmob/features/learn2/stage/question_view.dart';
import 'package:mockmob/features/learn2/stage/stage_frame.dart';
import 'package:mockmob/features/learn2/stage/stage_keys.dart';
import 'package:mockmob/features/learn2/stage/stage_pager.dart';
import 'package:mockmob/features/learn2/stage/stage_text.dart';
import 'package:mockmob/features/learn2/stage/stage_ticks.dart';

import '../../../helpers/fonts.dart';
import '../../../unit/learn2/stage/support/stage_harness.dart';

/// Runs [build] once per theme as `goldens/<name>_<night|day>.png` on a 360 x 800 phone with motion off (the Key
/// cards' `kcGolden` pattern), capturing the whole screen so sheets show. [after] drives the scene into its state.
void stageGolden(String name, Widget Function() build, {Future<void> Function(WidgetTester tester)? after}) {
  setUpAll(loadAppFonts);
  for (final brightness in [Brightness.dark, Brightness.light]) {
    final tag = brightness == Brightness.dark ? 'night' : 'day';
    testWidgets('$name, $tag', (tester) async {
      await pumpStage(tester, build(), brightness: brightness, reduced: true);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      if (after != null) await after(tester);
      await tester.pumpAndSettle();
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/${name}_$tag.png'));
    });
  }
}

/// The page under the one in view: only its card edge (its label) shows, in the 40 dp peek above the action bar; a Key card's
/// edge is its header band in its [family]'s colours (R8).
StagePage peekOf(String cap, {KcFamily? family}) => StagePage.card(label: 'Next', cap: cap, capFamily: family, child: const SizedBox.shrink());

/// One item of a feed on the phone stage, the way the feed composes it: the top bar (Close, the ticks, "n of N" with its
/// chevron) over the chapter's name, the item on a pager page with the next one peeking, and the action bar for that item.
class StageScene extends StatelessWidget {
  const StageScene({
    super.key,
    required this.page,
    required this.position,
    this.of = 16,
    this.keyFor = const [],
    this.left,
    this.wide = false,
    this.next,
    this.chip,
  });

  final StagePage page;
  final int position;
  final int of;
  final List<Widget> keyFor;
  final Widget? left;
  final bool wide;

  /// What peeks under the page (`peekOf`).
  final StagePage? next;

  /// The first visit's cue in the peek strip.
  final Widget? chip;

  @override
  Widget build(BuildContext context) {
    return StageFrame(
      label: 'Admission of a Partner feed',
      onClose: () {},
      closeLabel: 'Close the feed',
      title: 'Admission of a Partner',
      ticks: StageTicks(total: of, done: position - 1, current: wide ? -1 : position - 1),
      position: position,
      of: of,
      onCounter: () {},
      counterLabel: '$position of $of. Open the list of this feed',
      left: wide ? null : left,
      right: wide ? null : StageSideKey(icon: LucideIcons.bookOpen, label: 'Chapter', onTap: () {}),
      wide: wide,
      main: keyFor,
      child: StagePager(count: next == null ? 1 : 2, index: 0, onGo: (_) {}, chip: chip, pageBuilder: (context, i) => i == 0 ? page : next!),
    );
  }
}

/// A question that is answered after it is drawn (so it reacts as on the phone: the verdict, the line opening, the
/// scroll to the pick).
class AnsweredQuestion extends StatefulWidget {
  const AnsweredQuestion({super.key, required this.stem, required this.options, this.head = 'Question', this.streak = 0});

  final String stem;
  final List<StageOption> options;
  final String head;
  final int streak;

  @override
  State<AnsweredQuestion> createState() => AnsweredQuestionState();
}

class AnsweredQuestionState extends State<AnsweredQuestion> {
  StageAnswer? answer;

  void answerWith(StageAnswer a) => setState(() => answer = a);

  @override
  Widget build(BuildContext context) => QuestionView(
    head: widget.head,
    stem: widget.stem,
    options: widget.options,
    answer: answer,
    streak: widget.streak,
    onChoose: (_) {},
    onSeePro: () {},
  );
}

/// The card's side key as the feed draws it: Revise later (the card stack), or a check and In Revise once it is added.
Widget reviseKey({bool added = false}) => added
    ? StageSideKey(icon: LucideIcons.check, label: 'In Revise', on: true, onTap: () {})
    : StageSideKey(mark: (color) => StageCardStack(color: color), label: 'Revise later', onTap: () {});

/// The save key on a question.
Widget saveKey() => StageSideKey(icon: LucideIcons.bookmark, label: 'Save', onTap: () {});

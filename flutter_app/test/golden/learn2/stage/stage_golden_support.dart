import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
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

/// One item of a feed on the phone stage, the way the feed composes it: the top bar (ticks, Close, the chapter's title,
/// the kept count, "n of N" with its chevron), the item on a pager page, and the action bar for that item.
class StageScene extends StatefulWidget {
  const StageScene({
    super.key,
    required this.page,
    required this.position,
    this.of = 16,
    this.kept = 0,
    this.keyFor = const [],
    this.left,
    this.wide = false,
  });

  final StagePage page;
  final int position;
  final int of;
  final int kept;
  final List<Widget> keyFor;
  final Widget? left;
  final bool wide;

  @override
  State<StageScene> createState() => StageSceneState();
}

class StageSceneState extends State<StageScene> {
  @override
  Widget build(BuildContext context) {
    return StageFrame(
      label: 'Admission of a Partner feed',
      onClose: () {},
      closeLabel: 'Close the feed',
      title: 'Admission of a Partner',
      ticks: StageTicks(total: widget.of, done: widget.position - 1, current: widget.wide ? -1 : widget.position - 1),
      kept: widget.kept,
      position: widget.position,
      of: widget.of,
      onCounter: () {},
      counterLabel: '${widget.position} of ${widget.of}. Open the list of this feed',
      left: widget.wide ? null : widget.left,
      right: widget.wide ? null : StageSideKey(icon: LucideIcons.bookOpen, label: 'Chapter', onTap: () {}),
      wide: widget.wide,
      main: widget.keyFor,
      child: StagePager(count: 1, index: 0, onGo: (_) {}, pageBuilder: (context, i) => widget.page),
    );
  }
}

/// A question that is answered after it is drawn (so it reacts as on the phone: the verdict, the line opening, the
/// scroll to the pick).
class AnsweredQuestion extends StatefulWidget {
  const AnsweredQuestion({super.key, required this.stem, required this.options, this.head = 'Question 1 of 3', this.streak = 0});

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

/// The keep key as the feed draws it: Keep, or Kept once kept.
Widget keepKey({bool kept = false}) => StageSideKey(icon: LucideIcons.bookmark, label: kept ? 'Kept' : 'Keep', on: kept, onTap: () {});

/// The save key on a question.
Widget saveKey() => StageSideKey(icon: LucideIcons.bookmark, label: 'Save', onTap: () {});

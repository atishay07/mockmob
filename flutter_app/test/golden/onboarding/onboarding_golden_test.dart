import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show ByteData, FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/models/models.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/data/guest_sample.dart';
import 'package:mockmob/features/onboarding/data/sample_questions.dart';
import 'package:mockmob/features/onboarding/screens/account_step_sheet.dart';
import 'package:mockmob/features/onboarding/screens/before_you_start_sheet.dart';
import 'package:mockmob/features/onboarding/screens/sample_question_screen.dart';
import 'package:mockmob/features/onboarding/screens/sample_result_screen.dart';
import 'package:mockmob/features/onboarding/screens/subject_screen.dart';
import 'package:mockmob/features/onboarding/screens/welcome_screen.dart';
import 'package:mockmob/features/onboarding/state/sample_import.dart';
import 'package:mockmob/features/onboarding/state/subject_choices.dart';

import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

void noop() {}
void noopBool(bool _) {}
void noopBand(AgeBand _) {}

SampleSet _set() => SampleSet.parse(File('assets/sample/sample_questions.json').readAsStringSync());

GuestSample _guest(List<String> keys) => GuestSample(
      importKey: 'import-key-0000000001',
      subject: 'accountancy',
      answers: {for (var i = 0; i < keys.length; i++) 'q${i + 1}': keys[i]},
    );

/// A sheet drawn the way the router draws one: scrim, then the 28 dp raised sheet at the bottom.
class _SheetFrame extends StatelessWidget {
  const _SheetFrame({required this.child, this.title});

  final Widget child;
  final String? title;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return ColoredBox(
      color: Color.alphaBlend(colors.scrim, colors.ground),
      child: Align(
        alignment: Alignment.bottomCenter,
        child: ConstrainedBox(
          // The real sheet is at most 640 dp tall and scrolls inside.
          constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth, maxHeight: 640),
          child: Material(
            color: colors.raised,
            borderRadius: MmRadius.sheetTopOnly,
            clipBehavior: Clip.antiAlias,
            child: MmSheetScaffold(title: title, child: child),
          ),
        ),
      ),
    );
  }
}

Widget _question(int index, {String? chosen}) {
  final set = _set();
  final question = set.questions[index - 1];
  return SampleQuestionBody(
    question: question,
    index: index,
    total: set.total,
    answered: [for (var i = 1; i <= set.total; i++) i < index || (i == index && chosen != null)],
    initialChosenKey: chosen,
    onAnswer: (_) {},
    onNext: noop,
    onBack: noop,
  );
}

Widget _result(List<String> keys) => SampleResultView(
      set: _set(),
      guest: _guest(keys),
      onSave: noop,
      onTryAnother: noop,
      onContinue: noop,
      onBack: noop,
    );

Widget _beforeYouStart({
  bool usage = false,
  bool usageOn = false,
  bool eventsOpen = false,
  AgeBand? saving,
  String? error,
  SampleImportPhase phase = SampleImportPhase.idle,
}) =>
    _SheetFrame(
      child: BeforeYouStartView(
        showUsageStep: usage,
        savingAge: saving,
        usageOn: usageOn,
        eventsOpen: eventsOpen,
        error: error,
        importPhase: phase,
        onAnswerAge: noopBand,
        onSkip: noop,
        onToggleUsage: noopBool,
        onToggleEvents: noop,
        onDone: noop,
        onRetryImport: noop,
      ),
    );

/// The bundled Gabarito and Hanken Grotesk have no rupee sign; a phone falls back to its system
/// font for it. The test engine has no system font, so for the goldens only, a host font that has
/// the glyph stands in as the fallback (and the Material icon font for the switch's check).
const _fallbackFamily = 'GoldenFallback';

Future<void> _loadFallbacks() async {
  Future<void> load(String family, String path) async {
    final file = File(path);
    if (!file.existsSync()) return;
    final loader = FontLoader(family)..addFont(Future.value(ByteData.sublistView(file.readAsBytesSync())));
    await loader.load();
  }

  await load(_fallbackFamily, 'C:/Windows/Fonts/arial.ttf');
  final flutterRoot = Platform.environment['FLUTTER_ROOT'] ?? 'C:/flutter';
  await load('MaterialIcons', '$flutterRoot/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
}

/// Material's `Scaffold` resets the default text style from the theme, so the fallback goes there.
Widget _withFallback(Widget child) => Builder(
      builder: (context) {
        final theme = Theme.of(context);
        final body = theme.textTheme.bodyMedium!.copyWith(fontFamilyFallback: const [_fallbackFamily]);
        return Theme(data: theme.copyWith(textTheme: theme.textTheme.copyWith(bodyMedium: body)), child: child);
      },
    );

void main() {
  setUpAll(() async {
    await loadAppFonts();
    await _loadFallbacks();
  });

  final cases = <String, Widget Function()>{
    'welcome': () => WelcomeView(guest: GuestSample.empty, onStart: noop, onHaveAccount: noop),
    'welcome_returning': () => WelcomeView(guest: _guest(['B', 'A']), onStart: noop, onHaveAccount: noop),
    'subject': () => SubjectView(
          choices: const SubjectChoices(),
          selectedId: null,
          onPick: (_) {},
          onOthers: noop,
          onBack: noop,
        ),
    'subject_other_sheet': () => const _SheetFrame(
          title: 'Other subjects',
          child: OtherSubjectsList(options: kOtherSubjectsFallback, selectedId: 'physics'),
        ),
    'question_unanswered': () => _question(2),
    'question_correct': () => _question(2, chosen: 'B'),
    'question_wrong': () => _question(1, chosen: 'A'),
    'question_last_wrong': () => _question(5, chosen: 'A'),
    'result_four_of_five': () => _result(['B', 'B', 'C', 'A', 'B']),
    'result_none_right': () => _result(['A', 'A', 'A', 'A', 'A']),
    'result_unfinished': () => _result(['B', 'B', 'C']),
    'account_step': () => _SheetFrame(
          child: AccountStepView(onGoogle: noop, onEmail: noop, onNotNow: noop),
        ),
    'account_step_offline': () => _SheetFrame(
          child: AccountStepView(onGoogle: noop, onEmail: noop, onNotNow: noop, offline: true),
        ),
    'account_step_google_loading': () => _SheetFrame(
          child: AccountStepView(onGoogle: noop, onEmail: noop, onNotNow: noop, googleLoading: true, error: 'Google sign-in did not work. You can use an email code instead.'),
        ),
    'before_age': () => _beforeYouStart(),
    'before_age_minor_saving': () => _beforeYouStart(saving: AgeBand.minor),
    'before_age_error': () => _beforeYouStart(error: 'We could not save that. Your choice was not changed. Try again.'),
    'before_usage_adult_off': () => _beforeYouStart(usage: true),
    'before_usage_adult_on': () => _beforeYouStart(usage: true, usageOn: true, phase: SampleImportPhase.accepted),
    'before_usage_error': () => _beforeYouStart(usage: true, error: 'We could not turn that on. Usage data is still off. Try again.'),
    'before_usage_events': () => _beforeYouStart(usage: true, eventsOpen: true),
    'before_import_pending': () => _beforeYouStart(phase: SampleImportPhase.pending),
    'before_import_failed': () => _beforeYouStart(phase: SampleImportPhase.failed),
  };

  for (final entry in cases.entries) {
    for (final brightness in Brightness.values) {
      testWidgets('${entry.key}, ${brightness.name}', (tester) async {
        await pumpMockmob(
          tester,
          _withFallback(entry.value()),
          brightness: brightness,
          wrapInScaffold: false,
        );
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('goldens/${entry.key}_${brightness.name}.png'),
        );
      });
    }
  }
}

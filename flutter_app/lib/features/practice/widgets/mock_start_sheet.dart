import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/models/practice_quote.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/launch_flow.dart';
import '../data/practice_catalog.dart';
import '../model/practice_selection.dart';
import 'failure_copy.dart';

/// The one pre-start sheet for mocks (spec 5.4): not a wizard. Returns the [LaunchResult] when
/// the student started (or must look again), and null when they chose "Not now".
Future<LaunchResult?> showMockStartSheet(
  BuildContext context, {
  required PracticeSelection selection,
  required PracticeQuote quote,
  DateTime? ticketBy,
}) {
  return showMmSheet<LaunchResult>(
    context: context,
    builder: (context) => MockStartSheet(selection: selection, quote: quote, ticketBy: ticketBy),
  );
}

class MockStartSheet extends ConsumerStatefulWidget {
  const MockStartSheet({super.key, required this.selection, required this.quote, this.ticketBy, this.minutes});

  final PracticeSelection selection;
  final PracticeQuote quote;

  /// Ticket mode only: when the student must open MockMob again by so the answers can be sent.
  /// Whether a session is in ticket mode is only known once it exists, so the setup screen
  /// leaves this null; the runner shows the same line from the live session.
  final DateTime? ticketBy;

  /// The mock length for the sheet's size line; defaults to the quote's own duration.
  final int? minutes;

  @override
  ConsumerState<MockStartSheet> createState() => _MockStartSheetState();
}

class _MockStartSheetState extends ConsumerState<MockStartSheet> {
  bool _starting = false;
  StartFailureView? _failure;

  Future<void> _start() async {
    if (_starting) return;
    setState(() {
      _starting = true;
      _failure = null;
    });
    final result = await launchPractice(ref, widget.selection, widget.quote);
    if (!mounted) return;
    switch (result) {
      case LaunchStarted():
        ref.read(hapticsProvider).open();
        Navigator.of(context).pop(result);
      case LaunchNeedsLook() || LaunchPendingElsewhere():
        Navigator.of(context).pop(result);
      case LaunchFailed(:final failure):
        setState(() {
          _starting = false;
          _failure = StartFailureView(failure);
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final selection = widget.selection;
    final catalog = ref.watch(practiceSubjectsProvider).value;
    final subject = subjectNameFor(selection.subjectId, catalog);
    final label = ref.watch(completedMockCountProvider(internalSubjectFor(selection.subjectId, catalog))).value;
    final minutes = widget.minutes ?? ((widget.quote.durationSec ?? 3600) / 60).round();

    return PopScope(
      canPop: !_starting,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text(PracticeCopy.sheetTitle(mockLabelFor(label), subject), style: type.title)),
          const SizedBox(height: MmSpace.s12),
          Text(PracticeCopy.sheetSize(selection.effectiveCount, minutes), style: type.body),
          const SizedBox(height: MmSpace.s8),
          Text(PracticeCopy.sheetMarking, style: type.body),
          const SizedBox(height: MmSpace.s8),
          Text(PracticeCopy.sheetTimer, style: type.body),
          if (widget.ticketBy != null) ...[
            const SizedBox(height: MmSpace.s8),
            Text(PracticeCopy.sheetTicket(widget.ticketBy!), style: type.body),
          ],
          const SizedBox(height: MmSpace.s12),
          Text(PracticeCopy.sheetDnd, style: type.small.copyWith(color: colors.ink3)),
          if (_failure != null) ...[
            const SizedBox(height: MmSpace.s16),
            Semantics(
              liveRegion: true,
              child: Text(_failure!.text, style: type.body.copyWith(color: colors.badText)),
            ),
          ],
          const SizedBox(height: MmSpace.s24),
          KeyButton(label: PracticeCopy.startMock, loading: _starting, onPressed: _starting ? null : _start),
          const SizedBox(height: MmSpace.s8),
          Align(
            child: KeyButton.quiet(label: PracticeCopy.notNow, onPressed: _starting ? null : () => Navigator.of(context).maybePop()),
          ),
        ],
      ),
    );
  }
}

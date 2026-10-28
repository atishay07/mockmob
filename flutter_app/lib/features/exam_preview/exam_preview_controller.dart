import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../core/models/question.dart';
import '../runner/logic/sheet_cells.dart';
import '../runner/nta/nta_copy.dart' show NtaRules;
import 'exam_preview_content.dart';

/// The five things the preview invites a student to try, in the order it offers them.
enum PreviewStep { answer, mark, palette, section, clock }

/// The state of the exam-screen preview: where the student is, what they picked and marked, the
/// clock, and which of the five things they have tried. All of it lives in memory for this visit:
/// nothing is read from or written to the account, the server or the phone's storage, and nothing
/// is scored.
class ExamPreviewController extends ChangeNotifier {
  ExamPreviewController({List<PreviewSection>? sections, this.runClock = true}) : sections = sections ?? kPreviewSections {
    _visited.add(currentQuestion.id);
  }

  final List<PreviewSection> sections;

  /// False in tests that step the clock themselves with [tick].
  final bool runClock;

  /// The real paper's length: 60 minutes.
  static const Duration fullTime = Duration(minutes: NtaRules.minutes);

  /// Where "tap the clock" jumps to, to show the last minute (the chip turns red under 60 s).
  static const Duration lastMinute = Duration(seconds: 54);

  final ValueNotifier<Duration> remaining = ValueNotifier<Duration>(fullTime);
  final Map<String, int> _answers = {};
  final Set<String> _marked = {};
  final Set<String> _visited = {};
  final Set<PreviewStep> _tried = {};
  final Map<int, int> _positions = {};
  Timer? _timer;
  int _section = 0;
  int _index = 0;
  bool _disposed = false;

  int get sectionIndex => _section;
  int get index => _index;
  PreviewSection get section => sections[_section];
  List<SessionQuestion> get questions => section.questions;
  SessionQuestion get currentQuestion => questions[_index];
  int? get selected => _answers[currentQuestion.id];
  bool get isMarked => _marked.contains(currentQuestion.id);
  bool get isFirst => _section == 0 && _index == 0;
  bool get isLast => _section == sections.length - 1 && _index == questions.length - 1;
  bool get clockRunning => _timer?.isActive ?? false;

  int get totalQuestions => sections.fold(0, (n, s) => n + s.questions.length);
  int get answeredTotal => _answers.length;
  int get markedTotal => _marked.length;
  int answeredIn(int sectionIndex) => sections[sectionIndex].questions.where((q) => _answers.containsKey(q.id)).length;

  Set<PreviewStep> get tried => Set.unmodifiable(_tried);
  int get triedCount => _tried.length;
  bool get allTried => _tried.length == PreviewStep.values.length;

  /// The first thing not tried yet, or null when all five are done.
  PreviewStep? get nextStep {
    for (final s in PreviewStep.values) {
      if (!_tried.contains(s)) return s;
    }
    return null;
  }

  /// The palette of the section on screen (every cell its own flags, as in a real session).
  List<SheetCell> get cells => [
    for (var i = 0; i < questions.length; i++)
      SheetCell(
        number: i + 1,
        answered: _answers.containsKey(questions[i].id),
        visited: _visited.contains(questions[i].id) || i == _index,
        marked: _marked.contains(questions[i].id),
        unsynced: false,
        current: i == _index,
      ),
  ];

  void _touch(PreviewStep? step) {
    if (step != null) _tried.add(step);
    _startClock();
    notifyListeners();
  }

  void _startClock() {
    if (!runClock || _timer != null || _disposed) return;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => tick());
  }

  /// One second off the clock. It stops at 0:00 (a real paper submits there; the preview just
  /// holds, and a tap on the clock starts it again).
  void tick() {
    if (_disposed) return;
    final left = remaining.value;
    if (left <= Duration.zero) return;
    remaining.value = left - const Duration(seconds: 1);
  }

  void select(int option) {
    _answers[currentQuestion.id] = option;
    _touch(PreviewStep.answer);
  }

  void clear() {
    if (_answers.remove(currentQuestion.id) != null) notifyListeners();
  }

  void setMarked(bool value) {
    if (value) {
      _marked.add(currentQuestion.id);
    } else {
      _marked.remove(currentQuestion.id);
    }
    _touch(value ? PreviewStep.mark : null);
  }

  /// "Mark for Review & Next": marks this question and moves on.
  void markAndNext() {
    _marked.add(currentQuestion.id);
    _tried.add(PreviewStep.mark);
    _advance();
  }

  /// "Save & Next": the answer is already held, so this only moves on.
  void saveAndNext() => _advance();

  void _advance() {
    if (_index < questions.length - 1) {
      _go(_section, _index + 1);
    } else if (_section < sections.length - 1) {
      _go(_section + 1, 0);
    } else {
      _touch(null);
    }
  }

  void previous() {
    if (_index > 0) {
      _go(_section, _index - 1);
    } else if (_section > 0) {
      _go(_section - 1, sections[_section - 1].questions.length - 1);
    }
  }

  void jump(int i) {
    if (i < 0 || i >= questions.length) return;
    _go(_section, i);
  }

  /// A section tab. Each section remembers the question you left it on.
  void switchSection(int i) {
    if (i < 0 || i >= sections.length || i == _section) return;
    _positions[_section] = _index;
    _go(i, _positions[i] ?? 0);
    _tried.add(PreviewStep.section);
    notifyListeners();
  }

  void _go(int section, int index) {
    _section = section;
    _index = index;
    _visited.add(currentQuestion.id);
    _touch(null);
  }

  void paletteOpened() {
    if (_tried.add(PreviewStep.palette)) notifyListeners();
  }

  /// Tap on the clock: to its last minute, and back to a full hour on the next tap.
  void toggleLastMinute() {
    final low = remaining.value <= const Duration(seconds: 60);
    remaining.value = low ? fullTime : lastMinute;
    if (!low) _tried.add(PreviewStep.clock);
    _startClock();
    notifyListeners();
  }

  /// Back to a fresh paper: nothing answered, clock full, nothing tried.
  void reset() {
    _timer?.cancel();
    _timer = null;
    _answers.clear();
    _marked.clear();
    _visited.clear();
    _tried.clear();
    _positions.clear();
    _section = 0;
    _index = 0;
    _visited.add(currentQuestion.id);
    remaining.value = fullTime;
    notifyListeners();
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _timer?.cancel();
    remaining.dispose();
    super.dispose();
  }
}

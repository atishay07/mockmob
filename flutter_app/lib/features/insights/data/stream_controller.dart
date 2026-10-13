import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import 'feed_api.dart';
import 'practice_question.dart';

/// What the stream draws from: the open feed with filters, or the saved list.
class StreamFilters {
  const StreamFilters({required this.subject, this.chapter, this.difficulty});

  final String subject;
  final String? chapter;

  /// `easy`, `medium`, `hard` or null for all.
  final String? difficulty;

  StreamFilters copyWith({String? subject, String? chapter, bool clearChapter = false, String? difficulty, bool clearDifficulty = false}) =>
      StreamFilters(
        subject: subject ?? this.subject,
        chapter: clearChapter ? null : (chapter ?? this.chapter),
        difficulty: clearDifficulty ? null : (difficulty ?? this.difficulty),
      );

  @override
  bool operator ==(Object other) => other is StreamFilters && other.subject == subject && other.chapter == chapter && other.difficulty == difficulty;

  @override
  int get hashCode => Object.hash(subject, chapter, difficulty);
}

enum StreamPhase { loading, ready, end, emptyFilters, emptyPage, failed }

class StreamState {
  const StreamState({
    this.filters,
    this.questions = const [],
    this.index = 0,
    this.picks = const {},
    this.phase = StreamPhase.loading,
    this.loadingMore = false,
    this.nextOffset = 0,
    this.hasMore = false,
    this.error,
    this.saved = false,
  });

  /// Null for the saved list.
  final StreamFilters? filters;
  final List<PracticeQuestion> questions;
  final int index;

  /// The option the student picked, by question id. Picking reveals the answer: this is untimed
  /// practice, never a mock.
  final Map<String, String> picks;
  final StreamPhase phase;
  final bool loadingMore;
  final int nextOffset;
  final bool hasMore;
  final ApiError? error;
  final bool saved;

  PracticeQuestion? get current => index < questions.length ? questions[index] : null;
  String? pickOf(String id) => picks[id];

  int get answered => picks.length;
  int get right => [for (final q in questions) if (picks[q.id] != null && picks[q.id] == q.correctKey) q].length;

  StreamState copyWith({
    List<PracticeQuestion>? questions,
    int? index,
    Map<String, String>? picks,
    StreamPhase? phase,
    bool? loadingMore,
    int? nextOffset,
    bool? hasMore,
    ApiError? error,
    bool clearError = false,
  }) =>
      StreamState(
        filters: filters,
        questions: questions ?? this.questions,
        index: index ?? this.index,
        picks: picks ?? this.picks,
        phase: phase ?? this.phase,
        loadingMore: loadingMore ?? this.loadingMore,
        nextOffset: nextOffset ?? this.nextOffset,
        hasMore: hasMore ?? this.hasMore,
        error: clearError ? null : (error ?? this.error),
        saved: saved,
      );
}

/// The question stream: one question at a time, answer then see why. Keeps paging past pages
/// that came back empty after the server's quality filter.
class StreamController extends Notifier<StreamState> {
  DateTime? _shownAt;
  final Set<String> _seen = {};
  int _generation = 0;

  static const _maxEmptyPagesInARow = 3;

  @override
  StreamState build() => const StreamState();

  FeedApi get _api => ref.read(feedApiProvider);
  DateTime _now() => ref.read(nowProvider)();
  String get _flow => state.saved ? 'review' : 'explore';

  /// Opens the open feed with [filters], from the first page.
  Future<void> open(StreamFilters filters) async {
    final gen = ++_generation;
    _seen.clear();
    state = StreamState(filters: filters);
    await _loadMore(gen, first: true);
  }

  /// Opens the saved questions, starting at [startAt].
  void openSaved(List<PracticeQuestion> questions, {int startAt = 0}) {
    ++_generation;
    _seen.clear();
    state = StreamState(
      questions: questions,
      index: startAt.clamp(0, questions.isEmpty ? 0 : questions.length - 1),
      phase: questions.isEmpty ? StreamPhase.emptyFilters : StreamPhase.ready,
      saved: true,
    );
    _markSeen();
  }

  Future<void> retry() async {
    final f = state.filters;
    if (f == null) return;
    if (state.questions.isEmpty) return open(f);
    await _loadMore(_generation);
  }

  Future<void> _loadMore(int gen, {bool first = false}) async {
    final filters = state.filters;
    if (filters == null || state.loadingMore) return;
    state = state.copyWith(loadingMore: true, clearError: true, phase: first ? StreamPhase.loading : null);
    var offset = state.nextOffset;
    var emptyPages = 0;
    try {
      while (true) {
        final page = await _api.page(subject: filters.subject, chapter: filters.chapter, difficulty: filters.difficulty, offset: offset);
        if (gen != _generation) return;
        final known = {for (final q in state.questions) q.id};
        final fresh = [for (final q in page.questions) if (q.id.isNotEmpty && !known.contains(q.id)) q];
        offset = page.nextOffset;
        if (fresh.isNotEmpty || !page.hasMore) {
          final all = [...state.questions, ...fresh];
          state = state.copyWith(
            questions: all,
            nextOffset: offset,
            hasMore: page.hasMore,
            loadingMore: false,
            phase: all.isEmpty ? StreamPhase.emptyFilters : (state.index >= all.length ? StreamPhase.end : StreamPhase.ready),
          );
          _markSeen();
          return;
        }
        if (++emptyPages >= _maxEmptyPagesInARow) {
          state = state.copyWith(nextOffset: offset, hasMore: true, loadingMore: false, phase: state.current == null ? StreamPhase.emptyPage : null);
          return;
        }
      }
    } on ApiError catch (e) {
      if (gen != _generation) return;
      state = state.copyWith(loadingMore: false, error: e, phase: state.current == null ? StreamPhase.failed : null);
    }
  }

  void _markSeen() {
    final q = state.current;
    if (q == null) return;
    _shownAt = _now();
    if (_seen.add(q.id)) _api.log(q.id, 'seen', flow: _flow);
  }

  int get _dwellMs => _shownAt == null ? 0 : _now().difference(_shownAt!).inMilliseconds.clamp(0, 30 * 60 * 1000);

  /// Picks [key] on the current question and reveals the answer. One pick per question.
  void pick(String key) {
    final q = state.current;
    if (q == null || !q.hasUsableKey || state.picks.containsKey(q.id)) return;
    state = state.copyWith(picks: {...state.picks, q.id: key});
    _api.log(q.id, 'attempted', flow: _flow, dwellMs: _dwellMs, metadata: {'selected_key': key, 'is_correct': key == q.correctKey});
  }

  /// Moves on without answering.
  void skip() {
    final q = state.current;
    if (q != null && !state.picks.containsKey(q.id)) _api.log(q.id, 'skip', flow: _flow, dwellMs: _dwellMs);
    next();
  }

  void next() {
    final i = state.index + 1;
    if (i >= state.questions.length) {
      if (state.hasMore && state.filters != null) {
        state = state.copyWith(index: i);
        _loadMore(_generation);
      } else {
        state = state.copyWith(index: i, phase: StreamPhase.end);
      }
      return;
    }
    state = state.copyWith(index: i);
    _markSeen();
    // Read ahead when three questions are left.
    if (state.filters != null && state.hasMore && state.questions.length - i <= 3) _loadMore(_generation);
  }

  void previous() {
    if (state.index == 0) return;
    state = state.copyWith(index: state.index - 1, phase: StreamPhase.ready);
    _markSeen();
  }

  /// Sends the vote; the counts change only when the server answers.
  Future<bool> vote(String questionId, String? vote) async {
    try {
      final r = await _api.vote(questionId, vote);
      state = state.copyWith(questions: [
        for (final q in state.questions)
          q.id == questionId ? q.copyWith(upvotes: r.up, downvotes: r.down, userVote: r.vote, clearVote: r.vote == null) : q,
      ]);
      return true;
    } on ApiError {
      return false;
    }
  }
}

final streamControllerProvider = NotifierProvider.autoDispose<StreamController, StreamState>(StreamController.new);

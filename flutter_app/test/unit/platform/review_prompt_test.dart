import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/platform/native_prefs.dart';
import 'package:mockmob/core/platform/review_prompt.dart';
import 'package:mockmob/core/storage/prefs_store.dart';

class _Requester implements ReviewRequester {
  bool available = true;
  bool throws = false;
  int requests = 0;

  @override
  Future<bool> isAvailable() async => available;

  @override
  Future<void> request() async {
    if (throws) throw StateError('no Play');
    requests++;
  }
}

void main() {
  final day0 = DateTime.utc(2026, 8, 1, 12);

  group('ReviewPromptPolicy', () {
    test('never in the first 3 days, and never when the first run is unknown', () {
      expect(ReviewPromptPolicy.allows(now: day0, firstSeen: null, lastAsked: null), isFalse);
      expect(ReviewPromptPolicy.allows(now: day0.add(const Duration(days: 2, hours: 23)), firstSeen: day0, lastAsked: null), isFalse);
      expect(ReviewPromptPolicy.allows(now: day0.add(const Duration(days: 3)), firstSeen: day0, lastAsked: null), isTrue);
    });

    test('at most once in 60 days', () {
      final asked = day0.add(const Duration(days: 10));
      expect(ReviewPromptPolicy.allows(now: asked.add(const Duration(days: 59)), firstSeen: day0, lastAsked: asked), isFalse);
      expect(ReviewPromptPolicy.allows(now: asked.add(const Duration(days: 60)), firstSeen: day0, lastAsked: asked), isTrue);
    });

    test('never in NTA mode', () {
      expect(ReviewPromptPolicy.allows(now: day0.add(const Duration(days: 90)), firstSeen: day0, lastAsked: null, ntaMode: true), isFalse);
    });
  });

  group('ReviewPrompt', () {
    late NativePrefs prefs;
    late _Requester requester;
    late DateTime now;

    ReviewPrompt make({bool Function()? foreground}) =>
        ReviewPrompt(prefs: prefs, requester: requester, now: () => now, foreground: foreground ?? () => true);

    setUp(() async {
      prefs = NativePrefs(MemoryPrefsStore());
      requester = _Requester();
      now = day0;
      await prefs.markFirstSeen(day0);
    });

    test('is quiet in the first 3 days', () async {
      now = day0.add(const Duration(days: 2));
      expect(await make().maybeAsk(ReviewMoment.repairFinished), isFalse);
      expect(requester.requests, 0);
    });

    test('asks at a good moment after 3 days, then not again for 60 days', () async {
      now = day0.add(const Duration(days: 4));
      expect(await make().maybeAsk(ReviewMoment.repairFinished), isTrue);
      expect(requester.requests, 1);

      now = now.add(const Duration(days: 30));
      expect(await make().maybeAsk(ReviewMoment.resultImproved), isFalse);

      now = now.add(const Duration(days: 31));
      expect(await make().maybeAsk(ReviewMoment.resultHeld), isTrue);
      expect(requester.requests, 2);
    });

    test('never in NTA mode, and the ask is not spent', () async {
      now = day0.add(const Duration(days: 10));
      expect(await make().maybeAsk(ReviewMoment.resultHeld, ntaMode: true), isFalse);
      expect(requester.requests, 0);
      expect(await prefs.reviewAskedAt(), isNull);
      expect(await make().maybeAsk(ReviewMoment.resultHeld), isTrue);
    });

    test('a timer that fires while the app is in the background asks for nothing and spends nothing', () async {
      now = day0.add(const Duration(days: 10));
      expect(await make(foreground: () => false).maybeAsk(ReviewMoment.repairFinished), isFalse);
      expect(requester.requests, 0);
      expect(await prefs.reviewAskedAt(), isNull);
      expect(await make().maybeAsk(ReviewMoment.repairFinished), isTrue, reason: 'the next good moment can still ask');
    });

    test('leaving the app while the policy is read also stops the ask', () async {
      now = day0.add(const Duration(days: 10));
      var calls = 0;
      expect(await make(foreground: () => ++calls == 1).maybeAsk(ReviewMoment.repairFinished), isFalse);
      expect(requester.requests, 0);
      expect(await prefs.reviewAskedAt(), isNull);
    });

    test('where Play cannot show it (a sideloaded build) nothing is asked or counted', () async {
      now = day0.add(const Duration(days: 10));
      requester.available = false;
      expect(await make().maybeAsk(ReviewMoment.repairFinished), isFalse);
      expect(await prefs.reviewAskedAt(), isNull);
    });

    test('a failing dialog never reaches the student', () async {
      now = day0.add(const Duration(days: 10));
      requester.throws = true;
      expect(await make().maybeAsk(ReviewMoment.repairFinished), isFalse);
    });

    test('the first run is remembered once', () async {
      await prefs.markFirstSeen(day0.add(const Duration(days: 40)));
      expect((await prefs.firstSeen())!.isAtSameMomentAs(day0), isTrue);
    });
  });
}

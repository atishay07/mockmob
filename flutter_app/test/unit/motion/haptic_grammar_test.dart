import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/haptics/haptics.dart';
import 'package:mockmob/core/motion/motion.dart';
import 'package:mockmob/core/theme/theme.dart';
import 'package:mockmob/core/widgets/controls/mm_switch.dart';

/// A phone with the verbs: records base calls and verbs; [has] limits which verbs it plays.
class _VerbPhone implements HapticDriver, HapticVerbDriver {
  _VerbPhone({Set<HapticVerb>? has}) : has = has ?? HapticVerb.values.toSet();

  final Set<HapticVerb> has;
  final List<String> calls = [];

  @override
  Future<void> selectionClick() async => calls.add('selection');

  @override
  Future<void> lightImpact() async => calls.add('light');

  @override
  Future<void> mediumImpact() async => calls.add('medium');

  @override
  Future<bool> perform(HapticVerb verb) async {
    if (!has.contains(verb)) return false;
    calls.add('verb:${verb.name}');
    return true;
  }
}

Widget _app(Widget child, _VerbPhone phone) => ProviderScope(
      overrides: [hapticsProvider.overrideWithValue(Haptics(enabled: true, driver: phone))],
      child: MaterialApp(theme: buildTheme(Brightness.dark), home: Scaffold(body: child)),
    );

void main() {
  group('Haptics verbs', () {
    test('success is one confirm where the phone has it', () async {
      final phone = _VerbPhone();
      await Haptics(enabled: true, driver: phone).success();
      expect(phone.calls, ['verb:confirm']);
    });

    test('an older phone plays the fallbacks', () async {
      final phone = _VerbPhone(has: const {});
      final h = Haptics(enabled: true, driver: phone);
      await h.success();
      await h.segmentTick();
      await h.toggle(true);
      await h.toggle(false);
      await h.gestureStart();
      await h.gestureEnd();
      expect(phone.calls, ['medium', 'light', 'selection', 'selection', 'selection']);
    });

    test('each verb maps to its native verb', () async {
      final phone = _VerbPhone();
      final h = Haptics(enabled: true, driver: phone);
      await h.segmentTick();
      await h.toggle(true);
      await h.toggle(false);
      await h.gestureStart();
      await h.gestureEnd();
      expect(phone.calls, [
        'verb:segmentTick',
        'verb:toggleOn',
        'verb:toggleOff',
        'verb:gestureStart',
        'verb:gestureEnd',
      ]);
    });

    test('Touch feedback off silences every verb', () async {
      final phone = _VerbPhone();
      final h = Haptics(enabled: false, driver: phone);
      await h.success();
      await h.confirm();
      await h.segmentTick();
      await h.toggle(true);
      await h.gestureStart();
      await h.gestureEnd();
      expect(phone.calls, isEmpty);
    });
  });

  group('PlatformHapticDriver', () {
    TestWidgetsFlutterBinding.ensureInitialized();
    final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    late List<MethodCall> native;
    late List<MethodCall> platform;

    setUp(() {
      PlatformHapticDriver.resetForTest();
      native = [];
      platform = [];
      messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
        platform.add(call);
        return null;
      });
    });

    tearDown(() {
      messenger.setMockMethodCallHandler(PlatformHapticDriver.channel, null);
      messenger.setMockMethodCallHandler(SystemChannels.platform, null);
      PlatformHapticDriver.resetForTest();
    });

    test('plays a verb the phone has through the app channel, and asks for the list once', () async {
      messenger.setMockMethodCallHandler(PlatformHapticDriver.channel, (call) async {
        native.add(call);
        return call.method == 'verbs' ? <String>['confirm', 'gestureStart', 'gestureEnd'] : true;
      });
      final h = Haptics(enabled: true);
      await h.success();
      await h.gestureStart();
      expect(native.map((c) => '${c.method}:${c.arguments}'), ['verbs:null', 'perform:confirm', 'perform:gestureStart']);
      expect(platform, isEmpty);
    });

    test('a verb the phone lacks falls back to Flutter haptics', () async {
      messenger.setMockMethodCallHandler(PlatformHapticDriver.channel, (call) async {
        native.add(call);
        return call.method == 'verbs' ? <String>['confirm'] : true;
      });
      await Haptics(enabled: true).toggle(true);
      expect(native.map((c) => c.method), ['verbs']);
      expect(platform.map((c) => '${c.method}:${c.arguments}'), ['HapticFeedback.vibrate:HapticFeedbackType.selectionClick']);
    });

    test('no channel (another platform) falls back to Flutter haptics', () async {
      await Haptics(enabled: true).segmentTick();
      expect(platform.map((c) => c.arguments), ['HapticFeedbackType.selectionClick']);
    });
  });

  group('callers', () {
    testWidgets('the switch says on and off', (tester) async {
      final phone = _VerbPhone();
      var on = false;
      await tester.pumpWidget(_app(
        StatefulBuilder(
          builder: (context, setState) => Center(
            child: MmSwitch(value: on, onChanged: (v) => setState(() => on = v), semanticsLabel: 'Sound'),
          ),
        ),
        phone,
      ));
      await tester.tap(find.byType(MmSwitch));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(MmSwitch));
      await tester.pumpAndSettle();
      expect(phone.calls, ['verb:toggleOn', 'verb:toggleOff']);
    });

    testWidgets('a scrub ticks a segment per point', (tester) async {
      final phone = _VerbPhone();
      final key = GlobalKey<MmScrubState>();
      await tester.pumpWidget(_app(
        Center(child: SizedBox(width: 400, height: 40, child: MmScrub(key: key, count: 5, child: const SizedBox.expand()))),
        phone,
      ));
      key.currentState!.scrubTo(const Offset(0, 10));
      key.currentState!.scrubTo(const Offset(10, 10));
      key.currentState!.scrubTo(const Offset(400, 10));
      key.currentState!.end();
      expect(phone.calls, ['verb:segmentTick', 'verb:segmentTick']);
    });

    testWidgets('a commit drag is felt when picked up and let go', (tester) async {
      final phone = _VerbPhone();
      MmDragSide? committed;
      await tester.pumpWidget(_app(
        Center(
          child: SizedBox(
            width: 400,
            height: 64,
            child: MmDragCommit(
              onCommit: (side) => committed = side,
              child: const ColoredBox(color: Color(0xFF333333), child: SizedBox.expand()),
            ),
          ),
        ),
        phone,
      ));
      await tester.timedDrag(find.byType(MmDragCommit), const Offset(300, 0), const Duration(milliseconds: 300));
      await tester.pumpAndSettle();
      expect(committed, MmDragSide.right);
      expect(phone.calls.first, 'verb:gestureStart');
      expect(phone.calls.last, 'verb:gestureEnd');
      expect(phone.calls.where((c) => c == 'verb:gestureStart'), hasLength(1));
      expect(phone.calls.where((c) => c == 'verb:gestureEnd'), hasLength(1));
    });
  });
}

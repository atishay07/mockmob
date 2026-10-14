import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';

import '../motion/motion_harness.dart';

class _Host extends StatefulWidget {
  const _Host({this.refuse = false});

  final bool refuse;

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  bool on = false;
  int changes = 0;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: MmSwitch(
        value: on,
        semanticsLabel: 'Touch feedback',
        onChanged: (v) {
          changes++;
          if (!widget.refuse) setState(() => on = v);
        },
      ),
    );
  }
}

void main() {
  test('the thumb is 24 dp at rest, 28 pressed, and stretches toward its far end', () {
    final off = MmSwitch.thumbRect(0, 0);
    final offPressed = MmSwitch.thumbRect(0, 1);
    final on = MmSwitch.thumbRect(1, 0);
    final onPressed = MmSwitch.thumbRect(1, 1);
    expect(off.width, 24);
    expect(offPressed.width, 28);
    expect(offPressed.left, off.left, reason: 'off: keeps its left edge, grows right');
    expect(onPressed.right, on.right, reason: 'on: keeps its right edge, grows left');
    expect(on.right, MmSwitch.trackSize.width - MmSwitch.inset);
  });

  testWidgets('a tap toggles with a selection haptic and settles with a small overshoot', (tester) async {
    final haptics = RecordingHaptics();
    await tester.pumpWidget(motionApp(const _Host(), haptics: haptics));
    expect(tester.getSize(find.byType(MmSwitch)), MmSwitch.trackSize);
    await tester.tap(find.byType(MmSwitch));
    await tester.pump();
    final state = tester.state<_HostState>(find.byType(_Host));
    expect(state.on, isTrue);
    expect(haptics.count('selection'), 1);
    expect(tester.hasRunningAnimations, isTrue);
    await tester.pumpAndSettle();
    expect(tester.getSemantics(find.byType(MmSwitch)), matchesSemantics(
      label: 'Touch feedback',
      hasToggledState: true,
      isToggled: true,
      hasEnabledState: true,
      isEnabled: true,
      hasTapAction: true,
    ));
  });

  testWidgets('a sideways drag carries the thumb and lands on the nearer end', (tester) async {
    await tester.pumpWidget(motionApp(const _Host()));
    await tester.drag(find.byType(MmSwitch), const Offset(30, 0));
    await tester.pumpAndSettle();
    expect(tester.state<_HostState>(find.byType(_Host)).on, isTrue);
  });

  testWidgets('a refused change returns the thumb to the value', (tester) async {
    await tester.pumpWidget(motionApp(const _Host(refuse: true)));
    await tester.tap(find.byType(MmSwitch));
    await tester.pumpAndSettle();
    final state = tester.state<_HostState>(find.byType(_Host));
    expect(state.changes, 1);
    expect(state.on, isFalse);
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('disabled does nothing; works in Day and under reduced motion', (tester) async {
    await tester.pumpWidget(motionApp(const Center(child: MmSwitch(value: true, onChanged: null)), brightness: Brightness.light));
    await tester.tap(find.byType(MmSwitch), warnIfMissed: false);
    await tester.pump();
    expect(tester.hasRunningAnimations, isFalse);
    await tester.pumpWidget(motionApp(const _Host(), reduced: true));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(MmSwitch));
    await tester.pump();
    expect(tester.hasRunningAnimations, isFalse, reason: 'the thumb jumps');
    expect(tester.state<_HostState>(find.byType(_Host)).on, isTrue);
  });
}

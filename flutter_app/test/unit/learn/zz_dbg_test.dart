import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/core/widgets/pressable.dart';

class _W extends StatefulWidget { const _W(); @override State<_W> createState() => _S(); }
class _S extends State<_W> with SingleTickerProviderStateMixin {
  late final sp = MmPressSpring(this);
  @override Widget build(BuildContext c) => GestureDetector(onTap: () {}, child: AnimatedBuilder(animation: sp.scale, builder: (c, _) => Text('v=${sp.scale.value}')));
}

void main() {
  testWidgets('dbg', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: _W()));
    final st = tester.state<_S>(find.byType(_W));
    st.sp.to(0.96, reduced: false);
    for (var i = 0; i < 5; i++) { await tester.pump(const Duration(milliseconds: 16)); debugPrint('f$i ${st.sp.scale.value} anim=${st.sp.scale.isAnimating}'); }
  });
}

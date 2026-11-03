import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';

// Temporary probe (deleted before commit): prints squash and lookY through a few acts.
void main() {
  test('probe', () {
    for (final act in [MobiAct.cheer, MobiAct.celebrate, MobiAct.correct, MobiAct.hello]) {
      final sim = MobiSim();
      sim.run(0.5);
      sim.play(act);
      final buf = StringBuffer('${act.name}: ');
      for (var i = 0; i < 40; i++) {
        final r = sim.run(0.05);
        buf.write('${(i * 50 + 50)}ms y${r.y.toStringAsFixed(1)} s${r.squash.toStringAsFixed(3)} l${r.lookY.toStringAsFixed(2)} | ');
      }
      // ignore: avoid_print
      print(buf);
    }
    final sim = MobiSim();
    var minS = 1.0, maxS = -1.0, minY = 99.0, maxY = -99.0;
    for (var i = 0; i < 600; i++) {
      final r = sim.run(0.05);
      if (sim.act != null) continue;
      minS = r.squash < minS ? r.squash : minS;
      maxS = r.squash > maxS ? r.squash : maxS;
      minY = r.y < minY ? r.y : minY;
      maxY = r.y > maxY ? r.y : maxY;
    }
    // ignore: avoid_print
    print('idle squash $minS..$maxS y $minY..$maxY');
  });
}

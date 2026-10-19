// The foil sheen (spec 5.7): shaders/foil_sheen.frag is bundled, compiles, loads, and takes its
// four uniforms in the order the podium writes them.

import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/social/v3/widgets/podium_stage.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('the foil sheen program loads and accepts its uniforms', () async {
    FoilSheenProgram.enabled = true;
    FoilSheenProgram.debugReset();
    await FoilSheenProgram.precache();
    expect(FoilSheenProgram.ready, isTrue);
    final s = FoilSheenProgram.newShader()!;
    s
      ..setFloat(0, 120)
      ..setFloat(1, 140)
      ..setFloat(2, 0.5)
      ..setFloat(3, 1);
    expect(() => s.setFloat(4, 0), throwsA(anything));
    s.dispose();
    FoilSheenProgram.debugReset();
  });
}

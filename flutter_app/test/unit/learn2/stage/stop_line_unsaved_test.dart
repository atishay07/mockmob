// R8 APP-07: the stop sheet never says "It’s all saved." after an answer failed to save.
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/features/learn2/stage/stage_end_model.dart';

void main() {
  test('nothing failed: all saved', () {
    expect(StageEndModel.stopSheetLine(1, 11), '1 of 11 done. It’s all saved.');
  });

  test('a failed answer is named, and the rest is kept', () {
    expect(StageEndModel.stopSheetLine(1, 11, unsaved: 1), '1 of 11 done. 1 answer didn’t save. The rest is kept.');
    expect(StageEndModel.stopSheetLine(3, 11, unsaved: 2), '3 of 11 done. 2 answers didn’t save. The rest is kept.');
  });
}

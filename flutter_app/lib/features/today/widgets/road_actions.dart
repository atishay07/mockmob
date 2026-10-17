// What the road's plan saves through, handed in by the screen so widgets read no providers (tests
// and goldens pump them without a database).

/// What the road saves through: the study-days goal and its weekdays (the account), the exam day
/// and the mock target (this phone). Each future completes when the save has returned and throws
/// when it did not.
class RoadActions {
  const RoadActions({required this.savePace, required this.setExamDate, required this.setMockTarget});

  final Future<void> Function(Set<int> days) savePace;
  final Future<void> Function(DateTime? day) setExamDate;
  final Future<void> Function(int? target) setMockTarget;
}

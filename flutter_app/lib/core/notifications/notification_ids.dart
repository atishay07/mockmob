/// A stable positive 31-bit id for a task id, so a scheduled notification can be cancelled by
/// the same task id across app restarts. `String.hashCode` is not stable between runs, so
/// this uses 32-bit FNV-1a.
int notificationIdFor(String taskId) {
  var hash = 0x811c9dc5;
  for (final unit in taskId.codeUnits) {
    hash ^= unit & 0xff;
    hash = (hash * 0x01000193) & 0xffffffff;
    if (unit > 0xff) {
      hash ^= (unit >> 8) & 0xff;
      hash = (hash * 0x01000193) & 0xffffffff;
    }
  }
  return hash & 0x7fffffff;
}

/// Task id of the ongoing "Mock in progress" status. A fixed id keeps one status at a time.
const mockInProgressTaskId = 'mock_in_progress';

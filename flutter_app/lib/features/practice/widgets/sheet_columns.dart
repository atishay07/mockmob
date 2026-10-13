/// Columns that keep a sheet of [count] bubbles even: one row up to 10, then rows of 10 (or 8
/// for 15, so the last row is not a stub).
int sheetColumns(int count) {
  if (count <= 10) return count < 1 ? 1 : count;
  if (count == 15) return 8;
  return 10;
}

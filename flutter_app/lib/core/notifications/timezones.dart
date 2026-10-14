import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

/// The timezone used until the student's own preference loads.
const defaultTimezoneName = 'Asia/Kolkata';

bool _initialised = false;

/// Loads the timezone database once. Cheap to call repeatedly.
void ensureTimeZones() {
  if (_initialised) return;
  tzdata.initializeTimeZones();
  _initialised = true;
}

/// The location for an IANA name, falling back to Asia/Kolkata for an unknown one.
tz.Location locationFor(String? name) {
  ensureTimeZones();
  try {
    return tz.getLocation(name ?? defaultTimezoneName);
  } on tz.LocationNotFoundException {
    return tz.getLocation(defaultTimezoneName);
  }
}

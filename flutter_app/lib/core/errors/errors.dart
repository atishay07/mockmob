/// Public surface of self-hosted crash reporting.
library;

export 'error_buffer.dart' show ErrorBuffer;
export 'error_report.dart' show DeviceFacts, ErrorKinds, ErrorReport;
export 'error_reporter.dart' show ErrorReporter;
export 'error_reporting.dart' show ErrorReportingHost, errorReporterProvider, errorUploaderProvider;

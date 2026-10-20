// Public copy that describes Android app behaviour waits for the app build that has it.
// The question stream events (seen, attempted, skip) and the Report this reply button are in app version 13, which went
// to closed testing on 20 Oct 2026, so /privacy now describes them. If an app build without them were ever the only one
// students had, turn this off in the same change, so /privacy never describes something the app does not do.
export const APP_STREAM_AND_REPORT_LIVE = true;

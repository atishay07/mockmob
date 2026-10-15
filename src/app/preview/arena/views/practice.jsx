// Preview views for IA5: Practice (/dashboard, Question stream, Concepts labels, the confirm line). Suggested name: practice.
// Owned by the IA5 builder; no other packet edits this file.
//
// Contract (src/app/preview/arena/views/index.js):
//   views     { [name]: { route, render(ctx), shell?: false, toolbar?(ctx), moderatorOnly?, linkKeys? } }
//             Open with /preview/arena?view=<name>. A name already in legacy.jsx replaces that view.
//             ctx = { params (URLSearchParams of the page), pro (boolean), openDrawer() }.
//             route is the path the shell treats as current ('/today'); its last segment is the
//             previewLinks key, so the shell's links stay inside the preview.
//   handlers  [(req) => Promise<Response> | null]. Fixture API replies, tried before the built-in
//             fixtures in ArenaPreviewClient. req = { url (URL), method, init, fixture (URLSearchParams
//             of the page), json(body, status = 200) }. Return null to pass. Never call a real write.
export const views = {};
export const handlers = [];

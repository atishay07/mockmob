// One switch for the whole "bring a mistake" photo path (16 Nov 2026, lane web/1116-photo).
//
// On: Ask Mobi's bring-a-mistake form shows "Add a photo of the question", and POST /api/ai/mentor/mistake accepts one JPEG
// photo of the question (2 credits, MISTAKE_PHOTO_CREDITS in src/services/mobi/bringMistake.mjs).
// Off: the form shows no photo key, and the server refuses a `photo` field with a 400 ("Mobi does not read photos yet. Type or
// paste the question. Nothing was charged."). The home page reads this same switch.
//
// Pure: no imports, so the server, the panel, the home page and the tests read one value.
export const MISTAKE_PHOTO_ON = true;

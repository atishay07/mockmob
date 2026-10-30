import { keycardsHttp } from '@/lib/server/keycardsHttp';
// GET /api/keycards: the student's subjects, their CUET units and chapters with card counts and chapter state, and today.
export const dynamic = 'force-dynamic';
export const GET = (request) => keycardsHttp(request, (kc, userId) => kc.overview(userId));

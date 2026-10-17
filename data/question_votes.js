// Question votes (security review 17 Oct 2026, group 13). Pure: takes the Supabase client, so node:test can drive it.
//
// A vote is accepted only on a live, non-deleted question. Before, any signed-in student could vote on pending or
// rejected questions (77 of 292 production votes sat on them), and a few throwaway accounts could push a question's
// score below the practice floor. Every write is checked: a failed write is an error, never a 200 with made-up counts.

export class VoteError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

const VOTE_TYPES = [null, 'up', 'down'];

/** True only for a question students can practise: status live and not deleted. */
export function isVotableQuestion(question) {
  return Boolean(question) && question.status === 'live' && question.is_deleted !== true;
}

export async function voteOnLiveQuestion(supabase, userId, questionId, voteType) {
  if (!userId) throw new Error('User is required');
  if (!questionId) throw new Error('Question is required');
  if (!VOTE_TYPES.includes(voteType)) throw new Error('Invalid vote type');

  // 0. The question must be live. A missing, pending, rejected or deleted question is "not found" to the voter.
  const { data: question, error: questionError } = await supabase
    .from('questions')
    .select('id, status, is_deleted')
    .eq('id', questionId)
    .maybeSingle();
  if (questionError) throw new VoteError('vote_unavailable', 'Vote failed');
  if (!isVotableQuestion(question)) throw new VoteError('question_not_found', 'Question not found');

  const checked = async (step) => {
    const { data, error } = await step;
    if (error) throw new VoteError('vote_unavailable', 'Vote failed');
    return data;
  };

  // 1. Existing vote, 2. insert / update / delete.
  const existing = await checked(supabase.from('question_votes').select('vote_type').eq('user_id', userId).eq('question_id', questionId).maybeSingle());
  if (voteType === null) {
    await checked(supabase.from('question_votes').delete().eq('user_id', userId).eq('question_id', questionId));
  } else if (existing) {
    await checked(supabase.from('question_votes').update({ vote_type: voteType }).eq('user_id', userId).eq('question_id', questionId));
  } else {
    await checked(supabase.from('question_votes').insert({ user_id: userId, question_id: questionId, vote_type: voteType }));
  }

  // 3. Recount, 4. store the counts on the question.
  const votes = (await checked(supabase.from('question_votes').select('vote_type').eq('question_id', questionId))) || [];
  const upvotes = votes.filter((v) => v.vote_type === 'up').length;
  const downvotes = votes.filter((v) => v.vote_type === 'down').length;
  const score = upvotes - downvotes;
  await checked(supabase.from('questions').update({ upvotes, downvotes, score }).eq('id', questionId));

  return { questionId, upvotes, downvotes, score, userVote: voteType };
}

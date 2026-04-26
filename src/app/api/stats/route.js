import { supabase } from '@/lib/supabase';
import { SUBJECTS } from '@/../data/subjects';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .or('status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)');
    
    if (error) throw error;
    const subjectCounts = {};
    await Promise.all(SUBJECTS.map(async (subject) => {
      const { count: subjectCount, error: subjectError } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('subject', subject.id)
        .eq('is_deleted', false)
        .or('status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)');

      if (subjectError) throw subjectError;
      subjectCounts[subject.id] = subjectCount || 0;
    }));
    
    return Response.json({
      bankSize: count || 0,
      subjectCounts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

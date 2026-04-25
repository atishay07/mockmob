import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .or('status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)');
    
    if (error) throw error;
    
    return Response.json({
      bankSize: count || 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

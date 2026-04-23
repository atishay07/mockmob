import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'live');
    
    if (error) throw error;
    
    return Response.json({
      bankSize: count || 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

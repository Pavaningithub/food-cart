import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    let query = supabase
      .from('cash_entries')
      .select('*')
      .order('entry_date', { ascending: false });

    if (date) {
      query = query.eq('entry_date', date);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ entries: data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch cash entries' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    const { data, error } = await supabase
      .from('cash_entries')
      .insert(body)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create cash entry' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { id, ...updates } = await req.json();

    const { data, error } = await supabase
      .from('cash_entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ entry: data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update cash entry' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const { error } = await supabase.from('cash_entries').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete cash entry' }, { status: 500 });
  }
}

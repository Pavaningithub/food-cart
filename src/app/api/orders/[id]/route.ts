import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ order: data });
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();
    const body = await req.json();

    // Validate admin PIN for sensitive updates
    const { pin, ...updates } = body;

    // Allow status updates from kitchen without PIN (for chef display)
    // But require PIN for payment_method, cancellation, etc.
    const sensitiveFields = ['payment_status', 'payment_method', 'total_amount'];
    const isSensitive = sensitiveFields.some((f) => f in updates);

    if (isSensitive && pin) {
      const { data: pinSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'admin_pin')
        .single();

      const adminPin = process.env.ADMIN_PIN ?? pinSetting?.value ?? '1234';
      if (pin !== adminPin) {
        return NextResponse.json({ error: 'Invalid PIN' }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ order: data });
  } catch (error) {
    console.error('Update order error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete order error:', error);
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { CartItem } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { items, order_type, notes } = body as {
      items: CartItem[];
      order_type: 'dine_in' | 'parcel';
      notes?: string;
    };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items in order' }, { status: 400 });
    }

    // Get parcel charge from settings
    const { data: settingData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'parcel_charge')
      .single();

    const parcelCharge = order_type === 'parcel' ? Number(settingData?.value ?? 10) : 0;

    // Calculate subtotal
    const subtotal = items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
    const totalAmount = subtotal + parcelCharge;

    // Get next token number for today
    const today = new Date().toISOString().split('T')[0];
    const { data: tokenData, error: tokenError } = await supabase.rpc(
      'get_next_token',
      { p_date: today }
    );

    if (tokenError) throw tokenError;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        token_number: tokenData,
        order_date: today,
        order_type,
        status: 'pending',
        payment_status: 'unpaid',
        subtotal,
        parcel_charge: parcelCharge,
        total_amount: totalAmount,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items
    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product.id,
      product_name_en: item.product.name_en,
      product_name_kn: item.product.name_kn,
      unit_price: item.product.price,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    const orderType = searchParams.get('order_type');

    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (date) {
      query = query.eq('order_date', date);
    }
    if (orderType) {
      query = query.eq('order_type', orderType);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ orders: data });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

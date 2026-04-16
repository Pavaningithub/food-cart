export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'online' | 'cash';
export type OrderType = 'dine_in' | 'parcel';
export type ProductCategory = 'main' | 'snack' | 'drink' | 'dessert';
export type ExpenseCategory = 'raw_materials' | 'labour' | 'gas' | 'packaging' | 'other';

export interface Product {
  id: string;
  name_en: string;
  name_kn: string;
  description_en: string | null;
  description_kn: string | null;
  price: number;
  category: ProductCategory;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  token_number: number;
  order_date: string;
  order_type: OrderType;
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus;
  subtotal: number;
  parcel_charge: number;
  total_amount: number;
  razorpay_order_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name_en: string;
  product_name_kn: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  amount: number;
  currency: string;
  method: string | null;
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
  webhook_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface CashEntry {
  id: string;
  entry_date: string;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

// Enriched order with items (for kitchen display)
export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

// Cart item (client-side only)
export interface CartItem {
  product: Product;
  quantity: number;
}

// Admin dashboard stats
export interface DailyStats {
  date: string;
  total_orders: number;
  dine_in_orders: number;
  parcel_orders: number;
  online_revenue: number;
  cash_revenue: number;
  total_revenue: number;
  total_items_sold: number;
  footfall: number; // same as total_orders
}

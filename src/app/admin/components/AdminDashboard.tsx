'use client';

import { useState } from 'react';
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, TrendingUp, Settings, LogOut } from 'lucide-react';
import DashboardTab from './DashboardTab';
import OrdersTab from './OrdersTab';
import ProductsTab from './ProductsTab';
import ExpensesTab from './ExpensesTab';
import SettingsTab from './SettingsTab';

type AdminTab = 'dashboard' | 'orders' | 'products' | 'expenses' | 'settings';

const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'orders', label: 'Orders', icon: <ShoppingBag size={18} /> },
  { id: 'products', label: 'Menu', icon: <UtensilsCrossed size={18} /> },
  { id: 'expenses', label: 'Expenses', icon: <TrendingUp size={18} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
];

export default function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top nav */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-black text-orange-600">🍛 FoodCart Admin</h1>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 text-gray-500 hover:text-red-500 text-sm font-medium"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      {/* Tab nav */}
      <div className="bg-white border-b overflow-x-auto">
        <div className="flex min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'products' && <ProductsTab />}
        {activeTab === 'expenses' && <ExpensesTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
}

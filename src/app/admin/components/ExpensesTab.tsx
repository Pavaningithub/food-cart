'use client';

import { useEffect, useState, useCallback } from 'react';
import { Expense, CashEntry, ExpenseCategory } from '@/types';
import { formatCurrency, EXPENSE_CATEGORY_LABELS } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil } from 'lucide-react';

export default function ExpensesTab() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [activeSection, setActiveSection] = useState<'expenses' | 'cash'>('expenses');

  // Expense form
  const [showExpForm, setShowExpForm] = useState(false);
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [expForm, setExpForm] = useState({ expense_date: new Date().toISOString().split('T')[0], category: 'raw_materials' as ExpenseCategory, description: '', amount: '' });

  // Cash form
  const [showCashForm, setShowCashForm] = useState(false);
  const [editingCashId, setEditingCashId] = useState<string | null>(null);
  const [cashForm, setCashForm] = useState({ entry_date: new Date().toISOString().split('T')[0], amount: '', notes: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [expRes, cashRes] = await Promise.all([
      fetch(`/api/admin/expenses?date=${dateFilter}`),
      fetch(`/api/admin/cash?date=${dateFilter}`),
    ]);
    const [expData, cashData] = await Promise.all([expRes.json(), cashRes.json()]);
    setExpenses(expData.expenses ?? []);
    setCashEntries(cashData.entries ?? []);
    setLoading(false);
  }, [dateFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveExpense = async () => {
    try {
      const payload = { ...expForm, amount: parseFloat(expForm.amount) };
      const res = editingExpId
        ? await fetch('/api/admin/expenses', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingExpId, ...payload }) })
        : await fetch('/api/admin/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      toast.success(editingExpId ? 'Expense updated' : 'Expense added');
      setShowExpForm(false); setEditingExpId(null);
      setExpForm({ expense_date: dateFilter, category: 'raw_materials', description: '', amount: '' });
      fetchData();
    } catch { toast.error('Failed to save expense'); }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    await fetch(`/api/admin/expenses?id=${id}`, { method: 'DELETE' });
    toast.success('Deleted'); fetchData();
  };

  const saveCash = async () => {
    try {
      const payload = { ...cashForm, amount: parseFloat(cashForm.amount) };
      const res = editingCashId
        ? await fetch('/api/admin/cash', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingCashId, ...payload }) })
        : await fetch('/api/admin/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      toast.success('Cash entry saved');
      setShowCashForm(false); setEditingCashId(null);
      setCashForm({ entry_date: dateFilter, amount: '', notes: '' });
      fetchData();
    } catch { toast.error('Failed to save cash entry'); }
  };

  const deleteCash = async (id: string) => {
    if (!confirm('Delete this cash entry?')) return;
    await fetch(`/api/admin/cash?id=${id}`, { method: 'DELETE' });
    toast.success('Deleted'); fetchData();
  };

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalCash = cashEntries.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      {/* Date filter */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-2xl shadow-sm">
        <div>
          <label className="text-xs text-gray-500 font-medium block mb-1">Date</label>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm" />
        </div>
        <button onClick={fetchData} className="self-end bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold">
          Load
        </button>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-500">Expenses: <span className="font-bold text-red-600">{formatCurrency(totalExpenses)}</span></p>
          <p className="text-xs text-gray-500">Cash In: <span className="font-bold text-green-600">{formatCurrency(totalCash)}</span></p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2">
        <button onClick={() => setActiveSection('expenses')}
          className={`px-4 py-2 rounded-xl font-bold text-sm ${activeSection === 'expenses' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 border'}`}>
          💸 Expenses
        </button>
        <button onClick={() => setActiveSection('cash')}
          className={`px-4 py-2 rounded-xl font-bold text-sm ${activeSection === 'cash' ? 'bg-green-500 text-white' : 'bg-white text-gray-600 border'}`}>
          💵 Cash Entries
        </button>
      </div>

      {activeSection === 'expenses' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-gray-800">Expenses — {formatCurrency(totalExpenses)}</h3>
            <button onClick={() => { setShowExpForm(true); setEditingExpId(null); }}
              className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-2 rounded-xl text-sm font-bold">
              <Plus size={14} /> Add Expense
            </button>
          </div>

          {(showExpForm || editingExpId) && (
            <div className="bg-red-50 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Date</label>
                  <input type="date" value={expForm.expense_date} onChange={e => setExpForm(f => ({ ...f, expense_date: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Category</label>
                  <select value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5">
                    {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Description</label>
                  <input value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5" placeholder="e.g. Rice 10kg" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Amount (₹)</label>
                  <input type="number" value={expForm.amount} onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5" placeholder="500" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveExpense} className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold">Save</button>
                <button onClick={() => { setShowExpForm(false); setEditingExpId(null); }} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold">Cancel</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-xl h-14 animate-pulse" />)}</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-10 text-gray-400">No expenses for this date</div>
          ) : (
            <div className="space-y-2">
              {expenses.map((exp) => (
                <div key={exp.id} className="bg-white rounded-xl shadow-sm flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800 text-sm">{exp.description}</p>
                    <p className="text-gray-400 text-xs">{EXPENSE_CATEGORY_LABELS[exp.category]} · {exp.expense_date}</p>
                  </div>
                  <span className="font-bold text-red-600">{formatCurrency(exp.amount)}</span>
                  <button onClick={() => { setEditingExpId(exp.id); setShowExpForm(false); setExpForm({ expense_date: exp.expense_date, category: exp.category as ExpenseCategory, description: exp.description, amount: exp.amount.toString() }); }}
                    className="text-blue-500 p-1.5 hover:bg-blue-50 rounded-lg"><Pencil size={14} /></button>
                  <button onClick={() => deleteExpense(exp.id)} className="text-red-500 p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'cash' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-gray-800">Cash Received — {formatCurrency(totalCash)}</h3>
            <button onClick={() => { setShowCashForm(true); setEditingCashId(null); }}
              className="flex items-center gap-1.5 bg-green-500 text-white px-3 py-2 rounded-xl text-sm font-bold">
              <Plus size={14} /> Add Entry
            </button>
          </div>

          {(showCashForm || editingCashId) && (
            <div className="bg-green-50 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Date</label>
                  <input type="date" value={cashForm.entry_date} onChange={e => setCashForm(f => ({ ...f, entry_date: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Amount (₹)</label>
                  <input type="number" value={cashForm.amount} onChange={e => setCashForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5" placeholder="1500" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 font-medium">Notes (optional)</label>
                  <input value={cashForm.notes} onChange={e => setCashForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border rounded-xl px-3 py-2 text-sm mt-0.5" placeholder="End of day cash collected" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveCash} className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold">Save</button>
                <button onClick={() => { setShowCashForm(false); setEditingCashId(null); }} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold">Cancel</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-xl h-14 animate-pulse" />)}</div>
          ) : cashEntries.length === 0 ? (
            <div className="text-center py-10 text-gray-400">No cash entries for this date</div>
          ) : (
            <div className="space-y-2">
              {cashEntries.map((entry) => (
                <div key={entry.id} className="bg-white rounded-xl shadow-sm flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <p className="text-gray-400 text-xs">{entry.entry_date}</p>
                    {entry.notes && <p className="font-medium text-gray-700 text-sm">{entry.notes}</p>}
                  </div>
                  <span className="font-bold text-green-600">{formatCurrency(entry.amount)}</span>
                  <button onClick={() => { setEditingCashId(entry.id); setShowCashForm(false); setCashForm({ entry_date: entry.entry_date, amount: entry.amount.toString(), notes: entry.notes ?? '' }); }}
                    className="text-blue-500 p-1.5 hover:bg-blue-50 rounded-lg"><Pencil size={14} /></button>
                  <button onClick={() => deleteCash(entry.id)} className="text-red-500 p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

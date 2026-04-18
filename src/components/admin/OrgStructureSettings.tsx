import { useEffect, useState } from 'react';
import { Plus, Trash2, Building, LayoutGrid, Pencil, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface OrgItem {
  id: string;
  name: string;
  is_active: boolean;
}

interface OrgListProps {
  title: string;
  icon: React.ReactNode;
  items: OrgItem[];
  loading: boolean;
  onAdd: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onToggle: (id: string, active: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function OrgList({ title, icon, items, loading, onAdd, onRename, onToggle, onDelete }: OrgListProps) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    try {
      await onAdd(trimmed);
      setNewName('');
      setAdding(false);
    } catch (e: any) {
      setError(e.message || 'Already exists or failed to add');
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    try {
      await onRename(id, trimmed);
      setEditingId(null);
    } catch (e: any) {
      setError(e.message || 'Failed to rename');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {items.filter(i => i.is_active).length} active
          </span>
        </div>
        <button
          onClick={() => { setAdding(true); setError(''); }}
          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 mb-2 px-1">{error}</p>
      )}

      {adding && (
        <div className="flex gap-2 mb-2">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
            className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-600"
            placeholder={`New ${title.toLowerCase().replace(/s$/, '')} name`}
          />
          <button onClick={handleAdd} disabled={busy} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => { setAdding(false); setNewName(''); }} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-sm text-slate-400 py-4 text-center">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No {title.toLowerCase()} yet</p>
        ) : items.map(item => (
          <div key={item.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${item.is_active ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-dashed border-slate-200 bg-slate-50 opacity-60'}`}>
            {editingId === item.id ? (
              <>
                <input
                  autoFocus
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(item.id); if (e.key === 'Escape') setEditingId(null); }}
                  className="flex-1 px-2 py-0.5 text-sm border border-slate-300 rounded focus:outline-none focus:border-slate-600"
                />
                <button onClick={() => handleRename(item.id)} disabled={busy} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-slate-800 truncate">{item.name}</span>
                <button
                  onClick={() => { setEditingId(item.id); setEditName(item.name); setError(''); }}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                  title="Rename"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onToggle(item.id, !item.is_active)}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${item.is_active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  title={item.is_active ? 'Deactivate' : 'Activate'}
                >
                  {item.is_active ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrgStructureSettings() {
  const { activeRole } = useAuth();
  const accountId = activeRole?.type === 'account' ? activeRole.accountId : null;

  const [departments, setDepartments] = useState<OrgItem[]>([]);
  const [divisions, setDivisions] = useState<OrgItem[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingDivs, setLoadingDivs] = useState(true);

  const fetchDepts = async () => {
    if (!accountId) return;
    setLoadingDepts(true);
    const { data } = await supabase
      .from('departments')
      .select('id, name, is_active')
      .eq('account_id', accountId)
      .order('name');
    setDepartments(data || []);
    setLoadingDepts(false);
  };

  const fetchDivs = async () => {
    if (!accountId) return;
    setLoadingDivs(true);
    const { data } = await supabase
      .from('divisions')
      .select('id, name, is_active')
      .eq('account_id', accountId)
      .order('name');
    setDivisions(data || []);
    setLoadingDivs(false);
  };

  useEffect(() => {
    fetchDepts();
    fetchDivs();
  }, [accountId]);

  const addDept = async (name: string) => {
    const { error } = await supabase.from('departments').insert({ account_id: accountId, name });
    if (error) throw new Error(error.message.includes('unique') ? `"${name}" already exists` : error.message);
    await fetchDepts();
  };

  const renameDept = async (id: string, name: string) => {
    const { error } = await supabase.from('departments').update({ name }).eq('id', id);
    if (error) throw new Error(error.message.includes('unique') ? `"${name}" already exists` : error.message);
    await fetchDepts();
  };

  const toggleDept = async (id: string, is_active: boolean) => {
    await supabase.from('departments').update({ is_active }).eq('id', id);
    await fetchDepts();
  };

  const deleteDept = async (id: string) => {
    await supabase.from('departments').delete().eq('id', id);
    await fetchDepts();
  };

  const addDiv = async (name: string) => {
    const { error } = await supabase.from('divisions').insert({ account_id: accountId, name });
    if (error) throw new Error(error.message.includes('unique') ? `"${name}" already exists` : error.message);
    await fetchDivs();
  };

  const renameDiv = async (id: string, name: string) => {
    const { error } = await supabase.from('divisions').update({ name }).eq('id', id);
    if (error) throw new Error(error.message.includes('unique') ? `"${name}" already exists` : error.message);
    await fetchDivs();
  };

  const toggleDiv = async (id: string, is_active: boolean) => {
    await supabase.from('divisions').update({ is_active }).eq('id', id);
    await fetchDivs();
  };

  const deleteDiv = async (id: string) => {
    await supabase.from('divisions').delete().eq('id', id);
    await fetchDivs();
  };

  if (!accountId) return null;

  return (
    <div className="flex gap-6 flex-col sm:flex-row">
      <OrgList
        title="Departments"
        icon={<Building className="w-4 h-4 text-slate-500" />}
        items={departments}
        loading={loadingDepts}
        onAdd={addDept}
        onRename={renameDept}
        onToggle={toggleDept}
        onDelete={deleteDept}
      />
      <div className="hidden sm:block w-px bg-slate-200" />
      <OrgList
        title="Divisions"
        icon={<LayoutGrid className="w-4 h-4 text-slate-500" />}
        items={divisions}
        loading={loadingDivs}
        onAdd={addDiv}
        onRename={renameDiv}
        onToggle={toggleDiv}
        onDelete={deleteDiv}
      />
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useSemester } from '@/context/SemesterContext';

type Props = {
  onClose: () => void;
};

export default function SemesterManager({ onClose }: Props) {
  const { semesters, activeSemester, addSemester, renameSemester, deleteSemester, switchSemester } =
    useSemester();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    await addSemester(newName.trim());
    setNewName('');
    setLoading(false);
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    setLoading(true);
    await renameSemester(id, editName.trim());
    setEditingId(null);
    setEditName('');
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    await deleteSemester(id);
    setConfirmDeleteId(null);
    setLoading(false);
  };

  const handleSwitch = async (id: string) => {
    if (activeSemester?.id === id) return;
    setLoading(true);
    await switchSemester(id);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Semesters
          </h2>
          <button onClick={onClose} className="modal-close-btn">✕</button>
        </div>

        {/* Semester List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {semesters.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              No active semester records. Initialize a new semester below.
            </p>
          )}

          {semesters.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                background: s.is_active
                  ? 'var(--accent-ghost)'
                  : 'rgba(255, 255, 255, 0.01)',
                border: `1px solid ${s.is_active ? 'var(--border-active)' : 'var(--border-glass)'}`,  
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: s.is_active ? 'var(--hud-glow)' : 'none',
              }}
              onClick={() => handleSwitch(s.id)}
            >
              {/* Active indicator dot */}
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: s.is_active ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                  boxShadow: s.is_active ? '0 0 6px var(--accent)' : 'none',  
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                }}
              />

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === s.id ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleRename(s.id); }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      className="glass-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                  </form>
                ) : (
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: s.is_active ? 800 : 600,
                      color: s.is_active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {s.name}
                  </span>
                )}
              </div>

              {/* Active badge */}
              {s.is_active && (
                <span
                  style={{
                    fontSize: '0.58rem',
                    fontWeight: 800,
                    color: 'var(--accent)',
                    background: 'var(--accent-ghost)',
                    border: '1px solid var(--border-glass)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  Active
                </span>
              )}

              {/* Actions */}
              <div
                style={{ display: 'flex', gap: '4px', flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Rename */}
                <button
                  className="btn-action btn-edit"
                  onClick={() => {
                    setEditingId(s.id);
                    setEditName(s.name);
                  }}
                  title="Rename"
                  style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>

                {/* Delete */}
                {semesters.length > 1 && (
                  <button
                    className="btn-action btn-delete-action"
                    onClick={() => setConfirmDeleteId(s.id)}
                    title="Delete"
                    style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Delete Confirmation */}
        {confirmDeleteId && (
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              marginBottom: '16px',
            }}
          >
            <p style={{ fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.01em' }}>
              Confirm deletion: all courses, schedules, and analytics will be permanently expunged.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-secondary"
                onClick={() => setConfirmDeleteId(null)}
                style={{ flex: 1, padding: '9px 12px', fontSize: '0.78rem' }}
              >
                Abort
              </button>
              <button
                className="btn-primary"
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  fontSize: '0.78rem',
                  background: 'linear-gradient(135deg, #f43f5e, #ef4444)',
                  boxShadow: '0 0 15px rgba(239, 68, 68, 0.3)',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        )}

        {/* Add Semester */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
          style={{ display: 'flex', gap: '8px' }}
        >
          <input
            className="glass-input"
            type="text"
            placeholder="Initialize new semester..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ flex: 1, padding: '10px 14px' }}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={!newName.trim() || loading}
            style={{
              padding: '10px 16px',
              opacity: !newName.trim() || loading ? 0.5 : 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

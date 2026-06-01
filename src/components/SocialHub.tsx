'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSemester } from '@/context/SemesterContext';
import { useCourse } from '@/context/CourseContext';
import { supabase } from '@/lib/supabase';
import { triggerHapticLight, triggerHapticSuccess, triggerHapticWarning } from '@/lib/haptics';
import type { Course } from '@/types';

type Message = {
  id: string;
  user_id: string;
  user_name: string;
  course_code: string;
  message: string;
  created_at: string;
};

type Props = {
  activeFriendPeriods: any[] | null;
  setFriendPeriods: (periods: any[] | null) => void;
  compareMode: boolean;
  setCompareMode: (active: boolean) => void;
};

export default function SocialHub({ activeFriendPeriods, setFriendPeriods, compareMode, setCompareMode }: Props) {
  const { user } = useAuth();
  const { activeSemester } = useSemester();
  const { courses } = useCourse();

  // Share States
  const [shareLink, setShareLink] = useState('');
  const [shareId, setShareId] = useState('');
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);

  // Compare States
  const [friendShareInput, setFriendShareInput] = useState('');
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const [compareError, setCompareError] = useState('');
  const [friendName, setFriendName] = useState('');

  // Chat States
  const [activeChatCourse, setActiveChatCourse] = useState<Course | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // 1. Fetch current shared links for user
  useEffect(() => {
    async function loadActiveShare() {
      if (!user || !activeSemester) return;
      const { data, error } = await supabase
        .from('shared_schedules')
        .select('id')
        .eq('user_id', user.id)
        .eq('semester_id', activeSemester.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to load active shares:', error);
      } else if (data) {
        setShareId(data.id);
        const domain = typeof window !== 'undefined' ? window.location.origin : '';
        setShareLink(`${domain}/?share=${data.id}`);
      }
    }
    loadActiveShare();
  }, [user, activeSemester]);

  // 2. Generate Share link
  const handleGenerateShare = async () => {
    if (!user || !activeSemester) return;
    triggerHapticLight();
    setIsGeneratingShare(true);

    try {
      const { data, error } = await supabase
        .from('shared_schedules')
        .insert({
          user_id: user.id,
          semester_id: activeSemester.id,
        })
        .select('id')
        .single();

      if (error) throw error;
      
      if (data) {
        setShareId(data.id);
        const domain = typeof window !== 'undefined' ? window.location.origin : '';
        setShareLink(`${domain}/?share=${data.id}`);
        triggerHapticSuccess();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate sharing token.');
      triggerHapticWarning();
    } finally {
      setIsGeneratingShare(false);
    }
  };

  // 3. Delete share link
  const handleDeleteShare = async () => {
    if (!shareId) return;
    const confirm = window.confirm('Delete share link? Classmates will no longer be able to view this schedule.');
    if (!confirm) return;

    triggerHapticLight();
    try {
      const { error } = await supabase.from('shared_schedules').delete().eq('id', shareId);
      if (error) throw error;

      setShareId('');
      setShareLink('');
      triggerHapticSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to delete share link.');
      triggerHapticWarning();
    }
  };

  // Copy to clipboard
  const handleCopyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    triggerHapticSuccess();
    alert('Share link copied to clipboard!');
  };

  // 4. Compare Schedule overlay
  const handleCompareSchedules = async () => {
    if (!friendShareInput.trim()) return;
    triggerHapticLight();
    setIsLoadingCompare(true);
    setCompareError('');

    // Extract UUID from input (it might be a full URL or just the ID)
    let targetId = friendShareInput.trim();
    if (targetId.includes('?share=')) {
      targetId = targetId.split('?share=')[1]?.split('&')[0] || '';
    }

    try {
      // Find shared schedule record
      const { data: sharedInfo, error: infoErr } = await supabase
        .from('shared_schedules')
        .select('user_id, semester_id, profiles(full_name)')
        .eq('id', targetId)
        .single();

      if (infoErr || !sharedInfo) {
        throw new Error('Shared schedule not found. Double check the share link/ID.');
      }

      // Fetch periods
      const { data: friendPeriodsData, error: periodsErr } = await supabase
        .from('periods_with_course')
        .select('*')
        .eq('user_id', sharedInfo.user_id)
        .eq('semester_id', sharedInfo.semester_id);

      if (periodsErr) throw periodsErr;

      // Extract friend name
      const fname = (sharedInfo.profiles as any)?.full_name || 'Classmate';
      setFriendName(fname);
      setFriendPeriods(friendPeriodsData || []);
      setCompareMode(true);
      
      triggerHapticSuccess();
      setFriendShareInput('');
    } catch (err: any) {
      console.error(err);
      setCompareError(err.message || 'Verification failed.');
      triggerHapticWarning();
    } finally {
      setIsLoadingCompare(false);
    }
  };

  // Reset comparison
  const handleResetComparison = () => {
    triggerHapticLight();
    setFriendPeriods(null);
    setCompareMode(false);
    setFriendName('');
  };

  // 5. Chat Feed Lifecycle
  useEffect(() => {
    if (!activeChatCourse || !user) return;

    const normalizedCode = activeChatCourse.course_code.replace(/\s+/g, '').toUpperCase();
    setIsLoadingChat(true);

    // Fetch messages
    async function loadChatMessages() {
      const { data, error } = await supabase
        .from('course_messages')
        .select('*')
        .eq('course_code', normalizedCode)
        .order('created_at', { ascending: true })
        .limit(60);

      if (error) {
        console.error('Error fetching chat messages:', error);
      } else {
        setChatMessages(data ?? []);
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
      setIsLoadingChat(false);
    }
    loadChatMessages();

    // Realtime channel listener
    const channel = supabase
      .channel(`chat-board-${normalizedCode}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'course_messages', filter: `course_code=eq.${normalizedCode}` },
        (payload) => {
          setChatMessages((prev) => {
            const exists = prev.some((m) => m.id === payload.new.id);
            if (exists) return prev;
            return [...prev, payload.new as Message];
          });
          setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatCourse, user]);

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !activeChatCourse || !user) return;

    const normalizedCode = activeChatCourse.course_code.replace(/\s+/g, '').toUpperCase();
    const textToSend = newMessageText.trim();
    setNewMessageText('');
    triggerHapticLight();

    const { error } = await supabase.from('course_messages').insert({
      user_id: user.id,
      user_name: user.user_metadata?.full_name || user.email || 'Anonymous',
      course_code: normalizedCode,
      message: textToSend,
    });

    if (error) {
      console.error('Failed to post message:', error);
      alert('Failed to send message.');
    }
  };

  // Close chat room
  const closeChatRoom = () => {
    setActiveChatCourse(null);
    setChatMessages([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* ─── SHARE SCHEDULE PANEL (5.1) ───────────────── */}
      <section className="glass-card" style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
          Share Schedule
        </h2>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.4' }}>
          Publish your calendar to generate a shareable link and scan QR codes for your classmates.
        </p>

        {shareLink ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
            <div style={{ width: '100%', display: 'flex', gap: '6px' }}>
              <input
                className="glass-input"
                readOnly
                value={shareLink}
                style={{ flex: 1, padding: '8px 12px', fontSize: '0.72rem', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
              />
              <button onClick={handleCopyLink} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800 }}>
                Copy
              </button>
            </div>

            {/* QR Code Container */}
            <div
              style={{
                background: '#ffffff', padding: '10px', borderRadius: '8px',
                border: '1px solid var(--border-glass)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                marginTop: '4px',
              }}
            >
              <img
                src={`https://chart.googleapis.com/chart?chs=180x180&cht=qr&chl=${encodeURIComponent(shareLink)}`}
                alt="Timetable Share QR Code"
                style={{ display: 'block', width: '150px', height: '150px' }}
              />
            </div>

            <button
              onClick={handleDeleteShare}
              style={{
                background: 'transparent', border: 'none', color: 'var(--danger)',
                fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer',
                letterSpacing: '0.04em', marginTop: '6px',
              }}
            >
              🗑️ Deactivate Link
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerateShare}
            disabled={isGeneratingShare || !activeSemester}
            className="btn-primary"
            style={{ width: '100%', padding: '10px', fontSize: '0.74rem' }}
          >
            {isGeneratingShare ? 'Publishing...' : '🔗 Generate Share Link & QR Code'}
          </button>
        )}
      </section>

      {/* ─── COMPARE SCHEDULE OVERLAY (5.2) ───────────── */}
      <section className="glass-card" style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
          Compare Schedules
        </h2>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.4' }}>
          Input a friend's Share Link or ID to overlay their calendar on yours and identify common free periods.
        </p>

        {compareMode ? (
          <div
            style={{
              padding: '12px', background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block' }}>
                🟢 Comparison Mode Active
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                Overlaid with: <b>{friendName}</b>
              </span>
            </div>
            <button
              onClick={handleResetComparison}
              className="semester-selector"
              style={{ padding: '4px 10px', fontSize: '0.66rem', border: '1px solid var(--border-glass)', background: 'transparent' }}
            >
              Close Overlay
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                className="glass-input"
                type="text"
                placeholder="Paste Friend Share Link or ID..."
                value={friendShareInput}
                onChange={(e) => setFriendShareInput(e.target.value)}
                style={{ flex: 1, padding: '10px 12px', fontSize: '0.74rem' }}
              />
              <button
                onClick={handleCompareSchedules}
                disabled={isLoadingCompare || !friendShareInput.trim()}
                className="btn-primary"
                style={{ padding: '10px 16px', fontSize: '0.74rem' }}
              >
                {isLoadingCompare ? 'Verifying...' : '⇅ Compare'}
              </button>
            </div>
            {compareError && (
              <span style={{ fontSize: '0.65rem', color: 'var(--danger)', fontWeight: 800, textTransform: 'uppercase' }}>
                ⚠️ {compareError}
              </span>
            )}
          </div>
        )}
      </section>

      {/* ─── CLASS GROUP CHATS (5.3) ──────────────────── */}
      <section className="glass-card" style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
          Subject Study Boards
        </h2>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.4' }}>
          Connect with other students taking the same course code to ask questions and post announcements.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {courses.length === 0 ? (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
              No subjects registered in active semester.
            </p>
          ) : (
            courses.map((course) => (
              <button
                key={course.id}
                onClick={() => { triggerHapticLight(); setActiveChatCourse(course); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)',
                  borderRadius: '8px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.background = 'var(--accent-ghost)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-glass)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                }}
              >
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>
                    {course.course_name}
                  </span>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {course.course_code}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' }}>
                    Chat Room
                  </span>
                  <span style={{ fontSize: '0.8rem' }}>💬</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {/* ─── REALTIME CHAT ROOM MODAL OVERLAY ─────────── */}
      {activeChatCourse && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'var(--bg-elevated)',
            backdropFilter: 'blur(35px) saturate(1.8)', WebkitBackdropFilter: 'blur(35px) saturate(1.8)',
            zIndex: 100, display: 'flex', flexDirection: 'column',
            maxWidth: '540px', margin: '0 auto', borderLeft: '1px solid var(--border-glass)',
            borderRight: '1px solid var(--border-glass)',
          }}
        >
          {/* Chat Header */}
          <header style={{ padding: '16px', borderBottom: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                💬 {activeChatCourse.course_name}
              </h3>
              <p style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Board Code: {activeChatCourse.course_code.replace(/\s+/g, '').toUpperCase()}
              </p>
            </div>
            <button
              onClick={closeChatRoom}
              className="modal-close-btn"
              style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '1rem', cursor: 'pointer' }}
            >
              ✕
            </button>
          </header>

          {/* Chat Messages Log */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isLoadingChat ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="loading-spinner" />
              </div>
            ) : chatMessages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                <span style={{ fontSize: '2rem', marginBottom: '8px' }}>💬</span>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  NO ANNOUNCEMENTS POSTED YET
                </span>
                <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2px', padding: '0 30px' }}>
                  Be the first to post a study reference or start a discussion.
                </span>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.user_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '75%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {/* Sender Tag */}
                    <span style={{ fontSize: '0.55rem', fontWeight: 800, color: isMe ? 'var(--accent)' : 'var(--text-secondary)', marginBottom: '2px', textTransform: 'uppercase' }}>
                      {msg.user_name}
                    </span>
                    {/* Speech bubble */}
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        background: isMe ? 'var(--accent-ghost)' : 'rgba(255,255,255,0.02)',
                        border: '1px solid',
                        borderColor: isMe ? 'var(--accent)' : 'var(--border-glass)',
                        boxShadow: isMe ? 'var(--hud-glow)' : 'none',
                        color: 'var(--text-primary)',
                        fontSize: '0.76rem',
                        lineHeight: '1.45',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.message}
                    </div>
                    {/* Timestamp */}
                    <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Send Form */}
          <form
            onSubmit={handleSendMessage}
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border-glass)',
              display: 'flex',
              gap: '8px',
              background: 'rgba(0,0,0,0.1)',
            }}
          >
            <input
              className="glass-input"
              type="text"
              placeholder="Ask a question or post announcement..."
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              style={{ flex: 1, padding: '10px 14px', fontSize: '0.78rem' }}
            />
            <button
              type="submit"
              disabled={!newMessageText.trim()}
              className="btn-primary"
              style={{ padding: '10px 18px', fontSize: '0.76rem' }}
            >
              Send
            </button>
          </form>
        </div>
      )}

    </div>
  );
}

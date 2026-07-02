import React, { useState, useRef, useEffect } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { useAuthStore } from '../store/useAuthStore';
import { MessageSquare, Users, Send, Mic, MicOff, Crown, X } from 'lucide-react';

// ─────────────────────────────────────────────
// Chat Tab
// ─────────────────────────────────────────────
function ChatTab() {
  const [text, setText] = useState('');
  const { chatMessages, sendChatMessage } = useRoomStore();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendChatMessage(text);
    setText('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-indigo-400/60" />
            </div>
            <span className="text-[10px] text-zinc-600 max-w-[180px] leading-relaxed">
              No messages yet. Start the conversation!
            </span>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div key={msg.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-4 h-4 rounded-md flex items-center justify-center text-[8px] text-white font-bold shrink-0"
                  style={{ backgroundColor: msg.avatarColor || '#6366F1' }}
                >
                  {msg.sender.charAt(0).toUpperCase()}
                </div>
                <span className="text-[10px] font-semibold text-zinc-300">{msg.sender}</span>
                <span className="text-[9px] text-zinc-600 ml-auto shrink-0">{msg.timestamp}</span>
              </div>
              <div className="pl-5">
                <p className="text-[11px] text-zinc-300 bg-zinc-900/50 border border-zinc-800/50 px-2.5 py-1.5 rounded-lg break-words leading-relaxed inline-block max-w-full">
                  {msg.text}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800/50 shrink-0">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full pl-3 pr-9 py-2 rounded-lg premium-input text-[11px] placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="absolute right-1.5 p-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            <Send className="w-2.5 h-2.5" />
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────
// Participants Tab
// ─────────────────────────────────────────────
function ParticipantsTab({ micMuted, isSpeakingMock }) {
  const { roomUsers, socket, currentRoom } = useRoomStore();
  const { user } = useAuthStore();
  const totalCount = Object.keys(roomUsers).length;

  return (
    <div className="flex-1 overflow-y-auto p-3 min-h-0">
      {/* Owner */}
      <div className="mb-3">
        <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-600 block mb-1.5">Room Owner</span>
        <div className="flex items-center gap-2 px-2.5 py-2 bg-amber-500/5 border border-amber-500/15 rounded-lg">
          <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Crown className="w-2.5 h-2.5 text-amber-500" />
          </div>
          <span className="text-xs font-semibold text-amber-400/90 truncate">{currentRoom?.owner?.username}</span>
        </div>
      </div>

      {/* Participants */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-600">Participants</span>
          <span className="text-[9px] text-zinc-600 font-mono">{totalCount}</span>
        </div>
        <div className="space-y-1">
          {/* Self */}
          <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[9px] text-white shrink-0" style={{ backgroundColor: user?.avatarColor }}>
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] text-zinc-200 font-semibold truncate leading-none">{user?.username}</span>
                <span className="text-[8px] text-indigo-400 mt-0.5">You</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {micMuted ? <MicOff className="w-3 h-3 text-red-500/70" /> : <Mic className="w-3 h-3 text-emerald-500/80" />}
              {!micMuted && isSpeakingMock && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            </div>
          </div>

          {/* Others */}
          {Object.entries(roomUsers).map(([socketId, p]) => {
            if (socketId === socket?.id) return null;
            return (
              <div key={socketId} className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-zinc-900/30 border border-zinc-800/30 hover:border-zinc-700/40 transition-colors">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[9px] text-white shrink-0" style={{ backgroundColor: p.avatarColor }}>
                    {p.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] text-zinc-300 truncate leading-none">{p.username}</span>
                    {p.isSitting && <span className="text-[8px] text-indigo-400 mt-0.5">Seated</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {p.micMuted ? <MicOff className="w-3 h-3 text-zinc-600" /> : <Mic className="w-3 h-3 text-emerald-500/70" />}
                  {p.isSpeaking && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sidebar Shell (desktop panel / mobile drawer)
// ─────────────────────────────────────────────
export default function RoomSidebar({ micMuted, isSpeakingMock, open, onClose }) {
  const [activeTab, setActiveTab] = useState('chat');
  const { chatMessages } = useRoomStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMsgCountRef = useRef(chatMessages.length);

  useEffect(() => {
    if (activeTab !== 'chat') {
      const n = chatMessages.length - prevMsgCountRef.current;
      if (n > 0) setUnreadCount(c => c + n);
    } else {
      setUnreadCount(0);
    }
    prevMsgCountRef.current = chatMessages.length;
  }, [chatMessages, activeTab]);

  const tabs = [
    { id: 'chat',         label: 'Chat',   icon: MessageSquare, badge: unreadCount },
    { id: 'participants', label: 'People', icon: Users,          badge: 0 },
  ];

  const panelContent = (
    <>
      {/* Tab Header */}
      <div className="flex shrink-0 border-b border-zinc-800/60 bg-zinc-950/30">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-3 text-[11px] font-semibold transition-colors cursor-pointer ${isActive ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-400'}`}
            >
              <Icon className="w-3 h-3" />
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="absolute top-1.5 right-3 min-w-[16px] h-4 rounded-full bg-indigo-600 text-white text-[8px] font-bold flex items-center justify-center px-1">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
              {isActive && <span className="absolute bottom-0 inset-x-0 h-px bg-indigo-500" />}
            </button>
          );
        })}

        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-3 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'chat' && <ChatTab />}
        {activeTab === 'participants' && <ParticipantsTab micMuted={micMuted} isSpeakingMock={isSpeakingMock} />}
      </div>
    </>
  );

  const panelStyle = {
    background: 'rgba(14, 14, 18, 0.92)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 4px 40px rgba(0,0,0,0.6)',
  };

  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────── */}
      <div
        className="hidden lg:flex w-64 xl:w-72 shrink-0 flex-col min-h-0 rounded-xl overflow-hidden"
        style={panelStyle}
      >
        {panelContent}
      </div>

      {/* ── Mobile: backdrop ─────────────────────────── */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile: bottom drawer ────────────────────── */}
      <div
        className={`lg:hidden fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl overflow-hidden transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ ...panelStyle, height: '65vh', maxHeight: '520px' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>
        {panelContent}
      </div>
    </>
  );
}

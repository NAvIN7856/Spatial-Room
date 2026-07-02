import React, { useState, useRef, useEffect } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { Send, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ChatPanel() {
  const [text, setText] = useState('');
  const { chatMessages, sendChatMessage } = useRoomStore();
  const messagesEndRef = useRef(null);

  // Auto scroll to latest message
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
    <div className="w-full lg:w-80 h-[400px] lg:h-auto flex flex-col premium-card rounded-xl border border-zinc-800/60 overflow-hidden select-none">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center gap-2 bg-zinc-900/20">
        <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
        <h3 className="font-bold text-xs text-zinc-200">Room Chat</h3>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <span className="text-[10px] text-zinc-500 max-w-[180px] leading-relaxed">No messages yet. Send a message to start conversing!</span>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <div key={msg.id} className="flex flex-col gap-1 items-start">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-md flex items-center justify-center text-[8px] text-white font-bold"
                  style={{ backgroundColor: msg.avatarColor || '#6366F1' }}
                >
                  {msg.sender.charAt(0).toUpperCase()}
                </div>
                <span className="text-[11px] font-semibold text-zinc-350">{msg.sender}</span>
                <span className="text-[9px] text-zinc-650">{msg.timestamp}</span>
              </div>
              <div className="pl-6 max-w-full">
                <p className="text-[11px] text-zinc-200 bg-zinc-900/40 border border-zinc-850 px-2.5 py-1.5 rounded-lg break-all inline-block leading-relaxed">
                  {msg.text}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800/60 bg-zinc-950/20">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Send message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full pl-3 pr-10 py-2 rounded-lg premium-input text-xs"
          />
          <button
            type="submit"
            className="absolute right-1.5 p-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </form>
    </div>
  );
}

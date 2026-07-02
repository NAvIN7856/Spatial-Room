import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from './store/useAuthStore';
import { useRoomStore } from './store/useRoomStore';

import Navbar from './components/Navbar';
import AuthCard from './components/AuthCard';
import Lobby from './components/Lobby';
import RoomCanvas from './components/RoomCanvas';
import RoomSidebar from './components/RoomSidebar';

export default function App() {
  const { user, token, loading, checkAuth } = useAuthStore();
  const { currentRoom, connectSocket, disconnectSocket } = useRoomStore();

  // Lifted audio state for sidebar display
  const [micMuted, setMicMuted]           = useState(true);
  const [isSpeakingMock, setIsSpeakingMock] = useState(false);

  // Mobile sidebar drawer state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (token) connectSocket(token);
    else disconnectSocket();
    return () => disconnectSocket();
  }, [token, connectSocket, disconnectSocket]);

  // Lock body scroll when inside a room
  useEffect(() => {
    if (currentRoom) {
      document.body.classList.add('room-mode');
    } else {
      document.body.classList.remove('room-mode');
      setMobileSidebarOpen(false);
    }
    return () => document.body.classList.remove('room-mode');
  }, [currentRoom]);

  // Close mobile sidebar when orientation changes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`flex flex-col relative bg-[#09090b] ${currentRoom ? 'h-screen overflow-hidden' : 'min-h-screen pb-10'}`}>
      <div className="grid-overlay" />
      <div className="ambient-mask" />

      <Navbar />

      <main className={`flex-1 flex flex-col px-3 sm:px-4 md:px-6 mt-3 sm:mt-4 min-h-0 ${currentRoom ? 'overflow-hidden' : ''}`}>
        <AnimatePresence mode="wait">

          {/* Loading */}
          {loading && !user ? (
            <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center py-20">
              <div className="relative w-12 h-12">
                <span className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
              </div>
              <p className="text-zinc-500 text-xs mt-4 tracking-wider uppercase font-semibold">Connecting…</p>
            </motion.div>

          /* Auth */
          ) : !user ? (
            <motion.div key="auth"
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex justify-center items-center my-auto">
              <AuthCard />
            </motion.div>

          /* Lobby */
          ) : !currentRoom ? (
            <motion.div key="lobby"
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex-1 flex flex-col">
              <Lobby />
            </motion.div>

          /* Room */
          ) : (
            <motion.div key="room"
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-row gap-3 items-stretch min-h-0 pb-3 w-full max-w-[1400px] mx-auto">

              {/* Canvas column — always visible */}
              <RoomCanvas
                onMicMutedChange={setMicMuted}
                onSpeakingChange={setIsSpeakingMock}
                onToggleSidebar={() => setMobileSidebarOpen(o => !o)}
                sidebarOpen={mobileSidebarOpen}
              />

              {/* Sidebar — desktop inline, mobile drawer */}
              <RoomSidebar
                micMuted={micMuted}
                isSpeakingMock={isSpeakingMock}
                open={mobileSidebarOpen}
                onClose={() => setMobileSidebarOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

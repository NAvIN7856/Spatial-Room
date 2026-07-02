import React from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useRoomStore } from '../store/useRoomStore';
import { LogOut, Compass, Users } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const { currentRoom, leaveRoom, roomUsers } = useRoomStore();

  const handleLogout = () => {
    leaveRoom();
    logout();
  };

  const usersCount = Object.keys(roomUsers).length;

  return (
    <nav className="sticky top-0 z-50 bg-[#09090b]/80 backdrop-blur-md px-6 py-3 flex items-center justify-between border-b border-zinc-800/60 select-none">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Compass className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-zinc-100 tracking-tight">
            SpatialRoom
          </span>
          <span className="hidden md:inline-block text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full font-medium">
            v1.0
          </span>
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-4">
          {currentRoom && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900/60 border border-zinc-800 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-zinc-300 font-medium">{currentRoom.name}</span>
              <span className="text-zinc-600">/</span>
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-zinc-300 font-medium">{usersCount} online</span>
            </div>
          )}

          <div className="flex items-center gap-3 pl-3 border-l border-zinc-800/60">
            <div className="flex items-center gap-2">
              <div
                className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-zinc-100 font-bold text-xs shadow-sm ring-1 ring-zinc-800"
                style={{ backgroundColor: user.avatarColor || '#6366F1' }}
              >
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:inline-block text-xs font-medium text-zinc-300">
                {user.username}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

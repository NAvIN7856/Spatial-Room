import React, { useState, useEffect } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { useAuthStore } from '../store/useAuthStore';
import { Plus, Lock, Key, Trash2, ShieldAlert, DoorOpen, Search, Compass, LogOut, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Lobby() {
  const { user } = useAuthStore();
  const { 
    rooms, 
    fetchRooms, 
    createRoom, 
    deleteRoom, 
    verifyPassword, 
    joinRoom,
    loading 
  } = useRoomStore();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // States for entering private rooms
  const [targetRoom, setTargetRoom] = useState(null);
  const [enterPassword, setEnterPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user?.token) {
      fetchRooms(user.token);
    }
  }, [user, fetchRooms]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newRoom = await createRoom({
      name,
      password: isPrivate ? password : '',
      isPrivate
    }, user.token);

    if (newRoom) {
      setName('');
      setPassword('');
      setIsPrivate(false);
      setShowCreateModal(false);
      joinRoom(newRoom);
    }
  };

  const handleJoinClick = (room) => {
    if (room.isPrivate && room.owner._id !== user._id) {
      setTargetRoom(room);
      setEnterPassword('');
      setPasswordError('');
    } else {
      joinRoom(room);
    }
  };

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    
    const isValid = await verifyPassword(targetRoom._id, enterPassword, user.token);
    if (isValid) {
      const roomToJoin = targetRoom;
      setTargetRoom(null);
      joinRoom(roomToJoin);
    } else {
      setPasswordError('Invalid room password');
    }
  };

  const handleDeleteRoom = async (e, roomId) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this room?')) {
      await deleteRoom(roomId, user.token);
    }
  };

  // Filter rooms based on query
  const filteredRooms = rooms.filter(room => 
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.owner.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl w-full mx-auto px-4 md:px-6 py-6 flex-1 flex flex-col md:flex-row gap-8 items-stretch select-none">
      
      {/* SIDEBAR NAVIGATION PANEL */}
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-6">
        {/* User Card */}
        <div className="premium-card rounded-xl p-4 flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm text-zinc-100 shadow-sm"
            style={{ backgroundColor: user?.avatarColor || '#6366F1' }}
          >
            {user?.username.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-sm font-semibold text-zinc-200 truncate">{user?.username}</h4>
            <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
          </div>
        </div>

        {/* Global info card */}
        <div className="premium-card rounded-xl p-4.5 space-y-3.5 border-t border-t-indigo-500/10">
          <div className="flex items-center gap-2 text-indigo-400">
            <Info className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Spatial Audio</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Move your avatar around tables and chairs inside virtual rooms. Sounds attenuate and pan based on distances.
          </p>
        </div>

        {/* Create room button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-4 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-indigo-500/20 shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Workspace</span>
        </button>
      </div>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Filter Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search workspaces or creators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl premium-input placeholder-zinc-500"
          />
        </div>

        {/* Loader skeleton */}
        {loading && rooms.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(idx => (
              <div key={idx} className="premium-card rounded-xl p-5 h-40 flex flex-col justify-between animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 bg-zinc-800 rounded-md w-2/3"></div>
                  <div className="h-3 bg-zinc-800 rounded-md w-1/3"></div>
                </div>
                <div className="h-3 bg-zinc-800 rounded-md w-1/4"></div>
              </div>
            ))}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="premium-card rounded-xl p-16 text-center flex-1 flex flex-col items-center justify-center">
            <DoorOpen className="w-10 h-10 mb-4 text-zinc-600" />
            <h3 className="text-sm font-semibold text-zinc-300">No rooms active</h3>
            <p className="text-zinc-500 text-xs mt-1.5 max-w-sm leading-relaxed">
              Create a virtual workspace to invite friends and start spatial conversations.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-6 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-medium py-2 px-4 rounded-lg border border-zinc-800 transition-colors text-xs cursor-pointer"
            >
              Create workspace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredRooms.map((room) => {
              const isOwner = room.owner._id === user?._id;
              return (
                <motion.div
                  key={room._id}
                  layout
                  onClick={() => handleJoinClick(room)}
                  className="premium-card rounded-xl p-5 border border-zinc-800/40 hover:border-zinc-700/60 hover:bg-zinc-900/40 transition-all cursor-pointer flex flex-col justify-between h-40 group shadow-sm hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold text-sm text-zinc-200 group-hover:text-indigo-400 transition-colors truncate">
                        {room.name}
                      </h3>
                      {room.isPrivate && (
                        <span className="p-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20" title="Private Room">
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] text-zinc-100 font-bold"
                        style={{ backgroundColor: room.owner.avatarColor }}
                      >
                        {room.owner.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        by <span className="font-semibold text-zinc-300">{room.owner.username}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500">
                      {new Date(room.createdAt).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-2">
                      {isOwner && (
                        <button
                          onClick={(e) => handleDeleteRoom(e, room._id)}
                          className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete Room"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="text-indigo-400 text-xs font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        Connect &rarr;
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE WORKSPACE MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="premium-card rounded-xl max-w-sm w-full p-6 relative border border-zinc-800 shadow-2xl"
            >
              <h3 className="text-md font-bold text-zinc-100 mb-4">Create workspace</h3>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Design Board, Lounge"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg premium-input text-xs"
                  />
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <div>
                    <label className="font-semibold text-xs text-zinc-300 block">Workspace lock</label>
                    <span className="text-[10px] text-zinc-500">Require password validation</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                  />
                </div>

                {isPrivate && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5 overflow-hidden"
                  >
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Room password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg premium-input text-xs"
                    />
                  </motion.div>
                )}

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium py-2 rounded-lg border border-zinc-800 transition-colors text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg transition-all text-xs cursor-pointer border border-indigo-500/20"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRIVATE ROOM VERIFICATION DIALOG */}
      <AnimatePresence>
        {targetRoom && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="premium-card rounded-xl max-w-sm w-full p-6 relative border border-zinc-800 shadow-2xl"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-4">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-md font-bold text-zinc-100 mb-1">Protected Workspace</h3>
              <p className="text-zinc-500 text-[11px] mb-4">
                Workspace <span className="font-semibold text-zinc-300">{targetRoom.name}</span> requires a password key.
              </p>

              <form onSubmit={handleVerifyPassword} className="space-y-4">
                {passwordError && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
                    {passwordError}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Password Key</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Key className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="password"
                      required
                      autoFocus
                      placeholder="Password"
                      value={enterPassword}
                      onChange={(e) => setEnterPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg premium-input text-xs"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setTargetRoom(null)}
                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium py-2 rounded-lg border border-zinc-800 transition-colors text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg transition-all text-xs cursor-pointer border border-indigo-500/20"
                  >
                    Connect
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

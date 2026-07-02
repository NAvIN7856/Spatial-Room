import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  Mic, MicOff, VolumeX, Volume2, HelpCircle, LogOut,
  Monitor, Smile, Headphones, Volume1, ChevronDown,
  ChevronUp, Settings2, MessageSquare
} from 'lucide-react';
import { spatialAudioEngine } from '../audio/spatialAudioEngine';
import WhiteboardModal from './WhiteboardModal';

// ─── Utility: close-on-outside-click hook ────────────────────────
function useOutsideClick(ref, onClose) {
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [onClose, ref]);
}

// ─── Volume Popover ───────────────────────────────────────────────
function VolumePopover({ volume, onVolumeChange, onClose }) {
  const ref = useRef(null);
  useOutsideClick(ref, onClose);

  return (
    <div ref={ref} className="popover-panel min-w-[140px]">
      <span className="popover-label">Volume</span>
      <input
        type="range" min={0} max={150} step={1}
        value={Math.round(volume * 100)}
        onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
        className="w-full cursor-pointer mt-1"
      />
      <div className="text-center text-[10px] text-zinc-400 font-bold mt-1">{Math.round(volume * 100)}%</div>
    </div>
  );
}

// ─── Unified Audio Device Popover (Input + Output) ────────────────
function AudioDevicesPopover({ onClose, micMuted, currentMuted, onMicDeviceSelect, selectedInputId, onOutputDeviceSelect, selectedOutputId }) {
  const ref = useRef(null);
  useOutsideClick(ref, onClose);

  const { availableInputDevices, availableOutputDevices } = useRoomStore();
  const [tab, setTab] = useState('output');
  const [switching, setSwitching] = useState(false);

  const handleInputSelect = async (deviceId) => {
    setSwitching(true);
    await onMicDeviceSelect(deviceId);
    setSwitching(false);
  };

  const DeviceList = ({ devices, selectedId, onSelect, emptyMsg }) => (
    devices.length === 0
      ? <p className="text-[10px] text-zinc-600 text-center py-3">{emptyMsg}</p>
      : <div className="space-y-1 max-h-44 overflow-y-auto">
          {devices.map(d => (
            <button
              key={d.deviceId}
              onClick={() => onSelect(d.deviceId)}
              disabled={switching}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-[10px] font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                selectedId === d.deviceId || (!selectedId && d.deviceId === 'default')
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/25'
                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
              }`}
            >
              {d.label || `Device ${d.deviceId.slice(0, 8)}`}
            </button>
          ))}
        </div>
  );

  return (
    <div ref={ref} className="popover-panel min-w-[220px] max-w-[260px]">
      {/* Tabs */}
      <div className="flex gap-1 mb-3 p-0.5 bg-zinc-800/60 rounded-lg">
        {[['output', 'Output 🔊'], ['input', 'Mic 🎙']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 text-[9px] font-semibold py-1 rounded-md transition-colors cursor-pointer ${
              tab === id ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >{label}</button>
        ))}
      </div>

      {tab === 'output' && (
        <>
          <span className="popover-label">Audio Output</span>
          <DeviceList
            devices={availableOutputDevices}
            selectedId={selectedOutputId}
            onSelect={(id) => { onOutputDeviceSelect(id); }}
            emptyMsg="No output devices detected"
          />
        </>
      )}
      {tab === 'input' && (
        <>
          <span className="popover-label">Microphone {switching ? '(switching…)' : ''}</span>
          <DeviceList
            devices={availableInputDevices}
            selectedId={selectedInputId}
            onSelect={handleInputSelect}
            emptyMsg="No microphone devices detected"
          />
          {availableInputDevices.length === 0 && (
            <p className="text-[9px] text-zinc-600 mt-1 text-center">Grant mic permission to see devices</p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Screen Share Overlay ─────────────────────────────────────────
function ScreenShareOverlay({ localScreenStream, remoteScreenStreams, screenShareOwnerSocketId, socket }) {
  const videoRef = useRef(null);
  const stream = screenShareOwnerSocketId === socket?.id
    ? localScreenStream
    : remoteScreenStreams[screenShareOwnerSocketId];

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  if (!screenShareOwnerSocketId || !stream) return null;

  return (
    <div className="absolute inset-0 z-10 bg-black/85 flex flex-col items-center justify-center rounded-xl">
      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-700/50 px-2 py-1 rounded-lg">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[9px] text-zinc-300 font-semibold">Screen Sharing</span>
      </div>
      <video
        ref={videoRef} autoPlay playsInline muted
        className="rounded-lg object-contain"
        style={{ width: '96%', height: '93%' }}
      />
    </div>
  );
}

// ─── Main RoomCanvas ──────────────────────────────────────────────
export default function RoomCanvas({ onMicMutedChange, onSpeakingChange, onToggleSidebar, sidebarOpen }) {
  const canvasRef = useRef(null);
  const canvasWrapperRef = useRef(null);
  const { user } = useAuthStore();
  const {
    roomUsers, sendMove, leaveRoom, socket,
    updateLocalMediaState, initLocalStream, toggleMicTrack,
    sendEmojiReaction, currentRoom,
    localScreenStream, remoteScreenStreams, screenShareOwnerSocketId,
    startScreenShare, stopScreenShare,
    availableInputDevices, availableOutputDevices,
    switchMicDevice, refreshDevices,
  } = useRoomStore();

  const [micMuted, setMicMuted]           = useState(true);
  const [deafened, setDeafened]           = useState(false);
  const [isSpeakingMock, setIsSpeakingMock] = useState(false);

  // Volume & device state
  const [volume, setVolume]                       = useState(1.0);
  const [showVolumePopover, setShowVolumePopover] = useState(false);
  const [showDevicePopover, setShowDevicePopover] = useState(false);
  const [selectedInputId, setSelectedInputId]     = useState(null);
  const [selectedOutputId, setSelectedOutputId]   = useState(null);

  // Sitting
  const [isSitting, setIsSitting] = useState(false);
  const [chairId, setChairId]     = useState(null);

  // Whiteboard
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  // Canvas scale factor (for CSS-scaled canvas click mapping)
  const canvasScaleRef = useRef(1);

  const videoCacheRef      = useRef({});
  const lastMoveTimeRef    = useRef(0);
  const wasMovingRef       = useRef(false);
  const reactionsRef       = useRef([]);

  // ─── Device management ──────────────────────────────────────────

  // Initial device load + subscribe to hotplug events
  useEffect(() => {
    refreshDevices();
    const unsub = spatialAudioEngine.onDeviceChange(() => {
      console.log('[Devices] Device list changed — refreshing');
      refreshDevices();
    });
    return unsub;
  }, [refreshDevices]);

  // ─── Callbacks passed upward ────────────────────────────────────
  useEffect(() => { onMicMutedChange?.(micMuted); }, [micMuted, onMicMutedChange]);
  useEffect(() => { onSpeakingChange?.(isSpeakingMock); }, [isSpeakingMock, onSpeakingChange]);

  // ─── Init mic stream ────────────────────────────────────────────
  useEffect(() => { initLocalStream(); }, [initLocalStream]);

  // ─── Audio handlers ─────────────────────────────────────────────
  const handleMicToggle = () => {
    const next = !micMuted;
    setMicMuted(next);
    toggleMicTrack(next);
    spatialAudioEngine.resumeContext();
  };

  const handleDeafenToggle = () => {
    const next = !deafened;
    setDeafened(next);
    spatialAudioEngine.setDeafened(next);
  };

  const handleVolumeChange = (level) => {
    setVolume(level);
    spatialAudioEngine.setVolume(level);
  };

  const handleOutputDeviceSelect = async (deviceId) => {
    setSelectedOutputId(deviceId);
    await spatialAudioEngine.setOutputDevice(deviceId);
  };

  const handleMicDeviceSelect = async (deviceId) => {
    setSelectedInputId(deviceId);
    await switchMicDevice(deviceId, micMuted);
  };

  const handleScreenShareToggle = () => {
    if (localScreenStream) stopScreenShare();
    else startScreenShare();
  };

  // ─── Throttled send ─────────────────────────────────────────────
  const throttleSendMove = (x, y, rot, force = false) => {
    const now = Date.now();
    if (force || now - lastMoveTimeRef.current > 50) {
      sendMove(x, y, rot);
      lastMoveTimeRef.current = now;
    }
  };

  // ─── Reactions ──────────────────────────────────────────────────
  const spawnReaction = (socketId, emoji) => {
    reactionsRef.current.push({
      id: Math.random(), emoji, targetSocketId: socketId,
      yOffset: 0, opacity: 1.0, ySpeed: 1.5 + Math.random() * 0.5,
    });
  };
  const handleReactionClick = (emoji) => {
    sendEmojiReaction(emoji);
    spawnReaction(socket?.id, emoji);
  };

  // ─── Player state ───────────────────────────────────────────────
  const localPlayerRef = useRef({
    x: Math.random() * 400 + 200, y: Math.random() * 300 + 150,
    rotation: 0, targetX: null, targetY: null, isSitting: false, chairId: null,
  });
  const lerpUsersRef  = useRef({});
  const keysPressed   = useRef({});

  const furniture = useRef({
    tables: [
      { id: 't1', x: 250, y: 300, radius: 45, label: 'Discussion A' },
      { id: 't2', x: 550, y: 300, radius: 45, label: 'Discussion B' },
    ],
    chairs: [
      { id: 'c1', x: 250, y: 220, rotation:  Math.PI / 2,  occupiedBy: null, tableId: 't1' },
      { id: 'c2', x: 250, y: 380, rotation: -Math.PI / 2,  occupiedBy: null, tableId: 't1' },
      { id: 'c3', x: 170, y: 300, rotation:  0,             occupiedBy: null, tableId: 't1' },
      { id: 'c4', x: 330, y: 300, rotation:  Math.PI,       occupiedBy: null, tableId: 't1' },
      { id: 'c5', x: 550, y: 220, rotation:  Math.PI / 2,  occupiedBy: null, tableId: 't2' },
      { id: 'c6', x: 550, y: 380, rotation: -Math.PI / 2,  occupiedBy: null, tableId: 't2' },
      { id: 'c7', x: 470, y: 300, rotation:  0,             occupiedBy: null, tableId: 't2' },
      { id: 'c8', x: 630, y: 300, rotation:  Math.PI,       occupiedBy: null, tableId: 't2' },
    ],
    whiteboard: { x: 300, y: 25, width: 200, height: 60, label: 'Whiteboard' },
  });

  // ─── Sync media state ───────────────────────────────────────────
  useEffect(() => {
    updateLocalMediaState({
      micMuted, deafened, isSitting, chairId,
      isSpeaking: !micMuted && isSpeakingMock,
    });
  }, [micMuted, deafened, isSitting, chairId, isSpeakingMock, updateLocalMediaState]);

  // ─── Main canvas loop ───────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Track CSS scale so clicks map correctly
    const updateScale = () => {
      if (canvas) canvasScaleRef.current = canvas.getBoundingClientRect().width / canvas.width;
    };
    const resizeObserver = new ResizeObserver(updateScale);
    if (canvasWrapperRef.current) resizeObserver.observe(canvasWrapperRef.current);
    updateScale();

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) {
        e.preventDefault();
        keysPressed.current[key] = true;
        localPlayerRef.current.targetX = null;
        localPlayerRef.current.targetY = null;
        localPlayerRef.current.chairTargetId = null;
      }
    };
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (key in keysPressed.current) keysPressed.current[key] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const initialPlayer = localPlayerRef.current;
    const s0 = useRoomStore.getState();
    if (s0.socket) s0.sendMove(initialPlayer.x, initialPlayer.y, initialPlayer.rotation);

    const updateLoop = () => {
      const player = localPlayerRef.current;
      const speed = 2.4;
      let dx = 0, dy = 0;

      if (!player.isSitting) {
        if (keysPressed.current['w'] || keysPressed.current['arrowup'])    dy -= speed;
        if (keysPressed.current['s'] || keysPressed.current['arrowdown'])  dy += speed;
        if (keysPressed.current['a'] || keysPressed.current['arrowleft'])  dx -= speed;
        if (keysPressed.current['d'] || keysPressed.current['arrowright']) dx += speed;

        if (dx !== 0 || dy !== 0) {
          if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx = (dx / len) * speed; dy = (dy / len) * speed;
          }
          player.x += dx; player.y += dy;
          player.rotation = Math.atan2(dy, dx);
          const r = 20;
          player.x = Math.max(r, Math.min(canvas.width - r, player.x));
          player.y = Math.max(r + 15, Math.min(canvas.height - r, player.y));
          wasMovingRef.current = true;
          throttleSendMove(player.x, player.y, player.rotation);
        } else if (wasMovingRef.current) {
          wasMovingRef.current = false;
          throttleSendMove(player.x, player.y, player.rotation, true);
        }
      }

      if (player.targetX !== null && player.targetY !== null) {
        const tx = player.targetX - player.x, ty = player.targetY - player.y;
        const dist = Math.sqrt(tx * tx + ty * ty);
        if (dist > speed) {
          player.rotation = Math.atan2(ty, tx);
          player.x += (tx / dist) * speed; player.y += (ty / dist) * speed;
          throttleSendMove(player.x, player.y, player.rotation);
        } else {
          player.x = player.targetX; player.y = player.targetY;
          player.targetX = null; player.targetY = null;
          throttleSendMove(player.x, player.y, player.rotation, true);
          if (player.chairTargetId) {
            const chair = furniture.current.chairs.find(c => c.id === player.chairTargetId);
            if (chair) {
              player.x = chair.x; player.y = chair.y; player.rotation = chair.rotation;
              player.isSitting = true; player.chairId = chair.id;
              setIsSitting(true); setChairId(chair.id);
              throttleSendMove(player.x, player.y, player.rotation, true);
            }
            player.chairTargetId = null;
          }
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const glow = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 50, canvas.width/2, canvas.height/2, 400);
      glow.addColorStop(0, 'rgba(99,102,241,0.05)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawGrid(ctx, canvas);
      drawFurniture(ctx);
      drawPlayers(ctx);
      drawReactions(ctx);

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    const drawGrid = (ctx, canvas) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.015)'; ctx.lineWidth = 1;
      const g = 40;
      for (let x = 0; x < canvas.width; x += g) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
      for (let y = 0; y < canvas.height; y += g) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
    };

    const drawFurniture = (ctx) => {
      const wb = furniture.current.whiteboard;
      ctx.save();
      ctx.strokeStyle = 'rgba(99,102,241,0.25)'; ctx.setLineDash([4,4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(wb.x, wb.y, wb.width, wb.height, 4); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = 'rgba(99,102,241,0.04)'; ctx.fill();
      ctx.fillStyle = 'rgba(99,102,241,0.5)'; ctx.font = 'bold 9px Inter'; ctx.textAlign = 'center';
      ctx.fillText('✏ ' + wb.label, wb.x + wb.width/2, wb.y + wb.height/2 + 4);
      ctx.restore();

      furniture.current.tables.forEach(table => {
        const sh = ctx.createRadialGradient(table.x, table.y, table.radius-8, table.x, table.y, table.radius+12);
        sh.addColorStop(0,'rgba(0,0,0,0.3)'); sh.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(table.x, table.y, table.radius+12, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#18181b'; ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(table.x, table.y, table.radius, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#71717a'; ctx.font = '9px Inter'; ctx.textAlign = 'center';
        ctx.fillText(table.label, table.x, table.y+3);
      });

      furniture.current.chairs.forEach(chair => {
        ctx.save(); ctx.translate(chair.x, chair.y); ctx.rotate(chair.rotation);
        ctx.fillStyle = '#27272a'; ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(-8,-8,16,16,3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#71717a'; ctx.beginPath(); ctx.arc(0,0,2,0,Math.PI*2); ctx.fill();
        ctx.restore();
      });
    };

    const drawPlayers = (ctx) => {
      const state = useRoomStore.getState();
      const authState = useAuthStore.getState();
      const users = state.roomUsers, sock = state.socket, currentUser = authState.user;
      const self = localPlayerRef.current;
      spatialAudioEngine.updateListener(self.x, self.y, self.rotation);

      Object.entries(users).forEach(([socketId, userState]) => {
        if (socketId === sock?.id) return;
        let ld = lerpUsersRef.current[socketId];
        if (!ld) {
          ld = { currentX: userState.x, currentY: userState.y, currentRotation: userState.rotation };
          lerpUsersRef.current[socketId] = ld;
        }
        ld.currentX += (userState.x - ld.currentX) * 0.15;
        ld.currentY += (userState.y - ld.currentY) * 0.15;
        ld.currentRotation += (userState.rotation - ld.currentRotation) * 0.15;
        drawAvatar(ctx, ld.currentX, ld.currentY, ld.currentRotation, userState.username, userState.avatarColor, userState.isSpeaking, !userState.micMuted);
      });

      const selfState = sock ? users[sock.id] : null;
      const micActive = selfState ? !selfState.micMuted : true;
      const isSpeakingSelf = selfState ? selfState.isSpeaking : false;

      if (!self.isSitting) {
        drawAvatar(ctx, self.x, self.y, self.rotation, currentUser?.username||'You', currentUser?.avatarColor, isSpeakingSelf, micActive);
      } else {
        const chair = furniture.current.chairs.find(c => c.id === self.chairId);
        if (chair) {
          self.x = chair.x; self.y = chair.y; self.rotation = chair.rotation;
          drawAvatar(ctx, self.x, self.y, self.rotation, currentUser?.username||'You', currentUser?.avatarColor, isSpeakingSelf, micActive);
        }
      }
    };

    const drawReactions = (ctx) => {
      const state = useRoomStore.getState();
      const sock = state.socket;
      reactionsRef.current.forEach(r => {
        let rx = 0, ry = 0;
        if (r.targetSocketId === sock?.id) { rx = localPlayerRef.current.x; ry = localPlayerRef.current.y; }
        else { const p = lerpUsersRef.current[r.targetSocketId]; if (p) { rx = p.currentX; ry = p.currentY; } }
        if (rx && ry) {
          ctx.save(); ctx.globalAlpha = r.opacity; ctx.font = '20px Arial'; ctx.textAlign = 'center';
          ctx.fillText(r.emoji, rx, ry - 25 - r.yOffset); ctx.restore();
        }
        r.yOffset += r.ySpeed; r.opacity -= 0.015;
      });
      reactionsRef.current = reactionsRef.current.filter(r => r.opacity > 0);
    };

    const drawAvatar = (ctx, x, y, rotation, name, color, isSpeaking, micActive) => {
      const radius = 18;
      const state = useRoomStore.getState(), room = state.currentRoom;
      ctx.save(); ctx.translate(x, y);
      if (isSpeaking) {
        ctx.fillStyle = 'rgba(99,102,241,0.15)'; ctx.strokeStyle = 'rgba(99,102,241,0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, radius + 6 + Math.sin(Date.now()/90)*2.5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = color || '#6366F1';
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI*2); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.rotate(rotation);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(radius-2,-4); ctx.lineTo(radius+5,0); ctx.lineTo(radius-2,4); ctx.closePath(); ctx.fill();
      ctx.rotate(-rotation);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(name.charAt(0).toUpperCase(), 0, 0);
      const isOwner = name === room?.owner?.username;
      ctx.fillStyle = 'rgba(9,9,11,0.85)'; ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(-30, radius+8, 60, 14, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = isOwner ? '#fbbf24' : '#e2e8f0'; ctx.font = '8px Inter'; ctx.textBaseline = 'middle';
      ctx.fillText(isOwner ? `👑 ${name}` : name, 0, radius+15);
      if (!micActive) {
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(12,-12,5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 7px Inter'; ctx.textBaseline = 'middle';
        ctx.fillText('M', 12, -12);
      }
      ctx.restore();
    };

    animationFrameId = requestAnimationFrame(updateLoop);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [socket]);

  // ─── Canvas click (with scale mapping) ─────────────────────────
  const handleCanvasClick = (e) => {
    spatialAudioEngine.resumeContext();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Map CSS pixel position back to canvas logical pixels
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top)  * scaleY;
    const player = localPlayerRef.current;

    const wb = furniture.current.whiteboard;
    if (clickX >= wb.x && clickX <= wb.x + wb.width && clickY >= wb.y && clickY <= wb.y + wb.height) {
      setShowWhiteboard(true); return;
    }

    let clickedChair = null;
    furniture.current.chairs.forEach(chair => {
      const dist = Math.sqrt(Math.pow(clickX - chair.x, 2) + Math.pow(clickY - chair.y, 2));
      if (dist < 18) clickedChair = chair;
    });

    if (clickedChair) {
      if (clickedChair.occupiedBy && clickedChair.occupiedBy !== user?.username) return;
      player.targetX = clickedChair.x; player.targetY = clickedChair.y;
      player.chairTargetId = clickedChair.id;
      if (player.isSitting) { player.isSitting = false; player.chairId = null; }
    } else {
      player.targetX = clickX; player.targetY = clickY;
      player.chairTargetId = null;
      if (player.isSitting) { player.isSitting = false; player.chairId = null; }
    }
  };

  const handleStandUp = () => {
    const player = localPlayerRef.current;
    if (player.isSitting) {
      player.isSitting = false; player.chairId = null;
      setIsSitting(false); setChairId(null);
      player.y += 30;
      throttleSendMove(player.x, player.y, player.rotation, true);
    }
  };

  // ─── Toolbar button classes ─────────────────────────────────────
  const btn      = 'p-2 rounded-full transition-all cursor-pointer border';
  const btnGhost = `${btn} bg-zinc-800/40 hover:bg-zinc-700/40 text-zinc-400 hover:text-zinc-200 border-zinc-700/30`;

  return (
    <div className="flex-1 flex flex-col min-h-0 select-none">

      {/* Room Header */}
      <div className="w-full flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 hidden sm:inline">Workspace</span>
          <span className="text-[10px] text-zinc-600 hidden sm:inline">•</span>
          <span className="text-xs font-semibold text-zinc-300">{currentRoom?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {isSitting && (
            <button onClick={handleStandUp} className="bg-indigo-600/10 hover:bg-indigo-600/25 border border-indigo-500/20 text-indigo-400 font-bold px-3 py-1 rounded-md text-[10px] transition-all cursor-pointer">
              Stand Up
            </button>
          )}
          {/* Mobile: toggle sidebar button */}
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/40 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title={sidebarOpen ? 'Hide Chat/People' : 'Show Chat/People'}
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Frame */}
      <div
        ref={canvasWrapperRef}
        className="relative rounded-xl overflow-hidden shrink-0 w-full"
        style={{ border: '1px solid rgba(255,255,255,0.07)', background: '#09090b', boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 8px 40px rgba(0,0,0,0.6)' }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          onClick={handleCanvasClick}
          className="block cursor-crosshair w-full h-auto"
        />

        {/* HUD hint — hidden on very small screens */}
        <div className="absolute top-2 left-2 bg-zinc-950/80 border border-zinc-800/60 px-2 py-1 rounded-lg hidden sm:flex items-center gap-1.5 text-[9px] text-zinc-500">
          <HelpCircle className="w-3 h-3 text-indigo-400/60 shrink-0" />
          <span>WASD / tap canvas to move · chairs to sit · whiteboard to draw</span>
        </div>

        {/* Screen Share Overlay */}
        <ScreenShareOverlay
          localScreenStream={localScreenStream}
          remoteScreenStreams={remoteScreenStreams}
          screenShareOwnerSocketId={screenShareOwnerSocketId}
          socket={socket}
        />
      </div>

      {/* Controls Toolbar */}
      <div className="flex items-center justify-center mt-3 shrink-0">
        <div className="flex items-center gap-1 p-1.5 px-2 bg-zinc-900/70 border border-zinc-800/60 rounded-full shadow-xl overflow-x-auto max-w-full scrollbar-hide">

          {/* Mic toggle */}
          <button onClick={handleMicToggle} className={`${btn} ${micMuted ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'}`} title={micMuted ? 'Unmute' : 'Mute'}>
            {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Deafen */}
          <button onClick={handleDeafenToggle} className={`${btn} ${deafened ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20' : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20'}`} title={deafened ? 'Undeafen' : 'Deafen'}>
            {deafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Volume popover */}
          <div className="relative">
            <button onClick={() => { setShowVolumePopover(v => !v); setShowDevicePopover(false); }} className={`${btnGhost} flex items-center gap-0.5`} title="Volume">
              <Volume1 className="w-3.5 h-3.5" />
              <ChevronDown className="w-2.5 h-2.5 opacity-50" />
            </button>
            {showVolumePopover && (
              <VolumePopover volume={volume} onVolumeChange={handleVolumeChange} onClose={() => setShowVolumePopover(false)} />
            )}
          </div>

          {/* Audio I/O device selector */}
          <div className="relative">
            <button
              onClick={() => { setShowDevicePopover(v => !v); setShowVolumePopover(false); }}
              className={`${btnGhost}`}
              title="Audio Devices (input/output)"
            >
              <Headphones className="w-4 h-4" />
            </button>
            {showDevicePopover && (
              <AudioDevicesPopover
                onClose={() => setShowDevicePopover(false)}
                micMuted={micMuted}
                currentMuted={micMuted}
                selectedInputId={selectedInputId}
                onMicDeviceSelect={handleMicDeviceSelect}
                selectedOutputId={selectedOutputId}
                onOutputDeviceSelect={handleOutputDeviceSelect}
              />
            )}
          </div>

          <span className="w-px h-4 bg-zinc-700/50 mx-0.5 shrink-0" />

          {/* Speak button (when unmuted) */}
          {!micMuted && (
            <button
              onMouseDown={() => setIsSpeakingMock(true)} onMouseUp={() => setIsSpeakingMock(false)}
              onMouseLeave={() => setIsSpeakingMock(false)}
              onTouchStart={(e) => { e.preventDefault(); setIsSpeakingMock(true); }}
              onTouchEnd={() => setIsSpeakingMock(false)}
              className={`px-2.5 py-1.5 rounded-full font-bold text-[9px] transition-all border cursor-pointer select-none shrink-0 ${isSpeakingMock ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20'}`}
            >
              Speak
            </button>
          )}

          {/* Screen share */}
          <button
            onClick={handleScreenShareToggle}
            disabled={!!screenShareOwnerSocketId && screenShareOwnerSocketId !== socket?.id}
            className={`${btn} disabled:opacity-40 disabled:cursor-not-allowed ${localScreenStream ? 'bg-purple-600 text-white border-purple-500' : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/20'}`}
            title={screenShareOwnerSocketId && screenShareOwnerSocketId !== socket?.id ? 'Another user is sharing' : localScreenStream ? 'Stop share' : 'Share screen'}
          >
            <Monitor className="w-4 h-4" />
          </button>

          <span className="w-px h-4 bg-zinc-700/50 mx-0.5 shrink-0" />

          {/* Leave */}
          <button onClick={leaveRoom} className={`${btnGhost} hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20`} title="Leave">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reactions Dock */}
      <div className="flex items-center gap-2 mt-2.5 px-4 py-1.5 bg-zinc-900/20 border border-zinc-800/40 rounded-full shadow-inner max-w-max mx-auto shrink-0 overflow-x-auto scrollbar-hide">
        <Smile className="w-3 h-3 text-zinc-600 shrink-0" />
        {['👍','😂','🎉','❤️','😮','👏'].map(emoji => (
          <button key={emoji} onClick={() => handleReactionClick(emoji)} className="text-base hover:scale-125 hover:rotate-6 active:scale-95 transition-transform cursor-pointer select-none leading-none shrink-0">
            {emoji}
          </button>
        ))}
      </div>

      {showWhiteboard && <WhiteboardModal onClose={() => setShowWhiteboard(false)} />}
    </div>
  );
}

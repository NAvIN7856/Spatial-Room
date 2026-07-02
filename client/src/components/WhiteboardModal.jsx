import React, { useRef, useEffect, useState } from 'react';
import { useRoomStore } from '../store/useRoomStore';
import { X, Trash2, Edit2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function WhiteboardModal({ onClose }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(3);
  
  const { socket, sendDrawLine, sendClearWhiteboard } = useRoomStore();

  const colors = [
    { name: 'White', value: '#ffffff' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Eraser', value: '#0e0d14' } // Eraser matches custom dark slate background
  ];

  const strokeSizes = [2, 4, 8, 12];

  // Tracks the last pointer coordinates locally (no React state to keep drawing fast)
  const lastPointRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Initialize board background
    ctx.fillStyle = '#0e0d14'; // clean deep dark gray slate
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawLineSegment = (x0, y0, x1, y1, strokeColor, strokeSize) => {
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    };

    // --- SOCKET.IO LISTENERS ---
    const handleInitHistory = (history) => {
      // Redraw history lines
      history.forEach(line => {
        drawLineSegment(line.x0, line.y0, line.x1, line.y1, line.color, line.size);
      });
    };

    const handleDrawLineEvent = (line) => {
      drawLineSegment(line.x0, line.y0, line.x1, line.y1, line.color, line.size);
    };

    const handleClearEvent = () => {
      ctx.fillStyle = '#0e0d14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    if (socket) {
      socket.on('whiteboard-init', handleInitHistory);
      socket.on('draw-line', handleDrawLineEvent);
      socket.on('clear-whiteboard', handleClearEvent);
      socket.emit('get-whiteboard-history');
    }

    return () => {
      if (socket) {
        socket.off('whiteboard-init', handleInitHistory);
        socket.off('draw-line', handleDrawLineEvent);
        socket.off('clear-whiteboard', handleClearEvent);
      }
    };
  }, [socket]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    // Support touch and mouse coordinates
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleMouseDown = (e) => {
    const coords = getCoordinates(e);
    if (!coords) return;
    lastPointRef.current = coords;
    setIsDrawing(true);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Draw locally
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    // Emit to other peers
    sendDrawLine({
      x0: lastPointRef.current.x,
      y0: lastPointRef.current.y,
      x1: coords.x,
      y1: coords.y,
      color,
      size: lineWidth
    });

    lastPointRef.current = coords;
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    if (window.confirm('Clear whiteboard drawings for everyone?')) {
      sendClearWhiteboard();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="premium-card rounded-xl max-w-4xl w-full p-6 relative border border-zinc-800 shadow-2xl"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-100">Interactive Whiteboard</h3>
              <p className="text-[10px] text-zinc-500">Drawings are synchronized instantly with everyone in the room</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar & Canvas wrapper */}
        <div className="flex flex-col md:flex-row gap-5 items-stretch">
          
          {/* Left Toolbar */}
          <div className="flex md:flex-col gap-4 justify-between md:justify-start items-center p-3.5 bg-zinc-900/40 rounded-xl border border-zinc-800/60 md:w-36 shrink-0">
            
            {/* Color Palette */}
            <div className="w-full">
              <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block mb-2 text-center md:text-left">Colors</span>
              <div className="grid grid-cols-3 md:grid-cols-2 gap-1.5">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setColor(c.value)}
                    className={`w-7.5 h-7.5 rounded-md border flex items-center justify-center cursor-pointer transition-all ${
                      color === c.value 
                        ? 'border-indigo-500 scale-105 shadow-sm shadow-indigo-500/20' 
                        : 'border-zinc-850 hover:border-zinc-700'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  >
                    {c.name === 'Eraser' && <span className="text-[8px] font-bold text-zinc-400">Eraser</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Brush Size */}
            <div className="w-full md:mt-4">
              <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block mb-2 text-center md:text-left">Brush Size</span>
              <div className="flex md:flex-col justify-around gap-1.5 bg-zinc-950/40 p-1.5 rounded-lg border border-zinc-850">
                {strokeSizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setLineWidth(size)}
                    className={`flex items-center justify-center rounded cursor-pointer text-[10px] font-bold py-1 px-2 transition-all ${
                      lineWidth === size 
                        ? 'bg-indigo-650 text-white shadow-sm' 
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>

            {/* Action Tools */}
            <button
              onClick={handleClear}
              className="md:mt-auto w-full flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 font-semibold py-1.5 px-3 rounded-lg transition-colors text-[10px] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Clear Board</span>
            </button>
          </div>

          {/* Board Canvas */}
          <div className="flex-1 border border-zinc-850 rounded-xl overflow-hidden shadow-inner bg-[#0e0d14] relative">
            <canvas
              ref={canvasRef}
              width={700}
              height={430}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
              className="block cursor-crosshair w-full h-full"
            />
          </div>

        </div>

      </motion.div>
    </div>
  );
}

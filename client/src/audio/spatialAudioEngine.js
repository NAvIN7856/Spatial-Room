class SpatialAudioEngine {
  constructor() {
    this.ctx = null;
    this.peers = {};           // socketId -> { sourceNode, pannerNode, gainNode }
    this.scale = 0.05;
    this.mainGainNode = null;
    this.compressorNode = null;
    this.highPassFilter = null;
    this._volume = 1.0;
    this._outputDeviceId = null;
    this._inputDeviceId = null;
    this._workaroundAudios = {};     // socketId -> HTMLAudioElement
    this._deviceChangeCallbacks = []; // Registered listeners for device hotplug
    this._deafened = false;

    // Listen for device hotplug events (plug/unplug headphones, mic, etc.)
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        this._deviceChangeCallbacks.forEach(cb => {
          try { cb(); } catch (e) { /* ignore */ }
        });
      });
    }
  }

  // ─── Core context ──────────────────────────────────────────────

  initAudioContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass({
        latencyHint: 'interactive',
        sampleRate: 48000,
      });

      // Pipeline: peer sources → HighPassFilter → DynamicsCompressor → MainGain → Destination
      this.highPassFilter = this.ctx.createBiquadFilter();
      this.highPassFilter.type = 'highpass';
      this.highPassFilter.frequency.value = 80;
      this.highPassFilter.Q.value = 0.7;

      this.compressorNode = this.ctx.createDynamicsCompressor();
      this.compressorNode.threshold.value = -24;
      this.compressorNode.knee.value = 10;
      this.compressorNode.ratio.value = 4;
      this.compressorNode.attack.value = 0.005;
      this.compressorNode.release.value = 0.15;

      this.mainGainNode = this.ctx.createGain();
      this.mainGainNode.gain.value = this._deafened ? 0 : this._volume;

      this.highPassFilter.connect(this.compressorNode);
      this.compressorNode.connect(this.mainGainNode);
      this.mainGainNode.connect(this.ctx.destination);

      console.log('[Audio] Context initialised — chain: HPF → Compressor → MainGain → Dest');
    }
    this.resumeContext();
    return this.ctx;
  }

  async resumeContext() {
    if (this.ctx?.state === 'suspended') {
      try {
        await this.ctx.resume();
        console.log('[Audio] Context resumed');
      } catch (err) {
        console.error('[Audio] Resume failed:', err);
      }
    }
  }

  // ─── Device change subscription ────────────────────────────────

  /**
   * Register a callback that fires whenever the OS device list changes
   * (headphones plugged/unplugged, USB mic connected, etc.).
   * Returns an unsubscribe function.
   */
  onDeviceChange(callback) {
    this._deviceChangeCallbacks.push(callback);
    return () => {
      this._deviceChangeCallbacks = this._deviceChangeCallbacks.filter(c => c !== callback);
    };
  }

  // ─── Device enumeration ────────────────────────────────────────

  async getInputDevices() {
    try {
      // Trigger permission prompt if labels are empty
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter(d => d.kind === 'audioinput');
      // If labels are empty, request mic permission to populate them
      if (inputs.length > 0 && !inputs[0].label) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
        } catch (_) { /* permission denied, return what we have */ }
      }
      return inputs;
    } catch (err) {
      console.error('[Audio] enumerateDevices failed:', err);
      return [];
    }
  }

  async getOutputDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'audiooutput');
    } catch (err) {
      console.error('[Audio] enumerateDevices failed:', err);
      return [];
    }
  }

  // ─── Peer spatial nodes ────────────────────────────────────────

  setupSpatialNode(socketId, remoteStream) {
    try {
      this.initAudioContext();
      this.removeSpatialNode(socketId);

      // Chromium WebRTC silent-audio workaround — stream must be attached to a DOM element
      const audio = document.createElement('audio');
      audio.id = `sr-audio-${socketId}`;
      audio.srcObject = remoteStream;
      audio.muted = true;        // Muted here; actual audio is routed via Web Audio
      audio.style.display = 'none';
      document.body.appendChild(audio);
      audio.play().catch(err => console.log('[Audio] Workaround play deferred:', err.message));

      // Apply current output device if already selected
      if (this._outputDeviceId && typeof audio.setSinkId === 'function') {
        audio.setSinkId(this._outputDeviceId).catch(e =>
          console.warn('[Audio] setSinkId on new element:', e.message)
        );
      }
      this._workaroundAudios[socketId] = audio;

      // Web Audio graph
      const sourceNode = this.ctx.createMediaStreamSource(remoteStream);

      const pannerNode = this.ctx.createPanner();
      pannerNode.panningModel  = 'HRTF';
      pannerNode.distanceModel = 'inverse';
      pannerNode.refDistance   = 2.0;
      pannerNode.maxDistance   = 10000;
      pannerNode.rolloffFactor = 1.5;
      pannerNode.coneInnerAngle = 360;
      pannerNode.coneOuterAngle = 360;
      pannerNode.coneOuterGain  = 0;

      const gainNode = this.ctx.createGain();
      gainNode.gain.value = 1.5;

      sourceNode.connect(pannerNode);
      pannerNode.connect(gainNode);
      gainNode.connect(this.highPassFilter);

      this.peers[socketId] = { sourceNode, pannerNode, gainNode };
      console.log(`[Audio] Spatial node ready for: ${socketId}`);
    } catch (err) {
      console.error(`[Audio] setupSpatialNode(${socketId}):`, err);
    }
  }

  // ─── Volume & deafen ───────────────────────────────────────────

  setDeafened(isDeafened) {
    this._deafened = isDeafened;
    this.initAudioContext();
    if (this.mainGainNode) {
      const target = isDeafened ? 0 : this._volume;
      this.mainGainNode.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.05);
    }
  }

  setVolume(level) {
    this._volume = Math.max(0, Math.min(1.5, level));
    if (this.mainGainNode && this.ctx && !this._deafened) {
      this.mainGainNode.gain.linearRampToValueAtTime(this._volume, this.ctx.currentTime + 0.05);
    }
  }

  getVolume() { return this._volume; }

  // ─── Output device switching ───────────────────────────────────

  /**
   * Set the audio output device.
   * Uses AudioContext.setSinkId() (Chrome 110+) for the Web Audio graph,
   * and HTMLAudioElement.setSinkId() for each workaround element.
   * Falls back gracefully where the API is unavailable.
   */
  async setOutputDevice(deviceId) {
    this._outputDeviceId = deviceId;
    const promises = [];

    // Try modern AudioContext.setSinkId (routes the entire Web Audio graph)
    if (this.ctx && typeof this.ctx.setSinkId === 'function') {
      promises.push(
        this.ctx.setSinkId(deviceId).catch(e =>
          console.warn('[Audio] ctx.setSinkId failed:', e.message)
        )
      );
    }

    // Also update every workaround <audio> element
    for (const [socketId, audio] of Object.entries(this._workaroundAudios)) {
      if (typeof audio.setSinkId === 'function') {
        promises.push(
          audio.setSinkId(deviceId).catch(e =>
            console.warn(`[Audio] setSinkId(${socketId}):`, e.message)
          )
        );
      }
    }

    await Promise.all(promises);
    console.log('[Audio] Output device set to:', deviceId);
  }

  getCurrentOutputDeviceId() { return this._outputDeviceId; }

  // ─── Input device tracking (used by store for replaceTrack) ────

  setCurrentInputDeviceId(deviceId) {
    this._inputDeviceId = deviceId;
  }

  getCurrentInputDeviceId() { return this._inputDeviceId; }

  // ─── Listener (self) position ──────────────────────────────────

  updateListener(selfX, selfY, selfRotation) {
    if (!this.ctx) return;
    const listener = this.ctx.listener;
    const time = this.ctx.currentTime;
    const scaledX = selfX * this.scale;
    const scaledZ = selfY * this.scale;
    const lookX = Math.cos(selfRotation);
    const lookZ = Math.sin(selfRotation);

    if (listener.positionX) {
      listener.positionX.setValueAtTime(scaledX, time);
      listener.positionY.setValueAtTime(0, time);
      listener.positionZ.setValueAtTime(scaledZ, time);
      listener.forwardX.setValueAtTime(lookX, time);
      listener.forwardY.setValueAtTime(0, time);
      listener.forwardZ.setValueAtTime(lookZ, time);
      listener.upX.setValueAtTime(0, time);
      listener.upY.setValueAtTime(1, time);
      listener.upZ.setValueAtTime(0, time);
    } else {
      listener.setPosition?.(scaledX, 0, scaledZ);
      listener.setOrientation?.(lookX, 0, lookZ, 0, 1, 0);
    }
  }

  // ─── Peer position ─────────────────────────────────────────────

  updatePeerPosition(socketId, x, y, rotation) {
    const peer = this.peers[socketId];
    if (!peer || !this.ctx) return;
    const panner = peer.pannerNode;
    const time = this.ctx.currentTime;
    const scaledX = x * this.scale;
    const scaledZ = y * this.scale;

    if (panner.positionX) {
      panner.positionX.setValueAtTime(scaledX, time);
      panner.positionY.setValueAtTime(0, time);
      panner.positionZ.setValueAtTime(scaledZ, time);
      panner.orientationX.setValueAtTime(Math.cos(rotation), time);
      panner.orientationY.setValueAtTime(0, time);
      panner.orientationZ.setValueAtTime(Math.sin(rotation), time);
    } else {
      panner.setPosition?.(scaledX, 0, scaledZ);
      panner.setOrientation?.(Math.cos(rotation), 0, Math.sin(rotation));
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────

  removeSpatialNode(socketId) {
    const audio = this._workaroundAudios[socketId]
      ?? document.getElementById(`sr-audio-${socketId}`);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      delete this._workaroundAudios[socketId];
    }

    const peer = this.peers[socketId];
    if (peer) {
      try {
        peer.sourceNode.disconnect();
        peer.pannerNode.disconnect();
        peer.gainNode.disconnect();
      } catch (_) { /* already disconnected */ }
      delete this.peers[socketId];
    }
  }

  close() {
    Object.keys(this.peers).forEach(id => this.removeSpatialNode(id));
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.mainGainNode = null;
      this.compressorNode = null;
      this.highPassFilter = null;
    }
    this._deviceChangeCallbacks = [];
  }
}

export const spatialAudioEngine = new SpatialAudioEngine();

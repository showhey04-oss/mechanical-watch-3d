const DEFAULT_BUS_GAINS = Object.freeze({
  escapement: 0.24,
  winding: 0.32,
  reverse: 0.24,
  crown: 0.38,
});

const EVENT_TYPES = Object.freeze([
  "escapementTick",
  "escapementTock",
  "winding",
  "reverse",
  "crownPull",
  "crownPush",
]);

const emptyCounts = () => Object.fromEntries(EVENT_TYPES.map((type) => [type, 0]));
const stateName = (enabled, loading, supported, failures) => {
  if (!supported || failures.length) return "unavailable";
  if (loading) return "loading";
  return enabled ? "on" : "off";
};

export class MechanicalAudioEngine {
  constructor({
    manifestUrl = new URL("../assets/audio/manifest.json?app=v3.14.0", import.meta.url),
    audioContextFactory,
    fetchFn = globalThis.fetch?.bind(globalThis),
    masterGain = 0.36,
    onStateChange = () => {},
  } = {}) {
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    this.audioContextFactory = audioContextFactory ?? (AudioContextClass ? () => new AudioContextClass() : null);
    this.fetchFn = fetchFn;
    this.manifestUrl = manifestUrl;
    this.masterGainValue = Math.max(0, Math.min(1, Number(masterGain) || 0));
    this.onStateChange = onStateChange;
    this.supported = Boolean(this.audioContextFactory && this.fetchFn);
    this.enabled = false;
    this.loading = false;
    this.visible = true;
    this.context = null;
    this.masterNode = null;
    this.busNodes = new Map();
    this.manifest = null;
    this.buffers = new Map();
    this.failedAssets = [];
    this.activeSources = new Set();
    this.eventCounts = emptyCounts();
    this.eventLog = [];
    this.lastEventType = null;
    this.lastEventTime = null;
    this.droppedEvents = 0;
    this.suppressedEvents = 0;
    this.loadPromise = null;
  }

  emitState() {
    this.onStateChange(this.getDiagnostics());
  }

  createGraph() {
    if (this.context) return;
    this.context = this.audioContextFactory();
    this.masterNode = this.context.createGain();
    this.masterNode.gain.value = 0;
    this.masterNode.connect(this.context.destination);
    for (const [name, gain] of Object.entries(DEFAULT_BUS_GAINS)) {
      const node = this.context.createGain();
      node.gain.value = gain;
      node.connect(this.masterNode);
      this.busNodes.set(name, node);
    }
  }

  rampMaster(value, duration = 0.025) {
    if (!this.context || !this.masterNode) return;
    const now = this.context.currentTime;
    const gain = this.masterNode.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(Math.max(0, value), now + duration);
  }

  async enableFromUserGesture() {
    if (!this.supported) {
      this.emitState();
      return false;
    }
    try {
      this.createGraph();
      await this.context.resume();
      this.enabled = true;
      this.loading = this.buffers.size === 0;
      this.failedAssets = [];
      this.emitState();
      if (this.buffers.size === 0) await this.loadBuffers();
      if (this.failedAssets.length) {
        this.enabled = false;
        this.rampMaster(0);
        this.emitState();
        return false;
      }
      this.rampMaster(this.masterGainValue);
      this.emitState();
      return true;
    } catch (error) {
      this.failedAssets = [error?.message || String(error)];
      this.enabled = false;
      this.loading = false;
      this.stopAll();
      this.emitState();
      return false;
    }
  }

  async loadBuffers() {
    if (this.loadPromise) return this.loadPromise;
    this.loading = true;
    this.emitState();
    this.loadPromise = (async () => {
      const response = await this.fetchFn(this.manifestUrl);
      if (!response.ok) throw new Error(`audio manifest ${response.status}`);
      this.manifest = await response.json();
      const baseUrl = new URL(".", response.url || this.manifestUrl);
      const revision = encodeURIComponent(this.manifest.revision || "1");
      const failures = [];
      await Promise.all(Object.entries(this.manifest.runtime).map(async ([type, asset]) => {
        try {
          const assetUrl = new URL(asset.file, baseUrl);
          assetUrl.searchParams.set("audio", revision);
          const assetResponse = await this.fetchFn(assetUrl);
          if (!assetResponse.ok) throw new Error(`HTTP ${assetResponse.status}`);
          const buffer = await this.context.decodeAudioData(await assetResponse.arrayBuffer());
          this.buffers.set(type, buffer);
        } catch (error) {
          failures.push(`${asset.file}: ${error?.message || String(error)}`);
        }
      }));
      this.failedAssets = failures.sort();
      this.loading = false;
      this.emitState();
      return this.failedAssets.length === 0;
    })().catch((error) => {
      this.loading = false;
      this.failedAssets = [error?.message || String(error)];
      this.emitState();
      return false;
    }).finally(() => {
      this.loadPromise = null;
    });
    return this.loadPromise;
  }

  async disable() {
    this.enabled = false;
    this.rampMaster(0);
    this.stopAll();
    if (this.context?.state === "running") await this.context.suspend().catch(() => {});
    this.emitState();
  }

  async setVisible(visible) {
    this.visible = Boolean(visible);
    if (!this.context) return;
    if (!this.visible) {
      this.rampMaster(0, 0.015);
      this.stopAll();
      if (this.context.state === "running") await this.context.suspend().catch(() => {});
    } else if (this.enabled) {
      await this.context.resume().catch(() => {});
      this.rampMaster(this.masterGainValue);
    }
    this.emitState();
  }

  setMasterGain(value) {
    this.masterGainValue = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.enabled && this.visible) this.rampMaster(this.masterGainValue);
    this.emitState();
    return this.masterGainValue;
  }

  noteDropped(count = 1) {
    this.droppedEvents += Math.max(0, Math.trunc(count) || 0);
  }

  noteSuppressed(count = 1) {
    this.suppressedEvents += Math.max(0, Math.trunc(count) || 0);
  }

  play(type, { timestamp = performance.now(), metadata = {} } = {}) {
    const asset = this.manifest?.runtime?.[type];
    const buffer = this.buffers.get(type);
    if (!this.enabled || !this.visible || this.context?.state !== "running" || !asset || !buffer) {
      this.noteSuppressed();
      return false;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.busNodes.get(asset.bus) || this.masterNode);
    source.addEventListener("ended", () => this.activeSources.delete(source), { once: true });
    this.activeSources.add(source);
    source.start();
    this.eventCounts[type] += 1;
    this.lastEventType = type;
    this.lastEventTime = timestamp;
    this.eventLog.push({ type, time: timestamp, ...metadata });
    if (this.eventLog.length > 500) this.eventLog.splice(0, this.eventLog.length - 500);
    return true;
  }

  stopAll() {
    for (const source of this.activeSources) {
      try { source.stop(); } catch {}
    }
    this.activeSources.clear();
  }

  createMediaStreamDestination() {
    if (!this.context || !this.masterNode || typeof this.context.createMediaStreamDestination !== "function") return null;
    const destination = this.context.createMediaStreamDestination();
    this.masterNode.connect(destination);
    return destination;
  }

  disconnectMediaStreamDestination(destination) {
    if (!destination || !this.masterNode) return;
    try { this.masterNode.disconnect(destination); } catch {}
  }

  clearEventLog() {
    this.eventLog.length = 0;
    this.eventCounts = emptyCounts();
    this.lastEventType = null;
    this.lastEventTime = null;
    this.droppedEvents = 0;
    this.suppressedEvents = 0;
  }

  getDiagnostics() {
    return {
      audioSupported: this.supported,
      audioEnabled: this.enabled,
      audioContextState: this.context?.state ?? "not-created",
      status: stateName(this.enabled, this.loading, this.supported, this.failedAssets),
      buffersLoaded: [...this.buffers.keys()].sort(),
      failedAssets: [...this.failedAssets],
      masterGain: this.masterGainValue,
      busGains: { ...DEFAULT_BUS_GAINS },
      lastEventType: this.lastEventType,
      lastEventTime: this.lastEventTime,
      eventCounts: { ...this.eventCounts },
      droppedEvents: this.droppedEvents,
      suppressedEvents: this.suppressedEvents,
      activeSources: this.activeSources.size,
      eventLog: this.eventLog.map((event) => ({ ...event })),
      highRatePolicy: { maxEscapementEventsPerSecond: 8, maxPhaseEventsPerFrame: 1 },
    };
  }
}

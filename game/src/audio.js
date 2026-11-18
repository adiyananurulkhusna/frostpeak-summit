// Synthesized sound for Frostpeak Drift: no audio files, no network — every
// sound is built from WebAudio oscillators and filtered noise at run time.
// A low wind bed follows the blizzard, the engine hum follows the car's
// speed, and a two-tone siren follows the wanted level. Short blips mark
// punches, pickups, mission success and getting busted.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let windGain = null;
  let windFilter = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);

      // Wind: looped white noise through a low-pass filter.
      const length = context.sampleRate * 2;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const wind = context.createBufferSource();
      wind.buffer = buffer;
      wind.loop = true;
      windFilter = context.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 420;
      windGain = context.createGain();
      windGain.gain.value = 0.05;
      wind.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      wind.start();

      // Engine: a sawtooth whose pitch follows speed.
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      // Siren: a square wave that alternates between two notes.
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 720;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function blip(frequency, duration, type, volume, slideTo) {
    if (!context || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(frequency, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
      gain.gain.setValueAtTime(volume || 0.2, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + duration);
    } catch {
      // A failed blip is never worth stopping the game for.
    }
  }

  return {
    /** Call from a user gesture (starting the game) so the browser lets sound play. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
    },
    isMuted() {
      return muted;
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    /** Continuous beds, called every frame with the live state. */
    update({ speed, driving, wanted, blizzard }) {
      if (!context || muted) return;
      if (windGain) windGain.gain.value = 0.03 + blizzard * 0.09;
      if (windFilter) windFilter.frequency.value = 300 + blizzard * 500;
      if (engineGain && engineOsc) {
        engineGain.gain.value = driving ? 0.04 + Math.min(0.08, speed / 6000) : 0;
        engineOsc.frequency.value = 50 + Math.min(140, speed * 0.22);
      }
      if (sirenGain && sirenOsc) {
        if (wanted > 0) {
          sirenGain.gain.value = 0.028;
          sirenTimer += 1 / 60;
          if (sirenTimer > 0.42) {
            sirenTimer = 0;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.value = sirenHigh ? 960 : 720;
          }
        } else {
          sirenGain.gain.value = 0;
        }
      }
    },
    punch() {
      blip(160, 0.12, 'square', 0.18, 70);
    },
    pickup() {
      blip(660, 0.12, 'sine', 0.2);
      blip(990, 0.18, 'sine', 0.18);
    },
    missionDone() {
      blip(523, 0.14, 'triangle', 0.22);
      setTimeout(() => blip(659, 0.14, 'triangle', 0.22), 120);
      setTimeout(() => blip(784, 0.26, 'triangle', 0.24), 240);
    },
    crash() {
      blip(90, 0.25, 'sawtooth', 0.22, 45);
    },
    busted() {
      blip(392, 0.3, 'square', 0.2, 196);
      setTimeout(() => blip(311, 0.5, 'square', 0.2, 155), 260);
    },
  };
}

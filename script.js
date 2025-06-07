// BeatCraft Pro Script

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

const state = {
  instrument: 'piano',
  volume: 0.8,
  tempo: 120,
  recording: false,
  playing: false,
  octave: 'lower',
  animationId: null
};

const selectors = {
  playBtn: document.getElementById('playBtn'),
  stopBtn: document.getElementById('stopBtn'),
  recordBtn: document.getElementById('recordBtn'),
  volumeSlider: document.getElementById('volumeSlider'),
  tempoSlider: document.getElementById('tempoSlider'),
  tempoValue: document.getElementById('tempoValue'),
  composerName: document.getElementById('composerName'),
  trackTitle: document.getElementById('trackTitle'),
  recIndicator: document.getElementById('recIndicator'),
  beatCells: document.querySelectorAll('.beat-cell'),
  keys: document.querySelectorAll('.white-key, .black-key'),
  instruments: document.querySelectorAll('.instrument'),
  octaveBtns: document.querySelectorAll('.octave-btn'),
  visualizerBars: document.querySelectorAll('#visualizer .bar')
};

const keyMap = {
  'z': 'C3','s': 'C#3','x': 'D3','d': 'D#3','c': 'E3','v': 'F3','g': 'F#3','b': 'G3','h': 'G#3','n': 'A3','j': 'A#3','m': 'B3',
  ',': 'C4','l': 'C#4','.': 'D4',';': 'D#4','/': 'E4','q': 'F4','2': 'F#4','w': 'G4','3': 'G#4','e': 'A4','4': 'A#4','r': 'B4','t': 'C5'
};

function initUI() {
  selectors.instruments.forEach(i => i.addEventListener('click', e => {
    selectors.instruments.forEach(ins => ins.classList.remove('active'));
    i.classList.add('active');
    state.instrument = i.dataset.instrument;
  }));

  selectors.keys.forEach(key => {
    key.addEventListener('mousedown', () => playNote(key.dataset.note));
    ['mouseup', 'mouseleave'].forEach(evt => key.addEventListener(evt, () => key.classList.remove('playing')));
  });

  selectors.beatCells.forEach(cell => cell.addEventListener('click', () => cell.classList.toggle('active')));

  selectors.playBtn.addEventListener('click', togglePlayback);
  selectors.stopBtn.addEventListener('click', stopPlayback);
  selectors.recordBtn.addEventListener('click', toggleRecording);

  selectors.volumeSlider.addEventListener('input', () => state.volume = selectors.volumeSlider.value / 100);
  selectors.tempoSlider.addEventListener('input', () => {
    state.tempo = selectors.tempoSlider.value;
    selectors.tempoValue.textContent = state.tempo;
  });

  selectors.octaveBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      selectors.octaveBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.octave = btn.dataset.octave;
    });
  });

  selectors.composerName.value = localStorage.getItem('composerName') || '';
  selectors.composerName.addEventListener('input', () => localStorage.setItem('composerName', selectors.composerName.value));

  animateVisualizer();
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  randomizeTrackTitle();
}

function playNote(note) {
  const key = document.querySelector(`[data-note="${note}"]`);
  key?.classList.add('playing');

  if (state.instrument === 'drums') return playDrum();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = {
    piano: 'sine',
    guitar: 'sawtooth',
    synth: 'square',
    bass: 'triangle',
    strings: 'sine'
  }[state.instrument] || 'sine';

  osc.frequency.value = getFreq(note);
  gain.gain.value = state.volume;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
  setTimeout(() => osc.stop(), 1000);
}

function playDrum() {
  const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 200;
  gain.gain.value = state.volume;
  source.buffer = buffer;
  source.connect(filter).connect(gain).connect(audioCtx.destination);
  source.start();
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
  setTimeout(() => source.stop(), 500);
}

function getFreq(note) {
  const freqs = {
    C3: 130.81, 'C#3': 138.59, D3: 146.83, 'D#3': 155.56, E3: 164.81, F3: 174.61, 'F#3': 185, G3: 196, 'G#3': 207.65,
    A3: 220, 'A#3': 233.08, B3: 246.94, C4: 261.63, 'C#4': 277.18, D4: 293.66, 'D#4': 311.13, E4: 329.63,
    F4: 349.23, 'F#4': 369.99, G4: 392, 'G#4': 415.3, A4: 440, 'A#4': 466.16, B4: 493.88, C5: 523.25
  };
  return freqs[note] || 440;
}

function handleKeyDown(e) {
  if (e.repeat) return;
  const note = keyMap[e.key];
  if (note && note[1] === (state.octave === 'lower' ? '3' : '4')) playNote(note);
}

function handleKeyUp(e) {
  const note = keyMap[e.key];
  if (note) document.querySelector(`[data-note="${note}"]`)?.classList.remove('playing');
}

function togglePlayback() {
  state.playing = !state.playing;
  selectors.playBtn.innerHTML = state.playing ? '<i class="fas fa-pause"></i> Pause' : '<i class="fas fa-play"></i> Play';
  if (state.playing) playBeatLoop(); else cancelAnimationFrame(state.animationId);
}

function stopPlayback() {
  state.playing = false;
  selectors.playBtn.innerHTML = '<i class="fas fa-play"></i> Play';
  cancelAnimationFrame(state.animationId);
  selectors.beatCells.forEach(cell => cell.classList.remove('highlight'));
}

function playBeatLoop() {
  const interval = 60000 / state.tempo / 4;
  let beat = 0, last = 0;
  function loop(t) {
    if (!last) last = t;
    if (t - last >= interval) {
      selectors.beatCells.forEach((cell, idx) => {
        if (idx === beat) {
          cell.classList.add('highlight');
          if (cell.classList.contains('active')) {
            if (cell.classList.contains('drum')) playDrum();
            else if (cell.classList.contains('snare')) playNote('D3');
            else if (cell.classList.contains('hihat')) playNote('F3');
            else playNote(['C3', 'E3', 'G3', 'A3'][Math.floor(Math.random() * 4)]);
          }
        } else if (idx === (beat - 1 + 8) % 8) cell.classList.remove('highlight');
      });
      beat = (beat + 1) % 8;
      last = t;
    }
    state.animationId = requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function toggleRecording() {
  state.recording = !state.recording;
  selectors.recordBtn.innerHTML = state.recording
    ? '<i class="fas fa-stop"></i> Stop Recording'
    : '<i class="fas fa-record-vinyl"></i> Record';
  selectors.recIndicator.classList.toggle('active', state.recording);
}

function animateVisualizer() {
  selectors.visualizerBars.forEach(bar => bar.style.height = `${20 + Math.floor(Math.random() * 80)}px`);
  requestAnimationFrame(animateVisualizer);
}

function randomizeTrackTitle() {
  const p = ['Midnight', 'Sunset', 'Ocean', 'Mountain', 'City', 'Forest'];
  const s = ['Dreams', 'Journey', 'Echoes', 'Waves', 'Horizon'];
  selectors.trackTitle.textContent = `${p[Math.floor(Math.random() * p.length)]} ${s[Math.floor(Math.random() * s.length)]}`;
}

window.addEventListener('DOMContentLoaded', initUI);

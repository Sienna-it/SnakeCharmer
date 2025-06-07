// ——— State & Selectors ———
const state = {
  ctx: new (window.AudioContext||window.webkitAudioContext)(),
  currentInstrument: 'piano',
  isPlaying: false, isRecording: false,
  volume: 0.8, tempo: 120, octave: 'lower',
  animationId: null,
};
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const refs = {
  keys: $$('.white-key, .black-key'),
  instruments: $$('.instrument'),
  beatCells: $$('.beat-cell'),
  playBtn: $('#playBtn'),
  stopBtn: $('#stopBtn'),
  recordBtn: $('#recordBtn'),
  recIndicator: $('#recIndicator'),
  volumeSlider: $('#volumeSlider'),
  tempoSlider: $('#tempoSlider'),
  tempoValue: $('#tempoValue'),
  visualizerBars: $$('#visualizer .bar'),
  composerName: $('#composerName'),
  trackTitle: $('#trackTitle'),
  octaveBtns: $$('.octave-btn'),
};

// ——— Mappings ———
const keyMap = {
  z:'C3', s:'C#3', x:'D3', d:'D#3', c:'E3', v:'F3', g:'F#3',
  b:'G3', h:'G#3', n:'A3', j:'A#3', m:'B3',
  ',':'C4', l:'C#4', '.':'D4', ';':'D#4', '/':'E4',
  q:'F4', '2':'F#4', w:'G4', '3':'G#4', e:'A4', '4':'A#4',
  r:'B4', t:'C5'
};

// ——— Initialization ———
document.addEventListener('DOMContentLoaded', () => {
  // instrument buttons
  refs.instruments.forEach(el => el.addEventListener('click', () => {
    refs.instruments.forEach(i=>i.classList.remove('active'));
    el.classList.add('active');
    state.currentInstrument = el.dataset.instrument;
  }));

  // piano keys
  refs.keys.forEach(el => {
    el.addEventListener('mousedown', ()=>playNote(el.dataset.note));
    ['mouseup','mouseleave'].forEach(ev=>
      el.addEventListener(ev, ()=>el.classList.remove('playing')));
  });

  // beat sequencer toggles
  refs.beatCells.forEach(c => c.addEventListener('click', ()=>c.classList.toggle('active')));

  // transport buttons
  refs.playBtn.addEventListener('click', togglePlay);
  refs.stopBtn.addEventListener('click', stopPlay);
  refs.recordBtn.addEventListener('click', toggleRecord);

  // sliders
  refs.volumeSlider.addEventListener('input', () => state.volume = refs.volumeSlider.value/100);
  refs.tempoSlider .addEventListener('input', () => {
    state.tempo = +refs.tempoSlider.value;
    refs.tempoValue.textContent = state.tempo;
  });

  // keyboard shortcuts
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup',   handleKeyUp);

  // octave toggle
  refs.octaveBtns.forEach(b => b.addEventListener('click', () => {
    refs.octaveBtns.forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    state.octave = b.dataset.octave;
  }));

  // visualizer loop
  requestAnimationFrame(animateVisualizer);

  // load saved name
  const saved = localStorage.getItem('composerName');
  if(saved) refs.composerName.value = saved;
  refs.composerName.addEventListener('input', ()=>localStorage.setItem('composerName', refs.composerName.value));

  // randomize track title
  (function(){
    const P=['Midnight','Sunset','Ocean','Mountain','City','Desert','Forest','Space'];
    const S=['Dreams','Journey','Echoes','Waves','Horizon','Reflections','Memories','Serenity'];
    refs.trackTitle.textContent = `${P.random()} ${S.random()}`;
  })();
});

// ——— Playback Functions ———
function playNote(note) {
  const keyEl = document.querySelector(`[data-note="${note}"]`);
  if (keyEl) keyEl.classList.add('playing');
  // handle drums separately
  if (state.currentInstrument === 'drums') { playDrum(); return; }

  const osc = state.ctx.createOscillator();
  const gain = state.ctx.createGain();
  osc.type = {
    piano: 'sine', guitar:'sawtooth', synth:'square',
    bass:'triangle', strings:'sine'
  }[state.currentInstrument] || 'sine';
  osc.frequency.value = FREQUENCIES[note] || 440;
  osc.connect(gain); gain.connect(state.ctx.destination);
  gain.gain.setValueAtTime(state.volume, state.ctx.currentTime);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, state.ctx.currentTime+1);
  setTimeout(()=>{ osc.stop(); osc.disconnect(); }, 1000);
}

function playDrum(){
  const buf = state.ctx.createBuffer(1, state.ctx.sampleRate, state.ctx.sampleRate);
  const d = buf.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  const src = state.ctx.createBufferSource();
  const filt=state.ctx.createBiquadFilter();
  const gain=state.ctx.createGain();
  src.buffer=buf; filt.type='bandpass'; filt.frequency.value=200;
  gain.gain.value=state.volume;
  src.connect(filt); filt.connect(gain); gain.connect(state.ctx.destination);
  src.start(); gain.gain.exponentialRampToValueAtTime(0.001, state.ctx.currentTime+0.5);
  setTimeout(()=>{ src.stop(); src.disconnect(); }, 500);
}

function togglePlay(){
  state.isPlaying = !state.isPlaying;
  refs.playBtn.innerHTML = state.isPlaying
    ? '<i class="fas fa-pause"></i> Pause'
    : '<i class="fas fa-play"></i> Play';
  if(state.isPlaying) runBeatLoop();
  else cancelAnimationFrame(state.animationId);
}

function stopPlay(){
  state.isPlaying = false;
  refs.playBtn.innerHTML = '<i class="fas fa-play"></i> Play';
  cancelAnimationFrame(state.animationId);
  refs.beatCells.forEach(c=>c.classList.remove('highlight'));
}

function toggleRecord(){
  state.isRecording = !state.isRecording;
  refs.recordBtn.innerHTML = state.isRecording
    ? '<i class="fas fa-stop"></i> Stop Recording'
    : '<i class="fas fa-record-vinyl"></i> Record';
  refs.recIndicator.classList.toggle('active', state.isRecording);
}

function runBeatLoop(){
  const interval = 60000/state.tempo/4;
  let beat=0, last=0;
  function step(ts){
    if(!last) last = ts;
    if(ts - last >= interval){
      const prev = (beat+7)%8;
      refs.beatCells[prev].classList.remove('highlight');
      const cell = refs.beatCells[beat];
      cell.classList.add('highlight');
      if(cell.classList.contains('active')){
        if(cell.classList.contains('drum')) playDrum();
        else if(cell.classList.contains('snare')) playNote('D3');
        else if(cell.classList.contains('hihat')) playNote('F3');
        else playNote(['C3','E3','G3','A3'][Math.floor(Math.random()*4)]);
      }
      beat = (beat+1)%8;
      last = ts;
    }
    state.animationId = requestAnimationFrame(step);
  }
  state.animationId = requestAnimationFrame(step);
}

// ——— Visualizer ———
function animateVisualizer(){
  refs.visualizerBars.forEach(bar=>{
    bar.style.height = 20 + Math.random()*80 + 'px';
  });
  state.animationId = requestAnimationFrame(animateVisualizer);
}

// ——— Keyboard Handlers ———
function handleKeyDown(e){
  if(e.repeat) return;
  const note = keyMap[e.key];
  if(!note) return;
  const oct = note.charAt(note.length-1);
  if((state.octave==='lower'&&oct==='3')||(state.octave==='upper'&&oct==='4')){
    playNote(note);
  }
}

function handleKeyUp(e){
  const note = keyMap[e.key];
  if(!note) return;
  const el = document.querySelector(`[data-note="${note}"]`);
  if(el) el.classList.remove('playing');
}

// ——— Frequencies Lookup ———
const FREQUENCIES = {
  C3:130.81, 'C#3':138.59, D3:146.83, 'D#3':155.56, E3:164.81,
  F3:174.61, 'F#3':185.00, G3:196.00, 'G#3':207.65, A3:220.00,
  'A#3':233.08, B3:246.94, C4:261.63, 'C#4':277.18, D4:293.66,
  'D#4':311.13, E4:329.63, F4:349.23, 'F#4':369.99, G4:392.00,
  'G#4':415.30, A4:440.00, 'A#4':466.16, B4:493.88, C5:523.25
};

// ——— Utility ———
Array.prototype.random = function(){ return this[Math.floor(Math.random()*this.length)]; };

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { buildOpeningPrompt, buildActionPrompt } from './lib/gamePrompt';

export default function Home() {
  const [phase, setPhase] = useState('title');
  const [entries, setEntries] = useState([]);
  const [input, setInput] = useState('');
  const [tension, setTension] = useState(0);
  const [inventory, setInventory] = useState([]);
  const [turnNumber, setTurnNumber] = useState(0);
  const [ending, setEnding] = useState(null);
  const [hint, setHint] = useState('');
  const [isNarrating, setIsNarrating] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState([]);
  const [stats, setStats] = useState({ peakTension: 0, screamCount: 0, itemsFound: 0 });

  const messagesRef = useRef([]);
  const terminalRef = useRef(null);
  const inputRef = useRef(null);
  const narrationAudioRef = useRef(null);
  const ambientAudioRef = useRef(null);
  const heartbeatAudioRef = useRef(null);
  const ambientUrlRef = useRef(null);
  const narrationUrlRef = useRef(null);
  const heartbeatUrlRef = useRef(null);
  const hasStartedRef = useRef(false);
  const prevTensionRef = useRef(0);



  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [entries, typingText]);

  // Screen shake trigger
  useEffect(() => {
    const tensionJump = tension - prevTensionRef.current;
    if (tensionJump >= 2 && prevTensionRef.current > 0) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
    if (tension > stats.peakTension) {
      setStats(prev => ({ ...prev, peakTension: tension }));
    }
    prevTensionRef.current = tension;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tension]);

  // Heartbeat at high tension
  useEffect(() => {
    if (tension >= 7 && phase !== 'gameover') {
      playHeartbeat();
    } else {
      stopHeartbeat();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tension, phase]);

  async function playHeartbeat() {
    if (heartbeatUrlRef.current) return; // already playing
    try {
      const res = await fetch('/api/sound-effect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Human heartbeat sound getting faster, tense and anxious, close and intimate', duration: 15 }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      heartbeatUrlRef.current = url;
      const audio = heartbeatAudioRef.current;
      if (audio) {
        audio.src = url;
        audio.loop = true;
        audio.volume = 0.3;
        audio.load();
        audio.play().catch(() => {});
      }
    } catch { /* non-critical */ }
  }

  function stopHeartbeat() {
    const audio = heartbeatAudioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    if (heartbeatUrlRef.current) {
      URL.revokeObjectURL(heartbeatUrlRef.current);
      heartbeatUrlRef.current = null;
    }
  }

  const typeText = useCallback((text) => {
    return new Promise((resolve) => {
      setTypingText('');
      setTypingDone(false);
      let i = 0;
      const speed = 30;
      const interval = setInterval(() => {
        if (i < text.length) {
          setTypingText(text.slice(0, i + 1));
          
          i++;
        } else {
          clearInterval(interval);
          setTypingDone(true);
          resolve();
        }
      }, speed);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function callGameAI(messages) {
    const res = await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error('Game AI failed');
    return res.json();
  }

  async function playNarration(text) {
    try {
      setIsNarrating(true);
      const res = await fetch('/api/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      if (narrationUrlRef.current) URL.revokeObjectURL(narrationUrlRef.current);
      const url = URL.createObjectURL(blob);
      narrationUrlRef.current = url;
      const audio = narrationAudioRef.current;
      audio.src = url;
      audio.volume = 0.9;
      audio.load();
      return new Promise((resolve) => {
        audio.oncanplaythrough = () => { audio.play(); };
        audio.onended = () => { setIsNarrating(false); resolve(); };
        audio.onerror = () => { setIsNarrating(false); resolve(); };
      });
    } catch { setIsNarrating(false); }
  }

  async function playAmbient(soundPrompt) {
    try {
      const res = await fetch('/api/sound-effect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: soundPrompt, duration: 12 }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      if (ambientUrlRef.current) URL.revokeObjectURL(ambientUrlRef.current);
      const url = URL.createObjectURL(blob);
      ambientUrlRef.current = url;
      const audio = ambientAudioRef.current;
      audio.src = url;
      audio.volume = 0.25;
      audio.loop = true;
      audio.load();
      audio.play().catch(() => {});
    } catch { /* non-critical */ }
  }

  async function processGameResponse(gameData, playerAction) {
    const { narrative, soundPrompt, tension: newTension, inventory: newInventory, turnNumber: turn, gameOver, ending: gameEnding, hint: newHint, suggestedActions: newActions } = gameData;

    setTension(newTension);
    setInventory(newInventory || []);
    setTurnNumber(turn);
    setHint(newHint || '');
    setSuggestedActions(newActions || []);

    // Track stats
    if (playerAction) {
      const lower = playerAction.toLowerCase();
      if (lower.includes('scream') || lower.includes('yell') || lower.includes('shout')) {
        setStats(prev => ({ ...prev, screamCount: prev.screamCount + 1 }));
      }
    }
    if (newInventory && newInventory.length > stats.itemsFound) {
      setStats(prev => ({ ...prev, itemsFound: newInventory.length }));
    }

    playAmbient(soundPrompt);
    await typeText(narrative);
    setEntries((prev) => [...prev, { type: 'narration', text: narrative, tension: newTension }]);
    setTypingText('');
    setTypingDone(false);
    await playNarration(narrative);

    if (gameOver) {
      setEnding(gameEnding);
      setPhase('gameover');
      stopHeartbeat();
    } else {
      setPhase('idle');
      inputRef.current?.focus();
    }
  }

  async function startGame() {
    setPhase('loading');
    try {
      const openingMessage = { role: 'user', content: buildOpeningPrompt() };
      messagesRef.current = [openingMessage];
      const gameData = await callGameAI(messagesRef.current);
      messagesRef.current.push({ role: 'assistant', content: JSON.stringify(gameData) });
      await processGameResponse(gameData, null);
    } catch (err) {
      console.error('Failed to start game:', err);
      setEntries([{ type: 'narration', text: 'The forest refuses to reveal itself. Something went wrong. Refresh to try again.', tension: 0 }]);
      setPhase('idle');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const action = input.trim();
    if (!action || phase !== 'idle') return;
    setInput('');
    setPhase('loading');
    setEntries((prev) => [...prev, { type: 'action', text: action }]);
    try {
      const actionMessage = { role: 'user', content: buildActionPrompt(action, turnNumber + 1) };
      messagesRef.current.push(actionMessage);
      const gameData = await callGameAI(messagesRef.current);
      messagesRef.current.push({ role: 'assistant', content: JSON.stringify(gameData) });
      await processGameResponse(gameData, action);
    } catch (err) {
      console.error('Game error:', err);
      setEntries((prev) => [...prev, { type: 'narration', text: 'The forest shudders. Your action was lost to the void. Try again.', tension }]);
      setPhase('idle');
    }
  }

  function handleRestart() {
    setEntries([]);
    setInput('');
    setTension(0);
    setInventory([]);
    setTurnNumber(0);
    setEnding(null);
    setHint('');
    setTypingText('');
    setTypingDone(false);
    setStats({ peakTension: 0, screamCount: 0, itemsFound: 0 });
    setSuggestedActions([]);
    messagesRef.current = [];
    prevTensionRef.current = 0;
    stopHeartbeat();
    if (ambientAudioRef.current) { ambientAudioRef.current.pause(); ambientAudioRef.current.src = ''; }
    if (narrationAudioRef.current) { narrationAudioRef.current.pause(); narrationAudioRef.current.src = ''; }
    hasStartedRef.current = true;
    startGame();
  }

  function getVignetteClass() {
    if (tension <= 2) return 'vignette--low';
    if (tension <= 5) return 'vignette--medium';
    if (tension <= 8) return 'vignette--high';
    return 'vignette--critical';
  }

  function getTensionColor() {
    if (tension <= 2) return '#4a7a5a';
    if (tension <= 5) return '#b08830';
    if (tension <= 8) return '#a04030';
    return '#8b2020';
  }

  const isHighTension = tension >= 7;

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={narrationAudioRef} aria-hidden="true" />
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={ambientAudioRef} aria-hidden="true" />
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={heartbeatAudioRef} aria-hidden="true" />

      <div className="fog" />
      <div className={`vignette ${getVignetteClass()}`} />

      <main className={`relative z-10 flex min-h-screen flex-col ${isHighTension ? 'screen-flicker' : ''} ${shaking ? 'screen-shake' : ''}`}>

        {/* Title screen */}
        {phase === 'title' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
            <h2 className="text-5xl text-glow" style={{ fontFamily: 'var(--font-display)', color: '#4a7a5a', letterSpacing: '0.2em' }}>
              WHISPER WOODS
            </h2>
            <p className="text-lg text-center max-w-md opacity-50" style={{ color: '#c4c0b0' }}>
              A horror experience powered by AI. Every sound you hear is generated in real-time. Put on headphones.
            </p>
            <button
              onClick={() => { setPhase('loading'); hasStartedRef.current = true; startGame(); }}
              className="rounded-full px-10 py-4 text-lg uppercase tracking-widest transition hover:opacity-80"
              style={{ fontFamily: 'var(--font-display)', background: 'rgba(74, 122, 90, 0.15)', color: '#4a7a5a', border: '1px solid rgba(74, 122, 90, 0.3)' }}
            >
              Enter the Forest
            </button>
          </div>
        )}

        {/* Header bar */}
        {phase !== 'title' && (
          <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h1
              className={`text-xl tracking-widest uppercase ${isHighTension ? 'text-glow-red' : 'text-glow'}`}
              style={{ fontFamily: 'var(--font-display)', color: isHighTension ? '#8b2020' : '#4a7a5a' }}
            >
              Whisper Woods
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-widest opacity-40" style={{ color: getTensionColor() }}>Fear</span>
              <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div
                  className={`tension-bar h-full rounded-full ${isHighTension ? 'heartbeat-pulse' : ''}`}
                  style={{ width: (tension / 10) * 100 + '%', background: getTensionColor() }}
                />
              </div>
            </div>
          </header>
        )}

        {/* Game terminal */}
        {phase !== 'title' && (
          <div ref={terminalRef} className="flex-1 overflow-y-auto terminal-scroll px-6 py-6 space-y-4" style={{ maxHeight: 'calc(100vh - 160px)' }}>
            {entries.map((entry, idx) => (
              <div key={idx} className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                {entry.type === 'narration' ? (
                  <p
                    className={`text-lg leading-8 max-w-3xl ${entry.tension >= 7 ? 'glitch-text' : ''}`}
                    style={{ fontFamily: 'var(--font-body)', color: entry.tension >= 7 ? '#c4a0a0' : '#c4c0b0' }}
                  >
                    {entry.text}
                  </p>
                ) : (
                  <p style={{ fontFamily: 'var(--font-display)', color: '#4a7a5a' }}>
                    {'> '}{entry.text}
                  </p>
                )}
              </div>
            ))}

            {typingText && (
              <p
                className={`text-lg leading-8 max-w-3xl ${!typingDone ? 'cursor-blink' : ''} ${tension >= 7 ? 'glitch-text' : ''}`}
                style={{ fontFamily: 'var(--font-body)', color: tension >= 7 ? '#c4a0a0' : '#c4c0b0' }}
              >
                {typingText}
              </p>
            )}

            {phase === 'loading' && !typingText && (
              <div className="flex items-center gap-2 opacity-50">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: getTensionColor(), animation: 'pulse-red 1.5s ease-in-out infinite' }} />
                <span className="text-sm" style={{ fontFamily: 'var(--font-display)', color: getTensionColor() }}>The forest stirs...</span>
              </div>
            )}

            {/* Game over with stats */}
            {phase === 'gameover' && (
              <div className="game-over-overlay mt-8 text-center space-y-8">
                <h2
                  className="text-3xl tracking-widest uppercase"
                  style={{ fontFamily: 'var(--font-display)', color: ending === 'ESCAPE' ? '#4a7a5a' : ending === 'EMBRACE' ? '#b08830' : '#8b2020' }}
                >
                  {ending === 'ESCAPE' && '— You Escaped —'}
                  {ending === 'CONSUMED' && '— Consumed —'}
                  {ending === 'EMBRACE' && '— Embraced —'}
                </h2>
                <p className="text-sm opacity-40" style={{ color: '#c4c0b0' }}>
                  {ending === 'ESCAPE' && 'You found your way out. But the forest remembers your name.'}
                  {ending === 'CONSUMED' && 'The forest takes what it wants. You were never leaving.'}
                  {ending === 'EMBRACE' && 'You became part of the whisper. Neither lost nor found.'}
                </p>

                {/* Stats */}
                <div className="flex justify-center gap-8 flex-wrap mt-4">
                  <div className="stat-appear text-center" style={{ animationDelay: '0.3s' }}>
                    <p className="text-3xl font-bold" style={{ color: getTensionColor(), fontFamily: 'var(--font-display)' }}>{turnNumber}</p>
                    <p className="text-xs uppercase tracking-widest opacity-40 mt-1" style={{ color: '#c4c0b0' }}>Turns survived</p>
                  </div>
                  <div className="stat-appear text-center" style={{ animationDelay: '0.6s' }}>
                    <p className="text-3xl font-bold" style={{ color: '#8b2020', fontFamily: 'var(--font-display)' }}>{stats.peakTension}/10</p>
                    <p className="text-xs uppercase tracking-widest opacity-40 mt-1" style={{ color: '#c4c0b0' }}>Peak fear</p>
                  </div>
                  <div className="stat-appear text-center" style={{ animationDelay: '0.9s' }}>
                    <p className="text-3xl font-bold" style={{ color: '#4a7a5a', fontFamily: 'var(--font-display)' }}>{stats.itemsFound}</p>
                    <p className="text-xs uppercase tracking-widest opacity-40 mt-1" style={{ color: '#c4c0b0' }}>Items found</p>
                  </div>
                  <div className="stat-appear text-center" style={{ animationDelay: '1.2s' }}>
                    <p className="text-3xl font-bold" style={{ color: '#b08830', fontFamily: 'var(--font-display)' }}>{stats.screamCount}</p>
                    <p className="text-xs uppercase tracking-widest opacity-40 mt-1" style={{ color: '#c4c0b0' }}>Times screamed</p>
                  </div>
                </div>

                <button
                  onClick={handleRestart}
                  className="rounded-full px-8 py-3 text-sm uppercase tracking-widest transition hover:opacity-80 mt-4"
                  style={{ fontFamily: 'var(--font-display)', background: 'rgba(74, 122, 90, 0.15)', color: '#4a7a5a', border: '1px solid rgba(74, 122, 90, 0.3)' }}
                >
                  Enter the forest again
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bottom bar */}
        {phase !== 'gameover' && phase !== 'title' && (
          <footer className="border-t border-white/5 px-6 py-4 space-y-3">
            {inventory.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-widest opacity-30" style={{ color: '#4a7a5a' }}>Carrying:</span>
                {inventory.map((item, idx) => (
                  <span key={idx} className="inventory-item text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(74, 122, 90, 0.1)', color: '#4a7a5a', border: '1px solid rgba(74, 122, 90, 0.2)' }}>
                    {item}
                  </span>
                ))}
              </div>
            )}
            {hint && phase === 'idle' && (
              <p className="text-xs italic opacity-25" style={{ color: '#b08830' }}>{'💡 '}{hint}</p>
            )}
            {suggestedActions.length > 0 && phase === "idle" && (
              <div className="flex items-center gap-2 flex-wrap">
                {suggestedActions.map((action, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setInput(action); setSuggestedActions([]); setTimeout(() => { const form = document.querySelector("form"); if (form) form.requestSubmit(); }, 50); }}
                    className="text-xs px-3 py-1.5 rounded-full transition hover:opacity-80"
                    style={{ background: isHighTension ? "rgba(139, 32, 32, 0.15)" : "rgba(74, 122, 90, 0.15)", color: isHighTension ? "#c4a0a0" : "#4a7a5a", border: "1px solid " + (isHighTension ? "rgba(139, 32, 32, 0.25)" : "rgba(74, 122, 90, 0.25)"), fontFamily: "var(--font-display)" }}
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex items-center gap-3">
              <span style={{ fontFamily: 'var(--font-display)', color: isHighTension ? '#8b2020' : '#4a7a5a' }}>{'>'}</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={phase !== 'idle'}
                placeholder={phase === 'idle' ? 'What do you do?' : '...'}
                maxLength={200}
                autoComplete="off"
                className={`flex-1 bg-transparent text-lg px-2 py-2 input-horror ${isHighTension ? 'input-horror--danger' : ''}`}
                style={{ fontFamily: 'var(--font-body)', color: '#c4c0b0', border: 'none', borderBottom: '1px solid rgba(' + (isHighTension ? '139, 32, 32' : '74, 122, 90') + ', 0.2)' }}
              />
            </form>
          </footer>
        )}

        <div className="px-6 py-2 text-center">
          <p className="text-[10px] uppercase tracking-widest opacity-15" style={{ color: '#4a7a5a' }}>Built with Zed + ElevenLabs</p>
        </div>
      </main>
    </>
  );
}

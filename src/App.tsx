import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const DICTIONARY_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

// Strict Keywords for Classification
const HEAL_KEYWORDS = ['heal', 'cure', 'remedy', 'restore', 'recovery', 'health', 'medicine', 'nurse', 'doctor', 'treatment', 'physician', 'vitamin', 'hospital', 'tonic', 'therapy', 'aid', 'wellness'];
// Removed "stop" and "knock" to prevent accidental stuns for words like "kill"
const STUN_KEYWORDS = ['stun', 'paralyze', 'shock', 'freeze', 'electric', 'immobile', 'dizzy', 'bolt', 'halt', 'numb', 'glitch', 'static', 'lightning'];

const HINT_POOL = {
  attack: ['elephant', 'avalanche', 'skyscraper', 'keyboard', 'mountain', 'galaxy', 'knight', 'victory', 'champion', 'infiltrate', 'probability'],
  heal: ['remedy', 'restore', 'vitamin', 'medicine', 'doctor', 'wellness', 'tonic'],
  stun: ['freeze', 'static', 'lightning', 'paralyze', 'shock', 'dizzy']
};

interface LogEntry {
  id: number;
  text: string;
  type: 'player' | 'enemy' | 'system' | 'heal' | 'stun';
}

function App() {
  // Game State
  const [playerHP, setPlayerHP] = useState(100);
  const [monsterHP, setMonsterHP] = useState(1000);
  const [inputValue, setInputValue] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [battleLog, setBattleLog] = useState<LogEntry[]>([]);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [damageDisplay, setDamageDisplay] = useState<{val: string | number, type: 'damage' | 'heal' | 'stun'} | null>(null);
  const [monsterHit, setMonsterHit] = useState(false);
  const [isMonsterStunned, setIsMonsterStunned] = useState(false);
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [inputError, setInputError] = useState(false);
  const [wordUsage, setWordUsage] = useState<Record<string, number>>({});
  
  // Hint State
  const [showHint, setShowHint] = useState(false);
  const [activeHint, setActiveHint] = useState<string | null>(null);

  const stunnedRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    addLog('Battle Start! Words are limited resources!', 'system');
    addLog('Attack: 1 use | Heal/Stun: 3 uses', 'system');
  }, []);

  // Hint Timer Logic
  useEffect(() => {
    let internalIdle = 0;
    let interval: number | undefined;
    if (isPlayerTurn && gameStatus === 'playing') {
      interval = window.setInterval(() => {
        internalIdle++;
        if (internalIdle >= 8) {
          setShowHint(true);
        }
      }, 1000);
    }
    return () => {
      clearInterval(interval);
      internalIdle = 0;
      setShowHint(false);
    };
  }, [isPlayerTurn, gameStatus, inputValue]);

  // Handle Monster Turn via Effect
  useEffect(() => {
    if (!isPlayerTurn && gameStatus === 'playing') {
      const timer = setTimeout(() => {
        monsterAttack();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isPlayerTurn, gameStatus]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [battleLog]);

  const addLog = (text: string, type: 'player' | 'enemy' | 'system' | 'heal' | 'stun') => {
    setBattleLog(prev => [...prev, { id: Date.now(), text, type }]);
  };

  const classifyWord = (word: string, meaningsText: string) => {
    const wordLower = word.toLowerCase();
    
    // 1. Check Direct Keywords (Strict)
    if (STUN_KEYWORDS.includes(wordLower)) return 'stun';
    if (HEAL_KEYWORDS.includes(wordLower)) return 'heal';
    
    // 2. Semantic Search (Strict context)
    // We only trigger stun if the definition specifically mentions stunning/paralyzing
    const isStunSemantic = STUN_KEYWORDS.some(k => 
      meaningsText.includes(` ${k} `) || 
      meaningsText.includes(` ${k}.`) || 
      meaningsText.includes(` ${k},`)
    );
    if (isStunSemantic) return 'stun';

    const isHealSemantic = HEAL_KEYWORDS.some(k => 
      meaningsText.includes(` ${k} `) || 
      meaningsText.includes(` ${k}.`) || 
      meaningsText.includes(` ${k},`)
    );
    if (isHealSemantic) return 'heal';

    return 'attack';
  };

  const calculateAIDamage = (word: string) => {
    const len = word.length;
    const uniqueLetters = new Set(word.split('')).size;
    const rareLetters = (word.match(/[zqxjkvw]/gi) || []).length;
    
    // Complexity Heuristic
    if (len >= 10 || (len >= 8 && rareLetters >= 1)) {
      // Complex (e.g., infiltrate, synchronize)
      return Math.floor(Math.random() * 41) + 100; // 100 - 140
    } else if (len >= 6 || uniqueLetters >= 5) {
      // Mid-Complex (e.g., probability, mountain)
      return Math.floor(Math.random() * 21) + 60; // 60 - 80
    } else {
      // Simple (e.g., cat, kill, run)
      return Math.floor(Math.random() * 21) + 20; // 20 - 40
    }
  };

  const handleAttack = async () => {
    if (!isPlayerTurn || gameStatus !== 'playing' || isValidating) return;

    const word = inputValue.trim().toLowerCase();
    if (word.length < 2) {
      triggerError();
      return;
    }

    const currentUsage = wordUsage[word] || 0;
    setIsValidating(true);

    try {
      const response = await fetch(`${DICTIONARY_API_BASE}${word}`);
      
      if (!response.ok) {
        addLog(`"${word}" is not a valid word!`, 'system');
        triggerError();
        setIsValidating(false);
        return;
      }

      const data = await response.json();
      
      const meaningsText = data[0].meanings.map((m: any) => 
        m.definitions.map((d: any) => d.definition).join(' ')
      ).join(' ').toLowerCase();

      const type = classifyWord(word, meaningsText);
      const limit = type === 'attack' ? 1 : 3;

      if (currentUsage >= limit) {
        addLog(`"${word}" is exhausted! (Used ${currentUsage}/${limit})`, 'system');
        triggerError();
        setIsValidating(false);
        return;
      }

      const nextUsage = currentUsage + 1;
      let damage = 0;
      
      if (type === 'stun') {
        stunnedRef.current = true;
        setIsMonsterStunned(true);
        damage = Math.floor(Math.random() * 11) + 10; // Stun words: 10-20
        addLog(`STUNNED! "${word}" (${nextUsage}/3) used!`, 'stun');
        setDamageDisplay({ val: 'STUN!', type: 'stun' });
      } else if (type === 'heal') {
        damage = calculateAIDamage(word); // Heals also damage slightly
        const healAmount = Math.floor(damage / 2);
        setPlayerHP(prev => Math.min(100, prev + healAmount));
        addLog(`HEALED! "${word}" (${nextUsage}/3) used! +${healAmount} HP`, 'heal');
        setDamageDisplay({ val: healAmount, type: 'heal' });
      } else {
        damage = calculateAIDamage(word);
        addLog(`ATTACK! "${word}" (1/1) for ${damage} damage!`, 'player');
        setDamageDisplay({ val: damage, type: 'damage' });
      }

      setWordUsage(prev => ({ ...prev, [word]: nextUsage }));
      setMonsterHP(prev => {
        const newVal = Math.max(0, prev - damage);
        if (newVal <= 0) setGameStatus('won');
        return newVal;
      });
      
      setMonsterHit(true);
      setInputValue('');
      setIsPlayerTurn(false);

      setTimeout(() => {
        setMonsterHit(false);
        setDamageDisplay(null);
      }, 800);

    } catch (error) {
      addLog('Dictionary connection error. Try again!', 'system');
    } finally {
      setIsValidating(false);
    }
  };

  const monsterAttack = () => {
    if (gameStatus !== 'playing') return;

    if (stunnedRef.current) {
      addLog('Monster is stunned and skips its turn!', 'system');
      stunnedRef.current = false;
      setIsMonsterStunned(false);
      setIsPlayerTurn(true);
      return;
    }

    const damage = Math.floor(Math.random() * 15) + 5;
    setPlayerHP(prev => {
      const newVal = Math.max(0, prev - damage);
      if (newVal <= 0) {
        setGameStatus('lost');
        addLog('You were defeated...', 'system');
      }
      return newVal;
    });
    addLog(`Monster attacks for ${damage} damage!`, 'enemy');
    setIsPlayerTurn(true);
  };

  const triggerError = () => {
    setInputError(true);
    setTimeout(() => setInputError(false), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAttack();
  };

  const generateHint = () => {
    const categories = ['attack', 'heal', 'stun'] as const;
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const word = HINT_POOL[cat][Math.floor(Math.random() * HINT_POOL[cat].length)];
    setActiveHint(`Try: "${word}" (${cat})`);
    setTimeout(() => setActiveHint(null), 4000);
  };

  return (
    <div className="game-container">
      {/* Header */}
      <div className="header">
        <div className="stat-box">
          <div className="stat-label">Player</div>
          <div className="hp-bar-container">
            <div className="hp-bar-fill" style={{ width: `${playerHP}%`, backgroundColor: '#4caf50' }}></div>
          </div>
          <div className="stat-value">{playerHP}/100</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Syntax Error</div>
          <div className="hp-bar-container">
            <div className="hp-bar-fill" style={{ width: `${(monsterHP / 1000) * 100}%`, backgroundColor: '#ff5555' }}></div>
          </div>
          <div className="stat-value">{monsterHP} HP</div>
        </div>
      </div>

      {/* Battle Area */}
      <div className="battle-area">
        {showHint && (
          <button className="hint-btn" onClick={generateHint}>
            💡 HINT
          </button>
        )}
        {activeHint && (
          <div className="hint-display">{activeHint}</div>
        )}

        {damageDisplay && (
          <div className={`damage-text ${damageDisplay.type}`}>
            {damageDisplay.type === 'heal' ? `+${damageDisplay.val}` : 
             damageDisplay.type === 'stun' ? damageDisplay.val : `-${damageDisplay.val}`}
          </div>
        )}
        <div className={`monster ${monsterHit ? 'hit' : ''} ${isMonsterStunned ? 'stunned' : ''}`}>
          {gameStatus !== 'playing' ? (gameStatus === 'won' ? '💀' : '😈') : (isMonsterStunned ? '😵‍💫' : '👾')}
        </div>
        {gameStatus !== 'playing' && (
          <div style={{marginTop: 20, fontSize: '2rem', fontWeight: 'bold', color: gameStatus === 'won' ? '#4caf50' : '#ff5555'}}>
            {gameStatus === 'won' ? 'VICTORY!' : 'GAME OVER'}
          </div>
        )}
      </div>

      {/* Log */}
      <div className="log">
        {battleLog.map(entry => (
          <div key={entry.id} className={`log-entry ${entry.type}`}>
            {entry.type === 'player' ? '> ' : entry.type === 'heal' ? '✨ ' : entry.type === 'stun' ? '⚡ ' : ''}{entry.text}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      {/* Controls */}
      <div className="controls">
        <input
          type="text"
          className={`word-input ${inputError ? 'error' : ''}`}
          placeholder={isValidating ? "Validating..." : "Type a word..."}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isPlayerTurn || isValidating || gameStatus !== 'playing'}
          autoFocus
        />
        {gameStatus === 'playing' ? (
          <button 
            className="attack-btn" 
            onClick={handleAttack}
            disabled={!isPlayerTurn || isValidating}
          >
            {isValidating ? '...' : 'ATTACK'}
          </button>
        ) : (
          <button 
            className="attack-btn" 
            onClick={() => window.location.reload()}
            style={{background: '#4caf50'}}
          >
            PLAY AGAIN
          </button>
        )}
      </div>
    </div>
  );
}

export default App;

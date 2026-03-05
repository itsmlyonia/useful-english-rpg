import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const DICTIONARY_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

const HEAL_KEYWORDS = ['heal', 'cure', 'remedy', 'restore', 'recovery', 'health', 'medicine', 'nurse', 'doctor', 'treatment', 'physician', 'vitamin'];
const STUN_KEYWORDS = ['stun', 'paralyze', 'shock', 'freeze', 'stop', 'electric', 'heavy', 'knock', 'static', 'lightning', 'immobile', 'dizzy', 'sleep'];

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

  const stunnedRef = useRef(false); // Ref for logic to avoid stale closure
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    addLog('Battle Start! Words are limited resources!', 'system');
    addLog('Attack: 1 use | Heal/Stun: 3 uses', 'system');
  }, []);

  // Handle Monster Turn via Effect to ensure fresh state access
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

  const handleAttack = async () => {
    if (!isPlayerTurn || gameStatus !== 'playing' || isValidating) return;

    const word = inputValue.trim().toLowerCase();
    if (word.length < 2) {
      triggerError();
      return;
    }

    // Check Usage Limit (Preliminary)
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
      
      // AI Logic: Precise Semantic Classification
      const meaningsText = data[0].meanings.map((m: any) => 
        m.definitions.map((d: any) => d.definition).join(' ')
      ).join(' ').toLowerCase();

      const isHealingWord = HEAL_KEYWORDS.some(k => word === k) || 
                          (HEAL_KEYWORDS.some(k => meaningsText.includes(` ${k} `) || meaningsText.includes(`${k} `)));
      
      const isStunWord = STUN_KEYWORDS.some(k => word === k) || 
                        (STUN_KEYWORDS.some(k => meaningsText.includes(` ${k} `) || meaningsText.includes(`${k} `)));
      
      const isSpecial = isHealingWord || isStunWord;
      const limit = isSpecial ? 3 : 1;

      // Strict Usage Check
      if (currentUsage >= limit) {
        addLog(`"${word}" is exhausted! (Used ${currentUsage}/${limit})`, 'system');
        triggerError();
        setIsValidating(false);
        return;
      }

      // Calculate Damage
      let damage = word.length * 8;
      if (word.length > 6) damage += 15;
      if (word.length > 10) damage += 30;

      // Unique letter bonus
      const uniqueLetters = new Set(word.split('')).size;
      if (uniqueLetters > 7) damage = Math.floor(damage * 1.4);

      // Apply Mechanics and Log Usage
      const nextUsage = currentUsage + 1;
      
      if (isStunWord) {
        stunnedRef.current = true; // Set Ref immediately
        setIsMonsterStunned(true); // Set state for UI
        addLog(`STUNNED! "${word}" (${nextUsage}/3) used!`, 'stun');
        setDamageDisplay({ val: 'STUN!', type: 'stun' });
      } else if (isHealingWord) {
        const healAmount = word.length * 3;
        setPlayerHP(prev => Math.min(100, prev + healAmount));
        addLog(`HEALED! "${word}" (${nextUsage}/3) used!`, 'heal');
        setDamageDisplay({ val: healAmount, type: 'heal' });
      } else {
        addLog(`ATTACK! "${word}" (1/1) for ${damage} damage!`, 'player');
        setDamageDisplay({ val: damage, type: 'damage' });
      }

      // Record Usage
      setWordUsage(prev => ({ ...prev, [word]: nextUsage }));

      // Apply Damage to Monster
      setMonsterHP(prev => {
        const newVal = Math.max(0, prev - damage);
        if (newVal <= 0) setGameStatus('won');
        return newVal;
      });
      setMonsterHit(true);
      
      setInputValue('');
      setIsPlayerTurn(false);

      // Reset visuals
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

    // Check the Ref for reliable stun status
    if (stunnedRef.current) {
      addLog('Monster is stunned and skips its turn!', 'system');
      stunnedRef.current = false; // Reset Ref
      setIsMonsterStunned(false); // Reset State
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
            {entry.type === 'player' ? '> ' : entry.type === 'heal' ? '✨ ' : ''}{entry.text}
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

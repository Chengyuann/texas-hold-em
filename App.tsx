import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Player, Card, GameState, GameStage, PlayerStatus, ScreenView
} from './types';
import { createDeck, INITIAL_CHIPS, SMALL_BLIND, BIG_BLIND, AVATARS, BOT_NAMES } from './constants';
import { evaluateHand } from './services/pokerLogic';
import { getBotDecision, getHandAnalysis } from './services/geminiService';
import PlayerSeat from './components/PlayerSeat';
import CardDisplay from './components/CardDisplay';
import ChipDisplay from './components/ChipDisplay';
import GameLog from './components/GameLog';

const App: React.FC = () => {
  // --- View State ---
  const [screen, setScreen] = useState<ScreenView>('LOBBY');
  const [roomCode, setRoomCode] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const [tournamentWinner, setTournamentWinner] = useState<Player | null>(null);

  // --- Game State ---
  const [gameState, setGameState] = useState<GameState>({
    stage: GameStage.IDLE,
    pot: 0,
    currentBet: 0,
    minRaise: BIG_BLIND, // Min increment
    deck: [],
    communityCards: [],
    players: [],
    currentPlayerIndex: -1,
    dealerIndex: 0,
    winners: [],
    logs: [],
  });

  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const [showRaiseControl, setShowRaiseControl] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);

  const turnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Helper Methods ---
  const addLog = (msg: string) => {
    setGameState(prev => ({ ...prev, logs: [...prev.logs, msg] }));
  };

  const getActivePlayers = (players: Player[]) => players.filter(p => p.status !== PlayerStatus.FOLDED && p.status !== PlayerStatus.BUSTED);

  // --- Lobby & URL Logic ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setInputRoomCode(roomParam);
    }
  }, []);

  const handleCreateRoom = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
    setScreen('GAME_ONLINE'); 
    initializeGame(true); 
  };

  const handleJoinRoom = () => {
    if (!inputRoomCode) return;
    setRoomCode(inputRoomCode);
    setScreen('GAME_ONLINE'); 
    initializeGame(false); 
  };

  const handleStartSolo = () => {
    setScreen('GAME_OFFLINE');
    initializeGame(true);
  };

  const handleShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
        setCopySuccess('链接已复制！');
        setTimeout(() => setCopySuccess(''), 2000);
    });
  };

  // --- Game Loop Actions ---

  const initializeGame = (isHost: boolean) => {
    let initialPlayers: Player[] = [];
    const TOTAL_PLAYERS = 6; 
    setTournamentWinner(null);
    
    // Human
    const human: Player = {
      id: 'p1', name: '玩家 (You)', chips: INITIAL_CHIPS, hand: [], 
      status: PlayerStatus.ACTIVE, currentBet: 0, isHuman: true, isDealer: false, avatar: AVATARS[0]
    };
    initialPlayers.push(human);

    // Bots
    for (let i = 1; i < TOTAL_PLAYERS; i++) {
        let botName = '';
        if (screen === 'GAME_OFFLINE') {
            botName = BOT_NAMES[i - 1] || `Bot ${i}`;
        } else {
             botName = isHost ? BOT_NAMES[i-1] : (i === 1 ? 'Host' : `Player ${Math.floor(Math.random()*999)}`);
        }
        
        initialPlayers.push({
            id: `b${i}`,
            name: botName,
            chips: INITIAL_CHIPS,
            hand: [],
            status: PlayerStatus.ACTIVE,
            currentBet: 0,
            isHuman: false,
            isDealer: false,
            avatar: AVATARS[i % AVATARS.length]
        });
    }
    
    setGameState(prev => ({
      ...prev,
      stage: GameStage.IDLE,
      players: initialPlayers,
      deck: createDeck(),
      communityCards: [],
      pot: 0,
      logs: ['锦标赛开始！最后幸存者获胜。'],
      winners: [],
      dealerIndex: 0
    }));
    setAiAdvice("");
  };

  const getSeatStyle = (index: number, totalPlayers: number): React.CSSProperties => {
    const CX = 50; 
    const CY = 50;
    const RX = 42; 
    const RY = 42; 
    const angleStep = (2 * Math.PI) / totalPlayers;
    const angle = (Math.PI / 2) + (index * angleStep);
    const left = CX + RX * Math.cos(angle);
    const top = CY + RY * Math.sin(angle);
    return { left: `${left}%`, top: `${top}%` };
  };

  const startRound = () => {
    let currentPlayers = [...gameState.players];
    
    // 1. Mark Busted Players & Check for Winner
    currentPlayers = currentPlayers.map(p => {
        // If chips are 0 or less, they are busted
        if (p.chips <= 0) {
            return { ...p, status: PlayerStatus.BUSTED, currentBet: 0, hand: [], isDealer: false };
        }
        return p;
    });

    const survivors = currentPlayers.filter(p => p.status !== PlayerStatus.BUSTED);
    
    if (survivors.length <= 1) {
        if (survivors.length === 1) {
             setTournamentWinner(survivors[0]);
             addLog(`锦标赛结束！赢家是 ${survivors[0].name}`);
        } else {
            // Everyone busted (rare side pot case?), just reset
            addLog("平局！重新开始。");
            initializeGame(screen === 'GAME_OFFLINE');
        }
        setGameState(prev => ({ 
            ...prev, 
            players: currentPlayers, 
            stage: GameStage.IDLE,
        }));
        return;
    }

    const deck = createDeck();
    
    // Reset state for new round (keep chips and dealer pos)
    currentPlayers = currentPlayers.map(p => ({
      ...p, 
      hand: [], 
      // Only reset status if they aren't busted
      status: p.status === PlayerStatus.BUSTED ? PlayerStatus.BUSTED : PlayerStatus.ACTIVE,
      currentBet: 0,
      lastAction: undefined,
      isDealer: false
    }));

    // Deal Cards
    currentPlayers.forEach(p => {
      if (p.status === PlayerStatus.ACTIVE) {
        p.hand = [deck.pop()!, deck.pop()!];
      }
    });

    // --- Dealer Rotation ---
    // Move dealer button to next ACTIVE player (skipping BUSTED)
    let nextDealerIdx = (gameState.dealerIndex + 1) % currentPlayers.length;
    while(currentPlayers[nextDealerIdx].status === PlayerStatus.BUSTED) {
        nextDealerIdx = (nextDealerIdx + 1) % currentPlayers.length;
    }
    
    // Set Dealer
    currentPlayers[nextDealerIdx].isDealer = true;

    // --- Blinds ---
    // SB is next active player after Dealer
    let sbIdx = (nextDealerIdx + 1) % currentPlayers.length;
    while(currentPlayers[sbIdx].status === PlayerStatus.BUSTED) sbIdx = (sbIdx + 1) % currentPlayers.length;

    // BB is next active player after SB
    let bbIdx = (sbIdx + 1) % currentPlayers.length;
    while(currentPlayers[bbIdx].status === PlayerStatus.BUSTED) bbIdx = (bbIdx + 1) % currentPlayers.length;
    
    // UTG is next active after BB
    let utgIdx = (bbIdx + 1) % currentPlayers.length;
    while(currentPlayers[utgIdx].status === PlayerStatus.BUSTED) utgIdx = (utgIdx + 1) % currentPlayers.length;

    // Heads up special rule: Dealer posts SB, Other posts BB
    if (survivors.length === 2) {
        sbIdx = nextDealerIdx; // Dealer is SB
        bbIdx = (nextDealerIdx + 1) % currentPlayers.length;
        while(currentPlayers[bbIdx].status === PlayerStatus.BUSTED) bbIdx = (bbIdx + 1) % currentPlayers.length;
        utgIdx = sbIdx; // Dealer/SB acts first preflop in Heads Up
    }

    let pot = 0;
    
    // Post Blinds
    const sbPlayer = currentPlayers[sbIdx];
    const bbPlayer = currentPlayers[bbIdx];
    
    const sbAmount = Math.min(sbPlayer.chips, SMALL_BLIND);
    sbPlayer.chips -= sbAmount;
    sbPlayer.currentBet = sbAmount;
    pot += sbAmount;
    addLog(`${sbPlayer.name} 小盲注 $${sbAmount}`);

    const bbAmount = Math.min(bbPlayer.chips, BIG_BLIND);
    bbPlayer.chips -= bbAmount;
    bbPlayer.currentBet = bbAmount;
    pot += bbAmount;
    addLog(`${bbPlayer.name} 大盲注 $${bbAmount}`);

    setGameState({
      ...gameState,
      stage: GameStage.PREFLOP,
      deck,
      players: currentPlayers,
      pot,
      currentBet: BIG_BLIND,
      minRaise: BIG_BLIND, 
      communityCards: [],
      currentPlayerIndex: utgIdx,
      winners: [],
      dealerIndex: nextDealerIdx 
    });
    setAiAdvice("");
  };

  const nextStage = () => {
    const { stage, deck, communityCards } = gameState;
    let nextStage = stage;
    const newCommunityCards = [...communityCards];
    const newDeck = [...deck];

    const playersResetBets = gameState.players.map(p => ({...p, currentBet: 0, lastAction: undefined }));

    if (stage === GameStage.PREFLOP) {
      nextStage = GameStage.FLOP;
      newDeck.pop();
      newCommunityCards.push(newDeck.pop()!, newDeck.pop()!, newDeck.pop()!);
    } else if (stage === GameStage.FLOP) {
      nextStage = GameStage.TURN;
      newDeck.pop();
      newCommunityCards.push(newDeck.pop()!);
    } else if (stage === GameStage.TURN) {
      nextStage = GameStage.RIVER;
      newDeck.pop();
      newCommunityCards.push(newDeck.pop()!);
    } else if (stage === GameStage.RIVER) {
      determineWinner(playersResetBets, newCommunityCards, gameState.pot);
      return; 
    }

    // Find first active player after Dealer
    const dealerIdx = gameState.dealerIndex;
    let firstActorIdx = (dealerIdx + 1) % gameState.players.length;
    let loopCount = 0;
    while (
        (playersResetBets[firstActorIdx].status !== PlayerStatus.ACTIVE) // Skip Folded, Busted, All-in (All-in doesn't act)
         && loopCount < playersResetBets.length
    ) {
        firstActorIdx = (firstActorIdx + 1) % gameState.players.length;
        loopCount++;
    }

    setGameState(prev => ({
      ...prev,
      stage: nextStage,
      deck: newDeck,
      communityCards: newCommunityCards,
      players: playersResetBets,
      currentBet: 0,
      minRaise: BIG_BLIND, 
      currentPlayerIndex: firstActorIdx
    }));
    addLog(`--- ${nextStage} ---`);
  };

  const determineWinner = (players: Player[], community: Card[], pot: number) => {
    const activePlayers = players.filter(p => p.status !== PlayerStatus.FOLDED && p.status !== PlayerStatus.BUSTED);
    
    const results = activePlayers.map(p => {
      const evalResult = evaluateHand(p.hand, community);
      return { player: p, score: evalResult.score, handName: evalResult.name };
    });

    results.sort((a, b) => b.score - a.score);

    const maxScore = results[0].score;
    const winners = results.filter(r => r.score === maxScore);
    const winAmount = Math.floor(pot / winners.length);
    
    const updatedPlayers = players.map(p => {
      const isWinner = winners.find(w => w.player.id === p.id);
      if (isWinner) {
        return { ...p, chips: p.chips + winAmount, status: PlayerStatus.SHOWDOWN };
      }
      return { ...p, status: PlayerStatus.SHOWDOWN };
    });

    const winnerData = winners.map(w => ({ 
      playerId: w.player.id, 
      handName: w.handName, 
      amount: winAmount 
    }));

    addLog(`赢家: ${winners.map(w => w.player.name).join(', ')} (${winners[0].handName})`);

    setGameState(prev => ({
      ...prev,
      stage: GameStage.SHOWDOWN,
      players: updatedPlayers,
      winners: winnerData,
      pot: 0,
      currentPlayerIndex: -1
    }));
  };

  // --- Core Game Logic ---
  
  const handleAction = async (action: 'CHECK' | 'CALL' | 'FOLD' | 'RAISE', amount?: number) => {
    if (isProcessingTurn) return; 
    
    setShowRaiseControl(false);

    const { players, currentPlayerIndex, currentBet, pot, minRaise } = gameState;
    const player = players[currentPlayerIndex];
    let newPlayers = [...players];
    let newPot = pot;
    let newCurrentBet = currentBet;
    let newMinRaise = minRaise;
    let actionLog = '';

    if (action === 'FOLD') {
      newPlayers[currentPlayerIndex] = { ...player, status: PlayerStatus.FOLDED, lastAction: 'FOLD' };
      actionLog = `${player.name} 弃牌`;
    } 
    else if (action === 'CHECK') {
       newPlayers[currentPlayerIndex] = { ...player, lastAction: 'CHECK' };
       actionLog = `${player.name} 过牌`;
    } 
    else if (action === 'CALL') {
      const toCall = currentBet - player.currentBet;
      const contribution = Math.min(toCall, player.chips);
      const isAllIn = contribution >= player.chips;
      
      newPlayers[currentPlayerIndex] = {
        ...player,
        chips: player.chips - contribution,
        currentBet: player.currentBet + contribution,
        status: isAllIn ? PlayerStatus.ALL_IN : PlayerStatus.ACTIVE,
        lastAction: isAllIn ? 'ALL IN' : 'CALL'
      };
      newPot += contribution;
      actionLog = `${player.name} 跟注 ${contribution}`;
    } 
    else if (action === 'RAISE') {
      let totalBetAmount = amount || (currentBet + minRaise);
      if (totalBetAmount > player.chips + player.currentBet) {
          totalBetAmount = player.chips + player.currentBet;
      }
      
      const contribution = totalBetAmount - player.currentBet;
      const isAllIn = totalBetAmount >= (player.chips + player.currentBet);
      const raiseIncrement = totalBetAmount - currentBet;
      
      if (raiseIncrement >= minRaise) {
          newMinRaise = raiseIncrement;
      }

      newPlayers[currentPlayerIndex] = {
        ...player,
        chips: player.chips - contribution,
        currentBet: totalBetAmount,
        status: isAllIn ? PlayerStatus.ALL_IN : PlayerStatus.ACTIVE,
        lastAction: isAllIn ? `ALL IN ${totalBetAmount}` : `RAISE ${totalBetAmount}`
      };
      
      newPot += contribution;
      if (totalBetAmount > newCurrentBet) newCurrentBet = totalBetAmount;
      actionLog = `${player.name} ${isAllIn ? '全压' : '加注'} 至 ${totalBetAmount}`;
    }

    addLog(actionLog);

    // --- Find Next Player ---
    let nextIndex = (currentPlayerIndex + 1) % players.length;
    let attempts = 0;
    while (
        (newPlayers[nextIndex].status === PlayerStatus.FOLDED || newPlayers[nextIndex].status === PlayerStatus.BUSTED || newPlayers[nextIndex].status === PlayerStatus.ALL_IN) 
        && attempts < players.length
    ) {
      nextIndex = (nextIndex + 1) % players.length;
      attempts++;
    }

    const activeStats = newPlayers.filter(p => p.status !== PlayerStatus.FOLDED && p.status !== PlayerStatus.BUSTED);
    const notAllIn = activeStats.filter(p => p.status !== PlayerStatus.ALL_IN);

    // 1. Everyone folded except one
    if (activeStats.length === 1) {
       const winner = activeStats[0];
       addLog(`${winner.name} 获胜 (对手弃牌)`);
       setGameState(prev => ({
           ...prev,
           players: newPlayers.map(p => p.id === winner.id ? {...p, chips: p.chips + newPot} : p),
           stage: GameStage.SHOWDOWN,
           currentPlayerIndex: -1,
           pot: 0,
           currentBet: 0,
           minRaise: BIG_BLIND,
           winners: [{playerId: winner.id, handName: '对手弃牌', amount: newPot}]
       }));
       return;
    }

    // 2. Check betting matches
    const allMatched = notAllIn.every(p => p.currentBet === newCurrentBet);
    const isShowdownBound = notAllIn.length === 0 || (notAllIn.length === 1 && activeStats.length > 1 && allMatched);
    
    setGameState(prev => ({
        ...prev,
        players: newPlayers,
        pot: newPot,
        currentBet: newCurrentBet,
        minRaise: newMinRaise,
        currentPlayerIndex: nextIndex
    }));
    
    if (allMatched && (activeStats.length > 1 || isShowdownBound)) {
        const nextPlayerObj = newPlayers[nextIndex];
        const isPreflopBBCheck = gameState.stage === GameStage.PREFLOP && nextPlayerObj.currentBet === BIG_BLIND && !nextPlayerObj.lastAction && newCurrentBet === BIG_BLIND;

        if (nextPlayerObj.currentBet === newCurrentBet && !isPreflopBBCheck) {
             setTimeout(() => {
                nextStage();
             }, 800);
        }
    }
  };

  // --- AI Turn Logic ---
  useEffect(() => {
    if (gameState.currentPlayerIndex === -1) return;
    if (gameState.stage === GameStage.SHOWDOWN || gameState.stage === GameStage.IDLE) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    // Human Advice
    if (currentPlayer.isHuman && !aiAdvice && gameState.stage !== GameStage.PREFLOP) {
       getHandAnalysis(currentPlayer.hand, gameState.communityCards, gameState.pot)
         .then(setAiAdvice);
    }

    // Bot Action
    if (!currentPlayer.isHuman) {
      setIsProcessingTurn(true);
      const activeCount = gameState.players.filter(p => p.status !== PlayerStatus.FOLDED && p.status !== PlayerStatus.BUSTED).length;

      // Get Dynamic Decision
      getBotDecision(
          currentPlayer,
          gameState.communityCards,
          gameState.pot,
          gameState.currentBet,
          gameState.minRaise,
          gameState.stage,
          activeCount
      ).then((decision) => {
          turnTimeoutRef.current = setTimeout(() => {
            addLog(`${currentPlayer.name}: ${decision.reasoning}`);
            handleAction(decision.action, decision.amount);
            setIsProcessingTurn(false);
          }, decision.thinkingTime);
      });
    }

    return () => {
        if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
    };
  }, [gameState.currentPlayerIndex, gameState.stage, gameState.currentBet, gameState.pot]);


  // --- UI Components ---

  const renderLobby = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a] z-50 animate-[fade-in_0.5s]">
      <div className="text-6xl font-black text-yellow-500 mb-2 tracking-tighter drop-shadow-lg">TEXAS HOLD'EM</div>
      <div className="text-xl text-gray-400 mb-12 tracking-widest uppercase">Premium Edition</div>

      <div className="flex flex-col space-y-4 w-64">
        <button 
          onClick={handleStartSolo}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-105"
        >
          单人游戏 (Solo)
        </button>
        <button 
          onClick={() => { setInputRoomCode(Math.random().toString().slice(2,8)); setScreen('GAME_ONLINE'); handleCreateRoom(); }}
          className="bg-green-700 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-105"
        >
          创建房间 (Host)
        </button>
        <div className="flex space-x-2">
           <input 
              type="text" 
              placeholder="房间号"
              value={inputRoomCode}
              onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
              className="bg-gray-800 border border-gray-600 text-white px-3 rounded-lg w-full text-center tracking-widest font-mono"
           />
           <button 
             onClick={handleJoinRoom}
             className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg"
           >
             加入
           </button>
        </div>
      </div>
    </div>
  );

  const renderRaiseControl = (player: Player) => {
      const minBet = gameState.currentBet + gameState.minRaise;
      const maxBet = player.chips + player.currentBet;
      const step = BIG_BLIND;
      const sliderMin = minBet;
      const sliderMax = maxBet;

      return (
        <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 bg-gray-900/95 p-6 rounded-2xl border border-yellow-500/50 shadow-2xl flex flex-col items-center w-80 backdrop-blur-xl z-40 animate-[slide-up_0.2s]">
             <div className="text-yellow-400 font-bold mb-4 text-xl">
                 加注至: <span className="font-mono text-white">${raiseAmount}</span>
             </div>
             <input 
                type="range" 
                min={sliderMin} 
                max={sliderMax} 
                step={step}
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mb-6 accent-yellow-500"
             />
             <div className="flex space-x-4 w-full">
                 <button 
                    onClick={() => setShowRaiseControl(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg font-bold"
                 >
                     取消
                 </button>
                 <button 
                    onClick={() => handleAction('RAISE', raiseAmount)}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black py-2 rounded-lg font-black"
                 >
                     确认 (${raiseAmount})
                 </button>
             </div>
             {raiseAmount >= maxBet && (
                 <div className="mt-2 text-red-500 font-bold animate-pulse text-sm">ALL IN!</div>
             )}
        </div>
      );
  };

  const humanPlayer = gameState.players.find(p => p.isHuman);
  const winnerInfo = gameState.winners.length > 0 ? gameState.winners[0] : null;

  if (screen === 'LOBBY') return renderLobby();

  // --- Tournament End Screen ---
  if (tournamentWinner && gameState.stage === GameStage.IDLE) {
      return (
          <div className="relative w-full h-full felt-bg flex flex-col items-center justify-center z-50">
               <div className="text-6xl text-yellow-400 font-black mb-4 drop-shadow-xl animate-bounce">
                   👑 冠军诞生 👑
               </div>
               <div className="relative w-40 h-40 mb-6">
                   <img src={tournamentWinner.avatar} className="w-full h-full rounded-full border-4 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.6)]" />
               </div>
               <div className="text-3xl text-white font-bold mb-8">{tournamentWinner.name}</div>
               <div className="text-xl text-gray-300 mb-12">赢取所有筹码！</div>
               <button 
                 onClick={() => setScreen('LOBBY')}
                 className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-full text-xl shadow-lg"
               >
                   回到大厅
               </button>
          </div>
      );
  }

  return (
    <div className="relative w-full h-full felt-bg overflow-hidden flex flex-col items-center justify-center">
      
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.6)_100%)]"></div>

      {/* Room Info */}
      {screen === 'GAME_ONLINE' && (
          <div className="absolute top-4 left-4 z-40">
              <div 
                onClick={handleShareLink}
                className="bg-black/60 hover:bg-black/80 cursor-pointer px-4 py-2 rounded-lg border border-yellow-500/30 backdrop-blur transition-all active:scale-95"
              >
                  <span className="text-gray-400 text-xs uppercase block">Room Code</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-mono font-bold text-lg tracking-widest">{roomCode}</span>
                    <span className="text-yellow-500 text-sm">📋</span>
                  </div>
              </div>
              {copySuccess && <div className="text-green-400 text-xs mt-1 animate-pulse font-bold">{copySuccess}</div>}
          </div>
      )}

      {/* Back to Lobby */}
      <button 
        onClick={() => setScreen('LOBBY')}
        className="absolute top-4 right-4 bg-red-900/50 hover:bg-red-900 text-white text-xs px-3 py-1 rounded border border-red-500/30 z-40"
      >
        EXIT
      </button>

      {/* Header Info */}
      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-black/60 px-8 py-3 rounded-full border border-yellow-600/30 flex items-center space-x-8 z-20 backdrop-blur-md shadow-2xl">
        <div className="flex flex-col items-center">
            <span className="text-yellow-500 text-sm font-bold uppercase tracking-widest">底池 (Pot)</span>
            <ChipDisplay amount={gameState.pot} />
        </div>
        <div className="h-10 w-px bg-gray-600"></div>
        <div className="flex flex-col items-center">
            <span className="text-blue-400 text-sm font-bold uppercase tracking-widest">盲注 (Blind)</span>
            <span className="text-white font-mono text-xl">{SMALL_BLIND}/{BIG_BLIND}</span>
        </div>
      </div>

      {/* Table */}
      <div className="relative w-[95vw] h-[65vh] md:w-[900px] md:h-[550px] border-[20px] border-[#3e2723] rounded-[250px] bg-[#35654d] shadow-2xl flex items-center justify-center mb-10">
        <div className="absolute inset-0 rounded-[230px] border-[2px] border-yellow-600/20 pointer-events-none m-4"></div>
        
        {/* Community Cards */}
        <div className="flex space-x-3 z-10 min-h-[140px] transform md:scale-110">
          {gameState.communityCards.map((card, idx) => (
             <div key={card.id} className="animate-[fade-in_0.5s_ease-out]">
                <CardDisplay card={card} large className="card-shadow" />
             </div>
          ))}
          {Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
              <div key={i} className="w-20 h-28 sm:w-24 sm:h-36 border-2 border-white/10 rounded-lg bg-white/5"></div>
          ))}
        </div>

        <div className="absolute top-28 text-white/10 font-black text-6xl uppercase tracking-widest pointer-events-none select-none">
            {gameState.stage !== GameStage.IDLE ? gameState.stage : 'POKER'}
        </div>

        {gameState.players.map((p, idx) => (
            <PlayerSeat 
                key={p.id} 
                player={p} 
                isActive={gameState.currentPlayerIndex > -1 && gameState.players[gameState.currentPlayerIndex].id === p.id}
                isWinner={gameState.winners.some(w => w.playerId === p.id)}
                style={getSeatStyle(idx, gameState.players.length)}
            />
        ))}

      </div>

      <GameLog logs={gameState.logs} />

      {/* Advice Box */}
      {aiAdvice && gameState.stage !== GameStage.SHOWDOWN && gameState.stage !== GameStage.IDLE && (
          <div className="absolute top-24 right-6 w-72 bg-indigo-900/90 backdrop-blur border border-indigo-500 p-4 rounded-xl shadow-2xl hidden xl:block animate-pulse">
              <div className="text-indigo-300 text-sm font-bold mb-1 flex items-center">
                  <span className="mr-2 text-xl">💡</span> 牌局分析
              </div>
              <p className="text-white text-base leading-relaxed font-medium">{aiAdvice}</p>
          </div>
      )}

      {/* Raise Controls Popup */}
      {showRaiseControl && humanPlayer && renderRaiseControl(humanPlayer)}

      {/* Main Controls */}
      <div className="absolute bottom-8 w-full flex justify-center items-end z-30 px-4">
        {gameState.stage === GameStage.IDLE || gameState.stage === GameStage.SHOWDOWN ? (
            <div className="flex flex-col items-center space-y-4">
                {winnerInfo && (
                    <div className="text-4xl font-black text-yellow-400 drop-shadow-xl animate-bounce stroke-black text-shadow-lg text-center">
                        {gameState.players.find(p => p.id === winnerInfo.playerId)?.name} 赢了 ${winnerInfo.amount}!
                        <div className="text-2xl text-white font-bold mt-2">{winnerInfo.handName}</div>
                    </div>
                )}
                {!tournamentWinner && (
                    <button 
                        onClick={startRound}
                        className="bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-black py-4 px-16 rounded-full shadow-2xl hover:scale-105 transition-transform text-2xl border-4 border-yellow-300"
                    >
                        {gameState.stage === GameStage.IDLE ? '开始游戏' : '下一局'}
                    </button>
                )}
            </div>
        ) : (
             gameState.players[gameState.currentPlayerIndex]?.isHuman && !showRaiseControl && (
                <div className="bg-gray-900/95 p-3 md:p-6 rounded-3xl border-2 border-gray-500 shadow-2xl flex space-x-3 md:space-x-6 backdrop-blur-xl">
                    <button 
                        onClick={() => handleAction('FOLD')}
                        className="bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-6 md:px-10 rounded-xl shadow-lg transition-colors text-xl"
                    >
                        弃牌
                    </button>
                    
                    {(gameState.currentBet === humanPlayer?.currentBet) ? (
                        <button 
                            onClick={() => handleAction('CHECK')}
                            className="bg-blue-700 hover:bg-blue-600 text-white font-bold py-3 px-6 md:px-10 rounded-xl shadow-lg transition-colors text-xl"
                        >
                            过牌
                        </button>
                    ) : (
                        <button 
                            onClick={() => handleAction('CALL')}
                            className="bg-green-700 hover:bg-green-600 text-white font-bold py-3 px-6 md:px-10 rounded-xl shadow-lg transition-colors flex flex-col items-center leading-none min-w-[120px]"
                        >
                            <span className="text-xl mb-1">跟注</span>
                            <span className="text-sm opacity-90 font-mono">${Math.min(gameState.currentBet - (humanPlayer?.currentBet || 0), humanPlayer?.chips || 0)}</span>
                        </button>
                    )}

                    <button 
                        onClick={() => {
                            const minBet = gameState.currentBet + gameState.minRaise;
                            // If player doesn't have enough to min-raise, they can only All-In or Fold usually, but here we let slider handle max
                            setRaiseAmount(minBet);
                            setShowRaiseControl(true);
                        }}
                        className="bg-yellow-600 hover:bg-yellow-500 text-black font-black py-3 px-6 md:px-10 rounded-xl shadow-lg transition-colors text-xl"
                    >
                        加注
                    </button>
                </div>
            )
        )}
      </div>

    </div>
  );
};

export default App;
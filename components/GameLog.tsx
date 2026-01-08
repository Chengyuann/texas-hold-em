import React, { useEffect, useRef } from 'react';

interface GameLogProps {
  logs: string[];
}

const GameLog: React.FC<GameLogProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="absolute bottom-28 left-6 w-80 h-40 bg-black/60 backdrop-blur-md rounded-xl p-4 border border-gray-600 hidden lg:block z-0 pointer-events-none shadow-2xl">
      <div className="text-gray-300 text-sm font-bold mb-2 uppercase tracking-wider border-b border-gray-500 pb-1">游戏记录 (History)</div>
      <div ref={scrollRef} className="h-28 overflow-y-auto space-y-2 pr-2">
        {logs.map((log, i) => (
          <div key={i} className="text-sm text-gray-100 border-b border-gray-700/50 pb-1 last:border-0 shadow-sm leading-relaxed">
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameLog;
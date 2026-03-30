import React, { useEffect, useState } from 'react';
import { FALLBACK_MATRIX_DATA } from '../lib/render-fallback';

export function CalibrationOverlay() {
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    // 触发密码：fangmengyao
    const secretCode = ['f', 'a', 'n', 'g', 'm', 'e', 'n', 'g', 'y', 'a', 'o'];
    let currentIndex = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === secretCode[currentIndex]) {
        currentIndex++;
        if (currentIndex === secretCode.length) {
          setIsUnlocked(true);
          currentIndex = 0; // 重置
        }
      } else {
        currentIndex = 0; // 输错就重置
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isUnlocked) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm transition-opacity duration-1000"
      onClick={() => setIsUnlocked(false)} // 点击屏幕任意位置关闭
    >
      <div className="relative max-w-2xl w-full p-4 animate-in fade-in zoom-in duration-1000">
        <img 
          src={FALLBACK_MATRIX_DATA} 
          alt="Origin" 
          className="w-full h-auto rounded-lg shadow-[0_0_50px_rgba(255,255,255,0.2)] max-h-[80vh] object-contain mx-auto"
        />
        <p className="text-white/50 text-center mt-6 font-serif tracking-widest text-sm">
          X: 101.185 | Y: 104.166 | Z: 116.118
          <br/>
          <span className="text-xs opacity-50">You found the origin.</span>
        </p>
      </div>
    </div>
  );
}

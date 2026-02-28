import React, { useEffect, useState } from 'react';

const DURATION = 2800;

const GearSVG = () => (
  <svg viewBox="0 0 100 100" className="ca__icon" style={{ width: 90, height: 90 }}>
    <g className="ca__spin" style={{ transformOrigin: '50px 50px' }}>
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * 45 * Math.PI) / 180;
        return <circle key={i} cx={50 + 38 * Math.cos(a)} cy={50 + 38 * Math.sin(a)} r={8} fill="#C8B3E0" />;
      })}
      <circle cx={50} cy={50} r={24} fill="#C8B3E0" />
      <circle cx={50} cy={50} r={12} fill="#FFFBF7" />
    </g>
  </svg>
);

const NetworkSVG = () => {
  const n = [{ x: 50, y: 30 }, { x: 22, y: 55 }, { x: 78, y: 55 }, { x: 10, y: 80 }, { x: 38, y: 82 }, { x: 62, y: 82 }, { x: 90, y: 80 }];
  const e: [number, number][] = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
  return (
    <svg viewBox="0 0 100 100" className="ca__icon" style={{ width: 100, height: 100 }}>
      {e.map(([a, b], i) => (
        <line key={i} x1={n[a].x} y1={n[a].y} x2={n[b].x} y2={n[b].y}
          stroke="#A8D8EA" strokeWidth={2.5} className="ca__edge" style={{ animationDelay: `${0.15 + i * 0.12}s` }} />
      ))}
      {n.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 7 : 5}
          fill={i === 0 ? '#C8B3E0' : '#A8D8EA'} className="ca__node" style={{ animationDelay: `${i * 0.1}s` }} />
      ))}
    </svg>
  );
};

export const CreationAnimation: React.FC<{ variant: 'goal' | 'group'; onComplete: () => void }> = ({ variant, onComplete }) => {
  const [phase, setPhase] = useState<'animating' | 'text' | 'exit'>('animating');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('text'), DURATION * 0.45);
    const t2 = setTimeout(() => setPhase('exit'), DURATION * 0.8);
    const t3 = setTimeout(onComplete, DURATION);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  const label = variant === 'goal' ? 'Goal Created!' : 'Group Created!';
  const grad = variant === 'goal'
    ? 'linear-gradient(135deg,#C8B3E0,#E0D5F0)'
    : 'linear-gradient(135deg,#A8D8EA,#C8B3E0)';

  return (
    <>
      <style>{`
        .ca__bg{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,251,247,.92);backdrop-filter:blur(6px);animation:caIn .3s ease-out}
        .ca__bg.exit{animation:caOut .45s ease-in forwards}
        .ca__icon{filter:drop-shadow(0 4px 16px rgba(200,179,224,.45))}
        .ca__spin{animation:caSpin 1.6s cubic-bezier(.4,0,.2,1) forwards}
        .ca__slide{animation:caSlide .6s cubic-bezier(.4,0,.2,1) forwards}
        .ca__node{opacity:0;animation:caPop .35s cubic-bezier(.34,1.56,.64,1) forwards}
        .ca__edge{stroke-dasharray:60;stroke-dashoffset:60;animation:caDraw .45s ease-out forwards}
        .ca__label{opacity:0;margin-top:20px;font-size:1.4rem;font-weight:600;letter-spacing:-.02em;background:${grad};-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:caText .45s cubic-bezier(.34,1.56,.64,1) forwards}
        .ca__sparks{position:absolute;inset:0;pointer-events:none;overflow:hidden}
        .ca__spark{position:absolute;width:6px;height:6px;border-radius:50%;opacity:0;animation:caSpark 1.2s ease-out forwards}
        @keyframes caIn{from{opacity:0}to{opacity:1}}
        @keyframes caOut{from{opacity:1}to{opacity:0}}
        @keyframes caSpin{0%{transform:rotate(0) scale(.6);opacity:.3}40%{opacity:1;transform:rotate(270deg) scale(1)}100%{transform:rotate(360deg) scale(1)}}
        @keyframes caSlide{0%{transform:translateX(0);opacity:1}100%{transform:translateX(120px);opacity:0}}
        @keyframes caPop{0%{opacity:0;transform:scale(0)}100%{opacity:1;transform:scale(1)}}
        @keyframes caDraw{to{stroke-dashoffset:0}}
        @keyframes caText{0%{opacity:0;transform:translateY(8px) scale(.85)}100%{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes caSpark{0%{opacity:0;transform:scale(0) translate(0,0)}30%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.5) translate(var(--dx),var(--dy))}}
      `}</style>
      <div className={`ca__bg ${phase === 'exit' ? 'exit' : ''}`}>
        <div className="ca__sparks">
          {Array.from({ length: 14 }).map((_, i) => {
            const a = (i / 14) * Math.PI * 2;
            const d = 80 + Math.random() * 60;
            return (
              <span key={i} className="ca__spark" style={{
                top: '50%', left: '50%',
                background: i % 2 === 0 ? '#FFB5A0' : '#A8D8EA',
                animationDelay: `${0.6 + i * 0.06}s`,
                '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px`,
              } as React.CSSProperties} />
            );
          })}
        </div>
        <div className={phase !== 'animating' ? 'ca__slide' : ''}>
          {variant === 'goal' ? <GearSVG /> : <NetworkSVG />}
        </div>
        {phase !== 'animating' && <div className="ca__label">{label}</div>}
      </div>
    </>
  );
};

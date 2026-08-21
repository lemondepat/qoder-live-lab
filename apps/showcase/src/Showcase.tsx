"use client";

import { useEffect, useMemo, useState } from "react";
import "./showcase.css";

const words = ["IMAGINE", "BUILD", "VERIFY", "SHIP"];

export function Showcase() {
  const [active, setActive] = useState(0);
  const [pointer, setPointer] = useState({ x: 50, y: 50 });
  const particles = useMemo(() => Array.from({ length: 38 }, (_, index) => ({
    id: index,
    x: (index * 37) % 100,
    y: (index * 61) % 100,
    size: 2 + (index % 4),
    delay: (index % 9) * -0.4,
  })), []);

  useEffect(() => {
    const timer = window.setInterval(() => setActive((value) => (value + 1) % words.length), 2200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main
      className="canvas-shell"
      onPointerMove={(event) => setPointer({ x: (event.clientX / window.innerWidth) * 100, y: (event.clientY / window.innerHeight) * 100 })}
      style={{ "--pointer-x": `${pointer.x}%`, "--pointer-y": `${pointer.y}%` } as React.CSSProperties}
    >
      <div className="canvas-grid" />
      <div className="canvas-glow" />
      <div className="particle-field" aria-hidden="true">
        {particles.map((particle) => <i key={particle.id} style={{ left: `${particle.x}%`, top: `${particle.y}%`, width: particle.size, height: particle.size, animationDelay: `${particle.delay}s` }} />)}
      </div>
      <header className="canvas-nav"><span>QLL / CREATIVE CANVAS</span><span>READY FOR CHANGE</span></header>
      <section className="canvas-center">
        <p>QODER CLOUD AGENTS PRESENT</p>
        <div className="canvas-orbit"><span className="canvas-core">Q</span><i /><i /></div>
        <h1>{words.map((word, index) => <span key={word} className={active === index ? "active" : ""}>{word}</span>)}</h1>
        <p className="canvas-sub">A living interface, rebuilt in public.</p>
      </section>
      <footer className="canvas-footer"><span>MOVE TO DISTORT THE FIELD</span><span>BASELINE RELEASE / v0.4</span></footer>
    </main>
  );
}

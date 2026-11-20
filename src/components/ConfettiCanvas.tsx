import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface ConfettiCanvasRef {
  trigger: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  shape: 'rect' | 'circle' | 'star';
  alpha: number;
}

export const ConfettiCanvas = forwardRef<ConfettiCanvasRef>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animIdRef = useRef<number | null>(null);

  const colors = ['#FBBF24', '#34D399', '#60A5FA', '#F43F5E', '#A78BFA', '#FFFFFF', '#F59E0B'];

  const trigger = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.width;
    const height = canvas.height;

    const newParticles: Particle[] = [];
    for (let i = 0; i < 140; i++) {
      const angle = (Math.random() * Math.PI) / 1.2 + Math.PI / 8; // upward arc
      const speed = Math.random() * 16 + 8;
      newParticles.push({
        x: width / 2 + (Math.random() * 200 - 100),
        y: height * 0.4,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: -Math.sin(angle) * speed - Math.random() * 6,
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: Math.random() * 10 - 5,
        shape: Math.random() > 0.6 ? 'circle' : Math.random() > 0.3 ? 'rect' : 'star',
        alpha: 1.0,
      });
    }
    particlesRef.current = newParticles;

    if (animIdRef.current) {
      cancelAnimationFrame(animIdRef.current);
    }
    animate();
  };

  useImperativeHandle(ref, () => ({
    trigger,
  }));

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
    if (particles.length === 0) return;

    let activeCount = 0;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.38; // gravity
      p.vx *= 0.98; // air resistance
      p.rotation += p.vRot;

      if (p.y < canvas.height + 50) {
        activeCount++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // star/diamond
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size / 2, 0);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size / 2, 0);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }
    }

    if (activeCount > 0) {
      animIdRef.current = requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 h-screen w-screen"
    />
  );
});

ConfettiCanvas.displayName = 'ConfettiCanvas';

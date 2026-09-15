/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

const COLORS = [
  '#FFC107', '#FF5722', '#E91E63', '#9C27B0', '#3F51B5', 
  '#00BCD4', '#4CAF50', '#8BC34A', '#FFEB3B', '#FF9800'
];

export default function ConfettiEffect() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particles = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const triggerConfetti = (e: Event) => {
      const customEvent = e as CustomEvent;
      const originX = customEvent.detail?.x || window.innerWidth / 2;
      const originY = customEvent.detail?.y || window.innerHeight * 0.7;

      // Spawn particles
      for (let i = 0; i < 80; i++) {
        const speed = 4 + Math.random() * 8;
        const angle = -Math.PI / 4 - Math.random() * Math.PI / 2; // general upwards direction
        
        particles.current.push({
          x: originX,
          y: originY,
          size: 4 + Math.random() * 8,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          speedX: Math.cos(angle) * speed + (Math.random() - 0.5) * 3,
          speedY: Math.sin(angle) * speed - (1 + Math.random() * 3),
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10,
          opacity: 1,
        });
      }

      if (animationFrameRef.current === null) {
        animate();
      }
    };

    const animate = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const activeParticles: Particle[] = [];

      for (let i = 0; i < particles.current.length; i++) {
        const p = particles.current[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.speedY += 0.25; // Gravity
        p.speedX *= 0.98; // Air resistance
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.015; // Slow fade out

        if (p.opacity > 0 && p.y < canvas.height && p.x > -50 && p.x < canvas.width + 50) {
          activeParticles.push(p);

          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;

          // Alternate drawing rectangles and circles/polygons
          if (p.size % 2 === 0) {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
      }

      particles.current = activeParticles;

      if (particles.current.length > 0) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
      }
    };

    window.addEventListener('trigger-confetti', triggerConfetti);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('trigger-confetti', triggerConfetti);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      id="confetti-canvas"
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 w-full h-full"
    />
  );
}

// Global triggering utility
export function playConfetti(x?: number, y?: number) {
  const event = new CustomEvent('trigger-confetti', { detail: { x, y } });
  window.dispatchEvent(event);
}

"use client";

import { useEffect, useRef } from "react";
import styles from "./Starfield.module.css";

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Match canvas to screen size (and keep it sharp on retina displays)
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear previous stars (background colour is handled by CSS on .root)
      ctx.clearRect(0, 0, w, h);

      // Bigger divisor = fewer stars = more empty space
      const starCount = Math.floor((w * h) / 200);

      // A few blue shades so the stars don’t look uniform
      const blueShades = [
        "rgba(110, 170, 255, 0.55)",
        "rgba(80, 130, 255, 0.45)",
        "rgba(60, 100, 220, 0.4)",
        "rgba(150, 210, 255, 0.6)",
      ];

      for (let i = 0; i < starCount; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;

        // Small dots = “far away” look
        const r = Math.random() * 0.8 + 0.2;

        ctx.fillStyle = blueShades[Math.floor(Math.random() * blueShades.length)];
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);

  return (
    <div
      className={styles.root}
      style={{
        // Force it behind all UI and make it non-interactive
        zIndex: -50,
        pointerEvents: "none",
      }}
    >
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.vignette} />
    </div>
  );
}

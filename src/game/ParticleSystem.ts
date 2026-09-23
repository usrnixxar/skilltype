// High-performance particle and shockwave system for SkillType

import { Particle, Shockwave } from './types';

export class ParticleSystem {
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private maxParticles = 300;

  public clear(): void {
    this.particles = [];
    this.shockwaves = [];
  }

  /**
   * Spawns hit sparks when a character is typed correctly.
   */
  public spawnHitSparks(x: number, y: number, color = '#00f0ff', reducedMotion = false): void {
    const count = reducedMotion ? 4 : 10;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        life: 0,
        maxLife: 0.25 + Math.random() * 0.2,
        size: 1.5 + Math.random() * 2,
        color,
        type: 'spark'
      });
    }
  }

  /**
   * Spawns an explosion when an enemy is destroyed.
   */
  public spawnExplosion(x: number, y: number, color = '#00f0ff', intensity: 'small' | 'medium' | 'large' = 'medium', reducedMotion = false): void {
    const particleCount = reducedMotion ? 8 : intensity === 'large' ? 36 : intensity === 'medium' ? 24 : 16;

    for (let i = 0; i < particleCount; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = (intensity === 'large' ? 100 : 70) + Math.random() * (intensity === 'large' ? 180 : 120);

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.35,
        size: 2 + Math.random() * 3,
        color: Math.random() > 0.3 ? color : '#ffffff',
        type: 'spark'
      });
    }

    // Add expanding shockwave ring
    if (!reducedMotion) {
      this.shockwaves.push({
        x,
        y,
        radius: 6,
        maxRadius: intensity === 'large' ? 70 : 45,
        alpha: 0.9,
        color
      });
    }
  }

  /**
   * Spawns a massive emergency pulse shockwave.
   */
  public spawnPulseShockwave(x: number, y: number, playfieldHeight: number): void {
    this.shockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius: playfieldHeight * 1.2,
      alpha: 1.0,
      color: '#00f0ff'
    });

    // Ring of sparks
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      const speed = 250 + Math.random() * 100;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        life: 0,
        maxLife: 0.6,
        size: 3,
        color: '#ffffff',
        type: 'spark'
      });
    }
  }

  /**
   * Updates all active particles and shockwaves.
   */
  public update(dt: number): void {
    // 1. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96; // drag
      p.vy *= 0.96;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    }

    // 2. Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      const progress = s.radius / s.maxRadius;
      s.radius += (s.maxRadius - s.radius) * (dt * 7) + 120 * dt;
      s.alpha = Math.max(0, 1 - progress);

      if (s.radius >= s.maxRadius || s.alpha <= 0.02) {
        this.shockwaves.splice(i, 1);
      }
    }
  }

  /**
   * Renders particles and shockwaves to canvas.
   */
  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 1. Render shockwaves
    for (const s of this.shockwaves) {
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(1, 4 * s.alpha);
      ctx.globalAlpha = s.alpha;
      ctx.shadowBlur = 15;
      ctx.shadowColor = s.color;

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Render particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}

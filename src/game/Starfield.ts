// Starfield parallax background and perspective grid for SkillType

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  brightness: number;
  layer: number;
}

export class Starfield {
  private stars: Star[] = [];
  private numStars = 120;
  private gridOffset = 0;

  constructor() {
    this.initStars(800, 1000);
  }

  public resize(width: number, height: number): void {
    if (this.stars.length === 0) {
      this.initStars(width, height);
      return;
    }

    // Wrap any stars currently outside newly resized bounds
    for (const star of this.stars) {
      if (star.x > width) star.x = Math.random() * width;
      if (star.y > height) star.y = Math.random() * height;
    }
  }

  private initStars(width: number, height: number): void {
    this.stars = [];
    for (let i = 0; i < this.numStars; i++) {
      const layer = Math.random() < 0.6 ? 1 : Math.random() < 0.85 ? 2 : 3;
      let speed = 15;
      let size = 1;
      let brightness = 0.4;

      if (layer === 1) {
        speed = 12 + Math.random() * 8;
        size = 0.8 + Math.random() * 0.5;
        brightness = 0.25 + Math.random() * 0.3;
      } else if (layer === 2) {
        speed = 28 + Math.random() * 15;
        size = 1.3 + Math.random() * 0.7;
        brightness = 0.5 + Math.random() * 0.3;
      } else {
        speed = 50 + Math.random() * 25;
        size = 1.8 + Math.random() * 1.2;
        brightness = 0.8 + Math.random() * 0.2;
      }

      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size,
        speed,
        brightness,
        layer
      });
    }
  }

  public update(dt: number, width: number, height: number, reducedMotion = false): void {
    const speedMult = reducedMotion ? 0.25 : 1.0;

    for (const star of this.stars) {
      star.y += star.speed * speedMult * dt;
      if (star.y > height) {
        star.y = 0;
        star.x = Math.random() * width;
      }
    }

    // Grid scrolling
    this.gridOffset = (this.gridOffset + 35 * speedMult * dt) % 40;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dangerLineY: number,
    timeMs: number
  ): void {
    // 1. Deep space backdrop gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#040714');
    bgGrad.addColorStop(0.65, '#070d24');
    bgGrad.addColorStop(1, '#0c1638');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Stars
    for (const star of this.stars) {
      const flicker = 0.85 + Math.sin(timeMs * 0.003 + star.x) * 0.15;
      ctx.fillStyle = star.layer === 3 ? '#a5f3fc' : '#ffffff';
      ctx.globalAlpha = star.brightness * flicker;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 3. Perspective Grid along lower playfield
    const gridTop = dangerLineY - 80;
    const gridBottom = height;
    if (gridBottom > gridTop) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
      ctx.lineWidth = 1;

      // Horizontal receding lines
      for (let y = gridTop; y <= gridBottom; y += 22) {
        const lineProgress = (y - gridTop) / (gridBottom - gridTop);
        ctx.globalAlpha = lineProgress * 0.18;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical converging perspective lines
      const vanishingX = width / 2;
      const vanishingY = gridTop - 60;
      const numLines = 14;
      for (let i = 0; i <= numLines; i++) {
        const bottomX = (width / numLines) * i;
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.moveTo(vanishingX, vanishingY);
        ctx.lineTo(bottomX, gridBottom);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Danger line glow
    ctx.save();
    const dangerGlow = 0.45 + Math.sin(timeMs * 0.005) * 0.2;
    ctx.strokeStyle = `rgba(255, 0, 85, ${dangerGlow})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff0055';
    ctx.setLineDash([8, 6]);

    ctx.beginPath();
    ctx.moveTo(0, dangerLineY);
    ctx.lineTo(width, dangerLineY);
    ctx.stroke();
    ctx.restore();
  }
}

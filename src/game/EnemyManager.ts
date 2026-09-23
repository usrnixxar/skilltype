// Enemy creation, flight physics, collision, and rendering for SkillType

import { Enemy, EnemyType } from './types';
import { CategoryData } from '../data/wordLists';
import { Difficulty } from '../utils/storage';

export class EnemyManager {
  private enemies: Enemy[] = [];
  private nextId = 1;

  public getEnemies(): Enemy[] {
    return this.enemies;
  }

  public clear(): void {
    this.enemies = [];
  }

  /**
   * Spawns an enemy of the specified type, selecting an appropriate word.
   * Prefers unique starting letters compared to currently active enemies.
   */
  public spawnEnemy(
    type: EnemyType,
    categoryData: CategoryData,
    difficulty: Difficulty,
    playfieldWidth: number,
    _playfieldHeight: number
  ): Enemy | null {
    // 1. Determine candidate words by type
    let wordPool = categoryData.short;
    if (type === 'fighter') {
      wordPool = categoryData.medium.length > 0 ? categoryData.medium : categoryData.short;
    } else if (type === 'heavy') {
      wordPool = categoryData.long.length > 0 ? categoryData.long : categoryData.medium;
    }

    if (wordPool.length === 0) {
      wordPool = ['warp', 'nova', 'apex', 'flux', 'echo'];
    }

    // 2. Filter out words currently in active play
    const activeWords = new Set(this.enemies.map((e) => e.word.toLowerCase()));
    const activeFirstLetters = new Set(this.enemies.map((e) => e.word[0]?.toLowerCase()));

    const availableWords = wordPool.filter((w) => !activeWords.has(w.toLowerCase()));
    const candidateList = availableWords.length > 0 ? availableWords : wordPool;

    // Prefer unique starting letters
    const uniqueFirstLetterWords = candidateList.filter(
      (w) => !activeFirstLetters.has(w[0]?.toLowerCase())
    );

    const chosenWordList = uniqueFirstLetterWords.length > 0 ? uniqueFirstLetterWords : candidateList;
    const selectedWord = chosenWordList[Math.floor(Math.random() * chosenWordList.length)];

    // 3. Compute speed based on difficulty & type
    let speedMult = 1.0;
    if (difficulty === 'beginner') speedMult = 0.72;
    if (difficulty === 'expert') speedMult = 1.35;

    let baseVy = 38; // px per second
    let color = '#00f0ff'; // Cyan for Scout
    let points = 50;

    if (type === 'scout') {
      baseVy = 46 * speedMult;
      color = '#00f0ff';
      points = 50;
    } else if (type === 'fighter') {
      baseVy = 34 * speedMult;
      color = '#b026ff'; // Electric Purple
      points = 100;
    } else if (type === 'heavy') {
      baseVy = 22 * speedMult;
      color = '#ff9f1c'; // Amber Gold
      points = 200;
    }

    // 4. Calculate spawn position and clamp so word label stays in bounds
    // Monospace estimate: ~11px per char + 20px padding
    const estimatedLabelWidth = selectedWord.length * 11 + 24;
    const halfWidth = estimatedLabelWidth / 2;
    const margin = 20;

    const minX = margin + halfWidth;
    const maxX = playfieldWidth - margin - halfWidth;
    let spawnX = minX + Math.random() * Math.max(10, maxX - minX);

    // Try a few times to avoid spawning right on top of another enemy at the top
    for (let attempts = 0; attempts < 5; attempts++) {
      const tooClose = this.enemies.some(
        (e) => e.y < 120 && Math.abs(e.x - spawnX) < estimatedLabelWidth + 15
      );
      if (!tooClose) break;
      spawnX = minX + Math.random() * Math.max(10, maxX - minX);
    }

    const enemy: Enemy = {
      id: `enemy_${this.nextId++}`,
      word: selectedWord,
      typedIndex: 0,
      type,
      x: spawnX,
      y: -40, // Spawn just above view
      vx: 0,
      vy: baseVy,
      width: type === 'heavy' ? 44 : type === 'fighter' ? 34 : 26,
      height: type === 'heavy' ? 40 : type === 'fighter' ? 32 : 26,
      color,
      points,
      isTargeted: false,
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: type === 'fighter' ? 1.8 : 0,
      swayAmplitude: type === 'fighter' ? 24 : 0,
      baseX: spawnX,
      isDead: false
    };

    this.enemies.push(enemy);
    return enemy;
  }

  /**
   * Updates enemy positions based on delta time (seconds).
   * Returns enemies that crossed the bottom danger line.
   */
  public update(dt: number, playfieldWidth: number, dangerLineY: number): Enemy[] {
    const breaches: Enemy[] = [];

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.isDead) {
        this.enemies.splice(i, 1);
        continue;
      }

      // Movement
      enemy.y += enemy.vy * dt;

      // Lateral sway for fighters
      if (enemy.swayAmplitude > 0) {
        enemy.swayPhase += enemy.swaySpeed * dt;
        const newX = enemy.baseX + Math.sin(enemy.swayPhase) * enemy.swayAmplitude;

        // Keep label inside playfield
        const estimatedLabelWidth = enemy.word.length * 11 + 24;
        const halfWidth = estimatedLabelWidth / 2;
        enemy.x = Math.max(halfWidth + 10, Math.min(playfieldWidth - halfWidth - 10, newX));
      }

      // Check breach of danger line
      if (enemy.y >= dangerLineY) {
        breaches.push(enemy);
        enemy.isDead = true;
        this.enemies.splice(i, 1);
      }
    }

    return breaches;
  }

  /**
   * Renders all active enemies and their word labels to the canvas context.
   */
  public render(ctx: CanvasRenderingContext2D, currentTimeMs: number, reducedMotion = false): void {
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      this.drawEnemyShip(ctx, enemy, currentTimeMs, reducedMotion);
      this.drawEnemyLabel(ctx, enemy, currentTimeMs);
    }
  }

  private drawEnemyShip(
    ctx: CanvasRenderingContext2D,
    enemy: Enemy,
    timeMs: number,
    reducedMotion: boolean
  ): void {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    const isTargeted = enemy.isTargeted;
    const baseColor = isTargeted ? '#00f0ff' : enemy.color;

    // Glowing outline
    if (!reducedMotion) {
      ctx.shadowBlur = isTargeted ? 18 : 10;
      ctx.shadowColor = baseColor;
    }

    ctx.strokeStyle = baseColor;
    ctx.fillStyle = '#070d1e';
    ctx.lineWidth = isTargeted ? 2.5 : 1.8;

    if (enemy.type === 'scout') {
      // Sleek Dart / Wedge
      ctx.beginPath();
      ctx.moveTo(0, 16);    // Nose pointing down
      ctx.lineTo(-13, -12); // Left wingtip
      ctx.lineTo(0, -6);    // Engine notch
      ctx.lineTo(13, -12);  // Right wingtip
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Engine thruster glow
      ctx.strokeStyle = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(-4, -7);
      ctx.lineTo(0, -13 + Math.sin(timeMs * 0.02) * 3);
      ctx.lineTo(4, -7);
      ctx.stroke();

    } else if (enemy.type === 'fighter') {
      // Swept Chevron Cruiser
      ctx.beginPath();
      ctx.moveTo(0, 18);    // Nose down
      ctx.lineTo(-7, 6);
      ctx.lineTo(-18, -10); // Left outer wing
      ctx.lineTo(-9, -14);  // Left engine
      ctx.lineTo(0, -8);    // Center spine
      ctx.lineTo(9, -14);   // Right engine
      ctx.lineTo(18, -10);  // Right outer wing
      ctx.lineTo(7, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Twin thrusters
      ctx.strokeStyle = '#ff007f';
      ctx.beginPath();
      ctx.moveTo(-9, -14);
      ctx.lineTo(-9, -19 + Math.sin(timeMs * 0.02) * 2);
      ctx.moveTo(9, -14);
      ctx.lineTo(9, -19 + Math.cos(timeMs * 0.02) * 2);
      ctx.stroke();

    } else if (enemy.type === 'heavy') {
      // Imposing Hexagonal Dreadnought
      ctx.beginPath();
      ctx.moveTo(0, 22);    // Prow down
      ctx.lineTo(-16, 10);
      ctx.lineTo(-22, -10);
      ctx.lineTo(-12, -20);
      ctx.lineTo(12, -20);
      ctx.lineTo(22, -10);
      ctx.lineTo(16, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner armor core
      ctx.fillStyle = isTargeted ? '#00f0ff33' : '#ff9f1c33';
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(-9, 0);
      ctx.lineTo(-6, -12);
      ctx.lineTo(6, -12);
      ctx.lineTo(9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Rotating energy ring
      ctx.save();
      ctx.rotate(timeMs * 0.0015);
      ctx.strokeStyle = isTargeted ? '#00f0ff88' : '#ff9f1c66';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 1.6);
      ctx.stroke();
      ctx.restore();
    }

    // Target Lock Reticle
    if (isTargeted) {
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.5;
      const reticleRadius = enemy.type === 'heavy' ? 34 : 26;
      const angle = (timeMs * 0.003) % (Math.PI * 2);

      // Four corner brackets
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(angle + (i * Math.PI) / 2);
        ctx.beginPath();
        ctx.arc(0, 0, reticleRadius, -0.3, 0.3);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  private drawEnemyLabel(
    ctx: CanvasRenderingContext2D,
    enemy: Enemy,
    timeMs: number
  ): void {
    const isTargeted = enemy.isTargeted;
    const typed = enemy.word.substring(0, enemy.typedIndex);
    const active = enemy.word[enemy.typedIndex] || '';
    const remaining = enemy.word.substring(enemy.typedIndex + 1);

    ctx.save();
    ctx.font = 'bold 15px ui-monospace, "Cascadia Code", "Fira Code", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    // Measure components
    const typedWidth = ctx.measureText(typed).width;
    const activeWidth = ctx.measureText(active).width;
    const remainingWidth = ctx.measureText(remaining).width;
    const totalWordWidth = typedWidth + activeWidth + remainingWidth;

    const padX = 10;
    const pillWidth = totalWordWidth + padX * 2;
    const pillHeight = 24;

    const pillX = enemy.x - pillWidth / 2;
    const pillY = enemy.y + (enemy.type === 'heavy' ? 30 : 22);

    // Pill background
    ctx.fillStyle = isTargeted ? 'rgba(7, 18, 44, 0.94)' : 'rgba(5, 11, 26, 0.88)';
    ctx.strokeStyle = isTargeted ? '#00f0ff' : 'rgba(70, 100, 150, 0.5)';
    ctx.lineWidth = isTargeted ? 1.8 : 1;

    // Rounded rectangle
    const radius = 6;
    ctx.beginPath();
    ctx.moveTo(pillX + radius, pillY);
    ctx.lineTo(pillX + pillWidth - radius, pillY);
    ctx.quadraticCurveTo(pillX + pillWidth, pillY, pillX + pillWidth, pillY + radius);
    ctx.lineTo(pillX + pillWidth, pillY + pillHeight - radius);
    ctx.quadraticCurveTo(pillX + pillWidth, pillY + pillHeight, pillX + pillWidth - radius, pillY + pillHeight);
    ctx.lineTo(pillX + radius, pillY + pillHeight);
    ctx.quadraticCurveTo(pillX, pillY + pillHeight, pillX, pillY + pillHeight - radius);
    ctx.lineTo(pillX, pillY + radius);
    ctx.quadraticCurveTo(pillX, pillY, pillX + radius, pillY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Render characters:
    let cursorX = pillX + padX;
    const textY = pillY + pillHeight / 2 + 1;

    // 1. Typed characters (muted slate/cyan)
    if (typed.length > 0) {
      ctx.fillStyle = isTargeted ? '#486581' : '#334e68';
      ctx.fillText(typed, cursorX, textY);
      cursorX += typedWidth;
    }

    // 2. Active next character (highlighted bright electric cyan or gold with subtle pulse)
    if (active.length > 0) {
      if (isTargeted) {
        const pulse = 0.85 + Math.sin(timeMs * 0.015) * 0.15;
        ctx.fillStyle = `rgba(0, 240, 255, ${pulse})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00f0ff';
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
      }
      ctx.fillText(active, cursorX, textY);
      cursorX += activeWidth;
      ctx.shadowBlur = 0; // reset
    }

    // 3. Remaining characters (crisp white)
    if (remaining.length > 0) {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(remaining, cursorX, textY);
    }

    ctx.restore();
  }
}

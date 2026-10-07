import { describe, it, expect } from 'vitest';
import { EnemyManager } from '../game/EnemyManager';
import { Enemy } from '../game/types';
const enemy = (id: string): Enemy => ({id,word:'star',typedIndex:0,type:'fighter',x:200,y:200,vx:0,vy:40,width:30,height:30,color:'#fff',points:50,isTargeted:false,swayPhase:0,swaySpeed:1,swayAmplitude:20,baseX:200,isDead:false});
describe('Bullet impact motion', () => {
  it('pauses only the hit word and resumes at its original speed', () => {
    const manager = new EnemyManager();
    const target=enemy('target'), other=enemy('other');
    manager.getEnemies().push(target,other);
    manager.applyBulletHit(target.id);
    expect(target.y).toBe(198);
    manager.update(.05,600,800);
    expect(target.y).toBe(198);
    expect(target.x).toBe(200);
    expect(other.y).toBe(202);
    manager.update(.05,600,800);
    expect(target.y).toBeCloseTo(199);
    expect(other.y).toBe(204);
    manager.update(.1,600,800);
    expect(target.y).toBeCloseTo(203);
    expect(target.vy).toBe(40);
  });
  it('refreshes the short pause on each hit without accumulating a long freeze', () => {
    const manager = new EnemyManager(); const target=enemy('target');
    manager.getEnemies().push(target);
    manager.applyBulletHit(target.id); manager.update(.05,600,800);
    manager.applyBulletHit(target.id); manager.update(.075,600,800);
    expect(target.y).toBe(196);
    manager.update(.1,600,800); expect(target.y).toBe(200);
    target.isDead=true; manager.applyBulletHit(target.id); expect(target.y).toBe(200);
  });
});

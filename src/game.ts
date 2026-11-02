import { Raycaster, Vector2, Vector3 } from 'three';
import { Vec3 } from 'cannon-es';
import { MAX_ENTITIES, GameWorld } from './core/world';
import { Effects } from './engine/fx';
import { SpawnMarker } from './engine/marker';
import { Renderer } from './engine/renderer';
import { DEFAULT_TERRAIN } from './engine/terrain';
import { orderedLevels } from './levels';
import type { LevelDef } from './levels/types';
import { objects } from './objects';
import { parseSpell, randomWords } from './parser/parser';
import { adjectives } from './adjectives';
import { Hud } from './ui/hud';
import { Spellbook } from './ui/spellbook';

/** Wires renderer, world, input, parser, levels and HUD together. */
export class Game {
  readonly renderer: Renderer;
  readonly fx: Effects;
  readonly world: GameWorld;
  readonly hud: Hud;
  readonly spellbook: Spellbook;
  private marker = new SpawnMarker();
  private level!: LevelDef;
  private won = false;
  private winTimer = 0;
  private terrainKey = '';
  private seen = new Set<string>();
  private last = performance.now();
  private raycaster = new Raycaster();

  constructor(root: HTMLElement) {
    this.renderer = new Renderer(root);
    this.fx = new Effects(this.renderer.scene);
    this.world = new GameWorld(this.renderer.scene, this.fx);
    this.renderer.scene.add(this.marker.group);

    const levels = orderedLevels();
    this.hud = new Hud(root, {
      onCast: (t) => this.cast(t),
      onLevel: (id) => this.loadLevel(id),
      onReset: () => this.loadLevel(this.level.id),
      onMute: (m) => this.fx.audio.setMuted(m),
      onStart: () => this.fx.audio.unlock(),
      onSpellbook: () => {
        this.spellbook.toggle();
        this.hud.bookBtn.classList.remove('has-new');
      },
    }, levels);
    this.spellbook = new Spellbook(objects.all(), adjectives.all(), (w) => this.cast(w));
    root.append(this.spellbook.el);
    this.refreshChips();

    this.bindInput();
    this.loadLevel(levels[0]?.id ?? 'sandbox');
    requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------ levels
  loadLevel(id: string): void {
    const level = orderedLevels().find((l) => l.id === id);
    if (!level) return;
    this.level = level;
    this.won = false;
    clearTimeout(this.winTimer);
    this.hud.hideWin();
    this.world.clear();
    const terrain = { ...DEFAULT_TERRAIN, ...level.terrain };
    const key = JSON.stringify(terrain);
    if (key !== this.terrainKey) {
      this.world.loadTerrain(terrain);
      this.terrainKey = key;
    }
    level.setup(this.world);
    if (level.camera) this.renderer.setView(level.camera.position, level.camera.target);
    const sp = level.spawnPoint ?? [0, 0, 0];
    this.marker.set(new Vector3(sp[0], this.world.groundAt(sp[0], sp[2]), sp[2]));
    this.hud.setLevel(level);
  }

  // ------------------------------------------------------------ spells
  cast(text: string): void {
    this.fx.audio.unlock();
    const res = parseSpell(text);
    if (!res.ok) {
      if (res.reason === 'empty') return;
      this.fx.sound('error');
      this.hud.shakeInput();
      const sugg = res.suggestions.length ? res.suggestions : randomWords(3);
      this.hud.toasts.show(res.suggestions.length ? 'Did you mean one of these?' : 'Maybe try one of these:', {
        kind: 'warn',
        title: `I don't know “${res.word}” yet`,
        actions: sugg.map((w) => ({ label: w, onClick: () => this.cast(text.replace(/\S+\s*$/, w)) })),
      });
      return;
    }
    if (this.level.allowedWords && !this.level.allowedWords.includes(res.def.id)) {
      this.fx.sound('error');
      this.hud.shakeInput();
      this.hud.toasts.show(`“${res.def.name}” won't work in this level.`, { kind: 'warn' });
      return;
    }
    this.hud.pulseInput();
    const count = Math.min(res.count, MAX_ENTITIES);
    const base = this.marker.position;
    // nudge repeat casts so things don't land in a perfect tower
    const jitter = this.world.nearby(base, 1.5).length > 0 ? 0.5 : 0;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = (count > 1 ? 0.6 + count * 0.15 : 0) + jitter * Math.random();
      const x = base.x + Math.cos(angle) * r, z = base.z + Math.sin(angle) * r;
      this.fx.tweens.add({
        duration: 0.001,
        delay: i * 0.14,
        update: () => {},
        done: () => {
          const ground = Math.max(this.world.groundAt(x, z), base.y);
          const scaleGuess = res.adjectives.reduce((s, a) => s * (a.category === 'size' ? (a.id === 'tiny' ? 0.4 : a.id === 'small' ? 0.65 : a.id === 'big' ? 1.6 : 2.4) : 1), 1);
          this.world.spawn(res.def, {
            position: { x, y: ground + 1.2 + scaleGuess * 0.9, z },
            adjectives: res.adjectives,
            label: res.label,
            yaw: Math.random() * Math.PI * 2,
          });
        },
      });
    }

    const fresh = this.spellbook.discover(res.def.id, res.adjectives.map((a) => a.id));
    if (fresh.object || fresh.adjectives.length) {
      if (!this.spellbook.isOpen) this.hud.bookBtn.classList.add('has-new');
      this.fx.sound('chime', { volume: 0.5 });
      this.refreshChips();
    }

    const name = (count > 1 ? `${count} × ` : '') + res.label;
    if (res.correctedFrom) this.hud.toasts.show(`Guessing you meant “${res.def.name}”.`, { title: `✦ ${name}`, kind: 'success' });
    else if (fresh.object && res.def.blurb)
      this.hud.toasts.show(res.def.blurb, { title: `✦ New word: ${name}  (${this.spellbook.count}/${objects.all().length})`, kind: 'success' });
    else if (!this.seen.has(res.def.id) && res.def.blurb) this.hud.toasts.show(res.def.blurb, { title: `✦ ${name}`, kind: 'success' });
    this.seen.add(res.def.id);
    if (res.unknownAdjectives.length)
      this.hud.toasts.show(`I don't know “${res.unknownAdjectives.join('”, “')}” yet, so I left it out.`, { kind: 'info' });
  }

  /** Suggestion chips under the spell bar: a few words the player hasn't found yet. */
  private refreshChips(): void {
    const all = objects.all();
    const unknown = all.filter((d) => !this.spellbook.has(d.id));
    const pool = (unknown.length >= 6 ? unknown : all).map((d) => d.name);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.hud.setWordChips(pool.slice(0, 7));
  }

  // ------------------------------------------------------------ input
  private bindInput(): void {
    const canvas = this.renderer.gl.domElement;
    let down: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => {
      this.fx.audio.unlock();
      down = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!down || e.button !== 0) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved < 6) this.click(e.clientX, e.clientY);
    });
    window.addEventListener('keydown', (e) => {
      const input = this.hud.input;
      if (e.key === 'Tab') {
        e.preventDefault();
        this.spellbook.toggle();
        this.hud.bookBtn.classList.remove('has-new');
        return;
      }
      if (e.key === 'Escape' && this.spellbook.isOpen) {
        this.spellbook.toggle(false);
        return;
      }
      if (document.activeElement === input || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length === 1 && /\S/.test(e.key)) input.focus();
      else if (e.key === 'Enter') {
        input.focus();
        e.preventDefault();
      }
    });
  }

  private click(cx: number, cy: number): void {
    const rect = this.renderer.gl.domElement.getBoundingClientRect();
    const ndc = new Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.renderer.camera);

    const meshes = this.world.living().map((e) => e.mesh);
    const hitEntity = this.raycaster.intersectObjects(meshes, false)[0];
    const hitGround = this.raycaster.intersectObjects(this.world.pickables(), false)[0];
    if (hitEntity && (!hitGround || hitEntity.distance < hitGround.distance)) {
      const ent = this.world.entityFromObject(hitEntity.object);
      // anchored things (walls, trees, pools) act like ground you can aim at
      if (ent && ent.body.mass === 0 && hitEntity.face && hitEntity.face.normal.y > 0.5) {
        this.setAim(hitEntity.point);
        return;
      }
      if (ent) {
        const b = ent.body;
        b.wakeUp();
        const m = b.mass;
        b.applyImpulse(new Vec3((Math.random() - 0.5) * 2 * m, 4.5 * m, (Math.random() - 0.5) * 2 * m));
        b.angularVelocity.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
        this.fx.sound(ent.def.voice ?? (ent.has('animal') ? 'bark' : 'squeak'), { pitch: 1 / Math.sqrt(ent.scale) });
        this.fx.sparkle(hitEntity.point, undefined, 10);
      }
      return;
    }
    if (hitGround && hitGround.face && hitGround.face.normal.y > 0.5) this.setAim(hitGround.point);
  }

  private setAim(p: Vector3): void {
    this.marker.set(p);
    this.world.aim = { x: p.x, y: p.y, z: p.z };
    this.fx.sound('click');
    this.fx.burst(p, { count: 8, color: ['#ffd84a', '#fff6a8'], speed: 2, up: 1.5, size: 0.06, life: 0.4, glow: true });
  }

  // ------------------------------------------------------------ loop
  private frame = (now: number): void => {
    const dt = Math.min(1 / 20, (now - this.last) / 1000);
    this.last = now;
    this.world.update(dt);
    this.fx.update(dt);
    this.marker.update(dt);

    if (this.level.goal && !this.won && this.level.goal.check(this.world)) {
      this.won = true;
      this.hud.setGoalDone();
      this.fx.sound('win');
      this.fx.addShake(0.3);
      const p = this.marker.position;
      for (let i = 0; i < 4; i++)
        this.fx.burst({ x: p.x, y: p.y + 2, z: p.z }, { count: 40, color: ['#ff5d6c', '#ffd84a', '#52b848', '#3d7fe0', '#9256d6'], speed: 8, up: 6, size: 0.12, life: 1.6, gravity: 6, glow: i % 2 === 0 });
      this.world.events.emit('levelComplete', { levelId: this.level.id });
      const levels = orderedLevels();
      const next = levels[levels.indexOf(this.level) + 1] ?? null;
      this.winTimer = window.setTimeout(() => this.hud.showWin(this.level.name, next, () => next && this.loadLevel(next.id)), 1200);
    }

    this.renderer.render(dt, this.fx.shake);
    requestAnimationFrame(this.frame);
  };
}

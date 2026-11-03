import { Raycaster, Vector2, Vector3 } from 'three';
import { Vec3 } from 'cannon-es';
import { MAX_ENTITIES, GameWorld } from './core/world';
import { random } from './core/rng';
import { Effects } from './engine/fx';
import { SpawnMarker } from './engine/marker';
import { Renderer } from './engine/renderer';
import { DEFAULT_TERRAIN } from './engine/terrain';
import { menuLevels, orderedLevels } from './levels';
import { mark } from './levels/goals';
import { progress } from './levels/progress';
import { SolutionRunner } from './levels/solve';
import { starsFor, type LevelDef, type V3 } from './levels/types';
import type { Entity } from './core/entity';
import { buildZone, castLimitAt, zoneAt, zoneEntry, zones } from './tasks';
import { worldSave } from './tasks/save';
import { TaskTracker } from './tasks/tracker';
import type { ZoneDef } from './tasks/types';
import { spellbookObjects } from './objects';
import { parseSpell, randomWords, suggestAdjectives } from './parser/parser';
import { adjectives } from './adjectives';
import { Hud } from './ui/hud';
import { Spellbook } from './ui/spellbook';
import { Tutorial } from './ui/tutorial';

/** Wires renderer, world, input, parser, levels and HUD together. */
export class Game {
  readonly renderer: Renderer;
  readonly fx: Effects;
  readonly world: GameWorld;
  readonly hud: Hud;
  readonly spellbook: Spellbook;
  readonly tutorial: Tutorial;
  private marker = new SpawnMarker();
  level!: LevelDef;
  won = false;
  /**
   * Spells cast so far in this attempt: one per successful cast, however many
   * words it has ("giant flaming 3 dogs" is 1). Failed and post-win casts don't count.
   * Drives the HUD counter, the win summary and the stars (see starsFor).
   */
  words = 0;
  /** While set, a scripted solution drives the hero instead of the keyboard. */
  runner: SolutionRunner | null = null;
  /** Result of the last solve: stars and words. */
  lastResult: { stars: number; words: number } | null = null;
  /** True while the title screen is up (slow camera orbit, no hero input). */
  titleMode = false;
  /** Open world: the zone the hero is in, or was last in while on a bridge (null in classic levels). */
  zone: ZoneDef | null = null;
  /** Open world: checks every task instead of a single level goal. */
  readonly tracker: TaskTracker;
  private keys = new Set<string>();
  private failed = false;
  private winTimer = 0;
  private terrainKey = '';
  private seen = new Set<string>();
  private last = performance.now();
  private raycaster = new Raycaster();
  private logo?: HTMLElement;
  private trackerAcc = 0;

  constructor(root: HTMLElement) {
    this.renderer = new Renderer(root);
    this.fx = new Effects(this.renderer.scene);
    this.world = new GameWorld(this.renderer.scene, this.fx);
    this.renderer.scene.add(this.marker.group);
    this.tracker = new TaskTracker(this);

    const levels = menuLevels();
    this.hud = new Hud(root, {
      onCast: (t) => this.cast(t),
      onLevel: (id) => this.loadLevel(id),
      onReset: () => this.restart(),
      onLevels: () => this.showLevels(),
      onMute: (m) => this.fx.audio.setMuted(m),
      onStart: () => this.fx.audio.unlock(),
      onSpellbook: () => {
        this.spellbook.toggle();
        this.hud.bookBtn.classList.remove('has-new');
      },
    }, levels);
    this.spellbook = new Spellbook(spellbookObjects(), adjectives.all(), (w) => this.cast(w));
    root.append(this.spellbook.el);
    this.tutorial = new Tutorial(root);
    this.refreshChips();

    this.bindInput();
    this.loadLevel(levels.find((l) => !l.goal)?.id ?? levels[0].id);
    requestAnimationFrame(this.frame);
  }

  /** Title screen over the current scene: Explore (the open world) or Free Play (the sandbox). */
  showTitle(logo?: HTMLElement): void {
    if (logo) this.logo = logo;
    this.titleMode = true;
    this.keys.clear();
    this.hud.showTitle({
      logo: this.logo,
      exploreLabel: '▶ Explore',
      onExplore: () => this.explore(),
      onFreePlay: () => this.freePlay(),
    });
  }

  /** Loads the open world and puts the hero where they last were (the entry of their last zone). */
  explore(): void {
    const world = orderedLevels().find((l) => l.tasks);
    if (!world) return;
    this.loadLevel(world.id);
    const last = worldSave.all().lastZone;
    const zone = last ? this.level.zones?.find((z) => z.id === last) : undefined;
    if (zone && zone !== this.zone) {
      this.teleportHero(zoneEntry(zone));
      this.zone = zone;
      this.tracker.enterZone(zone);
      this.hud.setZoneName(zone.name);
    }
  }

  /** The sandbox: every word, no hero, no goal. */
  freePlay(): void {
    const free = menuLevels().find((l) => !l.goal);
    if (free) this.loadLevel(free.id);
  }

  /** The ☰ button: the Journal in the open world, else the title screen (to switch modes). */
  showLevels(): void {
    if (this.level?.tasks && !this.titleMode) this.showJournal();
    else this.showTitle();
  }

  /** The open world's Journal: every task by zone, done ticks from the save, hints and ways found. */
  showJournal(): void {
    const list = this.level.tasks;
    if (!list) return;
    this.keys.clear();
    const saved = worldSave.all().tasks;
    const groups = (this.level.zones ?? [])
      .map((z) => ({
        name: z.name,
        here: z === this.zone,
        tasks: list.filter((t) => t.zone === z.id).map((t) => ({ title: t.title, hint: t.hint, done: !!saved[t.id], ways: saved[t.id]?.ways.length ?? 0 })),
      }))
      .filter((g) => g.tasks.length);
    this.hud.showJournal({ zones: groups, spells: this.words, onFreePlay: () => this.freePlay(), onTitle: () => this.showTitle() });
  }

  /** J: opens or closes the Journal. */
  toggleJournal(): void {
    if (this.hud.journalOpen) this.hud.hideOverlay();
    else if (!this.hud.overlayOpen) this.showJournal();
  }

  // ------------------------------------------------------------ levels
  loadLevel(id: string): void {
    const level = orderedLevels().find((l) => l.id === id);
    if (!level) return;
    this.titleMode = false;
    this.level = level;
    this.won = false;
    this.failed = false;
    this.words = 0;
    this.lastResult = null;
    clearTimeout(this.winTimer);
    this.hud.hideWin();
    this.world.clear();
    const islands = level.islands ?? (level.terrain === null ? [] : [level.terrain ?? {}]);
    const terrain = islands.map((t) => ({ ...DEFAULT_TERRAIN, ...t }));
    const key = JSON.stringify(terrain);
    if (key !== this.terrainKey) {
      this.world.setIslands(terrain);
      this.terrainKey = key;
    }
    this.renderer.setRange(level.view ?? null);
    level.setup(this.world);
    this.zone = level.zones && level.hero ? zoneAt(...level.hero, level.zones) : null;
    if (level.hero) this.spawnHero(level.hero);
    this.tracker.reset(level.tasks ?? []);
    if (this.zone) this.tracker.enterZone(this.zone, false);
    this.trackerAcc = Infinity;
    if (level.camera) this.renderer.setView(level.camera.position, level.camera.target);
    const sp = level.spawnPoint ?? [0, 0, 0];
    const g = this.world.groundAt(sp[0], sp[2]);
    this.marker.set(new Vector3(sp[0], sp[1] || (Number.isFinite(g) ? g : 0), sp[2]));
    this.hud.autoFocus = !level.hero;
    this.hud.setLevel(level);
    if (this.zone) this.hud.setZoneName(this.zone.name);
    if (level.hero) this.hud.input.blur();
    this.tutorial.onLevel(level);
  }

  /** R and the reset button: the current zone in the open world, else the whole level. */
  restart(): void {
    if (this.level.tasks) this.resetZone();
    else this.loadLevel(this.level.id);
  }

  /**
   * Resets only the hero's zone (the one they were last in while on a bridge):
   * removes its props and every unpinned thing cast there or lying there,
   * forgets its task progress since the last setup, runs the zone's (and its
   * tasks') setup again without rebuilding statics, and puts the hero at the
   * zone entry. Other zones are left as they are.
   */
  resetZone(): void {
    const zone = this.zone;
    const list = this.level.tasks;
    if (!zone || !list) {
      this.loadLevel(this.level.id);
      return;
    }
    const w = this.world;
    for (const e of w.living()) {
      if (e === w.hero) continue;
      const mine = e.state.zone === zone.id || e.state.castZone === zone.id || (!e.state.pinned && zoneAt(e.x, e.y, e.z, this.level.zones) === zone);
      if (mine) w.remove(e, 'zoneReset');
    }
    this.tracker.resetZone(zone);
    w.skipStatics = true;
    try {
      buildZone(w, zone, list);
    } finally {
      w.skipStatics = false;
    }
    this.tracker.armZone(zone);
    const entry = zoneEntry(zone);
    if (w.hero?.alive) this.teleportHero(entry);
    else this.spawnHero(entry);
    this.zone = zone;
    this.tracker.enterZone(zone);
    this.trackerAcc = Infinity;
    const g = w.groundAt(entry[0], entry[2] - 3);
    this.marker.set(new Vector3(entry[0], Number.isFinite(g) ? g : entry[1], entry[2] - 3));
    w.aim = null;
    if (w.hero?.alive) this.fx.sparkle(w.hero.body.position);
    this.hud.toasts.show(`${zone.name} is back to how it started.`, { kind: 'info', duration: 1800 });
  }

  /** Max cast distance (horizontal, from the hero) for a spell aimed at a point, or null for anywhere. */
  castRangeAt(x: number, y: number, z: number): number | null {
    const limit = this.level.tasks ? castLimitAt(x, y, z, this.level.tasks) : null;
    return limit ?? this.level.castRange ?? null;
  }

  /** Moves the hero to a feet position (y omitted: the ground there) and brings the camera along. */
  teleportHero(at: [number, number] | V3): V3 {
    const h = this.world.hero;
    if (!h?.alive) throw new Error('no hero in this level');
    const [x, z] = at.length === 3 ? [at[0], at[2]] : at;
    const g = this.world.groundAt(x, z);
    const y = at.length === 3 ? at[1] : Number.isFinite(g) ? g : 0;
    h.body.position.set(x, y + h.size.y / 2 + 0.05, z);
    h.body.velocity.set(0, 0, 0);
    h.body.wakeUp();
    const c = this.renderer.controls.target, cam = this.renderer.camera.position;
    cam.set(cam.x + x - c.x, cam.y, cam.z + z - c.z);
    c.set(x, c.y, z);
    return [x, y, z];
  }

  /** Spawns the keyboard-controlled hero at its feet position. */
  private spawnHero(at: V3): Entity | null {
    const e = this.world.spawnById('hero', { position: { x: at[0], y: at[1], z: at[2] }, grounded: true, silent: true, label: 'you' });
    if (!e) return null;
    this.world.removeTag(e, 'player');
    this.world.removeTag(e, 'animal');
    this.world.addTag(e, 'controlled');
    mark(e, 'hero');
    this.world.hero = e;
    return e;
  }

  /**
   * Updates the hero's zone, but only while they stand on solid ground: a
   * hero falling through a gap keeps the zone they fell from (and respawns there).
   */
  private trackZone(hero: Entity): void {
    const feet = hero.y - hero.size.y / 2;
    const g = this.world.groundAt(hero.x, hero.z);
    if (!Number.isFinite(g) || feet < g - 0.5) return;
    const zone = zoneAt(hero.x, feet, hero.z, this.level.zones) ?? this.zone;
    if (zone && zone !== this.zone) {
      this.tracker.enterZone(zone);
      this.hud.setZoneName(zone.name);
      if (!this.runner) this.hud.showZoneBanner(zone.name);
      this.trackerAcc = Infinity;
    }
    this.zone = zone;
  }

  /** Puts a fallen (or lost) hero back at the start of the level, or at the entry of the zone they were last in. */
  private respawnHero(): void {
    const start = this.zone ? zoneEntry(this.zone) : this.level.hero;
    if (!start) return;
    const old = this.world.hero;
    if (old?.alive) this.world.remove(old, 'respawn');
    const e = this.spawnHero(start);
    if (e) {
      this.fx.poof(e.body.position, ['#fff6a8', '#ffffff'], 1);
      this.fx.sparkle(e.body.position);
      this.hud.toasts.show(this.zone ? `Back to ${this.zone.name}!` : 'Back to the start!', { kind: 'info', duration: 1600 });
    }
  }

  // ------------------------------------------------------------ spells
  /** Aims at a world point, then casts there (used by solutions and the debug hook). */
  castAt(text: string, at: V3): boolean {
    const p = new Vector3(...at);
    this.marker.set(p);
    this.world.aim = { x: p.x, y: p.y, z: p.z };
    return this.cast(text);
  }

  cast(text: string): boolean {
    this.fx.audio.unlock();
    const res = parseSpell(text);
    if (this.level.hero) this.hud.input.blur();
    if (!res.ok) {
      if (res.reason === 'empty') return false;
      this.fizzle();
      const sugg = res.suggestions.length ? res.suggestions : randomWords(3);
      this.hud.toasts.show(`No spell for “${res.word}”. ${res.suggestions.length ? 'Did you mean one of these?' : 'Maybe try one of these:'}`, {
        kind: 'warn',
        title: "Blockspell doesn't know that word yet",
        actions: sugg.map((w) => ({ label: w, onClick: () => this.cast(text.replace(/\S+\s*$/, w)) })),
      });
      return false;
    }
    if (this.level.allowedWords && !this.level.allowedWords.includes(res.def.id)) {
      this.fizzle();
      this.hud.toasts.show(`“${res.def.name}” won't work in this level.`, { kind: 'warn' });
      return false;
    }
    const mp = this.marker.position;
    const range = this.castRangeAt(mp.x, mp.y, mp.z);
    const hero = this.world.hero;
    if (range && hero?.alive && Math.hypot(mp.x - hero.x, mp.z - hero.z) > range) {
      this.fizzle();
      const where = range < (this.level.castRange ?? Infinity) ? 'there' : 'in this level';
      this.hud.toasts.show(`Your magic only reaches ${range} m ${where}. Walk closer, or click nearer to you.`, { kind: 'warn', title: 'Too far away' });
      return false;
    }
    this.hud.pulseInput();
    this.tracker.noteCast(this.zone?.id ?? null, res.def.id);
    if (!this.won) {
      this.words++;
      this.hud.setWords(this.words, this.level.goal ? (this.level.par ?? 2) : null);
    }
    const count = Math.min(res.count, MAX_ENTITIES);
    const base = this.marker.position;
    // nudge repeat casts so things don't land in a perfect tower
    const jitter = this.world.nearby(base, 1.5, (e) => e !== this.world.hero).length > 0 ? 0.5 : 0;
    const yaw = this.castYaw(res.def.orient, base);
    const castZone = this.level.tasks ? this.zone?.id ?? null : null;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = (count > 1 ? 0.6 + count * 0.15 : 0) + jitter * random();
      const x = base.x + Math.cos(angle) * r, z = base.z + Math.sin(angle) * r;
      this.fx.tweens.add({
        duration: 0.001,
        delay: i * 0.14,
        update: () => {},
        done: () => {
          const ground = Math.max(this.world.groundAt(x, z), base.y);
          const scaleGuess = res.adjectives.reduce((s, a) => s * (a.category === 'size' ? (a.id === 'tiny' ? 0.4 : a.id === 'small' ? 0.65 : a.id === 'big' ? 1.6 : 2.4) : 1), 1);
          const e = this.world.spawn(res.def, {
            position: { x, y: ground + 1.2 + scaleGuess * 0.9, z },
            adjectives: res.adjectives,
            label: res.label,
            yaw: yaw ?? random() * Math.PI * 2,
          });
          // a zone reset clears what was cast there, wherever it ended up
          if (castZone) e.state.castZone = castZone;
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
      this.hud.toasts.show(res.def.blurb, { title: `✦ New word: ${name}  (${this.spellbook.count}/${this.spellbook.total})`, kind: 'success' });
    else if (!this.seen.has(res.def.id) && res.def.blurb) this.hud.toasts.show(res.def.blurb, { title: `✦ ${name}`, kind: 'success' });
    this.seen.add(res.def.id);
    if (res.unknownAdjectives.length) {
      const bad = res.unknownAdjectives;
      const sugg = suggestAdjectives(bad[0]);
      this.hud.toasts.show(
        `Blockspell doesn't know “${bad.join('”, “')}” yet, so ${bad.length === 1 ? 'it was' : 'they were'} left out.${sugg.length ? ' Pick one to fix the spell:' : ''}`,
        { kind: 'info', actions: sugg.map((a) => ({ label: a, onClick: () => this.hud.prefill(text.replace(new RegExp(`\\b${bad[0]}\\b`, 'i'), a)) })) },
      );
    }
    return true;
  }

  /** Failed-spell feedback: a small grey puff at the cast point, the error buzz and a shake. */
  private fizzle(): void {
    this.fx.poof(this.marker.position, ['#cfc8e8', '#a9a3c4', '#ffffff'], 0.8);
    this.fx.sound('error');
    this.hud.shakeInput();
  }

  /** Yaw for objects with an `orient` hint, based on the caster → aim direction. */
  private castYaw(orient: 'span' | 'face' | undefined, at: Vector3): number | null {
    if (!orient) return null;
    const h = this.world.hero;
    let from = h?.alive ? { x: h.x, z: h.z } : this.renderer.camera.position;
    if (Math.hypot(at.x - from.x, at.z - from.z) < 0.3) from = this.renderer.camera.position;
    const facing = Math.atan2(at.x - from.x, at.z - from.z);
    return orient === 'span' ? facing - Math.PI / 2 : facing + Math.PI;
  }

  /** Suggestion chips under the spell bar: a few words the player hasn't found yet. */
  private refreshChips(): void {
    const all = spellbookObjects();
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
      if (this.level.hero) this.hud.input.blur();
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!down || e.button !== 0) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved < 6) this.click(e.clientX, e.clientY);
    });
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
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
      const typing = document.activeElement === input;
      if (this.level.tasks && !this.titleMode && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) {
        if (e.code === 'KeyJ' || (e.key === 'Escape' && this.hud.journalOpen)) {
          e.preventDefault();
          this.toggleJournal();
          return;
        }
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || this.hud.overlayOpen) return;
      if (this.level.hero) {
        // hero levels: keys move the hero; Enter (or T or /) opens the spell bar
        if (HERO_KEYS.has(e.code)) {
          this.keys.add(e.code);
          e.preventDefault();
          this.fx.audio.unlock();
        } else if (e.key === 'Enter' || e.code === 'KeyT' || e.key === '/') {
          e.preventDefault();
          this.keys.clear();
          input.focus();
        } else if (e.code === 'KeyR' && !e.repeat) this.restart();
        return;
      }
      if (e.key.length === 1 && /\S/.test(e.key)) input.focus();
      else if (e.key === 'Enter') {
        input.focus();
        e.preventDefault();
      }
    });
  }

  /** Converts held keys into camera-relative hero input. */
  private readKeys(): void {
    const inp = this.world.input;
    const k = this.keys;
    const typing = document.activeElement === this.hud.input;
    const on = (...codes: string[]) => !typing && !this.titleMode && codes.some((c) => k.has(c));
    const fwd = (on('KeyW', 'ArrowUp') ? 1 : 0) - (on('KeyS', 'ArrowDown') ? 1 : 0);
    const side = (on('KeyD', 'ArrowRight') ? 1 : 0) - (on('KeyA', 'ArrowLeft') ? 1 : 0);
    const cam = this.renderer.camera.position, tgt = this.renderer.controls.target;
    let fx = tgt.x - cam.x, fz = tgt.z - cam.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;
    // right = forward × up
    inp.move.x = fx * fwd - fz * side;
    inp.move.z = fz * fwd + fx * side;
    inp.up = fwd > 0;
    inp.down = fwd < 0;
    inp.jump = on('Space');
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
      if (ent && ent !== this.world.hero) {
        this.poke(ent);
        this.fx.sparkle(hitEntity.point, undefined, 10);
      }
      return;
    }
    if (hitGround && hitGround.face && hitGround.face.normal.y > 0.5) this.setAim(hitGround.point);
  }

  /** Bumps an entity into the air (clicking things). */
  poke(ent: Entity): void {
    const b = ent.body;
    if (b.mass === 0) return;
    b.wakeUp();
    const m = b.mass;
    b.applyImpulse(new Vec3((random() - 0.5) * 2 * m, 4.5 * m, (random() - 0.5) * 2 * m));
    b.angularVelocity.set(random() * 4 - 2, random() * 4 - 2, random() * 4 - 2);
    this.fx.sound(ent.def.voice ?? (ent.has('animal') ? 'bark' : 'squeak'), { pitch: 1 / Math.sqrt(ent.scale) });
  }

  private setAim(p: Vector3): void {
    this.marker.set(p);
    this.world.aim = { x: p.x, y: p.y, z: p.z };
    this.fx.sound('click');
    this.fx.burst(p, { count: 8, color: ['#ffd84a', '#fff6a8'], speed: 2, up: 1.5, size: 0.06, life: 0.4, glow: true });
  }

  // ------------------------------------------------------------ loop
  /** Advances the game by `dt` seconds: input, simulation, effects, hero safety net and goal check. */
  tick(dt: number): void {
    if (this.runner) this.runner.update(dt);
    else this.readKeys();
    this.world.update(dt);
    this.fx.update(dt);
    this.marker.update(dt);

    const hero = this.world.hero;
    if (this.level.zones && hero?.alive) this.trackZone(hero);
    if (this.level.hero && (!hero?.alive || hero.y < (this.level.killY ?? -6))) this.respawnHero();

    if (this.level.tasks) {
      this.tracker.update(dt, this.zone);
      this.trackerAcc += dt;
      if (this.trackerAcc >= 0.25) {
        this.trackerAcc = 0;
        this.refreshTracker();
      }
    }
    else if (this.level.goal && !this.won && this.level.goal.check(this.world)) this.win();
    else if (this.level.fail && !this.won && !this.failed) {
      const msg = this.level.fail(this.world);
      if (msg) {
        this.failed = true;
        this.fx.sound('error');
        this.hud.toasts.show('Press R (or ↺) to try again.', { kind: 'error', title: msg, duration: 8000, actions: [{ label: '↺ Retry', onClick: () => this.loadLevel(this.level.id) }] });
      }
    }
  }

  /**
   * The pinned tracker line: the nearest task not yet done (from the save),
   * looking in the hero's zone first, then anywhere.
   */
  private refreshTracker(): void {
    const list = this.level.tasks;
    if (!list) return;
    const saved = worldSave.all().tasks;
    const open = list.filter((t) => !saved[t.id] && !this.tracker.isDone(t.id));
    if (!open.length) {
      this.hud.setTracker(null, 'Every task is done! Press J and try finding new ways.');
      return;
    }
    const here = this.zone ? open.filter((t) => t.zone === this.zone!.id) : [];
    const h = this.world.hero;
    const from = h?.alive ? [h.x, h.z] : [0, 0];
    let best = (here.length ? here : open)[0], bestD = Infinity;
    for (const t of here.length ? here : open) {
      const d = Math.hypot(t.start[0] - from[0], t.start[2] - from[1]);
      if (d < bestD) {
        best = t;
        bestD = d;
      }
    }
    this.hud.setTracker({ title: best.title, zone: best.zone === this.zone?.id ? null : (zones.get(best.zone)?.name ?? null) });
  }

  /** Runs the simulation for `seconds` without rendering (headless checks, screenshots). */
  step(seconds: number, dt = 1 / 60): void {
    for (let t = 0; t < seconds; t += dt) this.tick(dt);
  }

  private win(): void {
    this.won = true;
    const stars = starsFor(this.level, this.words);
    const newBest = progress.record(this.level.id, stars, this.words);
    this.lastResult = { stars, words: this.words };
    this.hud.setGoalDone();
    const h = this.world.hero;
    const p = h?.alive ? h.body.position : this.marker.position;
    this.fx.celebrate({ x: p.x, y: p.y, z: p.z });
    this.world.events.emit('levelComplete', { levelId: this.level.id });
    const levels = menuLevels().filter((l) => l.goal);
    const next = levels[levels.indexOf(this.level) + 1] ?? null;
    const level = this.level;
    clearTimeout(this.winTimer);
    this.winTimer = window.setTimeout(() => {
      if (this.level !== level || this.runner) return;
      this.hud.showWin(
        { level, stars, words: this.words, par: level.par ?? 2, newBest, next },
        () => next && this.loadLevel(next.id),
        () => this.loadLevel(level.id),
      );
    }, 1600);
  }

  /** Smoothly keeps the hero in view while leaving the player free to orbit. */
  private followCamera(dt: number): void {
    const controls = this.renderer.controls;
    controls.autoRotate = this.titleMode;
    controls.autoRotateSpeed = 0.6;
    const h = this.world.hero;
    if (!h?.alive || this.titleMode) return;
    const k = 1 - Math.exp(-dt * 3.5);
    const ty = Math.max(h.y + 0.4, (this.level.killY ?? -6) + 3);
    const d = new Vector3((h.x - controls.target.x) * k, (ty - controls.target.y) * k, (h.z - controls.target.z) * k);
    controls.target.add(d);
    this.renderer.camera.position.add(d);
  }

  private frame = (now: number): void => {
    const dt = Math.min(1 / 20, (now - this.last) / 1000);
    this.last = now;
    this.tick(dt);
    this.followCamera(dt);
    this.tutorial.update(this, dt);
    this.renderer.render(dt, this.fx.shake);
    requestAnimationFrame(this.frame);
  };
}

const HERO_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

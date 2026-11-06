import { Raycaster, Vector2, Vector3, type Fog } from 'three';
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
import { clockText, demoBest } from './levels/demo-best';
import { SolutionRunner } from './levels/solve';
import { starsFor, type LevelDef, type LevelObjective, type LevelSolution, type V3 } from './levels/types';
import type { Entity } from './core/entity';
import type { ObjectDef } from './objects/types';
import { buildZone, castLimitAt, orderedTasks, zoneAt, zoneEntry, zones } from './tasks';
import { worldSave } from './tasks/save';
import { TaskTracker } from './tasks/tracker';
import type { ZoneDef } from './tasks/types';
import { objects, spellbookObjects } from './objects';
import { prewarmObjects } from './core/spawn';
import { hd, onHDChange, setHDEnabled, updateVoxelLOD } from './voxel/hd';
import { parseSpell, randomWords, suggestAdjectives } from './parser/parser';
import { adjectives } from './adjectives';
import { CarryPrompt } from './ui/prompt';
import { Hud, type DemoNews } from './ui/hud';
import { h } from './ui/dom';
import { isTouch } from './ui/touch';
import { CARRY, carryHint, carryKind, grab, handGrab, heldBy, letGo, type Carry, type CarryHint } from './behaviors/lib/carry';
import { board, canRide, engineNote, leave, ridingOf, thrownOff } from './behaviors/lib/ride';
import { lureTarget } from './behaviors/lib/lure';
import { clickUse, isTool } from './behaviors/lib/use';
import { waterSurfaceAt } from './behaviors/lib/water';
import { Spellbook } from './ui/spellbook';
import { ease } from './engine/tween';
import { Reactions } from './ui/reactions';
import { pickVignette } from './surprise';
import { Tutorial } from './ui/tutorial';
import { settings, type Settings } from './settings';
import { sceneUrl, type SceneCast } from './share';
import { SideTools, type ToolId } from './ui/tools';
import { PhotoUI } from './ui/photo';
import { EXPERIMENTS, Trophies, TROPHIES, type Experiment, type TrophyDef } from './trophies';
import { Waypoint } from './engine/waypoint';
import { SKY_LABEL, SKY_NAMES, type SkyName } from './engine/skies';
import { WEATHER_LABEL, WEATHER_NAMES, type WeatherName } from './engine/weather';
import { finalePanel } from './ui/finale-panel';
import { trophiesPanel } from './ui/trophies-panel';
import { shopPanel } from './ui/shop-panel';
import { SHOP, wallet } from './wallet';
import { settingsPanel } from './ui/settings-panel';
import { getAppPanel } from './ui/get-app-panel';
import { isAndroidApp, saveBlob } from './save-file';
import { GamepadInput } from './ui/gamepad';
import { cssFilter, filterById } from './photo-filters';

/** Wires renderer, world, input, parser, levels and HUD together. */
export class Game {
  readonly renderer: Renderer;
  readonly fx: Effects;
  readonly world: GameWorld;
  readonly hud: Hud;
  readonly spellbook: Spellbook;
  readonly tutorial: Tutorial;
  private reactions: Reactions;
  /** The swoop-in when a mode starts from the title screen: the camera eases in from farther out. */
  private intro: { t: number; offset: Vector3 } | null = null;
  private marker = new SpawnMarker();
  /** True while the player has clicked a spot for the next spell. Otherwise spells land in front of the hero. */
  private aimPinned = false;
  /** Under what the hero would grab, or where what they hold would be set down. */
  private carryRing = new SpawnMarker('#7fe3ff');
  /** Free Play: what the pointer is on, and whether it has picked it up yet (a press that doesn't move is a poke). */
  private hand: { e: Entity; pointer: number; lifted: boolean } | null = null;
  private carryPrompt: CarryPrompt;
  /** What the hero can do with the things around them right now; null when the player can't act on it. */
  carryHint: CarryHint | null = null;
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
  /** Free Play: the player clicked a vehicle, and a hero is at the controls until they get out. */
  private pilot = false;
  /** Open world: the zone the hero is in, or was last in while on a bridge (null in classic levels). */
  zone: ZoneDef | null = null;
  /** Open world: checks every task instead of a single level goal. */
  readonly tracker: TaskTracker;
  readonly trophies: Trophies;
  private waypoint!: Waypoint;
  /** Open world: where the tracked task starts (world space), for the beam and the arrow. */
  private waypointAt: V3 | null = null;
  /** Simulation speed: 1 normal, below 1 slow motion, 0 paused (the ⏱ button; photo mode's freeze). */
  timeScale = 1;
  /** Photo mode: HUD hidden, camera free, snap saves a PNG. */
  photo = false;
  private readonly tools: SideTools;
  private photoUI: PhotoUI;
  private toolMode: 'free' | 'hero' | 'world' | null | undefined;
  /** Free Play casts, newest last: what Undo takes back and what a shared link replays. */
  private history: { log: SceneCast; entities: Entity[]; pending: { cancelled: boolean } }[] = [];
  private keys = new Set<string>();
  /** When the player last turned the camera themselves: the riding camera leaves them be for a moment. */
  private orbitedAt = -Infinity;
  /** Hero action keys pressed since the last tick: a tap shorter than a frame still counts. */
  private taps = new Set<string>();
  private pad = new GamepadInput();
  /** Real seconds since the last frame (unscaled by slow-mo): the gamepad camera turns at the same speed on any display. */
  private frameDt = 1 / 60;
  private cycleWasOn = settings.get().cycle;
  /** Frame-rate watch: the on-screen counter and the automatic sharpness drop on slow devices. */
  private fpsEl = h('div.fps-meter.hidden', { 'aria-hidden': 'true' });
  private fpsEma = 60;
  private fpsShownAt = 0;
  private slowFor = 0;
  private autoScale = 1;
  private lastResolution = -1;
  private failed = false;
  private winTimer = 0;
  private terrainKey = '';
  private seen = new Set<string>();
  private last = performance.now();
  private raycaster = new Raycaster();
  private logo?: HTMLElement;
  private trackerAcc = 0;
  private activeObjective: string | null = null;
  /** Guided levels keep the view clear: word and trophy news waits here for the finish panel. Null once shown. */
  private heldNews: DemoNews | null = null;
  /** Seconds of play in a guided level (the demo), shown as its clock and kept as a best time. */
  private runClock = 0;
  private clockRunning = false;
  private clockShown = -1;
  /** The end-of-demo camera move: glides out to the whole island and holds behind the finish panel. */
  private overview: { start: number; from: [Vector3, Vector3]; to: [Vector3, Vector3] } | null = null;
  /** Multi-object casts still spawning (one object every 0.14 s): a zone reset cancels the ones aimed at that zone. */
  private pendingCasts = new Set<{ zone: string | null; x: number; y: number; z: number; left: number; cancelled: boolean }>();

  constructor(root: HTMLElement) {
    this.renderer = new Renderer(root);
    this.fx = new Effects(this.renderer.scene);
    this.world = new GameWorld(this.renderer.scene, this.fx);
    this.renderer.scene.add(this.marker.group, this.carryRing.group);
    this.tracker = new TaskTracker(this);
    this.waypoint = new Waypoint(this.renderer.scene);
    this.trophies = new Trophies((t) => this.onTrophy(t), (x) => this.onExperiment(x));
    this.trophies.watch(this.world.events, this.world);
    this.world.events.on('coin', () => wallet.add(1));
    this.world.events.on('say', ({ text }) => this.hud.toasts.show(text, { duration: 1500 }));
    this.world.events.on('hint', () => this.hud.toasts.show(this.currentHint(), { title: '📖 The book says', kind: 'info', duration: 6000 }));
    this.world.events.on('taskComplete', ({ taskId, first }) => {
      if (first && !this.runner) {
        wallet.add(TASK_REWARD);
        this.hud.toasts.show(`+${TASK_REWARD} coins. Spend them in the 🪙 shop.`, { duration: 2200 });
      }
      const saved = worldSave.all().tasks;
      const total = orderedTasks().length;
      this.trophies.noteTasks(Object.keys(saved).length, saved[taskId]?.ways.length ?? 0, total);
      if (Object.keys(saved).length >= total) this.scheduleFinale();
    });

    const levels = menuLevels();
    this.hud = new Hud(root, {
      onCast: (t) => this.cast(t),
      onLevel: (id) => this.loadLevel(id),
      onReset: () => this.restart(),
      onLevels: () => this.showLevels(),
      onSettings: () => this.openSettings(),
      onMute: (m) => this.fx.audio.setMuted(m),
      onStart: () => this.fx.audio.unlock(),
      onSurprise: () => this.surprise(),
      onHD: () => {
        setHDEnabled(!hd.enabled);
        return hd.enabled;
      },
      onSpellbook: () => {
        this.spellbook.toggle();
        this.hud.bookBtn.classList.remove('has-new');
      },
    }, levels);
    this.spellbook = new Spellbook(spellbookObjects(), adjectives.all(), (w) => this.cast(w));
    this.hud.autocomplete.known = (id) => this.spellbook.has(id);
    root.append(this.spellbook.el);
    this.tutorial = new Tutorial(root);
    this.carryPrompt = new CarryPrompt(root);
    settings.onChange((s) => this.applySettings(s));
    this.reactions = new Reactions(root, this.world);
    this.tools = new SideTools((id) => this.useTool(id));
    this.photoUI = new PhotoUI(root, {
      onSnap: () => this.snap(),
      onFreeze: () => this.toggleFreeze(),
      onExit: () => this.setPhoto(false),
      onFilter: (id) => this.setPhotoFilter(id),
      onClip: typeof MediaRecorder !== 'undefined' ? () => this.recordClip() : undefined,
    });
    root.append(this.tools.el, this.fpsEl);
    this.refreshChips();

    this.bindInput();
    this.renderer.controls.addEventListener('start', () => { this.intro = null; this.overview = null; });
    this.loadLevel(levels.find((l) => !l.goal)?.id ?? levels[0].id);
    this.hud.setHD(hd.enabled);
    // HD meshes for the hero and every castable object, built in the background so spawns don't wait
    const prewarm = () => prewarmObjects([...objects.all().filter((d) => d.tags.includes('player')), ...spellbookObjects(), ...objects.all().filter((d) => d.levelOnly)]);
    if (hd.enabled) prewarm();
    onHDChange((on) => {
      this.hud.setHD(on);
      if (on) prewarm();
    });
    requestAnimationFrame(this.frame);
  }

  /** Title screen over the current scene: Explore (the open world) or Free Play (the sandbox). */
  showTitle(logo?: HTMLElement): void {
    if (logo) this.logo = logo;
    this.titleMode = true;
    this.keys.clear();
    this.hud.showTitle({
      logo: this.logo,
      onDemo: () => { this.loadLevel('demo'); this.startIntro(); },
      exploreLabel: '▶ Explore',
      onExplore: () => this.explore(),
      onFreePlay: () => this.freePlay(),
      onSurprise: () => this.freePlay(true),
      onSettings: () => this.openSettings(),
      onGetApp: () => this.openGetApp(),
      extra: [h('button.link-btn.trophy-link', { type: 'button', text: `🏆 Trophies ${this.trophies.unlockedCount}/${TROPHY_TOTAL}`, onClick: () => this.openTrophies() })],
    });
  }

  /** Pushes the player's settings into audio, effects, camera and tips. */
  private applySettings(s: Settings): void {
    this.fx.audio.setVolumes({ music: s.music, sfx: s.sfx });
    this.fx.screen.calm = s.reduceEffects;
    this.fx.shake.enabled = s.shake;
    this.tutorial.setEnabled(s.tips);
    this.renderer.controls.rotateSpeed = s.orbit;
    this.renderer.life.enabled = s.life;
    this.renderer.setBloom(s.bloom);
    this.applyScale();
    this.fpsEl.classList.toggle('hidden', !s.fps);
    // turning the day and night cycle back on restarts it, even after a manual sky choice or a load with it off
    if (s.cycle && !this.cycleWasOn && this.level?.tasks) this.skyAuto = true;
    this.cycleWasOn = s.cycle;
  }

  /** The ⬇ panel with every way to install or download the game. */
  openGetApp(): void {
    this.keys.clear();
    this.hud.showPanel(getAppPanel(() => (this.titleMode ? this.showTitle() : this.hud.hideOverlay())));
  }

  /** The ⚙ panel. Back returns to the title screen if that's where it was opened from. */
  openSettings(): void {
    this.keys.clear();
    const back = () => (this.titleMode ? this.showTitle() : this.hud.hideOverlay());
    this.hud.showPanel(
      settingsPanel({
        hdOn: () => hd.enabled,
        toggleHD: () => {
          setHDEnabled(!hd.enabled);
          return hd.enabled;
        },
        resetTips: () => this.tutorial.resetTips(),
        journey: () => this.journeyStats(),
        resetProgress: () => this.eraseProgress(),
        onBack: back,
      }),
    );
  }

  /** Forgets everything saved on this device (levels, world, spellbook, tips) and starts over. */
  /** The numbers in Settings → Your journey. */
  private journeyStats(): [string, string][] {
    const mins = Math.floor(this.trophies.stat('playSeconds') / 60);
    const played = mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
    const tasks = this.level.tasks ?? orderedLevels().find((l) => l.tasks)?.tasks ?? [];
    return [
      [`spells cast`, String(this.trophies.stat('casts'))],
      [`words found`, `${this.spellbook.count} / ${this.spellbook.total}`],
      [`tasks done`, `${Object.keys(worldSave.all().tasks).length} / ${tasks.length}`],
      [`trophies`, `${this.trophies.unlockedCount} / ${TROPHY_TOTAL}`],
      [`experiments`, `${this.trophies.labDone.size} / ${EXPERIMENTS.length}`],
      [`played`, played],
    ];
  }

  private eraseProgress(): void {
    worldSave.reset();
    progress.reset();
    demoBest.reset();
    this.spellbook.reset();
    this.trophies.reset();
    this.tutorial.resetTips();
    try { localStorage.removeItem(SURPRISED); localStorage.removeItem(FINALE); } catch { /* ignore */ }
    window.setTimeout(() => location.reload(), 700);
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
    this.startIntro();
  }

  /** The sandbox: every word, no hero, no goal. */
  freePlay(surpriseNow = false): void {
    const free = menuLevels().find((l) => !l.goal);
    if (!free) return;
    this.loadLevel(free.id);
    this.startIntro();
    // the very first visit opens with a little show, so the magic is on screen before anything is typed
    let seen = false;
    try { seen = !!localStorage.getItem(SURPRISED); } catch { /* no storage: the show just plays each time */ }
    if (surpriseNow || !seen) this.fx.tweens.add({ delay: surpriseNow ? 0.9 : 1.1, duration: 0.01, update: () => {}, done: () => this.surprise(!surpriseNow) });
  }

  private startIntro(): void {
    if (this.fx.screen.calm) return;
    const { camera, controls } = this.renderer;
    this.intro = { t: 0, offset: camera.position.clone().sub(controls.target) };
  }

  /** 🎲 in Free Play: stages a random little scene (see surprise.ts) where the island's center is. */
  surprise(first = false): void {
    if (this.level.goal || this.level.hero || this.level.tasks || this.titleMode) return;
    this.fx.audio.unlock();
    try { localStorage.setItem(SURPRISED, '1'); } catch { /* ignore */ }
    const v = pickVignette();
    const cx = 0, cz = 0;
    for (const step of v.steps) {
      this.fx.tweens.add({
        delay: step.delay,
        duration: 0.001,
        update: () => {},
        done: () => {
          const x = cx + step.at[0], z = cz + step.at[1];
          const g = this.world.groundAt(x, z);
          this.castAt(step.spell, [x, Number.isFinite(g) ? g : 0, z]);
        },
      });
    }
    this.hud.toasts.show(first ? `${v.blurb} Press 🎲 for another, or write your own word.` : v.blurb, { title: `🎲 ${v.name}`, kind: 'success', duration: first ? 5500 : 3200 });
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
        tasks: list.filter((t) => t.zone === z.id).map((t) => ({ title: t.title, hint: t.hint, answer: firstWay(t), done: !!saved[t.id], ways: saved[t.id]?.ways.length ?? 0 })),
      }));
    this.hud.showJournal({
      zones: groups,
      spells: this.words,
      onFreePlay: () => this.freePlay(),
      onTitle: () => this.showTitle(),
      extra: [h('button.btn.secondary', { type: 'button', text: `🏆 Trophies ${this.trophies.unlockedCount}/${TROPHY_TOTAL}`, onClick: () => this.openTrophies() })],
    });
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
    if (level.id !== this.level?.id) {
      // a different level starts in daylight and clear weather; Explore starts the day and night cycle
      this.setSky('day', 0);
      this.setWeather('clear');
      this.skyAuto = !!level.tasks && settings.get().cycle;
      this.skyClock = 0;
    }
    this.titleMode = false;
    this.level = level;
    this.won = false;
    this.failed = false;
    this.words = 0;
    this.runClock = 0;
    this.clockRunning = false;
    this.clockShown = -1;
    this.activeObjective = null;
    this.heldNews = level.objectives ? { words: [], trophies: [], experiments: 0 } : null;
    this.overview = null;
    this.lastResult = null;
    clearTimeout(this.winTimer);
    this.hud.hideOverlay();
    this.reactions.clear();
    this.world.clear();
    this.pendingCasts.clear();
    this.history = [];
    this.waypointAt = null;
    this.waypoint.target(null);
    const islands = level.islands ?? (level.terrain === null ? [] : [level.terrain ?? {}]);
    const terrain = islands.map((t) => ({ ...DEFAULT_TERRAIN, ...t }));
    const key = JSON.stringify(terrain);
    if (key !== this.terrainKey || this.world.islandsCut) {
      this.world.setIslands(terrain);
      this.terrainKey = key;
      this.world.islandsCut = false;
    }
    this.world.flightLimit = level.islands ? 75 : 45;
    this.pilot = false;
    this.renderer.setRange(level.view ?? null);
    level.setup(this.world);
    this.zone = level.zones && level.hero ? zoneAt(...level.hero, level.zones) : null;
    if (level.hero) this.spawnHero(level.hero);
    this.tracker.reset(level.tasks ?? []);
    if (this.zone) {
      this.tracker.enterZone(this.zone, false);
      this.trophies.noteZone(this.zone.id);
    }
    this.trackerAcc = Infinity;
    if (level.camera) this.renderer.setView(level.camera.position, level.camera.target);
    const sp = level.spawnPoint ?? [0, 0, 0];
    const g = this.world.groundAt(sp[0], sp[2]);
    this.marker.set(new Vector3(sp[0], sp[1] || (Number.isFinite(g) ? g : 0), sp[2]));
    this.aimPinned = false;
    this.hud.autoFocus = !level.hero;
    this.hud.setLevel(level);
    if (level.objectives) this.refreshObjectives();
    this.refreshChips();
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
    for (const p of this.pendingCasts) {
      if (p.zone === zone.id || zoneAt(p.x, p.y, p.z, this.level.zones) === zone) {
        p.cancelled = true;
        this.pendingCasts.delete(p);
      }
    }
    for (const e of w.living()) {
      if (e === w.hero) continue;
      const mine = e.state.zone === zone.id || e.state.castZone === zone.id || (!e.state.pinned && zoneAt(e.x, e.y, e.z, this.level.zones) === zone);
      if (mine) w.remove(e, 'zoneReset');
    }
    w.flushRemovals();
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
    this.aimPinned = false;
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
    if (h.state.riding && !leave(this.world, h)) thrownOff(h);
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
    // Free Play's pilot is nobody in particular: what the shop sells is for the hero of the islands
    const shirt = this.level.hero ? SHOP.find((i) => i.id === wallet.shirt)?.color : undefined;
    const color = shirt ? adjectives.get(shirt) : undefined;
    const e = this.world.spawnById('hero', { position: { x: at[0], y: at[1], z: at[2] }, grounded: true, silent: true, label: 'you', adjectives: color ? [color] : undefined });
    if (!e) return null;
    e.state.boots = wallet.owns('boots');
    this.world.removeTag(e, 'player');
    this.world.removeTag(e, 'animal');
    this.world.addTag(e, 'controlled');
    mark(e, 'hero');
    this.world.hero = e;
    return e;
  }

  /** Keys drive a hero: always in hero levels, and in Free Play while someone's at the controls. */
  private get steering(): boolean {
    return !!this.level.hero || this.pilot;
  }

  /** Free Play: puts a hero at the controls of what the player clicked. Returns false if it's not to be driven. */
  pilotClick(v: Entity): boolean {
    const wear = v.has('wearable') && !v.has('held') && !v.has('ghost');
    if (!this.isFreePlay || this.pilot || this.titleMode || !(canRide(v) || wear)) return false;
    const h = this.spawnHero([v.x, v.y - v.size.y / 2, v.z]);
    if (!h) return false;
    h.state.pilot = true;
    this.pilot = true;
    this.hud.autoFocus = false;
    this.hud.input.blur();
    this.tutorial.touch.setHero(true);
    if (wear) grab(this.world, h, v);
    else board(this.world, h, v);
    return true;
  }

  /** Free Play: the pilot is out, or lost their vehicle. They vanish, and the pointer is the hand again. */
  private endControls(): void {
    const h = this.world.hero;
    this.pilot = false;
    this.keys.clear();
    this.hud.autoFocus = true;
    this.tutorial.touch.setHero(false);
    if (h?.alive) {
      if (h.state.riding) thrownOff(h);
      this.fx.poof(h.body.position, ['#fff6a8', '#ffffff'], 0.7);
      this.world.remove(h, 'respawn');
      // out over the void there's nothing left to look at
      if (!Number.isFinite(this.world.groundAt(h.x, h.z)) && this.level.camera) this.renderer.setView(this.level.camera.position, this.level.camera.target);
    }
    this.world.hero = null;
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
      this.trophies.noteZone(zone.id);
      this.tracker.enterZone(zone);
      this.hud.setZoneName(zone.name);
      if (!this.runner) this.hud.showZoneBanner(zone.name);
      this.trackerAcc = Infinity;
    }
    this.zone = zone;
  }

  /**
   * The hero can't swim: waist deep in a lake (a level's pool, not water they cast) for half a second,
   * they are fished out and put back at the zone entry.
   */
  private swimming(hero: Entity, dt: number): boolean {
    if (hero.state.riding) return false;
    const feet = hero.y - hero.size.y / 2;
    const surface = waterSurfaceAt(this.world, hero.x, feet + 0.05, hero.z, (w) => !!w.def.levelOnly);
    const t = surface !== null && surface - feet > 0.5 ? ((hero.state.swimT as number) ?? 0) + dt : 0;
    hero.state.swimT = t;
    return t > 0.5;
  }

  /** Puts a fallen (or lost) hero back at the start of the level, or at the entry of the zone they were last in. */
  private respawnHero(swam = false): void {
    const start = this.zone ? zoneEntry(this.zone) : this.level.hero;
    if (!start) return;
    const old = this.world.hero;
    if (old?.alive) this.world.remove(old, 'respawn');
    const e = this.spawnHero(start);
    if (e) {
      this.fx.poof(e.body.position, ['#fff6a8', '#ffffff'], 1);
      this.fx.sparkle(e.body.position);
      const back = this.zone ? `Back to ${this.zone.name}!` : 'Back to the start!';
      this.hud.toasts.show(swam ? `Splash! You can't swim. ${back}` : back, { kind: 'info', duration: swam ? 2400 : 1600 });
    }
  }

  // ------------------------------------------------------------ spells
  /** Where the next spell lands: the spot the player clicked, or else in front of the hero (or the view). */
  castPoint(): Vector3 {
    if (!this.aimPinned) this.followDefaultAim();
    return this.marker.position;
  }

  /** Moves the marker to the default spot, in front of the hero. */
  private followDefaultAim(): void {
    const p = this.defaultAim();
    this.marker.follow(p.x, p.y, p.z);
  }

  /**
   * The default place for a spell: a step or two in front of the hero, on whatever is there. A wall or
   * ledge in the way brings it closer; a gap leaves it hanging at the hero's feet height, so a plank
   * cast at the edge falls across. With no hero (Free Play) it is the middle of the view, a little below
   * the center of the screen.
   */
  private defaultAim(): Vector3 {
    const hero = this.world.hero;
    if (hero?.alive) {
      const yaw = typeof hero.state.yaw === 'number' ? hero.state.yaw : 0;
      const dx = Math.sin(yaw), dz = Math.cos(yaw);
      const feet = hero.y - hero.size.y / 2;
      const reach = Math.min(1.7, (this.level?.castRange ?? Infinity) * 0.6);
      let x = hero.x, z = hero.z, y = feet;
      for (const f of [1, 0.7, 0.4]) {
        x = hero.x + dx * reach * f;
        z = hero.z + dz * reach * f;
        const g = this.world.groundAt(x, z);
        if (!Number.isFinite(g)) { y = feet; continue; }
        if (g > feet + 0.9) continue; // a wall or a high ledge: nearer
        y = g < feet - 1 ? feet : g; // a drop leaves it at the hero's level
        return new Vector3(x, y, z);
      }
      return new Vector3(x, feet, z);
    }
    // no hero: the ground a little below the center of the screen, found without raycasting the terrain
    const t = this.renderer.controls.target;
    const gy = this.world.groundAt(t.x, t.z);
    const y = Number.isFinite(gy) ? gy : t.y;
    this.raycaster.setFromCamera(new Vector2(0, -0.2), this.renderer.camera);
    const { origin, direction } = this.raycaster.ray;
    if (direction.y < -0.05) {
      const k = (y - origin.y) / direction.y;
      const reach = Math.hypot(origin.x - t.x, origin.z - t.z) + 8;
      if (k > 0 && k * Math.hypot(direction.x, direction.z) < reach) return new Vector3(origin.x + direction.x * k, y, origin.z + direction.z * k);
    }
    return new Vector3(t.x, y, t.z);
  }

  /** Aims at a world point, then casts there (used by solutions and the debug hook). */
  castAt(text: string, at: V3): boolean {
    const p = new Vector3(...at);
    this.marker.set(p);
    this.aimPinned = true;
    this.world.aim = { x: p.x, y: p.y, z: p.z };
    return this.cast(text);
  }

  cast(text: string): boolean {
    this.fx.audio.unlock();
    const res = parseSpell(text);
    if (this.steering) this.hud.input.blur();
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
    if (!this.aimPinned) this.followDefaultAim();
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
      this.hud.setWords(this.words, this.level.goal && !this.level.objectives ? (this.level.par ?? 2) : null);
    }
    const count = Math.min(res.count, MAX_ENTITIES);
    const base = this.marker.position.clone(); // the marker itself keeps moving with the hero
    // food aimed near a hungry animal but out of its reach (on a pen wall, past a fence) lands by the animal instead
    const lure = lureTarget(this.world, res.def, base, (p) => {
      const r = this.castRangeAt(p.x, p.y, p.z);
      return !(r && hero?.alive && Math.hypot(p.x - hero.x, p.z - hero.z) > r);
    });
    if (lure) {
      base.set(lure.x, lure.y, lure.z);
      this.fx.sparkle(base, undefined, 10);
    }
    this.aimPinned = false; // a clicked spot is for one spell; the next one lands in front of the hero again
    // nudge repeat casts so things don't land in a perfect tower
    const jitter = this.world.nearby(base, 1.5, (e) => e !== this.world.hero).length > 0 ? 0.5 : 0;
    const yaw = this.castYaw(res.def.orient, base);
    // aimed at the floor under an overhang (an arch, a ledge): spawn under it, not on top of it
    const covered = this.world.groundAt(base.x, base.z) > base.y + 1;
    const castZone = this.level.tasks ? this.zone?.id ?? null : null;
    const pending = { zone: castZone, x: base.x, y: base.y, z: base.z, left: count, cancelled: false };
    this.pendingCasts.add(pending);
    const entry = { log: { spell: text.trim(), x: base.x, z: base.z }, entities: [] as Entity[], pending };
    if (this.isFreePlay) {
      this.history.push(entry);
      if (this.history.length > 80) this.history.shift();
    }
    if (this.timeScale === 0) this.setTimeScale(1); // casting is how you un-pause, in every mode
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = (count > 1 ? 0.6 + count * 0.15 : 0) + jitter * random();
      const x = base.x + Math.cos(angle) * r, z = base.z + Math.sin(angle) * r;
      this.fx.tweens.add({
        duration: 0.001,
        delay: i * 0.14,
        update: () => {},
        done: () => {
          if (--pending.left <= 0) this.pendingCasts.delete(pending);
          if (pending.cancelled) return;
          const ground = covered ? base.y : Math.max(this.world.groundAt(x, z), base.y);
          const scaleGuess = res.adjectives.reduce((s, a) => s * (a.category === 'size' ? (a.id === 'tiny' ? 0.4 : a.id === 'small' ? 0.65 : a.id === 'big' ? 1.6 : 2.4) : 1), 1);
          const e = this.world.spawn(res.def, {
            position: { x, y: ground + 1.2 + scaleGuess * 0.9, z },
            adjectives: res.adjectives,
            label: res.label,
            yaw: yaw ?? random() * Math.PI * 2,
          });
          // a zone reset clears what was cast there, wherever it ended up
          if (castZone) e.state.castZone = castZone;
          entry.entities.push(e);
        },
      });
    }

    const fresh = this.spellbook.discover(res.def.id, res.adjectives.map((a) => a.id));
    this.trophies.noteCast({ adjectives: res.adjectives.map((a) => a.id), night: this.renderer.skyPreset === 'night' });
    this.trophies.noteWords(this.spellbook.count, this.spellbook.total);
    if (fresh.object || fresh.adjectives.length) {
      if (!this.spellbook.isOpen) this.hud.bookBtn.classList.add('has-new');
      this.fx.sound('chime', { volume: 0.5 });
      this.refreshChips();
    }

    const name = (count > 1 ? `${count} × ` : '') + res.label;
    if (fresh.object) this.heldNews?.words.push(res.def.name);
    // say what Blockspell understood whenever it wasn't exactly what was typed
    const heard = res.correctedFrom
      ? `Guessing you meant “${res.def.name}”.`
      : res.approxFrom
        ? `Blockspell has no “${res.approxFrom}” yet, so you got the closest thing it knows: ${res.def.name}.`
        : res.randomFrom
          ? `“${res.randomFrom}” is a whole kind of thing, so Blockspell picked one: ${res.def.name}.`
          : null;
    if (heard) this.hud.toasts.show(heard, { title: `✦ ${name}`, kind: 'success' });
    else if (this.heldNews) { /* the finish panel lists new words */ }
    else if (fresh.object && res.def.blurb)
      this.hud.toasts.show(this.blurbOf(res.def), { title: `✦ New word: ${name}  (${this.spellbook.count}/${this.spellbook.total})`, kind: 'success' });
    else if (!this.seen.has(res.def.id) && res.def.blurb) this.hud.toasts.show(this.blurbOf(res.def), { title: `✦ ${name}`, kind: 'success' });
    this.seen.add(res.def.id);
    if (res.ignoredNouns.length) {
      const extra = res.ignoredNouns;
      this.hud.toasts.show(`A spell conjures one kind of thing, so “${extra.join('”, “')}” ${extra.length === 1 ? 'was' : 'were'} left out. Cast ${extra.length === 1 ? 'it' : 'them'} on ${extra.length === 1 ? 'its' : 'their'} own.`, { kind: 'info' });
    }
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

  /** What to say about a new word. Blurbs talk to a hero, and Free Play's player is a pointer. */
  private blurbOf(def: ObjectDef): string {
    if (!this.isFreePlay) return def.blurb ?? '';
    if (def.ride) return 'Click it to climb in. W and S are throttle and brake, A and D steer, E gets out.';
    if (def.tags.includes('wearable')) return 'Click it to put it on. Space flies, WASD moves, and E takes it off.';
    if (isTool(def)) return 'Drag it onto a tree, a rock or anything else, and hold it there to break it.';
    if (def.use === 'douse') return 'Drag it over a fire to put it out.';
    if (def.use === 'play') return 'Click it to play a note. It rings when things land on it too.';
    if (def.use === 'open' || def.use === 'read' || def.use === 'flip') return 'Click it and see what happens.';
    if (def.tags.includes('edible')) return `${def.blurb ?? ''} Drag it to a hungry animal to feed it.`.trim();
    return def.use && def.use !== 'kick' ? `It takes a hero to use a ${def.name}: try it in Explore or a level.` : (def.blurb ?? '');
  }

  /** Failed-spell feedback: a small grey puff at the cast point, the error buzz and a shake. */
  private fizzle(): void {
    this.fx.poof(this.marker.position, ['#cfc8e8', '#a9a3c4', '#ffffff'], 0.8);
    this.fx.sound('error');
    this.hud.shakeInput();
  }

  /** Yaw for objects with an `orient` hint, based on the caster → aim direction. */
  private castYaw(orient: 'span' | 'face' | 'away' | undefined, at: Vector3): number | null {
    if (!orient) return null;
    const h = this.world.hero;
    let from = h?.alive ? { x: h.x, z: h.z } : this.renderer.camera.position;
    if (Math.hypot(at.x - from.x, at.z - from.z) < 0.3) from = this.renderer.camera.position;
    const facing = Math.atan2(at.x - from.x, at.z - from.z);
    return orient === 'span' ? facing - Math.PI / 2 : orient === 'away' ? facing : facing + Math.PI;
  }

  /** Suggestion chips under the spell bar: a few words the player hasn't found yet. */
  private refreshChips(): void {
    // The demo offers relevant ideas in its task card; random casts distract from the next job.
    if (this.level?.objectives) { this.hud.setWordChips([]); return; }
    const all = spellbookObjects();
    const unknown = all.filter((d) => !this.spellbook.has(d.id));
    const pool = (unknown.length >= 6 ? unknown : all).map((d) => d.name);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.hud.setWordChips(pool.slice(0, 7));
  }



  // ------------------------------------------------------------ finale
  private finaleTimer = 0;

  /** The last task of the world is done: a few seconds of fireworks, then the summary (once per save). */
  private scheduleFinale(): void {
    let seen = false;
    try { seen = !!localStorage.getItem(FINALE); } catch { /* no storage: it shows each time */ }
    if (seen || this.runner) return;
    const level = this.level;
    clearTimeout(this.finaleTimer);
    for (let i = 1; i <= 3; i++)
      this.fx.tweens.add({ delay: i * 0.9, duration: 0.01, update: () => {}, done: () => { const h = this.world.hero; if (h?.alive) this.fx.celebrate({ x: h.x, y: h.y, z: h.z }); } });
    this.finaleTimer = window.setTimeout(() => {
      if (this.level !== level || this.titleMode) return;
      try { localStorage.setItem(FINALE, '1'); } catch { /* ignore */ }
      this.keys.clear();
      const saved = worldSave.all().tasks;
      this.hud.showPanel(
        finalePanel(
          {
            tasks: Object.keys(saved).length,
            ways: Object.values(saved).reduce((n, t) => n + t.ways.length, 0),
            words: this.spellbook.count,
            wordsTotal: this.spellbook.total,
            casts: this.trophies.stat('casts'),
            trophies: this.trophies.unlockedCount,
            trophiesTotal: TROPHY_TOTAL,
          },
          { onKeep: () => this.hud.hideOverlay(), onFreePlay: () => this.freePlay(), onTrophies: () => this.openTrophies() },
        ),
      );
      this.fx.sound('fanfare');
    }, 3600);
  }

  /** Every frame in the open world: points the beam and the arrow at the nearest unfinished task. */
  private updateGuide(dt: number): void {
    const h = this.world.hero;
    const on = settings.get().guide && !!(this.level.tasks || this.level.objectives) && !!this.waypointAt && !!h?.alive && !this.titleMode;
    let angle: number | null = null, dist = 0;
    if (on) {
      const wp = this.waypointAt!;
      const dx = wp[0] - h!.x, dz = wp[2] - h!.z;
      dist = Math.hypot(dx, dz);
      const cam = this.renderer.camera.position, tgt = this.renderer.controls.target;
      const fx = tgt.x - cam.x, fz = tgt.z - cam.z;
      // clockwise from "up the screen" (the camera's forward direction); right = (-fz, fx)
      angle = Math.atan2(-dx * fz + dz * fx, dx * fx + dz * fz);
    }
    this.hud.setCompass(angle, dist);
    this.waypoint.update(dt, on && (this.level.objectives ? dist > 1 : dist > 5) && !this.photo && !this.hud.overlayOpen);
  }

  // ------------------------------------------------------------ tools
  /** Free Play: no goal, no hero, no tasks. */
  get isFreePlay(): boolean {
    return !this.level.goal && !this.level.hero && !this.level.tasks;
  }

  private useTool(id: ToolId): void {
    this.fx.audio.unlock();
    this.fx.sound('uiClick', { volume: 0.5 });
    if (id === 'photo') this.setPhoto(true);
    else if (id === 'speed') this.cycleSpeed();
    else if (id === 'undo') this.undo();
    else if (id === 'clear') this.clearAll();
    else if (id === 'share') void this.shareScene();
    else if (id === 'trophies') this.openTrophies();
    else if (id === 'shop') this.openShop();
    else if (id === 'sky') this.cycleSky();
    else if (id === 'weather') this.cycleWeather();
  }

  // ---- sky and weather
  /** The automatic day and night turning of Explore: seconds into the cycle, and whether it is running. */
  private skyClock = 0;
  private skyAuto = false;

  /** 🌤: day, sunset, night, dawn. Choosing one by hand stops the automatic cycle. */
  cycleSky(): void {
    const next = SKY_NAMES[(SKY_NAMES.indexOf(this.renderer.skyPreset) + 1) % SKY_NAMES.length];
    this.skyAuto = false;
    this.setSky(next);
    this.trophies.noteSky(next);
    this.hud.toasts.show(SKY_LABEL[next], { duration: 1500 });
  }

  setSky(name: SkyName, seconds = 2.5): void {
    this.renderer.setSky(name, seconds);
    this.updateMusicMood();
    this.tools.setBadge('sky', name === 'day' ? '' : name === 'night' ? '🌙' : name === 'sunset' ? '🌇' : '🌅');
  }

  /** Rain and snow set the music's mood; otherwise the time of day does. */
  private updateMusicMood(): void {
    const w = this.renderer.weather.current;
    this.fx.audio.setMusicMood(w !== 'clear' ? w : this.renderer.skyPreset);
  }

  /** 🌦: clear, rain, snow (just for looks and mood: it does not put out fires). */
  cycleWeather(): void {
    const next = WEATHER_NAMES[(WEATHER_NAMES.indexOf(this.renderer.weather.current) + 1) % WEATHER_NAMES.length];
    this.setWeather(next);
    if (next !== 'clear') this.trophies.noteWeather(next);
    this.hud.toasts.show(WEATHER_LABEL[next], { duration: 1500 });
  }

  setWeather(w: WeatherName): void {
    this.renderer.weather.set(w);
    this.updateMusicMood();
    this.fx.audio.setAmbient(w === 'rain' ? 'rain' : w === 'snow' ? 'wind' : null);
    this.tools.setBadge('weather', w === 'rain' ? '🌧' : w === 'snow' ? '❄' : '');
  }

  /** Explore: the sky turns slowly through day, sunset, night and dawn. */
  private stepSkyCycle(dt: number): void {
    if (!this.skyAuto || this.photo || this.titleMode || !settings.get().cycle) return;
    const phases: [SkyName, number][] = [['day', 260], ['sunset', 50], ['night', 150], ['dawn', 50]];
    const total = phases.reduce((n, p) => n + p[1], 0);
    this.skyClock += dt;
    let t = this.skyClock % total;
    let now: SkyName = 'day';
    for (const [name, len] of phases) {
      if (t < len) { now = name; break; }
      t -= len;
    }
    if (this.renderer.skyPreset !== now) this.setSky(now, 14);
  }

  /** The 🏆 panel. */
  openTrophies(): void {
    this.keys.clear();
    const back = () => (this.titleMode ? this.showTitle() : this.hud.hideOverlay());
    this.hud.showPanel(trophiesPanel(this.trophies, back));
  }

  /** The 🪙 panel. A new shirt shows as soon as the panel closes. */
  openShop(): void {
    this.keys.clear();
    let changed = false;
    this.hud.showPanel(shopPanel(() => (changed = true), () => {
      this.hud.hideOverlay();
      const h = this.world.hero;
      if (changed && h?.alive && !h.state.riding) this.dressHero(h);
    }));
  }

  /** Swaps the hero for one in what's bought, on the same spot. */
  private dressHero(old: Entity): void {
    const at: V3 = [old.x, old.y - old.size.y / 2, old.z];
    const yaw = old.state.yaw;
    const held = old.state.held as Entity | null | undefined;
    if (held?.alive) letGo(old, held);
    this.world.remove(old, 'respawn');
    const e = this.spawnHero(at);
    if (e) {
      e.state.yaw = yaw;
      this.fx.sparkle(e.body.position, undefined, 14);
    }
  }

  /** A trophy was just earned: toast, chime and sparkles. */
  private onExperiment(x: Experiment): void {
    if (this.heldNews) { this.heldNews.experiments++; return; }
    this.hud.toasts.show(`${x.name}. Ticked in the lab notebook (🏆 panel).`, { title: `${x.icon} Experiment done`, kind: 'success', duration: 4200 });
    this.fx.sound('chime', { pitch: 1.3, volume: 0.7 });
  }

  private onTrophy(t: TrophyDef): void {
    if (this.heldNews) { this.heldNews.trophies.push(t.name); return; }
    this.hud.toasts.show(t.desc, { title: `${t.icon} Trophy: ${t.name}`, kind: 'success', duration: 5000 });
    this.fx.sound('star', { pitch: 1.2 });
    this.fx.sound('chime', { pitch: 1.5, volume: 0.7 });
    const h = this.world.hero;
    this.fx.sparkle(h?.alive ? h.body.position : this.marker.position, undefined, 24);
  }

  /** Sets which tools show and whether the undo button has anything to undo. Called every frame, cheap. */
  private refreshTools(): void {
    const mode = this.titleMode || this.hud.overlayOpen || this.photo ? null : this.level.tasks ? 'world' : this.level.hero ? 'hero' : 'free';
    if (mode !== this.toolMode) {
      this.toolMode = mode;
      this.tools.setMode(mode);
    }
    if (mode === 'free') {
      this.tools.setEnabled('undo', this.history.length > 0);
      this.tools.setEnabled('clear', this.history.length > 0 || this.world.living().some((e) => e !== this.world.hero));
    }
  }

  setTimeScale(k: number): void {
    this.timeScale = k;
    this.tools.setBadge('shop', wallet.coins ? String(wallet.coins) : '');
    this.tools.setBadge('speed', k === 1 ? '' : k === 0 ? '⏸' : k === 0.5 ? '½×' : '¼×');
    this.tools.setActive('speed', k !== 1);
    this.photoUI.setFrozen(k === 0);
    if (k !== 1) this.world.events.emit('timeBent', { scale: k });
  }

  /** ⏱: normal, half speed, quarter speed, paused, and around again. */
  cycleSpeed(): void {
    const order = [1, 0.5, 0.25, 0];
    this.setTimeScale(order[(order.indexOf(this.timeScale) + 1) % order.length]);
    const label = this.timeScale === 1 ? 'Normal speed' : this.timeScale === 0 ? 'Time is paused. Casting a spell starts it again.' : `${this.timeScale === 0.5 ? 'Half' : 'Quarter'} speed`;
    this.hud.toasts.show(label, { duration: 1600 });
  }

  /** ↶: takes back the last spell you cast in Free Play. */
  undo(): void {
    const last = this.history.pop();
    if (!last) return;
    last.pending.cancelled = true;
    for (const p of this.pendingCasts) if (p === (last.pending as object)) this.pendingCasts.delete(p);
    for (const e of last.entities) if (e.alive) this.world.remove(e, 'undo', 'poof');
    this.fx.sound('poof', { volume: 0.6 });
  }

  /** 🧹: removes everything you cast (not the island). */
  clearAll(): void {
    for (const p of this.pendingCasts) p.cancelled = true;
    this.pendingCasts.clear();
    let n = 0;
    for (const e of this.world.living()) {
      if (e === this.world.hero) continue;
      this.world.remove(e, 'cleared', 'poof');
      n++;
    }
    this.history = [];
    if (n) this.fx.sound('whoosh', { volume: 0.5 });
    this.hud.toasts.show(n ? `Swept away ${n} thing${n === 1 ? '' : 's'}.` : 'Nothing to clear.', { duration: 1600 });
  }

  /** 🔗: a link that rebuilds this scene, copied to the clipboard (or the share sheet on phones). */
  async shareScene(): Promise<void> {
    if (!this.history.length) {
      this.hud.toasts.show('Cast a few spells first, then share the scene.', { kind: 'info' });
      return;
    }
    const url = sceneUrl(this.history.map((h) => h.log));
    this.world.events.emit('shared', { url });
    try {
      if (isTouch && navigator.share) {
        await navigator.share({ title: 'A Blockspell scene', text: 'Watch this scene build itself in Blockspell:', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      this.hud.toasts.show('Anyone who opens it watches your spells cast themselves. It works offline too.', { title: '🔗 Link copied', kind: 'success', duration: 4200 });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return; // closed the share sheet
      // no clipboard (insecure page, old browser): show the link to copy by hand
      const box = h('input.link-box', { type: 'text', readonly: 'true', value: url, 'aria-label': 'Scene link' });
      this.hud.showPanel(h('div.panel', {}, [
        h('h2', { text: '🔗 Share this scene' }),
        h('p', { text: 'Copy this link:' }),
        box,
        h('div.panel-actions', {}, [h('button.btn', { type: 'button', text: 'Done', onClick: () => this.hud.hideOverlay() })]),
      ]));
      box.focus();
      box.select();
    }
  }

  /** Opens Free Play and replays a shared scene's casts, one every half second. */
  playScene(casts: SceneCast[]): void {
    const free = menuLevels().find((l) => !l.goal);
    if (!free || !casts.length) return;
    this.loadLevel(free.id);
    this.startIntro();
    this.hud.toasts.show(`${casts.length} spell${casts.length === 1 ? '' : 's'} are about to cast themselves. Then it's your island.`, { title: '🔗 A shared scene', kind: 'success', duration: 4500 });
    casts.forEach((c, i) => {
      this.fx.tweens.add({
        delay: 1.2 + i * 0.5,
        duration: 0.001,
        update: () => {},
        done: () => {
          const g = this.world.groundAt(c.x, c.z);
          this.castAt(c.spell, [c.x, Number.isFinite(g) ? g : 0, c.z]);
        },
      });
    });
  }

  /** 📷: hides the HUD so the camera can roam free; Snap saves a PNG. */
  setPhoto(on: boolean): void {
    if (this.photo === on) return;
    this.photo = on;
    document.body.classList.toggle('photo-mode', on);
    this.photoUI.show(on);
    this.keys.clear();
    if (on) {
      this.hud.input.blur();
      this.intro = null;
    } else {
      if (this.photoPaused) this.setTimeScale(this.photoPrev);
      this.photoPaused = false;
      this.photoUI.pick('natural');
    }
  }

  private photoFilter = 'natural';
  private clipTimer = 0;

  /** The look chosen in photo mode: shown live on the canvas and baked into saved pictures. */
  private setPhotoFilter(id: string): void {
    this.photoFilter = id;
    this.renderer.gl.domElement.style.filter = cssFilter(filterById(id));
  }

  /** 🎞: records six seconds of the scene as a video file (not filtered: the filter is a picture look). */
  private recordClip(): void {
    if (this.clipTimer) return;
    const canvas = this.renderer.gl.domElement;
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
    if (!mime || !canvas.captureStream) {
      this.hud.toasts.show("This browser can't record clips. Photos still work.", { kind: 'warn' });
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      const name = `blockspell-clip-${stamp}.${mime.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
      void saveBlob(blob, name);
      this.hud.toasts.show(`Saved ${name}`, { title: '🎞 Clip saved', kind: 'success', duration: 4000 });
      this.trophies.bump('clips');
    };
    const LENGTH = 6;
    let left = LENGTH;
    rec.start(250);
    this.photoUI.setRecording(left);
    this.clipTimer = window.setInterval(() => {
      left -= 0.1;
      if (left > 0) {
        this.photoUI.setRecording(left);
        return;
      }
      clearInterval(this.clipTimer);
      this.clipTimer = 0;
      this.photoUI.setRecording(null);
      if (rec.state !== 'inactive') rec.stop();
    }, 100);
  }

  private photoPaused = false;
  private photoPrev = 1;

  /** Photo mode's freeze toggle. */
  private toggleFreeze(): void {
    if (this.timeScale === 0) {
      this.setTimeScale(this.photoPrev || 1);
      this.photoPaused = false;
    } else {
      this.photoPrev = this.timeScale;
      this.photoPaused = true;
      this.setTimeScale(0);
    }
  }

  /** Saves what the camera sees as a PNG and shows it in the corner. */
  private snap(): void {
    const canvas = this.renderer.capture(this.fx.shake, this.fx.screen, filterById(this.photoFilter));
    this.photoUI.flash();
    this.fx.sound('chime', { pitch: 1.5, volume: 0.6 });
    if (!canvas) {
      this.hud.toasts.show("The browser wouldn't let me read the picture.", { kind: 'warn' });
      return;
    }
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const name = `blockspell-${stamp}.png`;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      // on Android saving opens the share sheet, so wait for a tap on the thumbnail instead of opening it every shot
      if (!isAndroidApp()) void saveBlob(blob, name);
      this.photoUI.thumb(url, name, blob);
      this.world.events.emit('photo', { name });
    }, 'image/png');
  }

  // ------------------------------------------------------------ input
  private bindInput(): void {
    const canvas = this.renderer.gl.domElement;
    let down: { x: number; y: number } | null = null;
    // a finger drifts a few pixels during a tap that a mouse never would: fingers get a roomier "that was a tap"
    const slop = (e: PointerEvent) => (e.pointerType === 'mouse' ? 6 : 14);
    // a second finger down (pinch to zoom, two-finger orbit) is never a tap
    const touches = new Set<number>();
    let multi = false;
    // capturing, to get in before the camera controls: dragging a thing mustn't orbit too
    canvas.addEventListener('pointerdown', (e) => {
      this.fx.audio.unlock();
      if (e.pointerType !== 'mouse') {
        touches.add(e.pointerId);
        if (touches.size > 1) multi = true;
      }
      down = { x: e.clientX, y: e.clientY };
      if (this.steering) this.hud.input.blur();
      else if (!this.titleMode && !this.photo && e.button === 0 && !this.hand) {
        const ent = this.entityAt(e.clientX, e.clientY);
        if (ent && carryKind(ent)) {
          this.hand = { e: ent, pointer: e.pointerId, lifted: false };
          canvas.setPointerCapture(e.pointerId);
          e.stopImmediatePropagation();
        }
      }
    }, { capture: true });
    canvas.addEventListener('pointermove', (e) => {
      if (down) this.orbitedAt = performance.now();
      const hand = this.hand;
      if (!hand || e.pointerId !== hand.pointer || !down) return;
      if (!hand.e.alive) this.hand = null;
      else if (hand.lifted) this.moveHand(hand.e, e.clientX, e.clientY);
      else if (Math.hypot(e.clientX - down.x, e.clientY - down.y) >= slop(e)) {
        hand.lifted = true;
        handGrab(this.world, hand.e);
        this.moveHand(hand.e, e.clientX, e.clientY);
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      touches.delete(e.pointerId);
      const wasMulti = multi;
      if (!touches.size) multi = false;
      if (!down || e.button !== 0 || (this.hand && e.pointerId !== this.hand.pointer)) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      const dragged = this.hand?.lifted;
      this.dropHand();
      if (moved < slop(e) && !dragged && !wasMulti && !this.photo) this.click(e.clientX, e.clientY, e.pointerType !== 'mouse'); // photo mode: the pointer only orbits
    });
    canvas.addEventListener('pointercancel', (e) => {
      touches.delete(e.pointerId);
      if (!touches.size) multi = false;
      this.dropHand();
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.dropHand();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('keydown', (e) => {
      const input = this.hud.input;
      if (this.photo) {
        // only the shortcuts used here are consumed: Tab and a focused button's Enter/Space keep their native behavior
        const onButton = e.target instanceof HTMLButtonElement;
        if (e.key === 'Escape' || e.code === 'KeyP') {
          this.setPhoto(false);
          e.preventDefault();
        } else if ((e.code === 'Space' || e.key === 'Enter') && !onButton) {
          if (!e.repeat) this.snap();
          e.preventDefault();
        } else if (e.code === 'KeyF') {
          if (!e.repeat) this.toggleFreeze();
          e.preventDefault();
        } else if (e.key !== 'Tab' && !(onButton && (e.code === 'Space' || e.key === 'Enter'))) e.preventDefault();
        return;
      }
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
      // 1-9 cast pinned spells (Alt+1-9 where plain digits belong to the spell bar)
      const digit = /^Digit([1-9])$/.exec(e.code);
      if (digit && !this.titleMode && !this.hud.overlayOpen && !e.metaKey && !e.ctrlKey && !e.repeat && (e.altKey || (this.steering && !typing))) {
        if (this.hud.hotbar.cast(Number(digit[1]) - 1)) {
          e.preventDefault();
          return;
        }
      }
      if (this.level.tasks && !this.titleMode && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) {
        if (e.code === 'KeyJ' || (e.key === 'Escape' && this.hud.journalOpen)) {
          e.preventDefault();
          this.toggleJournal();
          return;
        }
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || this.hud.overlayOpen) return;
      if (this.steering) {
        // hero levels: keys move the hero; Enter (or T or /) opens the spell bar
        if (HERO_KEYS.has(e.code)) {
          this.keys.add(e.code);
          if (!e.repeat) this.taps.add(e.code);
          e.preventDefault();
          this.fx.audio.unlock();
        } else if (e.key === 'Enter' || e.code === 'KeyT' || e.key === '/') {
          e.preventDefault();
          this.keys.clear();
          input.focus();
        } else if (e.code === 'KeyR' && !e.repeat) {
          if (this.level.hero) this.restart(); // a Free Play scene has no reset key, pilot or not
        }
        else if (e.code === 'KeyP' && !e.repeat) this.setPhoto(true);
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
    const on = (...codes: string[]) => !typing && !this.titleMode && !this.photo && codes.some((c) => k.has(c));
    const fwd = (on('KeyW', 'ArrowUp') ? 1 : 0) - (on('KeyS', 'ArrowDown') ? 1 : 0);
    const side = (on('KeyD', 'ArrowRight') ? 1 : 0) - (on('KeyA', 'ArrowLeft') ? 1 : 0);
    const cam = this.renderer.camera.position, tgt = this.renderer.controls.target;
    let fx = tgt.x - cam.x, fz = tgt.z - cam.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;
    const polled = this.pad.poll();
    const menuWasOpen = this.hud.overlayOpen; // a press that closes a panel must not also act in the world
    this.padButtons();
    // sticks and buttons steer the hero only when the keyboard could (not typing, not in a menu)
    const pad = !typing && !this.titleMode && !this.photo && !menuWasOpen && !this.hud.overlayOpen ? polled : null;
    const px = pad?.move.x ?? 0, pz = pad?.move.y ?? 0;
    // right = forward × up; the stick adds to the keys, clamped so analog tilt keeps its speed
    const mf = Math.max(-1, Math.min(1, fwd - pz)), ms = Math.max(-1, Math.min(1, side + px));
    inp.move.x = fx * mf - fz * ms;
    inp.move.z = fz * mf + fx * ms;
    inp.up = mf > 0.3;
    inp.down = mf < -0.3;
    inp.jump = on('Space') || !!pad?.jump;
    const tapped = (code: string) => on(code) || (!typing && !this.titleMode && this.taps.has(code));
    inp.grab = tapped('KeyE') || !!pad?.grab;
    inp.toss = tapped('KeyF') || !!pad?.toss;
    inp.turn = tapped('KeyQ') || !!pad?.turn;
    inp.use = tapped('KeyC') || !!pad?.use;
    inp.run = on('ShiftLeft', 'ShiftRight') || !!pad?.run;
    inp.drive.x = ms;
    inp.drive.y = mf;
    // right stick orbits the camera around what it looks at
    if (pad && (pad.look.x || pad.look.y)) this.orbitBy(pad.look.x, pad.look.y, this.frameDt);
    this.taps.clear();
  }

  /** Gamepad buttons that act once per press: Start is the Journal, Back the spellbook, Y the spell bar. */
  private padButtons(): void {
    const pressed = this.pad.last;
    if (!pressed.size || this.photo || this.titleMode) return;
    if (pressed.has('start')) {
      if (this.level.tasks) this.toggleJournal();
      else this.spellbook.toggle();
    } else if (pressed.has('select')) this.spellbook.toggle();
    else if (pressed.has('y') && !this.hud.overlayOpen) this.hud.input.focus();
    else if (pressed.has('b') && this.hud.overlayOpen) this.hud.hideOverlay();
  }

  /** Turns the camera around its target (radians per second at full tilt, scaled by the orbit setting). */
  private orbitBy(x: number, y: number, dt: number): void {
    const cam = this.renderer.camera, ctl = this.renderer.controls;
    const t = ctl.target;
    this.orbitedAt = performance.now();
    const k = 2.7 * dt * settings.get().orbit; // 0.045 per frame at 60 fps
    const ox = cam.position.x - t.x, oz = cam.position.z - t.z;
    const a = -x * k * 2.4;
    cam.position.x = t.x + ox * Math.cos(a) - oz * Math.sin(a);
    cam.position.z = t.z + ox * Math.sin(a) + oz * Math.cos(a);
    const r = Math.hypot(cam.position.x - t.x, cam.position.y - t.y, cam.position.z - t.z);
    cam.position.y = Math.max(t.y + 0.6, Math.min(t.y + r * 0.95, cam.position.y + y * k * 8));
    ctl.update();
  }

  /** Points the raycaster through a spot on the screen. */
  private aimRay(cx: number, cy: number): void {
    const rect = this.renderer.gl.domElement.getBoundingClientRect();
    const ndc = new Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.renderer.camera);
  }

  /** The thing under a spot on the screen, unless the ground is in front of it. */
  private entityAt(cx: number, cy: number): Entity | null {
    this.aimRay(cx, cy);
    const hit = this.raycaster.intersectObjects(this.world.living().map((e) => e.mesh), false)[0];
    const ground = this.raycaster.intersectObjects(this.world.pickables(), false)[0];
    return hit && (!ground || hit.distance < ground.distance) ? this.world.entityFromObject(hit.object) : null;
  }

  /** Free Play: sends what's in the pointer's hold to hover above whatever is under the pointer. */
  private moveHand(e: Entity, cx: number, cy: number): void {
    this.aimRay(cx, cy);
    const others = this.world.living((o) => o !== e).map((o) => o.mesh);
    const hit = this.raycaster.intersectObjects([...others, ...this.world.pickables()], false)[0];
    if (hit) (e.state.carry as Carry).at = { x: hit.point.x, y: hit.point.y + e.size.y / 2 + CARRY.hover, z: hit.point.z };
  }

  /** Free Play: lets go of what's in the pointer's hold. It keeps its speed, so a flick throws it. */
  private dropHand(): void {
    if (this.hand?.lifted && this.hand.e.alive) (this.hand.e.state.carry as Carry).mode = 'loose';
    this.hand = null;
  }

  /**
   * Handles a tap or click on the canvas. In a hero level a tap is nearly always "put the next spell
   * here", so it is forgiving: a step's side face, a creature, or a near miss all still aim at the ground
   * where the finger pointed. (Free Play, with no hero, keeps poking things.)
   */
  private click(cx: number, cy: number, touch = false): void {
    this.aimRay(cx, cy);

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
      if (ent && this.pilotClick(ent)) return;
      if (ent && this.isFreePlay && !this.pilot && clickUse(this.world, ent)) return;
      if (ent && ent !== this.world.hero && !ent.has('ridden')) {
        if (this.level.hero) {
          // a tap on a creature or a thing aims at the ground by it, so a bone can land at the dog's paws
          const p = hitEntity.point;
          const out = ent.body.mass === 0 ? this.groundBeside(p, hitEntity.face?.normal) : null; // a wall's side: the ground out from it
          const g = this.world.groundAt(p.x, p.z);
          this.setAim(out ?? new Vector3(p.x, Number.isFinite(g) ? Math.min(g, p.y) : p.y, p.z));
          return;
        }
        this.poke(ent);
        this.fx.sparkle(hitEntity.point, undefined, 10);
      }
      return;
    }
    if (hitGround) {
      if (hitGround.face && hitGround.face.normal.y > 0.5) return this.setAim(hitGround.point);
      // the side of a step or a bank: aim at the top edge it leads to, a bit out from the face
      const p = this.groundBeside(hitGround.point, hitGround.face?.normal);
      if (p) return this.setAim(p);
    }
    // a near miss (the sky, the void past an island's edge): look around the fingertip for ground
    const reach = touch ? 44 : 14;
    for (const r of [reach * 0.5, reach]) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.4;
        this.aimRay(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        const near = this.raycaster.intersectObjects(this.world.pickables(), false)[0];
        if (near?.face && near.face.normal.y > 0.5) return this.setAim(near.point);
      }
    }
  }

  /** Where a ray that struck the side of the terrain (a step, a bank) should aim: the ground just outside the face. */
  private groundBeside(point: Vector3, normal?: Vector3): Vector3 | null {
    if (!normal) return null;
    const x = point.x + normal.x * 0.3, z = point.z + normal.z * 0.3;
    const g = this.world.groundAt(x, z);
    // a face that leads nowhere (the underside of an island, a cliff over the void) isn't ground
    if (!Number.isFinite(g) || g > point.y + 1.2 || g < point.y - 2.5) return null;
    return new Vector3(x, g, z);
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
    this.aimPinned = true;
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
    if (!this.aimPinned && !this.titleMode) this.followDefaultAim();

    const hero = this.world.hero;
    const rode = hero?.alive ? ridingOf(hero) : null;
    const note = rode && !this.titleMode ? engineNote(rode) : null;
    this.fx.audio.engine(note?.throttle ?? null, note?.pitch);
    if (this.pilot && (!hero?.alive || !(hero.state.riding || heldBy(hero)) || hero.y < (this.level.killY ?? -6))) this.endControls();
    if (this.level.zones && hero?.alive) this.trackZone(hero);
    if (this.level.hero && (!hero?.alive || hero.y < (this.level.killY ?? -6))) this.respawnHero();
    else if (hero?.alive && this.level.hero && this.swimming(hero, dt)) this.respawnHero(true);

    if (this.level.objectives && !this.won) {
      // the clock starts with the player's first move or spell, so reading the card first is free
      if (!this.clockRunning && (this.words > 0 || (hero?.alive && Math.hypot(hero.x - (this.level.hero?.[0] ?? hero.x), hero.z - (this.level.hero?.[2] ?? hero.z)) > 0.3))) this.clockRunning = true;
      if (this.clockRunning) this.runClock += dt;
      const sec = Math.floor(this.runClock);
      if (sec !== this.clockShown) {
        this.clockShown = sec;
        this.hud.setObjectiveClock(clockText(this.runClock));
      }
      this.refreshObjectives(true);
    }

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

  /** What a book tells the hero: the hint for the task they're nearest, or for this level. */
  private currentHint(): string {
    const saved = worldSave.all().tasks;
    const open = (this.level.tasks ?? []).filter((t) => !saved[t.id] && !this.tracker.isDone(t.id));
    const h = this.world.hero;
    const near = (t: { start: V3 }) => (h ? Math.hypot(t.start[0] - h.x, t.start[2] - h.z) : 0);
    const task = open.sort((a, b) => near(a) - near(b))[0];
    return task?.hint ?? this.level.hint ?? 'Anything you can write, you can make.';
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
      this.waypointAt = null;
      this.waypoint.target(null);
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
    this.waypointAt = best.start;
    this.waypoint.target({ x: best.start[0], y: best.start[1], z: best.start[2] });
    this.hud.setTracker({ title: best.title, zone: best.zone === this.zone?.id ? null : (zones.get(best.zone)?.name ?? null) });
  }

  /** Runs the simulation for `seconds` without rendering (headless checks, screenshots). */
  step(seconds: number, dt = 1 / 60): void {
    for (let t = 0; t < seconds; t += dt) this.tick(dt);
  }

  /** Check every job, so an inventive player can finish them in any order. */
  private refreshObjectives(check = false): void {
    const list = this.level.objectives;
    if (!list) return;
    if (check) for (const objective of list) {
      const key = `objective:${objective.id}`;
      if (this.world.flags[key] || !objective.check(this.world)) continue;
      this.world.flags[key] = true;
      this.fx.celebrate({ x: objective.at[0], y: objective.at[1], z: objective.at[2] });
      this.fx.sound('chime');
      this.hud.toasts.show(objective.title, { kind: 'success', title: 'Job done!', duration: 2600 });
    }
    const done = (o: LevelObjective) => this.world.flags[`objective:${o.id}`] === true;
    const active = list.find((o) => o.id === this.activeObjective && !done(o)) ?? list.find((o) => !done(o));
    this.activeObjective = active?.id ?? null;
    this.waypointAt = active?.at ?? null;
    this.waypoint.target(active ? { x: active.at[0], y: active.at[1], z: active.at[2] } : null);
    this.hud.setObjectives(list, list.filter(done).map((o) => o.id), active, (id) => {
      this.activeObjective = id;
      this.refreshObjectives();
    }, () => {
      if (!active) return;
      this.setAim(new Vector3(...active.at));
      const hero = this.world.hero, range = this.level.castRange;
      if (range && hero?.alive && Math.hypot(active.at[0] - hero.x, active.at[2] - hero.z) > range) {
        this.hud.toasts.show('Walk a little closer, then cast.', { title: 'Aimed, but out of reach' });
      }
    });
  }

  private win(): void {
    this.won = true;
    const stars = starsFor(this.level, this.words);
    const newBest = progress.record(this.level.id, stars, this.words);
    const record = this.level.objectives && !this.runner ? demoBest.record(this.runClock, this.words) : { prev: null, fasterBest: false, fewerBest: false };
    this.lastResult = { stars, words: this.words };
    this.hud.setGoalDone();
    const h = this.world.hero;
    const p = h?.alive ? h.body.position : this.marker.position;
    // A guided level's last job has just had its own celebration.
    if (!this.level.objectives) this.fx.celebrate({ x: p.x, y: p.y, z: p.z });
    else if (!this.runner) this.startOverview();
    this.world.events.emit('levelComplete', { levelId: this.level.id });
    const levels = menuLevels().filter((l) => l.goal);
    const next = levels[levels.indexOf(this.level) + 1] ?? null;
    const level = this.level;
    clearTimeout(this.winTimer);
    this.winTimer = window.setTimeout(() => {
      if (this.level !== level || this.runner || this.titleMode) return;
      if (level.objectives) {
        const news = this.heldNews ?? { words: [], trophies: [], experiments: 0 };
        this.heldNews = null;
        this.hud.showDemoWin({ words: this.words, stars, par: level.par ?? 4, time: this.runClock, ...record }, news, {
          onExplore: () => this.explore(),
          onRetry: () => this.loadLevel(level.id),
          onKeep: () => { this.overview = null; this.hud.hideOverlay(); },
          onFreePlay: () => this.freePlay(),
        });
        return;
      }
      this.hud.showWin(
        { level, stars, words: this.words, par: level.par ?? 2, newBest, next },
        () => next && this.loadLevel(next.id),
        () => this.loadLevel(level.id),
      );
    }, level.objectives ? (OVERVIEW_GLIDE + OVERVIEW_HOLD) * 1000 : 1600);
  }

  /** Pulls back to the level's opening view so the player sees everything they changed. */
  private startOverview(): void {
    const view = this.level.camera;
    if (!view) return;
    const { camera, controls } = this.renderer;
    const target = new Vector3(...view.target);
    const position = new Vector3(...view.position).sub(target).multiplyScalar(OVERVIEW_ZOOM).add(target);
    this.intro = null;
    // Real time, not frame time: the panel arrives on a timer, so a slow machine mustn't fall behind it.
    const start = performance.now() - (this.fx.screen.calm ? OVERVIEW_GLIDE * 1000 : 0);
    this.overview = { start, from: [camera.position.clone(), controls.target.clone()], to: [position, target] };
  }

  /** Runs the overview. False once it's over, which hands the camera back to the follow code. */
  private stepOverview(): boolean {
    const view = this.overview;
    if (!view) return false;
    const { camera, controls } = this.renderer;
    const t = (performance.now() - view.start) / 1000;
    const k = ease.inOutSine(Math.min(1, t / OVERVIEW_GLIDE));
    camera.position.lerpVectors(view.from[0], view.to[0], k);
    controls.target.lerpVectors(view.from[1], view.to[1], k);
    if (t > OVERVIEW_GLIDE + OVERVIEW_HOLD + 0.1 && !this.hud.overlayOpen) this.overview = null;
    return true;
  }

  /** Smoothly keeps the hero in view while leaving the player free to orbit. */
  private followCamera(dt: number): void {
    const controls = this.renderer.controls;
    controls.autoRotate = this.titleMode;
    controls.autoRotateSpeed = 0.6;
    const h = this.world.hero;
    if (!h?.alive || this.titleMode || this.stepOverview()) return;
    const riding = ridingOf(h);
    const k = 1 - Math.exp(-dt * (riding ? 7 : 3.5));
    const ty = Math.max(h.y + 0.4, (this.level.killY ?? -6) + 3);
    const d = new Vector3((h.x - controls.target.x) * k, (ty - controls.target.y) * k, (h.z - controls.target.z) * k);
    controls.target.add(d);
    this.renderer.camera.position.add(d);
    if (riding && performance.now() - this.orbitedAt > 1800 && riding.body.velocity.length() > 1) this.swingBehind(h.state.yaw as number, dt);
  }

  /** Eases the camera round behind a heading: on board, W is always away from the screen. */
  private swingBehind(yaw: number, dt: number): void {
    const cam = this.renderer.camera.position, t = this.renderer.controls.target;
    const ox = cam.x - t.x, oz = cam.z - t.z;
    const now = Math.atan2(ox, oz);
    let d = yaw + Math.PI - now;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const a = now + d * (1 - Math.exp(-dt * 1.5)), r = Math.hypot(ox, oz);
    cam.x = t.x + Math.sin(a) * r;
    cam.z = t.z + Math.cos(a) * r;
  }

  private stepIntro(dt: number): void {
    const intro = this.intro;
    if (!intro) return;
    intro.t += dt;
    const k = 1 + 1.2 * (1 - ease.outCubic(Math.min(1, intro.t / 2.2)));
    const { camera, controls } = this.renderer;
    camera.position.copy(controls.target).addScaledVector(intro.offset, k);
    if (intro.t >= 2.2) this.intro = null;
  }

  /** Refreshes what the hero could grab or is holding, and the ring and prompt that show it. */
  private updateCarry(dt: number): void {
    const h = this.world.hero;
    const playing = !this.titleMode && !this.runner && !this.hud.overlayOpen && document.activeElement !== this.hud.input;
    const prev = this.carryHint?.entity;
    const hint = (this.carryHint = h?.alive && playing ? carryHint(this.world, h) : null);
    const ring = this.carryRing;
    const inHand = this.hand?.lifted && this.hand.e.alive ? this.hand.e : null;
    const e = inHand ?? hint?.entity;
    const hover = inHand && (inHand.state.carry as Carry).at!;
    const at = hover ? { ...hover, y: hover.y - CARRY.hover } : hint?.verb === 'holding' ? hint.spot : e && { x: e.x, y: e.y, z: e.z };
    ring.group.visible = !!at && !!e && hint?.verb !== 'heavy' && hint?.verb !== 'dragging' && hint?.verb !== 'riding';
    if (at && e) {
      const half = e.size.y / 2 + (hint?.verb === 'holding' ? 0.04 : 0);
      ring.follow(at.x, at.y - half, at.z, Math.max(0.6, Math.hypot(e.size.x, e.size.z) * 1.25));
      if (e !== prev) ring.set(ring.position);
    }
    ring.update(dt);
    this.carryPrompt.update(hint, this.renderer.camera);
  }

  private applyScale(): void {
    const st = settings.get();
    // the player's own choice wins: turning adaptation off, or moving the Sharpness slider, drops the automatic step-down
    if (!st.autoRes || st.resolution !== this.lastResolution) this.autoScale = 1;
    this.lastResolution = st.resolution;
    this.renderer.setRenderScale(st.resolution * this.autoScale);
  }

  /** The fps counter, and a one-way step down in resolution if the frame rate stays low (never in headless runs). */
  private watchFrameRate(real: number): void {
    if (real <= 0 || real > 0.5 || document.hidden) return;
    this.fpsEma += (1 / real - this.fpsEma) * Math.min(1, real * 2);
    const st = settings.get();
    if (st.fps && performance.now() - this.fpsShownAt > 500) {
      this.fpsShownAt = performance.now();
      this.fpsEl.textContent = `${Math.round(this.fpsEma)} fps · ${Math.round(this.renderer.scale * 100)}%`;
    }
    if (!st.autoRes || navigator.webdriver || this.titleMode) return;
    this.slowFor = this.fpsEma < 26 ? this.slowFor + real : Math.max(0, this.slowFor - real);
    if (this.slowFor > 3 && st.resolution * this.autoScale > 0.55) {
      this.slowFor = 0;
      this.autoScale = Math.max(0.5, this.autoScale - 0.15);
      this.applyScale();
      this.hud.toasts.show('Things were running slowly, so I lowered the sharpness a little. Settings → Sharpness changes it.', { title: 'Smoother, softer', kind: 'info', duration: 6000 });
    }
  }

  private playAcc = 0;

  private frame = (now: number): void => {
    this.watchFrameRate((now - this.last) / 1000);
    if (!this.titleMode && !document.hidden) {
      this.playAcc += Math.min(0.25, (now - this.last) / 1000);
      if (this.playAcc >= 5) {
        this.trophies.bump('playSeconds', Math.round(this.playAcc));
        this.playAcc = 0;
      }
    }
    const dt = Math.min(1 / 20, (now - this.last) / 1000);
    this.last = now;
    this.frameDt = dt;
    this.tick(dt * this.fx.screen.pace(dt) * this.timeScale); // hit-stop and slow motion slow the world, not the camera or the UI
    this.refreshTools();
    this.followCamera(dt);
    this.stepIntro(dt);
    this.updateCarry(dt);
    this.updateGuide(dt);
    this.stepSkyCycle(dt);
    this.tutorial.update(this, dt);
    this.reactions.update(dt, this.renderer.camera, !this.titleMode && !this.hud.overlayOpen);
    updateVoxelLOD(this.renderer.camera.position, (this.renderer.scene.fog as Fog).far);
    this.renderer.render(dt, this.fx.shake, this.fx.screen);
    requestAnimationFrame(this.frame);
  };
}

/** The end-of-demo camera move: seconds gliding out, seconds holding before the panel, and how far past the opening view it stops. */
const OVERVIEW_GLIDE = 1.8;
const OVERVIEW_HOLD = 1.7;
const OVERVIEW_ZOOM = 1.15;
const SURPRISED = 'blockspell.surprised.v1';
/** Coins for finishing a task for the first time. */
const TASK_REWARD = 3;
const FINALE = 'blockspell.finale.v1';
const TROPHY_TOTAL = TROPHIES.length;
/** The spells of a task's first scripted solution: the Journal's second hint. */
function firstWay(t: { solutions: LevelSolution[] }): string[] {
  return (t.solutions[0]?.steps ?? []).flatMap((st) => ('cast' in st ? [st.cast] : []));
}

const HERO_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyF', 'KeyQ', 'KeyC', 'ShiftLeft', 'ShiftRight']);

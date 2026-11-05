import { defineLevel, type LevelObjective, type LevelSolution, type SolutionStep } from '../types';
import { fed, firstWithRole, heroInside, heroStandingAbove, place, watchFed } from '../goals';
import { Decor } from '../../tasks/decor';

const objectives: LevelObjective[] = [
  {
    id: 'pup', title: 'Feed the hungry pup', at: [-5, 0, 3],
    instruction: 'Drop a dog treat inside the little stone pen.',
    hint: 'Click inside the pen, press Enter, type "bone", then Enter to cast. The pup also likes steak, burgers, pizza and cookies.',
    spells: ['bone', 'steak'], check: (w) => fed(w, 'demo-pup'),
  },
  {
    id: 'garden', title: 'Grow a tree in the garden', at: [5, 0.2, 3],
    instruction: 'The seed in the square garden needs water.',
    hint: 'Cast "water" on the seed or let a "cloud" rain on it. A "wet seed" can grow too.',
    spells: ['water', 'wet seed', 'cloud'],
    check: (w) => w.living((e) => e.def.id === 'tree' && Math.abs(e.x - 5) < 2 && Math.abs(e.z - 3) < 2).length > 0,
  },
  {
    id: 'lookout', title: 'Climb to the lookout', at: [-4, 0, -2.2],
    instruction: 'Make a way up, then stand on the grassy rock ledge.',
    hint: 'Aim in front of the ledge and cast "ladder". Walk into it and hold W to climb, then step onto the top. "Stairs" work too.',
    spells: ['ladder', 'stairs'], check: (w) => heroInside(w, [-6, 2.4, -7], [-2, 3.5, -3]) && heroStandingAbove(w, 2.4),
  },
  {
    id: 'beacon', title: 'Light the welcome beacon', at: [4, 1.35, -5],
    instruction: 'Bring a flame to the stone bowl to welcome visitors.',
    hint: 'Drop a "torch" into the bowl. Try "fire" or a "flaming box" for another way.',
    spells: ['torch', 'flaming box'], check: (w) => !!firstWithRole(w, 'demo-beacon')?.state.lit,
  },
];

// Whole runs, including walking between stations, checked by solveAll().
const route = (food: string, garden: string, heat: string, stairs = false): LevelSolution => ({
  name: `${food}, ${garden}, ${stairs ? 'stairs' : 'ladder'}, ${heat}`,
  steps: [
    { cast: food, at: [-5, 0, 3] }, { wait: 4 },
    { walkTo: [2, 5], timeout: 12 }, { cast: garden, at: [5, 0.2, 3] }, { wait: 8 },
    { walkTo: [0, 0], timeout: 8 }, { walkTo: [-4, 0.5], timeout: 8 },
    { cast: stairs ? 'stairs' : 'ladder', at: [-4, stairs ? -1.5 : -2.2] }, { wait: 1.5 },
    ...(stairs ? [
      { walkTo: [-4, -2.8], jump: true, timeout: 8 } satisfies SolutionStep,
      { walkTo: [-4, -5], jump: true, timeout: 8 } satisfies SolutionStep,
    ] : [
      { walkTo: [-4, -1.7] } satisfies SolutionStep,
      { hold: { dir: [0, -1], up: true }, for: 3 } satisfies SolutionStep,
      { walkTo: [-4, -5], timeout: 5 } satisfies SolutionStep,
    ]),
    { walkTo: [0, -5], timeout: 10 }, { cast: heat, at: [4, 1.35, -5] },
  ],
  timeout: 15,
});

export default defineLevel({
  id: 'demo', name: 'Welcome island', order: 6, hidden: true,
  description: 'Get the island ready for visitors. Four little jobs, any solution you can imagine.',
  terrain: { seed: 21, radius: 13, flatRadius: 12, hilliness: 0.2, trees: 0, rocks: 0, shrubs: 0 },
  hero: [-3, 0, 6], camera: { position: [7, 12, 18], target: [0, 0.8, 0] },
  spawnPoint: [-5, 0, 3], castRange: 8, par: 4,
  objectives,
  setup(world) {
    // Low walls keep the pup near its food and let the player see into the pen.
    for (const x of [-7, -3]) world.addStaticBox({ position: [x, 0.6, 3], size: [0.35, 1.2, 4.3], color: 'stone' });
    for (const z of [1, 5]) world.addStaticBox({ position: [-5, 0.6, z], size: [4.3, 1.2, 0.35], color: 'stone' });
    place(world, 'dog', [-5, 0, 3], 'demo-pup');
    watchFed(world, 'demo-pup');
    world.addStaticBox({ position: [5, 0.1, 3], size: [3.5, 0.2, 3.5], color: 'dirt' });
    for (const x of [3.25, 6.75]) world.addStaticBox({ position: [x, 0.3, 3], size: [0.2, 0.6, 3.7], color: 'stone' });
    for (const z of [1.25, 4.75]) world.addStaticBox({ position: [5, 0.3, z], size: [3.7, 0.6, 0.2], color: 'stone' });
    place(world, 'seed', [4.4, 0.2, 3], 'demo-seed');
    world.addStaticBox({ position: [-4, 1.25, -5], size: [4, 2.5, 4], color: 'stone', topColor: 'grass' });
    // A parapet stops a held W running off the back: too tall to step over (0.6), low enough to jump.
    // The front (ladders) and east side (the way to the beacon) stay open.
    world.addStaticBox({ position: [-4, 2.875, -6.875], size: [4, 0.75, 0.25], color: 'stone' });
    world.addStaticBox({ position: [-5.875, 2.875, -4.875], size: [0.25, 0.75, 3.75], color: 'stone' });
    place(world, 'beacon', [4, 0, -5], 'demo-beacon');
    new Decor([0, 0, 0]).flowers(-7, -6).flowers(7, -5, 'flowerYellow')
      .flowers(0, 7, 'flowerRed').tree(9, -2).tree(-9, -2).build(world);
  },
  goal: { text: 'Finish the four island jobs', check: (w) => objectives.every((o) => w.flags[`objective:${o.id}`] === true) },
  fail: (w) => !w.flags['objective:pup'] && !firstWithRole(w, 'demo-pup')
    ? 'The pup is gone. Restart the demo to bring it back.' : null,
  solutions: [route('bone', 'water', 'torch'), route('steak', 'wet seed', 'flaming box', true)],
});

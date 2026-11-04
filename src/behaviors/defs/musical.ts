import { defineBehavior } from '../types';

const NOTES = [0, 2, 4, 7, 9, 12, 14, 16]; // a major pentatonic run, in semitones

/** Things that ring when something lands on them: a different note each time. */
export default defineBehavior({
  id: 'musical',
  tags: ['musical'],
  contact(e, other, world, { speed }) {
    if (!other || speed < 0.7) return;
    // count the notes it has rung (the piano task wants three)
    e.state.plinks = ((e.state.plinks as number | undefined) ?? 0) + 1;
    const n = NOTES[Math.floor(Math.random() * NOTES.length)];
    world.fx.sound('chime', { pitch: 2 ** (n / 12) * 0.8, volume: Math.min(1, 0.4 + speed / 6) });
    const p = e.body.position;
    world.fx.burst({ x: p.x, y: p.y + e.size.y * 0.55, z: p.z }, { count: 4, color: ['#ffe27a', '#ffffff', '#9fd8ff'], speed: 1.3, up: 2, gravity: -0.5, size: 0.08, life: 0.9, glow: true });
  },
});

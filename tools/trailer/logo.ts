// Renders the game's own animated voxel logo on a transparent page (used by capture-logo.mjs).
import '../../src/ui/title.css';
import { createVoxelLogo } from '../../src/ui/logo';

const { el } = createVoxelLogo();
document.getElementById('stage')!.append(el);

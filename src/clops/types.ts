import { GridCoord } from '../core/types';

export type ClopPersonality = 'curious' | 'coward' | 'hyperactive';
export type SimulationSpeed = 1 | 2 | 4;

export interface ClopSnapshot {
  id: number;
  personality: ClopPersonality;
  position: GridCoord;
  spawn: GridCoord;
  target: GridCoord | null;
  status: 'active' | 'finished' | 'stuck';
  pathLength: number;
  pathHasHazard: boolean;
  blocked: boolean;
}

export interface ClopPersonalityConfig {
  id: number;
  personality: ClopPersonality;
}

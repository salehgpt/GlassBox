
import { StrategyId } from '../../types';

export const PinnedOutputContract = {
  requiredKeys: ['taskId', 'role', 'status'],
};

export const VettingRules = {
  strategyPhases: {
    h1: ['Phase 1'],
    h2: ['Phase 1', 'Phase 2', 'Phase 3'],
    h3: ['Phase 1'],
    h4: ['Phase 1', 'Phase 2'],
    h5: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'],
  } as Record<StrategyId, string[]>,
};

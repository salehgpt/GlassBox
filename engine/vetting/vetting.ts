import { VettingRules } from '../autonomy/playbook';
import { StrategyId } from '../../types';

export class SelfCorrectionEngine {
  checkArtifact(artifact: string, planStatement: string, strategyId: StrategyId) {
    if (typeof artifact !== 'string' || !artifact) {
      return 'Artifact is missing or invalid, cannot be vetted.';
    }
    if (!artifact.includes(planStatement)) {
      return 'Strategy statement missing from artifact.';
    }
    const requiredPhases = VettingRules.strategyPhases[strategyId] || [];
    for (const phase of requiredPhases) {
      if (!artifact.includes(phase)) {
        return `Missing required section for strategy ${strategyId}: ${phase}.`;
      }
    }
    return null; // No issues found
  }

  run(finalArtifact: string, planStatement: string, strategyId: StrategyId) {
    const validationError = this.checkArtifact(finalArtifact, planStatement, strategyId);
    return {
      approved: !validationError,
      comment: validationError ?? 'Artifact passed self-correction. It is coherent with the chosen strategy and includes all required phases.',
    };
  }
}
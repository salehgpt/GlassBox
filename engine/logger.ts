
import type { NDJSONEvent } from '../../types';

export class NDJSONLogger {
  constructor(private onEmit: (event: NDJSONEvent) => void) {}

  emit(event: Omit<NDJSONEvent, 'ts' | 'runId'>, runId: string) {
    const fullEvent: NDJSONEvent = {
      ...event,
      ts: new Date().toISOString(),
      runId,
    };
    
    // Log to console for debugging
    console.log(JSON.stringify(fullEvent));

    // Emit the event to the UI
    this.onEmit(fullEvent);
  }
}

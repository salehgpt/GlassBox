
import React from 'react';
import type { SessionStatus } from '../types';
import { StopIcon } from './icons/StopIcon';

interface ControlBarProps {
  status: SessionStatus;
  onStop: () => void;
}

const ControlBar: React.FC<ControlBarProps> = ({ status, onStop }) => {
  const isAgentActive = status === 'RUNNING' || status === 'STARTING';

  if (!isAgentActive) {
    return (
        <div className="flex items-center justify-center p-2 text-dark-text-secondary text-sm h-[40px]">
            Agent is not active.
        </div>
    );
  }

  return (
    <div className="flex items-center justify-center space-x-2">
       <button 
        onClick={onStop}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
        <StopIcon />
        Stop
      </button>
    </div>
  );
};

export default ControlBar;

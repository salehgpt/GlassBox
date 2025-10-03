import React from 'react';
import type { SessionStatus, UINode } from '../types';
import { StopIcon } from './icons/StopIcon';
import { CogIcon } from './icons/CogIcon';
import { SearchIcon } from './icons/SearchIcon';
import { CheckIcon } from './icons/CheckIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { FlaskIcon } from './icons/FlaskIcon';

const ToolUsageDisplay: React.FC<{ tool: { name: string } | null }> = ({ tool }) => {
    if (!tool) return null;

    const Icon = tool.name.toLowerCase().includes('search') ? SearchIcon : CogIcon;

    return (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 flex justify-center">
            <div className="flex items-center gap-3 rounded-full bg-black/50 backdrop-blur-md border border-white/10 px-4 py-2 shadow-xl">
                <div className="w-6 h-6 bg-brand-blue/20 text-brand-blue rounded-full flex items-center justify-center animate-pulse">
                    <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-semibold text-white">Using Tool: {tool.name}</span>
            </div>
        </div>
    );
};


const AICore: React.FC<{activeTool: { nodeId: string, name: string } | null}> = ({ activeTool }) => (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-brand-purple/20 via-brand-blue/20 to-dark-bg opacity-50"></div>
      <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-brand-blue/30 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl animate-[pulse_8s_cubic-bezier(0.4,0,0.6,1)_infinite]"></div>
      <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-brand-purple/20 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl animate-[pulse_6s_cubic-bezier(0.4,0,0.6,1)_infinite_2s]"></div>
       <div className="absolute inset-0 flex items-center justify-center text-center text-dark-text">
        {!activeTool && (
            <div>
               <p className="text-2xl font-bold">Discovery Engine</p>
               <p className="text-sm text-dark-text-secondary">Running perpetual discovery loop...</p>
            </div>
        )}
      </div>
    </div>
);

const AppWindow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-full rounded-2xl border border-white/10 bg-black/20 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/50" style={{ transformPerspective: '1200px' }}>
    <div className="absolute top-0 left-0 right-0 h-9 bg-black/20 backdrop-blur border-b border-white/10 flex items-center justify-between px-3">
      <div className="text-xs opacity-90 flex items-center gap-2">
        <span className="flex gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-rose-500"/>
          <span className="inline-block w-3 h-3 rounded-full bg-amber-500"/>
          <span className="inline-block w-3 h-3 rounded-full bg-emerald-500"/>
        </span>
        <span className="ml-2 font-semibold">Discovery Engine — Visualization</span>
      </div>
      <div className="text-[10px] opacity-70">LIVE</div>
    </div>
    <div className="pt-9 h-full">
      {children}
    </div>
  </div>
);

const roleToStepMap: Record<string, string> = {
    'Hypothesize': 'Hypothesize',
    'ExperimentDesign': 'Experiment',
    'DataCollection': 'Experiment',
    'Simulation': 'Experiment',
    'CrossReference': 'Experiment',
    'Analyze': 'Analyze',
    'Validate': 'Validate',
};

const Timeline: React.FC<{ nodes: Record<string, UINode>, onStop: () => void, status: SessionStatus }> = ({ nodes, onStop, status }) => {
    const isAgentActive = status === 'RUNNING' || status === 'STARTING';
    const nodeArray: UINode[] = Object.values(nodes);
    
    const steps = [
        { role: 'Hypothesize', icon: <LightbulbIcon/> },
        { role: 'Experiment', icon: <SearchIcon/> },
        { role: 'Analyze', icon: <FlaskIcon/> },
        { role: 'Validate', icon: <CheckIcon/> },
    ];
    
    let activeStepIndex = -1;
    let isRepairing = false;
    const runningNode = nodeArray.find(n => n.status === 'RUNNING');
    const repairingNode = nodeArray.find(n => n.status === 'REPAIRING');

    if (repairingNode) {
        isRepairing = true;
        const activeStepRole = roleToStepMap[repairingNode.role];
        if(activeStepRole) {
            activeStepIndex = steps.findIndex(s => s.role === activeStepRole);
        }
    } else if (runningNode) {
        const activeStepRole = roleToStepMap[runningNode.role];
        if(activeStepRole) {
            activeStepIndex = steps.findIndex(s => s.role === activeStepRole);
        }
    } else if (status === 'COMPLETED') {
        activeStepIndex = steps.length; // All completed
    } else if (status === 'FAILED') {
        activeStepIndex = -2; // Indicates failure
    }

    return (
        <div className="mt-4 rounded-2xl border border-dark-border p-3 bg-dark-surface/70 backdrop-blur-sm">
            <div className="flex items-center gap-4">
                <div className="flex-1 grid grid-cols-4 gap-2 text-xs">
                    {steps.map((step, i) => {
                        const isCompleted = i < activeStepIndex;
                        const isActive = i === activeStepIndex;
                        const isFailed = activeStepIndex === -2 && i === steps.findIndex(s => s.role === roleToStepMap[nodeArray.find(n => n.status ==='FAILED')?.role || '']);
                        
                        let stepClasses = 'border-dark-border bg-dark-bg text-dark-text-secondary';
                        if (isRepairing && isActive) {
                            stepClasses = 'border-amber-500/50 bg-amber-500/10 text-amber-400 animate-pulse';
                        }
                        else if (isActive) {
                             stepClasses = 'border-brand-blue bg-brand-blue/20 text-brand-blue';
                        } else if (isCompleted) {
                            stepClasses = 'border-status-completed/50 bg-status-completed/10 text-status-completed';
                        } else if (isFailed) {
                            stepClasses = 'border-status-failed/50 bg-status-failed/10 text-status-failed';
                        }
                        
                        return (
                             <div key={step.role} className={`rounded-lg p-2 text-center border transition-all duration-300 ${stepClasses}`}>
                                <div className="flex items-center justify-center gap-1.5 font-semibold">
                                     {React.cloneElement(step.icon, {className: 'h-4 w-4'})} 
                                     <span>{step.role}</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
                 <button 
                    onClick={onStop}
                    disabled={!isAgentActive}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    <StopIcon />
                    Stop
                </button>
            </div>
        </div>
    );
}

const DesktopView: React.FC<{
  sessionStatus: SessionStatus;
  agentStatusText: string;
  uiNodes: Record<string, UINode>;
  onStop: () => void;
  activeTool: { nodeId: string, name: string } | null;
}> = ({ sessionStatus, agentStatusText, uiNodes, onStop, activeTool }) => {
  return (
    <div className="h-full w-full flex flex-col">
        <div className="relative flex-1 rounded-2xl overflow-hidden border border-dark-border bg-dark-bg">
            <div className="absolute h-full w-full" style={{
                backgroundImage: 'radial-gradient(1200px 600px at -20% -20%, rgba(160, 118, 249, 0.2), transparent 60%), radial-gradient(900px 900px at 110% -10%, rgba(0, 169, 255, 0.2), transparent 60%), linear-gradient(120deg, #0D1117 0%, #161B22 100%)'
            }}/>
            <div className="p-6 h-full">
                 <AppWindow>
                    <AICore activeTool={activeTool}/>
                    <ToolUsageDisplay tool={activeTool} />
                 </AppWindow>
            </div>
             <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-center z-20">
                <p className="text-base font-medium text-white shadow-black/50 [text-shadow:_0_1px_2px_var(--tw-shadow-color)]">{agentStatusText}</p>
            </div>
        </div>
        <Timeline nodes={uiNodes} onStop={onStop} status={sessionStatus} />
    </div>
  );
};

export default DesktopView;
import React from 'react';
import { useState, useRef } from 'react';
import type { Message, SessionStatus, Artifact, UINode, NDJSONEvent } from './types';
import { initialMessages } from './constants';
import { useAgentSimulation } from './hooks/useAgentSimulation';
import DesktopView from './components/DesktopStream';
import ChatPanel from './components/ChatPanel';

const TopBar: React.FC<{ status: SessionStatus }> = ({ status }) => {
  const statusConfig: Record<SessionStatus, { label: string, color: string }> = {
    IDLE: { label: 'IDLE', color: 'bg-gray-700' },
    STARTING: { label: 'STARTING', color: 'bg-indigo-600 animate-pulse' },
    RUNNING: { label: 'RUNNING', color: 'bg-emerald-600' },
    PAUSED: { label: 'PAUSED', color: 'bg-yellow-600' },
    AWAITING_APPROVAL: { label: 'AWAITING', color: 'bg-orange-500' },
    STOPPED: { label: 'STOPPED', color: 'bg-rose-600' },
    COMPLETED: { label: 'COMPLETED', color: 'bg-sky-600' },
    FAILED: { label: 'FAILED', color: 'bg-red-700' },
  };
  const { label, color } = statusConfig[status];

  return (
    <header className="px-6 py-3 flex items-center gap-4 border-b border-dark-border bg-dark-surface/50 backdrop-blur-sm z-20">
      <div className="text-xl font-semibold flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-brand-blue/20 flex items-center justify-center border border-brand-blue/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-blue" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V5a1 1 0 00-1.447-.894l-4 2A1 1 0 0011 7v10zM4 17a1 1 0 001.447.894l4-2A1 1 0 0010 15V5a1 1 0 00-1.447-.894l-4 2A1 1 0 004 7v10z" />
            </svg>
        </span>
        AI Agent Workspace — Glassbox
      </div>
      <div className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${color}`}>{label}</div>
      <div className="ml-auto flex items-center gap-4 text-xs text-dark-text-secondary">
        <span>CPU: 18%</span>
        <span>MEM: 256MB</span>
        <span>LATENCY: 48ms</span>
      </div>
    </header>
  );
};

const App: React.FC = () => {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('IDLE');
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [agentStatusText, setAgentStatusText] = useState('Agent is idle.');
  const [isMuted, setIsMuted] = useState(true);
  const [uiNodes, setUiNodes] = useState<Record<string, UINode>>({});
  const [events, setEvents] = useState<NDJSONEvent[]>([]);
  const [activeTool, setActiveTool] = useState<{ nodeId: string, name: string } | null>(null);

  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const {
    startSession,
    stopSession,
    isLoading,
  } = useAgentSimulation({
    setSessionStatus,
    setMessages,
    setArtifacts,
    setAgentStatusText,
    setUiNodes,
    setEvents,
    setActiveTool,
    endOfMessagesRef,
  });

  return (
    <div className="h-screen w-screen bg-dark-bg text-dark-text font-sans flex flex-col overflow-hidden">
      <TopBar status={sessionStatus} />
      <main className="flex-1 grid grid-cols-12 gap-6 p-6 overflow-hidden">
        <div className="col-span-7 h-full flex flex-col gap-4">
          <DesktopView
            sessionStatus={sessionStatus}
            agentStatusText={agentStatusText}
            uiNodes={uiNodes}
            onStop={stopSession}
            activeTool={activeTool}
          />
        </div>
        <div className="col-span-5 h-full min-h-0">
          <ChatPanel
            messages={messages}
            artifacts={artifacts}
            sessionStatus={sessionStatus}
            isLoading={isLoading}
            onSend={startSession}
            onStop={stopSession}
            endOfMessagesRef={endOfMessagesRef}
            uiNodes={uiNodes}
            events={events}
          />
        </div>
      </main>
    </div>
  );
};

export default App;
import React, { useState, useRef, useEffect } from 'react';
import type { Message, Artifact, SessionStatus, UINode, NDJSONEvent } from '../types';
import ChatMessage from './ChatMessage';
import ArtifactsList from './ArtifactsList';
import ThinkingProcess from './ThinkingProcess';

// Define icons as sub-components to avoid creating new files
const GitBranchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>;
const ActivityIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>;
const ChatIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>;

const TraceLog: React.FC<{ events: NDJSONEvent[] }> = ({ events }) => {
    if (events.length === 0) {
        return <div className="text-center text-sm text-dark-text-secondary p-8">No events recorded yet.</div>;
    }
    return (
        <div className="font-mono text-xs text-dark-text-secondary space-y-2">
            {events.map((e, i) => (
                <div key={i} className="flex items-start gap-2">
                    <span className="opacity-60">{new Date(e.ts).toLocaleTimeString()}</span>
                    <span className="text-emerald-400 font-semibold">{e.type}</span>
                    <span className="truncate text-gray-400">{JSON.stringify(e.data)}</span>
                </div>
            ))}
        </div>
    );
};


interface ChatPanelProps {
  messages: Message[];
  artifacts: Artifact[];
  sessionStatus: SessionStatus;
  isLoading: boolean;
  onSend: (prompt: string) => void;
  onStop: () => void;
  endOfMessagesRef: React.RefObject<HTMLDivElement>;
  uiNodes: Record<string, UINode>;
  events: NDJSONEvent[];
}

type TabID = 'chat' | 'thinking' | 'artifacts' | 'trace';

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  artifacts,
  sessionStatus,
  isLoading,
  onSend,
  onStop,
  endOfMessagesRef,
  uiNodes,
  events,
}) => {
  const [prompt, setPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<TabID>('chat');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const handleSendClick = () => {
    if (prompt.trim() && (sessionStatus === 'IDLE' || sessionStatus === 'COMPLETED' || sessionStatus === 'FAILED' || sessionStatus === 'STOPPED')) {
      onSend(prompt.trim());
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  useEffect(() => {
    if (sessionStatus === 'IDLE' && !isLoading) {
      inputRef.current?.focus();
    }
  }, [sessionStatus, isLoading]);
  
  const isAgentActive = sessionStatus === 'RUNNING' || sessionStatus === 'STARTING';

  // This effect handles automatic tab switching based on agent state.
  // It no longer depends on `activeTab` to prevent overriding user interaction.
  useEffect(() => {
    if (isAgentActive && Object.keys(uiNodes).length > 0) {
      setActiveTab('thinking');
    } else if (sessionStatus === 'COMPLETED' && artifacts.length > 0) {
      setActiveTab('artifacts');
    } else if (['IDLE', 'STOPPED', 'FAILED'].includes(sessionStatus)) {
      setActiveTab('chat');
    }
  }, [sessionStatus, uiNodes, artifacts, isAgentActive]);

  const TabButton = ({ id, label, icon, children }: {id: TabID, label: string, icon: React.ReactNode, children?: React.ReactNode}) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-3 text-sm font-semibold transition-colors relative outline-none flex items-center justify-center gap-2 ${activeTab === id ? 'text-brand-blue' : 'text-dark-text-secondary hover:text-dark-text'}`}
    >
      {icon} {label}
      {children}
      {activeTab === id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-blue rounded-full shadow-glow-blue"></span>}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-dark-surface/80 backdrop-blur-md rounded-lg border border-dark-border">
      <div className="border-b border-dark-border flex">
        <TabButton id="chat" label="Chat" icon={<ChatIcon/>} />
        <TabButton id="thinking" label="Thinking" icon={<GitBranchIcon/>}>
           {isAgentActive && <span className="ml-1 h-2 w-2 bg-brand-blue rounded-full inline-block animate-pulse shadow-glow-blue"></span>}
        </TabButton>
        <TabButton id="trace" label="Trace" icon={<ActivityIcon/>} />
        <TabButton id="artifacts" label="Artifacts" icon={<span className="font-normal">{artifacts.length}</span>} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'chat' && (
          <div className="space-y-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={endOfMessagesRef} />
          </div>
        )}
        {activeTab === 'thinking' && <ThinkingProcess nodes={uiNodes} />}
        {activeTab === 'trace' && <TraceLog events={events} />}
        {activeTab === 'artifacts' && <ArtifactsList artifacts={artifacts} />}
      </div>

      <div className="p-4 border-t border-dark-border bg-dark-surface/90 backdrop-blur-sm">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your task for the AI agent..."
            className="w-full bg-dark-bg border border-dark-border rounded-lg p-3 pr-12 text-sm resize-none focus:ring-2 focus:ring-brand-blue focus:outline-none transition-all shadow-inner"
            rows={2}
            disabled={isLoading || isAgentActive}
          />
          <button
            onClick={handleSendClick}
            disabled={!prompt.trim() || isLoading || isAgentActive}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md text-brand-blue hover:bg-brand-blue/10 disabled:text-dark-text-secondary disabled:bg-transparent transition-colors"
            aria-label="Activate Agent"
          >
            {isLoading ? (
                <div className="w-5 h-5 border-2 border-dark-text-secondary border-t-brand-blue rounded-full animate-spin"></div>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
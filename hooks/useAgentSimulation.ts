import React from 'react';
import { useState, useCallback, useRef } from 'react';
import type { Message, SessionStatus, Artifact, NDJSONEvent, UINode, DAGTaskDef, NodeStatus } from '../types';
import { COSIEOrchestrator } from '../engine/cosie/orchestrator';
import { NDJSONLogger } from '../engine/logger';
import { GoogleGenAI } from '@google/genai';

interface UseAgentSimulationProps {
  setSessionStatus: React.Dispatch<React.SetStateAction<SessionStatus>>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setArtifacts: React.Dispatch<React.SetStateAction<Artifact[]>>;
  setAgentStatusText: React.Dispatch<React.SetStateAction<string>>;
  setUiNodes: React.Dispatch<React.SetStateAction<Record<string, UINode>>>;
  setEvents: React.Dispatch<React.SetStateAction<NDJSONEvent[]>>;
  setActiveTool: React.Dispatch<React.SetStateAction<{ nodeId: string, name: string } | null>>;
  endOfMessagesRef: React.RefObject<HTMLDivElement>;
}

export const useAgentSimulation = ({
  setSessionStatus,
  setMessages,
  setArtifacts,
  setAgentStatusText,
  setUiNodes,
  setEvents,
  setActiveTool,
  endOfMessagesRef,
}: UseAgentSimulationProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const orchestratorRef = useRef<COSIEOrchestrator | null>(null);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = useCallback((message: Omit<Message, 'id'>) => {
    setMessages(prev => [...prev, { ...message, id: Date.now() + Math.random() }]);
    setTimeout(scrollToBottom, 100);
  }, [setMessages]);

  const handleEvent = useCallback((event: NDJSONEvent) => {
    setEvents(prev => [...prev, event]);
    
    let uiNodesCache: Record<string, UINode> = {};
    setUiNodes(prev => {
        uiNodesCache = prev;
        return prev;
    });

    switch (event.type) {
      case 'cosie.start':
        setAgentStatusText(`Discovery Engine started for: ${event.data.goal}`);
        addMessage({ role: 'thought', content: `Starting Perpetual Discovery Engine... Goal: **${event.data.goal}**` });
        break;

      case 'dag.node.start':
        if (event.nodeId) {
            setAgentStatusText(`[${event.data.role}] ${event.data.brief}`);
            addMessage({ role: 'thought', content: `▶️ **${event.data.role}**: ${event.data.brief}`, nodeId: event.nodeId, eventType: event.type });
            
            setUiNodes(prev => {
                const updatedNode: UINode = {
                    ...(prev[event.nodeId!] || { id: event.nodeId!, dependsOn: [] }),
                    id: event.nodeId!,
                    role: event.data.role,
                    brief: event.data.brief,
                    status: 'RUNNING',
                };
                return { ...prev, [event.nodeId!]: updatedNode };
            });
        }
        break;

      case 'dag.node.status.update':
         if (event.nodeId) {
            setUiNodes(prev => {
                const newNodes: Record<string, UINode> = { ...prev };
                if (newNodes[event.nodeId!]) {
                    newNodes[event.nodeId!] = {
                        ...newNodes[event.nodeId!],
                        status: event.data.status as NodeStatus,
                    };
                }
                return newNodes;
            });
         }
        break;

      case 'urm.start':
        if(event.nodeId) {
            setAgentStatusText(`Anomaly detected in [${uiNodesCache[event.nodeId]?.role}]. Pausing loop...`);
            addMessage({ role: 'repair', content: `Anomaly detected in node **${event.nodeId}**. Pausing discovery loop. Activating Cognitive Immune System...`, nodeId: event.nodeId, eventType: event.type });
        }
        break;

      case 'urm.propose.start':
          if (event.nodeId) {
              setAgentStatusText(`[${uiNodesCache[event.nodeId]?.role}] Diagnosing root cause and proposing solution...`);
              addMessage({ role: 'repair', content: `**Diagnose & Propose:** Analyzing failure and engineering a solution for node **${event.nodeId}**.`, nodeId: event.nodeId, eventType: event.type });
          }
        break;

      case 'urm.vet.start':
          if (event.nodeId) {
              setAgentStatusText(`[${uiNodesCache[event.nodeId]?.role}] Submitting repair for governance approval...`);
              addMessage({ role: 'repair', content: `**Vet:** Submitting proposed repair to Governance Layer for vetting.`, nodeId: event.nodeId, eventType: event.type });
          }
        break;
      
      case 'urm.apply.code_patch':
          if (event.nodeId) {
              const nodeRole = uiNodesCache[event.nodeId]?.role || 'Unknown Node';
              const justification = event.data.justification?.join(' ') || 'No justification provided.';
              setAgentStatusText(`[${nodeRole}] Applying code patch and retrying...`);
              addMessage({ role: 'repair', content: `**Apply Patch:** Applying code modification to **${nodeRole}** and retrying. <br/>**Justification:** *${justification}*`, nodeId: event.nodeId, eventType: event.type });
          }
        break;

      case 'urm.vet.success':
          if (event.nodeId) {
              setAgentStatusText(`[${uiNodesCache[event.nodeId]?.role}] Repair approved. Applying patch...`);
              addMessage({ role: 'repair', content: `**Vet:** Repair for node **${event.nodeId}** approved by Governance.`, nodeId: event.nodeId, eventType: event.type });
          }
        break;

      case 'urm.success':
        if(event.nodeId) {
             setAgentStatusText(`Self-repair successful for [${uiNodesCache[event.nodeId]?.role}]. Resuming operation.`);
             addMessage({ role: 'repair', content: `✅ **Apply & Resume:** Self-repair on node **${event.nodeId}** successful. System enhanced. Resuming discovery loop.`, nodeId: event.nodeId, eventType: event.type });
        }
        break;

      case 'urm.failed':
        if (event.nodeId) {
            const nodeRole = uiNodesCache[event.nodeId]?.role || 'Unknown Node';
            setAgentStatusText(`Self-repair failed for [${nodeRole}]. Halting operation.`);
            addMessage({ role: 'repair', content: `❌ Self-repair on node **${event.nodeId}** failed. The agent cannot continue. Justification: ${event.data.justification?.join(' ') || 'Not specified'}` });
            setSessionStatus('FAILED');
        }
        break;

      case 'urm.failed.permanent':
        if (event.nodeId) {
            const nodeRole = uiNodesCache[event.nodeId]?.role || 'Unknown Node';
            setAgentStatusText(`Self-repair for [${nodeRole}] failed permanently. Halting operation.`);
            addMessage({ role: 'repair', content: `🛑 Self-repair on node **${event.nodeId}** failed permanently after multiple attempts. The agent cannot continue.` });
            setSessionStatus('FAILED');
        }
        break;
        
      case 'dag.node.result':
        if (event.nodeId) {
            setUiNodes(prev => {
                const newNodes: Record<string, UINode> = { ...prev };
                if (newNodes[event.nodeId!]) {
                    newNodes[event.nodeId!] = {
                        ...newNodes[event.nodeId!],
                        status: event.data.repaired ? 'COMPLETED' : event.data.status as NodeStatus,
                        output: event.data,
                    };
                }
                return newNodes;
            });

            if (event.nodeId.startsWith('D') && Array.isArray(event.data.tasks)) {
                const experimentTasks = event.data.tasks as DAGTaskDef[];
                setUiNodes(prev => {
                    const newNodes = { ...prev };
                    experimentTasks.forEach(task => {
                        newNodes[task.taskId] = {
                            id: task.taskId,
                            role: task.role,
                            brief: task.brief,
                            status: 'PENDING',
                            dependsOn: task.dependsOn || [],
                        };
                    });
                    return newNodes;
                });
            }
      
          const nodeRole = uiNodesCache[event.nodeId]?.role || event.data.role || 'Task';
          let thoughtContent = `${event.data.repaired ? '🔧' : '✔️'} **${nodeRole}** finished with status: **${event.data.status}** ${event.data.repaired ? '(Repaired)' : ''}`;
      
          if (event.data.sources?.length > 0) {
            const sources = event.data.sources
                .map((c: {uri: string, title: string}, i: number) => `[${i+1}] <a href="${c.uri}" target="_blank" rel="noopener noreferrer" class="text-brand-blue hover:underline">${c.title || c.uri}</a>`)
                .join('<br/>');
            thoughtContent += `<br/><br/>**Sources Found:**<br/>${sources}`;
          }
      
          addMessage({ role: 'thought', content: thoughtContent, nodeId: event.nodeId, eventType: event.type });
      
          if (event.data?.artifacts) {
              setArtifacts(event.data.artifacts);
          }
        }
        break;
      
      case 'dag.node.tool.start':
          if(event.nodeId) {
            setActiveTool({ nodeId: event.nodeId, name: event.data.name });
            const nodeRole = uiNodesCache[event.nodeId]?.role || 'Task';
            setAgentStatusText(`[${nodeRole}] Using tool: ${event.data.name}`);
          }
        break;

      case 'dag.node.tool.result':
        if(event.nodeId) {
            setActiveTool(null);
            const nodeRole = uiNodesCache[event.nodeId]?.role || 'Task';
            const nodeBrief = uiNodesCache[event.nodeId]?.brief || 'Continuing task...';
            setAgentStatusText(`[${nodeRole}] ${nodeBrief}`);
        }
        break;

      case 'cosie.done':
        const isApproved = event.data.approved;
        setAgentStatusText(isApproved ? 'Discovery made!' : 'Cycles completed without discovery.');
        setSessionStatus('COMPLETED');
        const messageContent = event.data.finalMessage || `Process finished. **Status: ${isApproved ? 'Discovery Found' : 'No Discovery'}**.`;
        addMessage({ role: 'agent', content: messageContent });
        break;
        
      case 'cosie.stopped':
        setAgentStatusText('Agent stopped by user.');
        setSessionStatus('STOPPED');
        addMessage({ role: 'system', content: 'Session terminated by user.' });
        break;
    }
  }, [addMessage, setAgentStatusText, setEvents, setMessages, setSessionStatus, setUiNodes, setArtifacts, setActiveTool]);

  const startSession = useCallback(async (prompt: string) => {
    setIsLoading(true);
    setSessionStatus('STARTING');
    setAgentStatusText('Initializing agent engine...');
    setArtifacts([]);
    setEvents([]);
    setUiNodes({});
    setActiveTool(null);
    setMessages(prev => prev.filter(m => m.role !== 'thought' && m.role !== 'system' && m.role !== 'repair'));
    
    addMessage({ role: 'user', content: prompt });
    
    if (!process.env.API_KEY) {
        addMessage({ role: 'system', content: 'ERROR: API_KEY is not configured. This app cannot work without it.' });
        setIsLoading(false);
        setSessionStatus('FAILED');
        setAgentStatusText('Configuration error.');
        return;
    }

    const runId = `run_${Date.now()}`;
    const logger = new NDJSONLogger(handleEvent);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const orchestrator = new COSIEOrchestrator(logger, ai);
    orchestratorRef.current = orchestrator;

    setTimeout(async () => {
      setIsLoading(false);
      setSessionStatus('RUNNING');
      try {
        await orchestrator.run(prompt, runId);
      } catch (error) {
        console.error("Orchestration failed", error);
        setSessionStatus('FAILED');
        setAgentStatusText('An unexpected error occurred.');
        addMessage({ role: 'system', content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
      }
    }, 1000);
  }, [handleEvent, addMessage, setArtifacts, setEvents, setMessages, setSessionStatus, setUiNodes, setActiveTool]);

  const stopSession = useCallback(() => {
    orchestratorRef.current?.stop();
  }, []);

  return { startSession, stopSession, isLoading };
};

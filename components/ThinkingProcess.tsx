
import React from 'react';
import type { UINode, NodeStatus } from '../types';
import { CogIcon } from './icons/CogIcon';
import { SearchIcon } from './icons/SearchIcon';
import { WrenchIcon } from './icons/WrenchIcon';

const StatusIcon: React.FC<{ status: NodeStatus, size?: number }> = ({ status, size = 16 }) => {
    const iconClass = `w-${size/4} h-${size/4}`;
    const iconConfig = {
        PENDING: <svg className={`${iconClass} text-gray-400`} viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="4" /></svg>,
        RUNNING: <svg className={`${iconClass} text-status-running animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>,
        COMPLETED: <svg className={`${iconClass} text-status-completed`} viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.854-9.646a.5.5 0 00-.708-.708L7.5 8.293 6.354 7.146a.5.5 0 10-.708.708l1.5 1.5a.5.5 0 00.708 0l3-3z" clipRule="evenodd" /></svg>,
        FAILED: <svg className={`${iconClass} text-status-failed`} viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm-1.09-11.5a.5.5 0 00-1.002.817l5 9a.5.5 0 00.894-.447l-5-9a.5.5 0 00-.2-.37z" clipRule="evenodd" /></svg>,
        REPAIRING: <WrenchIcon className={`${iconClass} text-amber-400 animate-pulse`} />,
    };
    return <div className={`w-${size/2} h-${size/2} flex items-center justify-center`}>{iconConfig[status]}</div>
};

const ToolIndicator: React.FC<{ node: UINode }> = ({ node }) => {
    if (!node.activeTool) return null;

    const ToolIcon = node.activeTool.toLowerCase().includes('search') ? SearchIcon : CogIcon;

    return (
        <g>
            <circle cx="0" cy="0" r="14" fill="#0D1117" stroke="#388BFD" strokeWidth="2" />
            <foreignObject x="-10" y="-10" width="20" height="20">
                <div className="w-full h-full flex items-center justify-center text-brand-blue">
                    <ToolIcon className="w-3 h-3"/>
                </div>
            </foreignObject>
        </g>
    )
}

const ThinkingProcess: React.FC<{ nodes: Record<string, UINode> }> = ({ nodes }) => {
    const nodeArray: UINode[] = Object.values(nodes);

    if (nodeArray.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-dark-text-secondary p-4">
                <div className="w-16 h-16 bg-dark-bg rounded-full flex items-center justify-center border-2 border-dark-border mb-4">
                    <CogIcon />
                </div>
                <h3 className="font-semibold text-dark-text text-lg">Waiting for Plan</h3>
                <p className="text-sm">The agent's execution plan will appear here once activated.</p>
            </div>
        );
    }
    
    const nodePositions: { [key: string]: { x: number, y: number } } = {};
    const levels: string[][] = [];
    let remainingNodes = [...nodeArray];
    let levelIndex = 0;

    while (remainingNodes.length > 0) {
        levels[levelIndex] = [];
        const currentLevelNodes = remainingNodes.filter(node => 
            (node.dependsOn || []).every(depId => !remainingNodes.some(rem => rem.id === depId))
        );
        
        if (currentLevelNodes.length === 0 && remainingNodes.length > 0) {
            console.error("Circular dependency or orphan node detected in DAG", remainingNodes);
            // As a fallback, add all remaining nodes to the current level to prevent an infinite loop
            levels[levelIndex] = remainingNodes.map(n => n.id);
            remainingNodes = [];
            break; 
        }

        currentLevelNodes.forEach(node => {
            levels[levelIndex].push(node.id);
        });

        remainingNodes = remainingNodes.filter(node => !currentLevelNodes.find(n => n.id === node.id));
        levelIndex++;
    }

    const maxNodesInLevel = Math.max(...levels.map(l => l.length), 0);
    const canvasHeight = Math.max(400, maxNodesInLevel * 100 + 40);

    levels.forEach((level, lIdx) => {
        const levelHeight = level.length;
        const yOffset = (canvasHeight - (levelHeight * 100 - 40)) / 2;
        level.forEach((nodeId, nIdx) => {
            nodePositions[nodeId] = {
                x: 100 + lIdx * 200,
                y: yOffset + nIdx * 100,
            };
        });
    });

    const boxWidth = 160;
    const boxHeight = 64;
    const totalWidth = 100 + levels.length * 200;

    return (
        <div className="w-full h-full overflow-auto">
            <svg className="min-w-full" height={canvasHeight} viewBox={`0 0 ${totalWidth} ${canvasHeight}`}>
                <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#30363D" />
                    </marker>
                    <style>
                        {`
                        @keyframes ping {
                            75%, 100% {
                                transform: scale(2);
                                opacity: 0;
                            }
                        }
                        .ping-animate {
                            animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
                        }
                        `}
                    </style>
                </defs>

                {/* Edges */}
                {nodeArray.map(node => 
                    (node.dependsOn || []).map(depId => {
                        const from = nodePositions[depId];
                        const to = nodePositions[node.id];
                        if (!from || !to) return null;
                        return <line key={`${depId}-${node.id}`} x1={from.x + boxWidth/2} y1={from.y} x2={to.x - boxWidth/2} y2={to.y} stroke="#30363D" strokeWidth={2} markerEnd="url(#arrow)" />;
                    })
                )}

                {/* Nodes */}
                {nodeArray.map(node => {
                    const pos = nodePositions[node.id];
                    if (!pos) return null;
                    const isToolActive = !!node.activeTool;
                    
                    const statusColors: Record<NodeStatus, string> = {
                        PENDING: '#30363D',
                        RUNNING: '#388BFD',
                        COMPLETED: '#2DA44E',
                        FAILED: '#F85149',
                        REPAIRING: '#FBBF24',
                    }
                    const color = isToolActive ? '#388BFD' : statusColors[node.status];
                    
                    return (
                        <g key={node.id} transform={`translate(${pos.x - boxWidth/2}, ${pos.y - boxHeight/2})`}>
                            {(isToolActive || node.status === 'REPAIRING') && (
                                <rect width={boxWidth} height={boxHeight} rx={8} fill={color} className="opacity-75 ping-animate" />
                            )}
                            <rect width={boxWidth} height={boxHeight} rx={8} fill="#161B22" stroke={color} strokeWidth={isToolActive || node.status === 'REPAIRING' ? 2.5 : 2} />
                            <foreignObject width={boxWidth} height={boxHeight} x="0" y="0">
                                <div className="w-full h-full p-2 flex flex-col justify-center text-center text-dark-text overflow-hidden">
                                    <div className="font-bold text-xs truncate flex items-center justify-center gap-1.5">
                                      {node.role} <span className="text-gray-500 font-mono">({node.id})</span>
                                    </div>
                                    <div className="text-[10px] text-dark-text-secondary leading-tight mt-1 whitespace-normal">{node.brief}</div>
                                </div>
                            </foreignObject>
                            <foreignObject width="24" height="24" x={boxWidth - 12} y="-12">
                                <StatusIcon status={node.status} size={24} />
                            </foreignObject>
                             {isToolActive && (
                                <g transform={`translate(${-12}, ${boxHeight/2})`}>
                                    <ToolIndicator node={node} />
                                </g>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

export default ThinkingProcess;
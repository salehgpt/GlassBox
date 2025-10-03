
import React from 'react';
import type { Message } from '../types';
import { UserIcon } from './icons/UserIcon';
import { AgentIcon } from './icons/AgentIcon';
import { CogIcon } from './icons/CogIcon';
import { WrenchIcon } from './icons/WrenchIcon';

const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
  const { role, content } = message;

  if (role === 'system') {
    return (
      <div className="text-center text-xs text-dark-text-secondary italic my-2 py-2 border-y border-dark-border">
        {content}
      </div>
    );
  }

  if (role === 'thought') {
    return (
       <div className="flex items-start gap-3 text-sm text-dark-text-secondary pl-2 border-l-2 border-dashed border-dark-border ml-5 my-4">
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 -ml-6 bg-dark-surface rounded-full border-2 border-dark-border">
            <CogIcon />
          </div>
          <div className="pt-1.5 prose prose-sm prose-invert max-w-full" dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }}/>
       </div>
    );
  }

  if (role === 'repair') {
      return (
        <div className="flex items-start gap-3 text-sm text-amber-300 bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 my-2">
            <div className="flex-shrink-0 mt-0.5">
                <WrenchIcon className="h-5 w-5 text-amber-400" />
            </div>
            <div className="prose prose-sm prose-invert max-w-full" dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }}/>
        </div>
      );
  }


  const isUser = role === 'user';
  
  return (
    <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-9 h-9 rounded-full bg-brand-purple flex items-center justify-center flex-shrink-0 mt-1 border-2 border-dark-border shadow-md">
          <AgentIcon />
        </div>
      )}
      <div 
        className={`max-w-xs md:max-w-sm rounded-lg px-4 py-2.5 text-sm shadow-md ${isUser ? 'bg-brand-blue text-white rounded-br-none' : 'bg-dark-border text-dark-text rounded-bl-none'}`}
      >
        <div className="prose prose-sm prose-invert max-w-full" dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }}/>
      </div>
      {isUser && (
        <div className="w-9 h-9 rounded-full bg-dark-border flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
          <UserIcon />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
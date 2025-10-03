import React from 'react';
import type { Artifact } from '../types';
import { DownloadIcon } from './icons/DownloadIcon';
import { PaperclipIcon } from './icons/PaperclipIcon';

interface ArtifactsListProps {
  artifacts: Artifact[];
}

const ArtifactsList: React.FC<ArtifactsListProps> = ({ artifacts }) => {
  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-dark-text-secondary p-4">
        <div className="w-16 h-16 bg-dark-bg rounded-full flex items-center justify-center border-2 border-dark-border mb-4">
            <PaperclipIcon className="w-8 h-8" />
        </div>
        <h3 className="font-semibold text-dark-text text-lg">No Artifacts Yet</h3>
        <p className="text-sm max-w-xs">Completed tasks will produce downloadable artifacts which will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
        <h3 className="text-lg font-semibold text-dark-text px-1">Completed Artifacts</h3>
        {artifacts.map((artifact) => (
            <div key={artifact.id} className="bg-dark-bg p-3 rounded-lg border border-dark-border flex items-center justify-between transition-all hover:border-brand-blue/50 hover:bg-dark-surface">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex-shrink-0 rounded-md bg-dark-border flex items-center justify-center">
                        <PaperclipIcon className="w-5 h-5 text-dark-text-secondary"/>
                    </div>
                    <div>
                        <p className="font-semibold text-dark-text">{artifact.name}</p>
                        <p className="text-xs text-dark-text-secondary uppercase">{artifact.type} &bull; {artifact.size}</p>
                    </div>
                </div>
                <a 
                    href={artifact.url} 
                    download={artifact.name}
                    className="p-2 rounded-md bg-dark-border text-dark-text-secondary hover:bg-brand-blue hover:text-white transition-colors"
                    aria-label={`Download ${artifact.name}`}
                >
                    <DownloadIcon />
                </a>
            </div>
        ))}
    </div>
  );
};

export default ArtifactsList;

import type { Message } from './types';

export const initialMessages: Message[] = [
  {
    id: 1,
    role: 'agent',
    content: "Hello! I am a Perpetual Discovery Engine with a self-repairing core. Provide me with a research domain, and I will autonomously attempt to make a novel discovery. If I encounter an error, I will attempt to fix myself. Try this prompt to see it in action: 'Find a more efficient way to sort a list of numbers, but FAIL during the data collection phase.'"
  },
];
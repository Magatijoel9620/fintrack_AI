import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

type GenkitInstance = ReturnType<typeof genkit>;
let instance: GenkitInstance | undefined;

/**
 * Build Genkit lazily so a missing provider key is handled by the server
 * action's normal error response rather than crashing a Server Component
 * module while it is being loaded.
 */
export function getAI(): GenkitInstance {
  if (instance) return instance;

  const googleApiKey =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!googleApiKey) {
    throw new Error('Gemini API key is not configured on the server.');
  }

  instance = genkit({
    plugins: [googleAI({ apiKey: googleApiKey })],
    model: 'googleai/gemini-3.8-flash',
  });

  return instance;
}

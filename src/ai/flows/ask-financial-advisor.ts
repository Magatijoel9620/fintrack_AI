'use server';

/**
 * @fileOverview Provides answers to user's financial questions based on their spending data.
 *
 * - askFinancialAdvisor - A function that answers financial questions.
 * - AskFinancialAdvisorInput - The input type for the askFinancialAdvisor function.
 * - AskFinancialAdvisorOutput - The return type for the askFinancialAdvisor function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AskFinancialAdvisorInputSchema = z.object({
  question: z.string().describe('The user\'s financial question.'),
  expenses: z
    .string()
    .describe('A stringified JSON array of the user\'s recent expenses.'),
});
export type AskFinancialAdvisorInput = z.infer<typeof AskFinancialAdvisorInputSchema>;

const AskFinancialAdvisorOutputSchema = z.object({
  answer: z.string().describe('The advisor\'s answer to the user\'s question.'),
});
export type AskFinancialAdvisorOutput = z.infer<typeof AskFinancialAdvisorOutputSchema>;

export async function askFinancialAdvisor(
  input: AskFinancialAdvisorInput
): Promise<AskFinancialAdvisorOutput> {
  return askFinancialAdvisorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'askFinancialAdvisorPrompt',
  input: {schema: AskFinancialAdvisorInputSchema},
  output: {schema: AskFinancialAdvisorOutputSchema},
  prompt: `You are a friendly and helpful personal finance advisor. A user is asking for advice. 
  
Use their recent expense data to provide a personalized and actionable answer.

User's Question: {{{question}}}

User's Recent Expenses:
{{{expenses}}}

Keep your answer concise and easy to understand.
`,
});

const askFinancialAdvisorFlow = ai.defineFlow(
  {
    name: 'askFinancialAdvisorFlow',
    inputSchema: AskFinancialAdvisorInputSchema,
    outputSchema: AskFinancialAdvisorOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

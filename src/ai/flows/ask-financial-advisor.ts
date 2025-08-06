'use server';

/**
 * @fileOverview Provides answers to user's financial questions based on their spending data and conversation history.
 *
 * - askFinancialAdvisor - A function that answers financial questions.
 * - AskFinancialAdvisorInput - The input type for the askFinancialAdvisor function.
 * - AskFinancialAdvisorOutput - The return type for the askFinancialAdvisor function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const AskFinancialAdvisorInputSchema = z.object({
  question: z.string().describe("The user's current financial question."),
  expenses: z
    .string()
    .describe("A stringified JSON array of the user's recent expenses."),
  history: z.array(MessageSchema).describe('The history of the conversation so far.'),
});
export type AskFinancialAdvisorInput = z.infer<typeof AskFinancialAdvisorInputSchema>;

const AskFinancialAdvisorOutputSchema = z.object({
  answer: z.string().describe("The advisor's answer to the user's question."),
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
  
Use their recent expense data and the conversation history to provide a personalized and actionable answer.

Conversation History:
{{#each history}}
{{role}}: {{{content}}}
{{/each}}

User's Recent Expenses:
{{{expenses}}}

User's Current Question: {{{question}}}

Keep your answer concise, conversational, and easy to understand. Directly answer the user's question based on the provided context.`,
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

'use server';

/**
 * @fileOverview Analyzes user spending habits and provides personalized savings strategies.
 *
 * - analyzeSpendingHabits - A function that analyzes spending habits and suggests savings strategies.
 * - AnalyzeSpendingHabitsInput - The input type for the analyzeSpendingHabits function.
 * - AnalyzeSpendingHabitsOutput - The return type for the analyzeSpendingHabits function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeSpendingHabitsInputSchema = z.object({
  expenses: z
    .string()
    .describe('A stringified JSON array of expenses, each with a category and amount.'),
});
export type AnalyzeSpendingHabitsInput = z.infer<typeof AnalyzeSpendingHabitsInputSchema>;

const AnalyzeSpendingHabitsOutputSchema = z.object({
  analysis: z.string().describe('An analysis of the user\'s spending habits.'),
  savingsStrategies: z
    .string()
    .describe('Personalized savings strategies based on the spending analysis.'),
});
export type AnalyzeSpendingHabitsOutput = z.infer<typeof AnalyzeSpendingHabitsOutputSchema>;

export async function analyzeSpendingHabits(
  input: AnalyzeSpendingHabitsInput
): Promise<AnalyzeSpendingHabitsOutput> {
  return analyzeSpendingHabitsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeSpendingHabitsPrompt',
  input: {schema: AnalyzeSpendingHabitsInputSchema},
  output: {schema: AnalyzeSpendingHabitsOutputSchema},
  prompt: `You are a personal finance advisor. Analyze the user's spending habits based on their expenses and suggest personalized savings strategies.

Expenses: {{{expenses}}}

Provide a concise analysis of their spending habits and suggest actionable savings strategies.`,
});

const analyzeSpendingHabitsFlow = ai.defineFlow(
  {
    name: 'analyzeSpendingHabitsFlow',
    inputSchema: AnalyzeSpendingHabitsInputSchema,
    outputSchema: AnalyzeSpendingHabitsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

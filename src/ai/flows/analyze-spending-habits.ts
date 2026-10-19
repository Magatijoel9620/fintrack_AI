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
import { verifyFirebaseIdToken } from '@/lib/verify-firebase-id-token';

const AnalyzeSpendingHabitsInputSchema = z.object({
  idToken: z.string().min(100).max(6000),
  expenses: z.string().max(20000)
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
  const parsed = AnalyzeSpendingHabitsInputSchema.safeParse(input);
  if (!parsed.success) throw new Error("Please provide a smaller expense summary and try again.");
  await verifyFirebaseIdToken(parsed.data.idToken);
  return analyzeSpendingHabitsFlow({ expenses: parsed.data.expenses });
}

const SpendingDataSchema = z.object({ expenses: z.string().max(20000) });
const prompt = ai.definePrompt({
  name: 'analyzeSpendingHabitsPrompt',
  input: {schema: SpendingDataSchema},
  output: {schema: AnalyzeSpendingHabitsOutputSchema},
  prompt: `You are a personal finance advisor. Analyze the user's spending habits based on their expenses and suggest personalized savings strategies.

Expenses: {{{expenses}}}

Provide a concise analysis of their spending habits and suggest actionable savings strategies.`,
});

const analyzeSpendingHabitsFlow = ai.defineFlow(
  {
    name: 'analyzeSpendingHabitsFlow',
    inputSchema: SpendingDataSchema,
    outputSchema: AnalyzeSpendingHabitsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

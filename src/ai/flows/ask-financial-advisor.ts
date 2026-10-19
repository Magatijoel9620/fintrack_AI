'use server';

/**
 * @fileOverview Provides answers to user's financial questions based on their spending data and conversation history.
 *
 * - askFinancialAdvisor - A function that answers financial questions.
 * - AskFinancialAdvisorInput - The input type for the askFinancialAdvisor function.
 * - AskFinancialAdvisorOutput - The return type for the askFinancialAdvisor function.
 */

import { ai } from "@/ai/genkit";
import { z } from "genkit";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(2000),
});

const AskFinancialAdvisorInputSchema = z.object({
  idToken: z.string().min(100).max(6000),
  question: z.string().trim().min(1).max(1200).describe("The user's current financial question."),
  expenses: z.string().max(20000).describe("A bounded JSON array of the user's recent expenses."),
  history: z.array(MessageSchema).max(10).describe("The last 10 conversation messages."),
});
export type AskFinancialAdvisorInput = z.infer<typeof AskFinancialAdvisorInputSchema>;

const AskFinancialAdvisorOutputSchema = z.object({
  answer: z.string().describe("The advisor's answer to the user's question."),
});
export type AskFinancialAdvisorOutput = z.infer<typeof AskFinancialAdvisorOutputSchema>;

export async function askFinancialAdvisor(
  input: AskFinancialAdvisorInput
): Promise<AskFinancialAdvisorOutput> {
  const parsed = AskFinancialAdvisorInputSchema.safeParse(input);
  if (!parsed.success) throw new Error("Please shorten your question and try again.");
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("The financial advisor is temporarily unavailable.");
  const app = getApps().find((existing) => existing.name === "financial-advisor-admin")
    ?? initializeApp({ credential: applicationDefault(), projectId }, "financial-advisor-admin");
  try {
    await getAuth(app).verifyIdToken(parsed.data.idToken);
  } catch {
    throw new Error("Your session needs refreshing. Please sign in again.");
  }
  const { idToken: _idToken, ...safeInput } = parsed.data;
  return askFinancialAdvisorFlow(safeInput);
}

const AdvisorPromptInputSchema = z.object({
  question: AskFinancialAdvisorInputSchema.shape.question,
  expenses: AskFinancialAdvisorInputSchema.shape.expenses,
  history: AskFinancialAdvisorInputSchema.shape.history,
});

const prompt = ai.definePrompt({
  name: 'askFinancialAdvisorPrompt',
  input: {schema: AdvisorPromptInputSchema},
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
    inputSchema: AdvisorPromptInputSchema,
    outputSchema: AskFinancialAdvisorOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

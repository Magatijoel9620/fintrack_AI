'use server';

/**
 * Server action for extracting expense details from a receipt image.
 * Genkit is initialised only when the action runs, not when this module loads.
 */

import { getAI } from '@/ai/genkit';
import { z } from 'genkit';
import { verifyFirebaseIdToken } from '@/lib/verify-firebase-id-token';

const ScanReceiptInputSchema = z.object({
  idToken: z.string().min(100).max(6000),
  receiptDataUri: z.string().max(8_000_000).describe(
    "A receipt photo as a base64 data URI including its MIME type, for example 'data:image/jpeg;base64,...'.",
  ),
});
export type ScanReceiptInput = z.infer<typeof ScanReceiptInputSchema>;

const ScanReceiptOutputSchema = z.object({
  amount: z.number().describe('The total amount on the receipt.'),
  date: z.string().describe('The date on the receipt (YYYY-MM-DD).'),
  category: z.string().describe('The category of the expense.'),
  merchant: z.string().describe('The name of the merchant.'),
});
export type ScanReceiptOutput = z.infer<typeof ScanReceiptOutputSchema>;

const ReceiptImageSchema = z.object({ receiptDataUri: z.string().max(8_000_000) });
type ReceiptImageInput = z.infer<typeof ReceiptImageSchema>;

let receiptFlow: ((input: ReceiptImageInput) => Promise<ScanReceiptOutput>) | undefined;

function getScanReceiptFlow() {
  if (receiptFlow) return receiptFlow;

  const ai = getAI();
  const receiptPrompt = ai.definePrompt({
    name: 'receiptPrompt',
    input: { schema: ReceiptImageSchema },
    output: { schema: ScanReceiptOutputSchema },
    prompt: `You are an AI assistant specialized in extracting information from receipts.
Given a receipt image, extract the total amount, date (YYYY-MM-DD), category, and merchant name.
Return only the structured fields. Use zero or an empty string when a value is not visible.
Receipt Image: {{media url=receiptDataUri}}`,
  });

  receiptFlow = ai.defineFlow({
    name: 'scanReceiptFlow',
    inputSchema: ReceiptImageSchema,
    outputSchema: ScanReceiptOutputSchema,
  }, async (input: ReceiptImageInput) => {
    const { output } = await receiptPrompt(input);
    if (!output) throw new Error('The AI provider could not extract receipt details.');
    return output;
  });

  return receiptFlow;
}

export async function scanReceipt(input: ScanReceiptInput): Promise<ScanReceiptOutput> {
  const parsed = ScanReceiptInputSchema.safeParse(input);
  if (!parsed.success) throw new Error('Choose a smaller receipt image and try again.');
  await verifyFirebaseIdToken(parsed.data.idToken);
  return getScanReceiptFlow()({ receiptDataUri: parsed.data.receiptDataUri });
}

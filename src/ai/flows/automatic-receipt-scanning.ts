'use server';

/**
 * @fileOverview This file defines a Genkit flow for automatically extracting information from receipts using AI.
 *
 * - `scanReceipt` - A function that takes a receipt image as input and returns extracted expense information.
 * - `ScanReceiptInput` - The input type for the `scanReceipt` function.
 * - `ScanReceiptOutput` - The return type for the `scanReceipt` function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScanReceiptInputSchema = z.object({
  receiptDataUri: z
    .string()
    .describe(
      'A photo of a receipt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // keep the single quotes in the string
    ),
});
export type ScanReceiptInput = z.infer<typeof ScanReceiptInputSchema>;

const ScanReceiptOutputSchema = z.object({
  amount: z.number().describe('The total amount on the receipt.'),
  date: z.string().describe('The date on the receipt (YYYY-MM-DD).'),
  category: z.string().describe('The category of the expense (e.g., food, transportation).'),
  merchant: z.string().describe('The name of the merchant on the receipt.'),
});
export type ScanReceiptOutput = z.infer<typeof ScanReceiptOutputSchema>;

export async function scanReceipt(input: ScanReceiptInput): Promise<ScanReceiptOutput> {
  return scanReceiptFlow(input);
}

const receiptPrompt = ai.definePrompt({
  name: 'receiptPrompt',
  input: {schema: ScanReceiptInputSchema},
  output: {schema: ScanReceiptOutputSchema},
  prompt: `You are an AI assistant specialized in extracting information from receipts.
  Given an image of a receipt, extract the following information:
  - Total amount
  - Date (YYYY-MM-DD)
  - Category of the expense
  - Name of the merchant

  Receipt Image: {{media url=receiptDataUri}}

  Provide the extracted information in JSON format.
  `,
});

const scanReceiptFlow = ai.defineFlow(
  {
    name: 'scanReceiptFlow',
    inputSchema: ScanReceiptInputSchema,
    outputSchema: ScanReceiptOutputSchema,
  },
  async input => {
    const {output} = await receiptPrompt(input);
    return output!;
  }
);

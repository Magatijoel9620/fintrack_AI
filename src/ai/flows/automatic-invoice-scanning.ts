'use server';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { verifyFirebaseIdToken } from '@/lib/verify-firebase-id-token';
const Input=z.object({idToken:z.string().min(100).max(6000),invoiceDataUri:z.string().max(8_000_000)});
const Output=z.object({supplier:z.string(),invoiceNumber:z.string(),date:z.string(),items:z.array(z.object({name:z.string(),quantity:z.number(),unitCost:z.number(),sku:z.string()})),subtotal:z.number(),tax:z.number(),total:z.number()});
export async function scanInvoice(input:z.infer<typeof Input>):Promise<z.infer<typeof Output>>{const parsed=Input.safeParse(input);if(!parsed.success)throw new Error('Choose a smaller invoice image and try again.');await verifyFirebaseIdToken(parsed.data.idToken);return flow({invoiceDataUri:parsed.data.invoiceDataUri})}
const InvoiceImageSchema=z.object({invoiceDataUri:z.string().max(8_000_000)});const prompt=ai.definePrompt({name:'invoiceScannerPrompt',input:{schema:InvoiceImageSchema},output:{schema:Output},prompt:`Extract structured data from this supplier invoice image. Return empty strings or zero values when a field is not visible. Date must be YYYY-MM-DD.\nInvoice: {{media url=invoiceDataUri}}`});
const flow=ai.defineFlow({name:'automaticInvoiceScanningFlow',inputSchema:InvoiceImageSchema,outputSchema:Output},async input=>(await prompt(input)).output!);

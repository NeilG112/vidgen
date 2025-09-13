// This file is machine-generated - edit with caution!
'use server';
/**
 * @fileOverview A flow to automatically improve an intro script using AI.
 *
 * - improveIntroScript - A function that improves the intro script.
 * - ImproveIntroScriptInput - The input type for the improveIntroScript function.
 * - ImproveIntroScriptOutput - The return type for the improveIntroScript function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ImproveIntroScriptInputSchema = z.object({
  script: z.string().describe('The intro script to improve.'),
});
export type ImproveIntroScriptInput = z.infer<typeof ImproveIntroScriptInputSchema>;

const ImproveIntroScriptOutputSchema = z.object({
  improvedScript: z.string().describe('The improved intro script.'),
});
export type ImproveIntroScriptOutput = z.infer<typeof ImproveIntroScriptOutputSchema>;

export async function improveIntroScript(input: ImproveIntroScriptInput): Promise<ImproveIntroScriptOutput> {
  return improveIntroScriptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'improveIntroScriptPrompt',
  input: {schema: ImproveIntroScriptInputSchema},
  output: {schema: ImproveIntroScriptOutputSchema},
  prompt: `You are an expert copywriter specializing in recruitment. Your task is to improve the provided intro script to be more engaging and effective. Focus on clarity, conciseness, and a compelling call to action.\n\nOriginal Script: {{{script}}}`,
});

const improveIntroScriptFlow = ai.defineFlow(
  {
    name: 'improveIntroScriptFlow',
    inputSchema: ImproveIntroScriptInputSchema,
    outputSchema: ImproveIntroScriptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

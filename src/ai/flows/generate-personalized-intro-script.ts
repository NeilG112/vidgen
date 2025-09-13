// src/ai/flows/generate-personalized-intro-script.ts
'use server';
/**
 * @fileOverview Generates a personalized intro script for a candidate based on their LinkedIn profile data.
 *
 * - generatePersonalizedIntroScript - A function that generates the personalized intro script.
 * - GeneratePersonalizedIntroScriptInput - The input type for the generatePersonalizedIntroScript function.
 * - GeneratePersonalizedIntroScriptOutput - The return type for the generatePersonalizedIntroScript function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePersonalizedIntroScriptInputSchema = z.object({
  firstName: z.string().describe('The first name of the candidate.'),
  lastName: z.string().describe('The last name of the candidate.'),
  headline: z.string().describe('The headline of the candidate.'),
  skills: z.array(z.string()).describe('The skills of the candidate.'),
  company: z.string().describe('The current company of the candidate.'),
});
export type GeneratePersonalizedIntroScriptInput = z.infer<typeof GeneratePersonalizedIntroScriptInputSchema>;

const GeneratePersonalizedIntroScriptOutputSchema = z.object({
  script: z.string().describe('The generated personalized intro script.'),
});
export type GeneratePersonalizedIntroScriptOutput = z.infer<typeof GeneratePersonalizedIntroScriptOutputSchema>;

export async function generatePersonalizedIntroScript(input: GeneratePersonalizedIntroScriptInput): Promise<GeneratePersonalizedIntroScriptOutput> {
  return generatePersonalizedIntroScriptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePersonalizedIntroScriptPrompt',
  input: {schema: GeneratePersonalizedIntroScriptInputSchema},
  output: {schema: GeneratePersonalizedIntroScriptOutputSchema},
  prompt: `You are an expert in writing personalized introduction scripts for recruiters.

  Given the following information about a candidate, generate a compelling intro script that highlights their key skills and experience.

  Candidate Name: {{firstName}} {{lastName}}
  Headline: {{headline}}
  Skills: {{#each skills}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
  Current Company: {{company}}

  Intro Script:`,
});

const generatePersonalizedIntroScriptFlow = ai.defineFlow(
  {
    name: 'generatePersonalizedIntroScriptFlow',
    inputSchema: GeneratePersonalizedIntroScriptInputSchema,
    outputSchema: GeneratePersonalizedIntroScriptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

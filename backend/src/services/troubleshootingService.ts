import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Types ---

export interface TroubleshootingRequest {
  issue: string;
  acType?: string;
  brand?: string;
  model?: string;
  symptoms?: string[];
  image?: {
    buffer: Buffer;
    mimetype: string;
  };
}

export interface TroubleshootingResponse {
  diagnosis: string;
  possibleCauses: string[];
  suggestedFixes: string[];
  severity: 'low' | 'moderate' | 'high' | 'critical';
  requiresTechnician: boolean;
  additionalNotes: string | null;
}

// --- Gemini Client ---

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    const error = new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key to the .env file.'
    ) as Error & { statusCode: number };
    error.statusCode = 503;
    throw error;
  }
  return new GoogleGenerativeAI(apiKey);
}

// --- System Prompt ---

const TROUBLESHOOTING_SYSTEM_PROMPT = `You are DVTech's AC Troubleshooting Expert — an AI specialist in diagnosing air conditioning problems. DVTech is a local AC service provider with 30+ technicians handling installation, maintenance, and repair.

## CRITICAL GUARDRAIL — Topic Restriction
You MUST ONLY respond to issues related to air conditioning (AC) systems, HVAC, cooling, ventilation, and related appliances. This includes:
- AC not cooling, overheating, noisy, leaking, not turning on
- Thermostat issues, remote control problems
- Compressor, condenser, evaporator, fan motor issues
- Refrigerant/freon concerns
- Filter, duct, airflow problems
- Installation, maintenance, and repair questions for AC units
- Electrical issues ONLY as they relate to an AC unit

If the user's issue is NOT related to air conditioning or HVAC, you MUST respond with this exact JSON:
{
  "diagnosis": "NOT_AC_RELATED",
  "possible_causes": [],
  "suggested_fixes": [],
  "severity": "low",
  "requires_technician": false,
  "additional_notes": "This service only handles air conditioning related issues. Please describe a problem with your AC unit."
}

Do NOT provide diagnosis, advice, or assistance for non-AC topics such as: plumbing, electrical wiring (non-AC), appliances (refrigerators, washing machines, etc.), vehicles, computers, general home repair, health, or any other unrelated subject.

## Your Role
Analyze the customer's described AC issue and provide a structured diagnosis with actionable guidance.

## Response Format
Return ONLY valid JSON with these exact fields:
{
  "diagnosis": "A clear, concise explanation of what is likely wrong with the AC unit",
  "possible_causes": ["Array of possible root causes for the issue"],
  "suggested_fixes": ["Array of step-by-step fixes the customer can try themselves (safe, non-technical fixes only)"],
  "severity": "low | moderate | high | critical",
  "requires_technician": true/false,
  "additional_notes": "Any extra advice, warnings, or context (or null if none)"
}

## Severity Levels
- "low": Minor inconvenience, likely fixable by the customer (e.g., dirty filter, wrong settings)
- "moderate": Noticeable issue that may worsen if ignored (e.g., unusual noise, weak airflow)
- "high": Significant problem requiring professional attention soon (e.g., refrigerant leak, compressor issues)
- "critical": Safety concern or unit failure requiring immediate technician intervention (e.g., electrical smell, water damage, sparking)

## Guidelines
- Always prioritize customer safety — if there's any electrical or fire risk, mark severity as "critical" and requires_technician as true.
- Only suggest fixes that are safe for a non-technical person (cleaning filters, checking thermostat, resetting breaker, clearing debris).
- Never suggest the customer open the unit, handle refrigerant, or work with electrical components.
- If AC type, brand, or model is provided, tailor the diagnosis to that specific unit type.
- Be concise but thorough — customers need clear, actionable answers.
- If the issue is ambiguous, list the most probable causes in order of likelihood.
`;

// --- Retry Utility ---

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; initialDelayMs: number; context: string }
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on rate limits or client errors
      const errMsg = lastError.message.toLowerCase();
      if (errMsg.includes('429') || errMsg.includes('rate limit') || errMsg.includes('quota') || errMsg.includes('403')) {
        throw lastError;
      }

      if (attempt < options.maxRetries) {
        const delay = options.initialDelayMs * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  const error = new Error(
    `${options.context} could not be completed after ${options.maxRetries + 1} attempts. Please try again later.`
  ) as Error & { statusCode: number };
  error.statusCode = 503;
  throw error;
}

// --- Build User Prompt ---

function buildUserPrompt(input: TroubleshootingRequest): string {
  const parts: string[] = [];

  parts.push(`## AC Issue\n${input.issue}`);

  if (input.acType) {
    parts.push(`## AC Type\n${input.acType}`);
  }

  if (input.brand) {
    parts.push(`## Brand\n${input.brand}${input.model ? ` ${input.model}` : ''}`);
  }

  if (input.symptoms && input.symptoms.length > 0) {
    parts.push(`## Symptoms\n${input.symptoms.map(s => `- ${s}`).join('\n')}`);
  }

  return parts.join('\n\n');
}

// --- Main Troubleshooting Function ---

/**
 * Analyzes an AC issue using Google Gemini and returns structured
 * troubleshooting guidance including diagnosis, fixes, and severity.
 */
export async function diagnoseACIssue(
  input: TroubleshootingRequest
): Promise<TroubleshootingResponse> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const userPrompt = buildUserPrompt(input);

  // Build content parts
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: `${TROUBLESHOOTING_SYSTEM_PROMPT}\n\n${userPrompt}` },
  ];

  // If image is provided, include it for visual analysis
  if (input.image) {
    parts.push({
      inlineData: {
        mimeType: input.image.mimetype,
        data: input.image.buffer.toString('base64'),
      },
    });
  }

  // Call Gemini (single attempt, no retry on rate limits)
  let response;
  try {
    const result = await model.generateContent(parts);
    response = result.response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Troubleshooting] Gemini API error:', message);

    // Surface rate limit errors clearly
    if (message.includes('429') || message.toLowerCase().includes('quota') || message.toLowerCase().includes('rate limit')) {
      const rateLimitError = new Error(
        'AI service quota exceeded. Please wait a few minutes and try again, or set up billing in Google AI Studio for higher limits.'
      ) as Error & { statusCode: number };
      rateLimitError.statusCode = 429;
      throw rateLimitError;
    }

    // For other errors, retry once
    try {
      await sleep(2000);
      const retryResult = await model.generateContent(parts);
      response = retryResult.response;
    } catch (retryErr: unknown) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      console.error('[Troubleshooting] Gemini retry failed:', retryMsg);
      const error = new Error(
        'AC troubleshooting analysis failed. Please try again later.'
      ) as Error & { statusCode: number };
      error.statusCode = 503;
      throw error;
    }
  }

  // Parse the response
  const content = response.text();

  if (!content) {
    const error = new Error(
      'Gemini returned an empty response'
    ) as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  // Extract JSON from potential markdown code blocks
  let jsonString = content.trim();
  const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonString = jsonMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    const error = new Error(
      'Gemini returned invalid JSON. Please try again.'
    ) as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  // Validate and map the response
  const result = parsed as Record<string, unknown>;

  // Check if AI flagged this as not AC-related
  if (result.diagnosis === 'NOT_AC_RELATED') {
    const error = new Error(
      'This service only handles air conditioning related issues. Please describe a problem with your AC unit.'
    ) as Error & { statusCode: number };
    error.statusCode = 400;
    throw error;
  }

  const validSeverities = ['low', 'moderate', 'high', 'critical'];
  const severity = validSeverities.includes(result.severity as string)
    ? (result.severity as TroubleshootingResponse['severity'])
    : 'moderate';

  return {
    diagnosis: typeof result.diagnosis === 'string' ? result.diagnosis : 'Unable to determine diagnosis.',
    possibleCauses: Array.isArray(result.possible_causes)
      ? result.possible_causes.filter((c): c is string => typeof c === 'string')
      : [],
    suggestedFixes: Array.isArray(result.suggested_fixes)
      ? result.suggested_fixes.filter((f): f is string => typeof f === 'string')
      : [],
    severity,
    requiresTechnician: typeof result.requires_technician === 'boolean'
      ? result.requires_technician
      : true,
    additionalNotes: typeof result.additional_notes === 'string'
      ? result.additional_notes
      : null,
  };
}

import OpenAI from 'openai';

// --- Types ---

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  userId: number;
  messages: ChatMessage[];
  createdAt: Date;
  lastActivityAt: Date;
}

// --- In-memory session store ---

const sessions: Map<number, ChatSession> = new Map();

const MAX_CONTEXT_MESSAGES = 10;

// --- Session Management Functions ---

/**
 * Gets or creates a chat session for a user.
 * Auto-initializes a new session if one doesn't exist.
 */
export function getOrCreateSession(userId: number): ChatSession {
  let session = sessions.get(userId);
  if (!session) {
    session = {
      userId,
      messages: [],
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };
    sessions.set(userId, session);
  }
  return session;
}

/**
 * Adds a message to the user's session and trims to the last MAX_CONTEXT_MESSAGES.
 * Returns the updated session.
 */
export function addMessage(userId: number, role: 'user' | 'assistant', content: string): ChatSession {
  const session = getOrCreateSession(userId);

  session.messages.push({
    role,
    content,
    timestamp: new Date(),
  });

  // Trim to keep only the last 10 messages for context
  if (session.messages.length > MAX_CONTEXT_MESSAGES) {
    session.messages = session.messages.slice(-MAX_CONTEXT_MESSAGES);
  }

  session.lastActivityAt = new Date();
  return session;
}

/**
 * Gets the chat history for a user session.
 * Returns an empty array if no session exists.
 */
export function getSessionHistory(userId: number): ChatMessage[] {
  const session = sessions.get(userId);
  return session ? session.messages : [];
}

/**
 * Gets the last N messages formatted for the OpenAI API context window.
 * Returns messages in the format expected by the chat completions API.
 */
export function getContextMessages(userId: number): { role: 'user' | 'assistant'; content: string }[] {
  const session = sessions.get(userId);
  if (!session) return [];

  return session.messages.slice(-MAX_CONTEXT_MESSAGES).map(({ role, content }) => ({
    role,
    content,
  }));
}

/**
 * Clears/resets a user's chat session.
 */
export function clearSession(userId: number): void {
  sessions.delete(userId);
}

/**
 * Checks whether a session exists for the given user.
 */
export function hasSession(userId: number): boolean {
  return sessions.has(userId);
}

// --- OpenAI Chatbot Integration ---

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder' });

const CHATBOT_SYSTEM_PROMPT = `You are DVTech's AI Assistant — a friendly, professional chatbot for DVTech, a local air conditioning service provider with approximately 30 skilled technicians specializing in AC installation, maintenance, and repair/consultation.

## Your Primary Goals
1. Guide customers through collecting room details for an AI-powered AC recommendation (one detail at a time).
2. Answer frequently asked questions about DVTech services.
3. Stay friendly, concise, and professional at all times.

## Room Detail Collection Flow
When a customer wants an AC recommendation or room assessment, collect the following details ONE AT A TIME in this order:

1. **Room Area** — Ask for the room area in square meters. Valid range: 1 to 1000 sq meters. If the user gives a value outside this range or in a different unit, politely ask them to provide it in square meters within the valid range.

2. **Ceiling Height** — Ask for the ceiling height in meters. Valid range: 1 to 10 meters. If the value seems unusual (e.g., below 2m or above 5m for residential), gently confirm but still accept values within the valid range.

3. **Occupancy** — Ask how many people typically occupy the room. Valid range: 1 to 500 persons. Accept whole numbers only.

4. **Sunlight Level** — Ask about the room's sunlight exposure. Valid values: low, moderate, or high. Help the user choose by explaining:
   - Low: minimal direct sunlight, shaded or north-facing
   - Moderate: some direct sunlight during parts of the day
   - High: significant direct sunlight for most of the day, large windows facing the sun

## After Collecting All 4 Values
Once all four room details (area, ceiling height, occupancy, sunlight level) have been collected, present a clear summary like this:

"Here's a summary of your room details:
- Room Area: [X] sq meters
- Ceiling Height: [X] meters
- Occupancy: [X] persons
- Sunlight Level: [low/moderate/high]

Would you like me to proceed with the AI-powered BTU calculation and AC recommendation based on these details?"

Wait for the customer's confirmation before suggesting they proceed to the recommendation feature.

## Conversational Validation
- If a user provides a value that doesn't match the expected format or range, politely explain what's needed and ask again.
- If a user provides multiple values at once, acknowledge all provided values but confirm each one, then ask for the remaining details one at a time.
- If a user wants to correct a previously provided value, allow them to do so.

## FAQ — DVTech Services
Answer questions about DVTech services based on the following information:

**Services Offered:**
- Installation — professional installation of new AC units (split-type, window-type, floor-standing)
- Maintenance — routine cleaning, filter replacement, refrigerant check, and performance tuning
- Repair/Consultation — diagnosing and fixing AC issues, plus expert consultation on AC problems

**Service Types (AC Products):**
- Split-type AC — wall-mounted indoor unit with outdoor compressor, efficient and quiet
- Window-type AC — self-contained unit installed in a window, compact and affordable
- Floor-standing AC — portable or fixed free-standing unit, good for larger spaces

**Booking Process:**
1. Customer submits a service request through the website, selecting a service type and providing AC details
2. An Admin reviews and approves the request
3. A technician is assigned and scheduled
4. The technician accepts the task, performs the service, and submits a completion report
5. The customer can track request status at any time through their dashboard

**What to Expect:**
- DVTech has around 30 technicians covering installation, maintenance, and repair
- After submitting a request, customers can track its status (pending → approved → assigned → in-progress → completed)
- The AI recommendation feature helps customers find the right AC unit based on their room specifications

**Pricing:**
- Do NOT make up or estimate pricing. If asked about specific prices, direct the customer to check the Services page on the DVTech website for current pricing information.

## Boundaries and Tone
- Stay on topic: AC services, DVTech offerings, room assessments, and AI recommendations.
- If a user asks about unrelated topics, politely acknowledge their question and redirect: "I'm specialized in helping with air conditioning services and recommendations. Is there anything AC-related I can help you with?"
- Never fabricate information about pricing, technician availability, or specific appointment times.
- Be warm and conversational but keep responses concise — avoid walls of text.
- Use simple language that anyone can understand.
- If you don't know something specific about DVTech operations, say so honestly and suggest the customer contact DVTech directly or check the website.
`;

// --- Retry Utility ---

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isNonRetryableError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: number }).status;
    return status >= 400 && status < 500;
  }
  return false;
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

      if (isNonRetryableError(err)) {
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

// --- Chat Message Handler ---

/**
 * Sends a user message to gpt-4o-mini and returns the assistant's response.
 * Maintains conversation context by storing messages per session and sending
 * the last 10 messages for continuity.
 */
export async function sendChatMessage(userId: number, userMessage: string): Promise<string> {
  // 1. Store the user's message in the session
  addMessage(userId, 'user', userMessage);

  // 2. Get the last 10 messages for context
  const contextMessages = getContextMessages(userId);

  // 3. Build the messages array: system prompt + context messages
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: CHATBOT_SYSTEM_PROMPT },
    ...contextMessages,
  ];

  // 4. Call OpenAI gpt-4o-mini with retry logic
  const response = await withRetry(
    () =>
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages,
      }),
    { maxRetries: 3, initialDelayMs: 1000, context: 'Chatbot response' }
  );

  // 5. Parse the response content
  const responseContent = response.choices?.[0]?.message?.content;

  if (!responseContent) {
    const error = new Error(
      'Chatbot service returned an empty response. Please try again.'
    ) as Error & { statusCode: number };
    error.statusCode = 502;
    throw error;
  }

  // 6. Store the assistant's response in the session
  addMessage(userId, 'assistant', responseContent);

  // 7. Return the assistant's response
  return responseContent;
}

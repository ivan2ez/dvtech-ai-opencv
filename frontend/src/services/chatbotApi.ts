import api from './api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ChatResponse {
  message: string;
  history: ChatMessage[];
}

export interface ChatHistoryResponse {
  history: ChatMessage[];
}

export async function sendMessage(message: string): Promise<ChatResponse> {
  const response = await api.post('/ai/chatbot', { message });
  return response.data;
}

export async function getChatHistory(): Promise<ChatHistoryResponse> {
  const response = await api.get('/ai/chatbot/history');
  return response.data;
}

export async function clearChatSession(): Promise<{ message: string }> {
  const response = await api.delete('/ai/chatbot/session');
  return response.data;
}

import { ChatWindow } from '@/components/chatbot';

export function ChatPage() {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">AI Assistant</h1>
      <ChatWindow />
    </div>
  );
}

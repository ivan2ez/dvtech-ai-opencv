import { useEffect, useRef, useState, useCallback } from 'react';
import { Trash2, RefreshCw, Loader2 } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import {
  sendMessage,
  getChatHistory,
  clearChatSession,
  type ChatMessage as ChatMessageType,
} from '@/services/chatbotApi';

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const data = await getChatHistory();
        setMessages(data.history ?? []);
      } catch {
        // History fetch failure is non-critical; start with empty chat
      }
    }
    fetchHistory();
  }, []);

  async function handleSend(message: string) {
    setError(null);
    setLastFailedMessage(null);

    // Optimistic update: show user message immediately
    const userMessage: ChatMessageType = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const data = await sendMessage(message);
      // Replace messages with server history (includes assistant reply)
      setMessages(data.history);
    } catch {
      setError('Service is temporarily unavailable. Please try again.');
      setLastFailedMessage(message);
      // Remove the optimistic user message on failure
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function handleRetry() {
    if (lastFailedMessage) {
      handleSend(lastFailedMessage);
    }
  }

  async function handleClear() {
    try {
      await clearChatSession();
      setMessages([]);
      setError(null);
      setLastFailedMessage(null);
    } catch {
      setError('Failed to clear chat session.');
    }
  }

  return (
    <Card className="flex h-[600px] w-full max-w-2xl flex-col">
      <CardHeader className="border-b">
        <CardTitle>AI Assistant</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleClear}
            aria-label="Clear chat"
          >
            <Trash2 className="size-4" />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <div
          ref={scrollRef}
          className="flex h-full flex-col gap-3 overflow-y-auto p-4"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
        >
          {messages.length === 0 && !loading && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Send a message to start the conversation.
            </p>
          )}
          {messages.map((msg, index) => (
            <ChatMessage
              key={index}
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
            />
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </CardContent>

      {error && (
        <div
          className="flex items-center justify-between gap-2 border-t bg-destructive/10 px-4 py-2"
          role="alert"
        >
          <p className="text-sm text-destructive">{error}</p>
          {lastFailedMessage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              aria-label="Retry sending message"
            >
              <RefreshCw className="mr-1 size-3" />
              Retry
            </Button>
          )}
        </div>
      )}

      <CardFooter className="border-t p-4">
        <div className="w-full">
          <ChatInput onSend={handleSend} disabled={loading} />
        </div>
      </CardFooter>
    </Card>
  );
}

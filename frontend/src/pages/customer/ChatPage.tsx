import { ChatWindow } from '@/components/chatbot';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ChatPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground">
          Ask about AC maintenance, troubleshooting, installation tips, or get help choosing the right unit.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Conversation</CardTitle>
          <CardDescription>
            Your full chat history is saved here. Use the floating chat bubble for quick questions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChatWindow />
        </CardContent>
      </Card>
    </div>
  );
}

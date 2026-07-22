import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatWindow } from './ChatWindow';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat window overlay */}
      {isOpen && (
        <div className="mb-3 w-[min(24rem,calc(100vw-3rem))] animate-in fade-in slide-in-from-bottom-4 duration-200">
          <ChatWindow />
        </div>
      )}

      {/* Floating action button */}
      <Button
        onClick={() => setIsOpen((prev) => !prev)}
        size="icon-lg"
        className="size-14 rounded-full shadow-lg"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <X className="size-6" />
        ) : (
          <MessageCircle className="size-6" />
        )}
      </Button>
    </div>
  );
}

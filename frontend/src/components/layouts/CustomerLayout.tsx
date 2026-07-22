import { Outlet } from 'react-router-dom';
import { ChatWidget } from '@/components/chatbot';

export function CustomerLayout() {
  return (
    <>
      <Outlet />
      <ChatWidget />
    </>
  );
}

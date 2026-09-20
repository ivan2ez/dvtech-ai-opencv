import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { LoginForm } from '@/components/auth/LoginForm';

export function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <LoginForm />
      </div>
    </div>
  );
}

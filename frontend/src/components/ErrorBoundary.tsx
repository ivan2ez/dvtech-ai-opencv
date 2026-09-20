import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import type { FallbackProps } from 'react-error-boundary';
import { Button } from '@/components/ui/button';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>
        <p className="text-muted-foreground font-mono text-sm">
          {error.message}
        </p>
        {import.meta.env.DEV && error.stack && (
          <pre className="mt-4 max-h-60 overflow-auto rounded-md bg-muted p-4 text-left text-xs">
            {error.stack}
          </pre>
        )}
        <Button onClick={resetErrorBoundary} className="mt-4">
          Try again
        </Button>
      </div>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        window.location.href = '/';
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}

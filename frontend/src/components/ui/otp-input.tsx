import * as React from 'react';

import { cn } from '@/lib/utils';

export interface OtpInputProps {
  /** Current value. May be shorter than `length` while being typed. */
  value: string;
  onChange: (value: string) => void;
  /** Fired once the final digit is entered, so callers can auto-submit. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  /** Renders the boxes in an error state and marks them invalid. */
  invalid?: boolean;
  /** Describes the group for screen readers. */
  'aria-label'?: string;
  /** Id of an element describing the group (e.g. an error message). */
  'aria-describedby'?: string;
  autoFocus?: boolean;
  className?: string;
}

const DIGITS_ONLY = /\D/g;

/**
 * Segmented one-time-code entry: one box per digit, with auto-advance,
 * backspace-to-previous, arrow navigation, and full-code paste.
 *
 * Each box is a real input so browsers and password managers can autofill an
 * SMS/email code, and the group is labelled for screen readers.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  autoFocus = false,
  className,
  'aria-label': ariaLabel = 'One-time verification code',
  'aria-describedby': ariaDescribedBy,
}: OtpInputProps) {
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);

  const digits = React.useMemo(() => {
    const chars = value.slice(0, length).split('');
    return Array.from({ length }, (_, i) => chars[i] ?? '');
  }, [value, length]);

  const focusBox = React.useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, inputRefs.current.length - 1));
    inputRefs.current[clamped]?.focus();
    inputRefs.current[clamped]?.select();
  }, []);

  /** Applies a new value and reports completion when all boxes are filled. */
  const commit = React.useCallback(
    (next: string) => {
      const trimmed = next.slice(0, length);
      onChange(trimmed);
      if (trimmed.length === length) {
        onComplete?.(trimmed);
      }
    },
    [length, onChange, onComplete]
  );

  function handleChange(index: number, raw: string) {
    const cleaned = raw.replace(DIGITS_ONLY, '');
    if (cleaned.length === 0) return;

    // Typing (or autofilling) more than one digit fills forward from here.
    const next = digits.slice();
    for (let i = 0; i < cleaned.length && index + i < length; i += 1) {
      next[index + i] = cleaned[i] ?? '';
    }
    commit(next.join(''));
    focusBox(index + cleaned.length);
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const next = digits.slice();
      if (next[index]) {
        // Clear the current box first.
        next[index] = '';
        commit(next.join(''));
        return;
      }
      // Already empty — step back and clear the previous box.
      if (index > 0) {
        next[index - 1] = '';
        commit(next.join(''));
        focusBox(index - 1);
      }
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusBox(index - 1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusBox(index + 1);
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      const next = digits.slice();
      next[index] = '';
      commit(next.join(''));
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(DIGITS_ONLY, '');
    if (pasted.length === 0) return;
    commit(pasted);
    focusBox(Math.min(pasted.length, length - 1));
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={cn('flex items-center justify-center gap-2', className)}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          pattern="\d*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          autoFocus={autoFocus && index === 0}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            'h-12 w-11 rounded-lg border border-input bg-transparent text-center text-lg font-semibold',
            'transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            invalid && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30'
          )}
        />
      ))}
    </div>
  );
}

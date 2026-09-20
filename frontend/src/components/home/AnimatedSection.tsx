import type { ReactNode } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

type AnimationVariant = 'fade-up' | 'fade-in' | 'fade-left' | 'fade-right' | 'scale-up';

interface AnimatedSectionProps {
  children: ReactNode;
  variant?: AnimationVariant;
  delay?: number;
  className?: string;
}

const variantStyles: Record<AnimationVariant, { hidden: string; visible: string }> = {
  'fade-up': {
    hidden: 'opacity-0 translate-y-8',
    visible: 'opacity-100 translate-y-0',
  },
  'fade-in': {
    hidden: 'opacity-0',
    visible: 'opacity-100',
  },
  'fade-left': {
    hidden: 'opacity-0 -translate-x-8',
    visible: 'opacity-100 translate-x-0',
  },
  'fade-right': {
    hidden: 'opacity-0 translate-x-8',
    visible: 'opacity-100 translate-x-0',
  },
  'scale-up': {
    hidden: 'opacity-0 scale-95',
    visible: 'opacity-100 scale-100',
  },
};

export function AnimatedSection({
  children,
  variant = 'fade-up',
  delay = 0,
  className = '',
}: AnimatedSectionProps) {
  const { ref, isVisible } = useScrollAnimation();
  const styles = variantStyles[variant];

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${isVisible ? styles.visible : styles.hidden} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

interface StaggerChildrenProps {
  children: ReactNode[];
  variant?: AnimationVariant;
  staggerDelay?: number;
  className?: string;
}

export function StaggerChildren({
  children,
  variant = 'fade-up',
  staggerDelay = 100,
  className = '',
}: StaggerChildrenProps) {
  const { ref, isVisible } = useScrollAnimation();
  const styles = variantStyles[variant];

  return (
    <div ref={ref} className={className}>
      {children.map((child, index) => (
        <div
          key={index}
          className={`transition-all duration-700 ease-out ${isVisible ? styles.visible : styles.hidden}`}
          style={{ transitionDelay: `${index * staggerDelay}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

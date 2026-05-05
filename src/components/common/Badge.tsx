import type { ReactNode } from 'react';

export type BadgeColor = 'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'orange' | 'purple';

const styles: Record<BadgeColor, string> = {
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-700',
  yellow: 'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  purple: 'bg-purple-100 text-purple-700',
};

interface BadgeProps {
  color?: BadgeColor;
  children: ReactNode;
  className?: string;
}

export default function Badge({ color = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[color]} ${className}`}
    >
      {children}
    </span>
  );
}

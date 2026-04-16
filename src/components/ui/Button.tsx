'use client';

import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed',
          {
            'bg-orange-500 hover:bg-orange-600 text-white shadow-md': variant === 'primary',
            'bg-gray-100 hover:bg-gray-200 text-gray-800': variant === 'secondary',
            'bg-red-500 hover:bg-red-600 text-white': variant === 'danger',
            'bg-transparent hover:bg-gray-100 text-gray-700': variant === 'ghost',
            'border-2 border-orange-500 text-orange-500 hover:bg-orange-50': variant === 'outline',
          },
          {
            'text-sm px-3 py-1.5 gap-1.5': size === 'sm',
            'text-base px-4 py-2.5 gap-2': size === 'md',
            'text-lg px-6 py-3 gap-2': size === 'lg',
            'text-xl px-8 py-4 gap-3': size === 'xl',
          },
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;

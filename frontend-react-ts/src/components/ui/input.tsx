import React, { InputHTMLAttributes, forwardRef } from 'react';
import classNames from 'classnames';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  className?: string;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, fullWidth = false, ...props }, ref) => {
    const baseStyles = 'rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-50 bg-white !important';
    
    const errorStyles = error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : '';
    
    const widthStyles = fullWidth ? 'w-full' : '';
    
    const inputClasses = classNames(baseStyles, errorStyles, widthStyles, className);
    
    return (
      <div className={`${fullWidth ? 'w-full' : ''} relative max-w-full overflow-hidden`}>
        <input
          ref={ref}
          className={inputClasses}
          style={{ backgroundColor: 'white' }}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input'; 
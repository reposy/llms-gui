import React, { LabelHTMLAttributes, forwardRef } from 'react';
import classNames from 'classnames';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  className?: string;
  htmlFor?: string;
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required = false, ...props }, ref) => {
    const baseStyles = 'text-sm font-medium text-gray-700 block';
    
    const labelClasses = classNames(baseStyles, className);
    
    return (
      <label
        ref={ref}
        className={labelClasses}
        {...props}
      >
        {children}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
    );
  }
);

Label.displayName = 'Label'; 
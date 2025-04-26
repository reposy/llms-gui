import React, { forwardRef, InputHTMLAttributes } from 'react';
import classNames from 'classnames';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onCheckedChange) {
        onCheckedChange(event.target.checked);
      }
    };

    const checkboxClasses = classNames(
      'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
      className
    );

    return (
      <div className="flex h-4 w-4 items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          className={checkboxClasses}
          checked={checked}
          onChange={handleChange}
          {...props}
        />
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox'; 
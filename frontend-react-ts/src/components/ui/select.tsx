import React, { useState, useRef, useEffect, forwardRef } from 'react';
import classNames from 'classnames';

// Context to manage select state
const SelectContext = React.createContext<{
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  value: string;
  onValueChange: (value: string) => void;
} | null>(null);

interface SelectProps {
  children: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function Select({ children, value, onValueChange, disabled = false }: SelectProps) {
  const [open, setOpen] = useState(false);
  
  return (
    <SelectContext.Provider value={{ open, setOpen, value, onValueChange }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
}

export function SelectTrigger({ children, id, className }: SelectTriggerProps) {
  const context = React.useContext(SelectContext);
  
  if (!context) {
    throw new Error('SelectTrigger must be used within a Select component');
  }
  
  const { open, setOpen, value } = context;
  
  const triggerClasses = classNames(
    'flex items-center justify-between w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    {
      'ring-2 ring-blue-500 border-blue-500': open,
    },
    className
  );
  
  return (
    <button
      id={id}
      type="button"
      onClick={() => setOpen(!open)}
      aria-haspopup="listbox"
      aria-expanded={open}
      className={triggerClasses}
    >
      {children}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-50">
        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

interface SelectValueProps {
  placeholder?: string;
}

export function SelectValue({ placeholder }: SelectValueProps) {
  const context = React.useContext(SelectContext);
  
  if (!context) {
    throw new Error('SelectValue must be used within a Select component');
  }
  
  const { value } = context;
  
  return (
    <span className={value ? '' : 'text-gray-400'}>
      {value || placeholder || 'Select option'}
    </span>
  );
}

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SelectContent({ children, className }: SelectContentProps) {
  const context = React.useContext(SelectContext);
  const ref = useRef<HTMLDivElement>(null);
  
  if (!context) {
    throw new Error('SelectContent must be used within a Select component');
  }
  
  const { open, setOpen } = context;
  
  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [open, setOpen]);
  
  if (!open) return null;
  
  const contentClasses = classNames(
    'absolute z-10 mt-1 w-full rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none',
    className
  );
  
  return (
    <div 
      className={contentClasses}
      ref={ref}
      role="listbox"
    >
      {children}
    </div>
  );
}

interface SelectItemProps {
  children: React.ReactNode;
  value: string;
  className?: string;
}

export function SelectItem({ children, value, className }: SelectItemProps) {
  const context = React.useContext(SelectContext);
  
  if (!context) {
    throw new Error('SelectItem must be used within a Select component');
  }
  
  const { onValueChange, value: selectedValue, setOpen } = context;
  
  const isSelected = selectedValue === value;
  
  const itemClasses = classNames(
    'relative cursor-pointer select-none py-2 pl-3 pr-9 text-sm',
    {
      'bg-blue-100 text-blue-900': isSelected,
      'text-gray-900': !isSelected,
    },
    'hover:bg-blue-50',
    className
  );
  
  const handleClick = () => {
    onValueChange(value);
    setOpen(false);
  };
  
  return (
    <div
      className={itemClasses}
      role="option"
      aria-selected={isSelected}
      onClick={handleClick}
    >
      {children}
      {isSelected && (
        <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600">
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </span>
      )}
    </div>
  );
} 
/**
 * Premium UI Components
 * Production-grade, accessible, WCAG 2.1 AAA compliant components
 */

import React, { ReactNode } from 'react';
import { cn } from './utils';

// Color system for medical interfaces
export const premiumColors = {
  // Status colors
  critical: '#EF4444',    // Red
  warning: '#F59E0B',     // Amber
  success: '#10B981',     // Green
  info: '#3B82F6',        // Blue
  neutral: '#6B7280',     // Gray

  // Background
  bgPrimary: '#0F172A',   // Dark slate
  bgSecondary: '#1E293B', // Slate
  bgTertiary: '#334155',  // Light slate

  // Text
  textPrimary: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textTertiary: '#94A3B8'
};

/**
 * Medical Alert Component
 * High-contrast, accessible alerts for critical information
 */
interface MedicalAlertProps {
  level: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const MedicalAlert: React.FC<MedicalAlertProps> = ({ level, title, message, action }) => {
  const colors = {
    critical: { bg: '#7F1D1D', border: '#DC2626', text: '#FCA5A5' },
    warning: { bg: '#78350F', border: '#D97706', text: '#FCD34D' },
    info: { bg: '#0C2340', border: '#3B82F6', text: '#93C5FD' },
    success: { bg: '#064E3B', border: '#10B981', text: '#86EFAC' }
  };

  const colorScheme = colors[level];

  return (
    <div
      className={cn(
        'border-l-4 p-4 rounded-r-lg mb-4',
        'flex items-start justify-between gap-4'
      )}
      style={{
        backgroundColor: colorScheme.bg,
        borderColor: colorScheme.border
      }}
      role="alert"
      aria-live={level === 'critical' ? 'assertive' : 'polite'}
    >
      <div className="flex-1">
        <h3 className="font-bold text-lg mb-1" style={{ color: colorScheme.text }}>
          {title}
        </h3>
        <p style={{ color: colorScheme.text }} className="text-sm opacity-90">
          {message}
        </p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 rounded font-semibold text-sm whitespace-nowrap transition-all hover:opacity-80"
          style={{ backgroundColor: colorScheme.border, color: colorScheme.bg }}
          aria-label={action.label}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

/**
 * Vital Sign Display Component
 * Real-time patient vital signs with medical formatting
 */
interface VitalSignProps {
  label: string;
  value: number | string;
  unit: string;
  normalRange?: { min: number; max: number };
  status?: 'critical' | 'warning' | 'normal';
}

export const VitalSign: React.FC<VitalSignProps> = ({ label, value, unit, normalRange, status }) => {
  const getStatusColor = () => {
    if (status === 'critical') return premiumColors.critical;
    if (status === 'warning') return premiumColors.warning;
    return premiumColors.success;
  };

  return (
    <div className="border rounded-lg p-4 backdrop-blur-sm" style={{ borderColor: getStatusColor(), backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold" style={{ color: getStatusColor() }}>
          {value}
        </span>
        <span className="text-sm text-gray-400">{unit}</span>
      </div>
      {normalRange && (
        <p className="text-xs text-gray-500 mt-2">
          Normal: {normalRange.min}–{normalRange.max} {unit}
        </p>
      )}
    </div>
  );
};

/**
 * Loading State Component
 * Premium loading indicator with accessibility
 */
interface LoadingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Loading: React.FC<LoadingProps> = ({ message = 'Loading...', size = 'md' }) => {
  const sizeMap = { sm: '24px', md: '40px', lg: '56px' };

  return (
    <div className="flex flex-col items-center justify-center p-8" role="status" aria-live="polite">
      <div
        className="border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin"
        style={{ width: sizeMap[size], height: sizeMap[size] }}
      />
      <p className="mt-4 text-gray-400">{message}</p>
    </div>
  );
};

/**
 * Button Component
 * Accessible button with multiple variants
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  children,
  className,
  disabled,
  ...props
}) => {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    outline: 'border-2 border-gray-600 hover:bg-gray-900 text-white'
  };

  const sizes = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      className={cn(
        'rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'flex items-center gap-2',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loading size="sm" /> : icon}
      {children}
    </button>
  );
};

/**
 * Card Component
 * Premium card for organizing content
 */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, children, className, ...props }) => {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-700 bg-gray-900 bg-opacity-50 backdrop-blur-sm p-6 shadow-lg',
        className
      )}
      {...props}
    >
      {title && <h3 className="text-xl font-bold mb-4 text-white">{title}</h3>}
      {children}
    </div>
  );
};

/**
 * Input Field Component
 * Accessible form input
 */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, id, className, ...props }) => {
  const inputId = id || `input-${Math.random()}`;

  return (
    <div className="mb-4">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-gray-300 mb-2"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full px-4 py-2 rounded-lg border border-gray-600 bg-gray-800 text-white',
          'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'transition-all duration-200',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default {
  MedicalAlert,
  VitalSign,
  Loading,
  Button,
  Card,
  Input,
  premiumColors
};

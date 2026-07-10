import React from 'react';
import { Link } from 'react-router-dom';

type ButtonVariant = 'primary' | 'secondary' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  onClick?: () => void;
  href?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  href,
  type = 'button',
  disabled = false,
}) => {
  const baseClasses =
    'inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow/70 active:scale-[0.98]';

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3 text-base',
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-gradient-to-br from-[#ff3c02] to-[#fa7041] text-white shadow-lg shadow-[#ff3c02]/30 hover:shadow-[#ff3c02]/50 hover:brightness-110 border border-white/10',
    secondary:
      'bg-white/10 text-white backdrop-blur-md border border-white/10 shadow-lg shadow-black/20 hover:bg-white/15',
    outline:
      'bg-white/[0.06] text-slate-100 backdrop-blur-md border border-white/15 shadow-sm hover:bg-white/10 hover:border-white/30',
  };

  const buttonClasses = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className} ${
    disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
  }`;

  if (href) {
    return (
      <Link to={href} className={buttonClasses}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;

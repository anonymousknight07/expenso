import React from 'react';
import { Link } from 'react-router-dom';

type ButtonVariant = 'primary' | 'secondary' | 'outline';

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
  onClick?: () => void;
  href?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  onClick,
  href,
  type = 'button',
  disabled = false,
}) => {
  const baseClasses = 'inline-block rounded-md font-medium transition-colors focus:outline-none px-6 py-3 text-sm';
  
  const variantClasses = {
    primary: 'bg-yellow text-black hover:bg-yellow-600',
    secondary: 'bg-black text-white hover:bg-gray-800',
    outline: 'bg-transparent text-black border-2 border-black hover:bg-black hover:text-white',
  };
  
  const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${className} ${
    disabled ? 'opacity-50 cursor-not-allowed' : ''
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
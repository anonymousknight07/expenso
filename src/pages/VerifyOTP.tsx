import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type OtpType = 'signup' | 'recovery' | 'email';

interface LocationState {
  email?: string;
  type?: OtpType;
  /** After successful verify, where to go */
  redirectTo?: string;
}

const VerifyOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || {};

  const email = state.email || '';
  const otpType: OtpType = state.type || 'signup';
  const redirectTo = state.redirectTo || '/dashboard';

  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];

    if (value.length > 1) {
      // Handle paste: spread digits across inputs
      const digits = value.slice(0, 6).split('');
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // Move back and clear previous
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const token = otp.join('');
    if (token.length !== 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: otpType,
      });

      if (verifyError) throw verifyError;

      if (otpType === 'recovery') {
        // For password reset, redirect to the reset password page
        setSuccess('Code verified! Redirecting...');
        setTimeout(() => navigate('/reset-password', { replace: true }), 1000);
      } else {
        // signup or email OTP login
        setSuccess('Email verified successfully! Redirecting...');
        setTimeout(() => navigate(redirectTo, { replace: true }), 1000);
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('expired')) {
        setError('This code has expired. Please request a new one.');
      } else if (err.message?.toLowerCase().includes('invalid')) {
        setError('Invalid code. Please check and try again.');
      } else {
        setError(err.message || 'Verification failed. Please try again.');
      }
      // Shake effect - clear OTP on error
      setOtp(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResendLoading(true);
    setError('');

    try {
      if (otpType === 'signup' || otpType === 'email') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: otpType === 'signup' },
        });
        if (error) throw error;
      } else if (otpType === 'recovery') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/verify-otp`,
        });
        if (error) throw error;
      }

      setCanResend(false);
      setCountdown(60);
      setOtp(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    if (otp.every((d) => d !== '') && !loading) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const titleMap: Record<OtpType, string> = {
    signup: 'Verify your email',
    recovery: 'Reset your password',
    email: 'Confirm your identity',
  };

  const subtitleMap: Record<OtpType, string> = {
    signup: "We've sent a 6-digit code to confirm your account.",
    recovery: "We've sent a 6-digit code to reset your password.",
    email: "We've sent a 6-digit code to verify your identity.",
  };

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-8 w-full max-w-md text-center">
          <p className="text-gray-300 mb-4">No email address found. Please go back and try again.</p>
          <Link to="/login" className="text-yellow font-medium hover:text-yellow-600">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-card p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <span className="font-serif text-2xl text-white">
              EX<span className="text-yellow">PENSO</span>
            </span>
          </Link>
          <h1 className="text-2xl font-serif mt-6">{titleMap[otpType]}</h1>
          <p className="text-gray-300 text-sm mt-2">{subtitleMap[otpType]}</p>
          <p className="text-sm font-medium text-gray-100 mt-1">{email}</p>
        </div>

        {/* Error / Success */}
        {error && (
          <div className="bg-red-500/10 text-red-400 p-3 rounded mb-4 text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 text-emerald-400 p-3 rounded mb-4 text-sm">{success}</div>
        )}

        {/* OTP Input Grid */}
        <div className="flex justify-center gap-3 mb-8">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onFocus={(e) => e.target.select()}
              className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-yellow focus:border-transparent
                transition-all duration-150
                ${digit ? 'border-yellow bg-yellow/5' : 'border-white/15'}
                ${error ? 'border-red-300 animate-shake' : ''}
              `}
            />
          ))}
        </div>

        {/* Verify Button */}
        <button
          onClick={handleVerify}
          disabled={loading || otp.some((d) => !d)}
          className="w-full py-3 px-4 bg-yellow text-white font-bold rounded-md
            hover:bg-yellow-400 transition-colors duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-yellow focus:ring-offset-2"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Verifying...
            </span>
          ) : (
            'Verify Code'
          )}
        </button>

        {/* Resend */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-300">
            Didn't receive the code?{' '}
            {canResend ? (
              <button
                onClick={handleResend}
                disabled={resendLoading}
                className="font-medium text-yellow hover:text-yellow-600 disabled:opacity-50"
              >
                {resendLoading ? 'Sending...' : 'Resend code'}
              </button>
            ) : (
              <span className="text-gray-400">
                Resend in <span className="font-medium text-gray-300">{countdown}s</span>
              </span>
            )}
          </p>
        </div>

        {/* Back link */}
        <div className="mt-4 text-center">
          <Link
            to={otpType === 'recovery' ? '/forgotPassword' : '/login'}
            className="text-sm text-gray-400 hover:text-gray-200"
          >
            ← Back
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;
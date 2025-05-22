import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/common/Button';
import { supabase } from '../lib/supabase';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if user has a valid session for password reset
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setIsValidSession(true);
        } else {
          // Try to get session from URL hash parameters (common with email links)
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (data.session && !error) {
              setIsValidSession(true);
            } else {
              setError('Invalid or expired reset link. Please request a new password reset.');
            }
          } else {
            setError('Invalid or expired reset link. Please request a new password reset.');
          }
        }
      } catch (error: any) {
        setError('Something went wrong. Please try again.');
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate passwords
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;
      
      setSuccess('Password updated successfully! Redirecting to login...');
      
      // Sign out the user and redirect to login after a short delay
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/login');
      }, 2000);
      
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block">
              <span className="font-serif text-2xl text-black">
                EX<span className="text-yellow">PENSO</span>
              </span>
            </Link>
            <h1 className="text-2xl font-serif mt-6">Invalid Reset Link</h1>
          </div>
          
          <div className="bg-red-50 text-red-500 p-3 rounded mb-4">
            {error}
          </div>
          
          <div className="text-center space-y-4">
            <Link to="/forgot-password">
              <Button variant="primary" className="w-full">
                Request New Reset Link
              </Button>
            </Link>
            
            <p className="text-sm text-gray-600">
              <Link to="/login" className="font-medium text-yellow hover:text-yellow-600">
                Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <span className="font-serif text-2xl text-black">
              EX<span className="text-yellow">PENSO</span>
            </span>
          </Link>
          <h1 className="text-2xl font-serif mt-6">Set New Password</h1>
          <p className="text-gray-600 text-sm mt-2">
            Enter your new password below.
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow focus:border-transparent"
              placeholder="••••••••"
              required
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters long</p>
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow focus:border-transparent"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          
          <Button 
            type="submit" 
            variant="primary" 
            className="w-full" 
            disabled={loading || success}
          >
            {loading ? 'Updating Password...' : 'Update Password'}
          </Button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Remember your password?{' '}
            <Link to="/login" className="font-medium text-yellow hover:text-yellow-600">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
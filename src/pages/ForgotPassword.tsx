import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/common/Button';
import { supabase } from '../lib/supabase';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        // Check if the error is related to user not found
        if (error.message.includes('User not found') || 
            error.message.includes('email not confirmed') ||
            error.message.includes('Invalid login credentials') ||
            error.status === 400) {
          throw new Error('Account not found. Please create one.');
        }
        throw error;
      }
      
      setSuccess('Password reset email sent! Check your inbox for further instructions.');
      setEmail(''); // Clear the form
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <span className="font-serif text-2xl text-black">
              EX<span className="text-yellow">PENSO</span>
            </span>
          </Link>
          <h1 className="text-2xl font-serif mt-6">Reset your password</h1>
          <p className="text-gray-600 text-sm mt-2">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded mb-4">
            {error}
            {error.includes('Account not found') && (
              <div className="mt-2">
                <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-800 underline">
                  Create an account here
                </Link>
              </div>
            )}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow focus:border-transparent"
              placeholder="your@email.com"
              required
            />
          </div>
          
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Remember your password?{' '}
            <Link to="/login" className="font-medium text-yellow hover:text-yellow-600">
              Back to Login
            </Link>
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-yellow hover:text-yellow-600">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
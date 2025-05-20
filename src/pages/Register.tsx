import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import { supabase } from '../lib/supabase';
import { Check } from 'lucide-react';

// TypeScript interfaces
interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface AuthData {
  user: {
    id: string;
  } | null;
  session: object | null;
}

interface SupabaseError {
  message: string;
}

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  // Handle form field changes with proper typing
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData({
      ...formData,
      [id]: value,
    });
  };
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Sign up user with Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (!authData?.user) {
        throw new Error('User registration failed');
      }
      
      // Check if email confirmation is needed
      if (authData.user && !authData.session) {
        console.log('Email confirmation required');
        
        // Create profile in the background - might fail due to RLS but will be created on first login
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
              id: authData.user.id,
              first_name: formData.firstName,
              last_name: formData.lastName,
              avatar_url: null,
              xp: 0,
              level: 1,
              health_score: 75,
            }]);
            
          if (profileError) {
            console.log('Profile will be created after email confirmation:', profileError);
          }
        } catch (profileErr) {
          console.log('Profile creation deferred to first login');
        }
        
        // Show confirmation message instead of error
        setRegistrationComplete(true);
        return;
      }

      // If we have a session, continue with regular flow
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) throw signInError;
      
      // Verify we have a valid session
      if (!signInData?.session) {
        throw new Error('Failed to establish authentication session');
      }

      // Step 3: Create the profile with the established session
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          avatar_url: null,
          xp: 0,
          level: 1,
          health_score: 75,
        }]);

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }

      navigate('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      // Handle specific error types
      if (error instanceof Error && error.message.includes('Email not confirmed')) {
        setRegistrationComplete(true);
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        {registrationComplete ? (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-700 mb-2">Check your email</h2>
            <p className="text-gray-600 mb-6">
              We've sent a confirmation link to <strong>{formData.email}</strong>. 
              Please check your inbox and click the link to activate your account.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              If you don't see the email, check your spam folder or junk mail.
            </p>
            <Link 
              to="/login" 
              className="text-yellow hover:text-yellow-600 font-medium"
            >
              Return to login
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <Link to="/" className="inline-block">
                <span className="font-serif text-2xl text-black">
                  EX<span className="text-yellow">PENSO</span>
                </span>
              </Link>
              <h1 className="text-2xl font-serif mt-6">Create your account</h1>
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-500 p-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow focus:border-transparent"
                    placeholder="John"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow focus:border-transparent"
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow focus:border-transparent"
                  placeholder="your@email.com"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
              </div>
              
              <div className="flex items-center">
                <input
                  id="agree_terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 text-yellow focus:ring-yellow border-gray-300 rounded"
                />
                <label htmlFor="agree_terms" className="ml-2 block text-sm text-gray-700">
                  I agree to the{' '}
                  <Link to="/terms" className="font-medium text-yellow hover:text-yellow-600">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="font-medium text-yellow hover:text-yellow-600">
                    Privacy Policy
                  </Link>
                </label>
              </div>
              
              <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-yellow hover:text-yellow-600">
                  Login
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Register;
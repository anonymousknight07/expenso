import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from '../supabaseClient';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); 

  const handleSignUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      alert(error.message);
    } else {
      alert('Check your email for verification link!');
    }
    setLoading(false);
  };

  const handleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
    } else {
      navigate('/dashboard'); 
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        type="email"
        placeholder="Email"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black"
        onChange={(e) => setPassword(e.target.value)}
      />
      <button
        onClick={handleSignIn}
        disabled={loading}
        className="w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition-colors"
      >
        Sign In
      </button>
      <button
        onClick={handleSignUp}
        disabled={loading}
        className="w-full border border-black text-black py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        Sign Up
      </button>
    </div>
  );
}
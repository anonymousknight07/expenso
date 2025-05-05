import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

export default function Dashboard() {
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div>
      <h1>Welcome, {user?.email}</h1>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

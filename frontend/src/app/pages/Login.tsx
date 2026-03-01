import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Heart, Users } from 'lucide-react';

export const Login: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup } = useApp();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        await signup(email, password, name);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #FFD4C8 0%, #E0D5F0 50%, #D0EBF5 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center mb-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#C8B3E0] via-[#FFB5A0] to-[#A8D8EA] opacity-20"></div>
            <div className="relative flex items-center gap-1">
              <Heart className="w-8 h-8 text-[#C8B3E0] fill-[#C8B3E0]" />
              <Users className="w-6 h-6 text-[#FFB5A0]" />
            </div>
          </div>
          <h1 className="text-3xl mb-2 text-[#4A4A4A]">Flock</h1>
          <p className="text-center text-[#8A8A8A]">Mental health accountability with friends</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h2 className="text-2xl mb-6 text-center text-[#4A4A4A]">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block mb-2 text-[#4A4A4A]">Name</label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7]"
                />
              </div>
            )}
            
            <div>
              <label className="block mb-2 text-[#4A4A4A]">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7]"
              />
            </div>
            
            <div>
              <label className="block mb-2 text-[#4A4A4A]">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="rounded-2xl border-[#E0D5F0] focus:border-[#C8B3E0] bg-[#FFFBF7]"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full rounded-2xl h-12 text-white shadow-lg cursor-pointer pointer-events-auto"
              style={{ background: 'linear-gradient(135deg, #C8B3E0 0%, #B39DD1 100%)' }}
            >
              {loading ? (isSignUp ? 'Signing up…' : 'Logging in…') : isSignUp ? 'Sign Up' : 'Log In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[#C8B3E0] hover:text-[#B39DD1] transition-colors cursor-pointer"
            >
              {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        {/* Demo hint */}
        <div className="mt-6 text-center text-sm text-[#8A8A8A]">
          <p>Demo: Sign up with any email to get started</p>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Mail, Lock, User, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuthCard() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { login, register, loading, error, clearError } = useAuthStore();

  useEffect(() => {
    clearError();
  }, [isRegister, clearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isRegister) {
      await register(username, email, password);
    } else {
      await login(email, password);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-16 px-4">
      {/* Branding / Header */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 mb-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
          {isRegister ? 'Create your account' : 'Sign in to SpatialRoom'}
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          {isRegister 
            ? 'Join the real-time virtual spatial communication environment' 
            : 'Enter your credentials to enter the workspace'}
        </p>
      </div>

      {/* Main card */}
      <div className="premium-card rounded-2xl p-8 border-t border-t-indigo-500/40 shadow-xl shadow-black/40">
        <form onSubmit={handleSubmit} className="space-y-5">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {isRegister && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-1.5 overflow-hidden"
              >
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                  Username
                </label>
                <div className="relative rounded-lg">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. janesmith"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg premium-input text-sm"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
              {isRegister ? 'Email Address' : 'Email or Username'}
            </label>
            <div className="relative rounded-lg">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type={isRegister ? "email" : "text"}
                required
                placeholder={isRegister ? "jane@example.com" : "username or email"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg premium-input text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
              Password
            </label>
            <div className="relative rounded-lg">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg premium-input text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm cursor-pointer border border-indigo-500/20"
          >
            {loading ? (
              <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
            ) : (
              <>
                <span>{isRegister ? 'Register' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-zinc-800/60 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            {isRegister 
              ? 'Already have an account? Sign in' 
              : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}

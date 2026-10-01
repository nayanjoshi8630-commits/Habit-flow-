/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Sparkles, 
  Clock, 
  Flame, 
  Cloud, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle,
  Loader2,
  CheckCircle2,
  Copy,
  ExternalLink
} from 'lucide-react';
import { signInWithGoogle, User } from '../lib/firebase';

interface GoogleLoginViewProps {
  onLoginSuccess: (user: User) => void;
  onContinueAsGuest: () => void;
}

export default function GoogleLoginView({
  onLoginSuccess,
  onContinueAsGuest,
}: GoogleLoginViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyHost = () => {
    if (navigator.clipboard && currentHost) {
      navigator.clipboard.writeText(currentHost);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setIsUnauthorizedDomain(false);
    setIsLoading(true);

    // Timeout safety guard so user is never stuck in infinite loading
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('SIGNIN_TIMEOUT'));
      }, 45000);
    });

    try {
      const result = await Promise.race([signInWithGoogle(), timeoutPromise]);
      if (result && result.user) {
        onLoginSuccess(result.user);
      }
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      if (err?.code === 'auth/unauthorized-domain') {
        setIsUnauthorizedDomain(true);
        setErrorMsg('Domain not authorized in Firebase Console.');
      } else if (err?.code === 'auth/popup-blocked') {
        setErrorMsg('The sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (err?.message === 'SIGNIN_TIMEOUT') {
        setErrorMsg('Sign-in window timed out or was closed in the background. Please try again or continue as guest.');
      } else if (err?.code === 'auth/network-request-failed') {
        setErrorMsg('Network error. Please check your internet connection and try again.');
      } else if (err?.message) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Could not complete Google sign-in. Please try again or continue as guest.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="google-login-view" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Ambient background glow accents */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60 flex flex-col items-center text-center relative z-10 animate-fadeIn">
        
        {/* App Logo & Icon */}
        <div className="relative mb-5 group">
          <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 rounded-3xl blur-md opacity-75 group-hover:opacity-100 transition-opacity" />
          <img 
            src="/icon.svg" 
            alt="HabitFlow App Icon" 
            className="relative w-20 h-20 rounded-2xl shadow-xl border border-slate-700/60 object-cover bg-slate-950 p-1"
          />
        </div>

        {/* Header Title */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
          Welcome to <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">HabitFlow</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium max-w-xs leading-relaxed">
          Your daily routine planner with smart alarm chimes, habit streaks, and Gemini coaching.
        </p>

        {/* Feature Highlights Grid */}
        <div className="w-full grid grid-cols-2 gap-2.5 my-6 text-left">
          <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-850 flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black text-slate-200 block truncate">Routines & Alarms</span>
              <span className="text-[9px] text-slate-400 font-medium block truncate">Custom device tunes</span>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-850 flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black text-slate-200 block truncate">Habit Streaks</span>
              <span className="text-[9px] text-slate-400 font-medium block truncate">Badges & coins</span>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-850 flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black text-slate-200 block truncate">AI Coach</span>
              <span className="text-[9px] text-slate-400 font-medium block truncate">Gemini routine advisor</span>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-850 flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black text-slate-200 block truncate">Cloud Synced</span>
              <span className="text-[9px] text-slate-400 font-medium block truncate">Auto-saved to Firestore</span>
            </div>
          </div>
        </div>

        {/* Error notification banner */}
        {isUnauthorizedDomain ? (
          <div className="w-full mb-5 p-3.5 rounded-2xl bg-amber-950/70 border border-amber-500/40 text-left animate-fadeIn shadow-lg">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs mb-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Firebase: Add Authorized Domain</span>
            </div>
            <p className="text-[11px] text-amber-200/90 leading-relaxed mb-2.5">
              Firebase Authentication requires your current preview domain to be registered in your Firebase project (<strong className="text-white">habitflow-hakari-fd9b9</strong>).
            </p>
            
            <div className="p-2 rounded-xl bg-black/40 border border-amber-500/20 flex items-center justify-between gap-2 mb-3">
              <span className="text-[10px] font-mono text-amber-100 truncate select-all">{currentHost}</span>
              <button
                type="button"
                onClick={handleCopyHost}
                className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
              >
                {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="text-[10px] text-amber-300/80 space-y-1">
              <div>1. Go to <strong>Firebase Console → Authentication → Settings</strong></div>
              <div>2. In <strong>Authorized domains</strong>, click <strong>Add domain</strong> and paste this host</div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-amber-500/20 flex items-center justify-between">
              <span className="text-[10px] text-amber-200/70">Or continue locally now:</span>
              <button
                type="button"
                onClick={onContinueAsGuest}
                className="text-[11px] font-black text-amber-300 hover:text-white underline cursor-pointer"
              >
                Use Guest Mode →
              </button>
            </div>
          </div>
        ) : errorMsg ? (
          <div className="w-full mb-4 p-3 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2 text-left animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        ) : null}

        {/* Primary Action: Google Sign In Button */}
        <button
          id="google-signin-btn"
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full py-3.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-black rounded-2xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3 cursor-pointer select-none active:scale-[0.99] disabled:opacity-75 disabled:cursor-not-allowed group border border-slate-200"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
              <span className="text-sm">Connecting with Google...</span>
            </>
          ) : (
            <>
              {/* Google 4-Color 'G' Logo SVG */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span className="text-sm tracking-wide">Sign in with Google</span>
            </>
          )}
        </button>

        {/* Secondary Action: Continue as Guest */}
        <div className="w-full mt-3 flex flex-col items-center gap-2">
          <button
            id="continue-guest-btn"
            type="button"
            onClick={onContinueAsGuest}
            disabled={isLoading}
            className="w-full py-2.5 px-4 text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Continue as Guest (Local Mode)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Security badge */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 w-full flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Secure Google OAuth • Automatic Cloud Backup</span>
        </div>

      </div>

      {/* Footer Branding */}
      <div className="mt-6 text-center text-xs text-slate-400 font-bold flex items-center gap-2 relative z-10">
        <img src="/icon.svg" alt="HabitFlow" className="w-4 h-4 opacity-70" />
        <span>HabitFlow Web • Free & Secure</span>
      </div>
    </div>
  );
}

import { createContext, useContext, useEffect, useState, ReactNode, useRef, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../lib/types';
import { getCurrencyFromTimezone } from '../hooks/useCurrency';

interface PendingRegistration {
  fullName: string;
  email: string;
  password: string;
  phone: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isRegistering: boolean;
  pendingRegistration: PendingRegistration | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  startPhoneRegistration: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: Error | null }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  sendPhoneOtp: (phone: string) => Promise<{ error: Error | null }>;
  clearPendingRegistration: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkPhoneExists: (phone: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const EDGE_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-verify`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function twilioSend(phone: string): Promise<{ error: Error | null }> {
  const res = await fetch(EDGE_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ action: 'send', phone }),
  });
  const data = await res.json();
  if (!res.ok) return { error: new Error(data.error || 'Failed to send code') };
  return { error: null };
}

async function twilioVerify(phone: string, code: string): Promise<{ error: Error | null }> {
  const res = await fetch(EDGE_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ action: 'verify', phone, code }),
  });
  const data = await res.json();
  if (!res.ok) return { error: new Error(data.error || 'Invalid code') };
  return { error: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const isRegisteringRef = useRef(false);
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) console.error("[Auth] Fetch error:", error);
    setProfile(data || null);
    return data;
  }

  async function refreshProfile() {
    if (user) {
      setLoading(true);
      await fetchProfile(user.id);
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        if (isRegisteringRef.current) return;
        if (event === 'SIGNED_IN') setLoading(true);
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    user, session, profile, loading, isRegistering, pendingRegistration,
    signIn: async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error as Error | null };
    },
    startPhoneRegistration: async (email: string, password: string, fullName: string, phone: string) => {
      const { error } = await twilioSend(phone);
      if (error) return { error };
      setPendingRegistration({ email, password, fullName, phone });
      return { error: null };
    },
    verifyPhoneOtp: async (phone: string, token: string) => {
      const { error: twilioError } = await twilioVerify(phone, token);
      if (twilioError) return { error: twilioError };

      if (pendingRegistration) {
        const { fullName, email, password } = pendingRegistration;

        isRegisteringRef.current = true;
        setIsRegistering(true);
        setLoading(true);

        try {
          // 1. Sign up + Store name in metadata
          const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
          });
          if (signUpError) throw signUpError;

          if (data.user) {
            // 2. Create the profile record
            const { error: insertError } = await supabase.from('profiles').insert({
              user_id: data.user.id,
              full_name: fullName,
              email,
              phone,
              role: 'mentee',
              preferred_currency: getCurrencyFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone),
            });
            if (insertError) console.error("Profile creation error:", insertError);

            await new Promise(r => setTimeout(r, 800));
            await fetchProfile(data.user.id);
          }

          setPendingRegistration(null);
          return { error: null };
        } catch (err) {
          return { error: err as Error };
        } finally {
          isRegisteringRef.current = false;
          setIsRegistering(false);
          setLoading(false);
        }
      }
      return { error: null };
    },
    checkPhoneExists: async (phone: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();
      if (error) {
        // If we can't verify (e.g. table empty), fail open to avoid false negatives.
        console.error('[Auth] phone check error:', error);
        return false;
      }
      return !!data;
    },
    sendPhoneOtp: (phone: string) => twilioSend(phone),
    clearPendingRegistration: () => setPendingRegistration(null),
    signOut: async () => {
      setLoading(true);
      await supabase.auth.signOut();
      setProfile(null);
      setPendingRegistration(null);
      setLoading(false);
    },
    refreshProfile
  }), [user, session, profile, loading, isRegistering, pendingRegistration]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

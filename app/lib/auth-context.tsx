'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setUserProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    setUserProfile(data);
    setLoading(false);
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

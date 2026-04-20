'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';

const ADMIN_EMAIL = 'nakamae@mub.biglobe.ne.jp';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false); // 新規ユーザーフラグ

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

    if (data) {
      // 既存ユーザー：プロフィールあり
      setUserProfile(data);
      setIsNewUser(false);
    } else {
      // 新規ユーザー：usersテーブルに未登録
      setUserProfile(null);
      setIsNewUser(true);
    }
    setLoading(false);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
    setIsNewUser(false);
  };

  // 新規ユーザーが属性を登録する
  const registerProfile = async (name: string, role: string) => {
    if (!user) return { error: 'ログインが必要です' };

    const isAdmin = user.email === ADMIN_EMAIL;

    const { data, error } = await supabase
      .from('users')
      .insert({
        id: user.id,
        email: user.email,
        name,
        role,
        is_admin: isAdmin,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (!error && data) {
      setUserProfile(data);
      setIsNewUser(false);
    }
    return { error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      isNewUser,
      signIn,
      signOut,
      registerProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

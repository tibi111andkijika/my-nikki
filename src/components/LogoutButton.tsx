// src/components/SignOutButton.tsx
// import React from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function SignOutButton() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return;
    }
    // ログアウト後はログイン画面へリダイレクト
    navigate('/', { replace: true });
  };

  return (
    <button onClick={handleSignOut}>
      サインアウト
    </button>
  );
}

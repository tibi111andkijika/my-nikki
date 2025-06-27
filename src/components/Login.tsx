import React, { useEffect, useState } from 'react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react'; // これが正しい

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const user = session.user;
          const { data: existingProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('id, username')
            .eq('id', user.id)
            .single();

          if (profileError && profileError.code === 'PGRST116') {
            console.log('No existing profile found, creating new one.');
            const initialUsername = `user_${user.id.replace(/-/g, '').substring(0, 15)}`;
            const { error: upsertError } = await supabase
              .from('user_profiles')
              .upsert(
                [{
                  id: user.id,
                  username: null,
                  preferred_language: 'en',
                }],
                { onConflict: 'id' }
              );

            if (upsertError) {
              console.error('Error upserting profile in Login.tsx:', upsertError);
            } else {
              console.log('User profile created/updated successfully with initial username:', initialUsername);
            }
          } else if (profileError) {
            console.error('Error fetching existing profile:', profileError);
            navigate('/', { replace: true });
            return;
          } else {
            console.log('Existing profile found:', existingProfile);
          }

          // ★上の処理を削除またはコメントアウトした後、必ずこの行でprofileページにリダイレクトします★
          navigate('/profile', { replace: true });

        }
        if (event === 'SIGNED_OUT') {
          console.log('User signed out from Login page.');
          navigate('/', { replace: true });
        }
        setLoading(false);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return <p style={{ textAlign: 'center', marginTop: '2rem' }}>Loading...</p>;
  }

  return (
    <div style={{ maxWidth: 400, margin: '4rem auto', textAlign: 'center' }}>
      <h2>Login / Sign Up</h2>
      <Auth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={[]}
      />
    </div>
  );
};

export default Login;
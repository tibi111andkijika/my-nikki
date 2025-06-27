import React, { useEffect, useState, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Layout from './Layout';
import Self from './components/Self';
import Friends from './components/Friends';
import World from './components/World';
import UserSearch from './components/UserSearch';
import UserSettings from './components/UserProfile';
import Login from './components/Login';
import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';
import { AppContextProvider, useAppContext } from './context/AppContext';
import Profile from './components/Profile';
import Front from './front/Front';
import { z } from 'zod';

// --- Zodカスタムエラーマップ (変更なし) ---
const customErrorMap = (issue: z.ZodIssueOptionalMessage, ctx: { defaultError: string }, translations: any): { message: string } => {
  let message: string;
  const zodErrors = translations?.zod_errors || {};

  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      message = zodErrors.invalid_type || `Expected ${issue.expected}, received ${issue.received}.`;
      break;
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string' && issue.minimum === 1) {
        message = zodErrors.required || `This field is required.`;
      } else if (issue.type === 'string') {
        message = zodErrors.string_min ? zodErrors.string_min.replace('{min}', issue.minimum.toString()) : `Must be at least ${issue.minimum} characters.`;
      } else {
        message = zodErrors.too_small ? zodErrors.too_small.replace('{minimum}', issue.minimum.toString()) : `Value too small: ${issue.minimum}.`;
      }
      break;
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') {
        message = zodErrors.string_max ? zodErrors.string_max.replace('{max}', issue.maximum.toString()) : `Must be at most ${issue.maximum} characters.`;
      } else {
        message = zodErrors.too_big ? zodErrors.too_big.replace('{maximum}', issue.maximum.toString()) : `Value too big: ${issue.maximum}.`;
      }
      break;
    case z.ZodIssueCode.invalid_string:
      if (issue.path.includes('username')) {
        message = zodErrors.invalid_username_format || 'Username can only contain alphanumeric characters and underscores.';
      } else if (issue.validation === 'email') {
        message = zodErrors.invalid_string_email || 'Invalid email address.';
      } else {
        message = zodErrors.invalid_string || 'Invalid string.';
      }
      break;
    case z.ZodIssueCode.custom:
      if (issue.params && typeof issue.params === 'object' && 'i18nKey' in issue.params) {
        const i18nKey = (issue.params as { i18nKey: string }).i18nKey;
        message = zodErrors[i18nKey] || (issue.message || ctx.defaultError);
      } else {
        message = issue.message || ctx.defaultError;
      }
      break;
    default:
      message = ctx.defaultError;
  }

  return { message };
};

// --- AppContent コンポーネント ---
const AppContent: React.FC = () => {
  const { language, translations } = useAppContext();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [usernameExists, setUsernameExists] = useState<boolean | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  // タイムアウト管理用のref
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef<boolean>(false);

  // Zodエラーマップの更新
  useEffect(() => {
    z.setErrorMap((issue, ctx) => customErrorMap(issue, ctx, translations));
    console.log('AppContent DEBUG: Zod error map updated for language:', language);
  }, [language, translations]);

  // ロードタイムアウトを設定する関数
  const setLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    loadingTimeoutRef.current = setTimeout(() => {
      setLoadingError('読み込みに時間がかかっています。ページを再読み込みします...');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }, 10000); // 10秒でタイムアウト
  }, []);

  // ロードタイムアウトをクリアする関数
  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  // ユーザープロファイルとユーザー名を確認する関数を useCallback でメモ化
  const checkUserAndProfile = useCallback(async (currentUser: User | null, forceCheck = false) => {
    // 既にチェック中の場合は重複実行を防ぐ
    if (isCheckingRef.current && !forceCheck) {
      return;
    }

    isCheckingRef.current = true;
    setLoading(true);
    setLoadingError(null);
    setLoadingTimeout(); // タイムアウトを設定
    

    try {
      if (!currentUser) {
        setUser(null);
        setUsernameExists(null);
        return;
      }

      setUser(currentUser);

      const { data: userProfile, error } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', currentUser.id)
        .maybeSingle();


      if (error) {
        setUsernameExists(false); 
        if (location.pathname !== '/profile') { 
          navigate('/profile', { replace: true });
        }
      } else if (userProfile === null) { 
        setUsernameExists(false); 
        if (location.pathname !== '/profile') { 
          navigate('/profile', { replace: true });
        }
      } else { 
        const hasUsername = userProfile.username !== null && userProfile.username.trim() !== ''; 
        setUsernameExists(hasUsername);

        if (!hasUsername) {
          if (location.pathname !== '/profile') { 
            navigate('/profile', { replace: true });
          }
        }
      }
    } catch (error: any) { 
      setUsernameExists(false);
      setLoadingError('プロファイルの読み込み中にエラーが発生しました。');
    } finally {
      isCheckingRef.current = false;
      setLoading(false);
      clearLoadingTimeout(); // タイムアウトをクリア
    }
  }, [navigate, location.pathname, setLoadingTimeout, clearLoadingTimeout]); 

  // ページの可視性変更とフォーカスイベントを処理
  const handlePageVisibilityChange = useCallback(async () => {
    if (document.visibilityState === 'visible' && !document.hidden) {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          setLoadingError('セッションの確認中にエラーが発生しました。');
        } else {
          await checkUserAndProfile(session?.user ?? null, true); // 強制チェック
        }
      } catch (error) {
        setLoadingError('セッションの確認中にエラーが発生しました。');
      }
    }
  }, [checkUserAndProfile]);

  const handleWindowFocus = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        setLoadingError('セッションの確認中にエラーが発生しました。');
      } else {
        await checkUserAndProfile(session?.user ?? null, true); // 強制チェック
      }
    } catch (error) {
      setLoadingError('セッションの確認中にエラーが発生しました。');
    }
  }, [checkUserAndProfile]);

  // 初回ロード時と認証状態の変更を監視
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await checkUserAndProfile(session?.user ?? null); 
      if (_event === 'SIGNED_OUT') {
        navigate('/', { replace: true });
      }
    });

    const getInitialSessionAndProfile = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('AppContent DEBUG: Error getting initial session:', error);
          setLoadingError('初期セッションの取得中にエラーが発生しました。');
        } else {
          await checkUserAndProfile(session?.user ?? null);
        }
      } catch (error) {
        console.error('AppContent DEBUG: Critical error during initial session check:', error);
        setLoadingError('初期化中にエラーが発生しました。');
      }
    };

    getInitialSessionAndProfile();

    // イベントリスナーを追加
    document.addEventListener('visibilitychange', handlePageVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    // クリーンアップ
    return () => {
      authListener.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handlePageVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      clearLoadingTimeout();
    };
  }, [checkUserAndProfile, navigate, handlePageVisibilityChange, handleWindowFocus, clearLoadingTimeout]); 

  // loadingがtrueの間はLoading表示
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f2f2f7'
      }}>
        <div style={{ marginBottom: '20px' }}>読み込み中...</div>
        {loadingError && (
          <div style={{ 
            color: 'red', 
            textAlign: 'center',
            padding: '10px',
            backgroundColor: '#ffe6e6',
            borderRadius: '5px',
            margin: '10px'
          }}>
            {loadingError}
          </div>
        )}
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#42a5f5',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          ページを再読み込み
        </button>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Front />} />
      <Route path="/login" element={user ? <Navigate to="/self" replace /> : <Login />} />
      {user ? (
        <>
          {usernameExists === false ? (
            <Route path="*" element={<UserSettings />} />
          ) : (
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/self" replace />} />
              <Route path="/self" element={<Self />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/world" element={<World />} />
              <Route path="/search" element={<UserSearch />} />
              <Route path="/profile" element={<UserSettings />} /> 
              <Route path="/profile/:id" element={<Profile />} />
              <Route path="*" element={<Navigate to="/self" replace />} />
            </Route>
          )}
        </>
      ) : (
        <Route path="*" element={<Navigate to="/" replace />} />
      )}
    </Routes>
  );
};

// --- App コンポーネント ---
const App: React.FC = () => {
  return (
    <Router>
      <AppContextProvider>
        <AppContent />
      </AppContextProvider>
    </Router>
  );
};

export default App;
 
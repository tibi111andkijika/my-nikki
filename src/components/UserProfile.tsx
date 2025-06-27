import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAppContext } from '../context/AppContext';
import Logout from './LogoutButton';
// import { User } from '@supabase/supabase-js'; // User型をインポート
import { useNavigate } from 'react-router-dom';

// React Hook FormとZod関連のインポート
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UsernameSchema, UsernameInputs } from '../schemas/userSettingsSchemas'; 

// 型定義（変更なし）
// interface FollowData {
//   follower_id: string;
//   following_id: string;
//   id: string;
// }

const UserSettings: React.FC = () => {
  // スタイル定義 (変更なし)
  const cardStyle = {
    backgroundColor: '#fff',
    color: '#000',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  };

  const GOOGLE_FORM_URL = "https://forms.gle/aADHFXFeU137gqr56";

  const pageStyle = {
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
    padding: '30px',
    fontFamily: 'sans-serif',
  };

  const { language, setLanguage, translations } = useAppContext();
  const navigate = useNavigate();
  const [username, setUsername] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [followersList, setFollowersList] = useState<{ id: string; username: string }[]>([]);
  const [followingList, setFollowingList] = useState<{ id: string; username: string }[]>([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);

  // React Hook Formの設定
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    reset, 
    setValue,
    setError, 
  } = useForm<UsernameInputs>({
    resolver: zodResolver(UsernameSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      username: '',
    },
  });

  // useEffect での認証状態監視と情報取得
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setLoading(true); // 必ずローディングを開始

      const user = session?.user;
      
      if (!user) {
        // ユーザーがサインアウトした場合、すべてのユーザー関連の状態をリセット
        setUserId(null);
        setUsername(null);
        setFollowerCount(0);
        setFollowingCount(0);
        setFollowersList([]);
        setFollowingList([]);
        setNeedsUsernameSetup(false); 
        setIsEditingUsername(false); 
        setLoading(false);
        return;
      }

      const uid = user.id;
      setUserId(uid);

      try {
        // ★★★ single() から maybeSingle() に変更 ★★★
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', uid)
          .maybeSingle(); // ★★★ ここを変更 ★★★

        if (profileError) {
          // maybeSingle() でも2行以上の場合などエラーは発生しうる
          setUsername(null); 
          setValue('username', '');
          setNeedsUsernameSetup(true); 
          setIsEditingUsername(true); 
        } else if (userProfile === null) { // ★★★ userProfile が null の場合を追加 ★★★
          // プロファイルが見つからない場合（新規ユーザーなど）
          setUsername(null); 
          setValue('username', ''); // フォームの値をクリア
          setNeedsUsernameSetup(true); // ユーザー名設定が必要
          setIsEditingUsername(true); // 編集モードにする
        } else { // userProfile が有効なオブジェクトの場合
          const currentUsername = userProfile.username; 
          setUsername(currentUsername);
          setValue('username', currentUsername || ''); // フォームに現在のユーザー名を設定

          if (!currentUsername) {
            // ユーザープロファイルは存在するが、usernameカラムがnullまたは空文字列の場合
            setNeedsUsernameSetup(true);
            setIsEditingUsername(true); 
          } else {
            // ユーザー名が正常に設定されている場合
            setNeedsUsernameSetup(false); 
            setIsEditingUsername(false); 
          }
        }

        const { count: followersCount, error: followersError } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', uid)
          .eq('status', 'accepted');

        if (!followersError) {
          setFollowerCount(followersCount || 0);
        }

        const { count: followingCountData, error: followingError } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', uid)
          .eq('status', 'accepted');

        if (!followingError) {
          setFollowingCount(followingCountData || 0);
        }

      } catch (error: unknown) {
        let errorMessage = 'ユーザー情報取得中に不明なエラーが発生しました';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        if (process.env.NODE_ENV === 'development') {
         console.error('エラー発生:', errorMessage); // 開発時のみログ出力
        }

        alert('ユーザー情報取得中に問題が発生しました。時間をおいて再度お試しください。');
      } finally {
        setLoading(false); // 最後にローディングを終了
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setValue]); // setValue は依存配列に必要

  // 各種リスト取得関数 (変更なし)
  const fetchFollowersList = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: follows, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId)
        .eq('status', 'accepted');

      if (error) {
        return;
      }

      const followerIds = follows?.map((f: { follower_id: string }) => f.follower_id) || [];

      if (followerIds.length === 0) {
        setFollowersList([]);
        return;
      }

      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, username')
        .in('id', followerIds);

      if (usersError) {
        return;
      }

      setFollowersList(users || []);
    } catch (error: unknown) {
      let errorMessage = 'フォロワーリスト取得中に不明なエラーが発生しました';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      if (process.env.NODE_ENV === 'development') {
         console.error('エラー発生:', errorMessage); // 開発時のみログ出力
        }

      alert('フォロワーリスト取得中に不明なエラーが発生しました。時間をおいて再度お試しください。');
    }
  }, [userId]);

  const fetchFollowingList = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: follows, error } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)
        .eq('status', 'accepted');

      if (error) {
        return;
      }

      const followingIds = follows?.map((f: { following_id: string }) => f.following_id) || [];
      
      if (followingIds.length === 0) {
        setFollowingList([]);
        return;
      }

      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, username')
        .in('id', followingIds);

      if (usersError) {
        return;
      }

      setFollowingList(users || []);
    } catch (error: unknown) {
      let errorMessage = 'フォローリスト取得中に不明なエラーが発生しました';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      if (process.env.NODE_ENV === 'development') {
         console.error('エラー発生:', errorMessage); // 開発時のみログ出力
        }

        alert('フォローリスト取得中に不明なエラーが発生しました。時間をおいて再度お試しください。');
    }
  }, [userId]);

  // 各種ハンドラ関数 (変更なし)
  const handleLanguageChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as 'ja' | 'en' | 'es' | 'fr');
  }, [setLanguage]);

  // ユーザー名更新のハンドラ（重複チェック機能を追加）
  const onSubmitUsername = useCallback(async (data: UsernameInputs) => {
  if (!userId) return;

  try {
    const newUsername = data.username.trim();

    // 現在のユーザー名と変更がない場合は更新しない
    if (newUsername === username) {
      setIsEditingUsername(false);
      setNeedsUsernameSetup(false);
      
      // ★修正: セッションを強制更新（refreshSessionを使用）★
      await supabase.auth.refreshSession();
      
      navigate('/self', { replace: true });
      return;
    }

    // ★追加: セッション確認を最初に行う★
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('セッションエラー:', sessionError);
      alert('セッションが無効です。再度ログインしてください。');
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
      return;
    }

    // ユーザー名の重複をチェック
    const { data: existingUser, error: checkError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('username', newUsername)
      .neq('id', userId)
      .maybeSingle();

    if (checkError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Supabaseクエリエラー:', checkError);
      }
      alert('データの取得に失敗しました。');
      return;
    }

    if (existingUser) {
      setError('username', { type: 'manual', message: translations.usernameTaken });
      return;
    }

    // ★修正: RLSポリシーを考慮した更新★
    const { error } = await supabase
      .from('user_profiles')
      .update({ username: newUsername })
      .eq('id', userId);

    if (error) {
      console.error('Username update error:', error);
      
      // ★追加: 詳細なエラーハンドリング★
      if (error.code === 'PGRST116') {
        alert('ユーザープロフィールが見つかりません。再度ログインしてください。');
        await supabase.auth.signOut();
        navigate('/login', { replace: true });
        return;
      }
      
      alert(translations.usernameUpdateFailed + ': ' + error.message);
    } else {
      setUsername(newUsername);
      setIsEditingUsername(false);
      setNeedsUsernameSetup(false);
      alert(translations.usernameUpdatedSuccessfully);

      // ★修正: セッションを強制更新★
      await supabase.auth.refreshSession();

      navigate('/self', { replace: true });
    }
  } catch (error: unknown) {
    let errorMessage = translations.usernameUpdateUnknownError;
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    if (process.env.NODE_ENV === 'development') {
      console.error('エラー発生:', errorMessage);
    }
    alert(translations.usernameUpdateFailed);
  }
}, [userId, username, setUsername, setIsEditingUsername, setError, translations, setNeedsUsernameSetup, navigate]);

  // アカウント削除のハンドラ (変更なし)
  const handleDeleteAccount = useCallback(async () => {
    if (!userId) {
      alert(translations.deleteAccountError);
      return;
    }

    const confirmDelete = window.confirm(translations.confirmDeleteAccount);
    if (!confirmDelete) {
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error(sessionError?.message || translations.notLoggedIn);
      }

      const EDGE_FUNCTION_URL = 'https://ojrlupicniwhjotkvjgb.supabase.co/functions/v1/delete-user';

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json,',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || translations.deleteFailed);
      }

      try {
        await supabase.auth.signOut();
      } catch (logoutError) {
        localStorage.removeItem('sb-ojrlupicniwhjotkvjgb-auth-token'); 
      }

      alert(translations.accountDeletedSuccessfully);
      window.location.href = '/'; 
      
    } catch (error: unknown) {
      let errorMessage = translations.deleteFailed;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      alert(errorMessage);
    }
  }, [userId, translations]);

  // お問い合わせフォームを開くハンドラ (変更なし)
  const handleContactClick = useCallback(() => {
    window.open(GOOGLE_FORM_URL, '_blank');
  }, [GOOGLE_FORM_URL]); 

  // ローディング状態の表示
  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p>読み込み中…</p>
        </div>
      </div>
    );
  }

  // JSX (レンダリング)
  return (
    <div style={pageStyle}>
      <h1 style={{ color: '#333', marginBottom: '30px' }}>{translations.settings}</h1>

      <div style={cardStyle}>
        <h2>{translations.username}</h2>

        {needsUsernameSetup || isEditingUsername ? (
          <>
            {needsUsernameSetup && (
                <p style={{ color: 'orange', fontWeight: 'bold' }}>
                    {translations.pleaseSetUsername || "最初にユーザー名を設定してください。"}
                </p>
            )}
            <form onSubmit={handleSubmit(onSubmitUsername)}>
              <input
                type="text"
                {...register('username')}
                placeholder={translations.enterUsername || "ユーザー名を入力"}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: errors.username ? '1px solid red' : '1px solid #ccc',
                  backgroundColor: '#fff',
                  color: '#000',
                }}
              />
              {errors.username && (
                <p style={{ color: 'red', fontSize: '0.85em', marginTop: '5px' }}>
                  {errors.username.message}
                </p>
              )}
              <div style={{ marginTop: '10px' }}>
                <button 
                  type="submit"
                  style={{ marginRight: '10px' }}
                  disabled={isSubmitting || !isValid}
                >
                  {translations.save}
                </button>
                {/* ユーザー名が未設定の状態ではキャンセルボタンは表示しない */}
                {!needsUsernameSetup && ( 
                    <button
                        type="button"
                        onClick={() => {
                          setIsEditingUsername(false);
                          reset({ username: username || '' });
                        }}
                    >
                        {translations.cancel}
                    </button>
                )}
              </div>
            </form>
          </>
        ) : (
          <>
            <p>
              ユーザー名: <strong>{username || '未設定'}</strong>
            </p>
            <button onClick={() => setIsEditingUsername(true)}>
              {translations.profileEdit}
            </button>
          </>
        )}

        {/* ユーザー名が設定されている場合のみ、フォロー/フォロワー関連の情報を表示 */}
        {!needsUsernameSetup && (
            <>
                <p
                  onClick={async () => {
                    const toggle = !showFollowing;
                    setShowFollowing(toggle);
                    if (toggle) await fetchFollowingList();
                  }}
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {translations.following}: {followingCount}人
                </p>
                {showFollowing && (
                  <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
                    {followingList.map((user) => (
                      <li key={user.id}>{user.username}</li>
                    ))}
                    {followingList.length === 0 && <li>フォロー中のユーザーはいません。</li>}
                  </ul>
                )}

                <p
                  onClick={async () => {
                    const toggle = !showFollowers;
                    setShowFollowers(toggle);
                    if (toggle) await fetchFollowersList();
                  }}
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {translations.followers}: {followerCount}人
                </p>
                {showFollowers && (
                  <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
                    {followersList.map((user) => (
                      <li key={user.id}>{user.username}</li>
                    ))}
                    {followersList.length === 0 && <li>フォロワーはいません。</li>}
                  </ul>
                )}
            </>
        )}
      </div>

      {/* ユーザー名が設定されている場合のみ、その他の設定項目を表示 */}
      {!needsUsernameSetup && ( 
        <>
            <div style={cardStyle}>
              <h2>{translations.languageSetting}</h2>
              <select value={language} onChange={handleLanguageChange} style={{ fontSize: '16px' }}>
                <option value="ja">日本語</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
              </select>
            </div>

            <div style={cardStyle}>
              <h2>{translations.contactUs}</h2>
              <p>{translations.contactUsDescription}</p>
              <button onClick={handleContactClick}>
                {translations.openContactForm}
              </button>
            </div>
            
            <div style={cardStyle}>
              <h2>{translations.deleteAccount}</h2>
              <p>{translations.deleteAccountWarning}</p>
              <button onClick={handleDeleteAccount} style={{ backgroundColor: '#e74c3c', color: '#fff' }}>
                {translations.deleteAccountButton}
              </button>
            </div>

            <Logout />
        </>
      )}
    </div>
  );
};

export default UserSettings;


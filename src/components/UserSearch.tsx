import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  TextField,
  Button,
  CircularProgress,
  Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAppContext } from "../context/AppContext";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserSearchSchema, UserSearchInputs } from '../schemas/searchSchemas';

// フォロー申請のインターフェースを定義
interface FollowRequest {
  id: string;
  follower_id: string;
  following_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  follower_username: string; // フォロワーのユーザー名
}

const UserSearch: React.FC = () => {
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const { translations } = useAppContext();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    // reset
  } = useForm<UserSearchInputs>({
    resolver: zodResolver(UserSearchSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      searchTerm: '',
    },
  });

  // ユーザーIDの取得と認証状態の監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // 🔍 ユーザー検索 (Edge Function 経由)
  const onSubmitSearch = async (data: UserSearchInputs) => {
  setLoading(true); // ローディング開始
  setSearchResults([]); // 検索結果をクリア

  try {
    // 1. Supabaseセッションの取得
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      // ★ 開発時のみコンソール出力
      if (process.env.NODE_ENV === 'development') {
        console.error("セッション取得エラーまたは未ログイン:", sessionError?.message || "セッションが存在しません。");
      }
      // ★ 本番環境でのユーザー向けメッセージ
      alert("ユーザー検索を行うにはログインが必要です。");
      // ★ エラー監視サービスに送信 (sessionErrorが存在する場合)
      // if (sessionError) {
      //   Sentry.captureException(sessionError, { tags: { feature: 'user_search', stage: 'get_session' } });
      // } else {
      //   Sentry.captureMessage("ユーザーセッションが存在しない状態で検索機能が呼び出されました。", { level: 'info', tags: { feature: 'user_search' } });
      // }
      return; // ログインが必要なため、処理を中断
    }

    const accessToken = session.access_token;

    // 2. アクセストークンの有効性チェック
    if (!accessToken || accessToken.length < 100) {
      // ★ 開発時のみコンソール出力
      if (process.env.NODE_ENV === 'development') {
        console.error("認証トークンが無効です。");
      }
      // ★ 本番環境でのユーザー向けメッセージ
      alert("認証情報に問題があります。再度ログインしてください。");
      // ★ エラー監視サービスに送信
      // Sentry.captureMessage("認証トークンが無効な状態で検索機能が呼び出されました。", { level: 'warning', tags: { feature: 'user_search', stage: 'token_check' } });
      return; // 認証トークンが無効なため、処理を中断
    }

    const EDGE_FUNCTION_URL = 'https://ojrlupicniwhjotkvjgb.supabase.co/functions/v1/add-serch';

    // 3. Edge Functionの呼び出し
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json, application/vnd.pgrst.object+json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ searchTerm: data.searchTerm }),
    });

    // 4. Edge Functionからのレスポンスチェック
    if (!response.ok) {
      // APIから返されたエラーメッセージを取得
      const errorData = await response.json(); // エラーレスポンスをJSONとしてパース
      
      // ★ 開発時のみコンソール出力
      if (process.env.NODE_ENV === 'development') {
        console.error('Edge Function呼び出しエラー:', response.status, errorData);
      }
      // ★ 本番環境でのユーザー向けメッセージ（APIからのエラーメッセージがあればそれを使う）
      alert(errorData.error || `ユーザー検索に失敗しました。サーバーエラー: ${response.status}が発生しました。`);
      // ★ エラー監視サービスに送信（サーバーからのエラーレスポンスをそのまま送る）
      // Sentry.captureMessage(
      //   errorData.error || `Edge Functionエラー: ${response.status}`,
      //   { level: 'error', tags: { feature: 'user_search', stage: 'edge_function_response' }, extra: { status: response.status, responseData: errorData } }
      // );
      setSearchResults([]); // エラー時は結果をクリア
      return; // エラーのため処理を中断
    }

    const responseData = await response.json();

    // 5. Edge Functionからの成功レスポンスの処理
    if (responseData.success) {
      setSearchResults(responseData.users ?? []); // 成功時は検索結果をセット
    } else {
      // Edge Functionがsuccess: false を返した場合（ビジネスロジック上のエラーなど）
      // ★ 開発時のみコンソール出力
      if (process.env.NODE_ENV === 'development') {
        console.error('ユーザー検索のビジネスロジックエラー:', responseData.error);
      }
      // ★ 本番環境でのユーザー向けメッセージ
      alert(responseData.error || "ユーザー検索中に不明な問題が発生しました。");
      // ★ エラー監視サービスに送信
      // Sentry.captureMessage(
      //   responseData.error || "ユーザー検索のビジネスロジックエラー",
      //   { level: 'warning', tags: { feature: 'user_search', stage: 'business_logic_error' }, extra: { responseData: responseData } }
      // );
      setSearchResults([]); // エラー時は結果をクリア
    }

  } catch (error: any) { // ★ ネットワークエラーや予期せぬJavaScriptエラーを捕捉
    setSearchResults([]); // エラー時は結果をクリア

    // ★ 開発時のみコンソール出力
    if (process.env.NODE_ENV === 'development') {
      console.error(`検索中に予期せぬエラーが発生しました:`, error);
    }
    // ★ 本番環境でのユーザー向けメッセージ
    alert(`検索中に通信エラーが発生しました。インターネット接続を確認し、再度お試しください。`);
    // ★ エラー監視サービスに送信
    // Sentry.captureException(error, { tags: { feature: 'user_search', context: 'unexpected_error' } });

  } finally {
    setLoading(false); // ★ 成功・失敗にかかわらずローディングを終了
  }
};

  /**
   * 📩 フォロー申請を取得
   * `user_profiles` テーブルと `follows` テーブルを結合して、フォロワーのユーザー名を取得します。
   */
  const fetchFollowRequests = useCallback(async () => {
  if (!userId) {
    // ユーザーがログインしていない場合の処理（例：何もせず関数を終了）
    // この関数はUIの初期表示など、ユーザー操作なしで呼ばれることも多いため、alertは出さないことが多い
    // 必要であれば、Sentryに情報ログを送信
    // Sentry.captureMessage("未ログイン状態でフォロー申請リストの取得が試行されました。", { level: 'info' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        id,
        follower_id,
        following_id,
        status,
        created_at,
        follower_profile:follower_id(username)
      `)
      .eq('following_id', userId)
      .eq('status', 'pending');

    if (error) {
      // ★ 開発時のみコンソール出力
      if (process.env.NODE_ENV === 'development') {
        console.error('フォロー申請取得エラー:', error.message);
      }
      // ★ 本番環境でのユーザー向けフィードバック（必要に応じて）
      // alert('フォロー申請の読み込み中に問題が発生しました。'); // 初期読み込みではalertは避ける傾向
      // UIに「読み込みエラー」などのメッセージを表示するsetStateなど
      setFollowRequests([]); // エラー時は空の配列をセット
      // ★ エラー監視サービスに送信
      // Sentry.captureException(error, { tags: { feature: 'follow_requests', action: 'fetch' } });
    } else {
      const requestsWithUsername: FollowRequest[] = data.map((req: any) => ({
        ...req,
        follower_username: req.follower_profile ? req.follower_profile.username : 'Unknown User'
      }));
      setFollowRequests(requestsWithUsername);
    }
  } catch (e) {
    // ★ 予期せぬエラー（ネットワークエラーなど）
    if (process.env.NODE_ENV === 'development') {
      console.error('予期せぬエラー（フォロー申請取得時）:', e);
    }
    // alert('フォロー申請の読み込み中に通信エラーが発生しました。'); // 初期読み込みではalertは避ける傾向
    setFollowRequests([]); // エラー時は空の配列をセット
    // ★ エラー監視サービスに送信
    // Sentry.captureException(e, { tags: { feature: 'follow_requests', context: 'unexpected_error' } });
  }
}, [userId]);
  /**
   * ✅ フォロー申請を承認
   */
  const approveFollowRequest = async (followId: string) => {
  if (!userId) { // ログイン状態のチェックは、ユーザー操作起因の関数では重要
    alert('フォロー申請を承認するにはログインが必要です。');
    return;
  }

  // ★ 楽観的UI更新の前の状態を保持しておく
  const originalFollowRequests = [...followRequests];

  // ★ 楽観的UI更新: UIから承認する申請を削除（またはステータス変更）し、即座に反映させる
  // ここでは、承認後にリストから消えることを想定
  setFollowRequests((prev) => prev.filter((req) => req.id !== followId));

  try {
    const { error } = await supabase
      .from('follows')
      .update({ status: 'accepted' })
      .eq('id', followId)
      .eq('following_id', userId); // セキュリティ: 承認者が本人であることを確認

    if (error) {
      // ★ UIを元の状態に戻す（ロールバック）
      setFollowRequests(originalFollowRequests);

      // ★ 開発時のみコンソール出力
      if (process.env.NODE_ENV === 'development') {
        console.error('フォロー承認エラー:', error); // error.message だけでなく error オブジェクト全体
      }
      // ★ 本番環境でのユーザー向けメッセージ
      alert('フォロー承認に失敗しました。時間をおいて再度お試しください。');
      // ★ エラー監視サービスに送信
      // Sentry.captureException(error, { tags: { feature: 'follow_requests', action: 'approve' } });
      return;
    }

    // ★ 成功時のユーザーフィードバック
    alert('フォローを承認しました！');
    // ★ 承認後、最新の申請リストを再取得（UIの整合性を完全に保証）
    fetchFollowRequests(); 

  } catch (e) {
    // ★ 予期せぬエラー（ネットワークエラーなど）
    // ★ UIを元の状態に戻す（ロールバック）
    setFollowRequests(originalFollowRequests);

    if (process.env.NODE_ENV === 'development') {
      console.error('予期せぬエラー（フォロー承認時）:', e);
    }
    alert('フォロー承認中に予期せぬ問題が発生しました。しばらくしてからもう一度お試しください。');
    // ★ エラー監視サービスに送信
    // Sentry.captureException(e, { tags: { feature: 'follow_requests', context: 'unexpected_error' } });
  }
};

  /**
   * ❌ フォロー申請を拒否
   */
  const rejectFollowRequest = async (followId: string) => {
  if (!userId) { // ログイン状態のチェックは、ユーザー操作起因の関数では重要
    alert('フォロー申請を拒否するにはログインが必要です。');
    return;
  }

  // ★ 楽観的UI更新の前の状態を保持しておく
  const originalFollowRequests = [...followRequests];

  // ★ 楽観的UI更新: UIから拒否する申請を削除し、即座に反映させる
  setFollowRequests((prev) => prev.filter((req) => req.id !== followId));

  try {
    const { error } = await supabase
      .from('follows')
      .update({ status: 'rejected' })
      .eq('id', followId)
      .eq('following_id', userId); // セキュリティ: 拒否者が本人であることを確認

    if (error) {
      // ★ UIを元の状態に戻す（ロールバック）
      setFollowRequests(originalFollowRequests);

      // ★ 開発時のみコンソール出力
      if (process.env.NODE_ENV === 'development') {
        console.error('フォロー拒否エラー:', error); // error.message だけでなく error オブジェクト全体
      }
      // ★ 本番環境でのユーザー向けメッセージ
      alert('フォロー拒否に失敗しました。時間をおいて再度お試しください。');
      // ★ エラー監視サービスに送信
      // Sentry.captureException(error, { tags: { feature: 'follow_requests', action: 'reject' } });
      return;
    }

    // ★ 成功時のユーザーフィードバック
    alert('フォローを拒否しました。');
    // ★ 拒否後、最新の申請リストを再取得（UIの整合性を完全に保証）
    fetchFollowRequests();

  } catch (e) {
    // ★ 予期せぬエラー（ネットワークエラーなど）
    // ★ UIを元の状態に戻す（ロールバック）
    setFollowRequests(originalFollowRequests);

    if (process.env.NODE_ENV === 'development') {
      console.error('予期せぬエラー（フォロー拒否時）:', e);
    }
    alert('フォロー拒否中に予期せぬ問題が発生しました。しばらくしてからもう一度お試しください。');
    // ★ エラー監視サービスに送信
    // Sentry.captureException(e, { tags: { feature: 'follow_requests', context: 'unexpected_error' } });
  }
};

  // マウント時＆userId 変更時に申請を取得
  useEffect(() => {
    fetchFollowRequests();
  }, [fetchFollowRequests]);

  return (
    <Box sx={{ p: 2 }}>
      {/* 🔍 検索フォーム */}
      <form onSubmit={handleSubmit(onSubmitSearch)}>
        <TextField
          label={translations.userserch}
          {...register('searchTerm')}
          error={!!errors.searchTerm}
          helperText={errors.searchTerm?.message}
          fullWidth
          variant="outlined"
          sx={{ mb: 2 }}
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={isSubmitting || !isValid || loading}
        >
          {loading ? <CircularProgress size={24} /> : translations.serch}
        </Button>
      </form>

      {/* 🔍 検索結果 */}
      {loading && <CircularProgress sx={{ mt: 2 }} />}
      {!loading && searchResults.length === 0 && (
        <Typography sx={{ mt: 2 }}>{translations.user}</Typography>
      )}
      {searchResults.map(u => (
        <Box
          key={u.id}
          sx={{ mt: 2, p: 2, border: '1px solid #ccc', borderRadius: 2 }}
        >
          <Typography variant="h6">{u.username}</Typography>
          <Button
            variant="outlined"
            onClick={() => navigate(`/profile/${u.id}`)}
            sx={{ mt: 1 }}
          >
            {translations.profile}
          </Button>
        </Box>
      ))}

      {/* 📩 フォロー申請（保留中） */}
      <Typography variant="h6" sx={{ mt: 4 }}>
        {translations.follow}
      </Typography>
      {followRequests.length === 0 && (
        <Typography>{translations.followrequet}</Typography>
      )}
      {followRequests.map(req => (
        <Box
          key={req.id}
          sx={{ mt: 2, p: 2, border: '1px solid #ccc', borderRadius: 2 }}
        >
          <Typography variant="h6">
            <span style={{ fontWeight: 'bold' }}>{req.follower_username}</span> さんからの申請
          </Typography>
          <Button
            variant="contained"
            onClick={() => approveFollowRequest(req.id)}
            sx={{ mt: 1, mr: 2 }}
          >
            {translations.approval}
          </Button>
          <Button
            variant="outlined"
            onClick={() => rejectFollowRequest(req.id)}
            sx={{ mt: 1 }}
          >
            {translations.rejection}
          </Button>
        </Box>
      ))}
    </Box>
  );
};

export default UserSearch;

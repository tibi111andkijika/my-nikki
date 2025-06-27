import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  TextField,
  Button,
  Box,
  Paper,
  IconButton,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  Modal,
  OutlinedInput
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAppContext } from "../context/AppContext";

// React Hook FormとZod関連のインポート
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PostSchema } from '../schemas/postSchemas'; // 新しく作成したスキーマファイルをインポート
import type { z } from 'zod';

// Zodスキーマから型を推論
type PostFormInputs = z.infer<typeof PostSchema>;

interface UserProfile {
  username: string;
}

interface PostLike {
  user_id: string;
}

interface FriendPost {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  completed: boolean;
  user_profiles: UserProfile;
  post_likes?: PostLike[];
  like_count: number;
  liked_by_user: boolean;
  start_time?: string;
  end_time?: string;
}

const Friends = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<FriendPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  // いいね処理中の投稿IDを管理するためのstateを追加
  const [likingPosts, setLikingPosts] = useState<Set<string>>(new Set());

  const { translations } = useAppContext();

  // React Hook Formの設定
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<PostFormInputs>({
    resolver: zodResolver(PostSchema),
    mode: 'onChange',
    defaultValues: {
      content: '',
      start_time: '',
      end_time: ''
    }
  });

  // ログインユーザー取得
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
  }, []);

  // 投稿一覧取得
  const fetchPosts = async () => {
    if (!userId) return;

    // --- ここから変更点 ---
    // 自分をフォローしているユーザー（フォロワー）のIDを取得
    const { data: followers, error: followersError } = await supabase
      .from('follows')
      .select('follower_id') // フォロワーのIDを取得
      .eq('following_id', userId) // 自分をフォローしている人
      .eq('status', 'accepted'); // 承認済みのフォロー関係のみ

    if (followersError) {
      return;
    }

    const followerIds = followers?.map(f => f.follower_id) ?? [];

    // 自分自身の投稿と、フォロワーの投稿を取得
    // もしフォロワーの投稿のみを見たい場合は、`[userId, ...followerIds]` から `userId` を削除してください。
    const userIdsToFetch = [userId, ...followerIds]; 
    if (userIdsToFetch.length === 0) { // 取得対象がいない場合
      setPosts([]);
      return;
    }

    const { data: postsData, error: postsError } = await supabase
      .from('friend_posts')
      .select(`
        *,
        user_profiles (
          username
        ),
        post_likes (
          user_id
        )
      `)
      .in('user_id', userIdsToFetch) // 自分とフォロワーの投稿を取得
      .order('created_at', { ascending: false });

    if (!postsError && postsData) {
      const processedPosts = postsData.map(post => {
        const likeCount = post.post_likes?.length ?? 0;
        const likedByUser = post.post_likes?.some((like: PostLike) => like.user_id === userId);
        
        return {
          ...post,
          like_count: likeCount,
          liked_by_user: likedByUser
        };
      });
      setPosts(processedPosts);
    }
  };
  // --- 変更点ここまで ---

  // 初回読み込み時に投稿取得
  useEffect(() => {
    if (userId) {
      fetchPosts();
    }
  }, [userId]);

  // 投稿送信ハンドラー
  const onSubmit = async (data: PostFormInputs) => {
    if (!userId) return;

    setLoading(true);

    const { data: newPost, error } = await supabase
      .from('friend_posts')
      .insert([
        {
          user_id: userId,
          content: data.content.trim(),
          start_time: data.start_time || null,
          end_time: data.end_time || null
        }
      ])
      .select(`
        *,
        user_profiles (
          username
        )
      `)
    .maybeSingle(); 

    if (!error && newPost) {
      reset();
      setShowModal(false);
      
      const processedPost = {
        ...newPost,
        like_count: 0,
        liked_by_user: false
      };
      
      setPosts(prev => [processedPost, ...prev]);
    }

    setLoading(false);
  };

  // 完了処理
  const handleComplete = async (postId: string) => {
    const { error } = await supabase
      .from('friend_posts')
      .update({ completed: true })
      .eq('id', postId);

    if (!error) {
      setPosts(prev =>
        prev.map(p =>
          p.id === postId ? { ...p, completed: true } : p
        )
      );
    } else {
      fetchPosts();
    }
  };

  // いいね処理（トグル）- 連打防止版
  const handleLike = async (postId: string, liked: boolean) => {
    if (!userId) return;
    
    // すでに処理中の場合は何もしない
    if (likingPosts.has(postId)) return;

    try {
      // 処理中のpostIdをSetに追加
      setLikingPosts(prev => new Set(prev).add(postId));

      if (liked) {
        // いいねを取り消す
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('user_id', userId)
          .eq('post_id', postId);

        if (!error) {
          setPosts(prev =>
            prev.map(p =>
              p.id === postId
                ? {
                    ...p,
                    liked_by_user: false,
                    like_count: Math.max(0, p.like_count - 1) // マイナスにならないよう保護
                  }
                : p
            )
          );
        } else {
          throw error;
        }
      } else {
        // いいねを追加
        const { error } = await supabase
          .from('post_likes')
          .insert([
            {
              user_id: userId,
              post_id: postId
            }
          ]);

        if (!error) {
          setPosts(prev =>
            prev.map(p =>
              p.id === postId
                ? {
                    ...p,
                    liked_by_user: true,
                    like_count: p.like_count + 1
                  }
                : p
            )
          );
        } else {
          throw error;
        }
      }
    } catch (error) {
      // エラーが発生した場合は最新データを取得して同期
      fetchPosts();
    } finally {
      // 処理完了後、処理中のpostIdをSetから削除
      setLikingPosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  // 削除ダイアログを開く
  const openDeleteDialog = (postId: string) => {
    setPostToDelete(postId);
    setDeleteDialogOpen(true);
  };

  // 投稿削除処理
  const handleDelete = async () => {
  // 1. 削除対象の投稿IDが存在するか確認
  if (!postToDelete) {
    setDeleteDialogOpen(false); // ダイアログを閉じる
    return;
  }

  // Optional: ユーザーがログインしているか確認
  // この操作はログインが必要なはずなので、念のためチェックを推奨します。
  // if (!userId) {
  //   alert('投稿を削除するにはログインが必要です。');
  //   setDeleteDialogOpen(false);
  //   setPostToDelete(null);
  //   return;
  // }

  // 2. UIロールバックのために現在の投稿リストの状態を保存
  const originalPosts = [...posts]; 

  // 3. 楽観的UI更新: まずUIから投稿を即座に削除（ユーザー体験向上）
  setPosts(prev => prev.filter(p => p.id !== postToDelete));

  try {
    // 4. 関連するいいね（post_likes）の削除
    // この削除操作のエラーは通常、投稿自体の削除を妨げないため、ここではthrowしません。
    const { error: likesDeleteError } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postToDelete);

    if (likesDeleteError) {
      // 開発環境でのみ警告を出力
      if (process.env.NODE_ENV === 'development') {
        console.warn('開発警告: 投稿のいいね削除中にエラーが発生しました:', likesDeleteError);
      }
      // 本番環境ではエラー監視サービスに送信 (例: Sentry)
      // Sentry.captureMessage(`いいね削除エラー: ${likesDeleteError.message}`, { level: 'warning', tags: { feature: 'post_delete', sub_feature: 'likes' } });
      // ここでreturnはしない（投稿自体の削除は続行）
    }

    // 5. 投稿自体の削除
    const { error: postDeleteError } = await supabase
      .from('friend_posts') // 正しいテーブル名であることを確認
      .delete()
      .eq('id', postToDelete);
      // セキュリティ強化: 投稿者が本人であることを確認する条件を追加することを強く推奨
      // .eq('user_id', userId); 

    // 6. 投稿削除時のエラーハンドリング
    if (postDeleteError) {
      // ★ UIを元の状態に戻す（ロールバック）
      setPosts(originalPosts); 

      // 開発環境でのみエラー詳細をコンソールに出力
      if (process.env.NODE_ENV === 'development') {
        console.error('開発エラー: 投稿の削除エラー:', postDeleteError);
      }
      // 本番環境でのユーザー向けメッセージ
      alert('投稿の削除中に問題が発生しました。時間をおいて再度お試しください。');
      // 本番環境ではエラー監視サービスに送信
      // Sentry.captureException(postDeleteError, { tags: { feature: 'post_delete', stage: 'post' } });
      
      return; // エラー処理後、ここで関数を終了
    }

    // ★ ここまで来ればAPI処理は成功。UIはすでに更新済み。

  } catch (error: any) { // ネットワークエラーや予期せぬJavaScriptエラーを捕捉
    // ★ UIを元の状態に戻す（ロールバック）
    setPosts(originalPosts);

    // 開発環境でのみ予期せぬエラーの詳細をコンソールに出力
    if (process.env.NODE_ENV === 'development') {
      console.error('開発エラー: 予期せぬエラー（投稿削除時）:', error);
    }
    // 本番環境でのユーザー向けメッセージ
    alert('投稿の削除中に予期せぬ問題が発生しました。インターネット接続を確認し、再度お試しください。');
    // 本番環境ではエラー監視サービスに送信
    // Sentry.captureException(error, { tags: { feature: 'post_delete', context: 'unexpected_error' } });

    // ★ 重要: エラー時に fetchPosts() を呼ぶのは避けるべきです。
    // 無限ループのリスクや、エラー解決にならない再フェッチを防ぐためです。
    // fetchPosts(); // この行は削除
    
  } finally {
    // 成功・失敗にかかわらず、クリーンアップ処理を実行
    setDeleteDialogOpen(false); // 削除ダイアログを閉じる
    setPostToDelete(null);     // 削除対象投稿IDをクリア
  }
};

  // 時間表示を整形する関数
  const formatTime = (timeString: string): string => { // 返り値の型を明示
  if (!timeString) return ''; // null, undefined, 空文字列の場合

  // HH:MM 形式のチェック
  if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeString)) {
    return timeString;
  }
  // HH:MM:SS 形式のチェック (HH:MM部分を返す)
  if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(timeString)) {
    return timeString.substring(0, 5);
  }

  try {
    const date = new Date(timeString);
    // Dateオブジェクトが無効な日付の場合 (例: "invalid date string")
    if (isNaN(date.getTime())) {
      // ★ ここでログを出す必要はない。不正な入力があったことを示すので、そのまま返すかデフォルト値を返す
      // if (process.env.NODE_ENV === 'development') {
      //   console.warn('formatTime: 無効な日付文字列を検出しました:', timeString);
      // }
      return timeString; // 無効な場合は元の文字列を返す
    }

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;

  } catch (e) {
    // new Date() コンストラクタは通常、不正な文字列でもエラーを throw しない（Invalid Dateを返す）
    // そのため、この catch ブロックが実行されることは稀だが、念のため
    // ★ ここでログを出す必要はない。
    // if (process.env.NODE_ENV === 'development') {
    //   console.error('formatTime: 予期せぬエラー:', e);
    // }
    // Sentry.captureException(e, { tags: { feature: 'time_formatting' } });
    return timeString; // エラー時も元の文字列を返すことでUIが壊れるのを防ぐ
  }
};

  return (
    <Box sx={{ p: 3 }}>
      {/* フローティング投稿ボタン */}
      <IconButton
        onClick={() => {
            setShowModal(!showModal);
            reset(); // モーダルを開くときにフォームをリセット
        }}
        sx={{
          position: 'fixed',
          top: 60,
          right: 30,
          backgroundColor: '#000',
          zIndex: 2000,
          color: 'white',
          '&:hover': { backgroundColor: 'primary.dark' }
        }}
      >
        <AddIcon fontSize="large" />
      </IconButton>

      {/* 投稿フォームモーダル */}
      <Modal open={showModal} onClose={() => {
          setShowModal(false);
          reset(); // モーダルを閉じるときにフォームをリセット
      }}>
        <Box sx={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '90%', sm: 500 },
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
          borderRadius: 2,
          maxHeight: '80vh',
          overflowY: 'auto'
        }}>
          <Typography variant="h6" sx={{ mb: 2 }}>{translations.Post || '投稿作成'}</Typography>
          
          {/* ここからReact Hook Formのフォーム */}
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* テキスト投稿エリア */}
            <TextField
              fullWidth
              multiline
              minRows={3}
              maxRows={6}
              placeholder="今日の予定を入力..."
              {...register('content')}
              error={!!errors.content}
              helperText={errors.content?.message}
              sx={{ mb: 2 }}
            />

            {/* 開始時間 */}
            <FormControl fullWidth margin="normal">
              <InputLabel shrink htmlFor="start-time" error={!!errors.start_time}>
                開始時間
              </InputLabel>
              <OutlinedInput
                id="start-time"
                type="time"
                {...register('start_time')}
                notched
                label="開始時間"
                error={!!errors.start_time}
              />
              {errors.start_time && (
                <Typography variant="caption" color="error">
                  {errors.start_time.message}
                </Typography>
              )}
            </FormControl>

            {/* 終了時間 */}
            <FormControl fullWidth margin="normal">
              <InputLabel shrink htmlFor="end-time" error={!!errors.end_time}>
                終了時間
              </InputLabel>
              <OutlinedInput
                id="end-time"
                type="time"
                {...register('end_time')}
                notched
                label="終了時間"
                error={!!errors.end_time}
              />
              {errors.end_time && (
                <Typography variant="caption" color="error">
                  {errors.end_time.message}
                </Typography>
              )}
            </FormControl>
            
            {/* 送信ボタン */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button 
                variant="contained"
                type="submit"
                disabled={isSubmitting || !isValid}
              >
                {isSubmitting ? '送信中…' : '投稿'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setShowModal(false);
                  reset();
                }}
              >
                キャンセル
              </Button>
            </Box>
          </form>
          {/* ここまでReact Hook Formのフォーム */}
        </Box>
      </Modal>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>投稿を削除します</DialogTitle>
        <DialogContent>
          <DialogContentText>
            この投稿を削除しますか？この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>キャンセル</Button>
          <Button onClick={handleDelete} color="error" autoFocus>
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 投稿一覧 */}
      <Box>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '8px' }}>{translations.friends || 'フレンド'}</h2>
        <Box sx={{ borderBottom: '1px solid #ccc', mb: 2 }} />

        <Box sx={{ maxWidth: 600, mx: 'auto', px: 2 }}>
          {posts.map((post, idx) => {
            const isOwnPost = post.user_id === userId;
            return (
              <Paper key={post.id || idx} sx={{ p: 2, mb: 2, position: 'relative' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle1" color="primary" noWrap sx={{ fontSize: 15 }}>
                    {post.user_profiles?.username || '匿名'}
                  </Typography>
                  <Typography variant="caption" color="gray">
                    {new Date(post.created_at).toLocaleString()}
                  </Typography>
                </Box>

                {(post.start_time || post.end_time) && (
                  <Typography variant="caption" color="gray" sx={{ display: 'block', mb: 1 }}>
                    {(() => {
                      const startTimeFormatted = post.start_time ? formatTime(post.start_time) : '';
                      const endTimeFormatted = post.end_time ? formatTime(post.end_time) : '';
                      
                      if (startTimeFormatted && endTimeFormatted) {
                        return `${startTimeFormatted} ～ ${endTimeFormatted}`;
                      } else if (startTimeFormatted) {
                        return `開始: ${startTimeFormatted}`;
                      } else if (endTimeFormatted) {
                        return `終了: ${endTimeFormatted}`;
                      }
                      return '';
                    })()}
                  </Typography>
                )}

                {post.content && (
                  <Typography
                    sx={{
                      mt: 1,
                      mb: 4,
                      textDecoration: post.completed ? 'line-through' : 'none'
                    }}
                  >
                    {post.content}
                  </Typography>
                )}

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    right: 8
                  }}
                >
                  <Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      startIcon={<ThumbUpIcon />}
                      onClick={() => handleLike(post.id, post.liked_by_user)}
                      color={post.liked_by_user ? 'primary' : 'inherit'}
                    >
                      {post.like_count}
                    </Button>

                    {isOwnPost && !post.completed && (
                      <Button
                        size="small"
                        onClick={() => handleComplete(post.id)}
                      >
                        完了
                      </Button>
                    )}

                    {isOwnPost && (
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() => openDeleteDialog(post.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              </Paper>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default Friends;
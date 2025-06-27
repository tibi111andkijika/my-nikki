import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  IconButton,
  Box,
  TextField,
  Button,
  Modal,
  FormControl,
  InputLabel,
  OutlinedInput,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAppContext } from '../context/AppContext';

import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PostSchema } from '../schemas/postSchemas';
import type { z } from 'zod';

type PostFormInputs = z.infer<typeof PostSchema>;

interface Post {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  username: string | null;
  likes_count: number;
  liked_by_user: boolean;
  completed: boolean;
  start_time: string;
  end_time: string;
}

export default function World() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { language, translations } = useAppContext();

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    reset,
  } = useForm<PostFormInputs>({
    resolver: zodResolver(PostSchema),
    mode: 'onBlur',
    defaultValues: {
      content: '',
      start_time: '',
      end_time: '',
    },
  });

  // ユーザーID取得
  useEffect(() => {
    async function getUserId() {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id || null);
    }
    getUserId();
  }, []);

  // 投稿取得
  const fetchPosts = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData.user?.id || '';

    const { data, error } = await supabase
      .from('world_posts')
      .select(`
        id, content, user_id, created_at, start_time, end_time,
        user_profiles(username)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return;
    }

    if (data) {
      const postsWithLikes = await Promise.all(
        data.map(async (post: any) => {
          const { data: likesData, error: likesError } = await supabase
            .from('world_post_likes')
            .select('*', { count: 'exact' })
            .eq('post_id', post.id);

          const likesCount = likesError ? 0 : likesData?.length || 0;

          let likedByUser = false;
          if (currentUserId) {
            const { data: userLikeData } = await supabase
              .from('world_post_likes')
              .select('*')
              .eq('post_id', post.id)
              .eq('user_id', currentUserId)
              .maybeSingle();
            likedByUser = !!userLikeData;
          }

          const isCompleted = post.content.includes('[完了]');
          const cleanContent = isCompleted
            ? post.content.replace('[完了]', '').trim()
            : post.content;

          return {
            id: post.id,
            content: cleanContent,
            user_id: post.user_id,
            created_at: post.created_at,
            username: post.user_profiles?.username ?? '名無し',
            likes_count: likesCount,
            liked_by_user: likedByUser,
            completed: isCompleted,
            start_time: post.start_time || '',
            end_time: post.end_time || '',
          };
        })
      );
      setPosts(postsWithLikes);
    }
  };

  useEffect(() => {
    if (userId !== null) {
      fetchPosts();
    }
  }, [userId]);

  // 投稿ハンドラ
  const onSubmit: SubmitHandler<PostFormInputs> = async (data) => {
    if (!userId) return;

    const { data: newPostData, error } = await supabase
      .from('world_posts')
      .insert({
        content: data.content,
        user_id: userId,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
      })
      .select('*, user_profiles(username)')
      .maybeSingle();

    if (!error && newPostData) {
      const username = newPostData.user_profiles?.username || '名無し';
      setPosts((prev) => [
        {
          id: newPostData.id,
          content: newPostData.content,
          user_id: newPostData.user_id,
          created_at: newPostData.created_at,
          username,
          likes_count: 0,
          liked_by_user: false,
          completed: false,
          start_time: newPostData.start_time || '',
          end_time: newPostData.end_time || '',
        },
        ...prev,
      ]);
      reset();
      setShowModal(false);
    }
  };

  // いいねハンドラ
 const handleLike = async (postId: string, isCurrentlyLiked: boolean) => {
  if (!userId) {
    // ユーザーがログインしていない場合の処理
    alert('いいねするにはログインしてください。'); // ★ ユーザーにアラートが表示される
    return;
  }

  // ★ 楽観的UI更新の前の状態を保持しておく
  const originalPosts = [...posts];

  // ★ UIの即時更新（いいね/解除の見た目がすぐに変わる）
  setPosts((prev) =>
    prev.map((p) =>
      p.id === postId
        ? {
            ...p,
            liked_by_user: !isCurrentlyLiked,
            likes_count: isCurrentlyLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1,
          }
        : p
    )
  );

  try {
    let error = null;

    if (isCurrentlyLiked) {
      const { error: deleteError } = await supabase
        .from('world_post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);
      error = deleteError;
    } else {
      const { error: insertError } = await supabase
        .from('world_post_likes')
        .insert({ post_id: postId, user_id: userId });
      error = insertError;
    }

    // ★ SupabaseからのAPIエラーがあった場合
    if (error) {
      // ★ UIを元の状態に戻す（ロールバック）
      setPosts(originalPosts); // 見た目が元に戻る
      alert('いいね処理中に問題が発生しました。時間をおいて再度お試しください。');
      return;
    }

    // ★ API呼び出しが成功した場合、特にエラー処理は行われない
    // fetchPosts(); // もし成功時にも必要なら、ここに入れる
    
  } catch (e) {
    setPosts(originalPosts); // 見た目が元に戻る
    alert('いいね処理中に予期せぬ問題が発生しました。しばらくしてからもう一度お試しください。');
  }
};

  // 完了ハンドラ
  const handleComplete = async (postId: string) => {
  if (!userId) {
    // ユーザーがログインしていない場合の処理
    alert('完了マークを付けるにはログインしてください。'); // ユーザーへのフィードバック
    return;
  }

  // ★ 楽観的UI更新の前の状態を保持しておく（エラー時のロールバック用）
  const originalPosts = [...posts];

  // ★ 楽観的UI更新: まずはUIを「完了」状態に更新
  setPosts((prev) =>
    prev.map((p) => (p.id === postId ? { ...p, completed: true } : p))
  );

  try {
    // 1. 投稿内容の取得
    const { data: postData, error: fetchError } = await supabase
      .from('world_posts')
      .select('content')
      .eq('id', postId)
      .single();

    if (fetchError) {
      // ★ UIを元の状態に戻す
      setPosts(originalPosts);

      // ★ 開発時のみコンソール出力
      if (process.env.NODE_ENV === 'development') {
        console.error('投稿内容の取得エラー:', fetchError);
      }
      // ★ 本番環境でのユーザー向けメッセージ
      alert('投稿内容の読み込み中に問題が発生しました。時間をおいて再度お試しください。');
      // ★ エラー監視サービスに送信 (Sentry.captureException(fetchError, { tags: { feature: 'complete', stage: 'fetch' } });)
      return;
    }

    // 2. コンテンツの更新（[完了] マークを追加）
    // 既に [完了] が付いている場合は重複しないように処理
    const updatedContent = '[完了] ' + postData.content.replace('[完了]', '').trim();

    const { error: updateError } = await supabase
      .from('world_posts')
      .update({ content: updatedContent })
      .eq('id', postId);

    if (updateError) {
      // ★ UIを元の状態に戻す
      setPosts(originalPosts);

      // ★ 開発時のみコンソール出力
      if (process.env.NODE_ENV === 'development') {
        console.error('投稿完了マークの更新エラー:', updateError);
      }
      // ★ 本番環境でのユーザー向けメッセージ
      alert('完了マークの更新中に問題が発生しました。時間をおいて再度お試しください。');
      // ★ エラー監視サービスに送信 (Sentry.captureException(updateError, { tags: { feature: 'complete', stage: 'update' } });)
      return;
    }

    // ★ ここまで来ればAPI処理は成功。UIはすでに更新済み。
    // 必要であれば、再度投稿リストをフェッチしてUIの整合性を完全に保証する
    // 例: fetchPosts();
    
  } catch (e) {
    // ★ ネットワークエラーや予期せぬJavaScriptエラーがあった場合
    // ★ UIを元の状態に戻す
    setPosts(originalPosts);

    // ★ 開発時のみコンソール出力
    if (process.env.NODE_ENV === 'development') {
      console.error('予期せぬエラー（完了処理）:', e);
    }
    // ★ 本番環境でのユーザー向けメッセージ
    alert('完了マーク処理中に予期せぬ問題が発生しました。しばらくしてからもう一度お試しください。');
    // ★ エラー監視サービスに送信 (Sentry.captureException(e, { tags: { feature: 'complete', context: 'unexpected_error' } });)
  }
};

  // 削除ハンドラ
  const handleDelete = async (postId: string) => {
  if (!userId) {
    // ユーザーがログインしていない場合の処理
    alert('投稿を削除するにはログインしてください。'); // ユーザーへのフィードバック
    return;
  }

  // ★ 楽観的UI更新の前の状態を保持しておく（エラー時のロールバック用）
  const originalPosts = [...posts]; // posts state のコピー

  // ★ 楽観的UI更新: まずはUIから投稿を削除（すぐに消えるように見せる）
  setPosts((prev) => prev.filter((p) => p.id !== postId));
  setShowDeleteConfirm(null); // 削除確認モーダルなどを閉じる

  try {
    // 1. 関連するいいね（likes）の削除
    // これは成功・失敗に関わらず、投稿削除を続行することが多いですが、エラーがあればログに残す
    const { error: likesDeleteError } = await supabase
      .from('world_post_likes')
      .delete()
      .eq('post_id', postId);

    if (likesDeleteError) {
      // Likesの削除エラーは致命的ではないことが多いが、開発時には知りたい
      if (process.env.NODE_ENV === 'development') {
        console.warn('投稿のいいね削除中にエラーが発生しました:', likesDeleteError);
      }
      // Sentry.captureMessage(`いいね削除エラー: ${likesDeleteError.message}`, { level: 'warning', tags: { feature: 'delete', sub_feature: 'likes' } });
      // ここで return しないのは、いいねの削除が失敗しても投稿自体の削除は試みたいから。
      // ただし、RLSが正しく設定されていれば、ユーザーがいいねした以外のデータは触れないはずなので、
      // 実際にはあまりエラーにならないかもしれません。
    }

    // 2. 投稿自体の削除
    const { error: postDeleteError } = await supabase
      .from('world_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId); // 投稿者が本人であることを確認するセキュリティ対策（RLSも重要）

    if (postDeleteError) {
      // ★ UIを元の状態に戻す（ロールバック）
      setPosts(originalPosts); // 削除したように見えた投稿が元に戻る

      // ★ 開発時のみコンソール出力
      if (process.env.NODE_ENV === 'development') {
        console.error('投稿の削除エラー:', postDeleteError);
      }
      // ★ 本番環境でのユーザー向けメッセージ
      alert('投稿の削除中に問題が発生しました。時間をおいて再度お試しください。');
      // ★ エラー監視サービスに送信
      // Sentry.captureException(postDeleteError, { tags: { feature: 'delete', stage: 'post' } });
      return; // エラーなのでここで処理を終了
    }

    // ★ ここまで来ればAPI処理は成功。UIはすでに更新済み。
    // setPosts 以外に何か状態を更新する必要があればここで行う。
    // 例えば、削除後にページ全体を再フェッチするなど
    // fetchPosts();
    
  } catch (e) {
    // ★ ネットワークエラーや予期せぬJavaScriptエラーがあった場合
    // ★ UIを元の状態に戻す（ロールバック）
    setPosts(originalPosts);

    // ★ 開発時のみコンソール出力
    if (process.env.NODE_ENV === 'development') {
      console.error('予期せぬエラー（削除処理）:', e);
    }
    // ★ 本番環境でのユーザー向けメッセージ
    alert('投稿の削除中に予期せぬ問題が発生しました。しばらくしてからもう一度お試しください。');
    // ★ エラー監視サービスに送信
    // Sentry.captureException(e, { tags: { feature: 'delete', context: 'unexpected_error' } });
  }
};

  // 時刻フォーマット
  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    if (/^\d{2}:\d{2}$/.test(timeString)) return timeString;
    if (/^\d{2}:\d{2}:\d{2}$/.test(timeString)) return timeString.substring(0, 5);
    try {
      const date = new Date(timeString);
      if (isNaN(date.getTime())) return timeString;
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    } catch {
      return timeString;
    }
  };

  return (
    <div style={{ padding: 15, position: 'relative' }}>
      {/* 投稿フォームモーダル */}
      <Modal open={showModal} onClose={() => { setShowModal(false); reset(); }}>
        <Box
          sx={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)', width: 400,
            bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2,
          }}
        >
          <h3>{translations.Post}</h3>
          <form onSubmit={handleSubmit(onSubmit)}>
            <TextField
              fullWidth multiline minRows={3} placeholder="内容を入力…"
              error={!!errors.content} helperText={errors.content?.message}
              {...register('content')} sx={{ mb: 2 }}
            />

            <FormControl fullWidth margin="normal">
              <InputLabel shrink htmlFor="start-time">開始時間</InputLabel>
              <OutlinedInput
                id="start-time" type="time"
                error={!!errors.start_time}
                {...register('start_time')}
                label="開始時間"
              />
              {errors.start_time && (
                <p style={{ color: 'red' }}>{errors.start_time.message}</p>
              )}
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel shrink htmlFor="end-time">終了時間</InputLabel>
              <OutlinedInput
                id="end-time" type="time"
                error={!!errors.end_time}
                {...register('end_time')}
                label="終了時間"
              />
              {errors.end_time && (
                <p style={{ color: 'red' }}>{errors.end_time.message}</p>
              )}
            </FormControl>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button type="submit" variant="contained" disabled={!isValid || isSubmitting}>
                {isSubmitting ? '送信中…' : translations.Post}
              </Button>
              <Button
                variant="outlined"
                onClick={() => { setShowModal(false); reset(); }}
              >
                キャンセル
              </Button>
            </Box>
          </form>
        </Box>
      </Modal>

      {/* 削除確認モーダル */}
      <Modal open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)}>
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', width: 400,
          bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2,
        }}>
          <h3>投稿を削除</h3>
          <p>この投稿を削除してもよろしいですか？この操作は取り消せません。</p>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
            <Button variant="outlined" onClick={() => setShowDeleteConfirm(null)}>
              キャンセル
            </Button>
            <Button
              variant="contained" color="error"
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
            >
              削除する
            </Button>
          </Box>
        </Box>
      </Modal>

      {/* 投稿ボタン */}
      <IconButton
        onClick={() => setShowModal(!showModal)}
        sx={{
          position: 'fixed', top: 55, right: 30,
          bgcolor: '#000', color: '#fff', zIndex: 5000,
          '&:hover': { bgcolor: 'primary.dark' },
        }}
      >
        <AddIcon fontSize="large" />
      </IconButton>

      <h2 style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 8 }}>
        {translations.world}
      </h2>
      <hr style={{ margin: '8px 0 12px', border: 'none', borderTop: '2px solid #ccc' }} />

      <Box sx={{ maxWidth: 600, mx: 'auto', px: 2 }}>
        {posts.map((post) => (
          <Box
            key={post.id}
            sx={{
              bgcolor: '#fff', p: 2, mb: 1.5, borderRadius: 2,
              boxShadow: '0 4px 8px rgba(0,0,0,0.1)', position: 'relative',
              minHeight: 100,
            }}
          >
            {/* ヘッダー */}
            <Box sx={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', fontSize: 13, mb: 0.75,
            }}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ color: '#007bff', fontWeight: 'bold', fontSize: 18 }}>
                  {post.username}
                </Box>
                {(post.start_time || post.end_time) && (
                  <Box sx={{ color: '#888', mt: 0.5 }}>
                    {post.start_time && formatTime(post.start_time)}
                    {post.start_time && post.end_time && ' ～ '}
                    {post.end_time && formatTime(post.end_time)}
                  </Box>
                )}
              </Box>
              <Box sx={{ color: '#888' }}>
                {new Date(post.created_at).toLocaleString()}
              </Box>
            </Box>

            {/* 内容 */}
            <Box component="p" sx={{
              fontSize: 15, mb: 4, textDecoration: post.completed ? 'line-through' : 'none',
            }}>
              {post.content}
            </Box>

            {/* アクション */}
            <Box sx={{
              position: 'absolute', bottom: 10, right: 14,
              display: 'flex', gap: 1.25,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton
                  onClick={() => handleLike(post.id, post.liked_by_user)}
                  size="small"
                >
                  {post.liked_by_user ? (
                    <ThumbUpIcon fontSize="small" color="primary" />
                  ) : (
                    <ThumbUpOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
                <Box component="span" sx={{ fontSize: 14 }}>
                  {post.likes_count}
                </Box>
              </Box>

              {userId === post.user_id && (
                <IconButton
                  size="small"
                  onClick={() => setShowDeleteConfirm(post.id)}
                >
                  <DeleteIcon fontSize="small" color="error" />
                </IconButton>
              )}

              {userId === post.user_id && !post.completed && (
                <Button
                  size="small" variant="outlined"
                  onClick={() => handleComplete(post.id)}
                  sx={{ ml: 1, fontSize: 12 }}
                >
                  完了
                </Button>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </div>
  );
}

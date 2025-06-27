import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Typography, Box, styled } from '@mui/material';
import { supabase } from '../supabaseClient';
import { useAppContext } from '../context/AppContext';


// スタイリングされた Box コンポーネント
// const GradientBox = styled(Box)(({ theme }) => ({
//   background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
//   borderRadius: 8,
//   color: 'white',
//   padding: theme.spacing(2),
//   boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
//   display: 'flex',
//   gap: theme.spacing(2),
//   justifyContent: 'center',
//   marginBottom: theme.spacing(2),
// }));

// スタイリングされた Button コンポーネント
const GradientButton = styled(Button)(({ theme }) => ({
  background: `linear-gradient(45deg, ${theme.palette.primary.light} 30%, ${theme.palette.primary.main} 90%)`,
  borderRadius: 8,
  border: 0,
  color: 'white',
  height: 48,
  padding: '0 30px',
  boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
  transition: 'transform 0.1s ease-in-out',
  '&:hover': {
    transform: 'scale(1.05)',
    background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.primary.dark} 90%)`,
  },
  '&:disabled': {
    background: theme.palette.grey['400'],
    color: theme.palette.grey['700'],
    boxShadow: 'none',
    transform: 'none',
  },
}));

const Profile = () => {
  const { id: targetUserId } = useParams<{ id: string }>();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [followStatusLoading, setFollowStatusLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // 処理中フラグ
  const [targetUserProfile, setTargetUserProfile] = useState<{ username: string } | null>(null);
  const { translations } = useAppContext();

  // デバウンス用のタイマー参照
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 自分のプロフィールかどうかを判定
  const isMyProfile = myUserId === targetUserId;

  useEffect(() => {
    const fetchUserAndFollowStatus = async () => {
      try {
        // ユーザー情報を取得
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          return;
        }

        const userId = data.user?.id || null;
        setMyUserId(userId);

        // 対象ユーザーのプロフィールを取得
        if (targetUserId) {
          const { data: profileData, error: profileError } = await supabase
            .from('user_profiles')
            .select('username')
            .eq('id', targetUserId)
            .single();

          if (profileError) {
          } else {
            setTargetUserProfile(profileData);
          }

          // フォロー状態をチェック（自分のプロフィールでない場合のみ）
          if (userId && targetUserId && userId !== targetUserId) {
            setFollowStatusLoading(true);
            
            const { data: followData, error: followError } = await supabase
              .from('follows')
              .select('id, status')
              .eq('follower_id', userId)
              .eq('following_id', targetUserId);

            if (followError) {
            } else if (followData && followData.length > 0) {
              const follow = followData[0];
              setIsFollowing(follow.status === 'accepted');
              setIsPending(follow.status === 'pending');
            } else {
              setIsFollowing(false);
              setIsPending(false);
            }
            
            setFollowStatusLoading(false);
          }
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndFollowStatus();
  }, [targetUserId]);

  // デバウンス機能付きのフォローリクエスト
  const handleFollowRequest = useCallback(async () => {
    if (!myUserId || !targetUserId || isProcessing) return;

    // デバウンス処理
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsProcessing(true);
      // UI を即座に更新（楽観的更新）
      setIsPending(true);

      try {
        const { error } = await supabase.from('follows').insert([
          {
            follower_id: myUserId,
            following_id: targetUserId,
            status: 'pending',
          },
        ]);

        if (error) {
          // エラーの場合は元の状態に戻す
          setIsPending(false);
        }
      } catch (error) {
        setIsPending(false);
      } finally {
        setIsProcessing(false);
      }
    }, 300); // 300ms のデバウンス
  }, [myUserId, targetUserId, isProcessing]);

  // デバウンス機能付きのアンフォロー
  const handleUnfollow = useCallback(async () => {
    if (!myUserId || !targetUserId || isProcessing) return;

    // デバウンス処理
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsProcessing(true);
      // UI を即座に更新（楽観的更新）
      const previousIsFollowing = isFollowing;
      const previousIsPending = isPending;
      setIsFollowing(false);
      setIsPending(false);

      try {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', myUserId)
          .eq('following_id', targetUserId);

        if (error) {
          // エラーの場合は元の状態に戻す
          setIsFollowing(previousIsFollowing);
          setIsPending(previousIsPending);
        }
      } catch (error) {
        setIsFollowing(previousIsFollowing);
        setIsPending(previousIsPending);
      } finally {
        setIsProcessing(false);
      }
    }, 300); // 300ms のデバウンス
  }, [myUserId, targetUserId, isProcessing, isFollowing, isPending]);

  // コンポーネントのアンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  if (loading) return <Typography textAlign="center">Loading...</Typography>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ textShadow: '2px 2px 4px rgba(0, 0, 0, 0.2)' }}>
        {targetUserProfile?.username}
      </Typography>

      {/* 自分のプロフィールでない場合のみフォローボタンを表示 */}
      {!isMyProfile && (
        <>
          {followStatusLoading ? (
            // フォロー状態の読み込み中は無効化されたボタンを表示
            <GradientButton variant="contained" disabled>
              Loading...
            </GradientButton>
          ) : isFollowing ? (
            <GradientButton 
              variant="contained" 
              color="secondary" 
              onClick={handleUnfollow}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : translations.unfollow}
            </GradientButton>
          ) : isPending ? (
            <GradientButton variant="contained" disabled>
              {translations.wait}
            </GradientButton>
          ) : (
            <GradientButton 
              variant="contained" 
              color="primary" 
              onClick={handleFollowRequest}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : translations.followrequest}
            </GradientButton>
          )}
        </>
      )}
    </Box>
  );
};

export default Profile;
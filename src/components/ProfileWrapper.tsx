// ProfileWrapper.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Profile from './Profile';

const ProfileWrapper = () => {
  const { userId } = useParams<{ userId: string }>(); // ルートで userId を受け取る想定
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setError('ユーザーIDが見つかりません');
      setLoading(false);
      return;
    }
    setLoading(false);
  }, [userId]);

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h2>{userId} のプロフィール</h2>
      <Profile /> {/* props を渡さずに呼び出す */}
    </div>
  );
};

export default ProfileWrapper;

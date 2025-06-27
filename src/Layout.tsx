import React from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  // Button,
  IconButton,
  Typography,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person'; // Self
import GroupIcon from '@mui/icons-material/Group'; // Friends
import PublicIcon from '@mui/icons-material/Public'; // World
import SearchIcon from '@mui/icons-material/Search'; // Search

const tabs = [
  { path: '/self', label: 'Self', icon: <PersonIcon /> },
  { path: '/friends', label: 'Friends', icon: <GroupIcon /> },
  { path: '/world', label: 'World', icon: <PublicIcon /> },
  { path: '/search', label: 'Search', icon: <SearchIcon /> }, // 検索タブも追加
];

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // 現在のパスに基づいて選択されているタブのインデックスを決定
  // `startsWith` を使用することで、`/profile/userId` のようなパスでも `/profile` タブとして認識されることを防ぎます。
  // タブのパスと完全に一致するか、そのパスから始まる場合にのみタブが選択されるようにします。
  const currentTabValue = tabs.findIndex(tab => location.pathname === tab.path || location.pathname.startsWith(`${tab.path}/`));
  const selectedTab = currentTabValue !== -1 ? currentTabValue : false;

  // 設定ボタンを押したときの処理
  const handleSettingsClick = () => {
    if (location.pathname === '/profile') {
      // すでに設定ページなら履歴を戻る（もとのページに戻る）
      navigate(-1);
    } else {
      // それ以外のページなら設定ページへ移動
      navigate('/profile');
    }
  };

  // 画面を再読み込みする関数
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f2f2f7' }}>
      {/* ヘッダー */}
      <AppBar position="static" sx={{ backgroundColor: '#42a5f5' }}> {/* Material UIのprimary色 */}
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            My App
          </Typography>
          <Box>
            <IconButton
              color="inherit"
              aria-label="settings"
              onClick={handleSettingsClick}
              sx={{ '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' } }}
            >
              <SettingsIcon fontSize="large" />
            </IconButton>
            <IconButton
              color="inherit"
              aria-label="reload"
              onClick={handleReload}
              sx={{ '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' } }}
            >
              <RefreshIcon fontSize="large" />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* メインコンテンツ */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}> {/* コンテンツ領域にパディングを追加 */}
        <Outlet />
      </Box>

      {/* 下部ナビゲーション (タブバー) */}
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }} elevation={3}>
        <BottomNavigation
          showLabels
          value={selectedTab}
          onChange={(event, newValue) => {
            // ここでのonChangeは通常BottomNavigationActionのonClickと組み合わせて使用しますが、
            // navigateはBottomNavigationActionのonClickで行われるため、このonChangeは不要な場合が多いです。
            // navigate(tabs[newValue].path); 
          }}
        >
          {tabs.map((tab, index) => (
            <BottomNavigationAction
              key={tab.path}
              label={tab.label}
              icon={tab.icon}
              onClick={() => navigate(tab.path)}
              sx={{
                // 選択中の色をlocation.pathnameで直接判断することで、より確実にタブの状態を反映
                color: location.pathname.startsWith(tab.path) ? 'primary.main' : 'text.secondary', 
                '&.Mui-selected': {
                  color: 'primary.main', // BottomNavigationActionが内部で管理するselected時の色
                },
                minWidth: 'unset', // 小さい画面での幅調整
                px: 1, // パディング調整
              }}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
};

export default Layout;
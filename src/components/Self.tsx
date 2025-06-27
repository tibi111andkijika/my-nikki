import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ScheduleEntrySchema } from '../schemas/scheduleSchemas';
import { z } from 'zod';
import {
  IconButton,
  TextField,
  Button,
  MenuItem,
  Typography,
  Paper,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Box,
  CircularProgress,
  Alert,
  Modal,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import dayjs from 'dayjs';
import 'dayjs/locale/ja';
import { supabase } from '../supabaseClient';
import { useAppContext } from '../context/AppContext'; // useAppContext をインポート
import { Session } from '@supabase/supabase-js';

type EntryForm = z.infer<typeof ScheduleEntrySchema>;

interface ScheduleEntry extends EntryForm {
  id: string;
  user_id: string;
}

const SelfScreen: React.FC = () => {
  const { translations, selectedDate, setSelectedDate } = useAppContext(); // ここで selectedDate と setSelectedDate を取得

  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  // const [selectedDate, setSelectedDate] = useState(dayjs()); // この行は削除またはコメントアウト
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<ScheduleEntry | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 背景要素への参照を追加
  const mainContentRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    watch,
  } = useForm<EntryForm>({
    resolver: zodResolver(ScheduleEntrySchema),
    mode: 'onBlur',
    defaultValues: {
      start_time: '',
      end_time: '',
      text: '',
      date: selectedDate.format('YYYY-MM-DD'),
    },
  });

  const formValues = watch();

  const EDGE_FUNCTION_URL = 'https://ojrlupicniwhjotkvjgb.supabase.co/functions/v1/add-schedule';

  // モーダル表示状態の管理
  const isModalOpen = showForm || deleteConfirmOpen;

  // モーダル表示時の背景要素の制御
  useEffect(() => {
    if (isModalOpen) {
      if (mainContentRef.current) {
        mainContentRef.current.setAttribute('inert', '');
        mainContentRef.current.setAttribute('aria-hidden', 'true');
      }
    } else {
      if (mainContentRef.current) {
        mainContentRef.current.removeAttribute('inert');
        mainContentRef.current.removeAttribute('aria-hidden');
      }
    }

    return () => {
      if (mainContentRef.current) {
        mainContentRef.current.removeAttribute('inert');
        mainContentRef.current.removeAttribute('aria-hidden');
      }
    };
  }, [isModalOpen]);

  // 現在時刻を更新するためのuseEffect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 時刻選択肢の生成
  const timeOptions = Array.from({ length: 24 * 12 }, (_, i) => {
    const h = Math.floor(i / 12);
    const m = (i % 12) * 5;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  });

  // 時間ブロックの表示用ラベル
  const hourBlocks = Array.from({ length: 24 }, (_, i) =>
    `${i.toString().padStart(2, '0')}:00`
  );

  const PIXELS_PER_MINUTE = 1.2;
  const BLOCK_HEIGHT = 60 * PIXELS_PER_MINUTE;

  // 予定ブロックのサイズとフォントサイズを計算
  const calculateSizes = (duration: number) => {
    const maxThreshold = 30;
    const minFontSize = 10;
    const maxFontSize = 20;
    const minIconSize = 16;
    const maxIconSize = 20;

    if (duration >= maxThreshold) {
      return { fontSize: maxFontSize, iconSize: maxIconSize, iconButtonSize: maxIconSize + 4 };
    }
    const ratio = Math.max(0, (duration - 5) / (maxThreshold - 5));
    const fontSize = Math.round(minFontSize + (maxFontSize - minFontSize) * ratio);
    const iconSize = Math.round(minIconSize + (maxIconSize - minIconSize) * ratio);
    return { fontSize: fontSize, iconSize: iconSize, iconButtonSize: iconSize + 4 };
  };

  // 現在時刻線の位置を計算する関数
  const getCurrentTimeLine = () => {
    const now = currentTime;
    const selectedDateStr = selectedDate.format('YYYY-MM-DD');
    const todayStr = now.format('YYYY-MM-DD');

    if (selectedDateStr !== todayStr) {
      return null;
    }

    const currentHour = now.hour();
    const currentMinute = now.minute();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    return {
      hour: currentHour,
      topPx: (currentTotalMinutes - currentHour * 60) * PIXELS_PER_MINUTE,
      time: now.format('HH:mm')
    };
  };

  // スケジュールデータの取得関数
  const fetchSchedule = useCallback(async () => {
    if (!session?.user?.id) {
      setSchedule([]);
      return;
    }

    setLoadingSchedule(true);
    setErrorMessage(null);
    const dateStr = selectedDate.format('YYYY-MM-DD'); // selectedDate を Context から取得したものを使用

    try {
      const accessToken = session.access_token;
      if (!accessToken) {
        throw new Error("認証トークンがありません。");
      }

      const response = await fetch(`${EDGE_FUNCTION_URL}?date=${dateStr}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessageDetail = `HTTPエラー: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessageDetail = errorJson.error || errorJson.message || errorMessageDetail;
        } catch (parseError) {
          errorMessageDetail = errorText || errorMessageDetail;
        }
        throw new Error(`スケジュールの取得に失敗しました: ${errorMessageDetail}`);
      }

      const responseData = await response.json();
      if (responseData.success) {
        setSchedule(responseData.data ?? []);
      } else {
        throw new Error(responseData.error || "スケジュール取得に失敗しました。");
      }
    } catch (error: any) {
      setErrorMessage(`${translations.fetchScheduleError || 'スケジュール取得中にエラーが発生しました'}: ${error.message}`);
      setSchedule([]);
    } finally {
      setLoadingSchedule(false);
    }
  }, [selectedDate, session, EDGE_FUNCTION_URL, translations]); // selectedDate を依存配列に追加

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // 追加フォームの送信ハンドラ
  const onSubmit: SubmitHandler<EntryForm> = async (data) => {
    if (!session?.user?.id) {
      alert(translations.notLoggedInAdd || "ユーザーがログインしていません。予定を投稿できません。");
      return;
    }

    setIsSubmittingForm(true);
    setErrorMessage(null);
    try {
      const accessToken = session.access_token;
      if (!accessToken) {
        throw new Error("認証トークンがありません。");
      }

      const newItem = {
        start_time: data.start_time,
        end_time: data.end_time,
        text: data.text,
        date: data.date,
      };

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(newItem),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessageDetail = `HTTPエラー: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessageDetail = errorJson.error || errorJson.message || errorMessageDetail;
        } catch (parseError) {
          errorMessageDetail = errorText || errorMessageDetail;
        }
        throw new Error(`${translations.addScheduleFailed || '予定の追加に失敗しました'}: ${errorMessageDetail}`);
      }

      const responseData = await response.json();
      if (responseData.success) {
        setSchedule((prev) => {
          const newSchedule = [...prev, responseData.data as ScheduleEntry];
          return newSchedule.sort((a, b) => {
            const timeA = dayjs(`2000-01-01T${a.start_time}`);
            const timeB = dayjs(`2000-01-01T${b.start_time}`);
            return timeA.diff(timeB);
          });
        });
        reset({ date: selectedDate.format('YYYY-MM-DD') }); // selectedDate を Context から取得したものを使用
        setShowForm(false);
        alert(translations.addScheduleSuccess || "予定が追加されました。");
      } else {
        throw new Error(responseData.error || "予定の追加に失敗しました。");
      }
    } catch (error: any) {
      setErrorMessage(`${translations.addScheduleError || '予定の追加中にエラーが発生しました'}: ${error.message}`);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // 削除ダイアログ表示の準備
  const handleDeleteClick = (entry: ScheduleEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEntryToDelete(entry);
    setDeleteConfirmOpen(true);
  };

  // 削除確認ハンドラ
  const handleDeleteConfirm = async () => {
    if (!entryToDelete?.id || !session?.user?.id) {
      alert(translations.deleteInvalid || "削除対象またはユーザー情報が不正です。");
      handleDeleteCancel();
      return;
    }

    setDeleteConfirmOpen(false);
    setIsSubmittingForm(true);
    setErrorMessage(null);

    try {
      const accessToken = session.access_token;
      if (!accessToken) {
        throw new Error("認証トークンがありません。");
      }

      const idToDelete = entryToDelete.id;

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: idToDelete }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessageDetail = `HTTPエラー: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessageDetail = errorJson.error || errorJson.message || errorMessageDetail;
        } catch (parseError) {
          errorMessageDetail = errorText || errorMessageDetail;
        }
        throw new Error(`${translations.deleteScheduleFailed || '予定の削除に失敗しました'}: ${errorMessageDetail}`);
      }

      const responseData = await response.json();
      if (responseData.success) {
        setSchedule((prev) => prev.filter((it) => it.id !== entryToDelete.id));
        alert(translations.deleteScheduleSuccess || "予定が削除されました。");
      } else {
        throw new Error(responseData.error || "予定の削除に失敗しました。");
      }
    } catch (error: any) {
      setErrorMessage(`${translations.deleteScheduleError || '予定の削除中にエラーが発生しました'}: ${error.message}`);
    } finally {
      setEntryToDelete(null);
      setIsSubmittingForm(false);
    }
  };

  // 削除キャンセルのハンドラ
  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setEntryToDelete(null);
  };

  // 特定の時間の予定を取得するヘルパー関数
  const getEntriesForHour = (hour: string) => {
    const h = parseInt(hour.split(':')[0]);
    return schedule.filter((e) => {
      const entryHour = parseInt(e.start_time.split(':')[0]);
      return entryHour === h && e.date === selectedDate.format('YYYY-MM-DD'); // selectedDate を Context から取得したものを使用
    }).sort((a, b) => {
      const timeA = dayjs(`2000-01-01T${a.start_time}`);
      const timeB = dayjs(`2000-01-01T${b.start_time}`);
      return timeA.diff(timeB);
    });
  };

  // 日付表示のフォーマット
  const formatDateText = (d: dayjs.Dayjs) =>
    d.locale('ja').format('YYYY年M月D日（ddd）');

  const currentTimeLine = getCurrentTimeLine();

  return (
    <div style={{ padding: 24, position: 'relative' }}>
      {/* メインコンテンツ - 背景要素として参照を設定 */}
      <div ref={mainContentRef}>
        {/* 日付ナビゲーション */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <IconButton onClick={() => setSelectedDate(selectedDate.subtract(1, 'day'))}> {/* Context の setSelectedDate を使用 */}
            <ArrowBackIosNewIcon />
          </IconButton>
          <Typography variant="h6" sx={{ mx: 2 }}>
            {formatDateText(selectedDate)} {/* Context の selectedDate を使用 */}
          </Typography>
          <IconButton onClick={() => setSelectedDate(selectedDate.add(1, 'day'))}> {/* Context の setSelectedDate を使用 */}
            <ArrowForwardIosIcon />
          </IconButton>
        </Box>

        {/* ＋ボタン（予定追加フォーム表示用） */}
        <IconButton
          onClick={() => {
            setShowForm(true);
            reset({ date: selectedDate.format('YYYY-MM-DD') }); // selectedDate を Context から取得したものを使用
          }}
          sx={{
            position: 'fixed', top: 60, right: 30,
            bgcolor: '#000', color: '#fff', zIndex: 1000,
            '&:hover': { bgcolor: 'primary.dark' },
          }}
          disabled={isSubmittingForm}
        >
          <AddIcon fontSize="large" />
        </IconButton>

        {/* エラーメッセージ表示 */}
        {errorMessage && (
          <Alert severity="error" onClose={() => setErrorMessage(null)} sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {/* スケジュール表示部分 */}
        {loadingSchedule ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            {hourBlocks.map((hour) => {
              const entries = getEntriesForHour(hour);
              const hourNumber = parseInt(hour.split(':')[0]);

              return (
                <Box
                  key={hour}
                  sx={{
                    position: 'relative',
                    height: BLOCK_HEIGHT,
                    borderBottom: '1px solid #ccc',
                  }}
                >
                  {/* 時間ラベル */}
                  <Typography
                    variant="body2"
                    sx={{ position: 'absolute', left: 0, top: 0, width: 50, color: '#555' }}
                  >
                    {hour}
                  </Typography>

                  {/* 30分の区切り線 */}
                  <Divider
                    sx={{
                      position: 'absolute',
                      top: BLOCK_HEIGHT / 2,
                      left: 50, right: 0,
                      borderColor: '#b0b0b0',
                      zIndex: 6,
                    }}
                  />

                  {/* 現在時刻線 */}
                  {currentTimeLine && currentTimeLine.hour === hourNumber && (
                    <>
                      <Box
                        sx={{
                          position: 'absolute',
                          top: currentTimeLine.topPx,
                          left: 50,
                          right: 0,
                          height: '2px',
                          backgroundColor: '#ff4444',
                          zIndex: 10,
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            left: -6,
                            top: -4,
                            width: 0,
                            height: 0,
                            borderTop: '5px solid transparent',
                            borderBottom: '5px solid transparent',
                            borderRight: '6px solid #ff4444',
                          }
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          position: 'absolute',
                          top: currentTimeLine.topPx - 12,
                          right: 5,
                          backgroundColor: '#ff4444',
                          color: 'white',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          zIndex: 11,
                        }}
                      >
                        {currentTimeLine.time}
                      </Typography>
                    </>
                  )}

                  {/* 各予定エントリの表示 */}
                  {entries.map((entry, i) => {
                    const [sH, sM] = entry.start_time.split(':').map(Number);
                    const [eH, eM] = entry.end_time.split(':').map(Number);
                    const startMinutes = sH * 60 + sM;
                    const endMinutes = eH * 60 + eM;
                    const durationMinutes = endMinutes - startMinutes;
                    const blockStartMinutes = parseInt(hour) * 60;

                    const topPx = (startMinutes - blockStartMinutes) * PIXELS_PER_MINUTE;
                    const heightPx = Math.max(durationMinutes * PIXELS_PER_MINUTE, 20);

                    const sizes = calculateSizes(durationMinutes);

                    return (
                      <Paper
                        key={entry.id || i}
                        elevation={3}
                        sx={{
                          position: 'absolute',
                          top: topPx,
                          left: 60,
                          right: 10,
                          height: heightPx,
                          backgroundColor: '#bbdefb',
                          p: '2px 6px 2px 2px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          overflow: 'hidden',
                          borderRadius: '4px',
                          boxSizing: 'border-box',
                          zIndex: 5,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            flexGrow: 1,
                            fontSize: `${sizes.fontSize}px`,
                            lineHeight: 1.2,
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            color: '#333',
                          }}
                        >
                          {entry.text}（{entry.start_time}〜{entry.end_time}）
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={(e) => handleDeleteClick(entry, e)}
                          sx={{
                            height: sizes.iconButtonSize,
                            width: sizes.iconButtonSize,
                            minWidth: sizes.iconButtonSize,
                            minHeight: sizes.iconButtonSize,
                            p: 0,
                            ml: 1,
                            color: '#424242',
                            '&:hover': {
                              backgroundColor: 'rgba(0, 0, 0, 0.04)',
                              color: 'error.main',
                            }
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: sizes.iconSize }} />
                        </IconButton>
                      </Paper>
                    );
                  })}
                </Box>
              );
            })}
          </Box>
        )}
      </div>

      {/* 追加フォームモーダル */}
      <Modal
        open={showForm}
        onClose={() => {
          if (!isSubmittingForm) {
            setShowForm(false);
            reset({ date: selectedDate.format('YYYY-MM-DD') });
          }
        }}
        aria-labelledby="add-schedule-modal"
        aria-describedby="add-schedule-form"
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: 400,
            bgcolor: 'background.paper',
            border: '2px solid #000',
            boxShadow: 24,
            p: 3,
          }}
        >
          <Typography id="add-schedule-modal" variant="h6" gutterBottom>
            {translations.addevent}
          </Typography>
          <form onSubmit={handleSubmit(onSubmit)}>
            <TextField
              select
              label={translations.start}
              error={!!errors.start_time}
              helperText={errors.start_time?.message}
              fullWidth
              margin="normal"
              {...register('start_time')}
              value={formValues.start_time || ''}
            >
              {timeOptions.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label={translations.finish}
              error={!!errors.end_time}
              helperText={errors.end_time?.message}
              fullWidth
              margin="normal"
              {...register('end_time')}
              value={formValues.end_time || ''}
            >
              {timeOptions.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>

            <TextField
              label={translations.content}
              error={!!errors.text}
              helperText={errors.text?.message}
              fullWidth
              margin="normal"
              {...register('text')}
            />

            <input type="hidden" {...register('date')} value={selectedDate.format('YYYY-MM-DD')} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={!isValid || isSubmittingForm}
              >
                {isSubmittingForm ? <CircularProgress size={24} /> : translations.add}
              </Button>
              <Button
                variant="outlined"
                onClick={() => { setShowForm(false); reset({ date: selectedDate.format('YYYY-MM-DD') }); }}
                disabled={isSubmittingForm}
              >
                {translations.cancel}
              </Button>
            </Box>
          </form>
        </Box>
      </Modal>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteConfirmOpen} onClose={handleDeleteCancel}>
        <DialogTitle>予定を削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {entryToDelete
              ? `「${entryToDelete.text}」（${entryToDelete.start_time}〜${entryToDelete.end_time}）を削除しますか？`
              : 'この予定を削除してもよろしいですか？'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={isSubmittingForm}>{translations.cancel}</Button>
          <Button color="error" onClick={handleDeleteConfirm} autoFocus disabled={isSubmittingForm}>
            {isSubmittingForm ? <CircularProgress size={24} /> : translations.delete}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default SelfScreen;
// src/schemas/scheduleSchemas.ts
import { z } from 'zod';

export const ScheduleEntrySchema = z
  .object({
    start_time: z
      .string()
      // .nonempty() の message を削除。これにより、Zodが自動的に 'too_small' または 'required' エラーコードを生成し、
      // App.tsx の customErrorMap で翻訳されます。
      .nonempty()
      // .regex() の message を削除。これにより、Zodが自動的に 'invalid_string' エラーコードを生成し、
      // App.tsx の customErrorMap で翻訳されます。
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/),

    end_time: z
      .string()
      .nonempty()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/),

    text: z
      .string()
      // .min() の message を削除。App.tsx の customErrorMap で 'string_min' (または 'too_small') を処理します。
      .min(1)
      // .max() の message を削除。App.tsx の customErrorMap で 'string_max' (または 'too_big') を処理します。
      .max(200),

    // ★重要: Edge Functionと一致するようにdateフィールドを追加★
    date: z
      .string()
      // .regex() の message を削除。App.tsx の customErrorMap で 'invalid_string' を処理します。
      .regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .superRefine((data, ctx) => {
    const { start_time, end_time } = data;
    // 開始時刻と終了時刻が両方存在し、かつ終了時刻が開始時刻以下の場合
    if (start_time && end_time && end_time <= start_time) {
      ctx.addIssue({
        path: ['end_time'], // エラーをend_timeフィールドに関連付ける
        code: z.ZodIssueCode.custom,
        // この 'i18nKey' を App.tsx の customErrorMap が読み取り、
        // AppContext.tsx の翻訳データから対応するメッセージを探します。
        params: { i18nKey: 'end_time_after_start_time' },
      });
    }
  });

// 削除リクエスト用のスキーマ（IDのみ）
export const DeleteScheduleSchema = z.object({
  id: z
    .number()
    // `required_error` は ZodIssueCode.invalid_type に対応することが多いですが、
    // ここで直接メッセージを設定する代わりに `.min(1)` を使用します。
    // これにより、IDが未定義または0以下の場合に ZodIssueCode.too_small が発生し、
    // App.tsx の customErrorMap で 'required' または 'too_small' として翻訳されます。
    .min(1), // IDが1以上であることを要求 (0以下の無効なIDを弾くため)
});
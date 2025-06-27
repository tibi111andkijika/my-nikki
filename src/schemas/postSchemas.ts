// src/schemas/yourSchemaFile.ts
import { z } from 'zod';

// スケジュールエントリーのバリデーションルールを定義
// export const ScheduleEntrySchema = z
//   .object({
//     // 必須：開始時刻（HH:mm形式）
//     start_time: z
//       .string()
//       // .nonempty() の message は削除（App.tsxのcustomErrorMapで'required'を処理）
//       .nonempty()
//       // .regex() の message は削除（App.tsxのcustomErrorMapで'invalid_string'を処理）
//       .regex(/^([01]\d|2[0-3]):[0-5]\d$/),

//     // 必須：終了時刻（HH:mm形式）
//     end_time: z
//       .string()
//       // .nonempty() の message は削除
//       .nonempty()
//       // .regex() の message は削除
//       .regex(/^([01]\d|2[0-3]):[0-5]\d$/),
//   })
//   .superRefine((data, ctx) => {
//     // superRefineを使って、開始時刻と終了時刻の論理的な関係をバリデーション
//     const { start_time, end_time } = data;

//     // 時刻が両方入力されている場合のみ比較を行う
//     // これにより、片方だけ入力されている場合や両方空の場合にこのバリデーションが起動しない
//     if (start_time && end_time) {
//       if (end_time <= start_time) {
//         ctx.addIssue({
//           path: ["end_time"], // エラーをend_timeフィールドに関連付ける
//           code: z.ZodIssueCode.custom,
//           // App.tsx の customErrorMap でこのキーを使って翻訳メッセージを検索する
//           params: {
//             i18nKey: 'end_time_after_start_time'
//           }
//         });
//       }
//     }
//   });

// 投稿フォーム全体のスキーマ
export const PostSchema = z.object({
  content: z
    .string()
    // .min() の message は削除（App.tsxのcustomErrorMapで'string_min'を処理）
    .min(1)
    // .max() の message は削除（App.tsxのcustomErrorMapで'string_max'を処理）
    .max(200),
  
  // start_time は optional で空文字列も許可
  start_time: z
    .string()
    // .regex() の message は削除
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional() // フィールド自体がオプション
    .or(z.literal('')), // 空文字列を有効な値として許可する

  // end_time も optional で空文字列も許可
  end_time: z
    .string()
    // .regex() の message は削除
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .optional() // フィールド自体がオプション
    .or(z.literal('')), // 空文字列を有効な値として許可する
}).superRefine((data, ctx) => {
    // content、start_time、end_time のいずれかが入力されていることをチェックするカスタムバリデーション
    if (!data.content && !data.start_time && !data.end_time) {
      ctx.addIssue({
        path: ["content"], // エラーをcontentフィールドに関連付ける
        code: z.ZodIssueCode.custom,
        params: {
          i18nKey: 'content_or_time_required' // App.tsxのcustomErrorMapでこのキーを使って翻訳メッセージを検索
        }
      });
    }

    // 時刻が両方入力されている場合のみ、終了時刻が開始時刻より後であるかをチェック
    // ScheduleEntrySchema と同じロジックとi18nKeyを使用
    if (data.start_time && data.end_time) {
      if (data.end_time <= data.start_time) {
        ctx.addIssue({
          path: ["end_time"],
          code: z.ZodIssueCode.custom,
          params: {
            i18nKey: 'end_time_after_start_time'
          }
        });
      }
    }
});
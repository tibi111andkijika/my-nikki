// src/schemas/UsernameSchema.ts
import { z } from 'zod';

export const UsernameSchema = z.object({
  username: z
    .string()
    // .min() の message を削除。AppContext で 'string_min' を処理。
    .min(3) // 最低3文字
    // .max() の message を削除。AppContext で 'string_max' を処理。
    .max(20) // 最大20文字
    // .regex() の message を削除。AppContext で 'invalid_string' を処理。
    .regex(/^[a-zA-Z0-9_]+$/) // 英数字とアンダースコアのみを許可
    .refine(value => value.trim().length > 0, {
      // refine の message を削除し、customErrorMap で処理されるように i18nKey を設定。
      path: ["username"], // どのフィールドにエラーを関連付けるか
      params: { i18nKey: 'invalid_username_format' } // AppContext で翻訳されるキー
    }),
});

// スキーマから型を推論
export type UsernameInputs = z.infer<typeof UsernameSchema>;
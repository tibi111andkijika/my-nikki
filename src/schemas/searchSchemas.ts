// src/schemas/UserSearchSchema.ts
import { z } from 'zod';

export const UserSearchSchema = z.object({
  searchTerm: z
    .string()
    // .min() の message を削除。App.tsx の customErrorMap で 'string_min' を処理します。
    .min(1) // 最低1文字必要
    // .max() の message を削除。App.tsx の customErrorMap で 'string_max' を処理します。
    .max(50) // 最大50文字
    .refine(value => value.trim().length > 0, {
      // refine の message を削除し、customErrorMap で処理されるようにします。
      // code: z.ZodIssueCode.custom を使用し、i18nKey を設定します。
      message: "有効な検索ワードを入力してください", // このメッセージは削除されます
      path: ["searchTerm"], // どのフィールドにエラーを関連付けるか
      // ここにカスタムエラーの識別子としてi18nKeyを追加
      params: { i18nKey: 'invalid_search_term' } // AppContextで翻訳されるキー
    }),
});

// スキーマから型を推論
export type UserSearchInputs = z.infer<typeof UserSearchSchema>;
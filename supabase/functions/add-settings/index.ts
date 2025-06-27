import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// --- Zod Schema の定義 ---
// この関数専用のスキーマ定義を直接記述します。
export const UsernameSchema = z.object({
  username: z
    .string()
    .min(3, { message: "ユーザー名は3文字以上で入力してください" }) // 最低3文字
    .max(20, { message: "ユーザー名は20文字以内で入力してください" }) // 最大20文字
    .regex(/^[a-zA-Z0-9_]+$/, { // 英数字とアンダースコアのみを許可
      message: "ユーザー名は英数字とアンダースコアのみ使用できます",
    })
    .refine((value: string) => value.trim().length > 0, { // 空白のみの入力も弾く
      message: "有効なユーザー名を入力してください",
    }),
});

// --- CORS 設定 ---
// 開発環境と本番環境でオリジンを切り替えます。
const ALLOWED_ORIGIN = Deno.env.get('NODE_ENV') === 'development'
  ? "http://localhost:3000" // ★開発中はここをあなたの開発サーバーのポートに設定★
  : "https://your-app-domain.com"; // ★本番環境にデプロイする際はここをあなたのドメインに設定★


// --- Edge Function のメイン処理 ---
serve(async (req: Request): Promise<Response> => {
  // CORS対応 (プリフライトリクエストの処理)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS', // ユーザー名更新は POST
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        
      },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase URL and/or Anon Key are not set as environment variables. Please check your .env.local file or Supabase project settings.");
    }

    // Supabase クライアントの初期化
    // Edge Functions で認証済みユーザーのコンテキストでデータベース操作を行う場合、
    // リクエストヘッダーから Authorization ヘッダーを抽出し、それを使って Supabase クライアントを初期化します。
    const authHeader = req.headers.get("Authorization")
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { authorization: authHeader! }, // クライアントから渡されたJWTを使用
      },
      auth: {
        persistSession: false, // Edge Functions はステートレス
      },
    });

    // 認証済みユーザーのセッションを取得 (RLSで必要)
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "認証が必要です。" }),
        { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
      );
    }

    // リクエストボディをJSONとしてパース
    const json = await req.json();

    // Zod スキーマでバリデーション
    const data = UsernameSchema.parse(json);

    // ユーザー名を profiles テーブルに挿入または更新
    // upsert を使うと、ユーザーが存在しない場合は挿入、存在する場合は更新されます。
    // RLS ポリシーにより、認証されたユーザー自身のプロフィールのみ操作可能になります。
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: user.id,        // 現在認証されているユーザーのID
          username: data.username, // Zodでバリデートされたユーザー名
        },
        { onConflict: 'id' } // id が衝突した場合に更新
      )
      .select('username') // 挿入/更新されたユーザー名を返す
      .maybeSingle();// 単一のオブジェクトとして返す

    if (error) {
      // ユーザー名が既に存在するなどのUNIQUE制約違反エラーを特別にハンドリング
      if (error.code === '23505' && error.details?.includes('username')) {
          throw new Error(`このユーザー名 "${data.username}" は既に使用されています。別のユーザー名を選択してください。`);
      }
      throw new Error(`ユーザー名の保存に失敗しました: ${error.message}`);
    }

    // 成功レスポンス
    return new Response(
      JSON.stringify({
        success: true,
        message: "ユーザー名を正常に設定しました",
        username: profile?.username // 設定されたユーザー名を返す
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN
        },
      }
    );
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      // ここで (e as z.ZodError) と型アサーションを追加

      return new Response(
        JSON.stringify({
          success: false,
          // ここで (e as z.ZodError) と型アサーションを追加し、
          // map のコールバック関数で issue の型を明示的に指定
          error: `入力データのバリデーションエラー: ${(e as z.ZodError).issues.map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN
          },
        }
      );
    }

    const error = e as Error; // ここで型アサーションを行う
    return new Response(
      JSON.stringify({
        success: false,
        error: `サーバーエラー: ${error.message || "不明なエラー"}`
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN
        },
      }
    );
  }
});

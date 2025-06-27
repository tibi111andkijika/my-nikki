// supabase/functions/user-search/index.ts

// Deno 標準ライブラリのバージョンを最新に更新 (serve の代わりに Deno.serve を使うためインポート不要に)
// import { serve } from "https://deno.land/std@0.177.0/http/server.ts"; // <-- この行は削除
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0"; // Supabase JS を最新バージョンに更新
// import { decode } from "https://deno.land/x/djwt@v2.9/mod.ts"; // <-- この行も削除

// --- Zod Schema の定義 ---
export const UserSearchSchema = z.object({
  searchTerm: z.string()
    .min(1, { message: "検索ワードを入力してください" })
    .max(50, { message: "検索ワードは50文字以内で入力してください" })
    .refine((value: string) => value.trim().length > 0, {
      message: "有効な検索ワードを入力してください",
    }),
});

// --- CORS 設定 ---
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('NODE_ENV') === 'development'
    ? "http://localhost:3000"
    : "https://your-app-domain.com", // あなたの本番環境のドメインを設定
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type',
};

// --- Edge Function のメイン処理 ---
// serve() の代わりに Deno.serve() を使用
Deno.serve(async (req: Request): Promise<Response> => { // <-- ここを Deno.serve に変更
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const supabaseServiceRoleKey = Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseJwtSecret = Deno.env.get('MY_SUPABASE_JWT_SECRET') ?? ''; // あなたが設定した名前

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !supabaseJwtSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "サーバー設定エラー: 必要な環境変数が設定されていません。"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // 認証サービス用のSupabaseクライアント（anonキーを使用）
    const authSupabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // データベース操作用のSupabaseクライアント（service_roleキーを使用）
    const dbSupabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "認証ヘッダーが見つかりません。ログインしてください。",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');

    // JWTのデコード（djwt ライブラリを使用していたデバッグブロックを削除）
    // Supabase AuthサービスによるJWT検証がこれを代替します
    // 以前の try...catch (decode を使っていた部分) は完全に削除されます

    // Supabase AuthサービスによるJWT検証
    const { data: { user }, error: authError } = await authSupabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `認証に失敗しました。再度ログインしてください。${authError?.message ? ` (${authError.message})` : ''}`,
          debug: {
            authError: authError?.message,
            jwtProvided: !!jwt,
            timestamp: new Date().toISOString()
          }
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const json = await req.json();
    const data = UserSearchSchema.parse(json);
    const searchTerm = data.searchTerm.trim();

    const { data: users, error } = await dbSupabase
      .from('user_profiles') // ここはあなたの実際のテーブル名
      .select('id, username')
      .ilike('username', `%${searchTerm}%`)
      .limit(10);

    if (error) {
      throw new Error(`ユーザーの検索に失敗しました: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${users.length}件のユーザーが見つかりました。`,
        users: users
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `入力データのバリデーションエラー: ${(e as z.ZodError).issues.map((issue: z.ZodIssue) => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    const error = e as Error;
    return new Response(
      JSON.stringify({
        success: false,
        error: `サーバーエラー: ${error.message || "不明なエラー"}`
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});



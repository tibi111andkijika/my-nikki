// supabase/functions/delete-user/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- CORS 設定 ---
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('NODE_ENV') === 'development'
    ? "http://localhost:3000" // 開発環境のReactアプリのURL
    : "https://your-app-domain.com", // ★★★ あなたの本番環境のドメインを設定してください ★★★
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type',
};

// serve() の代わりに Deno.serve() を使用
Deno.serve(async (req: Request): Promise<Response> => {
  // CORSプリフライトリクエストの処理
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseJwtSecret = Deno.env.get('MY_SUPABASE_JWT_SECRET') ?? ''; 


    // 環境変数がない場合の早期リターン (user-search と同様)
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

    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Missing Authorization header.' }), 
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    const token = authHeader.replace('Bearer ', '');

    // JWT検証 (user-search と同様のロギングとエラーハンドリング)
    const { data: { user }, error: authError } = await authSupabase.auth.getUser(token);

    // 認証失敗のハンドリング (user-search と同様)
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `認証に失敗しました。再度ログインしてください。${authError?.message ? ` (${authError.message})` : ''}`,
          debug: {
            authError: authError?.message,
            jwtProvided: !!token,
            timestamp: new Date().toISOString()
          }
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
    
    // リクエストボディから userId を取得
    const { userId } = await req.json();

    // ユーザーIDのミスマッチチェック
    if (user.id !== userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: You can only delete your own account.' }), 
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 管理者権限を持つSupabaseクライアント（service_roleキーを使用）
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    );

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to delete user' }), 
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }), // ★修正済み★
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e: unknown) {
    let errorMessage = 'Internal server error';

    if (e instanceof Error) {
      errorMessage = e.message;
    } else if (typeof e === 'string') {
      errorMessage = e;
    }
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }), // ★修正済み★
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
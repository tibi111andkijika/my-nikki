// supabase/functions/add-schedule/index.ts
// Deno 標準ライブラリのバージョンを最新に更新
// import { serve } from "https://deno.land/std@0.224.0/http/server.ts"; // Deno.serve を使うので不要
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";

// --- Zod Schema の定義 (src/schemas/scheduleSchemas.ts と一致させる) ---
export const ScheduleEntrySchema = z
  .object({
    start_time: z
      .string()
      .min(1, { message: "開始時刻を選択してください" })
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
        message: "開始時刻は HH:mm 形式で入力してください",
      }),
    end_time: z
      .string()
      .min(1, { message: "終了時間を選択してください" })
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
        message: "終了時刻は HH:mm 形式で入力してください",
      }),
    text: z
      .string()
      .min(1, { message: "内容を入力してください" })
      .max(200, { message: "200文字以内で入力してください" }),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "日付はYYYY-MM-DD 形式である必要があります",
    }),
  })
  .superRefine((data, ctx) => {
    const { start_time, end_time } = data;
    if (end_time <= start_time) {
      ctx.addIssue({
        path: ["end_time"],
        code: z.ZodIssueCode.custom,
        message: "終了時刻は開始時刻より後に設定してください",
      });
    }
  });

// 削除用のスキーマ (id が必須)
const DeleteScheduleSchema = z.object({
  id: z.string({ required_error: "削除対象のIDが必須です" }), // ★number から string に変更★
});

interface ScheduleRow {
  id: string; // ★number から string に変更 (UUIDのため)★
  start_time: string; // HH:mm
  end_time: string;   // HH:mm
  text: string;
  date: string;       // YYYY-MM-DD
  user_id: string;    // Supabase AuthのUUID
  created_at?: string; // Optional if it's an automatically generated timestamp
}

interface SuccessResponse {
  success: true;
  message: string;
}

// スケジュール追加時のレスポンス型
interface AddScheduleResponse extends SuccessResponse {
  data: ScheduleRow;
}

// スケジュール取得時のレスポンス型
interface GetSchedulesResponse extends SuccessResponse {
  data: ScheduleRow[];
}

// エラーレスポンスの型 (catchブロックで生成されるもの)
interface ErrorResponse {
  success: false;
  error: string;
}

// responseData に割り当てられる可能性のあるすべての型をUnion Typeでまとめる
type ResponseDataType = AddScheduleResponse | GetSchedulesResponse | SuccessResponse | ErrorResponse;

// --- CORS 設定の修正 ---
// 複数のオリジンを許可する設定
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://your-app-domain.com' // ★本番環境のドメインに変更★
];

// 動的にOriginを判定する関数
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && allowedOrigins.includes(origin) 
    ? origin 
    : allowedOrigins[0]; // デフォルトはlocalhost

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type',
  };
}

// --- Edge Function のメイン処理 ---
Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // CORSプリフライトリクエストの処理
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseJwtSecret = Deno.env.get('MY_SUPABASE_JWT_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET') ?? '';

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !supabaseJwtSecret) {
      throw new Error("サーバー設定エラー: 必要な環境変数が設定されていません。");
    }

    const authSupabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const dbSupabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error("認証ヘッダーが見つかりません。ログインしてください。");
    }
    const jwt = authHeader.replace('Bearer ', '');

    const { data: { user }, error: authError } = await authSupabase.auth.getUser(jwt);

    if (authError || !user) {
      throw new Error(`認証に失敗しました。再度ログインしてください。${authError?.message ? ` (${authError.message})` : ''}`);
    }

    let responseData: ResponseDataType;
    let status = 200;

    switch (req.method) {
      case 'POST': {
        const jsonBody = await req.json();
        const addData = ScheduleEntrySchema.parse(jsonBody);

        const { data: insertedEntry, error: insertError } = await dbSupabase
          .from('schedules') // ★あなたのテーブル名に合わせて変更★
          .insert({
            start_time: addData.start_time,
            end_time: addData.end_time,
            text: addData.text,
            date: addData.date,
            user_id: user.id,
          })
          .select()
          .single(); // 挿入されるデータが1件のみなので、.single() を追加すると良い

        if (insertError) {
          throw new Error(`スケジュールの追加に失敗しました: ${insertError.message}`);
        }
        if (!insertedEntry) {
              throw new Error("挿入されたスケジュールデータが見つかりませんでした。");
        }
        responseData = { success: true, message: "スケジュールを正常に追加しました", data: insertedEntry };
        status = 201; // POST成功時は201 Created が適切
        break;
      }

      case 'GET': {
        const url = new URL(req.url);
        const dateParam = url.searchParams.get('date');

        if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            console.error('Invalid or missing date parameter:', dateParam);
            throw new Error("日付パラメータ (date=YYYY-MM-DD) が必須です。");
        }
        
        const { data: schedules, error: fetchError } = await dbSupabase
            .from('schedules') // ★あなたのテーブル名に合わせて変更★
            .select('*')
            .eq('date', dateParam)
            .eq('user_id', user.id)
            .order('start_time', { ascending: true });

        if (fetchError) {
            throw new Error(`スケジュールの取得に失敗しました: ${fetchError.message}`);
        }
        responseData = { success: true, message: "スケジュールを正常に取得しました", data: schedules };
        break;
      }

      case 'DELETE': {
        const deleteJsonBody = await req.json();
        const deleteData = DeleteScheduleSchema.parse(deleteJsonBody); // Zodでバリデーション

        const { error: deleteError } = await dbSupabase
          .from('schedules') // ★あなたのテーブル名に合わせて変更★
          .delete()
          .eq('id', deleteData.id) // string 型のIDを使用
          .eq('user_id', user.id); // ユーザーIDも条件に加えることで、他のユーザーのデータを削除できないようにする

        if (deleteError) {
          throw new Error(`スケジュールの削除に失敗しました: ${deleteError.message}`);
        }
        responseData = { success: true, message: "スケジュールを正常に削除しました" };
        break;
      }

      default: {
        status = 405;
        console.warn('Unsupported HTTP method:', req.method);
        throw new Error("サポートされていないHTTPメソッドです。");
      }
    }

    return new Response(
      JSON.stringify(responseData),
      {
        status: status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (e: unknown) {
    let errorMessage = "不明なサーバーエラー";
    let errorStatus = 500;

    if (e instanceof z.ZodError) {
      errorMessage = `入力データのバリデーションエラー: ${e.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ')}`;
      errorStatus = 400;
      console.error("Zod Validation Error:", (e as z.ZodError).issues);
    } else if (e instanceof Error) {
      errorMessage = e.message;
      if (e.message.includes("認証に失敗しました") || e.message.includes("認証ヘッダー")) {
        errorStatus = 401;
      } else if (e.message.includes("必須です") || e.message.includes("形式が不正") || e.message.includes("が見つかりませんでした")) {
        errorStatus = 400;
      } else if (e.message.includes("サポートされていないHTTPメソッド")) {
        errorStatus = 405;
      }
    }

    const origin = req.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: errorStatus,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
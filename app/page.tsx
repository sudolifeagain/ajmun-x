import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import Link from "next/link";
import DiscordLoginButton from "./components/DiscordLoginButton";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Home({ searchParams }: Props) {
  const session = await getSession();
  const params = await searchParams;
  const errorType = typeof params.error === "string" ? params.error : null;

  if (session) {
    redirect("/ticket");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="w-full max-w-md px-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-2xl font-bold text-white">
              第37回 模擬国連会議全日本大会
            </h1>
            <p className="text-sm text-slate-300">
              オフラインイベント入退場管理システム
            </p>
          </div>

          <div className="space-y-4">
            {errorType === "access_denied" && (
              <div className="rounded-lg bg-red-500/10 p-4 text-center border border-red-500/20">
                <p className="text-sm font-semibold text-red-400">参加資格がありません</p>
                <p className="text-xs text-red-300 mt-1">
                  指定のDiscordサーバーに参加しているアカウントでログインしてください。
                </p>
              </div>
            )}
            {errorType && errorType !== "access_denied" && (
              <div className="rounded-lg bg-red-500/10 p-4 text-center border border-red-500/20">
                <p className="text-sm font-semibold text-red-400">ログインエラー</p>
                <p className="text-xs text-red-300 mt-1">
                  エラーが発生しました。もう一度お試しください。
                </p>
              </div>
            )}
            <DiscordLoginButton />
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            ログインすることで、QRコードを発行できます。
            <br />
            識別情報のみを取得します（サーバー一覧は取得しません）。
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          © 2025 AJMUN. All rights reserved.
          <br />
          <span className="text-slate-600">
            Developed by{" "}
            <a
              href="https://re4lity.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              re4lity
            </a>
          </span>
          <br />
          <a href="/terms" className="text-slate-500 hover:text-slate-400 transition-colors">
            利用規約
          </a>
          {" | "}
          <a href="/privacy" className="text-slate-500 hover:text-slate-400 transition-colors">
            プライバシーポリシー
          </a>
        </p>
      </div>
    </div>
  );
}

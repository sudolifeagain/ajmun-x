import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import Link from "next/link";
import DiscordLoginButton from "./components/DiscordLoginButton";

export default async function Home() {
  const session = await getSession();

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

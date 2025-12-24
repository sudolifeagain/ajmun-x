"use client";

import Link from "next/link";

export default function GuidePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        📱 使い方ガイド
                    </h1>
                    <p className="text-slate-300">
                        QRコードの発行から当日の入場までの流れ
                    </p>
                </div>

                {/* Steps */}
                <div className="space-y-6">
                    {/* Step 1 */}
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                1
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-white mb-2">
                                    Discordでログイン
                                </h2>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    トップページの「Discordでログイン」ボタンを押すと、Discordの認証画面が開きます。
                                    <br /><br />
                                    <strong className="text-white">💡 ポイント：</strong>
                                    <br />
                                    ・大会サーバーに参加済みのDiscordアカウントでログインしてください
                                    <br />
                                    ・取得するのは「あなたが誰か」という情報のみです（サーバー一覧などは見ません）
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                2
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-white mb-2">
                                    QRコードを保存
                                </h2>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    ログインすると、あなた専用のQRコードが表示されます。
                                    <br /><br />
                                    <strong className="text-white">⬇️ 保存方法：</strong>
                                    <br />
                                    ・「画像を保存」ボタンを押すと、カメラロールに保存できます
                                    <br />
                                    ・スクリーンショットでもOKです
                                    <br /><br />
                                    <strong className="text-red-400">⚠️ 重要：</strong>
                                    <br />
                                    会場はWi-Fiがつながりにくいことがあります。<strong className="text-white">必ず事前に保存</strong>しておいてください！
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                3
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-white mb-2">
                                    当日：受付でQRコードを見せる
                                </h2>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    会場の入口で、保存したQRコード画像をスタッフに見せてください。
                                    <br /><br />
                                    <strong className="text-white">✨ スムーズな入場のために：</strong>
                                    <br />
                                    ・画面の明るさを最大にしておくと読み取りやすいです
                                    <br />
                                    ・順番が来る前にQRコード画像を開いておくとスムーズです
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step 4 */}
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                ✓
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-white mb-2">
                                    入場完了！
                                </h2>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    スタッフの端末に緑の画面が表示されれば入場OKです。
                                    <br /><br />
                                    <strong className="text-white">📅 4日間共通：</strong>
                                    <br />
                                    同じQRコードを期間中ずっと使えます。毎日発行し直す必要はありません。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FAQ */}
                <div className="mt-10">
                    <h2 className="text-xl font-bold text-white mb-4 text-center">
                        ❓ よくある質問
                    </h2>

                    <div className="space-y-4">
                        <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10">
                            <h3 className="text-white font-semibold mb-1">
                                Q. QRコードが表示されません
                            </h3>
                            <p className="text-slate-400 text-sm">
                                大会のDiscordサーバーに参加していないアカウントではQRコードを発行できません。参加済みのアカウントで再度ログインしてください。
                            </p>
                        </div>

                        <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10">
                            <h3 className="text-white font-semibold mb-1">
                                Q. 間違ったアカウントでログインしてしまいました
                            </h3>
                            <p className="text-slate-400 text-sm">
                                一度ログアウトして、正しいアカウントで再度ログインしてください。Discordアプリでログイン中のアカウントが使われます。
                            </p>
                        </div>

                        <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10">
                            <h3 className="text-white font-semibold mb-1">
                                Q. 当日、QRコードが読み取れませんでした
                            </h3>
                            <p className="text-slate-400 text-sm">
                                画面の明るさを最大にしてお試しください。それでもダメな場合はスタッフにお申し出ください。
                            </p>
                        </div>
                    </div>
                </div>

                {/* Back Button */}
                <div className="mt-10 text-center">
                    <Link
                        href="/"
                        className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                    >
                        ← トップページに戻る
                    </Link>
                </div>

                {/* Footer */}
                <p className="mt-8 text-center text-xs text-slate-500">
                    ご不明点は運営スタッフまでお問い合わせください
                </p>
            </div>
        </div>
    );
}

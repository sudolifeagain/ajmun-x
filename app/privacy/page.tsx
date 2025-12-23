export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
            <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
                <h1 className="mb-6 text-3xl font-bold text-white">プライバシーポリシー（Privacy Policy）</h1>
                <p className="mb-8 text-sm text-slate-400">最終更新日: 2025年12月23日</p>

                <div className="space-y-8 text-slate-300">
                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">1. はじめに</h2>
                        <p>第37回模擬国連会議全日本大会事務局（以下「当事務局」）は、「第37回 模擬国連会議全日本大会 入退場管理システム」（以下「本サービス」）における個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">2. 収集する情報</h2>
                        <h3 className="mt-4 mb-2 text-lg font-medium text-white">2.1 Discord から取得する情報</h3>
                        <ul className="list-inside list-disc space-y-1">
                            <li>Discord ユーザーID</li>
                            <li>Discord ユーザー名および表示名</li>
                            <li>Discord アバター画像 URL</li>
                            <li>所属する Discord サーバー情報（対象サーバーのみ）</li>
                            <li>サーバー内でのニックネーム</li>
                            <li>付与されているロール情報</li>
                        </ul>

                        <h3 className="mt-4 mb-2 text-lg font-medium text-white">2.2 本サービスで生成する情報</h3>
                        <ul className="list-inside list-disc space-y-1">
                            <li>QR トークン（署名付き認証用トークン）</li>
                            <li>出席ログ（入場日時、担当スタッフ情報）</li>
                            <li>参加者属性（スタッフ/会議運営者/参加者）</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">3. 情報の利用目的</h2>
                        <p>収集した情報は、以下の目的でのみ使用します。</p>
                        <ul className="mt-2 list-inside list-disc space-y-1">
                            <li>入退場管理および出席確認</li>
                            <li>参加者の本人確認</li>
                            <li>イベント運営に必要な統計情報の作成</li>
                        </ul>
                        <p className="mt-3 font-medium text-white">マーケティングや広告目的での利用は一切行いません。</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">4. 情報の共有</h2>
                        <p>収集した情報は、以下の範囲でのみ共有されます。</p>
                        <ul className="mt-2 list-inside list-disc space-y-1">
                            <li><strong>第37回模擬国連会議全日本大会事務局</strong>: 運営管理目的</li>
                            <li><strong>会議フロント（会議運営者）</strong>: 各会議の出席管理目的</li>
                        </ul>
                        <p className="mt-3">上記以外の第三者への情報提供は一切行いません。</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">5. 情報の保存</h2>
                        <h3 className="mt-4 mb-2 text-lg font-medium text-white">5.1 保存場所</h3>
                        <p>収集した情報は、Oracle Cloud Infrastructure（OCI）日本リージョン（大阪）のサーバーに保存されます。</p>

                        <h3 className="mt-4 mb-2 text-lg font-medium text-white">5.2 保存期間</h3>
                        <p>収集した情報は、<strong>イベント終了後30日以内に削除</strong>します。</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">6. 情報のセキュリティ</h2>
                        <p>当事務局は、収集した情報を保護するため、以下のセキュリティ対策を実施しています。</p>
                        <ul className="mt-2 list-inside list-disc space-y-1">
                            <li>HTTPS による通信の暗号化</li>
                            <li>署名付きトークンによる認証</li>
                            <li>クラウドファイアウォールによるアクセス制御</li>
                            <li>スタッフページへのアクセス制限（Cloudflare Access）</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">7. 利用者の権利</h2>
                        <p>利用者は、以下の権利を有します。</p>
                        <ul className="mt-2 list-inside list-disc space-y-1">
                            <li><strong>アクセス権</strong>: 自身に関する保存データの開示を請求できます</li>
                            <li><strong>削除権</strong>: 自身に関するデータの削除を請求できます</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">8. Cookie の使用</h2>
                        <p>本サービスでは、セッション管理のために Cookie を使用します。この Cookie は、ログイン状態の維持のみに使用され、トラッキング目的では使用しません。</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">9. 外部サービス</h2>
                        <p>本サービスは、認証のために Discord の OAuth2 サービスを利用しています。Discord によるデータの取り扱いについては、<a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">Discord のプライバシーポリシー</a>をご確認ください。</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">10. お問い合わせ</h2>
                        <p><strong>第37回模擬国連会議全日本大会事務局</strong></p>
                        <p>Email: <a href="mailto:contact+ajmun@re4lity.com" className="text-purple-400 hover:text-purple-300">contact+ajmun@re4lity.com</a></p>
                    </section>
                </div>

                <div className="mt-8 border-t border-white/10 pt-4 text-center text-sm text-slate-500">
                    開発: <a href="https://re4lity.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">re4lity</a>
                </div>
            </div>
        </div>
    );
}

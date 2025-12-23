export default function TermsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
            <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
                <h1 className="mb-6 text-3xl font-bold text-white">利用規約（Terms of Service）</h1>
                <p className="mb-8 text-sm text-slate-400">最終更新日: 2025年12月23日</p>

                <div className="space-y-8 text-slate-300">
                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">1. はじめに</h2>
                        <p>本利用規約（以下「本規約」）は、第37回模擬国連会議全日本大会事務局（以下「当事務局」）が提供する「第37回 模擬国連会議全日本大会 入退場管理システム」（以下「本サービス」）の利用条件を定めるものです。</p>
                        <p className="mt-2">本サービスをご利用になる前に、本規約をよくお読みください。本サービスを利用することにより、利用者は本規約に同意したものとみなされます。</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">2. サービス概要</h2>
                        <p>本サービスは、第37回 模擬国連会議全日本大会における参加者の入退場管理および出席確認を目的として提供されます。</p>
                        <ul className="mt-2 list-inside list-disc space-y-1">
                            <li>Discord アカウントによる認証</li>
                            <li>QR コードの発行・表示</li>
                            <li>出席状況の記録・管理</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">3. 利用条件</h2>
                        <h3 className="mt-4 mb-2 text-lg font-medium text-white">3.1 アカウント</h3>
                        <p>本サービスの利用には、有効な Discord アカウントが必要です。利用者は、Discord の利用規約を遵守する責任があります。</p>

                        <h3 className="mt-4 mb-2 text-lg font-medium text-white">3.2 禁止事項</h3>
                        <p>利用者は、以下の行為を行ってはなりません。</p>
                        <ul className="mt-2 list-inside list-disc space-y-1">
                            <li>他人の Discord アカウントを使用する行為</li>
                            <li>QR コードを第三者に譲渡または共有する行為</li>
                            <li>本サービスのシステムに対する不正アクセス</li>
                            <li>本サービスの運営を妨害する行為</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">4. 免責事項</h2>
                        <h3 className="mt-4 mb-2 text-lg font-medium text-white">4.1 サービスの中断</h3>
                        <p>当事務局は、システムのメンテナンス、天災、停電、通信障害等の不可抗力、その他必要と判断した場合にサービスを中断することがあります。</p>

                        <h3 className="mt-4 mb-2 text-lg font-medium text-white">4.2 責任の制限</h3>
                        <p>当事務局は、本サービスの利用に関連して生じた直接的・間接的な損害について、一切の責任を負いません。</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">5. 知的財産権</h2>
                        <p>本サービスのオリジナルコード、デザイン、コンテンツに関する知的財産権は、当事務局または開発者（re4lity）に帰属します。</p>
                        <p className="mt-2 text-sm text-slate-400">本サービスで使用しているオープンソースライブラリ（Next.js、Prisma、その他）については、それぞれのライセンスに従います。</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">6. 準拠法と管轄</h2>
                        <p>本規約は日本法に準拠し、本サービスに関する紛争は東京地方裁判所を第一審の専属的合意管轄裁判所とします。</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">7. サービスレベル保証（SLA）</h2>
                        <p>本サービスは、サービスレベル保証（SLA）を提供しません。可用性、応答時間、稼働率等について、いかなる保証も行いません。</p>
                    </section>

                    <section>
                        <h2 className="mb-3 text-xl font-semibold text-white">8. お問い合わせ</h2>
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

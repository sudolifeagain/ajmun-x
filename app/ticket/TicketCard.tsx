"use client";

import { useRef } from "react";
import QRCodeDisplay from "./QRCodeDisplay";
import Link from "next/link";

interface Guild {
    guildId: string;
    guildName: string;
    guildIconUrl: string | null;
    defaultColor: string;
    nickname: string | null;
}

interface TicketCardProps {
    user: {
        discordUserId: string;
        globalName: string | null;
        defaultAvatarUrl: string | null;
        qrToken: string;
        primaryAttribute: string;
    };
    guilds: Guild[];
}

export default function TicketCard({ user, guilds }: TicketCardProps) {
    const ticketRef = useRef<HTMLDivElement>(null);

    const handleSaveImage = () => {
        // Find the QR code canvas element
        const qrCanvas = ticketRef.current?.querySelector('canvas');
        if (!qrCanvas) {
            alert("QRコードが見つかりません。");
            return;
        }

        try {
            // Create a new canvas with padding and text
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const padding = 50;
            const headerHeight = guilds.length > 0 ? 100 : 30;
            const footerHeight = 130;
            const qrSize = qrCanvas.width;

            canvas.width = qrSize + padding * 2;
            canvas.height = headerHeight + qrSize + padding + footerHeight;

            // Background gradient
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#0f172a');
            gradient.addColorStop(0.5, '#581c87');
            gradient.addColorStop(1, '#0f172a');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Server info at top
            if (guilds.length > 0) {
                const guild = guilds[0];
                ctx.fillStyle = '#94a3b8';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('所属サーバー', canvas.width / 2, 30);

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 16px sans-serif';
                ctx.fillText(guild.guildName, canvas.width / 2, 55);

                ctx.fillStyle = '#c4b5fd';
                ctx.font = '14px sans-serif';
                ctx.fillText(guild.nickname || user.globalName || 'User', canvas.width / 2, 80);
            }

            // White background for QR with rounded corners effect
            const qrY = headerHeight + 15;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(padding - 15, qrY - 15, qrSize + 30, qrSize + 30);

            // Draw QR code
            ctx.drawImage(qrCanvas, padding, qrY);

            // Event text at bottom
            const textY = headerHeight + qrSize + 50;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('第37回全日本大会', canvas.width / 2, textY);

            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('2025年12月27日〜30日', canvas.width / 2, textY + 28);

            // Attribute badge
            const attrText = user.primaryAttribute === "staff" ? "スタッフ"
                : user.primaryAttribute === "organizer" ? "会議フロント" : "参加者";
            ctx.fillStyle = '#a78bfa';
            ctx.font = '13px sans-serif';
            ctx.fillText(attrText, canvas.width / 2, textY + 55);

            // Download
            const link = document.createElement("a");
            link.download = "ajmun-ticket.png";
            link.href = canvas.toDataURL("image/png");
            link.click();
        } catch (error) {
            console.error("Failed to save image:", error);
            alert("画像の保存に失敗しました。スクリーンショットをご利用ください。");
        }
    };

    return (
        <div className="w-full max-w-md">
            {/* Ticket Content - this will be captured */}
            <div
                ref={ticketRef}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 shadow-2xl"
            >
                {/* Guild Info */}
                {guilds.length > 0 && (
                    <div className="mb-4">
                        <p className="mb-2 text-xs text-slate-400">所属サーバー</p>
                        <div className="flex flex-col gap-3">
                            {guilds.map((guild) => (
                                <div
                                    key={guild.guildId}
                                    className="rounded-lg bg-white/10 p-3"
                                    style={{
                                        borderLeft: `4px solid ${guild.guildIconUrl ? "#8B5CF6" : guild.defaultColor}`,
                                    }}
                                >
                                    {/* Server Icon + Server Name */}
                                    <div className="mb-3 flex items-center gap-3">
                                        {guild.guildIconUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={guild.guildIconUrl}
                                                alt={guild.guildName}
                                                className="h-10 w-10 rounded-full ring-2 ring-white/20"
                                            />
                                        ) : (
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-white/20"
                                                style={{ backgroundColor: guild.defaultColor }}
                                            >
                                                {guild.guildName.charAt(0)}
                                            </div>
                                        )}
                                        <span className="font-semibold text-white">{guild.guildName}</span>
                                    </div>

                                    {/* User Icon + Nickname */}
                                    <div className="flex items-center gap-3 pl-2">
                                        {user.defaultAvatarUrl && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={user.defaultAvatarUrl}
                                                alt="Avatar"
                                                className="h-8 w-8 rounded-full ring-1 ring-purple-500/50"
                                            />
                                        )}
                                        <div>
                                            <p className="text-sm text-white">
                                                {guild.nickname || user.globalName || "User"}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {user.primaryAttribute === "staff" && "スタッフ"}
                                                {user.primaryAttribute === "organizer" && "会議フロント"}
                                                {user.primaryAttribute === "participant" && "参加者"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Fallback if no guild */}
                {guilds.length === 0 && (
                    <div className="mb-6 flex items-center gap-4">
                        {user.defaultAvatarUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={user.defaultAvatarUrl}
                                alt="Avatar"
                                className="h-16 w-16 rounded-full ring-2 ring-purple-500"
                            />
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                {user.globalName || "User"}
                            </h2>
                            <p className="text-sm text-slate-300">
                                {user.primaryAttribute === "staff" && "スタッフ"}
                                {user.primaryAttribute === "organizer" && "会議フロント"}
                                {user.primaryAttribute === "participant" && "参加者"}
                            </p>
                        </div>
                    </div>
                )}

                {/* QR Code */}
                <div className="flex flex-col items-center">
                    <div className="rounded-xl bg-white p-4 shadow-lg">
                        <QRCodeDisplay token={user.qrToken} />
                    </div>

                    <p className="mt-4 text-center text-xs text-slate-400">
                        このQRコードを受付でスキャンしてください
                        <br />
                        スクリーンショットを保存しておくと、オフラインでも使用できます
                    </p>
                </div>

                {/* Event Info */}
                <div className="mt-6 rounded-lg bg-white/5 p-4">
                    <p className="text-center text-sm text-slate-300">
                        <span className="font-semibold text-white">第37回全日本大会</span>
                        <br />
                        2025年12月27日〜30日
                    </p>
                </div>
            </div>

            {/* Save as Image Button */}
            <div className="mt-4 text-center">
                <button
                    onClick={handleSaveImage}
                    className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500"
                >
                    📥 画像として保存
                </button>
            </div>

            {/* Logout */}
            <div className="mt-4 text-center">
                <form method="POST" action="/api/auth/logout">
                    <button
                        type="submit"
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        ログアウト
                    </button>
                </form>
            </div>

            {/* Footer Links */}
            <div className="mt-6 text-center text-xs text-slate-500">
                <Link href="/terms" className="hover:text-slate-400 transition-colors">
                    利用規約
                </Link>
                {" | "}
                <Link href="/privacy" className="hover:text-slate-400 transition-colors">
                    プライバシーポリシー
                </Link>
            </div>
        </div>
    );
}

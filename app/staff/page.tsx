"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface ScanResult {
    status: "ok" | "duplicate" | "error" | "idle";
    message: string;
    user?: {
        discordUserId: string;
        globalName: string | null;
        avatarUrl: string | null;
        attribute: string;
        guilds: Array<{
            guildId: string;
            guildName: string;
            guildIconUrl: string | null;
            defaultColor: string;
            nickname: string | null;
        }>;
    };
}

export default function ScannerPage() {
    const [result, setResult] = useState<ScanResult>({ status: "idle", message: "QRコードをスキャンしてください" });
    const [isScanning, setIsScanning] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const lastScannedRef = useRef<string>("");
    const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTapRef = useRef<number>(0);

    const vibrate = useCallback((pattern: number[]) => {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }, []);

    // Reset to idle state for next scan
    const resetResult = useCallback(() => {
        if (resetTimeoutRef.current) {
            clearTimeout(resetTimeoutRef.current);
        }
        setResult({ status: "idle", message: "QRコードをスキャンしてください" });
        lastScannedRef.current = "";
        setIsProcessing(false);
    }, []);

    // Handle double-tap/double-click to dismiss
    const handleDoubleTap = useCallback(() => {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300; // ms

        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            // Double tap detected
            resetResult();
        }
        lastTapRef.current = now;
    }, [resetResult]);

    const handleScan = useCallback(async (decodedText: string) => {
        // Prevent duplicate scans of the same code in quick succession
        if (isProcessing || decodedText === lastScannedRef.current) {
            return;
        }

        setIsProcessing(true);
        lastScannedRef.current = decodedText;

        try {
            const response = await fetch("/api/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: decodedText }),
            });

            const data: ScanResult = await response.json();
            setResult(data);

            // Vibration feedback based on result
            switch (data.status) {
                case "ok":
                    vibrate([100]); // Short single vibration
                    break;
                case "duplicate":
                    vibrate([100, 50, 100]); // Two short vibrations
                    break;
                case "error":
                    vibrate([500]); // Long vibration
                    break;
            }
        } catch (error) {
            console.error("Scan error:", error);
            setResult({ status: "error", message: "スキャンエラー" });
            vibrate([500]);
        }

        // Auto-reset after 3 seconds
        if (resetTimeoutRef.current) {
            clearTimeout(resetTimeoutRef.current);
        }
        resetTimeoutRef.current = setTimeout(() => {
            setResult({ status: "idle", message: "QRコードをスキャンしてください" });
            lastScannedRef.current = "";
            setIsProcessing(false);
        }, 3000);
    }, [isProcessing, vibrate]);

    useEffect(() => {
        const startScanner = async () => {
            try {
                const scanner = new Html5Qrcode("qr-reader", {
                    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                    verbose: false,
                });
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        // No qrbox - scan entire view
                    },
                    handleScan,
                    () => { } // Ignore errors from failed scans
                );

                setIsScanning(true);
            } catch (error) {
                console.error("Failed to start scanner:", error);
                setResult({ status: "error", message: "カメラの起動に失敗しました" });
            }
        };

        startScanner();

        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(console.error);
            }
            if (resetTimeoutRef.current) {
                clearTimeout(resetTimeoutRef.current);
            }
        };
    }, [handleScan]);

    // Get background style based on result and guilds
    const getBackgroundStyle = () => {
        if (result.status === "idle") {
            return { backgroundColor: "#0f172a" }; // Dark slate
        }
        if (result.status === "error") {
            return { backgroundColor: "#7f1d1d" }; // Dark red
        }
        if (result.status === "duplicate") {
            return { backgroundColor: "#854d0e" }; // Dark yellow/amber
        }
        // OK status - show guild icons or colors
        if (result.user?.guilds && result.user.guilds.length > 0) {
            const guild = result.user.guilds[0];
            if (guild.guildIconUrl) {
                return {
                    backgroundImage: `url(${guild.guildIconUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                };
            }
            return { backgroundColor: guild.defaultColor };
        }
        return { backgroundColor: "#166534" }; // Default green
    };

    return (
        <div
            className="flex min-h-screen flex-col items-center justify-between transition-all duration-300"
            style={getBackgroundStyle()}
        >
            {/* Status overlay for non-idle states */}
            {result.status !== "idle" && (
                <div
                    className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 cursor-pointer"
                    onClick={handleDoubleTap}
                    onTouchEnd={handleDoubleTap}
                >
                    <div className="text-center p-8 rounded-3xl bg-black/60 backdrop-blur-md max-w-md mx-4 pointer-events-none">
                        {result.user && (
                            <>
                                {/* User Avatar */}
                                {result.user.avatarUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={result.user.avatarUrl}
                                        alt="User"
                                        className="w-28 h-28 rounded-full mx-auto mb-4 ring-4 ring-white/50 shadow-2xl"
                                    />
                                )}

                                {/* User Name */}
                                <h2 className="text-3xl font-bold text-white mb-1">
                                    {result.user.globalName}
                                </h2>

                                {/* Attribute Badge */}
                                <div className="inline-block px-3 py-1 rounded-full text-sm font-medium mb-4"
                                    style={{
                                        backgroundColor: result.user.attribute === "staff" ? "#3B82F6" :
                                            result.user.attribute === "organizer" ? "#8B5CF6" : "#10B981",
                                        color: "white"
                                    }}
                                >
                                    {result.user.attribute === "staff" && "スタッフ"}
                                    {result.user.attribute === "organizer" && "会議運営者"}
                                    {result.user.attribute === "participant" && "参加者"}
                                </div>

                                {/* Guild Information */}
                                {result.user.guilds.length > 0 && (
                                    <div className="mt-4 space-y-3">
                                        {result.user.guilds.map((guild) => (
                                            <div
                                                key={guild.guildId}
                                                className="flex items-center gap-3 bg-white/10 rounded-xl p-3"
                                            >
                                                {/* Guild Icon */}
                                                <div
                                                    className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ring-2 ring-white/20"
                                                    style={{ backgroundColor: guild.defaultColor }}
                                                >
                                                    {guild.guildIconUrl ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={guild.guildIconUrl}
                                                            alt={guild.guildName}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="flex items-center justify-center h-full text-white font-bold text-lg">
                                                            {guild.guildName.charAt(0)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Guild Info */}
                                                <div className="text-left flex-1 min-w-0">
                                                    <p className="text-white font-semibold truncate">
                                                        {guild.guildName}
                                                    </p>
                                                    {guild.nickname && (
                                                        <p className="text-white/70 text-sm truncate">
                                                            表示名: {guild.nickname}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Status Message */}
                        <div
                            className={`mt-6 text-2xl font-bold ${result.status === "ok"
                                ? "text-green-400"
                                : result.status === "duplicate"
                                    ? "text-yellow-400"
                                    : "text-red-400"
                                }`}
                        >
                            {result.status === "ok" && "✓ "}
                            {result.status === "duplicate" && "⚠ "}
                            {result.status === "error" && "✗ "}
                            {result.message}
                        </div>
                    </div>
                </div>
            )}

            {/* Camera View - Full Screen */}
            <div className="w-full h-screen absolute inset-0">
                <div
                    id="qr-reader"
                    className={`w-full h-full ${!isScanning ? "hidden" : ""}`}
                />
                {!isScanning && (
                    <div className="flex items-center justify-center h-full w-full bg-slate-900">
                        <div className="text-center">
                            <div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full mx-auto mb-4"></div>
                            <p className="text-white text-lg">カメラを起動中...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Status - only visible in idle state */}
            {result.status === "idle" && (
                <div className="fixed bottom-0 w-full p-4 text-center bg-gradient-to-t from-black/50 to-transparent z-20">
                    <p className="text-white/80 text-sm">
                        {isScanning ? "📷 カメラ画面全体でスキャン可能" : "カメラ準備中..."}
                    </p>
                </div>
            )}
        </div>
    );
}

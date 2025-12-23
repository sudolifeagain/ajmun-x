"use client";

import QRCode from "qrcode";
import { useEffect, useRef } from "react";

interface QRCodeDisplayProps {
    token: string;
}

export default function QRCodeDisplay({ token }: QRCodeDisplayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current) {
            QRCode.toCanvas(canvasRef.current, token, {
                width: 256,
                margin: 2,
                color: {
                    dark: "#1e1b4b",
                    light: "#ffffff",
                },
            });
        }
    }, [token]);

    return <canvas ref={canvasRef} className="h-64 w-64" />;
}

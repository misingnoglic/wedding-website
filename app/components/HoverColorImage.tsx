"use client";

import { useState } from "react";
import Image from "next/image";

interface HoverColorImageProps {
    src: string;
    alt: string;
    containerClassName?: string;
    imageClassName?: string;
    sizes?: string;
    priority?: boolean;
}

export default function HoverColorImage({
    src,
    alt,
    containerClassName = "",
    imageClassName = "object-cover",
    sizes,
    priority = false,
}: HoverColorImageProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [isTapped, setIsTapped] = useState(false);

    const handlePointerEnter = (e: React.PointerEvent) => {
        if (e.pointerType === "mouse") {
            setIsHovered(true);
        }
    };

    const handlePointerLeave = (e: React.PointerEvent) => {
        if (e.pointerType === "mouse") {
            setIsHovered(false);
        }
    };

    const active = isHovered || isTapped;

    return (
        <div 
            className={`relative overflow-hidden cursor-pointer ${containerClassName}`} 
            tabIndex={0}
            onClick={() => setIsTapped(!isTapped)}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
        >
            <Image
                src={src}
                alt={alt}
                fill
                className={`${imageClassName} transition-all duration-700 ease-in-out ${active ? "grayscale-0 scale-105" : "grayscale"}`}
                sizes={sizes}
                priority={priority}
            />
        </div>
    );
}

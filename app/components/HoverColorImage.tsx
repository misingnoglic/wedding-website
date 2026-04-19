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
    const [isTapped, setIsTapped] = useState(false);

    return (
        <div 
            className={`relative overflow-hidden group cursor-pointer ${containerClassName}`} 
            tabIndex={0}
            onClick={() => setIsTapped(!isTapped)}
        >
            <Image
                src={src}
                alt={alt}
                fill
                className={`${imageClassName} transition-all duration-700 ease-in-out ${isTapped ? "grayscale-0 scale-105" : "grayscale group-hover:grayscale-0 group-hover:scale-105 active:grayscale-0 active:scale-105"}`}
                sizes={sizes}
                priority={priority}
            />
        </div>
    );
}

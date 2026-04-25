"use client";

import { useId, useSyncExternalStore } from "react";
import Image from "next/image";

let globalActiveId: string | null = null;
const listeners = new Set<() => void>();

const hoverStore = {
    setActiveId: (id: string | null) => {
        globalActiveId = id;
        listeners.forEach((listener) => listener());
    },
    getActiveId: () => globalActiveId,
    subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};

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
    const id = useId();
    const activeId = useSyncExternalStore(
        hoverStore.subscribe,
        hoverStore.getActiveId,
        () => null
    );

    const active = activeId === id;

    const handlePointerEnter = (e: React.PointerEvent) => {
        if (e.pointerType === "mouse") {
            hoverStore.setActiveId(id);
        }
    };

    const handlePointerLeave = (e: React.PointerEvent) => {
        if (e.pointerType === "mouse") {
            if (globalActiveId === id) {
                hoverStore.setActiveId(null);
            }
        }
    };

    const handleClick = () => {
        if (active) {
            hoverStore.setActiveId(null);
        } else {
            hoverStore.setActiveId(id);
        }
    };

    return (
        <div 
            className={`relative overflow-hidden cursor-pointer ${containerClassName}`} 
            tabIndex={0}
            onClick={handleClick}
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

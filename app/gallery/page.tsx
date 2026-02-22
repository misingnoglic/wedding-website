import fs from "fs";
import path from "path";
import Image from "next/image";

export default function Gallery() {
    const galleryDir = path.join(process.cwd(), "public", "gallery");
    let images: string[] = [];

    try {
        images = fs.readdirSync(galleryDir).filter(file =>
            file.toLowerCase().endsWith(".jpg") ||
            file.toLowerCase().endsWith(".png") ||
            file.toLowerCase().endsWith(".jpeg")
        );
    } catch (error) {
        console.error("Error reading gallery directory:", error);
    }

    return (
        <div className="w-full max-w-7xl px-4 py-16 md:py-24 animate-fade-in text-center">
            <h1 className="text-5xl md:text-7xl font-script mb-8">Engagement Photos</h1>
            <p className="max-w-xl mx-auto text-lg text-zinc-600 font-karla mb-16 leading-relaxed">
                Shinjuku National Park, Tokyo, Japan, March 4th, 2024
            </p>

            {images.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {images.map((img, index) => (
                        <div key={index} className="relative aspect-[4/5] min-h-[300px] w-full overflow-hidden bg-zinc-100 group cursor-pointer" tabIndex={0}>
                            <Image
                                src={`/gallery/${img}`}
                                alt={`Engagement photo ${index + 1}`}
                                fill
                                className="object-cover grayscale transition-all duration-700 ease-in-out group-hover:grayscale-0 group-hover:scale-105 active:grayscale-0 active:scale-105"
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-zinc-500 font-karla">Gallery images coming soon.</p>
            )}
        </div>
    );
}

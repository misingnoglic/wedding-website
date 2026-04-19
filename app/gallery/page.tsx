import fs from "fs";
import path from "path";
import HoverColorImage from "../components/HoverColorImage";

export default function Gallery() {
    const galleryDir = path.join(process.cwd(), "public", "gallery");
    const cityImages: Record<string, string[]> = {};

    try {
        if (fs.existsSync(galleryDir)) {
            const items = fs.readdirSync(galleryDir, { withFileTypes: true });
            for (const item of items) {
                if (item.isDirectory()) {
                    const cityName = item.name;
                    const cityPath = path.join(galleryDir, cityName);
                    const images = fs.readdirSync(cityPath).filter(file =>
                        file.toLowerCase().endsWith(".jpg") ||
                        file.toLowerCase().endsWith(".png") ||
                        file.toLowerCase().endsWith(".jpeg")
                    );
                    if (images.length > 0) {
                        cityImages[cityName] = images;
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error reading gallery directory:", error);
    }

    const cityOrder = ["Tokyo", "Hong Kong"];
    const cities = Object.keys(cityImages).sort((a, b) => {
        const indexA = cityOrder.indexOf(a);
        const indexB = cityOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    return (
        <div className="w-full max-w-7xl px-4 py-16 md:py-24 animate-fade-in text-center">
            <h1 className="text-5xl md:text-7xl font-script mb-16">Gallery</h1>

            {cities.length > 0 ? (
                <div className="space-y-24">
                    {cities.map((city) => (
                        <div key={city}>
                            <div className="mb-12">
                                <h2 className="text-4xl font-sans tracking-tight mb-6">{city}</h2>
                                <div className="w-24 h-px bg-zinc-300 mx-auto"></div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {cityImages[city].map((img, index) => (
                                    <HoverColorImage
                                        key={index}
                                        src={`/gallery/${city}/${img}`}
                                        alt={`${city} photo ${index + 1}`}
                                        containerClassName="aspect-[4/5] min-h-[300px] w-full bg-zinc-100"
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-zinc-500 font-karla">Gallery images coming soon.</p>
            )}
        </div>
    );
}

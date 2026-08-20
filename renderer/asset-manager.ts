export class AssetManager {
    private static assets: Map<string, HTMLImageElement> = new Map();
    private static isLoaded = false;

    // Simple SVG definitions for map assets
    private static readonly SVGS = {
        treeDeciduous: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <rect x="14" y="20" width="4" height="12" fill="#78350f" />
            <circle cx="16" cy="14" r="12" fill="#15803d" />
            <circle cx="10" cy="18" r="8" fill="#166534" />
            <circle cx="22" cy="18" r="8" fill="#166534" />
        </svg>\`,
        
        treePine: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
            <rect x="14" y="24" width="4" height="8" fill="#451a03" />
            <polygon points="16,2 4,16 12,16 4,28 28,28 20,16 28,16" fill="#14532d" />
        </svg>\`,

        mountain: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
            <polygon points="20,4 4,36 36,36" fill="#737373" />
            <polygon points="20,4 4,36 20,36" fill="#525252" />
        </svg>\`,

        mountainSnow: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
            <polygon points="20,4 4,36 36,36" fill="#737373" />
            <polygon points="20,4 4,36 20,36" fill="#525252" />
            <polygon points="20,4 12,20 16,18 20,24 24,18 28,20" fill="#f5f5f5" />
            <polygon points="20,4 12,20 16,18 20,24" fill="#e5e5e5" />
        </svg>\`,

        city: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
            <rect x="8" y="16" width="24" height="24" fill="#64748b" />
            <rect x="12" y="12" width="6" height="8" fill="#475569" />
            <rect x="22" y="8" width="6" height="12" fill="#475569" />
            <polygon points="8,16 20,6 32,16" fill="#94a3b8" />
            <rect x="16" y="28" width="8" height="12" fill="#334155" />
        </svg>\`
    };

    public static async init() {
        if (this.isLoaded) return;
        
        const loadPromises = Object.entries(this.SVGS).map(([key, svg]) => {
            return new Promise<void>((resolve) => {
                const img = new Image();
                const blob = new Blob([svg], { type: "image/svg+xml" });
                const url = URL.createObjectURL(blob);
                img.onload = () => {
                    this.assets.set(key, img);
                    URL.revokeObjectURL(url);
                    resolve();
                };
                img.src = url;
            });
        });

        await Promise.all(loadPromises);
        this.isLoaded = true;
    }

    public static get(key: string): HTMLImageElement | null {
        return this.assets.get(key) || null;
    }
}

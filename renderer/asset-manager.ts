export class AssetManager {
    private static assets: Map<string, HTMLImageElement> = new Map();
    private static patterns: Map<string, CanvasPattern> = new Map();
    private static isLoaded = false;

    private static readonly IMAGE_FILES: Record<string, string> = {
        // Terrestrial Biomes
        "biome_1": "Hot_desert_sand_dunes_map_202608192206.jpeg",
        "biome_2": "Cold_desert_map_tile_icon_202608192206.jpeg",
        "biome_3": "Savanna_map_tile_icon_202608192206.jpeg",
        "biome_4": "Grassland_map_tile_icon_202608192206.jpeg",
        "biome_5": "Tropical_seasonal_forest_map_tile_202608192206.jpeg",
        "biome_6": "Deciduous_forest_map_tile_icon_202608192206.jpeg",
        "biome_7": "Tropical_rainforest_map_tile_icon_202608192206.jpeg",
        "biome_8": "Temperate_rainforest_map_tile_icon_202608192206.jpeg",
        "biome_9": "Taiga_map_tile_icon_202608192206.jpeg",
        "biome_10": "Tundra_map_tile_icon_202608192206.jpeg",
        "biome_11": "Glacier_map_tile_icon_202608192206.jpeg",
        "biome_12": "Wetland_map_tile_icon_202608192206.jpeg",

        // Marine Biomes
        "biome_13": "Brine_pools_map_tile_icon_202608192206.jpeg",
        "biome_14": "Still_waters_underwater_map_tile_202608192206.jpeg",
        "biome_15": "Open_seafloor_map_tile_202608192206.jpeg",
        "biome_16": "Seagrass_meadows_map_tile_202608192206.jpeg",
        "biome_17": "Volcanic_vents_map_tile_202608192206.jpeg",
        "biome_18": "Kelp_forests_map_tile_icon_202608192206.jpeg",
        "biome_19": "Tropical_reef_map_tile_icon_202608192206.jpeg",
        "biome_20": "Temperate_reefs_rocky_sea_floor_202608192206.jpeg",
        "biome_21": "Deep_fissure_canyon_map_tile_202608192206.jpeg",
        "biome_22": "Arctic_waters_map_tile_icon_202608192206.jpeg",
        "biome_23": "Underwater_glacier_map_tile_icon_202608192206.jpeg",
        "biome_24": "Tidal_plains_map_tile_icon_202608192206.jpeg",

        // Icons
        "treePine": "Tree_variation_map_icon_202608192206.jpeg",
        "treeDeciduous": "Deciduous_tree_map_icon_202608192206.jpeg",
        "mountain": "Map_icon_of_rocky_hills_202608192206.jpeg",
        "mountainSnow": "Map_icon_of_rocky_hills_202608192206.jpeg",
        "city": "Soldiers_with_spears_and_shields_202608192206.jpeg",
        "caravan": "Merchant_caravan_map_icon_202608192206.jpeg",
        "battle": "Soldiers_with_spears_and_shields_202608192206.jpeg",
        "magic": "Top-down_map_icon_of_vines_202608192206.jpeg",
        "birds": "Birds_flying_in_square_tile_202608192206.jpeg",
        "fish": "Fish_school_map_icon_202608192206.jpeg",
        "grazers": "Grazers_herd_map_icon_variation_202608192206.jpeg",
        "predators": "Predator_icon_map_tile_202608192206.jpeg"
    };

    public static async init() {
        if (this.isLoaded) return;
        
        const loadPromises = Object.entries(this.IMAGE_FILES).map(([key, filename]) => {
            return new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    this.assets.set(key, img);
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load asset: ${filename}`);
                    resolve(); // Resolve anyway so it doesn't break everything
                };
                img.src = `/assets/images/${filename}`;
            });
        });

        await Promise.all(loadPromises);
        this.isLoaded = true;
    }

    public static get(key: string): HTMLImageElement | null {
        return this.assets.get(key) || null;
    }

    public static getPattern(key: string, ctx: CanvasRenderingContext2D): CanvasPattern | null {
        if (this.patterns.has(key)) return this.patterns.get(key)!;
        
        const img = this.get(key);
        if (!img) return null;
        
        const pattern = ctx.createPattern(img, "repeat");
        if (pattern) {
            this.patterns.set(key, pattern);
            return pattern;
        }
        return null;
    }
}

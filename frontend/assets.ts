// Helper functions for static asset URLs
export function getTokenUrl(name: string): string {
    return `/tokens/${name}`;
}
export function getObjectUrl(name: string): string {
    return `/objects/${name}`;
}
export function getTerrianUrl(name: string): string {
    return `/terrian/${name}`;
}

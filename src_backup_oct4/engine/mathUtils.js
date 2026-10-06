"use strict";
/**
 * Pure functions for World Simulation Mathematics
 * Structure of Arrays (SoA) optimization is prioritized for coordinate data arrays over Object-Oriented layouts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSolarDeclination = calculateSolarDeclination;
exports.calculateInsolation = calculateInsolation;
exports.getIcosahedronFaces = getIcosahedronFaces;
function calculateSolarDeclination(axialTilt, dayOfYear, daysPerYear) {
    // δ = -axial_tilt * cos( (2π * (DOY + 10)) / days_per_year )
    const angle = (2 * Math.PI * (dayOfYear + 10)) / daysPerYear;
    return -axialTilt * Math.cos(angle);
}
function calculateInsolation(latitude, declination) {
    // I = sin(φ) * sin(δ) + cos(φ) * cos(δ)
    // Convert inputs to radians if they are in degrees
    const latRad = latitude * (Math.PI / 180);
    const decRad = declination * (Math.PI / 180);
    return Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad);
}
// 20-face Icosahedral d20 global mesh helper functions
function getIcosahedronFaces() {
    // Utilizing SoA approach: flattened array outputs for high-performance iteration
    return [];
}
//# sourceMappingURL=mathUtils.js.map
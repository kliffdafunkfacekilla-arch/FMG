// Simple Menu module for FMG-Rebuild
export function mountSimpleMenu(containerId: string) {
	const container = document.getElementById(containerId);
	if (!container) return;
	const btn = document.createElement("button");
	btn.textContent = "Simple Menu";
	btn.style.cssText =
		"padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 0.5rem;";
	btn.addEventListener("click", () => {
		alert("Simple menu clicked! Replace with real action.");
	});
	container.appendChild(btn);
}

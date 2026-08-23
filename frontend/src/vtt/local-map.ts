export class LocalMap {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    constructor() {
        this.canvas = document.getElementById("playerMapCanvas") as HTMLCanvasElement;
        this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;

        this.resize();
        window.addEventListener("resize", () => this.resize());

        this.render();
    }

    private resize() {
        const parent = this.canvas.parentElement;
        if (parent) {
            this.canvas.width = parent.clientWidth;
            this.canvas.height = parent.clientHeight;
            this.render();
        }
    }

    public render() {
        // Clear canvas
        this.ctx.fillStyle = "#08080a";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw a tactical grid
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        this.ctx.lineWidth = 1;
        
        const gridSize = 50;
        const cols = Math.ceil(this.canvas.width / gridSize);
        const rows = Math.ceil(this.canvas.height / gridSize);

        for (let i = 0; i < cols; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * gridSize, 0);
            this.ctx.lineTo(i * gridSize, this.canvas.height);
            this.ctx.stroke();
        }

        for (let j = 0; j < rows; j++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, j * gridSize);
            this.ctx.lineTo(this.canvas.width, j * gridSize);
            this.ctx.stroke();
        }

        // Draw a dummy player token in the center
        const centerX = (Math.floor(cols / 2) * gridSize) + (gridSize / 2);
        const centerY = (Math.floor(rows / 2) * gridSize) + (gridSize / 2);

        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
        this.ctx.fillStyle = "#3b82f6";
        this.ctx.fill();
        this.ctx.strokeStyle = "#60a5fa";
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw a dummy enemy token
        this.ctx.beginPath();
        this.ctx.arc(centerX + gridSize * 2, centerY - gridSize, 15, 0, Math.PI * 2);
        this.ctx.fillStyle = "#ef4444";
        this.ctx.fill();
        this.ctx.strokeStyle = "#f87171";
        this.ctx.stroke();
    }
}

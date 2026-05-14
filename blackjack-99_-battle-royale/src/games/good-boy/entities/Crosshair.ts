export class Crosshair {
  private x: number = 0;
  private y: number = 0;
  private size: number = 60;

  update(mouseX: number, mouseY: number) {
    this.x = mouseX;
    this.y = mouseY;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 4;
    
    // Circle
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
    ctx.stroke();

    // Cross lines
    ctx.beginPath();
    ctx.moveTo(this.x - this.size / 1.5, this.y);
    ctx.lineTo(this.x + this.size / 1.5, this.y);
    ctx.moveTo(this.x, this.y - this.size / 1.5);
    ctx.lineTo(this.x, this.y + this.size / 1.5);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(this.x - 1, this.y - 1, 2, 2);
  }

  getX() { return this.x; }
  getY() { return this.y; }
}

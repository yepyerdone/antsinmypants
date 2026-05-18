import "./styles.css";
import { Game } from "./Game";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root");
}

const game = new Game(app);
game.start();

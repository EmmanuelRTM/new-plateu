/** Bootstrap: creates the game in the #app container and starts the intro. */
import { Game } from './core/Game.js';

const game = new Game(document.getElementById('app'));
game.start().catch((error) => {
  console.error(error);
  throw error;
});

import { startCfPoller } from "./cfPoller";
import { pollClashSquad } from "./csPoller";
import { pollBattleRoyale } from "./brPoller";

export function startPollerOrchestrator(io: any) {
  // Bingo
  startCfPoller(io);

  // Clash Squad
  setInterval(() => {
    pollClashSquad(io).catch(console.error);
  }, 11000);

  // Battle Royale
  setInterval(() => {
    pollBattleRoyale(io).catch(console.error);
  }, 12000);
}

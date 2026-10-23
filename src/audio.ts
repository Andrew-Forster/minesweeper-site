const sounds = {
  Explode: 'Explode', Defuse: 'Defuse', Win: 'Win', Lose: 'Lose',
  Flag: 'Flag', Click: 'TileClick', Reward: 'Reward', Button: 'MainButton',
} as const;
const players = new Map<keyof typeof sounds, HTMLAudioElement>();

export function playSound(name: keyof typeof sounds) {
  let player = players.get(name);
  if (!player) {
    player = new Audio(`/Assets/Sounds/${sounds[name]}.mp3`);
    player.volume = name === 'Win' || name === 'Lose' ? 0.3 : 0.5;
    players.set(name, player);
  }
  player.currentTime = 0;
  void player.play().catch(() => {});
}

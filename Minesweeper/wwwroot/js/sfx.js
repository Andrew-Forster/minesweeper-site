const sfxManager = {
    Explode: new Audio("/Assets/Sounds/Explode.mp3"),
    Defuse: new Audio("/Assets/Sounds/Defuse.mp3"),
    Win: new Audio("/Assets/Sounds/Win.mp3"),
    Lose: new Audio("/Assets/Sounds/Lose.mp3"),
    Flag: new Audio("/Assets/Sounds/Flag.mp3"),
    Click: new Audio("/Assets/Sounds/TileClick.mp3"),
    Gameplay: new Audio("/Assets/Sounds/Gameplay.mp3"),
    Menu: new Audio("/Assets/Sounds/MainMenu.mp3"),
    Reward: new Audio("/Assets/Sounds/Reward.mp3"),
    Button: new Audio("/Assets/Sounds/MainButton.mp3"),

    play(name) {
        if (this[name]) {
            sfxManager.setVolume("Win", 0.3);
            sfxManager.setVolume("Lose", 0.3);
            sfxManager.setVolume("Explode", 0.5);
            this[name].currentTime = 0;
            this[name].play();
        } else {
            console.warn(`SFX "${name}" not found.`);
        }
    },

    setVolume(name, volume) {
        if (this[name]) {
            this[name].volume = volume;
        }
    },

    stop(name) {
        if (this[name]) {
            this[name].pause();
            this[name].currentTime = 0;
        }
    }
};
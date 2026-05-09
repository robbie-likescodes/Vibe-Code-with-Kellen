# RoboFrog: Rings of Saturn

A retro arcade prototype inspired by Crossy Road. You are a robotic frog leaping across Saturn ring lanes made of meteors, ice chunks, satellites, and junk while blasting hostile drones.

## How to run

1. Open `index.html` directly in any modern browser.
2. Press **Enter** to start.

No install, npm, or build steps are required.

## Controls

- **Enter**: Start / Restart
- **Arrow Keys** or **WASD**: Hop one tile
- **Mouse**: Aim
- **Left Click**: Shoot toward cursor
- **Space**: Shoot straight upward

## Current features

- Immediate rendering on load with:
  - animated parallax starfield
  - large Saturn + ring backdrop
  - visible title overlay
  - visible robotic frog and 20+ lanes
  - moving platforms and visible drones
- Grid-based frog movement with hop animation and camera follow
- Multiple lane types and wrapped moving platforms
- Laser combat with particles and screenshake
- Drone collisions and falling/game-over logic
- Scrap collectibles for bonus score
- Score, best score, and local top-10 scoreboard persistence via `localStorage`
- Defensive startup checks and visible fallback errors if canvas/context fails
- Debug line with state/lane/lane-count/drone-count

## Suggested next improvements

- Add sound effects and music toggle
- Add multiple frog skins and drone variants
- Improve lane generation for long-run difficulty scaling
- Add power-ups (shield, rapid fire, slow time)
- Add mobile touch controls

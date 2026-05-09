# RoboFrog: Rings of Saturn

A retro arcade browser prototype where a robotic frog hops upward across moving space platforms near Saturn's rings.

## Run locally

1. Download or clone this repository.
2. Open `index.html` directly in any modern browser.
3. Click **START MISSION**.

No build tools, packages, or setup required.

## Controls

- **Move/Hop:** `WASD` or Arrow keys
- **Aim:** Mouse
- **Shoot:** Left click
- **Restart:** `Enter` or on-screen button after game over

## Gameplay

- Hop from platform to platform as the camera follows upward progress.
- Falling into empty space ends the run.
- Drone enemies move horizontally; touching one is game over.
- Shoot drones with lasers for bonus points (short cooldown).
- Score increases by reaching new higher lanes and by destroying drones.
- Best score and top 10 scoreboard are saved in localStorage:
  - `robofrog_best_score`
  - `robofrog_scoreboard`

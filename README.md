# Gore Shooter FPS

A fast-paced, gore-filled first-person shooter built with Three.js and deployed on Vercel.

## Features

- **Fast-paced FPS gameplay** with smooth first-person controls
- **Dismemberment system** with realistic body part physics
- **Gore effects** including blood splatters and flying body parts
- **Enemy AI** with pathfinding and aggressive behavior
- **Weapon system** with recoil, muzzle flash, and bullet trails
- **Particle effects** for explosions and blood
- **Procedural audio** using Web Audio API
- **Optimized performance** for 60fps gameplay

## Controls

- **WASD** - Movement
- **Mouse** - Look around
- **Left Click** - Shoot
- **R** - Reload
- **Shift** - Sprint

## Deployment

### Local Development
```bash
npm install
npm run dev
```

### Deploy to Vercel
1. Push to GitHub repository
2. Connect repository to Vercel
3. Deploy automatically with zero configuration

### Manual Deployment
```bash
npm run build
# Upload dist/ folder to Vercel
```

## Technical Details

- **Engine**: Three.js for 3D graphics
- **Physics**: Custom physics for dismemberment
- **Audio**: Web Audio API for procedural sounds
- **Build**: Vite for fast development and optimized builds
- **Deployment**: Vercel-ready configuration

## Game Systems

### Dismemberment System
- Real-time body part separation
- Physics-based flying limbs
- Blood particle effects
- Headshot instant kills

### Enemy AI
- Pathfinding towards player
- Dynamic spawning system
- Health and damage system
- Death animations

### Weapon System
- Realistic recoil mechanics
- Muzzle flash effects
- Bullet trail visualization
- Reload animations

## Performance Optimizations

- Efficient particle pooling
- LOD system for distant objects
- Optimized shadow mapping
- Compressed textures and models

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

Requires WebGL 2.0 support for optimal performance.
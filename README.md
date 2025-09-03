# DoomCrawler - 3D Dungeon Crawler Game

A modern 3D dungeon crawler built with Next.js, Three.js, and Supabase. Features real-time 3D graphics, creature AI, physics-based projectiles, and a comprehensive inventory system.

## Features

- **3D First-Person Gameplay**: Immersive dungeon exploration with mouse look and WASD movement
- **Dynamic Lighting**: Atmospheric torch lighting with shadows and fog effects
- **Creature AI**: Intelligent shadow creatures that hunt the player
- **Physics System**: Realistic projectile physics with collision detection
- **Inventory Management**: Comprehensive backpack and area item systems
- **Database Integration**: Persistent player state and map data via Supabase
- **Responsive UI**: Modern game interface with health/mana orbs and minimap

## Technology Stack

- **Frontend**: Next.js 14 with TypeScript
- **3D Graphics**: Three.js for WebGL rendering
- **Database**: Supabase for real-time data persistence
- **Styling**: Tailwind CSS with custom dungeon theme
- **UI Components**: shadcn/ui component library

## Local Development Setup

### Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account (for database features)

### Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   cd doomcrawler
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install --legacy-peer-deps
   # or if you encounter dependency conflicts:
   npm install --force
   # or with yarn:
   yarn install --ignore-engines
   \`\`\`

   **Note**: This project uses React 19, but some UI dependencies (like `vaul`) may show peer dependency warnings. The `--legacy-peer-deps` flag resolves these compatibility issues.

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   \`\`\`env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   \`\`\`

4. **Database Setup**
   Run the SQL scripts in the `scripts/` directory in your Supabase SQL editor:
   \`\`\`sql
   -- Execute in order:
   scripts/001_create_torch_and_loot_tables.sql
   scripts/002_fix_rls_policies.sql
   scripts/003_fix_session_id_schema.sql
   \`\`\`

5. **Start Development Server**
   \`\`\`bash
   npm run dev
   # or
   yarn dev
   \`\`\`

6. **Open in Browser**
   Navigate to `http://localhost:3000`

### Project Structure

\`\`\`
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main game component
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/
│   ├── three/             # Three.js 3D components
│   │   └── dungeon-scene.tsx
│   ├── dungeon-ui/        # Game UI components
│   │   ├── health-mana-orbs.tsx
│   │   ├── action-bar.tsx
│   │   └── minimap.tsx
│   └── ui/                # Reusable UI components
├── lib/
│   ├── supabase/          # Database client setup
│   └── utils.ts           # Utility functions
├── scripts/               # Database migration scripts
└── public/                # Static assets (textures, images)
\`\`\`

## Game Controls

### Movement
- **WASD** or **Arrow Keys**: Move forward/backward/strafe
- **Mouse**: Look around (first-person camera)
- **Q/E**: Strafe left/right (when mouse not locked)

### Combat
- **Left Click** or **Spacebar**: Shoot crossbow
- **1-5 Keys**: Quick actions (attack, defend, cast, heal, examine)

### Interface
- **Tab**: Open inventory/spellcasting interface
- **Click**: Interact with UI elements when inventory is open

## Configuration

### Game Settings
Key configuration variables in `app/page.tsx`:
\`\`\`typescript
// Inventory loading delay (milliseconds)
const INVENTORY_LOADING_DELAY_MS = 2000
\`\`\`

### Performance Settings
Adjust these in `components/three/dungeon-scene.tsx`:
\`\`\`typescript
// Shadow map resolution (lower = better performance)
light.shadow.mapSize.width = 512
light.shadow.mapSize.height = 512

// Cleanup queue processing rate (items per frame)
const itemsToClean = cleanupQueueRef.current.splice(0, 2)
\`\`\`

## Database Schema

The game uses several Supabase tables:

- **player_states**: Player position, health, and game state
- **game_maps**: Dungeon layout data and spawn points
- **torch_positions**: Map-based torch placement data
- **loot_items**: Item definitions and properties
- **session_dropped_items**: Items dropped in current game session
- **player_inventories**: Player's collected items

## Deployment

### Vercel Deployment (Recommended)

1. **Connect to Vercel**
   - Import your repository to Vercel
   - Configure environment variables in Vercel dashboard

2. **Environment Variables**
   Add the same variables from `.env.local` to your Vercel project settings

3. **Deploy**
   \`\`\`bash
   npm run build
   # Vercel will automatically deploy on git push
   \`\`\`

### Manual Deployment

1. **Build the project**
   \`\`\`bash
   npm run build
   \`\`\`

2. **Start production server**
   \`\`\`bash
   npm start
   \`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Performance Optimization

- **Memory Management**: Automatic cleanup of destroyed creatures and projectiles
- **Shadow Optimization**: Reduced shadow map sizes for better performance
- **Texture Reuse**: Shared materials across similar objects
- **Collision Optimization**: Efficient Box3 collision detection
- **Frame Rate**: Capped cleanup processing to maintain 60fps

## Troubleshooting

### Common Issues

1. **Dependency Resolution Errors**
   - **Error**: `ERESOLVE unable to resolve dependency tree` with `vaul` package
   - **Solution**: Use `npm install --legacy-peer-deps` or `npm install --force`
   - **Cause**: React 19 compatibility issues with some shadcn/ui dependencies
   - **Alternative**: The `package.json` includes overrides to force compatibility

2. **Pointer Lock Errors**
   - Ensure user interaction before requesting pointer lock
   - Check browser security settings

3. **Texture Loading Issues**
   - Verify texture files exist in `/public` directory
   - Check browser console for 404 errors

4. **Database Connection Issues**
   - Verify Supabase environment variables
   - Check RLS policies are properly configured

5. **Performance Issues**
   - Reduce shadow map resolution
   - Lower creature count in `createShadowCreatures()`
   - Disable fog for better performance: `scene.fog = null`

## License

This project is licensed under the MIT License - see the LICENSE file for details.

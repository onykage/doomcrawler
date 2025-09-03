"use client"

import { useRef, useEffect } from "react"
import * as THREE from "three"

/**
 * Props interface for the DungeonScene component
 * @interface DungeonSceneProps
 * @property {function} onPlayerMove - Callback function triggered when player position changes
 * @property {any} mapData - Map data containing wall layout and spawn points from database
 * @property {function} onShoot - Optional callback function triggered when player shoots
 * @property {boolean} inventoryVisible - Flag indicating if inventory UI is currently visible
 * @property {function} onCreatureUpdate - Optional callback function to update creature positions for minimap
 */
interface DungeonSceneProps {
  onPlayerMove: (x: number, y: number, angle: number) => void
  mapData: any
  onShoot?: () => void
  inventoryVisible?: boolean
  onCreatureUpdate?: (creatures: Array<{ x: number; y: number }>) => void // Added creature update callback
}

/**
 * Main 3D dungeon scene component using Three.js
 * Handles player movement, collision detection, creature AI, projectile physics, and environmental rendering
 *
 * @param {DungeonSceneProps} props - Component props
 * @returns {JSX.Element} The rendered 3D scene container
 */
export function DungeonScene({
  onPlayerMove,
  mapData,
  onShoot,
  inventoryVisible,
  onCreatureUpdate,
}: DungeonSceneProps) {
  // Core Three.js references for scene management
  const mountRef = useRef<HTMLDivElement>(null) // DOM mount point for Three.js canvas
  const sceneRef = useRef<THREE.Scene>() // Main Three.js scene container
  const rendererRef = useRef<THREE.WebGLRenderer>() // WebGL renderer for 3D graphics
  const cameraRef = useRef<THREE.PerspectiveCamera>() // First-person camera

  // Player state and input management
  const playerRef = useRef({ x: 0, y: 0, angle: 0 }) // Player position and rotation
  const keysRef = useRef<Set<string>>(new Set()) // Currently pressed keys for movement
  const mouseRef = useRef({ x: 0, y: 0, sensitivity: 0.002, isLocked: false }) // Mouse look controls

  // Game world collision and physics systems
  const wallsRef = useRef<THREE.Box3[]>([]) // Collision boxes for walls
  const projectilesRef = useRef<Array<{ mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }>>([]) // Active projectiles

  // Creature AI and management system
  const creaturesRef = useRef<
    Array<{
      body: THREE.Mesh // Main creature body mesh
      leftEye: THREE.Mesh // Left glowing eye
      rightEye: THREE.Mesh // Right glowing eye
      light: THREE.PointLight // Creature's ambient light
      targetX: number // AI target X position
      targetZ: number // AI target Z position
      collisionBox: THREE.Box3 // Creature collision boundaries
    }>
  >([])

  // Performance and memory management
  const mapDataRef = useRef<any>(null) // Cached map data reference
  const bobRef = useRef({ time: 0, isMoving: false, baseY: 1.6 }) // Head bobbing animation state
  const cleanupQueueRef = useRef<
    Array<{ body: THREE.Mesh; leftEye: THREE.Mesh; rightEye: THREE.Mesh; light: THREE.PointLight }>
  >([]) // Queue for disposing of destroyed creatures to prevent memory leaks

  const gameLoadedRef = useRef(false) // Flag to track if game has finished initial loading

  /**
   * Shoots a crossbow bolt projectile from the player's current position and direction
   * Creates a glowing yellow bolt with physics simulation and collision detection
   */
  const shoot = () => {
    if (!sceneRef.current || !cameraRef.current) return

    // Create bolt geometry and materials
    const boltGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8)
    const boltMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00, // Bright yellow color
      transparent: true,
      opacity: 0.9,
    })
    const bolt = new THREE.Mesh(boltGeometry, boltMaterial)

    // Add glowing effect around the bolt
    const glowGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.3, // Semi-transparent glow
    })
    const glow = new THREE.Mesh(glowGeometry, glowMaterial)
    bolt.add(glow)

    // Position bolt at camera location (slightly below for realism)
    bolt.position.copy(cameraRef.current.position)
    bolt.position.y -= 0.2

    // Calculate shooting direction based on camera orientation
    const direction = new THREE.Vector3(0, 0, -1)
    direction.applyQuaternion(cameraRef.current.quaternion)

    // Orient bolt to face shooting direction
    bolt.lookAt(bolt.position.clone().add(direction))
    bolt.rotateX(Math.PI / 2) // Rotate to align with direction

    sceneRef.current.add(bolt)

    // Add to projectiles array for physics simulation
    projectilesRef.current.push({
      mesh: bolt,
      velocity: direction.multiplyScalar(0.8), // Projectile speed
      life: 100, // Frames until projectile expires
    })

    console.log("[v0] Crossbow bolt fired!")
  }

  /**
   * Processes the cleanup queue to dispose of destroyed creature resources
   * Prevents memory leaks by properly disposing of geometries and materials
   * Processes maximum 2 items per frame to maintain performance
   */
  const processCleanupQueue = () => {
    if (cleanupQueueRef.current.length === 0) return

    const itemsToClean = cleanupQueueRef.current.splice(0, 2) // Process max 2 items per frame

    itemsToClean.forEach((item) => {
      // Dispose of geometries and materials to free GPU memory
      item.body.geometry.dispose()
      if (Array.isArray(item.body.material)) {
        item.body.material.forEach((mat) => mat.dispose())
      } else {
        item.body.material.dispose()
      }

      item.leftEye.geometry.dispose()
      if (Array.isArray(item.leftEye.material)) {
        item.leftEye.material.forEach((mat) => mat.dispose())
      } else {
        item.leftEye.material.dispose()
      }

      item.rightEye.geometry.dispose()
      if (Array.isArray(item.rightEye.material)) {
        item.rightEye.material.forEach((mat) => mat.dispose())
      } else {
        item.rightEye.material.dispose()
      }
    })
  }

  /**
   * Updates all active projectiles in the scene
   * Handles physics simulation, collision detection with walls and creatures
   * Removes projectiles that hit targets or expire naturally
   */
  const updateProjectiles = () => {
    if (!sceneRef.current) return

    projectilesRef.current = projectilesRef.current.filter((projectile) => {
      // Update projectile position based on velocity
      projectile.mesh.position.add(projectile.velocity)
      projectile.life-- // Decrease remaining lifetime

      // Create collision box for projectile
      const projectileBox = new THREE.Box3().setFromObject(projectile.mesh)
      let hitWall = false
      let hitCreature = false

      // Check collision with walls
      for (const wallBox of wallsRef.current) {
        if (projectileBox.intersectsBox(wallBox)) {
          hitWall = true
          break
        }
      }

      // Check collision with creatures (iterate backwards to safely remove)
      for (let i = creaturesRef.current.length - 1; i >= 0; i--) {
        const creature = creaturesRef.current[i]
        if (projectileBox.intersectsBox(creature.collisionBox)) {
          hitCreature = true

          // Remove creature from scene immediately
          sceneRef.current!.remove(creature.body)
          sceneRef.current!.remove(creature.leftEye)
          sceneRef.current!.remove(creature.rightEye)
          sceneRef.current!.remove(creature.light)

          // Add to cleanup queue for proper resource disposal
          cleanupQueueRef.current.push({
            body: creature.body,
            leftEye: creature.leftEye,
            rightEye: creature.rightEye,
            light: creature.light,
          })

          // Remove from creatures array
          creaturesRef.current.splice(i, 1)

          console.log("[v0] Creature hit and destroyed! Remaining creatures:", creaturesRef.current.length)
          break
        }
      }

      // Remove projectile if it hit something or expired
      if (hitWall || hitCreature || projectile.life <= 0) {
        sceneRef.current!.remove(projectile.mesh)
        // Dispose of projectile resources
        projectile.mesh.geometry.dispose()
        if (Array.isArray(projectile.mesh.material)) {
          projectile.mesh.material.forEach((mat) => mat.dispose())
        } else {
          projectile.mesh.material.dispose()
        }
        return false // Remove from array
      }

      return true // Keep in array
    })
  }

  /**
   * Main useEffect hook for initializing the Three.js scene
   * Sets up renderer, camera, lighting, environment, and event listeners
   * Only recreates scene when mapData changes to prevent unnecessary resets
   */
  useEffect(() => {
    if (!mountRef.current) return

    if (!mapData) {
      console.log("[v0] Waiting for mapData to load before initializing scene")
      return
    }

    // Initialize Three.js scene with atmospheric fog
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x1a1a1a, 1, 50) // Dark fog for dungeon atmosphere
    sceneRef.current = scene

    // Setup first-person perspective camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 1.6, 0) // Eye level height
    cameraRef.current = camera

    // Initialize WebGL renderer with shadows and antialiasing
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x0a0a0a) // Very dark background
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap // Soft shadows for better visuals
    rendererRef.current = renderer

    mountRef.current.appendChild(renderer.domElement)

    // Create the dungeon environment (walls, floor, ceiling)
    createDungeonEnvironment(scene)

    // Add ambient lighting for basic visibility
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3) // Dim ambient light
    scene.add(ambientLight)

    // Create torch lighting and creatures
    createTorchLights(scene)

    // Expose shoot function globally for external access
    ;(window as any).dungeonShoot = shoot

    /**
     * Main animation loop - runs every frame
     * Handles movement, projectiles, creatures, cleanup, and rendering
     */
    const animate = () => {
      requestAnimationFrame(animate)

      handleMovement() // Process player input and movement
      updateProjectiles() // Update projectile physics and collisions
      updateCreatures() // Update creature AI and animations
      processCleanupQueue() // Clean up destroyed objects

      renderer.render(scene, camera) // Render the frame
    }
    animate()

    // Event handlers for player input
    const handleKeyDown = (event: KeyboardEvent) => {
      keysRef.current.add(event.code)
      if (event.code === "Space") {
        event.preventDefault()
        shoot() // Spacebar shoots
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.code)
    }

    /**
     * Handles mouse movement for first-person camera control
     * Only active when pointer is locked (mouse captured)
     */
    const handleMouseMove = (event: MouseEvent) => {
      if (!mouseRef.current.isLocked) return

      const movementX = event.movementX || 0
      const movementY = event.movementY || 0

      // Horizontal mouse movement rotates player left/right
      playerRef.current.angle -= movementX * mouseRef.current.sensitivity

      // Vertical mouse movement tilts camera up/down (with limits)
      mouseRef.current.y -= movementY * mouseRef.current.sensitivity
      mouseRef.current.y = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, mouseRef.current.y)) // Limit vertical look

      // Apply rotation to camera
      if (cameraRef.current) {
        cameraRef.current.rotation.order = "YXZ" // Proper rotation order for FPS camera
        cameraRef.current.rotation.y = playerRef.current.angle
        cameraRef.current.rotation.x = mouseRef.current.y
        cameraRef.current.rotation.z = 0
      }
    }

    /**
     * Handles mouse clicks for shooting and pointer lock requests
     */
    const handleClick = () => {
      if (rendererRef.current?.domElement) {
        if (mouseRef.current.isLocked) {
          shoot() // Shoot if mouse is already locked
        } else {
          // Request pointer lock only if inventory is not visible
          if (!inventoryVisible) {
            rendererRef.current.domElement.requestPointerLock()
          }
        }
      }
    }

    /**
     * Tracks pointer lock state changes
     */
    const handlePointerLockChange = () => {
      mouseRef.current.isLocked = document.pointerLockElement === rendererRef.current?.domElement
    }

    /**
     * Handles window resize events to maintain proper aspect ratio
     */
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return
      cameraRef.current.aspect = window.innerWidth / window.innerHeight
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(window.innerWidth, window.innerHeight)
    }

    // Register all event listeners
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("resize", handleResize)
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("pointerlockchange", handlePointerLockChange)
    rendererRef.current?.domElement.addEventListener("click", handleClick)

    // Cleanup function to remove event listeners and dispose resources
    return () => {
      delete (window as any).dungeonShoot
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("resize", handleResize)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("pointerlockchange", handlePointerLockChange)
      rendererRef.current?.domElement.removeEventListener("click", handleClick)
      if (mountRef.current && rendererRef.current?.domElement) {
        mountRef.current.removeChild(rendererRef.current.domElement)
      }
      rendererRef.current?.dispose()
    }
  }, [mapData]) // Only recreate when mapData changes

  /**
   * Effect to handle inventory visibility and pointer lock
   * Releases mouse when inventory opens
   */
  useEffect(() => {
    if (inventoryVisible && mouseRef.current.isLocked) {
      document.exitPointerLock()
    }
  }, [inventoryVisible])

  /**
   * Creates the main dungeon environment including floor, ceiling, and walls
   * @param {THREE.Scene} scene - The Three.js scene to add objects to
   */
  const createDungeonEnvironment = (scene: THREE.Scene) => {
    mapDataRef.current = mapData

    // Create textured stone floor
    const floorGeometry = new THREE.PlaneGeometry(50, 50)
    const floorTexture = new THREE.TextureLoader().load(
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-MfETb85Ey9xzJjh3qkHV7oweXyEJjc.png",
    )
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping
    floorTexture.repeat.set(15, 15) // Tile the texture for realistic stone pattern
    const floorMaterial = new THREE.MeshLambertMaterial({ map: floorTexture })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2 // Rotate to be horizontal
    floor.receiveShadow = true // Allow shadows to be cast on floor
    scene.add(floor)

    // Create matching stone ceiling
    const ceilingGeometry = new THREE.PlaneGeometry(50, 50)
    const ceilingTexture = new THREE.TextureLoader().load("/stone-floor-texture.png")
    ceilingTexture.wrapS = ceilingTexture.wrapT = THREE.RepeatWrapping
    ceilingTexture.repeat.set(15, 15)
    const ceilingMaterial = new THREE.MeshLambertMaterial({
      map: ceilingTexture,
      color: 0x888888, // Darker tint for ceiling
    })
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial)
    ceiling.rotation.x = Math.PI / 2 // Rotate to face downward
    ceiling.position.y = 2.4 // Standard dungeon ceiling height
    scene.add(ceiling)

    // Generate walls from map data and return collision boxes
    const wallCollisions = createWalls(scene)
    wallsRef.current = wallCollisions

    // Add decorative doors
    createDoors(scene)
  }

  /**
   * Creates walls based on map data or default layout
   * Handles player spawn point positioning with proper orientation
   * @param {THREE.Scene} scene - The Three.js scene to add walls to
   * @returns {THREE.Box3[]} Array of collision boxes for wall collision detection
   */
  const createWalls = (scene: THREE.Scene) => {
    const wallHeight = 2.4 // Standard dungeon wall height
    const wallThickness = 0.5 // Wall thickness for collision
    const collisionBoxes: THREE.Box3[] = []

    // Load and configure wall texture
    const wallTexture = new THREE.TextureLoader().load("/medieval-stone-wall.png")
    wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping
    wallTexture.repeat.set(3, 2) // Texture tiling for realistic stone appearance

    const wallMaterial = new THREE.MeshLambertMaterial({ map: wallTexture })

    console.log("[v0] createWalls called with mapData:", mapData)
    console.log("[v0] mapData exists:", !!mapData)
    console.log("[v0] mapData.walls exists:", !!(mapData && mapData.walls))

    if (!mapData || !mapData.walls) {
      console.log("[v0] No valid mapData available, skipping wall creation")
      return collisionBoxes
    }

    const walls = mapData.walls
    const cellSize = 2 // Each grid cell represents 2x2 world units

    console.log("[v0] Creating walls from map data, grid size:", walls.length, "x", walls[0]?.length)

    // Remove existing walls to prevent duplicates
    const existingWalls = scene.children.filter(
      (child) =>
        child instanceof THREE.Mesh &&
        child.geometry instanceof THREE.BoxGeometry &&
        child.position.y === wallHeight / 2,
    )
    existingWalls.forEach((wall) => scene.remove(wall))

    // Find first open space for player spawn point
    let spawnFound = false
    for (let row = 0; row < walls.length && !spawnFound; row++) {
      for (let col = 0; col < walls[row].length && !spawnFound; col++) {
        if (walls[row][col] === 0) {
          // 0 = open space, 1 = wall
          const spawnX = (col - walls[0].length / 2) * cellSize
          const spawnZ = (row - walls.length / 2) * cellSize

          // Set player spawn position and orientation
          playerRef.current.x = spawnX
          playerRef.current.y = spawnZ
          playerRef.current.angle = Math.PI // Face 180 degrees (down corridor, not wall)

          // Update camera to match spawn position
          if (cameraRef.current) {
            cameraRef.current.position.x = spawnX
            cameraRef.current.position.z = spawnZ
            cameraRef.current.rotation.y = playerRef.current.angle
          }
          console.log("[v0] Spawn point set to:", spawnX, spawnZ, "facing angle:", playerRef.current.angle)
          spawnFound = true
        }
      }
    }

    // Generate walls from map data grid
    let wallCount = 0
    for (let row = 0; row < walls.length; row++) {
      for (let col = 0; col < walls[row].length; col++) {
        if (walls[row][col] === 1) {
          // 1 indicates wall in map data
          const x = (col - walls[0].length / 2) * cellSize
          const z = (row - walls.length / 2) * cellSize

          // Create wall geometry and mesh
          const geometry = new THREE.BoxGeometry(cellSize, wallHeight, cellSize)
          const mesh = new THREE.Mesh(geometry, wallMaterial)
          mesh.position.set(x, wallHeight / 2, z)
          mesh.castShadow = true // Walls cast shadows
          mesh.receiveShadow = true // Walls receive shadows
          scene.add(mesh)

          // Create collision box for this wall
          const box = new THREE.Box3().setFromObject(mesh)
          collisionBoxes.push(box)
          wallCount++
        }
      }
    }
    console.log("[v0] Created", wallCount, "walls from map data")

    return collisionBoxes
  }

  const createDoors = (scene: THREE.Scene) => {
    const doorGeometry = new THREE.BoxGeometry(2, 3, 0.3)
    const doorMaterial = new THREE.MeshLambertMaterial({ color: 0x4a2c2a })

    const door = new THREE.Mesh(doorGeometry, doorMaterial)
    door.position.set(8, 1.5, 0)
    scene.add(door)
  }

  const createTorchLights = (scene: THREE.Scene) => {
    const sharedHolderMaterial = new THREE.MeshLambertMaterial({ color: 0x4a4a4a })
    const sharedHandleMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 })
    const sharedFlameMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
    })

    if (!mapDataRef.current?.walls) {
      // Fallback to default positions if no map data
      const torchPositions = [
        { x: -10, z: -10 },
        { x: 10, z: -10 },
        { x: -10, z: 10 },
        { x: 10, z: 10 },
        { x: 0, z: 0 },
      ]

      torchPositions.forEach((pos) => {
        createTorchAtPosition(scene, pos.x, pos.z, sharedHolderMaterial, sharedHandleMaterial, sharedFlameMaterial)
      })
      return
    }

    const walls = mapDataRef.current.walls
    const cellSize = 2
    const torchPositions: { x: number; z: number; direction: string }[] = []

    for (let row = 1; row < walls.length - 1; row++) {
      for (let col = 1; col < walls[row].length - 1; col++) {
        if (walls[row][col] === 1) {
          // Check each direction for adjacent open space
          const directions = [
            { check: walls[row - 1][col] === 0, name: "north", offsetX: 0, offsetZ: -cellSize * 0.4 },
            { check: walls[row + 1][col] === 0, name: "south", offsetX: 0, offsetZ: cellSize * 0.4 },
            { check: walls[row][col - 1] === 0, name: "west", offsetX: -cellSize * 0.4, offsetZ: 0 },
            { check: walls[row][col + 1] === 0, name: "east", offsetX: cellSize * 0.4, offsetZ: 0 },
          ]

          const openDirection = directions.find((dir) => dir.check)
          if (openDirection) {
            const baseX = (col - walls[0].length / 2) * cellSize
            const baseZ = (row - walls.length / 2) * cellSize

            // Position torch on the wall surface facing the open space
            const torchX = baseX + openDirection.offsetX
            const torchZ = baseZ + openDirection.offsetZ

            torchPositions.push({ x: torchX, z: torchZ, direction: openDirection.name })
          }
        }
      }
    }

    const maxTorches = 8
    const selectedPositions = torchPositions
      .filter((_, index) => index % Math.max(1, Math.floor(torchPositions.length / maxTorches)) === 0)
      .slice(0, maxTorches)

    selectedPositions.forEach((pos) => {
      createTorchAtPosition(scene, pos.x, pos.z, sharedHolderMaterial, sharedHandleMaterial, sharedFlameMaterial)
    })

    createShadowCreatures(scene)
  }

  const createTorchAtPosition = (
    scene: THREE.Scene,
    x: number,
    z: number,
    holderMaterial: THREE.Material,
    handleMaterial: THREE.Material,
    flameMaterial: THREE.Material,
  ) => {
    // Create torch holder (wall sconce)
    const holderGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.3, 8)
    const holder = new THREE.Mesh(holderGeometry, holderMaterial)
    holder.position.set(x, 1.8, z) // Head height
    scene.add(holder)

    // Create torch handle
    const handleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8)
    const handle = new THREE.Mesh(handleGeometry, handleMaterial)
    handle.position.set(x, 1.5, z)
    scene.add(handle)

    // Point light at head height
    const light = new THREE.PointLight(0xff6600, 1, 15)
    light.position.set(x, 1.8, z) // Same as holder
    light.castShadow = true
    light.shadow.mapSize.width = 512 // Reduced shadow map size to save memory
    light.shadow.mapSize.height = 512
    scene.add(light)

    // Flame effect at top of torch
    const flameGeometry = new THREE.SphereGeometry(0.1, 8, 8)
    const flame = new THREE.Mesh(flameGeometry, flameMaterial)
    flame.position.set(x, 2.0, z) // Slightly above holder
    scene.add(flame)
  }

  const createShadowCreatures = (scene: THREE.Scene) => {
    creaturesRef.current.forEach((creature) => {
      scene.remove(creature.body)
      scene.remove(creature.leftEye)
      scene.remove(creature.rightEye)
      scene.remove(creature.light)

      // Add to cleanup queue instead of disposing immediately
      cleanupQueueRef.current.push({
        body: creature.body,
        leftEye: creature.leftEye,
        rightEye: creature.rightEye,
        light: creature.light,
      })
    })
    creaturesRef.current = []

    if (!mapDataRef.current?.walls) return

    const walls = mapDataRef.current.walls
    const cellSize = 2
    const openSpaces: { x: number; z: number }[] = []

    for (let row = 0; row < walls.length; row++) {
      for (let col = 0; col < walls[row].length; col++) {
        if (walls[row][col] === 0) {
          const x = (col - walls[0].length / 2) * cellSize
          const z = (row - walls.length / 2) * cellSize
          openSpaces.push({ x, z })
        }
      }
    }

    const numCreatures = Math.min(5, Math.max(3, Math.floor(openSpaces.length / 10)))
    const shuffledSpaces = openSpaces.sort(() => Math.random() - 0.5)

    for (let i = 0; i < numCreatures; i++) {
      const pos = shuffledSpaces[i]
      if (!pos) continue

      const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8)
      const bodyMaterial = new THREE.MeshLambertMaterial({
        color: 0x1a1a1a,
        transparent: true,
        opacity: 0.8,
      })
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
      body.position.set(pos.x, 0.8, pos.z)
      body.castShadow = true
      scene.add(body)

      const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8)
      const eyeMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.9,
      })

      const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
      leftEye.position.set(pos.x - 0.1, 1.3, pos.z + 0.3)
      scene.add(leftEye)

      const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
      rightEye.position.set(pos.x + 0.1, 1.3, pos.z + 0.3)
      scene.add(rightEye)

      const glowLight = new THREE.PointLight(0x440000, 0.3, 3)
      glowLight.position.set(pos.x, 1, pos.z)
      scene.add(glowLight)

      const collisionBox = new THREE.Box3(
        new THREE.Vector3(pos.x - 0.4, 0, pos.z - 0.4),
        new THREE.Vector3(pos.x + 0.4, 1.6, pos.z + 0.4),
      )

      creaturesRef.current.push({
        body,
        leftEye,
        rightEye,
        light: glowLight,
        targetX: pos.x,
        targetZ: pos.z,
        collisionBox,
      })
    }

    console.log("[v0] Added", creaturesRef.current.length, "shadow creatures to the dungeon")
  }

  const updateCreatures = () => {
    if (!mapDataRef.current?.walls) return

    const walls = mapDataRef.current.walls
    const cellSize = 2
    const playerX = playerRef.current.x
    const playerZ = playerRef.current.y

    creaturesRef.current.forEach((creature, index) => {
      const time = Date.now() * 0.001

      // Floating animation
      creature.body.position.y = 0.8 + Math.sin(time + index) * 0.1
      creature.leftEye.material.opacity = 0.7 + Math.sin(time * 2 + index) * 0.2
      creature.rightEye.material.opacity = 0.7 + Math.sin(time * 2 + index) * 0.2

      // AI behavior - move towards player but avoid walls
      const dx = playerX - creature.body.position.x
      const dz = playerZ - creature.body.position.z
      const distance = Math.sqrt(dx * dx + dz * dz)

      if (distance > 1.5) {
        // Only move if not too close to player
        const moveSpeed = 0.02
        const dirX = dx / distance
        const dirZ = dz / distance

        const newX = creature.body.position.x + dirX * moveSpeed
        const newZ = creature.body.position.z + dirZ * moveSpeed

        const gridX = Math.floor((newX + (walls[0].length * cellSize) / 2) / cellSize)
        const gridZ = Math.floor((newZ + (walls.length * cellSize) / 2) / cellSize)

        // Ensure creatures stay within bounds and don't move into walls
        if (gridX >= 0 && gridX < walls[0].length && gridZ >= 0 && gridZ < walls.length && walls[gridZ][gridX] === 0) {
          const creatureBox = new THREE.Box3(
            new THREE.Vector3(newX - 0.4, 0, newZ - 0.4),
            new THREE.Vector3(newX + 0.4, 1.6, newZ + 0.4),
          )

          let canMove = true
          for (const wallBox of wallsRef.current) {
            if (creatureBox.intersectsBox(wallBox)) {
              canMove = false
              break
            }
          }

          if (canMove) {
            creature.body.position.x = newX
            creature.body.position.z = newZ
            creature.leftEye.position.x = newX - 0.1
            creature.leftEye.position.z = newZ + 0.3
            creature.rightEye.position.x = newX + 0.1
            creature.rightEye.position.z = newZ + 0.3
            creature.light.position.x = newX
            creature.light.position.z = newZ

            // Update collision box
            creature.collisionBox.setFromCenterAndSize(
              new THREE.Vector3(newX, 0.8, newZ),
              new THREE.Vector3(0.8, 1.6, 0.8),
            )
          }
        }
      }
    })

    if (onCreatureUpdate) {
      const creaturePositions = creaturesRef.current.map((creature) => ({
        x: creature.body.position.x,
        y: creature.body.position.z,
      }))
      onCreatureUpdate(creaturePositions)
    }
  }

  const checkCollision = (newX: number, newZ: number) => {
    const playerBox = new THREE.Box3(
      new THREE.Vector3(newX - 0.3, 0, newZ - 0.3),
      new THREE.Vector3(newX + 0.3, 2, newZ + 0.3),
    )

    for (const wallBox of wallsRef.current) {
      if (playerBox.intersectsBox(wallBox)) {
        return true
      }
    }

    // Check creature collisions
    for (const creature of creaturesRef.current) {
      if (playerBox.intersectsBox(creature.collisionBox)) {
        return true
      }
    }

    return false
  }

  const handleMovement = () => {
    if (!cameraRef.current) return

    const baseSpeed = 0.04
    const sprintMultiplier = 2.0 // Double speed when shift is held
    const isShiftHeld = keysRef.current.has("ShiftLeft") || keysRef.current.has("ShiftRight")
    const moveSpeed = baseSpeed * (isShiftHeld ? sprintMultiplier : 1)

    const rotateSpeed = 0.05

    const camera = cameraRef.current
    const player = playerRef.current

    let isMoving = false

    if (!mouseRef.current.isLocked) {
      if (keysRef.current.has("ArrowLeft") || keysRef.current.has("KeyA")) {
        player.angle -= rotateSpeed
        camera.rotation.y = player.angle
      }
      if (keysRef.current.has("ArrowRight") || keysRef.current.has("KeyD")) {
        player.angle += rotateSpeed
        camera.rotation.y = player.angle
      }
    }

    if (keysRef.current.has("ArrowUp") || keysRef.current.has("KeyW")) {
      const newX = player.x - Math.sin(player.angle) * moveSpeed
      const newZ = player.y - Math.cos(player.angle) * moveSpeed

      if (!checkCollision(newX, newZ)) {
        player.x = newX
        player.y = newZ
        camera.position.x = player.x
        camera.position.z = player.y
        isMoving = true
      }
    }
    if (keysRef.current.has("ArrowDown") || keysRef.current.has("KeyS")) {
      const newX = player.x + Math.sin(player.angle) * moveSpeed
      const newZ = player.y + Math.cos(player.angle) * moveSpeed

      if (!checkCollision(newX, newZ)) {
        player.x = newX
        player.y = newZ
        camera.position.x = player.x
        camera.position.z = player.y
        isMoving = true
      }
    }

    if (keysRef.current.has("KeyA") && mouseRef.current.isLocked) {
      const newX = player.x - Math.cos(player.angle) * moveSpeed
      const newZ = player.y + Math.sin(player.angle) * moveSpeed

      if (!checkCollision(newX, newZ)) {
        player.x = newX
        player.y = newZ
        camera.position.x = player.x
        camera.position.z = player.y
        isMoving = true
      }
    }
    if (keysRef.current.has("KeyD") && mouseRef.current.isLocked) {
      const newX = player.x + Math.cos(player.angle) * moveSpeed
      const newZ = player.y - Math.sin(player.angle) * moveSpeed

      if (!checkCollision(newX, newZ)) {
        player.x = newX
        player.y = newZ
        camera.position.x = player.x
        camera.position.z = player.y
        isMoving = true
      }
    }

    if (keysRef.current.has("KeyQ") && !mouseRef.current.isLocked) {
      const newX = player.x - Math.cos(player.angle) * moveSpeed
      const newZ = player.y + Math.sin(player.angle) * moveSpeed

      if (!checkCollision(newX, newZ)) {
        player.x = newX
        player.y = newZ
        camera.position.x = player.x
        camera.position.z = player.y
        isMoving = true
      }
    }
    if (keysRef.current.has("KeyE") && !mouseRef.current.isLocked) {
      const newX = player.x + Math.cos(player.angle) * moveSpeed
      const newZ = player.y - Math.sin(player.angle) * moveSpeed

      if (!checkCollision(newX, newZ)) {
        player.x = newX
        player.y = newZ
        camera.position.x = player.x
        camera.position.z = player.y
        isMoving = true
      }
    }

    bobRef.current.isMoving = isMoving

    if (isMoving) {
      const bobSpeedMultiplier = isShiftHeld ? 1.5 : 1 // Faster bobbing when sprinting
      bobRef.current.time += 0.15 * bobSpeedMultiplier
      const bobAmount = Math.sin(bobRef.current.time) * 0.05
      camera.position.y = bobRef.current.baseY + bobAmount
    } else {
      // Gradually return to base height when not moving
      const currentBob = camera.position.y - bobRef.current.baseY
      camera.position.y = bobRef.current.baseY + currentBob * 0.9
      bobRef.current.time = 0
    }

    onPlayerMove(player.x, player.y, player.angle)
  }

  return <div ref={mountRef} className="w-full h-full" />
}

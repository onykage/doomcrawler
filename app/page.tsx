"use client"

import type React from "react"
import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Minimap } from "@/components/dungeon-ui/minimap"
import { Crosshair } from "@/components/ui/crosshair"
import { ActionBar } from "@/components/dungeon-ui/action-bar" // Fixed import path to point to correct ActionBar location
import { createClient } from "@/lib/supabase/client"

/**
 * Configuration for inventory loading behavior
 * INVENTORY_LOADING_DELAY_MS: Time in milliseconds to show loading screen when opening inventory
 * This creates a more immersive experience and allows for proper mouse control transitions
 */
const INVENTORY_LOADING_DELAY_MS = 2000

// Dynamically import Three.js component to avoid SSR issues
const DungeonScene = dynamic(
  () => import("@/components/three/dungeon-scene").then((mod) => ({ default: mod.DungeonScene })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading Dungeon...</div>
      </div>
    ),
  },
)

export default function DungeonCrawler() {
  const [playerState, setPlayerState] = useState({
    x: 0,
    y: 0,
    angle: 0,
    health: 100,
    maxHealth: 100,
    mana: 50,
    maxMana: 100,
    level: 1,
    experience: 0,
  })

  const [gameMessage, setGameMessage] = useState("Welcome to the Dungeon!")
  const [showWelcome, setShowWelcome] = useState(true) // Start with welcome screen
  const [showInventory, setShowInventory] = useState(false) // Separate inventory state
  const [showConsole, setShowConsole] = useState(false) // Console state within inventory
  const [consoleMessages, setConsoleMessages] = useState([
    "Console initialized...",
    "Welcome to DoomCrawler!",
    "Type 'help' for available commands.",
  ])
  const [consoleInput, setConsoleInput] = useState("")
  const [isLoadingInventory, setIsLoadingInventory] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [mapData, setMapData] = useState(null)
  const [activeInventoryTab, setActiveInventoryTab] = useState("backpack")
  const [creaturePositions, setCreaturePositions] = useState<Array<{ x: number; y: number }>>([])
  const supabase = createClient()

  useEffect(() => {
    // Load player state from Supabase if authenticated
    loadPlayerState()
    loadMapData()
  }, [])

  const loadPlayerState = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: playerData } = await supabase.from("player_states").select("*").eq("player_id", user.id).single()

        if (playerData) {
          setPlayerState((prev) => ({
            ...prev,
            x: playerData.position_x || 0,
            y: playerData.position_y || 0,
            angle: playerData.angle || 0,
            health: playerData.health || 100,
          }))
        }
      }
    } catch (error) {
      console.log("[v0] Player state not found, using defaults")
    }
  }

  const savePlayerState = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        await supabase.from("player_states").upsert({
          player_id: user.id,
          position_x: playerState.x,
          position_y: playerState.y,
          angle: playerState.angle,
          health: playerState.health,
          is_alive: playerState.health > 0,
          last_updated: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.log("[v0] Could not save player state:", error)
    }
  }

  const handlePlayerMove = (x: number, y: number, angle: number) => {
    setPlayerState((prev) => ({ ...prev, x, y, angle }))
  }

  const handleShoot = () => {
    if ((window as any).dungeonShoot) {
      ;(window as any).dungeonShoot()
    }
    setGameMessage("Crossbow bolt fired!")
    setTimeout(() => setGameMessage(""), 2000)
  }

  const handleAction = (action: string) => {
    switch (action) {
      case "shoot":
        handleShoot()
        break
      case "attack":
        setGameMessage("You swing your weapon!")
        break
      case "defend":
        setGameMessage("You raise your shield!")
        break
      case "cast":
        if (playerState.mana >= 10) {
          setPlayerState((prev) => ({ ...prev, mana: prev.mana - 10 }))
          setGameMessage("You cast a spell!")
        } else {
          setGameMessage("Not enough mana!")
        }
        break
      case "heal":
        if (playerState.mana >= 15 && playerState.health < playerState.maxHealth) {
          setPlayerState((prev) => ({
            ...prev,
            health: Math.min(prev.health + 20, prev.maxHealth),
            mana: prev.mana - 15,
          }))
          setGameMessage("You feel refreshed!")
        } else {
          setGameMessage("Cannot heal right now!")
        }
        break
      case "examine":
        setGameMessage("You examine your surroundings carefully...")
        break
    }

    // Clear message after 3 seconds
    setTimeout(() => setGameMessage(""), 3000)
  }

  const loadMapData = async () => {
    try {
      const { data: maps } = await supabase.from("game_maps").select("*").eq("is_public", true).limit(1).single()

      if (maps) {
        setMapData(maps.map_data)
        console.log("[v0] Loaded map data:", maps)
      }
    } catch (error) {
      console.log("[v0] No map data found, using default layout")
    }
  }

  // Auto-save every 10 seconds
  useEffect(() => {
    const interval = setInterval(savePlayerState, 10000)
    return () => clearInterval(interval)
  }, [playerState])

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Tab") {
      event.preventDefault()

      if (!showInventory && !isLoadingInventory && !showWelcome) {
        setIsLoadingInventory(true)
        setLoadingProgress(0)

        const progressInterval = setInterval(() => {
          setLoadingProgress((prev) => {
            const newProgress = prev + 100 / (INVENTORY_LOADING_DELAY_MS / 50)
            if (newProgress >= 100) {
              clearInterval(progressInterval)
              return 100
            }
            return newProgress
          })
        }, 50)

        setTimeout(() => {
          setIsLoadingInventory(false)
          setShowInventory(true)
          setLoadingProgress(0)
        }, INVENTORY_LOADING_DELAY_MS)
      }
    }
  }

  const handleKeyPress = (event: KeyboardEvent) => {
    const key = event.key
    if (key >= "1" && key <= "5") {
      const actions = ["attack", "defend", "cast", "heal", "examine"]
      handleAction(actions[Number.parseInt(key) - 1])
    }
  }

  useEffect(() => {
    window.addEventListener("keypress", handleKeyPress)
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keypress", handleKeyPress)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [showInventory, isLoadingInventory, showWelcome])

  const handleWelcomeAction = (action: string) => {
    if (action === "inventory") {
      setShowWelcome(false)
      setShowInventory(true)
    } else if (action === "game") {
      setShowWelcome(false)
      setTimeout(() => {
        const canvas = document.querySelector("canvas")
        if (canvas) {
          canvas.requestPointerLock()
        }
      }, 100)
    }
  }

  const handleCloseInventory = () => {
    setShowInventory(false)
    setShowConsole(false)
    setTimeout(() => {
      const canvas = document.querySelector("canvas")
      if (canvas) {
        canvas.requestPointerLock()
      }
    }, 100)
  }

  const handleToggleConsole = () => {
    setShowConsole(!showConsole)
  }

  const handleConsoleCommand = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const command = consoleInput.trim()
      if (command) {
        setConsoleMessages((prev) => [...prev, `&gt; ${command}`])

        // Process commands
        switch (command.toLowerCase()) {
          case "help":
            setConsoleMessages((prev) => [...prev, "Available commands: help, clear, status, quit"])
            break
          case "clear":
            setConsoleMessages([])
            break
          case "status":
            setConsoleMessages((prev) => [
              ...prev,
              `Health: ${playerState.health}/${playerState.maxHealth}, Mana: ${playerState.mana}/${playerState.maxMana}`,
            ])
            break
          case "quit":
            setConsoleMessages((prev) => [...prev, "Use the Quit button to exit the game."])
            break
          default:
            setConsoleMessages((prev) => [...prev, `Unknown command: ${command}`])
        }

        setConsoleInput("")
      }
    }
  }

  const handleQuitGame = async () => {
    const confirmQuit = window.confirm("Are you sure you want to quit? Your progress will be saved.")
    if (confirmQuit) {
      try {
        // Save current player state before quitting
        await savePlayerState()
        console.log("[v0] Player state saved before quit")

        // Clear any intervals or timeouts
        // Reset game state
        setShowInventory(false)
        setShowWelcome(true)
        setGameMessage("Game session ended. Thanks for playing!")

        // In a real app, you might redirect to a main menu or close the window
        // For web apps, we'll reset to welcome screen
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } catch (error) {
        console.log("[v0] Error during quit:", error)
        // Still allow quit even if save fails
        window.location.reload()
      }
    }
  }

  const handleCreatureUpdate = (creatures: Array<{ x: number; y: number }>) => {
    setCreaturePositions(creatures)
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-900">
      {/* 3D Scene */}
      <DungeonScene
        onPlayerMove={handlePlayerMove}
        mapData={mapData}
        onShoot={handleShoot}
        inventoryVisible={showWelcome || showInventory}
        onCreatureUpdate={handleCreatureUpdate}
      />
      {/* UI Overlay */}
      <Minimap playerX={playerState.x} playerY={playerState.y} playerAngle={playerState.angle} mapData={mapData} />
      <ActionBar
        onAction={handleAction}
        energy={playerState.mana * 2.5} // Convert mana (0-100) to energy scale (0-250)
        health={playerState.health}
        armor={50} // Default armor value, can be expanded later
        faceSrc="/player-face.png"
      />
      <div className="absolute bottom-[10px] left-1/2 transform -translate-x-1/2 pointer-events-none z-5">
        <Crosshair className="scale-120" />
      </div>
      {isLoadingInventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card/95 text-card-foreground rounded-xl border-2 border-primary shadow-2xl p-8 text-center">
            <h3 className="text-xl font-bold text-primary mb-4">Casting invincibility Spell</h3>
            <div className="w-64 h-2 bg-muted rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-primary transition-all duration-75 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        </div>
      )}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[80vw] h-[80vh] bg-card/95 text-card-foreground rounded-xl border-2 border-primary shadow-2xl p-6 flex flex-col items-center justify-center">
            <h1 className="text-4xl font-bold text-primary mb-4">Welcome to DoomCrawler!</h1>
            <p className="text-lg text-muted-foreground mb-8 text-center max-w-md">
              You are currently protected by a forcefield. When you exit this menu, the forcefield will vanish and you
              will begin to take damage.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => handleWelcomeAction("inventory")}
                className="px-6 py-3 bg-muted hover:bg-muted/80 text-foreground rounded-lg border border-border transition-colors"
              >
                Inventory
              </button>
              <button
                onClick={() => handleWelcomeAction("game")}
                className="px-6 py-3 bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg transition-colors"
              >
                Back to Game
              </button>
            </div>
          </div>
        </div>
      )}
      {showInventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-[80vw] h-[80vh] bg-card/95 text-card-foreground rounded-xl border-2 border-primary shadow-2xl p-6 grid grid-cols-3 grid-rows-2 gap-4 relative pt-16">
            <div className="absolute top-6 right-4 flex items-center gap-2">
              <button
                onClick={handleQuitGame}
                className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-black rounded text-sm font-medium transition-colors"
              >
                Quit
              </button>
              <button
                onClick={handleToggleConsole}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
              >
                {showConsole ? "Inventory" : "Console"}
              </button>
              <button
                onClick={handleCloseInventory}
                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium transition-colors"
              >
                Return to Game
              </button>
            </div>

            {showConsole ? (
              // Console View
              <div className="col-span-3 row-span-2 bg-black rounded-lg border border-primary p-4 flex flex-col">
                <h3 className="text-lg font-bold text-green-400 mb-4">Console</h3>
                <div className="flex-1 overflow-y-auto mb-4 font-mono text-sm">
                  {consoleMessages.map((message, index) => (
                    <div key={index} className="text-green-400 mb-1">
                      {message}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-mono">&gt;</span>
                  <input
                    type="text"
                    value={consoleInput}
                    onChange={(e) => setConsoleInput(e.target.value)}
                    onKeyDown={handleConsoleCommand}
                    className="flex-1 bg-transparent text-green-400 font-mono outline-none border-none"
                    placeholder="Enter command..."
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              // Inventory View
              <>
                {/* Hero Card */}
                <div className="bg-background/80 rounded-lg border border-border p-3 overflow-hidden">
                  <h3 className="text-base font-bold text-primary mb-2">Hero Profile</h3>
                  <div className="flex gap-3">
                    {/* Player Icon Badge */}
                    <div className="relative w-16 h-16 bg-primary/20 rounded-lg border-2 border-primary/40 flex items-center justify-center flex-shrink-0">
                      <div className="text-2xl font-bold text-primary">SG</div>
                      {/* Accolade icons attached to edges */}
                      <div
                        className="absolute -top-1 -left-1 w-3 h-3 bg-yellow-500 rounded-full border border-white"
                        title="First Steps"
                      />
                    </div>
                    <div className="flex-1 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-black">Name:</span>
                        <span className="font-semibold text-black">Sir Gareth</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black">Level:</span>
                        <span className="font-semibold text-black">{playerState.level}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black">Class:</span>
                        <span className="font-semibold text-black">Ranger</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black">Rank:</span>
                        <span className="font-semibold text-black">Dungeon Seeker</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black">XP:</span>
                        <span className="font-semibold text-black">{playerState.experience}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-black">Gold:</span>
                        <span className="font-semibold text-black">247</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hero Garb/Equipment */}
                <div className="bg-background/80 rounded-lg border border-border p-3 overflow-hidden">
                  <h3 className="text-base font-bold text-primary mb-2">Equipment</h3>
                  <div className="grid grid-cols-3 gap-3 h-[calc(100%-2rem)] p-2 justify-items-center">
                    {Array.from({ length: 9 }, (_, i) => (
                      <div
                        key={i}
                        className="w-[60px] h-[60px] bg-muted/50 border border-border rounded-sm flex items-center justify-center text-[15px] text-muted-foreground hover:bg-muted/70 transition-colors"
                      >
                        {i === 0 && "Helm"}
                        {i === 1 && "Neck"}
                        {i === 2 && "Ring"}
                        {i === 3 && "Armor"}
                        {i === 4 && "Weapon"}
                        {i === 5 && "Shield"}
                        {i === 6 && "Gloves"}
                        {i === 7 && "Boots"}
                        {i === 8 && "Cloak"}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Map View */}
                <div className="bg-background/80 rounded-lg border border-border p-3 overflow-hidden">
                  <h3 className="text-base font-bold text-primary mb-2">Dungeon Map</h3>
                  <div className="w-full h-[calc(100%-2rem)] bg-muted/30 rounded border border-border overflow-hidden p-3">
                    {mapData?.walls && (
                      <div
                        className="grid gap-px h-full w-full relative"
                        style={{
                          gridTemplateColumns: `repeat(${mapData.walls[0]?.length || 16}, 1fr)`,
                          gridTemplateRows: `repeat(${mapData.walls.length || 16}, 1fr)`,
                        }}
                      >
                        {mapData.walls.flat().map((cell: number, index: number) => {
                          const row = Math.floor(index / (mapData.walls[0]?.length || 16))
                          const col = index % (mapData.walls[0]?.length || 16)

                          const cellSize = 2
                          const gridCenterX = (mapData.walls[0]?.length || 16) / 2
                          const gridCenterY = (mapData.walls.length || 16) / 2
                          const playerGridX = Math.round(playerState.x / cellSize + gridCenterX)
                          const playerGridY = Math.round(playerState.y / cellSize + gridCenterY)

                          const isPlayerHere = col === playerGridX && row === playerGridY

                          const creaturesHere = creaturePositions.filter((creature) => {
                            const creatureGridX = Math.round(creature.x / cellSize + gridCenterX)
                            const creatureGridY = Math.round(creature.y / cellSize + gridCenterY)
                            return col === creatureGridX && row === creatureGridY
                          })

                          return (
                            <div
                              key={index}
                              className={`relative ${
                                cell === 1 ? "bg-stone-600" : cell === 0 ? "bg-amber-200" : "bg-slate-800"
                              }`}
                              title={cell === 1 ? "Wall" : cell === 0 ? "Floor" : "Void"}
                            >
                              {isPlayerHere && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-2 h-2 bg-white rounded-full border border-black shadow-lg animate-pulse" />
                                </div>
                              )}
                              {creaturesHere.length > 0 && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full border border-white shadow-lg" />
                                  {creaturesHere.length > 1 && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full text-[8px] text-white flex items-center justify-center font-bold">
                                      {creaturesHere.length}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Backpack */}
                <div className="bg-background/80 rounded-lg border border-border p-4 overflow-hidden relative">
                  <div className="absolute bottom-0 left-0 right-0 bg-background/80 z-10 pointer-events-none"></div>
                  <div className="h-full pb-[18px]">
                    <h4 className="text-sm font-semibold text-primary mb-2">Backpack</h4>
                    <div className="h-[calc(100%-0.5rem)] overflow-y-auto pr-2">
                      <div className="grid grid-cols-5 gap-1">
                        {Array.from({ length: 75 }, (_, i) => (
                          <div
                            key={i}
                            className="aspect-square bg-muted/50 border border-border rounded-sm flex items-center justify-center text-[10px] text-muted-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                          >
                            {i === 0 && "Potion"}
                            {i === 1 && "Key"}
                            {i === 5 && "Scroll"}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Area Items */}
                <div className="bg-background/80 rounded-lg border border-border p-4 overflow-hidden relative">
                  <div className="absolute bottom-0 left-0 right-0 bg-background/80 z-10 pointer-events-none"></div>
                  <div className="h-full pb-[18px]">
                    <h4 className="text-sm font-semibold text-primary mb-2">Area Items</h4>
                    <div className="h-[calc(100%-0.5rem)] overflow-y-auto pr-2">
                      <div className="grid grid-cols-5 gap-1">
                        {Array.from({ length: 75 }, (_, i) => (
                          <div
                            key={i}
                            className="aspect-square bg-muted/50 border border-border rounded-sm flex items-center justify-center text-[10px] text-muted-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                          >
                            {i === 0 && "Torch"}
                            {i === 1 && "Stone"}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Spells */}
                <div className="bg-background/80 rounded-lg border border-border p-3 overflow-hidden">
                  <h3 className="text-base font-bold text-primary mb-2">Quick Spells</h3>
                  <div className="grid grid-cols-3 gap-3 h-[calc(100%-2rem)] p-2 justify-items-center">
                    {Array.from({ length: 9 }, (_, i) => (
                      <div
                        key={i}
                        className="w-[60px] h-[60px] bg-muted/50 border border-border rounded-sm flex items-center justify-center text-[15px] text-muted-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                        onClick={() => handleAction("cast")}
                      >
                        {i === 0 && "Heal"}
                        {i === 1 && "Light"}
                        {i === 2 && "Shield"}
                        {i === 4 && "Fire"}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Game Messages */}
      {gameMessage && gameMessage !== "Welcome to the Dungeon!" && (
        <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="bg-card/90 text-card-foreground px-6 py-3 rounded-lg border-2 border-primary shadow-2xl">
            <p className="text-lg font-semibold text-center">{gameMessage}</p>
          </div>
        </div>
      )}
    </div>
  )
}

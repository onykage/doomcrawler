"use client"

import { useMemo } from "react"

interface MinimapProps {
  playerX: number
  playerY: number
  playerAngle: number
  mapData: any
}

export function Minimap({ playerX, playerY, playerAngle, mapData }: MinimapProps) {
  const radarViewport = useMemo(() => {
    if (!mapData?.walls) {
      return { offsetX: 0, offsetY: 0, playerRadarX: 4, playerRadarY: 4 }
    }

    const mapWidth = mapData.walls[0]?.length || 16
    const mapHeight = mapData.walls.length || 16
    const cellSize = 2
    const radarSize = 8

    // Convert player world position to grid coordinates
    const gridCenterX = mapWidth / 2
    const gridCenterY = mapHeight / 2
    const playerGridX = Math.round(playerX / cellSize + gridCenterX)
    const playerGridY = Math.round(playerY / cellSize + gridCenterY)

    // Calculate radar viewport offset
    let offsetX = playerGridX - Math.floor(radarSize / 2)
    let offsetY = playerGridY - Math.floor(radarSize / 2)

    // Clamp to map boundaries
    offsetX = Math.max(0, Math.min(offsetX, mapWidth - radarSize))
    offsetY = Math.max(0, Math.min(offsetY, mapHeight - radarSize))

    // Calculate player position within the 8x8 radar grid
    const playerRadarX = playerGridX - offsetX
    const playerRadarY = playerGridY - offsetY

    return { offsetX, offsetY, playerRadarX, playerRadarY }
  }, [playerX, playerY, mapData])

  const radarGrid = useMemo(() => {
    if (!mapData?.walls) {
      return Array(8)
        .fill(null)
        .map(() => Array(8).fill(0))
    }

    const { offsetX, offsetY } = radarViewport
    const grid = []

    for (let y = 0; y < 8; y++) {
      const row = []
      for (let x = 0; x < 8; x++) {
        const mapX = offsetX + x
        const mapY = offsetY + y

        if (mapY >= 0 && mapY < mapData.walls.length && mapX >= 0 && mapX < mapData.walls[0]?.length) {
          row.push(mapData.walls[mapY][mapX])
        } else {
          row.push(2) // Void/unknown area
        }
      }
      grid.push(row)
    }

    return grid
  }, [mapData, radarViewport])

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="w-32 h-32 bg-blue-900/50 border-2 border-blue-400/50 rounded-lg p-2 opacity-50">
        <div className="w-full h-full bg-blue-800/50 rounded relative overflow-hidden">
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-px">
            {radarGrid.flat().map((cell, index) => (
              <div
                key={index}
                className={`${
                  cell === 1
                    ? "bg-gray-600"
                    : // Wall
                      cell === 0
                      ? "bg-yellow-300/60"
                      : // Floor
                        "bg-gray-900" // Void
                }`}
              />
            ))}
          </div>

          <div className="absolute inset-0 opacity-20">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={`v-${i}`}
                className="absolute border-r border-blue-300"
                style={{ left: `${(i + 1) * 12.5}%`, height: "100%" }}
              />
            ))}
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={`h-${i}`}
                className="absolute border-b border-blue-300"
                style={{ top: `${(i + 1) * 12.5}%`, width: "100%" }}
              />
            ))}
          </div>

          <div
            className="absolute w-1.5 h-1.5 bg-red-500 rounded-full transform -translate-x-1/2 -translate-y-1/2 z-10"
            style={{
              left: `${((radarViewport.playerRadarX + 0.5) / 8) * 100}%`,
              top: `${((radarViewport.playerRadarY + 0.5) / 8) * 100}%`,
            }}
          />
        </div>
      </div>
      <div className="text-center text-xs text-blue-400/50 font-semibold mt-1">Radar</div>
    </div>
  )
}

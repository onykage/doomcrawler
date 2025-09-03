"use client"

import { useEffect, useState } from "react"

interface OrbsProps {
  health: number
  maxHealth: number
  mana: number
  maxMana: number
}

export function HealthManaOrbs({ health, maxHealth, mana, maxMana }: OrbsProps) {
  const [healthPercent, setHealthPercent] = useState(100)
  const [manaPercent, setManaPercent] = useState(100)

  useEffect(() => {
    setHealthPercent((health / maxHealth) * 100)
    setManaPercent((mana / maxMana) * 100)
  }, [health, maxHealth, mana, maxMana])

  return (
    <>
      <div className="fixed bottom-4 left-24 z-50">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-red-900/40 border-2 border-red-600">
            <div
              className="absolute bottom-0 left-0 right-0 bg-red-600 rounded-full transition-all duration-300"
              style={{ height: `${healthPercent}%` }}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold text-sm z-10">{health}</span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 right-24 z-50">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-blue-900/40 border-2 border-blue-600">
            <div
              className="absolute bottom-0 left-0 right-0 bg-blue-600 rounded-full transition-all duration-300"
              style={{ height: `${manaPercent}%` }}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-bold text-sm z-10">{mana}</span>
          </div>
        </div>
      </div>
    </>
  )
}

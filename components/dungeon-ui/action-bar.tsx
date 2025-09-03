"use client"

import { useMemo, useState } from "react"

interface ActionBarProps {
  onAction: (action: string) => void
  energy?: number // 0..250
  health?: number // 0..100
  armor?: number // 0..100
  spells?: string[] // 4 spell icons
  faceSrc?: string
}

export function ActionBar({
  onAction,
  energy = 120,
  health = 72,
  armor = 42,
  spells = ["/forcefield.icon.png", "/heal.icon.png", "/firebreath.icon.png", "/iceblast.icon.png"],
  faceSrc = "/player-face.png",
}: ActionBarProps) {
  const [isShooting, setIsShooting] = useState(false)

  const handleShoot = () => {
    if (isShooting) return
    setIsShooting(true)
    onAction("shoot")
    setTimeout(() => setIsShooting(false), 300)
  }

  // Normalized values (0..1)
  const energy01 = useMemo(() => Math.max(0, Math.min(1, energy / 250)), [energy])
  const health01 = useMemo(() => Math.max(0, Math.min(1, health / 100)), [health])
  const armor01 = useMemo(() => Math.max(0, Math.min(1, armor / 100)), [armor])

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50">
      <div className="relative w-full">
        <div className="w-full flex justify-center relative">
          {/* === HUD === */}
          <ToolbarHUD faceSrc={faceSrc} energy01={energy01} health01={health01} armor01={armor01} spells={spells} />

          {/* === Crossbow === */}
          <div
            className="absolute left-1/2 -translate-x-1/2 cursor-crosshair z-10"
            style={{ bottom: "75px" }}
            onClick={handleShoot}
          >
            <img
              src="/crossbow.png"
              alt="Crossbow"
              className={`pixelated transition-transform duration-150 ${isShooting ? "scale-95" : "scale-100"}`}
              style={{ imageRendering: "pixelated", width: "18rem", height: "auto" }}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        .pixelated {
          image-rendering: pixelated;
          image-rendering: crisp-edges;
        }
      `}</style>
    </div>
  )
}

/* ================= Toolbar HUD ================= */

interface ToolbarHUDProps {
  faceSrc: string
  energy01: number
  health01: number
  armor01: number
  spells: string[]
}

function ToolbarHUD({ faceSrc, energy01, health01, armor01, spells }: ToolbarHUDProps) {
  return (
    <div id="game-toolbar" className="hud relative z-20">
      {/* Energy */}
      <section className="panel">
        <div className="title">ENERGY</div>
        <div className="frame">
          <div className="meter">
            <div className="bar" data-top="green" data-bot="black" style={{ width: `${energy01 * 100}%` }} />
          </div>
        </div>
      </section>

      {/* Health */}
      <section className="panel">
        <div className="title">HEALTH</div>
        <div className="frame">
          <div className="meter">
            <div className="bar" data-top="red" data-bot="black" style={{ width: `${health01 * 100}%` }} />
          </div>
        </div>
      </section>

      {/* Face */}
      <section className="panel face-panel">
        <div className="frame face-frame">
          <img className="face pixelated" src={faceSrc || "/placeholder.svg"} alt="Hero" />
        </div>
      </section>

      {/* Armor */}
      <section className="panel">
        <div className="title">ARMOR</div>
        <div className="frame">
          <div className="meter">
            <div className="bar" data-top="blue" data-bot="black" style={{ width: `${armor01 * 100}%` }} />
          </div>
        </div>
      </section>

      {/* Spells */}
      <section className="panel">
        <div className="title">SPELLS</div>
        <div className="frame spells-frame">
          <div className="spells">
            {spells.map((src, i) => (
              <div key={i} className="spell-slot">
                <img src={src || "/placeholder.svg"} alt={`Spell ${i + 1}`} className="pixelated" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <style jsx>{`
        .hud {
          --hud-h: clamp(64px, 10vh, 112px);
          --gap: 12px;
          --p1: #3b3f43;
          --p2: #2b2f33;
          --p3: #16191c;
          --outline: #0e1012;
          --text: #e2e2e2;

          width: 100%;
          height: var(--hud-h);
          display: grid;
          grid-auto-rows: var(--hud-h);
          grid-template-columns: 2fr 2fr auto 2fr 2fr;
          gap: var(--gap);
          align-items: stretch;
          background: linear-gradient(#1b1e21, #171a1d);
          padding: 8px 14px;
          box-shadow: inset 0 2px 0 var(--outline), inset 0 -2px 0 var(--outline);
        }

        .panel {
          display: grid;
          grid-template-rows: auto 1fr;
          color: var(--text);
          text-transform: uppercase;
          font-family: ui-monospace, Menlo, Consolas, "Liberation Mono", monospace;
          letter-spacing: 0.06em;
          min-width: 0;
        }

        .title {
          font-weight: 900;
          font-size: clamp(10px, 2.1vh, 16px);
          color: #e3e3e3;
          text-shadow: 0 1px 0 #000;
          align-self: end;
          margin: 2px 8px 6px;
        }

        .frame {
          position: relative;
          height: 100%;
          background: var(--p1);
          box-shadow:
            0 0 0 2px #1a1d20 inset,
            0 0 0 6px var(--p2) inset,
            0 0 0 10px #3f4449 inset,
            0 0 0 12px var(--p3) inset;
          border: 2px solid #2a2e32;
        }

        /* Face */
        .face-panel { grid-template-rows: 1fr; width: calc(var(--hud-h) - 8px); }
        .face-frame { display: grid; place-items: center; }
        .face { width: 85%; height: auto; filter: contrast(105%) saturate(105%); }

        /* Progress bars */
        .meter {
          position: relative;
          height: calc(100% - 16px);
          margin: 8px;
          background: linear-gradient(#0e1215, #0a0d10);
          border: 2px solid #0c0f12;
          box-shadow: inset 0 0 0 2px #1c2226, inset 0 8px 16px rgba(0,0,0,.45);
          overflow: hidden;
        }
        .bar {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 0%;
          transition: width .18s linear;
        }
        .bar[data-top="green"] { background: linear-gradient(#2f8a2f, #0b0c0e); }
        .bar[data-top="red"]   { background: linear-gradient(#c63c3c, #0b0c0e); }
        .bar[data-top="blue"]  { background: linear-gradient(#2f5c9e, #0b0c0e); }

        /* Spells */
        .spells-frame {
          display: grid;
          place-items: stretch;   /* stretch to panel */
          padding: 8px;           /* consistent with bars */
        }

        .spells {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          width: 100%;
          height: 100%;
        }

        .spell-slot {
          background: linear-gradient(#1a1e22, #111519);
          border: 2px solid #0c0f12;  /* full 4-sided border */
          box-shadow:
            inset 0 0 0 2px #2a3036,
            inset 0 8px 16px rgba(0, 0, 0, .45);
          display: grid;
          place-items: center;
        }
        .spell-slot img {
          width: 70%;
          height: auto;
        }
      `}</style>
    </div>
  )
}

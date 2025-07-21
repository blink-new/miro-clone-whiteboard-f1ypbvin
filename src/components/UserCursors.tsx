import React from 'react'
import type { UserCursor } from '../types/whiteboard'

interface UserCursorsProps {
  cursors: UserCursor[]
  zoom: number
  pan: { x: number; y: number }
}

export function UserCursors({ cursors, zoom, pan }: UserCursorsProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {cursors.map((cursor) => (
        <div
          key={cursor.userId}
          className="absolute transition-all duration-100 ease-out"
          style={{
            left: (cursor.x - pan.x) * zoom,
            top: (cursor.y - pan.y) * zoom,
            transform: 'translate(-2px, -2px)'
          }}
        >
          {/* Cursor pointer */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            className="drop-shadow-sm"
          >
            <path
              d="M2 2L18 8L8 12L2 18L2 2Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          
          {/* User name label */}
          <div
            className="absolute top-5 left-2 px-2 py-1 rounded text-xs text-white font-medium whitespace-nowrap shadow-lg"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.displayName}
          </div>
        </div>
      ))}
    </div>
  )
}
import React from 'react'
import type { User } from '../types/whiteboard'

interface UserPresenceProps {
  users: User[]
  currentUserId?: string
}

export function UserPresence({ users, currentUserId }: UserPresenceProps) {
  const otherUsers = users.filter(user => user.id !== currentUserId)

  return (
    <div className="absolute top-4 right-4 flex items-center gap-2 bg-white rounded-lg shadow-lg p-2 border">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-sm text-gray-600">
          {users.length} online
        </span>
      </div>
      
      {otherUsers.length > 0 && (
        <>
          <div className="w-px h-4 bg-gray-300"></div>
          <div className="flex -space-x-2">
            {otherUsers.slice(0, 5).map((user, index) => (
              <div
                key={user.id}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium shadow-sm"
                title={user.displayName}
                style={{
                  backgroundColor: `hsl(${(user.id.charCodeAt(0) * 137.5) % 360}, 70%, 60%)`
                }}
              >
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            ))}
            {otherUsers.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-gray-400 border-2 border-white flex items-center justify-center text-white text-xs font-medium">
                +{otherUsers.length - 5}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
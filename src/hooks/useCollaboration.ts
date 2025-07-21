import { useState, useEffect, useCallback } from 'react'
import { blink } from '../blink/client'
import type { WhiteboardElement, User, UserCursor, CollaborationState } from '../types/whiteboard'

const CHANNEL_NAME = 'whiteboard-collaboration'

// User colors for cursors
const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
]

export function useCollaboration(onElementsUpdate?: (elements: WhiteboardElement[]) => void) {
  const [collaboration, setCollaboration] = useState<CollaborationState>({
    users: [],
    cursors: [],
    isConnected: false
  })
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userColor, setUserColor] = useState<string>('')

  // Initialize collaboration
  useEffect(() => {
    let channel: any = null
    let unsubscribeAuth: (() => void) | null = null

    const initCollaboration = async () => {
      try {
        // Listen for auth state changes
        unsubscribeAuth = blink.auth.onAuthStateChanged(async (state) => {
          if (state.user && !state.isLoading) {
            const user: User = {
              id: state.user.id,
              email: state.user.email,
              displayName: state.user.email.split('@')[0] || 'Anonymous'
            }
            setCurrentUser(user)

            // Assign a color based on user ID
            const colorIndex = user.id.charCodeAt(0) % USER_COLORS.length
            setUserColor(USER_COLORS[colorIndex])

            // Join the collaboration channel
            channel = blink.realtime.channel(CHANNEL_NAME)
            await channel.subscribe({
              userId: user.id,
              metadata: { 
                displayName: user.displayName,
                color: USER_COLORS[colorIndex]
              }
            })

            // Listen for presence changes (who's online)
            channel.onPresence((users: any[]) => {
              setCollaboration(prev => ({
                ...prev,
                users: users.map(u => ({
                  id: u.userId,
                  email: u.metadata?.email || '',
                  displayName: u.metadata?.displayName || 'Anonymous'
                })),
                isConnected: true
              }))
            })

            // Listen for cursor movements and element updates
            channel.onMessage((message: any) => {
              if (message.type === 'cursor-move' && message.userId !== user.id) {
                setCollaboration(prev => ({
                  ...prev,
                  cursors: [
                    ...prev.cursors.filter(c => c.userId !== message.userId),
                    {
                      userId: message.userId,
                      x: message.data.x,
                      y: message.data.y,
                      displayName: message.metadata?.displayName || 'Anonymous',
                      color: message.metadata?.color || '#666'
                    }
                  ]
                }))
              } else if (message.type === 'elements-update' && message.userId !== user.id) {
                // Handle incoming element updates from other users
                if (onElementsUpdate) {
                  onElementsUpdate(message.data.elements)
                }
              }
            })

            console.log('✅ Collaboration initialized for user:', user.displayName)
          } else if (!state.isLoading) {
            setCurrentUser(null)
            setCollaboration({
              users: [],
              cursors: [],
              isConnected: false
            })
          }
        })
      } catch (error) {
        console.error('❌ Failed to initialize collaboration:', error)
      }
    }

    initCollaboration()

    return () => {
      if (channel) {
        channel.unsubscribe()
      }
      if (unsubscribeAuth) {
        unsubscribeAuth()
      }
    }
  }, [onElementsUpdate])

  // Broadcast cursor position
  const broadcastCursor = useCallback(async (x: number, y: number) => {
    if (!currentUser) return

    try {
      await blink.realtime.publish(CHANNEL_NAME, 'cursor-move', {
        x,
        y,
        timestamp: Date.now()
      }, {
        userId: currentUser.id,
        metadata: {
          displayName: currentUser.displayName,
          color: userColor
        }
      })
    } catch (error) {
      console.error('Failed to broadcast cursor:', error)
    }
  }, [currentUser, userColor])

  // Broadcast element changes
  const broadcastElementChange = useCallback(async (elements: WhiteboardElement[]) => {
    if (!currentUser) return

    try {
      await blink.realtime.publish(CHANNEL_NAME, 'elements-update', {
        elements,
        timestamp: Date.now()
      }, {
        userId: currentUser.id,
        metadata: {
          displayName: currentUser.displayName
        }
      })
    } catch (error) {
      console.error('Failed to broadcast elements:', error)
    }
  }, [currentUser])

  return {
    collaboration,
    currentUser,
    userColor,
    broadcastCursor,
    broadcastElementChange
  }
}
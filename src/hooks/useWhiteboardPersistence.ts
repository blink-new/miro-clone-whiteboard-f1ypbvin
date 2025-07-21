import { useState, useEffect, useCallback } from 'react'
import { blink } from '../blink/client'
import type { WhiteboardElement } from '../types/whiteboard'

interface WhiteboardSession {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  userId: string
}

export function useWhiteboardPersistence() {
  const [currentSession, setCurrentSession] = useState<WhiteboardSession | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate session ID
  const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Create a new whiteboard session
  const createSession = useCallback(async (name: string = 'Untitled Whiteboard') => {
    setIsLoading(true)
    setError(null)
    
    try {
      const user = await blink.auth.me()
      const sessionId = generateSessionId()
      
      await blink.db.whiteboardSessions.create({
        id: sessionId,
        name,
        userId: user.id
      })
      
      const session: WhiteboardSession = {
        id: sessionId,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: user.id
      }
      
      setCurrentSession(session)
      return session
    } catch (err) {
      setError('Failed to create session')
      console.error('Failed to create session:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Save elements to database
  const saveElements = useCallback(async (elements: WhiteboardElement[]) => {
    if (!currentSession) return
    
    try {
      const user = await blink.auth.me()
      
      // Clear existing elements for this session
      const existingElements = await blink.db.whiteboardElements.list({
        where: { sessionId: currentSession.id }
      })
      
      for (const element of existingElements) {
        await blink.db.whiteboardElements.delete(element.id)
      }
      
      // Save new elements
      if (elements.length > 0) {
        const elementsToSave = elements.map(element => ({
          id: `${currentSession.id}_${element.id}`,
          sessionId: currentSession.id,
          elementData: JSON.stringify(element),
          userId: user.id
        }))
        
        await blink.db.whiteboardElements.createMany(elementsToSave)
      }
      
      // Update session timestamp
      await blink.db.whiteboardSessions.update(currentSession.id, {
        updatedAt: new Date().toISOString()
      })
      
    } catch (err) {
      console.error('Failed to save elements:', err)
      setError('Failed to save whiteboard')
    }
  }, [currentSession])

  // Load elements from database
  const loadElements = useCallback(async (sessionId: string): Promise<WhiteboardElement[]> => {
    setIsLoading(true)
    setError(null)
    
    try {
      const elements = await blink.db.whiteboardElements.list({
        where: { sessionId },
        orderBy: { createdAt: 'asc' }
      })
      
      return elements.map(el => JSON.parse(el.elementData))
    } catch (err) {
      console.error('Failed to load elements:', err)
      setError('Failed to load whiteboard')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load session
  const loadSession = useCallback(async (sessionId: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const sessions = await blink.db.whiteboardSessions.list({
        where: { id: sessionId },
        limit: 1
      })
      const session = sessions[0]
      if (session) {
        setCurrentSession({
          id: session.id,
          name: session.name,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          userId: session.userId
        })
        return session
      }
      return null
    } catch (err) {
      console.error('Failed to load session:', err)
      setError('Failed to load session')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Get user's sessions
  const getUserSessions = useCallback(async (): Promise<WhiteboardSession[]> => {
    try {
      const user = await blink.auth.me()
      const sessions = await blink.db.whiteboardSessions.list({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' }
      })
      
      return sessions.map(session => ({
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        userId: session.userId
      }))
    } catch (err) {
      console.error('Failed to get user sessions:', err)
      return []
    }
  }, [])

  // Auto-create session on mount if none exists
  useEffect(() => {
    if (!currentSession) {
      createSession()
    }
  }, [createSession, currentSession])

  return {
    currentSession,
    isLoading,
    error,
    createSession,
    loadSession,
    saveElements,
    loadElements,
    getUserSessions
  }
}
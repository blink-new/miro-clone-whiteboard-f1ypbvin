import { useState, useCallback, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { UserPresence } from './components/UserPresence';
import { WhiteboardElement, Tool, ViewportState } from './types/whiteboard';
import { useCollaboration } from './hooks/useCollaboration';
import { useWhiteboardPersistence } from './hooks/useWhiteboardPersistence';
import { toast } from 'sonner';

function App() {
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    zoom: 1
  });
  const [history, setHistory] = useState<WhiteboardElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Handle collaborative element updates
  const handleCollaborativeElementsUpdate = useCallback((newElements: WhiteboardElement[]) => {
    setElements(newElements);
    // Don't add to history for collaborative updates to avoid conflicts
  }, []);

  // Persistence features
  const { currentSession, saveElements, loadElements } = useWhiteboardPersistence();

  // Collaboration features
  const { collaboration, currentUser, broadcastCursor, broadcastElementChange } = useCollaboration(handleCollaborativeElementsUpdate);

  // Handle elements change with history
  const handleElementsChange = useCallback((newElements: WhiteboardElement[]) => {
    setElements(newElements);
    
    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    // Auto-save to database (debounced)
    if (currentSession) {
      saveElements(newElements);
    }
  }, [history, historyIndex, currentSession, saveElements]);

  // Undo functionality
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
    }
  }, [history, historyIndex]);

  // Redo functionality
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
    }
  }, [history, historyIndex]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(5, viewport.zoom * 1.2);
    setViewport({ ...viewport, zoom: newZoom });
  }, [viewport]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(0.1, viewport.zoom * 0.8);
    setViewport({ ...viewport, zoom: newZoom });
  }, [viewport]);

  // Load elements when session is ready
  useEffect(() => {
    if (currentSession) {
      loadElements(currentSession.id).then(loadedElements => {
        if (loadedElements.length > 0) {
          setElements(loadedElements);
          setHistory([[], loadedElements]);
          setHistoryIndex(1);
        }
      }).catch(error => {
        console.error('Failed to load elements:', error);
        toast.error('Failed to load whiteboard elements');
      });
    }
  }, [currentSession, loadElements]);

  // Export functionality
  const handleExport = useCallback(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 1920;
    canvas.height = 1080;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all elements
    elements.forEach(element => {
      ctx.strokeStyle = element.color;
      ctx.lineWidth = element.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      switch (element.type) {
        case 'path':
          if (element.points && element.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(element.points[0].x, element.points[0].y);
            for (let i = 1; i < element.points.length; i++) {
              ctx.lineTo(element.points[i].x, element.points[i].y);
            }
            ctx.stroke();
          }
          break;

        case 'rectangle':
          ctx.beginPath();
          ctx.rect(element.x, element.y, element.width || 0, element.height || 0);
          if (element.fill) {
            ctx.fillStyle = element.fill;
            ctx.fill();
          }
          ctx.stroke();
          break;

        case 'circle': {
          const radius = Math.min((element.width || 0) / 2, (element.height || 0) / 2);
          ctx.beginPath();
          ctx.arc(
            element.x + (element.width || 0) / 2,
            element.y + (element.height || 0) / 2,
            radius,
            0,
            2 * Math.PI
          );
          if (element.fill) {
            ctx.fillStyle = element.fill;
            ctx.fill();
          }
          ctx.stroke();
          break;
        }

        case 'line':
          ctx.beginPath();
          ctx.moveTo(element.x, element.y);
          ctx.lineTo(element.x + (element.width || 0), element.y + (element.height || 0));
          ctx.stroke();
          break;

        case 'text':
          ctx.font = `${element.strokeWidth * 4}px Inter, sans-serif`;
          ctx.fillStyle = element.color;
          ctx.fillText(element.text || '', element.x, element.y);
          break;

        case 'sticky-note':
          // Draw sticky note background
          ctx.fillStyle = element.fill || '#fef08a';
          ctx.fillRect(element.x, element.y, element.width || 100, element.height || 100);
          
          // Draw border
          ctx.strokeRect(element.x, element.y, element.width || 100, element.height || 100);
          
          // Draw text
          if (element.text) {
            ctx.font = `${element.strokeWidth * 3}px Inter, sans-serif`;
            ctx.fillStyle = '#374151';
            const lines = element.text.split('\n');
            lines.forEach((line, index) => {
              ctx.fillText(
                line,
                element.x + 8,
                element.y + 20 + (index * element.strokeWidth * 4)
              );
            });
          }
          break;
      }
    });

    // Download the image
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = canvas.toDataURL();
    link.click();
  }, [elements]);

  return (
    <div className="w-full h-full bg-background relative">
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        strokeColor={strokeColor}
        onStrokeColorChange={setStrokeColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onExport={handleExport}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
      />
      
      <Canvas
        elements={elements}
        onElementsChange={handleElementsChange}
        activeTool={activeTool}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        viewport={viewport}
        onViewportChange={setViewport}
        collaboration={collaboration}
        broadcastCursor={broadcastCursor}
        broadcastElementChange={broadcastElementChange}
      />

      {/* User presence indicator */}
      <UserPresence 
        users={collaboration?.users || []}
        currentUserId={currentUser?.id}
      />

      {/* Zoom indicator */}
      <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 text-sm font-medium">
        {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  );
}

export default App;
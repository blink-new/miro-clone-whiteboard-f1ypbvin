import { useRef, useEffect, useCallback, useState } from 'react';
import { WhiteboardElement, Point, Tool, ViewportState, DrawingState, CollaborationState, RichNote } from '../types/whiteboard';
import { UserCursors } from './UserCursors';
import { RichNoteCard } from './RichNoteCard';

interface CanvasProps {
  elements: WhiteboardElement[];
  onElementsChange: (elements: WhiteboardElement[]) => void;
  activeTool: Tool;
  strokeColor: string;
  strokeWidth: number;
  viewport: ViewportState;
  onViewportChange: (viewport: ViewportState) => void;
  collaboration?: CollaborationState;
  broadcastCursor?: (x: number, y: number) => void;
  broadcastElementChange?: (elements: WhiteboardElement[]) => void;
}

export function Canvas({
  elements,
  onElementsChange,
  activeTool,
  strokeColor,
  strokeWidth,
  viewport,
  onViewportChange,
  collaboration,
  broadcastCursor,
  broadcastElementChange
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    currentPath: [],
    currentElement: null
  });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<Point>({ x: 0, y: 0 });
  const [selectedRichNote, setSelectedRichNote] = useState<string | null>(null);

  // Generate unique ID
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left - viewport.x) / viewport.zoom,
      y: (screenY - rect.top - viewport.y) / viewport.zoom
    };
  }, [viewport]);

  // Draw grid
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    const gridSize = 20;
    const startX = Math.floor(-viewport.x / viewport.zoom / gridSize) * gridSize;
    const startY = Math.floor(-viewport.y / viewport.zoom / gridSize) * gridSize;
    const endX = startX + (window.innerWidth / viewport.zoom) + gridSize;
    const endY = startY + (window.innerHeight / viewport.zoom) + gridSize;

    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1 / viewport.zoom;
    ctx.beginPath();

    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }

    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }

    ctx.stroke();
  }, [viewport]);

  // Draw individual element
  const drawElement = useCallback((ctx: CanvasRenderingContext2D, element: WhiteboardElement) => {
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

    // Draw selection indicator
    if (element.selected) {
      ctx.strokeStyle = '#4F46E5';
      ctx.lineWidth = 2 / viewport.zoom;
      ctx.setLineDash([5 / viewport.zoom, 5 / viewport.zoom]);
      ctx.strokeRect(
        element.x - 5,
        element.y - 5,
        (element.width || 0) + 10,
        (element.height || 0) + 10
      );
      ctx.setLineDash([]);
    }
  }, [viewport]);

  // Draw all elements on canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context and apply viewport transform
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Draw grid
    drawGrid(ctx);

    // Draw all elements
    elements.forEach(element => {
      drawElement(ctx, element);
    });

    // Draw current drawing
    if (drawingState.currentElement) {
      drawElement(ctx, drawingState.currentElement);
    }

    ctx.restore();
  }, [elements, viewport, drawingState.currentElement, drawGrid, drawElement]);

  // Create new element
  const createNewElement = useCallback((tool: Tool, point: Point, color: string, width: number): WhiteboardElement => {
    const id = generateId();
    
    switch (tool) {
      case 'pen':
        return {
          id,
          type: 'path',
          x: point.x,
          y: point.y,
          points: [point],
          color,
          strokeWidth: width
        };
      
      case 'text':
        return {
          id,
          type: 'text',
          x: point.x,
          y: point.y,
          text: 'Text',
          color,
          strokeWidth: width
        };
      
      case 'sticky-note':
        return {
          id,
          type: 'sticky-note',
          x: point.x,
          y: point.y,
          width: 100,
          height: 100,
          text: 'Note',
          color,
          strokeWidth: width,
          fill: '#fef08a'
        };
      
      default:
        return {
          id,
          type: tool as any,
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
          color,
          strokeWidth: width
        };
    }
  }, []);

  // Update element with new point
  const updateElementWithPoint = useCallback((
    element: WhiteboardElement,
    point: Point,
    currentPath: Point[]
  ): WhiteboardElement => {
    switch (element.type) {
      case 'path':
        return {
          ...element,
          points: [...currentPath, point]
        };
      
      case 'rectangle':
      case 'circle':
        return {
          ...element,
          width: point.x - element.x,
          height: point.y - element.y
        };
      
      case 'line':
        return {
          ...element,
          width: point.x - element.x,
          height: point.y - element.y
        };
      
      default:
        return element;
    }
  }, []);

  // Check if point is inside element
  const isPointInElement = useCallback((point: Point, element: WhiteboardElement): boolean => {
    switch (element.type) {
      case 'rectangle':
      case 'sticky-note':
        return (
          point.x >= element.x &&
          point.x <= element.x + (element.width || 0) &&
          point.y >= element.y &&
          point.y <= element.y + (element.height || 0)
        );
      
      case 'circle': {
        const centerX = element.x + (element.width || 0) / 2;
        const centerY = element.y + (element.height || 0) / 2;
        const radius = Math.min((element.width || 0) / 2, (element.height || 0) / 2);
        const distance = Math.sqrt((point.x - centerX) ** 2 + (point.y - centerY) ** 2);
        return distance <= radius;
      }
      
      default:
        return false;
    }
  }, []);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const point = screenToCanvas(e.clientX, e.clientY);

    if (activeTool === 'select') {
      // Check if clicking on an element
      const clickedElement = elements.find(el => isPointInElement(point, el));
      if (clickedElement) {
        // Select element
        const updatedElements = elements.map(el => ({
          ...el,
          selected: el.id === clickedElement.id
        }));
        onElementsChange(updatedElements);
      } else {
        // Start panning
        setIsPanning(true);
        setLastPanPoint({ x: e.clientX, y: e.clientY });
        // Deselect all elements
        const updatedElements = elements.map(el => ({ ...el, selected: false }));
        onElementsChange(updatedElements);
      }
      return;
    }

    // Start drawing
    setDrawingState({
      isDrawing: true,
      currentPath: [point],
      currentElement: createNewElement(activeTool, point, strokeColor, strokeWidth)
    });
  }, [activeTool, elements, isPointInElement, onElementsChange, screenToCanvas, createNewElement, strokeColor, strokeWidth]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const point = screenToCanvas(e.clientX, e.clientY);

    // Broadcast cursor position for collaboration
    if (broadcastCursor) {
      broadcastCursor(point.x, point.y);
    }

    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      
      onViewportChange({
        ...viewport,
        x: viewport.x + deltaX,
        y: viewport.y + deltaY
      });
      
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!drawingState.isDrawing || !drawingState.currentElement) return;

    const updatedElement = updateElementWithPoint(
      drawingState.currentElement,
      point,
      drawingState.currentPath
    );

    setDrawingState({
      ...drawingState,
      currentPath: activeTool === 'pen' ? [...drawingState.currentPath, point] : drawingState.currentPath,
      currentElement: updatedElement
    });
  }, [screenToCanvas, broadcastCursor, isPanning, lastPanPoint, onViewportChange, viewport, drawingState, updateElementWithPoint, activeTool]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (drawingState.isDrawing && drawingState.currentElement) {
      const newElements = [...elements, drawingState.currentElement];
      onElementsChange(newElements);
      // Broadcast element changes for collaboration
      if (broadcastElementChange) {
        broadcastElementChange(newElements);
      }
    }

    setDrawingState({
      isDrawing: false,
      currentPath: [],
      currentElement: null
    });
  }, [isPanning, drawingState, elements, onElementsChange, broadcastElementChange]);

  // Handle wheel for zooming
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * zoomFactor));
    
    // Zoom towards mouse position
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      onViewportChange({
        x: viewport.x - (mouseX - viewport.x) * (newZoom / viewport.zoom - 1),
        y: viewport.y - (mouseY - viewport.y) * (newZoom / viewport.zoom - 1),
        zoom: newZoom
      });
    }
  }, [viewport, onViewportChange]);

  // Resize canvas
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redraw();
  }, [redraw]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative">
      <canvas
        ref={canvasRef}
        className="cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{
          cursor: activeTool === 'select' ? 'default' : 'crosshair'
        }}
      />
      
      {/* Render user cursors for collaboration */}
      <UserCursors 
        cursors={collaboration?.cursors || []}
        zoom={viewport.zoom}
        pan={viewport}
      />
    </div>
  );
}
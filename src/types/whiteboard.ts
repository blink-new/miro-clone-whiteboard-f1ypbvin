export type Tool = 'select' | 'pen' | 'rectangle' | 'circle' | 'arrow' | 'line' | 'text' | 'sticky-note' | 'rich-note';

export interface Point {
  x: number;
  y: number;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  authorId: string;
  timestamp: number;
  resolved?: boolean;
}

export interface RichNote {
  id: string;
  content: string; // Rich text content in HTML format
  comments: Comment[];
  lastEditedBy?: string;
  lastEditedAt?: number;
}

export interface WhiteboardElement {
  id: string;
  type: 'path' | 'rectangle' | 'circle' | 'arrow' | 'line' | 'text' | 'sticky-note' | 'rich-note';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Point[];
  text?: string;
  color: string;
  strokeWidth: number;
  fill?: string;
  selected?: boolean;
  richNote?: RichNote; // For rich-note type elements
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface DrawingState {
  isDrawing: boolean;
  currentPath: Point[];
  currentElement: WhiteboardElement | null;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface UserCursor {
  userId: string;
  x: number;
  y: number;
  displayName: string;
  color: string;
}

export interface CollaborationState {
  users: User[];
  cursors: UserCursor[];
  isConnected: boolean;
}
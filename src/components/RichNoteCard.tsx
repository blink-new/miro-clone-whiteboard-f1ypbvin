import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send, Check, X, MoreHorizontal, User } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { RichNote, Comment } from '../types/whiteboard';
import { useCollaboration } from '../hooks/useCollaboration';

interface RichNoteCardProps {
  richNote: RichNote;
  onUpdate: (richNote: RichNote) => void;
  onClose: () => void;
  position: { x: number; y: number };
  width: number;
  height: number;
}

export function RichNoteCard({ 
  richNote, 
  onUpdate, 
  onClose, 
  position, 
  width, 
  height 
}: RichNoteCardProps) {
  const [content, setContent] = useState(richNote.content);
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useCollaboration();

  // Auto-save content changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (content !== richNote.content) {
        onUpdate({
          ...richNote,
          content,
          lastEditedBy: currentUser?.displayName || 'Anonymous',
          lastEditedAt: Date.now()
        });
      }
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [content, richNote, onUpdate, currentUser]);

  // Handle content editing
  const handleContentChange = useCallback(() => {
    if (contentRef.current) {
      setContent(contentRef.current.innerHTML);
    }
  }, []);

  // Add new comment
  const handleAddComment = useCallback(() => {
    if (!newComment.trim() || !currentUser) return;

    const comment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      text: newComment,
      author: currentUser.displayName,
      authorId: currentUser.id,
      timestamp: Date.now(),
      resolved: false
    };

    onUpdate({
      ...richNote,
      comments: [...richNote.comments, comment]
    });

    setNewComment('');
  }, [newComment, currentUser, richNote, onUpdate]);

  // Resolve/unresolve comment
  const handleToggleComment = useCallback((commentId: string) => {
    const updatedComments = richNote.comments.map(comment =>
      comment.id === commentId
        ? { ...comment, resolved: !comment.resolved }
        : comment
    );

    onUpdate({
      ...richNote,
      comments: updatedComments
    });
  }, [richNote, onUpdate]);

  // Delete comment
  const handleDeleteComment = useCallback((commentId: string) => {
    const updatedComments = richNote.comments.filter(comment => comment.id !== commentId);
    
    onUpdate({
      ...richNote,
      comments: updatedComments
    });
  }, [richNote, onUpdate]);

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const unresolvedComments = richNote.comments.filter(c => !c.resolved);
  const resolvedComments = richNote.comments.filter(c => c.resolved);

  return (
    <Card 
      className="absolute bg-white shadow-lg border border-gray-200 resize overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: Math.max(width, 300),
        height: Math.max(height, 200),
        minWidth: 300,
        minHeight: 200
      }}
    >
      <CardHeader className="p-3 bg-gray-50 border-b flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium">Rich Text Note</div>
          {unresolvedComments.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unresolvedComments.length} comment{unresolvedComments.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className="h-6 w-6 p-0"
          >
            <MessageCircle className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      <div className="flex h-full">
        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          <CardContent className="flex-1 p-3">
            <div
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleContentChange}
              onFocus={() => setIsEditing(true)}
              onBlur={() => setIsEditing(false)}
              className="w-full h-full outline-none text-sm leading-relaxed overflow-auto resize-none"
              style={{ minHeight: '100px' }}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </CardContent>
          
          {richNote.lastEditedBy && (
            <div className="px-3 pb-2 text-xs text-gray-500">
              Last edited by {richNote.lastEditedBy} {richNote.lastEditedAt && formatTimestamp(richNote.lastEditedAt)}
            </div>
          )}
        </div>

        {/* Comments sidebar */}
        {showComments && (
          <div className="w-64 border-l bg-gray-50 flex flex-col">
            <div className="p-3 border-b bg-white">
              <div className="text-sm font-medium mb-2">Comments</div>
              <div className="flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="text-xs resize-none"
                  rows={2}
                />
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="h-8 w-8 p-0"
                >
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {/* Unresolved comments */}
              {unresolvedComments.map((comment) => (
                <div key={comment.id} className="bg-white rounded-lg p-2 border">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-gray-400" />
                      <span className="text-xs font-medium">{comment.author}</span>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-32 p-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleComment(comment.id)}
                          className="w-full justify-start text-xs"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Resolve
                        </Button>
                        {currentUser?.id === comment.authorId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="w-full justify-start text-xs text-red-600"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <p className="text-xs text-gray-700 mb-1">{comment.text}</p>
                  <span className="text-xs text-gray-400">{formatTimestamp(comment.timestamp)}</span>
                </div>
              ))}
              
              {/* Resolved comments */}
              {resolvedComments.length > 0 && (
                <>
                  <Separator />
                  <div className="text-xs text-gray-500 font-medium">Resolved</div>
                  {resolvedComments.map((comment) => (
                    <div key={comment.id} className="bg-gray-100 rounded-lg p-2 border opacity-60">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-gray-400" />
                          <span className="text-xs font-medium">{comment.author}</span>
                          <Check className="h-3 w-3 text-green-600" />
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-32 p-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleComment(comment.id)}
                              className="w-full justify-start text-xs"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Unresolve
                            </Button>
                            {currentUser?.id === comment.authorId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteComment(comment.id)}
                                className="w-full justify-start text-xs text-red-600"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>
                      <p className="text-xs text-gray-600 mb-1">{comment.text}</p>
                      <span className="text-xs text-gray-400">{formatTimestamp(comment.timestamp)}</span>
                    </div>
                  ))}
                </>
              )}
              
              {richNote.comments.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-4">
                  No comments yet
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
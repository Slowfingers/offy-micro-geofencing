import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion';
import type { FloatingComment } from '../types/mall';

interface FloatingCommentsProps {
  discountId: string;
  className?: string;
}

// Optimized floating comments component using CSS transforms and requestAnimationFrame
export function FloatingComments({ discountId, className = '' }: FloatingCommentsProps) {
  const [comments, setComments] = useState<FloatingComment[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Simulate real-time comments (in production, this would come from WebSocket)
  useEffect(() => {
    const sampleComments: FloatingComment[] = [
      {
        id: '1',
        userId: 'user1',
        discountId,
        text: 'Отличная скидка! 🎉',
        position: { x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 },
        velocity: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 },
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        userId: 'user2',
        discountId,
        text: 'Успел купить! 🔥',
        position: { x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 },
        velocity: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 },
        createdAt: new Date().toISOString()
      },
      {
        id: '3',
        userId: 'user3',
        discountId,
        text: 'Спасибо за информацию 💯',
        position: { x: Math.random() * 80 + 10, y: Math.random() * 80 + 10 },
        velocity: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 },
        createdAt: new Date().toISOString()
      }
    ];

    setComments(sampleComments);

    // Initialize positions
    sampleComments.forEach(comment => {
      positionsRef.current.set(comment.id, { ...comment.position });
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [discountId]);

  // Optimized animation loop using requestAnimationFrame
  useEffect(() => {
    const animate = () => {
      const container = containerRef.current;
      if (!container) return;

      const { width, height } = container.getBoundingClientRect();
      const newPositions = new Map(positionsRef.current);

      comments.forEach(comment => {
        const currentPos = newPositions.get(comment.id);
        if (!currentPos) return;

        // Update position based on velocity
        let newX = currentPos.x + comment.velocity.x;
        let newY = currentPos.y + comment.velocity.y;

        // Bounce off edges
        if (newX <= 0 || newX >= 100) {
          comment.velocity.x *= -1;
          newX = Math.max(0, Math.min(100, newX));
        }
        if (newY <= 0 || newY >= 100) {
          comment.velocity.y *= -1;
          newY = Math.max(0, Math.min(100, newY));
        }

        newPositions.set(comment.id, { x: newX, y: newY });
      });

      positionsRef.current = newPositions;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [comments]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
    >
      {comments.map(comment => {
        const pos = positionsRef.current.get(comment.id);
        if (!pos) return null;

        return (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="absolute bg-white/90 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg text-sm font-medium text-gray-800 pointer-events-none select-none"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: 'translate(-50%, -50%)',
              willChange: 'transform' // Hint for browser optimization
            }}
          >
            {comment.text}
          </motion.div>
        );
      })}
    </div>
  );
}

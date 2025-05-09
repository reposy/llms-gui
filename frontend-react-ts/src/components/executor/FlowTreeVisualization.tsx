import React, { useEffect, useRef } from 'react';

interface Node {
  id: string;
  name: string;
  type?: string;
  children?: Node[];
  [key: string]: any;
}

interface FlowTreeVisualizationProps {
  flowJson: any;
}

// Polyfill for roundRect if not available in the browser
declare global {
  interface CanvasRenderingContext2D {
    roundRect?: (x: number, y: number, w: number, h: number, r: number) => void;
  }
}

const FlowTreeVisualization: React.FC<FlowTreeVisualizationProps> = ({ flowJson }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Sample flow data for testing when no flow is provided
  const sampleFlowData = {
    nodes: [
      { id: "node1", name: "Root Node 1", type: "inputNode" },
      { id: "node2", name: "Root Node 2", type: "functionNode" },
      { id: "node3", name: "Child Node 1", type: "dataNode" },
      { id: "node4", name: "Child Node 2", type: "outputNode" },
      { id: "node5", name: "Grandchild 1", type: "functionNode" },
      { id: "node6", name: "Grandchild 2", type: "functionNode" },
      { id: "node7", name: "Great-grandchild", type: "outputNode" }
    ],
    edges: [
      { source: "node1", target: "node3" },
      { source: "node1", target: "node4" },
      { source: "node2", target: "node4" },
      { source: "node3", target: "node5" },
      { source: "node3", target: "node6" },
      { source: "node5", target: "node7" }
    ]
  };
  
  useEffect(() => {
    // Use provided flow or sample data for testing
    const flow = flowJson || sampleFlowData;
    
    if (!canvasRef.current) return;
    
    // Transform flow JSON into tree structure
    const graph = buildGraphFromFlow(flow);
    
    // Render the graph
    renderGraph(graph);
    
    // Add window resize listener to redraw the graph
    const handleResize = () => renderGraph(graph);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [flowJson]);
  
  // Build a graph structure from flow JSON
  const buildGraphFromFlow = (flow: any) => {
    if (!flow || !flow.nodes || !flow.edges) {
      return { nodes: [], edges: [] };
    }
    
    // Create a map of all nodes with their connections
    const nodeMap: Record<string, any> = {};
    
    // Add all nodes to the map
    flow.nodes.forEach((node: any) => {
      nodeMap[node.id] = {
        ...node,
        incomingEdges: [],
        outgoingEdges: []
      };
    });
    
    // Add edge connections
    flow.edges.forEach((edge: any) => {
      const sourceId = edge.source;
      const targetId = edge.target;
      
      if (nodeMap[sourceId] && nodeMap[targetId]) {
        nodeMap[sourceId].outgoingEdges.push(targetId);
        nodeMap[targetId].incomingEdges.push(sourceId);
      }
    });
    
    // Find root nodes (nodes without incoming edges)
    const rootNodeIds: string[] = [];
    Object.keys(nodeMap).forEach(nodeId => {
      if (nodeMap[nodeId].incomingEdges.length === 0) {
        rootNodeIds.push(nodeId);
      }
    });
    
    return { 
      nodes: nodeMap, 
      rootNodeIds,
      edges: flow.edges
    };
  };
  
  // Draw a rounded rectangle (for browsers that don't support roundRect)
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    radius: number
  ) => {
    if (ctx.roundRect) {
      ctx.roundRect(x, y, width, height, radius);
    } else {
      // Manual implementation for browsers without roundRect
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }
  };
  
  // Calculate node positions for visualization
  const calculateNodePositions = (graph: any) => {
    const { nodes, rootNodeIds } = graph;
    const positions: Record<string, { x: number, y: number }> = {};
    const nodeWidth = 120;
    const nodeHeight = 40;
    const horizontalSpacing = 160;
    const verticalSpacing = 80;
    
    // Helper function for breadth-first layout
    const assignPositions = () => {
      // We'll use a breadth-first approach for horizontal layout
      const queue: { id: string, level: number, order: number }[] = [];
      const visited = new Set<string>();
      
      // Initialize with root nodes
      rootNodeIds.forEach((id, index) => {
        queue.push({ id, level: 0, order: index });
        visited.add(id);
      });
      
      // Track max nodes at each level for vertical positioning
      const levelCounts: Record<number, number> = {};
      rootNodeIds.forEach((_, index) => {
        levelCounts[0] = (levelCounts[0] || 0) + 1;
      });
      
      // Process nodes in breadth-first order
      while (queue.length > 0) {
        const { id, level, order } = queue.shift()!;
        
        // Calculate position based on level (x) and order (y)
        positions[id] = {
          x: level * (nodeWidth + horizontalSpacing) + 50,
          y: order * (nodeHeight + verticalSpacing) + 50
        };
        
        // Add children to queue
        const node = nodes[id];
        if (node && node.outgoingEdges) {
          let childOrder = 0;
          
          node.outgoingEdges.forEach((childId: string) => {
            if (!visited.has(childId)) {
              // Check if all parents of this child have been visited
              const childNode = nodes[childId];
              const allParentsVisited = childNode.incomingEdges.every((parentId: string) => 
                visited.has(parentId)
              );
              
              if (allParentsVisited) {
                const nextLevel = level + 1;
                levelCounts[nextLevel] = (levelCounts[nextLevel] || 0) + 1;
                
                // Use the maximum available order for this level
                const childOrderAtLevel = levelCounts[nextLevel] - 1;
                
                queue.push({ id: childId, level: nextLevel, order: childOrderAtLevel });
                visited.add(childId);
                childOrder++;
              }
            }
          });
        }
      }
      
      // Handle nodes that might not have been visited due to circular references
      Object.keys(nodes).forEach(id => {
        if (!visited.has(id)) {
          positions[id] = {
            x: 50,
            y: Object.keys(positions).length * (nodeHeight + verticalSpacing) + 50
          };
        }
      });
    };
    
    assignPositions();
    return positions;
  };
  
  // Render the graph on canvas
  const renderGraph = (graph: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size to match its display size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    const { nodes, edges } = graph;
    if (!nodes || Object.keys(nodes).length === 0) return;
    
    // Calculate node positions
    const positions = calculateNodePositions(graph);
    
    // Find canvas dimensions needed
    let maxX = 0;
    let maxY = 0;
    Object.values(positions).forEach((pos: any) => {
      maxX = Math.max(maxX, pos.x + 150); // nodeWidth + margin
      maxY = Math.max(maxY, pos.y + 60);  // nodeHeight + margin
    });
    
    // Define constants for drawing
    const nodeWidth = 120;
    const nodeHeight = 40;
    
    // Draw edges first (so they appear behind nodes)
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    edges.forEach((edge: any) => {
      const sourcePos = positions[edge.source];
      const targetPos = positions[edge.target];
      
      if (sourcePos && targetPos) {
        // Draw arrow from source to target
        const startX = sourcePos.x + nodeWidth;
        const startY = sourcePos.y + nodeHeight / 2;
        const endX = targetPos.x;
        const endY = targetPos.y + nodeHeight / 2;
        
        // Draw main line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        
        // Curved path with control points
        const controlPointX = startX + (endX - startX) / 2;
        ctx.bezierCurveTo(
          controlPointX, startY, // First control point
          controlPointX, endY,   // Second control point
          endX, endY             // End point
        );
        
        ctx.stroke();
        
        // Draw arrowhead
        const arrowSize = 8;
        const angle = Math.atan2(endY - (endY), endX - controlPointX);
        
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - arrowSize * Math.cos(angle - Math.PI / 6),
          endY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          endX - arrowSize * Math.cos(angle + Math.PI / 6),
          endY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = '#3b82f6';
        ctx.fill();
      }
    });
    
    // Draw nodes
    Object.keys(nodes).forEach(nodeId => {
      const node = nodes[nodeId];
      const position = positions[nodeId];
      
      if (position) {
        // Draw node rectangle
        ctx.fillStyle = '#f0f9ff';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        // Use our custom function that works on all browsers
        drawRoundedRect(ctx, position.x, position.y, nodeWidth, nodeHeight, 6);
        ctx.fill();
        ctx.stroke();
        
        // Draw node label
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Truncate long node names
        const displayName = (node.name || node.type || node.id || 'Node');
        const maxChars = 15;
        const displayText = displayName.length > maxChars 
          ? displayName.substring(0, maxChars) + '...' 
          : displayName;
        
        ctx.fillText(displayText, position.x + nodeWidth/2, position.y + nodeHeight/2);
      }
    });
    
    // Set canvas content size to accommodate all nodes
    canvas.style.minWidth = `${maxX}px`;
    canvas.style.minHeight = `${maxY}px`;
  };
  
  return (
    <div className="mt-4 p-4 border border-gray-300 rounded-lg bg-white">
      <h3 className="text-lg font-medium mb-3">Flow Structure</h3>
      <div className="bg-gray-50 p-2 border border-gray-200 rounded overflow-auto" style={{ height: '400px' }}>
        <canvas 
          ref={canvasRef} 
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
};

export default FlowTreeVisualization; 
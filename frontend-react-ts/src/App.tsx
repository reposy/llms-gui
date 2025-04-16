import { ReactFlowProvider } from 'reactflow';
import { FlowEditor } from './components/FlowEditor';
import { useEffect } from 'react';
import { registerAllNodeTypes } from './core/NodeRegistry';
import { NodeFactory } from './core/NodeFactory';

export default function App() {
  // Initialize node types on application startup
  useEffect(() => {
    console.log('Initializing node types at application startup');
    const nodeFactory = new NodeFactory();
    registerAllNodeTypes(nodeFactory);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <ReactFlowProvider>
        <FlowEditor />
      </ReactFlowProvider>
    </div>
  );
} 
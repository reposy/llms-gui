import { ReactFlowProvider } from 'reactflow';
import { FlowEditor } from './components/FlowEditor';

export default function App() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <ReactFlowProvider>
        <FlowEditor />
      </ReactFlowProvider>
    </div>
  );
} 
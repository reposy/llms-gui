import React, { useState } from 'react';
import { Box, Grid } from '@mui/material';
import { FlowChainList } from '../components/FlowExecutor/FlowChainList';
import { FlowChainDetail } from '../components/FlowExecutor/FlowChainDetail';
import { FlowChainModal } from '../components/FlowExecutor/FlowChainModal';

export const FlowExecutor: React.FC = () => {
  const [selectedFlow, setSelectedFlow] = useState<{ chainId: string; flowId: string } | null>(null);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <Grid container sx={{ height: '100%' }}>
          <Grid item xs={3} sx={{ borderRight: 1, borderColor: 'divider', height: '100%', overflow: 'auto' }}>
            <FlowChainList />
          </Grid>
          <Grid item xs={9} sx={{ height: '100%', overflow: 'auto' }}>
            <FlowChainDetail />
          </Grid>
        </Grid>
      </Box>

      {selectedFlow && (
        <FlowChainModal
          chainId={selectedFlow.chainId}
          flowId={selectedFlow.flowId}
          open={!!selectedFlow}
          onClose={() => setSelectedFlow(null)}
        />
      )}
    </Box>
  );
}; 
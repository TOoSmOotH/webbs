import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon
} from '@mui/icons-material';

// ANSI color palette
const ANSI_COLORS = [
  '#000000', '#aa0000', '#00aa00', '#aa5500',
  '#0000aa', '#aa00aa', '#00aaaa', '#aaaaaa',
  '#555555', '#ff5555', '#55ff55', '#ffff55',
  '#5555ff', '#ff55ff', '#55ffff', '#ffffff'
];

export default function AnsiPreviewDialog({ open, onClose, menuId }) {
  const [tabValue, setTabValue] = useState(0);
  const [ansiData, setAnsiData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && menuId) {
      fetchAnsiData();
    }
  }, [open, menuId]);

  const fetchAnsiData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/menus/${menuId}/ansi`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnsiData(data);
      }
    } catch (error) {
      console.error('Error fetching ANSI preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAnsi = () => {
    if (ansiData?.ansi) {
      navigator.clipboard.writeText(ansiData.ansi);
    }
  };

  const handleDownloadAnsi = () => {
    if (ansiData?.ansi) {
      const blob = new Blob([ansiData.ansi], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `menu_${menuId}.ans`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const parseAnsiToElements = (ansiText) => {
    if (!ansiText) return [];

    // Remove control sequences we don't need for display
    ansiText = ansiText.replace(/\x1b\[2J\x1b\[H/g, ''); // Clear screen
    ansiText = ansiText.replace(/\x1b\[\?25[lh]/g, ''); // Cursor visibility
    ansiText = ansiText.replace(/\x1b\[\d+;\d+H/g, '\n'); // Cursor positioning to newline

    const ansiRegex = /\x1b\[([0-9;]+)m/g;
    const elements = [];
    let lastIndex = 0;
    let currentFg = 7;
    let currentBg = 0;
    let match;

    while ((match = ansiRegex.exec(ansiText)) !== null) {
      // Add text before the ANSI code
      if (match.index > lastIndex) {
        const text = ansiText.substring(lastIndex, match.index);
        if (text) {
          elements.push({
            type: 'text',
            content: text,
            fg: currentFg,
            bg: currentBg
          });
        }
      }

      // Parse ANSI codes
      const codes = match[1].split(';').map(Number);
      for (const code of codes) {
        if (code === 0) {
          currentFg = 7;
          currentBg = 0;
        } else if (code >= 30 && code <= 37) {
          currentFg = code - 30;
        } else if (code >= 90 && code <= 97) {
          currentFg = code - 90 + 8;
        } else if (code >= 40 && code <= 47) {
          currentBg = code - 40;
        } else if (code >= 100 && code <= 107) {
          currentBg = code - 100 + 8;
        }
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < ansiText.length) {
      const text = ansiText.substring(lastIndex);
      if (text) {
        elements.push({
          type: 'text',
          content: text,
          fg: currentFg,
          bg: currentBg
        });
      }
    }

    return elements;
  };

  const renderAnsiElements = (elements) => {
    return elements.map((elem, idx) => {
      const style = {
        color: ANSI_COLORS[elem.fg],
        backgroundColor: ANSI_COLORS[elem.bg],
        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        whiteSpace: 'pre',
        lineHeight: '1.2'
      };

      return (
        <span key={idx} style={style}>
          {elem.content}
        </span>
      );
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">ANSI Preview</Typography>
          <Box>
            <Tooltip title="Copy ANSI">
              <IconButton onClick={handleCopyAnsi} size="small">
                <CopyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download ANSI">
              <IconButton onClick={handleDownloadAnsi} size="small">
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Visual Preview" />
          <Tab label="HTML Preview" />
          <Tab label="Raw ANSI" />
        </Tabs>

        <Box sx={{ p: 2, height: 'calc(100% - 48px)', overflow: 'auto' }}>
          {loading ? (
            <Typography>Loading preview...</Typography>
          ) : (
            <>
              {tabValue === 0 && (
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: '#000',
                    color: '#aaa',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    overflow: 'auto',
                    height: '100%'
                  }}
                >
                  {ansiData && renderAnsiElements(parseAnsiToElements(ansiData.ansi))}
                </Paper>
              )}

              {tabValue === 1 && (
                <Box
                  dangerouslySetInnerHTML={{ __html: ansiData?.htmlPreview || '' }}
                  sx={{ height: '100%', overflow: 'auto' }}
                />
              )}

              {tabValue === 2 && (
                <Paper
                  component="pre"
                  sx={{
                    p: 2,
                    bgcolor: '#f5f5f5',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    overflow: 'auto',
                    height: '100%',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}
                >
                  {ansiData?.ansi || ''}
                </Paper>
              )}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
import React, { useState, useEffect, useRef, useCallback } from 'react';
import AnsiPreviewDialog from '../components/AnsiPreviewDialog';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Toolbar,
  AppBar,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Slider,
  FormControlLabel,
  Switch,
  Tab,
  Tabs,
  Chip,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Save as SaveIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  GridOn as GridIcon,
  FormatColorFill as FillIcon,
  BorderOuter as BoxIcon,
  TextFields as TextIcon,
  Preview as PreviewIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  ContentPaste as PasteIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Palette as PaletteIcon,
  Apps as TemplateIcon,
  Apps
} from '@mui/icons-material';

// ANSI color palette
const ANSI_COLORS = [
  { id: 0, name: 'Black', hex: '#000000' },
  { id: 1, name: 'Red', hex: '#AA0000' },
  { id: 2, name: 'Green', hex: '#00AA00' },
  { id: 3, name: 'Yellow', hex: '#AA5500' },
  { id: 4, name: 'Blue', hex: '#0000AA' },
  { id: 5, name: 'Magenta', hex: '#AA00AA' },
  { id: 6, name: 'Cyan', hex: '#00AAAA' },
  { id: 7, name: 'White', hex: '#AAAAAA' },
  { id: 8, name: 'Bright Black', hex: '#555555' },
  { id: 9, name: 'Bright Red', hex: '#FF5555' },
  { id: 10, name: 'Bright Green', hex: '#55FF55' },
  { id: 11, name: 'Bright Yellow', hex: '#FFFF55' },
  { id: 12, name: 'Bright Blue', hex: '#5555FF' },
  { id: 13, name: 'Bright Magenta', hex: '#FF55FF' },
  { id: 14, name: 'Bright Cyan', hex: '#55FFFF' },
  { id: 15, name: 'Bright White', hex: '#FFFFFF' }
];

// Box drawing characters
const BOX_CHARS = {
  single: {
    horizontal: '─',
    vertical: '│',
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    cross: '┼',
    tDown: '┬',
    tUp: '┴',
    tRight: '├',
    tLeft: '┤'
  },
  double: {
    horizontal: '═',
    vertical: '║',
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    cross: '╬',
    tDown: '╦',
    tUp: '╩',
    tRight: '╠',
    tLeft: '╣'
  }
};

// Common block characters
const BLOCK_CHARS = {
  full: '█',
  upperHalf: '▀',
  lowerHalf: '▄',
  leftHalf: '▌',
  rightHalf: '▐',
  light: '░',
  medium: '▒',
  dark: '▓'
};

export default function MenuBuilder() {
  const [menus, setMenus] = useState([]);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [grid, setGrid] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tool, setTool] = useState('draw');
  const [currentChar, setCurrentChar] = useState(' ');
  const [foregroundColor, setForegroundColor] = useState(7);
  const [backgroundColor, setBackgroundColor] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedCell, setSelectedCell] = useState(null);
  const [menuDialog, setMenuDialog] = useState(false);
  const [itemDialog, setItemDialog] = useState(false);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [templates, setTemplates] = useState([]);
  const [clipboard, setClipboard] = useState(null);
  const [selection, setSelection] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [boxStart, setBoxStart] = useState(null);
  const canvasRef = useRef(null);

  // Initialize empty grid
  const initializeGrid = (width = 80, height = 25) => {
    const newGrid = Array(height).fill(null).map(() =>
      Array(width).fill(null).map(() => ({
        char: ' ',
        fg: 7,
        bg: 0
      }))
    );
    setGrid(newGrid);
    addToHistory(newGrid);
  };

  // Fetch menus
  const fetchMenus = async () => {
    try {
      const response = await fetch('/api/menus', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMenus(data.menus);
      }
    } catch (error) {
      console.error('Error fetching menus:', error);
      showSnackbar('Failed to fetch menus', 'error');
    }
  };

  // Load menu data
  const loadMenu = async (menuId) => {
    try {
      const response = await fetch(`/api/menus/${menuId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedMenu(data.menu);
        setMenuItems(data.items || []);
        
        if (data.layout && data.layout.grid_data) {
          setGrid(data.layout.grid_data);
          addToHistory(data.layout.grid_data);
        } else {
          initializeGrid(data.menu.width, data.menu.height);
        }
      }
    } catch (error) {
      console.error('Error loading menu:', error);
      showSnackbar('Failed to load menu', 'error');
    }
  };

  // Save menu layout
  const saveLayout = async () => {
    if (!selectedMenu) return;

    try {
      const response = await fetch(`/api/menus/${selectedMenu.id}/layout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          grid_data: grid,
          box_elements: [], // Could track box drawing separately
          text_elements: []  // Could track text elements separately
        })
      });

      if (response.ok) {
        showSnackbar('Layout saved successfully', 'success');
      } else {
        throw new Error('Failed to save layout');
      }
    } catch (error) {
      console.error('Error saving layout:', error);
      showSnackbar('Failed to save layout', 'error');
    }
  };

  // History management
  const addToHistory = (newGrid) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newGrid)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setGrid(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setGrid(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  // Drawing functions
  const drawCell = (x, y) => {
    if (x < 0 || x >= grid[0].length || y < 0 || y >= grid.length) return;

    const newGrid = [...grid];
    newGrid[y][x] = {
      char: currentChar,
      fg: foregroundColor,
      bg: backgroundColor
    };
    setGrid(newGrid);
  };

  const handleCellClick = (x, y) => {
    if (tool === 'draw') {
      drawCell(x, y);
      setIsDrawing(true);
    } else if (tool === 'fill') {
      floodFill(x, y);
    } else if (tool === 'box') {
      if (!boxStart) {
        setBoxStart({ x, y });
      } else {
        drawBox(boxStart.x, boxStart.y, x, y);
        setBoxStart(null);
      }
    } else if (tool === 'select') {
      if (!selection) {
        setSelection({ start: { x, y }, end: { x, y } });
      } else {
        setSelection({ ...selection, end: { x, y } });
      }
    } else if (tool === 'item') {
      placeMenuItem(x, y);
    }
  };

  const handleCellMove = (x, y) => {
    if (isDrawing && tool === 'draw') {
      drawCell(x, y);
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && tool === 'draw') {
      addToHistory(grid);
    }
    setIsDrawing(false);
  };

  // Flood fill algorithm
  const floodFill = (x, y) => {
    if (x < 0 || x >= grid[0].length || y < 0 || y >= grid.length) return;

    const targetCell = grid[y][x];
    const targetChar = targetCell.char;
    const targetFg = targetCell.fg;
    const targetBg = targetCell.bg;

    if (targetChar === currentChar && targetFg === foregroundColor && targetBg === backgroundColor) {
      return;
    }

    const newGrid = [...grid];
    const stack = [[x, y]];

    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      
      if (cx < 0 || cx >= grid[0].length || cy < 0 || cy >= grid.length) continue;
      
      const cell = newGrid[cy][cx];
      if (cell.char !== targetChar || cell.fg !== targetFg || cell.bg !== targetBg) continue;

      newGrid[cy][cx] = {
        char: currentChar,
        fg: foregroundColor,
        bg: backgroundColor
      };

      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }

    setGrid(newGrid);
    addToHistory(newGrid);
  };

  // Draw box
  const drawBox = (x1, y1, x2, y2, style = 'single') => {
    const newGrid = [...grid];
    const chars = BOX_CHARS[style];

    // Ensure coordinates are in correct order
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    // Draw corners
    if (minX >= 0 && minY >= 0 && minX < grid[0].length && minY < grid.length) {
      newGrid[minY][minX] = { char: chars.topLeft, fg: foregroundColor, bg: backgroundColor };
    }
    if (maxX >= 0 && minY >= 0 && maxX < grid[0].length && minY < grid.length) {
      newGrid[minY][maxX] = { char: chars.topRight, fg: foregroundColor, bg: backgroundColor };
    }
    if (minX >= 0 && maxY >= 0 && minX < grid[0].length && maxY < grid.length) {
      newGrid[maxY][minX] = { char: chars.bottomLeft, fg: foregroundColor, bg: backgroundColor };
    }
    if (maxX >= 0 && maxY >= 0 && maxX < grid[0].length && maxY < grid.length) {
      newGrid[maxY][maxX] = { char: chars.bottomRight, fg: foregroundColor, bg: backgroundColor };
    }

    // Draw horizontal lines
    for (let x = minX + 1; x < maxX; x++) {
      if (x >= 0 && x < grid[0].length) {
        if (minY >= 0 && minY < grid.length) {
          newGrid[minY][x] = { char: chars.horizontal, fg: foregroundColor, bg: backgroundColor };
        }
        if (maxY >= 0 && maxY < grid.length) {
          newGrid[maxY][x] = { char: chars.horizontal, fg: foregroundColor, bg: backgroundColor };
        }
      }
    }

    // Draw vertical lines
    for (let y = minY + 1; y < maxY; y++) {
      if (y >= 0 && y < grid.length) {
        if (minX >= 0 && minX < grid[0].length) {
          newGrid[y][minX] = { char: chars.vertical, fg: foregroundColor, bg: backgroundColor };
        }
        if (maxX >= 0 && maxX < grid[0].length) {
          newGrid[y][maxX] = { char: chars.vertical, fg: foregroundColor, bg: backgroundColor };
        }
      }
    }

    setGrid(newGrid);
    addToHistory(newGrid);
  };

  // Place text
  const placeText = (x, y, text) => {
    const newGrid = [...grid];
    
    for (let i = 0; i < text.length; i++) {
      const cx = x + i;
      if (cx >= 0 && cx < grid[0].length && y >= 0 && y < grid.length) {
        newGrid[y][cx] = {
          char: text[i],
          fg: foregroundColor,
          bg: backgroundColor
        };
      }
    }

    setGrid(newGrid);
    addToHistory(newGrid);
  };

  // Menu item management
  const placeMenuItem = (x, y) => {
    setEditingItem({
      x_position: x,
      y_position: y,
      hotkey: '',
      label: '',
      action_type: 'command',
      action_data: {}
    });
    setItemDialog(true);
  };

  const saveMenuItem = async (item) => {
    try {
      const method = item.id ? 'PUT' : 'POST';
      const url = item.id 
        ? `/api/menus/${selectedMenu.id}/items/${item.id}`
        : `/api/menus/${selectedMenu.id}/items`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(item)
      });

      if (response.ok) {
        const data = await response.json();
        if (item.id) {
          setMenuItems(menuItems.map(mi => mi.id === item.id ? data.item : mi));
        } else {
          setMenuItems([...menuItems, data.item]);
        }
        
        // Draw the menu item label on the grid
        placeText(item.x_position, item.y_position, `[${item.hotkey}] ${item.label}`);
        
        showSnackbar('Menu item saved successfully', 'success');
        setItemDialog(false);
        setEditingItem(null);
      }
    } catch (error) {
      console.error('Error saving menu item:', error);
      showSnackbar('Failed to save menu item', 'error');
    }
  };

  const deleteMenuItem = async (itemId) => {
    try {
      const response = await fetch(`/api/menus/${selectedMenu.id}/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });

      if (response.ok) {
        setMenuItems(menuItems.filter(item => item.id !== itemId));
        showSnackbar('Menu item deleted successfully', 'success');
      }
    } catch (error) {
      console.error('Error deleting menu item:', error);
      showSnackbar('Failed to delete menu item', 'error');
    }
  };

  // Generate ANSI preview
  const generateAnsiPreview = () => {
    if (!selectedMenu) return;
    setPreviewDialog(true);
  };

  // Utility functions
  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  useEffect(() => {
    fetchMenus();
    initializeGrid();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z for redo
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      // Ctrl/Cmd + S for save
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveLayout();
      }
      // Number keys for tools
      else if (e.key === '1') setTool('draw');
      else if (e.key === '2') setTool('fill');
      else if (e.key === '3') setTool('box');
      else if (e.key === '4') setTool('select');
      else if (e.key === '5') setTool('item');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, selectedMenu]);

  // Canvas rendering
  const renderCanvas = () => {
    if (!canvasRef.current || !grid.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const cellWidth = 10;
    const cellHeight = 20;

    canvas.width = grid[0].length * cellWidth;
    canvas.height = grid.length * cellHeight;

    ctx.font = '16px monospace';
    ctx.textBaseline = 'top';

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw cells
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[0].length; x++) {
        const cell = grid[y][x];
        
        // Draw background
        ctx.fillStyle = ANSI_COLORS[cell.bg].hex;
        ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);

        // Draw character
        ctx.fillStyle = ANSI_COLORS[cell.fg].hex;
        ctx.fillText(cell.char, x * cellWidth, y * cellHeight);

        // Draw grid lines if enabled
        if (showGrid) {
          ctx.strokeStyle = '#333333';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
        }
      }
    }

    // Draw selection
    if (selection) {
      const minX = Math.min(selection.start.x, selection.end.x);
      const maxX = Math.max(selection.start.x, selection.end.x);
      const minY = Math.min(selection.start.y, selection.end.y);
      const maxY = Math.max(selection.start.y, selection.end.y);

      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        minX * cellWidth,
        minY * cellHeight,
        (maxX - minX + 1) * cellWidth,
        (maxY - minY + 1) * cellHeight
      );
      ctx.setLineDash([]);
    }
  };

  useEffect(() => {
    renderCanvas();
  }, [grid, showGrid, selection]);

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* Left sidebar - Tools and colors */}
      <Paper sx={{ width: 250, p: 2, overflowY: 'auto' }}>
        <Typography variant="h6" gutterBottom>Tools</Typography>
        
        <ToggleButtonGroup
          value={tool}
          exclusive
          onChange={(e, newTool) => newTool && setTool(newTool)}
          orientation="vertical"
          fullWidth
          sx={{ mb: 2 }}
        >
          <ToggleButton value="draw" size="small">
            <TextIcon sx={{ mr: 1 }} /> Draw
          </ToggleButton>
          <ToggleButton value="fill" size="small">
            <FillIcon sx={{ mr: 1 }} /> Fill
          </ToggleButton>
          <ToggleButton value="box" size="small">
            <BoxIcon sx={{ mr: 1 }} /> Box
          </ToggleButton>
          <ToggleButton value="select" size="small">
            <TemplateIcon sx={{ mr: 1 }} /> Select
          </ToggleButton>
          <ToggleButton value="item" size="small">
            <AddIcon sx={{ mr: 1 }} /> Menu Item
          </ToggleButton>
        </ToggleButtonGroup>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom>Character</Typography>
        <TextField
          value={currentChar}
          onChange={(e) => setCurrentChar(e.target.value.slice(-1) || ' ')}
          fullWidth
          inputProps={{ maxLength: 1, style: { textAlign: 'center', fontFamily: 'monospace' } }}
          sx={{ mb: 2 }}
        />

        <Typography variant="subtitle1" gutterBottom>Common Characters</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          {Object.values(BLOCK_CHARS).map((char, idx) => (
            <Button
              key={idx}
              variant="outlined"
              size="small"
              onClick={() => setCurrentChar(char)}
              sx={{ minWidth: 32, fontFamily: 'monospace' }}
            >
              {char}
            </Button>
          ))}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom>Colors</Typography>
        
        <Typography variant="caption">Foreground</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          {ANSI_COLORS.map((color) => (
            <Tooltip key={color.id} title={color.name}>
              <Box
                onClick={() => setForegroundColor(color.id)}
                sx={{
                  width: 24,
                  height: 24,
                  backgroundColor: color.hex,
                  border: foregroundColor === color.id ? '2px solid #fff' : '1px solid #333',
                  cursor: 'pointer',
                  boxShadow: foregroundColor === color.id ? '0 0 0 1px #000' : 'none'
                }}
              />
            </Tooltip>
          ))}
        </Box>

        <Typography variant="caption">Background</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          {ANSI_COLORS.map((color) => (
            <Tooltip key={color.id} title={color.name}>
              <Box
                onClick={() => setBackgroundColor(color.id)}
                sx={{
                  width: 24,
                  height: 24,
                  backgroundColor: color.hex,
                  border: backgroundColor === color.id ? '2px solid #fff' : '1px solid #333',
                  cursor: 'pointer',
                  boxShadow: backgroundColor === color.id ? '0 0 0 1px #000' : 'none'
                }}
              />
            </Tooltip>
          ))}
        </Box>

        <Divider sx={{ my: 2 }} />

        <FormControlLabel
          control={
            <Switch
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
            />
          }
          label="Show Grid"
        />
      </Paper>

      {/* Main canvas area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <Paper sx={{ p: 1, mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Menu</InputLabel>
              <Select
                value={selectedMenu?.id || ''}
                onChange={(e) => loadMenu(e.target.value)}
                label="Menu"
              >
                {menus.map((menu) => (
                  <MenuItem key={menu.id} value={menu.id}>
                    {menu.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setMenuDialog(true)}
            >
              New Menu
            </Button>

            <Box sx={{ flexGrow: 1 }} />

            <IconButton size="small" onClick={undo} disabled={historyIndex <= 0}>
              <UndoIcon />
            </IconButton>
            <IconButton size="small" onClick={redo} disabled={historyIndex >= history.length - 1}>
              <RedoIcon />
            </IconButton>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            <Button
              size="small"
              startIcon={<SaveIcon />}
              onClick={saveLayout}
              disabled={!selectedMenu}
            >
              Save
            </Button>

            <Button
              size="small"
              startIcon={<PreviewIcon />}
              onClick={generateAnsiPreview}
              disabled={!selectedMenu}
            >
              Preview
            </Button>

            <Button
              size="small"
              startIcon={<TemplateIcon />}
              onClick={() => setTemplateDialog(true)}
            >
              Templates
            </Button>
          </Box>
        </Paper>

        {/* Canvas and properties */}
        <Box sx={{ flex: 1, display: 'flex', gap: 2 }}>
          {/* Canvas container */}
          <Paper sx={{ flex: 1, overflow: 'auto', bgcolor: '#1a1a1a', p: 2 }}>
            <canvas
              ref={canvasRef}
              style={{ cursor: 'crosshair' }}
              onMouseDown={(e) => {
                const rect = canvasRef.current.getBoundingClientRect();
                const x = Math.floor((e.clientX - rect.left) / 10);
                const y = Math.floor((e.clientY - rect.top) / 20);
                handleCellClick(x, y);
              }}
              onMouseMove={(e) => {
                const rect = canvasRef.current.getBoundingClientRect();
                const x = Math.floor((e.clientX - rect.left) / 10);
                const y = Math.floor((e.clientY - rect.top) / 20);
                handleCellMove(x, y);
                setSelectedCell({ x, y });
              }}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => setSelectedCell(null)}
            />
          </Paper>

          {/* Right sidebar - Menu items */}
          <Paper sx={{ width: 300, p: 2, overflowY: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Menu Items
            </Typography>

            <List>
              {menuItems.map((item) => (
                <ListItem key={item.id}>
                  <ListItemText
                    primary={`[${item.hotkey}] ${item.label}`}
                    secondary={`${item.action_type}: ${JSON.stringify(item.action_data)}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEditingItem(item);
                        setItemDialog(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => deleteMenuItem(item.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>

            {selectedCell && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2">
                  Position: {selectedCell.x}, {selectedCell.y}
                </Typography>
              </>
            )}
          </Paper>
        </Box>
      </Box>

      {/* Menu Dialog */}
      <Dialog open={menuDialog} onClose={() => setMenuDialog(false)}>
        <DialogTitle>Create New Menu</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            fullWidth
            margin="normal"
            id="menu-name"
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            id="menu-description"
          />
          <TextField
            label="Width"
            type="number"
            defaultValue={80}
            margin="normal"
            id="menu-width"
            sx={{ mr: 2 }}
          />
          <TextField
            label="Height"
            type="number"
            defaultValue={25}
            margin="normal"
            id="menu-height"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMenuDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              const name = document.getElementById('menu-name').value;
              const description = document.getElementById('menu-description').value;
              const width = parseInt(document.getElementById('menu-width').value);
              const height = parseInt(document.getElementById('menu-height').value);

              try {
                const response = await fetch('/api/menus', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                  },
                  body: JSON.stringify({ name, description, width, height })
                });

                if (response.ok) {
                  const data = await response.json();
                  fetchMenus();
                  loadMenu(data.menu.id);
                  setMenuDialog(false);
                  showSnackbar('Menu created successfully', 'success');
                }
              } catch (error) {
                console.error('Error creating menu:', error);
                showSnackbar('Failed to create menu', 'error');
              }
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Menu Item Dialog */}
      <Dialog open={itemDialog} onClose={() => setItemDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem?.id ? 'Edit' : 'Add'} Menu Item</DialogTitle>
        <DialogContent>
          <TextField
            label="Hotkey"
            value={editingItem?.hotkey || ''}
            onChange={(e) => setEditingItem({ ...editingItem, hotkey: e.target.value.toUpperCase().slice(-1) })}
            fullWidth
            margin="normal"
            inputProps={{ maxLength: 1 }}
          />
          <TextField
            label="Label"
            value={editingItem?.label || ''}
            onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
            fullWidth
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Action Type</InputLabel>
            <Select
              value={editingItem?.action_type || 'command'}
              onChange={(e) => setEditingItem({ ...editingItem, action_type: e.target.value })}
              label="Action Type"
            >
              <MenuItem value="command">Command</MenuItem>
              <MenuItem value="submenu">Submenu</MenuItem>
              <MenuItem value="script">Script</MenuItem>
              <MenuItem value="external">External Program</MenuItem>
            </Select>
          </FormControl>
          
          {editingItem?.action_type === 'command' && (
            <TextField
              label="Command"
              value={editingItem?.action_data?.command || ''}
              onChange={(e) => setEditingItem({
                ...editingItem,
                action_data: { ...editingItem.action_data, command: e.target.value }
              })}
              fullWidth
              margin="normal"
            />
          )}

          {editingItem?.action_type === 'submenu' && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Target Menu</InputLabel>
              <Select
                value={editingItem?.action_data?.menu_id || ''}
                onChange={(e) => setEditingItem({
                  ...editingItem,
                  action_data: { ...editingItem.action_data, menu_id: e.target.value }
                })}
                label="Target Menu"
              >
                {menus.filter(m => m.id !== selectedMenu?.id).map((menu) => (
                  <MenuItem key={menu.id} value={menu.id}>
                    {menu.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            label="Min User Level"
            type="number"
            value={editingItem?.min_user_level || 1}
            onChange={(e) => setEditingItem({ ...editingItem, min_user_level: parseInt(e.target.value) })}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => saveMenuItem(editingItem)}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <AnsiPreviewDialog
        open={previewDialog}
        onClose={() => setPreviewDialog(false)}
        menuId={selectedMenu?.id}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
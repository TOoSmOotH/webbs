import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Forum,
  Lock,
  LockOpen,
} from '@mui/icons-material';
import axios from 'axios';

export default function Boards() {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
  });

  useEffect(() => {
    fetchBoards();
  }, []);

  const fetchBoards = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/boards');
      // The API returns { boards: [...], total, page, limit }
      setBoards(response.data?.boards || []);
      setError(null);
    } catch (error) {
      setError('Failed to load boards');
      console.error('Error fetching boards:', error);
      setBoards([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditBoard = (board) => {
    setSelectedBoard(board);
    setFormData({
      name: board.name,
      description: board.description,
      category: board.category,
    });
    setDialogOpen(true);
  };

  const handleAddBoard = () => {
    setSelectedBoard(null);
    setFormData({
      name: '',
      description: '',
      category: '',
    });
    setDialogOpen(true);
  };

  const handleSaveBoard = async () => {
    try {
      if (selectedBoard) {
        await axios.put(`/api/admin/boards/${selectedBoard.id}`, formData);
      } else {
        await axios.post('/api/admin/boards', formData);
      }
      fetchBoards();
      setDialogOpen(false);
    } catch (error) {
      console.error('Error saving board:', error);
    }
  };

  const handleToggleLock = async (boardId, currentStatus) => {
    try {
      await axios.put(`/api/admin/boards/${boardId}/lock`, {
        locked: !currentStatus,
      });
      fetchBoards();
    } catch (error) {
      console.error('Error toggling board lock:', error);
    }
  };

  const handleDeleteBoard = async (boardId) => {
    if (window.confirm('Are you sure you want to delete this board?')) {
      try {
        await axios.delete(`/api/admin/boards/${boardId}`);
        fetchBoards();
      } catch (error) {
        console.error('Error deleting board:', error);
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Boards
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Boards</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddBoard}
        >
          Add Board
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Posts</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.isArray(boards) && boards.map((board) => (
              <TableRow key={board.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Forum sx={{ mr: 1, color: 'text.secondary' }} />
                    {board.name}
                  </Box>
                </TableCell>
                <TableCell>{board.description}</TableCell>
                <TableCell>
                  <Chip label={board.category || 'General'} size="small" />
                </TableCell>
                <TableCell>{board.message_count || 0}</TableCell>
                <TableCell>
                  {!board.is_active ? (
                    <Chip
                      label="Locked"
                      color="error"
                      size="small"
                      icon={<Lock />}
                    />
                  ) : (
                    <Chip
                      label="Open"
                      color="success"
                      size="small"
                      icon={<LockOpen />}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleEditBoard(board)}
                    color="primary"
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleToggleLock(board.id, board.locked)}
                    color={board.locked ? 'success' : 'warning'}
                  >
                    {board.locked ? <LockOpen /> : <Lock />}
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteBoard(board.id)}
                    color="error"
                  >
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Board Edit/Add Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedBoard ? 'Edit Board' : 'Add New Board'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Board Name"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Category"
            fullWidth
            variant="outlined"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveBoard} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
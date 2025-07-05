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
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Search,
  Delete,
  Visibility,
  FilterList,
  Upload,
  Palette,
  Edit,
  Download,
  ViewList,
  ViewModule,
  Refresh,
} from '@mui/icons-material';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

export default function AnsiArt() {
  const [ansiArt, setAnsiArt] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedArt, setSelectedArt] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    file: null,
    category_id: '',
    title: '',
    artist: '',
    group_name: '',
    year: '',
    description: ''
  });

  useEffect(() => {
    fetchAnsiArt();
    fetchCategories();
  }, []);

  const fetchAnsiArt = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/admin/ansi-art`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      setAnsiArt(response.data.ansiArt || []);
      setError(null);
    } catch (error) {
      setError('Failed to load ANSI art');
      console.error('Error fetching ANSI art:', error);
      setAnsiArt([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_BASE}/ansi-art/categories/list`);
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleDeleteArt = async (artId) => {
    if (window.confirm('Are you sure you want to delete this ANSI art?')) {
      try {
        await axios.delete(`${API_BASE}/ansi-art/${artId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('adminToken')}`
          }
        });
        fetchAnsiArt();
      } catch (error) {
        console.error('Error deleting ANSI art:', error);
        alert('Failed to delete ANSI art');
      }
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file) {
      alert('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadForm.file);
    formData.append('category_id', uploadForm.category_id || '14'); // Default to Misc
    formData.append('title', uploadForm.title);
    formData.append('artist', uploadForm.artist);
    formData.append('group_name', uploadForm.group_name);
    formData.append('year', uploadForm.year);
    formData.append('description', uploadForm.description);

    try {
      await axios.post(`${API_BASE}/ansi-art/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      setUploadDialogOpen(false);
      setUploadForm({
        file: null,
        category_id: '',
        title: '',
        artist: '',
        group_name: '',
        year: '',
        description: ''
      });
      fetchAnsiArt();
    } catch (error) {
      console.error('Error uploading ANSI art:', error);
      alert('Failed to upload ANSI art: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdate = async () => {
    if (!selectedArt) return;

    try {
      await axios.put(`${API_BASE}/ansi-art/${selectedArt.id}`, {
        title: selectedArt.title,
        artist: selectedArt.artist,
        group_name: selectedArt.group_name,
        year: selectedArt.year,
        description: selectedArt.description,
        category_id: selectedArt.category_id,
        is_active: selectedArt.is_active
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      setEditDialogOpen(false);
      fetchAnsiArt();
    } catch (error) {
      console.error('Error updating ANSI art:', error);
      alert('Failed to update ANSI art');
    }
  };

  const filteredArt = ansiArt.filter((art) => {
    const matchesSearch =
      art.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.artist?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.group_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.original_filename?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || art.category_id == categoryFilter;
    return matchesSearch && matchesCategory;
  });

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
          ANSI Art
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          ANSI Art Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Upload />}
          onClick={() => setUploadDialogOpen(true)}
        >
          Upload ANSI Art
        </Button>
      </Box>

      <Paper sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search ANSI art..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel id="category-filter-label">Category</InputLabel>
            <Select
              labelId="category-filter-label"
              value={categoryFilter}
              label="Category"
              onChange={(e) => setCategoryFilter(e.target.value)}
              startAdornment={<FilterList sx={{ mr: 1, ml: 1 }} />}
            >
              <MenuItem value="all">All Categories</MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => newMode && setViewMode(newMode)}
            aria-label="view mode"
          >
            <ToggleButton value="grid" aria-label="grid view">
              <ViewModule />
            </ToggleButton>
            <ToggleButton value="list" aria-label="list view">
              <ViewList />
            </ToggleButton>
          </ToggleButtonGroup>
          <IconButton onClick={fetchAnsiArt}>
            <Refresh />
          </IconButton>
        </Box>
      </Paper>

      {viewMode === 'grid' ? (
        <Grid container spacing={3}>
          {filteredArt.map((art) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={art.id}>
              <Card>
                <CardMedia
                  component="div"
                  sx={{
                    height: 200,
                    backgroundColor: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    '&:hover': {
                      opacity: 0.8,
                    },
                  }}
                  onClick={() => {
                    setSelectedArt(art);
                    setPreviewDialogOpen(true);
                  }}
                >
                  <Box sx={{ textAlign: 'center', color: '#fff' }}>
                    <Palette sx={{ fontSize: 48, mb: 1 }} />
                    <Typography variant="caption">Click to preview</Typography>
                  </Box>
                </CardMedia>
                <CardContent>
                  <Typography variant="h6" noWrap>
                    {art.title || art.original_filename}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {art.artist && `By ${art.artist}`}
                    {art.group_name && ` / ${art.group_name}`}
                    {art.year && ` (${art.year})`}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={art.category_name || 'Uncategorized'}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                </CardContent>
                <CardActions>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedArt(art);
                      setEditDialogOpen(true);
                    }}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => window.open(`${API_BASE}/ansi-art/${art.id}/raw`, '_blank')}
                  >
                    <Download />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteArt(art.id)}
                  >
                    <Delete />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title/Filename</TableCell>
                <TableCell>Artist</TableCell>
                <TableCell>Group</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Year</TableCell>
                <TableCell>Views</TableCell>
                <TableCell>Uploaded</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredArt.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No ANSI art found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredArt.map((art) => (
                  <TableRow key={art.id}>
                    <TableCell>
                      <Typography variant="body2">
                        {art.title || art.original_filename}
                      </Typography>
                    </TableCell>
                    <TableCell>{art.artist || '-'}</TableCell>
                    <TableCell>{art.group_name || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={art.category_name || 'Uncategorized'}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{art.year || '-'}</TableCell>
                    <TableCell>{art.view_count || 0}</TableCell>
                    <TableCell>
                      {new Date(art.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Preview">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedArt(art);
                            setPreviewDialogOpen(true);
                          }}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedArt(art);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download">
                        <IconButton
                          size="small"
                          onClick={() => window.open(`${API_BASE}/ansi-art/${art.id}/raw`, '_blank')}
                        >
                          <Download />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteArt(art.id)}
                        >
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload ANSI Art</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Button
              variant="outlined"
              component="label"
              fullWidth
            >
              {uploadForm.file ? uploadForm.file.name : 'Select ANSI File (.ans, .asc, .txt)'}
              <input
                type="file"
                hidden
                accept=".ans,.asc,.txt,.nfo,.diz"
                onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
              />
            </Button>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={uploadForm.category_id}
                label="Category"
                onChange={(e) => setUploadForm({ ...uploadForm, category_id: e.target.value })}
              >
                {categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Title"
              value={uploadForm.title}
              onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
              fullWidth
            />
            <TextField
              label="Artist"
              value={uploadForm.artist}
              onChange={(e) => setUploadForm({ ...uploadForm, artist: e.target.value })}
              fullWidth
            />
            <TextField
              label="Group"
              value={uploadForm.group_name}
              onChange={(e) => setUploadForm({ ...uploadForm, group_name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Year"
              type="number"
              value={uploadForm.year}
              onChange={(e) => setUploadForm({ ...uploadForm, year: e.target.value })}
              fullWidth
            />
            <TextField
              label="Description"
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpload} variant="contained" disabled={!uploadForm.file}>
            Upload
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit ANSI Art</DialogTitle>
        <DialogContent>
          {selectedArt && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedArt.category_id || ''}
                  label="Category"
                  onChange={(e) => setSelectedArt({ ...selectedArt, category_id: e.target.value })}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Title"
                value={selectedArt.title || ''}
                onChange={(e) => setSelectedArt({ ...selectedArt, title: e.target.value })}
                fullWidth
              />
              <TextField
                label="Artist"
                value={selectedArt.artist || ''}
                onChange={(e) => setSelectedArt({ ...selectedArt, artist: e.target.value })}
                fullWidth
              />
              <TextField
                label="Group"
                value={selectedArt.group_name || ''}
                onChange={(e) => setSelectedArt({ ...selectedArt, group_name: e.target.value })}
                fullWidth
              />
              <TextField
                label="Year"
                type="number"
                value={selectedArt.year || ''}
                onChange={(e) => setSelectedArt({ ...selectedArt, year: e.target.value })}
                fullWidth
              />
              <TextField
                label="Description"
                value={selectedArt.description || ''}
                onChange={(e) => setSelectedArt({ ...selectedArt, description: e.target.value })}
                multiline
                rows={3}
                fullWidth
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdate} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {selectedArt?.title || selectedArt?.original_filename}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {selectedArt && (
            <iframe
              src={`${API_BASE}/ansi-art/${selectedArt.id}/preview`}
              style={{
                width: '100%',
                height: '600px',
                border: 'none',
                backgroundColor: '#000',
              }}
              title="ANSI Art Preview"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
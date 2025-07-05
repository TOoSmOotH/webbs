import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  useTheme,
} from '@mui/material';
import {
  People,
  Forum,
  CloudUpload,
  TrendingUp,
  Storage,
  AccessTime,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import axios from 'axios';

const StatCard = ({ title, value, icon, color, loading }) => {
  const theme = useTheme();
  
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              backgroundColor: `${color}.light`,
              borderRadius: 2,
              p: 1,
              mr: 2,
            }}
          >
            {React.cloneElement(icon, { sx: { color: `${color}.main` } })}
          </Box>
          <Typography color="text.secondary" variant="body2">
            {title}
          </Typography>
        </Box>
        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <Typography variant="h4" component="div">
            {value}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default function Dashboard() {
  const theme = useTheme();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/admin/stats');
      // Transform the data to match our UI expectations
      setStats({
        totalUsers: response.data.users.total,
        totalPosts: response.data.messages.total,
        totalFiles: response.data.files.total,
        activeToday: response.data.users.active,
        storageUsed: '0 MB', // Would need backend implementation
        storageTotal: '10 GB', // Would need backend implementation
        databaseSize: '0 MB', // Would need backend implementation
        uptime: '0 days', // Would need backend implementation
      });
      setError(null);
    } catch (error) {
      setError('Failed to load statistics');
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sample data for charts - in production, this would come from the API
  const activityData = [
    { date: 'Mon', posts: 65, users: 45 },
    { date: 'Tue', posts: 78, users: 52 },
    { date: 'Wed', posts: 90, users: 61 },
    { date: 'Thu', posts: 81, users: 55 },
    { date: 'Fri', posts: 92, users: 68 },
    { date: 'Sat', posts: 103, users: 72 },
    { date: 'Sun', posts: 87, users: 65 },
  ];

  const fileTypeData = [
    { name: 'Documents', value: 35, color: theme.palette.primary.main },
    { name: 'Images', value: 30, color: theme.palette.secondary.main },
    { name: 'Software', value: 20, color: theme.palette.success.main },
    { name: 'Media', value: 15, color: theme.palette.warning.main },
  ];

  const boardActivityData = [
    { name: 'General', posts: 450 },
    { name: 'Tech', posts: 380 },
    { name: 'Gaming', posts: 320 },
    { name: 'News', posts: 280 },
    { name: 'Random', posts: 240 },
  ];

  if (error) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Users"
            value={stats?.totalUsers || 0}
            icon={<People />}
            color="primary"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Posts"
            value={stats?.totalPosts || 0}
            icon={<Forum />}
            color="secondary"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Files"
            value={stats?.totalFiles || 0}
            icon={<CloudUpload />}
            color="success"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Today"
            value={stats?.activeToday || 0}
            icon={<TrendingUp />}
            color="warning"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Activity Chart */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Weekly Activity
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="posts"
                  stackId="1"
                  stroke={theme.palette.primary.main}
                  fill={theme.palette.primary.light}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  stackId="1"
                  stroke={theme.palette.secondary.main}
                  fill={theme.palette.secondary.light}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* File Types Pie Chart */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              File Types Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={fileTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name} ${entry.value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {fileTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Board Activity */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Board Activity
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={boardActivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="posts" fill={theme.palette.primary.main} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* System Info */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Storage sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6">System Information</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Storage Used
              </Typography>
              <Typography variant="body2">
                {stats?.storageUsed || '0 MB'} / {stats?.storageTotal || '0 GB'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Database Size
              </Typography>
              <Typography variant="body2">
                {stats?.databaseSize || '0 MB'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                System Uptime
              </Typography>
              <Typography variant="body2">
                {stats?.uptime || '0 days'}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AccessTime sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6">Recent Activity</Typography>
            </Box>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {stats?.recentActivity?.map((activity, index) => (
                <Box key={index} sx={{ mb: 1 }}>
                  <Typography variant="body2">
                    {activity.user} {activity.action} at {activity.time}
                  </Typography>
                </Box>
              )) || (
                <Typography variant="body2" color="text.secondary">
                  No recent activity
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
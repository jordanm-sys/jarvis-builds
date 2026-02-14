const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3334;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Helper function to ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch (error) {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Helper function to get daily data file path
function getDailyDataPath(date) {
  return path.join(__dirname, 'data', `${date}.json`);
}

// Helper function to get or create daily data
async function getDailyData(date) {
  const filePath = getDailyDataPath(date);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist, create default structure
    const defaultData = {
      date,
      nutrition: {
        meals: {
          breakfast: [],
          lunch: [],
          dinner: [],
          snacks: []
        },
        totalCalories: 0,
        calorieGoal: 2000
      },
      workouts: {
        exercises: [],
        totalCaloriesBurned: 0
      },
      notes: ""
    };
    await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
}

// API Routes

// Get daily data
app.get('/api/daily/:date', async (req, res) => {
  try {
    await ensureDataDir();
    const data = await getDailyData(req.params.date);
    res.json(data);
  } catch (error) {
    console.error('Error getting daily data:', error);
    res.status(500).json({ error: 'Failed to get daily data' });
  }
});

// Save daily data
app.post('/api/daily/:date', async (req, res) => {
  try {
    await ensureDataDir();
    const filePath = getDailyDataPath(req.params.date);
    await fs.writeFile(filePath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving daily data:', error);
    res.status(500).json({ error: 'Failed to save daily data' });
  }
});

// Get foods database
app.get('/api/foods', async (req, res) => {
  try {
    const foodsPath = path.join(__dirname, 'foods.json');
    const data = await fs.readFile(foodsPath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error getting foods:', error);
    res.status(500).json({ error: 'Failed to get foods database' });
  }
});

// Get exercises database
app.get('/api/exercises', async (req, res) => {
  try {
    const exercisesPath = path.join(__dirname, 'exercises.json');
    const data = await fs.readFile(exercisesPath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error getting exercises:', error);
    res.status(500).json({ error: 'Failed to get exercises database' });
  }
});

// Get calendar data (all dates with data)
app.get('/api/calendar', async (req, res) => {
  try {
    await ensureDataDir();
    const dataDir = path.join(__dirname, 'data');
    const files = await fs.readdir(dataDir);
    const dates = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .sort();
    
    const calendarData = {};
    for (const date of dates) {
      const data = await getDailyData(date);
      calendarData[date] = {
        totalCalories: data.nutrition.totalCalories,
        calorieGoal: data.nutrition.calorieGoal,
        totalCaloriesBurned: data.workouts.totalCaloriesBurned,
        workoutCount: data.workouts.exercises.length
      };
    }
    
    res.json(calendarData);
  } catch (error) {
    console.error('Error getting calendar data:', error);
    res.status(500).json({ error: 'Failed to get calendar data' });
  }
});

app.listen(PORT, () => {
  console.log(`🏃‍♀️ Fitness Tracker running on http://localhost:${PORT}`);
});
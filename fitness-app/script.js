// Global variables
let currentDate = new Date().toISOString().split('T')[0];
let dailyData = null;
let foodsDatabase = null;
let exercisesDatabase = null;
let calendarData = {};

// DOM elements
const elements = {
    currentDateBtn: document.getElementById('currentDate'),
    prevDayBtn: document.getElementById('prevDay'),
    nextDayBtn: document.getElementById('nextDay'),
    showCalendarBtn: document.getElementById('showCalendar'),
    caloriesConsumed: document.getElementById('caloriesConsumed'),
    calorieGoal: document.getElementById('calorieGoal'),
    caloriesBurned: document.getElementById('caloriesBurned'),
    netCalories: document.getElementById('netCalories'),
    progressFill: document.getElementById('progressFill'),
    addFoodBtn: document.getElementById('addFood'),
    addExerciseBtn: document.getElementById('addExercise'),
    dailyNotes: document.getElementById('dailyNotes'),
    calorieGoalInput: document.getElementById('calorieGoalInput'),
    updateGoalBtn: document.getElementById('updateGoal'),
    totalExercises: document.getElementById('totalExercises'),
    totalCaloriesBurned: document.getElementById('totalCaloriesBurned'),
    
    // Modals
    calendarModal: document.getElementById('calendarModal'),
    foodModal: document.getElementById('foodModal'),
    exerciseModal: document.getElementById('exerciseModal'),
    exerciseDetailsModal: document.getElementById('exerciseDetailsModal'),
    
    // Modal controls
    closeCalendar: document.getElementById('closeCalendar'),
    closeFoodModal: document.getElementById('closeFoodModal'),
    closeExerciseModal: document.getElementById('closeExerciseModal'),
    closeExerciseDetailsModal: document.getElementById('closeExerciseDetailsModal'),
    
    // Calendar
    calendarMonth: document.getElementById('calendarMonth'),
    calendarGrid: document.getElementById('calendarGrid'),
    prevMonth: document.getElementById('prevMonth'),
    nextMonth: document.getElementById('nextMonth'),
    
    // Food modal
    foodSearch: document.getElementById('foodSearch'),
    foodResults: document.getElementById('foodResults'),
    mealSelect: document.getElementById('mealSelect'),
    
    // Exercise modal
    exerciseSearch: document.getElementById('exerciseSearch'),
    exerciseResults: document.getElementById('exerciseResults'),
    
    // Exercise details
    exerciseDetailsTitle: document.getElementById('exerciseDetailsTitle'),
    exerciseInput: document.getElementById('exerciseInput'),
    exerciseInputLabel: document.getElementById('exerciseInputLabel'),
    setsRepsGroup: document.getElementById('setsRepsGroup'),
    setsInput: document.getElementById('setsInput'),
    repsInput: document.getElementById('repsInput'),
    estimatedCalories: document.getElementById('estimatedCalories'),
    addExerciseToLog: document.getElementById('addExerciseToLog')
};

let currentCalendarDate = new Date();
let selectedExercise = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await loadDatabases();
    await loadDailyData(currentDate);
    setupEventListeners();
    updateDateDisplay();
});

// Load databases
async function loadDatabases() {
    try {
        const [foodsResponse, exercisesResponse] = await Promise.all([
            fetch('/api/foods'),
            fetch('/api/exercises')
        ]);
        
        foodsDatabase = await foodsResponse.json();
        exercisesDatabase = await exercisesResponse.json();
    } catch (error) {
        console.error('Error loading databases:', error);
    }
}

// Load daily data
async function loadDailyData(date) {
    try {
        const response = await fetch(`/api/daily/${date}`);
        dailyData = await response.json();
        
        elements.calorieGoalInput.value = dailyData.nutrition.calorieGoal;
        elements.dailyNotes.value = dailyData.notes || '';
        
        renderNutrition();
        renderWorkouts();
        updateSummary();
    } catch (error) {
        console.error('Error loading daily data:', error);
    }
}

// Save daily data
async function saveDailyData() {
    if (!dailyData) return;
    
    try {
        const response = await fetch(`/api/daily/${currentDate}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dailyData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save data');
        }
    } catch (error) {
        console.error('Error saving daily data:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Date navigation
    elements.prevDayBtn.addEventListener('click', () => navigateDay(-1));
    elements.nextDayBtn.addEventListener('click', () => navigateDay(1));
    elements.showCalendarBtn.addEventListener('click', showCalendarModal);
    
    // Modal controls
    elements.closeCalendar.addEventListener('click', hideCalendarModal);
    elements.closeFoodModal.addEventListener('click', hideFoodModal);
    elements.closeExerciseModal.addEventListener('click', hideExerciseModal);
    elements.closeExerciseDetailsModal.addEventListener('click', hideExerciseDetailsModal);
    
    // Calendar navigation
    elements.prevMonth.addEventListener('click', () => navigateMonth(-1));
    elements.nextMonth.addEventListener('click', () => navigateMonth(1));
    
    // Add buttons
    elements.addFoodBtn.addEventListener('click', showFoodModal);
    elements.addExerciseBtn.addEventListener('click', showExerciseModal);
    
    // Food search and categories
    elements.foodSearch.addEventListener('input', filterFoods);
    document.querySelectorAll('.food-categories .category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => filterFoodsByCategory(e.target.dataset.category));
    });
    
    // Exercise search and categories
    elements.exerciseSearch.addEventListener('input', filterExercises);
    document.querySelectorAll('.exercise-categories .category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => filterExercisesByCategory(e.target.dataset.category));
    });
    
    // Goal update
    elements.updateGoalBtn.addEventListener('click', updateCalorieGoal);
    
    // Notes auto-save
    elements.dailyNotes.addEventListener('blur', () => {
        if (dailyData) {
            dailyData.notes = elements.dailyNotes.value;
            saveDailyData();
        }
    });
    
    // Exercise details
    elements.exerciseInput.addEventListener('input', updateEstimatedCalories);
    elements.setsInput.addEventListener('input', updateEstimatedCalories);
    elements.repsInput.addEventListener('input', updateEstimatedCalories);
    elements.addExerciseToLog.addEventListener('click', addExerciseToLog);
    
    // Close modals on outside click
    [elements.calendarModal, elements.foodModal, elements.exerciseModal, elements.exerciseDetailsModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
}

// Date navigation
function navigateDay(direction) {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + direction);
    currentDate = date.toISOString().split('T')[0];
    loadDailyData(currentDate);
    updateDateDisplay();
}

function updateDateDisplay() {
    const date = new Date(currentDate);
    const options = { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    };
    elements.currentDateBtn.textContent = date.toLocaleDateString('en-US', options);
}

// Calendar functionality
async function showCalendarModal() {
    try {
        const response = await fetch('/api/calendar');
        calendarData = await response.json();
    } catch (error) {
        console.error('Error loading calendar data:', error);
    }
    
    renderCalendar();
    elements.calendarModal.classList.add('show');
}

function hideCalendarModal() {
    elements.calendarModal.classList.remove('show');
}

function navigateMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalendar();
}

function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Update month display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    elements.calendarMonth.textContent = `${monthNames[month]} ${year}`;
    
    // Clear grid
    elements.calendarGrid.innerHTML = '';
    
    // Add day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const headerDiv = document.createElement('div');
        headerDiv.className = 'calendar-header-day';
        headerDiv.textContent = day;
        elements.calendarGrid.appendChild(headerDiv);
    });
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Add previous month's trailing days
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const dayDiv = createCalendarDay(
            prevMonth.getDate() - i,
            new Date(year, month - 1, prevMonth.getDate() - i),
            true
        );
        elements.calendarGrid.appendChild(dayDiv);
    }
    
    // Add current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = createCalendarDay(
            day,
            new Date(year, month, day),
            false
        );
        elements.calendarGrid.appendChild(dayDiv);
    }
    
    // Add next month's leading days to fill grid
    const totalCells = elements.calendarGrid.children.length - 7; // Subtract header row
    const remainingCells = 42 - totalCells; // 6 rows × 7 days
    for (let day = 1; day <= remainingCells; day++) {
        const dayDiv = createCalendarDay(
            day,
            new Date(year, month + 1, day),
            true
        );
        elements.calendarGrid.appendChild(dayDiv);
    }
}

function createCalendarDay(dayNumber, date, isOtherMonth) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    
    if (isOtherMonth) {
        dayDiv.classList.add('other-month');
    }
    
    const dateString = date.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    
    if (dateString === today) {
        dayDiv.classList.add('today');
    }
    
    if (calendarData[dateString]) {
        dayDiv.classList.add('has-data');
    }
    
    const numberDiv = document.createElement('div');
    numberDiv.className = 'calendar-day-number';
    numberDiv.textContent = dayNumber;
    dayDiv.appendChild(numberDiv);
    
    if (calendarData[dateString]) {
        const indicator = document.createElement('div');
        indicator.className = 'calendar-day-indicator';
        dayDiv.appendChild(indicator);
    }
    
    dayDiv.addEventListener('click', () => {
        currentDate = dateString;
        hideCalendarModal();
        loadDailyData(currentDate);
        updateDateDisplay();
    });
    
    return dayDiv;
}

// Nutrition functionality
function renderNutrition() {
    const mealSections = document.querySelectorAll('.meal-section');
    
    mealSections.forEach(section => {
        const mealType = section.dataset.meal;
        const itemsContainer = section.querySelector('.meal-items');
        const totalElement = section.querySelector('.meal-total');
        
        itemsContainer.innerHTML = '';
        
        const mealItems = dailyData.nutrition.meals[mealType] || [];
        let mealTotal = 0;
        
        mealItems.forEach((item, index) => {
            const itemDiv = createFoodItem(item, mealType, index);
            itemsContainer.appendChild(itemDiv);
            mealTotal += item.calories;
        });
        
        totalElement.textContent = `${mealTotal} calories`;
    });
    
    calculateNutritionTotals();
}

function createFoodItem(food, mealType, index) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'food-item';
    
    itemDiv.innerHTML = `
        <div class="food-item-info">
            <div class="food-item-name">${food.name}</div>
            <div class="food-item-serving">${food.serving}</div>
        </div>
        <div class="food-item-calories">${food.calories} cal</div>
        <button class="delete-btn" onclick="removeFoodItem('${mealType}', ${index})">×</button>
    `;
    
    return itemDiv;
}

function removeFoodItem(mealType, index) {
    dailyData.nutrition.meals[mealType].splice(index, 1);
    renderNutrition();
    saveDailyData();
}

function calculateNutritionTotals() {
    let total = 0;
    Object.values(dailyData.nutrition.meals).forEach(meal => {
        meal.forEach(food => {
            total += food.calories;
        });
    });
    
    dailyData.nutrition.totalCalories = total;
    updateSummary();
}

// Workout functionality
function renderWorkouts() {
    const workoutList = document.getElementById('workoutList');
    workoutList.innerHTML = '';
    
    dailyData.workouts.exercises.forEach((exercise, index) => {
        const workoutDiv = createWorkoutItem(exercise, index);
        workoutList.appendChild(workoutDiv);
    });
    
    calculateWorkoutTotals();
}

function createWorkoutItem(exercise, index) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'workout-item';
    
    let detailsText = '';
    if (exercise.sets && exercise.reps) {
        detailsText = `${exercise.sets} sets × ${exercise.reps} reps`;
    } else if (exercise.duration) {
        detailsText = `${exercise.duration} ${exercise.unit}`;
    } else {
        detailsText = `${exercise.amount} ${exercise.unit}`;
    }
    
    itemDiv.innerHTML = `
        <div class="workout-item-info">
            <div class="workout-item-name">${exercise.name}</div>
            <div class="workout-item-details">${detailsText}</div>
        </div>
        <div class="workout-item-calories">${exercise.caloriesBurned} cal</div>
        <button class="delete-btn" onclick="removeWorkoutItem(${index})">×</button>
    `;
    
    return itemDiv;
}

function removeWorkoutItem(index) {
    dailyData.workouts.exercises.splice(index, 1);
    renderWorkouts();
    saveDailyData();
}

function calculateWorkoutTotals() {
    const total = dailyData.workouts.exercises.reduce((sum, exercise) => sum + exercise.caloriesBurned, 0);
    dailyData.workouts.totalCaloriesBurned = total;
    updateSummary();
}

// Summary updates
function updateSummary() {
    const consumed = dailyData.nutrition.totalCalories;
    const goal = dailyData.nutrition.calorieGoal;
    const burned = dailyData.workouts.totalCaloriesBurned;
    const net = consumed - burned;
    
    elements.caloriesConsumed.textContent = consumed;
    elements.calorieGoal.textContent = goal;
    elements.caloriesBurned.textContent = burned;
    elements.netCalories.textContent = net;
    
    elements.totalExercises.textContent = dailyData.workouts.exercises.length;
    elements.totalCaloriesBurned.textContent = burned;
    
    // Update progress bar
    const progress = Math.min((consumed / goal) * 100, 100);
    elements.progressFill.style.width = `${progress}%`;
    
    // Change color based on progress
    if (progress > 100) {
        elements.progressFill.style.background = 'linear-gradient(90deg, #e53e3e 0%, #c53030 100%)';
    } else {
        elements.progressFill.style.background = 'linear-gradient(90deg, #4fd1c7 0%, #38b2ac 100%)';
    }
}

function updateCalorieGoal() {
    const newGoal = parseInt(elements.calorieGoalInput.value);
    if (newGoal && newGoal > 0) {
        dailyData.nutrition.calorieGoal = newGoal;
        updateSummary();
        saveDailyData();
    }
}

// Food modal functionality
function showFoodModal() {
    renderAllFoods();
    elements.foodModal.classList.add('show');
}

function hideFoodModal() {
    elements.foodModal.classList.remove('show');
    elements.foodSearch.value = '';
}

function filterFoods() {
    const query = elements.foodSearch.value.toLowerCase();
    renderFilteredFoods(query);
}

function filterFoodsByCategory(category) {
    // Update active button
    document.querySelectorAll('.food-categories .category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderFoodsByCategory(category);
}

function renderAllFoods() {
    elements.foodResults.innerHTML = '';
    Object.keys(foodsDatabase.categories).forEach(category => {
        foodsDatabase.categories[category].forEach(food => {
            elements.foodResults.appendChild(createFoodResult(food));
        });
    });
}

function renderFilteredFoods(query) {
    elements.foodResults.innerHTML = '';
    Object.keys(foodsDatabase.categories).forEach(category => {
        foodsDatabase.categories[category]
            .filter(food => food.name.toLowerCase().includes(query))
            .forEach(food => {
                elements.foodResults.appendChild(createFoodResult(food));
            });
    });
}

function renderFoodsByCategory(category) {
    elements.foodResults.innerHTML = '';
    
    if (category === 'all') {
        renderAllFoods();
        return;
    }
    
    const foods = foodsDatabase.categories[category] || [];
    foods.forEach(food => {
        elements.foodResults.appendChild(createFoodResult(food));
    });
}

function createFoodResult(food) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'food-result';
    
    resultDiv.innerHTML = `
        <div class="food-result-info">
            <div class="food-result-name">${food.name}</div>
            <div class="food-result-serving">${food.serving}</div>
        </div>
        <div class="food-result-calories">${food.calories} cal</div>
    `;
    
    resultDiv.addEventListener('click', () => {
        addFoodToMeal(food);
    });
    
    return resultDiv;
}

function addFoodToMeal(food) {
    const mealType = elements.mealSelect.value;
    dailyData.nutrition.meals[mealType].push(food);
    renderNutrition();
    saveDailyData();
    hideFoodModal();
}

// Exercise modal functionality
function showExerciseModal() {
    renderAllExercises();
    elements.exerciseModal.classList.add('show');
}

function hideExerciseModal() {
    elements.exerciseModal.classList.remove('show');
    elements.exerciseSearch.value = '';
}

function filterExercises() {
    const query = elements.exerciseSearch.value.toLowerCase();
    renderFilteredExercises(query);
}

function filterExercisesByCategory(category) {
    // Update active button
    document.querySelectorAll('.exercise-categories .category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderExercisesByCategory(category);
}

function renderAllExercises() {
    elements.exerciseResults.innerHTML = '';
    Object.keys(exercisesDatabase.categories).forEach(category => {
        exercisesDatabase.categories[category].forEach(exercise => {
            elements.exerciseResults.appendChild(createExerciseResult(exercise, category));
        });
    });
}

function renderFilteredExercises(query) {
    elements.exerciseResults.innerHTML = '';
    Object.keys(exercisesDatabase.categories).forEach(category => {
        exercisesDatabase.categories[category]
            .filter(exercise => exercise.name.toLowerCase().includes(query))
            .forEach(exercise => {
                elements.exerciseResults.appendChild(createExerciseResult(exercise, category));
            });
    });
}

function renderExercisesByCategory(category) {
    elements.exerciseResults.innerHTML = '';
    
    if (category === 'all') {
        renderAllExercises();
        return;
    }
    
    const exercises = exercisesDatabase.categories[category] || [];
    exercises.forEach(exercise => {
        elements.exerciseResults.appendChild(createExerciseResult(exercise, category));
    });
}

function createExerciseResult(exercise, category) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'exercise-result';
    
    const calorieText = exercise.caloriesPerMinute ? 
        `${exercise.caloriesPerMinute} cal/min` : 
        `${exercise.caloriesPerRep} cal/rep`;
    
    resultDiv.innerHTML = `
        <div class="exercise-result-info">
            <div class="exercise-result-name">${exercise.name}</div>
            <div class="exercise-result-unit">Per ${exercise.unit}</div>
        </div>
        <div class="exercise-result-calories">${calorieText}</div>
    `;
    
    resultDiv.addEventListener('click', () => {
        showExerciseDetailsModal(exercise, category);
    });
    
    return resultDiv;
}

// Exercise details modal
function showExerciseDetailsModal(exercise, category) {
    selectedExercise = { ...exercise, category };
    elements.exerciseDetailsTitle.textContent = exercise.name;
    
    // Configure input based on exercise type
    if (exercise.unit === 'minutes' || exercise.unit === 'seconds') {
        elements.exerciseInputLabel.textContent = `Duration (${exercise.unit}):`;
        elements.setsRepsGroup.style.display = 'none';
        elements.exerciseInput.value = exercise.unit === 'minutes' ? 30 : 60;
    } else if (exercise.unit === 'reps') {
        elements.exerciseInputLabel.textContent = 'Total Reps:';
        elements.setsRepsGroup.style.display = 'flex';
        elements.exerciseInput.value = 10;
        elements.setsInput.value = 3;
        elements.repsInput.value = 10;
    }
    
    updateEstimatedCalories();
    hideExerciseModal();
    elements.exerciseDetailsModal.classList.add('show');
}

function hideExerciseDetailsModal() {
    elements.exerciseDetailsModal.classList.remove('show');
    selectedExercise = null;
}

function updateEstimatedCalories() {
    if (!selectedExercise) return;
    
    let calories = 0;
    const inputValue = parseInt(elements.exerciseInput.value) || 0;
    
    if (selectedExercise.caloriesPerMinute) {
        if (selectedExercise.unit === 'seconds') {
            calories = (selectedExercise.caloriesPerMinute * inputValue) / 60;
        } else {
            calories = selectedExercise.caloriesPerMinute * inputValue;
        }
    } else if (selectedExercise.caloriesPerRep) {
        if (elements.setsRepsGroup.style.display !== 'none') {
            const sets = parseInt(elements.setsInput.value) || 1;
            const reps = parseInt(elements.repsInput.value) || 1;
            calories = selectedExercise.caloriesPerRep * sets * reps;
        } else {
            calories = selectedExercise.caloriesPerRep * inputValue;
        }
    }
    
    elements.estimatedCalories.textContent = Math.round(calories);
}

function addExerciseToLog() {
    if (!selectedExercise) return;
    
    const inputValue = parseInt(elements.exerciseInput.value) || 0;
    let exerciseLog = {
        name: selectedExercise.name,
        category: selectedExercise.category,
        caloriesBurned: parseInt(elements.estimatedCalories.textContent)
    };
    
    if (selectedExercise.unit === 'minutes' || selectedExercise.unit === 'seconds') {
        exerciseLog.duration = inputValue;
        exerciseLog.unit = selectedExercise.unit;
    } else if (selectedExercise.unit === 'reps') {
        if (elements.setsRepsGroup.style.display !== 'none') {
            exerciseLog.sets = parseInt(elements.setsInput.value) || 1;
            exerciseLog.reps = parseInt(elements.repsInput.value) || 1;
        } else {
            exerciseLog.amount = inputValue;
            exerciseLog.unit = 'reps';
        }
    }
    
    dailyData.workouts.exercises.push(exerciseLog);
    renderWorkouts();
    saveDailyData();
    hideExerciseDetailsModal();
}

// Make functions globally available for HTML onclick handlers
window.removeFoodItem = removeFoodItem;
window.removeWorkoutItem = removeWorkoutItem;
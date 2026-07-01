import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. Load Configurations
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// 2. Initialize Supabase Connection
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Sends a message directly to your Telegram group chat
 */
async function sendTelegramNotification(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Telegram API Error:', errorData);
    }
  } catch (error) {
    console.error('❌ Failed to execute fetch request:', error);
  }
}

/**
 * Fetches uncompleted tasks from your Supabase database
 */
async function fetchActiveTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_completed', false);

  if (error) {
    console.error('❌ Error fetching tasks from Supabase:', error);
    return [];
  }
  return data;
}

/**
 * Evaluates progress thresholds and locks state to prevent duplicate notifications
 */
async function handleMilestoneLatching(task, progress) {
  let targetMilestone = null;
  let alertMessage = null;

  if (progress >= 100) {
    if (task.current_milestone !== 'overdue') {
      targetMilestone = 'overdue';
      alertMessage = `🚨 *OVERDUE TASK!* \n\nHey @${task.users}, your task *"${task.title}"* has officially missed its deadline! Resolve this immediately.`;
    }
  } else if (progress >= 80) {
    if (task.current_milestone !== '80' && task.current_milestone !== 'overdue') {
      targetMilestone = '80';
      alertMessage = `⚠️ *80% Milestone Alert* \n\n@${task.users}, your task *"${task.title}"* is *80%* through its time window. Wrap it up quickly!`;
    }
  } else if (progress >= 50) {
    if (task.current_milestone !== '50' && task.current_milestone !== '80' && task.current_milestone !== 'overdue') {
      targetMilestone = '50';
      alertMessage = `⚡ *50% Milestone Alert* \n\n@${task.users}, your task *"${task.title}"* is halfway through its deadline window. Keep moving!`;
    }
  }

  if (targetMilestone && alertMessage) {
    console.log(`🎯 Task [ID: ${task.id}] reached ${targetMilestone}% milestone. Updating DB latch...`);
    
    const { error } = await supabase
      .from('tasks')
      .update({ current_milestone: targetMilestone })
      .eq('id', task.id);

    if (!error) {
      await sendTelegramNotification(alertMessage);
      console.log(`💬 Telegram notification dispatched for Task ID ${task.id}`);
    } else {
      console.error(`❌ Database latching failed for task ${task.id}:`, error);
    }
  }
}

/**
 * Core engine runner that loops through tasks and runs the mathematical equations
 */
async function engineCheckCycle() {
  console.log(`\n--- [${new Date().toLocaleTimeString()}] Running validation cycle... ---`);
  
  const tasks = await fetchActiveTasks();
  const currentTime = Date.now();

  for (const task of tasks) {
    const createdAt = Date.parse(task.created_at);
    const reminderTime = Date.parse(task.reminder_time);

    const totalDuration = reminderTime - createdAt;
    const timePassed = currentTime - createdAt;

    if (totalDuration <= 0) continue;

    const progressPercentage = (timePassed / totalDuration) * 100;
    console.log(`Task "${task.title}" owned by ${task.users} is at ${progressPercentage.toFixed(2)}% progress.`);

    await handleMilestoneLatching(task, progressPercentage);
  }
}

// ==========================================
// 3. Web Server Routes & Automated Intervals
// ==========================================

// Web health check route
app.get('/', (req, res) => {
  res.status(200).json({ status: 'Engine Active', timestamp: new Date() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Accountability Engine active on port ${PORT}`);
  
  // 1. Run once immediately when the server boots up
  await engineCheckCycle();

  // 2. Automatically repeat the cycle every 60 seconds (60000 milliseconds)
  setInterval(async () => {
    await engineCheckCycle();
  }, 60000);
});
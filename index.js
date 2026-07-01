import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environmental variables from .env
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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

    if (response.ok) {
      console.log('✅ Telegram alert sent successfully!');
    } else {
      const errorData = await response.json();
      console.error('❌ Telegram API Error:', errorData);
    }
  } catch (error) {
    console.error('❌ Failed to execute fetch request:', error);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Engine listening on port ${PORT}`);
  console.log('Sending test alert to group chat...');
  
  // Fire off a test run message to your group!
  await sendTelegramNotification('🚀 *Accountability Engine Connected!* \n\nHey Dinesh and Thilip, our local project environment is officially ready.');
});
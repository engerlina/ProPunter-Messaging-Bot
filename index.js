const { Bot, GrammyError, HttpError } = require("grammy");
const { autoQuote } = require("@roziscoding/grammy-autoquote");
const fs = require("fs");
const path = require("path");
const moment = require('moment-timezone');
const schedule = require('node-schedule');
const OpenAI = require("openai");

if (fs.existsSync(".env")) {
  require("dotenv").config();
}

const botToken = process.env.BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!botToken) {
  throw new Error("BOT_TOKEN is not set in environment variables! Exiting...");
}

const weeklyPrompts = {
  Monday: "Day 1 (Monday): Reflection & Teasers Tactic: Start the week by reflecting on the past week's results. Example Post: 🔥 Last week's bets gave our members a whopping 75% profit including bonus backs! Curious about our strategy? Check our results here: https://bit.ly/propunterresults. 📊 Stay tuned for a sneak peek of tomorrow's tips!",
  Tuesday: "Day 2 (Tuesday): Testimonial Tuesday Tactic: Share testimonials from satisfied paid members. Example Post: 🗣️ 'Thanks to Propunter Premium, I've made consistent profits every week!' - Dave M. Galloping Gains Weekly/Champion's Monthly/Triple Crown Annual Member. Want to experience the same? Join our premium channel! 🏇🏽 Add the membership bot @ProPunter_bot and use the /subscribe command",
  Wednesday: "Day 3 (Wednesday): Big Race Day Promo Tactic: Offer a flash sale discount for new members, especially given that it's a big race day. Example Post: 🚀 WEDNESDAY FLASH SALE 🚀: Get 30% off our Champion's Choice Monthly plan for today only! Dive into today's races with expert tips! Use code: WEDRACE30 at checkout - Only for 1st time members",
  Thursday: "Day 4 (Thursday): Behind the Scenes Tactic: Share a behind-the-scenes look into how you select the tips – this builds trust and curiosity. Example Post: Ever wondered how we pick our winning horses? 🐎 We use a combination of Artificial Intelligence and a tonne of quantitative data to make our decisions in the last few minutes before every race. We believe that the flow of (smart) money often determines the race outcomes so we follow the money! ➡️ And for the full experience, join our premium channel!",
  Friday: "Day 5 (Friday): Weekend Warm-up Tactic: Hype the upcoming big race day and showcase the potential value of the premium channel for the weekend. Example Post: Weekend's here and so are the biggest races! 🏆 Get ready for tomorrow's 20+ races. Our premium members are already armed with the best tips. Want in? Join now and don't miss out! Add the membership bot @ProPunter_bot and use the /subscribe command",
  Saturday: "Day 6 (Saturday): Big Race Day Bonanza Tactic: Offer a limited-time discount for the weekly plan to entice users to experience the premium channel during the biggest race day. Example Post: 🎉 SATURDAY SPECIAL 🎉: Dive into today's 20+ races with our expert tips! Get 50% off our Galloping Gains Weekly plan for today only and for new members only! Experience the thrill of premium betting. Use code: SATBONANZA at checkout. Add the membership bot @ProPunter_bot and use the /subscribe command",
  Sunday: "Day 7 (Sunday): Reflection & Relaxation Tactic: Share aggregate results of Saturday's races and encourage members to gear up for the upcoming week. Example Post: What an exhilarating race day! 🎊 Our tips yielded fantastic results. Check out the full breakdown here: https://bit.ly/propunterresults. Relax and recharge today, and get ready for another week of top-notch tips! 🌟"
};

async function fetchMessageForToday() {
  const today = new Date().toLocaleString('en-US', { weekday: 'long' });
  const todayPrompt = weeklyPrompts[today];
  
  const openai = new OpenAI(openaiApiKey);

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        "role": "system",
        "content": "You are a Telegram moderator of a Horse Betting Group called ProPunter."
      },
      {
        "role": "user",
        "content": `Create a Telegram post ONLY based on the following guidance: ${todayPrompt}`
      }
    ],
    temperature: 1,
    max_tokens: 2000,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });
  
  return response.choices[0].message.content;
}

// This function converts 8:30AM AEST to the local time of the server
function getLocalTimeForAEST() {
  return moment.tz("08:30:00", "HH:mm:ss", "Australia/Sydney").tz(moment.tz.guess()).format("HH:mm:ss");
}

const timeToSend = getLocalTimeForAEST();

async function start() {
  const bot = new Bot(botToken);
  bot.use(autoQuote);

  const commandFilesDir = path.resolve(__dirname, "commands");
  const commandFiles = fs
    .readdirSync(commandFilesDir)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const command = require(path.join(commandFilesDir, file));
    bot.command(command.name, async (ctx) => {
      await command.handler(ctx);
    });

    if (command.alias) {
      for (const alias of command.alias) {
        bot.command(alias, async (ctx) => {
          await command.handler(ctx);
        });
      }
    }
  }

  bot.command("start", (ctx) =>
    ctx.reply("Hello!\n\n" + "Run the /help command to see what I can do!")
  );

  bot.command('sendmessage', async (ctx) => {
    if (ctx.chat.id === -1001925815386) { // Only allow this command for the specific chat/channel
        const message = await fetchMessageForToday();
        await ctx.reply(message);
    }
});

  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error("Error in request:", e.description);
    } else if (e instanceof HttpError) {
      console.error("Could not contact Telegram:", e);
    } else {
      console.error("Unknown error:", e);
    }
  });

  process.on("uncaughtException", (err) => {
    console.error(err);
  });

  process.on("unhandledRejection", (err) => {
    console.error(err);
  });

  process.on("SIGINT", () => {
    console.log("Stopping...");
    bot.stop();
    process.exit(0);
  });

// Schedule the message to be sent every 5 minutes
//const job = schedule.scheduleJob('*/5 * * * *', function() {
//  bot.api.sendMessage(-1001925815386, 'Testing 5 mins send');
//});

  // Schedule the message to be sent daily at 8:30AM AEST
  const job = schedule.scheduleJob(`0 30 8 * * *`, async function() {
    const message = await fetchMessageForToday();
    bot.api.sendMessage(-1001925815386, message);
  });

  console.log("Starting the bot...");
  await bot.start();
}

start().catch((error) => {
  console.error("Error occurred during bot startup:", error);
  process.exit(1);
});

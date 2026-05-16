require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = require('discord.js');
const Groq = require('groq-sdk');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const groq   = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Store each user's answers and current question index
const sessions = {};

// ─── Questions ────────────────────────────────────────────────────────────────
const questions = [
  { id: 'destination',      text: '🌍 Where are you dreaming of traveling to?',              type: 'modal',   placeholder: 'e.g. Tokyo, Japan' },
  { id: 'dates',            text: '🗓️ When are you planning to travel?',                      type: 'modal',   placeholder: 'e.g. June 10 – June 20' },
  { id: 'duration',         text: '⏳ How long should this adventure last?',                  type: 'modal',   placeholder: 'e.g. 7 days or 2 weeks' },
  { id: 'tripPurpose',      text: '🎯 What\'s the main purpose of this trip?',                type: 'buttons', options: ['Holiday & relaxation', 'Adventure & exploration', 'Honeymoon / romance', 'Business + leisure', 'Cultural deep-dive'] },
  { id: 'companions',       text: '👥 Who are you traveling with?',                          type: 'buttons', options: ['Solo', 'Couple', 'Friends', 'Family with kids'] },
  { id: 'budget',           text: '💰 What is your overall budget level?',                   type: 'buttons', options: ['Budget (under $50/day)', 'Mid-range ($50–150/day)', 'Comfortable ($150–300/day)', 'Luxury ($300+/day)'] },
  { id: 'budgetPriority',   text: '💳 Where do you want to spend more?',                     type: 'buttons', options: ['Food & dining', 'Accommodation', 'Activities & experiences', 'Shopping'] },
  { id: 'arrival',          text: '🛬 What time do you arrive on Day 1?',                    type: 'buttons', options: ['Early morning (before 9am)', 'Morning (9am–12pm)', 'Afternoon (12–6pm)', 'Evening / Night (after 6pm)'] },
  { id: 'departure',        text: '🛫 What time is your flight home on the last day?',       type: 'buttons', options: ['Early morning (before 10am)', 'Midday (10am–2pm)', 'Afternoon (2–6pm)', 'Evening (after 6pm)'] },
  { id: 'vibe',             text: '⚡ What\'s your preferred travel pace?',                   type: 'buttons', options: ['Relaxed — I need downtime', 'Balanced — mix of busy & chill', 'Packed — I want to see everything'] },
  { id: 'morningPerson',    text: '🌅 Are you a morning person or night owl?',               type: 'buttons', options: ['Morning person — up at 7am', 'Somewhere in between', 'Night owl — sleep in late'] },
  { id: 'activities',       text: '🎭 What kind of activities excite you most?',             type: 'buttons', options: ['Culture & history', 'Nature & outdoors', 'Adventure & thrills', 'Shopping & lifestyle'] },
  { id: 'mustSeeType',      text: '💎 Hidden gems or famous landmarks?',                     type: 'buttons', options: ['Hidden gems only', 'A mix of both', 'Famous spots — I want it all'] },
  { id: 'indoorOutdoor',    text: '🏕️ Do you prefer indoor or outdoor activities?',          type: 'buttons', options: ['Mostly outdoors', 'Mix of both', 'Mostly indoors'] },
  { id: 'physicalLevel',    text: '🏃 How physically active do you want to be?',             type: 'buttons', options: ['Low — easy walks only', 'Moderate — some hiking OK', 'High — bring on the challenge'] },
  { id: 'foodPrefs',        text: '🍜 Any dietary preferences?',                             type: 'buttons', options: ['No restrictions', 'Vegetarian', 'Vegan', 'Halal', 'Gluten-free'] },
  { id: 'foodAdventure',    text: '🌶️ How adventurous are you with food?',                   type: 'buttons', options: ['I\'ll try anything local!', 'Mostly local with safe options', 'I prefer familiar cuisines'] },
  { id: 'diningStyle',      text: '🍽️ What\'s your dining style?',                           type: 'buttons', options: ['Street food & local spots', 'Casual restaurants', 'Mix of casual & fine dining', 'Fine dining experiences'] },
  { id: 'transport',        text: '🚆 How do you prefer to get around?',                     type: 'buttons', options: ['Public transport', 'Taxi / Rideshare', 'Rent a car', 'Walk & explore on foot'] },
  { id: 'accommodation',    text: '🏨 Where do you prefer to stay?',                         type: 'buttons', options: ['Hostel / budget stay', 'Mid-range hotel', 'Boutique / unique stay', 'Luxury hotel or resort'] },
  { id: 'locationPref',     text: '📍 Where should your accommodation be?',                  type: 'buttons', options: ['City centre / close to everything', 'Quiet neighbourhood', 'Near nature / beach', 'Doesn\'t matter'] },
  { id: 'nightlife',        text: '🌙 How much do you enjoy nightlife?',                     type: 'buttons', options: ['Love it — bars & clubs every night', 'Occasional night out', 'Dinner & early nights for me'] },
  { id: 'shoppingInterest', text: '🛍️ How important is shopping on this trip?',              type: 'buttons', options: ['Very important', 'A bit of browsing', 'Not at all'] },
  { id: 'weatherPref',      text: '☀️ Any weather preferences?',                             type: 'buttons', options: ['Hot & sunny', 'Mild & comfortable', 'Cool or cold is fine', 'No preference'] },
  { id: 'mustSee',          text: '📌 Any must-see spots or special requests?',              type: 'modal',   placeholder: 'e.g. I really want to see the cherry blossoms' },
  { id: 'avoid',            text: '🚫 Anything you want to avoid?',                          type: 'modal',   placeholder: 'e.g. crowded tourist traps, long bus rides' },
];

// ─── Build question embed ─────────────────────────────────────────────────────
function buildQuestionEmbed(idx, total) {
  const q = questions[idx];
  return new EmbedBuilder()
    .setColor(0x9B59B6)
    .setAuthor({ name: 'wandr.ai ✈️' })
    .setTitle(q.text)
    .setFooter({ text: `Question ${idx + 1} of ${total}` });
}

// ─── Build button row ─────────────────────────────────────────────────────────
function buildButtons(idx) {
  const q    = questions[idx];
  const rows = [];
  let   row  = new ActionRowBuilder();
  let   count = 0;

  for (const opt of q.options) {
    if (count === 5) {
      rows.push(row);
      row   = new ActionRowBuilder();
      count = 0;
    }
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`ans_${idx}_${opt}`)
        .setLabel(opt)
        .setStyle(ButtonStyle.Primary)
    );
    count++;
  }
  rows.push(row);
  return rows;
}

// ─── Build modal for text input ───────────────────────────────────────────────
function buildModal(idx) {
  const q = questions[idx];
  return new ModalBuilder()
    .setCustomId(`modal_${idx}`)
    .setTitle('wandr.ai')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('modal_input')
          .setLabel(q.text.replace(/^.{2} /, ''))
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(q.placeholder)
          .setRequired(true)
      )
    );
}

// ─── Send question ────────────────────────────────────────────────────────────
async function sendQuestion(interaction, userId, idx, editReply = false) {
  const q     = questions[idx];
  const embed = buildQuestionEmbed(idx, questions.length);

  if (q.type === 'buttons') {
    const rows = buildButtons(idx);
    const payload = { embeds: [embed], components: rows };
    if (editReply) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply({ ...payload, ephemeral: true });
    }
  } else {
    // For modal questions show a "Click to answer" button
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`open_modal_${idx}`)
        .setLabel('Click to answer ✏️')
        .setStyle(ButtonStyle.Secondary)
    );
    const payload = { embeds: [embed], components: [row] };
    if (editReply) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply({ ...payload, ephemeral: true });
    }
  }
}

// ─── Generate itinerary ───────────────────────────────────────────────────────
async function generateItinerary(answers) {
  const prompt = `You are an expert travel planner. Plan a detailed trip based on these preferences:
${JSON.stringify(answers, null, 2)}

Rules:
- Use REAL restaurant names, REAL hotel names, REAL attraction names.
- Always recommend a specific hotel to stay at matching the budget.
- Be specific and exciting.

Format the itinerary like this for each day:
**Day X: Title**
• Time — Activity @ Location (Vibe)
• Time — Activity @ Location (Vibe)
🍽️ Food tip: [Real restaurant name] — [specific dish]
🏨 Stay: [Hotel name] (only on Day 1)

Start with a 2-line summary of the trip.
Keep it concise enough to fit in Discord — no markdown tables, no images.`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are a professional travel planner. Always use real place names.' },
      { role: 'user',   content: prompt },
    ],
    temperature: 0.7,
    max_tokens:  2000,
  });

  return completion.choices[0].message.content;
}

// ─── Client ready ─────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`Wandr Bot is online as ${client.user.tag}`);
});

// keep all your other code in between...

// ─── Health check server for Render ──────────────────────────────────────────
const express = require('express');
const server = express();
server.get('/', (req, res) => res.send('Wandr Bot is running!'));
server.listen(3000, () => console.log('Health check server on port 3000'));

// ─── Login ────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);

// ─── Interaction handler ──────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  const userId = interaction.user.id;

  // ── /trip command ──
  if (interaction.isChatInputCommand() && interaction.commandName === 'trip') {
    sessions[userId] = { answers: {}, idx: 0 };
    await sendQuestion(interaction, userId, 0, false);
    return;
  }

  // ── Button click ──
  if (interaction.isButton()) {
    const session = sessions[userId];
    if (!session) {
      await interaction.reply({ content: 'Session expired. Run `/trip` again!', ephemeral: true });
      return;
    }

    // Open modal button
    if (interaction.customId.startsWith('open_modal_')) {
      const idx = parseInt(interaction.customId.replace('open_modal_', ''));
      await interaction.showModal(buildModal(idx));
      return;
    }

    // Answer button
    if (interaction.customId.startsWith('ans_')) {
      const parts  = interaction.customId.split('_');
      const idx    = parseInt(parts[1]);
      const answer = parts.slice(2).join('_');

      session.answers[questions[idx].id] = answer;
      session.idx = idx + 1;

      await interaction.deferUpdate();

      if (session.idx >= questions.length) {
        // All questions answered — generate itinerary
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x9B59B6)
              .setAuthor({ name: 'wandr.ai ✈️' })
              .setTitle('Crafting your perfect itinerary...')
              .setDescription('This takes about 15 seconds ✨')
          ],
          components: [],
        });

        try {
          const itinerary = await generateItinerary(session.answers);
          const chunks    = itinerary.match(/[\s\S]{1,4000}/g) || [itinerary];

          // First chunk replaces the loading embed
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0x9B59B6)
                .setAuthor({ name: 'wandr.ai ✈️' })
                .setTitle(`Your trip to ${session.answers.destination} ✈️`)
                .setDescription(chunks[0])
                .setFooter({ text: 'Made with wandr.ai' })
            ],
            components: [],
          });

          // Extra chunks as follow-up messages if itinerary is long
          for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp({
              embeds: [
                new EmbedBuilder()
                  .setColor(0x9B59B6)
                  .setDescription(chunks[i])
              ],
              ephemeral: true,
            });
          }
        } catch (err) {
          console.error('Generation error:', err);
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Something went wrong')
                .setDescription('Could not generate your itinerary. Please try `/trip` again.')
            ],
            components: [],
          });
        }

        delete sessions[userId];
      } else {
        await sendQuestion(interaction, userId, session.idx, true);
      }
    }
  }

  // ── Modal submit ──
  if (interaction.isModalSubmit()) {
    const session = sessions[userId];
    if (!session) {
      await interaction.reply({ content: 'Session expired. Run `/trip` again!', ephemeral: true });
      return;
    }

    const idx    = parseInt(interaction.customId.replace('modal_', ''));
    const answer = interaction.fields.getTextInputValue('modal_input');

    session.answers[questions[idx].id] = answer;
    session.idx = idx + 1;

    await interaction.deferUpdate();

    if (session.idx >= questions.length) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x9B59B6)
            .setAuthor({ name: 'wandr.ai ✈️' })
            .setTitle('Crafting your perfect itinerary...')
            .setDescription('This takes about 15 seconds ✨')
        ],
        components: [],
      });

      try {
        const itinerary = await generateItinerary(session.answers);
        const chunks    = itinerary.match(/[\s\S]{1,4000}/g) || [itinerary];

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x9B59B6)
              .setAuthor({ name: 'wandr.ai ✈️' })
              .setTitle(`Your trip to ${session.answers.destination} ✈️`)
              .setDescription(chunks[0])
              .setFooter({ text: 'Made with wandr.ai' })
          ],
          components: [],
        });

        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp({
            embeds: [
              new EmbedBuilder()
                .setColor(0x9B59B6)
                .setDescription(chunks[i])
            ],
            ephemeral: true,
          });
        }
      } catch (err) {
        console.error('Generation error:', err);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setTitle('Something went wrong')
              .setDescription('Could not generate your itinerary. Please try `/trip` again.')
          ],
          components: [],
        });
      }

      delete sessions[userId];
    } else {
      await sendQuestion(interaction, userId, session.idx, true);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

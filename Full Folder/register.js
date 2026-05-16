console.log("Script started...");
require('dotenv').config();
const { REST, Routes } = require('discord.js');

const commands = [
  {
    name: 'trip',
    description: 'Plan your perfect trip with Wandr AI!',
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registering /trip command...');
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_APP_ID),
      { body: commands }
    );
    console.log('/trip command registered successfully!');
  } catch (error) {
    console.error('Error registering command:', error);
  }
})();
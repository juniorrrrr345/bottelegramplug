module.exports = {
  apps: [
    {
      name: 'bot-1',
      script: './bot.js',
      env: {
        BOT_TOKEN: '8128299360:AAEWmbRLjkTaQYP17GsiGm5vhQv8AcJLKIY',
        ADMIN_ID: '7670522278'
      }
    },
    // Ajoutez d'autres bots ici
    // {
    //   name: 'bot-2',
    //   script: './bot.js',
    //   cwd: '/chemin/vers/bot2',
    //   env: {
    //     BOT_TOKEN: 'TOKEN_DU_BOT_2',
    //     ADMIN_ID: '7670522278'
    //   }
    // }
  ]
};
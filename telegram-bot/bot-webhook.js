require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { loadConfig, saveConfig, getImagePath, IMAGES_DIR } = require('./config');
const { getMainKeyboard, getAdminKeyboard, getSocialManageKeyboard, getConfirmKeyboard } = require('./keyboards');

// Configuration Express
const app = express();
const PORT = process.env.PORT || 3000;

// Vérifier les variables d'environnement
if (!process.env.BOT_TOKEN) {
    console.error('❌ BOT_TOKEN n\'est pas défini dans le fichier .env');
    process.exit(1);
}

if (!process.env.ADMIN_ID) {
    console.error('❌ ADMIN_ID n\'est pas défini dans le fichier .env');
    process.exit(1);
}

// URL de votre app Render
const WEBHOOK_URL = process.env.WEBHOOK_URL || `https://your-app.onrender.com`;

// Initialiser le bot en mode webhook
const bot = new TelegramBot(process.env.BOT_TOKEN, { webHook: true });
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

// Middleware Express
app.use(express.json());

// Route pour le webhook Telegram
app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Route de santé pour Render
app.get('/', (req, res) => {
    res.send('Bot Telegram is running! 🤖');
});

// Route de santé
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// État des utilisateurs (pour gérer les conversations)
const userStates = {};

// Charger la configuration au démarrage
let config = loadConfig();

// Fonction pour envoyer le message d'accueil
async function sendWelcomeMessage(chatId) {
    try {
        const options = {
            reply_markup: getMainKeyboard(config),
            parse_mode: 'HTML'
        };

        if (config.welcomeImage) {
            const imagePath = getImagePath(config.welcomeImage);
            if (fs.existsSync(imagePath)) {
                await bot.sendPhoto(chatId, imagePath, {
                    caption: config.welcomeMessage,
                    ...options
                });
            } else {
                await bot.sendMessage(chatId, config.welcomeMessage, options);
            }
        } else {
            await bot.sendMessage(chatId, config.welcomeMessage, options);
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message d\'accueil:', error);
        await bot.sendMessage(chatId, '❌ Une erreur s\'est produite. Veuillez réessayer.');
    }
}

// Commande /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await sendWelcomeMessage(chatId);
});

// Commande /admin
bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (userId !== ADMIN_ID) {
        await bot.sendMessage(chatId, '❌ Vous n\'êtes pas autorisé à accéder au menu administrateur.');
        return;
    }

    await bot.sendMessage(chatId, '🔧 Menu Administrateur', {
        reply_markup: getAdminKeyboard()
    });
});

// [Le reste du code reste identique au bot.js original...]
// Copiez tout le code de gestion des callbacks, messages, photos depuis bot.js

// Démarrer le serveur Express
app.listen(PORT, async () => {
    console.log(`🌐 Serveur démarré sur le port ${PORT}`);
    
    // Configurer le webhook
    const webhookUrl = `${WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`;
    try {
        await bot.setWebHook(webhookUrl);
        console.log(`🔗 Webhook configuré: ${webhookUrl}`);
    } catch (error) {
        console.error('❌ Erreur lors de la configuration du webhook:', error);
    }
    
    console.log('🤖 Bot démarré avec succès en mode webhook!');
});
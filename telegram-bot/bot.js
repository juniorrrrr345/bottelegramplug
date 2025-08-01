require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
const http = require('http');
const { loadConfig, saveConfig, getImagePath, IMAGES_DIR } = require('./config');
const { getMainKeyboard, getAdminKeyboard, getSocialManageKeyboard, getConfirmKeyboard } = require('./keyboards');

// Créer un serveur HTTP simple pour Render
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Telegram is running!');
});

server.listen(PORT, () => {
    console.log(`🌐 Serveur HTTP démarré sur le port ${PORT}`);
});

// Vérifier les variables d'environnement
if (!process.env.BOT_TOKEN) {
    console.error('❌ BOT_TOKEN n\'est pas défini dans le fichier .env');
    process.exit(1);
}

if (!process.env.ADMIN_ID) {
    console.error('❌ ADMIN_ID n\'est pas défini dans le fichier .env');
    process.exit(1);
}

// Initialiser le bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = parseInt(process.env.ADMIN_ID);

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

// Gestion des callbacks
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    // Répondre au callback pour éviter le spinner
    await bot.answerCallbackQuery(callbackQuery.id);

    // Vérifier les permissions admin pour les actions admin
    if (data.startsWith('admin_') && userId !== ADMIN_ID) {
        await bot.sendMessage(chatId, '❌ Vous n\'êtes pas autorisé à effectuer cette action.');
        return;
    }

    try {
        switch (data) {
            case 'info':
                // Afficher les informations
                const infoOptions = {
                    parse_mode: 'HTML'
                };
                
                if (config.welcomeImage) {
                    const imagePath = getImagePath(config.welcomeImage);
                    if (fs.existsSync(imagePath)) {
                        await bot.sendPhoto(chatId, imagePath, {
                            caption: config.infoText,
                            ...infoOptions
                        });
                    } else {
                        await bot.sendMessage(chatId, config.infoText, infoOptions);
                    }
                } else {
                    await bot.sendMessage(chatId, config.infoText, infoOptions);
                }
                break;

            case 'admin_menu':
                await bot.editMessageText('🔧 Menu Administrateur', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: getAdminKeyboard()
                });
                break;

            case 'admin_edit_welcome':
                userStates[userId] = { action: 'editing_welcome' };
                await bot.sendMessage(chatId, '📝 Envoyez le nouveau message d\'accueil:');
                break;

            case 'admin_edit_photo':
                userStates[userId] = { action: 'editing_photo' };
                await bot.sendMessage(chatId, '🖼️ Envoyez la nouvelle photo d\'accueil:');
                break;

            case 'admin_edit_miniapp':
                userStates[userId] = { action: 'editing_miniapp_url' };
                await bot.sendMessage(chatId, '📱 Envoyez l\'URL de la mini application (ou "supprimer" pour la retirer):');
                break;

            case 'admin_manage_social':
                await bot.editMessageText('🌐 Gestion des réseaux sociaux', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: getSocialManageKeyboard(config)
                });
                break;

            case 'admin_add_social':
                userStates[userId] = { action: 'adding_social_name' };
                await bot.sendMessage(chatId, '➕ Entrez le nom du réseau social:');
                break;

            case 'admin_edit_info':
                userStates[userId] = { action: 'editing_info' };
                await bot.sendMessage(chatId, 'ℹ️ Envoyez le nouveau texte pour la section informations:');
                break;

            case 'admin_close':
                await bot.deleteMessage(chatId, messageId);
                break;

            case 'cancel':
                delete userStates[userId];
                await bot.sendMessage(chatId, '❌ Action annulée.');
                break;

            default:
                // Gestion de la suppression des réseaux sociaux
                if (data.startsWith('admin_delete_social_')) {
                    const index = parseInt(data.replace('admin_delete_social_', ''));
                    if (config.socialNetworks && config.socialNetworks[index]) {
                        config.socialNetworks.splice(index, 1);
                        saveConfig(config);
                        await bot.sendMessage(chatId, '✅ Réseau social supprimé!');
                        await bot.editMessageReplyMarkup(getSocialManageKeyboard(config), {
                            chat_id: chatId,
                            message_id: messageId
                        });
                    }
                }
                break;
        }
    } catch (error) {
        console.error('Erreur lors du traitement du callback:', error);
        await bot.sendMessage(chatId, '❌ Une erreur s\'est produite. Veuillez réessayer.');
    }
});

// Gestion des messages texte
bot.on('message', async (msg) => {
    // Ignorer les commandes
    if (msg.text && msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userState = userStates[userId];

    if (!userState) return;

    try {
        switch (userState.action) {
            case 'editing_welcome':
                config.welcomeMessage = msg.text;
                saveConfig(config);
                delete userStates[userId];
                await bot.sendMessage(chatId, '✅ Message d\'accueil mis à jour!');
                break;

            case 'editing_info':
                config.infoText = msg.text;
                saveConfig(config);
                delete userStates[userId];
                await bot.sendMessage(chatId, '✅ Texte d\'informations mis à jour!');
                break;

            case 'editing_miniapp_url':
                if (msg.text.toLowerCase() === 'supprimer') {
                    config.miniApp.url = null;
                } else {
                    config.miniApp.url = msg.text;
                }
                userStates[userId] = { action: 'editing_miniapp_text' };
                await bot.sendMessage(chatId, '📱 Entrez le texte du bouton pour la mini application:');
                break;

            case 'editing_miniapp_text':
                config.miniApp.text = msg.text;
                saveConfig(config);
                delete userStates[userId];
                await bot.sendMessage(chatId, '✅ Mini application mise à jour!');
                break;

            case 'adding_social_name':
                userStates[userId] = { 
                    action: 'adding_social_url',
                    socialName: msg.text
                };
                await bot.sendMessage(chatId, '🔗 Entrez l\'URL du réseau social:');
                break;

            case 'adding_social_url':
                userStates[userId] = {
                    ...userState,
                    action: 'adding_social_emoji',
                    socialUrl: msg.text
                };
                await bot.sendMessage(chatId, '😀 Entrez un emoji pour ce réseau social (optionnel, appuyez sur /skip pour ignorer):');
                break;

            case 'adding_social_emoji':
                const emoji = msg.text === '/skip' ? '🔗' : msg.text;
                if (!config.socialNetworks) {
                    config.socialNetworks = [];
                }
                config.socialNetworks.push({
                    name: userState.socialName,
                    url: userState.socialUrl,
                    emoji: emoji
                });
                saveConfig(config);
                delete userStates[userId];
                await bot.sendMessage(chatId, '✅ Réseau social ajouté!');
                break;
        }
    } catch (error) {
        console.error('Erreur lors du traitement du message:', error);
        await bot.sendMessage(chatId, '❌ Une erreur s\'est produite. Veuillez réessayer.');
    }
});

// Gestion des photos
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userState = userStates[userId];

    if (!userState || userState.action !== 'editing_photo') return;

    try {
        // Obtenir la photo de meilleure qualité
        const photo = msg.photo[msg.photo.length - 1];
        const fileId = photo.file_id;

        // Télécharger la photo
        const file = await bot.getFile(fileId);
        const filePath = file.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;

        // Sauvegarder la photo
        const fileName = `welcome_${Date.now()}.jpg`;
        const localPath = path.join(IMAGES_DIR, fileName);

        const https = require('https');
        const fileStream = fs.createWriteStream(localPath);

        https.get(downloadUrl, (response) => {
            response.pipe(fileStream);
            fileStream.on('finish', async () => {
                fileStream.close();
                
                // Supprimer l'ancienne photo si elle existe
                if (config.welcomeImage) {
                    const oldPath = getImagePath(config.welcomeImage);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }

                // Mettre à jour la configuration
                config.welcomeImage = fileName;
                saveConfig(config);
                delete userStates[userId];

                await bot.sendMessage(chatId, '✅ Photo d\'accueil mise à jour!');
            });
        });
    } catch (error) {
        console.error('Erreur lors du traitement de la photo:', error);
        await bot.sendMessage(chatId, '❌ Une erreur s\'est produite lors du traitement de la photo.');
    }
});

// Gestion des erreurs
bot.on('polling_error', (error) => {
    console.error('Erreur de polling:', error);
});

console.log('🤖 Bot démarré avec succès!');
console.log(`📱 Parlez au bot: https://t.me/${process.env.BOT_USERNAME || 'votre_bot'}`);
console.log(`🔧 ID Admin: ${ADMIN_ID}`);
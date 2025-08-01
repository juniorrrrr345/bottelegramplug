require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
const { loadConfig, saveConfig, getImagePath, IMAGES_DIR } = require('./config');
const { getMainKeyboard, getAdminKeyboard, getSocialManageKeyboard, getConfirmKeyboard } = require('./keyboards');

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
// Stocker les IDs des derniers messages pour chaque utilisateur
const lastMessages = {};
// Stocker les utilisateurs qui ont interagi avec le bot
const users = new Set();

// Charger la configuration au démarrage
let config = loadConfig();

// Charger les utilisateurs sauvegardés
const USERS_FILE = path.join(__dirname, 'users.json');
function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readJsonSync(USERS_FILE);
            data.forEach(userId => users.add(userId));
        }
    } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
    }
}

function saveUsers() {
    try {
        fs.writeJsonSync(USERS_FILE, Array.from(users));
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des utilisateurs:', error);
    }
}

loadUsers();

// Fonction pour supprimer le dernier message d'un utilisateur
async function deleteLastMessage(chatId) {
    if (lastMessages[chatId]) {
        try {
            await bot.deleteMessage(chatId, lastMessages[chatId]);
        } catch (error) {
            // Ignorer l'erreur si le message est déjà supprimé
        }
        delete lastMessages[chatId];
    }
}

// Fonction pour envoyer un message et stocker son ID
async function sendMessageAndStore(chatId, text, options = {}) {
    await deleteLastMessage(chatId);
    const message = await bot.sendMessage(chatId, text, options);
    lastMessages[chatId] = message.message_id;
    return message;
}

// Fonction pour envoyer une photo et stocker son ID
async function sendPhotoAndStore(chatId, photo, options = {}) {
    await deleteLastMessage(chatId);
    const message = await bot.sendPhoto(chatId, photo, options);
    lastMessages[chatId] = message.message_id;
    return message;
}

// Fonction pour éditer un message
async function editMessageAndStore(chatId, messageId, text, options = {}) {
    try {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            ...options
        });
        lastMessages[chatId] = messageId;
    } catch (error) {
        // Si l'édition échoue, envoyer un nouveau message
        await sendMessageAndStore(chatId, text, options);
    }
}

// Fonction pour envoyer le message d'accueil
async function sendWelcomeMessage(chatId, messageId = null) {
    try {
        const options = {
            reply_markup: getMainKeyboard(config),
            parse_mode: 'HTML'
        };

        if (config.welcomeImage) {
            const imagePath = getImagePath(config.welcomeImage);
            if (fs.existsSync(imagePath)) {
                if (messageId) {
                    await deleteLastMessage(chatId);
                }
                await sendPhotoAndStore(chatId, imagePath, {
                    caption: config.welcomeMessage,
                    ...options
                });
            } else {
                if (messageId) {
                    await editMessageAndStore(chatId, messageId, config.welcomeMessage, options);
                } else {
                    await sendMessageAndStore(chatId, config.welcomeMessage, options);
                }
            }
        } else {
            if (messageId) {
                await editMessageAndStore(chatId, messageId, config.welcomeMessage, options);
            } else {
                await sendMessageAndStore(chatId, config.welcomeMessage, options);
            }
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message d\'accueil:', error);
        await sendMessageAndStore(chatId, '❌ Une erreur s\'est produite. Veuillez réessayer.');
    }
}

// Commande /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Ajouter l'utilisateur à la liste
    users.add(userId);
    saveUsers();
    
    // Supprimer le message de commande
    try {
        await bot.deleteMessage(chatId, msg.message_id);
    } catch (error) {}
    
    await sendWelcomeMessage(chatId);
});

// Commande /admin
bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Supprimer le message de commande
    try {
        await bot.deleteMessage(chatId, msg.message_id);
    } catch (error) {}

    if (userId !== ADMIN_ID) {
        await sendMessageAndStore(chatId, '❌ Vous n\'êtes pas autorisé à accéder au menu administrateur.');
        return;
    }

    await sendMessageAndStore(chatId, '🔧 Menu Administrateur', {
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
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '⬅️ Retour', callback_data: 'back_to_main' }
                        ]]
                    }
                };
                
                if (config.welcomeImage) {
                    const imagePath = getImagePath(config.welcomeImage);
                    if (fs.existsSync(imagePath)) {
                        await bot.deleteMessage(chatId, messageId);
                        await sendPhotoAndStore(chatId, imagePath, {
                            caption: config.infoText,
                            ...infoOptions
                        });
                    } else {
                        await editMessageAndStore(chatId, messageId, config.infoText, infoOptions);
                    }
                } else {
                    await editMessageAndStore(chatId, messageId, config.infoText, infoOptions);
                }
                break;

            case 'back_to_main':
                await sendWelcomeMessage(chatId, messageId);
                break;

            case 'admin_menu':
                await editMessageAndStore(chatId, messageId, '🔧 Menu Administrateur', {
                    reply_markup: getAdminKeyboard()
                });
                break;

            case 'admin_edit_welcome':
                userStates[userId] = { action: 'editing_welcome', messageId: messageId };
                await editMessageAndStore(chatId, messageId, '📝 Envoyez le nouveau message d\'accueil:', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_menu' }
                        ]]
                    }
                });
                break;

            case 'admin_edit_photo':
                userStates[userId] = { action: 'editing_photo', messageId: messageId };
                await editMessageAndStore(chatId, messageId, '🖼️ Envoyez la nouvelle photo d\'accueil:', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_menu' }
                        ]]
                    }
                });
                break;

            case 'admin_edit_miniapp':
                userStates[userId] = { action: 'editing_miniapp_url', messageId: messageId };
                await editMessageAndStore(chatId, messageId, '📱 Envoyez l\'URL de la mini application (ou "supprimer" pour la retirer):', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_menu' }
                        ]]
                    }
                });
                break;

            case 'admin_manage_social':
                await editMessageAndStore(chatId, messageId, '🌐 Gestion des réseaux sociaux', {
                    reply_markup: getSocialManageKeyboard(config)
                });
                break;

            case 'admin_add_social':
                userStates[userId] = { action: 'adding_social_name', messageId: messageId };
                await editMessageAndStore(chatId, messageId, '➕ Entrez le nom du réseau social:', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_manage_social' }
                        ]]
                    }
                });
                break;

            case 'admin_edit_info':
                userStates[userId] = { action: 'editing_info', messageId: messageId };
                await editMessageAndStore(chatId, messageId, 'ℹ️ Envoyez le nouveau texte pour la section informations:', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_menu' }
                        ]]
                    }
                });
                break;

            case 'admin_broadcast':
                userStates[userId] = { action: 'broadcast_message', messageId: messageId };
                await editMessageAndStore(chatId, messageId, '📢 Envoyez le message à diffuser à tous les utilisateurs:', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_menu' }
                        ]]
                    }
                });
                break;

            case 'admin_close':
                await bot.deleteMessage(chatId, messageId);
                delete lastMessages[chatId];
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
                        await bot.answerCallbackQuery(callbackQuery.id, {
                            text: '✅ Réseau social supprimé!',
                            show_alert: true
                        });
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

    // Supprimer le message de l'utilisateur pour garder le chat propre
    try {
        await bot.deleteMessage(chatId, msg.message_id);
    } catch (error) {}

    try {
        switch (userState.action) {
            case 'editing_welcome':
                config.welcomeMessage = msg.text;
                saveConfig(config);
                delete userStates[userId];
                await editMessageAndStore(chatId, userState.messageId, '✅ Message d\'accueil mis à jour!', {
                    reply_markup: getAdminKeyboard()
                });
                break;

            case 'editing_info':
                config.infoText = msg.text;
                saveConfig(config);
                delete userStates[userId];
                await editMessageAndStore(chatId, userState.messageId, '✅ Texte d\'informations mis à jour!', {
                    reply_markup: getAdminKeyboard()
                });
                break;

            case 'editing_miniapp_url':
                if (msg.text.toLowerCase() === 'supprimer') {
                    config.miniApp.url = null;
                } else {
                    config.miniApp.url = msg.text;
                }
                userStates[userId] = { 
                    action: 'editing_miniapp_text', 
                    messageId: userState.messageId 
                };
                await editMessageAndStore(chatId, userState.messageId, '📱 Entrez le texte du bouton pour la mini application:', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_menu' }
                        ]]
                    }
                });
                break;

            case 'editing_miniapp_text':
                config.miniApp.text = msg.text;
                saveConfig(config);
                delete userStates[userId];
                await editMessageAndStore(chatId, userState.messageId, '✅ Mini application mise à jour!', {
                    reply_markup: getAdminKeyboard()
                });
                break;

            case 'adding_social_name':
                userStates[userId] = { 
                    action: 'adding_social_url',
                    socialName: msg.text,
                    messageId: userState.messageId
                };
                await editMessageAndStore(chatId, userState.messageId, '🔗 Entrez l\'URL du réseau social:', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_manage_social' }
                        ]]
                    }
                });
                break;

            case 'adding_social_url':
                userStates[userId] = {
                    ...userState,
                    action: 'adding_social_emoji',
                    socialUrl: msg.text
                };
                await editMessageAndStore(chatId, userState.messageId, '😀 Entrez un emoji pour ce réseau social (ou envoyez "skip" pour utiliser 🔗):', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_manage_social' }
                        ]]
                    }
                });
                break;

            case 'adding_social_emoji':
                const emoji = msg.text.toLowerCase() === 'skip' ? '🔗' : msg.text;
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
                await editMessageAndStore(chatId, userState.messageId, '✅ Réseau social ajouté!', {
                    reply_markup: getSocialManageKeyboard(config)
                });
                break;

            case 'broadcast_message':
                const message = msg.text;
                let successCount = 0;
                let failCount = 0;
                
                await editMessageAndStore(chatId, userState.messageId, '📤 Envoi en cours...');
                
                for (const targetUserId of users) {
                    if (targetUserId !== userId) { // Ne pas envoyer à l'admin
                        try {
                            await bot.sendMessage(targetUserId, `📢 Message de l'administrateur:\n\n${message}`);
                            successCount++;
                        } catch (error) {
                            failCount++;
                        }
                    }
                }
                
                delete userStates[userId];
                await editMessageAndStore(chatId, userState.messageId, 
                    `✅ Message diffusé!\n\n📊 Statistiques:\n✅ Envoyés: ${successCount}\n❌ Échecs: ${failCount}`, {
                    reply_markup: getAdminKeyboard()
                });
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

    // Supprimer le message de photo pour garder le chat propre
    try {
        await bot.deleteMessage(chatId, msg.message_id);
    } catch (error) {}

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

                await editMessageAndStore(chatId, userState.messageId, '✅ Photo d\'accueil mise à jour!', {
                    reply_markup: getAdminKeyboard()
                });
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
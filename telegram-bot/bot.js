require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
const { loadConfig, saveConfig, getImagePath, IMAGES_DIR } = require('./config');
const { getMainKeyboard, getAdminKeyboard, getSocialManageKeyboard, getSocialLayoutKeyboard, getConfirmKeyboard } = require('./keyboards');

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
// Stocker l'ID du dernier message pour chaque chat (un seul message actif par chat)
const activeMessages = {};
// Stocker les utilisateurs qui ont interagi avec le bot
const users = new Set();
// Stocker les administrateurs
const admins = new Set([ADMIN_ID]);

// Charger la configuration au démarrage
let config = loadConfig();

// Charger les utilisateurs sauvegardés
const USERS_FILE = path.join(__dirname, 'users.json');
const ADMINS_FILE = path.join(__dirname, 'admins.json');

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

function loadAdmins() {
    try {
        if (fs.existsSync(ADMINS_FILE)) {
            const data = fs.readJsonSync(ADMINS_FILE);
            data.forEach(adminId => admins.add(adminId));
        }
    } catch (error) {
        console.error('Erreur lors du chargement des admins:', error);
    }
}

function saveAdmins() {
    try {
        fs.writeJsonSync(ADMINS_FILE, Array.from(admins));
    } catch (error) {
        console.error('Erreur lors de la sauvegarde des admins:', error);
    }
}

loadUsers();
loadAdmins();

// Fonction pour supprimer tous les messages actifs d'un chat
async function deleteActiveMessage(chatId) {
    if (activeMessages[chatId]) {
        try {
            await bot.deleteMessage(chatId, activeMessages[chatId]);
        } catch (error) {
            // Ignorer si le message est déjà supprimé
        }
        delete activeMessages[chatId];
    }
}

// Fonction pour envoyer un message et supprimer l'ancien
async function sendNewMessage(chatId, text, options = {}) {
    // Supprimer l'ancien message actif
    await deleteActiveMessage(chatId);
    
    // Envoyer le nouveau message
    try {
        const message = await bot.sendMessage(chatId, text, options);
        activeMessages[chatId] = message.message_id;
        return message;
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
    }
}

// Fonction pour envoyer une photo et supprimer l'ancien message
async function sendNewPhoto(chatId, photo, options = {}) {
    // Supprimer l'ancien message actif
    await deleteActiveMessage(chatId);
    
    // Envoyer la nouvelle photo
    try {
        const message = await bot.sendPhoto(chatId, photo, options);
        activeMessages[chatId] = message.message_id;
        return message;
    } catch (error) {
        console.error('Erreur lors de l\'envoi de la photo:', error);
    }
}

// Fonction pour éditer le message actif ou en envoyer un nouveau
async function updateMessage(chatId, messageId, text, options = {}) {
    try {
        // Vérifier si c'est bien le message actif
        if (activeMessages[chatId] === messageId) {
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                ...options
            });
            return { message_id: messageId };
        } else {
            // Si ce n'est pas le message actif, envoyer un nouveau message
            return await sendNewMessage(chatId, text, options);
        }
    } catch (error) {
        // En cas d'erreur, envoyer un nouveau message
        return await sendNewMessage(chatId, text, options);
    }
}

// Fonction pour envoyer le message d'accueil
async function sendWelcomeMessage(chatId, editMessageId = null) {
    try {
        const options = {
            reply_markup: getMainKeyboard(config),
            parse_mode: 'HTML'
        };

        if (config.welcomeImage) {
            const imagePath = getImagePath(config.welcomeImage);
            if (fs.existsSync(imagePath)) {
                // Avec image, on doit envoyer un nouveau message
                await sendNewPhoto(chatId, imagePath, {
                    caption: config.welcomeMessage,
                    ...options
                });
            } else {
                // Sans image valide, utiliser du texte
                if (editMessageId && activeMessages[chatId] === editMessageId) {
                    await updateMessage(chatId, editMessageId, config.welcomeMessage, options);
                } else {
                    await sendNewMessage(chatId, config.welcomeMessage, options);
                }
            }
        } else {
            // Sans image, on peut éditer ou envoyer un nouveau message
            if (editMessageId && activeMessages[chatId] === editMessageId) {
                await updateMessage(chatId, editMessageId, config.welcomeMessage, options);
            } else {
                await sendNewMessage(chatId, config.welcomeMessage, options);
            }
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message d\'accueil:', error);
        await sendNewMessage(chatId, '❌ Une erreur s\'est produite. Veuillez réessayer.');
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
    
    // Envoyer le message d'accueil (supprimera automatiquement l'ancien)
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

    if (!admins.has(userId)) {
        await sendNewMessage(chatId, '❌ Vous n\'êtes pas autorisé à accéder au menu administrateur.');
        return;
    }

    await sendNewMessage(chatId, '🔧 Menu Administrateur', {
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
    if (data.startsWith('admin_') && !admins.has(userId)) {
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Vous n\'êtes pas autorisé à effectuer cette action.',
            show_alert: true
        });
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
                        await sendNewPhoto(chatId, imagePath, {
                            caption: config.infoText,
                            ...infoOptions
                        });
                    } else {
                        await updateMessage(chatId, messageId, config.infoText, infoOptions);
                    }
                } else {
                    await updateMessage(chatId, messageId, config.infoText, infoOptions);
                }
                break;

            case 'back_to_main':
                await sendWelcomeMessage(chatId, messageId);
                break;

            case 'admin_menu':
                await updateMessage(chatId, messageId, '🔧 Menu Administrateur', {
                    reply_markup: getAdminKeyboard()
                });
                break;

            case 'admin_edit_welcome':
                userStates[userId] = { action: 'editing_welcome', messageId: messageId };
                await updateMessage(chatId, messageId, '📝 Envoyez le nouveau message d\'accueil:', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_menu' }
                        ]]
                    }
                });
                break;

            case 'admin_edit_photo':
                userStates[userId] = { action: 'editing_photo', messageId: messageId };
                await updateMessage(chatId, messageId, '🖼️ Envoyez la nouvelle photo d\'accueil:', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_menu' }
                        ]]
                    }
                });
                break;

            case 'admin_edit_miniapp':
                userStates[userId] = { action: 'editing_miniapp_name', messageId: messageId };
                await updateMessage(chatId, messageId, '📱 Entrez le nom du bouton pour la mini application:', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_menu' }
                        ]]
                    }
                });
                break;

            case 'admin_manage_social':
                await updateMessage(chatId, messageId, '🌐 Gestion des réseaux sociaux', {
                    reply_markup: getSocialManageKeyboard(config)
                });
                break;

            case 'admin_add_social':
                userStates[userId] = { action: 'adding_social_name', messageId: messageId };
                await updateMessage(chatId, messageId, '➕ Entrez le nom du réseau social:', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_manage_social' }
                        ]]
                    }
                });
                break;

            case 'admin_edit_info':
                userStates[userId] = { action: 'editing_info', messageId: messageId };
                await updateMessage(chatId, messageId, 'ℹ️ Envoyez le nouveau texte pour la section informations:', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_menu' }
                        ]]
                    }
                });
                break;

            case 'admin_broadcast':
                userStates[userId] = { action: 'broadcast_message', messageId: messageId };
                await updateMessage(chatId, messageId, '📢 Envoyez le message à diffuser à tous les utilisateurs:', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_menu' }
                        ]]
                    }
                });
                break;

            case 'admin_social_layout':
                await updateMessage(chatId, messageId, '📐 Choisissez le nombre de boutons par ligne:', {
                    reply_markup: getSocialLayoutKeyboard()
                });
                break;

            case 'admin_manage_admins':
                const adminsList = Array.from(admins).map(id => {
                    if (id === ADMIN_ID) return `👑 ${id} (Principal)`;
                    return `👤 ${id}`;
                }).join('\n');
                
                await updateMessage(chatId, messageId, `👥 Administrateurs actuels:\n\n${adminsList}`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '➕ Ajouter un admin', callback_data: 'admin_add_admin' }],
                            [{ text: '➖ Retirer un admin', callback_data: 'admin_remove_admin' }],
                            [{ text: '⬅️ Retour', callback_data: 'admin_menu' }]
                        ]
                    }
                });
                break;

            case 'admin_add_admin':
                userStates[userId] = { action: 'adding_admin', messageId: messageId };
                await updateMessage(chatId, messageId, '👤 Envoyez l\'ID Telegram du nouvel administrateur:', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_manage_admins' }
                        ]]
                    }
                });
                break;

            case 'admin_remove_admin':
                if (admins.size <= 1) {
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: '⚠️ Il doit y avoir au moins un administrateur!',
                        show_alert: true
                    });
                    break;
                }
                
                const removableAdmins = Array.from(admins).filter(id => id !== ADMIN_ID);
                if (removableAdmins.length === 0) {
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: '⚠️ Aucun admin supprimable. L\'admin principal ne peut pas être retiré.',
                        show_alert: true
                    });
                    break;
                }
                
                const removeButtons = removableAdmins.map(id => [{
                    text: `❌ Retirer ${id}`,
                    callback_data: `remove_admin_${id}`
                }]);
                
                await updateMessage(chatId, messageId, '👥 Sélectionnez l\'admin à retirer:', {
                    reply_markup: {
                        inline_keyboard: [
                            ...removeButtons,
                            [{ text: '⬅️ Retour', callback_data: 'admin_manage_admins' }]
                        ]
                    }
                });
                break;

            case 'admin_close':
                await deleteActiveMessage(chatId);
                break;

            case 'cancel':
                delete userStates[userId];
                await bot.answerCallbackQuery(callbackQuery.id, {
                    text: '❌ Action annulée',
                    show_alert: false
                });
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
                // Gestion de la disposition des boutons sociaux
                else if (data.startsWith('social_layout_')) {
                    const buttonsPerRow = parseInt(data.replace('social_layout_', ''));
                    config.socialButtonsPerRow = buttonsPerRow;
                    saveConfig(config);
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: `✅ Disposition mise à jour: ${buttonsPerRow} bouton(s) par ligne`,
                        show_alert: true
                    });
                    await updateMessage(chatId, messageId, '🌐 Gestion des réseaux sociaux', {
                        reply_markup: getSocialManageKeyboard(config)
                    });
                }
                // Gestion de la suppression des admins
                else if (data.startsWith('remove_admin_')) {
                    const adminToRemove = parseInt(data.replace('remove_admin_', ''));
                    if (admins.has(adminToRemove) && adminToRemove !== ADMIN_ID) {
                        admins.delete(adminToRemove);
                        saveAdmins();
                        await bot.answerCallbackQuery(callbackQuery.id, {
                            text: '✅ Administrateur retiré!',
                            show_alert: true
                        });
                        // Retour à la liste des admins
                        const adminsList = Array.from(admins).map(id => {
                            if (id === ADMIN_ID) return `👑 ${id} (Principal)`;
                            return `👤 ${id}`;
                        }).join('\n');
                        
                        await updateMessage(chatId, messageId, `👥 Administrateurs actuels:\n\n${adminsList}`, {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '➕ Ajouter un admin', callback_data: 'admin_add_admin' }],
                                    [{ text: '➖ Retirer un admin', callback_data: 'admin_remove_admin' }],
                                    [{ text: '⬅️ Retour', callback_data: 'admin_menu' }]
                                ]
                            }
                        });
                    }
                }
                break;
        }
    } catch (error) {
        console.error('Erreur lors du traitement du callback:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ Une erreur s\'est produite',
            show_alert: true
        });
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
                await updateMessage(chatId, userState.messageId, '✅ Message d\'accueil mis à jour!', {
                    reply_markup: getAdminKeyboard()
                });
                break;

            case 'editing_info':
                config.infoText = msg.text;
                saveConfig(config);
                delete userStates[userId];
                await updateMessage(chatId, userState.messageId, '✅ Texte d\'informations mis à jour!', {
                    reply_markup: getAdminKeyboard()
                });
                break;

            case 'editing_miniapp_name':
                if (!config.miniApp) {
                    config.miniApp = {};
                }
                config.miniApp.text = msg.text;
                userStates[userId] = { 
                    action: 'editing_miniapp_url', 
                    messageId: userState.messageId 
                };
                await updateMessage(chatId, userState.messageId, '📱 Entrez l\'URL de la mini application (ou "supprimer" pour la retirer):', {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '❌ Annuler', callback_data: 'admin_menu' }
                        ]]
                    }
                });
                break;

            case 'editing_miniapp_url':
                if (msg.text.toLowerCase() === 'supprimer') {
                    config.miniApp.url = null;
                } else {
                    config.miniApp.url = msg.text;
                }
                saveConfig(config);
                delete userStates[userId];
                await updateMessage(chatId, userState.messageId, '✅ Mini application mise à jour!', {
                    reply_markup: getAdminKeyboard()
                });
                break;

            case 'adding_social_name':
                userStates[userId] = { 
                    action: 'adding_social_url',
                    socialName: msg.text,
                    messageId: userState.messageId
                };
                await updateMessage(chatId, userState.messageId, '🔗 Entrez l\'URL du réseau social:', {
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
                await updateMessage(chatId, userState.messageId, '😀 Entrez un emoji pour ce réseau social (ou envoyez "skip" pour utiliser 🔗):', {
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
                await updateMessage(chatId, userState.messageId, '✅ Réseau social ajouté!', {
                    reply_markup: getSocialManageKeyboard(config)
                });
                break;

            case 'broadcast_message':
                const message = msg.text;
                let successCount = 0;
                let failCount = 0;
                
                await updateMessage(chatId, userState.messageId, '📤 Envoi en cours...');
                
                for (const targetUserId of users) {
                    if (!admins.has(targetUserId)) { // Ne pas envoyer aux admins
                        try {
                            await bot.sendMessage(targetUserId, `📢 Message de l'administrateur:\n\n${message}`);
                            successCount++;
                        } catch (error) {
                            failCount++;
                        }
                    }
                }
                
                const totalUsers = users.size - admins.size; // Exclure tous les admins
                delete userStates[userId];
                await updateMessage(chatId, userState.messageId, 
                    `✅ Message diffusé!\n\n📊 Statistiques:\n👥 Utilisateurs totaux: ${totalUsers}\n✅ Envoyés: ${successCount}\n❌ Échecs: ${failCount}`, {
                    reply_markup: getAdminKeyboard()
                });
                break;

            case 'adding_admin':
                const newAdminId = parseInt(msg.text);
                if (isNaN(newAdminId)) {
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: '❌ ID invalide. Veuillez entrer un nombre.',
                        show_alert: true
                    });
                    break;
                }
                
                if (admins.has(newAdminId)) {
                    await bot.answerCallbackQuery(callbackQuery.id, {
                        text: '⚠️ Cet utilisateur est déjà administrateur!',
                        show_alert: true
                    });
                } else {
                    admins.add(newAdminId);
                    saveAdmins();
                    delete userStates[userId];
                    
                    const adminsList = Array.from(admins).map(id => {
                        if (id === ADMIN_ID) return `👑 ${id} (Principal)`;
                        return `👤 ${id}`;
                    }).join('\n');
                    
                    await updateMessage(chatId, userState.messageId, 
                        `✅ Administrateur ajouté!\n\n👥 Administrateurs actuels:\n\n${adminsList}`, {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '➕ Ajouter un admin', callback_data: 'admin_add_admin' }],
                                [{ text: '➖ Retirer un admin', callback_data: 'admin_remove_admin' }],
                                [{ text: '⬅️ Retour', callback_data: 'admin_menu' }]
                            ]
                        }
                    });
                }
                break;
        }
    } catch (error) {
        console.error('Erreur lors du traitement du message:', error);
        await sendNewMessage(chatId, '❌ Une erreur s\'est produite. Veuillez réessayer.');
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

                await updateMessage(chatId, userState.messageId, '✅ Photo d\'accueil mise à jour!', {
                    reply_markup: getAdminKeyboard()
                });
            });
        });
    } catch (error) {
        console.error('Erreur lors du traitement de la photo:', error);
        await sendNewMessage(chatId, '❌ Une erreur s\'est produite lors du traitement de la photo.');
    }
});

// Gestion des erreurs
bot.on('polling_error', (error) => {
    console.error('Erreur de polling:', error);
});

console.log('🤖 Bot démarré avec succès!');
console.log(`📱 Parlez au bot: https://t.me/${process.env.BOT_USERNAME || 'votre_bot'}`);
console.log(`🔧 ID Admin: ${ADMIN_ID}`);
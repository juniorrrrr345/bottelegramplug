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

// Temps de démarrage du bot
const botStartTime = new Date();

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
async function sendWelcomeMessage(chatId, editMessageId = null, userInfo = null) {
    try {
        // Personnaliser le message avec le nom de l'utilisateur
        let personalizedMessage = config.welcomeMessage || 'Bienvenue !';
        
        // Si on a les infos de l'utilisateur, remplacer les variables
        if (userInfo) {
            personalizedMessage = personalizedMessage
                .replace(/{firstname}/gi, userInfo.first_name || '')
                .replace(/{lastname}/gi, userInfo.last_name || '')
                .replace(/{username}/gi, userInfo.username ? `@${userInfo.username}` : '')
                .replace(/{fullname}/gi, `${userInfo.first_name || ''} ${userInfo.last_name || ''}`.trim());
        }
        
        const options = {
            reply_markup: getMainKeyboard(config),
            parse_mode: 'HTML'
        };

        if (config.welcomeImage) {
            const imagePath = getImagePath(config.welcomeImage);
            if (fs.existsSync(imagePath)) {
                // Avec image, on doit envoyer un nouveau message
                await sendNewPhoto(chatId, imagePath, {
                    caption: personalizedMessage,
                    ...options
                });
            } else {
                // Sans image valide, utiliser du texte
                if (editMessageId && activeMessages[chatId] === editMessageId) {
                    await updateMessage(chatId, editMessageId, personalizedMessage, options);
                } else {
                    await sendNewMessage(chatId, personalizedMessage, options);
                }
            }
        } else {
            // Sans image, on peut éditer ou envoyer un nouveau message
            if (editMessageId && activeMessages[chatId] === editMessageId) {
                await updateMessage(chatId, editMessageId, personalizedMessage, options);
            } else {
                await sendNewMessage(chatId, personalizedMessage, options);
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
    
    // Envoyer le message d'accueil avec les infos de l'utilisateur
    await sendWelcomeMessage(chatId, null, msg.from);
});

// Commande /id pour obtenir son ID
bot.onText(/\/id/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username ? `@${msg.from.username}` : 'Non défini';
    const firstName = msg.from.first_name;
    const lastName = msg.from.last_name || '';
    
    // Supprimer le message de commande
    try {
        await bot.deleteMessage(chatId, msg.message_id);
    } catch (error) {}
    
    const idMessage = `🆔 **Vos informations**\n\n` +
        `👤 **Nom:** ${firstName} ${lastName}\n` +
        `📛 **Username:** ${username}\n` +
        `🔢 **ID Telegram:** \`${userId}\`\n\n` +
        `_Vous pouvez copier votre ID en cliquant dessus_`;
    
    await sendNewMessage(chatId, idMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '❌ Fermer', callback_data: 'admin_close' }
            ]]
        }
    });
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
                await sendWelcomeMessage(chatId, messageId, callbackQuery.from);
                break;

            case 'admin_menu':
                await updateMessage(chatId, messageId, '🔧 Menu Administrateur', {
                    reply_markup: getAdminKeyboard()
                });
                break;

            case 'admin_edit_welcome':
                userStates[userId] = { action: 'editing_welcome', messageId: messageId };
                const currentWelcome = config.welcomeMessage || 'Aucun message configuré';
                await updateMessage(chatId, messageId, 
                    `📝 **Message d'accueil actuel:**\n\n${currentWelcome}\n\n` +
                    `💡 **Variables disponibles:**\n` +
                    `• \`{firstname}\` - Prénom de l'utilisateur\n` +
                    `• \`{lastname}\` - Nom de famille\n` +
                    `• \`{username}\` - @username\n` +
                    `• \`{fullname}\` - Nom complet\n\n` +
                    `📌 **Exemple:** Bienvenue {firstname} ! 👋\n\n` +
                    `_Envoyez le nouveau message d'accueil pour le remplacer_`, {
                    parse_mode: 'Markdown',
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
                const currentMiniApp = config.miniApp ? 
                    `Nom: ${config.miniApp.text || 'Non défini'}\nURL: ${config.miniApp.url || 'Non défini'}` : 
                    'Aucune mini application configurée';
                await updateMessage(chatId, messageId, 
                    `📱 **Mini Application actuelle:**\n\n${currentMiniApp}\n\n` +
                    `💡 *Entrez le nom du bouton pour la mini application*`, {
                    parse_mode: 'Markdown',
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
                const currentInfo = config.infoText || 'Aucune information configurée';
                await updateMessage(chatId, messageId, 
                    `ℹ️ **Informations actuelles:**\n\n${currentInfo}\n\n` +
                    `💡 *Envoyez le nouveau texte pour remplacer les informations*`, {
                    parse_mode: 'Markdown',
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
                const adminsList = await Promise.all(Array.from(admins).map(async (id) => {
                    try {
                        const chat = await bot.getChat(id);
                        const name = chat.first_name + (chat.last_name ? ` ${chat.last_name}` : '');
                        const username = chat.username ? `@${chat.username}` : '';
                        if (id === ADMIN_ID) {
                            return `👑 **${name}**${username ? ` (${username})` : ''}\n   └─ ID: \`${id}\` _(Principal)_`;
                        }
                        return `👤 **${name}**${username ? ` (${username})` : ''}\n   └─ ID: \`${id}\``;
                    } catch (error) {
                        if (id === ADMIN_ID) return `👑 ID: \`${id}\` _(Principal)_`;
                        return `👤 ID: \`${id}\``;
                    }
                }));
                
                const adminCount = admins.size;
                const adminMessage = `👥 **Gestion des Administrateurs**\n\n` +
                    `📊 Total: ${adminCount} administrateur${adminCount > 1 ? 's' : ''}\n\n` +
                    `**Liste des administrateurs:**\n${adminsList.join('\n\n')}`;
                
                await updateMessage(chatId, messageId, adminMessage, {
                    parse_mode: 'Markdown',
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
                await updateMessage(chatId, messageId, 
                    `👤 **Ajouter un nouvel administrateur**\n\n` +
                    `📝 Envoyez l'ID Telegram du nouvel administrateur\n\n` +
                    `💡 _Pour obtenir l'ID d'un utilisateur, il doit d'abord démarrer le bot avec /start_`, {
                    parse_mode: 'Markdown',
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

            case 'admin_stats':
                // Calculer les statistiques
                const totalUsers = users.size;
                const totalAdmins = admins.size;
                const regularUsers = totalUsers - totalAdmins;
                
                // Obtenir la date de démarrage du bot (à partir du premier utilisateur ou maintenant)
                const now = new Date();
                const startTime = botStartTime || now;
                const uptime = now - startTime;
                const uptimeDays = Math.floor(uptime / (1000 * 60 * 60 * 24));
                const uptimeHours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
                
                // Créer le message de statistiques
                const statsMessage = `📊 **Statistiques du Bot**\n\n` +
                    `👥 **Utilisateurs**\n` +
                    `├─ Total: ${totalUsers}\n` +
                    `├─ Utilisateurs réguliers: ${regularUsers}\n` +
                    `└─ Administrateurs: ${totalAdmins}\n\n` +
                    `⏱️ **Temps de fonctionnement**\n` +
                    `└─ ${uptimeDays}j ${uptimeHours}h ${uptimeMinutes}m\n\n` +
                    `📅 **Dernière mise à jour**\n` +
                    `└─ ${now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}\n\n` +
                    `💾 **Données**\n` +
                    `├─ Réseaux sociaux: ${config.socialNetworks ? config.socialNetworks.length : 0}\n` +
                    `└─ Message d'accueil: ${config.welcomeMessage ? 'Configuré ✅' : 'Non configuré ❌'}`;
                
                await updateMessage(chatId, messageId, statsMessage, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔄 Actualiser', callback_data: 'admin_stats' }],
                            [{ text: '📥 Exporter les utilisateurs', callback_data: 'admin_export_users' }],
                            [{ text: '⬅️ Retour', callback_data: 'admin_menu' }]
                        ]
                    }
                });
                break;

            case 'admin_export_users':
                // Créer une liste détaillée des utilisateurs
                const usersDetails = await Promise.all(Array.from(users).map(async (userId) => {
                    try {
                        const userChat = await bot.getChat(userId);
                        const isAdmin = admins.has(userId);
                        const firstName = userChat.first_name || '';
                        const lastName = userChat.last_name || '';
                        const username = userChat.username ? `@${userChat.username}` : 'Pas de username';
                        const fullName = `${firstName} ${lastName}`.trim() || 'Sans nom';
                        
                        return `ID: ${userId}${isAdmin ? ' [ADMIN]' : ''}\n` +
                               `Nom: ${fullName}\n` +
                               `Username: ${username}\n` +
                               `Type: ${userChat.type}\n` +
                               `----------------------------`;
                    } catch (error) {
                        // Si on ne peut pas obtenir les infos (utilisateur a bloqué le bot)
                        return `ID: ${userId}${admins.has(userId) ? ' [ADMIN]' : ''}\n` +
                               `Status: Utilisateur inaccessible (a peut-être bloqué le bot)\n` +
                               `----------------------------`;
                    }
                }));
                
                // Créer le contenu du fichier avec des statistiques
                const exportDate = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
                const totalUsers = users.size;
                const totalAdmins = admins.size;
                const regularUsers = totalUsers - totalAdmins;
                
                const fileContent = `📊 EXPORT DES UTILISATEURS DU BOT\n` +
                    `📅 Date d'export: ${exportDate}\n` +
                    `============================\n\n` +
                    `STATISTIQUES:\n` +
                    `- Total utilisateurs: ${totalUsers}\n` +
                    `- Utilisateurs réguliers: ${regularUsers}\n` +
                    `- Administrateurs: ${totalAdmins}\n` +
                    `============================\n\n` +
                    `LISTE DÉTAILLÉE:\n\n` +
                    usersDetails.join('\n\n');
                
                // Envoyer le fichier
                await bot.sendDocument(chatId, Buffer.from(fileContent, 'utf-8'), {
                    filename: `users_export_${new Date().toISOString().split('T')[0]}.txt`,
                    caption: `📥 **Export complet des utilisateurs**\n\n` +
                             `📊 Total: ${totalUsers} utilisateurs\n` +
                             `👤 Réguliers: ${regularUsers}\n` +
                             `👑 Admins: ${totalAdmins}`
                }, {
                    parse_mode: 'Markdown'
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
                await updateMessage(chatId, userState.messageId, '✅ Message d\'accueil mis à jour!');
                
                // Retour automatique au menu après 2 secondes
                setTimeout(async () => {
                    await updateMessage(chatId, userState.messageId, '🔧 Menu Administrateur', {
                        reply_markup: getAdminKeyboard()
                    });
                }, 2000);
                break;

            case 'editing_info':
                config.infoText = msg.text;
                saveConfig(config);
                delete userStates[userId];
                await updateMessage(chatId, userState.messageId, '✅ Texte d\'informations mis à jour!');
                
                // Retour automatique au menu après 2 secondes
                setTimeout(async () => {
                    await updateMessage(chatId, userState.messageId, '🔧 Menu Administrateur', {
                        reply_markup: getAdminKeyboard()
                    });
                }, 2000);
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
                    // Vérifier si l'utilisateur existe
                    try {
                        const newAdminChat = await bot.getChat(newAdminId);
                        const newAdminName = newAdminChat.first_name + (newAdminChat.last_name ? ` ${newAdminChat.last_name}` : '');
                        const newAdminUsername = newAdminChat.username ? `@${newAdminChat.username}` : '';
                        
                        admins.add(newAdminId);
                        saveAdmins();
                        delete userStates[userId];
                        
                        // Notifier le nouvel administrateur
                        try {
                            await bot.sendMessage(newAdminId, 
                                `🎉 **Félicitations!**\n\n` +
                                `Vous avez été promu administrateur du bot.\n` +
                                `Utilisez /admin pour accéder au menu administrateur.`, 
                                { parse_mode: 'Markdown' }
                            );
                        } catch (error) {
                            // L'utilisateur n'a peut-être pas démarré le bot
                        }
                        
                        const adminsList = await Promise.all(Array.from(admins).map(async (id) => {
                            try {
                                const chat = await bot.getChat(id);
                                const name = chat.first_name + (chat.last_name ? ` ${chat.last_name}` : '');
                                const username = chat.username ? `@${chat.username}` : '';
                                if (id === ADMIN_ID) {
                                    return `👑 **${name}**${username ? ` (${username})` : ''}\n   └─ ID: \`${id}\` _(Principal)_`;
                                }
                                return `👤 **${name}**${username ? ` (${username})` : ''}\n   └─ ID: \`${id}\``;
                            } catch (error) {
                                if (id === ADMIN_ID) return `👑 ID: \`${id}\` _(Principal)_`;
                                return `👤 ID: \`${id}\``;
                            }
                        }));
                        
                        const adminCount = admins.size;
                        await updateMessage(chatId, userState.messageId, 
                            `✅ **Administrateur ajouté avec succès!**\n\n` +
                            `👤 **Nouvel admin:** ${newAdminName}${newAdminUsername ? ` (${newAdminUsername})` : ''}\n\n` +
                            `📊 Total: ${adminCount} administrateur${adminCount > 1 ? 's' : ''}\n\n` +
                            `**Liste des administrateurs:**\n${adminsList.join('\n\n')}`, {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '➕ Ajouter un admin', callback_data: 'admin_add_admin' }],
                                    [{ text: '➖ Retirer un admin', callback_data: 'admin_remove_admin' }],
                                    [{ text: '⬅️ Retour', callback_data: 'admin_menu' }]
                                ]
                            }
                        });
                    } catch (error) {
                        await updateMessage(chatId, userState.messageId, 
                            `❌ **Erreur**\n\n` +
                            `Impossible de trouver l'utilisateur avec l'ID: ${newAdminId}\n` +
                            `Assurez-vous que l'utilisateur a démarré le bot avec /start`, {
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [[
                                    { text: '⬅️ Retour', callback_data: 'admin_manage_admins' }
                                ]]
                            }
                        });
                    }
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
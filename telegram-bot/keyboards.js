// Créer le clavier principal
function getMainKeyboard(config) {
    const keyboard = [];
    
    // Bouton Mini App (si configuré)
    if (config.miniApp && config.miniApp.url) {
        keyboard.push([{
            text: config.miniApp.text || "🎮 Mini Application",
            web_app: { url: config.miniApp.url }
        }]);
    }
    
    // Bouton Informations
    keyboard.push([{
        text: "ℹ️ Informations",
        callback_data: "info"
    }]);
    
    // Boutons réseaux sociaux
    if (config.socialNetworks && config.socialNetworks.length > 0) {
        const socialRow = [];
        config.socialNetworks.forEach((network, index) => {
            // Maximum 3 boutons par ligne
            if (index > 0 && index % 3 === 0) {
                keyboard.push([...socialRow]);
                socialRow.length = 0;
            }
            socialRow.push({
                text: `${network.emoji || "🔗"} ${network.name}`,
                url: network.url
            });
        });
        if (socialRow.length > 0) {
            keyboard.push(socialRow);
        }
    }
    
    return {
        inline_keyboard: keyboard
    };
}

// Clavier du menu admin
function getAdminKeyboard() {
    return {
        inline_keyboard: [
            [{ text: "📝 Modifier le message d'accueil", callback_data: "admin_edit_welcome" }],
            [{ text: "🖼️ Modifier la photo d'accueil", callback_data: "admin_edit_photo" }],
            [{ text: "📱 Modifier la mini application", callback_data: "admin_edit_miniapp" }],
            [{ text: "🌐 Gérer les réseaux sociaux", callback_data: "admin_manage_social" }],
            [{ text: "ℹ️ Modifier les informations", callback_data: "admin_edit_info" }],
            [{ text: "📢 Envoyer un message à tous", callback_data: "admin_broadcast" }],
            [{ text: "❌ Fermer", callback_data: "admin_close" }]
        ]
    };
}

// Clavier de gestion des réseaux sociaux
function getSocialManageKeyboard(config) {
    const keyboard = [];
    
    // Afficher les réseaux existants avec option de suppression
    if (config.socialNetworks && config.socialNetworks.length > 0) {
        config.socialNetworks.forEach((network, index) => {
            keyboard.push([{
                text: `❌ Supprimer ${network.emoji || "🔗"} ${network.name}`,
                callback_data: `admin_delete_social_${index}`
            }]);
        });
    }
    
    // Bouton pour ajouter un nouveau réseau
    keyboard.push([{
        text: "➕ Ajouter un réseau social",
        callback_data: "admin_add_social"
    }]);
    
    // Bouton retour
    keyboard.push([{
        text: "⬅️ Retour",
        callback_data: "admin_menu"
    }]);
    
    return {
        inline_keyboard: keyboard
    };
}

// Clavier de confirmation
function getConfirmKeyboard(action) {
    return {
        inline_keyboard: [
            [
                { text: "✅ Confirmer", callback_data: `confirm_${action}` },
                { text: "❌ Annuler", callback_data: "cancel" }
            ]
        ]
    };
}

module.exports = {
    getMainKeyboard,
    getAdminKeyboard,
    getSocialManageKeyboard,
    getConfirmKeyboard
};
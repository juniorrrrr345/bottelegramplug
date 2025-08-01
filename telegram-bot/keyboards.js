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
        const buttonsPerRow = config.socialButtonsPerRow || 3;
        let socialRow = [];
        
        config.socialNetworks.forEach((network, index) => {
            socialRow.push({
                text: `${network.emoji || "🔗"} ${network.name}`,
                url: network.url
            });
            
            // Si on a atteint le nombre de boutons par ligne, ajouter la ligne
            if (socialRow.length === buttonsPerRow || index === config.socialNetworks.length - 1) {
                keyboard.push([...socialRow]);
                socialRow = [];
            }
        });
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
            [{ text: "👥 Gérer les administrateurs", callback_data: "admin_manage_admins" }],
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
    
    // Bouton pour configurer la disposition
    keyboard.push([{
        text: `📐 Disposition: ${config.socialButtonsPerRow || 3} par ligne`,
        callback_data: "admin_social_layout"
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

// Clavier pour choisir la disposition des boutons
function getSocialLayoutKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: "1️⃣", callback_data: "social_layout_1" },
                { text: "2️⃣", callback_data: "social_layout_2" },
                { text: "3️⃣", callback_data: "social_layout_3" },
                { text: "4️⃣", callback_data: "social_layout_4" }
            ],
            [
                { text: "5️⃣", callback_data: "social_layout_5" },
                { text: "6️⃣", callback_data: "social_layout_6" },
                { text: "7️⃣", callback_data: "social_layout_7" },
                { text: "8️⃣", callback_data: "social_layout_8" }
            ],
            [{ text: "⬅️ Retour", callback_data: "admin_manage_social" }]
        ]
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
    getSocialLayoutKeyboard,
    getConfirmKeyboard
};
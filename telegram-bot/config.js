const fs = require('fs-extra');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'bot-config.json');
const IMAGES_DIR = path.join(__dirname, 'images');

// S'assurer que le dossier images existe
fs.ensureDirSync(IMAGES_DIR);

// Configuration par défaut
const defaultConfig = {
    welcomeMessage: "🤖 Bienvenue sur notre bot!\n\nUtilisez les boutons ci-dessous pour naviguer.",
    welcomeImage: null,
    infoText: "ℹ️ Informations\n\nCeci est la section d'informations du bot.",
    miniApp: {
        url: null,
        text: "🎮 Mini Application"
    },
    socialNetworks: [
        { name: "Twitter", url: "https://twitter.com", emoji: "🐦" },
        { name: "Instagram", url: "https://instagram.com", emoji: "📷" },
        { name: "Facebook", url: "https://facebook.com", emoji: "👍" }
    ],
    socialButtonsPerRow: 3 // Nombre de boutons par ligne (1-8)
};

// Charger la configuration
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const savedConfig = fs.readJsonSync(CONFIG_FILE);
            // Fusionner avec la config par défaut pour ajouter les nouvelles propriétés
            return { ...defaultConfig, ...savedConfig };
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration:', error);
    }
    // Retourner la configuration par défaut si le fichier n'existe pas ou en cas d'erreur
    saveConfig(defaultConfig);
    return defaultConfig;
}

// Sauvegarder la configuration
function saveConfig(config) {
    try {
        fs.writeJsonSync(CONFIG_FILE, config, { spaces: 2 });
        return true;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la configuration:', error);
        return false;
    }
}

// Obtenir le chemin complet d'une image
function getImagePath(filename) {
    if (!filename) return null;
    return path.join(IMAGES_DIR, filename);
}

module.exports = {
    loadConfig,
    saveConfig,
    getImagePath,
    IMAGES_DIR
};
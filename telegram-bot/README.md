# Bot Telegram avec Interface d'Administration

Un bot Telegram simple et efficace avec une interface d'administration complète.

## 🚀 Fonctionnalités

### Pour les utilisateurs
- **Message d'accueil** avec photo personnalisable
- **Mini Application** intégrée (Web App Telegram)
- **Boutons de réseaux sociaux** configurables
- **Section Informations** avec contenu personnalisable

### Pour l'administrateur
- Commande `/admin` pour accéder au menu d'administration
- Modifier le message et la photo d'accueil
- Gérer la mini application
- Ajouter/supprimer des réseaux sociaux
- Modifier le texte des informations

## 📋 Prérequis

- Node.js (version 14 ou supérieure)
- Un bot Telegram (créé via [@BotFather](https://t.me/botfather))
- Votre ID Telegram (obtenu via [@userinfobot](https://t.me/userinfobot))

## 🛠️ Installation

1. **Cloner ou télécharger le projet**

2. **Installer les dépendances**
```bash
cd telegram-bot
npm install
```

3. **Configurer les variables d'environnement**
   - Copier `.env.example` vers `.env`
   - Modifier `.env` avec vos informations :
```env
BOT_TOKEN=votre_token_bot_telegram
ADMIN_ID=votre_id_telegram
```

4. **Démarrer le bot**
```bash
npm start
```

## 📱 Utilisation

### Commandes disponibles

- `/start` - Affiche le message d'accueil avec les boutons
- `/admin` - Ouvre le menu d'administration (réservé à l'admin)

### Menu administrateur

1. **📝 Modifier le message d'accueil**
   - Permet de changer le texte affiché au démarrage

2. **🖼️ Modifier la photo d'accueil**
   - Envoyer une nouvelle photo pour l'accueil et les informations

3. **📱 Modifier la mini application**
   - Configurer l'URL et le texte du bouton Web App

4. **🌐 Gérer les réseaux sociaux**
   - Ajouter de nouveaux réseaux (nom, URL, emoji)
   - Supprimer des réseaux existants

5. **ℹ️ Modifier les informations**
   - Changer le texte affiché dans la section informations

## 🔧 Configuration avancée

### Structure des fichiers

- `bot.js` - Fichier principal du bot
- `config.js` - Gestion de la configuration
- `keyboards.js` - Claviers inline Telegram
- `bot-config.json` - Configuration sauvegardée (généré automatiquement)
- `images/` - Dossier pour stocker les photos

### Format de la configuration

La configuration est stockée dans `bot-config.json` :

```json
{
  "welcomeMessage": "Message d'accueil",
  "welcomeImage": "nom_du_fichier.jpg",
  "infoText": "Texte des informations",
  "miniApp": {
    "url": "https://votre-app.com",
    "text": "🎮 Ma Mini App"
  },
  "socialNetworks": [
    {
      "name": "Twitter",
      "url": "https://twitter.com/username",
      "emoji": "🐦"
    }
  ]
}
```

## 🚨 Dépannage

### Le bot ne répond pas
- Vérifier que le token est correct
- S'assurer que le bot n'est pas déjà en cours d'exécution ailleurs

### Erreur "ADMIN_ID n'est pas défini"
- Ajouter votre ID Telegram dans le fichier `.env`

### Les images ne s'affichent pas
- Vérifier que le dossier `images/` existe
- S'assurer que les photos sont bien envoyées en tant que photos (pas fichiers)

## 📝 Notes

- Les photos sont automatiquement sauvegardées localement
- La configuration est persistante (survit aux redémarrages)
- Un seul administrateur peut être défini à la fois
- Les mini applications nécessitent HTTPS

## 🤝 Support

Pour toute question ou problème, vérifiez d'abord que :
- Node.js est bien installé
- Les dépendances sont installées (`npm install`)
- Le fichier `.env` est correctement configuré
- Le bot a été créé via BotFather et est actif

## 🚀 Déploiement sur Render

### 1. Préparer le code
- Assurez-vous que votre code est sur GitHub, GitLab ou Bitbucket
- Le fichier `render.yaml` est déjà configuré pour le déploiement

### 2. Créer un nouveau service sur Render
1. Allez sur [render.com](https://render.com)
2. Connectez votre compte GitHub/GitLab
3. Cliquez sur "New +" → "Background Worker"
4. Sélectionnez votre repository
5. Render détectera automatiquement le fichier `render.yaml`

### 3. Configurer les variables d'environnement
Dans les paramètres du service Render, ajoutez :
- `BOT_TOKEN` : Votre token de bot Telegram
- `ADMIN_ID` : Votre ID utilisateur Telegram

### 4. Déployer
- Cliquez sur "Create Background Worker"
- Render construira et démarrera automatiquement votre bot

### 5. Vérifier le fonctionnement
- Vérifiez les logs dans le dashboard Render
- Testez votre bot sur Telegram avec `/start`

### Notes importantes pour Render
- Le bot est déployé comme "Background Worker" (pas Web Service)
- Render redémarre automatiquement le bot en cas de crash
- Les images uploadées seront perdues lors des redéploiements (utilisez un service de stockage externe pour la persistance)
- La version gratuite de Render peut avoir des limitations
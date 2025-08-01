# 🔄 Guide pour dupliquer votre bot Telegram

## 📋 Prérequis
- Un nouveau bot créé sur @BotFather
- Un compte GitHub
- Un compte Render

## 🚀 Étapes pour dupliquer

### 1. Créer un nouveau bot sur Telegram

1. Allez sur [@BotFather](https://t.me/botfather)
2. Envoyez `/newbot`
3. Choisissez un nom (ex: "Mon Super Bot")
4. Choisissez un username (ex: @monsuperbot_bot)
5. **Sauvegardez le token** (ex: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Dupliquer le code sur GitHub

#### Option A : Fork (Recommandé pour plusieurs bots)
1. Allez sur [github.com/juniorrrrr345/bottelegramplug](https://github.com/juniorrrrr345/bottelegramplug)
2. Cliquez sur **Fork** en haut à droite
3. Renommez le fork (ex: `mon-nouveau-bot`)

#### Option B : Utiliser comme template
1. Créez un nouveau repository
2. Clonez votre bot actuel :
```bash
git clone https://github.com/juniorrrrr345/bottelegramplug mon-nouveau-bot
cd mon-nouveau-bot
rm -rf .git
git init
git add .
git commit -m "Initial commit"
```
3. Créez un nouveau repo sur GitHub et poussez

### 3. Modifier la configuration par défaut (Optionnel)

Éditez `bot-config.json` pour personnaliser :
```json
{
  "welcomeMessage": "Bienvenue {firstname} sur Mon Nouveau Bot! 👋",
  "welcomeImage": "",
  "infoText": "ℹ️ Informations sur mon nouveau bot",
  "miniApp": {
    "text": "🎮 Mon App",
    "url": "https://monapp.com"
  },
  "socialNetworks": []
}
```

### 4. Déployer sur Render

1. **Connectez-vous à Render**
2. **Cliquez sur "New +" → "Web Service"**
3. **Connectez votre nouveau repository**
4. **Configuration :**
   - Build Command: `npm install`
   - Start Command: `node bot-webhook.js`

### 5. Variables d'environnement

Dans Render, ajoutez ces variables pour CHAQUE nouveau bot :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `BOT_TOKEN` | Token du nouveau bot | `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz` |
| `ADMIN_ID` | Votre ID Telegram | `7670522278` |
| `WEBHOOK_URL` | URL du service Render | `https://mon-nouveau-bot.onrender.com` |

### 6. Activer le bot

1. Attendez le déploiement
2. Copiez l'URL Render
3. Ajoutez-la dans `WEBHOOK_URL`
4. Le bot redémarre automatiquement

## 🎯 Script de duplication rapide

Créez `duplicate-bot.sh` :

```bash
#!/bin/bash
# Usage: ./duplicate-bot.sh nouveau-nom-bot

NEW_BOT_NAME=$1

# Clone le repo
git clone https://github.com/juniorrrrr345/bottelegramplug $NEW_BOT_NAME
cd $NEW_BOT_NAME

# Supprime l'historique git
rm -rf .git
git init

# Modifie le nom dans package.json
sed -i "s/telegram-bot/$NEW_BOT_NAME/g" package.json

# Commit initial
git add .
git commit -m "Initial commit for $NEW_BOT_NAME"

echo "✅ Bot dupliqué! Maintenant:"
echo "1. Créez un repo GitHub pour $NEW_BOT_NAME"
echo "2. Ajoutez le remote: git remote add origin <URL>"
echo "3. Push: git push -u origin main"
echo "4. Déployez sur Render avec les nouvelles variables"
```

## 💡 Gestion de plusieurs bots

### Structure recommandée :
```
mes-bots/
├── bot-principal/
├── bot-boutique/
├── bot-support/
└── bot-communaute/
```

### Variables différentes pour chaque bot :
- **bot-principal**: Token A, Admin: vous
- **bot-boutique**: Token B, Admin: vous + équipe
- **bot-support**: Token C, Admin: support team

## 🔐 Sécurité

1. **Ne partagez JAMAIS les tokens**
2. **Utilisez des repos privés** si nécessaire
3. **Différents admins** pour différents bots

## 📊 Tableau de bord multi-bots

Pour gérer plusieurs bots :
1. Utilisez des noms descriptifs
2. Documentez quel bot fait quoi
3. Utilisez UptimeRobot pour monitorer tous vos bots

## ✅ Checklist de duplication

- [ ] Nouveau bot créé sur @BotFather
- [ ] Code dupliqué/forké
- [ ] Repository GitHub créé
- [ ] Déployé sur Render
- [ ] Variables d'environnement configurées
- [ ] Bot testé avec /start
- [ ] Monitoring activé (UptimeRobot)
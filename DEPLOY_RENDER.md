# 🚀 Guide de déploiement gratuit sur Render

## 📋 Prérequis
- Un compte GitHub
- Un compte Render (gratuit)
- Votre bot Telegram configuré

## 🔧 Étapes de déploiement

### 1. Préparer votre repository GitHub

1. Assurez-vous que votre code est sur GitHub
2. Le fichier `render.yaml` est déjà configuré pour le déploiement gratuit

### 2. Créer un compte Render

1. Allez sur [render.com](https://render.com)
2. Inscrivez-vous gratuitement avec votre compte GitHub

### 3. Déployer le bot

1. Dans Render, cliquez sur **"New +"** → **"Web Service"**
2. Connectez votre repository GitHub
3. Sélectionnez votre repository `bottelegramplug`
4. Render détectera automatiquement le fichier `render.yaml`

### 4. Configurer les variables d'environnement

Dans Render, ajoutez ces variables d'environnement :

| Variable | Valeur |
|----------|--------|
| `BOT_TOKEN` | `8128299360:AAEWmbRLjkTaQYP17GsiGm5vhQv8AcJLKIY` |
| `ADMIN_ID` | `7670522278` |
| `WEBHOOK_URL` | (sera ajouté après le déploiement) |

### 5. Déployer

1. Cliquez sur **"Create Web Service"**
2. Attendez que le déploiement se termine
3. Copiez l'URL de votre service (ex: `https://votre-bot.onrender.com`)

### 6. Configurer le webhook

1. Retournez dans les variables d'environnement
2. Ajoutez/modifiez `WEBHOOK_URL` avec : `https://votre-bot.onrender.com`
3. Le service redémarrera automatiquement

### 7. Activer le webhook sur Telegram

Le bot configurera automatiquement le webhook au démarrage.

## ⚠️ Limitations du plan gratuit

- Le service se met en veille après 15 minutes d'inactivité
- Premier message peut prendre 30-50 secondes (réveil du service)
- Limite de 750 heures/mois (largement suffisant pour un bot)

## 💡 Variables personnalisées dans le message d'accueil

Vous pouvez utiliser ces variables dans votre message d'accueil :
- `{firstname}` - Prénom de l'utilisateur
- `{lastname}` - Nom de famille
- `{username}` - @username
- `{fullname}` - Nom complet

**Exemple :**
```
Bienvenue {firstname} ! 👋
Ravi de te voir sur notre bot !
```

## 🔍 Vérification

Pour vérifier que tout fonctionne :
1. Allez sur Telegram
2. Cherchez votre bot : `@jsjshsheejdbot`
3. Envoyez `/start`

## 🆘 Dépannage

Si le bot ne répond pas :
1. Vérifiez les logs dans Render (Dashboard → Logs)
2. Assurez-vous que toutes les variables sont correctement définies
3. Vérifiez que l'URL du webhook est correcte

## 📝 Notes importantes

- Le mode webhook est GRATUIT sur Render
- Pas besoin de carte de crédit
- Le bot restera actif tant que des utilisateurs l'utilisent
- Les données (config.json, users.json, etc.) sont persistantes
# 🚀 Garder votre bot Telegram actif 24/7 (Gratuit)

## Option 1 : UptimeRobot (Recommandé - 100% Gratuit)

### 1. Créez un compte sur [uptimerobot.com](https://uptimerobot.com)
- Inscription gratuite
- Permet jusqu'à 50 moniteurs

### 2. Ajoutez un nouveau moniteur
- **Monitor Type:** HTTP(s)
- **Friendly Name:** Bot Telegram
- **URL:** `https://coffeela55.onrender.com`
- **Monitoring Interval:** 5 minutes

### 3. Créez une route de santé dans votre bot

Ajoutez ceci dans `bot-webhook.js` après `app.post` :

```javascript
// Route de santé pour les pings
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
```

### 4. Mettez à jour l'URL dans UptimeRobot
- **URL:** `https://coffeela55.onrender.com/health`

## Option 2 : Cron-job.org (Gratuit aussi)

### 1. Créez un compte sur [cron-job.org](https://cron-job.org)
### 2. Créez un nouveau job
- **URL:** `https://coffeela55.onrender.com/health`
- **Execution:** Every 10 minutes
- **Method:** GET

## Option 3 : GitHub Actions (Pour les développeurs)

Créez `.github/workflows/keep-alive.yml` :

```yaml
name: Keep Bot Alive
on:
  schedule:
    - cron: '*/10 * * * *'  # Toutes les 10 minutes
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Bot
        run: curl https://coffeela55.onrender.com/health
```

## 🎯 Résultat
- Votre bot restera actif pendant les heures d'utilisation
- Réponse instantanée aux messages
- 100% gratuit
- Aucune carte de crédit requise

## 📊 Statistiques UptimeRobot
- Vous verrez le temps de disponibilité
- Notifications si le bot tombe
- Graphiques de performance
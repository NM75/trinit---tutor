# Trinité Tutor 🧚 — Guide de déploiement

## Ce dont tu as besoin (10 minutes max)

1. **Un compte GitHub** (gratuit) → github.com
2. **Un compte Vercel** (gratuit) → vercel.com (connecte-le à ton GitHub)
3. **Une clé API Anthropic** → console.anthropic.com (ajoute 5€ de crédit)

---

## Étape 1 : Créer le repo GitHub

1. Va sur **github.com** → bouton **"New repository"** (le + en haut à droite)
2. Nom : `trinite-tutor`
3. Visibilité : **Public** (le code ne contient aucun secret)
4. Clique **"Create repository"**

## Étape 2 : Uploader les fichiers

1. Sur la page du repo, clique **"uploading an existing file"**
2. Glisse les fichiers/dossiers suivants :
   - `public/index.html`
   - `api/chat.js`
   - `vercel.json`
   - `package.json`
3. Clique **"Commit changes"**

⚠️ Vérifie bien que la structure est :
```
trinite-tutor/
├── api/
│   └── chat.js
├── public/
│   └── index.html
├── package.json
└── vercel.json
```

## Étape 3 : Déployer sur Vercel

1. Va sur **vercel.com** → **"Add New Project"**
2. Importe le repo `trinite-tutor` depuis GitHub
3. **Framework Preset** : laisse "Other"
4. Clique **"Deploy"** (ça prend 30 secondes)

## Étape 4 : Ajouter les variables d'environnement

1. Dans Vercel, va dans **Settings** → **Environment Variables**
2. Ajoute ces deux variables :

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | Ta clé API (commence par `sk-ant-...`) |
| `APP_PASSWORD` | Le mot de passe que tu veux (ex: `trinite2025`) |

3. Clique **"Save"**
4. Va dans **Deployments** → clique les 3 points → **"Redeploy"**

## Étape 5 : C'est prêt ! 🎉

Ton app est accessible à : `https://trinite-tutor.vercel.app` (ou le nom que Vercel t'a donné)

### Pour l'utiliser :
1. Ouvre le lien dans Safari (iPad/iPhone) ou n'importe quel navigateur
2. Entre le mot de passe (une seule fois, il est sauvegardé)
3. Configure les prénoms/âges des enfants (une seule fois aussi)
4. C'est parti !

### Pour le partager :
Envoie le lien + le mot de passe à qui tu veux. Chaque famille configurera ses propres enfants à la première utilisation.

### Pour ajouter le tuteur à l'écran d'accueil de l'iPad :
Safari → bouton partage (carré + flèche) → "Sur l'écran d'accueil"

---

## Coûts estimés

- **Vercel** : gratuit
- **GitHub** : gratuit
- **API Anthropic** : ~2-3 centimes par session → quelques euros/mois même avec plusieurs familles
- Tu peux mettre un plafond de dépense sur console.anthropic.com

---

## Pour modifier l'app

1. Modifie les fichiers sur GitHub (ou en local + push)
2. Vercel redéploie automatiquement en 30 secondes
3. Pas besoin de toucher à Vercel

---

## Prochaine étape : les rapports par email

Pour ajouter l'envoi de rapports par email, il faudra :
1. Créer un compte sur **resend.com** (gratuit, 100 mails/jour)
2. Ajouter un fichier `api/email.js`
3. Ajouter la variable `RESEND_API_KEY` dans Vercel

On peut faire ça ensemble quand tu veux !

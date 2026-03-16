# Deployment

This guide covers deploying Strength 5x5 to Vercel and setting up Google Drive backup integration.

## Prerequisites

- A [GitHub](https://github.com) account with the repository pushed
- A [Vercel](https://vercel.com) account (free tier works)
- A [Google Cloud](https://console.cloud.google.com) account (only if enabling Drive backup)

## 1. Deploy to Vercel

### Import the project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository** and select your `strength5x5` repo
3. Vercel auto-detects the Vite framework -- no build settings need changing
   - Build command: `npm run build`
   - Output directory: `dist`
4. Click **Deploy**

The app will be live at `https://your-project.vercel.app` within a minute.

### Security headers

Security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) are configured in `vercel.json` and applied automatically. No manual configuration is needed.

## 2. Google Drive Setup (Optional)

Skip this section if you don't need cloud backup. The app works fully without it -- the Google Drive UI is hidden when no Client ID is configured.

### 2.1 Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top and select **New Project**
3. Name it (e.g., `Strength 5x5`) and click **Create**
4. Make sure the new project is selected in the dropdown

### 2.2 Enable the Google Drive API

1. Navigate to **APIs & Services > Library** (or search "API Library" in the top search bar)
2. Search for **Google Drive API**
3. Click on it and click **Enable**

### 2.3 Configure the OAuth consent screen

1. Navigate to **APIs & Services > OAuth consent screen**
2. Select **External** as the user type and click **Create**
3. Fill in the required fields:
   - **App name**: `Strength 5x5` (or whatever you prefer)
   - **User support email**: your email address
   - **Developer contact information**: your email address
4. Click **Save and Continue**
5. On the **Scopes** page, click **Add or Remove Scopes**
   - In the filter/search box, type `drive.file`
   - Check the box for `https://www.googleapis.com/auth/drive.file`
   - This scope only allows access to files created by the app -- it cannot read or modify any other files in the user's Drive
   - Click **Update**, then **Save and Continue**
6. On the **Test Users** page:
   - Click **Add Users** and enter the Google accounts you want to test with
   - Click **Save and Continue**
7. Review the summary and click **Back to Dashboard**

> **Testing vs Production mode**: By default, the consent screen is in **Testing** mode. Only the test users you explicitly add can authenticate. To allow anyone to use Google Drive backup, click **Publish App** on the consent screen dashboard. Google may ask for verification, but the `drive.file` scope is generally approved without issues.

### 2.4 Create OAuth credentials

1. Navigate to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Set **Application type** to **Web application**
4. Give it a name (e.g., `Strength 5x5 Web`)
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5173` (for local development)
   - `https://your-project.vercel.app` (your Vercel production URL)
   - If you have a custom domain, add that too (e.g., `https://5x5.yourdomain.com`)
6. Leave **Authorized redirect URIs** empty (not needed for the implicit flow)
7. Click **Create**
8. Copy the **Client ID** (looks like `123456789-xxxx.apps.googleusercontent.com`)

### 2.5 Configure the environment variable

**For local development:**

```bash
cp .env.example .env
```

Edit `.env` and paste your Client ID:

```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

**For production (Vercel):**

1. Go to your project in the [Vercel Dashboard](https://vercel.com)
2. Navigate to **Settings > Environment Variables**
3. Add a new variable:
   - **Key**: `VITE_GOOGLE_CLIENT_ID`
   - **Value**: your Client ID
   - **Environments**: check **Production** (and optionally **Preview**)
4. Click **Save**

> **Important**: Vite bakes `VITE_*` environment variables into the JavaScript bundle at build time. If you add or change the variable after the initial deploy, you must **redeploy** for it to take effect. In Vercel, go to **Deployments** and click the three-dot menu on the latest deployment, then **Redeploy**.

## 3. Custom Domain (Optional)

1. In the Vercel Dashboard, go to **Settings > Domains**
2. Add your custom domain and follow Vercel's DNS instructions
3. After the domain is active, go back to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
4. Edit your OAuth client and add the custom domain to **Authorized JavaScript origins**:
   ```
   https://5x5.yourdomain.com
   ```

## 4. Verify the deployment

1. Open your production URL
2. Navigate to **Options**
3. You should see the **Google Drive** section with a **Connect** button
4. Click **Connect** and complete the Google sign-in flow
5. Complete a workout or add a manual entry -- it should auto-save to Drive
6. Check for the "Last saved" timestamp in the Google Drive section

If the Google Drive section doesn't appear, verify that:
- `VITE_GOOGLE_CLIENT_ID` is set in Vercel environment variables
- The site was deployed (or redeployed) after the variable was added
- Your production URL is listed in the OAuth client's Authorized JavaScript origins

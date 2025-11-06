# ⚙️ Dynamics 365 Multi-App React Framework

A complete scaffolding and build framework for developing modern React applications inside **Microsoft Dynamics 365**.

It provides a robust local development experience (component-based UI, hot-reloading) while solving the core challenge of Dynamics deployment:
each React app is built into a **single, self-contained `.html` file** (with all JS and CSS inlined) that can be easily uploaded as a Dynamics Web Resource.

---

## 🚀 Features

### 🧩 Multi-App, Single Repo

Manage all your React apps (e.g., one for **Account**, one for **Contact**) in a single repository.

### 🧱 Single-File Build

The build process (`npm run build`) inlines all JavaScript and CSS into a single `.html` file per app, making Dynamics deployment effortless.

### ⚙️ Scaffolding CLI

A suite of npm scripts to create and delete apps or pages:

* `npm run create-app`
* `npm run delete-app`
* `npm run add-page`
* `npm run delete-page`

### 🧭 Automatic Navigation

* Adding a second page auto-generates a **Fluent UI** sidebar and routing logic.
* Deleting the last page reverts it to a simple single-page app.

### 🧠 Dynamics Launcher

An `AppLauncher.js` file is auto-generated with all logic required to open your React apps from a Dynamics ribbon button (form or grid context).

---

## 🛠️ Technology Stack

| Category        | Package                                                          |
| --------------- | ---------------------------------------------------------------- |
| Framework       | `react`, `react-dom`                                             |
| UI Kit          | `@fluentui/react` *(Microsoft's official component library)*     |
| Build Scripts   | `react-scripts` *(Create React App)*                             |
| Build Overrides | `react-app-rewired` *(The “magic” that enables multi-app setup)* |

---

## 📋 Prerequisites

Ensure you have the following installed:

* [Node.js](https://nodejs.org/) (LTS version recommended)
* npm (comes with Node.js)
* Git

---

## 🏁 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/your-repo-name.git
cd dynamics-365-multi-app-react-framework
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Your First App

```bash
npm run create-app MyFirstApp
```

You’re ready to go!

---

## ⚡ Core Workflows

### 1. Create a New App

```bash
npm run create-app MyNewApp
```

This will:

* Create `src/MyNewApp.tsx`
* Create `src/components/pages/MyNewApp/MyNewAppPage.tsx`
* Add the app to `scripts/app.config.js`
* Regenerate `dynamics/AppLauncher.js` with a new `openMyNewApp()` helper

---

### 2. Run an App in Development

```bash
npm run start MyNewApp
```

Starts a local dev server with **hot-reloading**.

---

### 3. Add a Page to an App

```bash
npm run add-page MyNewApp Settings
```

Creates:

* `src/components/pages/MyNewApp/SettingsPage.tsx`
* Automatically updates `src/MyNewApp.tsx` for navigation and routing.

---

### 4. Build All Apps for Production

```bash
npm run build
```

Outputs a `build-[AppName]/[AppName].html` for each app — ready for upload.

---

### 5. Cleanup & Maintenance

Remove a page:

```bash
npm run delete-page MyNewApp Settings
```

Remove an entire app:

```bash
npm run delete-app MyNewApp
```

---

## ☁️ Deployment to Dynamics 365

1. **Configure Launcher Path**
   Update the `WEB_RESOURCE_BASE_PATH` constant in:

   * `scripts/create-app.js`
   * `scripts/delete-app.js`
     Example:

   ```js
   const WEB_RESOURCE_BASE_PATH = "new_prefix/reactapps";
   ```

2. **Build Apps**

   ```bash
   npm run build
   ```

3. **Upload Launcher**
   Upload `dynamics/AppLauncher.js` as a JS Web Resource (e.g., `new_prefix/AppLauncher.js`).

4. **Upload Apps**
   Upload each built HTML file (e.g., `build-MyNewApp/MyNewApp.html`) as an HTML Web Resource:

   ```
   new_prefix/reactapps/MyNewApp.html
   ```

5. **Hook Up Ribbon Button**

   * Add the `AppLauncher.js` Web Resource to your command.
   * Set the command’s action to call:

     ```js
     AppLauncher.openMyNewApp
     ```
   * Pass the `PrimaryControl` (Form) or `SelectedControl` (Grid) context as needed.

---

## 📁 Project Structure

```
.
├── build-[AppName]/
│   └── [AppName].html         # (Generated) Single, inlined HTML file
├── dynamics/
│   └── AppLauncher.js         # (Generated) Dynamics launcher logic
├── node_modules/
├── public/
│   └── index.html             # Template used by dev server
├── scripts/
│   ├── add-page-to-app.js
│   ├── app.config.js          # *** MANIFEST OF ALL APPS ***
│   ├── build-pages.js
│   ├── create-open.js
│   ├── delete-app.js
│   ├── delete-page.js
│   └── start-app.js
├── src/
│   ├── components/
│   │   └── pages/
│   │       └── [AppName]/
│   │           ├── [AppName]Page.tsx
│   │           └── [PageName]Page.tsx
│   ├── context/
│   │   └── DynamicsProvider.tsx
│   ├── index.css
│   └── [AppName].tsx
├── .gitignore
├── config-overrides.js        # *** react-app-rewired config (the “magic”) ***
├── package.json
└── README.md
```

---

## 💡 Tip

When working with multiple apps, consider naming conventions like `AccountApp`, `ContactApp`, etc., to keep navigation and build outputs organized.

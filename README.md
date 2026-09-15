# HabitFlow 🚀

**HabitFlow** is an interactive habit tracker, daily schedule planner, and routine manager built with React, Vite, Capacitor, and Tailwind CSS.

---

## 📱 Download Android APK

The repository includes an automated **GitHub Actions Workflow** (`.github/workflows/build-apk.yml`) that compiles the Android APK on every push or tag release.

### How to Download:
1. **From GitHub Releases (Recommended)**:
   - Go to the **Releases** section of this GitHub repository.
   - Expand **Assets** under the latest release.
   - Download `app-debug.apk` and install it on your Android phone.

2. **From GitHub Actions Workflows**:
   - Go to the **Actions** tab in this GitHub repository.
   - Click on the latest run under **Build Android APK**.
   - Scroll down to **Artifacts** and download `HabitFlow-Android-APK`.

---

## 💻 Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start web dev server**:
   ```bash
   npm run dev
   ```

3. **Build Web Assets**:
   ```bash
   npm run build
   ```

4. **Sync with Android Project**:
   ```bash
   npm run cap:sync
   ```

---

## ⚡ Features
- 🎯 **Habit Management**: Track boolean habits, measurable targets, subtasks, and streaks.
- ⏰ **Clock Alarms & Schedule Planner**: Interactive neon clock time picker with custom sound chimes.
- 📊 **Visual Analytics**: Interactive completion trends, category breakdowns, and achievements.
- ☁️ **Firestore Sync**: Automatic local-first caching with optional Firebase cloud sync.

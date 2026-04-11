# 💬 Full-Stack Realtime Chat App

A feature-rich, full-stack real-time chat application designed for seamless communication. This platform supports 1-on-1 conversations, group chats, online status indicators, rich media sharing (such as profile picture uploads via Cloudinary), and real-time video calling features.

![App Demo](/frontend/public/screenshot-for-readme.png)

## ✨ Key Features

- **🛡️ Secure Authentication:** JWT-based user authentication and secure authorization routes.
- **⚡ Real-Time Messaging:** Instantaneous message delivery powered by `Socket.io`.
- **🟢 Active Presence Engine:** Live tracking of users' online/offline statuses.
- **👥 Group Chats:** Participate in multi-user group conversations with custom group info and participant lists.
- **📹 Video Calling Interface:** Integrated interface for premium live audio and video streaming.
- **🖼️ Profile & Media Handling:** Smooth image uploads and profile photo enhancements via Cloudinary.
- **🎨 Modern UI/UX:** A clean, responsive interface built with fully customized Tailwind CSS and DaisyUI.
- **🧠 Global State Management:** Predictable state updates with Zustand.
- **🐛 Robust Error Handling:** Comprehensive server-side and client-side error management.

## 💻 Tech Stack

- **Frontend:** React.js, Vite, TailwindCSS, DaisyUI, Zustand (State Management)
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (via Mongoose)
- **Real-Time Communication:** WebSockets (Socket.io)
- **Media Storage:** Cloudinary

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js and MongoDB installed on your system.

### 1. Environment Variables Setup
Create a `.env` file in the **backend** directory (or if running from the root, ensure your environments are correctly configured according to how your server handles them) and add the following:

```env
MONGODB_URI=your_mongodb_connection_string
PORT=5001
JWT_SECRET=your_jwt_secret_key

# Cloudinary Setup for Media Uploads
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

NODE_ENV=development
```

### 2. Installation & Build
This repository includes a root `package.json` file which makes building the fullstack application extremely simple. Just run this command from the root directory to install dependencies for both the frontend and backend, and to build the frontend assets:

```bash
npm run build
```

*(This runs `npm install` on both folders and compiles the Vite production bundle.)*

### 3. Start the Server
Once built, you can start the application backend which will serve the frontend build and initialize the WebSocket connections:

```bash
npm start
```
The application should now be accessible at `http://localhost:5001` (or whatever `PORT` you configured).

## 🤝 Contributing
Contributions, issues, and feature requests are always welcome! Feel free to check the issues page or submit a Pull Request.

## 📝 License
This project is licensed under the ISC License.

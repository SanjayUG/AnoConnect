require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static('public'));

// Create HTTP server
const server = require('http').createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected users and their matching status
const users = new Map();
const waitingQueue = [];
const activeChats = new Map();

class User {
    constructor(ws, username = null) {
        this.id = uuidv4();
        this.ws = ws;
        this.username = username;
        this.partnerId = null;
        this.chatId = null;
        this.isWaiting = false;
    }
}

class Chat {
    constructor(user1Id, user2Id) {
        this.id = uuidv4();
        this.user1Id = user1Id;
        this.user2Id = user2Id;
        this.messages = [];
        this.createdAt = new Date();
    }
}

function findPartner(userId) {
    // Remove user from waiting queue if they were there
    const userIndex = waitingQueue.findIndex(id => id === userId);
    if (userIndex !== -1) {
        waitingQueue.splice(userIndex, 1);
    }

    if (waitingQueue.length > 0) {
        // Match with first person in queue
        const partnerId = waitingQueue.shift();
        const user = users.get(userId);
        const partner = users.get(partnerId);

        if (user && partner && user.ws.readyState === WebSocket.OPEN && partner.ws.readyState === WebSocket.OPEN) {
            // Create new chat
            const chat = new Chat(userId, partnerId);
            activeChats.set(chat.id, chat);

            // Update user states
            user.partnerId = partnerId;
            user.chatId = chat.id;
            user.isWaiting = false;

            partner.partnerId = userId;
            partner.chatId = chat.id;
            partner.isWaiting = false;

            // Notify both users
            user.ws.send(JSON.stringify({
                type: 'chat_started',
                chatId: chat.id,
                partnerId: partnerId
            }));

            partner.ws.send(JSON.stringify({
                type: 'chat_started',
                chatId: chat.id,
                partnerId: userId
            }));

            return true;
        }
    }

    // No partner found, add to waiting queue
    if (!waitingQueue.includes(userId)) {
        waitingQueue.push(userId);
        const user = users.get(userId);
        if (user) {
            user.isWaiting = true;
            user.ws.send(JSON.stringify({
                type: 'waiting',
                message: 'Looking for a stranger to chat with...'
            }));
        }
    }

    return false;
}

function endChat(userId) {
    const user = users.get(userId);
    if (!user) return;

    const partnerId = user.partnerId;
    const chatId = user.chatId;

    if (partnerId && chatId) {
        const partner = users.get(partnerId);
        const chat = activeChats.get(chatId);

        // Notify partner that chat ended
        if (partner && partner.ws.readyState === WebSocket.OPEN) {
            partner.ws.send(JSON.stringify({
                type: 'chat_ended',
                message: 'Stranger has disconnected'
            }));
            // Reset partner state
            partner.partnerId = null;
            partner.chatId = null;
            partner.isWaiting = false;
        }

        // Clean up
        activeChats.delete(chatId);
    }

    // Reset user state
    user.partnerId = null;
    user.chatId = null;
    user.isWaiting = false;

    // Remove from waiting queue if present
    const userIndex = waitingQueue.findIndex(id => id === userId);
    if (userIndex !== -1) {
        waitingQueue.splice(userIndex, 1);
    }
}

function broadcastMessage(chatId, senderId, message) {
    const chat = activeChats.get(chatId);
    if (!chat) return;

    const sender = users.get(senderId);
    const partnerId = chat.user1Id === senderId ? chat.user2Id : chat.user1Id;
    const partner = users.get(partnerId);

    const messageObj = {
        id: uuidv4(),
        senderId,
        senderName: sender ? sender.username : 'User',
        partnerId,
        partnerName: partner ? partner.username : 'User',
        message,
        timestamp: new Date()
    };

    chat.messages.push(messageObj);

    // Send to both users in the chat
    [chat.user1Id, chat.user2Id].forEach(userId => {
        const user = users.get(userId);
        if (user && user.ws.readyState === WebSocket.OPEN) {
            user.ws.send(JSON.stringify({
                type: 'message',
                chatId,
                messageId: messageObj.id,
                senderId,
                senderName: messageObj.senderName,
                partnerId: messageObj.partnerId,
                partnerName: messageObj.partnerName,
                message,
                timestamp: messageObj.timestamp,
                isOwn: userId === senderId
            }));
        }
    });
}

wss.on('connection', (ws) => {
    let user = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());

            // First message should be username
            if (!user && message.type === 'set_username' && message.username) {
                user = new User(ws, message.username);
                users.set(user.id, user);
                console.log(`User ${user.id} (${user.username}) connected. Total users: ${users.size}`);
                ws.send(JSON.stringify({
                    type: 'connected',
                    userId: user.id,
                    username: user.username,
                    message: 'Connected to AnoConnect'
                }));
                return;
            }

            if (!user) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Username required.'
                }));
                return;
            }

            switch (message.type) {
                case 'find_partner':
                    findPartner(user.id);
                    break;

                case 'send_message':
                    if (user.chatId && user.partnerId && message.message.trim()) {
                        broadcastMessage(user.chatId, user.id, message.message.trim());
                    }
                    break;

                case 'end_chat':
                    endChat(user.id);
                    break;

                case 'new_chat':
                    endChat(user.id);
                    setTimeout(() => findPartner(user.id), 100);
                    break;

                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        if (user) {
            console.log(`User ${user.id} (${user.username}) disconnected`);
            endChat(user.id);
            users.delete(user.id);
            console.log(`Total users: ${users.size}`);
        }
    });

    ws.on('error', (error) => {
        if (user) {
            console.error('WebSocket error:', error);
            endChat(user.id);
            users.delete(user.id);
        }
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`AnoConnect server running on http://localhost:${PORT}`);
    console.log(`WebSocket server ready for connections`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    wss.close(() => {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
});

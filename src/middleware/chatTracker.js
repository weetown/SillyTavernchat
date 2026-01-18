import systemMonitor from '../system-monitor.js';


export default function chatTrackerMiddleware() {
    return (request, response, next) => {
        const chatEndpoints = [
            '/api/chats/save',
            '/api/chats/group/save',
            '/api/backends/chat-completions/generate',
            '/api/backends/text-completions/generate',
            '/api/generate',
            '/api/openai/generate'
        ];

        const isChatEndpoint = chatEndpoints.some(endpoint =>
            request.path === endpoint ||
            request.path.includes('/generate') ||
            request.path.includes('/save')
        );

        if (!isChatEndpoint) {
            return next();
        }

        const userHandle = request.user?.profile?.handle || 'anonymous';

        const originalSend = response.send;
        const originalJson = response.json;

        function trackChatActivity() {
            if (response.chatTracked) return;
            response.chatTracked = true;

            try {
                if (request.path === '/api/chats/save' && request.method === 'POST') {
                    const chatData = request.body.chat;
                    if (chatData && Array.isArray(chatData)) {
                        if (process.env.NODE_ENV === 'development') {
                            console.log(`Tracked chat save: ${chatData.length} messages`);
                        }
                        chatData.forEach(message => {
                            if (message.mes && message.send_date) {
                                const messageType = message.is_user ? 'user' : 'character';
                                const messageData = {
                                    content: message.mes,
                                    characterName: message.name || 'Unknown character',
                                    timestamp: new Date(message.send_date).getTime()
                                };

                                systemMonitor.recordUserChatActivity(userHandle, messageType, messageData);
                            }
                        });
                    }
                } else if (request.path === '/api/chats/group/save' && request.method === 'POST') {
                    const chatData = request.body.chat;
                    if (chatData && Array.isArray(chatData)) {
                        if (process.env.NODE_ENV === 'development') {
                            console.log(`Tracked group chat save: ${chatData.length} messages`);
                        }
                        chatData.forEach(message => {
                            if (message.mes && message.send_date) {
                                const messageType = message.is_user ? 'user' : 'character';
                                const messageData = {
                                    content: message.mes,
                                    characterName: message.name || 'Group chat',
                                    timestamp: new Date(message.send_date).getTime()
                                };

                                systemMonitor.recordUserChatActivity(userHandle, messageType, messageData);
                            }
                        });
                    }
                } else if (request.path.includes('/generate') && request.method === 'POST') {
                    if (response.statusCode === 200) {
                        let userMessage = '';
                        let characterName = 'Unknown character';

                        if (request.body.messages && Array.isArray(request.body.messages)) {
                            const lastMessage = request.body.messages[request.body.messages.length - 1];
                            userMessage = lastMessage?.content || lastMessage?.text || '';
                        } else if (request.body.prompt) {
                            userMessage = request.body.prompt;
                        } else if (request.body.text) {
                            userMessage = request.body.text;
                        }

                        if (request.body.character_name) {
                            characterName = request.body.character_name;
                        } else if (request.body.name) {
                            characterName = request.body.name;
                        }

                        if (userMessage) {
                            const requestData = {
                                content: userMessage,
                                characterName: characterName,
                                timestamp: Date.now(),
                                isGeneration: true
                            };

                            systemMonitor.recordUserChatActivity(userHandle, 'user', requestData);
                        }
                    }
                }
            } catch (error) {
                console.error('Chat tracking error:', error);
            }
        }

        response.send = function(body) {
            trackChatActivity();
            return originalSend.call(this, body);
        };

        response.json = function(obj) {
            trackChatActivity();
            return originalJson.call(this, obj);
        };

        response.on('finish', trackChatActivity);
        response.on('close', trackChatActivity);

        next();
    };
}


export function recordChatMessage(userHandle, messageType, messageData) {
    try {
        systemMonitor.recordUserChatActivity(userHandle, messageType, messageData);
    } catch (error) {
        console.error('Failed to record chat message:', error);
    }
}


export function recordChatHistory(userHandle, chatHistory) {
    try {
        if (!Array.isArray(chatHistory)) return;

        chatHistory.forEach(message => {
            if (message.mes && message.send_date) {
                const messageType = message.is_user ? 'user' : 'character';
                const messageData = {
                    content: message.mes,
                    characterName: message.name || 'Unknown',
                    timestamp: new Date(message.send_date).getTime(),

                };

                systemMonitor.recordUserChatActivity(userHandle, messageType, messageData);
            }
        });

        console.log(`Imported ${chatHistory.length} chat messages for user ${userHandle}`);
    } catch (error) {
        console.error('Failed to import chat history:', error);
    }
}

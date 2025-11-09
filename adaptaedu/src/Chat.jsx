import React, { useState, useEffect } from 'react';
import ChatMessages from './components/ChatMessages.jsx';
import ChatInput from './components/ChatInput.jsx';
import ContentSidebar from './components/ContentSidebar.jsx';
import './Chat.css';

const API_URL = 'https://adaptaedu-api.vercel.app/api';

const ASK_NAME_MESSAGE = {
    role: 'assistant',
    data: {
        resposta: `Olá! 👋 Como você gostaria de ser chamado?`,
        tipo: 'resposta'
    }
};

const GREETING_MESSAGE = (nome) => ({
    role: 'assistant',
    data: {
        resposta: `Prazer em conhecer você, ${nome}! 🎉\n\nSou o **Edu**, seu assistente educacional inteligente!\nEstou aqui para ajudar você a aprender de forma personalizada e interativa. \n\nComo posso te ajudar hoje?`,
        tipo: 'resposta'
    }
});

function Chat({ onBackToHome }) {
    const [conversationId, setConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sidebarContent, setSidebarContent] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showGreeting, setShowGreeting] = useState(true);
    const [userName, setUserName] = useState(null);
    const [waitingForName, setWaitingForName] = useState(true);

    useEffect(() => {
        if (showGreeting) {
            const timer = setTimeout(() => {
                setMessages([ASK_NAME_MESSAGE]);
                setIsLoading(false);
                setShowGreeting(false);
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [showGreeting]);

    const handleSendMessage = async (message) => {
        setMessages(prev => [...prev, { role: 'user', content: message }]);

        if (waitingForName) {
            setUserName(message);
            setWaitingForName(false);
            setIsLoading(true);
            setTimeout(() => {
                setMessages(prev => [...prev, GREETING_MESSAGE(message)]);
                setIsLoading(false);
            }, 500);
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mensagem: message,
                    conversationId: conversationId
                })
            });

            const data = await response.json();

            console.log(data)

            if (data.conversationId) {
                setConversationId(data.conversationId);
            }

            setMessages(prev => [...prev, { role: 'assistant', data }]);

        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Erro ao se comunicar com o servidor.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewChat = () => {
        setConversationId(null);
        setMessages([]);
        setIsSidebarOpen(false);
        setSidebarContent(null);
        setIsLoading(true);
        setShowGreeting(true);
        setUserName(null);
        setWaitingForName(true);
    };

    const handleOpenContent = (content) => {
        setSidebarContent(content);
        setIsSidebarOpen(true);
    };


    return (
        <>
            <div className="chat-container">
                <div className="chat-header">

                    <button className="btn-new-chat" onClick={onBackToHome}>
                        <span className="btn-icon">←</span>
                        <span className="btn-text">Início</span>

                    </button>

                    <button className="btn-new-chat" onClick={handleNewChat}>
                        <span className="btn-icon">+</span>
                        <span className="btn-text">Nova Conversa</span>
                    </button>

                </div>

                <div className="chat-wrapper">
                    <div className="chat-content">
                        <ChatMessages
                            messages={messages}
                            isLoading={isLoading}
                            onSelectOption={handleSendMessage}
                            onOpenContent={handleOpenContent}
                            userName={userName}
                        />

                    </div>

                </div>

                <ChatInput
                    onSendMessage={handleSendMessage}
                    disabled={isLoading}
                />


            </div>
            <ContentSidebar
                isOpen={isSidebarOpen}
                content={sidebarContent}
                onClose={() => setIsSidebarOpen(false)}
            />
        </>

    );
}

export default Chat;